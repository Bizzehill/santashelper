import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) initializeApp()

// Parent-initiated, irreversible deletion of everything tied to a family:
// the family doc (parent PIN, settings, audit log, child sessions), the
// parent's user doc and every child under it (wishlist, deeds,
// affirmations), any share-link tokens they created, and finally the
// Firebase Auth account itself so it can't just be signed back into.
export const deleteFamilyData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const uid = request.auth.uid
  const role = (request.auth.token as Record<string, unknown>)['role'] as string | undefined
  if (role !== 'parent') throw new HttpsError('permission-denied', 'Parent role required')

  const db = getFirestore()

  try {
    const tokens = await db.collection('shareTokens').where('parentId', '==', uid).get()
    if (!tokens.empty) {
      const batch = db.batch()
      tokens.forEach((doc) => batch.delete(doc.ref))
      await batch.commit()
    }

    await db.recursiveDelete(db.doc(`families/${uid}`))
    await db.recursiveDelete(db.doc(`users/${uid}`))

    await getAuth().deleteUser(uid)

    return { ok: true }
  } catch (e) {
    console.error('deleteFamilyData failed', e)
    throw new HttpsError('internal', 'Could not delete all data. Please try again or contact support.')
  }
})
