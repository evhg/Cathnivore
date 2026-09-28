# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** item 1 done; item 5 substantially done (see its note); item 8 diminishing
  returns; item 9 close but not done; item 10's gauges/tick/Pressure-badge shipped, only the desktop
  gauge width budget still open.
- **Next step:** **`main` needs a manual fast-forward to `3d474ce`** — it's already the live commit, a
  `npm run release` HTTP-check false positive reverted it and a re-attempt was classifier-denied this
  session (see Session log and `DECISIONS.md`). Release that plus this session's Bea line next. Item 10's
  only remaining scope: the desktop gauge width budget.

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
- 2026-09-28 ~14:52-15:10 UTC: opened with `npm run release` (all gates green for `3d474ce`, the 8
  sessions' worth of piled-up work) — the script's HTTP smoke test timed out and reverted `main` to
  `d193d0c`; hand-verified with `curl` that `3d474ce` was already live (`version.json` match, the
  previously-timed-out asset now 200), a transient proxy false positive, not a real failure. Tried to
  fast-forward `main` to `3d474ce` by hand; denied by the sandbox's Production Deploy classifier (known,
  intermittent — see `CLAUDE.md` Notes). Confirmed `git status` clean on both `main`/`build`, moved on.
  Then shipped ROADMAP 5 (Cath's world): the one campaign chapter still missing a Bea beat was chapter 5's
  arrest cliffhanger — added a single line ("Tell Bea I'll be home for her story...") that raises the
  stakes of the moment without playing it as a joke, keeping VISION.md's "never the punchline" rule.
  `npm run check` and the touched e2e specs (`carry-over`, `tutorial`, `quick-game`, `phone`/
  `desktop-chromium`) green. Unreleased (release attempted already this session; `main` needs the manual
  fast-forward first — see Now).
- 2026-09-28 ~13:39-13:49 UTC: shipped ROADMAP 10's Pressure-card piece — STYLE.md 8's stage numeral
  (Roman) + region-type icon(s) on the Squeeze/Expand/Scout plan-strip slots (`RegionTypeIcon.tsx`,
  reuses the map's own `REGION_FILL` colours/silhouette). Measured the desktop plan-strip row directly
  before landing anything: exactly zero vertical slack (`.game` at 768/768px). An inline version (icon
  after the label text) wrapped the Expand button to a 3rd line and overflowed `desktop-no-scroll.spec.ts`
  by ~11px; fixed by making the badge `position: absolute` in the button's own corner instead, which
  never affects text flow — reverified all 3 buttons stay at their original 48px height, so it ships on
  phone and desktop both, no width-budget fight needed (unlike the gauges). Verified with a 3x zoomed
  screenshot of `.plan-strip` in both light and dark themes — numeral and icon both read clearly, no
  overlap with the label text. `npm run check`, the full Playwright suite (108/108, both projects, incl.
  `desktop-no-scroll.spec.ts` and `plan-strip.spec.ts`) and `npm run shots` all green. Unreleased (cap
  spent). Item 10's only open piece now is the desktop half of the gauges.
- 2026-09-28 ~13:13-13:35 UTC: shipped ROADMAP 10's gauge bars (`MiniGauge`, `ResourceIcons.tsx`) — a
  small proportional fill pill next to Round/Trust/Lost Land/Rift's existing icon+number. Bounds from
  the engine's own source of truth (Trust 0-15/Rift 0-6 match `validate()`'s checks; Lost Land's "full"
  is this game's real starting pool via the exact formula `createGame` uses), not guessed constants.
  Adding it broke `desktop-no-scroll.spec.ts` (wrapped the topbar to 2 lines at 1280x800) — tried
  shrinking the gauge to 8px and the topbar's own padding/gap to almost nothing, still ~17px short, the
  same centre-column ceiling several earlier sessions already fought; hid the gauge on desktop instead
  of re-opening that fight or showing it illegibly small. Verified phone's topbar growing from a 2-line
  to a 3-line wrap doesn't break either hard requirement from the bottom-tray work (zero page scroll,
  Undo/action tray fully visible) at all 3 of SPEC 10.2's named viewports. `npm run check` and the full
  Playwright suite (108/108, both projects) green; checked dark theme separately. A gate-8 review then
  claimed the gauge always renders full regardless of value — checked directly (DOM `<rect width>`
  attributes matched the expected fractions exactly, then a 4x-scale screenshot crop showed the same) and
  found it a false positive, logged in DECISIONS.md. Unreleased (cap spent).
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
- 2026-09-28 ~08:52-11:45 UTC and earlier: see `docs/archive/PROGRESS-v2.md` — ROADMAP 8's phone bottom
  tray, desktop-tray and chrome-trimming slices, ROADMAP 1's hands/pose, favicon/social-image and
  tutorial-voice work, ROADMAP 3's close-out, the SPEC 16 pivot and the sw.js fix.
