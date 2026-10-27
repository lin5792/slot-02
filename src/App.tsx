import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppData } from './hooks'
import { DayLayers } from './screens/DayLayers'
import { Journey } from './screens/Journey'
import { Onboarding, Setup } from './screens/Setup'
import { Today } from './screens/Today'
import { Weekly } from './screens/Weekly'
import { Icon } from './ui/common'

const TABS = [
  { id: 'today', label: '오늘', icon: Icon.today },
  { id: 'layers', label: '하루', icon: Icon.layers },
  { id: 'journey', label: '66일', icon: Icon.journey },
  { id: 'weekly', label: '주간', icon: Icon.weekly },
  { id: 'setup', label: '설정', icon: Icon.setup },
] as const
type TabId = (typeof TABS)[number]['id']

const initialTab = (): TabId => {
  const h = location.hash.slice(1)
  return TABS.some(t => t.id === h) ? (h as TabId) : 'today'
}

export default function App() {
  const data = useAppData()
  const [tab, setTabState] = useState<TabId>(initialTab)
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
        {tab === 'today' && <Today data={data} goTo={setTab} />}
        {tab === 'layers' && <DayLayers data={data} />}
        {tab === 'journey' && <Journey data={data} />}
        {tab === 'weekly' && <Weekly data={data} />}
        {tab === 'setup' && <Setup data={data} />}
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
