import { useState } from 'react'
import type { AppData } from '../hooks'
import { addDays, fromMin, toMin } from '../domain/time'
import type { Habit, IfThen, Weekday } from '../domain/types'
import {
  backstopFor, createHabit, exportAll, importAll, promoteHabit, saveBlock, saveSettings, updateHabit,
} from '../db/queries'
import { NotifyPanel } from '../notify/NotifyPanel'
import { useToast } from '../ui/common'

type HabitDraft = Omit<Habit, 'id' | 'createdAt' | 'status' | 'extensions'>

export function emptyHabit(today: string, bedtime: string): HabitDraft {
  return {
    title: '매일 운동',
    tiers: { min: '스쿼트 10회 (2분)', basic: '오늘의 카드 퀘스트', best: '카드 퀘스트 + 카드 하나 더' },
    intention: { anchorEvent: '퇴근 후 현관문을 닫으면', place: '거실', action: '운동복으로 갈아입는다' },
    ifThen: [
      { if: '야근으로 늦게 귀가하면', then: '현관에서 바로 최소 퀘스트를 한다' },
      { if: '아프거나 너무 피곤하면', then: '최소 퀘스트만 하고 일찍 잔다' },
      { if: '여행이나 외박이면', then: '숙소 도착 직후 최소 퀘스트를 한다' },
    ],
    anchorTime: '19:00',
    backstopTime: backstopFor(bedtime),
    startDate: today,
  }
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function HabitForm({ initial, isNew, onSave }: { initial: HabitDraft; isNew: boolean; onSave: (h: HabitDraft) => Promise<void> }) {
  const [f, setF] = useState(initial)
  const set = <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) => setF(x => ({ ...x, [k]: v }))
  const setIfThen = (i: number, patch: Partial<IfThen>) =>
    set('ifThen', [0, 1, 2].map(j => (j === i ? { ...(f.ifThen[j] ?? { if: '', then: '' }), ...patch } : f.ifThen[j] ?? { if: '', then: '' })))

  return (
    <form className="stack" onSubmit={async e => { e.preventDefault(); await onSave(f) }}>
      <label className="field">정착시킬 행위<input className="input" required value={f.title} onChange={e => set('title', e.target.value)} /></label>

      <h3>3단 버전</h3>
      <label className="field">최소 (최악의 날에도 2분 안에)<input className="input" required value={f.tiers.min} onChange={e => set('tiers', { ...f.tiers, min: e.target.value })} /></label>
      <label className="field">기본 (20~30분)<input className="input" required value={f.tiers.basic} onChange={e => set('tiers', { ...f.tiers, basic: e.target.value })} /></label>
      <label className="field">최고 (컨디션 좋은 날)<input className="input" required value={f.tiers.best} onChange={e => set('tiers', { ...f.tiers, best: e.target.value })} /></label>

      <h3>실행의도</h3>
      <p className="small muted">시각이 아니라 매일 반드시 일어나는 사건 직후에 붙인다.</p>
      <label className="field">[사건] 직후에<input className="input" required value={f.intention.anchorEvent} onChange={e => set('intention', { ...f.intention, anchorEvent: e.target.value })} /></label>
      <label className="field">[장소]에서<input className="input" required value={f.intention.place} onChange={e => set('intention', { ...f.intention, place: e.target.value })} /></label>
      <label className="field">[첫 행동]을 한다<input className="input" required value={f.intention.action} onChange={e => set('intention', { ...f.intention, action: e.target.value })} /></label>
      <div className="row">
        <label className="field grow">앵커가 보통 일어나는 시각<input className="input" type="time" value={f.anchorTime ?? ''} onChange={e => set('anchorTime', e.target.value || undefined)} /></label>
        <label className="field grow">백스톱 알람<input className="input" type="time" required value={f.backstopTime} onChange={e => set('backstopTime', e.target.value)} /></label>
      </div>

      <h3>만약 ~하면 ~한다 (장애물 3개)</h3>
      {[0, 1, 2].map(i => (
        <div key={i} className="stack" style={{ gap: 4 }}>
          <input className="input" aria-label={`장애물 ${i + 1}`} placeholder="만약… (예: 야근으로 늦게 귀가하면)" value={f.ifThen[i]?.if ?? ''} onChange={e => setIfThen(i, { if: e.target.value })} />
          <input className="input" aria-label={`대응 ${i + 1}`} placeholder="→ 그러면…" value={f.ifThen[i]?.then ?? ''} onChange={e => setIfThen(i, { then: e.target.value })} />
        </div>
      ))}

      {isNew && (
        <label className="field">1일차
          <select className="input" value={f.startDate ?? ''} onChange={e => set('startDate', e.target.value)}>
            <option value={initial.startDate!}>오늘</option>
            <option value={addDays(initial.startDate!, 1)}>내일</option>
          </select>
        </label>
      )}
      <button className="btn primary block">{isNew ? '66일 퀘스트 시작' : '저장'}</button>
    </form>
  )
}

export function Onboarding({ data }: { data: AppData }) {
  const toast = useToast()
  const [withBlocks, setWithBlocks] = useState(true)
  return (
    <div className="stack-lg">
      <div className="stack">
        <h1>66일 퀘스트</h1>
        <p className="muted">행위 하나를 66일 동안 "필수" 계층으로 올려 매일 실행한다. 최소 기준은 예외 0회, 대신 아주 작게.</p>
      </div>
      <div className="card stack">
        <label className="row small"><input type="checkbox" checked={withBlocks} onChange={e => setWithBlocks(e.target.checked)} />
          기본 하루 블록도 만든다 (평일 근무 09–18, 수면 23:30–06:30, 여유 30분, 앵커 30분)</label>
      </div>
      <div className="card">
        <HabitForm isNew initial={emptyHabit(data.today, data.settings.bedtime)} onSave={async h => {
          const habit = await createHabit(h)
          if (withBlocks) {
            const all: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
            await saveBlock({ layer: 'L0', title: '근무', start: '09:00', end: '18:00', weekdays: [1, 2, 3, 4, 5] })
            await saveBlock({ layer: 'L1', title: '수면', start: data.settings.bedtime, end: '06:30', weekdays: all, kind: 'sleep' })
            await saveBlock({ layer: 'L1', title: '여유 시간', start: '21:30', end: '22:00', weekdays: all, kind: 'buffer' })
            if (h.anchorTime) {
              await saveBlock({ layer: 'L1', title: h.title, start: h.anchorTime, end: fromMin(toMin(h.anchorTime) + 30), weekdays: all, habitId: habit.id })
            }
          }
          toast('퀘스트 시작. 최소만 해도 오늘은 성공이다')
        }} />
      </div>
    </div>
  )
}

export function Setup({ data }: { data: AppData }) {
  const toast = useToast()
  const { habit, settings } = data
  const drafts = data.habits.filter(h => h.status === 'draft')
  const settled = data.habits.filter(h => h.status === 'settled')
  const [adding, setAdding] = useState(false)

  return (
    <div className="stack-lg">
      {habit && (
        <section className="card stack">
          <h2>승격 중: {habit.title}</h2>
          <HabitForm key={habit.id} isNew={false} initial={habit} onSave={async h => { await updateHabit(habit.id, h); toast('저장했다') }} />
        </section>
      )}

      {!habit && (
        <section className="card stack">
          <h2>다음 습관 승격</h2>
          {drafts.length === 0 && !adding && <p className="small muted">대기 중인 습관이 없다.</p>}
          {drafts.map(d => (
            <div key={d.id} className="row between">
              <span>{d.title}</span>
              <button className="btn sm primary" onClick={async () => { await promoteHabit(d.id, data.today); toast(`${d.title} 승격. 1일차 시작`) }}>오늘 승격</button>
            </div>
          ))}
        </section>
      )}

      <section className="card stack">
        <div className="row between">
          <h3>대기 중인 습관</h3>
          <button className="btn sm" onClick={() => setAdding(a => !a)}>{adding ? '취소' : '+ 추가'}</button>
        </div>
        <p className="small muted">한 번에 하나만 승격한다. 지금 습관이 66일 점검을 통과하면 다음을 올린다.</p>
        {habit && drafts.map(d => <p key={d.id} className="small">· {d.title}</p>)}
        {adding && (
          <HabitForm isNew initial={{ ...emptyHabit(data.today, settings.bedtime), title: '' }} onSave={async h => {
            const created = await createHabit(h)
            setAdding(false)
            toast(created.status === 'active' ? '승격했다' : '대기 목록에 추가했다')
          }} />
        )}
        {settled.length > 0 && <p className="small">정착 완료: {settled.map(s => s.title).join(', ')}</p>}
      </section>

      <section className="card stack">
        <h3>취침 시각</h3>
        <div className="row">
          <input className="input grow" type="time" value={settings.bedtime} aria-label="취침 시각"
            onChange={e => saveSettings({ bedtime: e.target.value })} />
          {habit && habit.backstopTime !== backstopFor(settings.bedtime) && (
            <button className="btn sm" onClick={async () => { await updateHabit(habit.id, { backstopTime: backstopFor(settings.bedtime) }); toast('백스톱을 취침 1시간 전으로 맞췄다') }}>
              백스톱 {backstopFor(settings.bedtime)}로
            </button>
          )}
        </div>
      </section>

      <NotifyPanel habit={habit} blocks={data.blocks} settings={settings} />

      <section className="card stack">
        <h3>백업</h3>
        <p className="small muted">기록은 이 기기에만 저장된다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 내보낸다.</p>
        <div className="row">
          <button className="btn sm grow" onClick={async () => download(`habit-quest-${data.today}.json`, await exportAll(), 'application/json')}>내보내기</button>
          <label className="btn sm grow" style={{ textAlign: 'center' }}>
            가져오기
            <input type="file" accept="application/json" hidden onChange={async e => {
              const file = e.target.files?.[0]
              if (!file || !confirm('지금 기록을 백업 파일 내용으로 바꾼다. 계속할까?')) return
              try { await importAll(await file.text()); toast('백업을 되살렸다') } catch (err) { toast(String((err as Error).message)) }
            }} />
          </label>
        </div>
      </section>
    </div>
  )
}
