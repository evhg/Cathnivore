import { describe, expect, it } from "vitest";
import { POISE, STAGGER, makeStagger, reactionMs, staggerDir, staggerHit, staggerTick, type StaggerHit } from "../games/cathode/src/sim/stagger";

const HP = 100;
const hit = (o: Partial<StaggerHit> = {}): StaggerHit => ({ damage: 10, maxHp: HP, poise: 1, zone: "torso", weaponCls: "rifle", distance: 10, dir: { x: 0, z: -1 }, ...o });

describe("cathode-stagger: accumulation and decay", () => {
  it("fills by damage / maxHp x poise", () => {
    const s = makeStagger();
    staggerHit(s, hit({ damage: 20 }));
    expect(s.meter).toBeCloseTo(0.2);
    staggerHit(s, hit({ damage: 10, poise: 0.6 }));
    expect(s.meter).toBeCloseTo(0.26);
  });
  it("half of what a plate took still counts", () => {
    const s = makeStagger();
    staggerHit(s, hit({ damage: 4, plateDamage: 12 }));
    expect(s.meter).toBeCloseTo(0.1);
  });
  it("holds for 0.6 s after a hit, then drains at 0.35 a second", () => {
    const s = makeStagger();
    staggerHit(s, hit({ damage: 30 }));
    for (let i = 0; i < 6; i++) staggerTick(s, 0.1);
    expect(s.meter).toBeCloseTo(0.3);
    staggerTick(s, 0.5);
    expect(s.meter).toBeCloseTo(0.3 - 0.35 * 0.5, 5);
    staggerTick(s, 5);
    expect(s.meter).toBe(0);
  });
});

describe("cathode-stagger: thresholds, poise and cooldowns", () => {
  it("staggers at 0.35 and knocks down at 0.8", () => {
    const s = makeStagger();
    expect(staggerHit(s, hit({ damage: 30 })).reaction).toBe("flinch");
    expect(staggerHit(s, hit({ damage: 10 })).reaction).toBe("stagger");
    expect(staggerHit(s, hit({ damage: 30 })).reaction).toBe("flinch");
    const r = staggerHit(s, hit({ damage: 20 }));
    expect(r.reaction).toBe("knockdown");
    expect(s.meter).toBe(0);
  });
  it("poise slows it: a riot shield needs more", () => {
    const a = makeStagger();
    const b = makeStagger();
    staggerHit(a, hit({ damage: 36, poise: POISE.enforcer! }));
    staggerHit(b, hit({ damage: 36, poise: POISE.riot! }));
    expect(a.meter).toBeGreaterThan(STAGGER.stagger);
    expect(b.meter).toBeLessThan(STAGGER.stagger);
  });
  it("the mech never knocks down from the meter", () => {
    const s = makeStagger();
    for (let i = 0; i < 20; i++) expect(staggerHit(s, hit({ damage: 100, poise: POISE.mech! })).reaction).not.toBe("knockdown");
  });
  it("a stagger can't play again for 1.2 s, a knockdown for 4 s", () => {
    const s = makeStagger();
    expect(staggerHit(s, hit({ damage: 40 })).reaction).toBe("stagger");
    s.meter = 0.4;
    expect(staggerHit(s, hit({ damage: 1 })).reaction).toBe("flinch");
    staggerTick(s, 1.21);
    s.meter = 0.4;
    expect(staggerHit(s, hit({ damage: 1 })).reaction).toBe("stagger");
    const k = makeStagger();
    expect(staggerHit(k, hit({ damage: 90 })).reaction).toBe("knockdown");
    staggerTick(k, 3.9);
    k.meter = 0.9;
    expect(staggerHit(k, hit({ damage: 1 })).reaction).not.toBe("knockdown");
    staggerTick(k, 0.2);
    k.meter = 0.9;
    expect(staggerHit(k, hit({ damage: 1 })).reaction).toBe("knockdown");
  });
  it("a close shotgun blast of 25% knocks down; at 5 m it doesn't", () => {
    expect(staggerHit(makeStagger(), hit({ damage: 26, weaponCls: "shotgun", distance: 3 })).reaction).toBe("knockdown");
    expect(staggerHit(makeStagger(), hit({ damage: 26, weaponCls: "shotgun", distance: 5 })).reaction).not.toBe("knockdown");
    expect(staggerHit(makeStagger(), hit({ damage: 5, explosive: true })).reaction).toBe("knockdown");
  });
  it("the stagger opens a 1.5 s crit window, spent by the next hit", () => {
    const s = makeStagger();
    staggerHit(s, hit({ damage: 40 }));
    expect(s.critMs).toBe(STAGGER.critWindowMs);
    expect(staggerHit(s, hit({ damage: 1 })).crit).toBe(true);
    expect(staggerHit(s, hit({ damage: 1 })).crit).toBe(false);
    const t = makeStagger();
    staggerHit(t, hit({ damage: 40 }));
    staggerTick(t, 1.6);
    expect(staggerHit(t, hit({ damage: 1 })).crit).toBe(false);
  });
});

describe("cathode-stagger: direction and the helmet", () => {
  it("reads which way the round travelled against his facing", () => {
    expect(staggerDir({ x: 0, z: -1 })).toBe("front");
    expect(staggerDir({ x: 0.2, z: 1 })).toBe("back");
    expect(staggerDir({ x: 1, z: 0.3 })).toBe("left");
    expect(staggerDir({ x: -1, z: -0.3 })).toBe("right");
  });
  it("a pistol head hit staggers, unless the visor still stands", () => {
    expect(staggerHit(makeStagger(), hit({ damage: 5, zone: "head", weaponCls: "pistol" })).reaction).toBe("stagger");
    expect(staggerHit(makeStagger(), hit({ damage: 5, zone: "head", weaponCls: "pistol", helmetUp: true })).reaction).toBe("flinch");
    expect(staggerHit(makeStagger(), hit({ damage: 5, zone: "head", weaponCls: "smg" })).reaction).toBe("flinch");
  });
  it("durations: front 600, back 550, sides 500; a knockdown falls, lies and gets up", () => {
    expect(reactionMs("stagger", "front")).toBe(600);
    expect(reactionMs("stagger", "back")).toBe(550);
    expect(reactionMs("stagger", "left")).toBe(500);
    expect(reactionMs("knockdown", "front")).toBe(STAGGER.knock.fallMs + STAGGER.knock.downMs + STAGGER.knock.upMs);
    expect(reactionMs("flinch", "front")).toBe(0);
  });
});

import { reactDuration, reactPose, reactTravel } from "../games/cathode/src/game/anim/react";

describe("cathode-stagger: the reaction poses (game/anim/react.ts)", () => {
  for (const dir of ["front", "back", "left", "right"] as const) {
    it(`the ${dir} stagger starts at rest and ends on the steps it took`, () => {
      const p0 = reactPose("stagger", dir, 0);
      expect(Math.abs(p0.pelvisX) + Math.abs(p0.pelvisZ) + Math.abs(p0.pitch) + Math.abs(p0.roll)).toBeLessThan(1e-6);
      const dur = reactDuration("stagger", dir);
      const p1 = reactPose("stagger", dir, dur);
      const tr = reactTravel("stagger", dir);
      expect(p1.pelvisX).toBeCloseTo(tr.x, 3);
      expect(p1.pelvisZ).toBeCloseTo(tr.z, 3);
      // Both feet end where the hips went (he stands square again when the steps are committed).
      expect(p1.footLX).toBeCloseTo(tr.x, 3);
      expect(p1.footRZ).toBeCloseTo(tr.z, 3);
      expect(Math.abs(p1.pitch) + Math.abs(p1.roll) + Math.abs(p1.armDrop) + p1.clutch).toBeLessThan(1e-3);
    });
  }
  it("front: two steps back of 0.35 m, the arm drops 45 degrees, the off hand clutches", () => {
    const mid = reactPose("stagger", "front", 300);
    expect(mid.armDrop).toBeCloseTo((45 * Math.PI) / 180, 2);
    expect(mid.clutch).toBeCloseTo(1, 2);
    expect(reactTravel("stagger", "front").z).toBeCloseTo(-0.35);
  });
  it("back: pitched 25 degrees forward", () => {
    expect(reactPose("stagger", "back", 275).pitch).toBeCloseTo((25 * Math.PI) / 180, 2);
  });
  it("knockdown: down by the end of the fall, up again at the end", () => {
    const fall = reactPose("knockdown", "front", 450);
    expect(fall.lie).toBeGreaterThan(0.95);
    const dur = reactDuration("knockdown", "front");
    expect(reactPose("knockdown", "front", dur).lie).toBeLessThan(1e-3);
    expect(reactPose("knockdown", "front", 1000).lie).toBeGreaterThan(0.95);
  });
});
