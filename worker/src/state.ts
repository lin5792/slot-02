// KV에 상태를 키 하나로 둔다. 개인용(기기 1~3대)이라 이게 가장 싸다:
// 매 분 cron이 읽기 1회(무료 하루 10만 회), 쓰기는 알림을 보낼 때만(하루 몇 회, 무료 1천 회).

import type { ISODate } from '../../src/domain/types'
import type { ReminderPlan } from '../../src/notify/schedule'

export interface StoredSubscription {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  plan: ReminderPlan
  /** itemId → 마지막으로 보낸 퀘스트 날짜 */
  sent: Record<string, ISODate>
  updatedAt: number
}

export interface State {
  subs: Record<string, StoredSubscription>
}

export interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

const STATE_KEY = 'state'
const CALENDAR_KEY = 'calendar'

export async function loadState(kv: KVLike): Promise<State> {
  const raw = await kv.get(STATE_KEY)
  return raw ? (JSON.parse(raw) as State) : { subs: {} }
}

export async function saveState(kv: KVLike, state: State): Promise<void> {
  await kv.put(STATE_KEY, JSON.stringify(state))
}

export const loadCalendar = (kv: KVLike) => kv.get(CALENDAR_KEY)
export const saveCalendar = (kv: KVLike, ics: string) => kv.put(CALENDAR_KEY, ics)

export async function subscriptionId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return [...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
