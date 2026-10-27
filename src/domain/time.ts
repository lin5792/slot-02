import type { HHmm, ISODate, Weekday } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now)
}

/** 로컬 정오로 만든다. 서머타임 경계에서도 날짜 계산이 밀리지 않게. */
export function parseISO(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseISO(date)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** b - a (일) */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

export function weekdayOf(date: ISODate): Weekday {
  return parseISO(date).getDay() as Weekday
}

/** 그 주 월요일 */
export function weekStart(date: ISODate): ISODate {
  const wd = weekdayOf(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

export function toMin(t: HHmm): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fromMin(min: number): HHmm {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function nowMin(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
export const weekdayLabel = (wd: number) => WD[wd]

export function formatKDate(date: ISODate): string {
  const d = parseISO(date)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}분`
  return m ? `${h}시간 ${m}분` : `${h}시간`
}
