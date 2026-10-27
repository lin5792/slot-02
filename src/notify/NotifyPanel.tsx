// 설정 화면의 "알림 · 캘린더" 카드. Setup.tsx가 <NotifyPanel habit blocks settings /> 로 넣는다.
// 정시 알림은 두 길이다: 캘린더 알람(.ics, 서버 없이 항상 동작) + 웹 푸시(푸시 서버가 있을 때, 기록을 보고 문구를 바꿈).

import { useEffect, useMemo, useState } from 'react'
import type { Block, Habit, Settings } from '../domain/types'
import { useToast } from '../ui/common'
import { upsertEventsFromIcs } from '../db/queries'
import { buildIcs, downloadIcs } from './ics-write'
import { parseIcsEvents } from './ics-read'
import { fetchIcsViaServer, publishCalendar } from './push-api'
import { configFromEnv, connectServer, disableReminders, getPushSupport, loadConfig, sendTestReminder, syncReminders, type ReminderSyncReason } from './push-client'
import type { PushServerConfig } from './push-api'
import { getSyncState } from './push-store'

const REASON_TEXT: Record<ReminderSyncReason, string> = {
  'not-configured': '푸시 서버가 없어서 캘린더 알람으로 울린다. 아래 .ics를 캘린더에 넣으면 앱이 꺼져 있어도 울린다.',
  'ios-needs-home-screen': 'iPhone·iPad는 Safari 공유 버튼 → "홈 화면에 추가"로 설치한 앱에서만 푸시가 된다 (iOS 16.4 이상).',
  'no-push': '이 브라우저는 웹 푸시를 지원하지 않는다. 캘린더 알람을 쓰자.',
  'no-service-worker': '이 브라우저는 서비스워커를 지원하지 않는다. 캘린더 알람을 쓰자.',
  'permission-denied': '알림 권한이 꺼져 있다. 기기 설정에서 이 앱의 알림을 허용해야 한다.',
  'no-active-habit': '승격 중인 습관이 없어서 보낼 알림이 없다.',
  'needs-connect-code': '이 기기를 푸시 서버에 연결해야 한다. 서버를 배포할 때 정한 연결 코드(API_TOKEN)를 한 번 입력하자.',
}

const CAL_URL_KEY = 'habit-quest:calendar-url'
const readCalUrl = () => {
  try {
    return localStorage.getItem(CAL_URL_KEY)
  } catch {
    return null
  }
}
const writeCalUrl = (v: string) => {
  try {
    localStorage.setItem(CAL_URL_KEY, v)
  } catch {
    /* 저장 못 해도 이번 화면에서는 보인다 */
  }
}

export function NotifyPanel({ habit, blocks, settings }: { habit: Habit | undefined; blocks: Block[]; settings: Settings }) {
  const toast = useToast()
  const server = useMemo(() => configFromEnv(), [])
  const support = useMemo(() => getPushSupport(window, server), [server])
  const [config, setConfig] = useState<PushServerConfig | null>(null)
  const [code, setCode] = useState('')
  const [pushOn, setPushOn] = useState(false)
  const [reason, setReason] = useState<ReminderSyncReason | null>(support.ok ? null : support.reason)
  const [calUrl, setCalUrl] = useState<string | null>(readCalUrl)
  const [importUrl, setImportUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSyncState().then((s) => setPushOn(!!s), () => setPushOn(false))
    loadConfig(server).then(setConfig, () => setConfig(null))
  }, [server])

  // 습관·백스톱·블록이 바뀌면 이미 켜 둔 푸시 일정과 구독 캘린더를 조용히 갱신한다
  const habitKey = habit && [habit.id, habit.status, habit.startDate, habit.anchorTime, habit.backstopTime, habit.extensions, habit.tiers.min].join('|')
  useEffect(() => {
    if (pushOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') syncReminders(habit, settings).catch(() => undefined)
  }, [habitKey, pushOn]) // eslint-disable-line react-hooks/exhaustive-deps
  const blocksKey = blocks.map((b) => [b.id, b.start, b.end, b.weekdays.join('')].join(':')).join('|')
  useEffect(() => {
    if (config && calUrl) publishCalendar(config, buildIcs(blocks, habit, settings)).catch(() => undefined)
  }, [habitKey, blocksKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <h3>알림 · 캘린더</h3>
      <p className="small">
        정시 알림: <b>{pushOn ? '푸시 켜짐 (기록을 보고 문구가 바뀐다)' : '캘린더 알람'}</b>
      </p>
      {(() => {
        const shown = reason ?? (server && !config ? 'needs-connect-code' : null)
        return shown && !pushOn && <p className="small muted">{REASON_TEXT[shown]}</p>
      })()}

      {server && !config && (
        <div className="row">
          <input className="input grow" type="password" autoComplete="off" placeholder="푸시 서버 연결 코드" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn sm" disabled={busy || !code} onClick={() => run(async () => {
            setConfig(await connectServer(code, server))
            setCode('')
            setReason(support.ok ? null : support.reason)
            toast('이 기기를 푸시 서버에 연결했다')
          })}>연결</button>
        </div>
      )}

      {support.ok && config && (
        <div className="row wrap">
          {!pushOn ? (
            <button className="btn sm primary" disabled={busy || !habit} onClick={() => run(async () => {
              const r = await syncReminders(habit, settings)
              setPushOn(r.mode === 'push')
              setReason(r.reason ?? null)
              if (r.mode === 'push') toast('정시 알림을 켰다. 백스톱은 기록을 보고 울린다')
            })}>정시 알림 켜기</button>
          ) : (
            <>
              <button className="btn sm" disabled={busy} onClick={() => run(async () => {
                toast((await sendTestReminder()) ? '테스트 알림을 보냈다' : '구독을 찾지 못했다. 다시 켜 보자')
              })}>테스트 알림</button>
              <button className="btn sm ghost" disabled={busy} onClick={() => run(async () => {
                await disableReminders()
                setPushOn(false)
                toast('푸시 알림을 껐다. 캘린더 알람은 그대로다')
              })}>푸시 끄기</button>
            </>
          )}
        </div>
      )}

      <p className="small"><b>캘린더로 내보내기</b></p>
      <p className="small muted">고정·필수 블록, 퀘스트 리마인더, 백스톱(정시와 15분 뒤), 주간 정비, 챕터 보스 날이 들어간다.</p>
      <div className="row wrap">
        <button className="btn sm" disabled={busy} onClick={() => run(async () => {
          await downloadIcs(buildIcs(blocks, habit, settings))
        })}>.ics 내보내기</button>
        {config && (
          <button className="btn sm" disabled={busy} onClick={() => run(async () => {
            const r = await publishCalendar(config, buildIcs(blocks, habit, settings))
            setCalUrl(r.url)
            writeCalUrl(r.url)
            toast('구독 주소를 만들었다. 블록이 바뀌면 자동으로 갱신된다')
          })}>{calUrl ? '구독 캘린더 갱신' : '구독 주소 만들기'}</button>
        )}
      </div>
      {calUrl && (
        <div className="stack">
          <input className="input" readOnly value={calUrl} onFocus={(e) => e.currentTarget.select()} aria-label="캘린더 구독 주소" />
          <div className="row wrap">
            <a className="btn sm" href={calUrl.replace(/^https:/, 'webcal:')}>iPhone·Mac 캘린더에 구독</a>
            <button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(calUrl).then(() => toast('복사했다'))}>주소 복사</button>
          </div>
          <p className="small muted">
            구글 캘린더는 웹(calendar.google.com) → 다른 캘린더 + → URL로 추가. 구글은 구독 캘린더를 늦게(최대 하루) 갱신하고 알람 처리를 보장하지 않으니, 알람은 iPhone 캘린더 구독이나 .ics 가져오기 쪽이 확실하다.
          </p>
        </div>
      )}

      <p className="small"><b>일정 가져오기 (L2 이벤트)</b></p>
      <div className="row wrap">
        <label className="btn sm">
          .ics 파일
          <input type="file" accept=".ics,text/calendar" hidden onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            await run(async () => toast(`이벤트 ${await upsertEventsFromIcs(parseIcsEvents(await file.text()))}개를 새로 가져왔다`))
            e.target.value = ''
          }} />
        </label>
      </div>
      {config && (
        <div className="row">
          <input className="input grow" placeholder="구글 캘린더 'iCal 형식의 비공개 주소'" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
          <button className="btn sm" disabled={busy || !importUrl} onClick={() => run(async () => {
            const n = await upsertEventsFromIcs(parseIcsEvents(await fetchIcsViaServer(config, importUrl)))
            toast(`이벤트 ${n}개를 새로 가져왔다`)
          })}>가져오기</button>
        </div>
      )}
    </section>
  )
}
