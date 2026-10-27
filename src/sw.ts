/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { registerPushHandlers } from './notify/sw-push'

declare let self: ServiceWorkerGlobalScope

// 오프라인 우선: 빌드 산출물을 전부 미리 캐시하고, 화면 이동은 index.html로 보낸다.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

registerPushHandlers(self)
