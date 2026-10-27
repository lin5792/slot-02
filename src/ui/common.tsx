import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Progress } from '../domain/progress'
import { levelForXp, xpForLevel } from '../domain/rules'
import { weekdayLabel } from '../domain/time'
import type { Weekday } from '../domain/types'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet stack" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose}>닫기</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  const show = useCallback((m: string) => setMsg(m), [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast pop" role="status">{msg}</div>}
    </ToastCtx.Provider>
  )
}

export function WeekdayPicker({ value, onChange }: { value: Weekday[]; onChange: (v: Weekday[]) => void }) {
  // 월요일부터 보여준다
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0]
  return (
    <div className="weekdays">
      {order.map(wd => (
        <button key={wd} type="button" className={value.includes(wd) ? 'on' : ''}
          aria-pressed={value.includes(wd)}
          onClick={() => onChange(value.includes(wd) ? value.filter(v => v !== wd) : [...value, wd].sort())}>
          {weekdayLabel(wd)}
        </button>
      ))}
    </div>
  )
}

export function Hud({ progress, totalXp }: { progress: Progress; totalXp: number }) {
  const level = levelForXp(totalXp)
  const floor = xpForLevel(level), next = xpForLevel(level + 1)
  const pct = Math.min(100, ((totalXp - floor) / (next - floor)) * 100)
  return (
    <div className="card stack">
      <div className="hud">
        <div className="level"><div><small>LV</small>{level}</div></div>
        <div className="row between small">
          <b>{progress.started ? `${Math.min(progress.day, progress.totalDays)}일차 / ${progress.totalDays}` : '시작 전'}</b>
          <span className="muted num">{totalXp} / {next} XP</span>
        </div>
        <div className="xpbar" role="progressbar" aria-valuemin={floor} aria-valuemax={next} aria-valuenow={totalXp}>
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="stats">
        <div className="stat"><b>{progress.combo}</b><span>🔥 콤보</span></div>
        <div className="stat"><b>{progress.basicStreak}</b><span>기본 연속</span></div>
        <div className="stat">
          <b>{progress.shieldThisWeek === 'available' ? '🛡' : '—'}</b>
          <span>{progress.shieldThisWeek === 'available' ? '실드 있음' : '실드 사용함'}</span>
        </div>
      </div>
    </div>
  )
}

export const Icon = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c2 3.5 6 5.5 6 10a6 6 0 0 1-12 0c0-2.8 1.4-4.6 2.8-6 .2 2.2 1.2 3.4 2.4 3.9C10.8 7.8 11.3 5.6 12 3z"/></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/></svg>,
  journey: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  weekly: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  setup: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
}
