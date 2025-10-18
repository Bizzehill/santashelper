import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Reuse the public result shape from gift-search
import type { GiftResultPublic } from '@/app/api/gift-search/route'

type ClassifyResult = {
  gift_request: boolean
  good_deed: boolean
  cleaned_query: string
}

async function moderateText(text: string, origin: string): Promise<{ flagged: boolean }> {
  try {
    // Prefer calling our own moderation route to keep consistency and avoid duplicating logic
    const base = origin || process.env.NEXT_PUBLIC_BASE_URL || ''
    const res = await fetch(`${base}/api/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      cache: 'no-store',
    })
    if (res.ok) {
      const json = await res.json() as { flagged?: boolean }
      return { flagged: !!json.flagged }
    }
  } catch {
    // Fall back to direct OpenAI moderation if local route is not reachable in this environment
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const r = await client.moderations.create({ model: 'omni-moderation-latest', input: text })
  const flagged = (r.results?.[0]?.flagged ?? false) as boolean
  return { flagged }
}

async function classifyText(text: string): Promise<ClassifyResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const sys = 'You classify a child\'s note into gift request and/or good deed. Return strict JSON only.'
  const usr = `Note: ${text}\nReturn JSON with fields: { "gift_request": boolean, "good_deed": boolean, "cleaned_query": string }.\n- If gift_request is true, cleaned_query should be a concise, safe retail search term (no brands unless essential).\n- If not a gift request, cleaned_query="".`
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 120,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: usr }
    ]
  })
  const txt = resp.choices[0]?.message?.content ?? '{"gift_request":false,"good_deed":false,"cleaned_query":""}'
  try {
    const parsed = JSON.parse(txt) as ClassifyResult
    return {
      gift_request: !!parsed.gift_request,
      good_deed: !!parsed.good_deed,
      cleaned_query: typeof parsed.cleaned_query === 'string' ? parsed.cleaned_query.slice(0, 140) : ''
    }
  } catch {
    return { gift_request: false, good_deed: false, cleaned_query: '' }
  }
}

async function callGiftSearch(origin: string, query: string, childAge?: number): Promise<GiftResultPublic[]> {
  // Internal server-side call to our existing gift-search route
  const base = origin || process.env.NEXT_PUBLIC_BASE_URL || ''
  const res = await fetch(`${base}/api/gift-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 8, childAge }),
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = await res.json() as { ok?: boolean; results?: GiftResultPublic[] }
  return json.ok && Array.isArray(json.results) ? json.results : []
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl?.origin || ''
    const body = await req.json() as { text?: string; childId?: string; childAge?: number }
    const text = (body.text ?? '').slice(0, 1000).trim()
    const childAge = body.childAge

    // 1) Basic validation
    if (!text) {
      return NextResponse.json({ ok: false, error: 'Please include a note.' }, { status: 400 })
    }

    // 2) Moderation
    const mod = await moderateText(text, origin)
    if (mod.flagged) {
      return NextResponse.json({ ok: false, error: 'Please rephrase your note to be kind and safe.' }, { status: 400 })
    }

    // 3) Classification
    const cls = await classifyText(text)

    let giftResults: GiftResultPublic[] | null = null

    // 4) Gift search (if requested)
    if (cls.gift_request && cls.cleaned_query) {
      try {
        giftResults = await callGiftSearch(origin, cls.cleaned_query, childAge)
      } catch (e) {
        console.warn('[santa-note] gift-search failed', e)
        giftResults = []
      }
    }

    // 5) Friendly response per spec
    let message = 'Thanks for your note!'
    if (cls.good_deed && !cls.gift_request) {
      message = 'Santa read your note! 🎅'
    } else if (cls.gift_request && (giftResults?.length ?? 0) > 0) {
      message = 'Santa found some ideas you might like.'
    }

    return NextResponse.json({
      ok: true,
      intents: { gift_request: !!cls.gift_request, good_deed: !!cls.good_deed },
      giftResults: giftResults ?? null,
      message,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
