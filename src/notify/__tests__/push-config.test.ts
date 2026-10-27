import { describe, expect, it, vi, afterEach } from 'vitest'
import { configFromEnv, connectServer, loadConfig } from '../push-client'

const server = { serverUrl: 'https://push.example', vapidPublicKey: 'BKEY' }

describe('푸시 서버 설정', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('환경변수에는 공개값(주소·VAPID 공개키)만 쓴다', () => {
    expect(configFromEnv({ VITE_PUSH_SERVER_URL: 'https://push.example', VITE_VAPID_PUBLIC_KEY: 'BKEY' })).toEqual(server)
    expect(configFromEnv({ VITE_PUSH_SERVER_URL: 'https://push.example' })).toBeNull()
  })

  it('연결 코드는 서버 확인 후 이 기기에만 저장한다', async () => {
    expect(await loadConfig(server)).toBeNull()
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: URL, init: RequestInit) => {
      calls.push(`${url} ${(init.headers as Record<string, string>).authorization}`)
      return new Response('{}', { status: (init.headers as Record<string, string>).authorization === 'Bearer good' ? 200 : 401 })
    })
    await expect(connectServer('bad', server)).rejects.toThrow('연결 코드가 맞지 않습니다')
    expect(await loadConfig(server)).toBeNull()
    await connectServer(' good ', server)
    expect(await loadConfig(server)).toEqual({ ...server, apiToken: 'good' })
    expect(calls).toEqual(['https://push.example/api/ping Bearer bad', 'https://push.example/api/ping Bearer good'])
  })
})
