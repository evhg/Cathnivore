// Runs SPEC 11.4 gates 1-8. Gate 8 (visual review) logs why it's skipped until a later milestone builds
// it out. Gate 9 (iPhone) is checked separately against origin/ci-status where SPEC 12 calls for it, not
// on every gates run.
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'

function run(label: string, cmd: string) {
  console.log(`\n=== ${label} ===`)
  execSync(cmd, { stdio: 'inherit' })
}

run('Gate 1-2: typecheck, lint, test', 'npm run typecheck && npm run lint && npm run test')

// SPEC 11.4 gate 3 is literal: "10,000 RandomBot games and 1,000 HeuristicBot games." `npm run check`
// (the fast dev-loop command) intentionally uses `sim/fuzz.ts --quick`'s 200/100 instead — fine for a
// quick local check, but this is the pre-release gate every push to `main` must actually pass, so it needs
// the real counts, not the quick ones. Confirmed cheap enough to run every time: ~19s for the full 10,000
// RandomBot + 1,000 HeuristicBot games on this hardware.
run('Gate 3: fuzz (10,000 RandomBot + 1,000 HeuristicBot games)', 'npm run fuzz')

run('Gate 4: build', 'npm run build')

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
// e2e/screenshots.spec.ts and e2e/store-screenshots.spec.ts are gate 8's material (visual review/App
// Store assets), not gate 5's pass/fail regression suite, so they're deliberately left out here.
// e2e/desktop-no-scroll.spec.ts is `test.skip`'d (SPEC 10.3 gap, see DECISIONS.md) so it's a no-op either
// way, but it's left out too rather than listed-and-skipped, to avoid implying it's actively checked here.
const GATE_5_SPECS =
  'e2e/ai-teammate.spec.ts e2e/campaign.spec.ts e2e/carry-over.spec.ts e2e/csp.spec.ts e2e/hotseat.spec.ts e2e/offline.spec.ts e2e/plan-strip.spec.ts e2e/quick-game.spec.ts e2e/save-recovery.spec.ts e2e/title.spec.ts e2e/tooltip.spec.ts e2e/tutorial.spec.ts'
run('Gate 5: Playwright', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} ${GATE_5_SPECS}`)

run('Gate 6: Accessibility (axe)', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} e2e/accessibility.spec.ts`)

// SPEC 11.4 gate 7: "Lighthouse mobile performance score of 85 or more on the production build served
// locally." (The gate's other half, "each AI teammate decision takes at most 1 second with 4x CPU
// throttling," is now covered too — the real MCTS-in-Worker AI teammate exists (see DECISIONS.md) and
// `e2e/ai-teammate.spec.ts`'s throttled test, run as part of Gate 5 above, measures it directly with a
// real CDP `Emulation.setCPUThrottlingRate` session rather than just asserting it.)
async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Preview server at ${url} did not come up within ${timeoutMs}ms`)
}

function killServer(server: ChildProcess): void {
  if (server.pid) {
    try {
      process.kill(server.pid, 'SIGTERM')
    } catch {
      // already exited
    }
  }
}

async function runLighthouseGate(): Promise<void> {
  console.log('\n=== Gate 7: Performance (Lighthouse) ===')
  const port = 4173
  const url = `http://localhost:${port}/`
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
  try {
    await waitForServer(url, 20_000)
    const reportDir = 'sim/reports'
    mkdirSync(reportDir, { recursive: true })
    const reportPath = `${reportDir}/lighthouse-latest.json`
    const chromePath = process.env.CHROME_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '')
    execSync(
      `${chromePath ? `CHROME_PATH=${chromePath} ` : ''}npx lighthouse ${url} --preset=perf --form-factor=mobile ` +
        `--screenEmulation.mobile --output=json --output-path=${reportPath} ` +
        `--chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet`,
      { stdio: 'inherit' },
    )
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      categories: { performance: { score: number } }
    }
    const score = Math.round(report.categories.performance.score * 100)
    console.log(`Lighthouse mobile performance score: ${score}/100 (report: ${reportPath})`)
    if (score < 85) {
      throw new Error(`Gate 7 failed: Lighthouse performance score ${score} is below the required 85.`)
    }
    console.log(
      'Gate 7 (Lighthouse half) passed. The AI-teammate-under-throttling half is checked by ' +
        'e2e/ai-teammate.spec.ts as part of Gate 5, not here.',
    )
  } finally {
    killServer(server)
  }
}

await runLighthouseGate()

console.log('\n=== Gate 8: Visual review ===\nskipped: no visual-review subagent step yet (M6)')

console.log('\nGates run complete.')
