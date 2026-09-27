import { isNativePlatform } from './native'

// SPEC 11.6: "Launch screen ... per STYLE.md." `capacitor.config.ts` sets `launchAutoHide: false` so the
// native splash doesn't hide itself as soon as the webview finishes its initial HTML load — which, on this
// app, is before `preloadNativeStorage()`/React have run — and instead stays up until this fires, right
// after the real UI has mounted. That avoids a blank-screen flash between "splash gone" and "app rendered"
// (SPEC 11.3's "never show a blank screen" applies here too, even though that line is about save errors).
// SPEC 11.3's "never show a blank screen" spirit also means never a stuck one: `launchAutoHide: false`
// (above) means there is no OS-level fallback if this call ever rejects (a native-bridge hiccup, the
// plugin not yet ready right after launch, etc.) — with nothing else in the app ever calling `hide()`
// again, a single failed attempt would otherwise strand a real device on the launch splash forever. Retries
// a few times with a short backoff before giving up (logged, not silently swallowed).
export async function hideSplashScreen(): Promise<void> {
  if (!isNativePlatform()) return
  const { SplashScreen } = await import('@capacitor/splash-screen')
  const attempts = 3
  for (let i = 0; i < attempts; i++) {
    try {
      await SplashScreen.hide()
      return
    } catch (err) {
      if (i === attempts - 1) {
        console.warn('hideSplashScreen: giving up after', attempts, 'attempts', err)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }
}
