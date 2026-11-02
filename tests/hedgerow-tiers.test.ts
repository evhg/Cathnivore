import { describe, expect, it } from "vitest";
import { TOWERS, type TowerKind } from "../games/hedgerow/src/engine";
import { drawTower, towerTier, type TowerLook } from "../games/hedgerow/src/sprites";

// Plan item 19: each tower's three tiers draw three different sprites (a plank deck at tier 2, a stone drum at
// tier 3, and the tier's own parts), on classic and path (Fleet) towers alike.

/** A Canvas 2D stand-in that writes down every call and every style it is given, rounded so it compares. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const fmt = (v: unknown) => (typeof v === "number" ? v.toFixed(2) : typeof v === "string" ? v : typeof v);
  const gradient = { addColorStop: (o: number, c: string) => log.push(`stop ${fmt(o)} ${c}`) };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        log.push(`${key}(${args.map(fmt).join(",")})`);
        if (key.startsWith("create")) return gradient;
        if (key === "measureText") return { width: 10 };
        return undefined;
      };
    },
    set(_t, key: string, v: unknown) {
      target[key] = v;
      log.push(`${key}=${fmt(v)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

function sprite(look: TowerLook): string {
  const { ctx, log } = recorder();
  drawTower(ctx, look, 50, 50, 60, 0);
  return log.join("\n");
}

const KINDS = Object.keys(TOWERS) as TowerKind[];
const base = { spec: null, fired: 9, dazed: false } as const;

describe("tower tiers", () => {
  it("reads the visible tier from a path tower's best path, and caps a classic tier 4 at 3", () => {
    expect(towerTier({ tier: 1, path: [0, 0, 0] })).toBe(1);
    expect(towerTier({ tier: 2, path: [1, 2, 0] })).toBe(2);
    expect(towerTier({ tier: 3, path: [0, 1, 3] })).toBe(3);
    expect(towerTier({ tier: 4 })).toBe(3);
  });

  it.each(KINDS)("gives a classic %s a distinct sprite at each tier", (kind) => {
    const seen = new Set([1, 2, 3].map((tier) => sprite({ ...base, kind, tier })));
    expect(seen.size).toBe(3);
  });

  it.each(KINDS)("gives a path %s a distinct sprite at each tier of every path", (kind) => {
    for (let p = 0; p < 3; p++) {
      const looks = [1, 2, 3].map((n) => {
        const path = [0, 0, 0];
        path[p] = n;
        return sprite({ ...base, kind, tier: n, path });
      });
      expect(new Set(looks).size).toBe(3);
    }
  });

  it("stands a tier 2 on planks and a tier 3 on stone with a gold band", () => {
    const t1 = sprite({ ...base, kind: "scarecrow", tier: 1 });
    const t2 = sprite({ ...base, kind: "scarecrow", tier: 2 });
    const t3 = sprite({ ...base, kind: "scarecrow", tier: 3 });
    expect(t1).not.toContain("fillStyle=#c08a55");
    expect(t2).toContain("fillStyle=#c08a55");
    expect(t3).toContain("fillStyle=#8d8a80");
    expect(t3).toContain("strokeStyle=#f2c94c");
  });
});
