'use client'
import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { linkChild } from '@/lib/functions'
import { useChildSession } from '@/hooks/useChildSession'

export default function LinkFamilyPage() {
  const router = useRouter()
  const { startChildSession } = useChildSession()

  const [form, setForm] = useState({ familyCode: '', childName: '', pin: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pinValid = useMemo(() => /^[0-9]{4,6}$/.test(form.pin), [form.pin])
  const canSubmit = useMemo(() => form.familyCode.trim() && form.childName.trim() && pinValid && !submitting, [form, pinValid, submitting])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await linkChild({ familyCode: form.familyCode.trim(), childName: form.childName.trim(), pin: form.pin })
      if (!res.ok) {
        switch (res.code) {
          case 'INVALID_CODE': setError('We couldn’t find that family. Check the code and try again.'); break
          case 'CHILD_NOT_FOUND': setError('We couldn’t find that child name for this family.'); break
          case 'PIN_NOT_SET': setError('This child does not have a PIN yet. Ask a parent to set it up.'); break
          case 'WRONG_PIN': setError('That PIN didn’t match. Try again.'); break
          case 'ALREADY_LINKED': setError('You’re already linked.'); break
          default: setError('Something went wrong. Please try again.')
        }
        return
      }
      // Start local child session and route to /santa
      startChildSession(res.familyId, res.childId, res.expiresAtEpochMs)
      router.replace('/santa')
    } catch (e: any) {
      setError(e?.message || 'Could not link at this time')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Link to Your Family</h1>
      <p className="text-gray-600 mb-6">Ask a parent for your family code and your name & PIN.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="familyCode">Family Code</label>
          <input id="familyCode" value={form.familyCode} onChange={e=>setForm(f=>({ ...f, familyCode: e.target.value }))}
            className="w-full border rounded px-3 py-2" placeholder="e.g., parent UID or code" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="childName">Your Name</label>
          <input id="childName" value={form.childName} onChange={e=>setForm(f=>({ ...f, childName: e.target.value }))}
            className="w-full border rounded px-3 py-2" placeholder="e.g., Buddy" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="pin">Your PIN (4–6 digits)</label>
          <input id="pin" inputMode="numeric" pattern="[0-9]*" maxLength={6}
            value={form.pin} onChange={e=>setForm(f=>({ ...f, pin: e.target.value.replace(/\D+/g,'') }))}
            className="w-full border rounded px-3 py-2" placeholder="1234" required />
          {form.pin.length>0 && !pinValid && (
            <p className="text-xs text-red-600 mt-1">PIN must be 4–6 digits.</p>
          )}
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={!canSubmit} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Link family</button>
      </form>
    </main>
  )
}
