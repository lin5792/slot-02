// 초보용 운동 플랜 프리셋. 맨몸·집 안·도구 없이 할 수 있는 것만 넣었다.
// 근거와 고른 이유는 docs/presets.md. 기본 세션은 챕터 상한(20/30/45분) 안에 들어온다 (테스트로 확인).
import type { Move, Plan, Session, Stage } from './plans'

/** 횟수 운동 한 회당 예상 시간(초). 내려갈 때 2초, 올라올 때 1초쯤 */
const PER_REP = 3

const reps = (name: string, n: number, cue: string, restSec = 30): Move =>
  ({ name, reps: n, sec: Math.max(20, n * PER_REP), cue, restSec })
const repsEach = (name: string, n: number, cue: string, restSec = 30): Move =>
  ({ name, reps: n, each: true, sec: n * PER_REP * 2, cue, restSec })
const hold = (name: string, sec: number, cue: string, restSec = 30): Move => ({ name, sec, cue, restSec })
const holdEach = (name: string, sec: number, cue: string, restSec = 10): Move => ({ name, sec, each: true, cue, restSec })

const week = (...s: Stage['week']): Stage['week'] => s

/** 운동 시작 전 공통 안내 (ACSM 사전 점검 원칙을 줄인 것) */
export const EXERCISE_SAFETY = [
  '가슴 통증, 심한 어지럼, 평소와 다른 숨참이 오면 바로 멈춘다.',
  '심장·혈압 질환, 임신, 수술 직후라면 시작 전에 의사와 상의한다.',
  '근력 운동은 2~3회 더 할 수 있을 때 멈춘다. 끝까지 쥐어짤 필요 없다.',
  '유산소는 말은 되지만 노래는 힘든 속도가 "중간 강도"다.',
]

// ---- 준비·정리 ----

const WARM: Move[] = [
  { name: '제자리 걷기', sec: 90, cue: '팔을 크게 흔들며 점점 빠르게' },
  { name: '팔·어깨 돌리기', sec: 30, cue: '앞으로 10번, 뒤로 10번' },
  { name: '반만 앉는 스쿼트', sec: 60, cue: '엉덩이를 뒤로 빼며 천천히, 몸 데우기' },
]
const COOL: Move[] = [
  { name: '천천히 걷기', sec: 60, cue: '숨이 고를 때까지' },
  { name: '허벅지 앞 스트레칭', sec: 30, each: true, cue: '한 발을 뒤로 잡아 엉덩이 쪽으로, 벽을 짚어도 된다' },
]
const WALK_WARM: Move[] = [{ name: '편하게 걷기', sec: 120, cue: '평소 걸음으로 시작' }]
const WALK_COOL: Move[] = [
  { name: '천천히 걷기', sec: 60, cue: '숨이 고를 때까지' },
  { name: '종아리 스트레칭', sec: 30, each: true, cue: '벽 짚고 한 발 뒤로, 뒤꿈치는 바닥에' },
]

// ---- 근력 (전신 서킷, 챕터마다 한 단계 어렵게) ----

const STRENGTH_1: Session = {
  id: 'strength-1', title: '전신 근력 1단계', summary: '의자 스쿼트·벽 푸시업 등 5동작 × 2바퀴',
  warmup: WARM, cooldown: COOL, roundRestSec: 90, rounds: { basic: 2, best: 3 },
  moves: [
    reps('의자 스쿼트', 10, '의자에 살짝 앉았다 일어서기. 무릎은 발끝 방향'),
    reps('벽 푸시업', 10, '벽에 손을 짚고 가슴을 벽 쪽으로 내렸다 밀기'),
    reps('글루트 브릿지', 12, '누워 무릎 세우고 엉덩이 들기, 위에서 1초 멈춤'),
    repsEach('버드독', 6, '네발 자세에서 반대 팔·다리를 길게 뻗었다 돌아오기'),
    hold('무릎 플랭크', 20, '무릎을 대고 머리부터 무릎까지 일직선'),
  ],
  min: [reps('의자 스쿼트', 10, '의자에 살짝 앉았다 일어서기'), reps('벽 푸시업', 10, '벽에 손 짚고 밀기')],
}

const STRENGTH_2: Session = {
  id: 'strength-2', title: '전신 근력 2단계', summary: '스쿼트·책상 푸시업·런지 등 6동작 × 3바퀴',
  warmup: WARM, cooldown: COOL, roundRestSec: 90, rounds: { basic: 3, best: 4 },
  moves: [
    reps('스쿼트', 12, '의자 없이, 허벅지가 바닥과 나란해질 만큼만'),
    reps('책상 푸시업', 10, '책상·싱크대 모서리를 짚고 몸을 일직선으로'),
    repsEach('뒤로 런지', 8, '한 발 뒤로 딛고 내려가기. 앞 무릎은 발목 위'),
    reps('글루트 브릿지', 15, '위에서 1초 멈춤'),
    hold('플랭크', 30, '팔꿈치로. 힘들면 무릎을 대도 된다'),
    repsEach('데드버그', 8, '누워 팔·다리를 들고 반대 팔·다리를 천천히 뻗기. 허리는 바닥에'),
  ],
  min: [reps('스쿼트', 12, '허벅지가 바닥과 나란해질 만큼'), reps('책상 푸시업', 10, '책상 모서리 짚고')],
}

const STRENGTH_3: Session = {
  id: 'strength-3', title: '전신 근력 3단계', summary: '푸시업·런지·한 다리 브릿지 등 6동작 × 3바퀴',
  warmup: WARM, cooldown: COOL, roundRestSec: 90, rounds: { basic: 3, best: 4 },
  moves: [
    reps('스쿼트', 15, '내려갈 때 2초, 올라올 때 1초'),
    reps('푸시업', 8, '무릎을 대고 해도 된다. 가슴이 주먹 하나 높이까지'),
    repsEach('뒤로 런지', 10, '앞 무릎은 발목 위, 상체는 곧게'),
    repsEach('한 다리 글루트 브릿지', 8, '한 발은 들고 다른 발로 엉덩이 들기'),
    hold('플랭크', 40, '배에 힘, 엉덩이가 처지지 않게'),
    reps('엎드려 Y 들기', 10, '엎드려 팔을 Y자로 뻗고 엄지를 위로 들어 2초'),
  ],
  min: [reps('스쿼트', 15, '내려갈 때 2초'), reps('푸시업', 8, '무릎 대도 된다')],
}

/** 근력 쉬는 날·가벼운 날. 매일 하는 습관이 끊기지 않게 짧은 걷기로 채운다 */
const RECOVERY: Session = {
  id: 'recovery', title: '회복 걷기', summary: '빠르게 걷기 10분',
  moves: [{ name: '빠르게 걷기', sec: 600, cue: '말은 되지만 노래는 힘든 속도' }],
  roundRestSec: 0, rounds: { basic: 1, best: 2 },
  cooldown: [{ name: '종아리 스트레칭', sec: 30, each: true, cue: '벽 짚고 한 발 뒤로' }],
  min: [{ name: '가볍게 걷기', sec: 120, cue: '집 안이든 밖이든 2분' }],
}

// ---- 체중 감량: 인터벌 걷기(빠르게 3분 · 천천히 3분) + 근력 2일 ----

const fastWalk: Move = {
  name: '빠르게 걷기', sec: 180, cue: '숨이 차서 짧은 말만 될 정도', restSec: 180, restAs: '천천히 걷기',
}
const walkSession = (n: 1 | 2 | 3, basic: number, best: number): Session => ({
  id: `interval-walk-${n}`, title: `인터벌 걷기 ${n}단계`, summary: `빠르게 3분 · 천천히 3분 × ${basic}번`,
  warmup: WALK_WARM, cooldown: WALK_COOL, moves: [fastWalk], roundRestSec: 0, rounds: { basic, best },
  min: [{ ...fastWalk, restSec: undefined }],
})
const WALK_1 = walkSession(1, 3, 5)
const WALK_2 = walkSession(2, 4, 6)
const WALK_3 = walkSession(3, 5, 7)

// ---- 달리기 입문: NHS Couch to 5K 9주를 66일·챕터 상한에 맞게 줄인 것 ----

const run = (sec: number, walkSec: number): Move => ({
  name: '달리기', sec, cue: '천천히. 옆 사람과 말할 수 있는 속도면 충분하다',
  ...(walkSec ? { restSec: walkSec, restAs: '걷기' } : {}),
})
const RUN_WARM: Move[] = [{ name: '빠르게 걷기', sec: 180, cue: '몸을 데운다' }]
const RUN_COOL: Move[] = [{ name: '천천히 걷기', sec: 120, cue: '숨이 고를 때까지' }]
// 3챕터는 상한이 45분이라 NHS 원래대로 준비·정리 5분씩
const RUN_WARM5: Move[] = [{ name: '빠르게 걷기', sec: 300, cue: '몸을 데운다' }]
const RUN_COOL5: Move[] = [{ name: '천천히 걷기', sec: 300, cue: '숨이 고를 때까지' }]
const RUN_MIN: Move[] = [{ name: '빠르게 걷기', sec: 120, cue: '몸 데우기' }, run(60, 0)]

const runSession = (
  n: number, summary: string, moves: Move[], rounds: Session['rounds'], long = false,
): Session => ({
  id: `run-${n}`, title: `달리기 ${n}주차`, summary, moves, rounds, roundRestSec: 0,
  warmup: long ? RUN_WARM5 : RUN_WARM, cooldown: long ? RUN_COOL5 : RUN_COOL, min: RUN_MIN,
})
const RUNS = [
  runSession(1, '1분 달리기 · 1분 30초 걷기 × 6', [run(60, 90)], { basic: 6, best: 8 }),
  runSession(2, '1분 30초 달리기 · 2분 걷기 × 4', [run(90, 120)], { basic: 4, best: 6 }),
  runSession(3, '1분 30초 · 3분 달리기 번갈아 × 2', [run(90, 90), run(180, 180)], { basic: 2, best: 3 }),
  runSession(4, '3분 · 5분 달리기 번갈아 × 2', [run(180, 90), run(300, 150)], { basic: 2, best: 3 }),
  runSession(5, '5분 달리기 · 3분 걷기 × 3', [run(300, 180)], { basic: 3, best: 4 }),
  runSession(6, '8분 달리기 · 5분 걷기 × 2', [run(480, 300)], { basic: 2, best: 3 }),
  runSession(7, '10분 달리기 · 3분 걷기 × 2', [run(600, 180)], { basic: 2, best: 3 }, true),
  runSession(8, '쉬지 않고 25분 달리기', [run(300, 0)], { basic: 5, best: 6 }, true),
  runSession(9, '쉬지 않고 30분 달리기', [run(300, 0)], { basic: 6, best: 7 }, true),
]
/** 달리기 주차가 바뀌는 일차. 챕터 경계(23일·45일)에 맞췄다 */
const RUN_FROM = [1, 8, 15, 23, 30, 37, 45, 52, 59]

// ---- 자세·유연성: 매일. 한 동작을 2바퀴 × 30초 = 60초 (ACSM 권장 누적 시간) ----

const chinTuck = reps('턱 당기기', 10, '턱을 뒤로 밀어 이중턱 만들기, 2초 멈춤', 10)
const doorway = hold('문틀 가슴 스트레칭', 30, '팔꿈치를 어깨 높이로 문틀에 대고 몸을 앞으로', 10)
const catCow = reps('고양이-소', 8, '내쉬며 등을 둥글게, 들이쉬며 가슴을 펴기', 10)
const hipFlexor = holdEach('고관절 앞 스트레칭', 30, '한쪽 무릎을 꿇고 골반을 앞으로 밀기')
const hamstring = holdEach('햄스트링 스트레칭', 30, '한 다리를 앞으로 뻗고 허리를 편 채 숙이기')
const wallAngel = reps('벽 천사', 10, '등·팔을 벽에 붙이고 팔을 위아래로 천천히', 10)
const yRaise = reps('엎드려 Y 들기', 10, '엎드려 팔을 Y자로 뻗고 엄지를 위로 들어 2초', 10)
const tRotation = repsEach('등 돌리기', 6, '옆으로 누워 위쪽 팔을 반대편으로 열기', 10)
const figure4 = holdEach('엉덩이 스트레칭', 30, '누워 한쪽 발목을 반대 무릎에 걸고 당기기')
const POSTURE_WARM: Move[] = [{ name: '제자리 걷기', sec: 60, cue: '근육을 데운 뒤에 늘린다' }]

const postureSession = (n: number, summary: string, moves: Move[]): Session => ({
  id: `posture-${n}`, title: `자세 펴기 ${n}단계`, summary, moves,
  warmup: POSTURE_WARM, roundRestSec: 20, rounds: { basic: 2, best: 3 }, min: [chinTuck, doorway],
})
const POSTURE_1 = postureSession(1, '목·가슴·고관절 5동작 × 2바퀴', [chinTuck, doorway, catCow, hipFlexor, hamstring])
const POSTURE_2 = postureSession(2, '벽 천사를 더한 6동작 × 2바퀴',
  [chinTuck, wallAngel, doorway, catCow, hipFlexor, hamstring])
const POSTURE_3 = postureSession(3, '등 근력·회전을 더한 8동작 × 2바퀴',
  [chinTuck, wallAngel, yRaise, doorway, tRotation, hipFlexor, figure4, hamstring])

// ---- 바쁜 사람: 7분 서킷(쉬운 동작으로 바꾼 것) + 계단 간식 ----

const circuitMoves = (work: number, rest: number): Move[] => [
  { name: '스텝 잭', sec: work, restSec: rest, cue: '뛰지 않고 한 발씩 옆으로 딛으며 팔 올리기' },
  { name: '벽에 기대 앉기', sec: work, restSec: rest, cue: '벽에 등을 대고 의자에 앉은 듯' },
  { name: '책상 푸시업', sec: work, restSec: rest, cue: '책상 모서리를 짚고' },
  { name: '데드버그', sec: work, restSec: rest, cue: '허리를 바닥에 붙인 채 팔·다리 번갈아' },
  { name: '계단 한 칸 오르내리기', sec: work, restSec: rest, cue: '낮은 계단이나 문턱. 난간을 잡아도 된다' },
  { name: '스쿼트', sec: work, restSec: rest, cue: '편한 깊이까지' },
  { name: '엎드려 Y 들기', sec: work, restSec: rest, cue: '팔을 Y자로, 엄지 위로' },
  { name: '플랭크', sec: work, restSec: rest, cue: '힘들면 무릎을 댄다' },
  { name: '무릎 높이 걷기', sec: work, restSec: rest, cue: '제자리에서 무릎을 높이, 빠르게' },
  { name: '뒤로 런지 번갈아', sec: work, restSec: rest, cue: '좌우 번갈아 한 발씩 뒤로' },
  { name: '버드독 번갈아', sec: work, restSec: rest, cue: '네발 자세에서 반대 팔·다리' },
  { name: '옆 플랭크', sec: work / 2, each: true, restSec: rest, cue: '무릎을 대고 옆으로 버티기' },
]
const circuitSession = (n: number, work: number, rest: number, basic: number, best: number): Session => ({
  id: `circuit-${n}`, title: `7분 서킷 ${n}단계`, summary: `12동작 · ${work}초 운동 · ${rest}초 쉬기 × ${basic}바퀴`,
  warmup: WARM.slice(0, 2), cooldown: COOL, moves: circuitMoves(work, rest), roundRestSec: 60,
  rounds: { basic, best }, min: circuitMoves(work, rest).slice(0, 4),
})
const CIRCUIT_1 = circuitSession(1, 20, 20, 1, 2)
const CIRCUIT_2 = circuitSession(2, 30, 15, 2, 3)
const CIRCUIT_3 = circuitSession(3, 30, 10, 2, 3)

const STAIR_SNACK: Session = {
  id: 'stair-snack', title: '계단 간식', summary: '20초 힘껏 오르기 × 3 (하루에 나눠 해도 된다)',
  warmup: [{ name: '제자리 걷기', sec: 120, cue: '몸 데우기' }],
  moves: [{
    name: '계단 빠르게 오르기', sec: 20, restSec: 120, restAs: '천천히 걷기',
    cue: '계단 2~3층, 없으면 제자리 무릎 높이 뛰기. 숨이 찰 만큼 힘껏',
  }],
  roundRestSec: 0, rounds: { basic: 3, best: 4 },
  cooldown: [{ name: '천천히 걷기', sec: 180, cue: '숨이 고를 때까지' }],
  min: [{ name: '계단 빠르게 오르기', sec: 20, cue: '딱 20초만 힘껏' }],
}

// ---- 플랜 ----

const SRC = {
  acsm2026: { label: 'ACSM 저항운동 입장문 2026 (MSSE): 주 2일 이상 전 근육군, 운동당 2~3세트', url: 'https://acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf' },
  acsm2009: { label: 'ACSM 저항운동 진행 모델 2009 (MSSE 41:687): 초보 8~12회 · 1~3세트 · 주 2~3회' },
  who2020: { label: 'WHO 신체활동 지침 2020 (Bull 외, BJSM): 주 150~300분 중간 강도 + 근력 2일', url: 'https://bjsm.bmj.com/content/54/24/1451' },
  donnelly2009: { label: 'ACSM 체중 감량 입장문 2009 (Donnelly 외): 주 150~250분은 적당한 감량, 그 이상은 더 큰 감량', url: 'https://pubmed.ncbi.nlm.nih.gov/19127177/' },
  nemoto2007: { label: 'Nemoto 외 2007 (Mayo Clin Proc): 빠르게 3분 · 천천히 3분 인터벌 걷기, 5개월' },
  c25k: { label: 'NHS Couch to 5K: 9주 · 주 3회 · 준비·정리 걷기 5분', url: 'https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/' },
  acsmFlex: { label: 'ACSM 스트레칭 지침: 10~30초 버티기, 동작당 누적 60초, 주 2~3일 이상(매일이 가장 효과)', url: 'https://www.acsm.org/blog-detail/acsm-certified-blog/2021/03/18/stretching-and-flexibility-guidelines-update' },
  andersen2011: { label: 'Andersen 외 2011 (Pain): 사무직 목·어깨 통증, 하루 2분 근력 운동으로도 감소' },
  klika2013: { label: 'Klika & Jordan 2013 (ACSM HFJ): 맨몸 12동작 30초 · 10초 쉬기 고강도 서킷' },
  gillen2016: { label: 'Gillen 외 2016 (PLoS One): 20초 전력 × 3이 든 10분 운동, 주 3회 12주' },
  jenkins2019: { label: 'Jenkins 외 2019 (APNM): 계단 3층 오르기 하루 3번, 주 3일 6주로 심폐체력 향상', url: 'https://pubmed.ncbi.nlm.nih.gov/30649897/' },
}

const strengthStages = (rest: Session): Stage[] => [
  { fromDay: 1, week: week(STRENGTH_1, rest, STRENGTH_1, rest, STRENGTH_1, rest, rest) },
  { fromDay: 23, week: week(STRENGTH_2, rest, STRENGTH_2, rest, STRENGTH_2, rest, rest) },
  { fromDay: 45, week: week(STRENGTH_3, rest, STRENGTH_3, rest, STRENGTH_3, rest, rest) },
]

export const EXERCISE_PLANS: Plan[] = [
  {
    id: 'lose-weight', theme: 'exercise', title: '체중 감량',
    promise: '걷기 5일 + 근력 2일. 3챕터엔 주 200분쯤 움직인다',
    forWho: '살을 빼고 싶은데 뛰는 건 부담스러운 사람',
    rhythm: '인터벌 걷기 5일, 전신 근력 2일 (근력은 근육량을 지키려고)',
    stages: [
      { fromDay: 1, week: week(WALK_1, STRENGTH_1, WALK_1, WALK_1, STRENGTH_1, WALK_1, WALK_1) },
      { fromDay: 23, week: week(WALK_2, STRENGTH_2, WALK_2, WALK_2, STRENGTH_2, WALK_2, WALK_2) },
      { fromDay: 45, week: week(WALK_3, STRENGTH_3, WALK_3, WALK_3, STRENGTH_3, WALK_3, WALK_3) },
    ],
    sources: [SRC.donnelly2009, SRC.who2020, SRC.nemoto2007, SRC.acsm2026],
  },
  {
    id: 'strength', title: '근력 기초', theme: 'exercise',
    promise: '도구 없이 집에서, 주 3일 전신 근력',
    forWho: '힘을 기르고 몸에 탄력을 붙이고 싶은 사람',
    rhythm: '전신 근력 3일 (하루씩 건너), 사이사이 회복 걷기',
    stages: strengthStages(RECOVERY),
    sources: [SRC.acsm2026, SRC.acsm2009, SRC.who2020],
  },
  {
    id: 'run', title: '달리기 입문', theme: 'exercise',
    promise: '걷기에서 시작해 9주 뒤 쉬지 않고 30분 달리기',
    forWho: '체력을 기르고 싶은 사람, 달리기를 해 본 적 없는 사람',
    rhythm: '달리기 3일 (하루씩 건너), 사이사이 회복 걷기',
    stages: RUNS.map((r, i) => ({
      fromDay: RUN_FROM[i], week: week(r, RECOVERY, r, RECOVERY, r, RECOVERY, RECOVERY),
    })),
    sources: [SRC.c25k, SRC.who2020],
  },
  {
    id: 'posture', title: '자세·유연성', theme: 'exercise',
    promise: '하루 10분, 굽은 목·어깨와 굳은 고관절 펴기',
    forWho: '오래 앉아 있는 사람, 몸이 뻣뻣한 사람',
    rhythm: '매일 같은 스트레칭 (매일 할 때 효과가 가장 크다)',
    stages: [
      { fromDay: 1, week: week(POSTURE_1, POSTURE_1, POSTURE_1, POSTURE_1, POSTURE_1, POSTURE_1, POSTURE_1) },
      { fromDay: 23, week: week(POSTURE_2, POSTURE_2, POSTURE_2, POSTURE_2, POSTURE_2, POSTURE_2, POSTURE_2) },
      { fromDay: 45, week: week(POSTURE_3, POSTURE_3, POSTURE_3, POSTURE_3, POSTURE_3, POSTURE_3, POSTURE_3) },
    ],
    sources: [SRC.acsmFlex, SRC.andersen2011],
  },
  {
    id: 'busy', title: '바쁜 날 10분', theme: 'exercise',
    promise: '10~20분 짧고 굵게. 시간 없는 날도 끊기지 않게',
    forWho: '운동할 시간이 정말 없는 사람',
    rhythm: '7분 서킷 3일, 계단 간식 2일, 회복 걷기 2일',
    stages: [
      { fromDay: 1, week: week(CIRCUIT_1, STAIR_SNACK, CIRCUIT_1, STAIR_SNACK, CIRCUIT_1, RECOVERY, RECOVERY) },
      { fromDay: 23, week: week(CIRCUIT_2, STAIR_SNACK, CIRCUIT_2, STAIR_SNACK, CIRCUIT_2, RECOVERY, RECOVERY) },
      { fromDay: 45, week: week(CIRCUIT_3, STAIR_SNACK, CIRCUIT_3, STAIR_SNACK, CIRCUIT_3, RECOVERY, RECOVERY) },
    ],
    sources: [SRC.klika2013, SRC.gillen2016, SRC.jenkins2019],
  },
]
