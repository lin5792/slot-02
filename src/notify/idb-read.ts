// 서비스워커용 읽기 전용 IndexedDB 접근. Dexie 없이 원시 API로 본체 DB를 읽는다.
// 버전 없이 열어서 업그레이드를 일으키지 않고, DB가 아직 없으면 만들지 않고 빈 결과를 낸다.

import type { DayLog, Habit, ISODate } from '../domain/types'
import { DB_NAME } from '../db/schema'
import { comboFromDates, type NotifyStatus } from './messages'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export function openExistingDb(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let created = false
    const r = factory.open(name)
    r.onupgradeneeded = () => {
      // DB가 없었다는 뜻이다. 빈 DB를 남기지 않도록 취소한다.
      created = true
      r.transaction?.abort()
    }
    r.onsuccess = () => resolve(created ? (r.result.close(), null) : r.result)
    r.onerror = () => resolve(null)
    r.onblocked = () => resolve(null)
  })
}

export async function readHabit(db: IDBDatabase, habitId: string): Promise<Habit | null> {
  if (!db.objectStoreNames.contains('habits')) return null
  const store = db.transaction('habits', 'readonly').objectStore('habits')
  return ((await req(store.get(habitId))) as Habit | undefined) ?? null
}

export async function readStatus(db: IDBDatabase, habitId: string, questDate: ISODate): Promise<NotifyStatus | null> {
  if (!db.objectStoreNames.contains('logs')) return null
  const store = db.transaction('logs', 'readonly').objectStore('logs')
  const logs = (await req(store.index('habitId').getAll(habitId))) as DayLog[]
  const today = logs.find((l) => l.date === questDate)
  return {
    tier: today?.tier ?? null,
    combo: comboFromDates(
      logs.map((l) => l.date),
      questDate,
    ),
  }
}
