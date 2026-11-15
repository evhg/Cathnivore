// Runs SPEC 11.4 gates 1-8. Gate 8 (visual review) logs why it's skipped until a later milestone builds
// it out. Gate 9 (iPhone) is checked separately against origin/ci-status where SPEC 12 calls for it, not
// on every gates run.
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { GATE_7_TIMING, chromiumPath, ciE2E, gameSuite, siteSuite } from './gates-e2e'

// GATES_PART=a|b|c runs one part (a: gates 1-5's game suite, b: the site suite, c: the rest), for sessions whose
// tools cap one command at 2 h (the whole run passed 2 h once the site suite reached 1.7 h, 2026-11-09; owner
// approved splitting it, 2026-11-11). Unset runs every part, as before.
const PART = process.env.GATES_PART ?? ''
let part = 'a'
const inPart = () => !PART || PART === part

function run(label: string, cmd: string) {
  if (!inPart()) return
  console.log(`\n=== ${label} ===`)
  execSync(cmd, { stdio: 'inherit' })
}

run('Gate 1-2: typecheck, lint, test', 'npm run typecheck && npm run lint && npm run test')

// AAA UI (docs/design/aaa-ui.md): every page's woff2 total stays within 180 KiB and latin only.
run('Gate 1: font budget', 'npm run build:site && npx tsx scripts/font-budget.ts')

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
// The browser suites live in scripts/gates-e2e.ts, shared with GitHub's E2E workflow. When that workflow has already
// passed them on this commit, or on one that differs from it only in notes (status/e2e/<sha>.json on ci-status), they
// aren't run a second time (owner, 2026-11-15: "speed up the release"; the site suite alone was 1.7 h here and about
// 20 min across GitHub's 8 shards). Any other case runs them here as before. GATES_LOCAL_E2E=1 forces the local run.
const ci = process.env.GATES_LOCAL_E2E ? null : ciE2E()
const ciPassed = ci?.state === 'passed' ? ci.commit : null
function e2e(label: string, fn: () => void) {
  if (!inPart()) return
  console.log(`\n=== ${label} ===`)
  if (ciPassed) console.log(`Passed in GitHub's E2E workflow on ${ciPassed} (status/e2e/<sha>.json on ci-status; only notes changed since): not run again here.`)
  else fn()
}
e2e('Gate 5: Playwright', () => gameSuite(projects))
// The website as a whole (games landing page at /, Runnel at /runnel/, Cathnivore under /cathnivore/),
// built exactly as Vercel builds it. Part of gate 5: main must not move if the site around the game breaks.
part = 'b'
e2e('Gate 5 (site): Playwright', () => siteSuite())

// CATHODE's performance budget (docs/design/cathode-combat.md S0, from C10): a staged firefight's whole-scene
// draw calls and triangles, phone (6 enemies) and desktop (12), on the dist-site Gate 1 built.
part = 'c'
run('Gate 5 (CATHODE): performance budget', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} node scripts/cathode-perf.mjs`)

run('Gate 6: Accessibility (axe)', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} e2e/accessibility.spec.ts`)

// SPEC 11.4 gate 7: "Lighthouse mobile performance score of 85 or more on the production build served
// locally." (The gate's other half, "each AI teammate decision takes at most 1 second with 4x CPU
// throttling," is now covered too — the real MCTS-in-Worker AI teammate exists (see DECISIONS.md) and
// `e2e/ai-teammate.spec.ts`'s throttled test, run on its own after the Lighthouse half, measures it directly with a
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
        'e2e/ai-teammate.spec.ts, run alone right after this.',
    )
  } finally {
    killServer(server)
  }
}

if (inPart()) await runLighthouseGate()
run(
  'Gate 7: AI teammate decision under 1 s at 4x CPU throttling (alone)',
  `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test --project=desktop-chromium --workers 1 e2e/ai-teammate.spec.ts --grep "${GATE_7_TIMING}"`,
)

// SPEC 11.4 gate 8: "capture screenshots of every screen at both sizes, plus one map screenshot in
// greyscale. A subagent reviews them against STYLE.md and section 10 and lists problems." A script can
// capture the screenshots but can't itself spawn a Claude subagent to review them, so this step does the
// scriptable half automatically (closing the gap where several early sessions treated the whole gate as
// a permanent skip) and prints an explicit reminder for the session driving `npm run gates` to do the
// review half before treating gate 8 as passed.
console.log('\n=== Gate 8: Visual review ===')
run(
  'Gate 8: capturing screenshots',
  `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} e2e/screenshots.spec.ts`,
)
console.log(
  'Screenshots captured to e2e/screenshots/ (gitignored). Gate 8 is not yet satisfied: have a subagent ' +
    'review them against STYLE.md and SPEC section 10 and fix anything it flags before treating this ' +
    'release as gated on gate 8.',
)

console.log('\nGates run complete.')
