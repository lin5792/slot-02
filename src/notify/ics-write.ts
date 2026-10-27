// .ics(iCalendar, RFC 5545) 내보내기.
// 캘린더 앱 알람은 앱이 꺼져 있어도, 서버가 없어도 울린다. 그래서 "예외 0회"의 1차 안전망은 이쪽이다.
//
// 담는 것
// - L0·L1·L3 반복 블록: 주간 반복(RRULE WEEKLY;BYDAY), 알람 없음
// - 퀘스트 리마인더(anchorTime이 있을 때): 66일 매일, 시작 시각 알람
// - 백스톱: 66일 매일, 시작 시각 + 15분 뒤 알람 두 번
// - 주간 정비: 일요일, 알람
// - 챕터 보스: 22·44·66일째 종일 일정, 그날 아침 9시 알람

import type { Block, HHmm, Habit, ISODate, Settings, Weekday } from '../domain/types'
import { addDaysISO, deviceTimeZone, localTodayISO, toMinutes, utcOffsetMinutes, weekdayOfISO } from './dates'
import {
  BACKSTOP_FINAL_AFTER_MIN,
  CHAPTER_DAYS,
  DEFAULT_WEEKLY_REVIEW_TIME,
  anchorSentence,
  programLength,
} from './schedule'

export const ICS_UID_DOMAIN = 'habit-quest'
const PRODID = '-//habit-quest//notify//KO'
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

export interface IcsOptions {
  /** IANA 시각대. 기본은 기기 시각대 */
  timeZone?: string
  /** 반복 블록의 첫 날짜 기준. 기본 오늘 */
  from?: ISODate
  now?: Date
  calendarName?: string
  weeklyReviewTime?: HHmm
  /** 백스톱·퀘스트 알람 끄기 (캘린더 앱 기본 알림을 쓰고 싶을 때) */
  noAlarms?: boolean
}

/** TEXT 값 이스케이프 (RFC 5545 3.3.11) */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** 75옥텟 줄 접기 (RFC 5545 3.1). UTF-8 문자 중간을 자르지 않는다 */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let curBytes = 0
  let limit = 75
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (curBytes + b > limit) {
      parts.push(cur)
      cur = ''
      curBytes = 0
      limit = 74 // 이어지는 줄은 앞의 공백 1옥텟을 뺀다
    }
    cur += ch
    curBytes += b
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

const compactDate = (d: ISODate) => d.replace(/-/g, '')
const compactTime = (t: HHmm) => t.replace(':', '') + '00'

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function offsetString(min: number): string {
  const sign = min < 0 ? '-' : '+'
  const a = Math.abs(min)
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}${String(a % 60).padStart(2, '0')}`
}

/**
 * 고정 오프셋 시각대(예: Asia/Seoul)는 VTIMEZONE을 직접 만든다.
 * 서머타임이 있는 시각대는 전환 규칙을 정확히 쓰기 어려워 VTIMEZONE을 생략하고 TZID(IANA 이름)만 쓴다.
 * 구글·애플 캘린더는 IANA TZID를 그대로 인식한다.
 */
export function vtimezone(timeZone: string, now: Date): string[] {
  const y = now.getUTCFullYear()
  const jan = utcOffsetMinutes(new Date(Date.UTC(y, 0, 1)), timeZone)
  const jul = utcOffsetMinutes(new Date(Date.UTC(y, 6, 1)), timeZone)
  if (jan !== jul) return []
  const off = offsetString(jan)
  return [
    'BEGIN:VTIMEZONE',
    `TZID:${timeZone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${off}`,
    `TZOFFSETTO:${off}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
}

/** from 이후 weekdays 중 가장 이른 날짜 (RRULE의 첫 회차와 DTSTART를 맞춘다) */
export function firstMatchingDate(from: ISODate, weekdays: Weekday[]): ISODate {
  for (let i = 0; i < 7; i++) {
    const d = addDaysISO(from, i)
    if (weekdays.includes(weekdayOfISO(d))) return d
  }
  return from
}

interface EventSpec {
  uid: string
  summary: string
  description?: string
  categories?: string
  /** 시각 일정 */
  date: ISODate
  start?: HHmm
  /** start가 있으면 분 단위 길이 */
  durationMin?: number
  rrule?: string
  transparent?: boolean
  alarms?: { trigger: string; text: string }[]
}

function eventLines(e: EventSpec, tz: string, stamp: string): string[] {
  const out = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`]
  if (e.start) {
    out.push(`DTSTART;TZID=${tz}:${compactDate(e.date)}T${compactTime(e.start)}`)
    out.push(`DURATION:PT${e.durationMin ?? 10}M`)
  } else {
    out.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`)
    out.push(`DTEND;VALUE=DATE:${compactDate(addDaysISO(e.date, 1))}`)
  }
  if (e.rrule) out.push(`RRULE:${e.rrule}`)
  out.push(`SUMMARY:${escapeText(e.summary)}`)
  if (e.description) out.push(`DESCRIPTION:${escapeText(e.description)}`)
  if (e.categories) out.push(`CATEGORIES:${escapeText(e.categories)}`)
  out.push(`TRANSP:${e.transparent ? 'TRANSPARENT' : 'OPAQUE'}`)
  for (const a of e.alarms ?? []) {
    out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(a.text)}`, `TRIGGER:${a.trigger}`, 'END:VALARM')
  }
  out.push('END:VEVENT')
  return out
}

function blockDuration(b: Block): number {
  const d = toMinutes(b.end) - toMinutes(b.start)
  return d > 0 ? d : d + 1440 // end < start면 자정을 넘는다
}

const LAYER_LABEL: Record<Block['layer'], string> = { L0: 'L0 고정', L1: 'L1 필수', L3: 'L3 희망' }

export function blockEvents(blocks: Block[], from: ISODate): EventSpec[] {
  return blocks
    .filter((b) => b.weekdays.length > 0)
    .map((b) => {
      const days = [...new Set(b.weekdays)].sort()
      return {
        uid: `block-${b.id}@${ICS_UID_DOMAIN}`,
        summary: b.title,
        description: `${LAYER_LABEL[b.layer]} 블록`,
        categories: LAYER_LABEL[b.layer],
        date: firstMatchingDate(from, days),
        start: b.start,
        durationMin: blockDuration(b),
        rrule: `FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`,
        transparent: b.layer === 'L3',
      }
    })
}

export function habitEvents(habit: Habit, opts: { today: ISODate; weeklyReviewTime?: HHmm; noAlarms?: boolean }): EventSpec[] {
  if (habit.status !== 'active') return []
  const start = habit.startDate ?? opts.today
  const days = programLength(habit)
  const anchor = anchorSentence(habit)
  const tiers = `최소: ${habit.tiers.min}\n기본: ${habit.tiers.basic}\n최고: ${habit.tiers.best}`
  const alarm = (trigger: string, text: string) => (opts.noAlarms ? [] : [{ trigger, text }])
  const events: EventSpec[] = []
  if (habit.anchorTime) {
    events.push({
      uid: `quest-${habit.id}@${ICS_UID_DOMAIN}`,
      summary: `⚔️ 퀘스트: ${habit.title}`,
      description: `${anchor}\n\n${tiers}\n\n앵커를 놓쳐도 오늘 안에만 하면 인정.`,
      categories: '퀘스트',
      date: start,
      start: habit.anchorTime,
      durationMin: 10,
      rrule: `FREQ=DAILY;COUNT=${days}`,
      transparent: true,
      alarms: alarm('PT0M', `퀘스트 시간: ${habit.tiers.min}`),
    })
  }
  events.push({
    uid: `backstop-${habit.id}@${ICS_UID_DOMAIN}`,
    summary: `🛡️ 백스톱: 아직이면 지금 최소 퀘스트`,
    description: `오늘 아직 안 했다면 지금 그 자리에서: ${habit.tiers.min}\n이미 했다면 기록만 확인하고 내일 운동복 꺼내두기.`,
    categories: '퀘스트',
    date: start,
    start: habit.backstopTime,
    durationMin: 10,
    rrule: `FREQ=DAILY;COUNT=${days}`,
    transparent: true,
    alarms: [
      ...alarm('PT0M', `백스톱: 아직이면 지금 ${habit.tiers.min}`),
      ...alarm(`PT${BACKSTOP_FINAL_AFTER_MIN}M`, `마지막 경고: ${habit.tiers.min}`),
    ],
  })
  const programEnd = addDaysISO(start, days - 1)
  const firstSunday = firstMatchingDate(start, [0])
  // TZID가 붙은 DTSTART에 UNTIL을 쓰면 UTC로 써야 하므로(RFC 5545 3.3.10) 횟수(COUNT)로 끝낸다
  const sundays = firstSunday > programEnd ? 0 : Math.floor((Date.parse(programEnd) - Date.parse(firstSunday)) / (7 * 86_400_000)) + 1
  if (sundays > 0) events.push({
    uid: `weekly-${habit.id}@${ICS_UID_DOMAIN}`,
    summary: '🗓️ 주간 정비 10분',
    description: '다음 주 L0·L2를 캘린더에서 확인 → 놓친 날 이유 보고 if-then 하나 고치기 → 실드 정산·라이벌 순위·해금 카드 확인',
    categories: '퀘스트',
    date: firstSunday,
    start: opts.weeklyReviewTime ?? DEFAULT_WEEKLY_REVIEW_TIME,
    durationMin: 10,
    rrule: `FREQ=WEEKLY;BYDAY=SU;COUNT=${sundays}`,
    transparent: true,
    alarms: alarm('PT0M', '주간 정비 10분'),
  })
  for (let ch = 1; ch * CHAPTER_DAYS <= days; ch++) {
    const day = ch * CHAPTER_DAYS
    const last = day === days
    events.push({
      uid: `boss-${habit.id}-${ch}@${ICS_UID_DOMAIN}`,
      summary: last ? `👑 ${day}일째: 최종 보스 + 자동화 점검` : `👹 챕터 ${ch} 보스 (${day}일째)`,
      description: last
        ? '측정 퀘스트로 첫날 기록과 비교하고, 자동화 점검(SRBAI 4문항)으로 다음 단계를 정한다.'
        : '측정 퀘스트(예: 푸시업 최대 개수, 1km 기록)로 챕터 첫날 기록과 비교한다.',
      categories: '퀘스트',
      date: addDaysISO(start, day - 1),
      transparent: true,
      alarms: alarm('PT9H', last ? '오늘 최종 보스' : `오늘 챕터 ${ch} 보스`),
    })
  }
  return events
}

/** 본체 설정 화면이 부르는 함수. 결과 문자열을 파일로 내보내거나 구독 서버에 올린다 */
export function buildIcs(blocks: Block[], habit: Habit | null | undefined, _settings?: Settings, opts: IcsOptions = {}): string {
  const now = opts.now ?? new Date()
  const tz = opts.timeZone ?? deviceTimeZone()
  const today = opts.from ?? localTodayISO(now)
  const stamp = utcStamp(now)
  // 습관 자리 블록(habitId)은 퀘스트 리마인더가 같은 시각을 66일 동안 대신 보여주므로 뺀다
  const questShown = habit?.status === 'active' && !!habit.anchorTime
  const shownBlocks = blocks.filter((b) => !(questShown && b.habitId === habit!.id))
  const events = [
    ...blockEvents(shownBlocks, today),
    ...(habit ? habitEvents(habit, { today, weeklyReviewTime: opts.weeklyReviewTime, noAlarms: opts.noAlarms }) : []),
  ]
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.calendarName ?? '퀘스트 습관')}`,
    `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz, now),
    ...events.flatMap((e) => eventLines(e, tz, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** .ics 파일 내려받기. iOS 홈 화면 앱에서는 다운로드가 막힐 수 있어 공유 시트를 먼저 시도한다 */
export async function downloadIcs(ics: string, filename = 'habit-quest.ics'): Promise<'shared' | 'downloaded'> {
  const file = new File([ics], filename, { type: 'text/calendar' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: '퀘스트 습관 캘린더' })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'shared'
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
