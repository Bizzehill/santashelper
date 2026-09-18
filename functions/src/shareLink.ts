import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import * as crypto from 'crypto'

if (!admin.apps.length) admin.initializeApp()

function shareDocId(parentId: string, childId: string) {
  return `${parentId}_${childId}`
}

// Parent-only: mint (or rotate) a share token for one child's wishlist.
export const createShareLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const uid = request.auth.uid
  const role = (request.auth.token as Record<string, unknown>)['role'] as string | undefined
  if (role !== 'parent') throw new HttpsError('permission-denied', 'Parent role required')

  const data = request.data as { childId?: string }
  const childId = (data?.childId || '').trim()
  if (!childId) throw new HttpsError('invalid-argument', 'childId is required')

  const db = getFirestore()
  const childRef = db.doc(`users/${uid}/children/${childId}`)
  const childSnap = await childRef.get()
  if (!childSnap.exists) throw new HttpsError('not-found', 'Child not found')
  const childName = (childSnap.data() as { name?: string })?.name || 'this child'

  const token = crypto.randomBytes(16).toString('hex')
  const tokenRef = db.doc(`shareTokens/${shareDocId(uid, childId)}`)
  await tokenRef.set({
    token,
    parentId: uid,
    childId,
    childName,
    createdAt: FieldValue.serverTimestamp(),
  })

  return { ok: true, token, parentId: uid, childId }
})

// Public: no sign-in required. Validates the token server-side (Admin SDK bypasses
// rules) and returns only what a shared wishlist page needs -- never a raw Firestore read.
export const getSharedWishlist = onCall(async (request) => {
  const data = request.data as { parentId?: string; childId?: string; token?: string }
  const parentId = (data?.parentId || '').trim()
  const childId = (data?.childId || '').trim()
  const token = (data?.token || '').trim()
  if (!parentId || !childId || !token) {
    return { ok: false as const, error: 'MISSING_PARAMS' as const }
  }

  const db = getFirestore()
  const tokenSnap = await db.doc(`shareTokens/${shareDocId(parentId, childId)}`).get()
  if (!tokenSnap.exists) return { ok: false as const, error: 'NOT_FOUND' as const }
  const stored = tokenSnap.data() as { token?: string; childName?: string }
  if (!stored.token || stored.token !== token) return { ok: false as const, error: 'INVALID_TOKEN' as const }

  const wishlistSnap = await db
    .collection(`users/${parentId}/children/${childId}/wishlist`)
    .orderBy('createdAt', 'desc')
    .get()

  const items = wishlistSnap.docs.map((d) => {
    const w = d.data() as { name?: string; description?: string | null; url?: string | null; image?: string | null }
    return {
      id: d.id,
      name: w.name || 'Untitled gift',
      description: w.description ?? null,
      url: w.url ?? null,
      image: w.image ?? null,
    }
  })

  return { ok: true as const, childName: stored.childName || 'this child', items }
})
