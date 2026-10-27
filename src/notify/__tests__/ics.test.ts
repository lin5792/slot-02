// 기기 로컬 시각 변환은 한국 시각 기준으로 검증한다
process.env.TZ = 'Asia/Seoul'

import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, foldLine } from '../ics-write'
import { parseIcsEvents } from '../ics-read'
import { blocks, habit } from './fixtures'

const now = new Date('2026-10-27T03:00:00Z')
const ics = buildIcs(blocks, habit, undefined, { timeZone: 'Asia/Seoul', now, from: '2026-10-27' })

function occurrences(text: string, uidPrefix: string, n: number) {
  const cal = new ICAL.Component(ICAL.parse(text))
  for (const tz of cal.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)
  const v = cal.getAllSubcomponents('vevent').find((e) => String(e.getFirstPropertyValue('uid')).startsWith(uidPrefix))!
  const ev = new ICAL.Event(v)
  const it = ev.iterator()
  const out: { start: string; end: string }[] = []
  for (let t = it.next(); t && out.length < n; t = it.next()) {
    const d = ev.getOccurrenceDetails(t)
    out.push({ start: d.startDate.toJSDate().toISOString(), end: d.endDate.toJSDate().toISOString() })
  }
  return { ev, v, out }
}

describe('buildIcs', () => {
  it('RFC 5545 형식: CRLF, 75옥텟 접기, 이스케이프', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    const enc = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75)
    expect(escapeText('a,b;c\\d\ne')).toBe(String.raw`a\,b\;c\\d\ne`)
    const long = 'DESCRIPTION:' + '한'.repeat(40)
    const folded = foldLine(long)
    expect(folded.split('\r\n ').join('')).toBe(long)
  })
  it('근무 블록은 평일 09–18시 주간 반복 (KST)', () => {
    const { out } = occurrences(ics, 'block-work', 6)
    expect(out[0]).toEqual({ start: '2026-10-27T00:00:00.000Z', end: '2026-10-27T09:00:00.000Z' }) // 화 09:00 KST
    expect(out.map((o) => new Date(o.start).getUTCDay())).toEqual([2, 3, 4, 5, 1, 2])
  })
  it('자정을 넘는 수면 블록은 다음날 06:30에 끝난다', () => {
    const { out, ev } = occurrences(ics, 'block-sleep', 1)
    expect(out[0]).toEqual({ start: '2026-10-27T14:30:00.000Z', end: '2026-10-27T21:30:00.000Z' })
    expect(ev.summary).toBe('수면, 7시간 이상; 지킴')
  })
  it('요일 없는 블록은 넣지 않는다', () => {
    expect(ics).not.toContain('block-none')
  })
  it('백스톱은 66회, 알람 두 번(정시, 15분 뒤)', () => {
    const { v, out } = occurrences(ics, 'backstop-h1', 100)
    expect(out).toHaveLength(66)
    expect(out[0].start).toBe('2026-10-28T13:30:00.000Z') // 22:30 KST
    expect(out[65].start).toBe('2027-01-01T13:30:00.000Z')
    const triggers = v.getAllSubcomponents('valarm').map((a) => a.getFirstPropertyValue('trigger')!.toString())
    expect(triggers).toEqual(['PT0S', 'PT15M'])
  })
  it('퀘스트 리마인더는 anchorTime이 있을 때만', () => {
    expect(ics).toContain('UID:quest-h1@habit-quest')
    const noAnchor = buildIcs([], { ...habit, anchorTime: undefined }, undefined, { timeZone: 'Asia/Seoul', now })
    expect(noAnchor).not.toContain('UID:quest-h1')
  })
  it('주간 정비는 프로그램 기간 안의 일요일마다', () => {
    const { out } = occurrences(ics, 'weekly-h1', 100)
    expect(out[0].start).toBe('2026-11-01T11:00:00.000Z') // 일 20:00 KST
    expect(out).toHaveLength(9) // 11/1 … 12/27
  })
  it('챕터 보스는 22·44·66일째 종일 일정', () => {
    const cal = new ICAL.Component(ICAL.parse(ics))
    const boss = cal
      .getAllSubcomponents('vevent')
      .filter((v) => String(v.getFirstPropertyValue('uid')).startsWith('boss-'))
      .map((v) => (v.getFirstPropertyValue('dtstart') as ICAL.Time).toString())
    expect(boss).toEqual(['2026-11-18', '2026-12-10', '2027-01-01'])
  })
  it('활성 습관이 아니면 블록만', () => {
    const only = buildIcs(blocks, { ...habit, status: 'paused' }, undefined, { timeZone: 'Asia/Seoul', now })
    expect(only).not.toContain('backstop')
    expect(only).toContain('block-work')
  })
  it('서머타임 시각대는 VTIMEZONE 없이 IANA TZID를 쓴다', () => {
    const ny = buildIcs(blocks, habit, undefined, { timeZone: 'America/New_York', now })
    expect(ny).not.toContain('BEGIN:VTIMEZONE')
    expect(ny).toContain('DTSTART;TZID=America/New_York:')
    expect(ics).toContain('TZOFFSETTO:+0900')
  })
})

const GOOGLE_SAMPLE = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
  'VERSION:2.0',
  'BEGIN:VTIMEZONE',
  'TZID:Asia/Seoul',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0900',
  'TZOFFSETTO:+0900',
  'TZNAME:KST',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'DTSTART:20261030T100000Z',
  'DTEND:20261030T113000Z',
  'UID:dinner@google.com',
  'SUMMARY:친구 저녁\\, 강남',
  'LOCATION:강남역',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261103',
  'DTEND;VALUE=DATE:20261104',
  'UID:allday@google.com',
  'SUMMARY:건강검진',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;TZID=Asia/Seoul:20261028T200000',
  'DTEND;TZID=Asia/Seoul:20261028T210000',
  'RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=4',
  'EXDATE;TZID=Asia/Seoul:20261104T200000',
  'UID:study@google.com',
  'SUMMARY:스터디',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'RECURRENCE-ID;TZID=Asia/Seoul:20261111T200000',
  'DTSTART;TZID=Asia/Seoul:20261111T210000',
  'DTEND;TZID=Asia/Seoul:20261111T220000',
  'UID:study@google.com',
  'SUMMARY:스터디 (늦게)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20261029T090000Z',
  'DTEND:20261029T100000Z',
  'UID:cancel@google.com',
  'STATUS:CANCELLED',
  'SUMMARY:취소된 회의',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20250101T090000Z',
  'UID:old@google.com',
  'SUMMARY:지난 일정',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseIcsEvents', () => {
  const events = parseIcsEvents(GOOGLE_SAMPLE, { from: '2026-10-27', to: '2026-12-31', now: 1 })
  it('UTC·TZID·종일 일정을 기기 로컬(KST)로 바꾼다', () => {
    const dinner = events.find((e) => e.externalId === 'dinner@google.com')!
    expect(dinner).toMatchObject({ date: '2026-10-30', start: '19:00', end: '20:30', title: '친구 저녁, 강남', place: '강남역', source: 'ics', status: 'planned' })
    expect(events.find((e) => e.externalId === 'allday@google.com')).toMatchObject({ date: '2026-11-03' })
    expect(events.find((e) => e.externalId === 'allday@google.com')!.start).toBeUndefined()
  })
  it('반복 일정을 펼치고 EXDATE·예외 회차를 반영한다', () => {
    const study = events.filter((e) => e.externalId!.startsWith('study@google.com'))
    expect(study.map((e) => [e.date, e.start, e.title])).toEqual([
      ['2026-10-28', '20:00', '스터디'],
      ['2026-11-11', '21:00', '스터디 (늦게)'],
      ['2026-11-18', '20:00', '스터디'],
    ])
    expect(new Set(study.map((e) => e.externalId)).size).toBe(3)
  })
  it('취소 상태, 기간 밖 일정, 이 앱이 내보낸 일정', () => {
    expect(events.find((e) => e.externalId === 'cancel@google.com')!.status).toBe('cancelled')
    expect(events.find((e) => e.externalId === 'old@google.com')).toBeUndefined()
    expect(parseIcsEvents(ics, { from: '2026-10-27' })).toEqual([])
  })
})
