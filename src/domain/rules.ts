// 설계 문서 v0의 수치. 모두 시작값이며 바꿔도 로직은 그대로 돈다.
import type { Tier } from './types'

export const TIER_ORDER: Tier[] = ['min', 'basic', 'best']
export const TIER_LABEL: Record<Tier, string> = { min: '최소', basic: '기본', best: '최고' }

/** 그날 달성한 가장 높은 단계의 XP (누적 아님) */
export const TIER_XP: Record<Tier, number> = { min: 10, basic: 30, best: 50 }

/** 기본을 놓친 다음 날 기본 이상을 하면 */
export const COMEBACK_XP = 20
/** 그 주 실드를 쓰지 않고 넘기면 주말에 환전 */
export const SHIELD_CASH_XP = 20
export const SHIELDS_PER_WEEK = 1

export const PROGRAM_DAYS = 66
export const CHAPTER_DAYS = 22

export interface ChapterRule {
  n: number
  name: string
  /** 기본 퀘스트 상한(분). null이면 상한 없음 */
  capMin: number | null
  bossLabel: string
}

const CHAPTERS: ChapterRule[] = [
  { n: 1, name: '챕터 1 · 불씨', capMin: 20, bossLabel: '푸시업 최대 개수' },
  { n: 2, name: '챕터 2 · 불길', capMin: 30, bossLabel: '플랭크 최대 시간(초)' },
  { n: 3, name: '챕터 3 · 화염', capMin: 45, bossLabel: '푸시업 최대 개수' },
]

/** 66일 점검에서 미통과하면 같은 규칙의 연장 챕터가 붙는다 */
export function chapterRule(n: number): ChapterRule {
  if (n <= CHAPTERS.length) return CHAPTERS[n - 1]
  return { n, name: `연장 챕터 ${n - CHAPTERS.length}`, capMin: null, bossLabel: '푸시업 최대 개수' }
}

/** 레벨 L에 도달하는 누적 XP = 50·L·(L−1). L2=100, L3=300, L4=600, L5=1000 … */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export function levelForXp(xp: number): number {
  let l = 1
  while (xpForLevel(l + 1) <= xp) l++
  return l
}

export const SRBAI_ITEMS = [
  '자동으로 한다',
  '의식적으로 기억하지 않아도 한다',
  '생각하지 않고 한다',
  '하고 있다는 걸 알아차리기 전에 시작한다',
] as const
/** 평균 5점 이상이면 정착. 설계 선택 */
export const SRBAI_PASS_MEAN = 5

export function tierAtLeast(t: Tier | null | undefined, min: Tier): boolean {
  if (!t) return false
  return TIER_ORDER.indexOf(t) >= TIER_ORDER.indexOf(min)
}

// ---- 골드 (퀘스트 보상). XP와 같은 방식으로 기록에서 매번 계산한다 ----

/** 메인 퀘스트 단계별 골드 */
export const TIER_GOLD: Record<Tier, number> = { min: 10, basic: 30, best: 50 }
export const COMEBACK_GOLD = 20
export const DEFAULT_SIDE_GOLD = 20

/** 앵콜 한 판: 클리어 직후 3분, 하루 1번 */
export const ENCORE_MIN = 3
export const ENCORE_GOLD = 10
/** 참고 저장: 다음 날 메인 퀘스트 골드에 이만큼 더 붙는다 (×1.5) */
export const REST_BONUS_RATE = 0.5

/** 주간 상자: 월~일 메인 퀘스트 5번. 진척 막대는 2칸 채워진 채로 시작한다 (부여된 진척) */
export const WEEKLY_CHEST_GOAL = 5
export const WEEKLY_CHEST_GIFT = 2
export const WEEKLY_CHEST_GOLD = 100

/** 봉인 상자: 깬 날 받고, 다음에 메인 퀘스트를 깨는 날 열린다 */
export const SEALED_CHEST_MIN = 20
export const SEALED_CHEST_MAX = 60

/** 깜짝 상자: 퀘스트를 깰 때 가끔 */
export const SURPRISE_RATE = 0.2
export const SURPRISE_GOLD = 30

/** 시험에 떨어져도 개인 기록을 깨면 */
export const RECORD_GOLD = 30
/** 떨어지면 이만큼 지나야 다시 본다 */
export const RETEST_DAYS = 3

/** 앵콜 3분에 하는 것. 날짜로 하나 고른다 */
export const ENCORE_MOVES = ['버피 10개', '스쿼트 20개', '플랭크 40초', '푸시업 10개', '런지 좌우 10개', '점핑잭 40개'] as const
