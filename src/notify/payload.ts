// 푸시 메시지 형식. Declarative Web Push(WebKit, iOS/iPadOS 18.4+) 형식을 그대로 쓴다.
// 이 형식이면 서비스워커가 실패해도 브라우저가 notification을 대신 띄우고,
// 서비스워커가 있으면 push 이벤트에서 오늘 기록을 보고 문구를 바꿔 다시 띄운다.
// https://webkit.org/blog/16535/meet-declarative-web-push/

import type { ISODate } from '../domain/types'
import type { NotificationContent } from './messages'
import type { ReminderKind } from './schedule'

export interface ReminderData {
  kind: ReminderKind
  habitId: string
  questDate: ISODate
  habitTitle: string
  minTier: string
  anchor: string
}

export interface DeclarativePushPayload {
  web_push: 8030
  /** 서비스워커가 내용을 바꿀 수 있게 한다 (W3C Push API declarative 초안의 mutable) */
  mutable: true
  notification: {
    title: string
    body: string
    tag: string
    silent: boolean
    navigate: string
    lang: 'ko'
    data: ReminderData
  }
}

/** appUrl: 앱 주소(하위 경로 포함, 끝에 /). 알림 문구의 상대 경로를 여기에 붙인다 */
export function buildPushPayload(data: ReminderData, fallback: NotificationContent, appUrl: string): DeclarativePushPayload {
  return {
    web_push: 8030,
    mutable: true,
    notification: {
      title: fallback.title,
      body: fallback.body,
      tag: fallback.tag,
      silent: fallback.silent,
      navigate: new URL(fallback.url, appUrl).toString(),
      lang: 'ko',
      data,
    },
  }
}

export function parsePushPayload(raw: unknown): DeclarativePushPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Partial<DeclarativePushPayload>
  const n = p.notification
  if (!n || typeof n.title !== 'string') return null
  return p as DeclarativePushPayload
}
