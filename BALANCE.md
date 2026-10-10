# Balance

Keep this under 300 lines (SPEC 16). v1's full balance log (12 iterations, 2026-09-24 to 2026-09-27) is in `docs/archive/BALANCE-v1.md`.

## Where v1 ended
- MCTSBot on Normal, all pairs: about 27% wins (SPEC 9.4's target is 45-60%). Mara+Tomas was the strongest pair; Sol's pairs got the production buff in iteration 12.
- Any new balance work is a ROADMAP item: at most 3 numbers per iteration, sims logged before and after, in this file.

## Hedgerow (2026-10-02, owner's second playtest: "at level 16 it's super easy")
- **Before:** a Scarecrows-only bot kept 100% of its Goodwill on every level up to 43; the levels didn't ask for any strategy.
- **What changed:** twists per level (docs/design/hedgerow-v2.md 2), air/ground targeting, seven lane shapes, Cath spots stealth within 1.3 cells, and enemy health tuned per level.
- **How it's tuned:** `scripts/hedgerow-tune.ts` binary-searches each level's enemy-health multiplier for the largest value at which the competent bot (`games/hedgerow/src/bot.ts`) still keeps its target Goodwill (0.9 for levels 1-3, 0.7 for 4-7, 0.5 from 8). What ships is that times a human margin (0.9 up to level 7, 0.97 after), and `--verify` backs off any level where the shipped value doesn't give the bot a clean win. Table: `games/hedgerow/src/tuning.ts`.
- **Shape of the curve:** most early levels land at 1-2.5x the old health, acts 4-10 at 2-8x, crowd levels highest (the bot handles crowds well with bees). Outcomes fall off a cliff rather than sloping: a few % more health takes the bot from 100% to a loss, so the margin matters more than the target.
- **Result (final 2026-10-02 table, margin 0.9 to level 7, 0.97 for 8-10, none after):** competent bot keeps 82% on average, 50% at worst; the naive bot wins 25 of the 93 levels from 8: all of 8-30 except 19, plus 32, 38, 43. Acts 4-10 now need real counters; acts 1-3 don't yet (ROADMAP 45: needs content, not numbers).

## Hedgerow round 3 (2026-10-02 evening, owner's third playtest: "Scarecrow spam wins the early acts")
- **Changes:** bubble-wrapped vans (single-target shots do 15% until area damage pops the wrap; 60% of vans in levels 5-20, 50% in act 3, 30% after), Scarecrow crowding (-20% fire rate per adjacent Scarecrow), Scarecrow damage 7/11.5/17.5 and upgrades 80/125, new winding routes on bigger fields, Windmill (8+), Seed Cannon (26+), megastructures (12+), ambushes (12+). Scarecrow bans cut from 17 levels to 2 (17, 29).
- **Benchmark:** the tuner and level tests now use `"best"` = the better of `competent` and the new `balanced` bot (a simple plan with a weighted mix of damage dealers); the old competent bot played worse than pure spam, which had tuned the curve too soft. Full run: tune, `--verify`, then the new `--antispam` (from level 8, +6% health steps while spam still wins and the best bot still passes verify).
- **Result:** best bot keeps 75% of its Goodwill on average, 50% at worst; the naive Scarecrows-only bot wins 9 of the 93 levels from 8 (8, 11, 12, 14, 18, 21, 28, 30, 40), down from 25 at the last release. 8, 14 and 30 are air levels and 18 is rain (Beehives halved), where Scarecrows are the right counter. Duels and Cath's sheet are not in the bots' game, so people get extra margin from them.

## Hedgerow counters and scarcity (2026-10-03, owner: "so easy it's not fun"; "look at how much money is collected, it's not scarce")
- **Changes** (docs/design/hedgerow-v2.md 8):
  - Hard counters (`TOWER_VS`): light, heavy and air enemies, with a damage multiplier for each tower against each class.
  - Heavy plant takes half of any slow, and gusts and knockback can't move it. Every boss counts as heavy plant.
  - A 30% slow floor (`SLOW_FLOOR`).
  - Wave pay is 14+3w (was 20+5w), income towers are cut by about a third, the early bonus is 8+2w, and bounties are cut by 20%.
  - Crowd levels pay half bounty. Level 96 had been raining about 2,000 Marks a wave from kills.
  - Endless health compounds ×1.075 a wave, starting at 0.5× the story level's tuned health. The act's boss comes every tenth wave from wave 20. Endless wave pay is 10+2w (capped at w=15), at half income.
- **Bots:**
  - competent: counts heavy plant and builds Silos and Cannons for it;
  - balanced: adds the Silo to its mix.
  - Full re-tune: tune, `--verify`, `--antispam 8 100`.
- **Result:**
  - Health per level is about the same as before (×0.99 on average), with much less money, so winning now takes counters.
  - The best bot wins all 100 levels, keeping 81% of its Goodwill on average.
  - The naive Scarecrows-only bot wins 5 of the 93 levels from 8 (8, 14, 20, 21, 30), down from 9.
- **Endless** (`scripts/hedgerow-endless-measure.ts`, week 39): the best bot dies at wave 30, 15, 40, 29, 26, 11, 25, 30, 19 and 15 (acts 1 to 10). It used to coast past wave 100.

## 2026-10-09 verify pass
`hedgerow-tune --verify` over levels 1-100 (incl. bridges 13/53/72/93): all 100 completed and the generated HP table is unchanged, so shipped values still hold.

## 2026-10-10 Hedgerow 2 M1 retune (Cath on a post, manual abilities)
Cath no longer walks to the lead vehicle: she holds a post (66% down the lane), holds two vehicles and swings (10, was 15) only at anything else in reach, so the towers finish what she holds. Nothing casts unless it is on Auto, so the bots call `castAbilities` themselves twice a second. A first tune with her still whacking held vehicles (damage 6) left a thin human-style level 1 build at 30% Cath kills, so the hold rule changed and the tune was rerun: full `hedgerow-tune.ts` (levels 1-100, about 45 min on 4 cores) then `--verify` (backed off on 58 levels). Median shipped HP scale versus the pre-M1 table, by act: 0.89, 0.82, 0.86, 0.84, 1.01, 1.05, 1.00, 0.90, 0.98, 1.00. `best` bot, Cath's share of kills: level 1 10%, level 3 3%, level 8 4%, level 50 2%; a scripted 3-Scarecrow level 1 run in the browser: 1 of 31 (3%). All Hedgerow level tests pass.

## 2026-10-10 Hedgerow 2 M1 review: level 1 forgives plot choice
The M1 review found level 1 lost by most first builds: 4 Scarecrows on random lane-side plots won 50 of 300 runs, because Cath held vans at a post no tower reached, was knocked down and dropped them. Changes: on levels 1-5 (`learning()`), with nothing else in reach she swings at what she holds at 20% damage (`HELD_SWING`), and held vehicles hurt her at 60% (`LEARNING_HURT`); level 1's human margin is 0.65 (was 0.9). `hedgerow-tune.ts 1 5` then `--verify 1 5`: L1 1.48→1.54 (ships 1.0), L2 1.01→1.23, L3 1.2→1.38, L4 2.41→2.17, L5 1.45→1.55; verify unchanged. Level 1 now: random 4-Scarecrow builds win 180/200 keeping 8.6 Goodwill on average (test: at least 75% of 40); best bot keeps 100% with Cath on 9.7% of kills (test: 5-20%); naive bot keeps 100%. Levels 6+ unchanged.

## 2026-10-10 Hedgerow 2 M2: the Fleet in act 1 (start Marks k, never HP)
Levels 1-10 play the Fleet on Round Book windows (1-12 ... 5-18), Goodwill 120, a Mark a layer, leaks cost FV. Fleet tower numbers (fleet.ts): Scarecrow 200, d1/1/2, pierce 2/4/4, 0.85/0.65/0.55 s; Beehive 300, pierce 6/8/10; Windmill 350; Hedgerow 100 (slow only until M4); upgrades at 1x and 2.5x base, specs 5x. Book: budgets within 1% of 18 r^1.5 (breathers 0.6 at R11/R23, spikes 1.6 at R14/R17/R20/R24/R29); R6-R9 lean on vans and pickups over Same-Day vans so level 1's short lane holds. Cath knocks 2 layers a swing (best bot: 4% of level 1 kills; M6 kits raise it).
`hedgerow-tune.ts 1 10` (fits k in [0.7, 1.0]) then `--verify 1 10`: every level at k = 0.7, the floor; verify unchanged. Best bot kept at k 0.7: L1 1.00, L2 1.00, L3 1.00, L4 1.00, L5 1.00, L6 1.00, L7 1.00, L8 1.00, L9 0.89 (night; competent loses, balanced wins), L10 1.00; naive Scarecrow spam: 0.95, 1.00, 1.00, 0.99, 1.00, 1.00, 1.00, 1.00, 0.68, 1.00. So act 1 on the Fleet is easier than its bot targets and k can't go lower: the lever is M3's property rounds (Wrapped R8, Sealed R15, Reefer R18) and lessons, not health. Level 1 by hand-style builds (30 runs each): 3 Scarecrows never upgraded lose 30/30; 4 random never upgraded lose 30/30; 4 random upgraded win 30/30 keeping 80/120; 6 random upgraded win 28/30 keeping 88; stacking every round loses 30/30; longest round with a simple build 36-42 s. Perf: 350 vehicles + 40 towers step in under 2 ms (test).

## 2026-10-10 Hedgerow 2 M2 review: act 1 stops being free
The review found every act 1 level at the old k floor with the best bot keeping 100% and Scarecrow spam 95-100%. Changes: Book rounds 4-9 spawn 15% tighter and rounds 10-30 30% tighter (same Fleet Value, shorter and denser rounds); round 1 has 3 hatchbacks among 12 couriers; on fleet levels Crowds bring every vehicle a rung smaller at the same FV in 70% of the time, Air drop flies every third vehicle in as quadcopters/drones of about its FV (was: a drone tail of 0.4 x the count, 75 s of spawning), Night is range x0.85 with no speed bonus (was x0.75 and +10%: the best bot lost round 4 with any purse); levels 3, 6 and 8 swap three rounds each for themed ones of equal FV. Start Marks are now k x (500 + the Book's income before the first round), k in [0.4, 1.2] (was 500 + k x income, k in [0.7, 1.0]: level 1 could only ever open on 500); level 1 is pinned at 1.2 (tutorial: random 4-Scarecrow builds must win).
`hedgerow-tune.ts 1 10` then `--verify 1 10`: k = 1.2, 0.83, 0.77, then 0.49 (L4-9, held up by L9's 0.49) and 0.4 (L10); verify unchanged. Shipped start Marks 600, 481, 446, 339, 339, 339, 416, 518, 518, 423. Best bot kept: 1.00, 0.95, 0.93, 1.00, 1.00, 0.86, 1.00, 0.92, 0.54, 0.75. Naive Scarecrow spam: 0.81, 0.82, 0.89, then loses L4, 0.67 on L5, loses L6-L10. Level 1 by hand-style builds: 3 Scarecrows never upgraded lose; 4 upgraded keep 26/120 with rounds of 9-23 s; 6 best plots upgraded keep 120 and one stacked round pays +12 Marks, stacking every round loses. Perf: the fleet step with 350 popping lorries and 40 T3 towers went from about 5.4 ms to 0.95 ms (lane-distance index, per-step lookups; bit-identical results).
