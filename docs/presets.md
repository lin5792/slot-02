# 초보용 플랜 프리셋

사용자는 **테마 → 플랜** 두 번만 고른다. 그날 할 세션, 동작, 세트·횟수·시간, 쉬는 시간은 습관의 일차로 정해지고,
세트 타이머는 `dayOfPlan(plan, day).segments[tier]`를 순서대로 재생하기만 하면 된다.

- 코드: `src/domain/plans.ts`(틀·타이머 구간), `presets-exercise.ts`(운동), `presets-life.ts`(배우기·마음·잠), `books.ts`(추천 책), `presets.ts`(목록), 테스트 `presets.test.ts`
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

시간이나 개수가 정해져 세트 타이머로 돌릴 수 있는 습관만 골랐다. 물 마시기처럼 시간·개수가 없는 습관은 타이머가 필요 없어서 뺐다.

| 테마 | 플랜 | 기본 (1 → 3챕터) | 근거 |
| --- | --- | --- | --- |
| 배우기 | 책 읽기 | 하루 7 → 10 → 15쪽 | 문체부 2023 독서실태, Brysbaert 2019 |
| 배우기 | 영어 단어 | 새 단어 10 → 20개 + 지난 단어 복습 | Karpicke & Roediger 2008, Cepeda 2006 |
| 마음 | 감사 일기 3줄 | 좋았던 일 3가지와 이유, 3분 | Seligman 2005 |
| 마음 | 부모님께 연락 | 주 3번 5분 통화, 나머지 날은 안부 한 줄 | Liu 2022, Holt-Lunstad 2010 |
| 잠 | 잠들기 루틴 | 근육 이완 7부위 × 2 + 느린 호흡, 9분 | Luo 2024, Zaccaro 2018 |

- **2026-11-24 마스터 피드백으로 바꿈:** 공부 집중(포모도로), 숨 고르기, 명상은 뺐다. 포모도로는 고정 휴식이 스스로 쉬기보다 낫다는 근거도 없었다 (Smits 2025, Göksu 2026). 대신 쪽수·개수처럼 손에 잡히는 목표가 있는 영어 단어, 감사 일기, 부모님께 연락을 넣었다.
- **책 읽기는 시간이 아니라 쪽수다.** 성인 10명 중 6명이 1년에 책을 한 권도 안 읽고, 하루 평균 독서시간은 18.5분이다 (2023). 그래서 1챕터는 하루 7쪽(약 15분)으로 시작해 얇은 책 한 권을 22일 안에 끝내게 했다. 66일에 약 700쪽이다.
- **한 쪽 = 2분**으로 잡았다. 성인 묵독 평균은 분당 238~260단어(영어)인데, 한국어 쪽당 읽기 시간 연구는 찾지 못해서 초보 기준으로 넉넉하게 잡은 추정치다. 다 읽으면 먼저 끝내면 된다.
- **영어 단어**는 새 단어를 외우고 바로 가리고 떠올리게 했다. 다시 보기보다 떠올리기를 반복한 쪽이 일주일 뒤 기억이 훨씬 좋았고, 몰아서보다 간격을 둔 복습이 오래 간다. 지난 단어는 1·3·7일 뒤에 다시 떠올린다.
- **감사 일기**는 매일 밤 좋았던 일 3가지와 이유를 1주 적은 실험에서 행복감 상승·우울 감소가 6개월까지 갔다. 한 줄만 적어도 되는 최소 단계를 뒀다.
- **부모님께 연락**은 마스터 요청으로 명상 대신 넣었다. 매일 전화는 부담이라 주 3번 5분 통화, 나머지 날은 사진이나 한 줄 안부로 했다. 연락하는 사람은 상대가 얼마나 반가워할지를 늘 낮춰 보고(실험 13개), 사회적 관계가 탄탄하면 생존 가능성이 50% 높았다(메타분석 148개 연구).
- **근육 이완**은 Luo 2024의 7부위, 힘 5~10초 · 이완 10~15초를 따라 힘 7초 · 이완 15초로 했다. 사전·사후 비교라 대조군이 없다는 한계가 있다.

### 추천 책 (`src/domain/books.ts`)

책을 거의 안 읽는 성인이 끝까지 읽을 만한 쉽고 짧은 책. 쪽수는 2026-11-24 서점 표기이고 판마다 다르다.

| 단계 | 책 | 쪽수 | 하루 쪽수로 며칠 |
| --- | --- | --- | --- |
| 1 (하루 7쪽) | 어린 왕자 (열린책들) | 136 | 20일 |
| 1 | 긴긴밤 (문학동네) | 144 | 21일 |
| 1 | 노인과 바다 (민음사) | 193 | 28일 |
| 1 | 죽고 싶지만 떡볶이는 먹고 싶어 (흔) | 208 | 30일 |
| 2 (하루 10쪽) | 불편한 편의점 (나무옆의자) | 268 | 27일 |
| 2 | 달러구트 꿈 백화점 1 (팩토리나인) | 300 | 30일 |
| 2 | 언어의 온도 (말글터) | 308 | 31일 |
| 2 | 아몬드 (다즐링 2023, 창비판은 절판) | 314 | 32일 |
| 3 (하루 15쪽) | 미움받을 용기 (인플루엔셜) | 340 | 23일 |
| 3 | 우리가 빛의 속도로 갈 수 없다면 (허블) | 344 | 23일 |
| 3 | 아주 작은 습관의 힘 (비즈니스북스) | 360 | 24일 |
| 3 | 나미야 잡화점의 기적 (현대문학) | 456 | 31일 |

소년이 온다(216쪽)는 쉽지만 내용이 무거워 첫 책 추천에서는 뺐다.

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
- 문화체육관광부 (2024). 2023 국민 독서실태 조사 결과. [정책브리핑](https://www.korea.kr/news/policyNewsView.do?newsId=148928309)
- Brysbaert M (2019). How many words do we read per minute? A review and meta-analysis of reading rate. *J Mem Lang* 109:104047.
- Karpicke JD, Roediger HL (2008). The critical importance of retrieval for learning. *Science* 319:966–968.
- Cepeda NJ 외 (2006). Distributed practice in verbal recall tasks: a review and quantitative synthesis. *Psychol Bull* 132(3):354–380.
- Seligman MEP 외 (2005). Positive psychology progress: empirical validation of interventions. *Am Psychol* 60(5):410–421.
- (뺀 플랜의 근거) Smits 2025 [링크](https://www.mdpi.com/2076-328X/15/7/861), Göksu 2026 [링크](https://www.mdpi.com/2076-328X/16/7/1158), Balban 2023 [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947), Basso 2019 [PubMed](https://pubmed.ncbi.nlm.nih.gov/30153464/)
- Liu PJ, Rim S, Min L, Min KE (2022). The surprise of reaching out: appreciated more than we think. *J Pers Soc Psychol*. [PubMed](https://pubmed.ncbi.nlm.nih.gov/35816566/)
- Holt-Lunstad J, Smith TB, Layton JB (2010). Social relationships and mortality risk: a meta-analytic review. *PLoS Med* 7(7):e1000316. [링크](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1000316)
- Luo Y 외 (2024). Progressive muscle relaxation alleviates anxiety and improves sleep quality among healthcare practitioners in a mobile cabin hospital. *Front Psychol* 15:1337318. [링크](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1337318/full)
- Zaccaro A 외 (2018). How breath-control can change your life: a systematic review on psycho-physiological correlates of slow breathing. *Front Hum Neurosci* 12:353.

원문을 직접 확인한 것: ACSM 2026 인포그래픽, NHS Couch to 5K, Balban 2023, Luo 2024, Jenkins 2019 초록, Smits 2025, Göksu 2026, Brysbaert 2019, 문체부 2023 조사, 책 12권의 서점 쪽수. 나머지는 널리 인용되는 논문의 서지와 핵심 수치를 기억에서 적었다.
