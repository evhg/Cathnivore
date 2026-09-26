import type { ThemePreference } from './settings'
import { isNativePlatform } from './native'

function effectiveIsDark(theme: ThemePreference): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

// SPEC 11.6: "Status bar ... handled." Overlaying the webview (rather than the plugin reserving its own
// space) keeps the gap under our own control, matching the safe-area padding global.css already needs for
// the fixed top bar (SPEC 10.2) — see `.native-app .topbar`. The icon style tracks the same effective
// theme `applyThemeSetting` computes for the page itself (STYLE.md 3.5's "the theme follows the phone's
// setting, and Settings can force light or dark"): Capacitor's `Style.Dark` means light icons for a dark
// background, `Style.Light` means dark icons for a light background — the opposite of what the names
// suggest at a glance.
export async function applyStatusBarStyle(theme: ThemePreference): Promise<void> {
  if (!isNativePlatform()) return
  const { StatusBar, Style } = await import('@capacitor/status-bar')
  await StatusBar.setOverlaysWebView({ overlay: true })
  await StatusBar.setStyle({ style: effectiveIsDark(theme) ? Style.Dark : Style.Light })
}
