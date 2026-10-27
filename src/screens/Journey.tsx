import type { AppData } from '../hooks'
import { CHAPTER_DAYS, TIER_LABEL, chapterRule } from '../domain/rules'
import { formatKDate } from '../domain/time'
import type { DayCell } from '../domain/progress'
import { Hud } from '../ui/common'

export function Journey({ data }: { data: AppData }) {
  const { habit, progress: p } = data
  if (!habit || !p) return <SettledList data={data} />

  const chapters: DayCell[][] = []
  for (let i = 0; i < p.cells.length; i += CHAPTER_DAYS) chapters.push(p.cells.slice(i, i + CHAPTER_DAYS))
  const done = p.cells.filter(c => c.tier).length
  const past = p.cells.filter(c => c.state === 'done' || c.state === 'missed').length
  const shieldsUsed = p.weeks.filter(w => w.usedOn).length
  const shieldsCashed = p.weeks.filter(w => w.cashed).length

  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>{habit.title} · {p.totalDays}일 여정</h1>
        <p className="muted small">
          {habit.startDate && formatKDate(habit.startDate)} 시작 · {p.endDate && formatKDate(p.endDate)} 점검
        </p>
      </div>

      <Hud progress={p} totalXp={data.totalXp} />

      <div className="stats">
        <div className="stat"><b>{done}<small className="muted">/{past || 0}</small></b><span>수행한 날</span></div>
        <div className="stat"><b>{p.bestCombo}</b><span>최장 콤보</span></div>
        <div className="stat"><b>{shieldsUsed}·{shieldsCashed}</b><span>실드 사용·환전</span></div>
      </div>

      {chapters.map((cells, i) => {
        const rule = chapterRule(i + 1)
        return (
          <section key={i} className="card stack">
            <div className="row between">
              <h3>{rule.name}</h3>
              <span className="chip">{rule.capMin ? `상한 ${rule.capMin}분` : '상한 없음'}</span>
            </div>
            <div className="chapter-grid">
              {cells.map(c => (
                <div key={c.date}
                  className={`cell ${c.tier ?? ''} ${c.state === 'missed' ? 'missed' : ''} ${c.state === 'today' || (c.state === 'done' && c.date === data.today) ? 'today' : ''} ${c.state === 'future' ? 'future' : ''}`}
                  title={`${c.day}일차 · ${formatKDate(c.date)} · ${c.tier ? TIER_LABEL[c.tier] : c.state === 'missed' ? '놓침' : ''}`}>
                  {c.day}
                  {c.isBoss && <span className="badge">👑</span>}
                  {!c.isBoss && c.shieldUsed && <span className="badge">🛡</span>}
                  {!c.isBoss && c.comeback && <span className="badge">↩</span>}
                </div>
              ))}
            </div>
            <BossRow data={data} chapter={i + 1} />
          </section>
        )
      })}

      <div className="legend">
        <span><i style={{ background: 'var(--t-min)' }} />최소</span>
        <span><i style={{ background: 'var(--t-basic)' }} />기본</span>
        <span><i style={{ background: 'var(--t-best)' }} />최고</span>
        <span><i style={{ border: '1.5px dashed var(--line)' }} />놓침</span>
        <span>🛡 실드 · ↩ 복귀 · 👑 보스</span>
      </div>

      {data.srbai.filter(s => s.habitId === habit.id).length > 0 && (
        <div className="card stack">
          <h3>자동화 점검 기록</h3>
          <table className="simple">
            <thead><tr><th>날짜</th><th>평균</th><th>결과</th></tr></thead>
            <tbody>
              {data.srbai.filter(s => s.habitId === habit.id).map(s => (
                <tr key={s.id}><td>{formatKDate(s.date)}</td><td className="num">{s.mean.toFixed(1)}</td><td>{s.passed ? '정착' : '연장'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BossRow({ data, chapter }: { data: AppData; chapter: number }) {
  const ms = data.measurements.filter(m => m.habitId === data.habit!.id && m.chapter === chapter)
  const base = ms.find(m => m.kind === 'baseline')
  const boss = ms.find(m => m.kind === 'boss')
  if (!base && !boss) return null
  const diff = base && boss ? boss.value - base.value : null
  return (
    <p className="small">
      {(boss ?? base)!.label}: 첫날 <b>{base ? `${base.value}${base.unit}` : '—'}</b> → 보스 <b>{boss ? `${boss.value}${boss.unit}` : '—'}</b>
      {diff !== null && <span style={{ color: diff >= 0 ? 'var(--good)' : 'var(--bad)' }}> ({diff >= 0 ? '+' : ''}{diff})</span>}
    </p>
  )
}

function SettledList({ data }: { data: AppData }) {
  const settled = data.habits.filter(h => h.status === 'settled')
  return (
    <div className="card stack">
      <h2>진행 중인 여정이 없다</h2>
      {settled.length > 0
        ? <p className="muted">정착한 습관: {settled.map(h => h.title).join(', ')}</p>
        : <p className="muted">설정에서 습관을 만들면 66일 여정이 시작된다.</p>}
    </div>
  )
}
