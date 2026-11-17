import { describe, expect, it } from "vitest";
import { SKILL_PREVIEWS } from "../games/cathode/src/game/skillpreview";
import { SKILLS } from "../games/cathode/src/sim/classes";
import { TREE_IDS } from "../games/cathode/src/sim/types";

// Plan item 481: every class's three trees have a preview on the pick, each showing a real active of that tree.
describe("skill tree previews", () => {
  it("all 15 trees map to an active of their own tree", () => {
    expect(TREE_IDS.length).toBe(15);
    for (const t of TREE_IDS) {
      const p = SKILL_PREVIEWS[t];
      expect(p, t).toBeDefined();
      const s = SKILLS[p.active] as { tree?: string; active?: unknown } | undefined;
      expect(s?.active, `${t}: ${p.active} is an active`).toBeTruthy();
      expect(s?.tree, `${t}: ${p.active}'s tree`).toBe(t);
      expect(p.ms).toBeGreaterThanOrEqual(1500);
      expect(p.ms).toBeLessThanOrEqual(2500);
    }
  });
  it("each class's three looks differ", () => {
    for (let i = 0; i < 15; i += 3) {
      const looks = TREE_IDS.slice(i, i + 3).map((t) => SKILL_PREVIEWS[t].look);
      expect(new Set(looks).size).toBe(3);
    }
  });
});
