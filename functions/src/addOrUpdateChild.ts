import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import * as bcrypt from 'bcryptjs'

if (!admin.apps.length) admin.initializeApp()

export const addOrUpdateChild = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required')
  const uid = request.auth.uid
  const role = (request.auth.token as any)['role'] as string | undefined
  if (role !== 'parent') throw new HttpsError('permission-denied', 'Parent role required')

  const data: any = request.data
  const childId: string | undefined = (data?.childId as string | undefined)?.trim() || undefined
  const name: string = (data?.name as string | undefined)?.trim() || ''
  const pin: string = (data?.pin as string | undefined)?.trim() || ''
  const avatar: string | undefined = (data?.avatar as string | undefined) || undefined
  if (!name) throw new HttpsError('invalid-argument', 'name is required')
  if (!/^[0-9]{4,6}$/.test(pin)) throw new HttpsError('invalid-argument', 'PIN must be 4–6 digits')

  const db = admin.firestore()
  const childrenCol = db.collection(`users/${uid}/children`)

  try {
    // If childId given, update that doc directly
    if (childId) {
      const ref = childrenCol.doc(childId)
      const hash = await bcrypt.hash(pin, 10)
      await ref.set({
        name,
        nameLower: name.toLowerCase(),
        avatar,
        childPinHash: hash,
        childPinStatus: 'set',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      }, { merge: true })
      return { childId }
    }

    // Idempotent by name (case-insensitive)
    const q = await childrenCol.where('nameLower', '==', name.toLowerCase()).limit(1).get()
    if (!q.empty) {
      const existingRef = q.docs[0].ref
      const hash = await bcrypt.hash(pin, 10)
      await existingRef.set({
        name,
        nameLower: name.toLowerCase(),
        avatar,
        childPinHash: hash,
        childPinStatus: 'set',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      }, { merge: true })
      return { childId: existingRef.id }
    }

    // Create new child
    const ref = childrenCol.doc()
    const hash = await bcrypt.hash(pin, 10)
    const payload: any = {
      name,
      nameLower: name.toLowerCase(),
      avatar,
      childPinHash: hash,
      childPinStatus: 'set',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    }
    await ref.set(payload, { merge: true })
    return { childId: ref.id }
  } catch (e: any) {
    console.error('addOrUpdateChild error', e)
    throw new HttpsError('internal', 'Failed to add/update child')
  }
})
