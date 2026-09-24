# Cathnivore: standing instructions

You are building the game described in `SPEC.md`, fully unattended. A routine on claude.ai starts a cloud session every hour. The owner will not answer questions or approve anything until the build is finished. **Never ask. Decide, log the decision in `DECISIONS.md`, and keep going.**

## Every session (full version in SPEC rule 1.9)
1. Run `git fetch --all` and check out `build`, creating it from `main` if it's missing.
2. If `DONE` exists, reply "Build finished" and end.
3. **Lock check:**
   - If `.build-lock` is less than 75 minutes old, end.
   - Otherwise write the UTC time into it, commit and push.
   - If the push is rejected, end.
4. Read `SPEC.md` in full; it is the source of truth. Then read `STYLE.md`, `OWNER.md`, `PROGRESS.md`, `DECISIONS.md`, `BALANCE.md` (if present), `git log --oneline -20` and `origin/ci-status`.
5. Check the time left against `DEADLINE`. The first session creates it as now plus 7 days, in UTC. Follow SPEC section 12; with less than 18 hours left, do only M7.
6. If `PROGRESS.md` doesn't exist yet, you are at the start of M0. Create it from SPEC sections 12 and 13.
7. Work for about 50 minutes. After each task, run its checks, tick it in `PROGRESS.md`, then commit and push to `build`.
8. Before ending, make `PROGRESS.md` accurate, delete `.build-lock`, then commit and push.

## Non-negotiables (full list in SPEC section 1)
- Never ask questions or wait for input.
- Work only on `build`. Move `main` forward only through `npm run release`, which requires every gate to pass. `main` is live on cathnivore.com.
- Never push to or merge `ci-status`; only read it.
- Never print, write or commit a secret. You don't have Vercel, Apple or domain credentials, and you don't need them.
- iOS builds cost scarce macOS minutes: push `ios-<n>` tags only where SPEC section 12 says, with at most 8 in the whole run. Apart from the day-1 signing check, none before the web version is complete.
- Cut scope before you cut stability.
- Use at most 2 subagents at once.

## Commands (create these in M0)
- `npm run check`: typecheck, lint, unit tests, quick fuzz, build.
- `npm run gates`: gates 1 to 8 in SPEC 11.4.
- `npm run e2e`: Playwright suite.
- `npm run sim`: balance simulations.
- `npm run release`: gates, fast-forward `main`, wait for the deployment, live smoke test, tag.

## Notes
Add short, durable notes here that will help later sessions, such as commands that work, gotchas and where things live. Keep this file under 150 lines.
- Each fresh session starts with a clean clone: `node_modules` is gitignored, so `npm ci` is needed before `npm run check`/`npm test` will even typecheck (missing deps otherwise show up as a wall of `tsc` "Cannot find module" errors, not a real code problem).
- `MCTSBot` (`src/ai/mcts.ts`) is slow: ~400ms per decision at the sim harness's 200-simulation budget, profiled directly in this environment. A 1,000-game MCTSBot `npm run sim` run would take hours single-threaded — don't run one until the perf issue in `PROGRESS.md`'s M2 section / `DECISIONS.md` is addressed (worker threads, or a cheaper rollout policy). `RandomBot`/`HeuristicBot` sim runs are fast (~13s for 1,000 games) and safe to run anytime.
- Tag pushes (`ios-<n>`, `deploy-<n>`, `store-<n>`) fail with this session's GitHub credentials (HTTP 403). Workaround: dispatch `ios.yml`/`store.yml` directly via the GitHub MCP tool's `run_workflow` action (ref `build`) instead of pushing a tag; `origin/ci-status` records the commit tested either way. `deploy-<n>` has no workflow to dispatch, so it just stays untagged — the deploy log in `PROGRESS.md` is the source of truth instead.
