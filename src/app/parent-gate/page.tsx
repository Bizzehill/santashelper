'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyParentPin } from '@/lib/functions'
import { useParentSession } from '@/hooks/useParentSession'
import { logAuditEvent } from '@/lib/audit'

export default function ParentGatePage() {
  const router = useRouter()
  const { startParentSession } = useParentSession()

  // Stages: intro (long-press required) -> keypad
  const [stage, setStage] = useState<'intro' | 'keypad'>('intro')
  const [pressing, setPressing] = useState(false)
  const [progress, setProgress] = useState(0) // 0..100 visual only
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTsRef = useRef<number | null>(null)
  const PRESS_MS = 1200

  const beginPress = useCallback(() => {
    if (pressing) return
    setPressing(true)
    setProgress(0)
    startTsRef.current = Date.now()
    timerRef.current = setInterval(() => {
      if (!startTsRef.current) return
      const elapsed = Date.now() - startTsRef.current
      const pct = Math.min(100, Math.round((elapsed / PRESS_MS) * 100))
      setProgress(pct)
      if (elapsed >= PRESS_MS) {
        endPress(true)
      }
    }, 50)
  }, [pressing])

  const endPress = useCallback((completed = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    startTsRef.current = null
    setPressing(false)
    setProgress(0)
    if (completed) {
      setStage('keypad')
      // Fire-and-forget audit event when keypad opens
      logAuditEvent('parentGate.open')
    }
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Keypad and PIN handling
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [statusAnnounce, setStatusAnnounce] = useState('')
  const MAX = 6, MIN = 4

  const addDigit = (d: string) => {
    if (busy) return
    setMsg(null)
    setPin(p => (p.length >= MAX ? p : p + d))
  }
  const backspace = () => {
    if (busy) return
    setMsg(null)
    setPin(p => p.slice(0, -1))
  }
  const clearAll = () => {
    if (busy) return
    setMsg(null)
    setPin('')
  }

  useEffect(() => {
    setStatusAnnounce(pin.length ? `${pin.length} digits entered` : 'No digits entered')
  }, [pin.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (stage !== 'keypad') return
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault(); addDigit(e.key)
    } else if (e.key === 'Backspace') {
      e.preventDefault(); backspace()
    } else if (e.key === 'Escape') {
      e.preventDefault(); clearAll()
    } else if (e.key === 'Enter') {
      e.preventDefault(); submit()
    }
  }

  const submit = async () => {
    if (busy) return
    if (pin.length < MIN) {
      setMsg('PIN must be 4–6 digits')
      return
    }
    try {
      setBusy(true)
      const res = await verifyParentPin(pin)
      if (!res.ok) {
        if (res.code === 'LOCKED') {
          setMsg('Let’s take a short break. Please try again later.')
        } else if (res.code === 'INVALID_PIN') {
          setMsg('That didn’t match. Please try again.')
        } else if (res.code === 'UNAUTHENTICATED') {
          setMsg('Please sign in to continue.')
        } else {
          setMsg('Something went wrong. Please try again.')
        }
        return
      }
      if (!res.expiresAtEpochMs) {
        setMsg('No session TTL provided')
        return
      }
      startParentSession(res.expiresAtEpochMs)
      router.replace('/parent')
    } catch {
      setMsg('We couldn’t connect. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-live="polite" onKeyDown={onKeyDown}>
      <h2>For grown-ups only</h2>

      {stage === 'intro' && (
        <div>
          <p className="meter-text" id="longpress-hint">Press and hold Continue for 1–2 seconds to confirm you’re a grown-up.</p>
          <div className="mt-2">
            <button
              className={`btn ${pressing ? 'secondary' : ''}`}
              aria-describedby="longpress-hint"
              aria-pressed={pressing}
              onMouseDown={beginPress}
              onMouseUp={()=>endPress(false)}
              onMouseLeave={()=>endPress(false)}
              onTouchStart={(e)=>{ e.preventDefault(); beginPress() }}
              onTouchEnd={()=>endPress(false)}
              onKeyDown={(e)=>{ if (e.key===' '|| e.key==='Enter') beginPress() }}
              onKeyUp={()=>endPress(false)}
            >Continue</button>
          </div>
          <div className="mt-2" aria-hidden="true" style={{ height: 6, background:'#1b2540', borderRadius: 999 }}>
            <div style={{ width: `${progress}%`, height: 6, background:'var(--accent)', borderRadius: 999, transition:'width 50ms linear' }} />
          </div>
        </div>
      )}

      {stage === 'keypad' && (
        <div>
          <p className="meter-text">Enter your 4–6 digit Parent PIN.</p>
          <div className="mb-2" role="status" aria-live="polite" style={{ position:'absolute', left:-9999 }}>{statusAnnounce}</div>
          {/* PIN display */}
          <div className="row" style={{ gap: 8, marginTop: 8, justifyContent:'center' }}>
            {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
              <div key={i} aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, background: i < pin.length ? 'var(--accent)' : '#334155' }} />
            ))}
          </div>

          {/* Keypad */}
          <div role="group" aria-label="Numeric keypad" className="mt-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,64px)', gap:8, justifyContent:'center' }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} className="btn" aria-label={`Digit ${n}`} onClick={()=>addDigit(String(n))} disabled={busy || pin.length>=MAX}>{n}</button>
            ))}
            <button className="btn secondary" aria-label="Clear" onClick={clearAll} disabled={busy}>C</button>
            <button className="btn" aria-label="Digit 0" onClick={()=>addDigit('0')} disabled={busy || pin.length>=MAX}>0</button>
            <button className="btn secondary" aria-label="Backspace" onClick={backspace} disabled={busy}>←</button>
          </div>

          <div className="mt-3 row" style={{ justifyContent:'center' }}>
            <button className="btn" onClick={submit} disabled={busy || pin.length < MIN}>Unlock</button>
          </div>

          {msg && <div className="badge" role="status" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </section>
  )
}
