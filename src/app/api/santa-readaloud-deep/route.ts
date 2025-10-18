import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { Readable } from 'stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

async function pitchShiftMp3(input: Buffer, semitones: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      // Compute factor F = 2^(-N/12), atempo = 1/F
      const N = semitones
      const F = Math.pow(2, -N / 12)
      const atempo = 1 / F
      // Compose filter: use 48kHz base rate
      const filter = `asetrate=48000*${F},aresample=48000,atempo=${atempo}`

      if (ffmpegPath) {
        // @ts-ignore - types may not include setFfmpegPath
        ffmpeg.setFfmpegPath(ffmpegPath as any)
      }

      const inputStream = Readable.from(input)
      const chunks: Buffer[] = []
      const command = ffmpeg()
        .input(inputStream)
        .inputFormat('mp3')
        .audioFilters(filter)
        .format('mp3')
  .on('error', (err: Error) => reject(err))
        .on('end', () => resolve(Buffer.concat(chunks)))

      const out = command.pipe()
      out.on('data', (c: Buffer) => chunks.push(c))
  out.on('error', (e: any) => reject(e))
    } catch (e) {
      reject(e)
    }
  })
}

export async function POST(req: Request) {
  try {
    const { text, semitones } = (await req.json()) as { text?: string; semitones?: number }

    const raw = (text ?? '').toString()
    const trimmed = raw.trim()
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: 'Empty text' }, { status: 400 })
    }
    const MAX = 240
    const toSpeak = trimmed.length <= MAX ? trimmed : trimmed.slice(0, MAX - 1).trimEnd() + '…'

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('[santa-readaloud-deep] missing OPENAI_API_KEY')
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }
    // Default onyx voice; env override if desired
    const voice = process.env.SANTA_VOICE || 'onyx'
    const N = clamp(typeof semitones === 'number' ? semitones : 3, -6, 6)

    console.log(`[santa-readaloud-deep] input=${trimmed.length} speak=${toSpeak.length} semitones=${N}`)

    const client = new OpenAI({ apiKey })
    const resp = await client.audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input: toSpeak })
    const arrayBuf = await resp.arrayBuffer()
    const baseBuf = Buffer.from(arrayBuf)

    try {
      const shifted = N === 0 ? baseBuf : await pitchShiftMp3(baseBuf, N)
      const b64 = shifted.toString('base64')
      const dataUrl = `data:audio/mpeg;base64,${b64}`
      console.log(`[santa-readaloud-deep] success bytes=${shifted.length}`)
      return NextResponse.json({ ok: true, dataUrl })
    } catch (e) {
      console.warn('[santa-readaloud-deep] ffmpeg failed, returning unshifted audio')
      const b64 = baseBuf.toString('base64')
      const dataUrl = `data:audio/mpeg;base64,${b64}`
      return NextResponse.json({ ok: true, dataUrl, degraded: true })
    }
  } catch (err: any) {
    const msg = typeof err?.message === 'string' ? err.message : 'Unexpected error'
    console.error('[santa-readaloud-deep] failure', msg)
    return NextResponse.json({ ok: false, error: 'TTS failed' }, { status: 500 })
  }
}