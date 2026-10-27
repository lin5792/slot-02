import { describe, expect, it } from 'vitest'
import { computeProgress, xpIfLogged } from './progress'
import { addDays } from './time'
import type { DayLog, Habit, Tier } from './types'

// 2026-11-02 는 월요일
const START = '2026-11-02'
const habit: Habit = {
  id: 'h', title: '운동', tiers: { min: '스쿼트 10회', basic: '카드 퀘스트', best: '카드 + 추가' },
  intention: { anchorEvent: '퇴근 후 현관문을 닫으면', place: '거실', action: '운동복으로 갈아입는다' },
  ifThen: [], backstopTime: '22:30', startDate: START, status: 'active', extensions: 0, createdAt: 0,
}
const logs = (tiers: (Tier | null)[]): DayLog[] =>
  tiers.flatMap((t, i) => (t ? [{ habitId: 'h', date: addDays(START, i), tier: t, loggedAt: 0 }] : []))

describe('computeProgress', () => {
  it('시작 전에는 진행이 없다', () => {
    const p = computeProgress(habit, [], addDays(START, -1))
    expect(p.started).toBe(false)
    expect(p.xp).toBe(0)
    expect(p.cells).toHaveLength(66)
    expect(p.cells.every(c => c.state === 'future')).toBe(true)
  })

  it('단계별 XP는 그날 가장 높은 단계 하나만 준다', () => {
    const p = computeProgress(habit, logs(['basic', 'best', 'min']), addDays(START, 2))
    expect(p.xp).toBe(30 + 50 + 10)
    expect(p.combo).toBe(3)
    expect(p.day).toBe(3)
  })

  it('오늘 기록 전에는 콤보가 깨지지 않는다', () => {
    const p = computeProgress(habit, logs(['min', 'min']), addDays(START, 2))
    expect(p.combo).toBe(2)
    expect(p.cells[2].state).toBe('today')
  })

  it('최소도 안 한 날은 콤보가 0이 된다 (실드 없음)', () => {
    const p = computeProgress(habit, logs(['basic', null, 'min']), addDays(START, 2))
    expect(p.combo).toBe(1)
    expect(p.bestCombo).toBe(1)
    expect(p.cells[1].state).toBe('missed')
  })

  it('기본을 놓친 첫날은 그 주 실드가 기본 연속기록을 지킨다', () => {
    const p = computeProgress(habit, logs(['basic', 'min', 'basic']), addDays(START, 2))
    expect(p.cells[1].shieldUsed).toBe(true)
    expect(p.basicStreak).toBe(2)
    expect(p.shieldThisWeek).toBe('used')
  })

  it('같은 주 두 번째로 놓치면 기본 연속기록이 끊긴다', () => {
    const p = computeProgress(habit, logs(['basic', 'min', 'basic', 'min', 'basic']), addDays(START, 4))
    expect(p.cells[3].shieldUsed).toBe(false)
    expect(p.basicStreak).toBe(1)
    expect(p.bestBasicStreak).toBe(2)
  })

  it('실드는 주마다 새로 생긴다', () => {
    // 1주차 일요일(6일차) 놓침, 2주차 월요일(8일차) 놓침 → 둘 다 실드
    const t: (Tier | null)[] = ['basic', 'basic', 'basic', 'basic', 'basic', 'basic', 'min', 'min', 'basic']
    const p = computeProgress(habit, logs(t), addDays(START, 8))
    expect(p.cells[6].shieldUsed).toBe(true)
    expect(p.cells[7].shieldUsed).toBe(true)
    expect(p.basicStreak).toBe(7)
  })

  it('쓰지 않은 실드는 주가 끝나면 +20XP로 환전된다', () => {
    const t: Tier[] = Array(7).fill('basic')
    const before = computeProgress(habit, logs(t), addDays(START, 6)) // 일요일 당일
    const after = computeProgress(habit, logs(t), addDays(START, 7)) // 다음 월요일
    expect(before.xp).toBe(7 * 30)
    expect(after.xp).toBe(7 * 30 + 20)
    expect(after.weeks[0].cashed).toBe(true)
  })

  it('기본을 놓친 다음 날 기본을 하면 복귀 보너스 +20XP', () => {
    const p = computeProgress(habit, logs(['basic', 'min', 'basic']), addDays(START, 2))
    expect(p.cells[2].comeback).toBe(true)
    expect(p.xp).toBe(30 + 10 + 30 + 20)
  })

  it('어제 기본을 놓쳤으면 오늘은 복귀 날이다', () => {
    const p = computeProgress(habit, logs(['basic', null]), addDays(START, 2))
    expect(p.comebackDay).toBe(true)
    expect(xpIfLogged(p, 'basic')).toBe(50)
    expect(xpIfLogged(p, 'min')).toBe(10)
  })

  it('오늘 최소만 한 상태에서는 실드를 아직 쓰지 않는다', () => {
    const p = computeProgress(habit, logs(['basic', 'min']), addDays(START, 1))
    expect(p.cells[1].shieldUsed).toBe(false)
    expect(p.shieldThisWeek).toBe('available')
    expect(p.basicStreak).toBe(1)
  })

  it('챕터와 보스까지 남은 날', () => {
    const p = computeProgress(habit, [], addDays(START, 21))
    expect(p.day).toBe(22)
    expect(p.chapter.n).toBe(1)
    expect(p.isBossDay).toBe(true)
    expect(p.daysToBoss).toBe(0)
    const p2 = computeProgress(habit, [], addDays(START, 22))
    expect(p2.chapter.n).toBe(2)
    expect(p2.daysToBoss).toBe(21)
    expect(p2.chapter.capMin).toBe(30)
  })

  it('66일째부터 점검 차례이고, 연장하면 22일이 붙는다', () => {
    expect(computeProgress(habit, [], addDays(START, 64)).checkDue).toBe(false)
    expect(computeProgress(habit, [], addDays(START, 65)).checkDue).toBe(true)
    const ext = computeProgress({ ...habit, extensions: 1 }, [], addDays(START, 65))
    expect(ext.totalDays).toBe(88)
    expect(ext.checkDue).toBe(false)
    expect(ext.chapter.n).toBe(3)
    const ext4 = computeProgress({ ...habit, extensions: 1 }, [], addDays(START, 70))
    expect(ext4.chapter.name).toContain('연장')
  })

  it('레벨은 누적 XP로 오른다', () => {
    const p = computeProgress(habit, logs(['best', 'best']), addDays(START, 1))
    expect(p.xp).toBe(100)
    expect(p.level).toBe(2)
    expect(p.nextLevelXp).toBe(300)
  })
})
