import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

if (!getApps().length) initializeApp()

function genFamilyCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // avoid ambiguous chars
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export const createFamilyOnSignup = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const asParent: boolean = request.data?.asParent !== false // default true
  if (!asParent) throw new HttpsError('invalid-argument', 'Only parent onboarding is supported')
  const uid = request.auth.uid
  const db = getFirestore()

  const userRef = db.doc(`users/${uid}`)
  const familyId = uid
  // The parent PIN and its settings live directly on this document, alongside
  // familyCode/parentUIDs -- a fixed-name "settings" child would be a Firestore
  // *collection* path, not a document, so it can never be read or written.
  const familyRef = db.doc(`families/${familyId}`)

  const [familySnap] = await Promise.all([familyRef.get()])

  let familyCode: string | undefined = familySnap.exists ? (familySnap.data() as any)?.familyCode : undefined
  if (!familySnap.exists) {
    familyCode = genFamilyCode()
    await familyRef.set({
      familyCode,
      parentUIDs: [uid],
      pinStatus: 'unset',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    }, { merge: true })
  } else {
    const updates: any = {}
    const data = familySnap.data() as any
    if (!data?.familyCode) updates.familyCode = familyCode = genFamilyCode()
    if (!Array.isArray(data?.parentUIDs) || !data.parentUIDs.includes(uid)) {
      updates.parentUIDs = Array.isArray(data?.parentUIDs) ? Array.from(new Set([...(data.parentUIDs as string[]), uid])) : [uid]
    }
    if (!data?.pinStatus) updates.pinStatus = 'unset'
    if (Object.keys(updates).length) {
      await familyRef.set(updates, { merge: true })
    }
    if (!familyCode) familyCode = (await familyRef.get()).data()?.familyCode
  }

  const userUpdates: any = {
    role: 'parent',
    familyId,
    roleUpdatedAt: FieldValue.serverTimestamp(),
  }
  await userRef.set(userUpdates, { merge: true })

  // Ensure auth custom claims include role=parent
  try {
    const rec = await getAuth().getUser(uid)
    const existing = (rec.customClaims || {}) as Record<string, unknown>
    if (existing['role'] !== 'parent') {
      await getAuth().setCustomUserClaims(uid, { ...existing, role: 'parent' })
      await getAuth().revokeRefreshTokens(uid)
    }
  } catch (e) {
    // Non-fatal: log and continue
    console.error('createFamilyOnSignup: set claims failed', e)
  }

  return { familyId, familyCode }
})
