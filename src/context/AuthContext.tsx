'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'

type AuthCtx = {
  user: { uid: string; email: string | null } | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logOut: () => Promise<void>
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
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u ? { uid: u.uid, email: u.email } : null)
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

  return (
    <Ctx.Provider value={{ user, loading, signIn, signUp, logOut }}>
      {children}
    </Ctx.Provider>
  )
}
