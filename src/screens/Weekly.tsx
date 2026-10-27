import { useEffect, useState } from 'react'
import type { AppData } from '../hooks'
import { checkAnchor, minLabel } from '../domain/layers'
import { TIER_LABEL, tierAtLeast } from '../domain/rules'
import { addDays, formatKDate, weekStart } from '../domain/time'
import type { IfThen } from '../domain/types'
import { saveReview, updateHabit } from '../db/queries'
import { useToast } from '../ui/common'

export function Weekly({ data }: { data: AppData }) {
  const { habit, progress: p, today } = data
  const toast = useToast()
  const [ws, setWs] = useState(weekStart(today))
  const review = habit ? data.reviews.find(r => r.id === `${habit.id}|${ws}`) : undefined
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [fixIdx, setFixIdx] = useState<number | null>(null)
  const [fix, setFix] = useState<IfThen>({ if: '', then: '' })

  useEffect(() => {
    setReasons(Object.fromEntries((review?.missed ?? []).map(m => [m.date, m.reason])))
    setFixIdx(null)
  }, [review?.id, ws])

  if (!habit || !p?.started) {
    return <div className="card"><p className="muted">66일 여정이 시작되면 주간 리뷰가 열린다.</p></div>
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const cells = days.map(d => p.cells.find(c => c.date === d))
  const missed = cells.filter(c => c && c.date < today && !tierAtLeast(c.tier, 'basic'))
  const week = p.weeks.find(w => w.weekStart === ws)
  const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(ws, 7 + i))
  const xpWeek = cells.reduce((s, c) => s + (c?.xp ?? 0), 0) + (week?.cashed ? 20 : 0)

  async function save() {
    let ifThenChange
    if (fixIdx !== null && fix.if && fix.then) {
      const next = [...habit!.ifThen]
      ifThenChange = { index: fixIdx, before: next[fixIdx] ?? { if: '', then: '' }, after: fix }
      next[fixIdx] = fix
      await updateHabit(habit!.id, { ifThen: next })
    }
    await saveReview({
      habitId: habit!.id, weekStart: ws,
      missed: missed.map(c => ({ date: c!.date, reason: reasons[c!.date] ?? '' })),
      ifThenChange: ifThenChange ?? review?.ifThenChange,
    })
    toast('주간 리뷰를 저장했다')
  }

  return (
    <div className="stack-lg">
      <div className="row between">
        <button className="btn sm" onClick={() => setWs(addDays(ws, -7))} aria-label="지난주">‹</button>
        <div style={{ textAlign: 'center' }}>
          <h2>{formatKDate(ws)} 주</h2>
          <p className="small muted">일요일 10분 리뷰 {review && '· 저장됨'}</p>
        </div>
        <button className="btn sm" disabled={ws >= weekStart(today)} onClick={() => setWs(addDays(ws, 7))} aria-label="다음주">›</button>
      </div>

      <div className="card stack">
        <div className="chapter-grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((c, i) => (
            <div key={days[i]} className={`cell ${c?.tier ?? ''} ${c?.state === 'missed' ? 'missed' : ''} ${!c || c.state === 'future' ? 'future' : ''}`}>
              {['월', '화', '수', '목', '금', '토', '일'][i]}
              {c?.shieldUsed && <span className="badge">🛡</span>}
            </div>
          ))}
        </div>
        <div className="row between small">
          <span>이번 주 <b className="num">{xpWeek} XP</b></span>
          <span className="muted">
            실드 {week?.usedOn ? `${formatKDate(week.usedOn)}에 사용` : week?.cashed ? '환전 +20 XP' : '아직 남음 (안 쓰면 주말에 +20 XP)'}
          </span>
        </div>
      </div>

      <section className="card stack">
        <h3>1. 기본을 놓친 날과 이유</h3>
        {missed.length === 0
          ? <p className="small muted">놓친 날이 없다.</p>
          : missed.map(c => (
            <label key={c!.date} className="field">
              {formatKDate(c!.date)} · {c!.tier ? `${TIER_LABEL[c!.tier]}만 함` : '기록 없음'}
              <input className="input" value={reasons[c!.date] ?? ''} placeholder="야근, 약속, 피곤…"
                onChange={e => setReasons(r => ({ ...r, [c!.date]: e.target.value }))} />
            </label>
          ))}
      </section>

      <section className="card stack">
        <h3>2. "만약 ~하면 ~한다" 하나 고치기</h3>
        <p className="small muted">놓친 이유를 보고 다음 주에 같은 이유로 놓치지 않게 계획 하나를 손본다.</p>
        {[0, 1, 2].map(i => {
          const x = habit.ifThen[i]
          return (
            <button key={i} className={`btn ${fixIdx === i ? 'primary' : ''}`} style={{ textAlign: 'left' }}
              onClick={() => { setFixIdx(i); setFix(x ?? { if: '', then: '' }) }}>
              {x?.if ? `만약 ${x.if} → ${x.then}` : `+ 계획 ${i + 1} 추가`}
            </button>
          )
        })}
        {fixIdx !== null && (
          <div className="stack">
            <label className="field">만약<input className="input" value={fix.if} onChange={e => setFix(f => ({ ...f, if: e.target.value }))} placeholder="야근으로 9시 넘어 귀가하면" /></label>
            <label className="field">그러면<input className="input" value={fix.then} onChange={e => setFix(f => ({ ...f, then: e.target.value }))} placeholder="현관에서 바로 스쿼트 10회" /></label>
          </div>
        )}
        {review?.ifThenChange && fixIdx === null && (
          <p className="small muted">이번 주에 고친 계획: 만약 {review.ifThenChange.after.if} → {review.ifThenChange.after.then}</p>
        )}
      </section>

      <section className="card stack">
        <h3>3. 다음 주 앵커가 흔들리는 날</h3>
        {nextWeek.map(d => {
          const c = checkAnchor(habit, data.blocks, data.events, d)
          const evs = data.events.filter(e => e.date === d && e.status !== 'cancelled')
          if (!c.conflict && !evs.length) return null
          return (
            <div key={d} className="small">
              <b>{formatKDate(d)}</b> {evs.map(e => e.title).join(', ')}
              {c.conflict && <span style={{ color: 'var(--warn)' }}> · 앵커 겹침{c.suggestion && ` → ${minLabel(c.suggestion.start)} 제안`}</span>}
            </div>
          )
        })}
        {nextWeek.every(d => !data.events.some(e => e.date === d)) && (
          <p className="small muted">다음 주 이벤트가 없다. 들어온 약속은 하루 화면에서 바로 등록한다.</p>
        )}
      </section>

      <button className="btn primary block" onClick={save}>리뷰 저장</button>
    </div>
  )
}
