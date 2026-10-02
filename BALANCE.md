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
