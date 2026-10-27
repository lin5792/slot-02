import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  createHabit, getActiveHabit, getLog, logTier, promoteHabit, redrawCard, submitSrbai,
  todayCardId, upsertEventsFromIcs, exportAll, importAll,
} from './queries'
import type { CalendarEvent } from '../domain/types'

const draft = {
  title: '운동', tiers: { min: 'a', basic: 'b', best: 'c' },
  intention: { anchorEvent: '퇴근 후', place: '거실', action: '운동복' },
  ifThen: [], backstopTime: '22:30', startDate: '2026-11-02',
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('queries', () => {
  it('한 번에 하나만 승격된다', async () => {
    const a = await createHabit(draft)
    const b = await createHabit({ ...draft, title: '독서' })
    expect(a.status).toBe('active')
    expect(b.status).toBe('draft')
    expect(b.startDate).toBeNull()
    await expect(promoteHabit(b.id, '2027-01-07')).rejects.toThrow()
  })

  it('기록은 [habitId, date] 키로 덮어쓴다', async () => {
    const h = await createHabit(draft)
    await logTier(h.id, '2026-11-02', 'min', { cardId: 'walk' })
    await logTier(h.id, '2026-11-02', 'basic')
    const log = await getLog(h.id, '2026-11-02')
    expect(log?.tier).toBe('basic')
    expect(log?.cardId).toBe('walk')
    expect(await db.logs.count()).toBe(1)
  })

  it('SRBAI 통과 시 정착, 미통과 시 22일 연장', async () => {
    const h = await createHabit(draft)
    const fail = await submitSrbai(h, '2027-01-06', [4, 4, 5, 4])
    expect(fail.passed).toBe(false)
    expect((await db.habits.get(h.id))?.extensions).toBe(1)
    const pass = await submitSrbai((await db.habits.get(h.id))!, '2027-01-28', [6, 5, 5, 6])
    expect(pass.passed).toBe(true)
    expect(await getActiveHabit()).toBeUndefined()
  })

  it('카드는 하루 고정이고 다시 뽑기는 하루 1번, 다른 카드', async () => {
    const h = await createHabit(draft)
    const first = await todayCardId(h.id, 6, '2026-11-02')
    expect(await todayCardId(h.id, 6, '2026-11-02')).toBe(first)
    expect(await redrawCard(h.id, 6, '2026-11-02')).toBe(true)
    const second = await todayCardId(h.id, 6, '2026-11-02')
    expect(second).not.toBe(first)
    expect(await redrawCard(h.id, 6, '2026-11-02')).toBe(false)
  })

  it('ICS 가져오기는 externalId로 중복 없이 덮어쓴다', async () => {
    const ev: CalendarEvent = {
      id: '', title: '병원', date: '2026-11-05', start: '19:00', end: '20:00',
      status: 'planned', source: 'ics', externalId: 'uid-1', createdAt: 0,
    }
    expect(await upsertEventsFromIcs([ev])).toBe(1)
    expect(await upsertEventsFromIcs([{ ...ev, title: '치과' }])).toBe(0)
    const all = await db.events.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('치과')
  })

  it('백업을 내보내고 그대로 되살린다', async () => {
    const h = await createHabit(draft)
    await logTier(h.id, '2026-11-02', 'best')
    const json = await exportAll()
    await db.logs.clear()
    await importAll(json)
    expect((await getLog(h.id, '2026-11-02'))?.tier).toBe('best')
  })
})
