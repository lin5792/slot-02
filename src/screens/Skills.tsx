import { useEffect, useRef, useState } from 'react'
import type { AppData } from '../hooks'
import { RECORD_GOLD, RETEST_DAYS, SRBAI_ITEMS } from '../domain/rules'
import { BRANCHES, passes, type SkillState } from '../domain/skills'
import { formatKDate } from '../domain/time'
import { saveSkillAttempt } from '../db/queries'
import { Sheet, useToast } from '../ui/common'

const STATUS_MARK = { owned: '✓', ready: '!', cooldown: '⏳', locked: '🔒' } as const

function testLabel(s: SkillState): string {
  const t = s.def.test
  if (t.kind === 'count') return `${t.label} ${t.target}개`
  if (t.kind === 'seconds') return `${t.label} ${t.target}초`
  if (t.kind === 'srbai') return `자동성 4문항 평균 ${t.minMean}점`
  return '66일 점검 통과'
}

function needLabel(s: SkillState): string {
  const n = s.need
  if (!n) return ''
  if (n.prev) return `${n.prev} 먼저`
  if (n.clears) return `메인 퀘스트 ${n.clears.need - n.clears.have}번 더`
  if (n.day) return `${n.day.need}일째부터`
  return '66일 점검으로 얻는다'
}

function subLabel(s: SkillState): string {
  if (s.status === 'owned') return s.def.effectLabel
  if (s.status === 'ready') return `시험 가능 · ${testLabel(s)}`
  if (s.status === 'cooldown') return `재시험 ${formatKDate(s.retestOn!)}`
  return needLabel(s)
}

export function Skills({ data }: { data: AppData }) {
  const [open, setOpen] = useState<SkillState | null>(null)
  const owned = data.skills.filter(s => s.status === 'owned').length
  const ready = data.skills.filter(s => s.status === 'ready').length
  // 시트가 열린 뒤 기록이 바뀌어도 최신 상태를 보여 준다
  const current = open ? data.skills.find(s => s.def.id === open.def.id) ?? open : null

  return (
    <div className="stack">
      <header className="row between">
        <h1>스킬</h1>
        <span className="row small">
          <span className="chip">{owned} 획득</span>
          {ready > 0 && <span className="chip gold">{ready} 시험 가능</span>}
        </span>
      </header>
      <p className="small muted">스킬은 승급 시험에 붙어야만 생긴다. 응시 조건을 채우면 시험이 열린다.</p>

      {BRANCHES.map(b => (
        <section key={b.id} className="card stack" style={{ gap: 6 }}>
          <h3>{b.title}</h3>
          <div className="tree">
            {data.skills.filter(s => s.def.branch === b.id).map(s => (
              <button key={s.def.id} className={`node ${s.status}`} onClick={() => setOpen(s)}>
                <span className="mark" aria-hidden>{STATUS_MARK[s.status]}</span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <b>{s.def.title}</b>
                  <small>{subLabel(s)}</small>
                </span>
                {s.status === 'ready' && <span className="chip gold">시험</span>}
              </button>
            ))}
          </div>
        </section>
      ))}

      <SkillSheet skill={current} data={data} onClose={() => setOpen(null)} />
    </div>
  )
}

function SkillSheet({ skill, data, onClose }: { skill: SkillState | null; data: AppData; onClose: () => void }) {
  const [exam, setExam] = useState(false)
  useEffect(() => { setExam(false) }, [skill?.def.id])
  if (!skill) return null
  const s = skill
  return (
    <Sheet open onClose={onClose} title={exam ? '승급 시험' : s.def.title}>
      {!exam && (
        <div className="stack">
          <table className="simple">
            <tbody>
              <tr><th>응시 조건</th><td>{conditionLabel(s)}</td></tr>
              <tr><th>합격 기준</th><td>{testLabel(s)}</td></tr>
              <tr><th>스킬 효과</th><td><b>{s.def.effectLabel}</b></td></tr>
              {s.best !== null && <tr><th>내 최고</th><td className="num">{s.best}{s.def.test.kind === 'seconds' ? '초' : '개'}</td></tr>}
              {s.acquiredOn && <tr><th>획득</th><td>{formatKDate(s.acquiredOn)}</td></tr>}
            </tbody>
          </table>
          {s.status === 'ready' && <button className="btn primary" onClick={() => setExam(true)}>시험 보기</button>}
          {s.status === 'cooldown' && <p className="small muted">떨어지면 {RETEST_DAYS}일 쉬고 다시 본다. {formatKDate(s.retestOn!)}부터.</p>}
          {s.status === 'locked' && <p className="small muted">{needLabel(s)}</p>}
        </div>
      )}
      {exam && <Exam skill={s} today={data.today} onClose={onClose} />}
    </Sheet>
  )
}

function conditionLabel(s: SkillState): string {
  const r = s.def.requires
  const parts = []
  if (s.def.prev) parts.push('앞 단계 획득')
  if (r.clears) parts.push(`메인 퀘스트 ${r.clears}번`)
  if (r.day) parts.push(`${r.day}일째`)
  return parts.join(' · ') || '없음'
}

function Exam({ skill, today, onClose }: { skill: SkillState; today: string; onClose: () => void }) {
  const toast = useToast()
  const t = skill.def.test
  const [value, setValue] = useState(0)
  const [answers, setAnswers] = useState([0, 0, 0, 0])
  const [result, setResult] = useState<{ value: number; passed: boolean; record: boolean } | null>(null)

  async function submit(v: number) {
    await saveSkillAttempt(skill.def.id, today, v)
    const passed = passes(skill.def, v)
    const record = !passed && skill.best !== null && v > skill.best
    setResult({ value: v, passed, record })
    toast(passed ? `${skill.def.title} 획득` : record ? `개인 기록 갱신 +${RECORD_GOLD} G` : '재시험은 3일 뒤')
  }

  const unit = t.kind === 'seconds' ? '초' : t.kind === 'count' ? '개' : '점'
  if (result) {
    const target = t.kind === 'count' || t.kind === 'seconds' ? t.target : t.kind === 'srbai' ? t.minMean : 0
    return (
      <div className={`exam-result stack pop ${result.passed ? 'pass' : ''}`}>
        <div className="big">{result.passed ? '합격' : '아깝다'}</div>
        <p className="num">
          {t.kind === 'srbai' ? result.value.toFixed(1) : result.value}{unit}
          {!result.passed && ` · 기준까지 ${t.kind === 'srbai' ? (target - result.value).toFixed(1) : target - result.value}${unit}`}
        </p>
        {result.passed && <p><b>{skill.def.effectLabel}</b></p>}
        {result.record && <span className="chip gold">개인 기록 갱신 · +{RECORD_GOLD} G</span>}
        {!result.passed && <p className="small muted">재시험은 {RETEST_DAYS}일 뒤</p>}
        <button className="btn primary" onClick={onClose}>확인</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row between small">
        <b>{skill.def.title}</b>
        <span className="muted">기준 {testLabel(skill)}{skill.best !== null && ` · 지난 최고 ${skill.best}${unit}`}</span>
      </div>
      {t.kind === 'count' && (
        <>
          <button className="counter num" onClick={() => { setValue(v => v + 1); navigator.vibrate?.(15) }}>
            {value}<small>탭해서 세기</small>
          </button>
          <div className="row">
            <button className="btn sm grow" disabled={value === 0} onClick={() => setValue(v => Math.max(0, v - 1))}>하나 빼기</button>
            <button className="btn sm primary grow" disabled={value === 0} onClick={() => submit(value)}>끝, 제출</button>
          </div>
        </>
      )}
      {t.kind === 'seconds' && <Stopwatch target={t.target} onSubmit={submit} />}
      {t.kind === 'srbai' && (
        <>
          <p className="small muted">요즘 메인 퀘스트를 할 때 나는… 1 = 전혀 아니다, 7 = 매우 그렇다</p>
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
          <button className="btn primary" disabled={answers.some(a => !a)}
            onClick={() => submit(answers.reduce((a, b) => a + b, 0) / answers.length)}>제출</button>
        </>
      )}
    </div>
  )
}

function Stopwatch({ target, onSubmit }: { target: number; onSubmit: (sec: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [sec, setSec] = useState(0)
  const [stopped, setStopped] = useState(false)
  const buzzed = useRef(false)
  useEffect(() => {
    if (startedAt === null || stopped) return
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000)
      setSec(s)
      if (s >= target && !buzzed.current) { buzzed.current = true; navigator.vibrate?.([200, 100, 200]) }
    }, 200)
    return () => clearInterval(t)
  }, [startedAt, stopped, target])
  return (
    <>
      <div className={`counter num ${sec >= target ? 'hit' : ''}`} aria-live="polite">
        {sec}<small>{sec >= target ? '기준 넘김 · 버틸 만큼 버틴다' : `기준 ${target}초`}</small>
      </div>
      {startedAt === null && <button className="btn primary" onClick={() => setStartedAt(Date.now())}>시작</button>}
      {startedAt !== null && !stopped && <button className="btn primary" onClick={() => setStopped(true)}>멈춤</button>}
      {stopped && (
        <div className="row">
          <button className="btn sm grow" onClick={() => { setStartedAt(null); setSec(0); setStopped(false); buzzed.current = false }}>다시</button>
          <button className="btn sm primary grow" onClick={() => onSubmit(sec)}>제출</button>
        </div>
      )}
    </>
  )
}
