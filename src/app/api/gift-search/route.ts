import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import crypto from 'crypto'

// Data shapes
export type GiftResultPublic = {
  title: string
  image: string | null
  url: string | null
  retailer: 'amazon' | 'walmart' | 'ai'
  hasPrice: boolean
}
export type GiftResultFull = GiftResultPublic & { price: number | null }

// Helpers
function uniqByTitle(items: GiftResultFull[]): GiftResultFull[] {
  const seen = new Set<string>()
  const out: GiftResultFull[] = []
  for (const it of items) {
    const key = it.title.trim().toLowerCase()
    if (!seen.has(key)) { seen.add(key); out.push(it) }
  }
  return out
}

async function normalizeQuery(client: OpenAI, query: string, childAge?: number): Promise<string> {
  const system = 'You refine gift search queries to be family-friendly, concise, and brand-neutral when possible.'
  const user = `Make safe, concise query for kid age ${childAge ?? 'unknown'}: ${query}`
  try {
    const r = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 40, messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]})
    return (r.choices[0]?.message?.content ?? query).slice(0, 120)
  } catch { return query }
}

// Retailer adapters (minimal; fill with real SDK calls when keys exist)
async function searchAmazon(query: string, limit: number): Promise<GiftResultFull[]> {
  const accessKey = process.env.AMAZON_ACCESS_KEY_ID
  const secretKey = process.env.AMAZON_SECRET_ACCESS_KEY
  const partnerTag = process.env.AMAZON_PARTNER_TAG
  const partnerType = process.env.AMAZON_PARTNER_TYPE || 'Associates'
  if (!accessKey || !secretKey || !partnerTag) return []

  const host = 'webservices.amazon.com'
  const region = 'us-east-1'
  const service = 'ProductAdvertisingAPI'
  const path = '/paapi5/searchitems'
  const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'

  // Choose a likely index to improve relevance; default to ToysAndGames for kid gifts
  const lowerQ = query.toLowerCase()
  const searchIndex = lowerQ.match(/book|storybook|novel/) ? 'Books' : 'ToysAndGames'

  const body = {
    PartnerTag: partnerTag,
    PartnerType: partnerType,
    Keywords: query,
    SearchIndex: searchIndex,
    Marketplace: 'www.amazon.com',
    ItemCount: Math.max(1, Math.min(10, limit)),
    Resources: [
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Offers.Listings.Price',
      'Offers.Summaries.LowestPrice'
    ]
  }
  const payload = JSON.stringify(body)
  const payloadHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex')

  const amzDate = new Date().toISOString().replace(/[-:]|\..{3}/g, '') // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.substring(0, 8)

  const canonicalHeaders = [
    ['content-type', 'application/json; charset=UTF-8'],
    ['host', host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
    ['x-amz-target', target],
  ]
  const signedHeaders = canonicalHeaders.map(([k]) => k).join(';')
  const canonicalHeadersStr = canonicalHeaders.map(([k, v]) => `${k}:${v}\n`).join('')
  const canonicalRequest = [
    'POST',
    path,
    '',
    canonicalHeadersStr,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n')

  function hmac(key: Buffer | string, data: string) { return crypto.createHmac('sha256', key).update(data, 'utf8').digest() }
  const kDate = hmac('AWS4' + secretKey, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const url = `https://${host}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'accept': 'application/json',
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'x-amz-target': target,
      'authorization': authorization,
      'host': host,
    },
    body: payload,
    // Optional: Next.js fetch options left default
  })
  const text = await res.text()
  if (!res.ok) {
    console.warn('[gift-search][amazon] HTTP', res.status, text?.slice(0, 500))
    return []
  }
  const data = (()=>{ try { return JSON.parse(text) } catch { return {} as unknown } })() as { Errors?: Array<{ Code: string; Message: string }>; SearchResult?: { Items?: unknown[] } }
  if (Array.isArray(data?.Errors) && data.Errors.length) {
    console.warn('[gift-search][amazon] API Errors:', JSON.stringify(data.Errors).slice(0, 500))
    return []
  }
  type AmazonItem = {
    ASIN?: string
    DetailPageURL?: string
    ItemInfo?: { Title?: { DisplayValue?: string } }
    Images?: { Primary?: { Large?: { URL?: string }, Medium?: { URL?: string } } }
    Offers?: { Listings?: Array<{ Price?: { Amount?: number } }> }
  }
  const items = (data?.SearchResult?.Items || []) as AmazonItem[]
  const mapped: GiftResultFull[] = items.map((it) => {
    const title = it?.ItemInfo?.Title?.DisplayValue || it?.ASIN || 'Item'
    const image = it?.Images?.Primary?.Large?.URL || it?.Images?.Primary?.Medium?.URL || null
    const url = it?.DetailPageURL || null
    const listing = it?.Offers?.Listings?.[0]
    const amount = listing?.Price?.Amount
    const price = typeof amount === 'number' ? amount : null
    return { title, image, url, retailer: 'amazon', hasPrice: price != null, price }
  })
  return mapped
}

async function searchWalmart(): Promise<GiftResultFull[]> {
  const hasKey = !!process.env.WALMART_API_KEY
  if (!hasKey) return []
  // TODO: Implement Walmart Search API call. Placeholder shape for now.
  return []
}

async function aiBackfill(client: OpenAI, query: string, limit: number): Promise<GiftResultFull[]> {
  const prompt = `Suggest ${limit} kid-friendly gift ideas based on: ${query}. Return JSON array with fields: title, image (representative URL or null), url (null), retailer='ai'. Do not include prices.`
  const r = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 400, messages:[
    { role: 'system', content: 'You return compact JSON only.' },
    { role: 'user', content: prompt }
  ]})
  const text = r.choices[0]?.message?.content ?? '[]'
  try {
    const arr = JSON.parse(text) as Array<{ title: string; image?: string | null; url?: string | null; retailer?: string }>
    return arr.filter(x=>x && x.title).map(x=>({
      title: x.title,
      image: x.image ?? null,
      url: x.url ?? null,
      retailer: (x.retailer === 'amazon' || x.retailer === 'walmart') ? x.retailer : 'ai',
      hasPrice: false,
      price: null,
    }))
  } catch {
    // Fallback to simple suggestions
    return Array.from({ length: limit }).map((_,i)=>({
      title: `${query} idea #${i+1}`,
      image: null,
      url: null,
      retailer: 'ai' as const,
      hasPrice: false,
      price: null,
    }))
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: string; limit?: number; childAge?: number }
    const query = body.query
    const limit = body.limit ?? 8
    const childAge = body.childAge
    if (!query || !query.trim()) return NextResponse.json({ ok:false, error:'Missing query' }, { status: 400 })

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Light input cleaning before any external calls
    const refined = await normalizeQuery(openai, query.trim().slice(0, 120), childAge)

    // Retailers (server-side only)
    const [amz, wmt] = await Promise.all([
      searchAmazon(refined, limit),
      searchWalmart()
    ])

    let merged = uniqByTitle([...amz, ...wmt])
    if (merged.length === 0) {
      const ai = await aiBackfill(openai, refined, limit)
      merged = uniqByTitle(ai)
    }

    // Cap results
    merged = merged.slice(0, Math.max(1, Math.min(24, limit)))

    // Redact prices for client
    const publicResults: GiftResultPublic[] = merged.map(m=>({
      title: m.title,
      image: m.image ?? null,
      url: m.url ?? null,
      retailer: m.retailer,
      hasPrice: typeof m.price === 'number',
    }))

    return NextResponse.json({ ok:true, results: publicResults })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ ok:false, error: msg }, { status: 500 })
  }
}
