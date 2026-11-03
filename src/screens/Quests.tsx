import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../hooks'
import { cardById, drawCard, REDRAWS_PER_DAY } from '../domain/deck'
import { dayTypeOf, mainGoldIf, questsFor, surpriseOn, type GoldKind } from '../domain/economy'
import { checkAnchor, minLabel } from '../domain/layers'
import { xpIfLogged } from '../domain/progress'
import {
  ENCORE_GOLD, ENCORE_MIN, ENCORE_MOVES, REST_BONUS_RATE, SRBAI_ITEMS, SRBAI_PASS_MEAN, SURPRISE_GOLD, TIER_GOLD,
  TIER_LABEL, TIER_ORDER, chapterRule, levelForXp, tierAtLeast, xpForLevel,
} from '../domain/rules'
import { effectsOn } from '../domain/skills'
import { addDays, diffDays, formatKDate } from '../domain/time'
import type { DayType, Habit, SideQuest, SrbaiCheck, Tier } from '../domain/types'
import {
  archiveQuest, clearLog, logTier, redrawCard, saveMeasurement, saveQuest, setAfterglow, setDayOverride, submitSrbai,
  todayCardId, toggleQuestDone,
} from '../db/queries'
import { Sheet, useToast } from '../ui/common'
import { DayRing } from '../ui/DayRing'
import { QuestTimer } from '../ui/QuestTimer'

const DAY_LABEL: Record<DayType, string> = { work: '평일', off: '휴일' }
const fmt = (n: number) => n.toLocaleString('ko-KR')

export function Quests({ data, goTo }: { data: AppData; goTo: (tab: string) => void }) {
  const { habit, progress: p, today, totalXp, economy: eco, settings } = data
  const toast = useToast()
  const level = levelForXp(totalXp)
  const [cardId, setCardId] = useState<string>()
  const [timerMin, setTimerMin] = useState<number>()
  const [editing, setEditing] = useState<SideQuest | 'new' | null>(null)
  const redrawsUsed = settings.redraws[today] ?? 0
  const started = !!habit && !!p?.started

  useEffect(() => {
    if (!habit?.startDate || habit.startDate > today) return
    todayCardId(habit.id, level, today).then(setCardId)
  }, [habit?.id, habit?.startDate, today, level, settings.drawn])

  const onCap = useCallback((m: number) => setTimerMin(m), [])

  const side = questsFor(data.quests, data.dayType)
  const sideDone = new Set(data.logs.filter(l => l.date === today).map(l => l.habitId))
  const mainDone = !!p?.todayTier
  const questCount = side.length + (started ? 1 : 0)
  const doneCount = side.filter(q => sideDone.has(q.id)).length + (mainDone ? 1 : 0)
  const dots = [
    ...(habit?.anchorTime && started ? [{ time: habit.anchorTime, done: mainDone }] : []),
    ...side.filter(q => q.time).map(q => ({ time: q.time!, done: sideDone.has(q.id) })),
  ]

  async function log(tier: Tier) {
    const before = p!.todayTier
    if (before === tier) {
      await clearLog(habit!.id, today)
      toast('오늘 기록을 지웠다')
      return
    }
    const gold = mainGoldIf(tier, p!, data.skills, settings, today)
    await logTier(habit!.id, today, tier, { cardId, minutes: timerMin })
    if (!before) toast(`클리어 +${gold} G · +${xpIfLogged(p!, tier)} XP`)
    else toast(`${TIER_LABEL[tier]} 단계로 바꿨다`)
  }

  async function toggleSide(q: SideQuest) {
    const was = sideDone.has(q.id)
    await toggleQuestDone(q.id, today)
    if (was) return
    const gold = Math.round(q.gold * (1 + effectsOn(data.skills, today).goldPct / 100))
    toast(surpriseOn(q.id, today) ? `깜짝 상자! +${gold + SURPRISE_GOLD} G` : `+${gold} G`)
  }

  const weekdayType = dayTypeOf(today, { ...settings, dayOverride: {} })
  const card = cardById(cardId)
  const capMin = Math.min(card?.minutes ?? 20, p?.chapter.capMin ?? Infinity)
  const yesterday = p?.cells.find(c => c.date === addDays(today, -1))
  const anchor = habit && started ? checkAnchor(habit, data.blocks, data.events, today) : null

  return (
    <div className="stack">
      <header className="topbar">
        <div className="lv">
          <span className="level sm"><small>LV</small>{level}</span>
          <span className="xpbar"><i style={{ width: `${Math.min(100, ((totalXp - xpForLevel(level)) / (xpForLevel(level + 1) - xpForLevel(level))) * 100)}%` }} /></span>
        </div>
        <button className="gold-pill" onClick={() => goTo('shop')} aria-label={`골드 ${eco.balance}, 상점으로`}>
          <Coin /> {fmt(eco.balance)} G
        </button>
      </header>

      <section className="card day">
        <DayRing blocks={data.blocks} events={data.events} date={today} dots={dots} isToday />
        <div className="stack" style={{ gap: 8 }}>
          <b className="small">{formatKDate(today)}</b>
          <div className="seg" role="radiogroup" aria-label="오늘은">
            {(['work', 'off'] as DayType[]).map(t => (
              <button key={t} role="radio" aria-checked={data.dayType === t} className={data.dayType === t ? 'on' : ''}
                onClick={() => setDayOverride(today, t === weekdayType ? null : t)}>{DAY_LABEL[t]}</button>
            ))}
          </div>
          <div className="legend">
            <span><i className="swatch lyr-L0" /> 고정</span>
            <span><i className="swatch lyr-L1" /> 필수</span>
            <span><i className="swatch lyr-L2" /> 일정</span>
          </div>
        </div>
      </section>

      {started && !mainDone && (eco.restWaiting || eco.sealedPending) && (
        <div className="perks">
          {eco.restWaiting && <div className="perk blue"><b>×1.5</b><span>휴식 보너스 대기</span></div>}
          {eco.sealedPending && <div className="perk"><Chest sealed /><span>봉인 상자 · 깨면 열린다</span></div>}
        </div>
      )}

      {p?.checkDue && habit && <SrbaiCard habit={habit} today={today} />}

      {p?.comebackDay && !tierAtLeast(p.todayTier, 'basic') && (
        <div className="banner warn"><b>이틀 연속은 없다.</b> 오늘 기본 이상이면 복귀 보너스 +20 G.</div>
      )}

      {anchor?.conflict && (
        <div className="banner info small">
          {minLabel(anchor.anchor!.start)} 자리에 <b>{anchor.conflict.title}</b>.
          {anchor.suggestion ? <> 대신 <b>{minLabel(anchor.suggestion.start)}</b>.</> : ' 백스톱 때 최소 퀘스트로.'}
        </div>
      )}

      {!habit && (
        <div className="card stack">
          <h2>메인 퀘스트가 없다</h2>
          <button className="btn primary" onClick={() => goTo('more')}>습관 고르기</button>
        </div>
      )}

      {habit && p && !p.started && (
        <div className="stack">
          <Intention habit={habit} />
          <div className="card stack">
            <h2>{habit.startDate ? diffDays(today, habit.startDate) : 0}일 뒤 1일차</h2>
            <p className="muted small">오늘은 운동복과 매트를 꺼내두는 것까지만.</p>
          </div>
        </div>
      )}

      {started && habit && p && (
        <section className="quest-card stack">
          <div className="row between">
            <span className="chip">메인 · {p.chapter.name.split(' · ')[1] ?? p.chapter.name} · {Math.min(p.day, p.totalDays)}일째</span>
            <button className="btn sm" disabled={redrawsUsed >= REDRAWS_PER_DAY || mainDone}
              onClick={async () => { if (await redrawCard(habit.id, level, today)) toast('카드를 다시 뽑았다') }}>
              다시 뽑기 {REDRAWS_PER_DAY - redrawsUsed}
            </button>
          </div>
          {card && <h2>{card.title}</h2>}
          <p className="small muted">{habit.intention.anchorEvent} → {habit.intention.action}</p>
          {card && (
            <details>
              <summary className="small">순서</summary>
              <ol>{card.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </details>
          )}
          <div className="ladder">
            {TIER_ORDER.map(t => (
              <button key={t} className={`tier ${t} ${p.todayTier === t ? 'done' : ''}`} onClick={() => log(t)} aria-pressed={p.todayTier === t}>
                <span className="dot" />
                <span>
                  <span className="label">{TIER_LABEL[t]} {p.todayTier === t && '✓'}</span>
                  <span className="desc" style={{ display: 'block' }}>{habit.tiers[t]}</span>
                </span>
                <span className="reward">
                  <b>+{mainGoldIf(t, p, data.skills, settings, today)} G</b>
                  <small>+{xpIfLogged(p, t)} XP</small>
                </span>
              </button>
            ))}
          </div>
          {p.isBossDay && <span className="chip">👑 보스의 날</span>}
        </section>
      )}

      {started && !mainDone && (
        <>
          {settings.bundle && <div className="banner info small">🎧 <b>{settings.bundle}</b>은 지금만</div>}
          <QuestTimer key={cardId} capMin={capMin} onCapReached={onCap} />
          {timerMin && <div className="banner good">{timerMin}분 했다. 해낸 단계를 누르자.</div>}
        </>
      )}

      {started && mainDone && <ClearPanel data={data} />}

      <section className="card stack">
        <div className="row between">
          <h3>오늘 퀘스트</h3>
          <span className="chip num">{doneCount} / {questCount}</span>
        </div>
        {side.length === 0 && <p className="small muted">물 한 잔, 스트레칭 5분처럼 작은 것도 퀘스트가 된다.</p>}
        {side.map(q => {
          const done = sideDone.has(q.id)
          return (
            <div key={q.id} className={`qrow ${done ? 'done' : ''}`}>
              <button className="check" aria-pressed={done} aria-label={`${q.title} ${done ? '완료 취소' : '완료'}`} onClick={() => toggleSide(q)}>
                {done && '✓'}
              </button>
              <button className="qbody" onClick={() => setEditing(q)}>
                <b>{q.title}</b>
                <small>{q.minutes}분{q.time && ` · ${q.time}`}</small>
              </button>
              <span className="qgold">+{q.gold} G</span>
            </div>
          )
        })}
        <button className="btn sm" onClick={() => setEditing('new')}>+ 퀘스트 추가</button>
      </section>

      <WeeklyChest data={data} />

      {started && p && p.dayInChapter === 1 && !p.checkDue && <MeasureCard data={data} kind="baseline" />}
      {started && p?.isBossDay && <MeasureCard data={data} kind="boss" />}

      {habit && yesterday && !yesterday.tier && (
        <div className="card stack">
          <h3>어제 기록이 없다</h3>
          <p className="small muted">했는데 기록만 빠졌다면 남긴다.</p>
          <div className="row">
            {TIER_ORDER.map(t => (
              <button key={t} className="btn sm grow" onClick={async () => { await logTier(habit.id, yesterday.date, t); toast('어제 기록을 남겼다') }}>
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      {habit && habit.ifThen.some(x => x.if) && (
        <details className="card">
          <summary>만약 ~하면 ~한다</summary>
          <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {habit.ifThen.filter(x => x.if).map((x, i) => <li key={i}>만약 {x.if} → {x.then}</li>)}
          </ul>
        </details>
      )}

      <QuestSheet quest={editing} dayType={data.dayType} onClose={() => setEditing(null)} />
    </div>
  )
}

const GOLD_LABEL: Partial<Record<GoldKind, string>> = {
  chest: '봉인 상자 열림', surprise: '깜짝 상자', weekly: '주간 상자', rest: '휴식 보너스', comeback: '복귀 보너스', encore: '앵콜',
}

function ClearPanel({ data }: { data: AppData }) {
  const { progress: p, today, totalXp, economy: eco, settings, habit } = data
  const toast = useToast()
  const [encoreOn, setEncoreOn] = useState(false)
  const e = effectsOn(data.skills, today)
  const todayMain = eco.lines.filter(l => l.date === today && l.source === 'main')
  const gold = todayMain.reduce((s, l) => s + l.gold, 0)
  const extras = todayMain.filter(l => GOLD_LABEL[l.kind])
  const choice = settings.afterglow?.[today]
  const level = levelForXp(totalXp)
  const encoreGold = ENCORE_GOLD * (e.encoreX2 ? 2 : 1)
  const restGold = Math.round(TIER_GOLD.basic * REST_BONUS_RATE * (e.restX2 ? 2 : 1))
  const move = ENCORE_MOVES[parseInt(today.replaceAll('-', ''), 10) % ENCORE_MOVES.length]

  const near: { title: string; left: string; pct: number }[] = []
  const floor = xpForLevel(level), next = xpForLevel(level + 1)
  near.push({ title: `레벨 ${level + 1}`, left: `${next - totalXp} XP`, pct: (totalXp - floor) / (next - floor) })
  if (!eco.week.opened) {
    near.push({ title: '주간 상자', left: `${eco.week.goal - eco.week.count}번`, pct: (eco.week.gift + eco.week.count) / (eco.week.gift + eco.week.goal) })
  }
  const ready = data.skills.find(s => s.status === 'ready')
  const soon = data.skills
    .filter(s => s.status === 'locked' && s.need?.clears && !s.need.prev && !s.need.day)
    .sort((a, b) => (a.need!.clears!.need - a.need!.clears!.have) - (b.need!.clears!.need - b.need!.clears!.have))[0]
  if (ready) near.push({ title: `${ready.def.title} 시험`, left: '지금 가능', pct: 1 })
  else if (soon) {
    const c = soon.need!.clears!
    near.push({ title: `${soon.def.title} 시험`, left: `${c.need - c.have}번`, pct: c.have / c.need })
  }

  const tomorrow = addDays(today, 1)
  const tCard = habit ? drawCard(level, habit.id, tomorrow) : null
  const masked = tCard ? tCard.title.slice(0, Math.ceil(tCard.title.length / 2)) + '?'.repeat(Math.max(2, Math.floor(tCard.title.length / 2))) : ''

  return (
    <section className="card clear stack pop">
      <div className="clear-head">
        <span className="chip">클리어</span>
        <div className="big">+{gold} G</div>
        <p className="small muted">{TIER_LABEL[p!.todayTier!]} · 🔥 콤보 {p!.combo}</p>
        {extras.length > 0 && (
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            {extras.map((l, i) => <span key={i} className="chip gold">{GOLD_LABEL[l.kind]} +{l.gold}</span>)}
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <h3>거의 다 왔다</h3>
        {near.map(n => (
          <div key={n.title} className="near">
            <div className="row between small"><b>{n.title}</b><span className="muted">{n.left}</span></div>
            <span className="bar"><i style={{ width: `${Math.round(Math.min(1, n.pct) * 100)}%` }} /></span>
          </div>
        ))}
      </div>

      {!choice && !encoreOn && (
        <div className="stack" style={{ gap: 8 }}>
          <h3>한 판 더? 아니면 내일로?</h3>
          <div className="choice">
            <button className="pick" onClick={() => setEncoreOn(true)}>
              <b>앵콜</b><span>{ENCORE_MIN}분 · +{encoreGold} G</span><small>하루 1번</small>
            </button>
            <button className="pick blue" onClick={async () => { await setAfterglow(today, 'rest'); toast(`내일 첫 퀘스트 +${restGold} G 예약`) }}>
              <b>참고 저장</b><span>내일 ×1.5</span><small>+{restGold} G 예약</small>
            </button>
          </div>
        </div>
      )}
      {!choice && encoreOn && (
        <Encore move={move} onDone={async () => { await setAfterglow(today, 'encore'); toast(`앵콜 +${encoreGold} G`) }} onCancel={() => setEncoreOn(false)} />
      )}
      {choice === 'encore' && <div className="banner good small">오늘 앵콜은 이걸로 끝. +{encoreGold} G</div>}
      {choice === 'rest' && <div className="banner info small"><b>휴식 보너스 저장됨.</b> 아쉬운 만큼 내일 더 받는다.</div>}

      <div className="perks">
        <div className="perk"><Chest sealed /><span>봉인 상자 · 내일 깨면 열린다</span></div>
        {tCard && <div className="perk col"><span className="small muted">내일 카드 · {DAY_LABEL[dayTypeOf(tomorrow, settings)]}</span><b className="mask">{masked}</b></div>}
      </div>
    </section>
  )
}

function Encore({ move, onDone, onCancel }: { move: string; onDone: () => void; onCancel: () => void }) {
  const total = ENCORE_MIN * 60
  const [startedAt] = useState(() => Date.now())
  const [left, setLeft] = useState(total)
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000))), 250)
    return () => clearInterval(t)
  }, [startedAt, total])
  useEffect(() => { if (left === 0) navigator.vibrate?.([200, 100, 200]) }, [left])
  return (
    <div className="encore stack">
      <div className="clock num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
      <b>앵콜: {move}</b>
      <div className="row">
        <button className="btn sm grow" onClick={onCancel}>그만</button>
        <button className="btn sm primary grow" disabled={left > 0} onClick={onDone}>{left > 0 ? '하는 중' : '받기'}</button>
      </div>
    </div>
  )
}

function WeeklyChest({ data }: { data: AppData }) {
  const { count, goal, gift, opened } = data.economy.week
  const slots = gift + goal
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <div className="row between">
        <h3>주간 상자</h3>
        <span className="num gold-text">{opened ? '열림' : `${count} / ${goal}`}</span>
      </div>
      <div className="slots" style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={i < gift ? 'gift' : i < gift + count ? 'on' : i === gift + count && !opened ? 'next' : ''} />
        ))}
      </div>
      <p className="small muted">{opened ? '이번 주 +100 G 받았다' : `메인 퀘스트 ${goal - count}번 더 깨면 +100 G`}</p>
    </section>
  )
}

function QuestSheet({ quest, dayType, onClose }: { quest: SideQuest | 'new' | null; dayType: DayType; onClose: () => void }) {
  const toast = useToast()
  const init = quest && quest !== 'new' ? quest : null
  const [f, setF] = useState({ title: '', minutes: 5, gold: 20, on: dayType as SideQuest['on'], time: '' })
  useEffect(() => {
    if (!quest) return
    setF(init ? { title: init.title, minutes: init.minutes, gold: init.gold, on: init.on, time: init.time ?? '' }
      : { title: '', minutes: 5, gold: 20, on: dayType, time: '' })
  }, [quest]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={!!quest} onClose={onClose} title={init ? '퀘스트 고치기' : '새 퀘스트'}>
      <form className="stack" onSubmit={async e => {
        e.preventDefault()
        await saveQuest({ ...(init ?? {}), title: f.title.trim(), minutes: f.minutes, gold: f.gold, on: f.on, time: f.time || undefined })
        toast(init ? '고쳤다' : '퀘스트 추가')
        onClose()
      }}>
        <label className="field">할 일<input className="input" required value={f.title} placeholder="스트레칭" onChange={e => setF({ ...f, title: e.target.value })} /></label>
        <div className="row">
          <label className="field grow">분<input className="input" type="number" min={1} value={f.minutes} onChange={e => setF({ ...f, minutes: Number(e.target.value) || 1 })} /></label>
          <label className="field grow">골드<input className="input" type="number" min={1} max={100} value={f.gold} onChange={e => setF({ ...f, gold: Number(e.target.value) || 1 })} /></label>
          <label className="field grow">시각<input className="input" type="time" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></label>
        </div>
        <div className="seg" role="radiogroup" aria-label="나오는 날">
          {([['work', '평일'], ['off', '휴일'], ['both', '매일']] as const).map(([v, l]) => (
            <button type="button" key={v} role="radio" aria-checked={f.on === v} className={f.on === v ? 'on' : ''} onClick={() => setF({ ...f, on: v })}>{l}</button>
          ))}
        </div>
        <button className="btn primary" type="submit">저장</button>
        {init && (
          <button type="button" className="btn ghost danger" onClick={async () => { await archiveQuest(init.id); toast('지웠다. 받은 골드는 남는다'); onClose() }}>지우기</button>
        )}
      </form>
    </Sheet>
  )
}

export function Coin() {
  return (
    <svg className="coin" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="var(--gold)" />
      <circle cx="10" cy="10" r="5.5" fill="none" stroke="var(--gold-ink)" strokeWidth="1.6" opacity=".55" />
    </svg>
  )
}

export function Chest({ sealed = false }: { sealed?: boolean }) {
  return (
    <svg className="chest" viewBox="-30 -26 60 52" aria-hidden="true">
      <rect x="-26" y="-4" width="52" height="28" rx="5" fill="#8A5A2B" />
      <path d="M-26 -4 C-26 -22 26 -22 26 -4 Z" fill="#A86E35" />
      <rect x="-26" y="-7" width="52" height="5" fill="var(--gold)" />
      {sealed
        ? <><path d="M-30 6 H30 M0 -20 V24" stroke="var(--l3)" strokeWidth="3" /><circle cx="0" cy="6" r="5" fill="var(--surface)" stroke="var(--l3)" strokeWidth="2.5" /></>
        : <circle cx="0" cy="6" r="4" fill="var(--gold)" />}
    </svg>
  )
}

function Intention({ habit }: { habit: Habit }) {
  const { anchorEvent, place, action } = habit.intention
  return (
    <div className="card tight">
      <p className="small muted">실행의도</p>
      <p><b>{anchorEvent}</b> 직후에 <b>{place}</b>에서 <b>{action}</b>.</p>
      <p className="small muted">백스톱 {habit.backstopTime} · 그때까지 안 했으면 그 자리에서 최소 퀘스트</p>
    </div>
  )
}

function MeasureCard({ data, kind }: { data: AppData; kind: 'baseline' | 'boss' }) {
  const { habit, progress: p, today } = data
  const toast = useToast()
  const chapter = p!.chapter.n
  const rule = chapterRule(chapter)
  const existing = data.measurements.find(m => m.habitId === habit!.id && m.chapter === chapter && m.kind === kind)
  const baseline = data.measurements.find(m => m.habitId === habit!.id && m.chapter === chapter && m.kind === 'baseline')
  const [value, setValue] = useState(existing ? String(existing.value) : '')
  const unit = rule.bossLabel.includes('초') ? '초' : '개'

  return (
    <div className="card stack">
      <h3>{kind === 'boss' ? `👑 챕터 ${chapter} 보스: ${rule.bossLabel}` : `챕터 ${chapter} 첫날 기록: ${rule.bossLabel}`}</h3>
      <p className="small muted">
        {kind === 'boss'
          ? baseline ? `챕터 첫날 ${baseline.value}${unit}. 얼마나 자랐는지 재 본다.` : '오늘 기록이 다음 챕터의 비교 기준이 된다.'
          : '챕터 마지막 날 같은 측정을 다시 해서 성장을 눈으로 본다. (선택)'}
      </p>
      <div className="row">
        <input className="input grow" inputMode="numeric" value={value} placeholder={unit}
          onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))} aria-label={rule.bossLabel} />
        <button className="btn primary" disabled={!value} onClick={async () => {
          await saveMeasurement({ habitId: habit!.id, chapter, kind, label: rule.bossLabel, value: Number(value), unit, date: today })
          const diff = baseline && kind === 'boss' ? Number(value) - baseline.value : null
          toast(diff !== null ? `기록 저장. 첫날보다 ${diff >= 0 ? '+' : ''}${diff}${unit}` : '기록 저장')
        }}>{existing ? '수정' : '저장'}</button>
      </div>
    </div>
  )
}

function SrbaiCard({ habit, today }: { habit: Habit; today: string }) {
  const toast = useToast()
  const [answers, setAnswers] = useState<number[]>([0, 0, 0, 0])
  const [result, setResult] = useState<SrbaiCheck>()
  const complete = answers.every(a => a > 0)

  if (result) {
    return (
      <div className={`banner ${result.passed ? 'good' : 'info'}`}>
        <b>평균 {result.mean.toFixed(1)}점. </b>
        {result.passed
          ? '정착했다. 이제 이 행위는 시스템 없이도 돈다. 설정에서 다음 습관을 승격하자.'
          : '아직 자동화 전이다. 22일 연장 챕터가 붙었다. 사람마다 18~254일 걸린다(Lally 외 2010).'}
      </div>
    )
  }
  return (
    <div className="card stack">
      <h2>{habit.extensions ? `${66 + habit.extensions * 22}일 점검` : '66일 점검'}</h2>
      <p className="small muted">"{habit.title}"을(를) 할 때 나는… 1 = 전혀 아니다, 7 = 매우 그렇다</p>
      {SRBAI_ITEMS.map((q, i) => (
        <div key={q} className="stack" style={{ gap: 6 }}>
          <p className="small"><b>{i + 1}.</b> {q}</p>
          <div className="likert" role="radiogroup" aria-label={q}>
            {[1, 2, 3, 4, 5, 6, 7].map(v => (
              <button key={v} role="radio" aria-checked={answers[i] === v} className={answers[i] === v ? 'on' : ''}
                onClick={() => setAnswers(a => a.map((x, j) => (j === i ? v : x)))}>{v}</button>
            ))}
          </div>
        </div>
      ))}
      <p className="small muted">평균 {SRBAI_PASS_MEAN}점 이상이면 정착, 아니면 연장 챕터.</p>
      <button className="btn primary" disabled={!complete} onClick={async () => {
        const r = await submitSrbai(habit, today, answers as SrbaiCheck['answers'])
        setResult(r)
        toast(r.passed ? '정착 완료' : '연장 챕터 시작')
      }}>점검 제출</button>
    </div>
  )
}

