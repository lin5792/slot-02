import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages 등 하위 경로 배포 시 BASE_PATH=/repo-name/ 으로 빌드
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '66일 퀘스트',
        short_name: '66퀘스트',
        description: '하루를 시간 계층으로 쌓고, 습관 하나를 66일 퀘스트로 정착시키는 앱',
        lang: 'ko',
        theme_color: '#1d1b2e',
        background_color: '#1d1b2e',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
})
