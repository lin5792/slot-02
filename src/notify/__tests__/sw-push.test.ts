import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDeps, handleNotificationClick, handlePush, registerPushHandlers, type SwScope } from '../sw-push'
import { buildPushPayload, type ReminderData } from '../payload'
import { fallbackNotification } from '../messages'
import { openExistingDb } from '../idb-read'
import type { DayLog } from '../../domain/types'

/** Dexie version 1 과 같은 모양의 본체 DB (원시 버전 10) */
async function seedBodyDb(factory: IDBFactory, logs: DayLog[]) {
  await new Promise<void>((resolve, reject) => {
    const r = factory.open('habit-quest', 10)
    r.onupgradeneeded = () => {
      const db = r.result
      db.createObjectStore('habits', { keyPath: 'id' }).createIndex('status', 'status')
      const l = db.createObjectStore('logs', { keyPath: ['habitId', 'date'] })
      l.createIndex('habitId', 'habitId')
      l.createIndex('date', 'date')
    }
    r.onsuccess = () => {
      const db = r.result
      const tx = db.transaction('logs', 'readwrite')
      for (const log of logs) tx.objectStore('logs').put(log)
      tx.oncomplete = () => (db.close(), resolve())
      tx.onerror = () => reject(tx.error)
    }
    r.onerror = () => reject(r.error)
  })
}

const log = (date: string, tier: DayLog['tier'] = 'min'): DayLog => ({ habitId: 'h1', date, tier, loggedAt: 0 })

function makeScope(factory: IDBFactory) {
  const shown: { title: string; options: NotificationOptions }[] = []
  const listeners: Record<string, (e: unknown) => void> = {}
  const scope: SwScope = {
    location: { origin: 'https://app.example' },
    registration: {
      scope: 'https://app.example/',
      showNotification: vi.fn(async (title: string, options: NotificationOptions) => void shown.push({ title, options })),
      setAppBadge: vi.fn(async () => {}),
      clearAppBadge: vi.fn(async () => {}),
    } as unknown as ServiceWorkerRegistration,
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => null) },
    addEventListener: (type, l) => void (listeners[type] = l as (e: unknown) => void),
    indexedDB: factory,
  }
  return { scope, shown, listeners }
}

const data = (kind: ReminderData['kind'], questDate = '2026-10-30'): ReminderData => ({
  kind,
  habitId: 'h1',
  questDate,
  habitTitle: '매일 운동',
  minTier: '스쿼트 10회',
  anchor: '퇴근 후 현관문을 닫으면 직후에 거실에서 운동복으로 갈아입는다',
})
const payloadFor = (d: ReminderData) =>
  buildPushPayload(d, fallbackNotification(d.kind, d.habitTitle, d.minTier, d.anchor), 'https://app.example')

describe('handlePush', () => {
  let factory: IDBFactory
  beforeEach(() => {
    factory = new IDBFactory()
  })

  it('안 했으면 콤보를 걸고 백스톱 문구를 소리 있게 띄운다', async () => {
    await seedBodyDb(factory, [log('2026-10-27'), log('2026-10-28'), log('2026-10-29')])
    const { scope, shown } = makeScope(factory)
    await handlePush(scope, payloadFor(data('backstop')), defaultDeps(scope))
    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe('🛡️ 백스톱: 콤보 3일이 오늘 밤 끊겨요')
    expect(shown[0].options).toMatchObject({ silent: false, tag: 'backstop', data: { url: 'https://app.example/?from=backstop' } })
    expect((scope.registration as unknown as Record<string, unknown>).setAppBadge).toHaveBeenCalledWith(1)
  })

  it('했으면 같은 tag로 조용한 완료 문구를 띄운다', async () => {
    await seedBodyDb(factory, [log('2026-10-29'), log('2026-10-30', 'basic')])
    const { scope, shown } = makeScope(factory)
    await handlePush(scope, payloadFor(data('backstop-final')), defaultDeps(scope))
    expect(shown[0].title).toBe('🌙 오늘 기록 완료 · 콤보 2일')
    expect(shown[0].options).toMatchObject({ silent: true, tag: 'backstop' })
    expect((scope.registration as unknown as Record<string, unknown>).clearAppBadge).toHaveBeenCalled()
  })

  it('퀘스트 리마인더: 안 했으면 앵커 문장', async () => {
    await seedBodyDb(factory, [])
    const { scope, shown } = makeScope(factory)
    await handlePush(scope, payloadFor(data('quest')), defaultDeps(scope))
    expect(shown[0].title).toBe('⚔️ 퀘스트 시간: 매일 운동')
    expect(shown[0].options.body).toContain('최소: 스쿼트 10회')
  })

  it('본체 DB가 없으면 만들지 않고 서버 기본 문구를 쓴다', async () => {
    const { scope, shown } = makeScope(factory)
    await handlePush(scope, payloadFor(data('backstop')), defaultDeps(scope))
    expect(shown[0].title).toBe('🛡️ 백스톱: 오늘을 1일차로 만들 기회')
    expect(await openExistingDb(factory)).toBeNull()
    const dbs = await factory.databases()
    expect(dbs.map((d) => d.name)).not.toContain('habit-quest')
  })

  it('기록 읽기가 실패해도, 형식이 깨진 푸시여도 알림은 반드시 띄운다', async () => {
    const { scope, shown } = makeScope(factory)
    await handlePush(scope, payloadFor(data('backstop')), { getStatus: async () => Promise.reject(new Error('x')) })
    await handlePush(scope, 'garbage', defaultDeps(scope))
    await handlePush(scope, null, defaultDeps(scope))
    expect(shown.map((s) => s.title)).toEqual(['🛡️ 백스톱: 오늘을 1일차로 만들 기회', '퀘스트 알림', '퀘스트 알림'])
  })
})

describe('registerPushHandlers', () => {
  it('push 이벤트를 waitUntil로 붙잡는다 (iOS 무음 푸시 차단 방지)', async () => {
    const { scope, listeners, shown } = makeScope(new IDBFactory())
    registerPushHandlers(scope)
    let pending: Promise<unknown> | undefined
    listeners.push({ data: { json: () => payloadFor(data('weekly')) }, waitUntil: (p: Promise<unknown>) => (pending = p) })
    expect(pending).toBeInstanceOf(Promise)
    await pending
    expect(shown[0].title).toBe('🗓️ 주간 정비 10분')
  })

  it('알림을 누르면 열린 창으로 이동하거나 새 창을 연다', async () => {
    const { scope } = makeScope(new IDBFactory())
    const note = { close: vi.fn(), data: { url: 'https://app.example/?from=backstop' } } as unknown as Notification
    await handleNotificationClick(scope, note)
    expect(scope.clients.openWindow).toHaveBeenCalledWith('https://app.example/?from=backstop')
    const win = { url: 'https://app.example/', focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) }
    scope.clients.matchAll = vi.fn(async () => [win])
    await handleNotificationClick(scope, note)
    expect(win.navigate).toHaveBeenCalledWith('https://app.example/?from=backstop')
    expect(win.focus).toHaveBeenCalled()
  })
})
