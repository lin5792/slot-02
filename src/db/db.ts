import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Block, CalendarEvent, DayLog, Habit, Measurement, Purchase, Reward, Settings, SideQuest, SkillAttempt,
  SrbaiCheck, WeeklyReview,
} from '../domain/types'
import { DB_NAME, DB_SCHEMA_VERSION, STORES, STORES_V2 } from './schema'

export class HabitDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  blocks!: EntityTable<Block, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  logs!: Table<DayLog, [string, string]>
  measurements!: EntityTable<Measurement, 'id'>
  reviews!: EntityTable<WeeklyReview, 'id'>
  srbai!: EntityTable<SrbaiCheck, 'id'>
  settings!: EntityTable<Settings, 'key'>
  quests!: EntityTable<SideQuest, 'id'>
  rewards!: EntityTable<Reward, 'id'>
  purchases!: EntityTable<Purchase, 'id'>
  skillTests!: EntityTable<SkillAttempt, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores(STORES)
    this.version(DB_SCHEMA_VERSION).stores(STORES_V2)
  }
}

export const db = new HabitDB()
