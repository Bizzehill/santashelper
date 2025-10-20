import { NextResponse } from 'next/server'

// Ensure Node.js runtime for Buffer/binary handling
export const runtime = 'nodejs'

const VOICE_ID = 'YOUR_SANTA_VOICE_ID' // Replace with your ElevenLabs Santa voice ID.

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string }

    const trimmed = text?.trim()
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      console.error('[santa-elevenlabs] missing ELEVENLABS_API_KEY')
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text: trimmed }),
    })

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      console.error(
        `[santa-elevenlabs] upstream failure status=${upstream.status} body=${errText.slice(0, 200)}`
      )
      return NextResponse.json({ ok: false, error: 'TTS request failed' }, { status: 500 })
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer())
    console.log(`[santa-elevenlabs] success bytes=${audioBuffer.length}`)

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
    console.error('[santa-elevenlabs] failure', message)
    return NextResponse.json({ ok: false, error: 'TTS failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
