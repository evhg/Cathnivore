// Plan item 399: each act's field furnished as its own country (fieldkit.ts), not one farm kit everywhere.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { BRINDLE_KIT, FIELD_KITS, bedBase, kitFor } from "../games/hedgerow/src/fieldkit";
import { plotLooks } from "../games/hedgerow/src/plotlook";

const kits = [BRINDLE_KIT, ...Object.values(FIELD_KITS).map((k) => k!)];

describe("field kits", () => {
  it("share no building, bed or water look between acts' kits", () => {
    for (let i = 0; i < kits.length; i++)
      for (let j = i + 1; j < kits.length; j++) {
        const [a, b] = [kits[i]!, kits[j]!];
        expect(a.barn, `${a.name} / ${b.name}`).not.toBe(b.barn);
        expect(a.water, `${a.name} / ${b.name}`).not.toBe(b.water);
        for (const bed of a.beds) expect(b.beds, `${a.name} / ${b.name}`).not.toContain(bed);
      }
  });

  it("give Saltmarsh and Rivermead their own kits, and the farm's to Brindle", () => {
    expect(kitFor({ id: 5 })).toBe(BRINDLE_KIT);
    expect(kitFor({ id: 21 }).name).toBe("saltmarsh");
    expect(kitFor({ id: 30 }).name).toBe("saltmarsh");
    expect(kitFor({ id: 34 }).name).toBe("water meadow");
  });

  it("sow every plot of a level from its act's kit", () => {
    for (const level of LEVELS) {
      const beds = new Set<string>([...kitFor(level).beds, "puddle"]);
      for (const look of plotLooks(level).values()) expect(beds.has(look), `level ${level.id} ${look}`).toBe(true);
    }
  });

  it("keep three different beds in the 3D view for each kit (neighbours still differ there)", () => {
    for (const kit of kits) expect(new Set(kit.beds.map(bedBase)).size, kit.name).toBe(3);
  });
});
