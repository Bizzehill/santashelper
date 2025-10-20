'use client'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'
import WishItemCard, { WishItem } from '@/components/WishItemCard'
import { db } from '@/lib/firebase'
import { verifyParentPin } from '@/lib/functions'
import { getAuth, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

type DeedStatus = 'pending' | 'approved' | 'rejected' | 'noted'
type Deed = { id: string; description: string; status: DeedStatus; createdAt?: unknown; source?: string }
type Child = { id: string; name?: string; age: number }

export default function ParentPage() {
  const { user, logOut } = useAuth()
  const { refreshClaims } = useAuth()
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [childId, setChildId] = useState<string>('')
  const [newChildName, setNewChildName] = useState('')
  const [editChildName, setEditChildName] = useState('')
  const [pendingDeeds, setPendingDeeds] = useState<Deed[]>([])
  const [wishlist, setWishlist] = useState<WishItem[]>([])
  const [toast, setToast] = useState<string>('')
  const [settings, setSettings] = useState({ age: 8 })
  const [lastAffirmation, setLastAffirmation] = useState<string | null>(null)
  const [lastAffirmationAt, setLastAffirmationAt] = useState<Date | null>(null)
  // Parent PIN settings state
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [pinSaveMsg, setPinSaveMsg] = useState<string | null>(null)
  const [pinBusy, setPinBusy] = useState(false)
  const [reauthEmail, setReauthEmail] = useState('')
  const [reauthPassword, setReauthPassword] = useState('')
  const purchasedCount = wishlist.filter(w=>w.status==='purchased').length
  const subtotal = wishlist.filter(w=>w.status!=='passed' && typeof (w as { price?: number }).price === 'number').reduce((sum,w)=> sum + ((w as { price?: number }).price || 0), 0)

  useEffect(() => {
    if (!user) return
    const ref = collection(db, 'users', user.uid, 'children')
    const unsub = onSnapshot(ref, snap => {
      const list: Child[] = snap.docs.map(d => {
        const data = d.data() as Partial<Child>
        return {
          id: d.id,
          name: data.name,
          age: (data as { age?: number }).age ?? 8,
        }
      })
      setChildren(list)
      if (!childId && list[0]) setChildId(list[0].id)
      const selected = list.find(c => c.id === (childId || (list[0]?.id || '')))
      if (selected?.name) setEditChildName(selected.name)
    })
    return () => unsub()
  }, [user, childId])

  useEffect(() => {
    if (!user || !childId) return
    const cRef = doc(db, 'users', user.uid, 'children', childId)
    const unsubC = onSnapshot(cRef, d => {
      const data = (d.data() as Partial<Child> & { lastAffirmation?: string | null; lastAffirmationAt?: any }) || {}
      setSettings({
        age: (data as { age?: number }).age ?? 8,
      })
      const msg = (data.lastAffirmation ?? null)
      setLastAffirmation(typeof msg === 'string' && msg.trim() ? msg : null)
      const at = data.lastAffirmationAt as { toDate?: () => Date } | undefined
      setLastAffirmationAt(typeof at?.toDate === 'function' ? at!.toDate() : null)
    })
    const dRef = query(collection(db, 'users', user.uid, 'children', childId, 'deeds'), orderBy('createdAt','desc'))
    const unsubD = onSnapshot(dRef, snap => {
      const deeds: Deed[] = snap.docs.map(docSnap => {
        const data = docSnap.data() as Partial<Deed>
        return {
          id: docSnap.id,
          description: data.description ?? '',
          status: (data.status as DeedStatus) ?? 'pending',
          createdAt: data.createdAt,
          source: (data as { source?: string } | undefined)?.source,
        }
      })
      setPendingDeeds(deeds)
    })
    const wRef = query(collection(db, 'users', user.uid, 'children', childId, 'wishlist'), orderBy('createdAt','desc'))
    const unsubW = onSnapshot(wRef, snap => {
      setWishlist(snap.docs.map(d=>({ id: d.id, ...(d.data() as Partial<WishItem>) })) as WishItem[])
    })
    return () => { unsubC(); unsubD(); unsubW() }
  }, [user, childId])

  const addChild = async () => {
    if (!user || !newChildName.trim()) return
    await addDoc(collection(db, 'users', user.uid, 'children'), {
      name: newChildName.trim(),
      age: 8,
      createdAt: serverTimestamp(),
    })
    setNewChildName('')
  }

  const saveChildName = async () => {
    if (!user || !childId) return
    const name = editChildName.trim()
    await updateDoc(doc(db, 'users', user.uid, 'children', childId), { name })
  }

  const updateSettings = async (patch: Partial<typeof settings>) => {
    if (!user || !childId) return
    await updateDoc(doc(db, 'users', user.uid, 'children', childId), patch)
  }

  const clearAffirmation = async () => {
    if (!user || !childId) return
    await updateDoc(doc(db, 'users', user.uid, 'children', childId), { lastAffirmation: null, lastAffirmationAt: null })
  }

  const approveDeed = async (id: string) => {
    if (!user || !childId) return
    await updateDoc(doc(db, 'users', user.uid, 'children', childId, 'deeds', id), { status: 'approved' })
  }

  const rejectDeed = async (id: string) => {
    if (!user || !childId) return
    await updateDoc(doc(db, 'users', user.uid, 'children', childId, 'deeds', id), { status: 'rejected' })
  }

  const updateItemStatus = async (itemId: string, status: WishItem['status']) => {
    if (!user || !childId) return
    await updateDoc(doc(db, 'users', user.uid, 'children', childId, 'wishlist', itemId), { status })
  }

  const refreshPrice = async (item: WishItem) => {
    if (!user || !childId || !item.url || !item.retailer) return
    try {
      const path = `users/${user.uid}/children/${childId}/wishlist/${item.id}`
      const res = await fetch('/api/price-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'parent' },
        body: JSON.stringify({ path, url: item.url, retailer: item.retailer })
      })
      const json = await res.json()
      if (!json.ok) {
        setToast(json.error || 'Price refresh failed')
      } else {
        setToast('Price updated')
      }
      setTimeout(()=>setToast(''), 2000)
    } catch {
      setToast('Network error')
      setTimeout(()=>setToast(''), 2000)
    }
  }

  if (!user) {
    return (
      <section className="card">
        <h2>Parent Dashboard</h2>
        <p>Please <a className="link" href="/login">sign in</a> to manage your family account.</p>
      </section>
    )
  }

  // Require parent role; allow entering PIN to elevate
  if (user && user.role !== 'parent') {
    return (
      <section className="card">
        <h2>Parent Access</h2>
        <p className="meter-text">This area is restricted to parents. Enter your 4–6 digit Parent PIN to continue.</p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input
            value={pin}
            onChange={e=>{ setPin(e.target.value); setPinError('') }}
            placeholder="Parent PIN"
            aria-label="Parent PIN"
            inputMode="numeric"
            pattern="[0-9]*"
            className="input"
            style={{ width: 160 }}
          />
          <button
            className="btn"
            onClick={async ()=>{
              try {
                const res = await verifyParentPin(pin.trim())
                if (!res.ok) {
                  setPinError(res.message || 'Invalid PIN')
                  return
                }
                await refreshClaims()
              } catch (e) {
                setPinError('Network error')
              }
            }}
            disabled={!pin.trim()}
          >Unlock</button>
        </div>
        {pinError && <div className="badge" role="status" style={{ marginTop: 8 }}>{pinError}</div>}
      </section>
    )
  }

  return (
    <section className="card">
      <div className="row between">
        <h2>Parent Dashboard</h2>
        <button className="btn secondary" onClick={logOut}>Sign out</button>
      </div>

      {/* Unified Children & Settings */}
      <div className="card">
        <h3>Children & Settings</h3>
        <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Select child
            <select value={childId} onChange={e=>setChildId(e.target.value)}>
              {children.map(c=> <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Edit name
            <input value={editChildName} onChange={e=>setEditChildName(e.target.value)} placeholder="Child name"/>
          </label>
          <button className="btn" onClick={saveChildName} disabled={!childId}>Save</button>
          <div style={{ flex: 1 }} />
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Add a child
            <div className="row">
              <input value={newChildName} onChange={e=>setNewChildName(e.target.value)} placeholder="Name"/>
              <button className="btn" onClick={addChild} disabled={!newChildName.trim()}>Add</button>
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Child age
            <input type="number" min={1} value={settings.age} onChange={e=>updateSettings({ age:Number(e.target.value) })}/>
          </label>
        </div>
      </div>

      {/* Messages grouped by type */}
      <div className="grid2">
        {/* Parent Settings - PIN */}
        <div className="card">
          <h3>Parent Settings</h3>
          <p className="meter-text" style={{ marginTop: 0 }}>Update the Parent PIN used to unlock the dashboard.</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display:'flex', flexDirection:'column' }}>
              Re-auth email
              <input value={reauthEmail} onChange={e=>setReauthEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label style={{ display:'flex', flexDirection:'column' }}>
              Re-auth password
              <input type="password" value={reauthPassword} onChange={e=>setReauthPassword(e.target.value)} placeholder="••••••••" />
            </label>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ display:'flex', flexDirection:'column' }}>
              New PIN (4–8 digits)
              <input inputMode="numeric" pattern="[0-9]*" value={newPin} onChange={e=>{ setNewPin(e.target.value); setPinSaveMsg(null) }} placeholder="1234" />
            </label>
            <label style={{ display:'flex', flexDirection:'column' }}>
              Confirm PIN
              <input inputMode="numeric" pattern="[0-9]*" value={newPin2} onChange={e=>{ setNewPin2(e.target.value); setPinSaveMsg(null) }} placeholder="1234" />
            </label>
            <div className="meter-text" style={{ alignSelf:'flex-end' }}>
              Strength tip: avoid repeating digits like 1111 or sequences like 1234.
            </div>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="btn"
              disabled={pinBusy || !/^[0-9]{4,8}$/.test(newPin) || newPin !== newPin2 || !reauthEmail || !reauthPassword}
              onClick={async ()=>{
                try {
                  setPinBusy(true)
                  setPinSaveMsg(null)
                  // Re-authenticate
                  const auth = getAuth()
                  if (!auth.currentUser) { setPinSaveMsg('Please sign in again.'); setPinBusy(false); return }
                  const cred = EmailAuthProvider.credential(reauthEmail, reauthPassword)
                  await reauthenticateWithCredential(auth.currentUser, cred)
                  // Call backend to set PIN
                  const resp = await fetch('/api/parent/set-pin', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ pin: newPin }) })
                  const json = await resp.json().catch(()=>({ ok:false }))
                  if (!json.ok) {
                    setPinSaveMsg('Unable to update at this time. Please try again later.')
                  } else {
                    setPinSaveMsg('Parent PIN updated.')
                    setNewPin(''); setNewPin2(''); setReauthPassword('')
                  }
                } catch (e) {
                  setPinSaveMsg('Unable to update at this time. Please try again later.')
                } finally {
                  setPinBusy(false)
                }
              }}
            >Save PIN</button>
          </div>
          {pinSaveMsg && <div className="badge" role="status" style={{ marginTop: 8 }}>{pinSaveMsg}</div>}
        </div>
        {/* Gift Requests */}
        <div className="card">
          <h3 className="flex items-center">
            <Image src="/giftbox.png" alt="Gift Box" width={24} height={24} className="mr-2" />
            Gift Requests
          </h3>
          <div className="list" aria-live="polite">
            {wishlist.filter(w=>w.status==='wants').length===0 && (
              <p className="meter-text" style={{ marginTop: 0 }}>No gift requests.</p>
            )}
            {wishlist.filter(w=>w.status==='wants').map(item => (
              <div key={item.id} className="card item" style={{ marginTop: 8 }}>
                <div className="item-top">
                  <div>
                    <h4 style={{ margin: 0 }}>{item.name}</h4>
                    {typeof item.price === 'number' && <p style={{ marginTop: 4 }}>${item.price.toFixed(2)}</p>}
                    {item.url && <a className="link" href={item.url} target="_blank" rel="noreferrer">View Item</a>}
                    <div className="meter-text" style={{ marginTop: 4 }}>Child: <strong>{children.find(c=>c.id===childId)?.name || childId}</strong></div>
                  </div>
                  <div className="chips">
                    <button className="chip" title="Approve" onClick={()=>updateItemStatus(item.id,'purchased')}>Approve</button>
                    <button className="chip" title="Reject" onClick={()=>updateItemStatus(item.id,'passed')}>Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Good Deed Log (read-only) */}
        <div className="card">
          <h3 className="flex items-center">
            <Image src="/goodstar.png" alt="Good Deed Star" width={24} height={24} className="mr-2" />
            Good Deed Log
          </h3>
          {pendingDeeds.filter(d=>d.status==='pending' || d.status==='approved' || d.status==='rejected').length===0 && <p className="meter-text" style={{ marginTop: 0 }}>No deeds yet.</p>}
          <ul className="list">
            {pendingDeeds.map(d => (
              <li key={d.id} className={`list-item ${d.status}`} style={{ alignItems:'flex-start', gap: 12 }}>
                <div style={{ maxWidth: '70%' }}>
                  <div className="meter-text" style={{ marginBottom: 4 }}>Child: <strong>{children.find(c=>c.id===childId)?.name || childId}</strong></div>
                  <div style={{ fontSize: 16 }}>{d.description}</div>
                  {d.source === 'santa-note' && (
                    <div className="badge" title="From Santa Note" style={{ marginTop: 6 }}>📜 santa-note</div>
                  )}
                </div>
                <span className={`badge ${d.status}`}>{d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Other Messages */}
      <div className="card">
        <h3>❓ Other Messages</h3>
        <ul className="list">
          {pendingDeeds.filter(d=>d.status==='noted').length===0 && (
            <p className="meter-text" style={{ marginTop: 0 }}>No other messages.</p>
          )}
          {pendingDeeds.filter(d=>d.status==='noted').map(d => (
            <li key={d.id} className="list-item" style={{ alignItems:'flex-start' }}>
              <div style={{ maxWidth: '70%' }}>
                <div className="meter-text" style={{ marginBottom: 4 }}>Child: <strong>{children.find(c=>c.id===childId)?.name || childId}</strong></div>
                <div style={{ fontSize: 16 }}>{d.description}</div>
              </div>
              <div className="row">
                <a className="btn" href="/santa">Respond</a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Santa’s Message</h3>
        {lastAffirmation ? (
          <p style={{ marginTop: 0 }}>{lastAffirmation}</p>
        ) : (
          <p className="meter-text" style={{ marginTop: 0 }}>No message yet.</p>
        )}
        {lastAffirmationAt && (
          <div className="meter-text">Updated: {lastAffirmationAt.toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</div>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={clearAffirmation} disabled={!lastAffirmation && !lastAffirmationAt}>Clear message</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <h3>Wish List</h3>
          <div style={{ position: 'sticky', top: 8 }}>
            <div className="meter-text">Estimated Subtotal: <strong>${subtotal.toFixed(2)}</strong></div>
            <div className="meter-text">Purchased: <strong>{purchasedCount}</strong></div>
          </div>
        </div>
        {toast && <div className="badge" role="status" aria-live="polite">{toast}</div>}

        <div className="row" style={{ margin: '8px 0' }}>
          <button
            className="btn secondary"
            onClick={async ()=>{
              for (const w of wishlist) {
                if (w.retailer === 'ai' && w.url) await refreshPrice(w)
              }
            }}
          >Update All Prices</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {wishlist.map(w => (
            <WishItemCard
              key={w.id}
              item={w}
              onStatus={(s: WishItem['status'])=>updateItemStatus(w.id, s)}
              showPrice
            />
          ))}
        </div>
      </div>
    </section>
  )
}
