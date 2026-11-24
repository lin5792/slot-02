// 운동 말고 다른 습관 테마의 초보용 프리셋: 배우기(책·영어 단어), 마음(감사 일기·명상), 잠.
// 시간이나 개수가 정해져 세트 타이머로 돌릴 수 있는 습관만 골랐다. 근거는 docs/presets.md.
import type { Move, Plan, Session, Stage } from './plans'

const daily = (s: Session): Stage['week'] => [s, s, s, s, s, s, s]

// ---- 배우기: 책 읽기 (하루 쪽수) ----

/** 한 쪽 읽는 데 잡은 시간(초). 초보 기준 넉넉한 추정치다 (docs/presets.md) */
export const PAGE_SEC = 120
/** 챕터별 하루 쪽수. 1챕터에 얇은 책 한 권, 2·3챕터에 보통 책 한 권씩 끝내는 속도 */
export const PAGES_PER_DAY: Record<1 | 2 | 3, number> = { 1: 7, 2: 10, 3: 15 }

const readSession = (n: 1 | 2 | 3): Session => {
  const pages = PAGES_PER_DAY[n]
  return {
    id: `read-${n}`, title: `책 읽기 ${n}단계`, summary: `하루 ${pages}쪽`,
    moves: [{ name: '읽기', reps: pages, unit: '쪽', sec: pages * PAGE_SEC, cue: '알림은 끄고. 다 읽으면 먼저 끝내도 된다' }],
    roundRestSec: 0, rounds: { basic: 1, best: 2 },
    min: [{ name: '한 쪽만 읽기', reps: 1, unit: '쪽', sec: PAGE_SEC, cue: '딱 한 쪽' }],
  }
}
const READ = [readSession(1), readSession(2), readSession(3)]

// ---- 배우기: 영어 단어 (간격 복습 + 가리고 떠올리기) ----

const REVIEW: Move = {
  name: '지난 단어 떠올리기', sec: 180, cue: '1일·3일·7일 전에 외운 단어를 뜻을 가리고 떠올린다. 틀린 것만 다시 보기',
}
const vocabSession = (n: number, basic: number, best: number): Session => ({
  id: `vocab-${n}`, title: `영어 단어 ${n}단계`, summary: `새 단어 ${basic * 5}개 + 지난 단어 복습`,
  warmup: [REVIEW],
  moves: [
    { name: '새 단어 외우기', reps: 5, unit: '개', sec: 150, cue: '단어·뜻·예문 한 줄을 소리 내어 읽기' },
    { name: '가리고 떠올리기', sec: 60, cue: '방금 외운 5개를 뜻을 가리고 맞혀 본다' },
  ],
  roundRestSec: 0, rounds: { basic, best },
  min: [{ ...REVIEW, sec: 120 }],
})
const VOCAB = [vocabSession(1, 2, 3), vocabSession(2, 3, 4), vocabSession(3, 4, 5)]

// ---- 마음: 감사 일기 3줄 ----

const GRATITUDE: Session = {
  id: 'three-good-things', title: '감사 일기 3줄', summary: '오늘 좋았던 일 3가지와 그 이유',
  moves: [{
    name: '오늘 좋았던 일 적기', reps: 3, unit: '가지', sec: 180,
    cue: '작은 일도 좋다. 왜 좋았는지 한 줄씩 덧붙인다',
  }],
  roundRestSec: 0, rounds: { basic: 1, best: 2 },
  min: [{ name: '좋았던 일 한 가지', reps: 1, unit: '가지', sec: 60, cue: '한 줄이면 된다' }],
}

// ---- 마음: 마음챙김 명상 ----

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
  brysbaert2019: { label: 'Brysbaert 2019 (J Mem Lang): 성인 묵독 평균 분당 238단어(비문학)·260단어(소설)' },
  mcst2023: { label: '문체부 2023 국민 독서실태 조사: 성인 연간 독서율 43.0%, 하루 독서시간 18.5분', url: 'https://www.korea.kr/news/policyNewsView.do?newsId=148928309' },
  karpicke2008: { label: 'Karpicke & Roediger 2008 (Science): 단어 쌍을 다시 보기보다 떠올리기 시험을 반복할 때 일주일 뒤 기억이 훨씬 좋았다' },
  cepeda2006: { label: 'Cepeda 외 2006 (Psychol Bull): 몰아서 보다 간격을 두고 복습할 때 오래 기억한다 (메타분석)' },
  seligman2005: { label: 'Seligman 외 2005 (Am Psychol): 매일 밤 좋았던 일 3가지와 이유 적기 1주, 행복감 상승·우울 감소가 6개월까지' },
  basso2019: { label: 'Basso 외 2019 (Behav Brain Res): 명상 초보, 하루 13분 · 8주로 주의·기억·기분 개선', url: 'https://pubmed.ncbi.nlm.nih.gov/30153464/' },
  luo2024: { label: 'Luo 외 2024 (Front Psychol): 자기 전 점진적 근육 이완 7부위(힘 5~10초 · 이완 10~15초), 수면 질 개선', url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1337318/full' },
  zaccaro2018: { label: 'Zaccaro 외 2018 (Front Hum Neurosci): 분당 6회 안팎의 느린 호흡과 이완 반응 리뷰' },
}

export const LIFE_PLANS: Plan[] = [
  {
    id: 'reading', theme: 'focus', title: '책 읽기',
    promise: '하루 7쪽에서 15쪽으로, 66일에 약 700쪽 (책 2~3권)',
    forWho: '책을 사 두고 못 읽는 사람',
    rhythm: '매일 같은 때 (자기 전, 출퇴근길 등). 챕터마다 추천 책 목록(books.ts)에서 한 권',
    stages: [
      { fromDay: 1, week: daily(READ[0]) },
      { fromDay: 23, week: daily(READ[1]) },
      { fromDay: 45, week: daily(READ[2]) },
    ],
    sources: [SRC.mcst2023, SRC.brysbaert2019],
  },
  {
    id: 'vocab', theme: 'focus', title: '영어 단어',
    promise: '하루 단어 10개에서 20개로, 지난 단어는 간격 두고 다시',
    forWho: '영어 단어를 외워도 금방 잊는 사람',
    rhythm: '매일. 외운 날로부터 1일·3일·7일 뒤에 다시 떠올린다',
    stages: [
      { fromDay: 1, week: daily(VOCAB[0]) },
      { fromDay: 23, week: daily(VOCAB[1]) },
      { fromDay: 45, week: daily(VOCAB[2]) },
    ],
    sources: [SRC.karpicke2008, SRC.cepeda2006],
  },
  {
    id: 'gratitude', theme: 'mind', title: '감사 일기 3줄',
    promise: '자기 전 3분, 오늘 좋았던 일 3가지',
    forWho: '하루가 늘 별로였다고 느끼는 사람',
    rhythm: '매일 자기 전',
    stages: [{ fromDay: 1, week: daily(GRATITUDE) }],
    sources: [SRC.seligman2005],
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
