import { useEffect, useRef, useState } from 'react'

/**
 * 상한이 있는 퀘스트 타이머. 마지막 2분은 추스름 구간으로 표시하고,
 * 상한에 닿으면 멈춘다 ("더 할 수 있었는데"를 남기는 설계).
 */
export function QuestTimer({ capMin, onCapReached }: { capMin: number; onCapReached: (minutes: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const fired = useRef(false)
  const cap = capMin * 60
  const coolFrom = Math.max(0, cap - 120)

  useEffect(() => {
    if (startedAt === null || done) return
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000)
      setElapsed(Math.min(s, cap))
      if (s >= coolFrom && s < coolFrom + 1) navigator.vibrate?.(200)
      if (s >= cap && !fired.current) {
        fired.current = true
        setDone(true)
        navigator.vibrate?.([200, 100, 200])
        onCapReached(capMin)
      }
    }, 250)
    return () => clearInterval(t)
  }, [startedAt, done, cap, coolFrom, capMin, onCapReached])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const cooling = elapsed >= coolFrom && !done
  const running = startedAt !== null && !done

  return (
    <div className="card timer stack">
      <div className="row between small">
        <b>퀘스트 타이머</b>
        <span className="muted">상한 {capMin}분</span>
      </div>
      <div className="clock">{mm}:{ss}</div>
      <div className="track" aria-hidden>
        <span className="cool" style={{ left: `${(coolFrom / cap) * 100}%`, right: 0 }} />
        <i style={{ width: `${(elapsed / cap) * 100}%` }} />
      </div>
      <p className="small muted" aria-live="polite">
        {done ? '여기서 멈춘다. 더 하고 싶은 마음은 내일의 연료로.'
          : cooling ? '추스름 구간: 강도를 낮추고 천천히 마무리'
          : running ? '마지막 2분은 추스름. 끝이 편해야 내일이 기다려진다'
          : '시작하면 상한에서 자동으로 멈춘다'}
      </p>
      {!running && !done && (
        <button className="btn primary block" onClick={() => { setStartedAt(Date.now()); fired.current = false }}>시작</button>
      )}
      {running && (
        <button className="btn block" onClick={() => { setDone(true); onCapReached(Math.max(1, Math.round(elapsed / 60))) }}>
          지금 끝내기
        </button>
      )}
    </div>
  )
}
