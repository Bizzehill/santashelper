type Props = { daysRemaining: number; totalDays?: number }

export default function CandyCaneCountdown({ daysRemaining, totalDays = 100 }: Props) {
  const clamped = Math.max(0, Math.min(totalDays, daysRemaining))
  const progress = 1 - clamped / totalDays
  const pct = Math.round(progress * 100)

  return (
    <div className="candycane-wrap" aria-label={`${daysRemaining} days until Christmas`}>
      <span className="candycane-text">{daysRemaining} days until Christmas</span>
      <div className="candycane-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="candycane-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
