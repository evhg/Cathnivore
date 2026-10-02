# Progress

Short by design (SPEC 16: under 150 lines). v1's full history (M0 to M7, every session's notes and the full deploy log) is in `docs/archive/PROGRESS-v1.md`; search it with grep and never read it in full.

## Now
- **Mode:** continuous improvement, indefinitely (SPEC 16). Work from `FEEDBACK.md`, then anything broken, then `ROADMAP.md`. **Never idle** (CLAUDE.md step 4).
- **Next:** FEEDBACK.md's round-3 note is answered (ROADMAP 47, design doc 6). Release it if today's cap allows (4 releases already on 2026-10-02, so the next session after midnight UTC), then ROADMAP 48-54 and 44's leftovers. Don't undo the 3D renderer, the auto-battler, duels or the Cath sheet: the owner asked for all of them.
- 2026-10-02 (owner's chat session, 15:22-~19:30 UTC): owner's third playtest. Built ROADMAP 47: bubble-wrapped vans, Scarecrow crowding, Windmill, Seed Cannon, eight megastructures, veterans, ambushes, winding routes on bigger fields (pan/zoom), Cath's character sheet, boss duels, tooltips, phone-fit dialogs, a synth score, richer 3D models and battlefield; bots `balanced`/`best`, re-tuned, `--antispam`.
- 2026-10-02 (owner's chat session, 09:28-12:30 UTC): owner's second playtest. Shipped ROADMAP 40-43 and 36, 39.
- 2026-10-02 (owner's chat session, 02:48-04:15 UTC): owner said Hedgerow was boring. Shipped ROADMAP 26-30 and much more (see Recent releases); live at `aadfc2c`.

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
- 2026-10-02 ~12:30 UTC (`4f67320`): Hedgerow round 2 (auto-battler, stats, story rewrite, twists, layouts, bot-tuned curve, 3D battlefield). All gates passed; HTTP check passed; tag push 403 (harmless). 4th release today (cap reached).
- 2026-10-02 ~09:25 UTC (`bdd2809`): ROADMAP 35, 36 (terrain, forks), 38 slices. main==build; tag push 403 (harmless).
- 2026-10-02 ~04:05 UTC (`aadfc2c`): Hedgerow overhaul: Cath as a hero unit, 22 tower specialisations, targeting, early calls, aimed pie, boss moves, painted acts and sprites, new build UI, journey map, graphic-novel scenes, Seed Bank (save v2), music. main==build; live version.json matches; tag push 403 (harmless).
- 2026-10-02 ~01:07 UTC (`a95986a`): all accumulated slices (scenes, plan cards, tour, motion tokens). main==build; live version.json matches; tag push 403 (harmless).
- 2026-10-01 ~13:12 UTC (`65ab9f2`): bigger desktop map. main==build; live version.json matches; tag push 403 (harmless).
- 2026-10-01 ~11:02 UTC (`b69c37f`): How to Play tour (cards page, keys, dots) + roadmap ticks. main==build; live version.json matches; tag push 403 (harmless).
- 2026-10-01 ~09:02 UTC (`55ac8ae`): scenes graphic-novel slices, final-round banner, end-screen hero. main==build; live version.json matches; deploy-2 tag push 403 (harmless).
- 2026-10-01 ~04:10 UTC (`b676182`): motion tokens complete (ROADMAP 21) + Rift banner. main==build; live version.json matches; tag push 403 (harmless).
- 2026-10-01 ~01:00 UTC (`fde53bd`): motion-token audit (global/title/campaign CSS) + Hedgerow act banners. main==build; live version.json matches; tag push 403 (harmless).
- 2026-09-30 ~19:05 UTC (`198c11b`): Hedgerow act 10 (levels 91-100, Kingsmarket, HollowCandor finale). main==build; live version.json matches; tag push 403 (harmless).
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

## Session log (newest first, last 15)
- 2026-10-02 15:22-21:00 UTC (owner chat session): round 3 (ROADMAP 47). All checks green: 729 unit/level tests, fuzz, build, 44 site e2e. Naive Scarecrow bot wins 9 of 93 levels from 8 (was 25). Unreleased: 4/day cap already used on 2026-10-02; the next session after 00:00 UTC should `npm run release`.
- 2026-10-02 ~14:52-15:10 UTC: ROADMAP 45 re-measured (naive bot wins 10 of 8-40; done). ROADMAP 37 part: 12 Rosettes (rosettes.ts, Seed Bank list, result-card note, test). tsc, lint and new test green; full check was still running at wrap-up. Unreleased (4/day cap reached).
- 2026-10-02 ~13:52-14:15 UTC: ROADMAP 45: naive Scarecrow bot measured (won 12 of levels 8-30 after the first bans); banned Scarecrows on 13,18,24,28, re-tuned and verified 13-28; level tests green. Naive bot should now win only 10,11,15,20,21,22,26,30 of 8-30 (not re-measured). Unreleased (4/day cap reached).
- 2026-10-02 ~12:52-13:10 UTC: ROADMAP 45 part 1: Scarecrow ban twist added to levels 8,9,12,14,16,17,19,23,25,27,29; levels 8-29 re-tuned and verified; hedgerow level tests green. Not yet re-measured against the naive bot; unreleased.
- 2026-10-02 ~09:28-12:30 UTC (owner's chat session): Hedgerow round 2 (auto-battler, stats, story rewrite, twists, layouts, bot + tuner, 3D renderer).
- 2026-10-02 ~08:51-09:20 UTC: ROADMAP 36 forks: `Level.path2`, `Enemy.lane`, `enemyPoint`, `laneCellsOf`; second lane painted with its own gate; test bot covers both lanes; level 94 left single-lane (bot lost). check green. Hedgerow test file now ~4 min.
- 2026-10-02 ~07:52-08:10 UTC: ROADMAP 36 terrain slice (high ground, water plots, `terrain.ts`, test). check green; unreleased, batching. Left: forks/two lanes/second spawn. Full hedgerow test file takes ~3 min.
- 2026-10-02 ~05:51-06:35 UTC: ROADMAP 38 part 1 (build pop-in/dust, upgrade sparkle, clean-sweep cheer, worried face, victory confetti, haptics.ts). check green; unreleased, batching. Left: enemies tipping over, scaffolding.
- 2026-10-02 ~04:51-05:15 UTC: ROADMAP 35 (Neighbours at level 12, Rally at level 25, two perks, tests). e2e:site needs PLAYWRIGHT_CHROMIUM_PATH. Unreleased, batching.
- 2026-10-02 ~02:48-04:20 UTC (owner's chat session): Hedgerow overhaul for the owner's "boring" feedback; ROADMAP 26-30 ticked, 35-39 added; released `aadfc2c`.
- 2026-10-01 ~02:51-03:05 UTC: Rift 3/6 banner (`.rift-banner`, reuses round-banner motion). Short session; no release (batching).
- 2026-09-30 ~19:52-20:10 UTC: Hedgerow level select grouped into ten act headers (place names), boss levels marked, list scrolls to the next unplayed level.
- 2026-09-30 ~18:52-19:10 UTC: Hedgerow act 10 (levels 91-100, Kingsmarket): HollowCandor 3-phase boss (phase 1 jams towers, splits into 2 Candors that heal, each splits into stealth remnants), finale with Bea; 1 new test. Prettier run on games/hedgerow again (fine).
- 2026-09-30 ~13:52-14:15 UTC: Hedgerow act 4 (levels 31-40, Rivermead): armour (halves non-piercing damage), bulldozers, Co-op Barn, Grain Silo (pierces), Mega-Dozer boss (splits into bulldozers); bot builds silos/barns; armour test. I ran prettier on games/hedgerow by mistake (big one-off diff, now formatted); files are prettier-clean from here.
- 2026-09-30 ~13:00-13:25 UTC: Hedgerow act 3 (levels 21-30, Saltmarsh): Duck Pond tower, influencers (charm nearby towers), Brand Ambassador Blimp boss, Sol as speaker; bot builds ponds. Prettier reformats these files heavily: don't run it on games/hedgerow.
  Buyout) and Rebut — each a structural check (an owned region with something to remove) then a resource
  comparison, so a "nothing to target" reason is genuinely distinct from "can't afford it" and worth
  surfacing, unlike a 'required'-Scheme's single ambiguous region check; Open Stall's real "no legal
  region" case (`canOpenStallIn`'s Stall-cap/adjacency check, unambiguous the same way, folded into the
  existing Produce-0 placeholder as one check); and 'optional'-targeting Schemes, which turn out to share
  `targeting: 'none'`'s exact shape since `legalSchemeTargets` always falls back to an untargeted play
  rather than ever disappearing for "no target". Along the way, an early version of the Supply/Rebut test
  was flaky ~50% of the time — traced to SPEC 4.3.4's opening Scout (the first Pressure card resolves
  immediately at game creation) sometimes adding a 2nd Outlet to a home region depending on the random
  seed; fixed by pinning the test to seed 1. Verified with `npm run check`, the full desktop Playwright
  suite (60/60, twice), and zoomed action-panel screenshots before/after. Not released: today's cap (4/day)
  was already spent before this session started (see DECISIONS.md).
  (Marks vs. cost, same shape as Sell — main panel + a new `missingMarks` prop on the Market sheet, whose
  Buy button used to just disappear), `targeting: 'none'` Schemes (Goodwill vs. cost, same shape — main
  panel + Cath's Plan sheet), and Open Stall's Produce-0 case (a flat 1-Produce cost with no per-region
  loop run at all when unaffordable, so that specific empty state is unambiguous too). Left 'required'/
  'optional' Schemes, Supply/Rebut and Open Stall's real "no legal region" case alone (still genuinely
  ambiguous without per-kind reason logic). Verified with `npm run check`, the full Playwright suite (only
  pre-existing phone-webkit/store-screenshots failures, unrelated — no `webkit` browser installed in this
  sandbox, and the victory-screenshot test is a documented ~63%-win-rate flake not wired to gates),
  `npm run gates` (all 8 green), and zoomed screenshots in both themes/layouts. Not released: `npm run
  release` was already run well past SPEC 12/PROGRESS's "at most 4 times a day" cap earlier today (7+
  logged releases before this session started) — see DECISIONS.md.
  (`6a59418`), then shipped ROADMAP 10's plan-strip branding pass: `EnemyLogos.tsx` (Hollowell's "H",
  Candor's "C", both glossy per STYLE.md 2, built from shapes not text glyphs) on the Squeeze/Expand/
  Scout cards' top-left corner. A gate-8 review of the first pass caught a real, pre-existing bug while
  zooming into that corner — the Expand card's top-right stage/region-icon badge had no reserved width
  and sat directly on "Expand:" whenever a plan was revealed — fixed with matching right padding and
  reverified with zoomed crops at both sizes (a second gate-8 pass confirmed clean). Released (`51bec56`):
  all gates green both releases, HTTP smoke passed outright both times, tag pushes failed with the known
  403 (harmless).
  `MiniGauge` bar with `GaugeRing`, a progress ring drawn on the icon's own 24px grid and layered directly
  over it (`.hud-icon-ring`/`.hud-ring`, `position: absolute; inset: 0`), same footprint as the bare icon.
  This needs no width budget at all, so it ships identically on phone and desktop, finally closing the
  fight several earlier sessions had with the desktop centre column's zero width slack. Verified with
  zoomed screenshots in light, dark, phone and desktop: all 4 stats' rings show the correct fraction
  (Round's small arc, Trust's ~2/3, Lost Land's full circle, Rift's empty track). `npm run check` and the
  full Playwright suite (108/108, both projects, incl. `desktop-no-scroll.spec.ts` and `csp.spec.ts`)
  green. Unreleased.
  "false positive" `curl` read was itself wrong — a second Vercel deploy for the revert commit had just
  landed after that check). `npm run release`'s `git merge --ff-only build` failed since that revert
  commit isn't `build`'s ancestor; a plain `git merge origin/main` would have silently deleted everything
  the revert removes (caught before committing — see DECISIONS.md). Fixed with `git merge -s ours
  origin/main` on `build` (records the merge, keeps `build`'s tree untouched), then re-ran `npm run
  release` clean: all gates green, fast-forward succeeded, HTTP smoke test passed outright (`b2b8aee`).
  Ticked ROADMAP 1 and 5 as released. `main`/`build`/live are all in sync.
  cliffhanger had no Bea beat; added one line ("Tell Bea I'll be home for her story...") raising the
  moment's stakes without playing it as a joke. `npm run check`/touched e2e specs green; a subagent's
  gate-8 review of fresh `npm run shots` screenshots came back clean. (The `npm run release` attempt this
  same session is the one untangled above.)
  region-type icon(s) on the Squeeze/Expand/Scout plan-strip slots (`RegionTypeIcon.tsx`), as a
  `position: absolute` corner badge (an inline version wrapped the button and broke
  `desktop-no-scroll.spec.ts`; the badge doesn't affect text flow so it ships on both platforms). Checks
  and full Playwright green. Unreleased (cap spent).
  icon set and Sell disabled/why-not state; ROADMAP 10's tick animation and first (bar-based, phone-only)
  gauge pass; ROADMAP 8's phone bottom tray and chrome-trimming; ROADMAP 1's hands/pose, favicon/
  social-image and tutorial-voice work; ROADMAP 3's close-out; the SPEC 16 pivot and the sw.js fix.

