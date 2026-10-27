// 서비스워커 푸시 처리. 본체 src/sw.ts가 registerPushHandlers(self)를 호출한다.
// iOS Safari는 푸시를 받고 알림을 띄우지 않으면(무음 푸시) 몇 번 만에 구독을 끊으므로,
// 어떤 경우에도 event.waitUntil 안에서 showNotification을 반드시 한 번 호출한다.

import { composeNotification, type NotificationContent, type NotifyStatus } from './messages'
import { openExistingDb, readStatus } from './idb-read'
import { parsePushPayload, type ReminderData } from './payload'
import { localTodayISO } from './dates'
import { saveSubscription } from './push-store'

/* lib.webworker 없이 컴파일되도록 쓰는 부분만 구조적으로 선언한다 */
interface ExtendableEventLike extends Event {
  waitUntil(p: Promise<unknown>): void
}
interface PushEventLike extends ExtendableEventLike {
  data: { json(): unknown; text(): string } | null
}
interface NotificationEventLike extends ExtendableEventLike {
  notification: Notification
}
interface PushSubscriptionChangeEventLike extends ExtendableEventLike {
  newSubscription?: PushSubscription | null
  oldSubscription?: PushSubscription | null
}
interface WindowClientLike {
  url: string
  focus(): Promise<unknown>
  navigate?(url: string): Promise<unknown>
}
export interface SwScope {
  location: { origin: string }
  registration: ServiceWorkerRegistration
  clients: {
    matchAll(o: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>
    openWindow(url: string): Promise<unknown>
  }
  addEventListener(type: string, listener: (e: Event) => void): void
  indexedDB?: IDBFactory
}

export interface PushDeps {
  /** 오늘 기록 읽기. 기본은 본체 IndexedDB */
  getStatus(data: ReminderData): Promise<NotifyStatus | null>
}

export function defaultDeps(scope: SwScope): PushDeps {
  return {
    async getStatus(data) {
      const db = await openExistingDb(scope.indexedDB ?? indexedDB)
      if (!db) return null
      try {
        return await readStatus(db, data.habitId, data.questDate)
      } finally {
        db.close()
      }
    },
  }
}

export async function handlePush(scope: SwScope, raw: unknown, deps: PushDeps): Promise<void> {
  const payload = parsePushPayload(raw)
  let content: NotificationContent
  if (!payload) {
    content = { title: '퀘스트 알림', body: '오늘 퀘스트를 확인하세요.', tag: 'quest', silent: false, url: './' }
  } else {
    const data = payload.notification.data
    content = {
      title: payload.notification.title,
      body: payload.notification.body,
      tag: payload.notification.tag,
      silent: payload.notification.silent,
      url: payload.notification.navigate,
    }
    if (data?.kind) {
      try {
        const status = await deps.getStatus({ ...data, questDate: data.questDate ?? localTodayISO() })
        content = composeNotification({ ...data, status })
      } catch {
        // 기록을 못 읽으면 서버가 보낸 기본 문구(백스톱 기준)를 그대로 쓴다
      }
    }
  }
  const done = content.silent
  const base = scope.registration.scope ?? scope.location.origin + '/'
  await scope.registration.showNotification(content.title, {
    body: content.body,
    tag: content.tag,
    silent: content.silent,
    data: { url: new URL(content.url, base).toString() },
    icon: new URL('pwa-192.png', base).toString(),
    lang: 'ko',
  })
  const nav = scope.registration as unknown as { setAppBadge?: (n?: number) => Promise<void> } & {
    clearAppBadge?: () => Promise<void>
  }
  try {
    if (done) await nav.clearAppBadge?.()
    else await nav.setAppBadge?.(1)
  } catch {
    /* Badging API가 없는 브라우저 */
  }
}

export async function handleNotificationClick(scope: SwScope, notification: Notification): Promise<void> {
  notification.close()
  const url: string = (notification.data as { url?: string } | null)?.url ?? scope.registration.scope
  const wins = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const same = wins.find((w) => new URL(w.url).origin === scope.location.origin)
  if (same) {
    await same.navigate?.(url).catch(() => undefined)
    await same.focus()
    return
  }
  await scope.clients.openWindow(url)
}

export function registerPushHandlers(scope: SwScope, deps: PushDeps = defaultDeps(scope)): void {
  scope.addEventListener('push', ((event: PushEventLike) => {
    let raw: unknown = null
    try {
      raw = event.data?.json() ?? null
    } catch {
      raw = null
    }
    event.waitUntil(handlePush(scope, raw, deps))
  }) as unknown as (e: Event) => void)

  scope.addEventListener('notificationclick', ((event: NotificationEventLike) => {
    event.waitUntil(handleNotificationClick(scope, event.notification))
  }) as unknown as (e: Event) => void)

  // 구독이 갱신되면 서버에 새 구독을 다시 등록한다 (Chrome·Firefox. Safari는 아직 이 이벤트가 드물다)
  scope.addEventListener('pushsubscriptionchange', ((event: PushSubscriptionChangeEventLike) => {
    event.waitUntil(
      (async () => {
        const sub = event.newSubscription ?? (await scope.registration.pushManager.getSubscription())
        if (sub) await saveSubscription(sub, event.oldSubscription?.endpoint)
      })().catch(() => undefined),
    )
  }) as unknown as (e: Event) => void)
}
