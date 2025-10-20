'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInAnonymously
} from 'firebase/auth'

type AuthCtx = {
  user: { uid: string; email: string | null; role?: 'parent' | 'child' } | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
  refreshClaims: () => Promise<void>
  signInAnon: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)
export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthCtx['user']>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u) {
        const token = await u.getIdTokenResult(true)
        const role = (token.claims.role as 'parent' | 'child' | undefined)
        setUser({ uid: u.uid, email: u.email, role })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }
  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
  }
  const logOut = async () => {
    await signOut(auth)
  }
  const refreshClaims = async () => {
    if (!auth.currentUser) return
    const u = auth.currentUser
    await u.getIdToken(true)
    const token = await u.getIdTokenResult()
    const role = (token.claims.role as 'parent' | 'child' | undefined)
    setUser({ uid: u.uid, email: u.email, role })
  }

  const signInAnon = async () => {
    await signInAnonymously(auth)
  }

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, logOut, refreshClaims, signInAnon }}>
      {children}
    </Ctx.Provider>
  )
}
