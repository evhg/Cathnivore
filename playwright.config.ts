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
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
    {
      name: 'phone-webkit',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
    },
  ],
})
