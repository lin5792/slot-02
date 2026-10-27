import { useState } from 'react'
import type { AppData } from '../hooks'
import { checkAnchor, minLabel, planDay, type DayItem } from '../domain/layers'
import { addDays, formatDuration, formatKDate, nowMin, toMin } from '../domain/time'
import type { Block, CalendarEvent, Layer, Weekday } from '../domain/types'
import { deleteBlock, deleteEvent, saveBlock, saveEvent } from '../db/queries'
import { Sheet, WeekdayPicker, useToast } from '../ui/common'

const LAYER_NAME: Record<Layer, string> = { L0: '고정', L1: '필수', L2: '이벤트', L3: '희망' }
const PX = 0.9 // 1분당 px

type Editing = { kind: 'block'; block?: Block } | { kind: 'event'; event?: CalendarEvent } | null

export function DayLayers({ data }: { data: AppData }) {
  const [date, setDate] = useState(data.today)
  const [editing, setEditing] = useState<Editing>(null)
  const plan = planDay(data.blocks, data.events, date)
  const anchor = data.habit ? checkAnchor(data.habit, data.blocks, data.events, date) : null


  const used = 1440 - plan.free
  const warnings: string[] = []
  if (plan.sleepMin && plan.sleepMin < 420) warnings.push(`수면이 ${formatDuration(plan.sleepMin)}이다. 성인 권고는 7시간 이상.`)
  if (!plan.sleepMin) warnings.push('수면 블록이 없다. L1 필수에 수면(종류: 수면)을 넣자.')
  if (plan.bufferMin < 30) warnings.push(`L1 여유 시간이 ${plan.bufferMin}분이다. 일정은 늘 예상보다 길어지니 30~60분을 둔다.`)
  for (const o of plan.overlaps) {
    if (o.lower.habitId || o.upper.habitId || o.upper.kind === 'buffer') continue
    warnings.push(`${LAYER_NAME[o.lower.layer]} "${o.lower.title}"이(가) ${LAYER_NAME[o.upper.layer]} "${o.upper.title}"과 겹쳐 밀린다.`)
  }

  return (
    <div className="stack-lg">
      <div className="row between">
        <button className="btn sm" onClick={() => setDate(addDays(date, -1))} aria-label="전날">‹</button>
        <div style={{ textAlign: 'center' }}>
          <h2>{formatKDate(date)}</h2>
          {date !== data.today && <button className="btn ghost sm" onClick={() => setDate(data.today)}>오늘로</button>}
        </div>
        <button className="btn sm" onClick={() => setDate(addDays(date, 1))} aria-label="다음날">›</button>
      </div>

      <div className="card stack">
        <div className="row between small"><b>시간 예산</b><span className="muted">빈 시간 {formatDuration(plan.free)}</span></div>
        <div className="budget" aria-hidden>
          {(['L0', 'L1', 'L2', 'L3'] as Layer[]).map(l => (
            <i key={l} className={`lyr-${l}`} style={{ width: `${(plan.budget[l] / 1440) * 100}%`, background: 'var(--c)' }} />
          ))}
        </div>
        <div className="row wrap small" style={{ gap: 12 }}>
          {(['L0', 'L1', 'L2', 'L3'] as Layer[]).map(l => (
            <span key={l} className={`row lyr-${l}`} style={{ gap: 4 }}>
              <span className="swatch" />{l} {LAYER_NAME[l]} <b className="num">{formatDuration(plan.budget[l])}</b>
            </span>
          ))}
        </div>
        <p className="small muted">윗 계층부터 자리를 잡고, 아래 계층은 남은 빈칸에 들어간다. 사용 {formatDuration(used)}.</p>
      </div>

      {anchor?.conflict && (
        <div className="banner info">
          앵커가 <b>{anchor.conflict.title}</b>과 겹친다.
          {anchor.suggestion ? <> 대체 앵커 <b>{minLabel(anchor.suggestion.start)}</b>.</> : ' 빈칸이 없어 백스톱 때 최소 퀘스트로 지킨다.'}
        </div>
      )}
      {warnings.map((w, i) => <div key={i} className="banner warn">{w}</div>)}

      {plan.allDay.length > 0 && (
        <div className="row wrap">
          {plan.allDay.map(e => (
            <button key={e.id} className="chip lyr-L2" style={{ border: 0, cursor: 'pointer' }} onClick={() => setEditing({ kind: 'event', event: e })}>
              <span className="swatch" /> 종일 · {e.title}
            </button>
          ))}
        </div>
      )}

      <div className="row">
        <button className="btn grow" onClick={() => setEditing({ kind: 'block' })}>+ 반복 블록</button>
        <button className="btn grow" onClick={() => setEditing({ kind: 'event' })}>+ 이벤트</button>
      </div>

      <div className="card" style={{ paddingLeft: 8 }}>
        <Timeline items={plan.items} date={date} today={data.today} backstop={data.habit?.backstopTime}
          onPick={it => {
            if (it.source === 'event') setEditing({ kind: 'event', event: data.events.find(e => e.id === it.id) })
            else setEditing({ kind: 'block', block: data.blocks.find(b => b.id === it.id) })
          }} />
      </div>

      <Sheet open={editing?.kind === 'block'} onClose={() => setEditing(null)} title={editing?.kind === 'block' && editing.block ? '블록 수정' : '반복 블록 추가'}>
        {editing?.kind === 'block' && <BlockForm block={editing.block} habitId={data.habit?.id} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={editing?.kind === 'event'} onClose={() => setEditing(null)} title={editing?.kind === 'event' && editing.event ? '이벤트 수정' : '이벤트 추가'}>
        {editing?.kind === 'event' && <EventForm event={editing.event} date={date} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function Timeline({ items, date, today, backstop, onPick }: {
  items: DayItem[]; date: string; today: string; backstop?: string; onPick: (it: DayItem) => void
}) {
  // 겹치는 일정끼리 묶어 나란히 놓는다 (구간 그래프 색칠)
  const placed: { it: DayItem; lane: number; lanes: number }[] = []
  let cluster: typeof placed = []
  let clusterEnd = -1
  const laneEnds: number[] = []
  const flush = () => {
    const n = Math.max(1, ...cluster.map(c => c.lane + 1))
    cluster.forEach(c => (c.lanes = n))
    placed.push(...cluster)
    cluster = []
    laneEnds.length = 0
  }
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    if (it.start >= clusterEnd && cluster.length) flush()
    let lane = laneEnds.findIndex(e => e <= it.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = it.end
    cluster.push({ it, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  flush()

  return (
    <div className="timeline" style={{ height: 1440 * PX }}>
      {Array.from({ length: 25 }, (_, h) => (
        <div key={h}>
          <span className="hour" style={{ top: h * 60 * PX }}>{String(h).padStart(2, '0')}:00</span>
          <span className="hline" style={{ top: h * 60 * PX }} />
        </div>
      ))}
      {placed.map(({ it, lane, lanes }) => (
        <div key={`${it.id}-${it.start}`} className={`item lyr-${it.layer} ${it.habitId ? 'anchor' : ''}`}
          role="button" tabIndex={0} onClick={() => onPick(it)} onKeyDown={e => e.key === 'Enter' && onPick(it)}
          style={{
            top: it.start * PX, height: Math.max(18, (it.end - it.start) * PX - 2),
            left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)`,
          }}>
          {it.habitId && '🔥 '}{it.title}
          <div className="t">{it.layer} · {minLabel(it.start)}–{it.end === 1440 ? '24:00' : minLabel(it.end)}</div>
        </div>
      ))}
      {backstop && <div className="marker backstop" style={{ top: toMin(backstop) * PX }}>백스톱 {backstop}</div>}
      {date === today && <div className="marker now" style={{ top: nowMin() * PX }}>지금</div>}
    </div>
  )
}

function BlockForm({ block, habitId, onDone }: { block?: Block; habitId?: string; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<Omit<Block, 'id' | 'createdAt'>>(block ?? {
    layer: 'L0', title: '', start: '09:00', end: '18:00', weekdays: [1, 2, 3, 4, 5] as Weekday[],
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }))
  return (
    <form className="stack" onSubmit={async e => {
      e.preventDefault()
      await saveBlock({ ...f, id: block?.id })
      toast('저장했다')
      onDone()
    }}>
      <div className="seg" role="radiogroup" aria-label="계층">
        {(['L0', 'L1', 'L3'] as const).map(l => (
          <button type="button" key={l} className={f.layer === l ? 'on' : ''} onClick={() => set('layer', l)}>{l} {LAYER_NAME[l]}</button>
        ))}
      </div>
      <label className="field">이름<input className="input" required value={f.title} onChange={e => set('title', e.target.value)} placeholder="근무, 수면, 식사…" /></label>
      <div className="row">
        <label className="field grow">시작<input className="input" type="time" required value={f.start} onChange={e => set('start', e.target.value)} /></label>
        <label className="field grow">끝<input className="input" type="time" required value={f.end} onChange={e => set('end', e.target.value)} /></label>
      </div>
      <p className="small muted">끝이 시작보다 이르면 자정을 넘는 블록이다 (예: 수면 23:30–06:30).</p>
      <WeekdayPicker value={f.weekdays} onChange={v => set('weekdays', v)} />
      {f.layer === 'L1' && (
        <label className="field">종류
          <select className="input" value={f.habitId ? 'anchor' : f.kind ?? ''} onChange={e => {
            const v = e.target.value
            setF(x => ({ ...x, kind: v === 'sleep' || v === 'buffer' ? v : undefined, habitId: v === 'anchor' ? habitId : undefined }))
          }}>
            <option value="">일반</option>
            <option value="sleep">수면 (7시간 점검)</option>
            <option value="buffer">여유 시간</option>
            {habitId && <option value="anchor">습관 앵커 (승격된 습관 자리)</option>}
          </select>
        </label>
      )}
      <div className="row">
        {block && <button type="button" className="btn danger" onClick={async () => { await deleteBlock(block.id); toast('삭제했다'); onDone() }}>삭제</button>}
        <button className="btn primary grow" disabled={!f.weekdays.length}>저장</button>
      </div>
    </form>
  )
}

function EventForm({ event, date, onDone }: { event?: CalendarEvent; date: string; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<Omit<CalendarEvent, 'id' | 'createdAt'>>(event ?? {
    title: '', date, start: '19:00', end: '21:00', status: 'planned', source: 'manual',
  })
  const allDay = !f.start
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }))
  return (
    <form className="stack" onSubmit={async e => {
      e.preventDefault()
      await saveEvent({ ...f, id: event?.id })
      toast('저장했다. 앵커와 겹치면 오늘 화면에 대체 앵커가 뜬다')
      onDone()
    }}>
      <label className="field">이름<input className="input" required value={f.title} onChange={e => set('title', e.target.value)} placeholder="약속, 병원, 마감…" /></label>
      <label className="field">날짜<input className="input" type="date" required value={f.date} onChange={e => set('date', e.target.value)} /></label>
      <label className="row small"><input type="checkbox" checked={allDay} onChange={e => setF(x => ({ ...x, start: e.target.checked ? undefined : '19:00', end: e.target.checked ? undefined : '21:00' }))} /> 종일</label>
      {!allDay && (
        <div className="row">
          <label className="field grow">시작<input className="input" type="time" value={f.start} onChange={e => set('start', e.target.value)} /></label>
          <label className="field grow">끝<input className="input" type="time" value={f.end ?? ''} onChange={e => set('end', e.target.value)} /></label>
        </div>
      )}
      <label className="field">장소<input className="input" value={f.place ?? ''} onChange={e => set('place', e.target.value)} /></label>
      <label className="field">준비물<input className="input" value={f.prep ?? ''} onChange={e => set('prep', e.target.value)} /></label>
      {event && (
        <div className="seg">
          {(['planned', 'done', 'cancelled'] as const).map(s => (
            <button type="button" key={s} className={f.status === s ? 'on' : ''} onClick={() => set('status', s)}>
              {{ planned: '예정', done: '완료', cancelled: '취소' }[s]}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        {event && <button type="button" className="btn danger" onClick={async () => { await deleteEvent(event.id); toast('삭제했다'); onDone() }}>삭제</button>}
        <button className="btn primary grow">저장</button>
      </div>
    </form>
  )
}
