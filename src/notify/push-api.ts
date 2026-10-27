// 푸시 서버(worker/) HTTP API 클라이언트. 앱과 서비스워커가 같이 쓴다.

import type { ReminderPlan } from './schedule'

export interface PushServerConfig {
  /** 예: https://habit-quest-push.<계정>.workers.dev */
  serverUrl: string
  /** 연결 코드 = 서버 API_TOKEN. 공개 번들에 넣지 않고 사용자가 기기마다 한 번 입력해 로컬에만 둔다 */
  apiToken: string
  /** VAPID 공개키 (base64url) */
  vapidPublicKey: string
}

async function call(config: PushServerConfig, path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(new URL(path, config.serverUrl), {
    ...init,
    headers: { authorization: `Bearer ${config.apiToken}`, 'content-type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`푸시 서버 ${path} 실패: ${res.status} ${await res.text().catch(() => '')}`)
  return res
}

/** 연결 코드가 맞는지 확인 */
export async function pingServer(config: PushServerConfig): Promise<void> {
  await call(config, '/api/ping', { method: 'GET' })
}

export async function putSubscription(
  config: PushServerConfig,
  subscription: PushSubscriptionJSON,
  plan: ReminderPlan,
  replacesEndpoint?: string,
): Promise<void> {
  await call(config, '/api/subscription', {
    method: 'PUT',
    body: JSON.stringify({ subscription, plan, replacesEndpoint }),
  })
}

export async function deleteSubscription(config: PushServerConfig, endpoint: string): Promise<void> {
  await call(config, '/api/subscription', { method: 'DELETE', body: JSON.stringify({ endpoint }) })
}

/** 지금 바로 테스트 알림 한 통 */
export async function sendTestPush(config: PushServerConfig, endpoint: string): Promise<void> {
  await call(config, '/api/test', { method: 'POST', body: JSON.stringify({ endpoint }) })
}

/** 캘린더 구독용 .ics를 서버에 올리고 구독 주소를 받는다 */
export async function publishCalendar(config: PushServerConfig, ics: string): Promise<{ url: string; webcal: string }> {
  const res = await call(config, '/api/calendar', {
    method: 'PUT',
    headers: { 'content-type': 'text/calendar; charset=utf-8' },
    body: ics,
  })
  return (await res.json()) as { url: string; webcal: string }
}

/** 구글·iCloud·Outlook 비공개 iCal 주소의 내용을 서버를 거쳐 받아온다 */
export async function fetchIcsViaServer(config: PushServerConfig, calendarUrl: string): Promise<string> {
  const res = await call(config, '/api/ics-proxy', { method: 'POST', body: JSON.stringify({ url: calendarUrl }) })
  return res.text()
}
