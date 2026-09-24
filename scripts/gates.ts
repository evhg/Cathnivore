// Runs SPEC 11.4 gates 1-8. Gates whose prerequisites don't exist yet (Playwright suite, axe,
// Lighthouse, visual review) log why they're skipped instead of failing, until later milestones
// build them out. Gate 9 (iPhone) is checked separately against origin/ci-status where SPEC 12
// calls for it, not on every gates run.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

function run(label: string, cmd: string) {
  console.log(`\n=== ${label} ===`)
  execSync(cmd, { stdio: 'inherit' })
}

run('Gate 1-4: typecheck, lint, test, fuzz, build', 'npm run check')

if (existsSync('e2e') && existsSync('playwright.config.ts')) {
  run('Gate 5: Playwright', 'npm run e2e')
} else {
  console.log('\n=== Gate 5: Playwright ===\nskipped: no playwright.config.ts yet (M3+)')
}

console.log('\n=== Gate 6: Accessibility (axe) ===\nskipped: no game screens to audit yet (M3+)')
console.log('\n=== Gate 7: Performance (Lighthouse) ===\nskipped: no production UI to measure yet (M3+)')
console.log('\n=== Gate 8: Visual review ===\nskipped: no screens to screenshot yet (M3+)')

console.log('\nGates run complete.')
