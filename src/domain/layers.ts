// 하루를 L0 고정 → L1 필수 → L2 이벤트 → L3 희망 순으로 쌓는다.
import { addDays, fromMin, toMin, weekdayOf } from './time'
import type { Block, CalendarEvent, Habit, ISODate, Layer } from './types'

export interface DayItem {
  id: string
  layer: Layer
  title: string
  /** 그날 0시 기준 분. end는 start보다 크다 (최대 1440) */
  start: number
  end: number
  source: 'block' | 'event'
  kind?: Block['kind']
  habitId?: string
  /** 자정을 넘어온 블록의 뒷부분 */
  carried?: boolean
}

export interface DayPlan {
  date: ISODate
  items: DayItem[]
  allDay: CalendarEvent[]
  /** 계층별 사용 분 (겹침은 윗 계층이 가져간다) */
  budget: Record<Layer, number>
  free: number
  /** 아래 계층이 윗 계층과 겹친 곳 */
  overlaps: { lower: DayItem; upper: DayItem }[]
  sleepMin: number
  bufferMin: number
}

const LAYER_RANK: Record<Layer, number> = { L0: 0, L1: 1, L2: 2, L3: 3 }

export function itemsForDate(blocks: Block[], events: CalendarEvent[], date: ISODate): DayItem[] {
  const wd = weekdayOf(date)
  const prevWd = weekdayOf(addDays(date, -1))
  const items: DayItem[] = []
  for (const b of blocks) {
    const s = toMin(b.start), e = toMin(b.end)
    const crosses = e <= s
    const base = { id: b.id, layer: b.layer, title: b.title, source: 'block' as const, kind: b.kind, habitId: b.habitId }
    if (b.weekdays.includes(wd)) items.push({ ...base, start: s, end: crosses ? 1440 : e })
    if (crosses && e > 0 && b.weekdays.includes(prevWd)) items.push({ ...base, start: 0, end: e, carried: true })
  }
  for (const ev of events) {
    if (ev.date !== date || ev.status === 'cancelled' || !ev.start) continue
    const s = toMin(ev.start)
    const e = ev.end ? toMin(ev.end) : s + 60
    items.push({ id: ev.id, layer: 'L2', title: ev.title, start: s, end: e > s ? e : 1440, source: 'event' })
  }
  return items.sort((a, b) => a.start - b.start || LAYER_RANK[a.layer] - LAYER_RANK[b.layer])
}

export function planDay(blocks: Block[], events: CalendarEvent[], date: ISODate): DayPlan {
  const items = itemsForDate(blocks, events, date)
  // 분 단위로 가장 높은 계층이 차지한다. 1440칸이라 단순 배열이 가장 명확하다.
  const owner: (Layer | null)[] = new Array(1440).fill(null)
  for (const layer of ['L0', 'L1', 'L2', 'L3'] as Layer[]) {
    for (const it of items) {
      if (it.layer !== layer) continue
      for (let m = it.start; m < it.end; m++) if (owner[m] === null) owner[m] = layer
    }
  }
  const budget: Record<Layer, number> = { L0: 0, L1: 0, L2: 0, L3: 0 }
  let free = 0
  for (const o of owner) o ? budget[o]++ : free++

  const overlaps: DayPlan['overlaps'] = []
  for (const lower of items) {
    for (const upper of items) {
      if (LAYER_RANK[upper.layer] >= LAYER_RANK[lower.layer]) continue
      if (upper.start < lower.end && lower.start < upper.end) overlaps.push({ lower, upper })
    }
  }

  const sumKind = (k: Block['kind']) => items.filter(i => i.kind === k).reduce((s, i) => s + i.end - i.start, 0)
  return {
    date,
    items,
    allDay: events.filter(e => e.date === date && !e.start && e.status !== 'cancelled'),
    budget,
    free,
    overlaps,
    sleepMin: sumKind('sleep'),
    bufferMin: sumKind('buffer'),
  }
}

export interface AnchorCheck {
  /** 오늘 앵커 자리 (블록 또는 anchorTime 기준 30분) */
  anchor: { start: number; end: number } | null
  conflict: DayItem | null
  /** 겹칠 때 제안하는 대체 앵커 시각 */
  suggestion: { start: number; end: number; after?: string } | null
}

/**
 * 이벤트가 앵커와 겹치면 대체 앵커를 제안한다.
 * 겹친 일정이 끝난 뒤 백스톱 전까지의 빈칸을 먼저 찾고, 없으면 그날 첫 빈칸을 준다.
 */
export function checkAnchor(
  habit: Habit, blocks: Block[], events: CalendarEvent[], date: ISODate, needMin = 30,
): AnchorCheck {
  const items = itemsForDate(blocks, events, date)
  const anchorItem = items.find(i => i.habitId === habit.id && !i.carried)
  const anchor = anchorItem
    ? { start: anchorItem.start, end: anchorItem.end }
    : habit.anchorTime ? { start: toMin(habit.anchorTime), end: toMin(habit.anchorTime) + needMin } : null
  if (!anchor) return { anchor, conflict: null, suggestion: null }

  const others = items.filter(i => i.habitId !== habit.id)
  const conflict = others.find(i => i.layer === 'L2' && i.start < anchor.end && anchor.start < i.end) ?? null
  if (!conflict) return { anchor, conflict: null, suggestion: null }

  const busy = (s: number, e: number) =>
    others.some(i => i.layer !== 'L3' && i.kind !== 'buffer' && i.start < e && s < i.end)
  const backstop = toMin(habit.backstopTime)
  const find = (from: number, to: number) => {
    for (let s = from; s + needMin <= to; s += 5) if (!busy(s, s + needMin)) return { start: s, end: s + needMin }
    return null
  }
  const afterEvent = find(conflict.end, backstop)
  if (afterEvent) return { anchor, conflict, suggestion: { ...afterEvent, after: conflict.title } }
  return { anchor, conflict, suggestion: find(6 * 60, backstop) }
}

export const minLabel = fromMin
