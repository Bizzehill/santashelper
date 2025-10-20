import * as admin from 'firebase-admin'

if (!admin.apps.length) admin.initializeApp()

// Helper to migrate anonymous Santa data into the linked child location.
// Supports both of these sources:
// - users/{fromUid}/anonSanta/{wishes|deeds}
// - anon_workspaces/{fromUid}/santa/{wishes|deeds}
// Destination:
// - users/{familyId}/children/{childId}/{wishlist|deeds}
export async function migrateAnonSantaData(params: { fromUid: string; familyId: string; childId: string }) {
  const { fromUid, familyId, childId } = params
  const db = admin.firestore()

  const sources = [
    { wishes: db.collection(`users/${fromUid}/anonSanta/wishes`), deeds: db.collection(`users/${fromUid}/anonSanta/deeds`) },
    { wishes: db.collection(`anon_workspaces/${fromUid}/santa/wishes`), deeds: db.collection(`anon_workspaces/${fromUid}/santa/deeds`) },
  ]

  const wishlistCol = db.collection(`users/${familyId}/children/${childId}/wishlist`)
  const deedsCol = db.collection(`users/${familyId}/children/${childId}/deeds`)

  for (const src of sources) {
    try {
      const [wishesSnap, deedsSnap] = await Promise.all([src.wishes.get(), src.deeds.get()])
      if (wishesSnap.empty && deedsSnap.empty) continue
      const batch = db.batch()
      wishesSnap.forEach((d) => {
        const ref = wishlistCol.doc()
        batch.set(ref, { ...d.data(), migratedAt: admin.firestore.FieldValue.serverTimestamp(), migratedFrom: fromUid })
      })
      deedsSnap.forEach((d) => {
        const ref = deedsCol.doc()
        batch.set(ref, { ...d.data(), migratedAt: admin.firestore.FieldValue.serverTimestamp(), migratedFrom: fromUid })
      })
      await batch.commit()
    } catch (e) {
      console.error('migrateAnonSantaData: source migration failed', e)
      // non-fatal; try next source or continue
    }
  }
}
