import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppData } from './hooks'
import { DayLayers } from './screens/DayLayers'
import { Journey } from './screens/Journey'
import { Quests } from './screens/Quests'
import { Onboarding, Setup } from './screens/Setup'
import { Shop } from './screens/Shop'
import { Skills } from './screens/Skills'
import { Weekly } from './screens/Weekly'
import { Icon } from './ui/common'

const TABS = [
  { id: 'quest', label: '퀘스트', icon: Icon.today },
  { id: 'shop', label: '상점', icon: Icon.shop },
  { id: 'skills', label: '스킬', icon: Icon.skills },
  { id: 'more', label: '설정', icon: Icon.setup },
] as const
type TabId = (typeof TABS)[number]['id']

const MORE = [
  { id: 'setup', label: '습관' },
  { id: 'layers', label: '하루' },
  { id: 'journey', label: '66일' },
  { id: 'weekly', label: '주간' },
] as const
type MoreId = (typeof MORE)[number]['id']

// 예전 주소(#today, #layers …)로 들어와도 맞는 화면을 연다
const initial = (): { tab: TabId; more: MoreId } => {
  const h = location.hash.slice(1)
  if (TABS.some(t => t.id === h)) return { tab: h as TabId, more: 'setup' }
  if (MORE.some(m => m.id === h)) return { tab: 'more', more: h as MoreId }
  return { tab: 'quest', more: 'setup' }
}

export default function App() {
  const data = useAppData()
  const [tab, setTabState] = useState<TabId>(() => initial().tab)
  const [more, setMore] = useState<MoreId>(() => initial().more)
  const setTab = (t: string) => {
    setTabState(t as TabId)
    history.replaceState(null, '', `#${t}`)
    window.scrollTo({ top: 0 })
  }
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: () => {} })

  if (!data.loaded) return <div className="app" />
  if (data.habits.length === 0) return <main className="app"><Onboarding data={data} /></main>

  return (
    <>
      <main className="app">
        {needRefresh && (
          <div className="banner info row between" style={{ marginBottom: 12 }}>
            <span>새 버전이 있다.</span>
            <button className="btn sm primary" onClick={() => updateServiceWorker(true)}>업데이트</button>
          </div>
        )}
        {tab === 'quest' && <Quests data={data} goTo={setTab} />}
        {tab === 'shop' && <Shop data={data} />}
        {tab === 'skills' && <Skills data={data} />}
        {tab === 'more' && (
          <div className="stack">
            <div className="seg" role="tablist">
              {MORE.map(m => (
                <button key={m.id} role="tab" aria-selected={more === m.id} className={more === m.id ? 'on' : ''}
                  onClick={() => { setMore(m.id); history.replaceState(null, '', `#${m.id}`) }}>{m.label}</button>
              ))}
            </div>
            {more === 'setup' && <Setup data={data} />}
            {more === 'layers' && <DayLayers data={data} />}
            {more === 'journey' && <Journey data={data} />}
            {more === 'weekly' && <Weekly data={data} />}
          </div>
        )}
      </main>
      <div className="tabs">
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}
