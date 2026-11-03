import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, HabitDB } from './db'
import {
  createHabit, getActiveHabit, getLog, logTier, promoteHabit, redrawCard, submitSrbai,
  todayCardId, upsertEventsFromIcs, exportAll, importAll, buyReward, setAfterglow, getSettings,
  toggleQuestDone, saveReward, saveSkillAttempt,
} from './queries'
import { STORES } from './schema'
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

  it('잔액이 모자라면 살 수 없다', async () => {
    await saveReward({ title: '커피', price: 40, kind: 'now' })
    const r = (await db.rewards.toArray())[0]
    expect(await buyReward(r, 39, '2026-11-02')).toBe(false)
    expect(await buyReward(r, 40, '2026-11-02')).toBe(true)
    expect(await db.purchases.count()).toBe(1)
  })

  it('앵콜/참고 저장은 하루 한 번만 고른다', async () => {
    expect(await setAfterglow('2026-11-02', 'encore')).toBe(true)
    expect(await setAfterglow('2026-11-02', 'rest')).toBe(false)
    expect((await getSettings()).afterglow).toEqual({ '2026-11-02': 'encore' })
  })

  it('사이드 퀘스트는 누를 때마다 켜고 끈다', async () => {
    await toggleQuestDone('q1', '2026-11-02')
    expect((await getLog('q1', '2026-11-02'))?.tier).toBe('basic')
    await toggleQuestDone('q1', '2026-11-02')
    expect(await getLog('q1', '2026-11-02')).toBeUndefined()
  })

  it('백업에 상점·시험 기록도 들어간다', async () => {
    await saveSkillAttempt('pushup1', '2026-11-02', 8)
    const json = await exportAll()
    await db.skillTests.clear()
    await importAll(json)
    expect((await db.skillTests.toArray())[0].value).toBe(8)
  })

  it('v1 DB를 열면 기록을 지킨 채 v2로 올라간다', async () => {
    db.close()
    await Dexie.delete('upgrade-test')
    const v1 = new Dexie('upgrade-test')
    v1.version(1).stores(STORES)
    await v1.table('logs').put({ habitId: 'h', date: '2026-11-02', tier: 'best', loggedAt: 0 })
    v1.close()
    const v2 = new HabitDB('upgrade-test')
    expect((await v2.logs.get(['h', '2026-11-02']))?.tier).toBe('best')
    expect(await v2.rewards.count()).toBe(0)
    expect(v2.verno).toBe(2)
    v2.close()
    await db.open()
  })
})
