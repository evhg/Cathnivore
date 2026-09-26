import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cathnivore.game',
  appName: 'Cathnivore',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // SPEC 11.6: hidden explicitly by `src/platform/splash.ts` once the real UI has mounted, not as soon
    // as the webview's initial HTML load finishes (this app's real content isn't ready until
    // `preloadNativeStorage()` and React have both run).
    SplashScreen: {
      launchAutoHide: false,
    },
  },
}

export default config
