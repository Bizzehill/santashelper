import OpenAI from 'openai'
import { NextResponse } from 'next/server'

// POST /api/santa-readaloud
// Body: { text: string }
// Using "onyx" for a deep, warm, Santa-like male voice.
// Alternatives: "alloy" (neutral), "fable" (softer), "echo" (younger male)
// Note: If the model exposes a speech rate parameter in the future, target ~0.92 for a slower, more natural Santa cadence.

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string }

    const raw = (text ?? '').toString()
    const trimmed = raw.trim()
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: 'Empty text' }, { status: 400 })
    }

    const MAX = 240
    const toSpeak = trimmed.length <= MAX ? trimmed : trimmed.slice(0, MAX - 1).trimEnd() + '…'

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[santa-readaloud] missing OPENAI_API_KEY')
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

  // Default to the deepest, resonant male voice; allow env override if desired.
  const voice = process.env.SANTA_VOICE || 'onyx'

    console.log(`[santa-readaloud] input length=${trimmed.length} speak length=${toSpeak.length}`)

    const client = new OpenAI({ apiKey })

    // Use OpenAI TTS to produce MP3
    const resp = await client.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: toSpeak,
      // speed: 0.92, // (Not currently exposed in this SDK; keep for future reference.)
    })

    const arrayBuf = await resp.arrayBuffer()
    const buf = Buffer.from(arrayBuf)
    const b64 = buf.toString('base64')
    const contentType = (resp as any).headers?.get?.('content-type') || 'audio/mpeg'
    const dataUrl = `data:${contentType};base64,${b64}`

    console.log(`[santa-readaloud] success bytes=${buf.length}`)
    return NextResponse.json({ ok: true, dataUrl })
  } catch (err: any) {
    const msg = typeof err?.message === 'string' ? err.message : 'Unexpected error'
    console.error('[santa-readaloud] failure', msg)
    return NextResponse.json({ ok: false, error: 'TTS failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'