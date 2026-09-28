# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** 3 shipped in full 2026-09-28 (`cb050ee`). Now working item 1's remaining polish:
  `d193d0c` widened the brow/eye/mouth deltas so 'determined' and 'worried' read apart from the default
  smirk at 56-96px (companion/portrait scale) — the readability half of the gate-8 flag. Still open: hands
  and a pose, finer hair/fabric shading, then replace `public/favicon.svg`, the app icon brief and the
  social images with the new Cath (STYLE.md 9 itself is already rewritten).
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
- [x] `site/src/scene.ts` never calls `gl.deleteShader` after linking (minor). **Fixed 2026-09-28**
  (`7c9121c`): shaders are freed after linking either way, and a failed link also frees the program.
- [x] `site/src/scene.ts` has no `webglcontextrestored` handler: after a GPU reset the landing animation
  stayed stopped until reload. **Fixed 2026-09-28** (`7c9121c`): the handler rebuilds the program, buffer
  and uniform locations and resumes the loop.

## Recent releases (newest first, last 10)
- 2026-09-28 ~07:18 UTC (`d193d0c`): widened Cath's 'determined'/'worried' brow, eye and mouth deltas so
  they read apart from the default smirk at companion/portrait scale (ROADMAP 1). All gates passed; HTTP
  smoke test confirmed live; `deploy-2` tag push failed with the known 403 (harmless).
- 2026-09-28 ~07:05 UTC (`cb050ee`): tutorial prompts rewritten in Cath's voice, a bigger companion line
  bank, STYLE.md 9 rewritten, and the `scene.ts` shader-leak/context-restore fixes. All gates passed; the
  browser smoke test was inconclusive (sandbox proxy cert, expected) but the HTTP check confirmed the live
  site matches; `deploy-1` tag push failed with the known 403 (harmless).
- 2026-09-28 ~06:30 UTC (`c78fad8`): Cath's bust on the Campaign screen (expression tracks chapter progress) and the Setup screen. All gates passed; `deploy-2` tag push failed with the known 403 (harmless).
- 2026-09-28 ~06:14 UTC (`adef266`): the Cath companion (game-screen reactions, end-screen portrait, tutorial-prompt face). All gates passed; `deploy-1` tag push failed with the known 403 (harmless, see Known limitations).
- 2026-09-28 (owner's chat session): Cath's new look everywhere (title hero, portraits, landing page star, Runnel host), title and Campaign redesigns, continuous-improvement plan.
- 2026-09-28 ~05:02 UTC and earlier: v1 hardening releases; see `docs/archive/PROGRESS-v1.md`'s deploy log.

## Session log (newest first, last 15)
- 2026-09-28 ~06:52-07:19 UTC: closed out ROADMAP 3 (release `cb050ee`): rewrote all 6 chapters' tutorial
  prompts in Cath's first-person voice (kept every phrase `e2e/tutorial.spec.ts` asserts on), grew the
  companion line bank with a couple of tasteful Bea mentions, rewrote STYLE.md 9 to describe the new Cath in
  full, and fixed 2 known `site/src/scene.ts` issues (a shader leak on every `startScene()`/link, and no
  `webglcontextrestored` handler). Then started ROADMAP 1's remaining polish (release `d193d0c`): rendered
  every expression at 56px/160px via a throwaway Playwright script to see what the gate-8 review actually
  flagged, then widened 'determined' (furrowed brows, tighter squint, firmer mouth) and 'worried' (stronger
  raised/dropped brow, deeper frown) so they read apart from the default smirk at small size. 2 releases,
  all gates green both times, live confirmed via HTTP (browser smoke test hit the known sandbox-proxy cert
  issue both times). ROADMAP 3 and 25 ticked; item 1's remaining scope (hands/pose, hair/fabric shading,
  favicon/social images) is next.
- 2026-09-28 ~05:51-06:31 UTC: shipped ROADMAP 3 across 5 slices, 2 releases. `CathCompanion.tsx` reacts to
  liberated/Squeeze/Expand/Rift-split log events with an expression and a deterministic line from
  `cathCompanionLines.ts` (same event always shows the same line — a region/faction hash, not RNG, so
  screenshots/e2e stay stable); added her portrait to the end screen, a face inline with tutorial prompts,
  and her bust to the Campaign (expression tracks chapter progress) and Setup screen headers. Had to shrink
  the companion at the 1024px breakpoint after it broke `desktop-no-scroll.spec.ts`'s 1280x800 budget (a
  56px portrait was enough on its own) — fixed and reverified. Caught a false-negative mid-session: a stale
  `vite preview` server on :4173 from an earlier gates run made `npm run shots` silently reuse old assets
  (Playwright's `reuseExistingServer`) — screenshots showed no Cath at all on Campaign until the stale
  server was killed. All gates green both releases; live via `version.json` at `c78fad8`. A subagent's
  gate-8 review of slice 1 found no blocking issues but flagged that Cath's small-scale portrait loses
  character-bible detail and her expressions look similar at this size — logged under Now, not fixed this
  session (a `shared/cath/` art concern, ROADMAP item 1).
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
