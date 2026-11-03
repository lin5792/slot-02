import { planDay } from '../domain/layers'
import { formatDuration, nowMin, toMin } from '../domain/time'
import type { Block, CalendarEvent, HHmm, ISODate } from '../domain/types'

const R = 44
const C = 2 * Math.PI * R
const angle = (min: number) => (min / 1440) * 360 - 90
const point = (min: number, r: number) => {
  const a = (angle(min) * Math.PI) / 180
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) }
}

/** 24시간 링. 근무·수면·식사가 칠해지고, 빈 곳이 남는 시간이다. 점은 퀘스트 시각 */
export function DayRing({ blocks, events, date, dots, isToday }: {
  blocks: Block[]; events: CalendarEvent[]; date: ISODate; dots: { time: HHmm; done: boolean }[]; isToday: boolean
}) {
  const plan = planDay(blocks, events, date)
  const now = nowMin()
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={`남는 시간 ${formatDuration(plan.free)}`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        {plan.items.filter(i => i.layer !== 'L3').map(i => (
          <circle key={`${i.id}-${i.start}`} cx="50" cy="50" r={R} fill="none" className={`lyr-${i.layer}`}
            stroke="var(--c)" strokeWidth="9"
            strokeDasharray={`${((i.end - i.start) / 1440) * C} ${C}`}
            transform={`rotate(${angle(i.start)} 50 50)`} />
        ))}
        {dots.map((d, k) => {
          const p = point(toMin(d.time), R)
          return <circle key={k} cx={p.x} cy={p.y} r="4.2" fill={d.done ? 'var(--gold)' : 'var(--surface)'} stroke="var(--gold)" strokeWidth="2" />
        })}
        {isToday && (() => {
          const a = point(now, R - 9), b = point(now, R + 6)
          return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
        })()}
      </svg>
      <div className="ring-center">
        <small>남는 시간</small>
        <b>{formatDuration(plan.free)}</b>
      </div>
    </div>
  )
}
