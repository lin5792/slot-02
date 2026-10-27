// 앱 전체가 공유하는 데이터 모델. 알림·캘린더 모듈(src/notify)도 이 타입을 그대로 쓴다.
// 날짜는 모두 사용자 로컬 기준 문자열이다. 시각대 변환은 하지 않는다.

/** YYYY-MM-DD (로컬 날짜) */
export type ISODate = string
/** HH:mm, 24시간제 (로컬 시각) */
export type HHmm = string

/** 시간 계층. L0 고정 → L1 필수 → L2 이벤트 → L3 희망 순으로 하루를 채운다. */
export type Layer = 'L0' | 'L1' | 'L2' | 'L3'

/** 퀘스트 단계. 기록이 없으면 그날은 안 한 것(null)이다. */
export type Tier = 'min' | 'basic' | 'best'

/** 0=일 … 6=토 (Date.getDay()와 같음) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * 반복 블록 (L0·L1·L3). 날짜가 정해진 일회성 일은 CalendarEvent(L2)로 둔다.
 * end < start 이면 자정을 넘는 블록이다 (예: 수면 23:30–06:30).
 */
export interface Block {
  id: string
  layer: Exclude<Layer, 'L2'>
  title: string
  start: HHmm
  end: HHmm
  weekdays: Weekday[]
  /** 계층 예산 점검용 표시. sleep=수면 7시간 점검, buffer=L1 여유 시간 */
  kind?: 'sleep' | 'buffer'
  /** 이 블록이 승격된 습관의 자리(앵커)일 때 그 습관 id */
  habitId?: string
  createdAt: number
}

/** 날짜가 정해진 일회성 일 (L2). 앱에서 직접 만들거나 캘린더에서 가져온다. */
export interface CalendarEvent {
  id: string
  title: string
  date: ISODate
  /** 비우면 종일 일정 */
  start?: HHmm
  end?: HHmm
  place?: string
  prep?: string
  status: 'planned' | 'done' | 'cancelled'
  source: 'manual' | 'ics'
  /** 외부 캘린더 UID (가져오기 중복 방지) */
  externalId?: string
  createdAt: number
}

export interface IfThen {
  if: string
  then: string
}

export type HabitStatus = 'draft' | 'active' | 'settled' | 'paused'

/**
 * 정착시킬 행위. 한 번에 하나만 status='active'(L1로 승격)이다.
 */
export interface Habit {
  id: string
  title: string
  tiers: Record<Tier, string>
  /** 실행의도: "[anchorEvent] 직후에 [place]에서 [action]을 한다" */
  intention: { anchorEvent: string; place: string; action: string }
  /** 장애물별 if-then 3개 */
  ifThen: IfThen[]
  /** 앵커가 보통 일어나는 시각 (리마인더용, 선택) */
  anchorTime?: HHmm
  /** 백스톱 알람 시각. 기본값은 취침 1시간 전 */
  backstopTime: HHmm
  /** 66일 프로그램 1일차. draft면 null */
  startDate: ISODate | null
  status: HabitStatus
  /** 66일 점검에서 미통과해 챕터를 연장한 횟수 (1회 = 22일) */
  extensions: number
  createdAt: number
}

/** 하루 기록. 키는 [habitId, date]. */
export interface DayLog {
  habitId: string
  date: ISODate
  tier: Tier
  /** 그날 뽑은 퀘스트 카드 */
  cardId?: string
  minutes?: number
  memo?: string
  loggedAt: number
}

/** 챕터 첫날 기준 측정과 마지막 날 보스 측정 */
export interface Measurement {
  id: string
  habitId: string
  chapter: number
  kind: 'baseline' | 'boss'
  label: string
  value: number
  unit: string
  date: ISODate
}

/** 주간 리뷰 (일요일 10분) */
export interface WeeklyReview {
  /** `${habitId}|${weekStart}` */
  id: string
  habitId: string
  /** 그 주 월요일 */
  weekStart: ISODate
  missed: { date: ISODate; reason: string }[]
  /** 고친 if-then (선택) */
  ifThenChange?: { index: number; before: IfThen; after: IfThen }
  createdAt: number
}

/** 66일째 자기보고 자동화 지수 점검 (SRBAI, Gardner 외 2012) */
export interface SrbaiCheck {
  id: string
  habitId: string
  date: ISODate
  /** 4문항, 각 1~7 */
  answers: [number, number, number, number]
  mean: number
  passed: boolean
}

export interface Settings {
  key: 'main'
  /** 취침 시각. 백스톱 기본값 계산에 쓴다 */
  bedtime: HHmm
  /** 오늘 카드 다시 뽑기 기록: date → 횟수 */
  redraws: Record<ISODate, number>
  /** 오늘 뽑은 카드 고정: date → cardId */
  drawn: Record<ISODate, string>
}
