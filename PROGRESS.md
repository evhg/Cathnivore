# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** 3, "Cath in Cathnivore, as guide and narrator": a companion on the game screen with reactions and a line bank. Items 1's remaining polish (favicon and social images with the new Cath, art refinement) can go alongside.
- **Next step:** see the **Session log** for where the last session stopped.

## Blocked
Nothing. (The App Store launch is postponed by the owner, not blocked; see ROADMAP "Postponed".)

## Known limitations (not blockers; the owner confirmed on 2026-09-28 that none of these hold up work)
- **Git tag pushes fail with HTTP 403** from session credentials. Tags are only bookmarks: skip them and keep the release list below.
- **The live browser smoke test hits the sandbox proxy's `ERR_CERT_AUTHORITY_INVALID`.** `npm run release` treats that as inconclusive and verifies the live site over HTTP instead.
- **Apple secrets** are only needed when the owner reopens the App Store launch.
- **`main` sometimes carries merge-only commits from earlier releases**, so `git merge --ff-only build` fails. Merge `origin/main` into `build` first (no content changes), then release.

## Known issues (small, from v1's last reviews)
- [x] `sim/run.ts`'s worker pool has no per-worker wall-clock timeout (dev tooling only). **Fixed
  2026-09-28** (`d196b03`): each worker now gets a 60s/game ceiling before it's killed with a clear error.
- [ ] `site/src/scene.ts` never calls `gl.deleteShader` after linking (minor).
- [ ] `site/src/scene.ts` has no `webglcontextrestored` handler: after a GPU reset the landing animation stays stopped until reload.

## Recent releases (newest first, last 10)
- 2026-09-28 (owner's chat session): Cath's new look everywhere (title hero, portraits, landing page star, Runnel host), title and Campaign redesigns, continuous-improvement plan.
- 2026-09-28 ~05:02 UTC and earlier: v1 hardening releases; see `docs/archive/PROGRESS-v1.md`'s deploy log.

## Session log (newest first, last 15)
- 2026-09-28 ~05:23 UTC: a routine session had already found and fixed (pre-`main`, on `build`) a real v1
  bug before this new plan landed underneath it: the root `sw.js` (SPEC 15) was wiping the live
  `/cathnivore/` PWA's own cache on activation (origin-wide `caches.keys()`/`delete()`, not scoped to the
  calling worker) — fixed to skip cache keys naming `/cathnivore/`/`/runnel/`. Also fixed 2 of the 3 "Known
  issues" above (sim `--bot`/`--difficulty` validation + the worker timeout ticked above) and hardened
  `sim/run.ts`'s error surfacing. Rebased those commits onto the owner's chat-session tip (`3a18ed4`) after
  finding it had landed the whole SPEC 16/VISION/ROADMAP/FEEDBACK pivot and the Cath-redesign kickoff while
  this session held (then re-took) the lock — no conflicts, pure addition. None of this session's fixes have
  reached `main` yet: `npm run release` hit the standing stale-local-`main`/"Production Deploy" classifier
  denial twice (see `docs/archive/PROGRESS-v1.md`'s Blocked log for the pattern) and wasn't retried a 3rd
  time. Next session: try `npm run release` first; if clean, both the sw.js fix and this new Cath-redesign
  work ship together.
- 2026-09-28 (owner's chat session): switched the routine to indefinite improvement (SPEC 16, VISION, ROADMAP, FEEDBACK); archived v1's notes; shipped the title screen and Campaign screen redesigns; the owner then set a new plan (Cath redesigned as a classy, cute, stylish mum and the star of every game; App Store launch postponed), and Cath's master art was started in `shared/cath/`.
