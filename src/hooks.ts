import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { DEFAULT_SETTINGS } from './db/queries'
import { computeProgress, type Progress } from './domain/progress'
import { todayISO } from './domain/time'
import type { Block, CalendarEvent, DayLog, Habit, Measurement, Settings, SrbaiCheck, WeeklyReview } from './domain/types'

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
  progress: Progress | undefined
  /** 모든 습관의 XP 합. 레벨은 사람에게 붙는다 */
  totalXp: number
}

export function useAppData(): AppData {
  const today = useToday()
  const data = useLiveQuery(async () => {
    const [habits, logs, blocks, events, settings, measurements, reviews, srbai] = await Promise.all([
      db.habits.toArray(), db.logs.toArray(), db.blocks.toArray(), db.events.toArray(),
      db.settings.get('main'), db.measurements.toArray(), db.reviews.toArray(), db.srbai.toArray(),
    ])
    return { habits, logs, blocks, events, settings: settings ?? DEFAULT_SETTINGS, measurements, reviews, srbai }
  }, [])

  return useMemo(() => {
    const empty = { habits: [], logs: [], blocks: [], events: [], settings: DEFAULT_SETTINGS, measurements: [], reviews: [], srbai: [] }
    const d = data ?? empty
    const habit = d.habits.find(h => h.status === 'active')
    const progress = habit ? computeProgress(habit, d.logs, today) : undefined
    const others = d.habits
      .filter(h => h.startDate && h.id !== habit?.id)
      .reduce((s, h) => s + computeProgress(h, d.logs, today).xp, 0)
    return { loaded: !!data, today, ...d, habit, progress, totalXp: (progress?.xp ?? 0) + others }
  }, [data, today])
}
