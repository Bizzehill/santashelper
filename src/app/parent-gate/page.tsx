'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyParentPin } from '@/lib/functions'
import { useParentSession } from '@/hooks/useParentSession'
import { logAuditEvent } from '@/lib/audit'
import { useAuthWithClaims } from '@/lib/auth/useAuthWithClaims'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc } from 'firebase/firestore'
import { getCountFromServer } from 'firebase/firestore'

export default function ParentGatePage() {
  const router = useRouter()
  const { startParentSession } = useParentSession()
  const { user, claims, loading } = useAuthWithClaims()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function precheck() {
      if (loading) return
      // Must be a signed-in parent to use PIN gate for parent tools
      const role = (claims?.role as string | undefined) || undefined
      if (!user || role !== 'parent') {
        setAllowed(false)
        setChecking(false)
        return
      }
      try {
        // Check children count
        const childrenCol = collection(db, `users/${user.uid}/children`)
        const countSnap = await getCountFromServer(childrenCol)
        const childCount = countSnap.data().count || 0
        if (cancelled) return
        if (childCount === 0) {
          router.replace('/parent/onboarding')
          return
        }
        // Check parent PIN configured
        const settingsRef = doc(db, `families/${user.uid}/settings`)
        const settingsSnap = await getDoc(settingsRef)
        const parentPinHash = settingsSnap.exists() ? (settingsSnap.data()?.parentPinHash as string | undefined) : undefined
        if (cancelled) return
        if (!parentPinHash) {
          router.replace('/parent-pin-setup')
          return
        }
        setAllowed(true)
      } catch (e) {
        // On error, be conservative and do not show PIN gate
        setAllowed(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    precheck()
    return () => { cancelled = true }
  }, [loading, user, claims, router])

  // Stages: intro (long-press required) -> keypad
  const [stage, setStage] = useState<'intro' | 'keypad'>('intro')
  const [pressing, setPressing] = useState(false)
  const [progress, setProgress] = useState(0) // 0..100 visual only
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTsRef = useRef<number | null>(null)
  const PRESS_MS = 1200

  // Micro-interactions helpers (respect reduced motion)
  const prefersReducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const vibrate = (ms = 12) => {
    if (prefersReducedMotion) return
    try { if ('vibrate' in navigator) (navigator as any).vibrate(ms) } catch { /* noop */ }
  }
  const setRippleFromPointer = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement
    if (!el || typeof (el as any).getBoundingClientRect !== 'function') return
    const rect = el.getBoundingClientRect()
    const rx = ((e.clientX - rect.left) / rect.width) * 100
    const ry = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty('--rx', `${Math.max(0, Math.min(100, rx))}%`)
    el.style.setProperty('--ry', `${Math.max(0, Math.min(100, ry))}%`)
  }
  const setPressed = (el: HTMLElement, pressed: boolean) => {
    if (pressed) el.setAttribute('data-pressed', 'true')
    else el.removeAttribute('data-pressed')
  }
  const shake = (el: HTMLElement | null) => {
    if (!el) return
    el.classList.remove('shake')
    // force reflow to restart animation
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    ;(el as any).offsetHeight
    el.classList.add('shake')
    setTimeout(() => el.classList.remove('shake'), 340)
  }
  const confettiBurst = () => {
    if (prefersReducedMotion || typeof document === 'undefined') return
    try {
      const host = document.createElement('div')
      host.className = 'confetti-host'
      document.body.appendChild(host)
      const colors = ['#e11d48', '#22c55e', '#fbbf24', '#ffffff']
      const count = 24
      const centerX = window.innerWidth / 2
      const baseY = Math.min(window.innerHeight * 0.65, window.innerHeight - 80)
      for (let i = 0; i < count; i++) {
        const d = document.createElement('div')
        d.className = 'confetti-piece'
        const x = centerX + (Math.random() * 240 - 120)
        const y = baseY + (Math.random() * 30 - 15)
        d.style.left = `${x}px`
        d.style.top = `${y}px`
        d.style.background = colors[i % colors.length]
        d.style.transform = `translateZ(0) rotate(${Math.random()*60-30}deg)`
        d.style.animationDelay = `${Math.random() * 80}ms`
        host.appendChild(d)
      }
      setTimeout(() => { host.remove() }, 900)
    } catch { /* noop */ }
  }

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
      vibrate(10)
    }
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Keypad and PIN handling
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [statusAnnounce, setStatusAnnounce] = useState('')
  const MAX = 6, MIN = 4
  const dotsRef = useRef<HTMLDivElement | null>(null)

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
        vibrate(8)
        shake(dotsRef.current)
        return
      }
      if (!res.expiresAtEpochMs) {
        setMsg('No session TTL provided')
        return
      }
      confettiBurst()
      startParentSession(res.expiresAtEpochMs)
      router.replace('/parent/dashboard')
    } catch {
      setMsg('We couldn’t connect. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || checking) {
    return (
      <section className="card p-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-6 w-40 bg-gray-200 rounded mb-3" />
        <div className="h-4 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
      </section>
    )
  }

  if (!allowed) {
    return (
      <section className="card">
        <h2>For grown-ups only</h2>
        <p className="meter-text">Please sign in as a parent to continue.</p>
      </section>
    )
  }

  return (
    <section className="card" aria-live="polite" onKeyDown={onKeyDown}>
      <h2>For grown-ups only</h2>

      {stage === 'intro' && (
        <div>
          <p className="meter-text" id="longpress-hint">Press and hold Continue for 1–2 seconds to confirm you’re a grown-up.</p>
          <div className="mt-2">
            <button
              className={`btn haptic ripple ${pressing ? 'secondary' : ''}`}
              aria-describedby="longpress-hint"
              aria-pressed={pressing}
              onPointerDown={(e)=>{ setRippleFromPointer(e); setPressed(e.currentTarget, true); vibrate(8) }}
              onPointerUp={(e)=>setPressed(e.currentTarget, false)}
              onPointerLeave={(e)=>setPressed(e.currentTarget, false)}
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
          <div ref={dotsRef} className="row" style={{ gap: 8, marginTop: 8, justifyContent:'center' }}>
            {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
              <div key={i} aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 7, background: i < pin.length ? 'var(--accent)' : '#334155' }} />
            ))}
          </div>

          {/* Keypad */}
          <div role="group" aria-label="Numeric keypad" className="mt-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,64px)', gap:8, justifyContent:'center' }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button
                key={n}
                className="btn keypad-key haptic ripple"
                aria-label={`Digit ${n}`}
                onPointerDown={(e)=>{ setRippleFromPointer(e); setPressed(e.currentTarget, true); vibrate(8) }}
                onPointerUp={(e)=>setPressed(e.currentTarget, false)}
                onPointerLeave={(e)=>setPressed(e.currentTarget, false)}
                onClick={()=>addDigit(String(n))}
                disabled={busy || pin.length>=MAX}
              >{n}</button>
            ))}
            <button
              className="btn secondary keypad-key haptic ripple"
              aria-label="Clear"
              onPointerDown={(e)=>{ setRippleFromPointer(e); setPressed(e.currentTarget, true); vibrate(8) }}
              onPointerUp={(e)=>setPressed(e.currentTarget, false)}
              onPointerLeave={(e)=>setPressed(e.currentTarget, false)}
              onClick={clearAll}
              disabled={busy}
            >C</button>
            <button
              className="btn keypad-key haptic ripple"
              aria-label="Digit 0"
              onPointerDown={(e)=>{ setRippleFromPointer(e); setPressed(e.currentTarget, true); vibrate(8) }}
              onPointerUp={(e)=>setPressed(e.currentTarget, false)}
              onPointerLeave={(e)=>setPressed(e.currentTarget, false)}
              onClick={()=>addDigit('0')}
              disabled={busy || pin.length>=MAX}
            >0</button>
            <button
              className="btn secondary keypad-key haptic ripple"
              aria-label="Backspace"
              onPointerDown={(e)=>{ setRippleFromPointer(e); setPressed(e.currentTarget, true); vibrate(8) }}
              onPointerUp={(e)=>setPressed(e.currentTarget, false)}
              onPointerLeave={(e)=>setPressed(e.currentTarget, false)}
              onClick={backspace}
              disabled={busy}
            >←</button>
          </div>

          <div className="mt-3 row" style={{ justifyContent:'center' }}>
            <button
              className="btn haptic ripple"
              onPointerDown={(e)=>{ setRippleFromPointer(e); setPressed(e.currentTarget, true); vibrate(8) }}
              onPointerUp={(e)=>setPressed(e.currentTarget, false)}
              onPointerLeave={(e)=>setPressed(e.currentTarget, false)}
              onClick={submit}
              disabled={busy || pin.length < MIN}
            >Unlock</button>
          </div>

          {msg && <div className="badge" role="status" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      )}
    </section>
  )
}
