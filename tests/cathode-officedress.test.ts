import { describe, expect, it } from "vitest";
import { officeDressing, DRAWINGS } from "../games/cathode/src/game/office";

// Plan item 51: the office is dressed from the save alone.
describe("officeDressing", () => {
  const closers = ["crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss"];
  for (const n of [0, 1, 3, 5]) {
    it(`with ${n} cases closed`, () => {
      const jobs = ["fishMarket", "crispLead", ...closers.slice(0, n)];
      const d = officeDressing(jobs);
      expect(d.keepsakes).toHaveLength(n);
      expect(d.drawings).toHaveLength(Math.min(DRAWINGS.length, 1 + n));
      expect(new Set(d.drawings).size).toBe(d.drawings.length);
    });
  }
  it("fills the shelf in story order, whatever order the save lists them", () => {
    expect(officeDressing(["pellBoss", "crispBoss"]).keepsakes.map((k) => k.id)).toEqual(["gumshoes", "widowsVeil"]);
  });
  it("is the same for the same save", () => {
    expect(officeDressing(["crispBoss"])).toEqual(officeDressing(["crispBoss"]));
  });
});
