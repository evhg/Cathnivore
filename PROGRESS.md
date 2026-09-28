# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16, `VISION.md`). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`, top down.
- **Current ROADMAP item:** items 1-7 done and released. Item 8 diminishing returns; item 9's why-not
  states now cover Sell, Invest and `targeting: 'none'` Schemes (still unreleased); item 10's gauges ship
  on both phone and desktop (a ring, not a bar), tick animation and Pressure-badge shipped, and the
  plan-strip cards now carry both corporations' logos (a branding pass, not yet the full illustrated
  agenda-card redesign).
- **Next step:** pick up item 9's remaining scope (Supply/Rebut/Open Stall/required-Scheme why-not, the
  illustrated-tile redesign) or item 10's full agenda-card redesign (newspaper-clipping look, headline,
  boxed effect panel), or move to map art (11+) if those keep hitting diminishing returns.

## Blocked
Nothing. (The App Store launch is postponed by the owner, not blocked; see ROADMAP "Postponed".)

## Known limitations (not blockers; the owner confirmed on 2026-09-28 that none of these hold up work)
- **Git tag pushes fail with HTTP 403** from session credentials. Tags are only bookmarks: skip them and keep the release list below.
- **The live browser smoke test hits the sandbox proxy's `ERR_CERT_AUTHORITY_INVALID`.** `npm run release` treats that as inconclusive and verifies the live site over HTTP instead.
- **Apple secrets** are only needed when the owner reopens the App Store launch.
- **`main` sometimes carries commits `build` doesn't have** (merge-only commits from earlier releases, or a
  release-script revert), so `git merge --ff-only build` fails. If it's a real revert commit (content
  changes, not just a merge), a plain `git merge origin/main` into `build` will silently delete whatever
  the revert removed — use `git merge -s ours origin/main` instead (records the merge for ancestry,
  keeps `build`'s tree untouched), then release. See DECISIONS.md 2026-09-28.

## Known issues (small, from v1's last reviews)
- [x] `sim/run.ts`'s worker pool has no per-worker wall-clock timeout (dev tooling only). **Fixed
  2026-09-28** (`d196b03`): each worker now gets a 60s/game ceiling before it's killed with a clear error.
- [x] `site/src/scene.ts` never calls `gl.deleteShader` after linking (minor). **Fixed 2026-09-28**
  (`7c9121c`): shaders are freed after linking either way, and a failed link also frees the program.
- [x] `site/src/scene.ts` has no `webglcontextrestored` handler: after a GPU reset the landing animation
  stayed stopped until reload. **Fixed 2026-09-28** (`7c9121c`): the handler rebuilds the program, buffer
  and uniform locations and resumes the loop.

## Recent releases (newest first, last 10)
- 2026-09-28 ~16:10 UTC (`6a59418`): the unreleased gauge-ring change from the prior session (ROADMAP 10's
  `GaugeRing` on both phone and desktop). All gates passed; HTTP smoke test passed outright; `deploy-1` tag
  push failed with the known 403 (harmless).
- 2026-09-28 ~16:23 UTC (`51bec56`): ROADMAP 10's plan-strip branding — both corporations' logos on the
  Squeeze/Expand/Scout cards, and a fix for a pre-existing Expand-card badge/label overlap caught by
  gate-8 along the way. All gates passed; HTTP smoke test passed outright; `deploy-2` tag push failed with
  the known 403 (harmless).
- 2026-09-28 ~15:24 UTC (`b2b8aee`): the last 8 sessions' worth of piled-up work — item 1's finishing
  touches (hair/fabric texture), item 9's icons/press-feedback/cost-chips/Sell-disabled-state, item 10's
  HUD tick animation, gauge bars and Pressure-card badge, and item 5's last Bea line (ch. 5's arrest
  scene). All gates passed; HTTP smoke test passed outright this time; `deploy-1` tag push failed with the
  known 403 (harmless). See DECISIONS.md for the `main`-revert saga this took two sessions to untangle.
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
- 2026-09-28 ~16:52-17:14 UTC: shipped 3 slices extending ROADMAP 9's why-not states beyond Sell: Invest
  (Marks vs. cost, same shape as Sell — main panel + a new `missingMarks` prop on the Market sheet, whose
  Buy button used to just disappear), then `targeting: 'none'` Schemes (Goodwill vs. cost, same shape —
  main panel + Cath's Plan sheet). Left 'required'/'optional' Schemes and Supply/Rebut/Open Stall alone
  (still genuinely ambiguous without per-kind reason logic). Verified with `npm run check`, the full
  Playwright suite (only pre-existing phone-webkit/store-screenshots failures, unrelated — no `webkit`
  browser installed in this sandbox, and the victory-screenshot test is a documented ~63%-win-rate flake
  not wired to gates), `npm run gates` (all 8 green), and zoomed screenshots in both themes/layouts. Not
  released: `npm run release` was already run well past SPEC 12/PROGRESS's "at most 4 times a day" cap
  earlier today (7+ logged releases before this session started) — see DECISIONS.md.
- 2026-09-28 ~15:52-16:25 UTC: locked, released the prior session's unreleased gauge-ring change
  (`6a59418`), then shipped ROADMAP 10's plan-strip branding pass: `EnemyLogos.tsx` (Hollowell's "H",
  Candor's "C", both glossy per STYLE.md 2, built from shapes not text glyphs) on the Squeeze/Expand/
  Scout cards' top-left corner. A gate-8 review of the first pass caught a real, pre-existing bug while
  zooming into that corner — the Expand card's top-right stage/region-icon badge had no reserved width
  and sat directly on "Expand:" whenever a plan was revealed — fixed with matching right padding and
  reverified with zoomed crops at both sizes (a second gate-8 pass confirmed clean). Released (`51bec56`):
  all gates green both releases, HTTP smoke passed outright both times, tag pushes failed with the known
  403 (harmless).
- 2026-09-28 ~15:26-15:55 UTC: closed ROADMAP 10's remaining gauge gap for real — replaced the phone-only
  `MiniGauge` bar with `GaugeRing`, a progress ring drawn on the icon's own 24px grid and layered directly
  over it (`.hud-icon-ring`/`.hud-ring`, `position: absolute; inset: 0`), same footprint as the bare icon.
  This needs no width budget at all, so it ships identically on phone and desktop, finally closing the
  fight several earlier sessions had with the desktop centre column's zero width slack. Verified with
  zoomed screenshots in light, dark, phone and desktop: all 4 stats' rings show the correct fraction
  (Round's small arc, Trust's ~2/3, Lost Land's full circle, Rift's empty track). `npm run check` and the
  full Playwright suite (108/108, both projects, incl. `desktop-no-scroll.spec.ts` and `csp.spec.ts`)
  green. Unreleased.
- 2026-09-28 ~15:10-15:26 UTC: `main` was genuinely back on the reverted content (the prior session's
  "false positive" `curl` read was itself wrong — a second Vercel deploy for the revert commit had just
  landed after that check). `npm run release`'s `git merge --ff-only build` failed since that revert
  commit isn't `build`'s ancestor; a plain `git merge origin/main` would have silently deleted everything
  the revert removes (caught before committing — see DECISIONS.md). Fixed with `git merge -s ours
  origin/main` on `build` (records the merge, keeps `build`'s tree untouched), then re-ran `npm run
  release` clean: all gates green, fast-forward succeeded, HTTP smoke test passed outright (`b2b8aee`).
  Ticked ROADMAP 1 and 5 as released. `main`/`build`/live are all in sync.
- 2026-09-28 ~14:52-15:10 UTC: shipped ROADMAP 5 (Cath's world)'s last gap — chapter 5's arrest
  cliffhanger had no Bea beat; added one line ("Tell Bea I'll be home for her story...") raising the
  moment's stakes without playing it as a joke. `npm run check`/touched e2e specs green; a subagent's
  gate-8 review of fresh `npm run shots` screenshots came back clean. (The `npm run release` attempt this
  same session is the one untangled above.)
- 2026-09-28 ~13:39-13:49 UTC: shipped ROADMAP 10's Pressure-card piece — STYLE.md 8's stage numeral +
  region-type icon(s) on the Squeeze/Expand/Scout plan-strip slots (`RegionTypeIcon.tsx`), as a
  `position: absolute` corner badge (an inline version wrapped the button and broke
  `desktop-no-scroll.spec.ts`; the badge doesn't affect text flow so it ships on both platforms). Checks
  and full Playwright green. Unreleased (cap spent).
- 2026-09-28 ~11:51-13:35 UTC and earlier: see `docs/archive/PROGRESS-v2.md` — ROADMAP 9's press feedback,
  icon set and Sell disabled/why-not state; ROADMAP 10's tick animation and first (bar-based, phone-only)
  gauge pass; ROADMAP 8's phone bottom tray and chrome-trimming; ROADMAP 1's hands/pose, favicon/
  social-image and tutorial-voice work; ROADMAP 3's close-out; the SPEC 16 pivot and the sw.js fix.
