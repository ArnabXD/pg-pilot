import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles.css'
import App from '@/App'

const theme = localStorage.getItem('pg-pilot:theme') || 'system'
document.documentElement.classList.toggle('dark', theme === 'dark')
document.documentElement.classList.toggle('light', theme === 'light')
document.documentElement.style.setProperty(
  '--ui-scale',
  localStorage.getItem('pg-pilot:scale') || '1',
)

// Desktop app, not a browser tab: no native right-click menu, no pinch/ctrl-wheel zoom.
document.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey) e.preventDefault()
  },
  { passive: false },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
