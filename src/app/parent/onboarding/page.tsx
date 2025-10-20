'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { addOrUpdateChild } from '@/lib/functions'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query } from 'firebase/firestore'

type Child = {
  id: string
  name?: string
  avatar?: string
}

const AVATARS = ['🧝', '🎄', '🎁', '⭐', '⛄']

export default function ParentOnboardingPage() {
  const router = useRouter()
  const { user, claims, loading } = useAuthWithClaims()

  const role = useMemo(() => (claims?.role as string | undefined) || undefined, [claims])

  const [children, setChildren] = useState<Child[]>([])
  const [form, setForm] = useState({ name: '', pin: '', confirm: '', avatar: AVATARS[0] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user || role !== 'parent') {
      router.replace('/parent-gate')
      return
    }
    const childrenCol = collection(db, `users/${user.uid}/children`)
    const q = query(childrenCol)
    const unsub = onSnapshot(q, (snap) => {
      const list: Child[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setChildren(list)
    })
    return () => unsub()
  }, [loading, user, role, router])

  const pinValid = /^[0-9]{4,6}$/.test(form.pin)
  const confirmMatch = form.pin === form.confirm
  const canSubmit = !!form.name.trim() && pinValid && confirmMatch && !submitting

  async function onAddChild(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await addOrUpdateChild({ name: form.name.trim(), pin: form.pin, avatar: form.avatar })
      setForm({ name: '', pin: '', confirm: '', avatar: AVATARS[0] })
    } catch (err: any) {
      setError(err?.message || 'Could not add child')
    } finally {
      setSubmitting(false)
    }
  }

  function finish() {
    router.push('/parent')
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Welcome, Parent</h1>
      <p className="text-gray-600 mb-6">Let’s set up your kids so Santa knows who’s who.</p>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Add a child</h2>
        <form onSubmit={onAddChild} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">Child name</label>
            <input id="name" value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="e.g., Buddy" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Avatar (optional)</label>
            <div className="flex gap-2">
              {AVATARS.map(a => (
                <button type="button" key={a} aria-pressed={form.avatar===a}
                  onClick={()=>setForm(f=>({ ...f, avatar: a }))}
                  className={`h-10 w-10 flex items-center justify-center rounded border ${form.avatar===a ? 'ring-2 ring-blue-500' : ''}`}>{a}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="pin">PIN (4–6 digits)</label>
              <input id="pin" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={form.pin} onChange={e=>setForm(f=>({ ...f, pin: e.target.value.replace(/\D+/g,'') }))}
                className="w-full border rounded px-3 py-2" placeholder="1234" required />
              {!pinValid && form.pin.length > 0 && (
                <p className="text-xs text-red-600 mt-1">PIN must be 4–6 digits.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="confirm">Confirm PIN</label>
              <input id="confirm" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={form.confirm} onChange={e=>setForm(f=>({ ...f, confirm: e.target.value.replace(/\D+/g,'') }))}
                className="w-full border rounded px-3 py-2" placeholder="1234" required />
              {form.confirm.length>0 && !confirmMatch && (
                <p className="text-xs text-red-600 mt-1">PINs don’t match.</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={!canSubmit}
              className={`px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50`}>Add child</button>
            <span className="text-sm text-gray-500">You can add multiple kids.</span>
          </div>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Your children</h2>
        {children.length === 0 ? (
          <p className="text-gray-600">No children added yet.</p>
        ) : (
          <ul className="space-y-2">
            {children.map(c => (
              <li key={c.id} className="flex items-center gap-3 p-3 border rounded">
                <div className="h-8 w-8 flex items-center justify-center text-lg">{c.avatar || '🧝'}</div>
                <div className="flex-1">
                  <div className="font-medium">{c.name || 'Unnamed'}</div>
                  <div className="text-xs text-gray-500">ID: {c.id}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <button onClick={finish} className="px-5 py-2 rounded bg-green-600 text-white disabled:opacity-50"
          disabled={children.length === 0}>Finish</button>
      </div>
    </main>
  )
}
