'use client'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

type VerifyParentPinResult = {
  ok: boolean
  // error shape
  code?: 'UNAUTHENTICATED' | 'INVALID_ARGUMENT' | 'SERVER_MISCONFIGURED' | 'LOCKED' | 'INVALID_PIN'
  message?: string
  // success shape
  expiresAtEpochMs?: number
  ttlMinutes?: number
  // rate-limit info
  remainingAttempts?: number
  lockedUntilEpochMs?: number
}

export async function verifyParentPin(pin: string, familyId?: string): Promise<VerifyParentPinResult> {
  const fn = httpsCallable<{ pin: string; familyId?: string }, VerifyParentPinResult>(functions, 'verifyParentPin')
  const res = await fn(familyId ? { pin, familyId } : { pin })
  return res.data
}

export async function setParentPin(pin: string, opts?: { ttlMinutes?: number; familyId?: string }): Promise<{ ok: true }> {
  const fn = httpsCallable<{ pin: string; ttlMinutes?: number; familyId?: string }, { ok: true }>(functions, 'setParentPin')
  const res = await fn({ pin, ttlMinutes: opts?.ttlMinutes, familyId: opts?.familyId })
  return res.data
}

// Called once right after a new parent account is created. Grants the role=parent
// custom claim, generates the family's shareable code, and seeds settings.
export async function createFamilyOnSignup(): Promise<{ familyId: string; familyCode?: string }> {
  const fn = httpsCallable<{ asParent: true }, { familyId: string; familyCode?: string }>(functions, 'createFamilyOnSignup')
  const res = await fn({ asParent: true })
  return res.data
}

export async function setChildPin(childId: string, pin: string): Promise<{ ok: true }> {
  const fn = httpsCallable<{ childId: string; pin: string }, { ok: true }>(functions, 'setChildPin')
  const res = await fn({ childId, pin })
  return res.data
}

type VerifyChildPinResult = {
  ok: boolean
  code?: 'NOT_FOUND' | 'NOT_SET'
  expiresAtEpochMs?: number
}

export async function verifyChildPin(familyId: string, childId: string, pin: string): Promise<VerifyChildPinResult> {
  const fn = httpsCallable<{ familyId: string; childId: string; pin: string }, VerifyChildPinResult>(functions, 'verifyChildPin')
  const res = await fn({ familyId, childId, pin })
  return res.data
}

export async function addOrUpdateChild(input: { childId?: string; name: string; pin: string; avatar?: string }): Promise<{ ok: true; childId: string }> {
  const fn = httpsCallable<typeof input, { ok: true; childId: string }>(functions, 'addOrUpdateChild')
  const res = await fn(input)
  return res.data
}

type LinkChildResult =
  | { ok: true; familyId: string; childId: string; expiresAtEpochMs: number }
  | { ok: false; code: 'INVALID_CODE' | 'CHILD_NOT_FOUND' | 'PIN_NOT_SET' | 'WRONG_PIN' | 'ALREADY_LINKED' }

export async function linkChild(input: { familyCode: string; childName: string; pin: string }): Promise<LinkChildResult> {
  const fn = httpsCallable<typeof input, LinkChildResult>(functions, 'linkChild')
  const res = await fn(input)
  return res.data
}

export async function createShareLink(childId: string): Promise<{ ok: true; token: string; parentId: string; childId: string }> {
  const fn = httpsCallable<{ childId: string }, { ok: true; token: string; parentId: string; childId: string }>(functions, 'createShareLink')
  const res = await fn({ childId })
  return res.data
}

export type SharedWishlistItem = { id: string; name: string; description: string | null; url: string | null; image: string | null }

type GetSharedWishlistResult =
  | { ok: true; childName: string; items: SharedWishlistItem[] }
  | { ok: false; error: 'MISSING_PARAMS' | 'NOT_FOUND' | 'INVALID_TOKEN' }

export async function getSharedWishlist(input: { parentId: string; childId: string; token: string }): Promise<GetSharedWishlistResult> {
  const fn = httpsCallable<typeof input, GetSharedWishlistResult>(functions, 'getSharedWishlist')
  const res = await fn(input)
  return res.data
}

// Irreversibly deletes the family's account and every piece of data tied to
// it (children, wishlists, deeds, share links, the parent's own login).
export async function deleteFamilyData(): Promise<{ ok: true }> {
  const fn = httpsCallable<Record<string, never>, { ok: true }>(functions, 'deleteFamilyData')
  const res = await fn({})
  return res.data
}
