'use client'
import React from 'react'
import Image from 'next/image'

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
  return (
    <div className="card item">
      <div className="item-top">
        <div>
          <h4>{item.name}</h4>
          {showPrice && item.price != null && <p>${item.price.toFixed(2)}</p>}
          {item.url && <a className="link" href={item.url} target="_blank">View link</a>}
        </div>
        {item.image && <Image src={item.image} alt={item.name} width={96} height={96} style={{objectFit:'cover', borderRadius:8}} />}
      </div>
      {item.retailer && <span className={`badge retailer ${item.retailer}`}>{item.retailer}</span>}
      {onStatus && (
        <div className="chips">
          <button className={`chip ${item.status==='wants'?'active':''}`} onClick={()=>onStatus('wants')}>Wants</button>
          <button className={`chip ${item.status==='purchased'?'active':''}`} onClick={()=>onStatus('purchased')}>Purchased</button>
          <button className={`chip ${item.status==='passed'?'active':''}`} onClick={()=>onStatus('passed')}>Pass</button>
        </div>
      )}
    </div>
  )
}
