# CLAUDE.md — habit-quest

> 슬롯 상태: 사용 중 — habit-quest · 2026-10-27
> 희망 레포 이름: habit-quest
>
> claude.ai/code 클라우드는 GitHub 레포를 만들지 못한다. 그래서 빈 private 레포(슬롯)를 미리 만들어 두고,
> 웹 세션이 하나를 잡아 새 프로젝트로 쓴다. 공통 규칙은 `.claude/rules/공통.md`.

## 목적

하루를 시간 계층(L0 고정 → L1 필수 → L2 이벤트 → L3 희망)으로 쌓고, 습관 하나를 66일 퀘스트로 정착시키는 모바일 우선 PWA.
설계·규칙 요약은 `README.md`, 알림 모듈과의 계약은 `INTERFACE.md`.

## 작업 규칙

- 저장하는 사실은 하루 기록뿐이고 XP·콤보·실드는 `src/domain/progress.ts`가 매번 계산한다. 규칙을 바꾸면 `src/domain/rules.ts`, `progress.ts`, 테스트를 함께 고친다.
- IndexedDB 스키마(`src/db/schema.ts`)는 서비스워커가 원시 API로 읽는다. 스토어를 바꾸면 버전을 올리고 `src/notify/idb-read.ts`도 확인한다.
- 하루 경계는 04:00 (`DAY_START_HOUR`, `src/notify/dates.ts`의 `DAY_BOUNDARY`와 같아야 한다).
- `main`에 push하면 GitHub Pages로 배포된다 (`.github/workflows/deploy.yml`). 검증: `npm test`, `npm run build`.
