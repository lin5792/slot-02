// 스킬은 승급 시험에 합격해야만 생긴다. 시험 기록(SkillAttempt)만 저장하고,
// 합격·보유·응시 가능 여부는 여기서 기준과 비교해 매번 계산한다.
import { RETEST_DAYS, SRBAI_PASS_MEAN } from './rules'
import { addDays } from './time'
import type { ISODate, SkillAttempt, SrbaiCheck } from './types'

export type SkillEffect =
  | { kind: 'goldPct'; pct: number }
  | { kind: 'bestGold'; gold: number }
  | { kind: 'encoreX2' }
  | { kind: 'comebackX2' }
  | { kind: 'restX2' }

export type SkillTest =
  | { kind: 'count'; family: string; label: string; target: number }
  | { kind: 'seconds'; family: string; label: string; target: number }
  /** 자동성 4문항(SRBAI) 평균 */
  | { kind: 'srbai'; minMean: number }
  /** 66일 점검 통과 = 정착. 퀘스트 화면의 점검으로 얻는다 */
  | { kind: 'settle' }

export interface SkillDef {
  id: string
  branch: 'strength' | 'core' | 'will'
  title: string
  prev?: string
  /** 응시 조건: 메인 퀘스트를 깬 날 수, 또는 지금 습관의 일차 */
  requires: { clears?: number; day?: number }
  test: SkillTest
  effect: SkillEffect
  effectLabel: string
}

export const BRANCHES = [
  { id: 'strength', title: '근력' },
  { id: 'core', title: '코어' },
  { id: 'will', title: '의지' },
] as const

export const SKILLS: SkillDef[] = [
  { id: 'pushup1', branch: 'strength', title: '푸시업 I', requires: { clears: 5 },
    test: { kind: 'count', family: 'pushup', label: '푸시업 연속', target: 10 },
    effect: { kind: 'goldPct', pct: 5 }, effectLabel: '골드 +5%' },
  { id: 'pushup2', branch: 'strength', title: '푸시업 II', prev: 'pushup1', requires: { clears: 15 },
    test: { kind: 'count', family: 'pushup', label: '푸시업 연속', target: 20 },
    effect: { kind: 'goldPct', pct: 10 }, effectLabel: '골드 +10%' },
  { id: 'pushup3', branch: 'strength', title: '푸시업 III', prev: 'pushup2', requires: { clears: 30 },
    test: { kind: 'count', family: 'pushup', label: '푸시업 연속', target: 30 },
    effect: { kind: 'goldPct', pct: 15 }, effectLabel: '골드 +15%' },
  { id: 'plank1', branch: 'core', title: '플랭크 I', requires: { clears: 10 },
    test: { kind: 'seconds', family: 'plank', label: '플랭크 버티기', target: 60 },
    effect: { kind: 'bestGold', gold: 10 }, effectLabel: '최고 단계 +10 G' },
  { id: 'plank2', branch: 'core', title: '플랭크 II', prev: 'plank1', requires: { clears: 25 },
    test: { kind: 'seconds', family: 'plank', label: '플랭크 버티기', target: 120 },
    effect: { kind: 'encoreX2' }, effectLabel: '앵콜 골드 2배' },
  { id: 'will1', branch: 'will', title: '22일 점검', requires: { day: 22 },
    test: { kind: 'srbai', minMean: 4 }, effect: { kind: 'comebackX2' }, effectLabel: '복귀 보너스 2배' },
  { id: 'will2', branch: 'will', title: '44일 점검', prev: 'will1', requires: { day: 44 },
    test: { kind: 'srbai', minMean: 4.5 }, effect: { kind: 'restX2' }, effectLabel: '휴식 보너스 2배' },
  { id: 'will3', branch: 'will', title: '66일 각인', requires: { day: 66 },
    test: { kind: 'settle' }, effect: { kind: 'goldPct', pct: 10 }, effectLabel: '골드 +10% · 습관 졸업' },
]

export const skillById = (id: string) => SKILLS.find(s => s.id === id)

export function passes(def: SkillDef, value: number): boolean {
  const t = def.test
  if (t.kind === 'srbai') return value >= t.minMean
  if (t.kind === 'settle') return value >= SRBAI_PASS_MEAN
  return value >= t.target
}

export type SkillStatus = 'owned' | 'ready' | 'cooldown' | 'locked'

export interface SkillState {
  def: SkillDef
  status: SkillStatus
  /** 합격한 날 */
  acquiredOn: ISODate | null
  /** 떨어진 뒤 다시 볼 수 있는 날 */
  retestOn: ISODate | null
  /** 같은 종목(푸시업, 플랭크) 최고 기록 */
  best: number | null
  /** 잠겨 있을 때 무엇이 모자란지 */
  need: { clears?: { have: number; need: number }; day?: { have: number; need: number }; prev?: string } | null
}

export interface SkillContext {
  attempts: SkillAttempt[]
  srbai: SrbaiCheck[]
  /** 메인 퀘스트를 깬 날 수 (모든 습관 합) */
  clears: number
  /** 지금 습관의 일차 (없으면 0) */
  day: number
  today: ISODate
}

const byTime = (a: SkillAttempt, b: SkillAttempt) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt

export function skillStates(ctx: SkillContext): SkillState[] {
  const attempts = [...ctx.attempts].sort(byTime)
  const out: SkillState[] = []
  const owned = new Map<string, ISODate>()

  for (const def of SKILLS) {
    const mine = attempts.filter(a => a.skillId === def.id)
    const t = def.test
    const family = t.kind === 'count' || t.kind === 'seconds' ? t.family : null
    const familyValues = family
      ? attempts.filter(a => (skillById(a.skillId)?.test as { family?: string } | undefined)?.family === family).map(a => a.value)
      : []
    const best = familyValues.length ? Math.max(...familyValues) : null

    let acquiredOn: ISODate | null = null
    if (t.kind === 'settle') {
      const pass = ctx.srbai.filter(c => c.passed).sort((a, b) => a.date.localeCompare(b.date))[0]
      acquiredOn = pass?.date ?? null
    } else {
      acquiredOn = mine.find(a => passes(def, a.value))?.date ?? null
    }
    if (acquiredOn) {
      owned.set(def.id, acquiredOn)
      out.push({ def, status: 'owned', acquiredOn, retestOn: null, best, need: null })
      continue
    }

    const need: NonNullable<SkillState['need']> = {}
    if (def.prev && !owned.has(def.prev)) need.prev = skillById(def.prev)!.title
    if (def.requires.clears && ctx.clears < def.requires.clears) need.clears = { have: ctx.clears, need: def.requires.clears }
    if (def.requires.day && ctx.day < def.requires.day) need.day = { have: Math.max(0, ctx.day), need: def.requires.day }
    if (need.prev || need.clears || need.day || t.kind === 'settle') {
      out.push({ def, status: 'locked', acquiredOn: null, retestOn: null, best, need })
      continue
    }

    const last = mine[mine.length - 1]
    const retestOn = last ? addDays(last.date, RETEST_DAYS) : null
    const cooling = !!retestOn && retestOn > ctx.today
    out.push({ def, status: cooling ? 'cooldown' : 'ready', acquiredOn: null, retestOn: cooling ? retestOn : null, best, need: null })
  }
  return out
}

/** 그날 효력이 있는 스킬 효과 (합격한 날부터 적용) */
export interface Effects {
  goldPct: number
  bestGold: number
  encoreX2: boolean
  comebackX2: boolean
  restX2: boolean
}

export function effectsOn(states: SkillState[], date: ISODate): Effects {
  const e: Effects = { goldPct: 0, bestGold: 0, encoreX2: false, comebackX2: false, restX2: false }
  for (const s of states) {
    if (!s.acquiredOn || s.acquiredOn > date) continue
    const f = s.def.effect
    if (f.kind === 'goldPct') e.goldPct += f.pct
    else if (f.kind === 'bestGold') e.bestGold += f.gold
    else e[f.kind] = true
  }
  return e
}

/**
 * 떨어졌지만 같은 종목 개인 기록을 깬 시험. 첫 시험은 기준점이라 제외한다.
 */
export function recordBreaks(attempts: SkillAttempt[]): SkillAttempt[] {
  const best = new Map<string, number>()
  const out: SkillAttempt[] = []
  for (const a of [...attempts].sort(byTime)) {
    const def = skillById(a.skillId)
    if (!def) continue
    const t = def.test
    if (t.kind !== 'count' && t.kind !== 'seconds') continue
    const prev = best.get(t.family)
    if (prev !== undefined && a.value > prev && !passes(def, a.value)) out.push(a)
    best.set(t.family, Math.max(prev ?? -Infinity, a.value))
  }
  return out
}
