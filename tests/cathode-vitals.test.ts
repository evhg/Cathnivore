// C6 (docs/design/cathode-combat.md S6.1): Guard and Flesh, the bleed floor, the tiers, the bearing, and a
// seeded fight that keeps time-to-death within 10% of the old single pool on every difficulty.
import { describe, expect, it } from "vitest";
import { bearing, tierOf, Vitals, VITALS, woundW } from "../games/cathode/src/sim/vitals";
import { timeToDeath } from "../games/cathode/src/sim/fightsim";

const step = (v: Vitals, s: number, dt = 1 / 60) => {
  for (let t = 0; t < s - 1e-9; t += dt) v.update(dt);
};

describe("CATHODE vitals (C6)", () => {
  it("splits the old pool 40/60 and carries overflow from Guard into Flesh", () => {
    const v = new Vitals(100);
    expect(v.maxGuard).toBeCloseTo(40);
    expect(v.maxFlesh).toBeCloseTo(60);
    expect(v.total).toBeCloseTo(100);
    const r = v.damage(30);
    expect(r).toEqual({ guard: 30, flesh: 0, broke: false });
    const r2 = v.damage(25);
    expect(r2.guard).toBeCloseTo(10);
    expect(r2.flesh).toBeCloseTo(15);
    expect(r2.broke).toBe(true);
    expect(v.drain()).toEqual(["guardBreak"]);
    expect(v.guard).toBe(0);
    expect(v.flesh).toBeCloseTo(45);
    // A broken Guard doesn't break again.
    v.damage(5);
    expect(v.drain()).toEqual([]);
  });

  it("starts Guard regen 4.0 s after a hit, fills it in 2.0 s, and a 0-damage hit resets the delay", () => {
    const v = new Vitals(100);
    v.damage(40);
    v.drain();
    step(v, 3.5);
    expect(v.guard).toBe(0);
    v.damage(0);
    step(v, 3.9);
    expect(v.guard).toBe(0);
    expect(v.drain()).toEqual([]);
    step(v, 0.2);
    expect(v.drain()).toEqual(["regenStart"]);
    expect(v.regenerating).toBe(true);
    step(v, 1.0);
    // Ease-in-out: about half way at the midpoint.
    expect(v.guard).toBeGreaterThan(14);
    expect(v.guard).toBeLessThan(28);
    step(v, 1.1);
    expect(v.guard).toBeCloseTo(40);
    expect(v.drain()).toEqual(["guardFull"]);
    expect(v.regenerating).toBe(false);
  });

  it("regen fires within one frame of 4.0 s", () => {
    const v = new Vitals(100);
    v.damage(10);
    v.drain();
    const dt = 1 / 60;
    let t = 0;
    let at = -1;
    while (t < 5 && at < 0) {
      t += dt;
      if (v.update(dt).includes("regenStart")) at = t;
      v.drain();
    }
    expect(Math.abs(at - VITALS.regenDelayS)).toBeLessThanOrEqual(dt + 1e-9);
  });

  it("the bleed floor lifts Flesh to 25% at most, only after 6 s, and nothing else heals Flesh", () => {
    const v = new Vitals(100);
    v.damage(40 + 59);
    expect(v.flesh).toBeCloseTo(1);
    step(v, 5.9);
    expect(v.flesh).toBeCloseTo(1);
    step(v, 4);
    // 3%/s of 60 for about 4 s: 1 + 7.2.
    expect(v.flesh).toBeGreaterThan(7);
    expect(v.flesh).toBeLessThan(10);
    step(v, 60);
    expect(v.flesh).toBeCloseTo(v.maxFlesh * VITALS.bleedFloorShare);
    expect(v.fleshFrac).toBeLessThanOrEqual(0.25 + 1e-9);
    expect(v.guard).toBeCloseTo(40);
    // Above the floor, Flesh stays where it is.
    const w = new Vitals(100);
    w.damage(70);
    step(w, 30);
    expect(w.flesh).toBeCloseTo(30);
  });

  it("heals go into Flesh and never past it; a new maximum keeps each layer's share", () => {
    const v = new Vitals(100);
    v.damage(70);
    v.heal(10);
    expect(v.flesh).toBeCloseTo(40);
    v.healShare(0.15);
    expect(v.flesh).toBeCloseTo(49);
    v.heal(999);
    expect(v.flesh).toBeCloseTo(60);
    expect(v.guard).toBe(0);
    v.setMax(200);
    expect(v.flesh).toBeCloseTo(120);
    expect(v.guard).toBe(0);
  });

  it("tier bounds and w", () => {
    expect(tierOf(1)).toBe("fine");
    expect(tierOf(0.61)).toBe("fine");
    expect(tierOf(0.6)).toBe("hurt");
    expect(tierOf(0.3)).toBe("hurt");
    expect(tierOf(0.29)).toBe("critical");
    expect(tierOf(0.1)).toBe("critical");
    expect(tierOf(0.09)).toBe("bleeding");
    expect(tierOf(0)).toBe("bleeding");
    expect(woundW(0.7)).toBe(0);
    expect(woundW(0.3)).toBeCloseTo(0.35);
    expect(woundW(0.1)).toBeCloseTo(0.85);
    expect(woundW(0)).toBeCloseTo(1);
    for (let f = 0; f < 1; f += 0.01) expect(woundW(f)).toBeGreaterThanOrEqual(woundW(f + 0.01) - 1e-9);
  });

  it("bearing: an attacker at +X with the camera facing -Z is 90 degrees; behind is 180", () => {
    const at = { x: 0, z: 0 };
    const fwd = { x: 0, z: -1 };
    expect((bearing(fwd, at, { x: 5, z: 0 }) * 180) / Math.PI).toBeCloseTo(90);
    expect((bearing(fwd, at, { x: -5, z: 0 }) * 180) / Math.PI).toBeCloseTo(-90);
    expect(bearing(fwd, at, { x: 0, z: -5 })).toBeCloseTo(0);
    expect(Math.abs((bearing(fwd, at, { x: 0, z: 5 }) * 180) / Math.PI)).toBeCloseTo(180);
  });

  it("a 10-minute seeded fight keeps time-to-death within 10% of the old pool on each difficulty", () => {
    for (const d of ["noir", "hardboiled", "hellWeek"]) {
      let a = 0;
      let b = 0;
      for (let s = 1; s <= 12; s++) {
        a += timeToDeath("pool", d, s).mean;
        b += timeToDeath("vitals", d, s).mean;
      }
      expect(Math.abs(b / a - 1), d).toBeLessThan(0.1);
    }
  });
});
