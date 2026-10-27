import { configDefaults, defineConfig } from 'vitest/config'
// worker/는 따로 설치·테스트하는 푸시 서버 패키지다 (cd worker && npm test)
export default defineConfig({
  test: { environment: 'node', setupFiles: ['fake-indexeddb/auto'], exclude: [...configDefaults.exclude, 'worker/**'] },
})
