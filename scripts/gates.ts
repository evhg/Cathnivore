// Runs SPEC 11.4 gates 1-8. Gates whose prerequisites don't exist yet (Lighthouse, visual review) log why
// they're skipped instead of failing, until later milestones build them out. Gate 9 (iPhone) is checked
// separately against origin/ci-status where SPEC 12 calls for it, not on every gates run.
import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'

function run(label: string, cmd: string) {
  console.log(`\n=== ${label} ===`)
  execSync(cmd, { stdio: 'inherit' })
}

run('Gate 1-4: typecheck, lint, test, fuzz, build', 'npm run check')

const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH
const hasWebkit = !!browsersPath && existsSync(browsersPath) && readdirSync(browsersPath).some((f) => f.startsWith('webkit'))

if (!hasWebkit) {
  console.log(
    '\n=== Gate 5: Playwright ===\nNo WebKit binary in this sandbox (only a pinned Chromium is installed, and ' +
      "sessions never run `playwright install` — see DECISIONS.md). Running the `phone`/`desktop-chromium` " +
      'Chromium projects only; `phone-webkit` (the SPEC-correct phone browser) needs a full Playwright install, ' +
      'which only exists outside this sandbox today. Logged as a standing environment limit, same as the iOS ' +
      'signing secrets — not something a session can fix.',
  )
}
const projects = hasWebkit ? '' : '--project=phone --project=desktop-chromium'
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '')
const GATE_5_SPECS = 'e2e/campaign.spec.ts e2e/hotseat.spec.ts e2e/quick-game.spec.ts e2e/title.spec.ts'
run('Gate 5: Playwright', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} ${GATE_5_SPECS}`)

run('Gate 6: Accessibility (axe)', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} e2e/accessibility.spec.ts`)
console.log('\n=== Gate 7: Performance (Lighthouse) ===\nskipped: no Lighthouse integration yet (M6)')
console.log('\n=== Gate 8: Visual review ===\nskipped: no visual-review subagent step yet (M6)')

console.log('\nGates run complete.')
