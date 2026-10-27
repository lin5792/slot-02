// 스텁: 이 폴더는 "습관 앱 알림과 캘린더 연동" 작업이 소유하고 교체한다. 계약은 INTERFACE.md.
import type { Block, CalendarEvent, Habit, Settings } from '../domain/types'

/** 알림 모듈이 실제 구현으로 교체되면 true */
export const NOTIFY_READY = false

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in globalThis)) return 'denied'
  return Notification.requestPermission()
}

/** L0·L1 반복 블록과 퀘스트·백스톱 알람을 담은 .ics 텍스트 */
export function buildIcs(_blocks: Block[], _habit: Habit, _settings: Settings): string {
  throw new Error('알림 모듈 준비 중')
}

export async function scheduleLocalReminders(_habit: Habit, _settings: Settings): Promise<void> {}

/** .ics 텍스트 → L2 이벤트 */
export function parseIcs(_text: string): CalendarEvent[] {
  throw new Error('알림 모듈 준비 중')
}
