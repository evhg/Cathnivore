import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ui/ErrorBoundary'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'
import '@fontsource/fraunces/700-italic.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './styles/tokens.css'
import './styles/global.css'
import { isNativePlatform } from './platform/native'
import { applyAnimationsSetting, applyThemeSetting, loadSettings } from './platform/settings'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element not found')
}

// SPEC 11.6: "no text selection or long-press callouts, no pinch zoom, and no web behaviour such as
// whole-page rubber-band scrolling or link previews" inside the bundled iPhone app. Scoped to a class
// rather than applied globally, since the same index.html/CSS also serves the website, where users must
// still be able to select text and pinch-zoom (an accessibility requirement) — see global.css's
// `.native-app` rules.
if (isNativePlatform()) {
  document.documentElement.classList.add('native-app')
}
applyAnimationsSetting(loadSettings().animations)
applyThemeSetting(loadSettings().theme)

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// SPEC 11.1: the service worker (offline play, home-screen install) is web-only — it's never
// registered inside the iPhone app, where Capacitor bundles every asset instead.
if (!isNativePlatform()) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('cathnivore:update-ready'))
      },
    })
  })
}
