'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { daysUntilChristmas, msUntilNextMidnight } from '@/lib/date'

export default function NorthPoleCounter({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date>(() => new Date())
  const { days, isToday } = useMemo(() => daysUntilChristmas(now), [now])

  useEffect(() => {
    // Update at next local midnight so the counter stays accurate
    const t = setTimeout(() => setNow(new Date()), msUntilNextMidnight())
    return () => clearTimeout(t)
  }, [now])

  const message = isToday
    ? 'Merry Christmas!'
    : days === 1
      ? '1 day until Christmas'
      : `${days} days until Christmas`

  return (
    <div className={`northpole ${compact ? 'compact' : ''}`} aria-label={message}>
      <div className="pole">
        <div className="finial" aria-hidden="true" />
      </div>
      <div className="sign" role="group" aria-roledescription="North Pole sign">
        <div className="snowcap" aria-hidden="true" />
        <div className="sign-text" aria-live="polite">{message}</div>
      </div>
    </div>
  )
}
