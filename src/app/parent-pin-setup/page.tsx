'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthWithClaims } from '@/hooks/useAuthWithClaims'
import { useRequireRecentLogin } from '@/lib/requireRecentLogin'
import { setParentPin } from '@/lib/functions'
import { useParentSession } from '@/hooks/useParentSession'

export default function ParentPinSetupPage() {
  const router = useRouter()
  const { user, claims, loading } = useAuthWithClaims()
  const role = useMemo(() => (claims?.role as string | undefined) ?? undefined, [claims])
  const { requireRecentLogin } = useRequireRecentLogin()
  const { startParentSession } = useParentSession()

  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [ttl, setTtl] = useState<number>(15)

  useEffect(() => {
    if (!pin && !confirm) setAnnounce('Enter a 4–6 digit PIN and confirm it')
    else if (pin !== confirm) setAnnounce('PINs do not match')
    else setAnnounce('PINs match')
  }, [pin, confirm])

  useEffect(() => {
    if (!loading && user && role !== 'parent') {
      // Non-parent shouldn’t be here; send to gate
      router.replace('/parent-gate')
    }
  }, [loading, user, role, router])

  const validFormat = /^[0-9]{4,6}$/.test(pin)
  const canSubmit = validFormat && pin === confirm && !busy

  const onSubmit = useCallback(async () => {
    setMsg(null)
    if (!validFormat) { setMsg('PIN must be 4–6 digits.'); return }
    if (pin !== confirm) { setMsg('Those didn’t match. Please try again.'); return }
    if (!user) { setMsg('Please sign in to continue.'); return }

    try {
      setBusy(true)
      await requireRecentLogin(async () => {
        await setParentPin(pin, { ttlMinutes: ttl })
      }, user.email || undefined)
      // After setting PIN, start a parent session locally for convenience
      const expiresAt = Date.now() + ttl * 60 * 1000
      startParentSession(expiresAt)
      setMsg('PIN saved! Taking you to the parent tools…')
      setTimeout(() => router.replace('/parent'), 500)
    } catch (e: any) {
      const code = e?.code as string | undefined
      if (code === 'auth/requires-recent-login') {
        setMsg('Please confirm it’s you to continue.')
      } else if (code === 'permission-denied') {
        setMsg('You do not have permission to do that.')
      } else if (code === 'invalid-argument') {
        setMsg('Please check the PIN and try again.')
      } else {
        setMsg('We couldn’t save your PIN. Please try again in a moment.')
      }
    } finally {
      setBusy(false)
    }
  }, [validFormat, pin, confirm, user, router, requireRecentLogin, startParentSession])

  return (
    <section className="card" aria-live="polite">
      <h2>Set your Parent PIN</h2>
      <p className="meter-text">Choose a 4–6 digit PIN to protect grown‑up tools.</p>
      <div className="mb-2" role="status" aria-live="polite" style={{ position:'absolute', left:-9999 }}>{announce}</div>

      <form onSubmit={(e)=>{ e.preventDefault(); if (canSubmit) onSubmit() }}>
        <div className="row" style={{ gap: 12, flexWrap:'wrap' }}>
          <label style={{ display:'flex', flexDirection:'column' }}>
            PIN
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              aria-describedby="pin-hint"
              value={pin}
              onChange={e=>{ const v=e.target.value.replace(/[^0-9]/g,''); if (v.length<=6) setPin(v) }}
              placeholder="••••"
            />
          </label>
          <label style={{ display:'flex', flexDirection:'column' }}>
            Confirm PIN
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              aria-describedby="pin-hint"
              value={confirm}
              onChange={e=>{ const v=e.target.value.replace(/[^0-9]/g,''); if (v.length<=6) setConfirm(v) }}
              placeholder="••••"
            />
          </label>
        </div>
        <div id="pin-hint" className="meter-text" style={{ marginTop: 4 }}>PIN must be 4–6 digits. Avoid birthdays.</div>
        <div className="row" style={{ marginTop: 8, gap: 12, alignItems:'center' }}>
          <label style={{ display:'flex', gap:8, alignItems:'center' }}>
            Session length
            <select value={ttl} onChange={e=>setTtl(parseInt(e.target.value,10))} aria-label="Parent session length">
              {[10,15,20,30,45,60].map(m => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
        </div>

        {msg && <div className="badge" role="status" style={{ marginTop: 8 }}>{msg}</div>}

        <div className="row" style={{ marginTop: 12, justifyContent:'flex-end', gap:8 }}>
          <button type="button" className="btn secondary" onClick={()=>router.replace('/parent-gate')} disabled={busy}>Cancel</button>
          <button type="submit" className="btn" disabled={!canSubmit}>Save PIN</button>
        </div>
      </form>
    </section>
  )
}
