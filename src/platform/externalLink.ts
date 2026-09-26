import { Browser } from '@capacitor/browser'
import { isNativePlatform } from './native'

// SPEC 11.6: "The only links out are Privacy and Support, which open in Safari." The iPhone app never
// loads the website (all assets are bundled, section 11.6), so a plain <a href="/privacy"> would instead
// navigate the app's own WKWebView to the locally bundled copy of that page — the opposite of "open in
// Safari." On the web build there is no app shell to leave, so a normal same-tab navigation is correct
// there and matches every other in-app link's behaviour.
export function openExternalLink(path: string): void {
  if (isNativePlatform()) {
    void Browser.open({ url: `https://cathnivore.com${path}` })
  } else if (typeof window !== 'undefined') {
    window.location.href = path
  }
}
