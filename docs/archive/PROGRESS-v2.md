# Progress archive, v2 (post-pivot)

Session log entries trimmed from `PROGRESS.md`'s "last 15" once the file grew past SPEC 16's
150-line limit, oldest first. `docs/archive/PROGRESS-v1.md` holds the pre-2026-09-28-pivot history
(M0-M7); this file continues from the 2026-09-28 SPEC 16/VISION/ROADMAP/FEEDBACK pivot onward.
Search with grep; never read in full.

- 2026-09-28 (owner's chat session): switched the routine to indefinite improvement (SPEC 16, VISION, ROADMAP, FEEDBACK); archived v1's notes; shipped the title screen and Campaign screen redesigns; the owner then set a new plan (Cath redesigned as a classy, cute, stylish mum and the star of every game; App Store launch postponed), and Cath's master art was started in `shared/cath/`.
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
- 2026-09-28 ~10:52-11:13 UTC: 2 more ROADMAP 8 slices, both unreleased (cap spent). (1) Merged `.plan-strip`
  and `.map-legend` into one shared desktop row (`Game.tsx`'s new `.plan-legend-row` wrapper, `display:
  contents` on phone so it's a no-op there) instead of two stacked full-width rows — real vertical slack,
  since the centre column is far wider than the map. This briefly introduced a horizontal-overflow bug
  `desktop-no-scroll.spec.ts` couldn't catch (it only checks vertical scrollHeight): `min-width: auto` on the
  flex items let their combined ~677px natural width overflow the ~641px row, clipping the topbar's Menu
  button and the legend text in a `shots` screenshot. Fixed with `min-width: 0` on both sides plus
  `flex-wrap: wrap` on the legend as a permanent safety net, re-verified with a throwaway Playwright script
  measuring `scrollWidth` directly at 1280 and 1440 before trusting the screenshot fix. `.map` max-width
  262px→284px (bisected: 289px last passing, 290px+ overflows). (2) Tightened `.topbar` and
  `.decision`/`.active-producer` desktop padding by 2px each (no legibility loss); re-bisected `.map` to
  288px (293px now the last passing width). Both slices: `npm run check`, the full Playwright suite (both
  projects, 106/106) and a `shots` visual check all green. `lsof -i :4173` confirmed no stale preview server
  before every `shots` run this session, per the known gotcha.
