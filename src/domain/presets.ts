// 프리셋 목록. 고르는 화면은 테마 → 플랜 두 번만 누르면 된다.
import { sessionForDay, tierSeconds, timeline, type Plan, type Segment, type Session, type Theme, type ThemeId } from './plans'
import { EXERCISE_PLANS } from './presets-exercise'
import { LIFE_PLANS } from './presets-life'
import type { Tier } from './types'

export { EXERCISE_SAFETY } from './presets-exercise'

/** 운동이 먼저다. 나머지는 세트 타이머로 돌릴 수 있는 습관만 */
export const THEMES: Theme[] = [
  { id: 'exercise', title: '운동', oneLine: '목적만 고르면 세트·횟수·휴식이 정해진다' },
  { id: 'focus', title: '배우기', oneLine: '하루 몇 쪽, 단어 몇 개로 정해서' },
  { id: 'mind', title: '마음', oneLine: '감사 일기 3줄, 부모님께 연락' },
  { id: 'sleep', title: '잠', oneLine: '누워서 몸 힘 빼기' },
]

export const PLANS: Plan[] = [...EXERCISE_PLANS, ...LIFE_PLANS]

export function plansOf(theme: ThemeId): Plan[] {
  return PLANS.filter(p => p.theme === theme)
}

export function planById(id: string | undefined): Plan | undefined {
  return PLANS.find(p => p.id === id)
}

/** 그날 할 것 한 번에: 세션, 단계별 총 시간(초), 단계별 타이머 구간 */
export function dayOfPlan(plan: Plan, day: number): {
  session: Session
  seconds: Record<Tier, number>
  segments: Record<Tier, Segment[]>
} {
  const session = sessionForDay(plan, day)
  return {
    session,
    seconds: tierSeconds(session),
    segments: { min: timeline(session, 'min'), basic: timeline(session, 'basic'), best: timeline(session, 'best') },
  }
}
