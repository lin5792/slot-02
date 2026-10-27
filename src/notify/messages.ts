// 알림 문구. 오늘 기록이 있는지에 따라 문구를 바꾼다 (서비스워커가 푸시를 받은 뒤 결정).

import type { Tier } from '../domain/types'
import { addDaysISO } from './dates'
import type { ReminderKind } from './schedule'

export interface NotifyStatus {
  /** 오늘 퀘스트 기록. null이면 아직 안 함 */
  tier: Tier | null
  /** 오늘까지(오늘 안 했으면 어제까지) 최소 퀘스트 연속일수 */
  combo: number
}

export interface NotifyContext {
  kind: ReminderKind
  habitTitle: string
  minTier: string
  anchor: string
  /** 기록을 못 읽었으면 null. 이때는 안 한 것으로 보고 백스톱 문구를 쓴다 */
  status: NotifyStatus | null
}

export interface NotificationContent {
  title: string
  body: string
  /** 같은 tag는 이전 알림을 덮어쓴다 */
  tag: string
  /** 이미 했을 때는 소리·진동 없이 조용히 */
  silent: boolean
  /** 눌렀을 때 열 화면. 앱 주소(서비스워커 scope) 기준 상대 경로 */
  url: string
}

const TIER_LABEL: Record<Tier, string> = { min: '최소', basic: '기본', best: '최고' }

export function composeNotification(ctx: NotifyContext): NotificationContent {
  const done = ctx.status?.tier != null
  const combo = ctx.status?.combo ?? 0
  const comboText = combo > 0 ? `콤보 ${combo}일` : '콤보 시작'
  switch (ctx.kind) {
    case 'quest':
      return done
        ? {
            title: `✅ 오늘 퀘스트 클리어 (${TIER_LABEL[ctx.status!.tier!]})`,
            body: `${comboText}. 더 하고 싶어도 상한에서 멈추면 내일이 더 기다려져요.`,
            tag: 'quest',
            silent: true,
            url: './',
          }
        : {
            title: `⚔️ 퀘스트 시간: ${ctx.habitTitle}`,
            body: [ctx.anchor, `최소: ${ctx.minTier}`].filter(Boolean).join(' · '),
            tag: 'quest',
            silent: false,
            url: './?from=quest',
          }
    case 'backstop':
    case 'backstop-final': {
      if (done) {
        return {
          title: `🌙 오늘 기록 완료 · ${comboText}`,
          body: '내일 운동복 꺼내두고 쉬세요.',
          tag: 'backstop',
          silent: true,
          url: './',
        }
      }
      const final = ctx.kind === 'backstop-final'
      const stake = combo > 0 ? `콤보 ${combo}일이 오늘 밤 끊겨요` : '오늘을 1일차로 만들 기회'
      return {
        title: final ? `⏰ 마지막 경고: ${stake}` : `🛡️ 백스톱: ${stake}`,
        body: `지금 그 자리에서 2분: ${ctx.minTier}. 하고 나서 기록 한 번.`,
        tag: 'backstop',
        silent: false,
        url: './?from=backstop',
      }
    }
    case 'weekly':
      return {
        title: '🗓️ 주간 정비 10분',
        body: '다음 주 근무·약속 확인, 놓친 날 if-then 하나 고치기, 실드 정산.',
        tag: 'weekly',
        silent: false,
        url: './?from=weekly',
      }
  }
}

/** 기록을 못 읽을 때(서버가 보내는 기본 문구, Declarative Web Push 대체 표시용) */
export function fallbackNotification(kind: ReminderKind, habitTitle: string, minTier: string, anchor: string) {
  return composeNotification({ kind, habitTitle, minTier, anchor, status: null })
}

/** 날짜 문자열 목록에서 기준일까지 이어진 연속일수 */
export function comboFromDates(dates: Iterable<string>, questDate: string): number {
  const set = new Set(dates)
  let cursor = set.has(questDate) ? questDate : addDaysISO(questDate, -1)
  let n = 0
  while (set.has(cursor)) {
    n += 1
    cursor = addDaysISO(cursor, -1)
  }
  return n
}
