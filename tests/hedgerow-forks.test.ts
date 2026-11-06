// Plan item 194: a fork level's second lane carries traffic. From Hedgerow 2 M2 the Round Book's waves replaced
// the forked ones, so nothing but air-twist drones took lane 1 and its depot read '0 next' all level.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";

describe("hedgerow forks", () => {
  const forks = LEVELS.filter((l) => l.path2);
  it("there are fork levels", () => expect(forks.length).toBeGreaterThanOrEqual(10));
  for (const lv of forks)
    it(`level ${lv.id}: both lanes carry traffic from the first round, and a boss keeps the first`, () => {
      expect(lv.waves[0]!.some((g) => g.lane === 1 && g.count > 0)).toBe(true);
      expect(lv.waves[0]!.some((g) => !g.lane && g.count > 0)).toBe(true);
      const sent = lv.waves.flat().filter((g) => g.lane === 1).reduce((a, g) => a + g.count, 0);
      const all = lv.waves.flat().reduce((a, g) => a + g.count, 0);
      expect(sent / all).toBeGreaterThan(0.2);
      for (const g of lv.waves.flat()) if (g.enemy === "boss" || g.count === 1 && g.gap === 1 && g.delay === 0) expect(g.lane).toBeUndefined();
    });
});
