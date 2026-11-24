// 초보용 플랜 프리셋의 틀과 세트 타이머가 바로 쓰는 구간(Segment) 계산.
// 프리셋 데이터는 presets-exercise.ts(운동), presets-life.ts(집중·마음·잠)에 있다.
// 사용자는 테마 → 플랜만 고르면 되고, 오늘 할 세션·세트·횟수·휴식은 여기서 날짜(일차)로 정해진다.
import type { Tier } from './types'

export type ThemeId = 'exercise' | 'focus' | 'mind' | 'sleep'

/** 동작 하나 = 한 세트 */
export interface Move {
  name: string
  /** 어떻게 하는지 한 줄 */
  cue?: string
  /** 횟수 운동이면 횟수. 시간 운동(버티기·걷기·집중 등)이면 비운다 */
  reps?: number
  /**
   * 좌우 각각. 시간 운동이면 왼쪽·오른쪽 두 구간으로 나뉘고 각 구간이 sec초다.
   * 횟수 운동이면 한 구간이고 sec는 양쪽을 합친 예상 시간이다.
   */
  each?: boolean
  /** 한 세트 시간(초). 횟수 운동은 예상 시간이라 다 하면 먼저 넘겨도 된다 */
  sec: number
  /** 이 동작 뒤 쉬는 시간(초). 바퀴의 마지막 동작 뒤에는 세션의 roundRestSec을 먼저 쓴다 */
  restSec?: number
  /** 쉬는 구간 이름. 기본 '쉬기' (예: 달리기 사이 '걷기') */
  restAs?: string
}

/** 하루치 세션. 동작 목록(moves)을 한 바퀴로 정해진 바퀴 수만큼 돈다 */
export interface Session {
  id: string
  title: string
  /** 고르는 화면·홈에 보이는 한 줄 */
  summary: string
  warmup?: Move[]
  moves: Move[]
  /** 바퀴 사이 휴식(초). 0이면 마지막 동작의 restSec을 쓴다 */
  roundRestSec: number
  rounds: { basic: number; best: number }
  cooldown?: Move[]
  /** 최소 단계: 준비·정리 없이 이것만 한 번. 없으면 moves 한 바퀴 */
  min?: Move[]
}

/** fromDay 일차부터 쓰는 7일 순서. 요일이 아니라 1일차 기준으로 돈다 */
export interface Stage {
  fromDay: number
  week: [Session, Session, Session, Session, Session, Session, Session]
}

export interface SourceRef {
  label: string
  url?: string
}

export interface Plan {
  id: string
  theme: ThemeId
  title: string
  /** 고르는 카드의 한 줄 약속 */
  promise: string
  /** 이런 사람에게 */
  forWho: string
  /** 일주일 리듬 설명 */
  rhythm: string
  /** fromDay 오름차순. 첫 단계는 1일차. 마지막 단계는 66일 이후(연장 챕터)에도 계속 쓴다 */
  stages: Stage[]
  sources: SourceRef[]
}

export interface Theme {
  id: ThemeId
  title: string
  oneLine: string
}

/** 세트 타이머가 순서대로 재생하는 구간 */
export interface Segment {
  kind: 'warmup' | 'work' | 'rest' | 'cooldown'
  label: string
  sec: number
  reps?: number
  each?: boolean
  /** 좌우가 나뉜 시간 운동의 쪽 */
  side?: 'left' | 'right'
  cue?: string
  /** work·rest: 몇 번째 바퀴 / 전체 바퀴 */
  round?: number
  rounds?: number
  /** rest: 다음에 할 동작 */
  next?: string
}

export function stageForDay(plan: Plan, day: number): Stage {
  let s = plan.stages[0]
  for (const st of plan.stages) if (st.fromDay <= day) s = st
  return s
}

/** 프로그램 n일차(1부터)에 할 세션 */
export function sessionForDay(plan: Plan, day: number): Session {
  const d = Math.max(1, Math.floor(day))
  return stageForDay(plan, d).week[(d - 1) % 7]
}

function moveSegments(m: Move, kind: Segment['kind'], extra: Partial<Segment> = {}): Segment[] {
  const base: Segment = { kind, label: m.name, sec: m.sec, ...extra }
  if (m.cue) base.cue = m.cue
  if (m.reps !== undefined) base.reps = m.reps
  if (m.each) base.each = true
  if (m.each && m.reps === undefined) {
    return [
      { ...base, label: `${m.name} (왼쪽)`, side: 'left' },
      { ...base, label: `${m.name} (오른쪽)`, side: 'right' },
    ]
  }
  return [base]
}

function rest(sec: number, label: string, next: string, round: number, rounds: number): Segment {
  return { kind: 'rest', label, sec, next, round, rounds }
}

/** 세션을 단계(최소·기본·최고)에 맞춰 타이머 구간으로 편다 */
export function timeline(session: Session, tier: Tier): Segment[] {
  if (tier === 'min') {
    const moves = session.min ?? session.moves
    return circuit(moves, 1, 0)
  }
  const rounds = session.rounds[tier]
  return [
    ...(session.warmup ?? []).flatMap(m => moveSegments(m, 'warmup')),
    ...circuit(session.moves, rounds, session.roundRestSec),
    ...(session.cooldown ?? []).flatMap(m => moveSegments(m, 'cooldown')),
  ]
}

function circuit(moves: Move[], rounds: number, roundRestSec: number): Segment[] {
  const out: Segment[] = []
  for (let r = 1; r <= rounds; r++) {
    moves.forEach((m, i) => {
      out.push(...moveSegments(m, 'work', { round: r, rounds }))
      const lastInRound = i === moves.length - 1
      if (lastInRound && r === rounds) return
      const sec = lastInRound && roundRestSec > 0 ? roundRestSec : m.restSec ?? 0
      if (sec <= 0) return
      const next = moves[lastInRound ? 0 : i + 1].name
      out.push(rest(sec, m.restAs ?? '쉬기', next, r, rounds))
    })
  }
  return out
}

export function totalSec(segments: Segment[]): number {
  return segments.reduce((s, g) => s + g.sec, 0)
}

/** 단계별 총 시간(초). 고르는 화면에 "최소 3분 · 기본 15분 · 최고 21분"처럼 보여 준다 */
export function tierSeconds(session: Session): Record<Tier, number> {
  return {
    min: totalSec(timeline(session, 'min')),
    basic: totalSec(timeline(session, 'basic')),
    best: totalSec(timeline(session, 'best')),
  }
}

/**
 * 직접 정하는 세트 타이머(세트 수 · 세트당 운동 시간 · 세트 사이 휴식)도 같은 구간으로 만든다.
 * 프리셋과 직접 설정이 한 타이머를 쓰게 하려는 것이다.
 */
export function uniformTimeline(o: { sets: number; workSec: number; restSec: number; name?: string }): Segment[] {
  const move: Move = { name: o.name ?? '운동', sec: o.workSec, restSec: o.restSec }
  return circuit([move], Math.max(1, Math.floor(o.sets)), 0)
}

