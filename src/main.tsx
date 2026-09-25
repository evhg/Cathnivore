import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'
import '@fontsource/fraunces/700-italic.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './styles/tokens.css'
import './styles/global.css'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element not found')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// SPEC 11.1: the service worker (offline play, home-screen install) is web-only — it's never
// registered inside the iPhone app, where Capacitor bundles every asset instead.
if (!('Capacitor' in window && (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.())) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('cathnivore:update-ready'))
      },
    })
  })
}
