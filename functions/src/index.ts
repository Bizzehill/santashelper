import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
type FirestoreTransaction = admin.firestore.Transaction
import * as crypto from 'crypto'
import * as bcrypt from 'bcryptjs'

if (!admin.apps.length) {
  admin.initializeApp()
}

// Environment variable (Functions config) must provide the salted+hashed PIN or a secret used for hashing
// Recommended: store a bcrypt hash and compare using bcrypt. For simplicity, we use HMAC-SHA256 with a secret.
const PIN_HASH_SECRET = process.env.PIN_HASH_SECRET || ''

function hmac(pin: string) {
  const h = crypto.createHmac('sha256', PIN_HASH_SECRET)
  h.update(pin)
  return h.digest('hex')
}

export const verifyParentPin = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  // Enforce authentication to associate attempts to a user; adjust if you support anon
  const callerUid = context.auth?.uid
  if (!callerUid) {
    return { ok: false, code: 'UNAUTHENTICATED', message: 'Authentication required' }
  }

  // Accept both legacy string or object input; default familyId to caller uid
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

export const setParentPin = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required')
  }
  const callerUid = context.auth.uid
  const token = context.auth.token as Record<string, unknown>
  const isAdmin = token['role'] === 'admin' || token['admin'] === true

  const pin: string = (data?.pin as string | undefined)?.trim() || ''
  const ttl: number | undefined = typeof data?.ttlMinutes === 'number' ? data.ttlMinutes : undefined
  const familyId: string = (data?.familyId as string | undefined) || callerUid

  if (!/^[0-9]{4,8}$/.test(pin)) {
    throw new functions.https.HttpsError('invalid-argument', 'PIN must be 4–8 digits')
  }
  if (ttl !== undefined && (ttl < 5 || ttl > 60)) {
    throw new functions.https.HttpsError('invalid-argument', 'TTL must be between 5 and 60 minutes')
  }
  // Only allow setting another family's PIN if admin
  if (familyId !== callerUid && !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed')
  }
  // Caller must be parent or admin
  if (!(token['role'] === 'parent' || isAdmin)) {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed')
  }

  try {
  const dbi = admin.firestore()
  const settingsRef = dbi.doc(`families/${familyId}/settings`)
    const hash = await bcrypt.hash(pin, 10)
    const payload: any = {
      parentPinHash: hash,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    }
    if (ttl !== undefined) payload.parentSessionTTLMinutes = ttl
    await settingsRef.set(payload, { merge: true })
    return { ok: true }
  } catch (e: any) {
    console.error('setParentPin error', e)
    throw new functions.https.HttpsError('internal', 'Unable to update settings')
  }
})

export const setParentRole = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  // Must be signed in
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required')
  }
  // Allow only admin callers (either role=='admin' or admin=true claim)
  const caller = context.auth.token as Record<string, unknown>
  const isAdmin = caller['role'] === 'admin' || caller['admin'] === true
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin privileges required')
  }

  const uid = (data?.uid as string | undefined)?.trim()
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Parameter "uid" is required')
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
    throw new functions.https.HttpsError('internal', e?.message || 'Failed to set parent role')
  }
})
