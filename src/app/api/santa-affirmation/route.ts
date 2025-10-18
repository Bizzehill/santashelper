import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

async function moderateText(text: string, origin: string): Promise<{ flagged: boolean }> {
  try {
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
  } catch {}
  // Fallback direct moderation
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const r = await client.moderations.create({ model: 'omni-moderation-latest', input: text })
  const flagged = (r.results?.[0]?.flagged ?? false) as boolean
  return { flagged }
}

function clampOneSentenceUnder20Words(s: string): string {
  const oneLine = s.replace(/\s+/g, ' ').trim()
  // simple split by sentence end; take first sentence
  const firstSentence = oneLine.split(/(?<=[.!?])\s/)[0] || oneLine
  const words = firstSentence.split(' ').filter(Boolean)
  const trimmed = words.slice(0, 20).join(' ')
  // ensure ends with punctuation
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl?.origin || ''
    const body = await req.json() as { text?: string }
    const raw = (body.text ?? '').trim()
    if (!raw || raw.length > 200) {
      return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 })
    }

    // Safety: moderate before sending to OpenAI
    const mod = await moderateText(raw, origin)
    if (mod.flagged) {
      return NextResponse.json({ ok: false, error: 'flagged' }, { status: 400 })
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    // Prefer Responses API; fallback to chat if needed
    let message = ''
    try {
      const resp = await client.responses.create({
        model: 'gpt-4o-mini',
        instructions: 'You are Santa Claus writing short, wholesome, Christmas-themed affirmations for children. Your tone should be warm, kind, and magical—no adult themes or promises. Respond with ONE sentence, under 20 words. Do not echo the child\'s full note.',
        input: `Child note: "${raw}"\nWrite one encouraging sentence from Santa.`,
        max_output_tokens: 60,
        temperature: 0.7,
      })
      // @ts-ignore - output_text is provided by SDK helpers
      const textOut = (resp as any).output_text as string | undefined
      if (textOut && textOut.trim()) {
        message = textOut.trim()
      } else {
        const out = (resp as any).output?.[0]?.content?.[0]?.text as string | undefined
        message = (out || '').trim()
      }
    } catch {
      // Fallback to chat completions if responses API not available
      const ch = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 60,
        messages: [
          { role: 'system', content: 'You are Santa Claus writing short, wholesome, Christmas-themed affirmations for children. Tone: warm, kind, magical. ONE sentence, under 20 words. No adult themes or promises. Do not echo the child\'s full note.' },
          { role: 'user', content: `Child note: "${raw}"
Write one encouraging sentence from Santa.` }
        ]
      })
      message = (ch.choices?.[0]?.message?.content || '').trim()
    }

    if (!message) {
      message = 'Santa is proud of your good heart!'
    }
    message = clampOneSentenceUnder20Words(message)

    return NextResponse.json({ ok: true, message })
  } catch (e) {
    return NextResponse.json({ ok: true, message: 'Santa is proud of your good heart!' })
  }
}
