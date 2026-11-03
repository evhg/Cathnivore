// Plan item 64: a new enemy's field-guide page. Which enemies a round brings for the first time, its traits,
// and the level's towers that reach it.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { countersFor, needsUpgrade, newThisRound, rosetteSpot, traitsOf } from "../games/hedgerow/src/intro";
import type { TowerKind } from "../games/hedgerow/src/engine";

const ALL: TowerKind[] = ["hedgerow", "scarecrow", "beehive", "stall", "pond", "barn", "silo", "mast", "tent", "court", "hall", "windmill", "cannon"];
const level1 = LEVELS.find((l) => l.id === 1)!;

describe("newThisRound", () => {
  it("introduces the drone on its first round, and never again once seen", () => {
    const round = level1.waves.findIndex((w) => w.some((g) => g.enemy === "drone")) + 1;
    expect(round).toBeGreaterThan(0);
    expect(newThisRound(level1, round, {})).toContain("drone");
    expect(newThisRound(level1, round, { drone: true })).not.toContain("drone");
    for (let r = 1; r <= level1.waves.length; r++) expect(newThisRound(level1, r, { drone: true })).not.toContain("drone");
  });

  it("puts a boss first", () => {
    const lv = LEVELS.find((l) => l.waves.some((w) => w.some((g) => g.enemy === "boss")))!;
    const round = lv.waves.findIndex((w) => w.some((g) => g.enemy === "boss")) + 1;
    expect(newThisRound(lv, round, {})[0]).toBe("boss");
    expect(newThisRound(lv, round, { boss: true })).not.toContain("boss");
  });

  it("introduces each kind once over a whole campaign", () => {
    const seen: Record<string, boolean> = {};
    const met: string[] = [];
    for (const lv of LEVELS)
      lv.waves.forEach((_, i) => {
        for (const k of newThisRound(lv, i + 1, seen)) {
          met.push(k);
          seen[k] = true;
        }
      });
    expect(new Set(met).size).toBe(met.length);
  });

  it("is empty for a round past the end", () => {
    expect(newThisRound(level1, 999, {})).toEqual([]);
  });
});

describe("countersFor", () => {
  it("the drone: only towers that hit the air", () => {
    const c = countersFor("drone", ALL);
    expect(traitsOf("drone")).toContain("flies");
    expect(c).toContain("scarecrow");
    expect(c).not.toContain("barn");
    expect(c).not.toContain("hedgerow");
    expect(countersFor("drone", level1.towers)).toEqual(["scarecrow"]);
  });

  it("a boss: anything that hits", () => {
    const c = countersFor("boss", ALL);
    expect(traitsOf("boss")[0]).toBe("boss");
    expect(c.length).toBeGreaterThan(3);
    expect(c).not.toContain("stall");
  });

  it("the armoured lorry: plates turn Sharp, so a Scarecrow reaches it only as a Pumpkin Lobber", () => {
    const c = countersFor("steel", ALL);
    expect(traitsOf("steel")).toContain("armour");
    expect(c).not.toContain("barn");
    expect(c).toContain("silo");
    expect(needsUpgrade("steel", "silo")).toBe(false);
    if (c.includes("scarecrow")) expect(needsUpgrade("steel", "scarecrow")).toBe(true);
  });
});

describe("rosetteSpot", () => {
  const field = { w: 400, h: 300 }
  const size = { w: 80, h: 80 }
  it("sits on the spot nearest the lane's end that covers no plot", () => {
    const plots = [{ x: 300, y: 200, w: 60, h: 60 }, { x: 200, y: 200, w: 60, h: 60 }]
    const s = rosetteSpot(plots, size, field, { x: 330, y: 230 })
    const box = { ...s, ...size }
    for (const p of plots) expect(box.x < p.x + p.w && p.x < box.x + box.w && box.y < p.y + p.h && p.y < box.y + box.h).toBe(false)
    expect(Math.hypot(s.x + 40 - 330, s.y + 40 - 230)).toBeLessThan(120)
    expect(s.x).toBeGreaterThanOrEqual(6)
    expect(s.y + size.h).toBeLessThanOrEqual(field.h - 6)
  })
  it("keeps off an overlay (Cath's bubble) when a plot-free spot allows it", () => {
    const bubble = { x: 0, y: 200, w: 400, h: 100 }
    const s = rosetteSpot([], size, field, { x: 200, y: 260 }, 6, [bubble])
    expect(s.y + size.h).toBeLessThanOrEqual(200)
  })
  it("covers the least plot when nothing is clear", () => {
    const plots = [{ x: 0, y: 0, w: 400, h: 150 }, { x: 0, y: 150, w: 400, h: 150 }]
    const s = rosetteSpot(plots, size, field, { x: 200, y: 150 })
    expect(s).toBeDefined()
  })
})
