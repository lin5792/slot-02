import { describe, expect, it } from 'vitest'
import { buildReminderPlan, dueReminders } from '../schedule'
import { questDateFor } from '../dates'
import { habit } from './fixtures'

const plan = buildReminderPlan(habit, { timeZone: 'Asia/Seoul', today: '2026-10-27' })!
// KST = UTC+9
const kst = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`)

describe('buildReminderPlan', () => {
  it('활성 습관만 일정을 만든다', () => {
    expect(buildReminderPlan({ ...habit, status: 'draft' }, { timeZone: 'Asia/Seoul', today: '2026-10-27' })).toBeNull()
    expect(plan.items.map((i) => [i.kind, i.time])).toEqual([
      ['quest', '19:00'],
      ['backstop', '22:30'],
      ['backstop-final', '22:45'],
      ['weekly', '20:00'],
    ])
    expect(plan.items[0].endDate).toBe('2027-01-01') // 10/28 + 65일
  })
  it('연장 1회마다 22일 늘어난다', () => {
    const p = buildReminderPlan({ ...habit, extensions: 1 }, { timeZone: 'Asia/Seoul', today: '2026-10-27' })!
    expect(p.items[0].endDate).toBe('2027-01-23')
  })
})

describe('dueReminders', () => {
  it('예정 시각부터 유예 시간 안이면 보낸다', () => {
    expect(dueReminders(plan, kst('2026-10-28', '22:30'), {}).map((d) => d.item.kind)).toEqual(['backstop'])
    expect(dueReminders(plan, kst('2026-10-28', '22:39'), {}).map((d) => d.item.kind)).toEqual(['backstop'])
    expect(dueReminders(plan, kst('2026-10-28', '22:40'), {})).toEqual([])
    expect(dueReminders(plan, kst('2026-10-28', '22:29'), {})).toEqual([])
  })
  it('이미 보낸 날짜는 다시 보내지 않는다', () => {
    expect(dueReminders(plan, kst('2026-10-28', '22:31'), { 'h1:backstop': '2026-10-28' })).toEqual([])
    expect(dueReminders(plan, kst('2026-10-29', '22:31'), { 'h1:backstop': '2026-10-28' })).toHaveLength(1)
  })
  it('프로그램 기간 밖이면 보내지 않는다', () => {
    expect(dueReminders(plan, kst('2026-10-27', '22:30'), {})).toEqual([])
    expect(dueReminders(plan, kst('2027-01-01', '22:30'), {})).toHaveLength(1)
    expect(dueReminders(plan, kst('2027-01-02', '22:30'), {})).toEqual([])
  })
  it('주간 정비는 일요일에만', () => {
    // 2026-11-01은 일요일
    expect(dueReminders(plan, kst('2026-11-01', '20:00'), {}).map((d) => d.item.kind)).toEqual(['weekly'])
    expect(dueReminders(plan, kst('2026-11-02', '20:00'), {})).toEqual([])
  })
  it('자정을 넘긴 백스톱은 전날 퀘스트로 센다', () => {
    const late = buildReminderPlan({ ...habit, anchorTime: undefined, backstopTime: '23:55' }, { timeZone: 'Asia/Seoul', today: '2026-10-27' })!
    // final = 00:10 → 10/29 00:12에 보내는 건 10/28 퀘스트
    const due = dueReminders(late, kst('2026-10-29', '00:12'), {})
    expect(due.map((d) => [d.item.kind, d.questDate])).toEqual([['backstop-final', '2026-10-28']])
    // 23:55 예정분을 00:02에 보내도 10/28 퀘스트
    const due2 = dueReminders(late, kst('2026-10-29', '00:02'), {})
    expect(due2.map((d) => [d.item.kind, d.questDate])).toEqual([['backstop', '2026-10-28']])
  })
  it('서버 시각대와 무관하게 plan 시각대로 계산한다', () => {
    const ny = buildReminderPlan(habit, { timeZone: 'America/New_York', today: '2026-10-27' })!
    // 2026-11-01 서머타임 종료일 전후
    expect(dueReminders(ny, new Date('2026-10-31T22:30:00-04:00'), {}).map((d) => d.item.kind)).toEqual(['backstop'])
    expect(dueReminders(ny, new Date('2026-11-02T22:30:00-05:00'), {}).map((d) => d.item.kind)).toEqual(['backstop'])
  })
  it('questDateFor 경계는 04:00', () => {
    expect(questDateFor('2026-10-29', '03:59')).toBe('2026-10-28')
    expect(questDateFor('2026-10-29', '04:00')).toBe('2026-10-29')
  })
})
