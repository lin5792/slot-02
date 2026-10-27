import { buildPushPayload as encryptForPush } from '@block65/webcrypto-web-push'
import { fallbackNotification } from '../../src/notify/messages'
import { buildPushPayload, type ReminderData } from '../../src/notify/payload'
import type { DueReminder, ReminderPlan } from '../../src/notify/schedule'
import type { StoredSubscription } from './state'

export interface PushEnv {
  /** base64url, 65바이트 비압축 P-256 공개키 (앱 VITE_VAPID_PUBLIC_KEY 와 같은 값) */
  VAPID_PUBLIC_KEY: string
  /** base64url, P-256 개인키 d 값 */
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  APP_URL: string
}

export type SendOutcome = 'sent' | 'gone' | 'failed'

export function reminderData(plan: ReminderPlan, due: DueReminder): ReminderData {
  return {
    kind: due.item.kind,
    habitId: plan.habitId,
    questDate: due.questDate,
    habitTitle: plan.habitTitle,
    minTier: plan.minTier,
    anchor: plan.anchor,
  }
}

export async function sendReminder(env: PushEnv, sub: StoredSubscription, data: ReminderData): Promise<SendOutcome> {
  const fallback = fallbackNotification(data.kind, data.habitTitle, data.minTier, data.anchor)
  const payload = buildPushPayload(data, fallback, env.APP_URL)
  // RFC 8291 aes128gcm + RFC 8292 VAPID. 애플 푸시 서비스는 예전 aesgcm 방식을 받지 않는다
  const req = await encryptForPush(
    {
      data: payload as never,
      // 30분 넘게 늦은 알림은 의미가 없다. 같은 topic의 미배달 알림은 새 것으로 바뀐다
      options: { ttl: 30 * 60, urgency: data.kind === 'weekly' ? 'normal' : 'high', topic: data.kind },
    },
    { endpoint: sub.subscription.endpoint, expirationTime: null, keys: sub.subscription.keys },
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  )
  const res = await fetch(sub.subscription.endpoint, req)
  if (res.status === 404 || res.status === 410) return 'gone' // 구독 만료·해지
  return res.ok ? 'sent' : 'failed'
}
