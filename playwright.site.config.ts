import { defineConfig, devices } from '@playwright/test'

// End-to-end checks for the whole cathnivore.com site as Vercel serves it (`npm run build:site`): the
// games landing page at /, Runnel at /runnel/ and Cathnivore at /cathnivore/. The Cathnivore game itself
// is covered in depth by playwright.config.ts against its own build.
export default defineConfig({
  testDir: 'e2e-site',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  webServer: {
    command: 'npm run build:site && npx vite preview --outDir dist-site --port 4175 --strictPort',
    port: 4175,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  use: {
    baseURL: 'http://localhost:4175',
  },
  projects: [
    {
      name: 'site-phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
    {
      name: 'site-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
      },
    },
  ],
})
