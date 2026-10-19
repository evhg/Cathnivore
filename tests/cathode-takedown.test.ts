import { describe, expect, it } from "vitest";
import {
  TAKEDOWN,
  TAKEDOWN_VARIANTS,
  approachFor,
  blowsInOrder,
  holdKnocksOut,
  lethalMs,
  magnetMs,
  orbPull,
  pickTakedownVariant,
  syncPoint,
  takedownEligible,
  takedownRewards,
  variantById,
  type TakedownApproach,
  type TakedownTargetState,
  type TakedownVariantId,
} from "../games/cathode/src/sim/takedown";

const D = Math.PI / 180;
const base: TakedownTargetState = { state: "unaware", hpFrac: 1, dist: 1.5, fromBack: 10 * D, viewOff: 5 * D };
const elig = (o: Partial<TakedownTargetState>, wire = false) => takedownEligible({ ...base, ...o }, wire);

describe("CATHODE takedown eligibility (S5.1)", () => {
  it("an unaware or suspicious man from within 70 degrees of his back", () => {
    expect(elig({}).ok).toBe(true);
    expect(elig({ state: "suspicious", fromBack: 69 * D }).ok).toBe(true);
    expect(elig({ fromBack: 71 * D })).toMatchObject({ ok: false, why: "aware" });
    expect(elig({ state: "searching" })).toMatchObject({ ok: false, why: "aware" });
    expect(elig({ state: "combat" })).toMatchObject({ ok: false, why: "aware" });
  });

  it("anyone staggered, knocked down, crawling or surrendered, from any side and any state", () => {
    for (const flag of ["staggered", "knockedDown", "crawling", "surrendered"] as const) {
      expect(elig({ state: "combat", fromBack: 180 * D, [flag]: true }).ok).toBe(true);
    }
  });

  it("anyone below 20% health, even hunting her face to face", () => {
    expect(elig({ state: "combat", fromBack: Math.PI, hpFrac: 0.19 }).ok).toBe(true);
    expect(elig({ state: "combat", fromBack: Math.PI, hpFrac: 0.21 }).ok).toBe(false);
  });

  it("within 2.5 m (the wire: 3 m), looking at him; never a machine; a cyberpsycho only staggered", () => {
    expect(elig({ dist: 2.49 }).ok).toBe(true);
    expect(elig({ dist: 2.6 })).toMatchObject({ ok: false, why: "range" });
    expect(elig({ dist: 2.9 }, true).ok).toBe(true);
    expect(elig({ viewOff: 70 * D })).toMatchObject({ ok: false, why: "view" });
    expect(elig({ machine: true, staggered: true })).toMatchObject({ ok: false, why: "machine" });
    expect(elig({ cyberpsycho: true })).toMatchObject({ ok: false, why: "cyberpsycho" });
    expect(elig({ cyberpsycho: true, staggered: true, state: "combat" }).ok).toBe(true);
    expect(elig({ state: "dead" })).toMatchObject({ ok: false, why: "dead" });
  });

  it("the approach comes from the angle off his back, or his state", () => {
    expect(approachFor({ fromBack: 30 * D })).toBe("behind");
    expect(approachFor({ fromBack: 90 * D })).toBe("side");
    expect(approachFor({ fromBack: 150 * D })).toBe("front");
    expect(approachFor({ fromBack: 10 * D, knockedDown: true })).toBe("down");
    expect(approachFor({ fromBack: 10 * D, crawling: true })).toBe("down");
    expect(approachFor({ fromBack: 10 * D, surrendered: true })).toBe("surrender");
  });
});

describe("CATHODE takedown variants (S5.2)", () => {
  it("eleven sequences, at least three per approach, each locking input for 0.9 to 1.4 s", () => {
    expect(TAKEDOWN_VARIANTS).toHaveLength(11);
    for (const a of ["behind", "front", "side"] as TakedownApproach[]) expect(TAKEDOWN_VARIANTS.filter((v) => v.approach === a).length).toBeGreaterThanOrEqual(3);
    for (const v of TAKEDOWN_VARIANTS) {
      expect(v.durMs).toBeGreaterThanOrEqual(900);
      expect(v.durMs).toBeLessThanOrEqual(1400);
      expect(v.syncM).toBeGreaterThanOrEqual(0.75);
      expect(v.syncM).toBeLessThanOrEqual(0.9);
      expect(v.releaseMs).toBeLessThan(v.durMs);
      for (const t of v.impacts) expect(t).toBeLessThan(v.releaseMs);
    }
  });

  it("the spec's timings: the wrap strikes at 420, the jaw shot at 650, the front double-tap at 700 and 820", () => {
    expect(lethalMs(variantById("behindWrap"))).toBe(420);
    expect(lethalMs(variantById("behindPistol"))).toBe(650);
    expect(blowsInOrder(variantById("frontKick"))).toEqual([700, 820]);
    expect(blowsInOrder(variantById("frontCollar"))).toEqual([300, 650]);
    expect(lethalMs(variantById("downStrike"))).toBe(380);
  });

  it("chosen by approach and weapon: a pistol finisher only with a pistol in hand", () => {
    for (let s = 0; s < 200; s++) {
      const v = pickTakedownVariant({ approach: "front", pistol: false, wall: false, seed: s });
      expect(v.approach).toBe("front");
      expect(v.weapon).toBe("any");
    }
    const seen = new Set<string>();
    for (let s = 0; s < 200; s++) seen.add(pickTakedownVariant({ approach: "behind", pistol: true, wall: false, seed: s }).id);
    expect([...seen].sort()).toEqual(["behindChoke", "behindPistol", "behindWrap"]);
  });

  it("the wall shove only with a wall; side without one falls back to the others", () => {
    for (let s = 0; s < 100; s++) expect(pickTakedownVariant({ approach: "side", pistol: false, wall: false, seed: s }).id).not.toBe("sideWall");
    const withWall = new Set<string>();
    for (let s = 0; s < 100; s++) withWall.add(pickTakedownVariant({ approach: "side", pistol: false, wall: true, seed: s }).id);
    expect(withWall.has("sideWall")).toBe(true);
  });

  it("never repeats either of the last two when another fits", () => {
    const recent: TakedownVariantId[] = [];
    for (let s = 0; s < 300; s++) {
      const v = pickTakedownVariant({ approach: "behind", pistol: true, wall: false, seed: s * 7.3, recent });
      expect(recent.slice(-2)).not.toContain(v.id);
      recent.push(v.id);
    }
    // Only one fits: it plays again rather than nothing.
    const only = pickTakedownVariant({ approach: "down", pistol: false, wall: false, seed: 1, recent: ["downStrike", "downStrike"] });
    expect(only.id).toBe("downStrike");
  });

  it("the first takedown of a save is always Behind A", () => {
    for (let s = 0; s < 20; s++) expect(pickTakedownVariant({ approach: "front", pistol: true, wall: true, seed: s, first: true }).id).toBe("behindWrap");
  });
});

describe("CATHODE takedown sync point and magnet (S5.1)", () => {
  const him = { x: 0, z: 0 };
  const back = { x: 0, z: -1 };
  it("0.75 to 0.9 m from him along the approach, in the open", () => {
    const p = syncPoint(him, back, 0.8, [], { x: 0, z: -2 });
    expect(p.fallback).toBe(false);
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(-0.8);
  });

  it("swings round a collider in the way, and is never inside one", () => {
    const crate = { minX: -0.5, minZ: -1.4, maxX: 0.5, maxZ: -0.55 };
    const p = syncPoint(him, back, 0.8, [crate], { x: 0, z: -2 });
    expect(p.fallback).toBe(false);
    const cx = Math.max(crate.minX, Math.min(p.x, crate.maxX));
    const cz = Math.max(crate.minZ, Math.min(p.z, crate.maxZ));
    expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThanOrEqual(TAKEDOWN.bodyR - 1e-9);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(0.6 - 1e-9);
  });

  it("boxed in on every side, she stays where she is", () => {
    const wall = { minX: -3, minZ: -3, maxX: 3, maxZ: 3 };
    const p = syncPoint(him, back, 0.8, [wall], { x: 0.2, z: -1.7 });
    expect(p).toEqual({ x: 0.2, z: -1.7, fallback: true });
  });

  it("the pull takes 120 to 300 ms", () => {
    expect(magnetMs(0)).toBe(120);
    expect(magnetMs(1)).toBeGreaterThan(120);
    expect(magnetMs(10)).toBe(300);
  });

  it("a takedown is heard within 2 m only", () => {
    expect(TAKEDOWN.noiseM).toBe(2);
  });
});

describe("CATHODE takedown rewards (S5.2)", () => {
  it("one or two health orbs at 8% of max health, one Guard orb, ammo only after a gun finisher", () => {
    const counts = new Set<number>();
    for (let s = 0; s < 60; s++) {
      const r = takedownRewards(variantById("behindWrap"), 200, s);
      const h = r.filter((o) => o.kind === "health");
      counts.add(h.length);
      expect(h.length).toBeGreaterThanOrEqual(1);
      expect(h.length).toBeLessThanOrEqual(2);
      for (const o of h) expect(o.amount).toBe(16);
      expect(r.filter((o) => o.kind === "guard")).toHaveLength(1);
      expect(r.some((o) => o.kind === "ammo")).toBe(false);
    }
    expect([...counts].sort()).toEqual([1, 2]);
    expect(takedownRewards(variantById("behindPistol"), 200, 3).some((o) => o.kind === "ammo")).toBe(true);
    // Seeded: the same takedown drops the same orbs.
    expect(takedownRewards(variantById("sideKnee"), 150, 9)).toEqual(takedownRewards(variantById("sideKnee"), 150, 9));
  });

  it("orbs magnetise to her after 400 ms within 4 m", () => {
    expect(orbPull(399, 1)).toBe(0);
    expect(orbPull(500, 4.1)).toBe(0);
    expect(orbPull(500, 3.9)).toBeGreaterThan(0);
    expect(orbPull(500, 0.5)).toBeGreaterThan(orbPull(500, 3.5));
  });

  it("a surrendered man is knocked out by holding the key 0.6 s", () => {
    expect(holdKnocksOut(599)).toBe(false);
    expect(holdKnocksOut(600)).toBe(true);
  });
});
