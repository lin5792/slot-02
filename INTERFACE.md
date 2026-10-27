# 본체 ↔ 알림·캘린더 인터페이스 (v1, 2026-10-27)

본체 코드: `/mnt/project-files/habit-quest/` (저장소 생기면 같은 저장소로 합침)

변경 이력: v1.1 Block에 kind? 추가 (선택 필드, 호환됨)

## 타입
`src/domain/types.ts` 가 원본이다. 알림 쪽은 여기서 import 한다.
- `Block`: id, layer('L0'|'L1'|'L3'), title, start/end(HH:mm, end<start면 자정 넘김), weekdays(0=일…6=토), kind?('sleep'|'buffer'), habitId?(있으면 그 습관의 앵커 블록)
- `CalendarEvent` (L2): id, title, date(YYYY-MM-DD), start?/end?(비우면 종일), place?, prep?, status, source('manual'|'ics'), externalId?(ICS UID)
- `Habit`: id, title, tiers{min,basic,best}, intention{anchorEvent,place,action}, ifThen[], anchorTime?, backstopTime, startDate, status('draft'|'active'|'settled'|'paused'), extensions
- `DayLog`: habitId, date, tier('min'|'basic'|'best'), cardId?, minutes?, memo?, loggedAt. 기록 없음 = 안 함

## IndexedDB (SW가 원시 IDB로 읽음)
- DB 이름 `habit-quest`, Dexie version 1 → **원시 IDB 버전 10**. SW에서는 `indexedDB.open('habit-quest')` 처럼 버전 없이 열 것 (업그레이드를 일으키지 않게).
- 스토어 (keyPath / 인덱스):
  - `habits` keyPath `id`, 인덱스 `status` → 활성 습관 = `index('status').get('active')`
  - `logs` keyPath `['habitId','date']`, 인덱스 `habitId`, `date` → 오늘 기록 = `store.get([habitId, 'YYYY-MM-DD'])`
  - `blocks` keyPath `id`, 인덱스 `layer`, `habitId`
  - `events` keyPath `id`, 인덱스 `date`, `externalId`
  - `settings` keyPath `key`, 행 하나 `{key:'main', bedtime:'HH:mm', ...}`
  - 그 외 `measurements`, `reviews`, `srbai` (알림엔 불필요)
- 스키마 상수: `src/db/schema.ts`

## 서비스워커 소유
본체가 `src/sw.ts` 소유 (vite-plugin-pwa `injectManifest`, srcDir `src`, filename `sw.ts`).
본체 sw.ts는 `import { registerPushHandlers } from './notify/sw-push'` 후 `registerPushHandlers(self)` 호출.
`src/notify/sw-push.ts` 는 지금 빈 스텁이며 알림 스레드가 교체한다. `src/notify/` 폴더 전체가 알림 스레드 소유.

## 본체가 알림 모듈에 제공하는 함수 (src/notify 에서 import)
- `src/domain/time.ts`: `todayISO()`, `weekdayOf(date)`, `addDays(date, n)`
- `src/domain/progress.ts`: `computeProgress(habit, logs, today)` → 콤보·실드·XP·챕터·남은 날
- `src/db/queries.ts`: `getActiveHabit()`, `getLog(habitId, date)`, `listBlocks()`, `upsertEventsFromIcs(events: CalendarEvent[])` (externalId 기준 upsert)

## 알림 모듈에 기대하는 것
- 본체 설정 화면이 호출할 함수: `src/notify/index.ts` 에서 `NOTIFY_READY`(true로 바꾸면 버튼 활성화), `buildIcs(blocks, habit, settings): string`, `requestNotificationPermission(): Promise<NotificationPermission>`, `scheduleLocalReminders(habit, settings): Promise<void>` (이름은 알림 쪽이 바꿔도 됨, 바꾸면 알려주기)
- 캘린더 가져오기: `parseIcs(text): CalendarEvent[]` (source 'ics', externalId=UID). 본체 설정 화면이 결과를 `upsertEventsFromIcs`에 넘긴다
