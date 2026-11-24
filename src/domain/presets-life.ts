// 운동 말고 다른 습관 테마의 초보용 프리셋: 집중·공부, 마음·호흡, 잠.
// 세트 타이머로 돌릴 수 있는(시간과 쉬는 시간이 있는) 습관만 골랐다. 근거는 docs/presets.md.
import type { Move, Plan, Session, Stage } from './plans'

const daily = (s: Session): Stage['week'] => [s, s, s, s, s, s, s]

// ---- 집중·공부: 포모도로 (짧게 시작해 25분 · 5분으로) ----

const focus = (min: number, breakMin: number): Move => ({
  name: '집중', sec: min * 60, restSec: breakMin * 60, restAs: '쉬기',
  cue: '한 가지만. 휴대폰은 다른 방에',
})
const PICK_TASK: Move[] = [{ name: '할 일 하나 정하기', sec: 60, cue: '이번에 끝낼 것을 한 줄로 적는다' }]
const pomodoro = (n: number, min: number, breakMin: number, basic: number, best: number): Session => ({
  id: `focus-${n}`, title: `집중 ${n}단계`, summary: `${min}분 집중 · ${breakMin}분 쉬기 × ${basic}번`,
  warmup: PICK_TASK, moves: [focus(min, breakMin)], roundRestSec: 0, rounds: { basic, best },
  min: [{ ...focus(10, 0), restSec: undefined }],
})
const FOCUS_1 = pomodoro(1, 15, 5, 2, 3)
const FOCUS_2 = pomodoro(2, 20, 5, 2, 3)
const FOCUS_3 = pomodoro(3, 25, 5, 2, 4)

const read = (n: number, basic: number, best: number): Session => ({
  id: `read-${n}`, title: `책 읽기 ${n}단계`, summary: `${basic * 5}분 읽기`,
  moves: [{ name: '읽기', sec: 300, cue: '종이책이나 전자책. 알림은 끄고' }],
  roundRestSec: 0, rounds: { basic, best },
  min: [{ name: '한 쪽만 읽기', sec: 120, cue: '딱 한 쪽, 2분' }],
})
const READ_1 = read(1, 2, 3)
const READ_2 = read(2, 3, 4)
const READ_3 = read(3, 4, 6)

// ---- 마음·호흡 ----

const SIGH: Move = {
  name: '주기적 한숨 호흡', sec: 300,
  cue: '코로 깊게 들이쉬고 한 번 더 짧게 채운 뒤, 입으로 길고 천천히 내쉬기',
}
const SIGHING: Session = {
  id: 'cyclic-sigh', title: '숨 고르기 5분', summary: '두 번 들이쉬고 길게 내쉬기 5분',
  moves: [SIGH], roundRestSec: 0, rounds: { basic: 1, best: 2 },
  min: [{ ...SIGH, sec: 60 }],
}

const SIT: Move[] = [{ name: '자세 잡기', sec: 30, cue: '등을 펴고 앉아 눈을 감거나 아래를 본다' }]
const meditation = (n: number, basic: number, best: number): Session => ({
  id: `meditate-${n}`, title: `마음챙김 ${n}단계`, summary: `호흡 바라보기 ${basic * 5}분`,
  warmup: SIT,
  moves: [{ name: '호흡에 주의 두기', sec: 300, cue: '생각이 떠오르면 알아차리고 다시 숨으로 돌아온다' }],
  roundRestSec: 0, rounds: { basic, best },
  min: [{ name: '숨 열 번 세기', sec: 60, cue: '내쉴 때마다 하나씩' }],
})
const MEDITATE_1 = meditation(1, 1, 2)
const MEDITATE_2 = meditation(2, 2, 3)
const MEDITATE_3 = meditation(3, 3, 4)

// ---- 잠: 점진적 근육 이완(7부위) + 느린 호흡 ----

const tense = (name: string, cue: string): Move => ({ name, sec: 7, cue, restSec: 15, restAs: '힘 풀고 느끼기' })
const SLOW_BREATH: Move = { name: '느린 호흡', sec: 180, cue: '4초 들이쉬고 6초 내쉬기' }
const PMR: Session = {
  id: 'pmr', title: '근육 이완', summary: '7부위 힘주고 풀기 × 2바퀴 + 느린 호흡',
  warmup: [{ name: '화면 끄고 눕기', sec: 60, cue: '불을 끄고 편하게 눕는다' }],
  moves: [
    tense('손·팔', '주먹을 쥐고 팔 전체에 힘을 7초'),
    tense('얼굴', '이마를 찌푸리고 눈을 꼭 감고 이를 문다'),
    tense('목·어깨', '어깨를 귀 쪽으로 끌어올린다'),
    tense('가슴·등', '숨을 들이쉬며 날개뼈를 모은다'),
    tense('배', '배에 힘을 주어 단단하게'),
    tense('엉덩이·허벅지', '엉덩이와 허벅지를 조인다'),
    tense('종아리·발', '발끝을 몸 쪽으로 당긴다'),
  ],
  roundRestSec: 30, rounds: { basic: 2, best: 3 },
  cooldown: [SLOW_BREATH],
  min: [{ ...SLOW_BREATH, sec: 120 }],
}

const SRC = {
  smits2025: { label: 'Smits 외 2025 (Behav Sci): 25분 · 5분 포모도로 vs 스스로 쉬기, 생산성·과제 완수 차이 없음', url: 'https://www.mdpi.com/2076-328X/15/7/861' },
  goksu2026: { label: 'Göksu 외 2026 (Behav Sci): 12분 · 3분 고정 휴식 vs 스스로 쉬기, 이해도 차이 없음·기분은 스스로 쉬기가 나음', url: 'https://www.mdpi.com/2076-328X/16/7/1158' },
  bavishi2016: { label: 'Bavishi 외 2016 (Soc Sci Med): 책 읽는 사람의 수명이 더 길었다 (관찰 연구)' },
  balban2023: { label: 'Balban 외 2023 (Cell Rep Med): 하루 5분 · 28일, 주기적 한숨 호흡이 기분 개선·호흡수 감소에서 가장 좋았다', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947' },
  basso2019: { label: 'Basso 외 2019 (Behav Brain Res): 명상 초보, 하루 13분 · 8주로 주의·기억·기분 개선', url: 'https://pubmed.ncbi.nlm.nih.gov/30153464/' },
  luo2024: { label: 'Luo 외 2024 (Front Psychol): 자기 전 점진적 근육 이완 7부위(힘 5~10초 · 이완 10~15초), 수면 질 개선', url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1337318/full' },
  zaccaro2018: { label: 'Zaccaro 외 2018 (Front Hum Neurosci): 분당 6회 안팎의 느린 호흡과 이완 반응 리뷰' },
}

export const LIFE_PLANS: Plan[] = [
  {
    id: 'study', theme: 'focus', title: '공부 집중',
    promise: '15분 집중으로 시작해 25분 · 5분 포모도로로',
    forWho: '앉으면 딴짓부터 하는 사람',
    rhythm: '매일. 흐름을 타면 쉬는 시간을 건너뛰어도 된다 (고정 휴식이 더 낫다는 근거는 없다)',
    stages: [
      { fromDay: 1, week: daily(FOCUS_1) },
      { fromDay: 23, week: daily(FOCUS_2) },
      { fromDay: 45, week: daily(FOCUS_3) },
    ],
    sources: [SRC.smits2025, SRC.goksu2026],
  },
  {
    id: 'reading', theme: 'focus', title: '책 읽기',
    promise: '하루 10분에서 20분으로',
    forWho: '책을 사 두고 못 읽는 사람',
    rhythm: '매일 같은 때 (자기 전, 출퇴근길 등)',
    stages: [
      { fromDay: 1, week: daily(READ_1) },
      { fromDay: 23, week: daily(READ_2) },
      { fromDay: 45, week: daily(READ_3) },
    ],
    sources: [SRC.bavishi2016],
  },
  {
    id: 'breathe', theme: 'mind', title: '숨 고르기',
    promise: '하루 5분 호흡으로 긴장 낮추기',
    forWho: '스트레스가 많고 명상은 어려운 사람',
    rhythm: '매일 5분. 긴장되는 때에 한 번 더 해도 좋다',
    stages: [{ fromDay: 1, week: daily(SIGHING) }],
    sources: [SRC.balban2023],
  },
  {
    id: 'meditate', theme: 'mind', title: '마음챙김 명상',
    promise: '5분에서 15분으로, 8주 넘게 매일',
    forWho: '집중력·기분을 다스리고 싶은 명상 초보',
    rhythm: '매일. 5분마다 종이 한 번 울린다',
    stages: [
      { fromDay: 1, week: daily(MEDITATE_1) },
      { fromDay: 23, week: daily(MEDITATE_2) },
      { fromDay: 45, week: daily(MEDITATE_3) },
    ],
    sources: [SRC.basso2019],
  },
  {
    id: 'sleep', theme: 'sleep', title: '잠들기 루틴',
    promise: '누워서 10분, 몸 힘 빼고 잠들기',
    forWho: '누워도 잠이 안 오는 사람',
    rhythm: '매일 잠자리에 누워서',
    stages: [{ fromDay: 1, week: daily(PMR) }],
    sources: [SRC.luo2024, SRC.zaccaro2018],
  },
]
