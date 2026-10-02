# Roadmap

The ordered plan for improvement sessions (SPEC 16). **New plan set by the owner on 2026-09-28.** Work from the top: take the first item that isn't done or blocked. Big items are split into slices, and each slice must ship on its own, leaving the games better and never half-broken.

Sessions may add items, split items or reorder within a phase when they find something more important, and log the reason in `DECISIONS.md`. **Never run out:** when fewer than 3 unfinished items remain, the session's work is planning: screenshot every game, have a subagent critique them against `VISION.md`, and add at least 5 concrete, measurable items before ending. Only the owner (through `FEEDBACK.md`) moves items between phases or deletes them. Mark items `[x]` when shipped (released to `main`), with the release commit.

Every visual item is done only when:
- before and after screenshots at 390×844 and 1440×900, light and dark, show a clear improvement against `VISION.md`;
- the gates pass;
- motion respects reduced motion.

## Phase 1: Cath, the face of every game (owner's top priority)

1. [x] **Cath's new look: the master art.** *(v1 shipped 2026-09-28 by the owner's chat session: `shared/cath/cath.ts` with face, bust and half framings, five expressions, two outfits and idle animation, used by Portrait.tsx, the title, the landing page and Runnel. STYLE.md 9 rewritten 2026-09-28 (`6e7a643`) to describe the new Cath in full, replacing the old K-pop-idol notes. 2026-09-28 (`d193d0c`): widened 'determined'/'worried' so they read apart from the default smirk at 56-96px, fixing the readability half of a gate-8 flag. 2026-09-28 (`cb72336`/`497f2d1`): gave the half-body figure hands, clasped at her waist where both sleeves already converged — a gate-8 review caught the first shape reading as a heart, redrawn as a single dominant hand with finger creases and a thumb. 2026-09-28 (`0b171b8`/`dcd6c92`/`7af62e1`): replaced `public/favicon.svg` (now a square crop, also used for `apple-touch-icon.png`/`icon-192.png`/`icon-512.png`) and both `social-preview.png` og:images with the new Cath, and rewrote STYLE.md 13's app icon brief. 2026-09-28 (later session): added finer hair strand-shine/depth texture and fabric fold/lapel/sleeve shading to both outfits, verified at every framing/expression and down to 56px, gate-8 reviewed clean — all listed scope done. **Released 2026-09-28 (`b2b8aee`).**)* Redesign Cath per `VISION.md` "Cath: character bible": a classy, cute, stylish mum. Build one shared, framework-free art module (`shared/cath/`) that renders her as SVG in:
   - two framings: a bust portrait for UI sizes of 32-160 px, and a half-body figure for heroes and scenes;
   - at least five expressions: warm smirk (the default), delighted, determined, worried and wink;
   - two outfits: her classic field look and a market-day look.
   The Cathnivore game (React), Runnel and the landing page all import from it, so she looks the same everywhere. Replace her old portrait everywhere it appears, including the favicon and social images. Update `STYLE.md` 9 and the app icon brief to match.
2. [x] **Landing page stars Cath.** *(v1 shipped 2026-09-28: she stands in the sunset fields, reacts to card hover and focus, and the Cathnivore card uses her face. A later polish pass can add her hair moving in the wind in step with the scene.)* She stands in the hero, half-body, lit by the sunset over the fields, with a subtle idle animation (breathing, a blink, her hair moving in the wind) and a reaction when a game card is hovered or tapped. Each game card shows Cath in that game's role.
3. [x] **Cath in Cathnivore, as guide and narrator** *(she is the title screen's hero, her portraits everywhere use the new art; 2026-09-28 `adef266`/`c78fad8` shipped the game-screen companion reacting to liberated/Squeeze/Expand/Rift-split, her end-screen portrait, a face inline with tutorial prompts, and her bust on the Campaign and Setup screens; 2026-09-28 `cb050ee` shipped tutorial prompts rewritten in her first-person voice, a bigger companion line bank, and a couple of tasteful Bea mentions. Later: a bigger Bea presence across scenes belongs to item 5, "Cath's world.")*:
   - a Cath companion on the game screen who comments on what just happened (short, witty lines from a bank written in her voice, SPEC 3.2) and reacts with her expressions to liberations, Squeezes, Lost Land and wins and losses;
   - Cath on the title, Campaign, setup and end screens with a matching expression;
   - tutorial prompts spoken by her.
4. [x] **Cath in Runnel, as host:** *(v1 shipped 2026-09-28: a daily greeting, reactions at 40% and 75% watered and on the win, and Cath on the help and win sheets; the share text names her fields. Still open for later: Cath standing by the spring on the board.)*
   - she presents each day's puzzle ("Cath's runnel for Tuesday"), with a greeting line that changes daily;
   - she stands by the spring on the board;
   - she reacts as water reaches fields, and celebrates on the win screen with a line about your time and par;
   - the help sheet is in her voice;
   - the share text names her.
5. [x] **Cath's world:** a short character-bible pass on her story as a mum (her daughter, Bea, appears in a few scenes as a small, wholesome recurring character), woven lightly into the campaign's scenes and Runnel's daily lines. Keep SPEC 3.5's satire rules. *(`VISION.md`'s "Cath: character bible" already had the short pass on her being a mum; earlier sessions had added one light Bea line each to 5 of the 6 campaign chapters and 1 of Runnel's 10 daily greetings. 2026-09-28: added the one remaining gap — chapter 5 ("Friends in Low Places"), the arrest cliffhanger — with a single line raising the stakes ("Tell Bea I'll be home for her story...") without playing it for a joke. Cadence (6/6 chapters, 1/10 Runnel greetings) still reads as "now and then," not overused. **Released 2026-09-28 (`b2b8aee`).**)*

## Phase 2: make Cathnivore beautiful

6. [x] **Title screen:** an illustrated, animated map of Marrow with Cath, poster typography and a clear menu (owner's chat session, 2026-09-28). Update Cath to the new art once item 1 ships.
7. [x] **Campaign screen:** a journey across Marrow, with chapter stops, mini maps and each chapter's producers (owner's chat session, 2026-09-28).
8. [x] **The table (game screen), part 1: layout.** *(Done 2026-09-30 by the owner's chat session: the map fills the centre column on a tabletop, sized by flexbox instead of a fixed 288px cap; the producer card and Undo moved to the left tray; phone gets a one-row icon HUD and a map that fits whole above the action tray. See `src/styles/table.css`.)* *(2026-09-28: the desktop action list moved out of the
   centre column into a new side tray next to the Farm panel (`Game.tsx`'s `actionsPanel`, `.actions-sheet`
   in `global.css`) — mounted via a `useIsDesktopLayout()` matchMedia hook, not CSS-hidden duplicates, since
   two always-mounted copies broke Playwright's strict-mode locators (e2e/tooltip.spec.ts). Measured
   directly (repeated runs against `desktop-no-scroll.spec.ts`'s own fixture) that this barely grows the
   map, though: the old in-column action list already shrank to near-nothing in the tightest states, so it
   was never really the map's ceiling — the topbar/companion/tutorial-prompt/plan-strip/legend/active-
   producer chrome around the map is. `.map`'s cap only moved from 260px to 262px; `.map-wrap` now absorbs
   leftover vertical space on taller-than-1280x800 windows so the map centres in it instead of leaving a
   dead gap below Undo (caught in a `shots` screenshot). Real, shippable progress toward "tidy side trays,"
   but not the item: the map isn't dramatically bigger, and phone still has no bottom tray (its action list
   render spot is unchanged). 2026-09-28 (later session): trimmed the fixed chrome itself — merged the plan
   strip and map legend into one shared desktop row instead of two stacked full-width rows (real slack, the
   centre column is far wider than the map), then tightened the topbar's and the decision/active-producer
   panel's vertical padding by 2px each. `.map`'s cap moved 262px→288px (bisected against
   `desktop-no-scroll.spec.ts` both times). The row-merge briefly overflowed horizontally — a bug the
   vertical-only e2e test couldn't catch, only a `shots` screenshot did — fixed with `min-width: 0` and a
   `flex-wrap` fallback; see DECISIONS.md. Diminishing returns from here: the companion/tutorial-prompt
   chrome was already tightened in an earlier session. 2026-09-28 (later session): gave phone its bottom
   tray. `.game` now splits into two flex children — `.game-scroll` (topbar/companion/plan-strip/map,
   scrolls internally if needed) and `.action-tray` (producer info, actions, Undo/sheet-toggle footer,
   its own natural size) — so the bottom panel SPEC 10.2 calls "fixed" is always fully visible with no
   fixed positioning or measured JS height, avoiding the inline-style CSP rule entirely; the actions list
   itself caps at 130px with internal scroll so a 10+-action state can't push Undo off-screen. Verified at
   360x640/390x844/430x932 (SPEC 10.2's full range): zero page scroll, every action and the footer always
   reachable. Trade-off, not yet solved: at the 390x844 design size the topbar (wraps to 2 lines) plus
   companion plus plan-strip plus legend already need ~570px on their own, so the map's bottom portion
   stays cropped within `.game-scroll`'s own scroll even with the action list collapsed — a gate-8 review
   called the crop itself clean-looking, not broken, but the map isn't the size-dominant "hero" on phone
   yet, and there's still no interactive pull-to-expand gesture (just a fixed peek height). Left unchecked
   for that reason — a follow-up could shrink the topbar/companion further, or add a real drag/tap-to-
   expand affordance.)* Make the
   map the hero. On desktop, the map fills the centre column at the largest size that fits, and the farm,
   market, plan and log panels become tidy side trays. On phone, the map fills the top of the screen and
   actions live in a bottom tray that can be pulled up. Leave room for Cath's companion (item 3). Keep every
   current control and test hook, and don't change the rules.
9. [x] **The table, part 2: actions as cards.** *(2026-09-28: shipped the two pieces of this item that needed
   no new art or engine changes, so they could land as safe, reversible slices ahead of the bigger
   illustrated-tile redesign. Press feedback: every button (not just action buttons — STYLE.md draws no
   per-screen exception, and a press effect on some buttons but not others would read as unfinished, not
   selective) gets a `transform: scale(0.96)` on `:active`, replaced with a plain opacity dip under
   `prefers-reduced-motion` per STYLE.md 11's "fades only". Region-targeting's animated outline: STYLE.md 7
   already called for "legal regions glow with a 3px wheat outline and a soft pulse," but only the static
   outline existed — added a 1.6s stroke-width/opacity pulse, disabled under reduced motion (falls back to
   the exact prior static stroke). Both verified directly (computed-style checks for both motion states,
   plus the full Playwright suite and `npm run gates`) rather than by screenshot, since neither is visible
   in a resting-state screenshot. 2026-09-28 (later same session): added resource cost chips — a small
   icon+number pill inside each action button, reusing the exact `ProduceIcon`/`MarksIcon`/`GoodwillIcon`
   already drawn in the topbar/active-producer panel (no new art needed), additive to `actionLabel`'s
   existing text cost rather than replacing it (keeps every e2e test that matches a button name by
   prefix working unchanged). `actionCost()` (`actionLabel.ts`) calls the exact same cost functions
   `applyAction` uses to spend the resource (now exported from `engine/actions.ts`) — one source of
   truth, so a chip can never drift from the real cost. A region-targeting group button only shows a
   chip when every region behind it costs the same (Supply's per-Outlet cost varies by region type and
   Improvements); mixed costs fall back to no chip. Gate-8 reviewed clean at both sizes, including the
   longest label ("Supply: remove 1 Outlet in Brindle Hills", which wraps to 2 lines).
   2026-09-28 (later same session): added the icon set — new STYLE.md 5.1 documents 8 icons (Sell,
   Invest, Scheme, Graft, Open Stall, Supply, Rebut, Role) on the same 24px/flat-fill/2px-ink-outline
   grid as the resource icons, drawn in `src/ui/icons/ActionIcons.tsx` and rendered at the start of
   each action button. Supply/Rebut reuse the map's Outlet/Doubt colours (a faded piece struck through
   with an X) rather than needing wholly new shapes. A gate-8 review of the first pass caught 3 real
   defects, all fixed and reverified with zoomed renders: Scheme's paper-dart shape collapsed into a
   plain chevron at true ~18px size (widened it, shaded one wing); Open Stall's canopy-to-valance
   proportions read as a boxy monitor rather than an awning (flipped them); Supply/Rebut's faded
   box/bubble had no `stroke` at all, so only the X was visible (added a separately-opaque ink
   outline). 5 of the 8 icons needed genuinely new art (Sell, Invest, Scheme, Graft, Role); the other
   3 (Open Stall, Supply, Rebut) build on shapes that already existed on the map. `npm run gates`
   green 3 times across the 2 sessions that shipped item 9's pieces so far.
   2026-09-28 (later same session): started the item's last piece, disabled/why-not states, with the one
   case that's genuinely unambiguous — Sell. Its whole legality is a single resource comparison (Produce
   ≥ count), so when a count is unaffordable it now renders as a disabled placeholder, in its natural
   numeric position, with a "Need N more Produce" line and its cost chip still shown (skipped during a
   gated tutorial step, since SPEC 8.1's "only the action being taught is enabled" already hides
   everything else). Every other action kind stays simply absent when illegal, as before: Invest/Scheme's
   "not enough Marks/Goodwill vs. no affordable card vs. rule not unlocked yet" and Supply/Rebut/Open
   Stall's "no valid region vs. can't afford it" would need real per-kind reason logic to avoid showing a
   misleading reason, which is a bigger, separate piece of work. Along the way, gave every button (not
   just this one) a real `:disabled` style — none existed before beyond the cursor, and a gate-8 review
   caught a first pass compounding `--ink-muted` text with 50% opacity into ~2.3:1 contrast (under
   STYLE.md 3.6's 4.5:1 floor); fixed by keeping text at plain `--ink-muted` (verified 4.51:1) and moving
   the opacity to only the icon/cost chip. New `e2e/disabled-actions.spec.ts` locks in the behaviour.
   2026-09-28 (later session): extended why-not to every other unambiguous-legality action kind. Invest's
   legality is the same single Marks-vs-cost comparison Sell has, so each unaffordable market slot gets its
   own "Need N more Marks" placeholder — shown both in the main action panel and (new `missingMarks` prop)
   the Market sheet, whose Buy button used to just silently disappear. A Scheme with `targeting: 'none'`
   (16 of the 31 Scheme cards) never needs a region, so its legality is a single Goodwill-vs-cost
   comparison too — same treatment, in both the action panel and Cath's Plan sheet. 'required'/'optional'
   Schemes and Supply/Rebut are still left alone (a missing region target could look identical to
   unaffordable — genuinely ambiguous without per-kind reason logic, still separate future work). Open
   Stall got its own flat-cost case too: it costs exactly 1 Produce and `legalActions` skips its whole
   per-region loop when Produce is 0, so (unlike a real "no legal region" case, which stays silently
   absent) that specific "nothing renders at all" state is unambiguously about affordability — one
   disabled placeholder for the whole grouped action. Verified with zoomed screenshots in both
   themes/layouts and 3 new seeded e2e tests (seed 1's deterministic market/plan draw for Invest/Scheme,
   default seed for Open Stall). Item 9 is now closer: disabled/why-not states cover Sell, Invest,
   `targeting: 'none'` Schemes and Open Stall's Produce-0 case everywhere they can appear; the full
   illustrated-tile redesign (the item's own title) still hasn't started, and Supply/Rebut/required-Scheme/
   Open-Stall's-no-legal-region why-not remains future work.)* Replace the grid of text buttons with illustrated action tiles: an icon per action, cost chips shown with resource tokens, clear disabled and why-not states, and press feedback. Region-targeting mode highlights the valid regions with an animated outline.
10. [x] **The table, part 3: the HUD.** *(2026-09-28: shipped the tick-up/tick-down animation (`useHudTick()`
    in `Game.tsx`, a CSS scale-pulse keyed on a per-stat change counter, deliberately colourless since
    Round/Trust/Lost Land/Rift don't share one "which way is good" direction) and Pressure-card corner
    badges (stage numeral + region-type icon on the Squeeze/Expand/Scout plan-strip pills,
    `RegionTypeIcon.tsx`, `position: absolute` so it never affects text flow). The gauges themselves first
    shipped as a bar next to each stat (`MiniGauge`) but phone-only — the desktop centre column had no
    width left for a second element per stat, confirmed by measurement (`desktop-no-scroll.spec.ts`) more
    than once. 2026-09-28 (later session): replaced the bar with `GaugeRing`, a progress ring drawn on the
    icon's own 24px grid and layered directly over it (`.hud-icon-ring`/`.hud-ring` in `global.css`) —
    same footprint as the bare icon, so it needs no separate width budget and ships identically on phone
    and desktop, closing that gap for good. Verified with zoomed screenshots in both themes and both
    sizes (Round/Trust/Lost Land/Rift's rings all show the correct fraction). Bounds still come from the
    engine's own source of truth (Trust 0-15/Rift 0-6 match `validate()`, Lost Land's "full" is the real
    starting pool). 2026-09-28 (later session): gave the Squeeze/Expand/Scout plan-strip cards both
    corporations' logos (`EnemyLogos.tsx`'s `HollowellLogo`/`CandorLogo`, built from shapes not text
    glyphs, glossy per STYLE.md 2's material rule), top-left per STYLE.md 8's Agenda-card convention —
    both factions act through every slot (SPEC 4.7), so each card is dual-branded rather than picking
    one. Along the way, gate-8 caught and this session fixed a pre-existing bug: the Expand card's
    top-right stage/region-icon badge had no reserved width and sat directly on top of the "Expand:"
    label whenever a plan was revealed; added matching right padding, verified with zoomed crops at
    both sizes. Still open: this is a branding pass, not the full "agenda card" redesign (STYLE.md 8's
    newspaper-clipping look, headline, boxed effect panel) — the Pressure card keeps its existing
    compact shape.)* Round, Trust, Lost Land and Rift become illustrated gauges with tick-up and tick-down animation when they change. The enemy's Squeeze, Expand and Scout slots become agenda cards with each corporation's glossy branding.
11. [x] **Map art, part 1: regions.** *(2026-09-28 evening: shipped per-type terrain vignettes — hedgerow bushes, converging field rows, sailing boats, Kingsmarket's clock tower — and paper signboard labels, verified in greyscale; unreleased. Still open: richer per-region variation, and the map is small on desktop (fixed 2026-10-01: viewBox tightened 300→250).)* Terrain illustration on each region (hedgerows, field rows, shoreline and boats, the Kingsmarket clock tower) and labels as painted signboards. It must pass the greyscale shape test (STYLE.md 2).
12. [x] **Map art, part 2: pieces.** The exact STYLE.md 6 pieces (awning Stall, glossy "0.99" Outlet, "SOLD" fence Buyout, "?" bubble Doubt), each with a placement animation. *(Verified 2026-09-30: shapes in `Map.tsx`, pop/slam/float animations in `global.css`, reduced-motion and no-animations handled.)*
13. [x] **Moments:** liberating a region (a seal stamp, colour blooming across the hex, Cath cheering), a Squeeze (glossy plastic creeping over a region), Lost Land, the Rift at 3 and 6, the enemy turn playback choreographed step by step, and the end of a round.
14. [x] **Story scenes as a graphic novel:** half-body characters with expressions (Cath from `shared/cath/`, the rest of the cast gains expressions too), speech bubbles on an illustrated backdrop per chapter's region, tap to advance line by line, and a skip option.
15. [x] **Setup screen:** *(2026-09-29: segmented mode/difficulty pickers, producers as cards with role and ability, paper cards; no visible radios/checkboxes.)* the producers as character cards and a designed difficulty picker, with no default radio buttons or checkboxes anywhere.
16. [x] **End screen:** *(2026-09-29: bigger Cath, verdict, stat cards; Share button done; map snapshot done.)* a win or loss illustration with Cath's reaction, the final map snapshot, stat cards, and "Play again" and "Share".
17. [x] **Cards:** Improvements and Schemes as illustrated cards with a frame per category and an icon per card, and animations for buying and playing them. Cath's Plan cards carry her handwriting and avatar.
18. [x] **How to Play:** illustrated and paged, taught by Cath, with tiny demo boards.
19. [ ] **Sound:** *(2026-09-28 night: shipped `src/platform/sound.ts` synth cues for place/liberate/Squeeze/Lost Land/win/lose, Settings "Sound" switch, silent until first tap; unreleased. UI-tap tick added; 2026-09-28 late: optional ambient pad loop, off by default, unreleased.)* a synthesised WebAudio sound set and an optional ambient loop, with Settings switches. Silent until the first tap.
20. [x] **Settings and Credits:** *(2026-09-29: both redesigned with Cath header and paper cards.)* designed screens that match the title.
21. [x] **Motion system:** *(2026-09-29: `--ease-settle`/`--ease-pop`/`--dur-*` tokens in `tokens.css`; title and campaign use the settle token. Audit of remaining screens still open.)* shared easing and duration tokens, and an audit of every screen.

## Phase 2b: Hedgerow, the third game (owner request, 2026-09-28)

The owner asked for a tower defense game: a strong story that develops level by level, new weapons and tower upgrades unlocking as you go, and level 100 as the ultimate boss fight. Cath leads. **The design note is `docs/design/hedgerow.md`; follow it.** Sessions pick these up after Phase 2 items 8-13 (**owner, 2026-09-30: start H1 now; don't wait for 9-13 to be fully polished**) (the Cathnivore table, map art and moments). The remaining Phase 2 items (14-21) continue after Hedgerow slice 2.

H1. [x] **Engine and a vertical slice:** *(2026-09-30: `games/hedgerow/`, levels 1-3, `/hedgerow/`, landing card, tests/hedgerow.test.ts bot gate.)* the engine, a Canvas renderer, 2 towers, 2 enemies, levels 1-3 with story scenes, saves, `/hedgerow/` in the site build, a landing card, site e2e tests and the level bot gate.
H2. [ ] **Act 1 complete (levels 1-10):** *(2026-09-30: levels 1-10, the Beehive, the Acquisition Van boss and Cath's pie are built (released: H1 only; the rest is on `build`). Open: upgrade-UI polish, sound, Hedgerow's own level-select art.)* the Acquisition Van miniboss and the upgrade UI.
H3. [x] Act 2 (11-20): *(2026-09-30: Highmoor, Market Stall, price-war trucks, Mr Crisp's Convoy boss.)* H4. [x] Act 3 (21-30): *(2026-09-30: Saltmarsh, Duck Pond, influencers that charm towers, Brand Ambassador Blimp boss.)* H5. [x] Act 4 (31-40): *(2026-09-30: Rivermead, armour, Co-op Barn, Grain Silo, Mega-Dozer boss.)* H6. [x] Act 5 (41-50): *(2026-09-30: Oakvale, stealth couriers, Radio Mast, Vane's Clinic-in-a-Box boss that heals.)*  H7. [x] Act 6 (51-60): *(2026-09-30: Shingle Bay, tenders, Clinic Tent, Container Ship boss.)* H8. [x] Act 7 (61-70): *(2026-09-30: The Rift, lawyers, Courthouse, Lawyer Swarm.)* H9. [x] Act 8 (71-80): *(2026-09-30: The Ballot, Farmers' Union Hall aura + Market Day, Pell's Campaign Bus boss.)* H10. [x] Act 9 (81-90): *(2026-09-30: The Merger, directors, Board of Directors boss.)*
H11. [x] **Act 10 and level 100:** the multi-phase HollowCandor boss fight and the finale.

## Phase 3: Runnel and the site

22. [x] **Runnel feel:** *(2026-10-01: verified in code: sound.ts, wet-plot sparkle, seasonal crops, streak calendar and tolerant drop thresholds all shipped.)* a sound set, a water-arrival sparkle, crops varied by season, a streak calendar, and a fairer par (log the sim before and after).
23. [x] **Runnel variety:** new tile types (bridges, sluice gates, reservoirs) introduced gradually by day of the week, each with generator support and a solvability test.
24. [ ] **Landing page:** a live miniature preview of each game on its card, and a frame-time check on real mid-range phones.
25. [x] **Known small issues:** the `sim/run.ts` worker timeout (fixed earlier), `scene.ts` `deleteShader`, and `scene.ts` WebGL context restore (fixed 2026-09-28 `cb050ee`; see `PROGRESS.md`).

## Phase 4: Hedgerow to world-class (owner's chat session, 2026-10-02)

All 100 levels exist and play, but the look is a flat prototype: a plain grid, simple shapes and a list for level select. Bring it up to Cathnivore's standard. Every item: screenshots before and after, phone and desktop.

26. [x] **The battlefield:** illustrated terrain per act (Brindle Hills hedgerows and pasture, Highmoor market lanes, Saltmarsh reeds and water, Rivermead floods, Oakvale orchards, Shingle Bay shingle and sea, the Rift, the Ballot town, the Merger's glossy campus, Kingsmarket's square). The lane as a textured dirt track with ruts; plots as tilled patches with soft shadows; props (fences, gates, trees, the farmhouse with smoke). No visible grid outside build mode.
27. [x] **Towers and enemies:** a distinct illustrated sprite per tower, with each upgrade tier visibly different, idle animation and visible projectiles (turnips, bees, gusts, seeds). Enemies get STYLE.md's glossy corporate material with motion (wheels turning, drone rotors, bobbing), hit flashes, health bars and pops on defeat. Bosses are big, distinct and announced.
28. [x] **Cath on the battlefield:** Cath standing by the farmhouse with live reactions (cheering on a perfect wave, worried when Goodwill drops), and the story beats staged like Cathnivore's graphic-novel scenes (reuse its scene system and backdrops).
29. [x] **Build UX:** a radial build menu at the tapped plot (tower icons with costs, locked ones greyed), a range preview while choosing, a next-wave preview (enemy icons and counts), and clear sell and upgrade affordances. Must work one-handed on a 390 px phone.
30. [x] **Level select as a journey:** a map of Marrow with the ten acts as regions and the levels as stops on a path, stars and boss markers, and the current level glowing (like Cathnivore's campaign).
31. [ ] **Balance pass:** a bot run over all 100 levels logged in `BALANCE.md` (stars per level, a difficulty curve); every level winnable with what's unlocked by then; 3 stars needs real skill; no sudden spikes except the bosses.
   _26-30 shipped 2026-10-02 by the owner's chat session (`5a8ec91`..`aadfc2c`), after the owner said Hedgerow was "pretty boring" and should be worth 50 USD: painted acts, sprites for every tier and specialisation, Cath as a hero unit, graphic-novel story scenes, an icon build menu with range preview (a bottom panel, not radial: better one-handed), the journey map. Plus tier-4 specialisations, targeting, early calls, an aimed pie, boss signature moves, the Seed Bank, music. Use `/hedgerow/?sandbox=1` (unlimited Marks) to screenshot late waves._
32. [ ] **Story pass:** read all 100 levels' beats end to end and tighten them into one arc with setups and payoffs, Bea's thread, each boss's introduction, and Cath's voice (SPEC 3.2).

### Hedgerow: from good to worth 50 USD (owner's feedback 2026-10-02; Kingdom Rush is the bar)

35. [x] *(2026-10-02: `callNeighbours`/`callRally` in engine, buttons B/R, barricade and rally art, perks Wellies by the Door and Rallying Cry; unreleased)* **More of Cath's abilities:** "Call the Neighbours" (level 12: three farmhands who block the lane for 10 s) and "Rally" (level 25: towers fire 50% faster for 6 s), each with its own button, cooldown, art and sound, and Seed Bank perks to upgrade them.
36. [x] *(2026-10-02 later: seven lane shapes in layouts.ts and a general fork finder, owner chat session.) (earlier: terrain slice done: high ground +25% range and water plots for ponds only, generated per level by `terrain.ts`, painted, in the build menu, tested; forks: 14 levels (every 4th from 18, not bosses or 94) have a second spawn whose lane joins the serpentine, `path2` + `Enemy.lane`; unreleased)* **Better maps:** bigger, more varied layouts per act: forks and two lanes, a second spawn on some levels, terrain that matters (water plots for ponds only, high ground with +range). Keep every level winnable (the level test) and retune.
37. [~] *(2026-10-02: achievements done as 12 Rosettes (rosettes.ts, shown in the Seed Bank, awarded on the result card); still to do: Heroic 4th star, Endless)* **Replay value:** a Heroic challenge per level for a 4th star (for example "Iron Lane": 1 Goodwill; "Hedge Fund": no Market Stalls), an Endless mode per act, and achievements.
38. [~] *(2026-10-02: build puff and pop-in, upgrade sparkle, clean-sweep cheer, worried face at low Goodwill, victory confetti, haptics; enemies tip over and fade when defeated; still to do: scaffolding)* **Feel pass:** Cath's live reactions on the field (cheers on a clean wave, worry at low Goodwill), tower build/upgrade animations (dirt puff, scaffolding), enemies that tip over when destroyed, a victory parade, and haptics on phones.
39. [x] *(2026-10-02, owner chat session: bot.ts competent/naive/idle bots, scripts/hedgerow-tune.ts + --verify, tuning.ts; BALANCE.md.)* **Balance pass with the new mechanics** (folds into 31): a bot that uses Cath, pies, early calls and specialisations; target 3-star rates; Seed Bank perks must not trivialise late acts.

### Hedgerow round 2 (owner's second playtest, 2026-10-02; design: docs/design/hedgerow-v2.md)

40. [x] Auto-battler flow (autonomous Cath, auto-cast, Auto toggle), stats on every card and specialisation, speed remembered, fixed-height phone panel, waves callable any time.
41. [x] Story rewritten from a story bible (all 100 levels, finale; Pell, Crisp, Vane, Pip on the page); portraits for Ines, Pip, Pell, Crisp, Vane; rewards say what unlocks.
42. [x] Sixteen twists so each level is a different problem; air/ground targeting; Cath spots stealth.
43. [x] 3D battlefield (three.js) with per-act light, models, effects, horizon landmarks; 2D fallback.
44. [ ] **3D polish:** per-enemy hit flashes (cloned materials), cloud shadows, animated water, units leaning into corners, Cath's 3D hair and arms on the swing, tower build-up animation, act-specific lane surfaces (cobbles in Kingsmarket, boardwalk in Saltmarsh). Screenshot every act on phone and desktop; check frame time with 60 enemies on a phone-class device.
45. [x] *(2026-10-02: naive bot now wins 10 of levels 8-40: 10,11,15,20,21,22,26,30,32,38; unreleased)* **Early acts still fall to Scarecrow spam** (2026-10-02 measurement: the naive Scarecrows-only bot wins levels 8-30 even at the tuned curve; from 31 it loses all but 32, 38, 43). Tuning can't fix it: with three tower types early, spam is near-optimal. Fix with content: early enemies that shrug off turnips (a "crate van" that only splash or slows stop), Scarecrow bans or limited plots on more act 1-3 levels, an earlier pond or barn. Then teach bot.ts early calls and targeting, re-tune and re-verify; target: the naive bot loses most levels from 8.
46. [ ] **Owner's next playtest:** act on FEEDBACK.md first.

### Hedgerow round 3 (owner's third playtest, 2026-10-02 afternoon; design: docs/design/hedgerow-v2.md 6)

47. [x] Bubble-wrapped vans against Scarecrow spam; Windmill and Seed Cannon; eight megastructures; veteran ranks; ambushes; winding routes on bigger fields with pan and zoom; Cath's character sheet (XP, six attributes, ten talents); one-on-one boss duels; tooltips on every control; dialogs that fit a phone; a synthwave score; richer 3D models.
48. [x] *(2026-10-02 night: Heroic toggle on the map (one Goodwill, no pies, a diamond on cleared levels, two rosettes); Endless per act after its boss (endless.ts, weekly seed, best wave kept); unreleased)* **Heroic and Endless:** a Heroic star per level (one life, no pie), and an Endless field per act with a weekly seed and a local best.
49. [x] *(2026-10-02 night: daily.ts, Daily button, no Seed Bank, score out of 100, copyable share card; fixed tower set and twist mix not done; unreleased)* **Daily challenge:** one seeded level a day with a fixed tower set and a twist mix; a share card of the result (no server needed).
50. [ ] **The Almanac:** a codex of every tower, specialisation, megastructure, enemy and boss, with its stats, lore lines and a 3D turntable; entries unlock as met.
51. [ ] **Cath's wardrobe:** outfits earned from Rosettes and act clears (wellies and wax jacket, market-day dress, Kingsmarket gown), shown in 3D and in the story scenes.
52. [ ] **New enemy factions per act:** a drone carrier that launches swarms, a "lobbyist" that disables the nearest tower's specialisation, a rival hero unit (Pell on a quad bike) who fights Cath on the lane.
53. [ ] **Replay and watch mode:** the deterministic engine records inputs; replay any win at x4 with a free camera, and share a link to it.
54. [ ] **Hand-tune the act openers and bosses:** level-specific set pieces (a flood that cuts a lane in act 4, a bridge that opens and closes, a night level lit only by towers).

## Phase 5: second passes (keep going)

33. [ ] **Fresh-eyes audit of all three games and the landing page:** `npm run shots` plus Hedgerow and Runnel screenshots, critiqued by a subagent against `VISION.md`'s eight bars; turn its findings into new ranked items here.
34. [ ] **Performance pass:** bundle sizes, first-load time, and frame time in Hedgerow with 50+ enemies on screen; fix anything over budget (VISION 7).

## Postponed by the owner (2026-09-28)

- **iPhone App Store launch:** postponed until the games are truly impressive. Don't dispatch `ios.yml` or `store.yml`, and don't work on store listings or screenshots. Keep `npm run build` (the iPhone app's web bundle) passing. Only the owner reopens this, through `FEEDBACK.md`.

## Later (only when the owner asks in FEEDBACK.md)

- A fourth game, starring Cath, with a design note first in `docs/design/`.
- Online play, localisation.
