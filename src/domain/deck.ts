// 기본 퀘스트 카드 덱. 매일 같은 운동의 지루함을 막고, 레벨이 오르면 카드가 해금된다.
// 개인 맞춤(도구, 현재 수준)은 보류 상태라 맨몸·실내 위주의 범용 카드로 시작한다.
import type { ISODate } from './types'

export interface QuestCard {
  id: string
  title: string
  /** 무엇을 하는가. 마지막 줄은 항상 추스름(강도 낮추기)이다 */
  steps: string[]
  minutes: number
  unlockLevel: number
  tag: '유산소' | '근력' | '유연성' | '혼합'
}

const COOL = '마지막 2분: 천천히 걷거나 스트레칭으로 추스름'

export const DECK: QuestCard[] = [
  { id: 'walk', title: '동네 한 바퀴', tag: '유산소', minutes: 20, unlockLevel: 1,
    steps: ['빠르게 걷기 15분 (말은 되지만 노래는 힘든 속도)', COOL] },
  { id: 'push-squat', title: '푸시업 · 스쿼트 서킷', tag: '근력', minutes: 15, unlockLevel: 1,
    steps: ['푸시업 8회 + 스쿼트 15회 = 1세트', '세트 사이 1분 휴식, 4세트', COOL] },
  { id: 'stretch', title: '전신 스트레칭', tag: '유연성', minutes: 15, unlockLevel: 1,
    steps: ['목·어깨·가슴 3분', '고관절·햄스트링 5분', '종아리·발목 3분', COOL] },
  { id: 'stairs', title: '계단 오르기', tag: '유산소', minutes: 15, unlockLevel: 1,
    steps: ['계단 3~5층 오르고 걸어서 내려오기 반복 10분', COOL] },
  { id: 'core', title: '코어 다지기', tag: '근력', minutes: 15, unlockLevel: 2,
    steps: ['플랭크 30초 · 데드버그 10회 · 버드독 10회 = 1세트', '3세트', COOL] },
  { id: 'interval-walk', title: '인터벌 걷기', tag: '유산소', minutes: 20, unlockLevel: 2,
    steps: ['보통 걷기 3분 → 빠르게 걷기 1분, 4회 반복', COOL] },
  { id: 'lunge', title: '런지 챌린지', tag: '근력', minutes: 15, unlockLevel: 3,
    steps: ['런지 좌우 10회 + 글루트 브릿지 15회 = 1세트', '3세트', COOL] },
  { id: 'dance', title: '음악 3곡 댄스', tag: '혼합', minutes: 15, unlockLevel: 3,
    steps: ['좋아하는 노래 3곡 동안 멈추지 않고 움직이기', COOL] },
  { id: 'yoga', title: '요가 플로우', tag: '유연성', minutes: 20, unlockLevel: 4,
    steps: ['태양 경배 5회', '전사 자세 좌우 각 30초 · 비둘기 자세 좌우 각 1분', COOL] },
  { id: 'tabata', title: '타바타 4분', tag: '혼합', minutes: 15, unlockLevel: 5,
    steps: ['워밍업 걷기 4분', '20초 전력 · 10초 휴식 × 8 (버피·점핑잭 번갈아)', COOL] },
  { id: 'jog', title: '가벼운 조깅', tag: '유산소', minutes: 25, unlockLevel: 6,
    steps: ['걷기 3분 → 조깅 2분, 4회 반복', COOL] },
]

export function unlockedCards(level: number): QuestCard[] {
  return DECK.filter(c => c.unlockLevel <= level)
}

export function cardById(id: string | undefined): QuestCard | undefined {
  return DECK.find(c => c.id === id)
}

/** 다음 레벨에 해금될 카드 (예고용) */
export function nextUnlocks(level: number): QuestCard[] {
  const next = DECK.filter(c => c.unlockLevel > level).map(c => c.unlockLevel)
  if (!next.length) return []
  const lv = Math.min(...next)
  return DECK.filter(c => c.unlockLevel === lv)
}

// 날짜·습관·다시뽑기 횟수로 정해지는 결정적 뽑기. 같은 날 다시 열어도 같은 카드가 나온다.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function drawCard(level: number, habitId: string, date: ISODate, redraw = 0, avoidId?: string): QuestCard {
  const pool = unlockedCards(level)
  let card = pool[hash(`${habitId}|${date}|${redraw}`) % pool.length]
  // 다시 뽑기는 직전 카드와 다른 카드를 준다
  if (avoidId && card.id === avoidId && pool.length > 1) {
    card = pool[(pool.indexOf(card) + 1) % pool.length]
  }
  return card
}

export const REDRAWS_PER_DAY = 1
