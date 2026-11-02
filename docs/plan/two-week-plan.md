# Two-week plan (2026-11-01 to 2026-11-15, extended 2026-11-02)

**Owner, 2026-11-01: this is the queue.** Every build session takes the **first item not marked done**, writes it under **Now** in `PROGRESS.md`, and works it in slices until about 45 minutes have passed. When the item is done, the session starts the next one. Older ROADMAP items wait unless an item here names them.

The items come from two fresh-eyes audits on 2026-11-01. Both were run against `VISION.md` at 390x844, 1440x900 and 844x390, and the screenshots are in that day's session notes. Every item is a whole, player-visible feature. "Size" is a rough count of build sessions.

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

## 16. [ ] NIGHT SHIFT: Cath's office, a hub between cases
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

## 17. [ ] NIGHT SHIFT: the morning-after debrief
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

## 18. [ ] Hedgerow: a full-bleed campaign map
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

## 19. [ ] Hedgerow: a living field with tower tiers and impact
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

## 20. [ ] Cathnivore: the board as a diorama
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

## 21. [ ] Cathnivore: a hand of action cards
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

## 22. [ ] Runnel: teach on the board
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

## 23. [ ] Shared: Cath's poses and an idle
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

## 24. [ ] NIGHT SHIFT: the gate and cold open on the live world
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

---

**Done on 2026-11-01, before this plan:** the portfolio front page (`/`). It has the WebGL2 hero, kinetic type, bento case cards and the `/work/<id>/` case studies with view transitions, and covers audit items P-A and P-B.

**Folded in or retired:** ROADMAP 19, H2, 31, 33, 62 and 219 are closed as built. 239 to 242 (Phase 27 meta add-ons) are deferred below this plan. 58 and U7 become item 5; 74's leftovers become items 14 and 16; U11 is part of item 13.
