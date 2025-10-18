// Utilities for Christmas countdown

export function getChristmasTarget(now: Date = new Date()): Date {
  const year = now.getFullYear()
  const target = new Date(year, 11, 25) // Dec is month 11
  // If today is after Dec 25, target is next year's Dec 25
  if (truncateToDate(now).getTime() > truncateToDate(target).getTime()) {
    return new Date(year + 1, 11, 25)
  }
  return target
}

export function truncateToDate(d: Date): Date {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  return t
}

export function daysUntilChristmas(now: Date = new Date()): { days: number; isToday: boolean; target: Date } {
  const today = truncateToDate(now)
  const target = truncateToDate(getChristmasTarget(now))
  const msPerDay = 24 * 60 * 60 * 1000
  const diff = target.getTime() - today.getTime()
  const days = Math.round(diff / msPerDay)
  return { days, isToday: days === 0, target }
}

export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now)
  next.setDate(now.getDate() + 1)
  next.setHours(0, 0, 0, 0)
  return next.getTime() - now.getTime()
}
