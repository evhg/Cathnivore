import { describe, expect, it } from "vitest";
import { buildSetProps, STOOP_PROP } from "../games/cathode/src/render/frontsetprops";
import { SET_CLASSES } from "../games/cathode/src/render/frontsets";

// Plan item 498: each class's set is dressed with props of its own: the stoop's one (item 338) and three more, none
// shared between classes, each with real geometry, clear of the test-fire crate beside her.
describe("class pick set dressing", () => {
  const all = SET_CLASSES.map((c) => ({ cls: c, b: buildSetProps(c) }));

  it("gives every class 4 props of its own, the stoop's first", () => {
    const seen = new Set<string>();
    for (const { cls, b } of all) {
      expect(b.names.length, cls).toBeGreaterThanOrEqual(4);
      expect(b.names[0]).toBe(STOOP_PROP[cls]);
      for (const n of b.names) {
        expect(seen.has(n), `${cls} ${n}`).toBe(false);
        seen.add(n);
      }
      // every dressing prop has a box (the stoop's own is measured in the stoop)
      for (const n of b.names.slice(1)) expect(b.boxes[n]?.isEmpty(), `${cls} ${n}`).toBe(false);
    }
  });

  it("merges each class into one lit body and at most one glow", () => {
    for (const { cls, b } of all) {
      expect(b.body.getAttribute("position").count, cls).toBeGreaterThan(100);
      expect(b.body.getAttribute("color"), cls).toBeTruthy();
      expect(b.body.getAttribute("normal"), cls).toBeTruthy();
      if (b.glow) expect(b.glow.getAttribute("color"), cls).toBeTruthy();
    }
  });

  it("keeps the floor by the test-fire crate clear (x 0.15-0.7, z -1.1 to -0.35 below 0.9 m)", () => {
    for (const { cls, b } of all)
      for (const n of b.names.slice(1)) {
        const x = b.boxes[n]!;
        // a prop that spans the whole set (the parapet, the cables, the rail) runs behind or over it instead
        if (x.max.x - x.min.x > 3) continue;
        const hits = x.min.x < 0.7 && x.max.x > 0.15 && x.min.z < -0.35 && x.max.z > -1.1 && x.min.y < 0.9;
        expect(hits, `${cls} ${n} ${JSON.stringify(x)}`).toBe(false);
      }
  });
});
