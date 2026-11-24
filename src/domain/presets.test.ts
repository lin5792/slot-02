import { describe, expect, it } from 'vitest'
import { sessionForDay, tierSeconds, timeline, totalSec, uniformTimeline, type Session } from './plans'
import { BOOKS, booksOfLevel, finishDay, pagesOnDay } from './books'
import { PLANS, THEMES, dayOfPlan, planById, plansOf } from './presets'
import { chapterOfDay } from './progress'
import { PROGRAM_DAYS, chapterRule } from './rules'

const days = Array.from({ length: PROGRAM_DAYS + 22 }, (_, i) => i + 1)

describe('timeline', () => {
  const s: Session = {
    id: 't', title: 't', summary: '', roundRestSec: 60, rounds: { basic: 2, best: 3 },
    warmup: [{ name: '준비', sec: 30 }],
    moves: [{ name: 'A', reps: 10, sec: 30, restSec: 20 }, { name: 'B', sec: 15, each: true, restSec: 20 }],
    cooldown: [{ name: '정리', sec: 40 }],
  }

  it('바퀴 사이는 roundRestSec, 마지막 동작 뒤에는 쉬지 않는다', () => {
    const t = timeline(s, 'basic')
    expect(t.map(g => `${g.kind}:${g.label}:${g.sec}`)).toEqual([
      'warmup:준비:30',
      'work:A:30', 'rest:쉬기:20', 'work:B (왼쪽):15', 'work:B (오른쪽):15', 'rest:쉬기:60',
      'work:A:30', 'rest:쉬기:20', 'work:B (왼쪽):15', 'work:B (오른쪽):15',
      'cooldown:정리:40',
    ])
    expect(t[1]).toMatchObject({ reps: 10, round: 1, rounds: 2 })
    expect(t[5]).toMatchObject({ next: 'A' })
  })

  it('최소는 준비·정리 없이 min(없으면 한 바퀴)만', () => {
    expect(timeline(s, 'min').map(g => g.kind)).toEqual(['work', 'rest', 'work', 'work'])
    expect(timeline({ ...s, min: [{ name: 'C', sec: 60 }] }, 'min')).toEqual([
      { kind: 'work', label: 'C', sec: 60, round: 1, rounds: 1 },
    ])
  })

  it('직접 정한 세트 타이머도 같은 구간으로 만든다', () => {
    const t = uniformTimeline({ sets: 3, workSec: 40, restSec: 20 })
    expect(t.map(g => g.kind)).toEqual(['work', 'rest', 'work', 'rest', 'work'])
    expect(totalSec(t)).toBe(160)
  })
})

describe('프리셋 목록', () => {
  it('테마마다 플랜이 있고 id는 겹치지 않는다', () => {
    for (const t of THEMES) expect(plansOf(t.id).length).toBeGreaterThan(0)
    expect(new Set(PLANS.map(p => p.id)).size).toBe(PLANS.length)
    expect(planById('run')?.title).toBe('달리기 입문')
  })

  it('모든 플랜에 근거가 있고 단계는 1일차부터 오름차순이다', () => {
    for (const p of PLANS) {
      expect(p.sources.length, p.id).toBeGreaterThan(0)
      expect(p.stages[0].fromDay, p.id).toBe(1)
      const from = p.stages.map(s => s.fromDay)
      expect([...from].sort((a, b) => a - b), p.id).toEqual(from)
    }
  })

  it('모든 날: 최소 < 기본 < 최고, 구간은 모두 0초보다 길다', () => {
    for (const p of PLANS) for (const d of days) {
      const { seconds, segments } = dayOfPlan(p, d)
      expect(seconds.min, `${p.id} ${d}일`).toBeLessThan(seconds.basic)
      expect(seconds.basic, `${p.id} ${d}일`).toBeLessThan(seconds.best)
      for (const g of [...segments.min, ...segments.basic, ...segments.best]) expect(g.sec).toBeGreaterThan(0)
    }
  })

  it('운동 기본 세션은 그날 챕터 상한 안, 최소는 5분 이하', () => {
    for (const p of plansOf('exercise')) for (const d of days.slice(0, PROGRAM_DAYS)) {
      const s = tierSeconds(sessionForDay(p, d))
      const cap = chapterRule(chapterOfDay(d)).capMin!
      expect(s.basic, `${p.id} ${d}일`).toBeLessThanOrEqual(cap * 60)
      expect(s.min, `${p.id} ${d}일`).toBeLessThanOrEqual(5 * 60)
    }
  })

  it('다른 테마의 최소는 10분 이하', () => {
    for (const p of PLANS.filter(p => p.theme !== 'exercise')) for (const d of days) {
      expect(tierSeconds(sessionForDay(p, d)).min, p.id).toBeLessThanOrEqual(10 * 60)
    }
  })
})

describe('운동 플랜 규칙 (근거 수치)', () => {
  const weekOf = (planId: string, firstDay: number) =>
    Array.from({ length: 7 }, (_, i) => sessionForDay(planById(planId)!, firstDay + i))

  it('근력이 들어간 플랜은 주 2일 이상 근력, 이틀 연속은 없다 (WHO 2020 · ACSM 2026)', () => {
    for (const id of ['strength', 'lose-weight']) for (const first of [1, 23, 45]) {
      const w = weekOf(id, first).map(s => s.id.startsWith('strength'))
      expect(w.filter(Boolean).length, id).toBeGreaterThanOrEqual(2)
      w.forEach((on, i) => { if (on && i > 0) expect(w[i - 1], `${id} ${first + i}일`).toBe(false) })
    }
  })

  it('체중 감량 3챕터 기본은 주 150~250분 (ACSM 2009)', () => {
    const min = weekOf('lose-weight', 45).reduce((s, x) => s + tierSeconds(x).basic, 0) / 60
    expect(min).toBeGreaterThanOrEqual(150)
    expect(min).toBeLessThanOrEqual(250)
  })

  it('달리기 입문: 1일차 1분 달리기로 시작해 59일차부터 쉬지 않고 30분', () => {
    const run = planById('run')!
    expect(sessionForDay(run, 1).id).toBe('run-1')
    expect(sessionForDay(run, 2).id).toBe('recovery')
    const last = timeline(sessionForDay(run, 59), 'basic')
    expect(last.some(g => g.kind === 'rest')).toBe(false)
    expect(totalSec(last.filter(g => g.kind === 'work'))).toBe(30 * 60)
    expect(sessionForDay(run, 80).id).toBe('run-9')
  })

  it('스트레칭은 동작당 누적 60초 이상 (ACSM)', () => {
    for (const d of [1, 23, 45]) {
      const t = timeline(sessionForDay(planById('posture')!, d), 'basic').filter(g => g.kind === 'work' && !g.reps)
      const byName = new Map<string, number>()
      for (const g of t) byName.set(g.label, (byName.get(g.label) ?? 0) + g.sec)
      for (const [name, sec] of byName) expect(sec, name).toBeGreaterThanOrEqual(60)
    }
  })
})

describe('책 읽기', () => {
  it('하루 쪽수는 7 → 10 → 15쪽이고 타이머 구간에 쪽 단위로 들어간다', () => {
    const p = planById('reading')!
    expect([1, 23, 45, 70].map(pagesOnDay)).toEqual([7, 10, 15, 15])
    expect(timeline(sessionForDay(p, 1), 'basic')[0]).toMatchObject({ label: '읽기', reps: 7, unit: '쪽' })
  })

  it('레벨마다 책이 있고, 1단계 책은 1챕터 안에 다 읽는다', () => {
    for (const lv of [1, 2, 3] as const) expect(booksOfLevel(lv).length).toBeGreaterThanOrEqual(3)
    expect(new Set(BOOKS.map(b => b.id)).size).toBe(BOOKS.length)
    for (const b of booksOfLevel(1).slice(0, 2)) expect(finishDay(b.pages, 1), b.title).toBeLessThanOrEqual(22)
    expect(finishDay(70, 1)).toBe(10)
    expect(finishDay(17, 22)).toBe(23) // 22일차 7쪽 + 23일차 10쪽
  })
})
