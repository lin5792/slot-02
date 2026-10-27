import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  Block, CalendarEvent, DayLog, Habit, Measurement, Settings, SrbaiCheck, WeeklyReview,
} from '../domain/types'
import { DB_NAME, DB_SCHEMA_VERSION, STORES } from './schema'

export class HabitDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  blocks!: EntityTable<Block, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  logs!: Table<DayLog, [string, string]>
  measurements!: EntityTable<Measurement, 'id'>
  reviews!: EntityTable<WeeklyReview, 'id'>
  srbai!: EntityTable<SrbaiCheck, 'id'>
  settings!: EntityTable<Settings, 'key'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(DB_SCHEMA_VERSION).stores(STORES)
  }
}

export const db = new HabitDB()
