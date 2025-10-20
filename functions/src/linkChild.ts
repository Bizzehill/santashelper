import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import * as bcrypt from 'bcryptjs'
import { migrateAnonSantaData } from './migrateAnonSantaData'

if (!admin.apps.length) admin.initializeApp()

export const linkChild = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const callerUid = request.auth.uid
  const data: any = request.data
  const familyCode: string = (data?.familyCode as string | undefined)?.trim() || ''
  const childName: string = (data?.childName as string | undefined)?.trim() || ''
  const pin: string = (data?.pin as string | undefined)?.trim() || ''
  if (!familyCode || !childName || !/^[0-9]{4,6}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'familyCode, childName and 4–6 digit pin are required')
  }

  const db = admin.firestore()
  // Look up family by code (for now, treat familyCode as familyId; otherwise query families by familyCode)
  let familyId: string | null = null
  // Simple path for now: familyCode === familyId
  familyId = familyCode
  const settingsRef = db.doc(`families/${familyId}/settings`)
  const settingsSnap = await settingsRef.get()
  if (!settingsSnap.exists) return { ok: false, code: 'INVALID_CODE' as const }

  // Find child by name (case-insensitive via nameLower)
  const children = await db.collection(`users/${familyId}/children`).where('nameLower', '==', childName.toLowerCase()).limit(1).get()
  if (children.empty) return { ok: false, code: 'CHILD_NOT_FOUND' as const }
  const childDoc = children.docs[0]
  const childId = childDoc.id
  const child = childDoc.data() as any
  const hash = child.childPinHash as string | undefined
  if (!hash) return { ok: false, code: 'PIN_NOT_SET' as const }
  const match = await bcrypt.compare(pin, hash)
  if (!match) return { ok: false, code: 'WRONG_PIN' as const }

  // Check if already linked
  const sessionRef = db.doc(`families/${familyId}/childSessions/${callerUid}`)
  const sessionSnap = await sessionRef.get()
  if (sessionSnap.exists) {
    const s = sessionSnap.data() as any
    if (s.allowedChildId === childId && (s.expireAt?.toMillis?.() || 0) > Date.now()) {
      return { ok: false, code: 'ALREADY_LINKED' as const }
    }
  }

  // Update user to linked child role and mirror family link
  const userRef = db.doc(`users/${callerUid}`)
  await userRef.set({ role: 'child_linked', familyId, childId, roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
  // Optionally set auth custom claims (kept minimal; role can be mirrored by server-only logic)
  try {
    const rec = await admin.auth().getUser(callerUid)
    const claims = { ...(rec.customClaims || {}) } as Record<string, unknown>
    if (claims['role'] !== 'child_linked') {
      await admin.auth().setCustomUserClaims(callerUid, { ...claims, role: 'child_linked' })
      await admin.auth().revokeRefreshTokens(callerUid)
    }
  } catch (e) {
    console.error('linkChild: set claims failed', e)
  }

  // Mark child as linked to this uid
  await childDoc.ref.set({ linkedUID: callerUid, linkedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })

  // Migrate anon data (best-effort)
  try {
    await migrateAnonSantaData({ fromUid: callerUid, familyId, childId })
  } catch (e) {
    console.error('linkChild: migration failed (non-fatal)', e)
  }

  // Start child session (1h)
  const ttlMinutes = 60
  const expiresAtMs = Date.now() + ttlMinutes * 60 * 1000
  await sessionRef.set({
    allowedChildId: childId,
    expireAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  return { ok: true as const, familyId, childId, expiresAtEpochMs: expiresAtMs }
})
