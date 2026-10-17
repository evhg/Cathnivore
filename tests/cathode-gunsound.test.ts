import { describe, expect, it } from "vitest";
import { RECIPES, VariantPicker, reflection, rng, variations } from "../games/cathode/src/game/gunsound";

describe("CATHODE gunshot audio (S2.5, C5)", () => {
  it("renders 8 distinct variants per class", () => {
    const vs = variations();
    expect(vs).toHaveLength(8);
    const keys = new Set(vs.map((v) => `${v.pitch.toFixed(4)}:${v.len.toFixed(3)}:${v.level.toFixed(3)}`));
    expect(keys.size).toBe(8);
    const pitches = vs.map((v) => v.pitch).sort();
    for (let i = 1; i < pitches.length; i++) expect(pitches[i]! - pitches[i - 1]!).toBeGreaterThan(0.005);
    for (const v of vs) expect(Math.abs(v.pitch - 1)).toBeLessThan(0.08);
  });

  it("never repeats one of the last two variants", () => {
    for (const seed of [1, 2, 3, 99]) {
      const p = new VariantPicker(8, 2, rng(seed));
      const seen = new Set<number>();
      let a = -1;
      let b = -1;
      for (let i = 0; i < 2000; i++) {
        const v = p.pick();
        expect(v).not.toBe(a);
        expect(v).not.toBe(b);
        seen.add(v);
        b = a;
        a = v;
      }
      expect(seen.size).toBe(8);
    }
  });

  it("the pistol's layers match the S2.5 table", () => {
    const p = RECIPES.pistol!;
    expect(p.transient).toEqual({ dur: 0.012, hp: 1500, db: -9 });
    expect(p.body.lp).toBe(2200);
    expect(p.body.sweep).toEqual([160, 70]);
    expect(p.mech.at).toEqual([0.022, 0.062]);
    expect(p.lfe).toEqual({ hz: 55, dur: 0.1, db: -16 });
  });

  it("a reflection arrives at 2d/343 s, 0.3 dB quieter per metre", () => {
    const r10 = reflection(10);
    const r20 = reflection(20);
    expect(r10.delay).toBeCloseTo(20 / 343, 6);
    expect(20 * Math.log10(r10.gain)).toBeCloseTo(-17, 4);
    expect(20 * Math.log10(r20.gain)).toBeCloseTo(-20, 4);
  });
});
