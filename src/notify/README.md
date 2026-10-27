# 알림 · 캘린더 모듈 (`src/notify`)

설계 문서 v0의 "예외 없이" 장치 중 알림 계층이다. 퀘스트 리마인더, 잠들기 전 백스톱 알람, 고정·필수 블록을 캘린더와 잇는다.

## 왜 이렇게 만들었나: 웹 알림의 제약

| 제약 | 근거 | 그래서 |
|---|---|---|
| 웹에는 "정해진 시각에 로컬 알림 예약" API가 없다. Chrome의 Notification Triggers는 개발이 끝났다(중단). | [Chrome for Developers: Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers) | 정시 알림은 **캘린더 알람** 또는 **서버가 정시에 보내는 웹 푸시** 두 길뿐이다. |
| iOS·iPadOS 16.4+는 **홈 화면에 추가한 웹 앱**에서만 웹 푸시가 된다. 권한 요청은 사용자의 탭 안에서만. | [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) | 설정 화면이 iOS 브라우저 탭이면 "홈 화면에 추가"를 안내한다. |
| Safari는 푸시를 받고 알림을 안 띄우면(무음 푸시) 몇 번 만에 구독을 끊는다. `event.waitUntil`로 붙잡아야 한다. | [Progressier: iOS 구독이 3번 만에 끊기는 문제](https://dev.to/progressier/how-to-fix-ios-push-subscriptions-being-terminated-after-3-notifications-39a7) | "이미 했으면 알림 생략"은 못 한다. 대신 같은 tag로 **조용한 완료 알림**으로 바꿔 띄운다. |
| iOS 18.4+ Declarative Web Push: `web_push: 8030` 형식이면 서비스워커가 실패해도 브라우저가 대신 띄운다. 서비스워커가 다른 알림을 띄우면 그걸 쓴다. | [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) | 서버는 이 형식으로 보내고(기본 문구 = 백스톱), 서비스워커가 오늘 기록을 읽어 문구를 바꾼다. |
| 애플 푸시 서비스는 예전 `aesgcm` 암호화를 받지 않는다. RFC 8291 `aes128gcm` + RFC 8292 VAPID가 필요하다. | [@block65/webcrypto-web-push README](https://www.npmjs.com/package/@block65/webcrypto-web-push), RFC 8291/8292 | 서버는 aes128gcm 라이브러리를 쓰고, 테스트에서 직접 복호화해 검증한다. |
| iPhone 구독 캘린더는 "알람 제거" 옵션을 끄면 .ics 알람이 울린다. 구글 캘린더 구독(URL)은 갱신이 최대 하루 늦고, .ics 안 알람(VALARM) 처리는 공식 문서에 없다. | [Hebcal: iPhone Remove Alarms](https://hebcal.com/home/?p=563), [OneCal: 구글 URL 구독](https://www.onecal.io/blog/how-to-subscribe-to-a-web-ics-calendar-in-google-calendar) | 알람의 1차 경로는 iPhone 캘린더 구독이나 .ics 가져오기. 구글은 그 캘린더의 기본 알림을 켜는 걸 권한다. |

## 두 겹 안전망

1. **캘린더 알람 (서버 없이 항상)**: `buildIcs()`가 만든 .ics를 캘린더에 넣으면 앱이 꺼져 있어도 울린다.
   - L0·L1·L3 반복 블록 (주간 RRULE, 알람 없음, 습관 앵커 블록은 퀘스트 리마인더와 겹쳐서 뺌)
   - 퀘스트 리마인더 (`anchorTime`이 있을 때, 66일 + 연장분 매일, 정시 알람)
   - 백스톱 (매일 `backstopTime`, 정시 + 15분 뒤 두 번)
   - 주간 정비 (일요일 20:00), 챕터 보스 (22·44·66일째 종일, 아침 9시)
2. **웹 푸시 (푸시 서버가 있을 때)**: 서버(`worker/`)가 매 분 일정을 보고 정시에 푸시. 서비스워커가 오늘 기록을 읽어
   - 안 했으면: `🛡️ 백스톱: 콤보 N일이 오늘 밤 끊겨요 / 지금 그 자리에서 2분: {최소}`
   - 했으면: `🌙 오늘 기록 완료 · 콤보 N일` (소리 없이, 같은 tag라 앞 알림을 덮음)

04:00 전 알림(예: 00:10 백스톱)은 전날 퀘스트로 센다 (`DAY_BOUNDARY`).

## 파일

| 파일 | 하는 일 |
|---|---|
| `index.ts` | 공개 API (`NOTIFY_READY`, `buildIcs`, `parseIcs`, `requestNotificationPermission`, `scheduleLocalReminders` = `syncReminders`, …) |
| `NotifyPanel.tsx` | 설정 화면 카드. 상태·이유 표시, 정시 알림 켜기/테스트/끄기, .ics 내보내기, 구독 주소, 가져오기 |
| `ics-write.ts` | .ics 만들기 (RFC 5545: CRLF, 75옥텟 접기, 이스케이프, 고정 오프셋 VTIMEZONE) |
| `ics-read.ts` | .ics 가져오기 → `CalendarEvent[]` (ical.js로 반복 전개·EXDATE·예외 회차·시각대) |
| `schedule.ts` | 알림 일정 `ReminderPlan`과 `dueReminders()` (앱·서버 공용, 브라우저 API 없음) |
| `messages.ts` | 기록 유무에 따른 알림 문구 |
| `payload.ts` | Declarative Web Push 메시지 형식 |
| `sw-push.ts` | 서비스워커 push / notificationclick / pushsubscriptionchange |
| `idb-read.ts` | 서비스워커에서 본체 DB를 버전 없이 읽기 (DB가 없으면 만들지 않음) |
| `push-client.ts`, `push-api.ts`, `push-store.ts` | 지원 판단, 권한, 구독, 서버 API, 별도 DB(`habit-quest-notify`)에 서버 설정 보관 |

## 환경변수 (푸시 서버를 쓸 때만, `.env.local`)

```
VITE_PUSH_SERVER_URL=https://habit-quest-push.<계정>.workers.dev
VITE_PUSH_API_TOKEN=<worker API_TOKEN과 같은 값>
VITE_VAPID_PUBLIC_KEY=<worker VAPID_PUBLIC_KEY와 같은 값>
```

비어 있으면 캘린더 알람만 쓰는 모드로 동작한다. 서버 배포는 `worker/README.md`.

## 테스트

- `npm test`: ICS 왕복(ical.js로 다시 읽어 회차·시각 확인), 가져오기(구글 형식 샘플), 알림 일정, 서비스워커(fake-indexeddb)
- 실제 Chromium에서 DevTools `ServiceWorker.deliverPushMessage`로 푸시를 넣어 문구 전환·tag 교체·DB 미생성을 확인했다.
- 실제 푸시 서비스(APNs·FCM) 왕복과 iPhone 동작은 서버 배포 후 기기에서 확인해야 한다 (아래 체크리스트).

## 기기 확인 체크리스트

1. iPhone Safari로 앱 열기 → 공유 → 홈 화면에 추가 → 홈 화면 아이콘으로 열기
2. 설정 → 정시 알림 켜기 → 권한 허용 → 테스트 알림이 잠금 화면에 오는지
3. 오늘 기록 없이 백스톱 시각을 2분 뒤로 바꿔 두고 기다리기 → 백스톱 문구
4. 기록 후 다시 → 소리 없는 완료 문구
5. 구독 주소 만들기 → iPhone 캘린더에 구독 → 설정 > 캘린더 > 계정 > 구독한 캘린더에서 "알람 제거"가 꺼져 있는지
