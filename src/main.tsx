import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ToastProvider } from './ui/common'
import './styles.css'

// 브라우저가 저장소를 임의로 비우지 않도록 요청 (로컬 전용 앱의 유일한 데이터)
navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
