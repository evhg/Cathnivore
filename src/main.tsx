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
import './styles/title.css'
import './styles/campaign.css'
import '../shared/cath/cath.css'
import { isNativePlatform } from './platform/native'
import { applyAnimationsSetting, applyThemeSetting, loadSettings } from './platform/settings'
import { preloadNativeStorage } from './platform/storage'
import { applyStatusBarStyle } from './platform/statusBar'
import { hideSplashScreen } from './platform/splash'

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

// SPEC 11.3: on the bundled iPhone app, `storage` (platform/storage.ts) is backed by an in-memory cache
// over Capacitor Preferences, not raw `localStorage` — that cache has to be warmed from the real native
// store once, before anything (including the settings calls below, and `App`'s own first render) reads
// or writes it. `preloadNativeStorage` resolves on the same microtask tick on the web build (it's a no-op
// there), so this costs web startup nothing measurable; top-level `await` isn't used here since the
// project's build target predates it (esbuild rejects it directly).
preloadNativeStorage().then(() => {
  const theme = loadSettings().theme
  applyAnimationsSetting(loadSettings().animations)
  applyThemeSetting(theme)
  void applyStatusBarStyle(theme)

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )

  void hideSplashScreen()
})

// STYLE.md 3.5's "system" theme tracks the OS live (tokens.css's media query already does this for the
// page itself); the status bar icon colour needs the same live tracking, since `applyStatusBarStyle` only
// re-runs on an explicit Settings change otherwise (see `settings.ts`'s `saveSettings`, which doesn't know
// about the status bar at all — it's a native-only concern, so it stays out of that shared, web-tested path).
if (isNativePlatform()) {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (loadSettings().theme === 'system') void applyStatusBarStyle('system')
  })
}

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
