// 습관 퀘스트 푸시 서버.
// - 매 분 cron: 구독마다 dueReminders()로 보낼 알림을 골라 웹 푸시로 보낸다
// - PUT/DELETE /api/subscription: 앱이 구독과 알림 일정(ReminderPlan)을 등록·해지
// - GET /api/ping: 연결 코드 확인
// - POST /api/test: 테스트 알림
// - PUT /api/calendar, GET /cal/<CAL_TOKEN>.ics: 캘린더 구독 주소(구글·애플 캘린더에서 URL로 구독)
// - POST /api/ics-proxy: 구글·iCloud·Outlook의 비공개 iCal 주소를 대신 받아온다 (브라우저는 CORS로 직접 못 받음)

import { dueReminders, type ReminderPlan } from '../../src/notify/schedule'
import { localPartsIn, questDateFor } from '../../src/notify/dates'
import { reminderData, sendReminder, type PushEnv } from './send'
import { loadCalendar, loadState, saveCalendar, saveState, subscriptionId, type KVLike, type StoredSubscription } from './state'

export interface Env extends PushEnv {
  STATE: KVLike
  API_TOKEN: string
  CAL_TOKEN: string
}

function cors(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': new URL(env.APP_URL).origin,
    'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
  }
}

const json = (env: Env, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(env) } })

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

function authorized(req: Request, env: Env): boolean {
  const h = req.headers.get('authorization') ?? ''
  return !!env.API_TOKEN && timingSafeEqual(h, `Bearer ${env.API_TOKEN}`)
}

/** 비공개 iCal 주소를 내주는 캘린더 서비스만 허용한다 (임의 주소 프록시 방지) */
const ICS_HOSTS = [/^calendar\.google\.com$/, /^p\d+-caldav\.icloud\.com$/, /^outlook\.(live|office365)\.com$/]

export function allowedIcsUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.replace(/^webcal:/i, 'https:'))
    return u.protocol === 'https:' && ICS_HOSTS.some((h) => h.test(u.hostname)) ? u : null
  } catch {
    return null
  }
}

function validPlan(p: unknown): p is ReminderPlan {
  const plan = p as ReminderPlan
  return !!plan && plan.version === 1 && typeof plan.timeZone === 'string' && Array.isArray(plan.items)
}

export async function handleFetch(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) })

  if (req.method === 'GET' && url.pathname.startsWith('/cal/')) {
    const token = url.pathname.slice('/cal/'.length).replace(/\.ics$/, '')
    if (!env.CAL_TOKEN || !timingSafeEqual(token, env.CAL_TOKEN)) return new Response('not found', { status: 404 })
    const ics = await loadCalendar(env.STATE)
    if (!ics) return new Response('not found', { status: 404 })
    return new Response(ics, {
      headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'max-age=900' },
    })
  }

  if (!url.pathname.startsWith('/api/')) return new Response('not found', { status: 404 })
  if (!authorized(req, env)) return json(env, { error: 'unauthorized' }, 401)

  if (url.pathname === '/api/ping' && req.method === 'GET') return json(env, { ok: true })

  if (url.pathname === '/api/subscription' && req.method === 'PUT') {
    const body = (await req.json()) as { subscription?: StoredSubscription['subscription']; plan?: unknown; replacesEndpoint?: string }
    const sub = body.subscription
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !validPlan(body.plan)) {
      return json(env, { error: 'invalid body' }, 400)
    }
    const state = await loadState(env.STATE)
    if (body.replacesEndpoint) delete state.subs[await subscriptionId(body.replacesEndpoint)]
    const id = await subscriptionId(sub.endpoint)
    const prev = state.subs[id]
    state.subs[id] = { subscription: sub, plan: body.plan, sent: prev?.sent ?? {}, updatedAt: Date.now() }
    await saveState(env.STATE, state)
    return json(env, { id })
  }

  if (url.pathname === '/api/subscription' && req.method === 'DELETE') {
    const { endpoint } = (await req.json()) as { endpoint?: string }
    if (!endpoint) return json(env, { error: 'invalid body' }, 400)
    const state = await loadState(env.STATE)
    delete state.subs[await subscriptionId(endpoint)]
    await saveState(env.STATE, state)
    return json(env, { ok: true })
  }

  if (url.pathname === '/api/test' && req.method === 'POST') {
    const { endpoint } = (await req.json()) as { endpoint?: string }
    const state = await loadState(env.STATE)
    const sub = endpoint ? state.subs[await subscriptionId(endpoint)] : undefined
    if (!sub) return json(env, { error: 'unknown subscription' }, 404)
    const item = sub.plan.items.find((i) => i.kind === 'backstop') ?? sub.plan.items[0]
    const local = localPartsIn(new Date(), sub.plan.timeZone)
    const outcome = await sendReminder(env, sub, reminderData(sub.plan, { item, questDate: questDateFor(local.date, local.time) }))
    return json(env, { outcome })
  }

  if (url.pathname === '/api/calendar' && req.method === 'PUT') {
    const ics = await req.text()
    if (!ics.startsWith('BEGIN:VCALENDAR')) return json(env, { error: 'not an iCalendar file' }, 400)
    await saveCalendar(env.STATE, ics)
    const calUrl = new URL(`/cal/${env.CAL_TOKEN}.ics`, url.origin)
    return json(env, { url: calUrl.toString(), webcal: calUrl.toString().replace(/^https:/, 'webcal:') })
  }

  if (url.pathname === '/api/ics-proxy' && req.method === 'POST') {
    const { url: target } = (await req.json()) as { url?: string }
    const u = target ? allowedIcsUrl(target) : null
    if (!u) return json(env, { error: 'unsupported calendar url' }, 400)
    // 리다이렉트도 허용 목록 안에서만 따라간다
    let res = await fetch(u.toString(), { headers: { accept: 'text/calendar' }, redirect: 'manual' })
    for (let hop = 0; hop < 3 && res.status >= 300 && res.status < 400; hop++) {
      const next = allowedIcsUrl(new URL(res.headers.get('location') ?? '', u).toString())
      if (!next) return json(env, { error: 'redirected outside calendar services' }, 502)
      res = await fetch(next.toString(), { headers: { accept: 'text/calendar' }, redirect: 'manual' })
    }
    if (!res.ok) return json(env, { error: `calendar fetch failed: ${res.status}` }, 502)
    return new Response(await res.text(), { headers: { 'content-type': 'text/calendar; charset=utf-8', ...cors(env) } })
  }

  return json(env, { error: 'not found' }, 404)
}

/** cron 1회분. 바뀐 게 있을 때만 KV에 쓴다 */
export async function runSchedule(env: Env, now: Date): Promise<{ sent: number; removed: number; failed: number }> {
  const state = await loadState(env.STATE)
  let sent = 0
  let removed = 0
  let failed = 0
  for (const [id, sub] of Object.entries(state.subs)) {
    for (const due of dueReminders(sub.plan, now, sub.sent)) {
      const outcome = await sendReminder(env, sub, reminderData(sub.plan, due)).catch(() => 'failed' as const)
      if (outcome === 'gone') {
        delete state.subs[id]
        removed++
        break
      }
      if (outcome === 'sent') {
        sub.sent[due.item.id] = due.questDate
        sent++
      } else failed++ // 다음 분에 다시 시도한다 (유예 10분 안)
    }
  }
  if (sent || removed) await saveState(env.STATE, state)
  return { sent, removed, failed }
}

export default {
  fetch: (req: Request, env: Env) => handleFetch(req, env),
  scheduled: (controller: { scheduledTime: number }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) => {
    ctx.waitUntil(runSchedule(env, new Date(controller.scheduledTime)))
  },
}
