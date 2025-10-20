import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

if (!admin.apps.length) admin.initializeApp()

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
  const db = admin.firestore()

  const userRef = db.doc(`users/${uid}`)
  const familyId = uid // keep compatibility with existing code expecting familyId === parent uid
  const familyRef = db.doc(`families/${familyId}`)
  const settingsRef = db.doc(`families/${familyId}/settings`)

  // Read current state
  const [userSnap, familySnap, settingsSnap] = await Promise.all([
    userRef.get(),
    familyRef.get(),
    settingsRef.get(),
  ])

  // Ensure family doc exists with a code and parentUIDs
  let familyCode: string | undefined = familySnap.exists ? (familySnap.data() as any)?.familyCode : undefined
  if (!familySnap.exists) {
    familyCode = genFamilyCode()
    await familyRef.set({
      familyCode,
      parentUIDs: [uid],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    }, { merge: true })
  } else {
    const updates: any = {}
    const data = familySnap.data() as any
    if (!data?.familyCode) updates.familyCode = familyCode = genFamilyCode()
    if (!Array.isArray(data?.parentUIDs) || !data.parentUIDs.includes(uid)) {
      updates.parentUIDs = Array.isArray(data?.parentUIDs) ? Array.from(new Set([...(data.parentUIDs as string[]), uid])) : [uid]
    }
    if (Object.keys(updates).length) {
      await familyRef.set(updates, { merge: true })
    }
    if (!familyCode) familyCode = (await familyRef.get()).data()?.familyCode
  }

  // Ensure settings doc exists with pinStatus: 'unset'
  if (!settingsSnap.exists) {
    await settingsRef.set({ pinStatus: 'unset', createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: uid }, { merge: true })
  }

  // Ensure user doc has role and familyId
  const userUpdates: any = {
    role: 'parent',
    familyId,
    roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
  await userRef.set(userUpdates, { merge: true })

  // Ensure auth custom claims include role=parent
  try {
    const rec = await admin.auth().getUser(uid)
    const existing = (rec.customClaims || {}) as Record<string, unknown>
    if (existing['role'] !== 'parent') {
      await admin.auth().setCustomUserClaims(uid, { ...existing, role: 'parent' })
      await admin.auth().revokeRefreshTokens(uid)
    }
  } catch (e) {
    // Non-fatal: log and continue
    console.error('createFamilyOnSignup: set claims failed', e)
  }

  return { familyId, familyCode }
})
