'use client'
import React, { useState } from 'react'
import Image from 'next/image'
import Tag from './Tag'

export type WishItem = {
  id: string
  name: string
  price?: number
  url?: string
  image?: string
  retailer?: 'amazon' | 'walmart' | 'ai'
  status: 'wants' | 'purchased' | 'passed'
}

export default function WishItemCard({ item, onStatus, showPrice }: { item: WishItem; onStatus?: (s: WishItem['status']) => void; showPrice?: boolean }) {
  const [clicked, setClicked] = useState<null | WishItem['status']>(null)

  const handleClick = (status: WishItem['status']) => {
    setClicked(status)
    if (onStatus) onStatus(status)
    // Remove flash after short delay
    setTimeout(() => setClicked(null), 250)
  }

  return (
    <div
      className={`card item relative transition-transform duration-200 hover:scale-[1.01] hover:shadow-lg ${clicked ? 'ring-2 ring-offset-2 ring-[var(--accent)] ring-offset-[#0b1220]' : ''}`}
    >
      {/* Source Tag */}
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        <Tag text={item.retailer === 'ai' ? 'AI Suggestion' : 'Child Wish'} scheme={item.retailer === 'ai' ? 'silver' : 'gold'} />
      </div>

      <div className="item-top">
        <div>
          <h4 className="line-clamp-2" title={item.name}>{item.name}</h4>
          {showPrice && item.price != null && <p>${item.price.toFixed(2)}</p>}
          {item.url && <a className="link" href={item.url} target="_blank">View link</a>}
        </div>
        {item.image && <Image src={item.image} alt={item.name} width={96} height={96} style={{objectFit:'cover', borderRadius:8}} />}
      </div>
      {item.retailer && <span className={`badge retailer ${item.retailer}`}>{item.retailer}</span>}
      {onStatus && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={()=>handleClick('wants')}
              aria-label="Mark as wants"
              aria-pressed={item.status==='wants'}
              className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-[#0b1220]
                ${item.status==='wants'
                  ? 'bg-[#6d28d9] text-white border-[#5b21b6] shadow-md'
                  : 'bg-[#1b2540] text-gray-100 border-[#334155] hover:scale-[1.02] hover:border-[#475569] hover:bg-[#223058]'}
              `}
              style={{
                boxShadow: item.status==='wants' ? '0 0 0 2px rgba(124,58,237,0.35) inset' : undefined,
              }}
            >
              🏰 Wants
            </button>
            <button
              onClick={()=>handleClick('purchased')}
              aria-label="Mark as purchased"
              aria-pressed={item.status==='purchased'}
              className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#16a34a] focus-visible:ring-offset-[#0b1220]
                ${item.status==='purchased'
                  ? 'bg-[#16a34a] text-white border-[#15803d] shadow-md'
                  : 'bg-[#1b2540] text-gray-100 border-[#334155] hover:scale-[1.02] hover:border-[#4b5563] hover:bg-[#1e2a48]'}
              `}
              style={{
                boxShadow: item.status==='purchased' ? '0 0 0 2px rgba(22,163,74,0.35) inset' : undefined,
              }}
            >
              ✅ Purchased
            </button>
            <button
              onClick={()=>handleClick('passed')}
              aria-label="Mark as pass"
              aria-pressed={item.status==='passed'}
              className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#dc2626] focus-visible:ring-offset-[#0b1220]
                ${item.status==='passed'
                  ? 'bg-[#dc2626] text-white border-[#b91c1c] shadow-md'
                  : 'bg-[#1b2540] text-gray-100 border-[#334155] hover:scale-[1.02] hover:border-[#ef4444] hover:bg-[#2a1b1b]'}
              `}
              style={{
                boxShadow: item.status==='passed' ? '0 0 0 2px rgba(220,38,38,0.35) inset' : undefined,
              }}
            >
              ❌ Pass
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
