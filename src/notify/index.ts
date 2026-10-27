// 알림·캘린더 모듈의 공개 API. 본체 설정 화면은 여기서만 import 한다.

import type { CalendarEvent } from '../domain/types'

import { parseIcsEvents, type ImportOptions } from './ics-read'
import { fetchIcsViaServer } from './push-api'
import { configFromEnv } from './push-client'

export { buildIcs, downloadIcs, type IcsOptions } from './ics-write'
export { parseIcsEvents, type ImportOptions } from './ics-read'
export {
  getPushSupport,
  requestNotificationPermission,
  syncReminders,
  scheduleLocalReminders,
  disableReminders,
  sendTestReminder,
  configFromEnv,
  type PushSupport,
  type ReminderSyncResult,
  type ReminderSyncReason,
} from './push-client'
export { publishCalendar, type PushServerConfig } from './push-api'
export { buildReminderPlan, type ReminderPlan, type ReminderItem } from './schedule'

/** 알림 모듈이 실제 구현으로 붙었는지 (본체 설정 화면이 버튼을 켤 때 본다) */
export const NOTIFY_READY = true

/** .ics 텍스트 → L2 일정 (오늘부터 90일, 반복 일정은 회차로 펼침) */
export function parseIcs(text: string, opts?: ImportOptions): CalendarEvent[] {
  return parseIcsEvents(text, opts)
}

/** .ics 텍스트를 L2 일정으로 가져와 본체 DB에 넣는다. 새로 추가된 개수를 돌려준다 */
export async function importIcs(text: string, opts?: ImportOptions): Promise<number> {
  const { upsertEventsFromIcs } = await import('../db/queries')
  return upsertEventsFromIcs(parseIcsEvents(text, opts))
}

/**
 * 구글 캘린더 "iCal 형식의 비공개 주소" 같은 구독 주소에서 일정을 가져온다.
 * 브라우저는 CORS 때문에 직접 못 받으므로 푸시 서버가 있어야 한다. 없으면 파일 가져오기(importIcs)를 쓴다.
 */
export async function importIcsFromUrl(calendarUrl: string, opts?: ImportOptions): Promise<number> {
  const config = configFromEnv()
  if (!config) throw new Error('푸시 서버가 설정되지 않아 주소로 가져올 수 없습니다. .ics 파일로 가져오세요.')
  return importIcs(await fetchIcsViaServer(config, calendarUrl), opts)
}
