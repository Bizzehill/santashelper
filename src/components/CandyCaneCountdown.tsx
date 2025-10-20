type Props = { daysRemaining: number; totalDays?: number }

export default function CandyCaneCountdown({ daysRemaining, totalDays = 100 }: Props) {
  const clamped = Math.max(0, Math.min(totalDays, daysRemaining))
  const progress = 1 - clamped / totalDays
  const pct = Math.round(progress * 100)
  const isToday = daysRemaining === 0
  const message = isToday
    ? 'Merry Christmas!'
    : daysRemaining === 1
      ? '1 day until Christmas'
      : `${daysRemaining} days until Christmas`
  const isNear = daysRemaining <= 10

  return (
    <div className="candycane-wrap" aria-label={message}>
      <span className="candycane-text" aria-live="polite">{message}</span>
      <div className={`candycane-bar ${isNear ? 'near' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="candycane-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
