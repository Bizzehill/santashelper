'use client'
import { useAuth } from '@/context/AuthContext'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { signIn, signUp, user, logOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState<string>('')
  const router = useRouter()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    try {
      if (mode === 'signin') await signIn(email, password)
      else await signUp(email, password)
      router.push('/parent')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setMessage(msg)
    }
  }

  if (user) {
    return (
      <section className="card">
        <h2>Signed in as {user.email}</h2>
        <div className="grid2">
          <a className="btn" href="/parent">Go to Parent Dashboard</a>
          <button className="btn secondary" onClick={logOut}>Sign out</button>
        </div>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>{mode === 'signin' ? 'Sign In' : 'Create Account'}</h2>
      <form onSubmit={onSubmit} className="form">
        <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label>
        <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></label>
        {message && <p className="error">{message}</p>}
        <div className="grid2">
          <button className="btn" type="submit">{mode==='signin'?'Sign In':'Sign Up'}</button>
          <button className="btn secondary" type="button" onClick={()=>setMode(m=>m==='signin'?'signup':'signin')}>
            {mode==='signin'? 'Need an account? Sign Up' : 'Have an account? Sign In'}
          </button>
        </div>
      </form>
    </section>
  )
}
