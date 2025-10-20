import { NextRequest, NextResponse } from 'next/server'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const pin = (body?.pin as string | undefined)?.trim() || ''
    if (!/^[0-9]{4,8}$/.test(pin)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const app = getApp()
    const fn = httpsCallable(getFunctions(app), 'setParentPin')
    const res: any = await fn({ pin })
    if (res?.data?.ok) return NextResponse.json({ ok: true })
    return NextResponse.json({ ok: false }, { status: 400 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
