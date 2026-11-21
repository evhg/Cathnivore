// Plan item 399: each act's field furnished as its own country (fieldkit.ts), not one farm kit everywhere.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { BRINDLE_KIT, FIELD_KITS, bedBase, kitFor } from "../games/hedgerow/src/fieldkit";
import { fieldAt, plotLooks } from "../games/hedgerow/src/plotlook";

const kits = [BRINDLE_KIT, ...Object.values(FIELD_KITS).map((k) => k!)];

describe("field kits", () => {
  it("share no building, bed, water, house or knoll look between acts' kits", () => {
    for (let i = 0; i < kits.length; i++)
      for (let j = i + 1; j < kits.length; j++) {
        const [a, b] = [kits[i]!, kits[j]!];
        expect(a.barn, `${a.name} / ${b.name}`).not.toBe(b.barn);
        expect(a.water, `${a.name} / ${b.name}`).not.toBe(b.water);
        expect(a.house, `${a.name} / ${b.name}`).not.toBe(b.house);
        expect(a.knoll.top, `${a.name} / ${b.name}`).not.toBe(b.knoll.top);
        for (const bed of a.beds) expect(b.beds, `${a.name} / ${b.name}`).not.toContain(bed);
      }
  });

  it("give every act after Brindle its own kit, and the farm's to Brindle", () => {
    for (let act = 1; act < 10; act++) expect(kitFor({ id: act * 10 + 5 }), `act ${act + 1}`).not.toBe(BRINDLE_KIT);
    expect(kitFor({ id: 5 })).toBe(BRINDLE_KIT);
    expect(kitFor({ id: 15 }).name).toBe("hill farm");
    expect(kitFor({ id: 21 }).name).toBe("saltmarsh");
    expect(kitFor({ id: 30 }).name).toBe("saltmarsh");
    expect(kitFor({ id: 34 }).name).toBe("water meadow");
    expect(kitFor({ id: 45 }).name).toBe("woodland holding");
    expect(kitFor({ id: 55 }).name).toBe("shingle croft");
    expect(kitFor({ id: 65 }).name).toBe("agribusiness");
    expect(kitFor({ id: 75 }).name).toBe("allotments");
    expect(kitFor({ id: 85 }).name).toBe("agri-tech");
    expect(kitFor({ id: 95 }).name).toBe("market garden");
  });

  it("sow every plot of a level from its act's kit", () => {
    for (const level of LEVELS) {
      const beds = new Set<string>([...kitFor(level).beds, ...kitFor(level).margins, "puddle"]);
      for (const look of plotLooks(level).values()) expect(beds.has(look), `level ${level.id} ${look}`).toBe(true);
    }
  });

  it("keep three different beds in the 3D view for each kit (neighbours still differ there)", () => {
    for (const kit of kits) expect(new Set(kit.beds.map(bedBase)).size, kit.name).toBe(3);
  });

  // Plan item 621: a level's farm reads as five crops or more, the act's own three plus two borrowed margins.
  it("sow 5+ different beds on every level with five fields or more", () => {
    for (const kit of kits) for (const m of kit.margins) expect(kit.beds, kit.name).not.toContain(m);
    for (const level of LEVELS) {
      const looks = plotLooks(level);
      const fields = new Set([...looks.keys()].map((k) => { const [c, r] = k.split(",").map(Number) as [number, number]; return fieldAt(level, c, r)?.id; }));
      if (fields.size >= 5) expect(new Set(looks.values()).size, `level ${level.id}`).toBeGreaterThanOrEqual(5);
    }
  });
});
