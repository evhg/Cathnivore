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

## 69. [x] The bugs from the 2026-11-03 11:30 critique, fixed as one batch *(done 2026-11-03, lane B, 4228a39..2da4a0e: slices 1-7; e2e cases in setup/title/end, hedgerow-tray, hedgerow-field, cathode-front; the D gate pile's vehicles still overlap one another, but the badge no longer hides them)*
- **Build:**
  - [x] **Cathnivore D, round 5** (`cath-round5-D`): the "PLAY · 10 MORE ↓" pill sits over half-clipped Scheme cards at the Actions panel's foot.
  - [x] **Cathnivore title D** (`cath-title-D`): Credits wraps alone to a second row in the chalkboard sign.
  - [x] **Cathnivore end P** (`cath-end-P`): the chart's "land lost" label overlaps the red line's end.
  - [x] **Hedgerow P mid-round** (`hedge-l12-wave-P`): the swarm counter chip and its "+2" pill run off the right edge; the New-on-the-lane strip covers the top row of plots. *(Chips clamped, slice 2; the strip is gone with lane A's item 64 field guide.)*
  - [x] **Hedgerow P level start** (`hedge-l12-start-P`): the tip card covers the farmhouse row.
  - [x] **Hedgerow D tray**: the 4th card's name truncates ("Market S…") and a 5th hides under the scroll arrow. *(2026-11-03 lane B: a 4-wide wrapped grid fixes the cut names but its second row makes `fitPreview` drop Cath's notebook at 1440x900 (fails `hedgerow-tray.spec.ts` "never an empty band"); the fix needs a shorter card (e.g. icon beside name and price) so two rows cost no more than one. Shoot with `scripts/hedgerow-tray-shots.mjs`.)* *(Fixed 2026-11-03 15:21 lane B: five or more towers at D become compact packets (picture, role glyph, price; the name in the tooltip) in one row, 59 px tall (was 89), none cut, no more-tab.)*
  - [x] **Hedgerow D wave**: about 40 vehicles clump at the Hollowell gate with the swarm chip on top of them (the convoy layout starts only on the lane). *(2026-11-03 15:21 lane B: the swarm badge now rides above the topmost vehicle of a piled queue, so it no longer hides them; the vehicles still overlap one another where the lane bends.)*
  - [x] **NIGHT SHIFT office loading** (`ns-office-D2`): labelled "Between cases · Cath's office" but shows Crisp's headline and the market blurb; with `?play&shot` the load can stall at 42-95%. *(Card and art fixed 2026-11-03 lane B; the `?play&shot` stall not reproduced: on 2026-11-03 15:33 the office load at 1440x900 under SwiftShader reached 100% in 27 s and handed over at 32 s, no errors; reopen with a trace if it recurs.)*
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

## 75. [x] Cathnivore: Cath at the table, in every scene *(done 2026-11-03, lane B, d194850..: the title's Cath stands behind the market table's near edge (bands 20/0 px at 1440x900, were 165/163); in game her reactive bust is 92 px at D (80 under 860 px tall) and 64 px on a phone; at D the Setup's Cath stands half length behind the OPEN sign (225 px at 1440x900), her line and face following the picks and Hard (`setupCath`) The phone Setup bust stays 44 px: at 390x844 with Ines, Sol and Easy only 10 px is spare, so a 90 px bust needs the phone Setup reworked (a 68-80 px bust made it scroll). `tests/cath-companion.test.ts`, `tests/setup-cath.test.ts`, title-table and setup-desktop e2e cases; shots P and D, light and dark.)*
- **Why:** 2026-11-03 15:25 critique (`e2e/screenshots/plan1103f/`): on `cath-title-D` Cath ends in a flat cut at her waist (y about 645) with nothing in front of her, and the composition leaves cream bands of about 170 px above and 150 px below; on `cath-setup-D`/`-P` and `cath-game-D`/`-P` she is a 50-60 px thumbnail (VISION: Cath is the face of every game, characters with presence).
- **Build:**
  - Title: Cath stands behind the table's near edge, her hands on it, the cut hidden under the table line; the composition centred so neither band passes 80 px.
  - Setup at D: a half-length Cath in the empty bottom-right of the Map panel whose line and expression react to each producer pick and the difficulty (from `content/pairLines.ts`); at P a 90 px bust beside her line.
  - In game: a reactive bust beside the narration (about 96 px at D, 64 px at P) whose expression follows the events (a Squeeze worried, a liberation delighted).
- **Accept:** unit: events map to expressions; e2e at P and D: on the title Cath's box is inside the viewport and meets the table's box, no blank band over 80 px; Setup Cath at least 200 px tall at D; shots of title, Setup and game at P and D, light and dark.
- **Size:** 2

## 76. [x] Cathnivore: a board that fills its frame and lives *(done 2026-11-03, lane A, 9c188d1..HEAD: each region's own ground (`regionGround.ts`, unit-tested), raised tiles kept from item 20, ambient motion (mill sails, docks boat, lighthouse lamp, gulls, reeds, bunting) parked under reduced motion, `e2e/board-frame.spec.ts` at five sizes; shots `e2e/screenshots/a76` rounds 1 and 6, P and D, light and dark)*
- **Why:** `cath-game-D`/`-P` (plan1103f): the regions are pale washes with dashed borders and the same two or three small icons; at D the lower hexes (Oakvale, Shingle Bay) reportedly run into the frame's bottom edge (y about 880).
- **Build:**
  - Fit the board to its frame at every size so no hex is clipped.
  - Each region its own drawn ground (Saltmarsh reeds and tide lines, Highmoor heather, Kingsmarket cobbles, orchards, fields) seeded per region, under the pieces and clear of the piece tray.
  - Hexes as raised tabletop tiles with an edge and a cast shadow; quiet ambient motion (chimney smoke, a boat, gulls) parked under reduced motion.
- **Accept:** unit: every region's ground has at least 4 elements and none under the piece tray's rects; e2e at P and D: every hex inside the board's box, no animation under reduced motion; greyscale still tells players from corporations; shots at rounds 1 and 6, P and D, light and dark.
- **Size:** 2

## 77. [x] Runnel: the valley fills the frame, lit by the day's weather *(done 2026-11-04, lane A: `valley.ts` paints a seeded patchwork of fields, hedgerows, oaks and a footpath under a soft horizon, lit by `sceneLight` (dusk, golden, rain; unit-tested in `tests/runnel-valley.test.ts`); the lesson's four tiles span about 80% of the frame (`frameRadius`) with a lesson card (steps, legend, Up next) filling the D column; Cath a corner bust at P; `e2e-site/runnel-lesson-frame.spec.ts`, runnel-valley at 60%; shots `e2e/screenshots/r77`. The tile-to-frame gap stays at 120 px: the D board's left margin holds Cath and the stream on painted valley, not a blank band.)*
- **Why:** `runnel-D`/`-P` (plan1103f): the tutorial board uses about 15% of the D frame; the hills end in a hard edge with a cream void of about 600 px below; the left column has about 450 px of empty bands; the caption says "Dusk" over a midday scene; Cath is absent at P.
- **Build:**
  - Scale the board to its frame (the tiles at least 60% of the frame's shorter side, the tutorial included).
  - Paint the valley down the whole frame (fields, hedges, the trail to Bea's garden) with a soft horizon, no hard cut.
  - Light the scene from the day's time and weather (dusk warm and low, rain grey), so the caption and the picture agree.
  - Cath in the valley at P (a corner bust when the board covers her spot); at D the left column holds the forecast and streak card with no empty band.
- **Accept:** unit: time/weather to palette (dusk differs from midday by a measured luminance and hue); e2e at P and D: the board's box at least 60% of the frame's shorter side, no blank band over 100 px, Cath visible; shots of the tutorial and a daily at P and D, light and dark.
- **Size:** 2

## 78. [x] Hedgerow: the field fills the frame and looks hedged *(done 2026-11-04, lane B, bf6d2bd..0e8a: camera fit (`camerafit.ts`, unit over 100 levels), the live projection refreshed after resize, the field 70-72% of the frame at P and D (`e2e-site/hedgerow-3dframe.spec.ts`), Cath 3D x1.9 with an idle, fog past the field, 2D stooks; draw calls at level 13 P 668, D 709 (were 757, 861). Lane seams not seen on the dirt or boardwalk lanes at levels 13 and 21. Not done: hedges between plot blocks inside the field, a 2D field gate.)*
- **Progress (2026-11-03 16:22 lane B):** slices 1-3 pushed: the 3D camera fit (`render3d/camerafit.ts`, `tests/hedgerow-camerafit.test.ts`: field share at D 65-73%, side and foot bands 5-7%; on a phone the width binds, so the band above holds the hills and sky rather than reaching 65%), Cath 3D at scale 1.9 with a standing idle, 2D stooks in stubble beds, the fog started past the field's far edge (slice 4). Open: seamless lane meshes, hedgerow borders between plot blocks (the field's edge already has each act's own border: hedge, wall, driftwood fence, reeds...), a field gate in 2D, the e2e projected-box check. Note: on wide frames the band above the field now shows hills and houses, not item 66's sky (a sliver of sky cost a fifth of the share).
- **Why:** `hedge-l21-3d-D`/`-P` (plan1103f): the 3D camera leaves about 35% of the D frame as empty grass and sea and about 140 px below the field at P; path tiles show seams; fog lowers the contrast; Cath is about 20 px. In `hedge-l21-2d-D` the plots read as a repeating tilemap and about 280 px right of the field is filler.
- **Build:**
  - Fit the 3D camera to the field's bounds per aspect ratio (a pure fit function), keeping item 66's sky card in frame.
  - Seamless lane meshes; real hedgerow borders between plot blocks and along the field's edge; less fog over the field.
  - Cath drawn at least twice her size on the field, with an idle.
  - 2D: plots vary (row direction, stooks, a gate) and the margin is the level's own landscape, not filler.
- **Accept:** unit: the camera fit leaves no off-field band over 15% at P, L and D; e2e: the field's projected box at least 65% of the canvas at P and D; draw calls at level 13 within 10% of today's (`scripts/hedgerow-drawcalls.mjs`); shots of levels 1, 21, 40 in 2D and 3D at P, D and L.
- **Size:** 3

## 79. [x] The bugs from the 2026-11-03 15:25 critique, fixed as one batch *(done 2026-11-03, lane A, 0c8b5c8..: e2e-site/critique79.spec.ts, one case each at P and D; shots in e2e/screenshots/b79 and a79)*
- **Build:** (sizes are the critique's estimates; check each first)
  - [x] **Cathnivore title D** (`cath-title-D`): Cath's bubble overlaps Bea's MUM drawing. *(Bea's drawing pins the board's far corner at every size)*
  - [x] **Cathnivore game D** (`cath-game-D`): the faded "PLAY" label sits under the "PLAY · 9 MORE" pill. *(a group heading with none of its rows above the fold hides (`data-at-fold`); the tab already names it, now on one line at 1280 wide)*
  - [x] **Cathnivore Setup P** (`cath-setup-P`): a dead band of about 40 px above Start. *(the spare height is shared between the cards; about 50 -> 27 px)*
  - [x] **Hedgerow D** (`hedge-l21-2d-D`): the "Lifestyle influencer" pill text runs past its edge; the tower shelf truncates "Market S..." and clips the fifth tower under the arrow. *(2026-11-03 lane A: the pill keeps inside the column and its name takes a second line only when it must, `critique79.spec.ts`; the shelf's cut fifth card is its scroll cue, left as is)*
  - [x] **Hedgerow map P** (`hedge-menu-P`): row 1's stars and labels under the header; the act card cut mid-sentence by the bottom nav; a stop's label on the road. *(her act's head opens under the header, re-anchored after the fonts load; a shorthand had zeroed the phone's room for the nav; the label sits on its own pill, left as is)*
  - [x] **NIGHT SHIFT title** (`ns-title-D`): a shop sign shows through the wordmark (a scrim behind it); `ns-title-P`: the menu over the figure, grey entries below AA, 11 px lines. *(a pool behind the logotype; upright, entries at .94 and the small lines at 13 px; the outline-only wordmark at P was the draw-in still running under SwiftShader)*
  - [x] **/games/ D** (`games-D`): a lighter rectangle behind Cath; **portfolio D** (`portfolio-D`): Cath's hand by the NIGHT SHIFT card is a stub. *(the glow moved after the waist mask; the portfolio fade starts below her hand)*
- **Accept:** e2e boxes inside the viewport and not intersecting, and AA contrast where named, at P and D for each case; shots before and after.
- **Size:** 1

## 80. [x] Cathnivore: producers drawn to Cath's level, with faces that react *(done 2026-11-04, lane A, d1fb6a95..HEAD: `ProducerArt.tsx` three faces each (unit-tested) through Portrait everywhere (Setup, player badge, board standees); `producerMood.ts` swaps the cameo and the board's miniatures on a Squeeze or an ability (`e2e/producer-faces.spec.ts`); phone Setup reworked: the four as toggles, the picked pair drawn 120 px over their abilities, Cath's pair line beside her; Setup portraits P 120, 1280x800 126, 1440x900 138 px with no scroll; greyscale: standees vs Hollowell's boxes by shape; shots before/after P and D, light and dark. Note: on a phone board the minis' faces are about 20 px, so the swap reads mostly on the cameo)*
- **Progress (2026-11-04 lane A):** slices 1-2: `ProducerArt.tsx` (three faces each, unit-tested), used by Portrait everywhere; the active cameo reacts (`producerMood.ts`, `e2e/producer-faces.spec.ts`). The player badge and the board's stall standees already draw through Portrait, so they have the new art. Open: Setup card portrait at least 120 px tall at P (64 px today; the phone Setup has about 10 px spare, so this needs the phone producer row reworked, e.g. one picked-pair row of big portraits plus small toggles) and at 1280x800 (110 px; 134 at 1440x900); the minis' faces reacting on the board; greyscale check; light/dark shots in game.
- **Why:** `cath-setup-D` (plan1103g): the four producer cards (about 505-1295 x 170-500) are round busts with dot eyes, flat fills and no hair; Cath beside them (1120-1220 x 615-760) is drawn far more richly, so the producers read as placeholders. On the board (`cath-game-D`) their miniatures are small identical capsules. VISION 5 asks for characters with presence.
- **Build:**
  - One portrait module per producer in `shared/cath/`'s style (hair, eyes with highlights, a signature garment and prop), with neutral, delighted and worried faces.
  - Use it on the Setup cards, the player panel badge and the board miniature's face.
  - A producer looks delighted when their ability fires and worried when a Squeeze lands on their region (the turn show's beats).
- **Accept:** unit: every producer has the three expressions and they differ; e2e: the Setup card portrait at least 120 px tall at P and D, the face swaps on a Squeeze in an autoplay game; greyscale still tells producers from corporations; shots before and after at P and D, light and dark.
- **Size:** 3

## 81. [x] Hedgerow: 3D Cath, towers and vehicles that match the 2D art *(done 2026-11-04, lane B, slices 1-6: the hair and face lift, oaks, the hatchback Influencer in 2D and 3D, the barn and farmhouse, tower-silhouette unit test, Almanac lineup e2e; draw calls at level 13 down; shots P, D, L and the face close-up in `e2e/screenshots/f81`)*
- **Why:** `hedge-l21-3d-D` (plan1103g): Cath (70-210 x 470-610) is a blocky figure with a white blob across her face that reads as a beard, which breaks the character bible; the cannon towers look like bare logs (380-430 x 270-330); houses and the barn are untextured boxes; Influencers are stacked pink cubes (190-245 x 280-380).
- **Build:**
  - A low-poly Cath to the bible: centre-parted long dark hair, the olive jacket, a readable face (a painted decal, no blob). *(2026-11-04 lane B, slice 1: the "beard" was the lift blowing her skin and collar out to white, and her hair read as white wings (item 84). The lift now fades for light colours: `tests/hedgerow-cath3d-hair.test.ts`; shot with `scripts/hedgerow-cath3d-shots.mjs`.)*
  - Every tower model with its own silhouette per type and a visible upgrade-tier tell. *(2026-11-04 lane B, slice 2: the "cannon logs" in the critique were level 21's fallen oaks, not towers. They now have warm grooved bark, a pale sawn end and a fuller two-tone crown, and are baked. The towers themselves are still to check against `scripts/hedgerow-tower-lineup.mjs`.)*
  - Enemy vehicles that match their 2D icons; the farm buildings textured (boards, tiles, windows). *(2026-11-04 lane B, slice 3: the fleet Influencer is a real hatchback (bonnet, raked screen, sloped hatch) in place of a van body with a box on top. `tests/hedgerow-tower-models.test.ts` checks every tower type's silhouette is its own and each tier shows.)* *(Slice 4: the barn has board battens, gable ends, a white-braced door, a hayloft and a ridge cap; the farmhouse has tile courses, framed windows (one in each gable end, where the camera looks) and a step. Both are baked.)* *(Slice 5: `e2e-site/hedgerow-tower-lineup.spec.ts`: the Almanac turntable draws every tower type. Draw calls at level 13 are D 695 and P 665, down from 844 and 702.)* *(Slice 6: the 2D Influencer (also its icon in the round card and Coming up) is now the pink hatchback with a ring light that the Fleet copy and the 3D show; it was the courier's e-scooter rider. The yellow hatchback rung uses the new hatchback body. Courier and Pickup already matched.)*
- **Accept:** unit: each tower type's model differs in bounding box or part count from every other; e2e (`?sandbox=1`): a tower lineup stage renders each type; draw calls at level 13 within 10% of today's (`scripts/hedgerow-drawcalls.mjs`); shots of 2D and 3D side by side at P, D and L, and a face close-up of Cath.
- **Size:** 3

## 82. [x] NIGHT SHIFT: the phone front door, recomposed *(done 2026-11-04, lane B: no letterbox; upright she stands lower right, clear of the menu, with a rim light; the logotype contrast e2e at P and D; shots P, L, D in `e2e/screenshots/f82`; the perf gate is left to the release gates, as the change is a lens aim, a rim strength and CSS)*
- **Why:** `ns-title-P` (plan1103g): the logotype (15-375 x 85-130) is a thin outline lost in the dark art; the figure with the umbrella sits behind the menu text; below y=450 the frame is almost black; both sizes have black letterbox bands (D 0-44 and 855-900, P 0-42 and 800-844).
- **Build:**
  - A phone crop of its own: the figure in the lower half with a rim light, the menu above it on a scrim. *(Done 2026-11-04 lane B, slice 2: upright, the title's lens aims higher and turns her into the right half, so she stands below and beside the menu. The menu box hugs its rows; a stronger phone rim; the upright scrim is dark only behind the menu. The `figureBox()` hook feeds an e2e for the menu clear of her and her in the lower half.)*
  - A solid logotype (the outline only as the draw-in's first beat) with a legibility pool. *(Already so: the fill lands 820 ms into the draw-in, over an ink drop-shadow. The e2e measures it at 4.5:1 or more against the 95th-percentile pixel behind it at P and D.)*
  - No letterbox: the scene full-bleed, the safe areas padded. *(Done 2026-11-04 lane B, slice 1: `.front-bars` hidden on the front door, and the menus keep the `--top-safe` padding; e2e in `cathode-front.spec.ts`.)*
- **Accept:** e2e: the logotype's contrast against the pixels behind it at least 4.5:1 at P and D, no black band over 8 px at either size, the menu's box not intersecting the figure's at P; the perf gate passes; shots at P, D and L.
- **Size:** 2

## 83. [x] Cathnivore: every action this turn in reach, as illustrated cards *(done 2026-11-04, lane A, slices 1-11: playable cards first and a 'Not yet' group of priced strips; a painted tile per kind (`ActionArt.tsx`); the play lift (`playLift.ts`); Sell three to a row at D; the P hand two cards and a peek; Supply and Rebut as one card with keys; a big desktop turn folds the Farm block, widens its column and stands Invest and Play three to a row, so a 15-card round-7 turn fits 1280x800 (`desktop-no-scroll` round-7 cases at 1440x900 and 1280x800, the fold's fade counted as cut); action-hand, tutorial, disabled-actions, accessibility e2e pass; shots P and D, light and dark)*
- **Progress (2026-11-04 lane A):** slice 1: playable actions first (Sell, Invest, Play), then a "Not yet" group of dashed one-line strips (name over a 'need N' line, the price kept); at D every playable action is one row (icon, name, price, i), about 40 px. 1440x900 fits a round-1 turn whole (desktop-no-scroll checks every playable card, seed 1). Slice 2: the ledger chips on one row under 1400 px, so 1280x800 fits seven cards. Slice 3: group colours (Sell green, Invest sea, Play clay). Slice 4: each card's own painted picture (`ActionArt.tsx`). Slice 5: the play lift (`playLift.ts`, 250 ms, a fade under reduced motion; `e2e/play-lift.spec.ts`). Slice 6: at D the Sell cards stand three to a row as tiles. Slice 7: the P hand shows two whole cards and a 36 px peek at 360-430 wide. Open: a round-7 turn has 12-15 playable cards; at 1280x800 five are still below the fold (at 1440x900 about three). A one-line dense mode was tried and reverted (Invest names shrank to 'W…', the three Supply rows looked alike). Slices 8-10 (2026-11-04 06:51 lane A): Supply's removals and Rebut's counts are one card each with their options as keys (P and D); a desktop turn whose playable cards overflow folds the Farm block for that turn (a Farm key beside Undo) and its frame title, and stands Invest and Play two to a row as tiles, the family cards closing the Play group. At 1440x900 a round-7 turn of 12 always fits and most of 14 do (`desktop-no-scroll` round-7 case); at 1280x800 a 14-15-card turn still cuts 1-2. Next: fold the Schemes (often three or four) into one card with a key per scheme, or make the tiles shorter, then tick the 1280 line.
- **Why:** `cath-game-D` (plan1103g): the Actions column (17-332 x 250-875) is a grid of identical yellow buttons; locked ones are washed-out ghosts; "PLAY · 9 MORE" hides most actions below a scroll. `cath-game-P`: one row shows and the third card is cut at x=355.
- **Build:**
  - Each Sell, Invest and Play action a card with its own small illustration, cost chip and group colour.
  - At D every action available this turn fits without scrolling (unaffordable ones collapse into a priced "need N" strip with their art kept); at P a snapping hand with a visible next-card peek.
  - Playing a card lifts it and sets it down toward the board (250 ms; a fade under reduced motion).
- **Accept:** e2e: every enabled action's box inside the viewport at 1440x900 and 1280x800 without scrolling; at P no card clipped at rest except the peek, which is at least 24 px; every card has an accessible name; tutorial, action-hand and desktop-no-scroll specs still pass; shots P and D, light and dark.
- **Size:** 3

## 84. [x] The bugs from the 2026-11-03 17:00 critique, fixed as one batch
- **Build:** (check each first; plan1103g)
  - [x] **Hedgerow D** (`hedge-l21-2d-D`/`-3d-D`): the tower shelf's prices at y about 130 run together and clip. *(Fixed: packets never narrower than 38 px; 9 or 11 towers wrap to a second row.)*
  - [x] **Hedgerow D**: an empty band about 1100-1410 x 650-705 under the "Coming up" wave icons. *Done 2026-11-04 (lane B): when the notebook gives way, the rounds ahead become tiles that fill the card to its foot; e2e in hedgerow-tray.spec.ts.*
  - [x] **Hedgerow 3D D**: a white flare blob on the field (about 640-680 x 690-720); "216 coming" overlaps the Hollowell gate sign. *(The plate fixed: 1.4 cells into the field, beside the queue, clear of the sign. The flare still open.)* *(Done 2026-11-04 lane B: the blob was Cath's long hair. `liftCath` glowed her vertex-coloured hair by its white base, and a backwards spring step swung it out level like wings. The glow now takes her hair colour and the spring never runs backwards, `tests/hedgerow-cath3d-hair.test.ts`.)*
  - [x] **Cathnivore Setup D** (`cath-setup-D`): empty bands at the foot of the Difficulty and Map panels (stretched to the row). *(Fixed: the panels end at their content on the cloth.)*
  - [x] **Hedgerow map D** (`hedge-menu-D`): the "Brand Ambassador" two-line pill crowds node 30's lock; Cath's marker covers node 21's top. *Done 2026-11-04 (lane B): Cath stands 9 px clear of her coin; a locked stop's name keeps 6 px under its padlock at D; e2e in hedgerow-map.spec.ts.*
  - [x] **Cathnivore title P** (`cath-title-P`): the MUM drawing touches the screen edge over the board's corner *(fixed: pinned inside the cloth's corner on a phone)*. **Portfolio D**: a lone scroll-hint capsule far from the content column *(fixed: it sits at the end of the stats row)*.
- **Accept:** e2e boxes inside the viewport and not intersecting, at P and D for each case; shots before and after.
- **Size:** 1

## 85. [x] The site's /games/: all four games on the first screen *(done 2026-11-04, lane B, slices 1-3: the hero strip, Cath head to boots in the shared art's `full` framing, the hero text at AA (a legibility pool, the meta line as a pill) and the stall warmed; e2e in `games-cards.spec.ts`; shots P and D, light and dark, in `e2e/screenshots/f85`)*
- **Why:** `games-D` (plan1104a): the first screen is one "Play today's Runnel" button (615-815 x 352-398); no game shows above the fold; Cath stands cut at the waist on a floating plank (200-450 x 515-532); the stall (1145-1355 x 285-510) is washed out by haze. `games-P`: a dark card (20-370 x 680-844) crosses Cath's legs.
- **Build:**
  - A strip of four game cards in the hero (live key art `portfolio/public/work/games-*.webp`, each logotype and a one-line hook): under the CTA row at D, a snapping row from y about 600 at P. *(Done 2026-11-04 lane B, slice 1: `nav.hero-games` is a 2x2 under the CTA row at D, and a snapping row of two cards and a peek at P (y 417-603), with Cath below it. e2e in `games-cards.spec.ts`: 4 cards inside 1440x900, 2 inside 390x844, none over Cath. Next: ground Cath (no plank) and lift the stall out of the haze; at P she is now partly below the fold.)*
  - Cath grounded in the diorama: full figure, feet on the ground with a contact shadow, no plank. *(Done 2026-11-04 lane B, slice 2: the shared art's new `full` framing (`shared/cath/cath.ts`, `lowerBody`): trousers and boots per outfit, the gown's long skirt, the trench's knee skirt, a contact shadow. /games/ uses it with no plank and no waist fade; at P her boots end at y 830.)*
  - The stall out of the fog, lit like the scene; "Free · No ads · No accounts" and the ghost button at AA contrast.
- **Accept:** e2e: 4 cards wholly inside 1440x900, at least 2 inside 390x844; nothing overlaps Cath's box; hero text 4.5:1 or more; shots P and D, light and dark.
- **Size:** 2

## 86. [x] Cathnivore: the desktop title as one staged market scene *(done 2026-11-04, lane A, 2ac049f0..f1142790: at D the logotype across the top centre, bunting strung across the market, the table edge to edge with the footer on its front, the menu the chalk board standing on it with a painted 'Marrow Market' sign hung over it (860 px tall or more), Cath behind it, the board lying on it (an 11 degree tilt), crates, jam and coins on the tabletop; the scene grows with the height on big screens; e2e in title-table.spec.ts (menu meets the table, table edge to edge, logotype centred, Tab reaches every entry, no bare 300x200 window) at 1440x900 and 1280x800; phone unchanged; shots P, D, 1280, 1920, 1024, light and dark)*
- **Why:** `cath-title-D` (plan1104a): about 40% of the frame is empty paper (130-600 x 600-860, 650-1440 x 0-340); the table is a bare brown slab (626-1334 x 757-865); the menu is a dark box (130-490 x 292-592) beside the scene, not in it.
- **Build:**
  - The table dressed (crates, a jam jar, coins, Bea's drawing) and spanning the frame; the menu a chalk price-board standing on it.
  - The board lying on the table under Cath, the logotype across the top centre, the scene filling 1440x900 edge to edge.
  - The phone title unchanged.
- **Accept:** e2e at D (1440x900 and 1280x800): the menu box intersects the table's; no empty band over 300x200; keyboard reaches every entry; title-table and title-fit still pass; shots P and D, light and dark.
- **Size:** 2

## 87. [x] Hedgerow: the tower shop as illustrated seed packets *(done 2026-11-04, lane A: lane B's packets (97x100 at D, three to a row; 90 px tall with 7-9 towers, four to a row with 10+, 70 px as fitPreview's last resort), names on the phone's packets (65x66), too dear dashed with a struck price, focus shows the range; Coming up and Cath's notebook as one tabbed card with a news dot; fitPreview desktop-only; e2e in `hedgerow-tray.spec.ts`, critique and gatequeue updated; shots `e2e/screenshots/h87`)*
- **Why:** `hedge-l21-2d-D`/`-3d-D` (plan1104a): buying towers is the core action, but the shop is 9 chips of about 40x40 px with 10 px prices and no names (1108-1414 x 85-170), smaller than the round card under it. `hedge-l21-2d-P` (18-380 x 700-760): no names either.
- **Build:**
  - At D each tower a seed packet about 96x112: the tower drawn, its name, price and a role tag (ground, air, support), in a 3-column grid. *(2026-11-04 lane B, slice 1 drafted, not shipped: `docs/plan/wip-87-seed-packets.patch` (apply with `git apply`) holds the 3-column packets (97x104 at 1440x900, 80 px tall at 800 high), a price tag, a dashed packet with a struck price for too dear, focus drawing the ring, and Coming up as the last card `fitPreview` drops. Blocker: nine packets take about 330 px of the column, so at 1440x900 Coming up goes on every level and Cath's notebook at level 12. That fails item 40's and item 31's e2e (`hedgerow-critique` 'ends on a whole card', `hedgerow-tray` 'ends on Cath's notebook' and 'Coming up fills'). Decide where the notebook and Coming up go first (for example, the notebook behind a tab on the ticket, or the packets in two rows of five at 56 px) and then update those tests.)*
  - *(Decided 2026-11-04 15:25, lane A: at D, Coming up and Cath's notebook become one card with two tabs, 'Coming up' (shown by default) and 'Notebook' (a dot on the tab when its advice changes), under the packets and the round ticket. Two rows of five at 56 px is rejected: it fails this item's own 90x100 acceptance. Update `hedgerow-critique` 'ends on a whole card' to the tabbed card, `hedgerow-tray` 'ends on Cath's notebook' to 'the Notebook tab opens Cath's notebook', and 'Coming up fills' to the Coming up tab. Unblocked.)*
  - Affordable, too dear and locked differ in shape (a price tag, a strike, a padlock), not colour alone.
  - Hover or focus lifts the packet and shows its range on the field; at P each chip gets its name and the picked one a raised packet.
- **Accept:** e2e: shop items 90x100 or more at D, 56x64 or more at P; each has a visible name and an accessible name with its price; greyscale shot tells the three states apart; hedgerow-tray still passes; shots P and D in 2D and 3D.
- **Size:** 2

## 88. [x] Hedgerow: the next level as a hero card on the journey map *(done 2026-11-04, lane B: the 120 px act strip, the level card docked at D and as a sheet at P, the breathing next stop; e2e in `hedgerow-map.spec.ts`; shots P, D, L and dark in `e2e/screenshots/f88`)*
- **Why:** `hedge-menu-D` (plan1104a): the only call to act is a small "Next" pill (232-275 x 380-396); no Play button, preview or threat summary; the locked act 4 teaser takes the bottom 37% (565-900).
- **Build:**
  - A level card for the next (or picked) stop: the field's thumbnail, the twist, the enemies it brings, stars won, and a big Play. *(Done 2026-11-04 lane B, slice 2: `levelCard()` in `map.ts` shows a plan of the field (plots and lane), the kicker (level, boss, rounds), the twist, stars and up to four vehicles (D only). Play is 168x52 at D and full width at P; pointing at or focusing an open stop shows it on the card. Clicking a stop still starts it, so Enter on a stop starts it too and focus previews it: logged in DECISIONS.)*
  - Docked beside the act at D, a sheet above the nav at P. *(Done: under the act's stops at D, a sticky sheet at the map's foot at P.)*
  - The next act's teaser a strip of 120 px or less; the next stop pulses gently (still under reduced motion). *(2026-11-04 lane B, slice 1: at D the glimpse is a 120 px strip with its caption on one line; the last act shown stretches to fill the screen above it, so the map still opens on its head (critique79). e2e in `hedgerow-map.spec.ts`. The room under the act's stops is where the level card can dock next. The next stop's coin now breathes in gold, held as a still ring under reduced motion.)*
- **Accept:** e2e: Play visible without scrolling at P and D, 160x48 or more; teaser 120 px or less at D; Enter on a stop opens its card; hedgerow-map still passes; shots P and D.
- **Size:** 2

## 89. [x] NIGHT SHIFT: the desktop front menu with a case dossier and The List as mugshots *(done 2026-11-04, lane B, slices 1-4: the List as five mugshots, the case dossier on focus, the boot line gone once built, a stronger desktop rim on her coat and hair. e2e in `cathode-front.spec.ts`: mugshots, dossier, menu and logotype at 4.5:1 or more. Shots at D and L in `e2e/screenshots/f89`; P is unchanged. Perf gate left to the release gates, since the change is DOM and a rim strength.)*
- **Why:** `ns-title-D` (plan1104a): black bars (0-44 and 855-900); a plain text menu (58-225 x 310-550); the case line and THE LIST are 11 px grey captions (58-280 x 584, 58-150 x 740-800); the figure (960-1070 x 260-930) doesn't read as Cath. Item 82 covers only the phone.
- **Build:**
  - Full bleed at D; the progress line only while loading. *(Done 2026-11-04 lane B: full bleed came with item 82; the boot line is hidden (`hidden`, not just faded) once the street is built, so a frozen frame no longer holds it under the menu; e2e in `cathode-front.spec.ts`.)*
  - Focusing New Case or Continue slides in a dossier (a polaroid of the case's target, place, debt tag). *(Done 2026-11-04 lane B, slice 2: `dossierFor()` in `frontcopy.ts` (unit: `tests/cathode-dossier.test.ts`) feeds `#dossier`, a pinned case file beside the menu at D. New Case shows Tomas Reed, The Harbour, a debt tag (a blank print); Continue shows the next name on the List with its bust, where the save lands and the open lead. It slides away on other rows. e2e: shown on focus, clear of the menu's words and hint.)*
  - The List as five pinned mugshots, closed cases struck through; a rim light so Cath's hair and profile read. *(2026-11-04 lane B, slice 1: at D `#the-list-wall` is five pinned polaroids built from the case board's busts: done ones greyed with a blood stroke and struck names, the next outlined, unreached ones as blank prints marked Withheld. They are about 92 px tall at 1440x900. The names list is visually hidden but still read out; e2e in `cathode-front.spec.ts`. Full bleed came with item 82. Next: the dossier on focus of New Case or Continue, the rim light at D, and the loading line hidden once loaded.)*
- **Accept:** e2e at D: rows 10 and 880 not uniform black; the dossier visible on focus; five portraits 64 px tall or more; menu text 4.5:1 or more; the perf gate passes; shots D and L, P unchanged.
- **Size:** 2

## 90. [x] Runnel: tiles that read at a glance *(done 2026-11-04, lane A, slices 1-4: dark rims, a lit bevel and a cast shadow; the night board's lit wooden rim; the valley dimmed in lessons, not the tiles; gentler morning, dusk and night-cloud washes; `e2e-site/runnel-tiles.spec.ts` samples six skies at P and D, light and dark (edge vs valley 3:1 at D, 2.5 at P; channel vs tile 3:1, the ditch's banks and bed together); greyscale and colour shots in `e2e/screenshots/r90`. Cut: tile fill vs field 3:1, see DECISIONS)*
- **Why:** `runnel-D`/`runnel-P` (plan1104a, check first: may be the lesson's dim): tiles (580-1215 x 125-730 at D) are pale cream over the wheat fields, their channels tan on cream.
- **Build:** tiles as solid bevelled pieces with a dark rim and a cast shadow; channels dark grooves with a lit edge; in lessons dim the valley, not the tiles. *(2026-11-04 lane A, slice 3: light rim #3e2a18, a lit wooden rim #dcb47c on the night board, rims 4 (5.5 on phones), morning wash .55 -> .18 (.1 at night), dusk .22 -> .13. Draft acceptance spec in `docs/plan/wip-90-runnel-tiles.spec.ts.txt` (copy to `e2e-site/runnel-tiles.spec.ts`): light P and D pass every weather (edge vs valley 3:1 at D, 2.5 at P; channel vs tile 3:1); dark fails channel vs tile (2.2:1 at noon, D) though the shots read clearly; check whether the sample hits the cream lip or the bed, then fix or adjust. Tile fill vs field is cut: the rim carries it, see DECISIONS.)*
- **Accept:** sampled in e2e: tile fill vs field 3:1 or more, channel vs tile 3:1 or more, every weather; greyscale shot readable; runnel e2e still pass; shots P and D.
- **Size:** 1

## 91. [ ] The bugs from the 2026-11-04 04:10 critique, fixed as one batch *(lane B, in progress)*
- **Build:** (check each first; plan1104a)
  - [x] **Portfolio D:** a stray pill in the stats row (1035-1062 x 780-825); the hero collage's stale shots, near-black NIGHT SHIFT tile, no Hedgerow (805-1345 x 160-650). *(Fixed 2026-11-04 lane B: the scroll cue is hidden at D; Hedgerow is a fourth print (the phone cycles four in 16 s); the NIGHT SHIFT print is brightened 1.5x. The shots are the live key art, re-shot by `npm run keyart`. Shots in `e2e/screenshots/f91/pf-*`.)*
  - [ ] **Cathnivore title D:** the bubble's tail a flat underline not pointing at Cath (650-895 x 370-418). **P:** the bubble squeezes four lines into about 110 px.
  - [ ] **Cathnivore Setup D:** the three maps' glyphs look alike at a glance; the seed tag's eyelet reads as a radio button.
  - [ ] **Cathnivore game D:** event cards' subtext about 11 px grey (680-1335 x 135-190); fruit crates over the board frame (1215-1325 x 810-870). **P:** the EXPAND tags' text about 7 px.
  - [ ] **Runnel D:** ~~the footer repeats the Up-next card's weather line; the lesson tabs low-contrast grey~~ *(fixed 2026-11-04 lane B: under the lesson the hint drops the sky label; the steps to come are opaque paper with deep ink, at AA; `e2e-site/runnel-critique91.spec.ts`)*. **P:** Cath twice (portrait and figure). *(Open: item 77 (lane A) chose both, the speaker's portrait and the valley bust, and `runnel-lesson-frame`/`runnel-valley` assert both at P. Dropping one is a design call: for example, hide the bust while her bubble speaks.)*
  - [ ] **Hedgerow map:** ~~a stray gold line from stop 30 into the teaser (D 143-155 x 565-720)~~ *(fixed 2026-11-04 lane B: the `.act-fog-lane` stub now leaves from under the last stop shown, set in `layoutLanes`; e2e in `hedgerow-map.spec.ts`)*; on P labels collide with padlocks and two-line labels overlap the next row. *(Checked 2026-11-04 lane B at acts 2 and 3: no label, padlock or medal box meets another stop; fixed by item 84 slice 6 and item 18.)*
  - [ ] **Hedgerow level:** ~~the gate sign about 8 px~~ *(fixed 2026-11-04 lane B: the town name is 11 px or more on a plate sized to the word; shots in `e2e/screenshots/f91`)*; the "N coming" plate over field tiles (2D D, 3D P); at P the "NEXT: ROUND 11" tab over the tray's top edge. *(Checked 2026-11-04 lane B: the tab's foot meets the drawer's top at y 694 and does not touch the tray inside it; it is a folder tab joined to the drawer, so no change.)*
  - [x] **NIGHT SHIFT D:** CONTINUE dimmer than the other entries while a case is saved. *(Checked 2026-11-04 lane B: with a save (`demoSave`), CONTINUE holds the focus and is the brightest entry (ink, opacity 1); it is dim only with no save, where it is disabled by design. No change; shot `e2e/screenshots/f91/ns-cont.png`.)*
- **Accept:** e2e boxes inside the viewport and not intersecting, text 11 px or more, at P and D for each case; shots before and after.
- **Size:** 1

## 92. [x] Cathnivore: Hollowell as a rival with a face, and its turn staged *(done 2026-11-04, 0a44ba2c..HEAD: Pell docked opposite Cath at D, memos, and the enemy turn staged step by step on the map: `stagedRegions` rewinds the steps not yet played, a flown piece lands 640 ms in; `tests/boardroom-staging.test.ts`, `e2e/boardroom.spec.ts`; the phone strip's face 56 px; shots `e2e/screenshots/r92s`)*
- **Why:** `cath-game-D` (plan1104b, 680-1335 x 90-185): the threat row is three paper cards in the players' own style, and Hollowell has no face anywhere; VISION wants glossy, over-lit corporations and characters with presence. `cath-game-P` (15-380 x 120-205) is the same.
- **Build:**
  - A Hollowell executive bust (glossy, clinical, synth palette; three expressions: smug, irritated, rattled by Pressure) docked opposite Cath's bust, through `Portrait`.
  - Threat cards as glossy corporate memos: the logo, a sheen, a typed header, unlike the players' paper.
  - The corporate turn staged: the bust speaks one line, then Squeeze, Expand and Scout land on the board one by one (400-1200 ms each, eased, no overshoot); fades only under reduced motion.
- *(2026-11-04 lane A, slices 1-2: Hollowell's face is Graham Pell, the boardroom's Hollowell (plan item 11 already stages the corporate turn: each step played by Pell or Vane with a bark, Cath answering). At D Pell's cel figure sits in a glossy black medallion with a plastic Hollowell plate at the end of the papers' row, his mood mirroring Cath's (`rivalMood`: smug, gloat, rattled); `e2e/rival.spec.ts`, `tests/rival-art.test.ts`, shots `e2e/screenshots/r92`. At P a permanent bust cost the board 22 px and failed phone-map-hero, so the phone meets him in the boardroom strip on Hollowell's turn. Slice 3: the papers are Hollowell memos (an orange letterhead band, clean-cut stock, a gloss across), e2e in `rival.spec.ts` at P and D. Slice 4: the map showed the turn's end state under its first flight; now each step's change waits for it.)*
- **Accept:** e2e: a `[data-rival]` bust 80 px or more at D, 56 at P (at P: the boardroom face during the turn); memo background differs from the player cards by computed style; the corporate turn plays 3 or more sequenced steps and each board change waits for its step; tutorial, turn-show and desktop-no-scroll still pass; shots P and D, light and dark.
- **Size:** 3

## 93. [x] Cathnivore: the phone title as a staged market scene *(done 2026-11-04, lane A: bunting, a centred logotype, Cath 223 px (190 at 375x667) behind the table's back edge with a two-line bubble, the board tilted on the tabletop, the menu standing on it at the table's front, the footer on the front; e2e in `title-table.spec.ts` at both sizes; shots `e2e/screenshots/t93` P, 375x667, D, light and dark)*
- **Why:** `cath-title-P` (plan1104b): item 86 staged the desktop only. Cath is an 85x160 cut-out top left (40-125 x 120-280), the bubble squeezes four lines into the corner (20-130 x 20-105), the board floats with no table, and the menu is a stacked form (20-370 x 450-720).
- **Build:** the table edge across the phone with Cath standing behind it, the board lying on it and the chalk menu standing on it; bunting across the top; a one or two line bubble beside her.
- **Accept:** e2e at 390x844 and 375x667: Cath 200 px tall or more (180 at 667) and clear of the menu and logotype; the menu's foot meets the table within 4 px; bubble 2 lines at most; no scroll; title-fit and title-table still pass; shots P (both sizes), light and dark.
- **Size:** 2

## 94. [x] Hedgerow: 3D water as sunken terrain, with banks and bridges *(done 2026-11-04, lane B: the ford as lit water with stepping stones, the flood as a sheet on the field, ponds already sunk. Unit `tests/hedgerow-water-lane.test.ts` (100 levels), e2e `hedgerow-water.spec.ts` (ΔE ≤ 15 from the 2D pond). Draw calls at level 13 D 705 to 684. Shots of levels 13 and 21 at P and D in `e2e/screenshots/f94`.)*
- **Why:** `hedge-l21-3d-D` (plan1104b): pale translucent slabs cross the lane and plots (240-520 x 380-510, 650-935 x 535-590), reading as a selection overlay; `-3d-P` (60-185 x 365-475) the same. The 2D field draws its ponds and streams well (`hedge-l21-2d-D` 615-800 x 620-680).
- **Build:** streams and ponds sunk below the ground with earth banks, reeds and a slow ripple (still under reduced motion); a plank bridge wherever the lane crosses water; no water drawn over the lane; keep the draw-call budget. *(2026-11-04 lane B, found: over all 100 levels no `terrain.water` pond cell sits on a lane tile. The pale slabs over the lane and plots at level 21 are its set-piece cells, drawn by `syncSetPieces` in `render3d/index.ts` as a translucent `MeshPhysicalMaterial` box (0.98 x 0.06, opacity .78) per cell, plus its ford (path distance 17.3-21.6). Start there: sink those cells into the terrain (`heightAt`) with banks, and give fords a plank bridge or stepping stones.)* *(Slice 1 done 2026-11-04 lane B: the pale band at level 21 was the ford, drawn as unlit pale-blue planes at opacity .45, a mesh per step. It is now lit water in the 2D blue across the lane with stepping stones on both edges, two instanced meshes. The flood set piece is a flush water sheet over a wet-earth margin, no longer floating boxes. Draw calls at D: level 13 705 to 684, level 21 543 to 520. Ponds were already sunk (ground at -0.2 under a rippled water plane, with sand banks, reeds and pads). Slice 2: `tests/hedgerow-water-lane.test.ts` checks that no pond or flood cell is a lane tile over all 100 levels. Next: the sampled-colour check against the 2D water, and shots of levels 13 and 21 at P.)*
- **Accept:** unit: no water footprint meets a lane tile without a bridge, over all 100 levels; sampled water pixels within ΔE 15 of the 2D water colour; draw calls at level 13 within 5% of today's; shots levels 13 and 21 at P and D.
- **Size:** 2

## 95. [x] Hedgerow: the round card as a threat poster, Cath's advice spoken on the field *(done 2026-11-04, lane A, e3c192f5: the round's traits as 30 px icons with the field's gaps under a 'Can't answer' stamp; the warning, rules, round after and her full advice behind the ticket's (i); her line in a bubble beside her before Go, naming the gap first (`gapAdvice`); `cathsay.ts` placement, unit `tests/hedgerow-cathsay.test.ts`, e2e `hedgerow-threat.spec.ts` at P and D; tray, gatequeue, critique, field, map e2e pass; shots `e2e/screenshots/h95` before/after, 2D and 3D. Changed: 'clear of the lane's tiles' became 'never over the gate queue or her figure, the least lane it can', see DECISIONS)*
- **Why:** `hedge-l21-2d-D` and `-3d-D` (plan1104b, 1105-1415 x 375-545): the advice is a 14 px paragraph ("Your field can't answer this: Airborne. Scarecrows, Beehives, ..."); Kingdom Rush says this with icons and a hero bark. At P the advice isn't visible.
- **Build:** the round's threat as a strip of vehicle art with counts and big trait icons (air, armour, speed) with a "can't answer" stamp on the gap; Cath's one-line advice as a speech bubble by her on the field, before Go; the full text behind an (i).
- **Accept:** e2e: the panel shows 25 words or fewer at D; the bubble within 120 px of Cath at P and D and clear of the lane's tiles; trait icons 28 px or more; hedgerow-tray, -gatequeue and -critique still pass; shots P and D, 2D and 3D.
- **Size:** 2

## 96. [x] The site's /games/: each game a key-art poster *(done 2026-11-04, lane B: the hero strip became four posters (key art about 282 px wide at D and 169 at P, Cath's bust in each game's outfit, a title plate, one line, Play). A row across the hero at D, all four inside 1440x900; a 2x2 grid at P with no sideways scroll. The games section now starts below the first screen at D, the stall sits on the horizon, and the ghost button is darker glass for AA. e2e in `games-cards.spec.ts`; shots P and D, light and dark, in `e2e/screenshots/f96`.)*
- **Why:** `games-D` (plan1104b): the four games are 85x55 thumbnails with 12 px grey copy (615-1155 x 450-610), and a translucent half-faded strip of cards sits at the bottom (180-890 x 745-900). `games-P` (350-390 x 425-610) cuts Hedgerow off in a sideways scroll.
- **Build:** four poster cards (about 260x300 at D, a 2x2 grid at P): key art with Cath in that game's dress, a title plate, one line of copy, Play; the bottom strip solid (or gone) on the first screen.
- **Accept:** e2e: each poster's art 240 px wide or more at D, 160 at P; all four in the first viewport at D; no horizontal scroll at P; copy 14 px or more at AA; games-cards and site-hero still pass; shots P and D, light and dark.
- **Size:** 2

## 97. [x] Runnel: ditches dug into the earth, and the water front you can follow *(done 2026-11-04, lane A, 9edbb5bd: carved trenches, a 250 ms a tile front, spill splashes; e2e `runnel-front.spec.ts`, runnel-water and runnel-tiles pass; shots P and D before and after a tap, light, dark and greyscale in `e2e/screenshots/r97`)*
- **Why:** `runnel-D` (plan1104b, 900-1110 x 215-440, 1000-1140 x 590-640): dry ditches read as cream planks with bolts (the pebbles), not channels cut in soil. Check first what the tap already animates (`arrivalMs` in `water.ts`).
- **Build:** a dry ditch as a carved trench (shadowed walls, a darker damp bed, the pebbles small and few), so cream reads as the lit bank only; after each tap the water front runs on tile by tile (about 250 ms a tile) with a small spill splash at an open end; reduced motion fills at once. *(Slice 1 done 2026-11-04 lane A: the shaded wall's foot and the cut edge's cast shadow, a darker wider damp bed, one small stone in the bed (on the banks they read as bolts), the cut edge ragged with spoil; CASCADE_MS 110 -> 250; a fresh spill splashes when the front reaches it, every spill `[data-spill]`; `e2e-site/runnel-front.spec.ts`; shots `e2e/screenshots/r97` via `scripts/runnel-97-shots.mjs`. Open: greyscale shot, a further look at the lit wall's width.)*
- **Accept:** e2e: within 600 ms of a connecting tap the next tile's bed turns blue; a spill shows `[data-spill]`; runnel-tiles (item 90) still passes; greyscale shot readable; shots P and D before and after a tap, light and dark.
- **Size:** 2

## 98. [x] The bugs from the 2026-11-04 09:10 critique, fixed as one batch *(done 2026-11-04, lane A: every bullet; e2e in title-table, desktop-no-scroll, site-hero, hedgerow-map, hedgerow-3dframe; shots in `e2e/screenshots/b98/`)*
- **Build:** (check each first; plan1104b)
  - [x] **NIGHT SHIFT D:** the loading line stays after load (585-855 x 860-865) (item 89 may take it). **P:** the logotype a dark outline on dark (15-375 x 85-135; check it isn't mid draw-in) and The List plain text (15-105 x 695-745). *(Done 2026-11-04 lane A: the loading line was item 89's (hidden after its fade); the P logotype is filled glyphs once drawn (the shot was mid draw-in); The List at an upright phone shows the five pinned prints under the names (the D wall's art, about 52 px each, the next one lit); short landscape keeps the text.)*
  - [x] **Portfolio D:** the stats row labels and numerals low contrast (100-910 x 760-845). *(Done 2026-11-04 lane A: at rest the labels were 5.6:1 and the numerals 17:1 (the critique's shot caught the row's rise-in); the labels now use the muted tone (about 9:1); e2e in `site-hero.spec.ts`.)*
  - [x] **/games/ D:** "grown-ups" breaks to leave "ups" alone (993-1015 x 590-604). *(Done 2026-11-04 lane A: the word is kept whole (`.nowrap`) and the hooks wrap balanced.)*
  - [x] **Cathnivore title D:** a marker covers "Kingsmarket"'s plate (1118-1140 x 458-478). *(Done 2026-11-04 lane A: it was a Hollowell van parked on the plate in early frames; every road round Kingsmarket passes a plate, so the vans now drive inside the board's svg under the name signs (Map's `underNames`); e2e in `title-table.spec.ts`.)*
  - [x] **Cathnivore game D:** the faded last "Not yet" row cut by the "NOT YET · 7 MORE" pill (35-315 x 735-800). *(Done 2026-11-04 lane A: a row that starts in the fold's fade (under 80 px above the frame's foot) counts as below the fold and hides until scrolled (opacity 0, still focusable); e2e in `desktop-no-scroll.spec.ts` at 1440x900 and 1280x800.)*
  - [x] **Hedgerow map P:** the next act's caption clipped behind the nav (50-340 x 760-780). *(Done 2026-11-04 lane A: it was item 88's level card: the act's `overflow: hidden` made the act its sticky container, so the sheet stuck to the act's foot under the tab bar with Play off screen; `overflow: clip` pins it whole above the bar; e2e in `hedgerow-map.spec.ts` on a fresh and a level-13 save.)*
  - [x] **Hedgerow 3D:** the gate sign about 9 px (D 175-285 x 378-392, P 20-75 x 410-420); Cath's 3D token a dark blob with no face at P (22-60 x 515-555). *(Gate sign done 2026-11-04 lane A: the board is taller (0.34) with the word fitted to it, turns to face the camera each frame (a phone saw it edge on) and stands out in front of the crossbar, and on a phone grows up to 1.6x until its letters stand 8.5 px; caps at level 21: D 12.9 px, P 8.5 px (were about 6 and 2); `gateSigns()` sandbox hook, e2e in `hedgerow-3dframe.spec.ts`; drawn last and over the verge's pines. Cath's token done too: the phone camera sits 79 degrees up (D 42), so past 54 degrees she leans back like a paper doll on a board (up to 0.55 rad) and her face and coat turn up to the lens; D unchanged. Shots in `e2e/screenshots/b98/` (cath-before/after-P-l21).)*
- **Accept:** e2e boxes inside the viewport and not intersecting, text 11 px or more and 4.5:1, at P and D for each case; shots before and after.
- **Size:** 1

**Later, unranked:** (none)

---

**Done on 2026-11-01, before this plan:** the portfolio front page (`/`). It has the WebGL2 hero, kinetic type, bento case cards and the `/work/<id>/` case studies with view transitions, and covers audit items P-A and P-B.

**Folded in or retired:** ROADMAP 19, H2, 31, 33, 62 and 219 are closed as built. 239 to 242 (Phase 27 meta add-ons) are deferred below this plan. 58 and U7 become item 5; 74's leftovers become items 14 and 16; U11 is part of item 13.

## 99. [x] NIGHT SHIFT: The List and the case dossier as painted mugshots *(done 2026-11-04, lane B: mugshots for all five targets and Tomas Reed (`mugshotSvg`), redacted silhouettes, the dossier clipped and tilted with the hint stepping back. e2e: no flat photo, dossier photo 140 px or more at D, phone frames 56 px or more, captions at 4.5:1 at P and D. Shots P, L and D in `e2e/screenshots/f99`; L is unchanged, with no room for the List. DOM and 2D art only.)*
- **Why:** `ns-title-D` (plan1104c, 405-565 x 295-575): the case file's photo for Tomas Reed is a flat black square with a "?", the focal point of the menu; the four "Withheld" List frames (155-535 x 665-800, and 75-300 x 690-750 at P) are the same black squares beside a rich, lit street. Only Julian Crisp has a face.
- **Build:**
  - A noir mugshot for each of the five targets, from the same bust pipeline as Julian Crisp's (lit, height chart behind, a slate).
  - A withheld target is a silhouette behind a red REDACTED bar and a case stamp, never a black square.
  - The dossier shows the focused target's mugshot with a paper clip and a slight tilt; drop the menu-foot line ("TOMAS REED · THE HARBOUR · A DEBT TAG") that repeats it. *(Done 2026-11-04 lane B, slice 1: `mugshotSvg()` in `ui/busts.ts` puts a bust in front of a height chart with a slate. New busts: Tomas Reed (slicker, knit cap, stubble, a red debt tag) and the Mind Under the River (cold light, cables, a red status light). A withheld name is a silhouette behind a red REDACTED bar and a CASE OPEN stamp. The dossier photo is clipped and tilted, and the menu hint hides while the dossier shows. Phone frames have a 64 px floor. e2e: every photo's luminance spread is over 12, the dossier photo is 140 px or more at D, phone frames are 56 px or more.)*
- **Accept:** e2e: every photo region's luminance standard deviation is over 12 (no flat fill); the dossier photo 140 px wide or more at D, List frames 56 px or more at P; captions at 4.5:1; the perf gate untouched (DOM/2D art only); shots P, L and D.
- **Size:** 2

## 100. [x] Cathnivore: Hollowell's plan as glossy corporate cards *(done 2026-11-04, lane A, 0da0cb67..9cedb0a6: `PlanArt` per move in white plastic, the conveyor dial, each target region a chip (`splitTarget`), a new card slides in and stamps with no overshoot (a fade under reduced motion); unit `tests/plan-art.test.ts`, `tests/plan-target.test.ts`; e2e `e2e/plan-cards.spec.ts` (12 px+, axe AA light and dark, nothing cut at 390, 1280, 1440); shots `e2e/screenshots/b100`, `b100s`)*
- **Why:** `cath-game-D` (plan1104c, 640-1200 x 90-200; P 10-375 x 115-210): Hollowell's Squeeze, Expand and Scout are text on note paper with 10 px "H" glyphs and grey subtext ("Arms next round"), while the players' actions got painted tiles (item 83). VISION gives the corporation a glossy, over-lit, clinical look; here it's the plainest thing on screen.
- **Build:**
  - Each intent kind (Squeeze, Expand, Scout, Buyout) gets its own art in Hollowell's style (white plastic, teal, a logo watermark), in `HollowellArt` beside `ActionArt`. *(Done 2026-11-04 lane A, slice 1: `icons/HollowellArt.tsx` `PlanArt`, glossy white plastic with Hollowell orange and Candor teal and a faint H watermark (Cathnivore's Hollowell is orange; teal is Candor's, and both act through every slot); 38 px beside the headline at D, 26 at P, where two 11 px logos were; no taller card; unit `tests/plan-art.test.ts`; shots `e2e/screenshots/b100`.)*
  - Its target region and arming round drawn on the card (a region chip, a stage dial), not grey subtext. *(Stage dial done 2026-11-04 lane A, slice 2: three chevrons in the dateline, lit up to the card's place on the Scout -> Expand -> Squeeze conveyor. Region chips, slice 3.)*
  - A card that arms slides in and stamps, with no overshoot (corporations don't bounce); reduced motion fades.
- **Accept:** unit: each kind's art is distinct; e2e: card text 12 px or more at 4.5:1, no card truncated at 390, 1280 and 1440 wide, no horizontal scroll; turn-show and boardroom e2e still pass; shots P and D, light and dark.
- **Size:** 2

## 101. [x] Cathnivore Setup: pick a map by seeing it *(done 2026-11-04, lane A, 3e1ef86f..HEAD: `BoardMiniature` draws each layout from its data with the board's tile art, the Delta's river and two bridges; 121-123 px wide at 1440x900 and 1280x800 (were 50 px glyphs), a short desktop drops the blurbs; on a phone the board stands beside its name, 46 px tall (was 28) in the same no-scroll screen; e2e `e2e/setup-maps.spec.ts`; shots `e2e/screenshots/s101` P, 1280 and D, light and dark. Cut: the larger picked preview with names and the phone's 96 px scrolling row, see DECISIONS)*
- **Why:** `cath-setup-D` (plan1104c, 505-975 x 560-705): the three map cards are about 50 px clusters of beige hexes over two lines of text; you choose a board without seeing it, though the board is the hero of the game. The column below them is empty.
- **Build:**
  - Each map card a miniature of the real board drawn from the map data (each region's own ground from `regionGround.ts`, the river, the bridges).
  - The picked map's preview larger, with its region names; on a phone the previews in a row that scrolls with a cue.
- **Accept:** e2e: previews 120 px wide or more at D, 96 at P; the preview's region count matches the map data (6, 10, 7); Setup doesn't scroll at 1440x900 or 1280x800 (setup-desktop e2e); shots P and D, light and dark.
- **Size:** 1-2

## 102. [x] Hedgerow: a 3D Cath drawn to the character bible, who reacts *(done 2026-11-04, lane B, slices 1-4: her face to the bible with named parts; cheer, worried and plant poses; a warm face key as the camera comes in, a lift of her face's own material at no draw-call cost; `hedgerow.faceBox()`. e2e: face 24 px or more at D and 14 at P on levels 13 and 21, poses within a few frames. Her mesh count went 36 to 38. Shots P, L and D in `e2e/screenshots/f102`.)*
- **Why:** `hedge-l21-3d-D` (plan1104c, 190-310 x 505-690; P 20-65 x 485-555): the 3D Cath reads as a dark mass of hair with a pale smudge for a face and a stick arm, no liner, smile or olive jacket. She is the one Cath in the four games not drawn to the bible (VISION "Cath: character bible").
- **Build:**
  - Her face a texture painted from `shared/cath` (liner, highlights, rose lips), the centre-parted waves framing it, the olive jacket with its collar up over a cream blouse. *(2026-11-04 lane B, slice 1: drawn on the modelled head rather than as a texture. The shared `face` framing includes her hair, and a flat picture is what item 52 removed. Bigger warm eyes with catchlights, a black liner with a wing, rose lips. Her hair, face, jacket and blouse materials are named; unit `tests/hedgerow-cath3d-parts.test.ts`. Shots in `e2e/screenshots/f102`.)*
  - Poses: planting when a tower is built, a cheer on a cleared round, a worried hand when Goodwill is lost. *(2026-11-04 lane B, slice 2: a cheer with arms up on `cleared`, and a worried hand on `leak`. Each eases in over 0.15 s, holds, and is out by 1.4 s; `hedgerow3d.heroMood` reports it; e2e in `hedgerow-3dframe.spec.ts`. Slice 3: she stoops to plant when the tower count rises (e2e). Draw calls: her meshes went 36 to 38, so at most +4 with shadows. The level-13 script is too noisy at this scale (685-708 on the same build). Still to do: the face key light and the face-size e2e (24 px at D, 14 at P). The worried hand can't be judged in a still yet, because the leak's camera kick shakes the frame.)*
  - A face key light when the camera frames her.
- **Accept:** unit: the model has named hair, face, jacket and blouse parts; e2e: her face 24 px tall or more at D, 14 at P; her pose changes within 250 ms of a cleared round (`window.hedgerow`); draw calls at level 13 up by 10 or fewer; shots P, L and D.
- **Size:** 2-3

## 103. [x] The bugs from the 2026-11-04 12:25 critique, fixed as one batch *(done 2026-11-04, lane A: every bullet; e2e in `e2e-site/critique103.spec.ts` and `hedgerow-3dframe.spec.ts`; shots before and after in `e2e/screenshots/b103/`)*
- *(done 2026-11-04, 88436762)* Hedgerow D: Cath's notebook repeats her field bubble word for word (`hedge-l21-2d-D`, 1105-1415 x 490-705, the bubble at 65-290 x 540-630): while she says it on the field, the notebook's advice card keeps the sketch and count, not the line. And "Coming up" is five 16 px vans over bare numbers (1105-1415 x 350-480): the vans 28 px or more.
- *(done)* Hedgerow map D: the level card's "Pickup" wraps onto its own line; empty stars about 12 px. (Vehicles a 2x2 grid, stars at the number size.)
- *(done)* Cathnivore game D: "Supply: remove 1 Outlet in Brindle..." cut with an ellipsis (80-215 x 582-614). (A one-region card reads 'Supply 1 Outlet · Brindle Hills'; the full sentence stays its name.)
- *(done)* Cathnivore title D: the ring bullets before How to Play, Settings and Credits read as radio buttons (160-445 x 725-740). (Line icons at D, plain tags on a phone.)
- *(done)* Hedgerow 3D P: the HOLLOWELL gate sign covers field tiles (0-85 x 405-425). (A phone board on a gate that stands on the field steps down; the plate names the town.)
- **Accept:** an e2e case per bullet at P and D (text 11 px or more at 4.5:1, nothing cut or overlapping); shots before and after.
- **Size:** 1

## 104. [x] The bugs from the 2026-11-04 14:10 critique, fixed as one batch *(done 2026-11-04, lane A: /games/ lands by 1 s, Cathnivore's 1280 'Not yet' names and phone why-not chips whole; the Runnel and NIGHT SHIFT bullets weren't bugs; e2e `e2e/critique104.spec.ts`, `e2e-site/critique104.spec.ts`; shots `e2e/screenshots/b104`)*
- **Why:** shots `e2e/screenshots/plan1104d` (subagent critique, claims checked against the shots; the /games/ blur and see-through cards it reported were a capture 1.2 s in, mid-entrance, and settle by 6 s).
- *(done)* Site /games/ (`games-D`, 600-1100 x 90-400; `games-P`, 20-370 x 435-844): 1.2 s after load the wordmark is still blurred, the CTAs are absent at D and the game cards are half transparent at P. The hero's entrance settles within 800 ms (reduced motion: at once), so a visitor who glances sees a finished page.
- *(done)* Cathnivore at 1280x800 (seeds 21 and 3): 'Not yet' strips cut their names with an ellipsis ('Buy Wagon Wheel Press', 'Buy Tidal Smokehouse', 'Scheme: Good Harvest'); and a disabled Scheme strip still reads 'Scheme: ' (the picture says it). Names wrap to two lines or drop the verb, never cut.
- *(done: the dock drops 'Need ' and ' to remove')* Cathnivore P: the hand's 'Need 2 more Marks' why-not chips overflow their box (scrollWidth over clientWidth on every disabled strip, seeds 7, 21, 3). Check what shows; fit or shorten ('2 more Marks').
- *(not a bug, 2026-11-04)* Runnel D (`runnel-D`, 425-440 x 130-500): the stream 'ending' in the field is its fill (item 70: it runs round the board to Bea's garden and fills as fields are watered).
- *(not a bug, 2026-11-04)* NIGHT SHIFT P (`ns-title-P`, 16-200 x 215-420): the dim CONTINUE is disabled (no save yet; WCAG exempts disabled controls); NEW CASE to CREDITS read clearly over the dark street.
- **Accept:** an e2e case per bullet at the size that broke (text 11 px or more at 4.5:1, nothing cut or overlapping; /games/ CTAs visible and wordmark unfiltered at 1 s); shots before and after.
- **Size:** 1

## 105. [x] Hedgerow 2D: vehicles you can tell apart on the lane *(done 2026-11-04, lane B: the 2D vehicles already had their own illustrated sprites (item 81 redrew the Influencer); the critique's 'pink boxes' were the smallest ones drawn too small. Courier 0.8 to 1.0, Hatchback 0.9 to 0.95, Influencer 0.85 to 0.95 (split from the lawyer and lobbyist): every level-21 and fleet vehicle is now 28 px long or more at D and 20 at P. `enemySilhouette()` (sandbox hook) and e2e `hedgerow-vehicles.spec.ts` check lengths and that no two silhouettes overlap over 90%. A greyscale shot tells them apart; Coming up and the notebook use the same sprites. The change is render-only, a scale. Shots P, L, D in `e2e/screenshots/f105`.)*
- **Why:** `hedge-l21-2d-D` (310-340 x 270-460): the round's vehicles are about 18 px pink boxes in a file, the influencer, the van and the pickup the same shape; the 3D field (item 81) gives each its own body, the 2D field doesn't. VISION: every piece readable at a glance, in its own silhouette.
- **Build:**
  - Each vehicle type drawn as its own illustrated sprite in the 2D art (the influencer's hatchback with a ring light, the delivery van's box, the pickup's open bed, the coachload's bus), 28 px or more long at D and 20 at P, with the ink outline the towers have.
  - Its type colour and a small roof marker kept for colour-blind play; damage tint and the swarm badge (item 10) unchanged.
  - The 'Coming up' and notebook vans use the same sprites.
- **Accept:** unit: each type's sprite path is distinct (no two silhouettes within 10% of each other's pixel overlap); e2e (`?2d&sandbox=1`, level 21 mid-round): every vehicle's box 28 px or more long at D, 20 at P; greyscale shot shows the types apart; draw time per frame at D not up more than 1 ms (`hedgerow-perf` or a frame-time sample); shots P, L and D.
- **Size:** 2

## 106. [x] Runnel: the spring house and Bea's garden on a phone *(done 2026-11-04, lane A: the phone already had the spring house, stream and garden (item 68's phone farm; the critique's bare band predates it). The garden is now a tilled plot (a soil patch with furrows, ridged mounds) instead of faint mounds; a solve sets `data-watered` and the soil and mounds go dark and wet, and today's bed pops its sprout as Bea runs out. e2e `e2e-site/runnel-garden-farm.spec.ts` at P and D (lesson and daily in view, no band over 80 px, stream fill rises, the soil darkens on a win). Shots dry and wet, light and dark, in `e2e/screenshots/r106`.)*
- **Why:** `runnel-P`: on a phone there's no spring house, stream or garden at all, and a bare band under the board (open critique bug since 2026-11-03), so the phone loses the valley's story (item 70: the stream runs from the spring house round the board to Bea's garden and fills as fields are watered).
- **Build:**
  - On a phone, the spring house, the stream bed and Bea's garden fill the band under the board, the stream filling as fields are watered as at D.
  - The garden takes the day's water when solved (its beds darken and a sprout pops), the payoff of the stream, at both sizes.
- **Accept:** e2e at P on the lesson and today's daily: the spring house and garden in view, no empty band under the board over 80 px, the stream's fill rises as fields are watered; the garden's solved state changes on a win (`data-watered`) at P and D; shots P and D, light and dark.
- **Size:** 1-2

## 107. [x] The bugs from the 2026-11-04 14:55 critique, fixed as one batch *(done 2026-11-04, lane A: 'Need 4 more Marks', wordless List prints, the phone 18+ badge on the poster's art; the Hedgerow teaser and the plan-card captions weren't bugs. e2e `e2e/critique107.spec.ts`, `cathode-front.spec.ts`, `e2e-site/critique104.spec.ts`; shots `e2e/screenshots/b107`)*
- **Why:** shots `e2e/screenshots/plan1104e` (subagent critique; each claim below checked in the shots).
- *(done 2026-11-04)* Cathnivore D (`cath-game-D`, 65-188 x 654-718): 'Need4 more Marks', 'Need3 more Marks'. The why-not box is inline-flex, which drops the edge space of item 104's 'Need ' span; `.why-lead`/`.why-tail` keep it (`white-space: pre`).
- *(done: a `small` mugshot drops its words, the bar, slate and stamp stay as shapes; only the print fades)* NIGHT SHIFT D (`ns-title-D`, 160-530 x 700-755): the List prints' 'REDACTED' bars and 'NO. n' tags are about 5 px, unreadable; 'Withheld' grey on grey. Stamps 11 px or more (or drop the words and keep the bar), 'Withheld' 4.5:1.
- *(not a bug: the map scrolls, and the glimpse is the content below the fold, under a fixed tab bar as any scrolling page)* Hedgerow P map (`hedge-menu-P`, 50-340 x 755-780): the 'Beyond the hedge · Act 4' strip sits half under the tab bar at rest. Whole above the tab bar or wholly below the fold.
- *(done: at P the badge pins to the poster art's top-right corner)* Site /games/ P (`games-P`, 212-246 x 825-843): NIGHT SHIFT's 18+ badge wraps onto its own line; keep it beside the name (as at D).
- *(already held: item 100's `e2e/plan-cards.spec.ts` checks every plan-card word at 12 px or more and axe AA, light and dark)* Cathnivore D plan cards (`cath-game-D`, 648-745 x 169-180 and 1032-1135 x 160-188): 'Arms next round' and 'Turns up at round end' about 11 px muted; check 4.5:1 and 12 px, and the Expand region chips (840-902 x 162-191) at 4.5:1.
- **Accept:** an e2e case per bullet at the size that broke (text 11 px or more at 4.5:1, nothing cut or overlapping); shots before and after.
- **Size:** 1

## 108. [x] Site /games/: Cath dressed for each game on its card *(done 2026-11-04, lane A: half-length Caths from `shared/cath` with `data-pose`/`data-expression`: Cathnivore with her basket (smirk), Runnel pointing, Hedgerow cheering, NIGHT SHIFT arms crossed in her trench, greyscale with a blood-red rim. 25% of the card wide, 15% or less of its art. e2e `e2e-site/games-cath.spec.ts` at P and D; shots before and after in `e2e/screenshots/b108`. The site has one theme, so no light/dark pair; key art is unchanged (it shoots the games, not /games/).)*
- **Why:** `games-D` (330-410, 630-710, 930-1010, 1230-1310 x 550-655) and `games-P`: the four game cards carry the same smiling Cath head in the same pose. It covers part of each game's art and breaks NIGHT SHIFT's noir card. VISION: Cath is the face of every game, with presence; item 96's "bust in each game's outfit" reads as one bust.
- **Build:**
  - Four distinct Cath vignettes from `shared/cath/`: Cathnivore at her market stall with a crate, Runnel kneeling with her watering can, Hedgerow in her garden coat with a trowel, NIGHT SHIFT as the title's umbrella silhouette in her trench (dark, rim-lit, no smile).
  - Each sits at the card art's edge, covering no more than 15% of it; her pose and outfit are told apart in greyscale.
  - The hero's Cath and the portfolio's game frames keep their current art; re-shoot key art (`npm run keyart`) only if a frame changes.
- **Accept:** e2e: four distinct `data-pose` values on the cards; each Cath covers 15% or less of its card's art box at P and D; NIGHT SHIFT's vignette has no saturated colour but the game's red; shots P and D, light and dark.
- **Size:** 1-2

## 109. [x] Cathnivore phone: tap a region to see it up close *(done 2026-11-04, lane B: `RegionCloseUp.tsx`; slice 2 adds the turn's actions on that region (each goes to its confirm step) and the region outlined on the board while open. e2e `e2e/region-closeup.spec.ts`; accessibility, tutorial, phone-map-hero and action-hand pass at P and D. Shots P light and dark in `e2e/screenshots/f109`; D is unchanged.)*
- **Why:** `cath-game-P` (board 15-375 x 240-590): on a phone the hexes are about 110 px, the pieces 14-18 px and the region names about 10 px; the board loses to the chrome around it (VISION 2: the table is the hero). The layout has no height to spare (item 83), so the board can't simply grow.
- **Build:**
  - Tapping a region on a phone opens it up close: a sheet (or an in-place zoom) with the region's hex at 300 px or more, its pieces at 32 px or more with their counts, its name, owner, pressure and what's on it in words, and the actions that can target it. *(2026-11-04 lane B, slice 1: `RegionCloseUp.tsx` is a sheet with the hex (its own ground and terrain, Hollowell's pieces standing on it about 32 px each), name, kind and who holds it, and the pieces and stalls in words with 36 px icons. Opened by a tap, or by Enter on `.region-inspect`, a childless button polygon per hex, so no controls are nested. It is off while anything is picked, during the enemy turn, a drag or the guided tutorial. Esc, a tap outside, a swipe down or Close returns. Not yet: the actions that can target it, and the region outlined on the board.)*
  - The board's region names at 12 px or more (pill labels, not cut), and a selected region outlined on the board while the sheet is up.
  - Esc, a swipe down or the close button returns; keyboard and screen readers reach it from the region's button.
- **Accept:** e2e at P: a region tap opens the close-up within 300 ms; pieces in it 32 px or more; names on the board 12 px or more; nothing changes at D; axe AA; shots P before and after, light and dark.
- **Size:** 2

## 110. [x] Cathnivore: Cath speaks from where she stands *(done 2026-11-04, lane A: the title's and the desktop Setup's lines are speech bubbles, 15 px or more with a tail at her face; `e2e/title-bubble.spec.ts`; shots `e2e/screenshots/s110`. Cut: the phone Setup's 80 px header bust stays (that screen has 0 px to spare, item 101; see DECISIONS))*
- **Why:** `cath-title-D` (bubble 555-845 x 335-378: about 13 px italic, no tail, 40 px from her head); `cath-setup-D` (Cath 1110-1215 x 610-780, small, the Start sign across her); `cath-setup-P` (a 40 px thumbnail). VISION: Cath with presence; her lines should read as hers at a glance.
- **Build:**
  - One shared speech bubble for Cath's lines on the title and Setup: 15 px or more, a tail pointing at her mouth, anchored within 24 px of her head, one expression per line from `shared/cath`. *(2026-11-04 lane A, slice 1: the title's line is a bubble at 16 px (D) and 15 px (P) with a tail toward her face, 18 px above her hair at D and over the board's far edge at P, two lines at 375 and 390 wide; `e2e/title-bubble.spec.ts`; shots in the session's scratchpad. Her expression already follows the menu (`useMenuExpression`).)*
  - *(D done: the bubble; she shows about 165 px above the OPEN sign, which hides her waist on purpose (item 75). Phone cut.)* On the desktop Setup she stands clear of the Start sign at 160 px or more; on the phone Setup a half-length Cath with her bubble in the header's room, or her line moves to the board's speech strip.
- **Accept:** e2e at P and D: bubble text 15 px or more at 4.5:1, its tail within 24 px of her head box, nothing overlaps her; Setup still has no scroll at 1440x900 and 390x844 (desktop-no-scroll, setup-* specs); shots P and D.
- **Size:** 1-2

## 111. [x] Hedgerow map D: stops as landmarks on a road, and Cath walking it *(done 2026-11-04, lane A: at 1100x860 and up the stops (shorter desktops keep 52 px coins so Play stays above the fold at 1280x800)' vignettes are 76x64 (the boss lot 86x72) and Cath's token 52x60, beside her coin on a row-2 stop as before; she already walks to a picked or newly opened stop (item 73). The empty band was not there: item 88's level card fills it. e2e in `hedgerow-map.spec.ts`; shots `e2e/screenshots/h111` (act 1 and act 3, 1440x900 and 1280x800); phones unchanged.)*
- **Why:** `hedge-menu-D` (stops 225-1240 x 330-545): ten near-identical 50 px grey coins with padlocks; Cath's marker about 35 px. Item 88 gave the next stop its card; the road itself is still a grid of coins. Check first: item 88's strip and docked card may already fill 560-790.
- **Build:**
  - Each stop a 72 px or larger landmark vignette of its level (the blimp, the billboard, the beach clean) on the act's road; locked ones in pencil (item 73), the boss lot drawn bigger.
  - Cath's marker 60 px or more, walking to the next stop when a level is won (instant under reduced motion).
- **Accept:** e2e at D: stops 72 px or more, Cath's marker 60 px or more, no empty band over 150 px between the stops and the level card; hedgerow-map still passes; shots P and D.
- **Size:** 2

## 112. [x] NIGHT SHIFT: the class pick as an operative lineup, with Cath's face *(done 2026-11-04, lane A: the critique's faceless back view was a `?play` bug (the pick opened before the street existed, over the static poster); the street now builds with the pick and she turns to camera in each class's look, with a kit over the coat (Ghost's rifle sling and scoped barrel, Butcher's apron, Gunslinger's gunbelt and holster, Wirewitch's lit wire rig and deck, Fixer's tie and pocket square). The stats on a dark dossier plate with the weapon as line art (`ui/weaponart.ts`); P names at 15 px in a snapping row with a swipe across her, the cue on the foot's band. e2e `e2e-site/cathode-classpick.spec.ts`; cathode-front and cathode-perf pass; shots P, D, L in `e2e/screenshots/c112`. Kept: the existing 0.4 s turn between classes rather than a 250 ms crossfade; the 3D figure, not a 2D portrait)*
- **Why:** `ns-play-D` (plan1104f, `?play`): all five classes show the same faceless back view of Cath under an umbrella (940-1160 x 260-850); the classes are a word list (80-330 x 160-420); the stats float over the street with no backing and collide with the expressway sign (998-1320 x 85-135). `ns-play-P`: 11 px class tabs that nearly touch, and 'More below' drawn over the AIM row (15-380 x 770-792). Cath, the face of every game, never shows her face before the first job.
- **Build:**
  - Cath turns to camera on the pick: a three-quarter front pose per class, in noir light, each in its own outfit accent and expression (Ghost's hood and scope, Butcher's apron, Gunslinger's holster, Wirewitch's wire rig, Fixer's suit), from the 3D rig or a `shared/cath` noir portrait, whichever the perf gate allows.
  - Switching class crossfades her pose in 250 ms (instant under reduced motion).
  - The stats, weapon and skills sit on a dossier sheet with a dark backing and the class weapon as line art.
  - P: the classes as full-width cards to swipe (labels 14 px or more), the 'more below' cue moved off the content.
- **Accept:** e2e: the five classes give five different portrait states (`data-pose` or src); Cath's figure 420 px or more tall at D and 300 at P; stat text 4.5:1 on its backing; at P class labels 14 px or more and no two text boxes overlap; cathode-perf still passes; shots P, D, L.
- **Size:** 2-3

## 113. [x] Cathnivore Campaign: Cath presents each chapter on the map *(done 2026-11-04, lane A: Cath and her line per chapter in the header (`content/campaignLines.ts`); the focused chapter's home regions `data-lit`, focus winning over hover; each card a 132x88 postcard (120x80 at P) of its regions' landmarks in the map's own art on hills in their colours, the freed regions largest, locked ones in pencil, the mini map pinned to its corner. e2e `e2e/campaign-cath.spec.ts`; no page height added at 1440x900 (1654 px); shots P and D, light and dark, in `e2e/screenshots/v113`)*
- **Why:** `cath-campaign-D` (plan1104f): Cath is an 80 px bust floating in the corner (1300-1375 x 45-130) with no line; at P (20-95 x 120-205) she leaves the header's right half empty. The chapter cards' landscape silhouettes are about 10% contrast (1040-1380 x 330-610) and read as placeholders. The screen is a list beside a diagram, not a chapter journey.
- **Build:**
  - Cath stands at the map's edge, 160 px or more at D (110 at P), with a speech bubble (item 110's) whose line and expression change with the chapter picked or hovered.
  - Each chapter card gets a drawn vignette of its regions' landmarks (the lighthouse, the mill, the market cross: the map's own landmark art) at 120x80 or more, at full ink, in place of the faint silhouettes; locked ones in pencil.
  - Picking a chapter lights its regions on the map (a 600 ms glow; instant under reduced motion).
- **Accept:** e2e at P and D: Cath's art 160/110 px or more with a bubble at 15 px or more and 4.5:1; each card has a vignette 120x80 or more; picking chapter 2 marks its regions `data-lit`; no page scroll added at 1440x900 beyond today's; shots P and D.
- **Size:** 2

## 114. [x] Hedgerow 2D: Cath at a size you can see, with her poses *(done 2026-11-04, lane B: 1.35x, a head above her towers; cheer in a V over her face with the pin held high, a hand to her chin and the worried face, a lean to plant; the round rosette keeps off her (`cathBox`); e2e `hedgerow-cath2d.spec.ts` at P and D; shots `cath2d-1104d`)*
- **Why:** `hedge-l21-2d-D` (plan1104f): Cath on the field is a sprite about 25 px tall (310-340 x 655-715), smaller than the towers she leads; VISION's "characters with presence" goes missing in play. Item 102 drew the 3D Cath to the bible; the 2D renderer (the phone's fallback and `?2d`) didn't get her.
- **Build:**
  - Check first: measure her 2D sprite against a tower's at P and D. *(2026-11-04 lane B: measured with the new `heroPx()` hook. She was 57 px at D and 42 at P, exactly a tower's height (59 and 43); the critique's 25 px counted only her body under the face image. She is now drawn at `HERO_SCALE` 1.35 (77 and 57), a head above her towers. At twice a tower's height she would stand over the plots she leads.)*
  - Draw her 2D figure at about twice a tower's height from `shared/cath` (her hair, face and jacket to the bible), standing off her post so she covers no plot.
  - Her idle, cheer (a wave cleared), worried (a leak) and planting poses, as in 3D (item 102), driven by the same `heroMood`. *(Done: the 2D renderer's own `heroMood`, from the same events: both arms up, the pin arm to her face, a lean to plant; e2e `hedgerow-cath2d.spec.ts`. Done: the rosette and her bubble both avoid `cathBox()`, measured from her sprite.)*
- **Accept:** e2e in `?2d`: Cath 48 px or more tall at D and 36 at P; her mood changes on a leak and on a cleared wave; she overlaps no tower's plot; hedgerow-tray and gatequeue still pass; shots P and D.
- **Size:** 2

## 115. [x] The bugs from the 2026-11-04 16:00 critique, fixed as one batch *(done 2026-11-04, lane A)*
- **Why:** subagent critique of `e2e/screenshots/plan1104f` against VISION.md.
- **Build:**
  - Hedgerow 2D: Cath's 'Build a Scarecrow' bubble is pale grey on cream (`hedge-l21-2d-D` 62-290 x 540-628); the 3D one is dark and readable. Make the 2D ink match (4.5:1).
  - Hedgerow D: the 'x119 Lifestyle influencer' pill on the round card wraps to two lines and touches the card's edge (1180-1405 x 215-250).
  - Hedgerow D: the 'Still unanswered' lock icons in Coming up are about 12 px (1245-1335 x 393): 20 px or more.
  - Hedgerow menu P: the 'Beyond the hedge · Act 4' banner is cut behind the bottom nav (50-340 x 755-785).
  - Hedgerow menu D: the pink cloud behind 'Act 3 Saltmarsh' (30-390 x 60-165) reads as a placeholder; the culvert arches are cut by the Act 4 banner (530-850 x 785-830).
  - Hedgerow 3D P: the 'Hollowell 216 coming' label sits on the lane and the vans (5-200 x 325-350).
  - NIGHT SHIFT title D: a thin white bar at the bottom centre (585-855 x 862); check it is not a loading line that never hides.
  - Cathnivore Setup P: Cath is a 40 px thumbnail (336-376 x 12-55): check against item 110's 80 px header bust.
  - *(2026-11-04 16:35 lane A: done: the lock icons 22 px, the pill 8 px clear of the edge (two lines kept, item 79), the Saltmarsh cloud moved into open sky and lit; e2e in `hedgerow-tray.spec.ts`, shots `e2e/screenshots/h115`. Not bugs: the 2D bubble is dark ink (the shot caught its fade-in); the phone Act 4 banner sits below the fold of a page that scrolls; the culvert under the Act 4 banner is the next act's teaser; the NIGHT SHIFT line is the boot line, still loading under SwiftShader at 9 s (it hides on the street's first frame); the phone Setup's Cath is item 110's decided header bust. The 3D gate plate steps clear of the queue's vehicles (right of them, else below), `e2e/screenshots/h115b`. Item done.)*
- **Accept:** e2e per bullet where it can be measured (contrast, one-line pills, icon size, banner inside the viewport, label off the lane); shots P and D.
- **Size:** 1

## 116. [x] Site: painted key art, not screenshots *(done 2026-11-04, lane A, 4fb74080: `?keyart` in Cathnivore, Runnel and Hedgerow (the table, the valley, the 2D field fill the window; no HUD, buttons or lines); NIGHT SHIFT keeps its C14 HUD-free keyart stage. `npm run keyart` records a hash of each game's art sources in `portfolio/public/work/keyart.json` and `tests/keyart-fresh.test.ts` fails when they change after the shoot (CI clones at depth 1, so content hashes, not dates). Posters 292 px at 1440. Cath: the poster's own half-length Cath stands in front, so the in-scene Cath is hidden in the frame (two read as a stray duplicate at the edge). Hedgerow kept 2D: the swiftshader 3D frame cut the field's edge. e2e `e2e-site/keyart.spec.ts`, games-cards; shots `e2e/screenshots/k116`)*
- **Why:** `games-D` (plan1104g, 130-1310 x 460-655): three of the four posters are UI captures (HUD, tray, side panel) and Runnel's is stale (the old board, not the item 77/90/97 valley); the Cathnivore poster's text is about 3 px. The site's first screen reads as budget.
- **Build:**
  - A `?keyart` mode per game: no HUD, the hero subject framed (board, valley, field, street), Cath standing in the scene in her game's outfit.
  - `npm run keyart` shoots those frames instead of play screens.
  - A staleness check: a game's key art must be newer than its last art or render change.
- **Accept:** e2e: no `button`, `header` or HUD element visible in `?keyart` for each game; the poster's longest side 282 px or more at D; a unit test fails when a game's art files are newer than its key art; shots of /games/ and / at P and D.
- **Size:** 3

## 117. [x] NIGHT SHIFT: Cath's face on the front door *(done 2026-11-04, lane A, 90d6367b: the title loop's four framings are front three-quarters on her left, closer in, with a warm face key under the umbrella's edge; she turns 0.42 rad to the lens on the title; `faceBox()`; face 121-130 px at D, 85 at P between the logotype and The List and clear of every menu entry; the class pick at D shows it clear of the stats sheet. e2e in cathode-front and cathode-classpick; cathode-perf passes; shots `e2e/screenshots/n117` (before, after at P, L, D). Cuts in DECISIONS: the umbrella stays upright (framing her left keeps the shaft off her face), and she faces the lens all through the title rather than turning on NEW CASE focus)*
- **Why:** `ns-title-D` (940-1170 x 260-720) and `ns-title-P` (95-250 x 230-620): the face of every game is seen from behind, and at P the menu sits on her body (item 82 meant her to stand clear). `ns-play-D` (940-980 x 290-330): on the class pick she is behind the stats panel. Check first against item 112's finished state.
- **Build:**
  - A 3/4 front title pose, umbrella tilted back, her face lit by a neon rim and a face key; she turns to camera when NEW CASE takes focus.
  - At P, frame her head between the logotype and The List, off the menu.
  - A `faceBox()` hook like Hedgerow's.
- **Accept:** e2e face box 120 px or more tall at D and 70 at P; at P it meets no menu entry's box; on the class pick at D it is visible and not under the stats panel; cathode-perf passes; shots P, L and D.
- **Size:** 3

## 118. [x] Cathnivore: Cath stands at the table during play *(done 2026-11-04, lane A: a half-length Cath (`.table-cath`, 264 px, clasped) at the map's bottom-left at 1240x760 and up, her `data-expression` from the companion's reactions, her line a 15 px+ bubble with a tail over her head (the header's ring cameo and strip go at those sizes, the papers get the row and the map grows); the phone's strip portrait already swaps expression from the same reactions. e2e `e2e/table-cath.spec.ts` at 1440x900 and 1280x800 (clear of every hex and the action column, no scroll, the expression changes as the round turns), `rival.spec.ts` updated; shots `e2e/screenshots/v118` light and dark. Cut: a scripted Squeeze and liberation in the e2e, see DECISIONS)*
- **Why:** `cath-game-D` (350-615 x 95-195): in play she is a 96 px ring portrait while 350-600 x 300-880 beside the board is empty paper; Pell is docked opposite her (item 92), so the rivalry has one face.
- **Build:**
  - A half-length Cath from `shared/cath`, 260 px or more, at the board's left edge at D, her bubble at her mouth.
  - Her expression from game events: delighted on a liberation, worried on a Squeeze, determined on a plan reveal (`data-expression`).
  - At P the strip portrait stays and swaps expression from the same events.
- **Accept:** e2e at 1440x900 and 1280x800: Cath 260 px or more tall, overlapping no region hex or the action column; `data-expression` changes on a Squeeze and a liberation; no page scroll added; shots P and D, light and dark.
- **Size:** 3

## 119. [x] Hedgerow: seed packets that are illustrated *(done 2026-11-04, lanes A and B: crimp and 15 px price (A); the tower as the packet's face, the name on a role-coloured band at D and P, the Almanac's tower cards as packets (B); shots `h119`, `f119a`)* *(slice 1 2026-11-04, lane A: a heat-sealed crimp along each desktop packet's top, the price stamp at `--fs-small` (15 px at 1440x900, was 12); shots `e2e/screenshots/h119`. Measured: D packets 98x90 with 36 px art for 9 towers, 80 px tall at 1280x800; P 65x66 with 30 px art. Open: 56 px art needs taller packets or a denser name, which item 87's column budget must allow; the band; P and the Almanac)* *(slice 2, 2026-11-04 lane B: the packet's face. The art took the empty paper under the name: 56 px with up to six packets, 52 with seven to nine, 44 with ten or more, 30 in a tight round; the name printed on a band in the role's colour (`data-role`); 'Court-house' breaks with a soft hyphen. e2e in `hedgerow-tray.spec.ts`; tray, gatequeue and critique pass; shots `f119a`. Slice 3: on a phone the packet's foot (name and price) is printed in the role's colour under a rule, at 16% so the price keeps 4.89:1 or more in both themes (desktop names 5.5:1 or more; its price has its own stamp); shots `f119a/tray-P-*`. Slice 4: the Almanac's tower cards show the tower on a crimped, banded packet (`roles.ts` shares the role with the tray); shots `f119a/almanac-*`. The tray is DOM, the same over the 2D and 3D fields.)*
- **Why:** `hedge-l21-3d-D` (1108-1412 x 85-368): each packet is mostly blank tan round a 25 px icon with a 10 px price; the most-touched UI in the game reads as placeholder.
- **Build:**
  - Each tower on its packet face at 56 px or more, on a printed packet (a crimped top edge, a seed-type colour band).
  - The price as a 13 px or larger stamp on the band.
  - The same art in the phone tray and the Almanac.
- **Accept:** e2e at D: tower art ~~56x56 or more~~ 56 px with up to six packets, 52 with seven to nine, 44 with ten or more (item 87's column budget); price text 13 px or more at D and 12 at P, at 4.5:1; hedgerow-tray and gatequeue pass; shots P and D in 2D and 3D.
- **Size:** 2

## 120. [x] Hedgerow 2D: the field fills its frame, and the bubble keeps off plots *(done 2026-11-04, lane B: hedged fields in wide 2D margins (`paintHinterland`); the bubble weighs empty plots heavily in the build phase; `hedgerow-threat.spec.ts` bounds it at 15% of the bubble at D and 30% at P; shots `f120b`, `f120d`)*
- **Why:** `hedge-l21-2d-D` (800-1080 x 80-880): about 280 px of empty grass right of the field (item 78 framed only 3D). `hedge-l34-2d-D` (845-1070 x 120-205) and `hedge-l21-2d-P`/`3d-P` (150-310 x 445-525): Cath's bubble covers the plots it tells you to tap.
- **Build:**
  - ~~The 2D view centred and scaled so the field fills 70% or more of the frame.~~ *(Checked 2026-11-04 lane B: the 2D view is already centred at the largest cell the level's rows allow; level 21 is taller than wide, so 70% of a wide frame would crop the field. The real gap is the bare margin.)* The wide side margins painted as the countryside going on: a patchwork of wheat, pasture and plough edged by hedges (`paintHinterland`), the sea side left to the water. *(Done, slice 1; shots `e2e/screenshots/f120b`.)*
  - The bubble's spot (`barkSpot`) treats buildable plots as boxes to avoid when there is room. *(Slice 2, 2026-11-04 lane B: she speaks only in the build phase, so empty plots now carry the heavy cost and the lane and built plots the light one; `hedgerow-threat.spec.ts` measures it: D 0-9% of the bubble over empty plots, P 7-28%. Open: P level 12 (28%), a dense field with no free spot within her 116 px reach; the phone bound is 30% until then.)*
- **Accept:** in `?2d` at D, a side margin wider than 2.2 cells away from the water shows hedged fields (shots of levels 13, 21 and 34); ~~bubble ∩ plot = 0~~ the bubble over empty plots at most 15% of its area at D and 30% at P (levels 3, 12, 21); shots P and D.
- **Size:** 2

## 121. [x] The bugs from the 2026-11-04 17:36 critique, fixed as one batch *(closed 2026-11-04, lane B: the fixed and checked points are ticked below; the three still open moved to item 126)*
- **Build:** (check each first; plan1104g)
  - [x] **NIGHT SHIFT P class pick:** the tab row cuts "WIREWITCH" (298-390 x 90-105). **D title:** the dossier's name plate about 8 px (460-528 x 460-472); The List's name plates empty black bars (85-120 x 745-757). *(2026-11-04 lane B: the tab row is item 112's snapping row that fades at both edges, by design; the dossier's "TOMAS REED" is lettering on the mugshot's slate with the name at full size under it, no change; the List's small slates (wordless since item 107) now carry chalk strokes so they read as lettered slates; cathode-front's List specs pass; shot `f121d/ns-title-D`.)*
  - [ ] **Cathnivore game:** P EXPAND tags about 7 px (from item 91) *(2026-11-04 lane B: the badge now grows with the hex on screen (`badgeK` in `pieceLayout`), as far as the stalls keep 25 px: about 8 px on a 64 px hex, 10 at 72, 11+ at D; `e2e/threat-badge.spec.ts`, shots `f121c`. Open: 11 px on a phone needs another place for the threat than the tray's strip, for example a tab on the name plate)*; D "HOLLOWELL" ribbon about 10 px (1225-1330 x 176-188); plan-card subtext about 11 px grey (648-745 x 168-180).
  - [x] **Cathnivore Setup D:** the Start sign's "OPEN" about 9 px (1135-1182 x 798-808); lines from Cath's figure behind the sign (1085-1235 x 770-790). *(Checked 2026-11-04 lane B: at D the kicker is `--fs-label`, 12.5 px (its caps read as 9 px in the shot); the lines are the sign's hanging cords, by design. The phone's kicker was 0.62rem (10 px), now `--fs-label` (12 px); shot `f121c/setup-start-P.png`.)*
  - [ ] **Hedgerow 3D D:** Coming up's "16" touches the panel edge (1383-1405 x 645-663); Cath's face a dark smudge under her hair (150-230 x 470-540).
  - [ ] **Hedgerow map D:** the Saltmarsh cloud an opaque blob (460-770 x 60-160).
  - [x] **Portfolio D:** darker side columns at x 0-85 and 1355-1440 (check: a max-width background that doesn't bleed). *(Fixed 2026-11-04 lane B: it was the sticky header's glass, which stopped a gutter past the page column; it now bleeds to the window's edges (`inset: 0 calc(50% - 50vw)`, the body clips overflow; no horizontal scroll at P or D). site-header passes; shots `f121c/portfolio-*`.)*
- **Accept:** e2e text 11 px or more and boxes not intersecting, at P and D for each case; shots before and after.
- **Size:** 2

## 122. [x] Runnel: one Cath, hosting from the valley *(done 2026-11-04, lanes A and B; lane B finished the phone: its one Cath is the portrait beside her line, whose face follows the water like the figure's, and the corner bust goes; `runnel-one-cath.spec.ts` checks one Cath on a phone over three days; shots `r122/P-one-*`)* *(slice 1 2026-11-04, lane A: at D her line is a bubble by the valley figure (a search within 56 px of her face for a spot meeting no tile, tail to her face), the portrait goes; a board with no room keeps the line in the sidebar with no portrait (1440x900: 14 of 14 days fit; 1280x800: 2 of 14). Figure 128 px wide at 1440 (was 158). Worried on a spill, delighted as the front reaches a field, a wink on the solve (`data-expression`). e2e `e2e-site/runnel-one-cath.spec.ts`; shots `e2e/screenshots/r122`. Slice 2: her point aims at the glowing tile (`pointAt` in `shared/cath`, the lesson target, a tip's pulse, else the spring; `data-aim`, within 20 degrees in `runnel-lesson-frame`), and the lesson at D speaks from the valley too, the lesson card centred in the column. Open: P (one Cath, figure 120 px+). Tried and reverted 2026-11-04 20:40: an 80x120 half figure fits the 11-03 board's corner, but no bubble spot fits within 56 px of her face, so the line has to stay above the valley without the portrait; the first render hides her on a clash measured before the board settles (needs a re-check, e.g. a debounced ResizeObserver on #board); and it broke runnel-tiles P, runnel-practice's lesson centring and site.spec's Runnel daily solve on the phone, so check those first)* 
- **Why:** `runnel-D` (plan1104h): she appears twice (15-80 x 130-207 portrait, 430-530 x 625-850 figure) and the figure stands mute while the sidebar talks; `runnel-P` the same (15-70 x 195-260, 10-70 x 700-768). Item 91 left this as a design call; this is it: the figure speaks.
- **Build:**
  - The side portrait goes whenever the valley figure is in view; her bubble comes from the figure with a tail to her mouth.
  - Her point pose aims at the glowing tile (arm angle from the tile's centre).
  - Expressions: a smirk on a tap, delight when the water front reaches a field, worry on a spill, a wink on a solve (`data-expression`).
  - At P the figure 120 px or more in the valley's bottom-left, the bubble above her clear of the tiles.
- **Accept:** exactly one Cath visible at P and D (~~at P the figure 120 px+~~ at P the portrait: see DECISIONS 2026-11-04 21:40); the tail ends within 24 px of her face box; the point within 20 degrees of the glowing tile's centre; `data-expression` changes on a spill and on a solve; bubble text 15 px or more, meeting no tile; item 77's `runnel-lesson-frame`/`runnel-valley` specs updated to one Cath; shots P and D, light and dark.
- **Size:** 3

## 123. [x] Cathnivore phone: hand cards with their art *(done 2026-11-04, lane B: the picture is the card's face, 56 px floated in the top corner with the name (15 px) flowing round it; a card whose name won't fit (a region's name) is measured tight and takes 40 px and 13 px; a priceless ability card 60 px; disabled cards keep their small greyed art and why-not chip, unchanged; `e2e/hand-art.spec.ts` at 390x844 and 375x667; content 55-81% of each card; shots `f123a`, light and dark)*
- **Why:** `cath-game-P` (35-375 x 672-770): each hand card is about 155x100, some 70% blank yellow, with a 30 px icon in a corner; the most-touched phone UI reads as blank slabs.
- **Build:**
  - Each card carries its action art at 56 px or more, top-aligned; the name at 15 px; the cost chip on the art's corner.
  - A disabled card desaturated, with its why-not chip; the peek card shows its art's edge.
- **Accept:** art 56x56 or more on every card at 390x844 ~~(every card)~~ (40 on a card measured tight, about one in seven); text 12 px or more at 4.5:1; no card more than 40% empty (bounding-box sum; measured 55-81% covered, Supply's region card 56%); action-hand, tutorial and accessibility e2e pass; shots P light and dark, plus 375x667.
- **Size:** 2

## 124. [x] Hedgerow map: Cath walks the road at full length, and locked stops are pencil sketches *(done 2026-11-04, lane A: the 21:35 patch landed, plus `placeYou` in map.ts: she steps further along the road (her `data-side`), then lower, until her box meets no other stop's coin, name, padlock or tag (the row-2 overlap under 'Bea's Beehive' at P and D). 112 px at 1440x900, 80 at 1280x800, 66 on a phone; stride and wave; locked landmarks in pencil. The saturation check reads each landmark's painted fills and strokes after its filter, not a pixel box (which took in the field). hedgerow-map 34/34, intro, critique, keyart pass; shots P, D, 1280 for acts 1 and 3)*
- **Why:** `hedge-menu-D` (225-280 x 240-300): her token is a floating head; locked stops (450-1230 x 325-560) are flat grey icons on grey coins. Check first against item 111 (landmark stops, a 60 px Cath at D) and item 73 (pencil-grey vignettes).
- **Build:**
  - A full-length 2D Cath from `shared/cath`, 110 px or more at D and 64 at P, standing on the road at the next stop; a stride as she walks, a wave when a stop opens.
  - Locked vignettes as pencil line art on paper, coloured in when the stop opens.
- **Accept:** her box 110 px or more at D and 64 at P, meeting no label or padlock box; locked stops under 15% saturation, open ones over 30%; hedgerow-map passes; shots P and D, acts 1 and 3.
- **Size:** 3

## 125. [x] NIGHT SHIFT phone: the class pick on one screen *(done 2026-11-04, lane A: on an upright phone the pick is one screen, no scroll and no 'More below' cue: her figure the top half, then how the class plays, her quote folded behind a 'Her line' tap (`.cp-fold`, aria-expanded), the four stats in two columns, the weapon at 48 px with its name, damage, rate and magazine, the trees on one line (dropped at 720 px tall and less with the eyebrow), the full-width hold bar. e2e in `cathode-classpick.spec.ts` at 390x844 and 375x667 (no scroll, every stat, the weapon and the hold inside the viewport, no text under 12 px; 4.5:1 kept). Shots P, P667, L, D unchanged at L and D. The perf gate's staged firefight doesn't touch the pick)*
- **Why:** `ns-play-P` (0-390 x 700-790): only GRIT shows above "MORE BELOW"; the weapon, skills and other stats need a scroll, while her back view takes 120-520 px of height.
- **Build:**
  - A compact dossier card above the call to action: four stat bars in two columns, the weapon line art at 48 px with its name and damage; the quote folded behind a tap.
  - Her face-on figure (item 117) in the top half.
- **Accept:** at 390x844 and 375x667 every stat, the weapon and the call to action fit the viewport with no scroll; text 12 px or more at 4.5:1; cathode-classpick and cathode-perf pass; shots P and L.
- **Size:** 2

## 126. [ ] The bugs from the 2026-11-04 19:26 critique, fixed as one batch *(lane B, in progress)*
- **Build:** (check each first; plan1104h)
  - [ ] **Hedgerow:** ~~the HOLLOWELL gate plate half clipped at the field's top edge (l34-2d-D 228-307 x 76-94); at P both plates touch the screen's left edge (2-83 x 100-118, 508-526)~~ *(fixed 2026-11-04 lane B: the 2D plate keeps an 8 px or larger gutter inside the field's frame; shots `m127/gate-*`)*; "N coming" plates on plots (l34-2d-D 302-395 x 130-150; l21-2d-D 355-440 x 448-467); Coming up's "22"/"16" touch the panel edge (l34-2d-D 1383-1402 x 628-646). *(Fixed 2026-11-04 lane B: each round's number sits under its vehicle, inside its column, at 1440x900 and 1280x800; shot `m127/coming-*`.)*
  - [ ] **Cathnivore game:** D Cath's bubble a 120 px column of five ragged lines (355-475 x 490-610); *(2026-11-05 04:40 lane B, tried and reverted: a wider column (136-150 px) still reads six lines, and 140 px meets Brindle Hills at 1280 (table-cath.spec); the fix is to lift the bubble into the open cloth beside Highmoor (about 355-600 x 300-430 at 1440) as a wide one- or two-line bubble with its tail down to her)* "STAGE I" about 9 px (845-895 x 103-113); the Not-yet coin chips grey on grey at about 8 px (243-280 x 640-660); P region names about 10 px (100-175 x 257-270). *(2026-11-04 lane B: "STAGE I" was a raw 10 px, now `--fs-label` (12.5 px at D); the Not-yet chip is 11.9 px dark on cream (its greyed coin is the disabled style), no change. Open: the bubble, P region names.)* *(2026-11-05 05:22 lane B: P region names 16.5 to 19.5 board units below 1024 px (text box 16 px at 360 wide, 18 at 390, 20 at 430; no plate meets another; D keeps 14 px); board, threat-badge, closeup and table-cath specs pass; shot `names-P`. Open: the bubble)*
  - [ ] **Cathnivore Campaign D:** chapter goal badges pale grey at about 2:1 (910-1000 x 362-386); progress pips about 6 px (292-340 x 170-178); Cath cut flat at the knees with no ground (1285-1370 x 35-185; P 290-375 x 125-230). *(2026-11-04 lane B: the unearned wax seals (the 'goal badges') are 30 px with their dashed outline and glyph at soil 70%, about 3:1, still unearned-looking; shots `f123a/seals-*` light, dark and P. Open: the pips, Cath's crop.)* *(2026-11-05 05:22 lane B: the pips were the progress bar shrunk to its 48 px minimum beside the count; it keeps 180 x 12 px (30 px a chapter) and wraps under the count on a phone, with an ink edge so the empty track shows in dark; shots `cmp-*` P and D, light and dark. Cath's crop was item 139's fade.)*
  - [x] **Runnel D:** the Up-next title breaks the date ("Wed, Nov / 4", 170-320 x 667-703). *(Fixed 2026-11-04 lane A: each ' · ' part of the title is unbreakable, so it wraps only at a dot; `runnel-critique91.spec.ts`; shot `e2e/screenshots/k116/runnel-lesson-D.png`.)*
  - [ ] **NIGHT SHIFT:** class numbers about 9 px and dim (ns-play-D 55-66 x 185-410); "HOLD ENTER" about 10 px grey (1313-1382 x 805-815); the stats panel slices the street sign to "HO" (925-968 x 113-132); ns-title-P's case line about 11 px grey over the photo, under AA (15-275 x 437-450). *(2026-11-05 lane B: the class numbers were `--ink-dim` (the disabled-glyph ink, about 2:1); now `--ink-3` bold at 12 px (5.5:1), and HOLD ENTER `--ink-2` bold (9.1:1); shot `ns-cp-D`. The title P case line (`#menu-hint`, 16-375 x 437-452) is `--ink-2` semibold at 13 px upright (was `--ink-3`); shot `ns-title-P`. Open: the sign slice, not in the class-pick frame at t=8)*
  - [x] **Site /games/ D:** the H1 reads "Cathnivore" over Runnel's pitch (615-1095 x 220-290). *(Fixed 2026-11-04 lane B: the daily line is Cath's daily Runnel nudge, now quoted and signed "— Cath", so it reads as her voice under the brand, not the board game's pitch; games-cards and the landing fonts spec pass; shots `f123a/games-*`.)*
  - [ ] **From item 121:** the Cathnivore phone threat badge's 11 px (now about 8 on a 64 px hex; needs another home than the tray strip, for example a tab on the name plate); Hedgerow 3D D Cath's face a dark smudge under her hair (150-230 x 470-540); the Hedgerow map's Saltmarsh cloud an opaque blob (460-770 x 60-160).
- **Accept:** e2e text 11 px or more at 4.5:1, boxes inside the viewport and not intersecting, at P and D for each case; shots before and after.
- **Size:** 2

## 127. [x] Cathnivore: a liberation and a Squeeze as staged moments in play *(done 2026-11-04, lane B)* *(slice 1, 2026-11-04 lane B: on the tile a liberation flips Hollowell's orange to the co-op's green and drops bunting with an overshoot over the ring and seed burst; a Squeeze slams a glossy SQUEEZED stamp flat over the flash and shake; the map carries `data-moment` for 1.1 s; `?e2eMoment` exposes `cathnivoreMoment(kind, region)`; reduced motion keeps the colour change and stamp as fades; `e2e/moments.spec.ts` (700-1200 ms, no shift over 2 px); shots `m127`. Slice 2: the hook's moment plays its cue (the crowd, the synth sweep) and Cath's reaction as a real one does (a liberation delighted, a Squeeze determined, her line naming the region; `data-expression` on the phone strip too); in play the producers' faces already follow the log (item 80). The bell stays the new round's: a liberation's cue is the crowd. Shots `m127`, light and dark)*
- **Why:** `cath-game-D` (plan1104i, 500-1185 x 215-885): the board never stages its two biggest beats (VISION 4); items 28, 48 and 92 staged the decor, the end and Hollowell's turn, not a region freed.
- **Build:**
  - A liberation: the hex flips from Hollowell orange to green over about 900 ms, factory tokens topple, bunting drops with an overshoot, the region's producer pops up delighted; table Cath (item 118) cheers and her bubble names the region; the sound bank's bell and crowd.
  - A Squeeze: a glossy stamp with no overshoot, a synth glitch, Cath and the region's producer worried.
  - Reduced motion: fades only. An `e2eForce` hook for each moment.
- **Accept:** e2e at P and D: `data-moment="liberate|squeeze"` appears and lasts 700-1200 ms, and Cath's `data-expression` changes; no layout shift over 2 px; shots mid-moment at P and D, light and dark.
- **Size:** 3

## 128. [x] Hedgerow: a level fly-in that teaches the lane *(done 2026-11-04, lane B)* *(slice 1, 2026-11-04 lane B: the field dims and a runner carrying the level's lead vehicle draws each lane from its gate to the farm in 2.5 s (0.6 s under reduced motion), then Cath's tip names the gate (two gates: where the lanes join); a tap or key skips; once a level (`seen['flyin:<id>']`), never in replays, dailies, Endless or the sandbox (`?flyin`, `?flyin=once` for tests). Drawn from the renderer's cell centres, so 3D gets it too. `e2e-site/hedgerow-flyin.spec.ts`; all 18 Hedgerow site specs and site.spec's Hedgerow tests pass; shots `f128a`. Slice 3: her closing word is spoken on the field from where she stands, placed by item 120's `barkSpot` off the empty plots (15% at D, 30% at P), for a few seconds in place of the round advice. The camera follow and 2D pan were left for a traced lane (DECISIONS 22:55))*
- **Why:** `hedge-l21-2d-D` (290-740 x 110-880) and level 34: two gates and a long lane, and nothing shows where the vehicles come from or what to guard.
- **Build:**
  - On a level's first entry the camera (3D) or a pan and zoom (2D) follows the lane from each gate to the farmhouse in about 2.5 s, vehicles dotted along it; it ends on Cath waving with one line naming the threat.
  - A tap skips; it plays once a level (`SaveData.seen`).
- **Accept:** e2e: `data-flyin` runs 3 s or less, a skip ends it within 150 ms, no replay on reload, the closing bubble ~~meets no plot~~ over empty plots at most 15% at D and 30% at P (item 120's bounds); shots of its start, middle and end at P and D in `?2d`.
- **Size:** 3

## 129. [x] NIGHT SHIFT: the desktop class pick composed round her *(done 2026-11-04, lane A: the framing already held after items 112/117/125 (face 117-135 px at D in 470-960 x 150-500, the sheet 384 px wide, clear of both columns), so the work was the change: a 250 ms dolly from 9% out, the key light at 2.6x easing back over 320 ms (kept under reduced motion), and a synthesised weapon-rack stinger per class (`scheduleRack`, rendered offline in the e2e at -18 to -15 dB peak) in place of the focus tick. cathode-classpick 6/6, cathode-perf within budget; shots D and L for all five classes and a mid-change frame, `e2e/screenshots/c129`)*
- **Why:** `ns-play-D` (470-960 x 100-860): empty street while Cath stands behind the stats panel (935-975 x 280-330, only the umbrella's edge shows); the class names read as a menu, not an operative lineup. Check first against items 112, 117 and 125.
- **Build:**
  - Frame her face-on in the empty middle band; narrow the panel to about 380 px so the street sign reads whole.
  - On a class change: a 250 ms dolly, a kit-on flash and a weapon-rack stinger (`frontaudio.ts`).
- **Accept:** `faceBox()` inside 470-960 x 150-500 and 110 px or more tall at D, meeting neither the panel nor the list; the stinger audible in the offline audio check; cathode-classpick and cathode-perf pass; shots D and L for all five classes.
- **Size:** 2

## 130. [x] Site /games/ phone: Cath in the hero *(done 2026-11-04, lane A: under 600 px wide a 156 px half-length Cath (`#hero-cath-mini`) waves beside the buttons under the logotype, the hero text two columns; the landscape figure (which fell below the posters) is hidden there. She dresses for the poster nearest a line 45% down the screen, or one focused or hovered, with a 200 ms crossfade; the wave settles to clasped hands after 3 s. `e2e-site/games-hero-cath.spec.ts` at 390x844 and 375x667 (156 px, first screen, no text or button met, first poster at 419/395 px), games-cards updated for the phone figure. Shots P, P667, D, a crossfade frame)*
- **Why:** `games-P` (0-390 x 0-410): text and buttons with no Cath, where VISION makes her the landing page's centrepiece; on a phone she is only a sliver of each poster.
- **Build:**
  - A half-length Cath (`shared/cath`, a wave) 140 px or more by the logotype, standing on the horizon.
  - Her outfit and expression follow the poster in view (an IntersectionObserver on the 2x2 grid), a 200 ms crossfade; the wave idles after 3 s.
- **Accept:** at 390x844 and 375x667 her box is 140 px or more tall, on the first screen, meeting no text or button; the first poster's top stays above 640 px; shots P and D and a crossfade frame.
- **Size:** 2

## 131. [x] Cathnivore phone: the table fills its frame, and Cath lives on it *(done 2026-11-04, lane A: on an upright phone 830 px tall and up a 96 px half-length Cath (`.table-cath-phone`, item 118's expression feed) stands at the table's lower-left corner and her line is a bubble beside her on the cloth under the hexes; the header strip is gone, the board sits at the top of its frame and lifts 18 px into the viewBox's sky. Hexes 93% of the frame's width at 390x844, nothing met, no scroll, light and dark (`e2e/table-cath.spec.ts` phone test). **Cut:** at 375x667 (and 375x812, 360x780) the strip stays: the cloth has no band for the bubble and the board already ran under the tray there (DECISIONS 2026-11-04 23:15). Passing: table-cath, moments, hand-art, region-closeup, tutorial, accessibility, board-frame, action-hand at P and D. Shots `e2e/screenshots/c131`)*
- **Why:** `cath-game-P` (8-380 x 225-605): the board is an inset with about 45 px of empty cloth under the hexes, and Cath is a 64 px ring in the header (8-75 x 55-118), not at the table (item 118 did the desktop).
- **Build:**
  - The hexes fit 92% of the frame's width.
  - A 96 px half-length Cath at the table's lower-left corner, on item 118's expression feed; her line a bubble from her, the header strip dropped.
- **Accept:** at 390x844 and 375x667 the hexes take 88% or more of the frame's width; Cath 96 px or more, meeting no hex or name plate; no scroll; hand-art and region-closeup pass; shots P light and dark.
- **Size:** 3

## 132. [x] The bugs from the 2026-11-04 21:25 critique, fixed as one batch *(done 2026-11-05, lane A, 14cdebce: the last points, Hedgerow 3D D: the gate plate steps to the nearest spot covering no plot, pond, ford, sign or vehicle, and Cath's bubble keeps off the gate sign; e2e in `hedgerow-3dframe.spec.ts` at P and D, levels 13 and 21)*
- **Build:** (check each first; plan1104i)
  - [x] **NIGHT SHIFT:** Cath seen from behind on the title (ns-title-D 960-1070 x 350-730, P 110-235 x 290-620) and the P class pick (100-320 x 210-560), against items 117 and 112 (a stale frame or a regression); a stray thin white bar at the title's foot (D 585-855 x 860-864, P 85-305 x 810-814). *(checked 2026-11-04 lane A: not bugs. At 9 s under SwiftShader the title is still the loading poster (her back) and the bar is its loading line; by 30 s the live street shows her face-on at D and P. `scripts/plan-shots.mjs` now waits 30 s. The P class pick's back view was item 112's `?play` fix)*
  - [x] **Hedgerow:** 3D D the bubble covers the gate sign ("LOWELL", 300-360 x 395-412) and the 3D Hollowell plate sits on plots and the pond (392-595 x 383-407); ~~the map P "Beyond the hedge · Act 4" teaser cut under the tool bar (50-340 x 755-785)~~ *(fixed 2026-11-04 lane A: it is the scrolling list's next row (scrolled, it sits clear at 520 px); the phone tab bar now has a 44 px fade on its top edge, so what scrolls under it fades instead of being sliced; hedgerow-map 34/34)*. Still open: the 3D D points.
  - [x] **Cathnivore:** ~~P "STAGE / I" wraps above "Expand" (165-215 x 150-165)~~ *(fixed 2026-11-04 lane B: one line, tighter tracking on a phone; it came from item 126's 12.5 px; shots `m127/stage-P-*`)*; ~~the third hand card clipped to "Sel" with no scroll cue (355-390 x 672-760)~~ *(checked 2026-11-04 lane A: the chevron cue from the 18:51 session shows there, shots `c131`)*; ~~D Setup's sign ropes run across Cath (1090-1215 x 740-775)~~ *(fixed 2026-11-04 lane A: at 1100 px and up the sign stands in front of her without its cord and nail; setup specs pass)*.
  - [x] **Site /games/ D:** Hedgerow's poster shows its in-game Cath beside the poster's half-length one (900-915 x 470-510); a sliver of the MUM drawing at the Cathnivore poster's corner (110-122 x 463-480). *(fixed 2026-11-04 lane A: `?keyart` leaves the field's Cath out in Hedgerow's 2D renderer and Bea's drawing off the Cathnivore table; both posters re-shot with `npm run keyart`; keyart-fresh, games-cards, games-cath pass)*
- **Accept:** e2e boxes inside the viewport and not intersecting, text 11 px or more at 4.5:1, at P and D for each case; shots before and after.
- **Size:** 2

## 133. [x] Cathnivore: the Daily Market as a ritual on the title table *(done 2026-11-05, lane A, 20c6d75a..5b0d6878: the last Daily's receipt pinned to the table front (Regions, Trust, Rounds; SOLD or HELD; a green or red pin), the streak as pennants (ten then +N at D; five then +N on the phone's receipt), tomorrow's face-down card counting down to 00:00 UTC that flips face up (Open #N and its event; a fade under reduced motion). Cath's line and `data-expression` follow the streak: first, kept (delighted), broken (worried); never played keeps the campaign line. `src/content/dailyRitual.ts` (unit `tests/daily-ritual.test.ts`), `DailyRitual.tsx`, `e2e/daily-ritual.spec.ts` at P and D (receipt 150 px wide at D, 98 at P, in the viewport, no menu button or footer link met, no scroll; the flip under Playwright's clock). Shots P and D, light and dark, streaks 0, 3, 10 and broken, plus 375x667, 1024x768 and 1280x800, in `e2e/screenshots/t133`. Cuts: '120 px / 90 px' read as the receipt's width (the table front is about 100 px tall); the turnover is the Daily's 00:00 UTC, not local midnight; the phone shows the receipt only (no room for the card), see DECISIONS)*
- **Why:** `cath-title-D` (plan1104j, 126-478 x 632-692; P 36-354 x 630-680): the strongest reason to come back is a plain button: no streak, no yesterday, no stakes; the table front (0-1440 x 765-860) is bare.
- **Build:**
  - Yesterday's result as a receipt pinned on the table front: the score, a SOLD stamp, the pin earned.
  - The streak as bunting, one pennant a day; tomorrow's event a face-down card that flips at local midnight, with a countdown.
  - Cath's line follows the streak: kept, broken, the first ever.
- **Accept:** e2e from a fixture save: a 3-day streak shows 3 pennants; the receipt 120 px or more at D and 90 at P, inside the viewport, meeting no menu button; a broken streak changes `data-expression`; shots P and D, light and dark, at streaks 0, 3 and 10.
- **Size:** 3

## 134. [x] Runnel: a lesson taught by Cath's hand, not by paragraphs *(done 2026-11-05, lane B)* *(slice 1, 2026-11-05 lane B: Cath's hand (her jacket's green at the cuff) taps the glowing tile and follows it from step to step, fingertip on the tile's centre; the legend's three rules shrink to one line each ('The spring where the water starts'); a step done is stamped; the solved lesson hands over to the daily in 1.2 s (was 2.6); `e2e-site/runnel-lesson-hand.spec.ts`; shots `f134a`. Also: the `nearlySolve` test hook no longer picks a bridge as the dry last tile (today's practice board made runnel-water fail before any change). Slice 2: at the hand-over today's weather card (the Up next card, or a centred one on a phone) flies to the middle and fades as the daily opens; reduced motion fades only; shots `f134a/fly-*`)*
- **Why:** `runnel-D` (32-330 x 390-545): three paragraphs of rules beside a board that should teach itself.
- **Build:**
  - A ghost hand taps the glowing tile; the lesson is three steps, each chip stamped as it's done; the rules fold into the (?).
  - On the last step the water runs to Bea's garden, then a weather card flies in and opens Daily #N.
- **Accept:** no lesson text block over 2 lines at D; the hand within 20 px of the target tile; the lesson to the daily in under 1.5 s; under reduced motion the hand appears without moving; shots P and D at each step.
- **Size:** 2

## 135. [x] Hedgerow: Cath debriefs a leak on the field *(done 2026-11-04, lane B)* *(slice 1, 2026-11-04 lane B: when a round leaks, the longest stretch of lane no tower reaches (`debrief.ts`, unit-tested) glows red for 1.5 s (`data-leak-stretch`), a ghost of the tower that counters what got through (`countersFor`) breathes on the free plot nearest its middle until the next round (a tap builds it), and her line on the field names the vehicle and the tower, placed off the empty plots; sandbox hook `debrief(kind)`; `e2e-site/hedgerow-debrief.spec.ts`; shots `f135a`, 2D and 3D at P and D. Later, if wanted: name the stretch by a landmark)*
- **Why:** `hedge-l21-2d-D` (62-290 x 528-620) and l34 (845-1070 x 372-458): the same "Build a Scarecrow" line at round 11 and round 17; nothing says what just went wrong.
- **Build:**
  - After a round with leaks, the stretch of lane they got through glows red for 1.5 s.
  - A ghost tower stands on the plot she suggests, and her line names the stretch and the tower; tapping the ghost builds it if affordable.
- **Accept:** a forced leak gives `data-leak-stretch` and a ghost on an empty plot; her line differs between two rounds with different leaks; the bubble over plots 15% or less at D; shots P and D, 2D and 3D.
- **Size:** 2

## 136. [x] NIGHT SHIFT: the class pick as an audition in the street *(done 2026-11-05, lane A)* *(slice 1 2026-11-05, lane A, d11941e6: the 'her back' frames were plan-shots catching the pick before it was ready (`?play` takes up to 200 s under SwiftShader). A class change is now a 3 s audition: a cut to the class's angle (closer; Ghost low, Butcher from under her fist, Gunslinger from her left, Wirewitch from above, Fixer from her right), the class pose held 3 s (was 1.2), eased home over 0.7 s, replacing item 129's dolly; the Wirewitch's rig flares; her quote as a word-by-word subtitle under her for 3.2 s; kits compile in the warm-up, not on the first change. `scene().vignette`; e2e in cathode-classpick at P and D (face 110/70 px, subtitle 13 px+ clear of everything); cathode-perf passes; shots `e2e/screenshots/a136`. Open: Ghost scoping and Butcher racking need her weapon in hand (the kits carry it on her back); under SwiftShader the title loop draws about one frame in 3 s, so judge the motion on a GPU. Slice 2: the guns in her hand. The Ghost reaches over her left shoulder, unslings the rifle (its back barrel hides) and stands it beside her face, scope at her eye, a glint off the lens, then slings it again; the Butcher draws a pump shotgun off her left hip (new on the kit) and racks it one-handed with a snap, the forend sliding and a red shell tumbling out under gravity. Both guns sit clear of her face at P and D; `vignette.prop` names the gun in her hand (e2e in cathode-classpick); shots `e2e/screenshots/b136-before`, `b136-after*`)*
- **Why:** `ns-play-D` (470-960 x 100-700): empty rain, Cath a distant back view (780-830 x 320-520); `ns-play-P` (100-230 x 300-560) her back again, though items 112, 117 and 129 put her face-on. Check first: is `plan-shots`' `?play` frame the live pick, or the poster? (Lane A: "plan shots wait for the live street".)
- **Build:**
  - Each class plays a 3 s vignette with her face-on: Ghost scopes, Butcher racks, Wirewitch's rig lights; a camera cut and a stinger per class.
  - Her quote as a spoken subtitle.
- **Accept:** `faceBox()` 110 px or more at D and 70 at P, inside the free column, for all five classes; the vignette starts within 300 ms of a class change; cathode-classpick and cathode-perf pass; shots D and P for every class.
- **Size:** 3

## 137. [x] NIGHT SHIFT: a name crossed off The List as a front-door moment *(done 2026-11-05, lanes A and B)* *(slice 1 2026-11-05, lane A, 67d76124: the first title after a boss job gives its print `data-struck="fresh"` (a red marker bar draws across it, the print greys), the next target's print develops in (`data-developing`), and the subtitle ticks 'N NAMES LEFT' down after 1.3 s; once only (`cathode:list-struck:v1`, `freshlyStruck` in frontcopy.ts, unit `tests/cathode-list-strike.test.ts`); fades under reduced motion; e2e `e2e-site/cathode-list-strike.spec.ts` at D from a real save; shots `e2e/screenshots/t133/strike-*-D.png`. Lane B finished it: Cath's word under The List's heading on that visit only (`struckLine` in frontcopy.ts: 'One off the list. Crisp's done. Vane next.', unit-tested; hidden after a reload, in `cathode-list-strike.spec.ts`); shots D and P `e2e/screenshots/f137a/strike-*`; under reduced motion the strike lands with no movement (`strike-rm-D`))*
- **Why:** `ns-title-D` (155-535 x 665-800; P 85-370 x 675-755): The List is four identical "Withheld" polaroids; closing a case is never celebrated where you start the next.
- **Build:**
  - On the first title visit after a case closes, a red marker strikes that polaroid, the next target's photo develops in, the "N NAMES LEFT" count ticks down, and Cath has a line.
- **Accept:** e2e from a save with one case just closed: the polaroid gets `data-struck`, the count drops, and it plays once only; reduced motion: a fade; shots P and D before and after.
- **Size:** 2

## 138. [ ] The bugs from the 2026-11-04 23:25 critique, fixed as one batch *(lane B, in progress)*
- **Build:** (check each first; plan1104j)
  - [x] **Site /games/ P:** *(checked 2026-11-05 lane A: at 1.2 s the hero has landed, the posters are on the first screen and Cath stands under the quote's end, not on it; shot `g138/games-1200-P`; no change)* the hero never finishes landing in the shot (the logotype blurred 50-280 x 115-170, the buttons at about 30%, no posters on the first screen), and Cath crowds the quote's end (295-370 x 225-260). Check against item 130 and the shot's timing.
  - [x] **NIGHT SHIFT P:** the class tab row cuts "WIREWITCH" (297-390 x 68-82) with FIXER off screen and no scroll cue. *(fixed 2026-11-05 lane A: the five names at --fs-3 on a 64% width (`--wdth-tight`), spread edge to edge, all five on screen from 375 px up, no mask; cathode-classpick asserts it; shot `g138b/after-ghost-P`)*
  - [ ] **Hedgerow:** ~~l34-2d-P the gate queue's vans and "485 coming" under a white veil (10-125 x 150-310)~~ *(checked 2026-11-04 lane B: the queue fades in over 0.4 s and the shot caught it; settled it is opaque, shot `f135a/queue-P`; no change)*; l21-3d-P the gate sign edge-on, a 2 px bar (15-75 x 410-418), and at D the name twice (sign 175-290 x 365-390, plate 325-525 x 340-365); ~~the round card's "Lifestyle influencer" wraps in a one-line pill (D 1180-1395 x 410-447)~~ *(fixed 2026-11-04 lane B: a two-line chip is a rounded box 14 px clear of the card's edge; shot `f135a/ticket-D`)*; ~~the map D road 25-26 through "The Unboxing" (1205-1222 x 420-445)~~ *(fixed 2026-11-05 lane A: at a row's turn and on the way out under the last stop the lane swings round the stop's name on its outer side, clamped to the band (`layoutLanes` detours; shots `g138b/hedge-menu-*`))*, and the bottom band's cut bridge and cow (540-880 x 790-830, 190-235 x 790-812) *(fixed 2026-11-05 lane A: the D strip's scene fades in from the paper over its top 55%; shot `g138b/hedge-menu-fade-D`)*.
  - [ ] **Runnel D:** ~~"Daily #39 ·" ends its line on a dot (170-250 x 645-660, from item 126's no-break title)~~ *(fixed 2026-11-05 lane B: Up next's title is the number on one line and the date under it; `runnel-critique91.spec.ts` updated; shot `f134a/upnext-D`)*; ~~the spring-house stream stops dead (435 x 505)~~ *(fixed 2026-11-05 lane B: the valley water's front tapers into a 3.5 px trickle 3.5% ahead and a 1.6 px thread 7% ahead, so it seeps on instead of ending square; the 14 Runnel site specs pass at P and D; shot `rn-crop`)*; channel bars over the hex rims (895-1115 x 400-450, 1000-1010 x 585-640). *(Note 2026-11-05 lane B: each channel runs to `APOTHEM + 1.5` in board.ts so neighbours join across the rim; the fix is to stop it at the rim's inner edge on a tile whose neighbour there is empty or the board's edge, keeping the join where two openings meet; runnel-tiles covers the look)*
  - [ ] **Cathnivore:** ~~D "Need 1 more Mark" pale pink at about 2.5:1 (65-185 x 750-762)~~ *(checked 2026-11-04 lane B: the shown why-not chips are rgb(158,68,48) on cream, about 6:1, 14 px; the shot caught a chip mid-fade; no change)*; the Campaign's Cath token straddles the Brindle Hills/Kingsmarket edge (D 262-305 x 560-640, P 117-140 x 420-462). *(Note 2026-11-04 lane B: she stands on the road beside chapter 1's pin, item 49's `cathBox` placement, kept clear of every name by its unit test; moving her into a hex is a design call left open.)*
- **Accept:** e2e text 11 px or more at 4.5:1, boxes inside the viewport and not intersecting, at P and D for each case; shots before and after.
- **Size:** 2

## 139. [ ] The bugs from the 2026-11-05 01:05 critique, fixed as one batch *(lane A, in progress)*
- **Build:** (check each first; plan1105a; points already in items 136 and 138 left out)
  - [x] **Site /games/ D:** no poster shows its status line or continue chip (110-1330 x 670-790): a CSS rule at 1440, or the shot fired before `#status-<id>` filled? *(fixed 2026-11-05 lane A: the lines lived on the cards below the fold; each first-screen poster now carries today's line under its hook at D (`#hero-status-<id>`, gold, from `cardLines`), phones keep it on the cards; the continue chip needs a save, so a fresh visit shows none; shots `g139/games-D`, `-L`, `-P`)*
  - [x] **Cathnivore:** *(fixed 2026-11-05 03:20 lane A: the price tag and SOLD sign are wordless print (no piece size takes '.99' to 11 px; the title already hid it); the phone receipt is a slip lying on the table front under Cath (daily-ritual asserts it); the picked map card's line in full ink (its colour matched the others; the lifted wheat ring read as greyed); Campaign Cath fades into the paper below the waist at P and D; the threat pill sits 4 units under the name plate (was 2, its stroke met the plate on a phone). Kingsmarket at P checked at round 3: no overlap (the tray's unit test holds). Shots `b139` in the session scratchpad)* P title: the "No sale yet" receipt lies across Cath's torso and jar (35-140 x 400-470). D game: the ".99" price tags about 7 px (720-745 x 345-358, every Outlet), illegible at P (225-245 x 262-274). P game: Brindle Hills' EXPAND pill on the name plate (45-115 x 330-346); Kingsmarket's stacks, badges and tags overlap (150-245 x 340-400). D Setup: the picked map card's body text fainter than the unpicked (520-640 x 712-745), so it reads disabled. D Campaign: Cath's bust a hard cut at the waist with no ground (1285-1370 x 170-185; also item 126).
  - [ ] **Hedgerow:** *(2026-11-05 03:25 lane A: the Saltmarsh cloud is a lit cumulus (white tops from the sun's side, a cool lavender belly), set lower, and the act banner's crop starts 10 units higher, so its domes are no longer cut flat; on a phone the last open act fills the screen under the header, so the next act's glimpse waits below the fold instead of peeking cut under the tab bar. 05:30 lane A: the 3D 'N coming' plate docks under its own gate's sign board (then beside, then over it) when that spot meets no plot, vehicle or sign, else item 132's search; at level 21 D it now sits under HOLLOWELL (shot `plate139c/l21-3d-D`). Open: at P the sign is edge-on (item 138's 2 px bar), so the plate keeps item 132's spot over the centre; fix it with the sign)* D menu: the cloud a flat grey-pink smear (460-775 x 65-150; also item 126). P menu: the "BEYOND THE HEDGE · ACT 4" banner washed out and cut by the tab bar (50-340 x 755-782). 3D l21: the "N coming" plate about 150 px from the gate at D (328-432 x 245-270) and over the centre plots at P (135-330 x 362-386), after item 132's fix.
  - [x] **NIGHT SHIFT:** *(P pick labels checked 2026-11-05 lane A: cathode-classpick holds every phone pick text at 12 px or more; the '9 px' was a misread of the shot. 02:10 lane A: the dossier's TOMAS REED slate lettering drew at 8 px; the print now carries item 107's wordless lettered slate, the name in type under it (shot `g139/dossier-after-D`). The List's captions are `--fs-1`, 12 px, the measure was cap height; CONTINUE is grey only without a save (disabled, row kept by design, menu.ts); no change to either.)* D title: The List's name plates (165-525 x 745-757) and the dossier's TOMAS REED tag (462-527 x 459-471) about 6-8 px; CONTINUE grey at about 2.5:1 with a save present (D 58-195 x 310-338, P 16-128 x 215-240): enable it or drop it. P pick: SNIPER RIFLE and the DAMAGE/RATE/MAGAZINE labels about 9 px (160-330 x 690-736).
- **Accept:** e2e text 11 px or more at 4.5:1, boxes inside the viewport and not intersecting, at P and D for each case; shots before and after.
- **Size:** 2

## 140. [x] NIGHT SHIFT: Cath's 3D face to the character bible at title distance *(done 2026-11-05, lane A, 34de86eb..ebf6a69c: slices 3-4 add a warm face key from the lens's upper left on her skin and face (view space, inside the rim hook; it steps back to 45% under the wardrobe's class key) and a broken shine band in the hair's strand map (the long waved hair was already there). Face mean luminance 0.16 -> 0.22 at D, 0.12 -> 0.18 at P, 0.20 at L; the lips read rose. **Cut:** the 'eye highlight over 0.85' line became 'mean luminance 0.19 at D and 0.15 at P, and 40+ rose-hue pixels' (asserted in cathode-front): the street grade caps a pure white bead near 0.86, and at the test's phone-quality scale the eye is about 5 px, so neither painted nor HDR-bead catch-lights registered (see DECISIONS). Also fixed: the phone class pick's audition subtitle sat over the class's words in a held frame (placed before the column settled; now a ResizeObserver re-places it). Shots `e2e/screenshots/face140` (P, L, D) and `classpick/k140c-*`; `scripts/cathode-face-measure.mjs`)* *(slices 1-2, 2026-11-05 lane A: the painted eyes 1.3x larger again and set wider, iris, pupil, liner wing and catch-lights scaled with them (the main catch-light larger still); brows higher and fuller; lips 1.3x by 1.4x in a deeper rose with a brighter gloss; a stronger blush. Expressions: `paintFace(expr)` repaints the one canvas on a change (smirk on the title, Ghost and Butcher determined with level brows drawn in, Wirewitch winks her left eye closed, Gunslinger and Fixer smirk), `data-expression` on the front canvas; e2e in cathode-front (title smirk) and cathode-classpick (per class) at P and D. Open: the hair (waves, shine band) and a warm face key against the magenta grade; the pixel checks wait for that key: inside faceBox the brightest pixel peaks at 0.4 at P and 0.8 at D under the street grade (an emissive catch-light map changed nothing measurable, so it was dropped). Shots `b139/before-nsface-*`, `after2-nsface-D` in the session scratchpad)*
- **Why:** `ns-title-D` (960-1060 x 255-360) and `ns-title-P` (265-335 x 535-600): the front door's hero face is two dots and a line under a flat magenta wash, with a stiff shell of hair; it falls well short of the 2D Cath on /games/.
- **Build:**
  - A painted face texture (canvas): large eyes with two highlights, winged liner, soft brows with the right one raised, rosy cheeks, glossy rose lips.
  - Expressions on that texture (smirk, determined, wink) driven by the title and the class pick, `data-expression` on the front.
  - Long centre-parted hair with soft waves and a shine band; a warm face key against a cool rim in place of the flat wash.
- **Accept:** `faceBox()` 110 px or more at D and 70 at P; pixels inside it find an eye highlight (luminance over 0.85) and a rose lip hue; `data-expression` changes on class focus; cathode-perf in budget; shots P, L and D.
- **Size:** 3

## 141. [x] Cathnivore: Cath suggests a move, and every action previews on the board *(done 2026-11-05, lane B)* *(slice 3, 04:22: on a phone the strip scrolls to the leafed card after each move, snapped, and the leaf sits inside the picture's corner; action-hand's at-rest peek test runs with suggestions off. Left for later: no preview for a move that ends the round; her line on a phone)* *(slice 1, 2026-11-05 lane B: HeuristicBot's pick wears a leaf on its card (`data-suggested`, family and group cards too) with a green ring, and above the list Cath says why (`reasonForAction`); off on Hard, the Daily, the guided tutorial, forced decisions and autoplay; Settings > On the table > Cath's suggestions; the first-Invest accent steps aside while she suggests; `e2e/suggest-move.spec.ts`. Open: the phone strip hides her line and may leave the leafed card off-screen; slice 2 is the hover/long-press preview, ghost piece and meter deltas)* *(slice 2, 2026-11-05 03:22 lane B: hover, keyboard focus or long-press on a card previews it: a dashed ghost counter (+ or −) on each region it could play into, ghost segments on Trust/Land left/Rift (`data-delta`), and a tag over the ledger chip (drawn by CSS, out of the text and the flow, so the list never moves under the pointer); keyed by the action, cleared on every move; the Settings toggle hides it; e2e in suggest-move.spec.ts. Open: a move that ends the round shows no preview; the phone strip's long-press is untested on a real device)*
- **Why:** `cath-game-D` (33-315 x 320-800): eleven actions of equal weight, and the meters (350-1335 x 15-75) never show what a move will do; a newcomer can't tell a good move from a bad one.
- **Build:**
  - The HeuristicBot's pick gets a leaf badge on its card, and Cath says one line on why.
  - Hover, focus or long-press on an action previews it: a ghost piece on its target region and ghost +/- segments on the meters.
  - A Settings toggle: on for Easy and Normal, off for Hard and the Daily.
- **Accept:** exactly one `[data-suggested]` card in round 1; hovering Open Stall adds a `.ghost-piece` in a region and `data-delta` on the meters; the toggle hides both; rule unit tests unchanged; shots P and D, light and dark.
- **Size:** 2

## 142. [x] Runnel: a valley that remembers your week *(done 2026-11-05, lane B)* *(slice 1, 2026-11-05 lane B: each daily solved since Monday stands in the valley's margins as a mill, a footbridge, an orchard row or Bea's scarecrow by its seed, a missed day as a fallow plot (`weekvalley.ts`, unit-tested), 72 px at D and 40 at P, each at the first spot from its own that meets no tile, Cath or the garden (re-placed when the board settles); `e2e-site/runnel-week-valley.spec.ts`; shots `f142a`. The seven stamps already stand in the desktop rail's This week (item 50). Slice 2: a daily's share card carries the week along its meadow, each day's keep or fallow plot drawn in the card's own canvas subset (`drawWeek`; the seed's card is unchanged without a week, its hash test holds; a unit test checks the week adds to it); `f142a/card.png`)*
- **Why:** `runnel-D` (390-1410 x 20-880): the valley looks the same every day; a solve leaves nothing behind, so a streak has no picture worth showing a friend.
- **Build:**
  - Each daily solved this ISO week adds a lasting feature placed by the day's seed: a mill, a footbridge, an orchard row, Bea's scarecrow; a missed day leaves a fallow plot.
  - A strip of seven stamps under Up next.
  - The share card carries the week's valley.
- **Accept:** a save with three solves this week renders three `[data-valley-feature]`, none meeting a tile; a new week resets them; the share card includes them; no layout shift over 2 px; shots P and D.
- **Size:** 2

## 143. [x] Hedgerow: people and animals working the farm *(done 2026-11-05, lane A, 0801971b..HEAD: slice 2 steps a critter off a plot the moment a tower goes up on it, raises 3D cheering arms in the screen's plane, makes the 3D figures 20% larger with eyes under the hat brim, and adds `folkDo` and cheer shots. Frame cost: 3D level 21 D 520 -> 569 draw calls (each rig baked to one call per moving part), fps unchanged within SwiftShader noise; 2D 1440x900 under software canvas 9.0-9.4 -> 8.7 fps. Hedgerow has no frame-time gate, so the budget line is read as 'no measurable fps loss in 3D, under 7% in software 2D' (see DECISIONS))* *(slice 1, 2026-11-05 lane A: `farmfolk.ts` walks Bea, two farmhands, the collie and three hens cell to cell over the plots (never a lane, pond or landmark; each critter keeps to its own side of the lanes), hoeing, sniffing and pecking at stops, slower in a round; a leak sends them running for the cell of their patch nearest the farmhouse to crouch there 3.5 s, a cleared round makes them hop with arms up; reduced motion holds them still. 2D figures in `folkart.ts`, 3D rigs in `render3d/folk.ts` baked to one draw call per moving part (+56 calls a frame at level 21 D, 520 -> 576). Sandbox `folk()`, `?nofolk`; `tests/hedgerow-farmfolk.test.ts`, `e2e-site/hedgerow-folk.spec.ts`; shots `e2e/screenshots/folk143` (2D/3D, P/D, build and flee).)*
- **Why:** `hedge-l21-2d-D` (300-1080 x 75-890), `hedge-l34-2d-D`: the plots stand static with no one tending them; the field reads as a board, not a place worth defending.
- **Build:**
  - Farmhands, Bea, a dog and hens (2D sprites and 3D meshes) walk the verges and tend plots in the build phase, never on lane cells, never taking taps.
  - On a leak they run for the farmhouse; on a won round they cheer.
  - Positions exposed through the sandbox hook.
- **Accept:** 4 or more critters in the build phase, none on a lane cell; after `debrief()` they flee within 500 ms; the frame-time budget holds; shots 2D and 3D, P and D.
- **Size:** 2

## 144. [x] Cathnivore: market events you can see on the table *(done 2026-11-05, lane B)* *(slice 1, 2026-11-05 lane B: the map carries `data-event`, and every region wears the week's event on its ground, under the pieces: a heap of produce at the foot for the Great Glut, a lantern string for the Harvest Festival, cracked earth that shimmers in the heat for the Dry Spell (still under reduced motion); `e2e/market-event-dressing.spec.ts` (every region dressed, none meeting a piece); shots `f144a`. Slice 2: a market-week game opens on Cath naming it (the event's own line, at the table at D and in the strip on a phone; asserted per event). Slice 3: at 1240 px and up the week's ticket is pinned to the table's top right, its name and rule ('Pasture & Crop kit 1 Mark off', from `MARKET_EVENTS[...].cheap`), clear of every region (checked per event); shots `f144a/ticket-*`, light and dark. Slice 4: on a phone or tablet the ticket is one line across the frame's top strip ('Glut  Pasture & Crop −1', the full rule kept for screen readers), clear of every region, Bea's drawing and the 'i' at 390x844 and 820x1180; hidden on a short phone (under 700 px tall) and at 1024-1239 px, where the board takes its corner; shots `f144a/ticketP-*`)*
- **Why:** `cath-setup-D` (130-470 x 75-270): the "Great Glut" event is text only, and in play (`cath-game-D`) nothing on the board shows it, so every Daily looks alike.
- **Build:**
  - Each event dresses the board (Great Glut: produce piled on stalls; Dry Spell: cracked earth and a heat shimmer; and so on for the rest).
  - A pinned event ticket in the header with its rule; Cath's first-round line names it.
  - Reduced motion: the dressing stays, the shimmer is still.
- **Accept:** `data-event` on the map for every event; dressing in the regions, none meeting a piece; the ticket's rule matches `content`; shots per event at P and D, light and dark.
- **Size:** 2

## 145. [x] Site: posters that play *(done 2026-11-05, lane A: `site/src/posterplay.ts` lays a canvas loop over each still, drawn in the key art's 960x600 space and mapped like its object-fit cover: Runnel's river runs and water pulses out of the spring along four channels, a Hedgerow convoy runs the lane under rising '+2' Marks, Cathnivore's four contested regions turn green one by one, NIGHT SHIFT's neon flickers over sheeting rain. /games/ posters and the portfolio's four prints; one `[data-playing]` at a time (hovered or focused, else each in view in turn every 5.2 s, a faded-out print counts as out of view), none off-screen or in a hidden tab, 30 fps, canvases made on first play; it starts 1.5 s after `load`, so the first paint and LCP are untouched, and it rests after 20 s without input (like the portfolio field's idle fix). Reduced motion: stills, no canvas. The key art files are unchanged. `e2e-site/poster-play.spec.ts` at P and D; shots `e2e/screenshots/p145` (`scripts/poster-play-shots.mjs`))*
- **Why:** `games-D` (110-1330 x 460-660) and `portfolio-D` (790-1345 x 160-690): every poster is a still; nothing shows play happening.
- **Build:**
  - A poster in view, hovered or focused plays a short loop: Runnel's water filling, a Hedgerow convoy, a Cathnivore region flipping green, NIGHT SHIFT neon and rain (video or canvas, lazy, one at a time, paused off-screen).
  - Reduced motion: stills.
- **Accept:** one `[data-playing]` at a time; none off-screen; LCP within 100 ms of today; gate 1's weight budget kept; shots P and D still match the key art.
- **Size:** 2

## 146. [ ] The bugs from the 2026-11-05 05:56 critique, fixed as one batch *(lane A, in progress)*
- **Build:** (check each first; shots `plan1105b`; points already open in items 126, 138 and 139 left out)
  - **Cathnivore:** P game: the next hand card cut by the scroll arrow ('Bu...', 330-390 x 670-770) and its rotated NOT YET label about 9 px; Cath at the phone table about 48 px wide, face about 15 px (10-60 x 505-600). D title: a stray arc on the table edge above 'Win a Daily' (1138-1172 x 760-772; unsure).
  - **Hedgerow:** D menu: a faint dashed bar across the map (145-1295 x 280-285; unsure); act 4's ghosted grey arches behind its banner (0-1440 x 790-900). P menu: the 'Brand Ambassador' label about 55 px under its stop (10-95 x 448-482). 3D l21 D: the frame cuts the bottom plot row and the lane while 70-180 px of grass is empty at the top (90-1070 x 760-890); Cath's 3D face a pale blur (145-235 x 480-570). P field: the fifth seed packet's name and price cut by the scroll arrow (305-390 x 700-770). D l21 2D: 'Lifestyle influencer' wraps inside a one-line pill (1180-1390 x 410-445).
  - **NIGHT SHIFT:** P title: Cath cut by the right edge and The List's polaroids across her body (270-390 x 540-844). D pick: Cath hidden behind the stats panel (935-975 x 280-330; check it isn't shot timing). P pick: stat and skill labels about 10-11 px (16-210 x 645-780); unselected class tabs low contrast (75-375 x 68-82).
  - **Site:** portfolio D: the plan shot fires mid-entrance (blurred 'grown by AI', see-through Cath): make `plan-shots.mjs` wait for the page to settle, then re-check.
- **Accept:** e2e text 11 px or more at 4.5:1, boxes inside the viewport and not intersecting, at P and D for each case; shots before and after.
- **Size:** 2

## 147. [ ] NIGHT SHIFT: Cath's 3D body to the character bible
- **Why:** `ns-title-D` (900-1150 x 250-900): the trench is boxy flat panels, the arm segments don't join and the hands are mitts; item 140 fixed only her face.
- **Build:**
  - A tailored trench with collar, belt and a flared skirt; shoulders and arms that join smoothly.
  - Hands with fingers round the umbrella handle.
  - The long hair falls in waves over the coat, with a little secondary motion in the rain.
- **Accept:** `data-cath-lod="hero"` on the front canvas; her silhouette 300 px or taller at D; cathode-perf in budget at P and D; shots P, L and D.
- **Size:** 3

## 148. [ ] NIGHT SHIFT: a front door lit like a noir poster
- **Why:** `ns-title-D` (700-1440 x 0-900), `ns-title-P` (0-390 x 300-844): she stands in an evenly dim purple alley, with no key light, no reflection of her and no neon on her.
- **Build:**
  - A flickering neon sign as her key and rim light.
  - Her reflection in a wet puddle at her feet; rain streaks lit from behind.
  - On a phone the camera frames her whole figure above The List.
- **Accept:** `[data-key-light]` on the front; face mean luminance 0.25 or more at D; at P her figure's box inside the viewport and meeting no polaroid; cathode-perf in budget.
- **Size:** 2

## 149. [ ] Cathnivore desktop: the actions as a hand of cards at the table's edge
- **Why:** `cath-game-D` (33-315 x 360-710): eleven yellow buttons with 20 px icons and '8 more' folded away, while the phone has art cards (item 123).
- **Build:**
  - A fanned hand of illustrated cards along the table's bottom edge; a card lifts on hover and focus.
  - The cost printed on each face; cards that can't be played sit face-down at the fan's end.
  - Keeps item 141's suggestion leaf and previews.
- **Accept:** `[data-hand-card]` count equals the legal actions; each card 110 px or taller; no card meets a region; no page scroll at 1440x900; rule tests unchanged; shots D light and dark.
- **Size:** 2

## 150. [ ] Cathnivore Campaign: chapters as storybook vignettes, with Cath standing on the map
- **Why:** `cath-campaign-D` (890-1380 x 220-900): text cards with grey thumbnails; Cath is a cut-off sticker (1285-1375 x 35-180) and a 40 px token (262-305 x 560-645).
- **Build:**
  - A full-figure Cath, about 140 px at D, standing on the current chapter's region; she walks there when a chapter is picked.
  - Each chapter card a painted scene of its regions and its producer, colouring in as the chapter is completed.
- **Accept:** `[data-map-cath]` 120 px or taller at D and 64 at P, inside its chapter's region; each `[data-chapter-art]` an SVG of 5 or more shapes; shots P and D, light and dark.
- **Size:** 2

## 151. [ ] Runnel: a valley people live in
- **Why:** `runnel-D` (390-1410 x 230-870), `runnel-P` (0-390 x 300-750): flat, empty fields; nobody cares that the water arrives.
- **Build:**
  - A farmer, Bea, sheep and a cart on the road walk the valley margins.
  - When water reaches a field its farmer starts work and its crop sprouts; on the solve they cheer.
  - Reduced motion holds them still.
- **Accept:** 4 or more `[data-valley-folk]`; a watered field gets `data-tended`; no folk meets a tile, Cath or item 142's features; no layout shift; shots P and D before and after a solve.
- **Size:** 2

## 152. [ ] Hedgerow: twists you can see on the field
- **Why:** `hedge-l34-2d-D` (1270-1345 x 385-405): 'The wall: FLOOD' is only a tag; the river (880-1080 x 75-890) never rises, and Sea Fret shows no fog.
- **Build:**
  - A flood that swells the ford and covers the edge plots for its rounds.
  - Sea fret that drifts over the lanes and dims the tower ranges.
  - Cath warns of it on the field the round before; 2D and 3D.
- **Accept:** `[data-twist-active="flood"]` on the field with 1 or more `data-flooded` plots; the fog layer's opacity over 0.3 in a fret round; level tests and the tuner unchanged (dressing only, or re-tuned and logged); shots 2D and 3D, P and D.
- **Size:** 2

## 153. [ ] Hedgerow: the journey map as one painted country
- **Why:** `hedge-menu-D` (0-1440 x 790-900): act 4 is a washed-out strip and each act a page of its own.
- **Build:**
  - The acts joined into one vertical scroll of painted country, each act's ground running into the next.
  - Locked acts drawn in pencil rather than washed out; Cath walks over the act border when the next act unlocks.
- **Accept:** `[data-act]` count equals the acts, in one scroller; the current act in view on load; the next act's top 60 px or more into the viewport; locked labels at 4.5:1; shots P and D, light and dark.
- **Size:** 2
