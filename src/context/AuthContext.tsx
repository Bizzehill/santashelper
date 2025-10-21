'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInAnonymously,
  updateProfile
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { doc, getDoc, setDoc } from 'firebase/firestore'

type AuthCtx = {
  user: { uid: string; email: string | null; role?: 'parent' | 'child'; displayName?: string | null } | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
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
        let role = token.claims.role as 'parent' | 'child' | undefined
        let displayName = u.displayName
        if (!role) {
          const snap = await getDoc(doc(db, 'users', u.uid))
          if (snap.exists()) {
            const data = snap.data() as { role?: 'parent' | 'child'; displayName?: string | null }
            role = data.role
            displayName = data.displayName ?? displayName
          }
        }
        setUser({ uid: u.uid, email: u.email, role, displayName })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          throw new Error('Those credentials don’t match our records. Double-check your email and password.')
        }
        if (err.code === 'auth/too-many-requests') {
          throw new Error('Too many attempts. Please wait a moment before trying again.')
        }
      }
      throw new Error('Unable to sign in right now. Please try again.')
    }
  }
  const signUp = async (email: string, password: string, displayName: string) => {
    const name = displayName.trim()
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      if (name) {
        await updateProfile(credential.user, { displayName: name })
      }
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        email: credential.user.email,
        role: 'parent',
        displayName: name || credential.user.displayName || null,
      }, { merge: true })
      setUser({ uid: credential.user.uid, email: credential.user.email, role: 'parent', displayName: name || credential.user.displayName })
    } catch (err) {
      if (err instanceof FirebaseError && err.code === 'auth/email-already-in-use') {
        throw new Error('That email is already registered. Try signing in instead or reset your password.')
      }
      throw new Error('Unable to create your account. Please try again in a moment.')
    }
  }
  const logOut = async () => {
    await signOut(auth)
  }
  const refreshClaims = async () => {
    if (!auth.currentUser) return
    const u = auth.currentUser
    await u.getIdToken(true)
    const token = await u.getIdTokenResult()
    let role = token.claims.role as 'parent' | 'child' | undefined
    let displayName = u.displayName
    if (!role) {
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (snap.exists()) {
        const data = snap.data() as { role?: 'parent' | 'child'; displayName?: string | null }
        role = data.role
        displayName = data.displayName ?? displayName
      }
    }
    setUser({ uid: u.uid, email: u.email, role, displayName })
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
