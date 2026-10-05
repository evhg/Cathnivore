import { describe, expect, it } from "vitest";
import { mostWanted, weekKey } from "../games/cathode/src/sim/mostwanted";

describe("Most Wanted", () => {
  it("names the ISO week", () => {
    expect(weekKey(new Date("2026-10-05T12:00:00Z"))).toBe("2026-W41");
    expect(weekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(weekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });
  it("is the same for everyone in a week and varies across weeks", () => {
    expect(mostWanted("2026-W41")).toEqual(mostWanted("2026-W41"));
    const names = new Set(Array.from({ length: 20 }, (_, i) => mostWanted(`2026-W${i + 1}`).name));
    expect(names.size).toBeGreaterThan(8);
    const c = mostWanted("2026-W41");
    expect(c.guards).toBeGreaterThanOrEqual(2);
    expect(c.bonusDrops).toBeGreaterThanOrEqual(2);
  });
});
