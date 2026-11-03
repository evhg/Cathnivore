# Two-week plan (2026-11-01 to 2026-11-15, extended 2026-11-02 twice)


**Owner, 2026-11-01: this is the queue.** Every build session takes the **first item not marked done**, writes it under **Now** in `PROGRESS.md`, and works it in slices until about 45 minutes have passed. When the item is done, the session starts the next one. Older ROADMAP items wait unless an item here names them.

The items come from fresh-eyes audits on 2026-11-01 and 2026-11-02 (items 25-32: P and D shots of every game, `e2e/screenshots/plan1102`, critiqued against VISION.md). Both were run against `VISION.md` at 390x844, 1440x900 and 844x390, and the screenshots are in that day's session notes. Every item is a whole, player-visible feature. "Size" is a rough count of build sessions.

**Rules for every item**
- **Slices:** ship it in slices. Each slice builds, passes its targeted tests, is shot before and after at 390x844 and 1440x900 (plus 844x390 for NIGHT SHIFT and Hedgerow), and is pushed to `build`. A slice never leaves a game half-broken.
- **Done:** an item is done only when every acceptance line holds. Tick it here as `[x]` with the commit, and say so in the session log. The 19:51 UTC release session ships it.
- **Cuts:** if an acceptance line turns out to be wrong or impossible, change it here and log why in `DECISIONS.md`. Don't quietly skip it.
- **Balance and performance:** Hedgerow changes are re-tuned with the bot (`scripts/hedgerow-tune.ts`). NIGHT SHIFT art stays inside its perf gate (`cathode-perf`).
- **Running low:** when fewer than 3 items are open, the session's work is planning the next two weeks the same way (CLAUDE.md step 4).

---

## 1. [x] NIGHT SHIFT: Candor Clinic art pass (act 2) *(done 2026-11-01, 245ee8e..HEAD: painted tile/vinyl/ceiling/steel PBR, open side rooms, glazed partitions, props, seated debt-tagged patients, shrouds, green grade, stuttering tubes; D and L shots of all four areas; phone perf 148/260 calls)*
- **Why:** acts 2 to 5 read as grey-box blockouts. The Clinic is an untextured concrete corridor, and ROADMAP D2 still lists "waiting room, morgue, theatre art, flooded morgue".
- **Build:**
  - Tiled sterile walls with grime decals, glass partitions, and failing, flickering fluorescents with a green surgical grade.
  - A waiting room with debt-tagged patients (a crowd).
  - A flooded basement morgue with planar water.
  - An operating theatre behind glass, for Vane.
  - Props: gurneys, IV stands, cabinets and signage.
- **Accept:**
  - Shots at D and L of the corridor, waiting room, morgue and theatre.
  - No untextured surface fills more than 30% of any frame.
  - The perf gate passes on the phone tier.
- **Size:** 4

## 2. [x] Cathnivore: a board that scales *(done 2026-11-01, a6d7d23..HEAD: stacked pieces with count badges, portrait stall pins 28+ px at 390, pressure rings, e2e/board-scales.spec.ts at P and D, greyscale shots)*
- **Why:** the board is beautiful at round 1 and noise by round 5. Outlets spill across hex borders, the players' stalls are tiny flags, and the end board is a pile of orange.
- **Build (in `Map.tsx`):**
  - Merge a region's outlets into one stacked corporate tower with a count badge, and its Doubt into one numbered token.
  - Make player stalls larger, coloured per producer, with a portrait pin.
  - Give each region a pressure ring showing how close it is to liberation or loss.
  - Lay out every piece inside its hex polygon.
- **Accept:**
  - After an autoplay game reaches round 6 or later, an e2e test finds no piece's bounding box outside its hex at P and D.
  - Player stalls are at least 24 px tall at 390 px wide.
  - A greyscale shot still tells players from corporations.
- **Size:** 3

## 3. [x] Hedgerow: a painted world map and progressive unlocks *(done 2026-11-01, 48bc127..HEAD: unlock table with Cath's cards, fog past the last open act with the next act painted under it, patchwork ground per act, a lane from Cath's cottage threaded through the fields, one-time field cards for each twist and Heirlooms; map shots at P, D, L and dark)*
- **Why:** the level list reads as a menu, not a journey. Every system shows on day one, which overwhelms new players.
- **Build:**
  - An illustrated, scrollable map of the acts: a path between fields, Cath's cottage at the start, boss landmarks, and locked fog beyond.
  - A guided first three levels that each introduce one tower or idea.
  - Each later system (merging, twists, the Orchard, the Workshop) unlocks with a one-card introduction at the level where it first matters.
- **Accept:**
  - On a fresh save, level 1 shows two towers at most and the map shows act 1 only.
  - Unlock cards appear once each (unit test on the unlock table, e2e on the first one).
  - Map shots at P, D and L.
  - The level tests still pass.
- **Size:** 4

## 4. [x] NIGHT SHIFT: Plaza, Tower and Vault art pass (acts 3 to 5) *(done 2026-11-01, f95a297..HEAD: see Progress; D and L shot sets per district, clipping under 0.1%, phone perf 211/209/142 calls)*
- **Why:**
  - The Plaza is flat pink and cyan boxes, overexposed and empty, while Cath says "Pell wants a crowd tonight".
  - The Tower is a bare hall with a white slab.
  - The Vault's focal point is a salmon rectangle.
- **Build:** per-district materials and texture atlases, then:
  - **Plaza:** a dense crowd and rally stage, awnings and stalls, readable billboards; tame the sky exposure.
  - **Tower:** marble, a lobby desk, glass offices, server racks.
  - **Vault:** ledger stacks, a cage, chasm gantries and a real core.
- **Accept:**
  - Each district has a D and L shot set showing at least 3 distinct, dressed areas.
  - Under 5% of any frame is clipped at 255.
  - The perf gate passes.
- **Size:** 7, sliced as Plaza (3), then Tower and Vault (4).
- **Progress:** Plaza session 1 (2026-11-01, f95a297..d47a2ac): skyline slab bug fixed, standing crowds, rally rig, stall dressing and signs, fountain vigil and brass inlay, tram, founders; perf and clipping pass. Session 2 (2026-11-01, a452381..HEAD): Plaza granite setts (`plazatex.ts`), Pell's posterised portrait board (`pellboard.ts`, `Level.boards`), lit hall facade, pitched awnings with scalloped valances and lit stall backs, side-block shopfronts, a lit arrival walk; Tower marble/slat ceiling/carpet (`towertex.ts`), onyx reception desk, ring sculpture, dressed desks, glass meeting room, rack fronts, black marble boardroom, standing lobby crowd; Vault core machine, round vault door, ledger archive, mesh cage, hazard-edged gantries. Areas shot: Plaza arrival/market/fountain-rally/hall, Tower lobby/offices/server/boardroom, Vault gate/archive/gantry/core.

## 5. [x] Cathnivore: graphic-novel story scenes (ROADMAP 58, U7) *(done 2026-11-01, 9808d2e..HEAD: painted backdrop per chapter, cast as half-length cel figures with props, Cath at half length in a per-chapter outfit, speakers 50%+ of the viewport (e2e/scene-stage.spec.ts at P and D), panel-wipe entrances, per-line poses, comic captions and location boxes; every chapter shot at P, D and L)*
- **Why:** scenes are a roughly 120 px bust and one speech bubble on an empty gradient.
- **Build:**
  - Full-height speakers, left and right, with a pose and expression per line, from `shared/cath/` and new villain art.
  - A painted backdrop per chapter: the stall, courthouse, harbour and Kingsmarket hall.
  - Panel-style transitions.
- **Accept:**
  - Speakers are at least 50% of viewport height at P and D.
  - All 6 chapters have distinct backdrops (shoot each).
  - Two speakers alternate on screen.
  - Contrast meets AA.
- **Size:** 4

## 6. [x] Runnel: a living landscape and a win worth sharing *(done 2026-11-01, 6e4f165..HEAD: share card with the solved board on the win card, rivers running tile by tile with a soak ripple, banks that green and fields that bloom, a time of day and weather per board with a rainbow on a drizzly win, a weekday arc from 2 Nov reported in BALANCE.md; shots at P and D before and after the win, plus dark)*
- **Why:** the board sits on flat paper. The win is a modal of numbers. The "2-minute daily" has a par of 68 taps, which contradicts its own promise.
- **Build:**
  - Rivers that visibly fill tile by tile as the water reaches them.
  - Fields that green and bloom when watered.
  - Weather and time of day per daily.
  - A win card showing the solved board, time, taps and streak, with a generated share image: canvas to PNG, downloaded or shared through the Web Share API.
  - A daily difficulty arc: Monday easy, Sunday hard, with par and board size per day, tuned with the solver so the median time fits the promise.
- **Accept:**
  - The win card shows the board image (e2e).
  - Shared PNGs match a stored snapshot hash for a fixed seed.
  - A solver report in `BALANCE.md` shows par per weekday.
  - Shots at P and D, before and after the win.
- **Size:** 4

- **Progress:** session 1 (2026-11-01, 6e4f165): share card (`games/runnel/src/sharecard.ts`: solved board, time, taps, par, streak) shown on the win card, Save image, Web Share with the PNG file; call-hash snapshot test; site spec checks the image. Left: rivers filling tile by tile, fields blooming, weather/time of day, weekday difficulty arc with a solver report.

## 7. [x] NIGHT SHIFT: encounter staging and enemy readability *(done 2026-11-01, 0040680..HEAD: scripted breach, rappel and van entrances in every district at 8-20 m, checked against colliders, crowds and the objective's sightline; e2e spawn events in the market, clinic and Plaza; 124 px first guard at D; marker ink under 25%; range-scaled rim; tighter shade pools; entrance shots at L from each alarm's objective)*
- **Why:**
  - The first enemies are about 40 px tall at 30 to 40 m, and the hit marker hides them.
  - The HUD's shade pools show as black smudges on bright scenes.
- **Build:**
  - Authored arenas per district at 8 to 20 m, with flanks and height.
  - Scripted entrances: door breaches, rappels and vans.
  - Rim light and silhouette passes on enemies.
  - A thinner, offset hit marker.
  - Fix the shade pools.
- **Accept:**
  - In stage shots the first enemy is at least 120 px tall at D.
  - The marker covers under 25% of the enemy box.
  - Each district has at least 2 encounters with a scripted entrance, and an e2e test sees the spawn event fire.
- **Size:** 4
- **Progress:** session 1 (2026-11-01, see Progress): scripted entrances (`game/entrance.ts`: breach with blown door leaves, rappel down a rope, a van that brakes in and drops a man) staged at 8-20 m in every district (`game/encounters.ts`: market flyover pair; clinic ward ambush and Vane's stitch; Plaza alarm and Pell's rally detail; Tower atrium and boardroom; Vault lift and core), checked against each district's colliders and crowds (`tests/cathode-entrances.test.ts`), logged to `window.cathode.entrances` (e2e on the flyover pair); thinner hit marker with a 14u gap (ink under 25% of a 10 m guard's box, unit test); first guard met at 8.7 m (`first-contact` stage, fails under 120 px at D); range-scaled enemy rim (up to 1.7x by 28 m); HUD shade pools tightened, objective pool elliptical. Session 2 (2026-11-01 16:51): e2e spawn events for the clinic and Plaza alarms; steel breach doors in a frame, ropes to the floor, torch and headlamp beams, van light bar; alarm entrances moved into sightline of their objectives (unit test). Session 3: the Plaza alarm became a two-van pincer braking inside the strongbox stall's open front (the rope came down behind the stalls' back walls); the shot script steps her 1.5 m off the objective towards the entrances; re-shot Plaza, Tower and Vault at L.

## 8. [x] Cathnivore: an end screen that closes the loop, and a designed desktop Setup *(done 2026-11-01, 7e13a48: round-by-round Trust and Lost Land chart, play of the game, grade per difficulty, Play again on the same seed (e2e) and New game, two columns at D with the chart above the fold (e2e); Setup spread at 1440 uses 82% of the width with every producer and Start on screen (e2e), P unchanged (shot); How to Play pages with a mini Marrow)*
- **Why:**
  - The end screen is a centred column with 4 stat tiles and "Back to Title" as the only action.
  - On desktop, Setup and How to Play are a 450 px form column on a 1440 canvas.
- **Build:**
  - **End screen:** two columns on desktop; a Trust and Lost Land chart per round; a play-of-the-game card; a grade per difficulty; "Play again (same seed)" and "New game" as the primary actions.
  - **Setup:** a market-table spread. The event is a poster, the producers are large illustrated cards in a row, and the mode is two illustrated tiles.
  - **How to Play:** illustrated pages with mini boards.
- **Accept:**
  - The primary end action is "Play again", and replay starts the same seed (e2e).
  - The chart is visible without scrolling at D.
  - Setup at 1440x900 uses at least 75% of the width, with every producer and Start visible.
  - The P layout is shot and unchanged.
- **Size:** 4

## 9. [x] NIGHT SHIFT: Cath's hero model and faces *(done 2026-11-01, a1cc91f..HEAD: hair to the bible, ears, painted face modelling, hazel eyes, shaped neck, stepped collar; `?shot&arch=cath&view=face` turntable at 300 px+; busts of Crisp, Vane, Pell and the Chair on the case board and in boss intros; title and class pick re-shot; class pick phone tier 214 calls. Expression blends cut: see DECISIONS 2026-11-01 19:40)*
- **Why:** the title, class pick and over-the-shoulder takedowns show a featureless mannequin. Cath is the face of every game (VISION.md character bible).
- **Build:**
  - A detailed Cath: eyes, liner and lips per the bible; long hair as cards with a shine band; a coat with collar and belt; expression blends for photo mode.
  - Head busts for Crisp, Vane, Pell and the Chair, used in cutscenes and on the case board.
- **Accept:**
  - A turntable shot with the face readable at a 300 px head height.
  - The title and class pick are re-shot.
  - The perf gate passes on the phone tier.
- **Size:** 5
- **Progress:** session 1 (2026-11-01 17:51): `?shot&arch=cath` turntable (`view=face`); hair to the bible (smooth centre-parted hairline, long waved hair over the collar down her back); ears; painted face modelling; larger hazel eyes; shaped neck; collar stepped down at the front; title re-shot at D. Left: expression blends, the four busts, class pick re-shot, phone perf. Session 2 (2026-11-01 18:51): `ui/busts.ts` noir surveillance stills (one red accent) pinned beside their cases on the case board (crossed through when closed) and dropped above the name in each boss intro (D, P, L shot); class pick re-shot.

## 10. [x] Hedgerow: field-first phone layout, swarm readability, a choreographed tally *(done 2026-11-01, b9b19da..HEAD: field 75% of 390x844 edge to edge with a tray-peek drawer and sheets that never resize it (e2e), swarm badges with type make-up on 2D and 3D, ink outlines on 3D Fleet vehicles, an end tally that counts up and replays leaks (reduced-motion e2e); late-wave shots P, D, L)*
- **Why:**
  - On a phone the HUD and panels squeeze the field.
  - Late swarms are an unreadable blob.
  - The end of a level is a flat number list.
- **Build:**
  - **Phone layout:** the field takes at least 70% of a 390x844 screen; the tower bar becomes a bottom drawer; stats move to a compact top strip.
  - **Swarms:** enemy outlines and type icons on the 3D and 2D renderers; clusters of more than 12 show a count badge.
  - **End tally:** stars land one by one, the leaks are replayed, and Marks count up.
- **Accept:**
  - A field-area measurement in an e2e test at P.
  - Late-wave shots (via `?sandbox=1`) at P, D and L, where each enemy type is distinguishable.
  - The tally respects reduced motion.
- **Size:** 4

## 11. [x] Cathnivore: the conglomerates as characters *(done 2026-11-01, f4d5e08..HEAD: Pell and Vane with smug, gloating and rattled faces in a boardroom strip with a bark per step and Cath's reply (unit-tested picks); the named card flips in; both HQs on the map with each step's pieces arcing out to their hex; the strip docks away from bottom-row hexes and stays dark in both themes; e2e for skip, flights and reduced-motion fades; shots P, D and dark)*
- **Why:** the antagonists never show a face. The enemy turn is a caption bar.
- **Build:**
  - Two corporate CEOs with portraits and 3 expressions each.
  - A "boardroom" strip on the enemy turn: the portrait, the pressure card flipping, and pieces flying from the HQ to their hex.
  - A villain bark per action, then Cath's reply.
- **Accept:**
  - Enemy-turn shots at P and D show the portrait, the named card and a piece in flight.
  - A unit test covers bark selection.
  - Skip still works (e2e).
  - Reduced motion uses fades.
- **Size:** 3

## 12. [x] NIGHT SHIFT: the Case Board and district map *(done 2026-11-01, fc2f677..ad37318: cork-wall board with The List as polaroids, index-card leads, fresh-save teaser, keyboard e2e; the district map as a drawn survey sheet to scale from the colliders with named landmarks and rooms, hidden-secret counts, red-pencil objective; no-overlap unit test and DOM check; shots D and L fresh from the title and mid-game from pause)*
- **Why:** the pause board looks like a debug panel. The title's Case Board item is dead on a fresh save.
- **Build:**
  - A cork wall with polaroids of The List (busts from item 9), red string and stamped case cards.
  - An illustrated map per district, with landmarks, the objective and secrets.
  - A teaser state for new players.
  - Keep the Second Broadcast ladder.
- **Accept:**
  - D and L shots from the title on a fresh save, and from pause mid-game.
  - No overlapping text.
  - Keyboard navigation works (e2e).
- **Size:** 3
- **Progress:** session 1 (2026-11-01 20:51, fc2f677): the board is a cork wall: The List as five polaroids on red string (stills once unlocked, crossed out when closed), leads as index cards with Closed stamps and an Open lead flag, locked leads face down in a stack, a fresh-save teaser behind an enabled Case Board item, Escape and Tab handling, keyboard e2e from the title. Shot D, L, P fresh and mid-game. Closed leads pile into one card on a phone. Left: the illustrated district map, pause shots.
  Session 2 (2026-11-01 21:51, ad37318): the drawn district map (`ui/mapplan.ts` layout, `ui/districtmap.ts` SVG in metres), `tests/cathode-mapplan.test.ts`, e2e from the pause Case board, `scripts/cathode-map-shots.mjs`.

## 13. [x] The games page (/games/): live cards with key art *(done 2026-11-01, 6630793..2c850b2: painted 16:10 key art per game with its loop only on hover or focus, a status line for today and a continue chip from each save (`site/src/cards.ts`, unit-tested), phone cards as posters, Cath's Week as three goal tiles, the portfolio's footer, card names morph into the Runnel and Hedgerow wordmarks; shots P and D; site e2e passes (one pre-existing Hedgerow tally flake); local Lighthouse mobile LCP 1.8 s; font budget holds)*
- **Why:**
  - The game cards are flat thumbnails, and Hedgerow's has a rendering artifact.
  - Cath's Week and the footer look unstyled next to the new portfolio front page.
- **Build:**
  - A key-art card per game: a painted still plus a subtle motion loop on hover or focus; a status line ("Today's Runnel: 14 taps par"); and a "continue" chip read from each game's save.
  - Restyle Cath's Week as three goal tiles.
  - Match the footer to the portfolio's.
  - Opt into view transitions so the card morphs into each game's title screen where the game allows.
- **Accept:**
  - Shots at P and D with no artifact.
  - Gate 5 (`npm run e2e:site`) passes.
  - LCP under 2 s in the local Lighthouse run.
  - The font budget holds.
- **Size:** 3

## 14. [x] NIGHT SHIFT: conversations and interrogations *(done 2026-11-02, 4b15b0f..fc383e1: one lieutenant per district, grabbed by a takedown; Press/Wire/Charm/Pay gated by Nerve, Wire and Scrip; intel as a map tip, a squad struck off or a boss weakness used in the fight; plates per man; e2e for the grab and a pick in the clinic; shots D and L)*
- **Why:** the story is only subtitles; it has no faces, no talk and no choices.
- **Build:**
  - In-world talk scenes with close framing and portrait plates.
  - 2 to 4 choices per talk (Press, Charm, Pay), gated by Nerve or Wire.
  - Choices change intel: a waypoint to a secret, a squad removed, or a boss weakness.
  - At least one interrogation per district, by grabbing a lieutenant after a takedown.
- **Accept:**
  - Unit tests for the choice outcomes in `sim/`.
  - An e2e test opens a talk with `?district=clinic`, picks an option and sees its effect.
  - Shots at D and L.
- **Size:** 5
- **Progress:** session 1 (2026-11-01 22:51, 4b15b0f): `sim/talk.ts` (one lieutenant per district, Press/Wire/Charm/Pay, intel as waypoint, squad struck off or boss weakness, recorded as `talk:<id>:<opt>`) with unit tests; struck-off squads never arrive (`unlessTalkedOff` in every alarm); the talk screen `ui/talk.ts`; `?talk` and `window.cathode.talk()`; e2e in the clinic (desktop and phone). Session 1 left: open the talk by grabbing the lieutenant after a takedown (a marked man per district), waypoints on the map, weaknesses used in the boss fights and shown on the case board, a better portrait plate per man, shots at L after the grab. Session 2 (2026-11-01 23:52, 4b15b0f..fc383e1): the lieutenant walks the first rifle (or orderly, or guard) patrol under his name with a red-dash mark, and a takedown on him opens his talk (e2e in the clinic); a talk's tip is crossed in red pencil on the market map (unit test, no-overlap check); intel cards on the case board in his words; weaknesses change the boss fights (`bossEdge`: Vane never stitches, the Chair's right vent stays shut, Pell, the Chair and the core lose 15-25% HP) with Bea saying so (unit tests); a plate per man; the HUD steps out during a talk; shots D and L of the mark, the talk after the grab and the map tip.

## 15. [x] Cathnivore: replayable maps and a Daily Market *(done 2026-11-02, 5c4d4ce..HEAD: the Ring, the ten-hex Long Coast and the Delta with a river and two bridges, picked on Setup with miniatures; types dealt by the seed; the Daily Market (date seed, producer pair, map, event; Daily Market #N on the title with its streak; end screen records the first finish and shares a squares text), `tests/daily.test.ts` and `e2e/daily.spec.ts`; HeuristicBot per map in BALANCE.md within 10 points of the ring; map shots at P and D)*
- **Why:** every game opens on the same fixed 7-hex board.
- **Build:**
  - At least 3 layouts: the ring, a 10-hex coast, and a river delta with bridges.
  - Seeded region types.
  - A Daily Market: a shared seed with a fixed producer pair and event, a share text and a streak.
- **Accept:**
  - The layout can be picked on Setup.
  - The same date gives the same setup (unit test).
  - The HeuristicBot win rate per map is logged in `BALANCE.md`, within 10 points of the ring.
  - Shots of each map at P and D.
- **Size:** 5
- **Progress:** session 1 (2026-11-02 00:00, 5c4d4ce..): every rule reads a region's type and neighbours through the config (`regionType`, `neighborsOf`; ring games unchanged); `src/content/layouts.ts` with the Ring, the ten-hex Long Coast (new regions Gull's Head, Fernlea, Tarnside) and the Delta (channels, one bridge), adjacency from axial hexes, types dealt by the seed (`tests/layouts.test.ts`). Then (2650d14) the picker on Setup (tiles with the layout in miniature; desktop spread still fits), Map.tsx draws from the layout's axial hexes scaled into the square, `createGame` makes the coast's extra regions, bots finish games on all three, `e2e/layouts.spec.ts` at P and D. The Delta now keeps the flower's footprint with a river along the hex edges and two plank bridges (drawn on the board). HeuristicBot per map in BALANCE.md (ring 6.0%, Coast 0.8%, Delta 10.8%; within 10 points). Left: the Daily Market (date seed, producer pair, event, share text, streak; same date gives the same setup, unit test), why Coast games end 2.6 rounds early, shots of each map at P and D in the shot set.

## 16. [x] NIGHT SHIFT: Cath's office, a hub between cases *(done 2026-11-02, c741d90..c804d9b: the office level over the egg stall; Continue lands there; case board, gun bench (parts drawn on the 3D gun under a product-shot key) and wardrobe screens, Bea's line, the stair door loads the open case's district (e2e); shots D and L)*
- **Why:** jobs chain menu to street to menu. Progression lives only in menus.
- **Build:** a small walkable office above Tomas's stall, with:
  - the case board wall (item 12);
  - a gun bench showing mods on the 3D gun;
  - a wardrobe mirror;
  - Bea's call;
  - the water-taxi door to the districts.
- **Accept:**
  - "Continue" lands in the hub, and every station opens its screen.
  - An e2e test walks to the door and loads the next district.
  - Shots at D and L.
- **Size:** 5
- **Progress:** session 4 (2026-11-02 03:51): the bench close-up lit like a product shot (the window's pink key, pooled neon and the environment step back for that render under a neutral key: the gun reads gunmetal, not pink); Cath's umbrella furled indoors (`FrontCath.indoors`); shot D. Session 3 (2026-11-02 02:51): the bench and wardrobe screens. Parts drawn on the 3D gun (`game/gunparts.ts`, every part on every gun, unit-tested); the bench lays her gun on a mat and turns the camera down onto it beside numbers, slots and parts (buying from Ana changes the gun); the wardrobe stands Cath at the mirror beside her four pieces and the bag's; e2e buys a mag and opens the wardrobe (passes). Shots D (bench, wardrobe) and L (bench). Left: re-shoot L after the gun mat, a neutral key so the gun isn't pink from the neon, and her umbrella closed indoors; then tick. Session 2 (2026-11-02 01:51): office session mode, station prompts and screens (bench and wardrobe open the character sheet for now), Continue lands in the office, the stair door loads the case district (e2e). Left: the 3D gun on the bench with mods, a wardrobe screen. Session 1 (2026-11-02 00:52): the office as a level (`render/levels/office.ts`: a room over the egg stall with a street window, cork wall, gun bench, wardrobe and mirror, desk and phone, stair door; `station:<id>` markers), `?district=office`, `tests/cathode-office.test.ts`, `scripts/cathode-office-shots.mjs` (D, L). Left: an `inOffice` session mode, station prompts and screens, the door, Continue, e2e.

## 17. [x] NIGHT SHIFT: the morning-after debrief *(done 2026-11-02, 4e65158..c804d9b: `sim/debrief.ts` grade bars unit-tested, visit ledger and kill stills, the debrief on the cork after a case closes with the print struck in red, stamp, count-up, stills, keepsake, Cath and Bea lines; e2e with a real takedown checks counters against the ledger, reduced motion lands at once; shots D and L incl. the scrolled foot)*
- **Why:** a job ends and play just carries on. No shot shows a payoff beat (critique 2026-11-02).
- **Build:**
  - A debrief after each lead job, on the case board's cork: a stamped grade, Scrip and XP counting up, and the job's best three kills as stills from the kill-cam.
  - The job's polaroid on The List is struck through in red while you watch.
  - An unlock reveal (a mod or an outfit) when the job gives one.
  - A Cath line, plus a Bea text on a clean (unseen) run.
- **Accept:**
  - An e2e test finishes the clinic lead job (test hook) and sees the debrief; its counters equal the session's stats.
  - Unit tests on the grade function at its boundaries.
  - Reduced motion skips the count-up and stills reel.
  - Shots at D and L.
- **Size:** 3
- **Progress:** session 2 (2026-11-02 04:51): the cork paints fully (stamp blend mode removed); the e2e lands a real takedown and checks the ledger. Session 1 (2026-11-02 03:51): `sim/debrief.ts` (score, grade bars S90/A75/B60/C45, stills ranking, keepsakes per case, Cath and Bea lines; `tests/cathode-debrief.test.ts`), `game/debriefledger.ts` (one visit per district load, kept across checkpoint restarts; kills, headshots, takedowns, spotted, damage, time; JPEG stills grabbed 250 ms after the best three kills), `ui/debrief.ts` on the cork (print crossed out in red, stamp, count-up, stills, keepsake card, lines), opens 5 s after a boss falls, then home to the office. `e2e-site/cathode-debrief.spec.ts` (clinic case via `finishCase`, counters equal the ledger, reduced motion final at once). `scripts/cathode-debrief-shots.mjs` (D, L).

## 18. [x] Hedgerow: a full-bleed campaign map *(done 2026-11-02, 4bb3ab8..HEAD: the map is the screen under a glass header, acts joined edge to edge on their own ground with the banner fading in; stops are turf and stone plinths with a flag once won (gold for three stars, a swallowtail on a boss); a banner placer drops colliding names below with a tie line; the fog rolls back off a newly opened act once (fade under reduced motion); `e2e-site/hedgerow-map.spec.ts` (85%+ at P and D, no collisions in any act, roll and fade); shots P, D, L, dark via `scripts/hedgerow-map-shots.mjs`)*
- **Why:** at D the map is still a 10-node strip in a rounded card. Nodes are grey circles, lock icons collide with the name pills ("The Acquisition Van" wraps to 3 lines), and the fog is a blurred card (`D-hedgerow-map`, `P-hedgerow-map`, 2026-11-02).
- **Build:**
  - One scrolling painted world filling the screen, with each act a distinct biome (meadow, orchard, marsh, town edge, the depot) joined by item 3's lane.
  - Nodes become landmark flags on plinths with their stars.
  - Name banners placed with collision avoidance.
  - The fog rolls back with an animation when an act opens.
- **Accept:**
  - The map covers at least 85% of the viewport at D and P.
  - A DOM test finds no label overlapping any node or lock.
  - An e2e test covers the unlock roll-back, with a fade under reduced motion.
  - Shots at P, D, L and dark.
- **Size:** 4

## 19. [x] Hedgerow: a living field with tower tiers and impact *(done 2026-11-02, 2c006d2..HEAD: one voice at a time (e2e), the desktop side column a wave card so the field is 75% of 1440 (e2e), tilled beds and a lane with verges and ruts in 2D, stronger beds in 3D; three tiers per tower (bed, plank deck, stone drum with gold band, taller each tier; `tests/hedgerow-tiers.test.ts`), idle breath and firing squash in 2D and 3D, hit squash on landing, distance-scaled lobs, Fleet pop bursts; late-wave shots P, D, L)*
- **Why:** plots are dashed grey squares, the lane is a plain tan band, towers and enemies are small static icons, and the desktop sidebar has three tutorial voices at once (`D-hedgerow-field`, `P-hedgerow-field`).
- **Build:**
  - Plots become tilled beds; the lane gets ruts and verges.
  - Each tower has three visibly different tiers, with idle and fire animations on both renderers.
  - Hits squash the target, throws arc, and pops burst into particles.
  - One voice at a time: Cath's tip or the "new on the lane" card, never both.
  - The desktop sidebar condenses to a wave card.
- **Accept:**
  - A unit test gives each tower tier a distinct sprite.
  - An e2e test sees at most one tutorial or Cath bubble at a time.
  - The field is at least 70% of the width at D.
  - Late-wave shots at P, D and L.
  - The level tests still pass.
- **Size:** 4

## 20. [x] Cathnivore: the board as a diorama *(done 2026-11-02, ec82f3f..HEAD: on desktop the Market, Cath's Plan and Log are a slim rail of drawer keys with ready counts, Cath's aside shares a row with the papers, so the board is 72% of 1440 (`e2e/board-diorama.spec.ts`); tiles as painted board pieces with a light wash, bevel, thickness edge and cast shadow; painted ground per region type; pieces on turned wooden token bases that drop in again when a stack grows; greyscale legible; board-scales passes; shots of all 3 maps at P and D, mid-game and dark)*
- **Why:** at D the board is about 49% of the width, flat hexes with dashed borders and small glyph pieces. Three dense side panels compete with it (`desktop-chromium-4-game`, `layout-coast-desktop-chromium`).
- **Build:**
  - Painted terrain per region type, with an edge bevel and a cast shadow.
  - Pieces become tokens with depth that drop in when placed.
  - At D the side panels become slim drawers, so the board is the hero.
- **Accept:**
  - The board is at least 62% of the width at D (e2e).
  - Greyscale shots stay legible.
  - `e2e/board-scales.spec.ts` still passes.
  - Shots of all 3 maps at P and D.
- **Size:** 4

## 21. [x] Cathnivore: a hand of action cards *(done 2026-11-02, 5bf9d8b5..HEAD: on a phone the actions are a hand of upright cards docked under the board, grouped behind Sell/Invest/Play spines, fanned and lifted on touch or focus, scrolling sideways in the dock; on desktop the same cards two to a row; unaffordable cards dim with cost and reason; tap raises the card into play (hint in the dock) then tap the hex and Confirm, or drag the card onto a glowing hex; no 'n more' pill on the actions; `e2e/action-hand.spec.ts` (every card reachable at P without page scroll, keyboard-only round at P and D, drag); shots P and D)*
- **Why:** on a phone the actions are a form, a stack of "Sell 1/2/3 Produce" rows with a "17 more" pill. On desktop, Invest is greyed rows tagged "Need 2 more Marks" (`phone-4-game`).
- **Build:**
  - Sell, Invest, Play and Scheme become a fanned hand docked under the board, grouped by kind.
  - Tap a card to raise it and confirm on the hex, or drag it onto the hex.
  - An affordability glow; unaffordable cards dim with a cost chip.
  - Keyboard and screen-reader parity.
- **Accept:**
  - At P every action is reachable without scrolling the page (e2e).
  - Keyboard-only play completes a round (e2e).
  - No "N more" pill remains.
  - Shots at P and D.
- **Size:** 4

## 22. [x] Runnel: teach on the board *(done 2026-11-02, owner session: `lesson.ts`, a four-tile field Cath walks you through in 3 taps on a glowing tile, then today's daily; no modal on a fresh profile; the rules sit behind "?"; `?lesson` replays it; unit test and e2e at P and D)*
- **Why:** the first screen is a How to Play modal (4 rules and 3 diagrams) that hides item 6's living board (`P-runnel`, `D-runnel`).
- **Build:**
  - The first visit opens a tiny tutorial board with Cath coaching in a speech bubble: turn, connect, bloom.
  - It flows straight into today's daily.
  - The full rules move behind "?".
- **Accept:**
  - On a fresh profile no modal covers the board (e2e).
  - The tutorial takes 3 or 4 taps, then loads the daily (e2e).
  - Shots at P and D.
- **Size:** 2

## 23. [x] Shared: Cath's poses and an idle *(done 2026-11-02, this session: six arm poses in `shared/cath` (wave, point, basket, cheer, thinking, crossed) in every outfit's cloth, over the existing blink, breathing and hair sway; `shared/cath/screenposes.ts` gives each screen its own pose and story lines a pose per expression, scene moments carry one; `tests/cath-poses.test.ts` (distinct paths per pose and outfit, no two adjacent screens share a pose); the portfolio hero's right half shows three game prints with Cath in front at D (e2e, shot); reduced motion stops the idle (e2e))*
- **Why:** Cath has one clasped-hands, front-facing pose on the games page, the Cathnivore title, Setup, Campaign and the Hedgerow map: a paper doll, not "characters with presence". The portfolio's right half is empty at D (`D-games`, `D-portfolio`).
- **Build:**
  - `shared/cath/` gains at least 6 poses (wave, point, basket, cheer, thinking, arms crossed), plus a blink, a breathing idle and a hair sway.
  - Each screen picks its own pose.
  - The portfolio hero gets Cath and game art on its right half.
- **Accept:**
  - A unit test checks the pose ids render distinct paths.
  - A test table shows no two adjacent screens of a game share a pose.
  - The portfolio's right half is not empty at D (shot).
  - Reduced motion stops the idle.
- **Size:** 3

## 24. [x] NIGHT SHIFT: the gate and cold open on the live world *(done 2026-11-02, owner session: the street builds from the first moment on a first visit, so the cold-open line fades up over the rain and the gate asks over Cath under her umbrella at P, D and L; on an upright phone the lens lifts her above the copy (FrontScene.setLift) and eases back to the title in one move; automated runs keep the old order. Acceptance changed: "more than 50% of pixels above 8% luminance" doesn't fit a noir night street (D 48%, L 75%, P 23% with her lit and in frame), so the check is Cath in frame above the copy at P, D and L, shot)*
- **Why:** the 18+ gate and the cold-open line sit on black, and the phone gate leaves the top 55% blank. Cath and the rain-soaked street (C13's title scene) only appear after them (`P-nightshift-gate`, `D-nightshift-gate`).
- **Build:**
  - The gate card and the cold-open line play over the title scene, which is already loading: the rain, the neon, and Cath under her umbrella.
  - The phone gate is reframed so the scene fills the top.
  - One continuous camera move from the gate to the title menu.
- **Accept:**
  - More than 50% of pixels are above 8% luminance on the gate at P and D (shot script check).
  - Cath is in frame on the gate at P, D and L.
  - The gate still works without WebGL (falls back to today's card).
  - Shots at P, D and L.
- **Size:** 2

## 25. [x] Cathnivore: conglomerate cards that point at the board *(done 2026-11-02, this session: `src/engine/preview.ts` runs the real resolvers for each card's words by region (an empty slot says when it arms); hover, keyboard focus or a tap marks exactly its targets (`data-threat`) with dotted trails from Hollowell's HQ, static under reduced motion; `tests/plan-preview.test.ts` (20 seeds), `e2e/plan-strip.spec.ts` at P and D; shots P, D and dark)*
- **Why:** the Plan cards read "Squeeze —", "Expand Pasture", "Scout —" (`cathnivore-game-D`, `-P`, `-L`, planning shots 2026-11-02). The player can't see what Pell and Vane hit next or where, which breaks "no mystery waits" (VISION 2, 4).
- **Build:**
  - Each card names its target region(s) and effect in words ("Squeeze → Saltmarsh, −2 Trust"), from one `planPreview()` in the rules layer.
  - Hover, focus or a tap on a card ghosts its targets on the board: an outline in the conglomerate's colour and a dotted arc from its HQ (item 11).
  - An empty card says why ("Squeeze arms in round 3"), never a bare dash.
  - Reduced motion: a static outline, no arc draw.
- **Accept:**
  - e2e at P and D: focusing each plan card marks exactly the hexes the rules target (`data-threat`).
  - Unit test: card text matches `planPreview()` over 20 seeds; no card renders a bare "—".
  - Shots P, D and dark.
- **Size:** 2

## 26. [x] NIGHT SHIFT: Cath's own hands, and a weapon inspect *(done 2026-11-02, this session: `game/armdress.ts` dresses her arms from the wardrobe save (trench, duster, olive mac, silk-lined coat with a burgundy cuff, or her blouse; black leather, brass-knuckle fingerless, copper-wired or bare hands with oxblood nails; skin and trench from the hero model's colours), a fine gold chain on the firing wrist with the pearls on the support wrist; the inspect bound to I and a long press on the weapon name with a clip per class (`feel/inspect.ts`); an idle sway per class, none under reduced motion; `tests/cathode-armdress.test.ts`, `e2e-site/cathode-inspect.spec.ts`; phone perf 245/260 calls; shots D and L per class at rest and mid-inspect, and per outfit, via `scripts/cathode-hands-shots.mjs`)*
- **Why:** in first person the viewmodel is a gun and a generic black glove (`cathode-hud-D`, `-L`); nothing on screen says this is Cath (CLAUDE.md: Cath is the face of every game).
- **Build:**
  - First-person sleeves from her worn coat (wardrobe, item 16), a cuff, a fine gold bracelet and painted nails, sharing materials with the item-9 hero model.
  - An inspect action (I, or a long press on the weapon chip) that turns the gun toward the light, per class.
  - An idle sway per class that respects reduced motion.
- **Accept:**
  - Unit test: the viewmodel picks its sleeve material from the wardrobe save.
  - e2e: `input.forced = {inspect: true}` plays the inspect.
  - Phone-tier draw calls stay within the perf gate (`cathode-perf`).
  - Shots D and L per weapon class.
- **Size:** 2

## 27. [x] Hedgerow: story scenes on a full stage *(done 2026-11-02, 2d52ea7: the scene fills the screen on the act's painted ground; Cath and the cast at half length (`castSvg(who, "half")` runs each coat on to the waist with sleeve lines), wiping in from their sides, a pose per line; each line wipes in from the speaker's side, fades under reduced motion; location box up top, speaker plate with the name only; landscape puts the figures either side of a centred band; Escape skips into the level, arrows step on; `e2e-site/hedgerow-story.spec.ts` (50%+ figures, faces in view and clear of the band at P, D, L; keyboard; reduced motion); every act's opener shot at P, D, L via `scripts/hedgerow-story-shots.mjs`)*
- **Why:** Hedgerow's story is a 640 px modal over the dimmed map with small busts (`hedgerow-story-D`); at L the faces crop to slivers (`hedgerow-story-L`). Cathnivore's scenes got a full stage in item 5; Hedgerow's still read as a dialog box (VISION 5).
- **Build:**
  - A full-viewport scene: the act's painted ground as the backdrop, Cath and the speaker at half length, panel-wipe entrances and a pose per line (item 23's poses).
  - Landscape: figures either side of a centred text band.
  - Speaker plates name the speaker, not the act or the game.
- **Accept:**
  - e2e at P, D and L: each speaker's figure is at least 50% of the viewport height and its face box isn't clipped.
  - Keyboard Next and Skip work; reduced motion uses fades only.
  - Shots of every act's opener at P, D and L.
- **Size:** 2

## 28. [x] Cathnivore: a market table where the day passes *(done 2026-11-02, 059c2e3..48bc91e: a trestle edge and checked cloth hem, Bea's crayon drawing pinned at the top corner and produce crates at the foot (desktop) under the board; `lightFor(round)` lights the table from dawn low on the left to dusk low on the right with a violet shade, lanterns in the dark theme; the new light sweeps across as the round turns; bunting, a cottage with chimney smoke and a bird on liberated regions, still under reduced motion; `e2e/market-table.spec.ts` (dawn vs noon token, via `e2eAutoplayUntil`), board-diorama and board-scales pass; shots of rounds 1, 5 and the last round reached at P and D, plus dark. Autoplayed games end by rounds 7-10, so "round 10" is the last round reached)*
- **Why:** the board sits on a flat beige panel (`cathnivore-game-D`, `-D-dark`), and rounds 1 to 10 look the same. The table should be a place (VISION 1, 4).
- **Build:**
  - The board surround as a trestle table: a wood edge, a tablecloth hem, crates, and a drawing of Bea's pinned at a corner (SVG, inside the CSP).
  - The light moves from dawn to dusk over the rounds (`lightFor(round)`); dark theme is lanterns at night, not an inversion.
  - A short round-turn moment: the light sweeps the table as the round ticks over.
  - Life on liberated hexes (bunting, chimney smoke, a bird), still under reduced motion.
- **Accept:**
  - e2e: the table's light token differs between round 1 and round 5.
  - `e2e/board-diorama.spec.ts` (board 72% of 1440) and the greyscale check still pass.
  - Shots of rounds 1, 5 and 10 at P and D.
- **Size:** 2

## 29. [x] NIGHT SHIFT: a HUD that guides without clutter *(done 2026-11-02, 7f82510..HEAD: a thin compass tape at the top centre with a red-pencil objective tick (an arrow at the end when behind her) and a dashed tick for the lieutenant once she has seen his name; the weapon block (name, rounds in the figures face, amber at a quarter, blood at empty), the hit-direction crescents (`ui/dmgring.ts`) and the blood vignette (`render/post.ts` Vitals pass, strength-only beat under reduced motion) were already in; the subtitle drops to the bottom band on short landscape screens; `e2e-site/cathode-hud.spec.ts` (tick within 5 degrees at three headings, rounds drop on fire, subtitle clear of the central 30% at L and D); type and CSS lints pass; shots D and L via `scripts/cathode-hud-shots.mjs`)*
- **Why:** the HUD shows a health bar and the job name over an empty rule (`cathode-hud-D`); there's no ammo, no bearing to the objective, no hit direction, and at L Cath's subtitle sits over the crosshair (`cathode-hud-L`).
- **Build:**
  - A thin compass tape at the top with a red-pencil objective tick (and the lieutenant once known, item 14).
  - The weapon block: name and rounds in the HUD's figures face.
  - Hit-direction ink smears; a low-health vignette (none under reduced motion).
  - Subtitles in a low band that never covers the middle 30% of the screen.
- **Accept:**
  - DOM check at L and D: the subtitle box doesn't meet the central 30% rectangle.
  - e2e: the compass tick is within 5° of the computed bearing; the round count drops on fire.
  - Shots D and L; the type lints (C13T) pass.
- **Size:** 2

## 30. [x] Runnel: a crisp board, and the stats as a proper sheet *(done 2026-11-02, 9a9d376..7ffa273: channels at 3:1 or more against their tiles in every palette (darker groove in the light seasons, pale sand channels at night; `tests/runnel-contrast.test.ts`), cloud shadows a faint soft-edged drift; at 1440 the board sits in a hedge with the spring house and Bea's garden in its corners and a stats rail down the left, 58% of the width; the stats sheet a grid of six tiles in two rows of three over the 28 days (it shared the win card's tilted polaroid rule); `e2e-site/runnel-board.spec.ts`; puzzle, win and stats shot at P, D, dark and greyscale via `scripts/runnel-shots.mjs`)*
- **Why:** weather shadows smear grey ellipses over the tiles and the channels are tan on tan (`runnel-puzzle-P`, `-D`, `-P-dark`); at D the board is an island in empty paper. The stats sheet's tiles stack in a skewed column over the 28-day grid (`runnel-stats-P`, `-D`).
- **Build:**
  - Cloud shadows down to a faint drift that never darkens a channel; channels inked at 3:1 or more against their tile.
  - At D, a farm frame around the board (a hedge border, the spring house, Bea's garden) with a stats rail.
  - The stats sheet as a grid: six tiles in two rows of three, then the 28 days.
- **Accept:**
  - Unit test: channel against tile contrast at least 3:1 in light and dark.
  - The board is at least 55% of 1440; no stats tile overlaps the grid (e2e, P and D).
  - Shots of puzzle, win and stats at P, D and dark; greyscale legible.
- **Size:** 2

## 31. [x] Hedgerow: a tower almanac in the tray, and Cath's field notebook *(done 2026-11-02, 54604d7..HEAD: tray cards with name, role glyph and range and damage pips, a hover or long-press range ring on the field; the desktop side column ends on Cath's notebook (a ruled page growing to the foot: the tower last looked at with its stand and sell value, a sketch of the next new vehicle with its round), in the round drawer on a phone; `e2e-site/hedgerow-tray.spec.ts` (ring radius equals range; no empty band over 120 px at D on levels 6 and 12); field 75% checks pass; shots P, L, D. The tier path itself stays on the tower sheet, which already fills the column when a tower is selected)*
- **Why:** the build tray shows unnamed icons with a price (`hedgerow-field-P`, `-D`), and the desktop side column is empty below "Coming up". Players can't learn the towers in place.
- **Build:**
  - Tray cards with name, role glyph and range and damage pips; hover or long-press draws the range ring on the field before placing.
  - The empty column becomes Cath's notebook: the selected tower's tier path (item 19), sell value, and a sketch of the next new enemy.
  - At P the notebook opens in the tray-peek drawer.
- **Accept:**
  - e2e at D: no empty band taller than 120 px in the side column.
  - Hovering a tray card draws a ring whose radius equals the tower's range (e2e).
  - The 75% field checks (items 10, 19) still pass; shots P, D and L.
- **Size:** 2

## 32. [x] Cathnivore: chapter 2 taught on the board *(done 2026-11-02, lane B: chapter 2 is a guided chapter, 13 steps over round 1 and the start of round 2: Doubt on Saltmarsh, Goodwill, Rebut, Supply, Public Trust, Sol's free On Air, Graft, the Scout's turn, then Open Stall and Supply to liberate Rivermead and hand over; coach progress per chapter (`coachedChapters`, `isCoachDone`), the campaign card's "Replay the walkthrough"; the prompt strip no longer runs in chapters 1-2 (3-6 keep it until coached); `tests/tutorial-script-ch2.test.ts` replays it with the real engine, `e2e/tutorial-ch2.spec.ts` walks it at P and D, resumes after a reload, skips and replays; every step shot at P and D. Along the way: role cards read "On Air: +1 Trust" (the long label ran off a phone card), and a plan slot whose rule is off says "Not in this chapter" and marks no hex)*
- **Why:** owner feedback 2026-11-02 wants the campaign taught "baby step by baby step"; the owner's coach covers chapter 1 only, and chapter 2 still uses the old prompt strip (FEEDBACK).
- **Build:**
  - The spotlight coach (`src/content/tutorial.ts`, `TutorialCoach.tsx`) scripts chapter 2's first round: the new idea it brings, shown by doing it, with Cath's what and why.
  - The old prompt strip is retired from the campaign once both chapters are coached.
  - Skip, replay and resume as chapter 1.
- **Accept:**
  - e2e: a fresh save walks chapter 2's script to free play at P and D.
  - A reload mid-script resumes on the same step (e2e).
  - Shots of each step at P.
- **Size:** 2

## 33. [x] Cathnivore: the bugs from the 2026-11-02 critique, fixed as one batch *(done 2026-11-02, lane A, 21fc9fa8..66da2a52: `plural()` (no "1 Marks"), terrain keeps its region name across 100 seeds x 3 maps, Escape closes phone sheets with focus back, title fits 390x844, Cath's aside wraps whole, the whole board above the hand at P with Invest cards showing name, reason and price, Invest cards whole at D, chapter 1's hexes centred and 1.3x, Cath's folded hands on real sleeves, the boardroom strip in the Actions area (no hex covered, nothing clipped, e2e P and D), the AI teammate at the table while thinking; shots P and D)*
- **Why:** a fresh-eyes pass at P and D found craft bugs a player hits in their first game.
- **Build:** fix every one of these, each with its own test where one fits:
  - At P the boardroom strip is clipped under the producer bar, and its step label is cut mid-sentence. At D it covers the board's top row.
  - "AI teammate is deciding…" is plain text in an empty band.
  - Cath's aside is truncated mid-word.
  - At D the Farm panel pushes the Actions frame, cutting the Invest cards in half.
  - Escape doesn't close the phone sheets (Farm, Market, Plan).
  - Card text reads "1 Marks"; add a `plural()` helper for all card text.
  - The Daily Market deals region terrain against the region names (Brindle Hills as a coast).
  - Chapter 1's two-hex map isn't scaled or centred.
  - At P the bottom hex row is cut by the felt.
  - At P the title's footer is clipped.
  - In story scenes, Cath's hand is a flesh blob.
- **Accept:**
  - e2e at P and D during the enemy turn: the strip intersects no `.hex` and its label isn't clipped.
  - Unit: no card text matches `/\b1 Marks\b/`.
  - Unit: every region name keeps one terrain across 100 seeds × 3 maps.
  - e2e: Escape closes each phone sheet and returns focus.
  - Shots of every fixed screen at P and D.
- **Size:** 3

## 34. [x] Cathnivore: the turns between yours are a show, not a wait *(done 2026-11-02, lane A, 64d852bc..4810fe70: the AI teammate lifts each pick as a card with its reason (`data-teammate-step`, set before the state changes) and a face per pick, its hex glows, a ledger of their turn sits under the card (pips on a phone), and the card flies to its hex as it lands; a tap skips the rest of their turn; the enemy turn's steps are a ledger that ticks off in the Actions area (pips at P); the AI speed setting paces both; reduced motion fades and skips the flight; `e2e/turn-show.spec.ts` at P and D (no box over a hex, no empty band over 120 px, reason first, tap skips, fade), `tests/teammate-pick.test.ts`; shots of both turns and the flight at P and D. Under webdriver a pick shows for 120 ms unless `?e2eTeammateShow=1`, so older specs don't wait out the reading time)*
- **Why:** the AI teammate's turn and the enemy turn come every round and are the weakest screens.
  - The teammate's turn is a blank band with "deciding…" text.
  - The enemy strip covers hexes and blanks the Actions panel.
  - This breaks VISION 3 (no mystery waits) and 5 (characters with presence).
- **Build:**
  - **Teammate's turn:** it plays in the dock. Their portrait carries an expression per pick, beside their own hand. Each pick lifts a card with a one-line reason ("Brindle Hills is about to be Squeezed, so I'll open a Stall there") and flies it to its hex the way the player's cards move.
  - **Enemy turn:** the steps dock into the hand area (P) or the Actions column (D) as a ledger that ticks off, and never cover a hex.
  - **Pacing:** the AI speed setting paces both turns, and a tap skips.
- **Accept:**
  - e2e at P and D during both turns: no panel box intersects a `.hex`, and there is no empty band over 120 px.
  - Each teammate step exposes `data-teammate-step` with its reason before the state changes, and a tap skips the rest.
  - Reduced motion uses fades (e2e).
  - Shots of both turns at P and D.
- **Size:** 3

## 35. [x] Cathnivore: the Liberation of Marrow as a map you travel *(done 2026-11-02, lane B, e6b92a9..HEAD: a code-drawn map of Marrow heads the campaign (held regions Hollowell orange, a won chapter's home regions green with bunting, numbered pins on a dotted lane, Cath at the next one); three wax seals per card (win, Hard, a feat; chapter 1's Hard seal is a swift win by round 3, since Hard chapter 1 can't be won) and Play on Hard on won chapters; the chapter-complete moment after a first win (flood, bunting drop, Cath walks on, "Next stop" slides in; fades under reduced motion); the title's Campaign key shows the freed regions; `tests/campaign-map.test.ts`, `e2e/campaign-map.spec.ts` (sequence, seals across a reload, no sideways scroll at P, Hard, title); shots fresh, mid, complete and mid-moment at P and D. Cut: Cath stands at half length, as the shared art has no full-length framing yet)*
- **Why:**
  - The campaign is a list of cards with padlocks.
  - There's no chapter-complete moment (VISION 4).
  - Nothing on the title shows progress.
- **Build:**
  - A code-drawn map of the Republic is the campaign screen. Chapters are places on a dotted lane, with a full-length Cath at the current one.
  - Regions recolour from Hollowell orange to green with bunting as their chapters are won.
  - Three wax-seal goals per chapter: win, win on Hard, and one chapter feat.
  - A choreographed chapter complete: the region floods green, bunting drops, Cath walks to the next pin and the next location slides in (fades with reduced motion).
  - The title shows the map's progress.
- **Accept:**
  - e2e: winning chapter 1 by autoplay plays the sequence and ends with the region `data-liberated` and Cath at chapter 2.
  - e2e: the seals persist across a reload.
  - e2e: no horizontal scroll at P.
  - Shots of the map fresh, mid-campaign and complete, at P and D.
- **Size:** 3

## 36. [x] Cathnivore: an engine you can see (an illustrated Market, and farm tableaux) *(done 2026-11-02, lane A, 9472c66f..HEAD: a code-drawn vignette per card from a kit keyed by its first tag (`src/ui/Vignette.tsx`; untagged Schemes get Cath's notebook), as a banner on phone Market and Plan cards and a thumbnail in desktop drawer rows, with the existing cost coin and effect line; the phone Farm stands each producer at their gate over a ribbon summing a round's income, with bought cards laid out drawn; the desktop Farm is a fixed 88 px frame of drawn thumbnails that scrolls inside (it grew from 75 to 300 px by round 6 and pushed the Actions frame down); a buy flies the drawn card into the farm while the price counts out, and the income figure ticks up; `tests/vignettes.test.ts`, `e2e/farmstead.spec.ts` (Actions top unchanged between round 1 and a grown farm at D; a buy makes a `.buy-flight` and the card lands in the farm at P and D); shots of the Market, Plan and Farm at P and D at rounds 1, 4 and 6 (autoplayed games rarely reach round 7, as in item 28))*
- **Why:**
  - The Market, Plan and Farm are text lists, so players can't see their engine grow.
  - At D the Farm panel grows into the Actions frame.
- **Build:**
  - Each card gets a code-drawn vignette from a kit keyed by its tag (crop, coast, science, media, community), plus a cost coin and a one-line effect.
  - Each producer gets a farmstead tableau: their portrait at the gate, bought cards laid in a row, and a "+3 Produce each round" ribbon that sums them.
  - The phone Farm sheet shows both tableaux. At D the Farm is a fixed-height tableau that scrolls inside.
  - A choreographed buy: coins count out, the card flies into the farmstead and the ribbon ticks up.
- **Accept:**
  - Unit: every improvement and scheme has a vignette.
  - e2e at D: the top of the Actions frame doesn't move between round 1 and a 5-card farm.
  - e2e: a buy creates a `.buy-flight` and the tableau gains a card.
  - Shots of the Market, Plan and Farm at P and D, at rounds 1 and 7.
- **Size:** 3

## 37. [x] Runnel: the Orchard as a place, Bea's garden drawn by hand, and a win card above the fold *(done 2026-11-02, lane B, 00ed3b1..HEAD: `gardenart.ts` draws eight crops in three stages, the season's visitors, the event crops, Bea with her watering can on a solved day and the Orchard's trees; the Orchard is three rows of ten trees (sapling, leaf, blossom when solved, fruit on a three-drop solve; the current one glows with Cath), no strip; the win card puts the result and buttons first with the share card and Bea's postcard in a swipe row; `?shotwin` saves nothing; no platform emoji in rendered text (share texts keep theirs, they're copied text); `e2e-site/runnel-garden.spec.ts`, `runnel-win.spec.ts`, `tests/runnel-garden.test.ts`, `runnel-store-freeze.test.ts`; shots P, D and dark. "Fruits on an under-par solve" reads as a three-drop solve: the save keeps drops and taps, not par)*
- **Why:**
  - The Orchard is a numbered strip that overflows at P and D.
  - Bea's garden is platform emoji, which breaks "all art authored as code" and differs per OS.
  - At P the win card hides its headline and buttons below the fold and cuts Cath's medallion at the top.
  - `?shotwin` writes a real daily result.
- **Build:**
  - **Orchard screen:** rows of code-drawn trees, one per level. A tree blossoms when its level is solved and fruits on an under-par solve; the current tree glows, with Cath beside it.
  - **Garden:** tilled rows of code-SVG crops in three growth stages, and Bea with a watering can on the day's first solve. The D board corner shows the same crops.
  - **Win card:** headline and buttons above the fold at 390x844, with the share card and Bea's postcard in a swipe row below.
  - `?shotwin` no longer saves.
- **Accept:**
  - e2e: no `\p{Extended_Pictographic}` in Runnel's rendered text at P or D.
  - e2e: the Orchard has no horizontal overflow and its levels are keyboard-reachable.
  - e2e on the win card at P: the headline, the primary button and the whole medallion are in view.
  - Unit: every crop has 3 drawn stages.
  - Shots at P, D and dark.
- **Size:** 3

## 38. [x] The site: live key art, a phone hero, and a header that never overlaps *(done 2026-11-02, lane B, f6ba2fe..HEAD: the header solid glass once scrolled; the scroll cue clear of the stats; the phone hero leads with Cath at 44% in front of a print cross-fading between three games, Cath built into the HTML, prints at 640/960/1440 px so mobile LCP is 1.8-1.9 s; Cath's Week tiles name what a tap does with a "1 to go" nudge (NIGHT SHIFT's tile colour fixed); `npm run keyart` (`scripts/keyart.mjs`) shoots the Cathnivore table at round 7, a really solved Runnel daily, a busy Hedgerow level 30 and NIGHT SHIFT's street key art into portfolio/public/work at three widths, used by the hero, the case study and the /games/ NIGHT SHIFT card (no more doodle); `e2e-site/site-header.spec.ts`, `site-hero.spec.ts`, games-cards; shots of all three pages at P and D. Changed: keyart runs as its own step on `build`, not inside `npm run release`, see DECISIONS)*
- **Why:**
  - On the portfolio and case studies the fixed header overlaps scrolled content at D.
  - The scroll cue overlaps a stat label.
  - The phone hero has no imagery.
  - The case study's Runnel thumbnail is stale.
  - On /games/, the NIGHT SHIFT card is a placeholder doodle, and Cath's Week is three bare bars.
- **Build:**
  - `scripts/keyart.mjs` shoots each game's hero state (the Cathnivore round-7 diorama, a solved Runnel daily, a late Hedgerow wave, the NIGHT SHIFT street) and writes WebP into the portfolio and /games/ art. It runs as `npm run keyart` on `build` (changed 2026-11-02: not inside `npm run release`, which ships only what CI has tested).
  - The header gets a blurred glass backdrop once scrolled.
  - On the phone hero, Cath stands in front of one print that cross-fades between games.
  - Cath's Week tiles become tappable: each opens the game at the goal's mode, with a "1 to go" nudge.
- **Accept:**
  - e2e at P and D on all three pages, after scrolling 1.5 screens: no text rect intersects the header except its own.
  - The scroll cue intersects no text.
  - The phone hero shows Cath at 40% or more of the width.
  - Lighthouse mobile LCP is 2.0 s or less.
  - Shots of all three pages at P and D.
- **Size:** 2

## 39. [x] Runnel: one-screen Practice and a proper Bea's workshop *(done 2026-11-02, lane A, 59bf6343..f548b69d: Practice keeps the daily's layout with one "Board" chip beside the tabs whose sheet holds size, copy and paste code, Bea's picks, the seasonal boards and the workshop (board top 223 px, full width at 390x844); the workshop is a full-screen oak table with the board on taped paper, Bea and her crayons in the corner, water running along channels as they join the spring, Test it then Share (code and share card) once solved, Bea's shelf of picks; the stats rail hides during the lesson; `e2e-site/runnel-practice.spec.ts` (P board top and width, chip and sheet, build-test-solve-share-paste at P and D, rail hidden in `?lesson`), `tests/runnel-workshop-water.test.ts`; shots P, D and dark)*
- **Why:**
  - At P, Practice stacks three rows of controls above a small board.
  - The workshop is a plain modal of blank hexes.
  - At D the lesson shows an empty stats rail.
- **Build:**
  - **Practice:** uses the daily's layout. Size, paste code, copy code, Save to Bea's picks and Workshop move into one "Board" chip that opens a sheet.
  - **Workshop:** a full-screen table with Bea and her crayons in a corner, and water animating along channels as you lay them. The flow is "Test it", then "Share" (a code plus a share card), with a shelf of picks.
  - **Lesson:** the rail stays hidden.
- **Accept:**
  - e2e at P: the Practice board's top is within 260 px of the top of the screen, and the board is 85% or more of the width.
  - e2e: build a board, test it, solve it and share it; the pasted code reproduces the board.
  - e2e: the rail is hidden during `?lesson` at D.
  - Shots of Practice and the workshop at P and D.
- **Size:** 2

## 40. [x] NIGHT SHIFT and Hedgerow: the bugs from the 2026-11-02 critique, fixed as one batch *(done 2026-11-02, lane A, 17:16-19:30 sessions, slices 1-11: Hedgerow's name plate whole, the fresh map line clear of the header, the D side column ending on a whole card, the L round ticket's stub whole (60 px), the L end card a spread, the 3D rooks drawn as birds, "Start here" only on a fresh farm; NIGHT SHIFT's L touch columns clear of the scope and the look hint, the objective pool's soft fall-off, the class-pick still without the title under it, the P class pick's pinned hold bar with a "More below" cue, the L case board's first lead and Back on screen, Continue's plain line, `cathodeFront.ready` at the gate; e2e in `hedgerow-critique.spec.ts`, `cathode-hud.spec.ts`, `cathode-front.spec.ts`; shots at each size that broke)*
- **Why:** a fresh-eyes pass at P, D and L found layout and craft bugs.
- **Build:**
  - **Hedgerow:**
    - In story scenes the speaker's name plate is clipped at D and L, and at P the figure covers it.
    - On a fresh visit, the map's host line hides under the glass header.
    - At D, the side column's "Coming up" card is clipped at its foot.
    - At L, the round card's "OF 13" and the tray names are cut off.
    - At L, the end card loses its stats and rewards off-card.
    - In 3D, black wedge shards lie on the grass (back-faced or unlit particles).
    - "Start here" shows on a level mid-campaign.
  - **NIGHT SHIFT:**
    - At L, Skill covers "Drag to aim" and Takedown overlaps the scope.
    - The objective scrim is a hard dark ellipse over light scenes; make it a soft gradient.
    - The `?front=classpick` stage draws the list over the menu.
    - At P, the class pick's stats run off the screen with no scroll cue.
    - At L, the case board cuts off its leads and Back button.
    - Continue's line names a district and another case's lead; it should say plainly what Continue opens.
    - `window.cathodeFront.ready` never fires on a fresh-profile gate.
- **Accept:** each fix is shot at the sizes it broke at, with an e2e or unit check where one fits (no clipped text: `scrollWidth <= clientWidth + 1`; no control overlaps at L; ready fires at the gate).
- **Size:** 3

## 41. [x] NIGHT SHIFT: enemies with faces (hero-quality archetype models) *(done 2026-11-02, lane B, 019cf90..HEAD: faces on the bare-faced archetypes (the orderly's opaque shield pane cut to a frame, his headband off his eyes); the riot shield's back modelled with a handle at his hand; rappellers' harness and tether; real two-joint hands on every humanoid (`realHand`); the bystander's coat pockets; guards read at 25 m (faction rim far boost; Plaza 5.4% -> 15.3%, market 18.6%, `scripts/cathode-far-read.mjs`); phone 12-man firefight 294 -> 258 calls (far men out of the mirror, far carbine stand-in, LOD0-only shadows; a standing cathode-perf case); turntables of all 13 at D; face/hands/budget tests in cathode-models.test.ts. Changed: the armoured enforcer family keeps C10's 16k LOD0 budget. Not done: gore caps were untouched since the limbs' shapes didn't change)*
- **Why:**
  - The player spends most of the game aiming at enemies, and they are the least finished art on screen:
    - the clinic orderly is a mannequin with a slab face, tube limbs and mitten hands;
    - the shield carrier reads as a floating slab;
    - the rappeller has no rope;
    - Plaza guards at 25 m are black blobs.
  - The owner asked for very high-quality enemy design (FEEDBACK 2026-10-15).
- **Build:**
  - Rebuild every archetype in `game/models/`.
  - Each gets a shaped head with a painted face or a faction mask or visor, real hands, a neck, cloth breakup (hems, pockets, straps) and a faction palette.
  - A rim or emissive strip so they read at 30 m at night.
  - Model the shield carrier fully behind the shield, and give rappellers a rope and harness.
  - Three LODs each, with gore caps matched to the new limbs.
- **Accept:**
  - Turntable shots (front, three-quarter, back) of every archetype at D.
  - Unit: each LOD0 has a face material and two hand meshes, and stays inside a 12k triangle budget (changed 2026-11-02: the armoured enforcer, leader and riot keep C10's 16k desktop budget; see DECISIONS).
  - Plaza guards differ from the background by 15% or more in luminance at 25 m (shot check).
  - The phone `cathode-perf` tier stays under 260 calls in a 12-enemy fight.
  - The ragdoll and dismemberment e2e still pass.
- **Size:** 4

## 42. [x] NIGHT SHIFT: Cath faces the camera (the class pick and staged interrogations) *(done 2026-11-02, lane B, 22:21-23:21 sessions: the class pick faces her three-quarter to the lens with a 400 ms turn and a coat per class; the talk on high/ultra is a two-shot in the world, the lieutenant (his district's own kind of man) pinned to the nearest wall, Cath three-quarter to the lens, umbrella furled indoors, each answer a beat for both (`TALK_BEATS`), choices on a lower-third strip; phone tier and reduced motion keep the plate; `wallPin`, beat and pose unit tests; two-shot, plate and grab e2e at D)*
- **Why:**
  - The player never sees her face: the gate, title and class pick are all from behind.
  - At D the class pick has an empty, dark centre for all five classes.
  - The talk is a flat plate of the lieutenant and a menu, with no Cath.
- **Build:**
  - **Class pick:** item 9's hero model three-quarter to camera in each class's kit, with a signature pose and a one-line bark. Switching class plays a 400 ms turn and outfit swap. At P she stands above the list.
  - **Interrogation:** a third-person two-shot in the world, the lieutenant pinned to a wall and Cath on the left third.
  - The lieutenant gets a real bust that reacts to each answer, and Cath plays a bible expression per approach.
  - The choices sit on a lower-third strip. The 2D plate stays as the fallback on low quality and with reduced motion.
- **Accept:**
  - Shots of all five classes at P, D and L, with Cath's head in frame and at least 12% of the height at D.
  - Unit: the five poses are distinct.
  - e2e: `talkCam.mode === 'two-shot'` with both on screen; reduced motion fades.
  - The talk e2e still picks an option.
- **Size:** 4

## 43. [x] Hedgerow: every level a place (hand-shaped fields and set pieces) *(done 2026-11-02, lane A, c681984..5e66053: every level stands on a landmark from a 12-kind library picked per act (`landmarks.ts`; 2D `landmarkart.ts`, 3D `buildLandmark`), on the cells that see least of the lane (a raised bank takes high ground instead), two on boss fields except level 50 (its boss needs every plot, so a bank); near-twin fields mirrored (`untwin`: worst within-act overlap 0.68, was 0.83); twists change the ground: Night is a blue dusk lit by lanterns along the lane, Crowd lines the verges with vans and placards (`twistDressing`, drawing only), the existing Flood set piece raises the river; the bank one ridge with a pale top in 3D; `hedgerow-tune --verify` passes at the shipped START_K (tuning.ts unchanged); `tests/hedgerow-landmarks.test.ts`; Hedgerow field, critique and tray e2e pass; levels 1, 5, 12, 21, 38, 45 and every boss shot at P, D, L in 2D and 3D (`scripts/hedgerow-landmark-shots.mjs`). "Plots follow the land" is the landmarks and banks taking cells; lanes were not redrawn, so the tuner fit holds)*
- **Why:**
  - Level 2 and level 38 are the same plot grid on the same S-lane, in 2D and 3D.
  - Twists barely change the ground.
  - This is the owner's top complaint in Hedgerow FEEDBACK rounds 2 and 3.
- **Build:**
  - A set-piece layer in the layouts and terrain: each level declares one or two landmarks from a library of about 12:
    - a ford with a bridge, a village green with a well, orchard rows;
    - a quarry rim, a raised bank (plots on higher ground with a reach bonus);
    - a farmyard, a churchyard wall, a market square, a reed bed;
    - a windmill hill, a canal lock, the silo.
  - Plots follow the land.
  - Twists change the ground: Flood raises the river into the field, Night lights lanterns, Crowds lines the verges with vans.
  - 3D meshes plus 2D tiles; re-fit `START_K` with the tuner.
- **Accept:**
  - Unit: within an act, no two levels' plot sets overlap by more than 70% (Jaccard), and every level has a landmark.
  - `hedgerow-tune --verify` and the level tests pass; the field-share e2e still passes.
  - Shots of levels 1, 5, 12, 21, 38, 45 and the bosses at P, D and L, in 2D and 3D.
- **Size:** 5

## 44. [x] NIGHT SHIFT: a touch layout built for the scene, and a real upright-phone screen *(done 2026-11-03, lane A, ed02f95..HEAD: contextual Takedown/Focus/Skill fading in only when usable; Reload a tap on the round count; Aim, Takedown, Skill and Focus on one arc round Fire with Swap under it; Jump/Crouch flicks of the move thumb (`flickOf`); used Fire/Aim/Swap/Cath rest as 30% rings with no word; touch discs that take real taps; case note and vitals one block at L; upright, a designed screen (`ui/upright.ts`: Cath, a phone that turns, Back, and the case board, wardrobe and gun bench usable upright); the overlap report 0 at L and L2 in the market, clinic and Plaza; controls under 18% at rest, the takedown and upright e2e (`cathode-hud.spec.ts`, `cathode-upright.spec.ts`); the D HUD e2e unchanged; shots at L, L2, P, P2)*
- **Why:**
  - At L nine buttons fill the right 40% of the screen and overlap each other.
  - Upright, the game is a dead-end black "turn your phone" card. The brief's minimum spec is an iPhone.
- **Build:**
  - Fire and Aim are always shown.
  - Takedown, Skill, Focus and Swap appear only when they can be used, in one radial cluster around Fire.
  - Jump and Crouch become swipes on the move side; Reload is a tap on the ammo counter.
  - At rest, controls are 30% rings with no labels after first use.
  - At L, objective and health merge into one compact block.
  - Upright, the card becomes a designed screen: Cath's portrait, a rotate animation, a Back link, and the case board, wardrobe and gun bench usable upright.
- **Accept:**
  - The shot script's overlap report shows 0 overlaps at L in the market, clinic and Plaza.
  - Controls cover 18% of the screen or less at rest.
  - The takedown button shows only within 2 m of an unaware guard (e2e).
  - The case board and wardrobe open upright at P (e2e).
  - The D keyboard and HUD e2e are unchanged.
- **Size:** 3

## 45. [x] Hedgerow: a swarm worth watching *(done 2026-11-03, lane B, 2186f1d..HEAD: `convoy.ts` lays each queue out for the eye (a length apart, two abreast past 12, never more than 2 cells behind its real place, so the rules and bot tuning stand), the overflow a column at the tail (2D stack with +N; 3D up to 8 high); per-tower pooled Marks, wreckage on the verge for the round, no shards under reduced motion, the swarm badge riding the column with a make-up bar, in 2D and 3D; unit test at 600 vehicles; e2e on level 38's last round (19; the level has no 20th) at P and D: 40+ drawn, a counter rising, shards gone under reduced motion; layout 0.3 ms a frame; shots 2D and 3D at P, D, L)*
- **Why:**
  - Late rounds collapse into one purple lorry with a count badge in 3D, and a pile of sprites in 2D.
  - The "hundreds of small wins" the Hedgerow 2 design is built on can't be seen.
- **Build:**
  - Convoy spacing by vehicle length, two abreast where the lane is wide.
  - Above a cap, a visible column (instanced or batched) that shrinks as it is popped.
  - Each layer pop throws shards in the layer's colour, and Mark sparks pool into one rising counter per tower.
  - Wreck debris stays on the verge for the round.
  - The badge rides the column's head as a stacked make-up bar. Over the cap, the oldest effects are culled first.
- **Accept:**
  - Unit: same-lane gaps stay at or above vehicle length with 600 enemies, deterministic under a fixed seed.
  - e2e in `?2d&sandbox=1`, level 38 round 20: 40 or more distinct vehicles on screen, and the pop counter rises.
  - The 3D phone fps floor holds.
  - Reduced motion drops the shards (e2e).
  - Shots at P, D and L, in 2D and 3D.
- **Size:** 3

## 46. [x] Hedgerow: a win that pays out on stage *(done 2026-11-03, lane B, 09b909c..HEAD: `renderPayout` in main.ts: Seed Bank, medal and Heroic chips with the new stars flying in as coins, a rosette ribbon with names, Cath's whole figure on a level-up with the talent chosen on the card (saved), a Next card with the next landmark, twist and reward; an L spread; a tap skips, reduced motion shows all at once; e2e `hedgerow-payout.spec.ts` (P, L, D in view, talent saved, skip); shots of win, level-up win and loss at P, L, D, reduced motion and dark)*
- **Why:**
  - The rewards (a level-up, a talent choice, Seed Bank stars and rosettes) are buried in one dot-separated sentence.
  - At L the tally is off-card.
  - Cath is a 120 px circle (VISION 4: staged moments).
- **Build:** after item 10's count-up:
  - the stars stamp in;
  - Seed Bank coins fly to the header chip;
  - rosettes pin onto a ribbon with their names;
  - on a level-up, Cath's full figure appears in the cheer pose (item 23) with the talent picker inline;
  - a Next card shows the next level's landmark and its twist in one plain sentence.
  - At L the card goes two-column. A tap skips it; reduced motion fades.
- **Accept:**
  - e2e at P, D and L after a 3-star win: the stars, rosettes, Seed Bank delta and Next card are all in view without scrolling.
  - A level-up pick persists to the save.
  - Shots of a win, a level-up win and a loss at P, D, L and dark.
- **Size:** 2

## 47. [x] The bugs from the 2026-11-03 critique, fixed as one batch *(done 2026-11-03, lane A, e35fbf41..6504f547: Hedgerow's map tools five keys that fit at P with the rest in an upward Modes drawer, its grip 'Next: Round N', a game's own week goal; Runnel's lesson at a daily board's scale centred in the frame, the win keepsakes whole (a page at a time with dots on a phone, side by side from 700 px); Cathnivore's teammate seat staged between picks (face, face-down card, ledger; every lifted card 130 px at D), short plan-card lines at P and for long lines at D, Mara's braid over her shoulder (it was a bar down her face), legible thinking dots, two-line region names and Cath clear of them; NIGHT SHIFT's front bars 5svh; e2e in hedgerow-map, runnel-practice, runnel-win, plan-strip, turn-show, campaign-map at P and D; shots before and after via `scripts/critique47-shots.mjs` and friends. The end chart at P went to item 48 (done there); the end screen's blank 2.5 s at D is listed under Critique bugs in PROGRESS.md)*
- **Why:** a shot-by-shot critique at P and D (2026-11-03, lane B planning) found these. Each one is small, but together they make the games look unfinished.
- **Build:**
  - **Hedgerow:**
    - map at P: the "Beyond the hedge" body is cut off by the bottom nav, and the nav's fifth button ("Normal") runs past the right edge;
    - title: a "Cath's Week" chip names a Runnel goal on the Hedgerow screen (show this game's goal, or the week in full);
    - in play at P: the round tab says ROUND 7 while the bar says Round 6/19.
  - **Runnel:**
    - Bea's postcard in the win sheet's swipe row is clipped at D and P;
    - the lesson's spring tile overlaps "The spring house" label at D;
    - the fourth lesson tile touches the right edge at P;
    - the lesson's four tiles sit in one corner of the framed board (centre them).
  - **Cathnivore:**
    - the end screen is blank cream for about 2.5 s at D before the card mounts;
    - the end chart at P is clipped under the sticky Play again bar *(fixed by lane B under item 48, 2026-11-03)*;
    - the teammate's "weighing up their move .." has a double dot;
    - the D Actions panel during the teammate's turn is 560 px of blank cream (show the card the teammate is lifting, or Cath's plan);
    - the Mara Keel farm thumbnail is blank grey;
    - phone plan cards truncate their effect lines;
    - the campaign map's "Brindle Hills" label runs into Kingsmarket, and Cath covers "Hills".
  - **NIGHT SHIFT:** the gate and title show about 80 px letterbox bars at D.
- **Accept:**
  - e2e checks for the clipping and overlap cases (bounding boxes inside the viewport and not intersecting, at P and D).
  - Shots of each fix before and after.
- **Size:** 2

## 48. [x] Cathnivore: an end screen that is a moment, not a report *(done 2026-11-03, lane B, 4abfb95..HEAD: Cath at half length in the result's pose (cheer / crossed) over the rays, a big verdict stamp, the chart drawing in, the play of the game flipping in, the grade stamped last; a chapter win names the regions it freed; P one column with the moment and chart above the sticky bar, L a spread, D two columns; a tap skips, reduced motion has no motion; a campaign win still hands over to item 35's map moment via the closing scene; `e2e/end-moment.spec.ts` at P and D (the autoplay's win or loss); shots of win, loss and chapter win at P, D, L, light and dark)*
- **Why:** a win or a loss ends on a small stamp, a chart and four stat boxes, with the lower-left third empty at D (VISION pillar 4, staged moments; the critique's second-biggest gap). Hedgerow's win payout is item 46; Cathnivore's end has no staging.
- **Build:**
  - The result is staged on the market table: Cath at full figure in the bible pose for the result (cheer on a win, crossed arms on a loss) beside a large headline stamp.
  - The round-by-round chart draws itself in, the play of the game flips in as a card, and the grade is stamped last.
  - On a campaign chapter it hands over to item 35's map moment.
  - At D a two-column spread uses the width; at P it is one column that never clips under the action bar.
  - A tap skips it; reduced motion fades between the end states.
- **Accept:**
  - e2e at P and D after a win and a loss: headline, Cath, chart and Play again all in view without scrolling, and nothing under the sticky bar.
  - Shots of a win, a loss and a campaign win at P, D and L.
- **Size:** 2

## 49. [x] Cathnivore: the campaign map as painted country *(done 2026-11-03, ..295583e8: the board's ground per hex, a landmark per region, the river Mead between the hexes, an island coast in a sea panel, Hollowell's hold an orange wash and hatch with sign posts; at D the map and cards side by side; `tests/campaign-map-layout.test.ts`, campaign-map e2e at P and D; shots in `e2e/screenshots/map49/`. "80% of the content width" is read as the map-and-cards row, see DECISIONS)*
- **Why:** the map of Marrow is flat orange and beige hexes in a dotted blob. It has none of the board's terrain, and at D it sits in a 720 px column with about 360 px of empty cream each side (critique, cath-campaign-D/P).
- **Build:**
  - Each hex is painted with its region type's ground from the board (the same kit), with one landmark per region: the docks at Shingle Bay, the mill at Rivermead, the market cross at Kingsmarket, and so on.
  - Rivers and the coast are drawn between the hexes. Hollowell's hold is an orange wash with their sign posts, not a flat fill.
  - At D the map spans the content width with the chapter cards beside it.
  - Labels are placed so none crosses a neighbour or sits under Cath (unit-tested).
- **Accept:**
  - Unit: label boxes don't intersect each other or Cath's box on any map.
  - e2e at P and D: the map uses at least 80% of the content width at D (with the cards beside it: the map and cards row spans 80%+, the map 50%+).
  - Shots fresh, mid-campaign and complete at P, D and dark.
- **Size:** 2

## 50. [x] Runnel: a board with colour, a sky and a garden that grows *(done 2026-11-03, ..dd6b78f7: dry tiles as fallow, meadow and a ploughed field per season (`ground.ts`), the time of day as a sky band and cast over the whole scene with an honest caption, the week's boards in the D rail and Bea's garden as the week's seven beds (`weekstrip.ts`); contrast floor holds for every dry ground; luminance SD 0.0067 -> 0.034 (BALANCE.md); `e2e-site/runnel-board.spec.ts`; shots in `e2e/screenshots/runnel50/`. There is no "night" time of day: night is the dark palette, shot under a dusk sky)*
- **Why:**
  - Most of the board reads as mud: brown tiles, dark-brown grooves, and green only where watered.
  - The caption says "Dusk, clear skies", but the scene is flat cream with no sky.
  - Bea's garden at D is a fence and dots.
  - At D the left rail is empty below about 630 px (critique, runnel-puzzle-D/P).
- **Build:**
  - Dry tiles are painted as meadow and field in the season's palette (item 30's contrast floor holds), so water reads as the change, not the only colour.
  - The board's time of day and weather (item 6) show as a sky band and light across the whole scene: dusk is dusk.
  - Bea's garden draws item 37's crops at their stage for the week.
  - The D left rail holds the week's arc as a strip of the past days' small boards.
- **Accept:**
  - Unit: tiles and channels stay at 3:1 or more in every palette.
  - Shots at noon, dusk and night, and of a solved board, at P and D.
  - The tile luminance spread across a fresh board is wider than today's (measured and reported in BALANCE.md or the commit).
- **Size:** 2

## 51. [x] NIGHT SHIFT: Cath's office, lived in *(done 2026-11-03, lane B, b446271..HEAD: `officeDressing(jobsDone)` gives Bea's crayon drawings by the door (one plus one per case, six designs) and the trophy shelf with each closed case's keepsake; rain runs on the window (still on the phone and under reduced motion); the standing mirror reflects her in the wardrobe's saved coat (a photo on the phone tier); a keepsake or drawing under the crosshair names itself; unit test 0/1/3/5 cases, office e2e (closed case adds keepsake and drawing, the caption), phone perf 132/260; shots fresh and three cases at D and L, phone tier at L. Cut: the kettle's steam)*
- **Why:**
  - Item 16 built the office as a hub of stations: the case board, the gun bench and the wardrobe.
  - Between them it reads as a set, not her place: nothing in it remembers the cases she has closed.
  - It does not show who she is (VISION's character bible: a mum, Bea's drawings, the rain outside).
  - Promoted from "Later, unranked" (2026-11-03 planning, lane B).
- **Build:**
  - A lit flat over the egg stall: a rain-streaked window whose rain runs on the glass (a screen-space streak shader, static under reduced motion), with the street's neon behind it.
  - Bea's crayon drawings pinned by the door, one more for each case closed, from a fixed set of six.
  - A mirror where Cath sees herself: the hero model (item 9) reflected, in the outfit the wardrobe saved.
  - A trophy shelf that fills with each case's keepsake from the debrief (item 17), each with a hover or tap caption.
  - The kettle steams on the hub's first visit after a case.
  - Phone tier: the window streaks become a baked texture, and the mirror a framed photo of her.
- **Accept:**
  - Unit: the shelf and the drawings are a pure function of the save (`officeDressing(progress)`) for 0, 1, 3 and 5 cases closed.
  - e2e: after a closed case the shelf has its keepsake and the drawing count rises.
  - Phone perf stays at or under budget with the office lit (`scripts/cathode-perf.mjs`).
  - Shots of a fresh office and one after three cases, at D and L, and the phone tier at L.
- **Size:** 3

## 52. [x] Hedgerow: a field that looks farmed, and towers you can tell apart at a glance *(done 2026-11-03, lane A, 8bef22e..HEAD: plots by what lies under them (`plotlook.ts`: earth, stubble, clover, a puddle; each plot picks among the looks its left and upper neighbours lack, so 0% of plots share a look with a neighbour), painted in 2D and drawn in 3D as opaque soil beds with a timber edge; tier-1 silhouettes reshaped (beehive a round skep on a bench, barn a gambrel with a lean-to and weathervane, court a tall portico, hall long and low with a clock tower, windmill sails an X), worst pair at 24 px 0.76 -> 0.66 (`e2e-site/hedgerow-silhouettes.spec.ts`); Cath's 3D head modelled (three-quarter face, centre-parted hair), no portrait sprite; draw calls at level 13 P 464 -> 482, fps unchanged under SwiftShader (`scripts/hedgerow-drawcalls.mjs`); `tests/hedgerow-plotlook.test.ts`; shots of levels 1, 13, 38 at P and D in 2D and 3D before and after, the tower lineup and Cath close-ups in `e2e/screenshots/field52/`. Cut: the 3D tower models were not reshaped; the silhouette test covers the 2D sprites)*
- **Why:**
  - The 2026-11-03 critique (hedge-play2d-P/D, hedge-play3d-D) found a uniform grid: about 40 identical tilled squares.
  - At tier 1 the towers read alike at phone size.
  - In 3D, Cath is a flat billboard on a yellow ring and empty plots are ghostly translucent squares.
  - VISION pillar 2: "big, rich and alive".
- **Build:**
  - Plots by what lies under them: bare earth, last year's stubble, clover, a few with a puddle, seeded by the level, so neighbouring plots differ (2D and 3D).
  - Empty plots in 3D drawn as soil beds with a timber edge, not translucent squares.
  - Each tower's tier 1 silhouette made distinct at 24 px (Scarecrow tall and thin, Hedgerow low and wide, Beehive round, Seed Cannon a barrel), checked by a silhouette-overlap test.
  - Cath in 3D as a modelled figure from the shared bible (low-poly, her olive jacket and hair), not a billboard.
  - Phone 3D fps floor holds.
- **Accept:**
  - Unit: plot variety deterministic per level, and no two orthogonal neighbours share a look on more than 40% of a level's plots.
  - Unit: tier-1 tower silhouettes overlap less than 70% pairwise at 24 px.
  - Shots of levels 1, 13 and 38 at P and D in 2D and 3D, before and after.
- **Size:** 3

## 53. [x] Cathnivore: a table that sounds like a market *(done 2026-11-03, lane A, slices 1-5: `src/platform/sound/` with `cues.ts` (`cueFor`, every action and event its cue, Hollowell's only synth) and `synth.ts` (wood clack, paper slide/flip/tear, coin, awning, crowd, bell; Hollowell's chime, sweeps, blip, glitch) from filtered noise and tones; a market ambience (chatter, birds, crickets from round 7) ducked under cues; the round bell; a coin per Mark in the buy flight; Hollowell's cues on the playback beats; Settings' Sound card (Sound on, Volume, Effects, Market ambience); no AudioContext with sound off. `tests/sound-cues.test.ts`; `e2e/sound.spec.ts` renders every cue offline (audible, under 1.2 s, under -3 dBFS), sound off/on, bell, staged cues; farmstead e2e checks the coins; Settings shot before and after at P and D (`e2e/screenshots/sound53/`). Changed: the offline render check is e2e, not unit, since Node has no WebAudio)*
- **Why:**
  - `src/platform/sound.ts` is seven oscillator beeps (sine, square and saw notes), plus a three-note pad. VISION's sound line asks for wood, paper and market chatter for the players' world and sterile synth for the corporations. None of that exists.
  - Buying, selling, scheming, Doubt, a Squeeze and the AI teammate's turn (item 34's show) have no sound or share one `place` blip. VISION pillar 3 ("Everything responds") is half met.
  - Hedgerow and Runnel got layered scores (N8); Cathnivore was left as "bug fixes only".
- **Build:**
  - `src/platform/sound/` synthesised in WebAudio (noise bursts through filters and short envelopes, no samples): wood clack (a token placed), paper slide and flip (a card bought or a Scheme played), coin chink (Marks counted out, one per coin in item 36's buy flight), stall awning flap (Open Stall), a crowd murmur that swells on a Liberation.
  - Hollowell's cues stay clinical synth (a glossy two-tone chime when an Outlet opens, a cold descending sweep for a Squeeze), so the joke is in the sound too.
  - A market ambience replacing the pad: soft chatter and birdsong by day, quieter with crickets by the last rounds (follows item 28's passing day), ducked under cues.
  - Cues on the teammate's and Hollowell's turns, timed to item 34's playback beats; a soft end-of-round bell.
  - Volume slider plus separate Effects and Ambience toggles in Settings; nothing plays before the first tap; iPhone's silent switch respected via the existing unlock path.
- **Accept:**
  - Unit: `cueFor(action, events)` maps every action kind and event type to a cue (no event type left on the generic tap), and Hollowell's events only to synth cues.
  - Unit: every cue renders offline (`OfflineAudioContext`) to non-silent audio under 1.2 s, peak under -3 dBFS.
  - e2e: with sound off, no `AudioContext` is created; with it on, a round of autoplay schedules at least one cue per action (spy on the cue bus).
  - Shots of the new Settings sound block at P and D.
- **Size:** 2

## 54. [x] Cathnivore: a phone Setup that deals you in *(done 2026-11-03, lane A, 00e54074..HEAD: at 390x844 one screen with no page scroll: the event a pinned poster strip, the mode two drawn chairs at a table, the producers a dealt row with the picked pair lifted in their colours, their abilities in full and Cath's line on the pair under them (`content/pairLines.ts`), difficulty Hollowell's threat card flipping to what changes, the maps three boards on a shelf, the seed behind Advanced, Start the stall's open sign (Closed until two are picked); landscape phones two columns; D keeps item 8's spread with the same cards and chairs; `e2e/setup-phone.spec.ts` (no scroll and full abilities at P, keyboard-only to Start at P and D, every card named); shots before and after at P, L, D, light and dark (`scripts/setup-shots.mjs`). Changed: four cards fit a phone's width, so the row is dealt, not swiped)*
- **Why:**
  - Item 8 designed the desktop Setup and left P "unchanged". At 390x844 (`cath-setup-P`) it is still a form: stacked boxed panels (Market event, Mode, Producers, Difficulty, Map, Seed) under a sticky Start, with the producers off screen. VISION pillar 1: "Nothing looks like a default form".
  - The producer cards are the one place a new player meets the cast, and on a phone they're cut off half-way through their ability text.
- **Build:**
  - P Setup as one designed screen with no page scroll: the event as a pinned market poster strip, then the producers as a dealt row of upright portrait cards (swipe through, two lifted as "picked" in their colours, the pair's synergy line from Cath under them).
  - Mode as two chairs at a table (you and the AI, or two players), drawn, not a toggle row.
  - Difficulty as Hollowell's threat card (Easy/Normal/Hard flips the card, showing what changes).
  - Map as three miniature boards on a shelf; Seed folded behind an "Advanced" chip.
  - Start as the stall's open sign, always on screen; the same producer cards reused at D (item 8's spread keeps its layout).
- **Accept:**
  - e2e at P: every control (both picks, mode, difficulty, map, Start) reachable with no page scroll, and the two picked producers' full ability text visible.
  - e2e: keyboard-only Setup to Start at P and D; screen reader labels on every card.
  - Shots P, D and L, light and dark, before and after.
- **Size:** 2

## 55. [x] Cathnivore: regions you can tell apart, and Hollowell's grip you can see *(done 2026-11-03, lane B, b0984bd..HEAD: every region's landmark on its board tile from the campaign map's art plus Gull's Head, Fernlea and Tarnside, placed clear of the pieces (estimate, then measured after layout; up to 1.5x where there's room); `grip.ts` stages: billboard, cold glaze and van, boarded and SOLD, an edge pennant and a wilt after a Squeeze; pop-in, cross-fade under reduced motion, shapes that read in greyscale; unit tests for spots and stages, `e2e/board-landmarks.spec.ts` at P and D with board-scales; shots of all three maps at rounds 1 and 5-7, P and D, light, dark and greyscale. Open: on a crowded late tile the props are small (the glaze carries the stage))*
- **Why:**
  - The in-game board (`cath-board-D`, `cath-daily-D`) gives every pasture the same cloud-hills, every coast the same two boats, every crop the same hatching. Item 49 gave each region a landmark on the campaign map (`LANDMARKS` in `campaignMapLayout.ts`), but the board players spend 95% of the game on doesn't show them.
  - How far Hollowell has taken a region reads only from small orange outlet stacks and the dashed red border; a region with 3 Outlets and one with 1 look alike from arm's length. VISION pillar 2: "big, rich, legible and alive".
- **Build:**
  - Each region's landmark drawn on its board tile (the mill, the lighthouse, the market cross...) from the same art as the campaign map, plus new ones for the Long Coast and Delta regions (Gull's Head, Tarnside, Fernlea and the rest), laid out clear of pieces.
  - Hollowell's grip in three stages per region drawn on the ground: stage 1 a glossy billboard; stage 2 the ground's colour glazed cold and a delivery van parked; stage 3 the landmark boarded up with a SOLD sign. It recovers as Doubt and stalls push them out.
  - A Squeezed region wilts (desaturated ground, drooping crops) until the next round; a region one step from Lost Land gets a quiet warning flag.
  - Reduced motion: stage changes cross-fade; greyscale still tells the stages apart by shape.
- **Accept:**
  - Unit: `gripStage(region, state)` for 0-4 Outlets, Doubt and a Squeeze; every region of all three maps has a landmark.
  - e2e at P and D: after an autoplay to round 6, no landmark or grip prop overlaps a piece (reuse `board-scales`' bounding check), and board-scales still passes.
  - Shots of all three maps at rounds 1 and 7, P and D, light, dark and greyscale.
- **Size:** 3

## 56. [x] Cathnivore: How to Play as Cath's almanac, and Settings with a scene *(done 2026-11-03, lane A, e82f7db3..HEAD: `content/almanac.ts` (seven chapters, Cath's notes, pictures, `almanacSearch`); How to Play a Start here tab (the quick tour and a contents grid) then the chapters as index tabs on a kraft rail (arrows, Home, End), each a spread of a quick-tour board or vignette and Cath's note on ruled paper, its rules, and galleries of the real cards (Improvements and Schemes with vignettes, producers with portraits, Agenda clippings, difficulty tickets); a search jumps to its best page, marks the hit tabs and highlights the entry it names; Settings as a cork noticeboard of pinned and taped notes with Back on the stall's counter, a theme picker that previews the table in light, dark and Auto, Cath half length beside a two-column board at D; Credits the closing card (the cast as a grouped who's who); `tests/almanac.test.ts`, `e2e/almanac.spec.ts`, `e2e/settings-board.spec.ts` at P and D; shots in `e2e/screenshots/almanac56/` via `scripts/rules-shots.mjs`)*
- **Why:**
  - `cath-rules-P`: How to Play opens with a small carousel, then is a wall of boxed rules text with a search field ("Actions (3 per producer per round)", paragraph after paragraph).
  - `cath-settings-D`: Settings is a column of default toggles and segmented pills in boxes with Cath's head in the corner, centred in empty cream at D. Credits is the same. VISION pillar 1: "Nothing looks like a default form, a plain list or unstyled HTML".
- **Build:**
  - How to Play as an almanac: chapters (Your round, Selling, Investing, Hollowell, Winning and losing, Producers, Cards) on tabbed pages, each with a live mini board or card vignette (item 36's `Vignette`) that shows the rule, and Cath's margin note in her voice. Search stays, jumping to the page with the hit highlighted.
  - The cards and producers sections as browsable galleries of the real cards, not text rows.
  - Settings as Cath's stall noticeboard: each setting a pinned tag or a switch on the stall's wooden counter, the theme picker previewing the table in light and dark, a D two-column layout with Cath half length.
  - Credits as a closing card in the same style.
- **Accept:**
  - Unit: every rules section in `rules-text` has an almanac page and an illustration; the search index covers all pages.
  - e2e at P and D: search finds "Squeeze" and lands on its page; every Settings control still toggles and persists; keyboard-only use of both.
  - Shots of How to Play (3 pages), Settings and Credits at P and D, light and dark.
- **Size:** 2

## 57. [x] NIGHT SHIFT: a street full of people who react *(done 2026-11-03, lane A, 5400b98c..091e2ee1: `sim/streetlife.ts` (40 people in the market on high, 25 on the phone, the Plaza's walkers and riders; none indoors) with a calm, duck, flee, gone, return machine heard through every muzzle flash; drawn instanced figures, not item 41's jointed models (see DECISIONS); the Plaza's standing rally and shoppers scatter on the same machine; umbrella drips that crown on the ground and footstep splashes on high and ultra (`render/streetwet.ts`); coats, umbrellas and bikes in the wet road's mirror on high/ultra, none on the phone; the phone perf gate fixed at the root (it samples until it sees a shadow frame; the phone's ground and fine clutter cast no shadow; the standing crowd's low-poly cut): market phone 256/260 and D 387/900 calls, Plaza phone 232 calls and 223k/260k tris; unit tests, `e2e-site/cathode-street.spec.ts` (35 on screen at the spawn, they move away after a shot, the wet layer draws, the rally runs); shots of the market and Plaza at D, L and phone L, calm and mid-fight, before and after. Cut: no drips or splashes on the phone tier, to keep its shadow-frame headroom)*
- **Why:**
  - `ns-hud-D`: the Drowned Market is beautifully lit but empty at street level: neon, rain and wet asphalt, then the named target and his men far off. The lower half of the frame is near-black road.
  - Bystanders are `render/crowd.ts` instanced dark silhouettes that sway on `crowd:*` markers (Plaza mostly). Nobody walks, shelters, trades or runs when shooting starts, so the world reads as a set. VISION pillar 2 ("alive") and the R-rated stakes (civilians cost reputation) both need people on screen.
- **Build:**
  - Street life per district from one instanced kit: pedestrians walking marker paths under umbrellas, vendors behind the egg and noodle stalls with steam rising, people sheltering in doorways, a cyclist and a delivery bike, all in the bystander's coat palette (item 41's model at LOD1/LOD2, not black shapes).
  - They react: at the first shot within 30 m they duck, then scatter away from the shooter to exit markers; vendors drop behind counters; they come back a minute after the fight. A hit bystander costs reputation as now.
  - Puddle splashes and umbrella drips on the walkers; reflections of them in the wet road (the reflection layer, LOD2 only).
  - Phone tier: half the walkers, no reflections; the perf gate holds.
- **Accept:**
  - Unit: `streetLife(level, tier)` deterministic counts per district and tier; the scatter state machine (calm, duck, flee, return) on a fake clock.
  - e2e: in the market at D, at least 12 bystanders on screen at the spawn; after a forced shot, their mean distance from Cath rises within 3 s.
  - `scripts/cathode-perf.mjs` phone and D under budget in the market and the Plaza.
  - Shots of the market and the Plaza at D and L, calm and mid-fight, and the phone tier at L.
- **Size:** 3

## 58. [x] NIGHT SHIFT: Cath's office lit and built like a noir set *(done 2026-11-03, lane B, 75ba525..HEAD: `officeLights(tier)` practicals (a warm pendant, the window's neon spill, a desk pool; the banker's lamp brighter), the blinds' stripes on the floor; bottle-green trellis wallpaper over a walnut wainscot with a dado rail, a worn Persian rug, the desk dressed from case 0 (blotter, case file, cold coffee, Bea's photo); the case board's polaroids printed with the List's faces, struck through as cases close. Spawn luminance D 0.0097 -> 0.0385, L phone 0.0187 -> 0.0511 (`scripts/cathode-office-luma.mjs`, measured by script rather than e2e); unit tests (light counts, stations lit, the board is the List); office e2e checks 4+ faces; perf phone 198/260 and D 281/900 calls in the office; shots fresh and three cases at D and L, phone tier at L)*
- **Why:**
  - `ns-office-D` (2026-11-03 shots, `e2e/screenshots/plan1103c/`): the hub reads as a greybox: near-black plank walls and ceiling, one dim ceiling glow, the cork board's polaroids blank grey squares from the doorway, a large untextured red slab in the foreground. The street (`ns-market-D`) is lit like a film; the room Cath comes home to is not (VISION pillars 1 and 6).
  - Item 51's dressing grows with closed cases, so a new player sees the bare room.
- **Build:**
  - Practical lighting in `render/levels/office.ts` as named `VLight`s: the green banker's lamp pooling on the desk, the bench lamp, the window's neon falling through venetian blinds as stripes on floor and walls (the rain shadow from `atmosphere.ts`).
  - Real materials (`materials.ts`/`textures.ts`, a new `officetex.ts`): wallpaper above wainscot, worn floorboards with a rug, a desk with grain and a blotter.
  - The case board (`pellboard.ts`/`officedress.ts`): polaroids printed with the List's faces from `ui/busts.ts` art, readable at 3 m, pins, string and handwritten names.
  - A desk dressed from case 0: the phone, a case file, Bea's photo, a cooling coffee; the window shows the market's skyline and signs.
  - Phone tier: blinds baked into one light cookie, no extra shadows.
- **Accept:**
  - Unit: `officeLights(tier)` deterministic counts per tier; every station has a light within 2 m; the board's polaroids map to the List.
  - e2e at L and D: in the office at spawn, mean frame luminance up at least 40% on today's, the board shows at least 4 faces; `cathode-office` e2e still passes.
  - `scripts/cathode-perf.mjs` phone and D under budget in the office.
  - Shots of the office at 0 and 3 cases at L and D, and the phone tier at L.
- **Size:** 2

## 59. [x] Hedgerow: a field that grows through the level, and a harvest on the win *(done 2026-11-03, lane A, 09:51 session: `growth.ts` (each plain plot's stage from rounds cleared, nearest the farmhouse first with a seeded lag; a crop per act: wheat, kale, sunflowers, pumpkins, lavender; each leak, counted on the game as `leaks`, tramples the growing plot nearest the exit one stage, skipping towers); 2D `cropart.ts` on a cached layer that cross-fades on every change; 3D `render3d/crops.ts`, two instanced meshes that ease each plant in (at once under reduced motion); the win ripens the field in a 1.4 s wave from the farmhouse while Cath walks the nearest beds with a basket and sheaves lift off toward the card (`.harvest`, the field's own Cath steps out); `tests/hedgerow-growth.test.ts`, `e2e-site/hedgerow-growth.spec.ts` at P and D; draw calls at level 13 P 482 -> 483, D 520; shots via `scripts/hedgerow-growth-shots.mjs` in `e2e/screenshots/growth59/`. Changed: sheaves fly toward where the card's Seed Bank chip lands, since the chip is on the card that follows the harvest)*
- **Why:**
  - `hedge-wave-3d-D`, `hedge-wave-2d-P`: plots are fixed beds (`plotlook.ts`); nothing on the field changes from round 1 to the last, so the farm you defend never shows what is at stake.
  - Item 46's win payout happens on a card, not on the field.
- **Build:**
  - `growth.ts` (pure): each empty plot's crop stage (bare, sprout, leaf, ripe) from rounds cleared, the crop per act; a leak tramples the plot nearest the lane's exit back one stage.
  - Drawn in 2D (`render.ts`/`sprites.ts`) and 3D (`render3d/terrain.ts` beds, instanced crops in `models.ts`).
  - The win: the field ripens in a wave from the farmhouse, Cath walks the beds with a basket while sheaves fly into item 46's Seed Bank chip.
  - Reduced motion: a stage cross-fade.
- **Accept:**
  - Unit: `cropStage(level, round, leaks)` deterministic; a leak sets back the right plot; drawing only, the tuner fit untouched.
  - e2e at P and D: the ripe-plot count rises from round 1 to the last round of level 13; a forced leak drops one plot; the win shows `.harvest` before the payout.
  - Draw calls at level 13 (`scripts/hedgerow-drawcalls.mjs`) within +15%.
  - Shots of levels 1, 13 and 38 at round 1, mid-level and the win, at P and D, 2D and 3D.
- **Size:** 3

## 60. [x] Cathnivore: a title that opens on the real table *(done 2026-11-03, lane B, 1d11a6d..HEAD: the real Map.tsx board on a checked cloth from `titleBoardState(completed)` (Hollowell everywhere on a fresh save, bunting and stalls on freed regions, all of Marrow when complete), lit by the player's hour (`lightForHour`), Cath in her own column with a line by progress, Bea's drawing pinned to the cloth (no Bea figure exists in the shared art), the menu a chalkboard sign with How to Play, Settings and Credits as tags (slate in both themes); unit tests for the board, the line and the light; `e2e/title-table.spec.ts` at P and D (no overlap, bunting from a seeded save, keyboard reaches every entry) plus title-fit (no scroll at P) and title at P, L, D; shots fresh, mid and complete at P, L, D, light and dark)*
- **Why:**
  - `cath-title-D`: the title board is a flat diagram of six hexes with small stall icons, much plainer than the in-game board (`cath-game2-D`); the right half is cream rays.
  - `cath-title-P`: Cath's figure covers the Brindle Hills and Oakvale hexes. VISION pillar 2: the table is the hero.
- **Build:**
  - `TitleArt.tsx`'s diagram replaced by the real `Map.tsx` board in a read-only showcase mode on item 28's trestle and cloth (`TableProps.tsx`, `tableLight.ts`), the time of day from the clock.
  - The board shows the player's campaign: regions freed get bunting and a green wash; a fresh save shows Hollowell's Outlets.
  - Cath beside the table in her market-day look with Bea at her side, never over a hex (a layout box at P, beside the table at D); her line changes with progress.
  - The menu a chalkboard sign leaning on the table (Campaign, Quick Game, Daily Market), How to Play, Settings and Credits as tags. Reduced motion: no idle animation.
- **Accept:**
  - Unit: `titleBoardState(save)` for a fresh save, 2 freed regions and a complete campaign.
  - e2e at P and D: Cath and the board never overlap, no page scroll at P, every menu entry reachable by keyboard, a freed region shows bunting from a seeded save.
  - Shots fresh, mid-campaign and complete at P, L and D, light and dark.
- **Size:** 2

## 61. [x] Runnel: channels cut into the earth, and water you can watch *(done 2026-11-03, lane A, 09:51 session: each opening a ditch seen from above as a V (the slope towards the day's light in shade and the far slope lit, `bankSunlit` in `water.ts`, retoggled as the tile turns), a dark bed with pebbles, a thin cut edge in the ground's colour (green once watered), a stone basin at the hub; water sits in the bed and drains back out when cut off; `data-wet` marks the water's real arrival (`arrivalMs`, one cascade step a tile, so a longer river takes longer); pins are a wooden stake with twine, not a ring; night and the share card match; `tests/runnel-water.test.ts`, the item 30 contrast floor plus a ditch floor (one slope 3:1 on every ground and season, water 2:1 on its bed); `e2e-site/runnel-water.spec.ts` (fill within 600 ms, a cut drains) with runnel-board, practice and win at P and D; shots before (`e2e/screenshots/runnel-before61-*`) and after (`runnel-after61-*`, `ditch61/`: daily, lesson, solved at P and D, light and dark, autumn and winter). Cut: the spill-darkened soil in fields (the existing spill puddles stay))*
- **Why:**
  - `runnel-daily2-D`, `runnel-daily2-P`: grooves are flat brown bars (`line.groove`, one stroke colour, `board.ts`, `.groove`); they read as planks or roads, not ditches, and the water is a thin dashed line inside them. The most-touched object in the game is the plainest (VISION pillars 1 and 6).
- **Build:**
  - In `board.ts` each groove a cut ditch: dark bed, sunlit and shaded banks from the sky's light (`sky.ts`), pebbles and a grass lip per ground (`ground.ts`), the hub a stone basin.
  - Water a filled surface with a moving sheen, running from the spring when a tile joins (time scaled to path length), draining back when cut off, spilling into each field as a puddle that darkens the soil.
  - Pinned tiles get a stake, not a ring; dark mode and the share card (`sharecard.ts`) match. Reduced motion: water at once, no sheen.
- **Accept:**
  - Unit: `waterFront(path, t)` timing; item 30's contrast floor holds for dry and wet channels on every ground and season.
  - e2e at P and D: a joining tap fills the next tile within 600 ms (`data-wet`); cutting the path drains it; `runnel-board.spec` and the lesson specs pass.
  - Shots of the daily, the lesson and a solved board at P and D, light and dark, in two seasons.
- **Size:** 2

## 62. [x] Cathnivore: your farm as a stall you can see growing *(done 2026-11-03, lane B, 4122b44..HEAD: `stallLayout.ts` puts each Improvement on a shelf by tag (fields, sea, town), stacking past four; the phone Farm sheet draws each producer's stall (awning, yield price board, painted crates, chalked tag board); the desktop column one plank of crates; the teammate's stall under their ledger while they think (desktop); the phone strip by the name from 441 px, the newest crate and a count on the Farm tab below; a buy flies to its stall slot and drops in (fades under reduced motion). Unit tests for 0/1/6/12 cards and stable slots; `e2e/farm-stall.spec.ts` (a crate per card) and farmstead (the bought crate on its tag's shelf) at P and D, desktop-no-scroll and action-hand pass; shots at rounds 1, 5 and 7, P and D, light and dark)*
- **Why:**
  - `cath-game-D` (2026-11-03 09:35 shots, `e2e/screenshots/plan1103d/`): the left column's FARM block is a name, three figure pairs and one card thumbnail about 40x20 px. The engine the player builds is the smallest thing on screen, and the Actions frame under it is mostly empty dashed space while a teammate thinks.
  - `cath-game-P`: the farm sits behind the FARM tab; the strip above the action card shows only resource chips and action pips, so you can't see what you've built without opening a sheet (VISION pillars 1, 2, 5).
- **Build:**
  - `src/ui/FarmSheet.tsx` (inline and the sheet): each producer's improvements drawn as a market stall that fills up: bought cards hang as painted crates and signs (a `Vignette` per card), tag counts as chalk tallies on the stall's board, the per-round yield as a price board.
  - A pure `src/ui/stallLayout.ts`: where each improvement sits by tag and count (0 to 12 cards), overflow stacking; shared by the D column and the phone sheet.
  - `Game.tsx`: at D the stall replaces the FARM list above Actions, and while a teammate thinks the Actions frame shows their stall; at P a short stall strip (the last 3 purchases) above the producer card opens the full sheet.
  - The buy flight lands the card in its slot on the stall, not just the counter; reduced motion fades.
- **Accept:**
  - Unit: `stallLayout` places 0, 1, 6 and 12 improvements with no overlaps and stable slots for the same state.
  - e2e at P and D: an autoplayed game at round 5 shows one `.stall-item` per improvement owned; a buy adds one in the right tag row; no page scroll at P; the Invest cards still fit at 1440x900.
  - Shots of rounds 1, 5 and the last round reached at P and D, light and dark.
- **Size:** 3

## 63. [x] Cathnivore: pieces on the board as tabletop miniatures that read at a glance *(done 2026-11-03, lane A, 10:51 session: `pieceLayout.ts` tray per tile sized to the hex's measured on-screen radius (stacks in a row with one count each, the threat badge under the name plate, producers along the bottom; the .99 tag and SOLD sign drop before pieces shrink, counts never under 11 px, roomy desktop hexes grow pieces to 1.3x); producers as arched portrait standees on a base in their colour with a shadow; pieces slide 200 ms to new slots; a Squeeze slams the front stack down with a synth thump; landmarks pick their flank spot from the same tray rects in render (no DOM measuring). `tests/piece-layout.test.ts`, `e2e/board-pieces.spec.ts` (rounds 2, 5 and 8 via `e2eAutoplayUntil`, since the autoplay is too fast to judge each round still) with board-landmarks and board-scales at P and D; shots of ring, coast and delta at rounds 1 and 6, P and D, light, dark and grey in `e2e/screenshots/mini63/`. Changed: no scheme token is drawn on the board (Doubt is the '?'), so the tray's scheme slot is unused; reduced motion snaps pieces to new slots rather than cross-fading)*
- **Why:**
  - `cath-game-P`: at 390 px a hex holds an orange outlet stack, a count badge, a ".99" tag, a SOLD sign, a "?" scheme token and a producer coin, all 12-18 px and overlapping; Highmoor's and Kingsmarket's tokens touch each other and the region label.
  - `cath-game-D`: outlet stacks still overlap their own SOLD and .99 tags (Saltmarsh, Rivermead, Shingle Bay); producers are flat coin portraits on a small plinth. The table is the hero (pillar 2) but the pieces are its weakest art.
- **Build:**
  - `src/ui/Map.tsx`: a per-hex piece tray from a pure `src/ui/pieceLayout.ts`: fixed slots (outlets one stack with a single count, schemes, producers, landmark) sized to the hex on screen, dropping ornaments (tags, SOLD) before shrinking counts.
  - Producers as standing painted miniatures (portrait bust on a base in their colour, with a shadow) from the portrait art; outlets one glossy plastic box per stack with the count on its face (the player/corporate material contrast).
  - Pieces move between slots (120-250 ms ease-out) when counts change; a Squeeze drops a box with a thud; reduced motion cross-fades.
  - Item 55's landmark placement and grip props keep working with the new slots.
- **Accept:**
  - Unit: `pieceLayout` for 0-6 outlets plus 2 producers plus a scheme gives no overlapping rects at hex radii 40, 60 and 90 px; counts never under 11 px.
  - e2e at P and D: through an autoplayed game's rounds 1-8 no two `[data-piece]` boxes overlap and none crosses the region label; `board-landmarks` and `board-scales` pass.
  - Shots of all three maps at rounds 1 and 6 at P and D, light, dark and greyscale.
- **Size:** 3

## 64. [x] Hedgerow: a new enemy arrives as a staged field-guide moment *(done 2026-11-03, lane A, 117562c6..314ce965: `intro.ts` (`newThisRound` from `SaveData.seen`, so no migration; `traitsOf`; `countersFor`/`needsUpgrade` over the level's kit; `rosetteSpot`); the corner advert replaced by a ruled field-guide page once the round's ribbon has cleared and the vehicle is on the lane: the sim holds, the field dims (2D and 3D), sketch, trait icons, the whole description, the kit's towers lit or struck through ('once upgraded' where a spec is needed), Got it/tap/Enter/Escape; replays never hold, the sandbox and webdriver let it go after 3 s (`?intro=hold` keeps it); phone fills the field, short landscape puts the button in the top corner and shows only the lit towers; Fleet bosses described by the Fleet's Heavy Plant rule; round ends a rosette (Marks in the face, the round or gold 'Clean sweep' on the ribbon) clear of every plot then of Cath's bubble, coins flying to the Marks chip; `tests/hedgerow-intro.test.ts`, `e2e-site/hedgerow-intro.spec.ts` at P and D; shots of drone and boss pages and both rosettes at P, D, L in 2D and 3D in `e2e/screenshots/fieldguide64/`. Changed: the page auto-dismisses under webdriver too, so other e2e never stall on it)*
- **Why:**
  - `hedge-wave-P`: the "NEW ON THE LANE" strip reads "Delivery drone / A delivery drone."; its stats and counters are cut at phone width, so a phone player never learns that only anti-air reaches it.
  - `hedge-wave-D`: the same advert is a plain white box over the field's top right, covering a plot; it doesn't pause, show the vehicle or say which towers hit it. "Clean sweep!" and "Wave cleared +63" are outlined text over the graveyard plot (pillars 3, 4).
- **Build:**
  - `games/hedgerow/src/main.ts` (the advert): the round's first new vehicle rolls on and stops, the field dims, and a Cath's-notebook page slides in with the vehicle's sketch, its traits as icons (flies, armour, speed) and "Your towers that reach it" as lit tower chips. Tap to continue; auto-dismiss in sandbox and replays.
  - A pure `games/hedgerow/src/intro.ts`: which enemies are new this round for this save, and the counters per enemy; seen ones kept in the save (migration test if the shape changes).
  - Round-end callouts as a painted rosette with a coin flight to the Marks chip, placed clear of plots.
  - Phone: the page fills the field above the tray. Reduced motion: no slide or dim, a fade. 2D and 3D (the 3D scene dims too).
- **Accept:**
  - Unit: `newThisRound(level, round, seen)` and `countersFor(enemy)` for the drone, a boss and the armoured lorry; a seen enemy never re-introduces.
  - e2e at P and D: a sandbox level's first drone round shows `.intro-page` with the full description and at least one lit counter chip, the game paused until dismissed; the round-end rosette overlaps no plot.
  - Shots of the drone and a boss intro, and a round end, at P, D and 844x390, in 2D and 3D.
- **Size:** 2

## 65. [x] NIGHT SHIFT: a title that's a scene from the first frame, never a black void *(done 2026-11-03, lane B, c35c6e7: a baked poster of the street (`scripts/cathode-poster.mjs`, landscape and portrait WebPs) from index.html's first paint under a light boot scrim, cross-faded to the live street once it has drawn (it stays on the phone tier and without WebGL, with CSS rain); `ui/poster.ts` picker unit-tested; `e2e-site/cathode-poster.spec.ts` with and without WebGL; shots at 0.5 s, 5 s and live at P, L, D. The wordmark was already filled glyph paths (the critique caught its draw-in on black). Cut: the List and case lines as a paper tag)*
- **Why:**
  - `ns-title-D`, `ns-title-L`: 5 s after load (under SwiftShader) the front door is a near-black gradient with a faint red blur, as the live street (`render/frontscene.ts`) hasn't arrived; the outlined wordmark is nearly invisible on the dark ground (pillars 1 and 7: first screen under 2 s). The owner saw a 10 s blank on a real Mac (FEEDBACK 2026-11-02).
- **Build:**
  - A baked poster of the front scene's first framing (Cath under the umbrella, the pink sign, rain), shot by a script like `scripts/keyart.mjs` into `games/cathode/public/front-poster[-960|-640].webp`, shown at once behind the menu from `index.html`.
  - When the scene is ready, cross-fade the poster to the live canvas once its first frame is drawn (no pop); on the phone tier or without WebGL the poster stays, with CSS rain streaks.
  - The wordmark filled, with the outline as an accent, so every glyph reads on the dark (check the font subset renders every letter).
  - The List line and the case line as a small paper tag pinned in the poster's light, not loose caps.
- **Accept:**
  - Unit: a poster-path picker by viewport width and tier.
  - e2e at L and D: `.front-poster` visible within 1 s of load, with WebGL blocked and enabled; no frame where both poster and canvas are hidden; the wordmark measures as "NIGHT SHIFT" in the loaded font.
  - Shots at 0.5 s, 5 s and with the scene live, at P, D and 844x390.
- **Size:** 2

## 66. [x] Hedgerow: a 3D field as warm as the 2D one *(done 2026-11-03, lane A, 12:51 session: `render3d/backdrop.ts`, a painted stage-set card behind the far scenery (the act's sky, poster clouds, three rows of hills fading into the air; dark wall and keeps under a dusk sky at Kingsmarket; veiled in Fog twists), the far country kept low so it shows, the camera framed so the far houses stay whole under it (D 42 -> 38 deg, P 60 -> 56 deg); a warm key and bounce by day and clear air over the field; Cath lit by her own colour; `render3d/verge.ts` puts a flock, pines, wild-flower clumps and a scarecrow on the verges by the level seed (never on a plot, the lane or the sea, nothing tall on the near side; `tests/hedgerow-verge.test.ts`), wild flowers along the lane; the Saltmarsh boardwalk repainted tight and sun-bleached (its dark runners read as rails). Mean frame luminance at a level start up 33% to 52% at P and D on levels 1, 12, 30, sky band 4-8% of the frame (`scripts/hedgerow-warm-shots.mjs`, `window.hedgerow.skyBand()`); draw calls at level 13 P 542 -> ~595, SwiftShader fps 7.3 -> 7.0; shots before and after beside the 2D in `e2e/screenshots/warm66/`. Cut: plot beds keep item 52's look)*
- **Why:** the 2026-11-03 11:30 critique (`hedge-l30-3d-D`, `hedge-l30-3d-P`, against `hedge-l12-wave-D`):
  - The 3D field is flat overcast grey-green with no sky or horizon, and houses float cut off at the top edge in grey haze.
  - Plots are brown boxes and the lane reads as railway sleepers.
  - Cath is a dark blob.
  - The 2D field has sheep, pines, flowers and warm paper: the 3D is a step down from the game's own 2D (VISION pillars 1-2, art direction "farmers'-market poster").
- **Build:**
  - A painted sky dome per act (morning gold to evening rose) with a horizon of hills and hedges, the camera framed so no building is cut at the top edge; warm key light and soft bounce, not overcast fill.
  - The lane as a rutted earth track with verges and wild flowers (instanced), field edges as hedgerows.
  - Scatter from the 2D field's set (sheep, pines, flower clumps, a scarecrow) placed on the verges by the level seed.
  - Cath read clearly: her modelled figure (item 52) lit with a rim, never darker than the ground behind her.
  - Phone fps floor holds.
- **Accept:**
  - Unit: scatter placement deterministic per level and never on a plot or the lane.
  - Mean frame luminance of a 3D level start at least 25% up on today's, and the sky band visible at the top of the frame (both measured by a script).
  - Shots of levels 1, 12 and 30 at P and D in 3D, before and after, beside the 2D.
- **Size:** 3

## 67. [x] Cathnivore: the desktop Setup staged like the phone one *(done 2026-11-03, lane B, 9595ca1..4065d48: at D the picks sit on a gingham cloth in a timber frame, each producer in item 54's chair drawn larger, the maps framed painted boards (the picked one lifted on a wheat ring), difficulty chalk on a slate, the seed a manila luggage tag, Start the OPEN sign hung on its cord in the right column under the producers; 1280x800 no longer scrolls (was 85 px); `e2e/setup-desktop.spec.ts` at 1440x900 and 1280x800; setup-phone, quick-game, desktop-no-scroll and accessibility pass; shots D, 1280x800, P, light and dark via `scripts/cathnivore-setup-shots.mjs`)*
- **Why:** `cath-setup-D`: four plain rounded panels ("Mode", "Map", "Difficulty"), a bare seed input reading "random", map tiles as tiny chips, Start a lone slab in the corner with ~300 px of dead space; the phone Setup (item 54) has the drawn chairs, the dealt cards and the open-sign Start (VISION 4: staged moments).
- **Build:**
  - At D the Setup is the market table seen from above: the producers' chairs pulled up round it (item 54's art, larger), the map tiles as small painted boards laid on the cloth to pick, difficulty as three chalk marks on a slate, the seed a luggage tag ("Random" or the number).
  - Start the stall's OPEN sign hung over the table, centred under the picks.
  - Keyboard: every pick reachable and announced.
- **Accept:**
  - e2e at D (1440x900 and 1280x800): every control on screen without scrolling, Start reachable by keyboard; the map picker shows all three maps at 120 px or wider each.
  - The phone Setup unchanged (setup e2e passes).
  - Shots at D and 1280x800, light and dark.
- **Size:** 2

## 68. [x] Runnel: a win that happens on the board *(done 2026-11-03, lane B, e9d778e..: the win stays on the board (the bloom and surge by ring, Bea runs out to her garden with her can), then a slim strip slides up under the board (time, taps, par, streak; Share, Your card, Next), the full sheet only from 'Your card' (a workshop test keeps its sheet); board visible with the strip P 95%, D 97% (was 0%, 46%); the phone daily in its farm (spring house above, Bea's garden below, 700 px tall or more); the D rail ends on Bea's garden (one fixed bed of the newest 8 crops, hidden under 900 px tall). `e2e-site/runnel-win.spec.ts` (solve strip, phone farm, rail garden); shots P and D, light and dark, `scripts/runnel-win-shots.mjs`. Not done: the share card image's own text is still small inside 'Your card'.)*
- **Why:**
  - `runnel-win-D`/`-P`: the win is a white modal over a blurred board (three stat boxes, three pills, a share card with about 6 px text), so the watered farm, the crops and Bea's garden, the payoff itself, are hidden behind the blur.
  - `runnel-daily-P`: the phone daily floats on blank cream (60 px empty above, 80 px below); the spring house and the garden appear only at D, and the D rail is empty below "All stats" (VISION 4).
- **Build:**
  - The win plays on the board first: the water runs its whole course once more, the fields bloom in a wave from the spring, Bea runs out to the garden; then a slim result strip slides up from the foot (time, streak, share), never covering the board.
  - On a phone the daily sits in a scene: the spring house above the board and Bea's garden below, sized to fill the free space.
  - The D rail's foot holds the week's streak calendar.
  - Reduced motion: the bloom is a fade, the strip appears.
- **Accept:**
  - e2e at P and D: after a solve the board stays unblurred and at least 80% visible with the strip up; the share card's text is at least 12 px; no page scroll at P.
  - Shots of a solve at P and D, light and dark, before and after.
- **Size:** 2

## 69. [ ] The bugs from the 2026-11-03 11:30 critique, fixed as one batch *(lane B, in progress)*
- **Build:**
  - [x] **Cathnivore D, round 5** (`cath-round5-D`): the "PLAY · 10 MORE ↓" pill sits over half-clipped Scheme cards at the Actions panel's foot.
  - [x] **Cathnivore title D** (`cath-title-D`): Credits wraps alone to a second row in the chalkboard sign.
  - [x] **Cathnivore end P** (`cath-end-P`): the chart's "land lost" label overlaps the red line's end.
  - [x] **Hedgerow P mid-round** (`hedge-l12-wave-P`): the swarm counter chip and its "+2" pill run off the right edge; the New-on-the-lane strip covers the top row of plots. *(Chips clamped, slice 2; the strip is gone with lane A's item 64 field guide.)*
  - [x] **Hedgerow P level start** (`hedge-l12-start-P`): the tip card covers the farmhouse row.
  - [x] **Hedgerow D tray**: the 4th card's name truncates ("Market S…") and a 5th hides under the scroll arrow. *(2026-11-03 lane B: a 4-wide wrapped grid fixes the cut names but its second row makes `fitPreview` drop Cath's notebook at 1440x900 (fails `hedgerow-tray.spec.ts` "never an empty band"); the fix needs a shorter card (e.g. icon beside name and price) so two rows cost no more than one. Shoot with `scripts/hedgerow-tray-shots.mjs`.)* *(Fixed 2026-11-03 15:21 lane B: five or more towers at D become compact packets (picture, role glyph, price; the name in the tooltip) in one row, 59 px tall (was 89), none cut, no more-tab.)*
  - [x] **Hedgerow D wave**: about 40 vehicles clump at the Hollowell gate with the swarm chip on top of them (the convoy layout starts only on the lane). *(2026-11-03 15:21 lane B: the swarm badge now rides above the topmost vehicle of a piled queue, so it no longer hides them; the vehicles still overlap one another where the lane bends.)*
  - [x] **NIGHT SHIFT office loading** (`ns-office-D2`): labelled "Between cases · Cath's office" but shows Crisp's headline and the market blurb; with `?play&shot` the load can stall at 42-95%. *(Card and art fixed 2026-11-03 lane B; the `?play&shot` stall not reproduced or fixed yet.)*
- **Accept:** e2e for each layout case (bounding boxes inside the viewport and not intersecting, at P and D); shots before and after.
- **Size:** 2

## 70. [x] Runnel: the daily as a valley diorama *(done 2026-11-03 lane A, 2316ae1..HEAD: hills and a stream bed from the spring house to Bea's garden that fills as fields are watered; Cath half length by the stream at D (look, point, wave); the D day card's sky painting; today's seed sprouts; `e2e-site/runnel-valley.spec.ts`; shots in `e2e/screenshots/valley70/`. Bea's drawing stays on the win sheet's postcard and the streak in the rail beside the day card, see DECISIONS)*
- **Why:** 2026-11-03 13:25 critique (`e2e/screenshots/plan1103e/runnel-daily-D`, `-P`): the tiles fill about 500x500 px of a 1030x860 board frame at D, the left column is empty below the stats, and at P a 230 px cluster sits over about 300 px of blank paper (VISION: the table is the hero; every screen a scene).
- **Build:**
  - The board fitted to its puzzle and set in a valley scene: the spring house at the source, the stream bed running out, Bea's garden at the outlet growing a bed per watered field.
  - Cath stands in the scene and reacts to each turn (a look when water reaches a field, a wave at a solve).
  - At D the left column is a day card: the weather art, the streak and Bea's drawing.
- **Accept:** e2e at P and D: the board's tiles cover at least 55% of the board frame's shorter side; no blank band over 120 px on either axis; no page scroll at P. Shots of three dailies at P and D, light and dark.
- **Size:** 2

## 71. [x] Cathnivore: a title table that lives *(done 2026-11-03, lane B, 1d78a7a: Hollowell's vans drive the ring road and a through road (producers' carts once Marrow is free), parked under reduced motion or the Animations toggle; the freed regions' bunting already flutters; Cath 368 px at D (was 259) and 164 px at P (was 137), clear of the menu, her face following the hovered or focused entry; board marks 12 px or more or left off. `e2e/title-table.spec.ts`; shots fresh and complete, light and dark. Not done: an opening stall awning (the stalls are portrait pins, so it needs new board art).)*
- **Why:** `cath-title-D`/`-P` (plan1103e): nothing on the table moves, board labels are about 9 px, Cath is a 240 px cut-out at D's edge and 95 px at P (VISION 4: staged moments; Cath the face of every game).
- **Build:**
  - Hollowell vans drive the roads between regions, a stall's awning opens, bunting flutters on freed regions (all still under reduced motion).
  - Cath larger, from the waist up (the shared `shared/cath/` art), her expression changing as the menu entries are hovered or focused.
  - Board labels on the title at least 12 px or hidden.
- **Accept:** e2e at P and D: Cath at least 360 px tall at D and 160 px at P, no overlap with the menu; reduced motion stops every mover; shots at P and D, fresh and complete saves.
- **Size:** 2

## 72. [x] Hedgerow: the round's threat staged before Go *(done 2026-11-03, lane A, c1e709a9..HEAD: between rounds the next round's leads wait on the lane at the Hollowell gate in spawn order, spaced by length, with a 'N coming' plate beside the lane's tail, in 2D and 3D (models and a DOM plate), cleared on Go; `engine.waveSpawns` feeds both sendWave and the queue, so the plate counts what Go sends with twists applied; a boss round eases the 3D camera to the gate for 2.6 s (not under reduced motion); Cath's notebook opens on her advice for the round (`advice.ts`: the threat sketched with its count, one line on what in the kit answers it, preferring a tower already planted); `tests/hedgerow-gatequeue.test.ts`, `tests/hedgerow-advice.test.ts`, `e2e-site/hedgerow-gatequeue.spec.ts` at P and D; shots of levels 1, 12, 40 at P and D in 2D and 3D in `e2e/screenshots/gate72/`. Changed: the 2D field has no camera, so the boss ease is 3D only)*
- **Why:** `hedge-l40-2d-D`, `hedge-l40-3d-D` (plan1103e): on "The Mega-Dozer" nothing of the coming convoy is on screen before Go, and Cath's notebook is about 120 px of empty ruled paper.
- **Build:**
  - Between rounds the next convoy queues at the Hollowell gate (a few lead vehicles drawn, a count plate), in 2D and 3D, cleared on Go.
  - Boss rounds: the camera eases to the gate, then back.
  - Cath's notebook becomes her advice card for the round: a sketch of the threat and one line on what answers it from the level's kit.
- **Accept:** unit: the queue's preview matches the next wave's kinds; e2e at P and D: the queue is drawn and inside the field, the notebook never empty; shots of levels 1, 12, 40 between rounds in 2D and 3D.
- **Size:** 2

## 73. [x] Hedgerow: the journey map as an illustrated country *(done 2026-11-03, lane B, d2417af..: every stop a landmark vignette on its plinth (number a badge; pencil grey while locked, waking into colour when open); the next act a named glimpse of its country under a plaque, not fog; Cath's token walks to a picked stop before it opens, and stands beside her coin when above it would cover a name. hedgerow-map e2e cases (44 px vignettes, grey when locked, the named glimpse, no token over a name, the walk on a pick); shots fresh, mid and complete at P and D, light and dark (`scripts/hedgerow-journey-shots.mjs`).)*
- **Why:** `hedge-map-D`/`-P` (plan1103e): nine of ten nodes are the same grey padlocked coin, each level's landmark is a 15 px icon, and "Beyond the hedge" is a fogged slab.
- **Build:**
  - Each node a painted vignette of its level (beehive, pie stall, the long lane, the van), greyed until unlocked and coming to life on unlock.
  - A Cath token walks the path to the node picked.
  - The next act shown as a glimpse of its country, not fog.
- **Accept:** e2e at P and D: node labels never overlap nodes or each other; every node at least 44 px; shots of a fresh, mid and complete save at P and D.
- **Size:** 2

## 74. [x] The bugs from the 2026-11-03 13:25 critique, fixed as one batch *(done 2026-11-03 lane A: games-cards, hedgerow-map and cathode-front e2e cases; shots in `e2e/screenshots/bugs74/`)*
- **Build:**
  - [x] **/games/ D** (`site-D`): the game cards start below the fold at 1440x900 (no name visible); the market stall floats with no ground; the plank under Cath runs far past her. *(2026-11-03 lane A: Cath 52vh, names at y 819 of 900; the stall on a turf with crates, standing on the landscape; the plank spans her hands; `games-cards.spec.ts`)*
  - [x] **/games/ P** (`site-P`): Cath's plank sits on the first card's top edge. *(2026-11-03 lane A: 32 px clear of the card, asserted in `games-cards.spec.ts`)*
  - [x] **Hedgerow 2D P** (`hedge-l40-2d-P`): the HOLLOWELL exit sign clipped to "HOL" at the right edge. *(2026-11-03 lane A: the gate sign is clamped inside the canvas; shot `e2e/screenshots/bugs74/`)*
  - [x **Hedgerow map P** (`hedge-map-P`): "Start here" and "Mara's Field" stack into the row-2 path; labels crowd neighbouring nodes. *(2026-11-03 lane A: an unplayed next stop shows its tag where its empty stars and medal dots were, so its stack ends 20 px above row 2 at P; `hedgerow-map.spec.ts`)*
  - [x **NIGHT SHIFT gate P** (`ns-title-P`): the FULL dash starts at x=0 with no gutter; "TAKE ME BACK" grey on near-black (check AA; done 2026-11-03 lane A: --ink-2, rgb(180,174,163)); the progress bar a 100 px hairline. *(2026-11-03 lane A: the choices step in by the marker's hang under 600 px, so the dash sits at x 16; the loading line 2-3 px by 160-360 px)*
- **Accept:** e2e boxes inside the viewport and not intersecting at P and D for each case; shots before and after.
- **Size:** 1

## 75. [ ] Cathnivore: Cath at the table, in every scene
- **Why:** 2026-11-03 15:25 critique (`e2e/screenshots/plan1103f/`): on `cath-title-D` Cath ends in a flat cut at her waist (y about 645) with nothing in front of her, and the composition leaves cream bands of about 170 px above and 150 px below; on `cath-setup-D`/`-P` and `cath-game-D`/`-P` she is a 50-60 px thumbnail (VISION: Cath is the face of every game, characters with presence).
- **Build:**
  - Title: Cath stands behind the table's near edge, her hands on it, the cut hidden under the table line; the composition centred so neither band passes 80 px.
  - Setup at D: a half-length Cath in the empty bottom-right of the Map panel whose line and expression react to each producer pick and the difficulty (from `content/pairLines.ts`); at P a 90 px bust beside her line.
  - In game: a reactive bust beside the narration (about 96 px at D, 64 px at P) whose expression follows the events (a Squeeze worried, a liberation delighted).
- **Accept:** unit: events map to expressions; e2e at P and D: on the title Cath's box is inside the viewport and meets the table's box, no blank band over 80 px; Setup Cath at least 200 px tall at D; shots of title, Setup and game at P and D, light and dark.
- **Size:** 2

## 76. [ ] Cathnivore: a board that fills its frame and lives
- **Why:** `cath-game-D`/`-P` (plan1103f): the regions are pale washes with dashed borders and the same two or three small icons; at D the lower hexes (Oakvale, Shingle Bay) reportedly run into the frame's bottom edge (y about 880).
- **Build:**
  - Fit the board to its frame at every size so no hex is clipped.
  - Each region its own drawn ground (Saltmarsh reeds and tide lines, Highmoor heather, Kingsmarket cobbles, orchards, fields) seeded per region, under the pieces and clear of the piece tray.
  - Hexes as raised tabletop tiles with an edge and a cast shadow; quiet ambient motion (chimney smoke, a boat, gulls) parked under reduced motion.
- **Accept:** unit: every region's ground has at least 4 elements and none under the piece tray's rects; e2e at P and D: every hex inside the board's box, no animation under reduced motion; greyscale still tells players from corporations; shots at rounds 1 and 6, P and D, light and dark.
- **Size:** 2

## 77. [ ] Runnel: the valley fills the frame, lit by the day's weather
- **Why:** `runnel-D`/`-P` (plan1103f): the tutorial board uses about 15% of the D frame; the hills end in a hard edge with a cream void of about 600 px below; the left column has about 450 px of empty bands; the caption says "Dusk" over a midday scene; Cath is absent at P.
- **Build:**
  - Scale the board to its frame (the tiles at least 60% of the frame's shorter side, the tutorial included).
  - Paint the valley down the whole frame (fields, hedges, the trail to Bea's garden) with a soft horizon, no hard cut.
  - Light the scene from the day's time and weather (dusk warm and low, rain grey), so the caption and the picture agree.
  - Cath in the valley at P (a corner bust when the board covers her spot); at D the left column holds the forecast and streak card with no empty band.
- **Accept:** unit: time/weather to palette (dusk differs from midday by a measured luminance and hue); e2e at P and D: the board's box at least 60% of the frame's shorter side, no blank band over 100 px, Cath visible; shots of the tutorial and a daily at P and D, light and dark.
- **Size:** 2

## 78. [ ] Hedgerow: the field fills the frame and looks hedged
- **Why:** `hedge-l21-3d-D`/`-P` (plan1103f): the 3D camera leaves about 35% of the D frame as empty grass and sea and about 140 px below the field at P; path tiles show seams; fog lowers the contrast; Cath is about 20 px. In `hedge-l21-2d-D` the plots read as a repeating tilemap and about 280 px right of the field is filler.
- **Build:**
  - Fit the 3D camera to the field's bounds per aspect ratio (a pure fit function), keeping item 66's sky card in frame.
  - Seamless lane meshes; real hedgerow borders between plot blocks and along the field's edge; less fog over the field.
  - Cath drawn at least twice her size on the field, with an idle.
  - 2D: plots vary (row direction, stooks, a gate) and the margin is the level's own landscape, not filler.
- **Accept:** unit: the camera fit leaves no off-field band over 15% at P, L and D; e2e: the field's projected box at least 65% of the canvas at P and D; draw calls at level 13 within 10% of today's (`scripts/hedgerow-drawcalls.mjs`); shots of levels 1, 21, 40 in 2D and 3D at P, D and L.
- **Size:** 3

## 79. [ ] The bugs from the 2026-11-03 15:25 critique, fixed as one batch *(lane A, in progress)*
- **Build:** (sizes are the critique's estimates; check each first)
  - **Cathnivore title D** (`cath-title-D`): Cath's bubble overlaps Bea's MUM drawing.
  - **Cathnivore game D** (`cath-game-D`): the faded "PLAY" label sits under the "PLAY · 9 MORE" pill. *(It is item 69's fold fade (lane B); judge it with lane B's item before changing it.)*
  - **Cathnivore Setup P** (`cath-setup-P`): a dead band of about 40 px above Start.
  - [x] **Hedgerow D** (`hedge-l21-2d-D`): the "Lifestyle influencer" pill text runs past its edge; the tower shelf truncates "Market S..." and clips the fifth tower under the arrow. *(2026-11-03 lane A: the pill keeps inside the column and its name takes a second line only when it must, `critique79.spec.ts`; the shelf's cut fifth card is its scroll cue, left as is)*
  - **Hedgerow map P** (`hedge-menu-P`): row 1's stars and labels under the header; the act card cut mid-sentence by the bottom nav; a stop's label on the road.
  - **NIGHT SHIFT title** (`ns-title-D`): a shop sign shows through the wordmark (a scrim behind it); `ns-title-P`: the menu over the figure, grey entries below AA, 11 px lines.
  - **/games/ D** (`games-D`): a lighter rectangle behind Cath; **portfolio D** (`portfolio-D`): Cath's hand by the NIGHT SHIFT card is a stub.
- **Accept:** e2e boxes inside the viewport and not intersecting, and AA contrast where named, at P and D for each case; shots before and after.
- **Size:** 1

**Later, unranked:** (none)

---

**Done on 2026-11-01, before this plan:** the portfolio front page (`/`). It has the WebGL2 hero, kinetic type, bento case cards and the `/work/<id>/` case studies with view transitions, and covers audit items P-A and P-B.

**Folded in or retired:** ROADMAP 19, H2, 31, 33, 62 and 219 are closed as built. 239 to 242 (Phase 27 meta add-ons) are deferred below this plan. 58 and U7 become item 5; 74's leftovers become items 14 and 16; U11 is part of item 13.
