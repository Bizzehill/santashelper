'use client'
import React from 'react'

type Props = { approvedPoints: number; pointsPerGift: number; maxGifts: number }
export default function GoodnessMeter({ approvedPoints, pointsPerGift, maxGifts }: Props) {
  const giftsEarned = Math.floor(approvedPoints / pointsPerGift)
  const clamped = Math.min(giftsEarned, maxGifts)
  const pct = Math.min(100, Math.round((clamped / maxGifts) * 100))
  return (
    <div className="meter">
      <div className="meter-bar" style={{ width: pct + '%' }} />
      <div className="meter-text">
        Gifts earned: <strong>{clamped}</strong> / {maxGifts} (Points: {approvedPoints})
      </div>
    </div>
  )
}
