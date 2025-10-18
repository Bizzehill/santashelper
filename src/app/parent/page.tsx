'use client'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { WishItem } from '@/components/WishItemCard'

type DeedStatus = 'pending' | 'approved' | 'rejected' | 'noted'
type Deed = { id: string; description: string; status: DeedStatus; createdAt?: unknown; source?: string }
type Child = { id: string; name?: string; age: number }

export default function ParentPage() {
  const { user, logOut } = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [childId, setChildId] = useState<string>('')
  const [newChildName, setNewChildName] = useState('')
  const [pendingDeeds, setPendingDeeds] = useState<Deed[]>([])
  const [wishlist, setWishlist] = useState<WishItem[]>([])
  const [toast, setToast] = useState<string>('')
  const [settings, setSettings] = useState({ age: 8 })
  const [lastAffirmation, setLastAffirmation] = useState<string | null>(null)
  const [lastAffirmationAt, setLastAffirmationAt] = useState<Date | null>(null)
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

  return (
    <section className="card">
      <div className="row between">
        <h2>Parent Dashboard</h2>
        <button className="btn secondary" onClick={logOut}>Sign out</button>
      </div>

      <div className="card">
        <h3>Children</h3>
        <div className="row">
          <select value={childId} onChange={e=>setChildId(e.target.value)}>
            {children.map(c=> <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
          </select>
          <input value={newChildName} onChange={e=>setNewChildName(e.target.value)} placeholder="Add a child name"/>
          <button className="btn" onClick={addChild}>Add</button>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Child Settings</h3>
          <label>Child age<input type="number" min={1} value={settings.age} onChange={e=>updateSettings({ age:Number(e.target.value) })}/></label>
        </div>

        <div className="card">
          <h3>Pending Deeds</h3>
          {pendingDeeds.length===0 && <p>No deeds yet.</p>}
          <ul className="list">
            {pendingDeeds.map(d => (
              <li key={d.id} className={`list-item ${d.status}`}>
                <div>
                  <strong>{d.description}</strong>
                  {d.source === 'santa-note' && (
                    <> <span className="badge" title="From Santa Note">📜 santa-note</span></>
                  )}
                </div>
                <div className="row">
                  {(d.status==='pending' || d.status==='noted') ? (
                    <>
                      <button className="btn" onClick={()=>approveDeed(d.id)}>Approve</button>
                      <button className="btn secondary" onClick={()=>rejectDeed(d.id)}>Reject</button>
                    </>
                  ) : (
                    <span className={`badge ${d.status}`}>{d.status}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
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

      <div className="card">
        <h3>Wish List</h3>
        {toast && <div className="badge" role="status" aria-live="polite">{toast}</div>}
        <div className="row between" style={{marginBottom:8}}>
          <div className="meter-text">Estimated Subtotal: <strong>${subtotal.toFixed(2)}</strong></div>
          <div className="meter-text">Purchased: <strong>{purchasedCount}</strong></div>
        </div>
        <div className="grid3">
          {wishlist.map(w => (
            <div key={w.id} className="card item">
              <div className="item-top">
                <div>
                  <h4>{w.name}</h4>
                  {typeof w.price === 'number' && <p>${w.price.toFixed(2)}</p>}
                  {w.url && <a className="link" href={w.url} target="_blank">View link</a>}
                  {w.retailer && <span className={`badge retailer ${w.retailer}`}>{w.retailer}</span>}
                </div>
              </div>
              <div className="chips">
                <button className={`chip ${w.status==='wants'?'active':''}`} onClick={()=>updateItemStatus(w.id, 'wants')}>Wants</button>
                <button className={`chip ${w.status==='purchased'?'active':''}`} onClick={()=>updateItemStatus(w.id, 'purchased')}>Purchased</button>
                <button className={`chip ${w.status==='passed'?'active':''}`} onClick={()=>updateItemStatus(w.id, 'passed')}>Pass</button>
              </div>
              <div className="row">
                <button className="btn secondary" disabled={!w.url || !w.retailer} onClick={()=>refreshPrice(w)}>Update Price</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
