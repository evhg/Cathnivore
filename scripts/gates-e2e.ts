// The release's browser suites (SPEC 11.4 gate 5), in one place so the local gates (scripts/gates.ts) and GitHub's
// E2E workflow (.github/workflows/e2e.yml) run exactly the same commands.
//   npx tsx scripts/gates-e2e.ts game          the Cathnivore game suite
//   npx tsx scripts/gates-e2e.ts site [i/n]    the whole-site suite, optionally one shard of n
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const chromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '')
const env = chromiumPath ? `PLAYWRIGHT_CHROMIUM_PATH=${chromiumPath} ` : ''

// e2e/screenshots.spec.ts and e2e/store-screenshots.spec.ts are gate 8's material (visual review/App
// Store assets), not gate 5's pass/fail regression suite, so they're deliberately left out here.
// e2e/desktop-no-scroll.spec.ts (SPEC 10.3's "no scrolling at 1280x800") is now genuinely fixed — see
// DECISIONS.md — so it's back in the real regression suite instead of being left out as a no-op skip.
export const GATE_5_SPECS =
  'e2e/ai-teammate.spec.ts e2e/campaign.spec.ts e2e/carry-over.spec.ts e2e/crash-recovery.spec.ts e2e/csp.spec.ts e2e/desktop-no-scroll.spec.ts e2e/hotseat.spec.ts e2e/offline.spec.ts e2e/plan-strip.spec.ts e2e/quick-game.spec.ts e2e/save-recovery.spec.ts e2e/title.spec.ts e2e/tooltip.spec.ts e2e/tutorial.spec.ts'
// Gate 7's AI-teammate timing (the throttled test in e2e/ai-teammate.spec.ts) runs on its own after gate 5, not among
// gate 5's parallel workers: beside three other browsers its wall-clock reading measured the machine's load (the same
// build read about 520 ms alone and 1092-1215 ms in the 2026-11-08 release run). The 1 s budget is unchanged.
export const GATE_7_TIMING = 'SPEC 11.4 gate 7'

/** The game suite: the phone and desktop Chromium projects (no WebKit in the sessions' sandbox; see DECISIONS.md). */
export function gameSuite(projects = '--project=phone --project=desktop-chromium'): void {
  const cmd = `${env}npx playwright test ${projects} ${GATE_5_SPECS} --grep-invert "${GATE_7_TIMING}"`
  // As the site suite: a failure gets one more go alone (a 1.2 min round-7 spec timed out once on a busy runner,
  // 2026-11-16); a test that fails alone too fails the gate.
  try {
    execSync(cmd, { stdio: 'inherit' })
  } catch {
    console.log('\n=== Gate 5: the failures again, alone ===')
    execSync(`${cmd} --last-failed --workers 1`, { stdio: 'inherit' })
  }
}

/**
 * The website as a whole, built exactly as Vercel builds it. Its WebGL specs (NIGHT SHIFT's opener and class pick,
 * Hedgerow's 3D camera and depot) read wall-clock timings and camera rest under SwiftShader, and beside a second
 * browser they fail by load alone (the 2026-11-09 release runs failed a different few each time, every one passing
 * alone). So a failure gets one more go, on its own (--last-failed, one worker); a test that fails alone too fails.
 */
export function siteSuite(shard?: string): void {
  const s = shard ? ` --shard=${shard}` : ''
  try {
    execSync(`${env}npx playwright test -c playwright.site.config.ts${s}`, { stdio: 'inherit' })
  } catch {
    console.log('\n=== Gate 5 (site): the failures again, alone ===')
    execSync(`${env}npx playwright test -c playwright.site.config.ts --last-failed --workers 1`, { stdio: 'inherit' })
  }
}

/** Paths the workflows skip (ci.yml's and e2e.yml's paths-ignore): changes to them alone change no code. */
const notesOnly = (f: string) => f.endsWith('.md') || f === '.build-lock' || f === '.build-lock-b' || f.startsWith('docs/')

export type CiE2E = { state: 'passed' | 'failed' | 'none'; commit?: string }
/**
 * What GitHub's E2E workflow says about this checkout (status/e2e/<sha>.json on ci-status): "passed" when it passed on HEAD,
 * or on an ancestor that differs from HEAD only in notes (lock and notes commits don't run the workflow), with a
 * clean working tree; "failed" when it failed on such a commit; "none" otherwise (not run yet, or stale).
 */
export function ciE2E(): CiE2E {
  const sh = (c: string) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    if (sh('git status --porcelain --untracked-files=no')) return { state: 'none' }
    sh('git fetch -q origin ci-status')
    const recorded = new Set(sh('git ls-tree --name-only origin/ci-status status/e2e/').split('\n').map((f) => f.replace(/^status\/e2e\//, '').replace(/\.json$/, '')))
    // The newest commit at or under HEAD the workflow recorded; it counts only if every change since is notes.
    for (const commit of sh('git rev-list -n 200 HEAD').split('\n')) {
      if (!recorded.has(commit)) continue
      const changed = sh(`git diff --name-only ${commit} HEAD`).split('\n').filter(Boolean)
      if (!changed.every(notesOnly)) return { state: 'none' }
      const st = JSON.parse(sh(`git show origin/ci-status:status/e2e/${commit}.json`)) as { success: boolean }
      return { state: st.success ? 'passed' : 'failed', commit }
    }
    return { state: 'none' }
  } catch {
    return { state: 'none' }
  }
}

/**
 * The newest commit on `ref` (and not yet on origin/main) that GitHub's E2E workflow passed, or null. The lanes push
 * code faster than the workflow finishes a run, so the build head is often still waiting while an earlier commit has
 * passed: the release ships that one (owner, 2026-11-15), and the head goes out in the next release.
 */
export function newestPassed(ref = 'build'): string | null {
  const sh = (c: string) => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    sh('git fetch -q origin ci-status')
    const files = sh('git ls-tree --name-only origin/ci-status status/e2e/').split('\n')
    const recorded = new Set(files.map((f) => f.replace(/^status\/e2e\//, '').replace(/\.json$/, '')))
    for (const commit of sh(`git rev-list ${ref} ^origin/main`).split('\n').filter(Boolean)) {
      if (!recorded.has(commit)) continue
      const st = JSON.parse(sh(`git show origin/ci-status:status/e2e/${commit}.json`)) as { success: boolean }
      if (st.success) return commit
    }
    return null
  } catch {
    return null
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [which, shard] = process.argv.slice(2)
  if (which === 'game') gameSuite()
  else if (which === 'site') siteSuite(shard)
  else {
    console.error('usage: gates-e2e.ts game | site [i/n]')
    process.exit(2)
  }
}
