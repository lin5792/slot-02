// 기록(DayLog)만 사실로 저장하고, XP·콤보·실드·챕터는 전부 여기서 계산한다.
// 저장된 파생값이 없으니 규칙을 고쳐도 과거 기록이 그대로 다시 계산된다.
import {
  CHAPTER_DAYS, COMEBACK_XP, PROGRAM_DAYS, SHIELD_CASH_XP, TIER_XP,
  chapterRule, levelForXp, tierAtLeast, xpForLevel, type ChapterRule,
} from './rules'
import { addDays, diffDays, weekStart } from './time'
import type { DayLog, Habit, ISODate, Tier } from './types'

export type DayState = 'done' | 'missed' | 'today' | 'future'

export interface DayCell {
  date: ISODate
  /** 1일차부터 */
  day: number
  chapter: number
  tier: Tier | null
  state: DayState
  /** 이날 기본을 놓쳤지만 실드가 기본 연속기록을 지켰다 */
  shieldUsed: boolean
  /** 복귀 보너스를 받은 날 */
  comeback: boolean
  isBoss: boolean
  xp: number
}

export interface WeekShield {
  weekStart: ISODate
  usedOn: ISODate | null
  /** 안 쓰고 주를 넘겨 XP로 환전됨 */
  cashed: boolean
}

export interface Progress {
  started: boolean
  /** 오늘이 몇 일차인가. 시작 전이면 0 이하, 끝났으면 totalDays 초과 */
  day: number
  totalDays: number
  endDate: ISODate | null
  chapter: ChapterRule
  dayInChapter: number
  daysToBoss: number
  isBossDay: boolean
  cells: DayCell[]
  weeks: WeekShield[]
  xp: number
  level: number
  levelFloorXp: number
  nextLevelXp: number
  /** 최소 퀘스트 연속일수 (실드 없음) */
  combo: number
  bestCombo: number
  /** 기본 퀘스트 연속일수 (주 1회 실드) */
  basicStreak: number
  bestBasicStreak: number
  shieldThisWeek: 'available' | 'used'
  todayTier: Tier | null
  /** 어제 기본을 놓쳤다 → 오늘은 기본이 필수 ("이틀 연속은 없다") */
  comebackDay: boolean
  /** 마지막 날 이후: SRBAI 점검 차례 */
  checkDue: boolean
}

export function totalDaysOf(habit: Habit): number {
  return PROGRAM_DAYS + CHAPTER_DAYS * habit.extensions
}

export function chapterOfDay(day: number): number {
  return Math.max(1, Math.ceil(day / CHAPTER_DAYS))
}

export function computeProgress(habit: Habit, logs: DayLog[], today: ISODate): Progress {
  const totalDays = totalDaysOf(habit)
  const byDate = new Map<ISODate, Tier>()
  for (const l of logs) if (l.habitId === habit.id) byDate.set(l.date, l.tier)

  const start = habit.startDate
  const day = start ? diffDays(start, today) + 1 : 0
  const endDate = start ? addDays(start, totalDays - 1) : null
  const clampedDay = Math.min(Math.max(day, 1), totalDays)
  const chapterN = chapterOfDay(clampedDay)
  const dayInChapter = clampedDay - (chapterN - 1) * CHAPTER_DAYS
  const daysToBoss = CHAPTER_DAYS - dayInChapter

  const cells: DayCell[] = []
  const weeks = new Map<ISODate, WeekShield>()
  let xp = 0
  let combo = 0, bestCombo = 0, basicStreak = 0, bestBasicStreak = 0
  let prevBasicMissed = false

  for (let i = 1; start && i <= totalDays; i++) {
    const date = addDays(start, i - 1)
    const isToday = date === today
    const isPast = date < today
    const tier = byDate.get(date) ?? null
    const ws = weekStart(date)
    if (!weeks.has(ws)) weeks.set(ws, { weekStart: ws, usedOn: null, cashed: false })
    const week = weeks.get(ws)!
    const cell: DayCell = {
      date, day: i, chapter: chapterOfDay(i), tier,
      state: isPast ? (tier ? 'done' : 'missed') : isToday ? (tier ? 'done' : 'today') : 'future',
      shieldUsed: false, comeback: false, isBoss: i % CHAPTER_DAYS === 0, xp: 0,
    }
    cells.push(cell)
    if (!isPast && !isToday) continue

    // 오늘은 아직 끝나지 않았다: 기록 전이면 연속기록을 깨지 않고, 최소만 했으면 실드를 아직 쓰지 않는다.
    const settled = isPast || tierAtLeast(tier, 'basic')

    if (tier) {
      cell.xp += TIER_XP[tier]
      combo++
      bestCombo = Math.max(bestCombo, combo)
    } else if (isPast) {
      combo = 0
    }

    if (tierAtLeast(tier, 'basic')) {
      if (prevBasicMissed) {
        cell.comeback = true
        cell.xp += COMEBACK_XP
      }
      basicStreak++
      bestBasicStreak = Math.max(bestBasicStreak, basicStreak)
    } else if (settled) {
      if (!week.usedOn) {
        week.usedOn = date
        cell.shieldUsed = true
      } else {
        basicStreak = 0
      }
    }

    if (settled) prevBasicMissed = !tierAtLeast(tier, 'basic')
    xp += cell.xp
  }

  for (const w of weeks.values()) {
    const sunday = addDays(w.weekStart, 6)
    if (!w.usedOn && sunday < today) {
      w.cashed = true
      xp += SHIELD_CASH_XP
    }
  }

  const level = levelForXp(xp)
  const todayCell = cells.find(c => c.date === today)
  const yesterday = cells.find(c => c.date === addDays(today, -1))
  const thisWeek = weeks.get(weekStart(today))

  return {
    started: !!start && day >= 1,
    day,
    totalDays,
    endDate,
    chapter: chapterRule(chapterN),
    dayInChapter,
    daysToBoss,
    isBossDay: day >= 1 && day <= totalDays && day % CHAPTER_DAYS === 0,
    cells,
    weeks: [...weeks.values()],
    xp,
    level,
    levelFloorXp: xpForLevel(level),
    nextLevelXp: xpForLevel(level + 1),
    combo,
    bestCombo,
    basicStreak,
    bestBasicStreak,
    shieldThisWeek: thisWeek?.usedOn ? 'used' : 'available',
    todayTier: todayCell?.tier ?? null,
    comebackDay: !!yesterday && !tierAtLeast(yesterday.tier, 'basic'),
    checkDue: !!start && day >= totalDays,
  }
}

/** 오늘 기록하면 얻을 XP (복귀 보너스 포함) — "아쉽게 끝내기" 화면용 */
export function xpIfLogged(p: Progress, tier: Tier): number {
  return TIER_XP[tier] + (p.comebackDay && tierAtLeast(tier, 'basic') ? COMEBACK_XP : 0)
}
