// SPEC 11.6: several checks throughout the app need to know "is this the bundled iPhone app, not the
// website" — the service worker (main.tsx), haptics, and the app-shell CSS lockdown all gate on this.
export function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: { isNativePlatform?(): boolean } }).Capacitor?.isNativePlatform?.())
}
