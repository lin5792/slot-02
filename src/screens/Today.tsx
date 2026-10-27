import { useCallback, useEffect, useState } from 'react'
import type { AppData } from '../hooks'
import { cardById, drawCard, nextUnlocks, REDRAWS_PER_DAY } from '../domain/deck'
import { checkAnchor, minLabel } from '../domain/layers'
import { xpIfLogged } from '../domain/progress'
import { SRBAI_ITEMS, SRBAI_PASS_MEAN, TIER_LABEL, TIER_ORDER, chapterRule, levelForXp, tierAtLeast } from '../domain/rules'
import { addDays, diffDays, formatKDate } from '../domain/time'
import type { Habit, SrbaiCheck, Tier } from '../domain/types'
import { clearLog, logTier, redrawCard, saveMeasurement, submitSrbai, todayCardId } from '../db/queries'
import { Hud, useToast } from '../ui/common'
import { QuestTimer } from '../ui/QuestTimer'

export function Today({ data, goTo }: { data: AppData; goTo: (tab: string) => void }) {
  const { habit, progress: p, today, totalXp } = data
  const toast = useToast()
  const level = levelForXp(totalXp)
  const [cardId, setCardId] = useState<string>()
  const [timerMin, setTimerMin] = useState<number>()
  const redrawsUsed = data.settings.redraws[today] ?? 0

  useEffect(() => {
    if (!habit?.startDate || habit.startDate > today) return
    todayCardId(habit.id, level, today).then(setCardId)
  }, [habit?.id, habit?.startDate, today, level, data.settings.drawn])

  const onCap = useCallback((m: number) => setTimerMin(m), [])

  if (!habit || !p) {
    return (
      <div className="card stack">
        <h2>승격 중인 습관이 없다</h2>
        <p className="muted">정착된 습관 다음으로 승격할 행위를 설정에서 고른다.</p>
        <button className="btn primary" onClick={() => goTo('setup')}>설정으로</button>
      </div>
    )
  }

  if (!p.started) {
    const until = habit.startDate ? diffDays(today, habit.startDate) : 0
    return (
      <div className="stack">
        <Intention habit={habit} />
        <div className="card stack">
          <h2>{until}일 뒤 1일차가 시작된다</h2>
          <p className="muted small">{habit.startDate && formatKDate(habit.startDate)}. 오늘은 운동복과 매트를 꺼내두는 것까지만.</p>
        </div>
      </div>
    )
  }

  const card = cardById(cardId)
  const capMin = Math.min(card?.minutes ?? 20, p.chapter.capMin ?? Infinity)
  const todayCell = p.cells.find(c => c.date === today)
  const yesterday = p.cells.find(c => c.date === addDays(today, -1))
  const anchor = checkAnchor(habit, data.blocks, data.events, today)
  const tomorrowCard = drawCard(level, habit.id, addDays(today, 1))
  const unlocks = nextUnlocks(level)

  async function log(tier: Tier) {
    const before = p!.todayTier
    if (before === tier) {
      await clearLog(habit!.id, today)
      toast('오늘 기록을 지웠다')
      return
    }
    await logTier(habit!.id, today, tier, { cardId, minutes: timerMin })
    if (!before) toast(`${TIER_LABEL[tier]} 퀘스트 완료 +${xpIfLogged(p!, tier)} XP`)
    else toast(`${TIER_LABEL[tier]} 단계로 기록을 바꿨다`)
  }

  return (
    <div className="stack">
      <Hud progress={p} totalXp={totalXp} />

      {p.checkDue && <SrbaiCard habit={habit} today={today} />}

      {p.comebackDay && !tierAtLeast(p.todayTier, 'basic') && (
        <div className="banner warn">
          <b>이틀 연속은 없다.</b> 어제 기본을 놓쳤으니 오늘은 기본 퀘스트가 필수다. 해내면 복귀 보너스 +20 XP.
        </div>
      )}

      {anchor.conflict && (
        <div className="banner info">
          오늘 앵커 시간({minLabel(anchor.anchor!.start)})이 <b>{anchor.conflict.title}</b>과 겹친다.
          {anchor.suggestion
            ? <> 대체 앵커: <b>{minLabel(anchor.suggestion.start)}</b>{anchor.suggestion.after && ` (${anchor.suggestion.after} 끝난 뒤)`}.</>
            : ' 오늘은 백스톱 알람 때 최소 퀘스트로 지킨다.'}
        </div>
      )}

      <Intention habit={habit} />

      <div className="row between">
        <h2>{p.chapter.name}</h2>
        <span className="chip">{p.isBossDay ? '👑 보스의 날' : `보스까지 ${p.daysToBoss}일`}</span>
      </div>

      {card && (
        <div className="quest-card stack">
          <div className="row between">
            <div>
              <span className="chip">오늘의 카드 · {card.tag}</span>
              <h2 style={{ marginTop: 6 }}>{card.title}</h2>
            </div>
            <button className="btn sm" disabled={redrawsUsed >= REDRAWS_PER_DAY || !!p.todayTier}
              onClick={async () => { if (await redrawCard(habit.id, level, today)) toast('카드를 다시 뽑았다') }}>
              다시 뽑기 {REDRAWS_PER_DAY - redrawsUsed}
            </button>
          </div>
          <ol>{card.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}

      <div className="ladder">
        {TIER_ORDER.map(t => (
          <button key={t} className={`tier ${t} ${p.todayTier === t ? 'done' : ''}`} onClick={() => log(t)}
            aria-pressed={p.todayTier === t}>
            <span className="dot" />
            <span>
              <span className="label">{TIER_LABEL[t]} 퀘스트 {p.todayTier === t && '✓'}</span>
              <span className="desc" style={{ display: 'block' }}>
                {t === 'basic' && card ? `${habit.tiers.basic} · ${card.title}` : habit.tiers[t]}
              </span>
            </span>
            <span className="xp">+{xpIfLogged(p, t)}</span>
          </button>
        ))}
        <p className="small muted">최소만 해도 오늘은 성공이다. 누른 단계를 다시 누르면 기록이 지워진다.</p>
      </div>

      {!p.todayTier && <QuestTimer key={cardId} capMin={capMin} onCapReached={onCap} />}
      {timerMin && !p.todayTier && (
        <div className="banner good">{timerMin}분 했다. 위에서 해낸 단계를 눌러 기록하자.</div>
      )}

      {p.todayTier && todayCell && (
        <div className="card finish stack pop">
          <div className="big">+{todayCell.xp} XP</div>
          <p>
            {TIER_LABEL[p.todayTier]} 퀘스트 완료. 🔥 {p.combo}일 콤보
            {todayCell.comeback && ' · 복귀 보너스 포함'}
          </p>
          <div className="banner info" style={{ textAlign: 'left' }}>
            <b>내일의 카드: {tomorrowCard.title}</b>
            <div className="small muted">
              {p.isBossDay ? '오늘 보스를 잡았다면 다음 챕터가 열린다.' : `${p.chapter.name} 보스까지 ${p.daysToBoss}일.`}
              {unlocks.length > 0 && ` 레벨 ${unlocks[0].unlockLevel}에서 '${unlocks.map(u => u.title).join("', '")}' 해금.`}
            </div>
          </div>
          <p className="small muted">자기 전 운동복을 꺼내두면 내일이 쉬워진다.</p>
        </div>
      )}

      {p.dayInChapter === 1 && !p.checkDue && <MeasureCard data={data} kind="baseline" />}
      {p.isBossDay && <MeasureCard data={data} kind="boss" />}

      {yesterday && !yesterday.tier && (
        <div className="card stack">
          <h3>어제({formatKDate(yesterday.date)}) 기록이 없다</h3>
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

      {habit.ifThen.some(x => x.if) && (
        <details className="card">
          <summary>만약 ~하면 ~한다</summary>
          <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {habit.ifThen.filter(x => x.if).map((x, i) => <li key={i}>만약 {x.if} → {x.then}</li>)}
          </ul>
        </details>
      )}
    </div>
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

