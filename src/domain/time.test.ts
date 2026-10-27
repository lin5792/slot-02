import { describe, expect, it } from 'vitest'
import { todayISO } from './time'

describe('todayISO', () => {
  it('04:00 전까지는 전날이다', () => {
    expect(todayISO(new Date(2026, 10, 3, 0, 30))).toBe('2026-11-02')
    expect(todayISO(new Date(2026, 10, 3, 3, 59))).toBe('2026-11-02')
    expect(todayISO(new Date(2026, 10, 3, 4, 0))).toBe('2026-11-03')
  })
})
