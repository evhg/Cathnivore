import { defineConfig, devices } from '@playwright/test'

// SPEC 11.4 gate 5 asks for WebKit at 390x844 (phone) and Chromium at 1440x900 (desktop). This session's
// sandbox only has one pinned Chromium build (no `playwright install` here — see DECISIONS.md) and no
// WebKit at all, so `phone`/`desktop-chromium` both use Chromium and accept an optional
// PLAYWRIGHT_CHROMIUM_PATH override to point at that exact pinned build; `phone-webkit` is the real
// SPEC-correct project, used wherever a full Playwright install (e.g. a future e2e CI workflow) exists.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'phone',
      // store-screenshots.spec.ts (below) is only meant for the dedicated `store-screenshots` project's
      // 428x926/deviceScaleFactor-3 viewport — without this it also runs here by default (every project
      // matches every e2e/*.spec.ts file unless excluded), where its "Cath's Plan" button is `mobile-only`
      // but still fits this viewport, so it passed, but redundantly re-generated store assets and burned
      // gate time.
      testIgnore: 'e2e/store-screenshots.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
    {
      name: 'desktop-chromium',
      // Same reason as `phone` above — and here it's a real failure, not just redundant: the "Cath's Plan"
      // button store-screenshots.spec.ts clicks is CSS `mobile-only`, so it's never actionable at this
      // viewport's 1024px+ desktop breakpoint.
      testIgnore: 'e2e/store-screenshots.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
    {
      name: 'phone-webkit',
      // Same reason as `phone` above.
      testIgnore: 'e2e/store-screenshots.spec.ts',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
    },
    {
      // SPEC 11.6/STYLE.md 13: App Store screenshots at Apple's largest *required* size (checked directly
      // against Apple's current developer docs), the "6.5-inch display" set — 1284x2778 physical pixels,
      // which is a 428x926 CSS viewport at deviceScaleFactor 3 (an iPhone 14 Plus's real logical/physical
      // pixel ratio), not a literal 1284-wide CSS viewport (that would trip the app's own 1024px desktop
      // breakpoint and render the 3-column layout instead of the phone one).
      name: 'store-screenshots',
      testMatch: 'e2e/store-screenshots.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 428, height: 926 },
        deviceScaleFactor: 3,
        hasTouch: true,
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
  ],
})
