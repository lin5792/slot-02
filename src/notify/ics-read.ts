// .ics 가져오기: 구글·애플 캘린더에서 내보낸 파일을 L2 CalendarEvent[]로 바꾼다.
// 반복 일정은 가져오는 기간 안의 회차로 펼친다. 파싱·반복 전개·시각대는 ical.js(Mozilla)에 맡긴다.

import ICAL from 'ical.js'
import type { CalendarEvent, HHmm, ISODate } from '../domain/types'
import { addDaysISO, localTodayISO } from './dates'
import { ICS_UID_DOMAIN } from './ics-write'

export interface ImportOptions {
  /** 가져올 기간 (포함). 기본: 오늘부터 90일 */
  from?: ISODate
  to?: ISODate
  now?: number
  /** 반복 일정 한 개당 최대 회차 */
  maxOccurrences?: number
}

const pad = (n: number) => String(n).padStart(2, '0')

function localDateTime(t: ICAL.Time): { date: ISODate; time?: HHmm } {
  if (t.isDate) return { date: `${t.year}-${pad(t.month)}-${pad(t.day)}` }
  // 시각대가 있는 값은 실제 순간으로 바꾼 뒤 기기 로컬로 표시한다. 시각대 없는(floating) 값은 그대로 로컬이다.
  const d = t.toJSDate()
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function toCalendarEvent(
  ev: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time | null,
  externalId: string,
  status: string | null,
  now: number,
): CalendarEvent {
  const s = localDateTime(start)
  const e = end ? localDateTime(end) : undefined
  const out: CalendarEvent = {
    id: `ics:${externalId}`,
    title: ev.summary || '(제목 없음)',
    date: s.date,
    status: status === 'CANCELLED' ? 'cancelled' : 'planned',
    source: 'ics',
    externalId,
    createdAt: now,
  }
  if (s.time) {
    out.start = s.time
    // 다른 날 끝나는 일정은 끝 시각을 넣지 않는다 (CalendarEvent는 하루 안의 일만 표현)
    if (e?.time && e.date === s.date) out.end = e.time
  }
  if (ev.location) out.place = ev.location
  return out
}

/** ICS 텍스트 → CalendarEvent[]. 이 앱이 내보낸 일정(UID ...@habit-quest)은 되가져오지 않는다 */
export function parseIcsEvents(text: string, opts: ImportOptions = {}): CalendarEvent[] {
  const now = opts.now ?? Date.now()
  const from = opts.from ?? localTodayISO(new Date(now))
  const to = opts.to ?? addDaysISO(from, 90)
  const max = opts.maxOccurrences ?? 500
  const root = new ICAL.Component(ICAL.parse(text))
  const cals = root.name === 'vcalendar' ? [root] : root.getAllSubcomponents('vcalendar')

  const result: CalendarEvent[] = []
  for (const cal of cals) {
    for (const tz of cal.getAllSubcomponents('vtimezone')) {
      const tzid = tz.getFirstPropertyValue('tzid')
      if (typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)) ICAL.TimezoneService.register(tz)
    }
    // UID별로 원본과 예외(RECURRENCE-ID)를 묶는다
    const byUid = new Map<string, { master?: ICAL.Component; exceptions: ICAL.Component[] }>()
    for (const v of cal.getAllSubcomponents('vevent')) {
      const uid = String(v.getFirstPropertyValue('uid') ?? '')
      if (!uid || uid.endsWith(`@${ICS_UID_DOMAIN}`)) continue
      const g = byUid.get(uid) ?? { exceptions: [] }
      if (v.hasProperty('recurrence-id')) g.exceptions.push(v)
      else g.master = v
      byUid.set(uid, g)
    }

    for (const [uid, g] of byUid) {
      if (!g.master) {
        // 예외만 있는 경우: 각각 단일 일정으로 취급
        for (const x of g.exceptions) pushSingle(new ICAL.Event(x), `${uid}#${x.getFirstPropertyValue('recurrence-id')}`)
        continue
      }
      const ev = new ICAL.Event(g.master)
      for (const x of g.exceptions) ev.relateException(x)
      const status = (g.master.getFirstPropertyValue('status') as string | null) ?? null
      if (!ev.isRecurring()) {
        pushSingle(ev, uid, status)
        continue
      }
      const it = ev.iterator()
      let n = 0
      for (let next = it.next(); next && n < max; next = it.next(), n++) {
        const occ = ev.getOccurrenceDetails(next)
        const s = localDateTime(occ.startDate)
        if (s.date > to) break
        const endDay = occ.endDate ? localDateTime(occ.endDate).date : s.date
        if (endDay < from) continue
        const itemStatus = (occ.item.component.getFirstPropertyValue('status') as string | null) ?? status
        result.push(
          toCalendarEvent(occ.item, occ.startDate, occ.endDate, `${uid}#${s.date}`, itemStatus, now),
        )
      }
    }

    function pushSingle(ev: ICAL.Event, externalId: string, status?: string | null) {
      const s = localDateTime(ev.startDate)
      if (s.date > to) return
      const endDay = ev.endDate ? localDateTime(ev.endDate).date : s.date
      if (endDay < from && s.date < from) return
      const st = status ?? ((ev.component.getFirstPropertyValue('status') as string | null) ?? null)
      result.push(toCalendarEvent(ev, ev.startDate, ev.endDate, externalId, st, now))
    }
  }
  return result.sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')))
}
