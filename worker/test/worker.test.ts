import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allowedIcsUrl, handleFetch, runSchedule, type Env } from '../src/index'
import { buildReminderPlan } from '../../src/notify/schedule'
import { habit } from '../../src/notify/__tests__/fixtures'

const b64u = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url')
const unb64u = (s: string) => new Uint8Array(Buffer.from(s, 'base64url')) as Uint8Array<ArrayBuffer>

/** 브라우저 쪽(구독자) 키: RFC 8291 복호화 테스트용 */
async function makeSubscriber() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { keys, pub, auth, subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: b64u(pub), auth: b64u(auth) } } }
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, len: number) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8))
}
const cat = (...a: Uint8Array<ArrayBuffer>[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0))
  let o = 0
  for (const x of a) out.set(x, o), (o += x.length)
  return out
}
const enc = (s: string) => new TextEncoder().encode(s)

/** RFC 8291 + RFC 8188 (aes128gcm) 복호화 */
async function decrypt(body: Uint8Array<ArrayBuffer>, sub: Awaited<ReturnType<typeof makeSubscriber>>): Promise<unknown> {
  const salt = body.slice(0, 16)
  const idlen = body[20]
  const asPub = body.slice(21, 21 + idlen)
  const ct = body.slice(21 + idlen)
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, sub.keys.privateKey, 256))
  const ikm = await hkdf(sub.auth, ecdh, cat(enc('WebPush: info\0'), sub.pub, asPub), 32)
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct))
  let end = plain.length - 1
  while (plain[end] === 0) end--
  expect(plain[end]).toBe(2) // 마지막 레코드 구분자
  return JSON.parse(new TextDecoder().decode(plain.slice(0, end)))
}

async function makeEnv(): Promise<Env & { kv: Map<string, string> }> {
  const vapid = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', vapid.privateKey)
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey))
  const kv = new Map<string, string>()
  return {
    kv,
    STATE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) },
    API_TOKEN: 'secret-token',
    CAL_TOKEN: 'cal-secret',
    VAPID_PUBLIC_KEY: b64u(pubRaw),
    VAPID_PRIVATE_KEY: jwk.d!,
    VAPID_SUBJECT: 'mailto:me@example.com',
    APP_URL: 'https://app.example/hq/',
  }
}

const plan = buildReminderPlan(habit, { timeZone: 'Asia/Seoul', today: '2026-10-27' })!
const api = (env: Env, method: string, path: string, body?: unknown, token = 'secret-token') =>
  handleFetch(
    new Request(`https://push.worker${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  )

describe('worker', () => {
  let pushes: { url: string; headers: Headers; body: Uint8Array<ArrayBuffer> }[]
  let status = 201
  beforeEach(() => {
    pushes = []
    status = 201
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      pushes.push({ url, headers: new Headers(init.headers as HeadersInit), body: new Uint8Array(init.body as Uint8Array<ArrayBuffer>) })
      return new Response(null, { status })
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('토큰이 없으면 거절한다', async () => {
    const env = await makeEnv()
    expect((await api(env, 'PUT', '/api/subscription', {}, 'wrong')).status).toBe(401)
    expect((await api(env, 'PUT', '/api/subscription', { plan })).status).toBe(400)
  })

  it('정시에 암호화된 Declarative Web Push를 보내고, 같은 날 두 번 보내지 않는다', async () => {
    const env = await makeEnv()
    const sub = await makeSubscriber()
    expect((await api(env, 'PUT', '/api/subscription', { subscription: sub.subscription, plan })).status).toBe(200)

    const at = new Date('2026-10-28T22:31:00+09:00')
    expect(await runSchedule(env, at)).toEqual({ sent: 1, removed: 0, failed: 0 })
    expect(await runSchedule(env, new Date('2026-10-28T22:33:00+09:00'))).toEqual({ sent: 0, removed: 0, failed: 0 })

    const p = pushes[0]
    expect(p.url).toBe('https://push.example/abc')
    expect(p.headers.get('content-encoding')).toBe('aes128gcm')
    expect(p.headers.get('ttl')).toBe('1800')
    expect(p.headers.get('urgency')).toBe('high')
    expect(p.headers.get('topic')).toBe('backstop')
    expect(p.headers.get('authorization')).toMatch(/^vapid t=.+, k=.+/)
    // VAPID JWT 서명이 공개키로 검증되는지 (RFC 8292)
    const [, t, k] = p.headers.get('authorization')!.match(/^vapid t=([^,]+), k=(.+)$/)!
    const [h, c, sig] = t.split('.')
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({ aud: 'https://push.example', sub: 'mailto:me@example.com' })
    const vk = await crypto.subtle.importKey('raw', unb64u(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, unb64u(sig), enc(`${h}.${c}`))).toBe(true)
    const payload = (await decrypt(p.body, sub)) as Record<string, any>
    expect(payload.web_push).toBe(8030)
    expect(payload.notification.navigate).toBe('https://app.example/hq/?from=backstop')
    expect(payload.notification.data).toMatchObject({ kind: 'backstop', habitId: 'h1', questDate: '2026-10-28' })
  })

  it('실패하면 다음 분에 다시 보내고, 410이면 구독을 지운다', async () => {
    const env = await makeEnv()
    const sub = await makeSubscriber()
    await api(env, 'PUT', '/api/subscription', { subscription: sub.subscription, plan })
    status = 500
    expect(await runSchedule(env, new Date('2026-10-28T19:00:00+09:00'))).toMatchObject({ sent: 0, failed: 1 })
    status = 201
    expect(await runSchedule(env, new Date('2026-10-28T19:01:00+09:00'))).toMatchObject({ sent: 1 })
    status = 410
    expect(await runSchedule(env, new Date('2026-10-28T22:30:00+09:00'))).toMatchObject({ removed: 1 })
    expect(JSON.parse(env.kv.get('state')!).subs).toEqual({})
  })

  it('구독 교체와 해지', async () => {
    const env = await makeEnv()
    const a = await makeSubscriber()
    await api(env, 'PUT', '/api/subscription', { subscription: a.subscription, plan })
    const b = { ...a.subscription, endpoint: 'https://push.example/new' }
    await api(env, 'PUT', '/api/subscription', { subscription: b, plan, replacesEndpoint: a.subscription.endpoint })
    let subs = JSON.parse(env.kv.get('state')!).subs
    expect(Object.values(subs).map((s: any) => s.subscription.endpoint)).toEqual(['https://push.example/new'])
    await api(env, 'DELETE', '/api/subscription', { endpoint: 'https://push.example/new' })
    subs = JSON.parse(env.kv.get('state')!).subs
    expect(subs).toEqual({})
  })

  it('캘린더 구독 주소: 비밀 토큰이 맞아야 내려준다', async () => {
    const env = await makeEnv()
    const res = await api(env, 'PUT', '/api/calendar', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n')
    expect(await res.json()).toEqual({
      url: 'https://push.worker/cal/cal-secret.ics',
      webcal: 'webcal://push.worker/cal/cal-secret.ics',
    })
    const ok = await handleFetch(new Request('https://push.worker/cal/cal-secret.ics'), env)
    expect(ok.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(await ok.text()).toContain('BEGIN:VCALENDAR')
    expect((await handleFetch(new Request('https://push.worker/cal/guess.ics'), env)).status).toBe(404)
  })

  it('iCal 프록시는 캘린더 서비스 주소만 받는다', async () => {
    const env = await makeEnv()
    expect(allowedIcsUrl('webcal://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics')?.protocol).toBe('https:')
    expect(allowedIcsUrl('https://p52-caldav.icloud.com/published/2/abc')).not.toBeNull()
    expect(allowedIcsUrl('https://evil.example/basic.ics')).toBeNull()
    expect(allowedIcsUrl('http://calendar.google.com/x.ics')).toBeNull()
    expect((await api(env, 'POST', '/api/ics-proxy', { url: 'https://169.254.169.254/' })).status).toBe(400)
    const res = await api(env, 'POST', '/api/ics-proxy', { url: 'https://calendar.google.com/calendar/ical/a/private-b/basic.ics' })
    expect(res.status).toBe(200)
    expect(pushes[0].url).toBe('https://calendar.google.com/calendar/ical/a/private-b/basic.ics')
  })

  it('연결 코드 확인', async () => {
    const env = await makeEnv()
    expect((await api(env, 'GET', '/api/ping')).status).toBe(200)
    expect((await api(env, 'GET', '/api/ping', undefined, 'nope')).status).toBe(401)
  })

  it('CORS preflight', async () => {
    const env = await makeEnv()
    const res = await handleFetch(new Request('https://push.worker/api/subscription', { method: 'OPTIONS' }), env)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
  })
})
