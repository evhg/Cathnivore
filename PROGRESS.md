# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** item 1's scope is done; item 8 hit diminishing returns 2 sessions ago.
  Item 9 ("actions as cards") is now 4 of 5 pieces done: press feedback and the region-glow pulse
  (prior session), resource cost chips (prior session), and this session's icon set — 8 new icons
  (Sell, Invest, Scheme, Graft, Open Stall, Supply, Rebut, Role) documented in a new STYLE.md 5.1 and
  drawn in `src/ui/icons/ActionIcons.tsx`, at the start of every action button. A gate-8 review of the
  first pass caught 3 real defects (Scheme reading as a plain chevron, Open Stall reading as a
  monitor, Supply/Rebut's faded shape having no visible outline at all) — all fixed and reverified
  with zoomed renders before committing. **Today's 4-release cap was already spent before this
  session started, so none of this has reached `main` yet — next session's `npm run release` should
  pick up everything since `92e7406`.**
- **Next step:** item 9's last piece, disabled/why-not states, is a real behaviour change (today only
  *legal* actions render as buttons at all) touching enough e2e tests (tutorial highlighting, the AI
  teammate) to need its own dedicated session — or, given 4 sessions have now piled up unreleased
  work on `build`, the next session might reasonably open with `npm run release` instead.

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
- 2026-09-28 ~12:17-12:35 UTC: ROADMAP 9's icon set, unreleased (cap spent). Documented 8 new icons in
  STYLE.md 5.1 (Sell, Invest, Scheme, Graft, Open Stall, Supply, Rebut, Role — same 24px/flat-fill/
  2px-ink-outline grid as the resource icons) and drew them in `src/ui/icons/ActionIcons.tsx`, wired in
  at the start of every action button (a new `.action-label` wrapper span so the button's existing
  `justify-content: space-between` still only ever splits 2 children — icon+label, and the cost chip —
  not an icon/text/chip trio spread unevenly). Supply/Rebut reuse the map's Outlet/Doubt colour language
  (a faded piece struck through with an X) instead of new shapes. A gate-8 subagent review of the first
  pass caught 3 real issues, all fixed and reverified with zoomed Playwright screenshots before
  committing: (1) Scheme's paper-dart redesign (already a fix for an even earlier version too close to
  Invest's card shape) still collapsed into a plain chevron at true ~18px render size — widened the dart
  and shaded one wing so it keeps a visible paper body; (2) Open Stall's canopy-to-valance proportions
  read as a boxy monitor, not an awning — flipped them so the scalloped valance dominates; (3) Supply/
  Rebut's faded box/bubble had no `stroke` at all (only fill opacity), so only the bare X was visible —
  added a separately-opaque ink outline. `npm run check`, the full Playwright suite (106/106) and
  `npm run gates` (all gates) green both before and after the icon fixes.
- 2026-09-28 ~11:51-12:16 UTC: moved from ROADMAP 8 (diminishing returns, prior session) to ROADMAP 9,
  shipping press feedback (every button, `:active` scale, a reduced-motion opacity fallback), the
  region-glow's missing pulse (STYLE.md 7 already specified it), and resource cost chips (exported
  `actions.ts`'s real cost functions rather than duplicating them in the UI, so a chip can't drift from
  what a tap actually costs) — all unreleased (cap spent). `npm run check`/full Playwright/`npm run
  gates` green throughout; one `ai-teammate.spec.ts` failure confirmed flaky/pre-existing, unrelated.
- 2026-09-28 ~11:24-11:45 UTC: gave phone's game screen its ROADMAP 8 bottom tray, unreleased (cap spent).
  Split `.game` into `.game-scroll` (topbar/companion/plan-strip/map) and `.action-tray` (producer info,
  actions, Undo/sheet-toggle footer) as flex siblings — the tray keeps its natural size and is always the
  second, non-scrolling child, so SPEC 10.2's "Bottom panel (fixed)" holds with plain flexbox, no fixed
  positioning or measured-JS-height hack (would've needed an inline `style` the CSP forbids). First pass
  capped the actions list at 42vh, which (combined with the topbar wrapping to 2 lines at 390px, plus the
  companion and plan-strip) still squeezed `.game-scroll` down to nothing — the map was entirely invisible
  on load. Bisected down to a 130px cap by direct measurement (Playwright scripts checking element
  bounding boxes, then a screenshot) — leaves ~3 action rows visible plus a 4th peeking, and the map mostly
  but not fully visible (its bottom crops within the scroll area). Desktop unaffected: both wrappers are
  `display: contents` at 1024px+, confirmed pixel-identical via `shots`. Verified at all 3 of SPEC 10.2's
  named viewports (360x640/390x844/430x932) and against the chapter-5 dense fixture (38-41 actions): zero
  page scroll, Undo always reachable. `npm run check`, the full Playwright suite (106/106) and `npm run
  gates` (all gates) green both before and after. A gate-8 review flagged "KINGSMARKET" as clipped to
  "RINGSMARKET" on the map — a zoomed screenshot showed the full text renders correctly; false positive
  from the low-res screenshot, not a real bug.
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
- 2026-09-28 ~06:52-08:14 UTC and earlier: see `docs/archive/PROGRESS-v2.md` — ROADMAP 1's hands/pose,
  favicon/social-image and tutorial-voice work, ROADMAP 3's close-out, the SPEC 16 pivot and the sw.js fix.
