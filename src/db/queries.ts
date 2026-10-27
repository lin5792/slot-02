import { db } from './db'
import { drawCard, REDRAWS_PER_DAY } from '../domain/deck'
import { SRBAI_PASS_MEAN } from '../domain/rules'
import { fromMin, toMin } from '../domain/time'
import type {
  Block, CalendarEvent, DayLog, Habit, ISODate, Measurement, Settings, SrbaiCheck, Tier, WeeklyReview,
} from '../domain/types'

export const uid = () => crypto.randomUUID()

export const DEFAULT_SETTINGS: Settings = { key: 'main', bedtime: '23:30', redraws: {}, drawn: {} }

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Omit<Settings, 'key'>>) {
  const cur = await getSettings()
  await db.settings.put({ ...cur, ...patch, key: 'main' })
}

export const backstopFor = (bedtime: string) => fromMin(toMin(bedtime) - 60)

// ---- 습관 ----

export async function getActiveHabit(): Promise<Habit | undefined> {
  return db.habits.where('status').equals('active').first()
}

/** 한 번에 하나만 승격한다. 이미 활성 습관이 있으면 draft로 저장된다. */
export async function createHabit(h: Omit<Habit, 'id' | 'createdAt' | 'status' | 'extensions'>): Promise<Habit> {
  return db.transaction('rw', db.habits, async () => {
    const active = await getActiveHabit()
    const habit: Habit = {
      ...h, id: uid(), createdAt: Date.now(), extensions: 0,
      status: active ? 'draft' : 'active',
      startDate: active ? null : h.startDate,
    }
    await db.habits.add(habit)
    return habit
  })
}

export async function updateHabit(id: string, patch: Partial<Habit>) {
  await db.habits.update(id, patch)
}

export async function promoteHabit(id: string, startDate: ISODate) {
  await db.transaction('rw', db.habits, async () => {
    if (await getActiveHabit()) throw new Error('이미 승격 중인 습관이 있다')
    await db.habits.update(id, { status: 'active', startDate, extensions: 0 })
  })
}

// ---- 기록 ----

export async function getLog(habitId: string, date: ISODate): Promise<DayLog | undefined> {
  return db.logs.get([habitId, date])
}

export async function logTier(habitId: string, date: ISODate, tier: Tier, extra: Partial<DayLog> = {}) {
  const prev = await getLog(habitId, date)
  await db.logs.put({ ...prev, ...extra, habitId, date, tier, loggedAt: Date.now() })
}

export async function clearLog(habitId: string, date: ISODate) {
  await db.logs.delete([habitId, date])
}

// ---- 카드 ----

/** 오늘 카드. 한 번 뽑으면 그날은 고정된다 */
export async function todayCardId(habitId: string, level: number, date: ISODate): Promise<string> {
  const s = await getSettings()
  if (s.drawn[date]) return s.drawn[date]
  const id = drawCard(level, habitId, date, 0).id
  await saveSettings({ drawn: { ...s.drawn, [date]: id } })
  return id
}

export async function redrawCard(habitId: string, level: number, date: ISODate): Promise<boolean> {
  const s = await getSettings()
  const used = s.redraws[date] ?? 0
  if (used >= REDRAWS_PER_DAY) return false
  const id = drawCard(level, habitId, date, used + 1, s.drawn[date]).id
  await saveSettings({ drawn: { ...s.drawn, [date]: id }, redraws: { ...s.redraws, [date]: used + 1 } })
  return true
}

// ---- 블록 · 이벤트 ----

export const listBlocks = () => db.blocks.toArray()

export async function saveBlock(b: Omit<Block, 'id' | 'createdAt'> & { id?: string }) {
  await db.blocks.put({ ...b, id: b.id ?? uid(), createdAt: Date.now() } as Block)
}

export const deleteBlock = (id: string) => db.blocks.delete(id)

export async function saveEvent(e: Omit<CalendarEvent, 'id' | 'createdAt'> & { id?: string }) {
  await db.events.put({ ...e, id: e.id ?? uid(), createdAt: Date.now() } as CalendarEvent)
}

export const deleteEvent = (id: string) => db.events.delete(id)

/** 캘린더 가져오기. externalId(ICS UID)가 같으면 덮어쓴다. 반환값은 새로 추가된 개수 */
export async function upsertEventsFromIcs(events: CalendarEvent[]): Promise<number> {
  return db.transaction('rw', db.events, async () => {
    let added = 0
    for (const ev of events) {
      const existing = ev.externalId ? await db.events.where('externalId').equals(ev.externalId).first() : undefined
      if (existing) await db.events.put({ ...ev, id: existing.id, createdAt: existing.createdAt })
      else { await db.events.put({ ...ev, id: ev.id || uid(), source: 'ics' }); added++ }
    }
    return added
  })
}

// ---- 측정 · 리뷰 · 점검 ----

export async function saveMeasurement(m: Omit<Measurement, 'id'>) {
  await db.measurements.put({ ...m, id: `${m.habitId}|${m.chapter}|${m.kind}` })
}

export async function saveReview(r: Omit<WeeklyReview, 'id' | 'createdAt'>) {
  await db.reviews.put({ ...r, id: `${r.habitId}|${r.weekStart}`, createdAt: Date.now() })
}

/** 66일째 점검. 통과하면 정착(settled), 아니면 22일 연장 챕터를 붙인다 */
export async function submitSrbai(habit: Habit, date: ISODate, answers: SrbaiCheck['answers']): Promise<SrbaiCheck> {
  const mean = answers.reduce((a, b) => a + b, 0) / answers.length
  const check: SrbaiCheck = { id: uid(), habitId: habit.id, date, answers, mean, passed: mean >= SRBAI_PASS_MEAN }
  await db.transaction('rw', db.srbai, db.habits, db.blocks, async () => {
    await db.srbai.add(check)
    if (check.passed) await db.habits.update(habit.id, { status: 'settled' })
    else await db.habits.update(habit.id, { extensions: habit.extensions + 1 })
  })
  return check
}

// ---- 백업 (로컬 전용 앱이라 내보내기·가져오기가 유일한 백업) ----

const TABLES = ['habits', 'blocks', 'events', 'logs', 'measurements', 'reviews', 'srbai', 'settings'] as const

export async function exportAll(): Promise<string> {
  const out: Record<string, unknown[]> = {}
  for (const t of TABLES) out[t] = await db.table(t).toArray()
  return JSON.stringify({ app: 'habit-quest', version: 1, exportedAt: new Date().toISOString(), data: out }, null, 2)
}

export async function importAll(json: string) {
  const parsed = JSON.parse(json)
  if (parsed?.app !== 'habit-quest') throw new Error('habit-quest 백업 파일이 아니다')
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear()
      await db.table(t).bulkPut(parsed.data[t] ?? [])
    }
  })
}
