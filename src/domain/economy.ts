// 골드는 XP처럼 기록에서 매번 계산한다. 저장되는 사실은 퀘스트 기록, 앵콜/참고 저장 선택,
// 시험 기록, 구매뿐이고, 상자·보너스·스킬 효과는 전부 여기서 다시 나온다.
import type { Progress } from './progress'
import {
  COMEBACK_GOLD, ENCORE_GOLD, RECORD_GOLD, REST_BONUS_RATE, SEALED_CHEST_MAX, SEALED_CHEST_MIN,
  SURPRISE_GOLD, SURPRISE_RATE, TIER_GOLD, WEEKLY_CHEST_GIFT, WEEKLY_CHEST_GOAL, WEEKLY_CHEST_GOLD,
} from './rules'
import { effectsOn, recordBreaks, type SkillState } from './skills'
import { addDays, weekStart, weekdayOf } from './time'
import type { DayLog, DayType, ISODate, Purchase, Settings, SideQuest, SkillAttempt, Tier } from './types'

export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5]

export function dayTypeOf(date: ISODate, settings: Settings): DayType {
  const o = settings.dayOverride?.[date]
  if (o) return o
  return (settings.workdays ?? DEFAULT_WORKDAYS).includes(weekdayOf(date)) ? 'work' : 'off'
}

export function questsFor(quests: SideQuest[], type: DayType): SideQuest[] {
  return quests.filter(q => !q.archived && (q.on === 'both' || q.on === type))
}

// 날짜로 정해지는 운. 같은 날 다시 열어도 결과가 같다.
function chance(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export const surpriseOn = (questId: string, date: ISODate) => chance(`surprise|${questId}|${date}`) < SURPRISE_RATE
export const sealedChestGold = (date: ISODate) =>
  SEALED_CHEST_MIN + Math.floor(chance(`chest|${date}`) * (SEALED_CHEST_MAX - SEALED_CHEST_MIN + 1))

export type GoldKind = 'quest' | 'comeback' | 'rest' | 'encore' | 'surprise' | 'chest' | 'weekly' | 'record'

export interface GoldLine {
  date: ISODate
  kind: GoldKind
  /** 사이드 퀘스트면 그 id, 메인이면 'main' */
  source: string
  gold: number
}

export interface Economy {
  lines: GoldLine[]
  earned: number
  spent: number
  balance: number
  /** 메인 퀘스트를 깬 날 수 (모든 습관 합) */
  clears: number
  /** 마지막으로 깬 날의 봉인 상자가 다음 클리어를 기다린다 */
  sealedPending: boolean
  /** 어제 참고 저장을 골랐고 오늘 메인 퀘스트는 아직이다 */
  restWaiting: boolean
  week: { count: number; goal: number; gift: number; opened: boolean }
  /** 사이드 퀘스트 XP (레벨에 더한다) */
  sideXp: number
}

export interface EconomyInput {
  progresses: Progress[]
  logs: DayLog[]
  quests: SideQuest[]
  purchases: Purchase[]
  attempts: SkillAttempt[]
  skills: SkillState[]
  settings: Settings
  today: ISODate
}

export function computeEconomy(input: EconomyInput): Economy {
  const { progresses, logs, quests, purchases, attempts, skills, settings, today } = input
  const afterglow = settings.afterglow ?? {}
  const lines: GoldLine[] = []
  const add = (date: ISODate, kind: GoldKind, source: string, gold: number) => {
    if (gold > 0) lines.push({ date, kind, source, gold })
  }
  const withPct = (gold: number, pct: number) => Math.round(gold * (1 + pct / 100))

  const mainDays: { date: ISODate; tier: Tier; comeback: boolean }[] = []
  for (const p of progresses) {
    for (const c of p.cells) if (c.tier && c.date <= today) mainDays.push({ date: c.date, tier: c.tier, comeback: c.comeback })
  }
  mainDays.sort((a, b) => a.date.localeCompare(b.date))

  const weekCounts = new Map<ISODate, number>()
  mainDays.forEach((d, i) => {
    const e = effectsOn(skills, d.date)
    add(d.date, 'quest', 'main', withPct(TIER_GOLD[d.tier] + (d.tier === 'best' ? e.bestGold : 0), e.goldPct))
    if (d.comeback) add(d.date, 'comeback', 'main', withPct(COMEBACK_GOLD * (e.comebackX2 ? 2 : 1), e.goldPct))
    if (afterglow[addDays(d.date, -1)] === 'rest') {
      add(d.date, 'rest', 'main', Math.round(TIER_GOLD[d.tier] * REST_BONUS_RATE * (e.restX2 ? 2 : 1)))
    }
    if (afterglow[d.date] === 'encore') add(d.date, 'encore', 'main', ENCORE_GOLD * (e.encoreX2 ? 2 : 1))
    if (surpriseOn('main', d.date)) add(d.date, 'surprise', 'main', SURPRISE_GOLD)
    if (i > 0) add(d.date, 'chest', 'main', sealedChestGold(mainDays[i - 1].date))
    const ws = weekStart(d.date)
    const n = (weekCounts.get(ws) ?? 0) + 1
    weekCounts.set(ws, n)
    if (n === WEEKLY_CHEST_GOAL) add(d.date, 'weekly', 'main', WEEKLY_CHEST_GOLD)
  })

  const byId = new Map(quests.map(q => [q.id, q]))
  let sideXp = 0
  for (const l of logs) {
    const q = byId.get(l.habitId)
    if (!q || l.date > today) continue
    add(l.date, 'quest', q.id, withPct(q.gold, effectsOn(skills, l.date).goldPct))
    if (surpriseOn(q.id, l.date)) add(l.date, 'surprise', q.id, SURPRISE_GOLD)
    sideXp += q.gold
  }

  for (const a of recordBreaks(attempts)) add(a.date, 'record', a.skillId, RECORD_GOLD)

  lines.sort((a, b) => a.date.localeCompare(b.date))
  const earned = lines.reduce((s, l) => s + l.gold, 0)
  const spent = purchases.reduce((s, p) => s + p.price, 0)
  const clearedToday = mainDays.some(d => d.date === today)
  const count = weekCounts.get(weekStart(today)) ?? 0
  return {
    lines,
    earned,
    spent,
    balance: earned - spent,
    clears: mainDays.length,
    sealedPending: mainDays.length > 0,
    restWaiting: afterglow[addDays(today, -1)] === 'rest' && !clearedToday,
    week: { count, goal: WEEKLY_CHEST_GOAL, gift: WEEKLY_CHEST_GIFT, opened: count >= WEEKLY_CHEST_GOAL },
    sideXp,
  }
}

/** 오늘 메인 퀘스트를 이 단계로 깨면 받을 골드 (화면 버튼에 미리 보여 준다) */
export function mainGoldIf(tier: Tier, p: Progress, skills: SkillState[], settings: Settings, today: ISODate): number {
  const e = effectsOn(skills, today)
  const base = Math.round((TIER_GOLD[tier] + (tier === 'best' ? e.bestGold : 0)) * (1 + e.goldPct / 100))
  const comeback = p.comebackDay && tier !== 'min' ? Math.round(COMEBACK_GOLD * (e.comebackX2 ? 2 : 1) * (1 + e.goldPct / 100)) : 0
  const rest = settings.afterglow?.[addDays(today, -1)] === 'rest' ? Math.round(TIER_GOLD[tier] * REST_BONUS_RATE * (e.restX2 ? 2 : 1)) : 0
  return base + comeback + rest
}

/** 한 달에 퀘스트를 다 깨면 대략 버는 골드 (상자 기댓값 포함). 보상 예산을 1 G당 원으로 바꿀 때 쓴다 */
export function monthlyGoldEstimate(quests: SideQuest[], settings: Settings): number {
  const workdays = (settings.workdays ?? DEFAULT_WORKDAYS).length
  const surprise = SURPRISE_RATE * SURPRISE_GOLD
  const perWeek = (on: DayType) => questsFor(quests, on)
    .reduce((s, q) => s + q.gold + surprise, 0) * (on === 'work' ? workdays : 7 - workdays)
  const main = TIER_GOLD.basic + (SEALED_CHEST_MIN + SEALED_CHEST_MAX) / 2 + surprise
  const weekly = main * 7 + perWeek('work') + perWeek('off') + WEEKLY_CHEST_GOLD
  return Math.round(weekly * 30 / 7)
}
