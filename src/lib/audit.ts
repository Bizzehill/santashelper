'use client'
import { getApp } from 'firebase/app'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { auth } from '@/lib/firebase'

// PII-safe audit logging helper. Writes to families/{familyId}/audit with a 30d TTL hint via expireAt.
// Do not include emails, full names, or raw PINs. Keep metadata minimal.
export async function logAuditEvent(event: 'parentGate.open', meta?: Record<string, unknown>) {
  const user = auth.currentUser
  if (!user) return // skip if unauthenticated
  const familyId = user.uid // assumption: uid is familyId
  const app = getApp()
  const db = getFirestore(app)
  try {
    const ttlMs = 30 * 24 * 60 * 60 * 1000
    const expireAt = new Date(Date.now() + ttlMs)
    await addDoc(collection(db, 'families', familyId, 'audit'), {
      event,
      meta: meta || {},
      createdAt: serverTimestamp(),
      expireAt,
      source: 'client',
    })
  } catch (e) {
    // Best-effort only; don't throw
    // eslint-disable-next-line no-console
    console.warn('audit log skipped', e)
  }
}
