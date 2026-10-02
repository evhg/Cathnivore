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
