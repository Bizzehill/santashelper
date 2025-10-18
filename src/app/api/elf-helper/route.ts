import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { age = 8, interests = [] as string[], mode = 'deeds' } = body || {}
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const system = `You are Elf Helper, a cheerful assistant that suggests age-appropriate acts of kindness and gratitude prompts consistent with Christian family values (kindness, service, generosity). Keep answers short, concrete, and wholesome. Do not make medical, legal, or unsafe recommendations.`
  const userMsg = mode === 'deeds'
    ? `Suggest 8 simple good deeds for a child age ${age}. Consider interests: ${interests.join(', ')}`
    : `Write 5 short gratitude note prompts a child age ${age} can complete. Consider interests: ${interests.join(', ')}`

  try {
    const resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.7,
      max_tokens: 300
    })
    const text = resp.choices[0]?.message?.content ?? ''
    return NextResponse.json({ ok: true, text })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
