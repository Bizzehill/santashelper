import * as functionsV1 from 'firebase-functions/v1'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
type FirestoreTransaction = admin.firestore.Transaction
import * as bcrypt from 'bcryptjs'

if (!admin.apps.length) admin.initializeApp()

// Note: parent PINs and child PINs are stored using bcrypt hashes in Firestore settings and compared with bcrypt.

export const verifyParentPin = onCall(async (request) => {
  // Enforce authentication to associate attempts to a user; adjust if you support anon
  const callerUid = request.auth?.uid
  if (!callerUid) {
    return { ok: false, code: 'UNAUTHENTICATED', message: 'Authentication required' }
  }

  // Accept both legacy string or object input; default familyId to caller uid
  const data: any = request.data
  const pin: string = (typeof data === 'string' ? data : (data?.pin as string | undefined))?.trim() || ''
  const familyId: string = (typeof data === 'object' ? (data?.familyId as string | undefined) : undefined) || callerUid

  if (!/^[0-9]{4,8}$/.test(pin)) {
    return { ok: false, code: 'INVALID_ARGUMENT', message: 'PIN must be 4–8 digits' }
  }

  const db = admin.firestore()
  const settingsRef = db.doc(`families/${familyId}/settings`)
  const guardRef = db.collection('families').doc(familyId).collection('private').doc('pinGuard')

  const nowTs = admin.firestore.Timestamp.now()
  const nowMs = Date.now()

  // Defaults
  const MAX_ATTEMPTS = 5
  const LOCK_MINUTES = 5

  type TxResult = {
    ok: boolean
    code?: 'UNAUTHENTICATED' | 'INVALID_ARGUMENT' | 'SERVER_MISCONFIGURED' | 'LOCKED' | 'INVALID_PIN'
    message?: string
    expiresAtEpochMs?: number
    ttlMinutes?: number
    remainingAttempts?: number
    lockedUntilEpochMs?: number
    _audit?: Array<{ event: string; meta?: Record<string, unknown> }>
  }

  const result = await db.runTransaction(async (tx: FirestoreTransaction): Promise<TxResult> => {
    const [settingsSnap, guardSnap] = await Promise.all([
      tx.get(settingsRef),
      tx.get(guardRef),
    ])

    const settings = settingsSnap.exists ? settingsSnap.data() as any : {}
    const hash: string | undefined = settings.parentPinHash
    const ttlMinutes: number = typeof settings.parentSessionTTLMinutes === 'number' && settings.parentSessionTTLMinutes > 0 ? settings.parentSessionTTLMinutes : 15

    if (!hash) {
      return { ok: false, code: 'SERVER_MISCONFIGURED', message: 'Parent PIN not configured', _audit: [
        { event: 'parentGate.verify.failure', meta: { reason: 'SERVER_MISCONFIGURED' } },
      ] }
    }

    const guard = guardSnap.exists ? guardSnap.data() as any : {}
    const attemptCount: number = typeof guard.attemptCount === 'number' ? guard.attemptCount : 0
    const lockedUntil = guard.lockedUntil as admin.firestore.Timestamp | undefined

    if (lockedUntil && lockedUntil.toMillis() > nowMs) {
      // Still locked
      const lockedMs = lockedUntil.toMillis()
      return {
        ok: false,
        code: 'LOCKED',
        message: 'Too many attempts. Try again later.',
        lockedUntilEpochMs: lockedMs,
        remainingAttempts: 0,
        _audit: [
          { event: 'parentGate.verify.failure', meta: { reason: 'LOCKED', lockedUntilEpochMs: lockedMs } },
        ],
      }
    }

    // Compare PIN
    const match = await bcrypt.compare(pin, hash)
    if (!match) {
      const nextAttempts = attemptCount + 1
      if (nextAttempts >= MAX_ATTEMPTS) {
        const until = admin.firestore.Timestamp.fromMillis(nowMs + LOCK_MINUTES * 60 * 1000)
        tx.set(guardRef, { attemptCount: 0, lockedUntil: until, lastAttemptAt: nowTs }, { merge: true })
        return {
          ok: false,
          code: 'LOCKED',
          message: 'Too many attempts. Locked for 5 minutes.',
          lockedUntilEpochMs: until.toMillis(),
          remainingAttempts: 0,
          _audit: [
            { event: 'parentGate.verify.failure', meta: { reason: 'INVALID_PIN' } },
            { event: 'lockout.started', meta: { lockedUntilEpochMs: until.toMillis(), durationMinutes: LOCK_MINUTES } },
          ],
        }
      } else {
        tx.set(guardRef, { attemptCount: nextAttempts, lockedUntil: null, lastAttemptAt: nowTs }, { merge: true })
        return {
          ok: false,
          code: 'INVALID_PIN',
          message: 'Invalid PIN',
          remainingAttempts: MAX_ATTEMPTS - nextAttempts,
          _audit: [
            { event: 'parentGate.verify.failure', meta: { reason: 'INVALID_PIN', remainingAttempts: MAX_ATTEMPTS - nextAttempts } },
          ],
        }
      }
    }

    // Success: reset guard and return TTL
    tx.set(guardRef, { attemptCount: 0, lockedUntil: null, lastAttemptAt: nowTs, lastSuccessAt: nowTs }, { merge: true })
    const expiresAtEpochMs = nowMs + ttlMinutes * 60 * 1000
    return { ok: true, expiresAtEpochMs, ttlMinutes, _audit: [ { event: 'parentGate.verify.success', meta: { ttlMinutes } } ] }
  })

  // Lightweight audit logging (PII-safe): write event(s) with 30d TTL
  try {
    const ttlMs = 30 * 24 * 60 * 60 * 1000
    const expireAt = admin.firestore.Timestamp.fromMillis(Date.now() + ttlMs)
    const batch = db.batch()
    for (const evt of result._audit || []) {
      const docRef = db.collection('families').doc(familyId).collection('audit').doc()
      batch.set(docRef, {
        event: evt.event,
        meta: evt.meta || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt,
        source: 'callable',
      })
    }
    if ((result._audit || []).length) {
      await batch.commit()
    }
  } catch (e) {
    console.error('audit log failed', e)
  }

  // Do not leak audit internals to client
  const { _audit, ...publicResult } = result
  return publicResult
})

export const setParentPin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required')
  }
  const callerUid = request.auth.uid
  const token = request.auth.token as Record<string, unknown>
  const role = token['role'] as string | undefined
  if (role !== 'parent') {
    throw new HttpsError('permission-denied', 'Parent role required')
  }

  const data: any = request.data
  const pin: string = (data?.pin as string | undefined)?.trim() || ''
  const ttlMinutes: number | undefined = typeof data?.ttlMinutes === 'number' ? data.ttlMinutes : undefined
  if (!/^[0-9]{4,6}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'PIN must be 4–6 digits')
  }
  if (ttlMinutes !== undefined && (ttlMinutes < 5 || ttlMinutes > 60)) {
    throw new HttpsError('invalid-argument', 'TTL must be between 5 and 60 minutes')
  }

  const dbi = admin.firestore()
  const familyId = callerUid
  const settingsRef = dbi.doc(`families/${familyId}/settings`)

  try {
    await dbi.runTransaction(async (tx: FirestoreTransaction) => {
      const snap = await tx.get(settingsRef)
      const existing = snap.exists ? (snap.data() as any) : {}
      if (existing.parentPinHash) { throw new HttpsError('already-exists', 'Parent PIN already set') }
      const hash = await bcrypt.hash(pin, 10)
      const payload: any = {
        parentPinHash: hash,
        pinStatus: 'set',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: callerUid,
      }
      if (ttlMinutes !== undefined) payload.parentSessionTTLMinutes = ttlMinutes
      tx.set(settingsRef, payload, { merge: true })
    })
    return { ok: true }
  } catch (e: any) {
    if (e instanceof HttpsError) throw e
    console.error('setParentPin error', e)
    throw new HttpsError('internal', 'Unable to update settings')
  }
})

export const setParentRole = onCall(async (request) => {
  // Must be signed in
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required')
  }
  // Allow only admin callers (either role=='admin' or admin=true claim)
  const caller = request.auth.token as Record<string, unknown>
  const isAdmin = caller['role'] === 'admin' || caller['admin'] === true
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges required')
  }

  const data: any = request.data
  const uid = (data?.uid as string | undefined)?.trim()
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Parameter "uid" is required')
  }
  try {
    const userRecord = await admin.auth().getUser(uid)
    const existing = (userRecord.customClaims || {}) as Record<string, unknown>
    // Set role=parent, preserving any other custom claims
    await admin.auth().setCustomUserClaims(uid, { ...existing, role: 'parent' })
    // Mirror into Firestore user doc; clients cannot write role directly (enforced in rules)
    await admin.firestore().collection('users').doc(uid).set(
      {
        role: 'parent',
        roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    // Force clients to refresh token to receive new claims
    await admin.auth().revokeRefreshTokens(uid)
    return { ok: true }
  } catch (e: any) {
    console.error('setParentRole error', e)
    throw new HttpsError('internal', e?.message || 'Failed to set parent role')
  }
})

// Seed family settings on first sign-in. Ensures families/{uid}/settings exists with pinStatus: 'unset'.
export const authOnCreate = functionsV1.auth.user().onCreate(async (user) => {
  try {
    const dbi = admin.firestore()
    const uid = user.uid
    const settingsRef = dbi.doc(`families/${uid}/settings`)
    const snap = await settingsRef.get()
    if (snap.exists) return
    await settingsRef.create({
      pinStatus: 'unset',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    })
  } catch (e: any) {
    // If already exists, treat as success; otherwise log for observability
    if (e?.code !== 'already-exists') {
      console.error('authOnCreate seed settings failed', e)
    }
  }
})

export const ensureFamilySettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required')
  }
  const uid = request.auth.uid
  const dbi = admin.firestore()
  const settingsRef = dbi.doc(`families/${uid}/settings`)
  try {
    const snap = await settingsRef.get()
    if (snap.exists) return { ok: true, existed: true }
    await settingsRef.create({
      pinStatus: 'unset',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    })
    return { ok: true, existed: false }
  } catch (e: any) {
    // Treat already-exists as success
    if (e?.code === 'already-exists') return { ok: true, existed: true }
    console.error('ensureFamilySettings failed', e)
    throw new HttpsError('internal', 'Failed to ensure settings')
  }
})

// Allow a newly created user to register as a parent for their own family.
export const registerParent = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const uid = request.auth.uid
  try {
    // If already has role parent, treat as success
    const userRecord = await admin.auth().getUser(uid)
    const existingClaims = (userRecord.customClaims || {}) as Record<string, unknown>
    if (existingClaims['role'] === 'parent') return { ok: true }
    // Set role=parent
    await admin.auth().setCustomUserClaims(uid, { ...existingClaims, role: 'parent' })
    // Mirror into users doc and seed settings
    const dbi = admin.firestore()
    await dbi.collection('users').doc(uid).set({ role: 'parent', roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    const settingsRef = dbi.doc(`families/${uid}/settings`)
    const snap = await settingsRef.get()
    if (!snap.exists) {
      await settingsRef.create({ pinStatus: 'unset', createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: uid })
    }
    // Force token refresh
    await admin.auth().revokeRefreshTokens(uid)
    return { ok: true }
  } catch (e: any) {
    console.error('registerParent error', e)
    throw new HttpsError('internal', 'Failed to register parent')
  }
})

// Per-child PIN management
export const setChildPin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const uid = request.auth.uid
  const role = (request.auth.token as any)['role'] as string | undefined
  if (role !== 'parent') throw new HttpsError('permission-denied', 'Parent role required')
  const data: any = request.data
  const childId: string = (data?.childId as string | undefined)?.trim() || ''
  const pin: string = (data?.pin as string | undefined)?.trim() || ''
  if (!childId) throw new HttpsError('invalid-argument', 'childId is required')
  if (!/^[0-9]{4,6}$/.test(pin)) throw new HttpsError('invalid-argument', 'PIN must be 4–6 digits')
  const dbi = admin.firestore()
  const childRef = dbi.doc(`users/${uid}/children/${childId}`)
  try {
    await dbi.runTransaction(async (tx: FirestoreTransaction) => {
      const snap = await tx.get(childRef)
      const existing = snap.exists ? (snap.data() as any) : {}
  if (existing.childPinHash) throw new HttpsError('already-exists', 'Child PIN already set')
      const hash = await bcrypt.hash(pin, 10)
      tx.set(childRef, { childPinHash: hash, childPinStatus: 'set', updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true })
    })
    return { ok: true }
  } catch (e: any) {
    if (e instanceof HttpsError) throw e
    console.error('setChildPin error', e)
    throw new HttpsError('internal', 'Failed to set child PIN')
  }
})

export const verifyChildPin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const callerUid = request.auth.uid
  const data: any = request.data
  const familyId: string = (data?.familyId as string | undefined)?.trim() || ''
  const childId: string = (data?.childId as string | undefined)?.trim() || ''
  const pin: string = (data?.pin as string | undefined)?.trim() || ''
  if (!familyId || !childId) throw new HttpsError('invalid-argument', 'familyId and childId required')
  if (!/^[0-9]{4,6}$/.test(pin)) throw new HttpsError('invalid-argument', 'PIN must be 4–6 digits')
  const dbi = admin.firestore()
  const childRef = dbi.doc(`users/${familyId}/children/${childId}`)
  try {
    const snap = await childRef.get()
    if (!snap.exists) return { ok: false, code: 'NOT_FOUND' }
    const hash = (snap.data() as any).childPinHash as string | undefined
    if (!hash) return { ok: false, code: 'NOT_SET' }
    const match = await bcrypt.compare(pin, hash)
    if (!match) return { ok: false }
    // On success, create/update a short-lived child session bound to caller uid
    const ttlMinutes = 60 // 1 hour child session
    const expiresAtMs = Date.now() + ttlMinutes * 60 * 1000
    const sessionRef = dbi.doc(`families/${familyId}/childSessions/${callerUid}`)
    await sessionRef.set({
      allowedChildId: childId,
      expireAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    return { ok: true, expiresAtEpochMs: expiresAtMs }
  } catch (e: any) {
    console.error('verifyChildPin error', e)
    throw new HttpsError('internal', 'Verification failed')
  }
})

export { createFamilyOnSignup } from './createFamilyOnSignup'

// Create or update a child under the parent's family. On create, a new childId is generated.
export { addOrUpdateChild } from './addOrUpdateChild'

// Link an authenticated (often anonymous) user to a family's child using a family code + child name + pin.
// - familyCode: for now treated as the familyId (parent uid). Future: support short codes stored in settings.
// - childName: exact match against users/{familyId}/children.name
// - pin: child's PIN
// On success: migrates anon data (if any) and creates a child session for caller.
export { linkChild } from './linkChild'
