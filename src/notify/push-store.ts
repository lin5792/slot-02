// 알림 모듈 자체 저장소. 본체 DB 스키마를 건드리지 않도록 별도 DB를 쓴다.
// 서비스워커가 구독 갱신(pushsubscriptionchange) 때 서버 주소와 마지막 일정을 알아야 해서 둔다.

import { putSubscription, type PushServerConfig } from './push-api'
import type { ReminderPlan } from './schedule'

const NOTIFY_DB = 'habit-quest-notify'
const STORE = 'kv'

export interface SyncState {
  config: PushServerConfig
  plan: ReminderPlan
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = factory.open(NOTIFY_DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function tx<T>(factory: IDBFactory, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await open(factory)
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE))
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  } finally {
    db.close()
  }
}

/** 연결 코드(서버 API_TOKEN). 이 기기의 로컬 DB에만 둔다 */
export function getConnectCode(factory: IDBFactory = indexedDB): Promise<string | undefined> {
  return tx(factory, 'readonly', (s) => s.get('connect-code') as IDBRequest<string | undefined>)
}

export async function setConnectCode(code: string | null, factory: IDBFactory = indexedDB): Promise<void> {
  await tx<unknown>(factory, 'readwrite', (s) => (code ? s.put(code, 'connect-code') : s.delete('connect-code')) as IDBRequest<unknown>)
}

export function getSyncState(factory: IDBFactory = indexedDB): Promise<SyncState | undefined> {
  return tx(factory, 'readonly', (s) => s.get('sync') as IDBRequest<SyncState | undefined>)
}

export async function setSyncState(state: SyncState | null, factory: IDBFactory = indexedDB): Promise<void> {
  await tx<unknown>(factory, 'readwrite', (s) => (state ? s.put(state, 'sync') : s.delete('sync')) as IDBRequest<unknown>)
}

/** 서비스워커: 새 구독을 마지막 일정과 함께 서버에 다시 등록 */
export async function saveSubscription(sub: PushSubscription, oldEndpoint?: string, factory: IDBFactory = indexedDB) {
  const state = await getSyncState(factory)
  if (!state) return
  await putSubscription(state.config, sub.toJSON(), state.plan, oldEndpoint)
}
