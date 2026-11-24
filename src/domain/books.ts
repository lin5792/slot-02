// 책 읽기 플랜의 추천 책. 책을 거의 안 읽는 성인이 끝까지 읽을 만한 쉽고 짧은 책부터.
// 쪽수는 2026-11-24 서점(yes24·알라딘) 표기 그대로이고, 판이 다르면 달라진다. 출처는 docs/presets.md.
import { PAGES_PER_DAY } from './presets-life'
import { chapterOfDay } from './progress'

export interface Book {
  id: string
  title: string
  author: string
  translator?: string
  publisher: string
  year: number
  pages: number
  /** 1 = 1챕터(하루 7쪽)에 맞는 얇은 책, 2 = 보통, 3 = 조금 두꺼운 책 */
  level: 1 | 2 | 3
  genre: '소설' | '동화' | '에세이' | '자기계발'
  /** 고르는 화면의 한 줄 */
  why: string
}

export const BOOKS: Book[] = [
  { id: 'little-prince', title: '어린 왕자', author: '생텍쥐페리', translator: '황현산', publisher: '열린책들', year: 2015, pages: 136, level: 1, genre: '동화', why: '어른이 되어 다시 읽으면 다르게 읽히는 짧은 이야기' },
  { id: 'long-night', title: '긴긴밤', author: '루리', publisher: '문학동네', year: 2021, pages: 144, level: 1, genre: '동화', why: '그림이 많고 한 번에 빠져드는, 어른도 우는 동화' },
  { id: 'old-man-sea', title: '노인과 바다', author: '헤밍웨이', translator: '김욱동', publisher: '민음사', year: 2012, pages: 193, level: 1, genre: '소설', why: '등장인물이 거의 하나뿐이라 따라가기 쉬운 고전' },
  { id: 'tteokbokki', title: '죽고 싶지만 떡볶이는 먹고 싶어', author: '백세희', publisher: '흔', year: 2018, pages: 208, level: 1, genre: '에세이', why: '상담 대화를 옮긴 에세이라 대화처럼 술술 읽힌다' },
  { id: 'convenience-store', title: '불편한 편의점', author: '김호연', publisher: '나무옆의자', year: 2021, pages: 268, level: 2, genre: '소설', why: '짧은 장마다 손님 이야기가 하나씩, 따뜻하고 쉽다' },
  { id: 'dallergut', title: '달러구트 꿈 백화점 1', author: '이미예', publisher: '팩토리나인', year: 2020, pages: 300, level: 2, genre: '소설', why: '꿈을 사고파는 백화점, 가볍고 재미있는 판타지' },
  { id: 'temperature-of-words', title: '언어의 온도', author: '이기주', publisher: '말글터', year: 2016, pages: 308, level: 2, genre: '에세이', why: '두세 쪽짜리 글 모음이라 아무 데서나 끊어 읽기 좋다' },
  { id: 'almond', title: '아몬드', author: '손원평', publisher: '다즐링', year: 2023, pages: 314, level: 2, genre: '소설', why: '감정을 못 느끼는 소년 이야기, 청소년 소설이라 문장이 쉽다' },
  { id: 'courage-to-be-disliked', title: '미움받을 용기', author: '기시미 이치로·고가 후미타케', translator: '전경아', publisher: '인플루엔셜', year: 2022, pages: 340, level: 3, genre: '자기계발', why: '철학자와 청년의 대화로만 된 책이라 어렵지 않다' },
  { id: 'speed-of-light', title: '우리가 빛의 속도로 갈 수 없다면', author: '김초엽', publisher: '허블', year: 2019, pages: 344, level: 3, genre: '소설', why: '단편 일곱 편이라 한 편씩 끝내는 맛이 있는 SF' },
  { id: 'atomic-habits', title: '아주 작은 습관의 힘', author: '제임스 클리어', translator: '이한이', publisher: '비즈니스북스', year: 2019, pages: 360, level: 3, genre: '자기계발', why: '지금 하고 있는 66일 습관 만들기의 원리를 다룬 책' },
  { id: 'namiya', title: '나미야 잡화점의 기적', author: '히가시노 게이고', translator: '양윤옥', publisher: '현대문학', year: 2022, pages: 456, level: 3, genre: '소설', why: '두껍지만 장이 짧고 이야기가 맞물려 손에서 안 놓인다' },
]

export function booksOfLevel(level: Book['level']): Book[] {
  return BOOKS.filter(b => b.level === level)
}

/** 그 일차의 하루 쪽수 (챕터 22일마다 7 → 10 → 15쪽, 이후 15쪽) */
export function pagesOnDay(day: number): number {
  const ch = Math.min(3, chapterOfDay(day)) as 1 | 2 | 3
  return PAGES_PER_DAY[ch]
}

/** startDay부터 하루 쪽수대로 읽으면 며칠째에 다 읽는가 */
export function finishDay(pages: number, startDay = 1): number {
  let left = pages
  let d = startDay
  for (;;) {
    left -= pagesOnDay(d)
    if (left <= 0) return d
    d++
  }
}
