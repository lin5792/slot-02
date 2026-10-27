import type { Block, Habit } from '../../domain/types'

export const habit: Habit = {
  id: 'h1',
  title: '매일 운동',
  tiers: { min: '스쿼트 10회', basic: '카드 퀘스트 20분', best: '컨디션 좋은 날 40분' },
  intention: { anchorEvent: '퇴근 후 현관문을 닫으면', place: '거실', action: '운동복으로 갈아입는다' },
  ifThen: [],
  anchorTime: '19:00',
  backstopTime: '22:30',
  startDate: '2026-10-28',
  status: 'active',
  extensions: 0,
  createdAt: 0,
}

export const blocks: Block[] = [
  { id: 'work', layer: 'L0', title: '근무', start: '09:00', end: '18:00', weekdays: [1, 2, 3, 4, 5], createdAt: 0 },
  { id: 'sleep', layer: 'L1', title: '수면, 7시간 이상; 지킴', start: '23:30', end: '06:30', weekdays: [0, 1, 2, 3, 4, 5, 6], createdAt: 0 },
  { id: 'none', layer: 'L3', title: '요일 없음', start: '10:00', end: '11:00', weekdays: [], createdAt: 0 },
]
