# Roadmap

The ordered plan for improvement sessions (SPEC 16). **New plan set by the owner on 2026-09-28.** Work from the top: take the first item that isn't done or blocked. Big items are split into slices, and each slice must ship on its own, leaving the games better and never half-broken.

Sessions may add items, split items or reorder within a phase when they find something more important, and log the reason in `DECISIONS.md`. Only the owner (through `FEEDBACK.md`) moves items between phases or deletes them. Mark items `[x]` when shipped (released to `main`), with the release commit.

Every visual item is done only when:
- before and after screenshots at 390×844 and 1440×900, light and dark, show a clear improvement against `VISION.md`;
- the gates pass;
- motion respects reduced motion.

## Phase 1: Cath, the face of every game (owner's top priority)

1. [ ] **Cath's new look: the master art.** *(v1 shipped 2026-09-28 by the owner's chat session: `shared/cath/cath.ts` with face, bust and half framings, five expressions, two outfits and idle animation, used by Portrait.tsx, the title, the landing page and Runnel. STYLE.md 9 rewritten 2026-09-28 (`6e7a643`) to describe the new Cath in full, replacing the old K-pop-idol notes. Still to do: refine the art (hands and a pose, finer hair and fabric shading, readability at 32 px — a subagent review found her small-scale portrait and expressions hard to tell apart at 56-96px), then replace `public/favicon.svg`, the app icon brief and the social images with the new Cath.)* Redesign Cath per `VISION.md` "Cath: character bible": a classy, cute, stylish mum. Build one shared, framework-free art module (`shared/cath/`) that renders her as SVG in:
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
5. [ ] **Cath's world:** a short character-bible pass on her story as a mum (her daughter, Bea, appears in a few scenes as a small, wholesome recurring character), woven lightly into the campaign's scenes and Runnel's daily lines. Keep SPEC 3.5's satire rules.

## Phase 2: make Cathnivore beautiful

6. [x] **Title screen:** an illustrated, animated map of Marrow with Cath, poster typography and a clear menu (owner's chat session, 2026-09-28). Update Cath to the new art once item 1 ships.
7. [x] **Campaign screen:** a journey across Marrow, with chapter stops, mini maps and each chapter's producers (owner's chat session, 2026-09-28).
8. [ ] **The table (game screen), part 1: layout.** Make the map the hero. On desktop, the map fills the centre column at the largest size that fits, and the farm, market, plan and log panels become tidy side trays. On phone, the map fills the top of the screen and actions live in a bottom tray that can be pulled up. Leave room for Cath's companion (item 3). Keep every current control and test hook, and don't change the rules.
9. [ ] **The table, part 2: actions as cards.** Replace the grid of text buttons with illustrated action tiles: an icon per action, cost chips shown with resource tokens, clear disabled and why-not states, and press feedback. Region-targeting mode highlights the valid regions with an animated outline.
10. [ ] **The table, part 3: the HUD.** Round, Trust, Lost Land and Rift become illustrated gauges with tick-up and tick-down animation when they change. The enemy's Squeeze, Expand and Scout slots become agenda cards with each corporation's glossy branding.
11. [ ] **Map art, part 1: regions.** Terrain illustration on each region (hedgerows, field rows, shoreline and boats, the Kingsmarket clock tower) and labels as painted signboards. It must pass the greyscale shape test (STYLE.md 2).
12. [ ] **Map art, part 2: pieces.** The exact STYLE.md 6 pieces (awning Stall, glossy "0.99" Outlet, "SOLD" fence Buyout, "?" bubble Doubt), each with a placement animation.
13. [ ] **Moments:** liberating a region (a seal stamp, colour blooming across the hex, Cath cheering), a Squeeze (glossy plastic creeping over a region), Lost Land, the Rift at 3 and 6, the enemy turn playback choreographed step by step, and the end of a round.
14. [ ] **Story scenes as a graphic novel:** half-body characters with expressions (Cath from `shared/cath/`, the rest of the cast gains expressions too), speech bubbles on an illustrated backdrop per chapter's region, tap to advance line by line, and a skip option.
15. [ ] **Setup screen:** the producers as character cards and a designed difficulty picker, with no default radio buttons or checkboxes anywhere.
16. [ ] **End screen:** a win or loss illustration with Cath's reaction, the final map snapshot, stat cards, and "Play again" and "Share".
17. [ ] **Cards:** Improvements and Schemes as illustrated cards with a frame per category and an icon per card, and animations for buying and playing them. Cath's Plan cards carry her handwriting and avatar.
18. [ ] **How to Play:** illustrated and paged, taught by Cath, with tiny demo boards.
19. [ ] **Sound:** a synthesised WebAudio sound set and an optional ambient loop, with Settings switches. Silent until the first tap.
20. [ ] **Settings and Credits:** designed screens that match the title.
21. [ ] **Motion system:** shared easing and duration tokens, and an audit of every screen.

## Phase 2b: Hedgerow, the third game (owner request, 2026-09-28)

The owner asked for a tower defense game: a strong story that develops level by level, new weapons and tower upgrades unlocking as you go, and level 100 as the ultimate boss fight. Cath leads. **The design note is `docs/design/hedgerow.md`; follow it.** Sessions pick these up after Phase 2 items 8-13 (the Cathnivore table, map art and moments). The remaining Phase 2 items (14-21) continue after Hedgerow slice 2.

H1. [ ] **Engine and a vertical slice:** the engine, a Canvas renderer, 2 towers, 2 enemies, levels 1-3 with story scenes, saves, `/hedgerow/` in the site build, a landing card, site e2e tests and the level bot gate.
H2. [ ] **Act 1 complete (levels 1-10):** the Acquisition Van miniboss and the upgrade UI.
H3. [ ] Act 2 (11-20). H4. [ ] Act 3 (21-30). H5. [ ] Act 4 (31-40). H6. [ ] Act 5 (41-50). H7. [ ] Act 6 (51-60). H8. [ ] Act 7 (61-70). H9. [ ] Act 8 (71-80). H10. [ ] Act 9 (81-90).
H11. [ ] **Act 10 and level 100:** the multi-phase HollowCandor boss fight and the finale.

## Phase 3: Runnel and the site

22. [ ] **Runnel feel:** a sound set, a water-arrival sparkle, crops varied by season, a streak calendar, and a fairer par (log the sim before and after).
23. [ ] **Runnel variety:** new tile types (bridges, sluice gates, reservoirs) introduced gradually by day of the week, each with generator support and a solvability test.
24. [ ] **Landing page:** a live miniature preview of each game on its card, and a frame-time check on real mid-range phones.
25. [x] **Known small issues:** the `sim/run.ts` worker timeout (fixed earlier), `scene.ts` `deleteShader`, and `scene.ts` WebGL context restore (fixed 2026-09-28 `cb050ee`; see `PROGRESS.md`).

## Postponed by the owner (2026-09-28)

- **iPhone App Store launch:** postponed until the games are truly impressive. Don't dispatch `ios.yml` or `store.yml`, and don't work on store listings or screenshots. Keep `npm run build` (the iPhone app's web bundle) passing. Only the owner reopens this, through `FEEDBACK.md`.

## Later (only when the owner asks in FEEDBACK.md)

- A fourth game, starring Cath, with a design note first in `docs/design/`.
- Online play, localisation.
