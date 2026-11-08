import { test as base, type Browser } from '@playwright/test'

export * from '@playwright/test'

// NIGHT SHIFT specs: each test gets its own browser, and so its own GPU process.
//
// Under software WebGL (SwiftShader) one browser's pages share one GPU process. After a test's game page closes,
// that process can stay busy for minutes, and the next page's `canvas.getContext('webgl2')` waits for it: in a
// two-worker site run a job's loading card sat at 0-9% for 200 s, and an instrumented run timed that single
// getContext call at 328 s (2026-11-08). Alone, or in a browser of its own, the same test boots in about 30 s.
// It is a test-runner effect of software WebGL: on a real GPU, context creation doesn't queue behind a closed page.
// Specs that open their own contexts take `ownBrowser` (a browser for this test alone) in place of `browser`.
export const test = base.extend<{ ownBrowser: Browser }>({
  ownBrowser: async ({ playwright, launchOptions }, provide) => {
    const browser = await playwright.chromium.launch(launchOptions)
    await provide(browser)
    await browser.close()
  },
  context: async ({ playwright, launchOptions, viewport, hasTouch, isMobile, userAgent, deviceScaleFactor, baseURL, locale }, provide) => {
    const browser = await playwright.chromium.launch(launchOptions)
    const context = await browser.newContext({ viewport, hasTouch, isMobile, userAgent, deviceScaleFactor, baseURL, locale })
    await provide(context)
    await browser.close()
  },
})
