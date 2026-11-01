# Two-week plan (2026-11-01 to 2026-11-15)

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

## 6. [ ] Runnel: a living landscape and a win worth sharing
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

## 7. [ ] NIGHT SHIFT: encounter staging and enemy readability
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

## 8. [ ] Cathnivore: an end screen that closes the loop, and a designed desktop Setup
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

## 9. [ ] NIGHT SHIFT: Cath's hero model and faces
- **Why:** the title, class pick and over-the-shoulder takedowns show a featureless mannequin. Cath is the face of every game (VISION.md character bible).
- **Build:**
  - A detailed Cath: eyes, liner and lips per the bible; long hair as cards with a shine band; a coat with collar and belt; expression blends for photo mode.
  - Head busts for Crisp, Vane, Pell and the Chair, used in cutscenes and on the case board.
- **Accept:**
  - A turntable shot with the face readable at a 300 px head height.
  - The title and class pick are re-shot.
  - The perf gate passes on the phone tier.
- **Size:** 5

## 10. [ ] Hedgerow: field-first phone layout, swarm readability, a choreographed tally
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

## 11. [ ] Cathnivore: the conglomerates as characters
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

## 12. [ ] NIGHT SHIFT: the Case Board and district map
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

## 13. [ ] The games page (/games/): live cards with key art
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

## 14. [ ] NIGHT SHIFT: conversations and interrogations
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

## 15. [ ] Cathnivore: replayable maps and a Daily Market
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

---

**Done on 2026-11-01, before this plan:** the portfolio front page (`/`). It has the WebGL2 hero, kinetic type, bento case cards and the `/work/<id>/` case studies with view transitions, and covers audit items P-A and P-B.

**Folded in or retired:** ROADMAP 19, H2, 31, 33, 62 and 219 are closed as built. 239 to 242 (Phase 27 meta add-ons) are deferred below this plan. 58 and U7 become item 5; 74's leftovers become items 14 and 16; U11 is part of item 13.
