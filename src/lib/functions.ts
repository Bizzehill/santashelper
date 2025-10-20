'use client'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'

const app = getApp()
const functions = getFunctions(app)

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

export async function ensureFamilySettings(): Promise<{ ok: true; existed?: boolean }>{
  const fn = httpsCallable(functions, 'ensureFamilySettings')
  const res = await fn({})
  return res.data as any
}

export async function registerParent(): Promise<{ ok: true }>{
  const fn = httpsCallable(functions, 'registerParent')
  const res = await fn({})
  return res.data as any
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
