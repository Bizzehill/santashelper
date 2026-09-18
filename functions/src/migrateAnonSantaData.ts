import * as admin from 'firebase-admin'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

if (!admin.apps.length) admin.initializeApp()

// Migrates a kid's "try it before you link" scratch data into their real,
// parent-visible child record once they successfully link a family.
// Source: users/{fromUid}/anonSanta/data/{wishlist|deeds}
// Destination: users/{familyId}/children/{childId}/{wishlist|deeds}
export async function migrateAnonSantaData(params: { fromUid: string; familyId: string; childId: string }) {
  const { fromUid, familyId, childId } = params
  const db = getFirestore()

  const sourceWishlist = db.collection(`users/${fromUid}/anonSanta/data/wishlist`)
  const sourceDeeds = db.collection(`users/${fromUid}/anonSanta/data/deeds`)
  const destWishlist = db.collection(`users/${familyId}/children/${childId}/wishlist`)
  const destDeeds = db.collection(`users/${familyId}/children/${childId}/deeds`)

  try {
    const [wishlistSnap, deedsSnap] = await Promise.all([sourceWishlist.get(), sourceDeeds.get()])
    if (wishlistSnap.empty && deedsSnap.empty) return
    const batch = db.batch()
    wishlistSnap.forEach((d) => {
      batch.set(destWishlist.doc(), {
        ...d.data(),
        migratedAt: FieldValue.serverTimestamp(),
        migratedFrom: fromUid,
      })
    })
    deedsSnap.forEach((d) => {
      batch.set(destDeeds.doc(), {
        ...d.data(),
        migratedAt: FieldValue.serverTimestamp(),
        migratedFrom: fromUid,
      })
    })
    await batch.commit()
  } catch (e) {
    console.error('migrateAnonSantaData: migration failed (non-fatal)', e)
  }
}
