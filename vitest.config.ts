import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // e2e/ holds Playwright specs (run via `npm run e2e`/gate 5), not Vitest ones.
    exclude: ['e2e/**', 'e2e-site/**', 'node_modules/**'],
  },
})
