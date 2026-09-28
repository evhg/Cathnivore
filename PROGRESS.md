# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** item 1's full listed scope is done; item 5 has 4 light, unreleased Bea
  mentions across 4 chapters. Item 8 (game-screen layout) got a real, tested slice this session:
  the desktop action list moved out of the centre column into a new side tray next to the Farm
  panel — see ROADMAP.md item 8's note for what actually changed and why it barely grew the map.
  Still open: trimming the fixed chrome around the map so it can grow further, and phone's own
  bottom-tray restructure. **Today's 4-release cap was already spent before this session started
  (from the prior session), so none of this has reached `main` yet — next session's
  `npm run release` should pick up everything since `92e7406`.**
- **Next step:** a follow-up session on item 8 should look at trimming the topbar/companion/
  tutorial-prompt/plan-strip/legend/active-producer chrome in the centre column (the real
  remaining ceiling on the map's size, per this session's measurements) before touching phone.

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
- 2026-09-28 ~09:52-10:20 UTC: gave ROADMAP 8 (game-screen layout) a dedicated session as scoped. Moved the
  desktop action list out of the centre `.game` column into a new side tray next to the Farm panel
  (`Game.tsx`'s `actionsPanel`, `.actions-sheet` in `global.css`), tried the right column first but measured
  it already near-full (Market+Plan+Log alone) before reaching for the left one instead. First pass mounted
  both the phone and desktop copies unconditionally (CSS picking which showed) — broke Playwright's
  strict-mode locators, since `display: none` doesn't stop a DOM query match; fixed by gating which one
  *mounts* with a `useIsDesktopLayout()` matchMedia hook instead. Measured directly (repeated runs against
  desktop-no-scroll.spec.ts's fixture) that this barely grows the map: the old action list already shrank to
  near-nothing in tight states, so the real ceiling is the fixed chrome around the map, not the action list
  sharing space with it. `.map`'s cap moved 260px→262px; `.map-wrap` now absorbs leftover vertical space on
  taller-than-1280x800 windows (a `shots` screenshot caught a dead gap below Undo otherwise). SPEC 10.3
  updated to match. `npm run check`, the full Playwright suite (both projects, 106/106) and `shots` all
  green; not released (today's cap already spent). ROADMAP 8 stays unchecked — see its note for what's left.
- 2026-09-28 ~08:52-09:10 UTC: closed out ROADMAP 1's last open piece — finer hair/fabric shading
  (`73e6e60`): strand-shine and depth strokes on the hair (back mass and front locks) and
  sleeve/lapel/waist fold shading on both outfits, verified across all 5 expressions and every
  framing down to 56px, gate-8 subagent review found no regressions. Added 2 more light Bea lines
  (`36bc223`, ROADMAP 5: Growing Season and Word of Mouth closings). Scoped ROADMAP item 8 (see its
  note) rather than starting it: today's desktop `.map` is deliberately capped at 260px to fit
  SPEC 10.3's no-scroll budget, so "make the map the hero" needs the actions moved out of the
  centre column — real `Game.tsx`/CSS surgery, not a same-session slice; confirmed with a live
  test (`a25949b`) that even a 10px bump past 260px fails `desktop-no-scroll.spec.ts`, so it's
  not a lever with hidden headroom. Caught my own mistake:
  started `npm run release` out of habit before checking today's cap was already spent (noted in
  Now/session log below) — stopped it via TaskStop before it touched `main` (verified
  `origin/main` still at `d193d0c`, working tree clean). All gates green, live site confirmed at
  `d193d0c` via `version.json`. **Today's 4-release cap remains spent; nothing new released.**
- 2026-09-28 ~07:51-08:14 UTC: ROADMAP 1 polish, all unreleased (today's 4-release cap was already spent).
  Gave the half-body figure hands: both outfits' sleeves already converged to one point at her waist, so drew
  clasped hands there (`cb72336`). A gate-8 subagent review (screenshots + a direct render of the half
  framing) flagged the shape as reading like a heart, not hands — redrew it as one dominant hand with
  knuckle-crease lines and a thumb over a sliver of the other hand's wrist (`497f2d1`), confirmed with a
  zoomed-in render. That same review found `e2e/screenshots.spec.ts` shot the title screen before
  `.title-cath`'s 500ms-delay/900ms fade-in finished, so every past gate-8 review of the title screen never
  actually saw her — added a wait for computed opacity 1 (`7b63459`). Replaced `public/favicon.svg` (still
  the pre-redesign 'idol style' Cath) with a square-cropped, static copy of `cathSvg({framing:'face', ...})`,
  checked it reads at 16-128px, and rasterized the same crop for `apple-touch-icon.png`/`icon-192.png`/
  `icon-512.png` (`0b171b8`, `dcd6c92`); rewrote STYLE.md 13 to match. Regenerated both `social-preview.png`
  og:images (`7af62e1`): the root one from a live mid-game capture with a Fraunces caption banner (built
  independently of the store-screenshots harness — the App Store launch itself stays postponed), and
  `site/public/social-preview.png` (found stale: its Cathnivore card icon was still the old favicon) from a
  live capture of the landing hero, which already draws from `shared/cath/cath.ts` so it picked up the new
  Cath for free. `npm run check` and a `shots`/gate-8-equivalent visual pass green after each slice. Only
  finer hair/fabric shading is left open on ROADMAP 1.
- 2026-09-28 ~06:52-07:19 UTC: closed out ROADMAP 3 (release `cb050ee`): rewrote all 6 chapters' tutorial
  prompts in Cath's first-person voice (kept every phrase `e2e/tutorial.spec.ts` asserts on), grew the
  companion line bank with a couple of tasteful Bea mentions, rewrote STYLE.md 9 to describe the new Cath in
  full, and fixed 2 known `site/src/scene.ts` issues (a shader leak on every `startScene()`/link, and no
  `webglcontextrestored` handler). Then started ROADMAP 1's remaining polish (release `d193d0c`): rendered
  every expression at 56px/160px via a throwaway Playwright script to see what the gate-8 review actually
  flagged, then widened 'determined' (furrowed brows, tighter squint, firmer mouth) and 'worried' (stronger
  raised/dropped brow, deeper frown) so they read apart from the default smirk at small size. 2 releases,
  all gates green both times, live confirmed via HTTP (browser smoke test hit the known sandbox-proxy cert
  issue both times) — **today's 4-release cap is now spent** (2 from an earlier session, 2 from this one).
  Closed with a small, unreleased ROADMAP 5 start: one light Bea line each in chapter 1's closing scene and
  chapter 6's `planUnlocked` scene, both well under SPEC 8.3's 12-line cap. ROADMAP 3 and 25 ticked; item 1's
  remaining scope (hands/pose, hair/fabric shading, favicon/social images) is next, and the next session's
  first `npm run release` will pick up the Bea commit too.
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
