'use client'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

export async function verifyParentPin(pin: string, familyId?: string): Promise<{
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
}> {
  const fn = httpsCallable(functions, 'verifyParentPin')
  const res = await fn(familyId ? { pin, familyId } : { pin })
  return res.data as any
}

export async function setParentPin(pin: string, opts?: { ttlMinutes?: number; familyId?: string }): Promise<{ ok: true }>{
  const fn = httpsCallable(functions, 'setParentPin')
  const payload: any = { pin }
  if (opts?.ttlMinutes !== undefined) payload.ttlMinutes = opts.ttlMinutes
  if (opts?.familyId) payload.familyId = opts.familyId
  const res = await fn(payload)
  return res.data as any
}

// Called once right after a new parent account is created. Grants the role=parent
// custom claim, generates the family's shareable code, and seeds settings.
export async function createFamilyOnSignup(): Promise<{ familyId: string; familyCode?: string }>{
  const fn = httpsCallable(functions, 'createFamilyOnSignup')
  const res = await fn({ asParent: true })
  return res.data as unknown as { familyId: string; familyCode?: string }
}

export async function setChildPin(childId: string, pin: string): Promise<{ ok: true }>{
  const fn = httpsCallable(functions, 'setChildPin')
  const res = await fn({ childId, pin })
  return res.data as any
}

export async function verifyChildPin(familyId: string, childId: string, pin: string): Promise<{
  ok: boolean
  code?: 'NOT_FOUND' | 'NOT_SET'
  expiresAtEpochMs?: number
}>{
  const fn = httpsCallable(functions, 'verifyChildPin')
  const res = await fn({ familyId, childId, pin })
  return res.data as any
}

export async function addOrUpdateChild(input: { childId?: string; name: string; pin: string; avatar?: string }): Promise<{ ok: true; childId: string }>{
  const fn = httpsCallable(functions, 'addOrUpdateChild')
  const res = await fn(input)
  return res.data as any
}

export async function linkChild(input: { familyCode: string; childName: string; pin: string }): Promise<
  | { ok: true; familyId: string; childId: string; expiresAtEpochMs: number }
  | { ok: false; code: 'INVALID_CODE' | 'CHILD_NOT_FOUND' | 'PIN_NOT_SET' | 'WRONG_PIN' | 'ALREADY_LINKED' }
>{
  const fn = httpsCallable(functions, 'linkChild')
  const res = await fn(input)
  return res.data as any
}

export async function createShareLink(childId: string): Promise<{ ok: true; token: string; parentId: string; childId: string }>{
  const fn = httpsCallable(functions, 'createShareLink')
  const res = await fn({ childId })
  return res.data as unknown as { ok: true; token: string; parentId: string; childId: string }
}

export type SharedWishlistItem = { id: string; name: string; description: string | null; url: string | null; image: string | null }

export async function getSharedWishlist(input: { parentId: string; childId: string; token: string }): Promise<
  | { ok: true; childName: string; items: SharedWishlistItem[] }
  | { ok: false; error: 'MISSING_PARAMS' | 'NOT_FOUND' | 'INVALID_TOKEN' }
>{
  const fn = httpsCallable(functions, 'getSharedWishlist')
  const res = await fn(input)
  return res.data as unknown as
    | { ok: true; childName: string; items: SharedWishlistItem[] }
    | { ok: false; error: 'MISSING_PARAMS' | 'NOT_FOUND' | 'INVALID_TOKEN' }
}
