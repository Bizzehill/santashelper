'use client'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { auth } from '@/lib/firebase'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'

type ReauthContextType = {
  showReauthModal: (opts?: { emailHint?: string }) => Promise<void>
}

const ReauthCtx = createContext<ReauthContextType | null>(null)

export function useReauth() {
  const v = useContext(ReauthCtx)
  if (!v) throw new Error('useReauth must be used within <ReauthProvider>')
  return v
}

export const ReauthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [resolver, setResolver] = useState<null | ((v: void | PromiseLike<void>) => void)>(null)
  const [rejecter, setRejecter] = useState<null | ((e?: any) => void)>(null)

  const close = useCallback(() => {
    setOpen(false)
    setEmail('')
    setPassword('')
    setBusy(false)
    setMessage(null)
    setResolver(null)
    setRejecter(null)
  }, [])

  const showReauthModal = useCallback(({ emailHint }: { emailHint?: string } = {}) => {
    if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
    setEmail(emailHint || auth.currentUser?.email || '')
    setMessage(null)
    setOpen(true)
    return new Promise<void>((resolve, reject) => {
      setResolver(() => resolve)
      setRejecter(() => reject)
    })
  }, [])

  const onSubmit = useCallback(async () => {
    try {
      if (!auth.currentUser) throw new Error('No active session')
      setBusy(true)
      const cred = EmailAuthProvider.credential(email, password)
      await reauthenticateWithCredential(auth.currentUser, cred)
      resolver?.()
      close()
    } catch (e: any) {
      const code = e?.code as string | undefined
      if (code === 'auth/wrong-password') setMessage('That password didn’t work. Please try again.')
      else if (code === 'auth/user-mismatch') setMessage('This email doesn’t match the signed-in account.')
      else setMessage('We couldn’t confirm your identity. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [email, password, resolver, close])

  const onCancel = useCallback(() => {
    rejecter?.(new Error('reauth-cancelled'))
    close()
  }, [rejecter, close])

  const value = useMemo(() => ({ showReauthModal }), [showReauthModal])

  return (
    <ReauthCtx.Provider value={value}>
      {children}
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="reauth-title" className="modal-overlay">
          <div className="modal card">
            <h3 id="reauth-title">Please confirm it’s you</h3>
            <p className="meter-text">For your security, re-enter your password to continue.</p>
            <div className="row" style={{ gap: 8, flexWrap:'wrap' }}>
              <label style={{ display:'flex', flexDirection:'column' }}>
                Email
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label style={{ display:'flex', flexDirection:'column' }}>
                Password
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
              </label>
            </div>
            {message && <div className="badge" role="status" style={{ marginTop: 8 }}>{message}</div>}
            <div className="row" style={{ marginTop: 12, justifyContent:'flex-end', gap:8 }}>
              <button className="btn secondary" onClick={onCancel} disabled={busy}>Cancel</button>
              <button className="btn" onClick={onSubmit} disabled={busy || !email || !password}>Confirm</button>
            </div>
          </div>
          <style jsx>{`
            .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:50; }
            .modal { max-width: 520px; width: calc(100% - 32px); }
          `}</style>
        </div>
      )}
    </ReauthCtx.Provider>
  )
}
