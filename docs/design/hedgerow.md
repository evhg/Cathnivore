# Hedgerow: design note (third game, owner request 2026-09-28)

The owner asked for **a tower defense game where each level develops a really good storyline, new weapon and tower upgrades unlock as you go, and level 100 is the ultimate boss fight.** Like every game on cathnivore.com, **Cath is the lead** (VISION.md "Cath: character bible"). This note is the source of truth for building it; sessions refine it and log changes in `DECISIONS.md`.

## Pitch
The corporations have stopped buying Marrow's farms and started taking them. Delivery drones, bulldozers, lawyers and glossy plastic "convenience" trucks roll down the lanes toward the farmhouses. Cath and the producers hold the line with what small farms have: hedgerows, beehives, scarecrows, windmills, market stalls and a lot of neighbours. Over 100 levels across all of Marrow, the fight escalates until Hollowell and Candor merge into one monster: **HollowCandor**. Level 100 is the showdown at Kingsmarket.

## Where it lives
- `/hedgerow/` on cathnivore.com, with a card on the landing page ("Cath's tower defense"), built into `dist-site/hedgerow/` by `scripts/build-site.ts`.
- Code: `games/hedgerow/`, following Runnel's pattern: a pure, deterministic engine (`engine/`, seeded RNG, fixed 30 Hz simulation step, no DOM) plus a Canvas 2D renderer (hundreds of units at 60 fps on a phone), with DOM/SVG for the menus and story scenes. Cath is drawn from `shared/cath/`.
- Saves: localStorage, versioned, with a migration and a test for every change. Progress, unlocks and stars per level.

## Core loop (each level)
1. **Story beat:** a short graphic-novel scene before the level (2-5 lines, Cath and the cast, SPEC 3.2 voice, SPEC 3.5 satire rules).
2. **Build:** place towers on plots beside a winding lane (a hex or square grid per map) with Marks earned from waves.
3. **Waves:** 5-20 waves of enemies follow the lane toward the farmhouse. Leaks cost Goodwill; at 0 the level is lost.
4. **Result:** 1-3 stars (Goodwill kept), rewards, and the level's unlock. A closing story beat.
Controls work one-handed on a phone: tap a plot to build, tap a tower to upgrade, sell or target, and a single speed and pause control.

## Towers (unlock gradually; each has 3 upgrade tiers and a tier-4 specialisation choice)
| Tower | Role | Unlocks |
|---|---|---|
| Hedgerow | Blocks and slows; cheap | Level 1 |
| Scarecrow | Single-target thrower (turnips) | Level 1 |
| Beehive | Area damage over time (swarms) | Level 4 |
| Windmill | Knockback gusts along the lane | Level 9 |
| Market Stall | Economy: earns Marks, buffs nearby towers | Level 13 |
| Duck Pond | Slows vehicles, splash | Level 18 |
| Seed Cannon | Long-range artillery | Level 24 |
| Co-op Barn | Spawns farmhand defenders who block | Level 31 |
| Grain Silo | Heavy damage vs armoured (bulldozers) | Level 38 |
| Radio Mast (Sol) | Reveals stealth units, marks targets | Level 45 |
| Clinic Tent (Ines) | Heals hedgerows, cleanses debuffs | Level 55 |
| Courthouse (Mara) | Stops bosses in their tracks ("Injunction") | Level 65 |
| Farmers' Union Hall (Tomas) | Global aura, calls a Market Day rally | Level 75 |

## Weapons and abilities
Cath's own **abilities**, on cooldowns, unlocked through the campaign: a thrown pie (a stun), a Rally (a speed and damage buff), Headline (every enemy on screen slowed as the news breaks), Bea's Drawing (a surprise barrier), and more. Each gets an upgrade path, so a new weapon, ability or upgrade tier unlocks at least every 2 levels (the owner's "new unlocks each level": every single level awards something, even if small: a tier, a skin, a lore card).

## Enemies (glossy, plastic, over-lit: STYLE.md's corporate material)
Delivery drones (fast, flying), vans (basic), bulldozers (armoured), lawyers (they slow your towers), lobbyists (they buff their allies), influencers (they charm towers into not shooting), PR helicopters (flying and armoured), and "0.99" price-war trucks (they split on death). Each act adds 1-2 enemy types. Minibosses end every act.

## Story: 10 acts of 10 levels
Each act is a place in Marrow with its own arc, rising stakes and a miniboss at level 10, 20 and so on. The story must be genuinely good: specific, funny, warm, with real stakes and payoffs, and Bea as a small wholesome thread.

1. **Brindle Hills (1-10):** the first drone lands on Mara's field. Tutorial arc. Miniboss: the Acquisition Van.
2. **Highmoor (11-20):** Tomas's market is priced out; the Market Stall joins. Miniboss: Mr Crisp's Price-War Convoy.
3. **Saltmarsh (21-30):** Sol's podcast goes viral; the corporations send influencers. Miniboss: the Brand Ambassador Blimp.
4. **Rivermead (31-40):** floods and bulldozers; the Co-op Barn rises. Miniboss: the Mega-Dozer.
5. **Oakvale (41-50):** Ines exposes Candor's "wellness" water; stealth units arrive. Miniboss: Vane's Clinic-in-a-Box.
6. **Shingle Bay (51-60):** a storm, the fishing fleet joins; naval lanes. Miniboss: the Container Ship.
7. **The Rift (61-70):** Hollowell and Candor fall out, then need each other; chaos levels with two enemy factions fighting each other and you. Miniboss: the Lawyer Swarm.
8. **The Ballot (71-80):** Marrow votes; Pell tries to buy the election. Defend the polling stations. Miniboss: Pell's Campaign Bus.
9. **The Merger (81-90):** Hollowell and Candor merge into HollowCandor; everything they have comes at once. Miniboss: the Board of Directors (five minibosses in one).
10. **Kingsmarket (91-100):** the last stand at the capital's market square, with all towers, all producers and every neighbour. **Level 100: HollowCandor itself**, a multi-phase boss fight (at least 3 phases, each changing the lane, the rules and Cath's lines), with a finale scene that pays off the whole story, Bea included.

## Difficulty and balance
- A smooth curve over 100 levels; every level is beatable with the towers unlocked by then. A bot (`sim/hedgerow`) plays each level with a simple greedy build policy and must win with at least 1 star, and must not win with 3 stars too easily. That is a gate for Hedgerow levels, like Cathnivore's fuzz.
- Normal and Hard modes, plus endless replay of cleared levels for stars.

## Build plan (slices; each ships playable)
1. **Engine and a vertical slice:** the engine, a Canvas renderer, 2 towers, 2 enemies, 3 levels of act 1 with story scenes, saves, a landing card, the site suite, unit tests and the bot gate.
2. **Act 1 complete (levels 1-10):** a miniboss and the upgrade UI.
3. Then one act per slice (acts 2-9), each adding its towers, enemies, abilities, story, map art and miniboss, with a bot pass over every level.
4. **Act 10 and the level 100 boss:** a multi-phase fight and the finale.
5. **Polish passes** throughout: sound, particles, Cath's reactions and the level-select map of Marrow.
