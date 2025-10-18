import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'

// Placeholder: In a real app we'd validate session and ownership. Here we check an Authorization header exists.
function requireAuth(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth) throw new Error('Unauthorized')
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req)
    const { path, url, retailer } = await req.json() as { path: string; url: string; retailer: 'amazon'|'walmart' }
    if (!path || !url || !retailer) return NextResponse.json({ ok:false, error:'Missing fields' }, { status:400 })

    // TODO: Re-query retailer by URL/ID. Placeholder static price.
    const latestPrice = Math.round((10 + Math.random()*90)*100)/100

    const ref = doc(db, path)
    const snap = await getDoc(ref)
    if (!snap.exists()) return NextResponse.json({ ok:false, error:'Doc not found' }, { status:404 })

    await updateDoc(ref, { price: latestPrice })
    return NextResponse.json({ ok:true, price: latestPrice })
  } catch(e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    const code = msg==='Unauthorized' ? 401 : 500
    return NextResponse.json({ ok:false, error: msg }, { status: code })
  }
}
