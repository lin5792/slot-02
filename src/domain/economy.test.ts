import { describe, expect, it } from 'vitest'
import { computeEconomy, dayTypeOf, mainGoldIf, monthlyGoldEstimate, questsFor, sealedChestGold, surpriseOn } from './economy'
import { computeProgress } from './progress'
import { SURPRISE_GOLD, TIER_GOLD, WEEKLY_CHEST_GOLD } from './rules'
import { effectsOn, recordBreaks, skillStates } from './skills'
import { addDays } from './time'
import type { DayLog, Habit, Settings, SideQuest, SkillAttempt, Tier } from './types'

// 2026-11-02 는 월요일
const START = '2026-11-02'
const habit: Habit = {
  id: 'h', title: '운동', tiers: { min: 'a', basic: 'b', best: 'c' },
  intention: { anchorEvent: '퇴근 후', place: '거실', action: '운동복' },
  ifThen: [], backstopTime: '22:30', startDate: START, status: 'active', extensions: 0, createdAt: 0,
}
const settings: Settings = { key: 'main', bedtime: '23:30', redraws: {}, drawn: {} }
const logs = (tiers: (Tier | null)[]): DayLog[] =>
  tiers.flatMap((t, i) => (t ? [{ habitId: 'h', date: addDays(START, i), tier: t, loggedAt: 0 }] : []))

function econ(tiers: (Tier | null)[], today: string, more: Partial<Parameters<typeof computeEconomy>[0]> = {}) {
  const l = [...logs(tiers), ...(more.logs ?? [])]
  return computeEconomy({
    progresses: [computeProgress(habit, l, today)], logs: l, quests: [], purchases: [], attempts: [],
    skills: [], settings, today, ...more, ...(more.logs ? { logs: l } : {}),
  })
}
const sum = (e: ReturnType<typeof econ>, kind: string) => e.lines.filter(l => l.kind === kind).reduce((s, l) => s + l.gold, 0)
// 깜짝 상자는 날짜 운이라 테스트에서는 따로 더한다
const surprises = (dates: string[], id = 'main') => dates.filter(d => surpriseOn(id, d)).length * SURPRISE_GOLD

describe('dayTypeOf', () => {
  it('요일로 정하고, 따로 정한 날이 우선한다', () => {
    expect(dayTypeOf('2026-11-02', settings)).toBe('work') // 월
    expect(dayTypeOf('2026-11-08', settings)).toBe('off') // 일
    expect(dayTypeOf('2026-11-02', { ...settings, dayOverride: { '2026-11-02': 'off' } })).toBe('off')
    expect(dayTypeOf('2026-11-08', { ...settings, workdays: [0] })).toBe('work')
  })

  it('지운 퀘스트와 다른 날 퀘스트는 빠진다', () => {
    const q = (id: string, on: SideQuest['on'], archived?: boolean): SideQuest =>
      ({ id, title: id, minutes: 5, gold: 20, on, archived, createdAt: 0 })
    const list = questsFor([q('a', 'work'), q('b', 'off'), q('c', 'both'), q('d', 'both', true)], 'work')
    expect(list.map(x => x.id)).toEqual(['a', 'c'])
  })
})

describe('computeEconomy', () => {
  it('메인 퀘스트 골드는 단계별, 봉인 상자는 다음 클리어 때 열린다', () => {
    const e = econ(['basic', 'best'], addDays(START, 1))
    expect(sum(e, 'quest')).toBe(TIER_GOLD.basic + TIER_GOLD.best)
    expect(sum(e, 'chest')).toBe(sealedChestGold(START))
    expect(e.sealedPending).toBe(true)
    expect(e.balance).toBe(e.earned)
  })

  it('봉인 상자 금액은 20~60 G이고 같은 날이면 같다', () => {
    for (let i = 0; i < 30; i++) {
      const g = sealedChestGold(addDays(START, i))
      expect(g).toBeGreaterThanOrEqual(20)
      expect(g).toBeLessThanOrEqual(60)
    }
    expect(sealedChestGold(START)).toBe(sealedChestGold(START))
  })

  it('복귀 보너스: 기본을 놓친 다음 날 기본 이상', () => {
    const e = econ(['basic', null, 'basic'], addDays(START, 2))
    expect(sum(e, 'comeback')).toBe(20)
  })

  it('앵콜은 그날 +10 G, 참고 저장은 다음 클리어에 ×1.5', () => {
    const s: Settings = { ...settings, afterglow: { [START]: 'encore', [addDays(START, 1)]: 'rest' } }
    const e = econ(['basic', 'basic', 'basic'], addDays(START, 2), { settings: s })
    expect(sum(e, 'encore')).toBe(10)
    expect(e.lines.find(l => l.kind === 'rest')).toEqual({ date: addDays(START, 2), kind: 'rest', source: 'main', gold: 15 })
  })

  it('참고 저장 다음 날 아직 안 깼으면 보너스가 기다린다', () => {
    const s: Settings = { ...settings, afterglow: { [START]: 'rest' } }
    expect(econ(['basic'], addDays(START, 1), { settings: s }).restWaiting).toBe(true)
    expect(econ(['basic', 'min'], addDays(START, 1), { settings: s }).restWaiting).toBe(false)
  })

  it('주간 상자는 같은 주 다섯 번째 클리어에 열린다', () => {
    const e4 = econ(['basic', 'basic', 'basic', 'basic'], addDays(START, 3))
    expect(e4.week).toEqual({ count: 4, goal: 5, gift: 2, opened: false })
    expect(sum(e4, 'weekly')).toBe(0)
    const e5 = econ(['basic', 'basic', 'basic', 'basic', 'min'], addDays(START, 4))
    expect(e5.week.opened).toBe(true)
    expect(sum(e5, 'weekly')).toBe(WEEKLY_CHEST_GOLD)
    // 다음 주 월요일에는 0부터
    expect(econ(['basic', 'basic', 'basic', 'basic', 'min'], addDays(START, 7)).week.count).toBe(0)
  })

  it('사이드 퀘스트는 골드와 같은 XP를 준다. 지운 퀘스트의 지난 골드도 남는다', () => {
    const q: SideQuest = { id: 'q', title: '물', minutes: 1, gold: 20, on: 'both', archived: true, createdAt: 0 }
    const side: DayLog[] = [{ habitId: 'q', date: START, tier: 'basic', loggedAt: 0 }]
    const e = econ([], START, { quests: [q], logs: side })
    expect(e.sideXp).toBe(20)
    expect(e.earned).toBe(20 + surprises([START], 'q'))
    expect(e.clears).toBe(0)
  })

  it('구매는 잔액에서 빠진다', () => {
    const e = econ(['best'], START, {
      purchases: [{ id: 'p', rewardId: 'r', title: '커피', price: 40, date: START, createdAt: 0 }],
    })
    expect(e.balance).toBe(e.earned - 40)
  })

  it('미래 기록은 세지 않는다', () => {
    const e = econ(['basic', 'basic'], START)
    expect(e.clears).toBe(1)
  })

  it('스킬 효과는 합격한 날부터 붙는다', () => {
    const attempts: SkillAttempt[] = [{ id: 'a', skillId: 'pushup1', date: addDays(START, 4), value: 12, createdAt: 0 }]
    const today = addDays(START, 5)
    const skills = skillStates({ attempts, srbai: [], clears: 5, day: 6, today })
    const e = econ(['basic', 'basic', 'basic', 'basic', 'basic', 'basic'], today, { attempts, skills })
    const q = e.lines.filter(l => l.kind === 'quest').map(l => l.gold)
    expect(q).toEqual([30, 30, 30, 30, 32, 32]) // 30 × 1.05 = 31.5 → 32
  })

  it('미리 보는 골드에 복귀·휴식 보너스가 들어간다', () => {
    const today = addDays(START, 2)
    const p = computeProgress(habit, logs(['basic', null]), today)
    const s: Settings = { ...settings, afterglow: { [addDays(START, 1)]: 'rest' } }
    expect(mainGoldIf('basic', p, [], s, today)).toBe(30 + 20 + 15)
    expect(mainGoldIf('min', p, [], settings, today)).toBe(10)
  })
})

describe('skills', () => {
  const ctx = { attempts: [] as SkillAttempt[], srbai: [], clears: 0, day: 1, today: START }

  it('응시 조건이 모자라면 잠겨 있고 무엇이 모자란지 알려 준다', () => {
    const s = skillStates(ctx).find(x => x.def.id === 'pushup1')!
    expect(s.status).toBe('locked')
    expect(s.need?.clears).toEqual({ have: 0, need: 5 })
    const s2 = skillStates(ctx).find(x => x.def.id === 'pushup2')!
    expect(s2.need?.prev).toBe('푸시업 I')
  })

  it('조건을 채우면 응시, 떨어지면 3일 뒤 재시험, 붙으면 보유', () => {
    const fail: SkillAttempt = { id: '1', skillId: 'pushup1', date: START, value: 7, createdAt: 1 }
    expect(skillStates({ ...ctx, clears: 5 }).find(x => x.def.id === 'pushup1')!.status).toBe('ready')
    const cool = skillStates({ ...ctx, clears: 5, attempts: [fail] }).find(x => x.def.id === 'pushup1')!
    expect(cool.status).toBe('cooldown')
    expect(cool.retestOn).toBe(addDays(START, 3))
    expect(skillStates({ ...ctx, clears: 5, attempts: [fail], today: addDays(START, 3) })
      .find(x => x.def.id === 'pushup1')!.status).toBe('ready')
    const pass: SkillAttempt = { id: '2', skillId: 'pushup1', date: addDays(START, 3), value: 10, createdAt: 2 }
    const owned = skillStates({ ...ctx, clears: 5, attempts: [fail, pass], today: addDays(START, 3) })
    expect(owned.find(x => x.def.id === 'pushup1')!.status).toBe('owned')
    expect(owned.find(x => x.def.id === 'pushup1')!.best).toBe(10)
  })

  it('66일 각인은 정착 점검을 통과하면 생긴다', () => {
    const srbai = [{ id: 's', habitId: 'h', date: '2027-01-06', answers: [5, 5, 5, 5] as [number, number, number, number], mean: 5, passed: true }]
    const s = skillStates({ ...ctx, srbai, day: 66 }).find(x => x.def.id === 'will3')!
    expect(s.status).toBe('owned')
    expect(effectsOn([s], '2027-01-06').goldPct).toBe(10)
    expect(effectsOn([s], '2027-01-05').goldPct).toBe(0)
  })

  it('떨어져도 개인 기록을 깨면 기록 갱신. 첫 시험은 기준점', () => {
    const a = (id: string, value: number, day: number, skillId = 'pushup1'): SkillAttempt =>
      ({ id, skillId, date: addDays(START, day), value, createdAt: day })
    const breaks = recordBreaks([a('1', 6, 0), a('2', 8, 3), a('3', 7, 6), a('4', 10, 9)])
    expect(breaks.map(x => x.id)).toEqual(['2']) // 10은 합격이라 기록 골드 대신 스킬을 받는다
  })
})

describe('monthlyGoldEstimate', () => {
  it('메인만 매일 기본으로 깨면 상자 기댓값까지 더한다', () => {
    // (30 + 40 + 6) × 7 + 100 = 632 / 주 → × 30/7
    expect(monthlyGoldEstimate([], settings)).toBe(Math.round(632 * 30 / 7))
  })
})
