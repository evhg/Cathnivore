// Runs SPEC 11.4 gates 1-8. Gate 8 (visual review) logs why it's skipped until a later milestone builds
// it out. Gate 9 (iPhone) is checked separately against origin/ci-status where SPEC 12 calls for it, not
// on every gates run.
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'

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
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '')
// e2e/screenshots.spec.ts and e2e/store-screenshots.spec.ts are gate 8's material (visual review/App
// Store assets), not gate 5's pass/fail regression suite, so they're deliberately left out here.
// e2e/desktop-no-scroll.spec.ts (SPEC 10.3's "no scrolling at 1280x800") is now genuinely fixed — see
// DECISIONS.md — so it's back in the real regression suite instead of being left out as a no-op skip.
const GATE_5_SPECS =
  'e2e/ai-teammate.spec.ts e2e/campaign.spec.ts e2e/carry-over.spec.ts e2e/crash-recovery.spec.ts e2e/csp.spec.ts e2e/desktop-no-scroll.spec.ts e2e/hotseat.spec.ts e2e/offline.spec.ts e2e/plan-strip.spec.ts e2e/quick-game.spec.ts e2e/save-recovery.spec.ts e2e/title.spec.ts e2e/tooltip.spec.ts e2e/tutorial.spec.ts'
// Gate 7's AI-teammate timing (the throttled test in e2e/ai-teammate.spec.ts) runs on its own after gate 5, not among
// gate 5's parallel workers: beside three other browsers its wall-clock reading measured the machine's load (the same
// build read about 520 ms alone and 1092-1215 ms in the 2026-11-08 release run). The 1 s budget is unchanged.
const GATE_7_TIMING = 'SPEC 11.4 gate 7'
run('Gate 5: Playwright', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test ${projects} ${GATE_5_SPECS} --grep-invert "${GATE_7_TIMING}"`)
// The website as a whole (games landing page at /, Runnel at /runnel/, Cathnivore under /cathnivore/),
// built exactly as Vercel builds it. Part of gate 5: main must not move if the site around the game breaks.
// The site suite runs two browsers at once for 1.7 h; its WebGL specs (NIGHT SHIFT's opener and class pick, Hedgerow's
// 3D camera and depot) read wall-clock timings and camera rest under SwiftShader, and beside a second browser they
// fail by load alone: the 2026-11-09 release runs failed a different few each time, every one passing alone. So a
// failure gets one more go, on its own (--last-failed, one worker); a test that fails alone too fails the gate.
part = 'b'
try {
  run('Gate 5 (site): Playwright', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test -c playwright.site.config.ts`)
} catch {
  run('Gate 5 (site): the failures again, alone', `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} npx playwright test -c playwright.site.config.ts --last-failed --workers 1`)
}

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
