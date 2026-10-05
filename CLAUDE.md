# Cathnivore: standing instructions

You are improving the games described in `SPEC.md` and `VISION.md`, fully unattended. A routine on claude.ai starts a cloud session every hour, **indefinitely**: the owner wants the games improved and beautified until they are world-class (SPEC 16). The owner doesn't answer questions. **Never ask. Decide, log the decision in `DECISIONS.md`, and keep going.**

## Every session (SPEC 1.9 as amended by SPEC 16)
1. Run `git fetch --all` and check out `build`. If `DONE` exists, delete it (SPEC 16: the run never ends) and log it.
2. **Lock check:**
   - If `.build-lock` is less than 75 minutes old, end.
   - Otherwise write the UTC time into it, commit and push.
   - If the push is rejected, end.
3. **Read, in this order:** `FEEDBACK.md`, `PROGRESS.md`, `ROADMAP.md`, `VISION.md`, the last 60 lines of `DECISIONS.md`, `git log --oneline -15` and `origin/ci-status`. Read `SPEC.md` sections 1, 15 and 16 in full; read other SPEC sections, `STYLE.md` and `BALANCE.md` when the task touches them. Never read `docs/archive/` in full; search it with grep.
4. **Pick the work:** an open `FEEDBACK.md` note, then anything broken (CI, gates, the live site, saves, rules), then the first unfinished `ROADMAP.md` item. Write it under **Now** in `PROGRESS.md`.
   - **Never idle** (owner, 2026-10-02): a "health check only" session wastes an hour. If fewer than 3 unfinished ROADMAP items remain, plan instead: screenshot every game, have a subagent critique them against `VISION.md`, add at least 5 concrete items to `ROADMAP.md`, then start the first one.
5. **Work for about 50 minutes, in slices.** After each slice, run its checks (`npm run check`; `npm run shots` before and after any visual change; the e2e specs it touches), commit and push to `build`. Each slice leaves the game better and never half-broken.
   - **Use the full ~50 minutes** (owner instruction, 2026-09-25). Finishing one or two slices is not a reason to stop: keep starting the next one until about 45 minutes have passed.
   - **Don't start anything long after about 40 minutes** (a sim run, a big refactor). Wrap up by about 55 minutes so the lock is released before the next session starts at :51.
6. **Release** with `npm run release` when a slice is complete and every gate passes (at most 4 times a day). Tick the ROADMAP item when it ships.
7. **Before ending,** keep the notes short (SPEC 16): update **Now**, the **Session log** and **Recent releases** in `PROGRESS.md`, append at most 5 lines to `DECISIONS.md`, and archive anything over the size limits. Then delete `.build-lock`, commit and push.

## Non-negotiables (full list in SPEC section 1)
- Never ask questions or wait for input.
- Work only on `build`. Move `main` forward only through `npm run release`, which requires every gate to pass. `main` is live on cathnivore.com.
- Never push to or merge `ci-status`; only read it.
- Never print, write or commit a secret. You don't have Vercel, Apple or domain credentials, and you don't need them.
- **The iPhone App Store launch is postponed by the owner** until the games are truly impressive: no `ios.yml` or `store.yml` dispatches, and no store work, until the owner reopens it in `FEEDBACK.md` (SPEC 16).
- **Cath is the face of every game** (VISION.md "Cath: character bible"): a classy, cute, stylish mum, drawn from the shared `shared/cath/` art module.
- Cut scope before you cut stability.
- Use at most 2 subagents at once.

## Commands (create these in M0)
- `npm run check`: typecheck, lint, unit tests, quick fuzz, build.
- `npm run gates`: gates 1 to 8 in SPEC 11.4.
- `npm run e2e`: Playwright suite.
- `npm run sim`: balance simulations.
- `npm run release`: gates, fast-forward `main`, wait for the deployment, live smoke test, tag.
- `npm run shots`: screenshots of every Cathnivore screen at phone and desktop sizes, saved to `e2e/screenshots/` (gitignored). Use them before and after every visual change.

## Notes
Add short, durable notes here that will help later sessions, such as commands that work, gotchas and where things live. Keep this file under 150 lines.
- Each fresh session starts with a clean clone: `node_modules` is gitignored, so `npm ci` is needed before `npm run check`/`npm test` will even typecheck (missing deps otherwise show up as a wall of `tsc` "Cannot find module" errors, not a real code problem).
- `MCTSBot` runs through a worker pool in `sim/`. A 1,000-game MCTS run takes 25-60 minutes, so start one only early in a session, and log it in `BALANCE.md`. `RandomBot`/`HeuristicBot` sim runs are fast (~13s for 1,000 games) and safe to run anytime.
- Tag pushes (`ios-<n>`, `deploy-<n>`, `store-<n>`) fail with this session's GitHub credentials (HTTP 403). Workaround: dispatch `ios.yml`/`store.yml` directly via the GitHub MCP tool's `run_workflow` action (ref `build`) instead of pushing a tag; `origin/ci-status` records the commit tested either way. `deploy-<n>` has no workflow to dispatch, so it just stays untagged — the deploy log in `PROGRESS.md` is the source of truth instead.
- Vercel is on the Hobby plan: **100 deployments a day**. Only `main` deploys (`git.deploymentEnabled` in `vercel.json`, plus the `vercel.json` the workflows write into `ci-status`). Don't remove that rule. If a release's deployment never appears, check the daily count before anything else. Vercel deploys on a push that moves `main`, so re-pushing the same commit won't retry a skipped one; the next release with a new commit will.
- If Playwright reports a missing browser executable at a specific pinned revision (e.g. `chromium_headless_shell-1243`) even though Chromium is pre-installed, the installed revision just doesn't match what this `@playwright/test` version wants. Don't run `playwright install` (no network needed and it may not even be allowed) — pass `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-<installed-rev>/chrome-linux/chrome` (check the actual folder name under `/opt/pw-browsers` first); `playwright.config.ts`'s `phone`/`desktop-chromium`/`store-screenshots` projects already read that env var.
- The "Production Deploy" classifier denial on the `main`-merge/push step is intermittent, not fixed: it was briefly gone around 2026-09-26 (a run went clean), but has denied the manual `git checkout -B main origin/main && git merge --no-ff build` (and sometimes even a bare `git checkout build` right after) in most sessions since, including 2026-09-28. Try `npm run release` each session regardless — don't skip it on the assumption it's blocked — but if denied, don't retry per the denial's own guidance: log it under Blocked, confirm with `git status` (may need to be run standalone, not batched with the denied command) that `origin/main` and the local branch are untouched, `git checkout build`, and move on to other work.
- `ios.yml` dispatch count so far against SPEC 12's 8-build cap: 3 (day-1 signing check 2026-09-24 `b99e197`; 2026-09-25 `9fc0f37`; 2026-09-26 `6d96198`) — all failed identically on missing Apple secrets, none actually consumed a real signed build. Keep counting here whenever you dispatch it again.
- `scripts/release.ts`'s `liveSmokeTest` will fail with `ERR_CERT_AUTHORITY_INVALID` against the real live domain in this sandbox: the egress proxy re-terminates TLS and Chromium doesn't trust its CA (Node/curl do, via the OS trust store, so `curl .../version.json` is unaffected). This is a standing environment limitation, not a site problem. Do not weaken TLS/certificate verification anywhere to route around it (the harness itself denies this, "TLS/Auth Weaken", and it shouldn't be attempted another way either) — if `npm run release` reports the smoke test failed this way, cross-check by hand with `curl` against the live `version.json` for the commit match instead of trusting the script's own revert decision.
- **Portfolio (owner, 2026-09-27, SPEC 15):** `/` is the games landing page (`site/`), Cathnivore is at `/cathnivore/`, and Runnel, a daily puzzle, is at `/runnel/` (`games/runnel/`). `npm run build` is still Cathnivore-only (`dist/`, used by iOS/e2e/gates). Vercel runs `npm run build:site`, which writes `dist-site/`. The site suite is `npm run e2e:site` and runs inside gate 5. To look at the site locally, run `npm run build:site && npx vite preview --outDir dist-site`.
- `npm run release`'s browser smoke test always hits the sandbox proxy's `ERR_CERT_AUTHORITY_INVALID`. That verdict is "inconclusive", not "failed": the script then verifies the release over HTTP with curl and reverts `main` only if that fails too. Don't "fix" this by disabling TLS checks.
- `npm run shots`/`npm run gates`/`npm run release` all reuse an already-listening `:4173` preview server (`playwright.config.ts`'s `reuseExistingServer: !CI`) without rebuilding. Running `gates`/`release` in the background then `shots` again in the same session can silently screenshot stale assets — a real change can render as absent. Run `lsof -i :4173` and kill any leftover process before trusting a `shots` run that follows an earlier gates/release run this session.
- **Hedgerow difficulty is bot-tuned:** after changing levels, enemies, towers or twists, run `npx tsx scripts/hedgerow-tune.ts` (about 15 min, parallel) then `npx tsx scripts/hedgerow-tune.ts --verify`, and log it in BALANCE.md. The level tests (`tests/hedgerow-levels-*.test.ts`) fail if the competent bot can't win a level.
- **Hedgerow renders in 3D** (`games/hedgerow/src/render3d/`, three.js). `/hedgerow/?2d` forces the 2D canvas renderer (also the no-WebGL fallback); `?sandbox=1` gives unlimited Marks for screenshots. Headless Chromium needs `--enable-unsafe-swiftshader --use-angle=swiftshader` for WebGL and runs it at a few fps: drive tests in `?2d`.
- Don't wait on a process with `pgrep -f <pattern>` inside a loop: the loop's own command line contains the pattern, so it never ends. Poll a log file instead.
- **Hedgerow bots:** the tuner and level tests use `playLevel(level, "best")` (the better of `competent` and `balanced`), so a simple spam strategy can't beat the curve because the benchmark played badly. Measure Scarecrow spam with `"naive"`. A full tune takes about an hour on 4 cores.
- `?sandbox=1` exposes `window.hedgerow` (`game()`, `place`, `upgrade`, `merge`, `sendWave`) so screenshot scripts can set up fields (megastructures, late waves) without clicking.
- **CATHODE** (owner, 2026-10-03; `docs/design/cathode.md`, ROADMAP Phase 6 comes first): `/cathode/` (`games/cathode/`), R-rated behind an 18+ gate.
  - Layout: `src/sim/` holds the pure rules, tested in `tests/cathode-*.test.ts`; `src/render/` is the three.js world implementing `render/types.ts`; `src/game/` has the session loop, player, enemies (jointed segment bodies, Verlet ragdolls), weapons, combat, kill-cam and synthesised audio; `src/ui/` is the DOM HUD and screens.
  - Test hooks: `?play` skips the title, `?shot` freezes time. `window.cathode` is the session; `window.cathode.input.forced = {fire: true}` drives one frame. The pause card doesn't show under webdriver.
  - Headless WebGL runs at about 3 fps under swiftshader: wait 1 s or more between scripted inputs.
- **CI is manual-only (`workflow_dispatch`) since 2026-10-05** because the owner's Actions billing is blocked and every failed run emailed them. Don't re-enable the push trigger until the owner says billing is fixed (FEEDBACK.md or chat); `origin/ci-status` won't update meanwhile. Rely on local `npm run check`/`gates`.
- **GitHub Actions minutes are finite:** when re-enabled, CI skips commits that only touch `*.md`, `.build-lock` or `docs/` and cancels superseded runs, so `origin/ci-status` has no entry for notes-only commits (read the latest code commit's). If every CI job fails in about 3 s with "recent account payments have failed or your spending limit needs to be increased", it's the owner's GitHub billing, not the code: log it under Blocked and rely on local `npm run check`/`gates`.
