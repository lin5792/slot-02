# 푸시 서버 (Cloudflare Worker)

습관 앱의 정시 알림(퀘스트 리마인더, 백스톱, 주간 정비)을 웹 푸시로 보내고, 캘린더 구독 주소를 내준다.
Cloudflare Workers **무료 플랜** 안에서 동작한다: 매 분 cron(무료 5개 중 1개), KV 읽기 하루 1,440회(무료 10만), 쓰기는 알림을 보낼 때만.
([Workers 한도](https://developers.cloudflare.com/workers/platform/limits/), [KV 한도](https://developers.cloudflare.com/kv/platform/limits/))

## API

| 경로 | 설명 |
|---|---|
| `PUT /api/subscription` | `{subscription, plan, replacesEndpoint?}` 구독과 알림 일정 등록 (Bearer API_TOKEN) |
| `DELETE /api/subscription` | `{endpoint}` 해지 |
| `POST /api/test` | `{endpoint}` 테스트 알림 |
| `PUT /api/calendar` | .ics 본문 저장 → `{url, webcal}` 구독 주소 |
| `GET /cal/<CAL_TOKEN>.ics` | 캘린더 구독 (토큰이 맞아야 함) |
| `POST /api/ics-proxy` | `{url}` 구글·iCloud·Outlook 비공개 iCal 주소만 대신 받아옴 (CORS 우회) |
| cron `* * * * *` | 예정 시각부터 10분 안이면 보냄, 같은 날 두 번 안 보냄, 410/404면 구독 삭제, 실패는 다음 분 재시도 |

## 배포 (마스터가 할 일, 15분)

```bash
cd worker
npm install
npx wrangler login                          # Cloudflare 무료 계정으로 로그인
npx wrangler kv namespace create STATE      # 나온 id를 wrangler.toml의 id에 넣기
npm run vapid                               # VAPID 키 한 쌍 출력
```

1. `wrangler.toml`의 `[vars]` 채우기: `APP_URL`(앱 주소, 끝에 `/`), `VAPID_SUBJECT`(mailto:본인메일), `VAPID_PUBLIC_KEY`(위 출력)
2. 시크릿 넣기 (값은 프롬프트에 붙여넣기)
   ```bash
   npx wrangler secret put VAPID_PRIVATE_KEY   # 위 출력의 개인키
   npx wrangler secret put API_TOKEN           # 아무 긴 랜덤 문자열 (node -e "console.log(crypto.randomBytes(24).toString('base64url'))")
   npx wrangler secret put CAL_TOKEN           # 다른 긴 랜덤 문자열
   ```
3. `npm run deploy` → `https://habit-quest-push.<계정>.workers.dev` 주소가 나온다
4. 앱 루트 `.env.local`에 `VITE_PUSH_SERVER_URL`, `VITE_PUSH_API_TOKEN`, `VITE_VAPID_PUBLIC_KEY` 넣고 앱 다시 빌드·배포

## 알아둘 점

- `API_TOKEN`은 앱 번들 안에 들어간다. 앱이 공개 주소에 있으면 누군가 읽어서 구독을 추가하거나 구독 캘린더를 덮어쓸 수 있다. 개인용이라 위험은 작지만, 걱정되면 토큰을 바꾸고(`wrangler secret put API_TOKEN`) 앱을 다시 배포하면 된다.
- 개인용(기기 1~3대) 기준으로 상태를 KV 키 하나에 둔다. 여러 사람이 쓰려면 구독별 키나 D1로 바꿔야 한다.

## 테스트

```bash
npm test        # 실제 aes128gcm 암호문을 RFC 8291대로 복호화하고, VAPID 서명을 공개키로 검증한다
npm run typecheck
npx wrangler deploy --dry-run --outdir /tmp/wr   # 배포 번들만 만들어 보기
```
