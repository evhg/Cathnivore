import { describe, expect, it } from "vitest";
import { buildOffice, officeLights, STATIONS } from "../games/cathode/src/render/levels/office";

// Plan item 58: the office is lit like a set, the same on every load, with a light over every station.
describe("officeLights", () => {
  it("has a fixed count per tier (the phone keeps two)", () => {
    expect(officeLights("phone")).toHaveLength(2);
    expect(officeLights("high")).toHaveLength(4);
    expect(officeLights("ultra")).toHaveLength(4);
    expect(officeLights("high")).toEqual(officeLights("high"));
  });
  for (const q of ["phone", "high"] as const)
    it(`every station has a light within 2 m (${q})`, () => {
      const lights = buildOffice(q).lights;
      for (const [id, s] of Object.entries(STATIONS)) {
        const near = lights.some((l) => Math.hypot(l.pos.x - s.x, l.pos.z - s.z) <= 2);
        expect(near, id).toBe(true);
      }
    });
});

import { BOARD_LIST, officeDressing } from "../games/cathode/src/game/office";
import { BUST_FOR_CASE } from "../games/cathode/src/ui/busts";

describe("the case board's polaroids", () => {
  it("are the List in order, with the bust each case closes on", () => {
    expect(BOARD_LIST.map((w) => w.job)).toEqual(["crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss"]);
    for (const w of BOARD_LIST) if (w.bust) expect(BUST_FOR_CASE[w.job]).toBe(w.bust);
    expect(BOARD_LIST.filter((w) => w.bust).length).toBeGreaterThanOrEqual(4);
  });
  it("strikes through the cases closed in the save", () => {
    expect(officeDressing(["crispBoss", "pellBoss"]).closed).toEqual(["crispBoss", "pellBoss"]);
  });
});
