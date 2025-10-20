import { NextResponse } from 'next/server'

// Use Node.js runtime to reliably handle Buffers/binary
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Allow configuration via env, with a clear placeholder fallback
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'YOUR_SANTA_VOICE_ID'
const MODEL_ID = 'eleven_monolingual_v1'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Server not configured: ELEVENLABS_API_KEY missing' },
        { status: 500 }
      )
    }

    if (!VOICE_ID || VOICE_ID === 'YOUR_SANTA_VOICE_ID') {
      return NextResponse.json(
        { ok: false, error: 'Voice ID not set. Set ELEVENLABS_VOICE_ID in .env.local or replace YOUR_SANTA_VOICE_ID.' },
        { status: 400 }
      )
    }

    const { text } = (await req.json()) as { text?: string }
    const trimmed = (text ?? '').toString().trim()
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: 'Text is required' }, { status: 400 })
    }

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`
    const payload = { text: trimmed, model_id: MODEL_ID }

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(payload),
    })

    if (!upstream.ok) {
      const status = upstream.status
      const errText = await upstream.text().catch(() => '')
      // Map common failure cases
      if (status === 400) {
        return NextResponse.json(
          { ok: false, error: 'Bad request to ElevenLabs', details: errText.slice(0, 300) },
          { status: 400 }
        )
      }
      if (status === 401 || status === 403) {
        return NextResponse.json(
          { ok: false, error: 'Invalid or unauthorized ELEVENLABS_API_KEY', details: errText.slice(0, 300) },
          { status: status }
        )
      }
      if (status === 429) {
        return NextResponse.json(
          { ok: false, error: 'Rate limit exceeded at ElevenLabs', details: errText.slice(0, 300) },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { ok: false, error: 'Upstream ElevenLabs error', status, details: errText.slice(0, 300) },
        { status: 502 }
      )
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer())
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message : 'Unexpected error'
    return NextResponse.json({ ok: false, error: 'TTS failed', message }, { status: 500 })
  }
}
