import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { DEFAULT_SETTINGS } from './db/queries'
import { computeEconomy, dayTypeOf, type Economy } from './domain/economy'
import { computeProgress, type Progress } from './domain/progress'
import { skillStates, type SkillState } from './domain/skills'
import { todayISO } from './domain/time'
import type {
  Block, CalendarEvent, DayLog, DayType, Habit, Measurement, Purchase, Reward, Settings, SideQuest, SkillAttempt,
  SrbaiCheck, WeeklyReview,
} from './domain/types'

/** 자정이 지나면 오늘 날짜를 바꾼다 (앱을 켜둔 채 밤을 넘겨도) */
export function useToday(): string {
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 30_000)
    const onVis = () => setToday(todayISO())
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return today
}

export interface AppData {
  loaded: boolean
  today: string
  habits: Habit[]
  habit: Habit | undefined
  logs: DayLog[]
  blocks: Block[]
  events: CalendarEvent[]
  settings: Settings
  measurements: Measurement[]
  reviews: WeeklyReview[]
  srbai: SrbaiCheck[]
  quests: SideQuest[]
  rewards: Reward[]
  purchases: Purchase[]
  skillTests: SkillAttempt[]
  progress: Progress | undefined
  /** 모든 습관의 XP 합 + 사이드 퀘스트 XP. 레벨은 사람에게 붙는다 */
  totalXp: number
  economy: Economy
  skills: SkillState[]
  dayType: DayType
}

export function useAppData(): AppData {
  const today = useToday()
  const data = useLiveQuery(async () => {
    const [habits, logs, blocks, events, settings, measurements, reviews, srbai, quests, rewards, purchases, skillTests] =
      await Promise.all([
        db.habits.toArray(), db.logs.toArray(), db.blocks.toArray(), db.events.toArray(),
        db.settings.get('main'), db.measurements.toArray(), db.reviews.toArray(), db.srbai.toArray(),
        db.quests.toArray(), db.rewards.toArray(), db.purchases.toArray(), db.skillTests.toArray(),
      ])
    return {
      habits, logs, blocks, events, settings: settings ?? DEFAULT_SETTINGS, measurements, reviews, srbai,
      quests, rewards, purchases, skillTests,
    }
  }, [])

  return useMemo(() => {
    const empty = {
      habits: [], logs: [], blocks: [], events: [], settings: DEFAULT_SETTINGS, measurements: [], reviews: [], srbai: [],
      quests: [], rewards: [], purchases: [], skillTests: [],
    }
    const d = data ?? empty
    const habit = d.habits.find(h => h.status === 'active')
    const progresses = d.habits.filter(h => h.startDate).map(h => computeProgress(h, d.logs, today))
    const progress = habit ? computeProgress(habit, d.logs, today) : undefined
    // 스킬 응시 조건(클리어 수)이 골드 효과보다 먼저 정해져야 해서 따로 센다
    const clears = progresses.reduce((s, p) => s + p.cells.filter(c => c.tier && c.date <= today).length, 0)
    const skills = skillStates({ attempts: d.skillTests, srbai: d.srbai, clears, day: progress?.day ?? 0, today })
    const economy = computeEconomy({
      progresses, logs: d.logs, quests: d.quests, purchases: d.purchases, attempts: d.skillTests,
      skills, settings: d.settings, today,
    })
    const habitXp = progresses.reduce((s, p) => s + p.xp, 0)
    return {
      loaded: !!data, today, ...d, habit, progress,
      totalXp: habitXp + economy.sideXp, economy, skills, dayType: dayTypeOf(today, d.settings),
    }
  }, [data, today])
}
