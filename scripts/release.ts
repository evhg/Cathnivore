// Implements SPEC 11.5 "Releasing": run gates, fast-forward main to the current build commit,
// poll the live version.json, run a live smoke test, tag deploy-<n>, and log it in PROGRESS.md.
// On smoke-test failure, revert main to the previous deploy tag (never force-push) and log it.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from '@playwright/test'

const VERCEL_ADDRESS = 'cathnivore.vercel.app' // from OWNER.md; used until the domain resolves
const DOMAIN = 'https://cathnivore.com'
const POLL_TIMEOUT_MS = 10 * 60 * 1000
const POLL_INTERVAL_MS = 15 * 1000

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

function nextDeployNumber(): number {
  let tags: string[] = []
  try {
    tags = sh('git tag --list "deploy-*"').split('\n').filter(Boolean)
  } catch {
    tags = []
  }
  const nums = tags.map((t) => Number(t.replace('deploy-', ''))).filter((n) => !Number.isNaN(n))
  return nums.length ? Math.max(...nums) + 1 : 1
}

async function pollVersion(commit: string, base: string): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(`${base}/version.json`, { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as { commit?: string }
        if (json.commit === commit) return true
      }
    } catch {
      // network hiccup; keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

async function liveSmokeTest(base: string): Promise<boolean> {
  // Same pinned-Chromium-path fallback as scripts/gates.ts's GATE_5_SPECS invocation: this script runs
  // outside the `playwright test` runner (no playwright.config.ts project applies), so without this,
  // chromium.launch() defaults to the headless-shell binary, which this sandbox never installs.
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ executablePath })
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    const res = await page.goto(base, { waitUntil: 'load' })
    if (!res || !res.ok()) {
      console.log(`Smoke test failed: ${base} returned ${res?.status()}`)
      return false
    }

    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    // Graft (SPEC 4.6.7: "gain 1 Produce and 1 Marks. This guarantees a legal action always exists.") is
    // always legal on the opening turn regardless of producer pair or difficulty, so it's the one action
    // this quick check can always take without needing to know the game state first.
    await page.getByRole('button', { name: /^Graft/ }).click({ timeout: 15_000 })

    if (errors.length > 0) {
      console.log(`Smoke test failed: ${errors.length} console error(s) on ${base}:`)
      for (const e of errors) console.log(`  ${e}`)
      return false
    }
    console.log(`Smoke test passed: title loaded, Quick Game started, Graft taken, no console errors.`)
    return true
  } catch (err) {
    console.log(`Smoke test failed with an exception: ${String(err)}`)
    return false
  } finally {
    await browser?.close()
  }
}

async function main() {
  console.log('=== Running gates ===')
  execSync('tsx scripts/gates.ts', { stdio: 'inherit' })

  const buildCommit = sh('git rev-parse build')
  console.log(`\n=== Fast-forwarding main to ${buildCommit} ===`)
  sh('git fetch origin main build')
  sh('git checkout main')
  sh('git merge --ff-only build')
  sh('git push origin main')

  console.log('\n=== Polling live version.json ===')
  let base = DOMAIN
  let ok = await pollVersion(buildCommit, base)
  if (!ok) {
    console.log(`Domain not showing new commit; trying Vercel address https://${VERCEL_ADDRESS}`)
    base = `https://${VERCEL_ADDRESS}`
    ok = await pollVersion(buildCommit, base)
  }

  if (!ok) {
    console.log('Deployment did not appear within 10 minutes. Not tagging. Logging as blocked.')
    process.exitCode = 1
    return
  }

  console.log(`\n=== Live smoke test against ${base} ===`)
  // SPEC 11.5: "the title loads, a Quick Game starts, one action is taken, and there are no console
  // errors" — a real browser check against the live URL, not just an HTTP status fetch. Uses the same
  // pinned-Chromium-path workaround as e2e/gates (playwright.config.ts's PLAYWRIGHT_CHROMIUM_PATH), since
  // this script runs outside the `playwright test` runner and its config.
  const smokeTestOk = await liveSmokeTest(base)
  if (!smokeTestOk) {
    const n = nextDeployNumber() - 1
    if (n >= 1) {
      console.log(`Reverting main to deploy-${n}`)
      sh('git checkout main')
      sh(`git revert --no-edit ${buildCommit}..HEAD || true`)
      sh('git push origin main')
    }
    process.exitCode = 1
    return
  }

  const n = nextDeployNumber()
  const tag = `deploy-${n}`
  try {
    sh(`git tag ${tag}`)
    sh(`git push origin ${tag}`)
    console.log(`\nTagged ${tag} at ${buildCommit}. Remember to log it in PROGRESS.md's deploy log.`)
  } catch (err) {
    console.log(`\nCould not push tag ${tag} (see PROGRESS.md Blocked section for known cause).`)
    console.log(err)
  } finally {
    sh('git checkout build')
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
