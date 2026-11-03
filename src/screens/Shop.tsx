import { useEffect, useState } from 'react'
import type { AppData } from '../hooks'
import { monthlyGoldEstimate } from '../domain/economy'
import type { Reward } from '../domain/types'
import { buyReward, deleteReward, markTicketUsed, saveReward, saveSettings } from '../db/queries'
import { Sheet, useToast } from '../ui/common'
import { Chest, Coin } from './Quests'

const fmt = (n: number) => n.toLocaleString('ko-KR')

// 상점이 비었을 때 한 번 눌러 넣는 예시. 1 G ≈ 25원(월 5만 원 기준)에 맞춘 값이다
const SUGGESTIONS: Omit<Reward, 'id' | 'createdAt'>[] = [
  { title: '좋아하는 커피 한 잔', price: 180, kind: 'now' },
  { title: '디저트 하나', price: 240, kind: 'now' },
  { title: '영화 한 편', price: 500, kind: 'now' },
  { title: '새 러닝화', price: 4000, kind: 'goal' },
]

export function Shop({ data }: { data: AppData }) {
  const { economy: eco, settings, today } = data
  const toast = useToast()
  const [editing, setEditing] = useState<Reward | 'new' | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const now = data.rewards.filter(r => r.kind === 'now').sort((a, b) => a.price - b.price)
  const goals = data.rewards.filter(r => r.kind === 'goal').sort((a, b) => a.price - b.price)
  const tickets = data.purchases.filter(p => !p.used).sort((a, b) => b.createdAt - a.createdAt)
  const won = settings.rewardBudget ? settings.rewardBudget / Math.max(1, monthlyGoldEstimate(data.quests, settings)) : null

  async function buy(r: Reward) {
    if (await buyReward(r, eco.balance, today)) toast(`${r.title} 샀다. 사용권은 아래에`)
    else toast(`${fmt(r.price - eco.balance)} G 모자라다`)
  }

  return (
    <div className="stack">
      <header className="row between">
        <h1>내 상점</h1>
        <span className="gold-pill"><Coin /> {fmt(eco.balance)} G</span>
      </header>

      <button className="card tight row between budget-row" onClick={() => setBudgetOpen(true)}>
        <span className="stack" style={{ gap: 0, textAlign: 'left' }}>
          <b className="small">내 보상 예산</b>
          <span className="small muted">
            {settings.rewardBudget ? `월 ${fmt(settings.rewardBudget)}원 · 1 G ≈ ${Math.round(won!)}원` : '한 달에 나한테 쓸 돈을 정한다'}
          </span>
        </span>
        <span className="chip">편집</span>
      </button>

      {data.rewards.length === 0 && (
        <section className="card stack">
          <h3>무엇을 받고 싶나</h3>
          <p className="small muted">진짜로 사거나 할 것만 적는다. 골드로 사면 그때 나한테 준다.</p>
          <div className="row wrap">
            {SUGGESTIONS.map(s => (
              <button key={s.title} className="btn sm" onClick={() => saveReward(s)}>{s.title} · {fmt(s.price)} G</button>
            ))}
          </div>
        </section>
      )}

      {now.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <h3>바로 쓰기</h3>
          <div className="shop-grid">
            {now.map(r => {
              const owned = tickets.filter(t => t.rewardId === r.id).length
              const can = eco.balance >= r.price
              return (
                <div key={r.id} className="item">
                  <button className="item-title" onClick={() => setEditing(r)}>{r.title}</button>
                  {owned > 0 && <span className="chip owned">×{owned}</span>}
                  <button className={`btn sm ${can ? 'primary' : ''}`} onClick={() => buy(r)}>
                    {can ? `${fmt(r.price)} G` : `${fmt(r.price - eco.balance)} G 더`}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {goals.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <h3>모아서 사기</h3>
          {goals.map(r => {
            const pct = Math.min(100, (eco.balance / r.price) * 100)
            const can = eco.balance >= r.price
            return (
              <div key={r.id} className="card stack" style={{ gap: 8 }}>
                <div className="row between">
                  <button className="item-title" onClick={() => setEditing(r)}>{r.title}</button>
                  <b className="gold-text num">{fmt(r.price)} G</b>
                </div>
                <span className="bar gold"><i style={{ width: `${pct}%` }} /></span>
                <div className="row between small">
                  <span className="muted">{can ? '살 수 있다' : `${fmt(r.price - eco.balance)} G 남음`}</span>
                  {can && <button className="btn sm primary" onClick={() => buy(r)}>사기</button>}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {settings.bundle && (
        <section className="card tight row">
          <span className="lock" aria-hidden>🔒</span>
          <span className="grow stack" style={{ gap: 0 }}>
            <b className="small">{settings.bundle}</b>
            <span className="small muted">퀘스트 할 때만</span>
          </span>
        </section>
      )}

      {tickets.length > 0 && (
        <section className="card stack">
          <h3>내 사용권</h3>
          {tickets.map(t => (
            <div key={t.id} className="row between">
              <span className="small">{t.title} <span className="muted">· {t.date.slice(5).replace('-', '/')}</span></span>
              <button className="btn sm" onClick={async () => { await markTicketUsed(t.id); toast(`${t.title} 즐기자`) }}>사용</button>
            </div>
          ))}
        </section>
      )}

      <button className="btn" onClick={() => setEditing('new')}>+ 보상 추가</button>

      <GoldLog data={data} />

      <RewardSheet reward={editing} onClose={() => setEditing(null)} />
      <BudgetSheet open={budgetOpen} data={data} onClose={() => setBudgetOpen(false)} />
    </div>
  )
}

const KIND_LABEL: Record<string, string> = {
  quest: '퀘스트', comeback: '복귀 보너스', rest: '휴식 보너스', encore: '앵콜', surprise: '깜짝 상자',
  chest: '봉인 상자', weekly: '주간 상자', record: '기록 갱신',
}

function GoldLog({ data }: { data: AppData }) {
  const recent = [...data.economy.lines].reverse().slice(0, 12)
  if (recent.length === 0) return null
  const name = (src: string) => src === 'main' ? '메인' : data.quests.find(q => q.id === src)?.title ?? ''
  return (
    <details className="card">
      <summary className="row between"><span>골드 기록</span><Chest /></summary>
      <table className="simple" style={{ marginTop: 8 }}>
        <tbody>
          {recent.map((l, i) => (
            <tr key={i}>
              <td className="muted small">{l.date.slice(5).replace('-', '/')}</td>
              <td className="small">{KIND_LABEL[l.kind]}{l.kind === 'quest' && ` · ${name(l.source)}`}</td>
              <td className="num gold-text" style={{ textAlign: 'right' }}>+{l.gold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function RewardSheet({ reward, onClose }: { reward: Reward | 'new' | null; onClose: () => void }) {
  const toast = useToast()
  const init = reward && reward !== 'new' ? reward : null
  const [f, setF] = useState({ title: '', price: 200, kind: 'now' as Reward['kind'] })
  useEffect(() => {
    if (reward) setF(init ? { title: init.title, price: init.price, kind: init.kind } : { title: '', price: 200, kind: 'now' })
  }, [reward]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={!!reward} onClose={onClose} title={init ? '보상 고치기' : '새 보상'}>
      <form className="stack" onSubmit={async e => {
        e.preventDefault()
        await saveReward({ ...(init ?? {}), title: f.title.trim(), price: f.price, kind: f.kind })
        toast(init ? '고쳤다' : '상점에 올렸다')
        onClose()
      }}>
        <label className="field">보상<input className="input" required value={f.title} placeholder="좋아하는 커피 한 잔" onChange={e => setF({ ...f, title: e.target.value })} /></label>
        <label className="field">가격 (G)<input className="input" type="number" min={1} value={f.price} onChange={e => setF({ ...f, price: Number(e.target.value) || 1 })} /></label>
        <div className="seg" role="radiogroup" aria-label="종류">
          {([['now', '바로 쓰기'], ['goal', '모아서 사기']] as const).map(([v, l]) => (
            <button type="button" key={v} role="radio" aria-checked={f.kind === v} className={f.kind === v ? 'on' : ''} onClick={() => setF({ ...f, kind: v })}>{l}</button>
          ))}
        </div>
        <button className="btn primary" type="submit">저장</button>
        {init && <button type="button" className="btn ghost danger" onClick={async () => { await deleteReward(init.id); onClose() }}>내리기</button>}
      </form>
    </Sheet>
  )
}

function BudgetSheet({ open, data, onClose }: { open: boolean; data: AppData; onClose: () => void }) {
  const { settings } = data
  const [budget, setBudget] = useState('')
  const [bundle, setBundle] = useState('')
  useEffect(() => {
    if (!open) return
    setBudget(settings.rewardBudget ? String(settings.rewardBudget) : '')
    setBundle(settings.bundle ?? '')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const est = monthlyGoldEstimate(data.quests, settings)
  return (
    <Sheet open={open} onClose={onClose} title="보상 예산">
      <form className="stack" onSubmit={async e => {
        e.preventDefault()
        await saveSettings({ rewardBudget: Number(budget) || undefined, bundle: bundle.trim() || undefined })
        onClose()
      }}>
        <label className="field">한 달 예산 (원)
          <input className="input" inputMode="numeric" value={budget} placeholder="50000" onChange={e => setBudget(e.target.value.replace(/\D/g, ''))} />
        </label>
        <p className="small muted">
          퀘스트를 다 깨면 한 달에 약 {fmt(est)} G를 번다.
          {Number(budget) > 0 && ` 그러면 1 G ≈ ${Math.round(Number(budget) / est)}원.`} 가격을 정할 때 참고만 한다.
        </p>
        <label className="field">퀘스트 할 때만 즐기는 것
          <input className="input" value={bundle} placeholder="보던 드라마 다음 화" onChange={e => setBundle(e.target.value)} />
        </label>
        <p className="small muted">평소엔 참고, 퀘스트 타이머가 도는 동안에만 한다.</p>
        <button className="btn primary" type="submit">저장</button>
      </form>
    </Sheet>
  )
}
