// IndexedDB 스키마. 서비스워커는 Dexie 없이 원시 IndexedDB로 읽으므로 이 값은 바꾸지 않는다.
// 스토어를 추가할 때는 DB_SCHEMA_VERSION을 올리고 새 version()을 db.ts에 쌓는다.

export const DB_NAME = 'habit-quest'
/** Dexie 버전. 원시 IndexedDB 버전은 이 값 × 10 이다 (Dexie 규칙). */
export const DB_SCHEMA_VERSION = 1

export const STORES = {
  habits: 'id, status',
  blocks: 'id, layer, habitId',
  events: 'id, date, externalId',
  /** keyPath ['habitId','date'] */
  logs: '[habitId+date], habitId, date',
  measurements: 'id, habitId',
  reviews: 'id, habitId, weekStart',
  srbai: 'id, habitId',
  settings: 'key',
} as const
