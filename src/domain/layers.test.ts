import { describe, expect, it } from 'vitest'
import { checkAnchor, planDay } from './layers'
import type { Block, CalendarEvent, Habit } from './types'

const ALL = [0, 1, 2, 3, 4, 5, 6] as Block['weekdays']
const WEEKDAYS = [1, 2, 3, 4, 5] as Block['weekdays']
const b = (p: Partial<Block>): Block => ({
  id: p.title!, layer: 'L1', title: '', start: '00:00', end: '01:00', weekdays: ALL, createdAt: 0, ...p,
})
const blocks: Block[] = [
  b({ title: '근무', layer: 'L0', start: '09:00', end: '18:00', weekdays: WEEKDAYS }),
  b({ title: '수면', layer: 'L1', start: '23:30', end: '06:30', kind: 'sleep' }),
  b({ title: '운동', layer: 'L1', start: '19:00', end: '19:30', habitId: 'h' }),
  b({ title: '독서', layer: 'L3', start: '17:00', end: '18:30' }),
]
const habit = { id: 'h', backstopTime: '22:30' } as Habit
const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e', title: '회식', date: '2026-11-03', status: 'planned', source: 'manual', createdAt: 0, ...p,
})

describe('planDay', () => {
  it('자정을 넘는 수면을 이틀에 나눠 넣는다', () => {
    const p = planDay(blocks, [], '2026-11-03') // 화
    const sleep = p.items.filter(i => i.kind === 'sleep')
    expect(sleep.map(s => [s.start, s.end])).toEqual([[0, 390], [1410, 1440]])
    expect(p.sleepMin).toBe(420)
  })

  it('겹치면 윗 계층이 시간을 가져가고 겹침을 알린다', () => {
    const p = planDay(blocks, [], '2026-11-03')
    expect(p.budget.L0).toBe(540)
    expect(p.budget.L3).toBe(30) // 18:00~18:30만 남음
    expect(p.overlaps.map(o => [o.lower.title, o.upper.title])).toEqual([['독서', '근무']])
    expect(p.free).toBe(1440 - 540 - 420 - 30 - 30)
  })

  it('주말에는 근무가 없다', () => {
    expect(planDay(blocks, [], '2026-11-07').budget.L0).toBe(0)
  })
})

describe('checkAnchor', () => {
  it('이벤트가 없으면 충돌도 없다', () => {
    const c = checkAnchor(habit, blocks, [], '2026-11-03')
    expect(c.anchor).toEqual({ start: 1140, end: 1170 })
    expect(c.conflict).toBeNull()
  })

  it('이벤트가 앵커와 겹치면 끝난 뒤 백스톱 전 빈칸을 제안한다', () => {
    const c = checkAnchor(habit, blocks, [ev({ start: '18:30', end: '21:00' })], '2026-11-03')
    expect(c.conflict?.title).toBe('회식')
    expect(c.suggestion).toEqual({ start: 1260, end: 1290, after: '회식' })
  })

  it('끝난 뒤 자리가 없으면 그날 앞쪽 빈칸을 제안한다', () => {
    const c = checkAnchor(habit, blocks, [ev({ start: '18:30', end: '23:00' })], '2026-11-03')
    expect(c.suggestion).toEqual({ start: 390, end: 420 })
  })
})
