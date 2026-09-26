import { isNativePlatform } from './native'

// SPEC 11.6: "Launch screen ... per STYLE.md." `capacitor.config.ts` sets `launchAutoHide: false` so the
// native splash doesn't hide itself as soon as the webview finishes its initial HTML load — which, on this
// app, is before `preloadNativeStorage()`/React have run — and instead stays up until this fires, right
// after the real UI has mounted. That avoids a blank-screen flash between "splash gone" and "app rendered"
// (SPEC 11.3's "never show a blank screen" applies here too, even though that line is about save errors).
export async function hideSplashScreen(): Promise<void> {
  if (!isNativePlatform()) return
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await SplashScreen.hide()
}
