// Every Hedgerow level, 1-25: connected lanes, lost by a player who builds nothing, won by the
// competent bot (games/hedgerow/src/bot.ts), whose Goodwill the tuner targets (docs/design/hedgerow-v2.md 2).
// Split into four files so vitest runs them in parallel.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { kept, playLevel } from "../games/hedgerow/src/bot";
import { stars } from "../games/hedgerow/src/engine";

describe("hedgerow levels 1-25", () => {
  for (const lv of LEVELS.filter((l) => l.id >= 1 && l.id <= 25)) {
    it(`level ${lv.id} (${lv.name}): a fair fight`, () => {
      for (const path of [lv.path, lv.path2].filter(Boolean) as Array<typeof lv.path>) {
        for (let i = 1; i < path.length; i++) {
          const [ax, ay] = path[i - 1]!;
          const [bx, by] = path[i]!;
          expect(ax === bx || ay === by).toBe(true);
        }
        for (const [x, y] of path) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(lv.cols);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(lv.rows);
        }
      }
      expect(playLevel(lv, "idle").phase).toBe("lost");
      const won = playLevel(lv, "competent");
      expect(won.phase).toBe("won");
      expect(stars(won)).toBeGreaterThanOrEqual(1);
      expect(kept(won)).toBeGreaterThanOrEqual(0.5);
    }, 120_000);
  }
});
