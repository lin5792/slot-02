// 알림 모듈 전용 날짜 계산. 날짜 문자열(YYYY-MM-DD)은 UTC 자정으로 계산해 DST 영향을 받지 않는다.
// 시각대가 필요한 계산(서버에서 "지금 사용자 로컬 몇 시인가")은 Intl로 한다.

import type { HHmm, ISODate, Weekday } from '../domain/types'

/** 이 시각 이전의 알림은 전날 퀘스트에 속한다 (예: 00:30 백스톱은 어제 퀘스트) */
export const DAY_BOUNDARY: HHmm = '04:00'

const pad = (n: number) => String(n).padStart(2, '0')

export function addDaysISO(date: ISODate, n: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function weekdayOfISO(date: ISODate): Weekday {
  return new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday
}

export function diffDaysISO(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)
}

export function toMinutes(t: HHmm): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): HHmm {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** 기기 로컬 기준 오늘 날짜 */
export function localTodayISO(now = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 알림 시각이 날짜 경계 이전이면 그 알림은 전날 퀘스트에 속한다 */
export function questDateFor(localDate: ISODate, time: HHmm): ISODate {
  return toMinutes(time) < toMinutes(DAY_BOUNDARY) ? addDaysISO(localDate, -1) : localDate
}

export interface LocalParts {
  date: ISODate
  time: HHmm
  minutes: number
}

/** 특정 시각대에서 순간(instant)의 로컬 날짜·시각 */
export function localPartsIn(instant: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]))
  const time = `${p.hour}:${p.minute}`
  return { date: `${p.year}-${p.month}-${p.day}`, time, minutes: toMinutes(time) }
}

/** 시각대의 UTC 오프셋(분). 예: Asia/Seoul → 540 */
export function utcOffsetMinutes(instant: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((x) => x.type === 'timeZoneName')?.value
  const m = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
