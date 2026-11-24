# 초보용 플랜 프리셋

사용자는 **테마 → 플랜** 두 번만 고른다. 그날 할 세션, 동작, 세트·횟수·시간, 쉬는 시간은 습관의 일차로 정해지고,
세트 타이머는 `dayOfPlan(plan, day).segments[tier]`를 순서대로 재생하기만 하면 된다.

- 코드: `src/domain/plans.ts`(틀·타이머 구간), `presets-exercise.ts`(운동), `presets-life.ts`(집중·마음·잠), `presets.ts`(목록), 테스트 `presets.test.ts`
- 66일 = 챕터 22일 × 3. 플랜은 챕터마다 한 단계 어려워진다 (23일차, 45일차). 66일 이후(연장 챕터)는 마지막 단계를 계속 쓴다.
- 단계: **최소**는 준비·정리 없이 핵심 동작 한 번(운동 5분 이하), **기본**은 그날 세션, **최고**는 한 바퀴 더.
- 운동 기본 세션은 그날 챕터 상한(20 / 30 / 45분, `rules.ts`) 안에 들어온다. 테스트가 1~66일 전부 확인한다.
- 쉬는 날도 짧은 회복 걷기로 채워서 매일 하는 습관이 끊기지 않게 했다.

## 운동 (우선)

| 플랜 | 누구에게 | 일주일 리듬 | 기본 시간 (1 → 3챕터) | 근거 |
| --- | --- | --- | --- | --- |
| 체중 감량 | 살 빼고 싶은데 뛰기는 부담 | 인터벌 걷기 5일 + 전신 근력 2일 | 걷기 19 → 31분, 근력 16 → 28분. 3챕터 주 약 210분 | ACSM 2009 체중 감량(주 150~250분), Nemoto 2007 인터벌 걷기, WHO 2020 |
| 근력 기초 | 힘·탄력 | 근력 3일(격일) + 회복 걷기 | 16 → 28분 | ACSM 2026 저항운동(주 2일+, 2~3세트), ACSM 2009(초보 8~12회) |
| 달리기 입문 | 체력, 달리기 처음 | 달리기 3일(격일) + 회복 걷기 | 1분 달리기 × 6 → 쉬지 않고 30분 | NHS Couch to 5K 9주 |
| 자세·유연성 | 오래 앉는 사람 | 매일 같은 스트레칭 | 10 → 15분 | ACSM 스트레칭(동작당 누적 60초, 매일이 가장 효과), Andersen 2011 |
| 바쁜 날 10분 | 시간이 정말 없는 사람 | 7분 서킷 3일 + 계단 간식 2일 + 회복 2일 | 12 → 21분 | Klika & Jordan 2013, Gillen 2016, Jenkins 2019 |

### 정한 것과 이유

- **맨몸·집 안·도구 없이.** 덱(`deck.ts`)과 같은 원칙이다. 점프·의자 딥스처럼 초보가 다치기 쉬운 동작은 뺐다 (점핑잭 → 스텝 잭, 크런치 → 데드버그).
- **근력은 2~3회 남기고 멈춘다.** ACSM 2026은 실패 지점까지 가는 것이 평균적인 성인에게 결과를 바꾸지 않는다고 정리했다. 횟수는 ACSM 2009 초보 권장 8~12회 안에서 정했다.
- **횟수 운동의 시간**은 1회 3초로 잡은 예상치다. 다 하면 먼저 넘겨도 된다 (UI 몫).
- **근력은 이틀 연속으로 넣지 않았다.** 같은 근육은 하루 쉬게 한다는 ACSM 권장을 따랐다.
- **달리기**는 NHS 9주 계획을 66일에 맞췄다. 1챕터 상한 20분에 맞추려고 1~2주차 반복 수와 준비·정리 걷기(5분 → 3분 + 2분)를 줄였다. 3챕터는 NHS대로 5분씩이다. NHS 5주차의 "갑자기 20분 연속"은 빼고 8주차 25분, 9주차 30분으로 완만하게 올렸다.
- **체중 감량은 운동만으로는 크지 않다.** ACSM 2009도 식단 조절과 함께해야 한다고 했다. 화면에 이 한 줄을 보여 주는 것을 권한다.

## 다른 테마

세트 타이머로 돌릴 수 있는 것(시간과 쉬기가 있는 습관)만 골랐다. 물 마시기·일기처럼 시간이 없는 습관은 타이머가 필요 없어서 뺐다.

| 테마 | 플랜 | 기본 (1 → 3챕터) | 근거 |
| --- | --- | --- | --- |
| 집중·공부 | 공부 집중 (포모도로) | 15분 × 2 → 25분 × 2, 사이 5분 | Smits 2025, Göksu 2026 |
| 집중·공부 | 책 읽기 | 10 → 20분 | Bavishi 2016 (관찰 연구) |
| 마음·호흡 | 숨 고르기 | 5분 | Balban 2023 |
| 마음·호흡 | 마음챙김 명상 | 5 → 15분 | Basso 2019 |
| 잠 | 잠들기 루틴 | 근육 이완 7부위 × 2 + 느린 호흡, 9분 | Luo 2024, Zaccaro 2018 |

- **포모도로는 근거가 약하다.** 고정 휴식(25·5분, 12·3분)이 스스로 쉬는 것보다 생산성·이해도가 낫다는 결과는 없었고, 기분·의욕은 스스로 쉬기가 더 나았다. 그래서 타이머는 "시작하게 해 주는 틀"로 쓰고, 흐름을 타면 쉬기를 건너뛰어도 된다고 안내한다.
- **호흡은 주기적 한숨 호흡**(두 번 들이쉬고 길게 내쉬기). 5분 · 28일 비교에서 마음챙김·박스 호흡보다 기분 개선과 호흡수 감소가 컸다.
- **명상**은 초보가 하루 13분 · 8주에 효과를 본 연구가 있어, 3챕터 기본을 15분으로 했다.
- **근육 이완**은 Luo 2024의 7부위, 힘 5~10초 · 이완 10~15초를 따라 힘 7초 · 이완 15초로 했다. 사전·사후 비교라 대조군이 없다는 한계가 있다.

## 세트 타이머와의 약속

```ts
import { dayOfPlan, planById } from './domain/presets'
const { session, seconds, segments } = dayOfPlan(planById('run')!, programDay)
// segments.basic: [{ kind: 'warmup'|'work'|'rest'|'cooldown', label, sec, reps?, cue?, round?, rounds?, next? }, …]
```

- 구간이 바뀔 때 소리·진동. 마지막 구간이 끝나면 20초 완료 확인 (리스킨 스레드의 타이머 규칙 그대로).
- 직접 정하는 타이머(세트 수 · 세트당 운동 시간 · 휴식)는 `uniformTimeline()`으로 같은 구간을 만든다.
- 단계를 골라 시작하면 그 단계로 기록한다. 직접 설정일 때만 총 시간으로 단계를 정한다.
- `EXERCISE_SAFETY`(운동 시작 전 안내 4줄)를 처음 한 번 보여 준다.

## 출처

- ACSM (2026). Resistance training prescription for muscle function, hypertrophy, and physical performance in healthy adults: an overview of reviews. *MSSE*. [인포그래픽](https://acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf)
- ACSM (2009). Progression models in resistance training for healthy adults. *MSSE* 41(3):687–708.
- Bull FC 외 (2020). WHO 2020 guidelines on physical activity and sedentary behaviour. *BJSM* 54:1451. [링크](https://bjsm.bmj.com/content/54/24/1451)
- Donnelly JE 외 (2009). ACSM position stand: appropriate physical activity intervention strategies for weight loss and prevention of weight regain. *MSSE* 41(2):459–471. [PubMed](https://pubmed.ncbi.nlm.nih.gov/19127177/)
- Nemoto K 외 (2007). Effects of high-intensity interval walking training on physical fitness and blood pressure in middle-aged and older people. *Mayo Clin Proc* 82(7):803–811.
- NHS. Couch to 5K running plan. [링크](https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/)
- ACSM (2021). Stretching and flexibility guidelines update. [링크](https://www.acsm.org/blog-detail/acsm-certified-blog/2021/03/18/stretching-and-flexibility-guidelines-update)
- Andersen LL 외 (2011). Effectiveness of small daily amounts of progressive resistance training for frequent neck/shoulder pain. *Pain* 152(2):440–446.
- Klika B, Jordan C (2013). High-intensity circuit training using body weight. *ACSM's Health & Fitness Journal* 17(3):8–13.
- Gillen JB 외 (2016). Twelve weeks of sprint interval training improves indices of cardiometabolic health similar to traditional endurance training despite a five-fold lower exercise volume and time commitment. *PLoS One* 11(4):e0154075.
- Jenkins EM 외 (2019). Do stair climbing exercise "snacks" improve cardiorespiratory fitness? *APNM* 44(6):681–684. [PubMed](https://pubmed.ncbi.nlm.nih.gov/30649897/)
- Smits EJC, Wenzel N, de Bruin A (2025). Investigating the effectiveness of self-regulated, Pomodoro, and Flowtime break-taking techniques among students. *Behav Sci* 15(7):861. [링크](https://www.mdpi.com/2076-328X/15/7/861)
- Göksu A, Wiradhany W, de Bruin ABH (2026). When to take a break. *Behav Sci* 16(7):1158. [링크](https://www.mdpi.com/2076-328X/16/7/1158)
- Bavishi A, Slade MD, Levy BR (2016). A chapter a day: association of book reading with longevity. *Soc Sci Med* 164:44–48.
- Balban MY 외 (2023). Brief structured respiration practices enhance mood and reduce physiological arousal. *Cell Rep Med* 4(1):100895. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947)
- Basso JC 외 (2019). Brief, daily meditation enhances attention, memory, mood, and emotional regulation in non-experienced meditators. *Behav Brain Res* 356:208–220. [PubMed](https://pubmed.ncbi.nlm.nih.gov/30153464/)
- Luo Y 외 (2024). Progressive muscle relaxation alleviates anxiety and improves sleep quality among healthcare practitioners in a mobile cabin hospital. *Front Psychol* 15:1337318. [링크](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1337318/full)
- Zaccaro A 외 (2018). How breath-control can change your life: a systematic review on psycho-physiological correlates of slow breathing. *Front Hum Neurosci* 12:353.

원문을 직접 확인한 것: ACSM 2026 인포그래픽, NHS Couch to 5K, Balban 2023, Luo 2024, Jenkins 2019 초록, Smits 2025, Göksu 2026. 나머지는 널리 인용되는 논문의 서지와 핵심 수치를 기억에서 적었다.
