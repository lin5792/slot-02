// 앱(창) 쪽 알림 설정: 지원 여부 판단, 권한 요청, 푸시 구독과 일정 동기화.
//
// 웹에는 "정해진 시각에 로컬 알림 예약" API가 없다 (Chrome Notification Triggers는 개발 중단).
// 그래서 정시 알림은 (1) 캘린더 알람(.ics) 또는 (2) 서버가 정시에 보내는 웹 푸시 두 길뿐이다.
// 이 파일은 (2)를 담당하고, 서버 설정이 없으면 캘린더만 쓰는 모드로 알려준다.

import type { Habit, Settings } from '../domain/types'
import { deleteSubscription, putSubscription, sendTestPush, type PushServerConfig } from './push-api'
import { getSyncState, setSyncState } from './push-store'
import { buildReminderPlan, type ReminderPlan } from './schedule'
import { deviceTimeZone, localTodayISO } from './dates'

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: 'no-service-worker' | 'no-push' | 'ios-needs-home-screen' | 'not-configured' }

export type ReminderSyncReason =
  | Extract<PushSupport, { ok: false }>['reason']
  | 'permission-denied'
  | 'no-active-habit'

export interface ReminderSyncResult {
  /** push: 서버 푸시 등록됨. calendar-only: 캘린더 알람만 쓴다 */
  mode: 'push' | 'calendar-only'
  reason?: ReminderSyncReason
  plan?: ReminderPlan
}

/** Vite 환경변수에서 푸시 서버 설정을 읽는다. 하나라도 비면 null */
export function configFromEnv(
  env: Record<string, string | undefined> = (import.meta as { env?: Record<string, string | undefined> }).env ?? {},
): PushServerConfig | null {
  const serverUrl = env.VITE_PUSH_SERVER_URL
  const apiToken = env.VITE_PUSH_API_TOKEN
  const vapidPublicKey = env.VITE_VAPID_PUBLIC_KEY
  return serverUrl && apiToken && vapidPublicKey ? { serverUrl, apiToken, vapidPublicKey } : null
}

function isIOS(nav: Navigator): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
}

function isStandalone(win: Window): boolean {
  return (
    win.matchMedia?.('(display-mode: standalone)').matches ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * iOS·iPadOS 16.4+는 홈 화면에 추가한 웹 앱에서만 웹 푸시가 된다.
 * https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
 */
export function getPushSupport(win: Window = window, config = configFromEnv()): PushSupport {
  if (!config) return { ok: false, reason: 'not-configured' }
  if (!('serviceWorker' in win.navigator)) return { ok: false, reason: 'no-service-worker' }
  if (isIOS(win.navigator) && !isStandalone(win)) return { ok: false, reason: 'ios-needs-home-screen' }
  if (!('PushManager' in win) || !('Notification' in win)) return { ok: false, reason: 'no-push' }
  return { ok: true }
}

/** 반드시 사용자의 탭(클릭) 처리 안에서 불러야 한다. iOS는 제스처 없이 요청하면 거절한다 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function ensureSubscription(config: PushServerConfig): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(config.vapidPublicKey),
  })
}

export interface SyncOptions {
  weeklyReviewTime?: string
  config?: PushServerConfig | null
}

/**
 * 활성 습관의 알림 일정을 푸시 서버에 등록한다. 습관·백스톱 시각이 바뀔 때마다 다시 부르면 된다.
 * 권한이 아직 없으면 요청하므로, 처음 한 번은 사용자 탭 안에서 부른다.
 */
export async function syncReminders(
  habit: Habit | null | undefined,
  _settings?: Settings,
  opts: SyncOptions = {},
): Promise<ReminderSyncResult> {
  const config = opts.config === undefined ? configFromEnv() : opts.config
  const support = getPushSupport(window, config)
  if (!support.ok) return { mode: 'calendar-only', reason: support.reason }
  const plan = buildReminderPlan(habit, {
    timeZone: deviceTimeZone(),
    today: localTodayISO(),
    weeklyReviewTime: opts.weeklyReviewTime,
  })
  if (!plan) {
    await disableReminders(config!)
    return { mode: 'calendar-only', reason: 'no-active-habit' }
  }
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return { mode: 'calendar-only', reason: 'permission-denied', plan }
  const sub = await ensureSubscription(config!)
  await putSubscription(config!, sub.toJSON(), plan)
  await setSyncState({ config: config!, plan })
  return { mode: 'push', plan }
}

/** 인터페이스 v1 이름. 웹에는 로컬 예약이 없어서 실제로는 서버 푸시 등록이다 */
export const scheduleLocalReminders = syncReminders

export async function disableReminders(config = configFromEnv()): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub && config) await deleteSubscription(config, sub.endpoint).catch(() => undefined)
  await sub?.unsubscribe()
  await setSyncState(null)
}

export async function sendTestReminder(config = configFromEnv()): Promise<boolean> {
  const state = await getSyncState()
  const reg = await navigator.serviceWorker?.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  const cfg = config ?? state?.config
  if (!sub || !cfg) return false
  await sendTestPush(cfg, sub.endpoint)
  return true
}
