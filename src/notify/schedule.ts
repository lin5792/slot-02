// 알림 일정(ReminderPlan). 앱이 만들어 푸시 서버에 보내고, 서버 cron이 이걸로 "지금 보낼 알림"을 고른다.
// 앱·서비스워커·서버가 함께 쓰므로 브라우저 API에 의존하지 않는다.

import type { HHmm, Habit, ISODate, Weekday } from '../domain/types'
import { addDaysISO, localPartsIn, questDateFor, toMinutes, weekdayOfISO } from './dates'

/** 66일 프로그램, 연장 1회 = 챕터 1개(22일) */
export const PROGRAM_DAYS = 66
export const CHAPTER_DAYS = 22
/** 백스톱을 놓쳤을 때 한 번 더 울리는 간격 */
export const BACKSTOP_FINAL_AFTER_MIN = 15
export const DEFAULT_WEEKLY_REVIEW_TIME: HHmm = '20:00'

export type ReminderKind = 'quest' | 'backstop' | 'backstop-final' | 'weekly'

export interface ReminderItem {
  /** plan 안에서 고유. 보낸 기록의 키로 쓴다 */
  id: string
  kind: ReminderKind
  time: HHmm
  /** 비우면 매일 */
  weekdays?: Weekday[]
  /** 퀘스트 날짜 기준 범위 (포함) */
  startDate: ISODate
  endDate: ISODate
}

export interface ReminderPlan {
  version: 1
  timeZone: string
  habitId: string
  habitTitle: string
  /** 서비스워커가 IndexedDB를 못 읽을 때 쓰는 기본 문구 재료 */
  minTier: string
  anchor: string
  items: ReminderItem[]
}

export interface PlanOptions {
  timeZone: string
  weeklyReviewTime?: HHmm
  /** 습관에 시작일이 없을 때 쓸 날짜 */
  today: ISODate
}

export function programLength(habit: Pick<Habit, 'extensions'>): number {
  return PROGRAM_DAYS + CHAPTER_DAYS * (habit.extensions ?? 0)
}

export function programEnd(habit: Pick<Habit, 'startDate' | 'extensions'>, today: ISODate): ISODate {
  return addDaysISO(habit.startDate ?? today, programLength(habit) - 1)
}

export function anchorSentence(habit: Habit): string {
  const { anchorEvent, place, action } = habit.intention
  return [anchorEvent && `${anchorEvent} 직후에`, place && `${place}에서`, action].filter(Boolean).join(' ')
}

/** 활성 습관에서 알림 일정을 만든다. 활성 습관이 아니면 null */
export function buildReminderPlan(habit: Habit | null | undefined, opts: PlanOptions): ReminderPlan | null {
  if (!habit || habit.status !== 'active') return null
  const startDate = habit.startDate ?? opts.today
  const endDate = programEnd(habit, opts.today)
  const items: ReminderItem[] = []
  if (habit.anchorTime) {
    items.push({ id: `${habit.id}:quest`, kind: 'quest', time: habit.anchorTime, startDate, endDate })
  }
  items.push({ id: `${habit.id}:backstop`, kind: 'backstop', time: habit.backstopTime, startDate, endDate })
  items.push({
    id: `${habit.id}:backstop-final`,
    kind: 'backstop-final',
    time: addMinutesHHmm(habit.backstopTime, BACKSTOP_FINAL_AFTER_MIN),
    startDate,
    endDate,
  })
  items.push({
    id: `${habit.id}:weekly`,
    kind: 'weekly',
    time: opts.weeklyReviewTime ?? DEFAULT_WEEKLY_REVIEW_TIME,
    weekdays: [0],
    startDate,
    endDate,
  })
  return {
    version: 1,
    timeZone: opts.timeZone,
    habitId: habit.id,
    habitTitle: habit.title,
    minTier: habit.tiers.min,
    anchor: anchorSentence(habit),
    items,
  }
}

function addMinutesHHmm(t: HHmm, add: number): HHmm {
  const m = (toMinutes(t) + add) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export interface DueReminder {
  item: ReminderItem
  /** 이 알림이 속한 퀘스트 날짜 */
  questDate: ISODate
}

/**
 * 지금 보낼 알림. cron이 몇 분 늦게 돌아도 놓치지 않도록 예정 시각부터 graceMin분 안이면 보낸다.
 * sent[item.id]에 이미 그 퀘스트 날짜가 있으면 다시 보내지 않는다.
 */
export function dueReminders(
  plan: ReminderPlan,
  now: Date,
  sent: Record<string, ISODate>,
  graceMin = 10,
): DueReminder[] {
  const local = localPartsIn(now, plan.timeZone)
  const due: DueReminder[] = []
  for (const item of plan.items) {
    const target = toMinutes(item.time)
    // 예정 시각이 자정 직전이고 지금이 자정 직후면 어제 날짜의 예정분이다
    let late = local.minutes - target
    let localDate = local.date
    if (late < 0) {
      late += 1440
      localDate = addDaysISO(local.date, -1)
    }
    if (late >= graceMin) continue
    const questDate = questDateFor(localDate, item.time)
    if (questDate < item.startDate || questDate > item.endDate) continue
    if (item.weekdays && !item.weekdays.includes(weekdayOfISO(questDate))) continue
    if (sent[item.id] === questDate) continue
    due.push({ item, questDate })
  }
  return due
}
