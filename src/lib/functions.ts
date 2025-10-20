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
