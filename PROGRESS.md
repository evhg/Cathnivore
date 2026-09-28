# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** item 1's scope is done; item 8 hit diminishing returns; item 9 ("actions as
  cards") is close but not done (icons, cost chips, press feedback, the region-glow pulse, and a
  disabled/why-not state for Sell are shipped; per-kind why-not reasons and the full illustrated-tile
  redesign aren't). This session moved to item 10 ("the HUD") and shipped its animation half:
  `useHudTick()` (`Game.tsx`) plays a scale-pulse on Round/Trust/Lost Land/Rift exactly once per real
  change (a per-stat counter incremented synchronously during render, keyed so React remounts and
  replays the CSS animation), gated so game load never flashes every stat at once. Deliberately
  scale-only, no colour — Round/Trust/Lost Land/Rift don't share one "which way is good" direction, and
  this session already fixed one colour-contrast mistake (the Sell disabled state, prior session) so a
  new colour choice went in only after concluding a scale transform sidesteps that risk entirely.
  Verified directly (no animation class on the very first render; a forced round advance confirms only
  the stats that actually changed tick). **Today's 4-release cap was already spent before this session
  started, so none of this has reached `main` yet — next session's `npm run release` should pick up
  everything since `92e7406`.**
- **Next step:** 6 sessions have now piled up unreleased work on `build` — the next session should
  seriously consider opening with `npm run release` (today's cap resets on the next calendar day)
  before starting more new work. Item 10's own title (illustrated gauges, branded agenda cards) still
  needs real new art and hasn't started.

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
- 2026-09-28 ~13:02-13:11 UTC: moved to ROADMAP 10 (the HUD), shipped its no-new-art half: a
  `useHudTick()` hook (`Game.tsx`) increments a per-stat counter only when Round/Trust/Lost Land/Rift
  actually change, computed synchronously during render; the topbar wraps each stat's icon+number in a
  span keyed on that counter so React remounts (replaying a CSS scale-pulse) exactly once per real
  change. Gated the animation class itself on the counter being > 0 so game load's first render never
  flashes every stat. Deliberately scale-only, no colour change — no single colour-by-direction is
  honest across all 4 stats (Round up is neutral, Trust up is good, Lost Land/Rift up are both bad), and
  a scale transform never touches text colour so there's no contrast to re-check (this session's prior
  Sell-disabled-state slice already found one real contrast mistake from an unchecked colour choice).
  Verified directly: initial render has no animation class at all; forcing a real round advance
  (autoplay) confirmed only the stats that actually changed got the tick class, the unchanged ones
  didn't. `npm run check`, the full Playwright suite (108/108, both projects) and `npm run gates` (all
  gates) green. Unreleased (cap spent). Item 10's actual title — illustrated gauges, branded agenda
  cards — needs real new art and hasn't started.
- 2026-09-28 ~12:38-13:00 UTC: started ROADMAP 9's disabled/why-not piece, unreleased (cap spent).
  Scoped to Sell only (the one action whose legality is a single resource comparison, so the reason is
  never ambiguous): a disabled placeholder button now renders for each unaffordable count, right where
  the real button would sit, with "Need N more Produce" and its cost chip. Built by splitting `standalone`
  into `sellEntries`/`otherStandalone` and inserting the synthetic disabled rows between them, so ordering
  stays natural without needing to splice into the typed `{index, action}` array. Skipped during a gated
  tutorial step (SPEC 8.1's "only the action being taught is enabled"). Added a real `button:disabled`
  style project-wide (previously only `button.primary:disabled` had one) — first pass used `opacity` on
  the whole button, which a gate-8 review measured at ~2.3:1 contrast (compounding `--ink-muted` with 50%
  opacity), well under STYLE.md 3.6's 4.5:1 floor; fixed by keeping text at plain `--ink-muted` (hand-
  verified 4.51:1 via the WCAG relative-luminance formula) and moving the opacity to only the icon/cost
  chip. New `e2e/disabled-actions.spec.ts` checks the reason text, the tooltip, and that a forced click on
  a disabled button changes nothing. `npm run check`, the full Playwright suite (108/108, both projects,
  including the new spec) and `npm run gates` (all gates) green throughout, including a second full gates
  run after the contrast fix.
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
- 2026-09-28 ~08:52-10:20 UTC and earlier: see `docs/archive/PROGRESS-v2.md` — ROADMAP 8's first slice
  (the desktop action tray), ROADMAP 1's hands/pose,
  favicon/social-image and tutorial-voice work, ROADMAP 3's close-out, the SPEC 16 pivot and the sw.js fix.
