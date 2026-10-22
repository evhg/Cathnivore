import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SECOND_WIND, SecondWind, weaponDt } from "../games/cathode/src/sim/secondwind";
import { Vitals } from "../games/cathode/src/sim/vitals";
import { Timescale } from "../games/cathode/src/game/feel/timescale";
import { Arsenal } from "../games/cathode/src/game/weapons";

const run = (sw: SecondWind, ms: number, step = 1000 / 60) => {
  const evs: string[] = [];
  for (let t = 0; t < ms; t += step) {
    const e = sw.update(step);
    if (e) evs.push(e);
  }
  return evs;
};

describe("CATHODE Second Wind (S6.5)", () => {
  it("takes one lethal blow per checkpoint", () => {
    const sw = new SecondWind();
    expect(sw.ready).toBe(true);
    expect(sw.lethal()).toBe(true);
    expect(sw.active).toBe(true);
    // A second lethal blow inside it is not taken again.
    expect(sw.lethal()).toBe(false);
    run(sw, 4000);
    expect(sw.ready).toBe(false);
    expect(sw.lethal()).toBe(false);
    sw.checkpoint();
    expect(sw.ready).toBe(true);
    expect(sw.lethal()).toBe(true);
  });

  it("is off on Hell Week, and the skill adds a charge", () => {
    expect(new SecondWind({ hellWeek: true }).lethal()).toBe(false);
    const sw = new SecondWind({ extraCharges: 1 });
    expect(sw.lethal()).toBe(true);
    sw.kill();
    run(sw, 1000);
    expect(sw.ready).toBe(true);
    expect(sw.lethal()).toBe(true);
    sw.kill();
    run(sw, 1000);
    expect(sw.ready).toBe(false);
  });

  it("starts the slow motion at the end of the 140 ms stop and expires at 3640 ms", () => {
    const sw = new SecondWind();
    sw.lethal();
    const evs: Array<[number, string]> = [];
    for (let t = 0; t < 4000; t += 10) {
      const e = sw.update(10);
      if (e) evs.push([t + 10, e]);
    }
    expect(evs[0]).toEqual([SECOND_WIND.stopMs, "window"]);
    expect(evs[1]![1]).toBe("expired");
    expect(evs[1]![0]).toBeGreaterThanOrEqual(SECOND_WIND.stopMs + SECOND_WIND.windowMs);
    expect(evs[1]![0]).toBeLessThan(SECOND_WIND.stopMs + SECOND_WIND.windowMs + 20);
  });

  it("a kill in the window revives her to +30% Flesh", () => {
    const v = new Vitals(100);
    v.damage(99.5);
    const sw = new SecondWind();
    expect(sw.lethal()).toBe(true);
    run(sw, 1500);
    const share = sw.kill();
    expect(share).toBe(0.3);
    v.healShare(share);
    expect(v.fleshFrac).toBeGreaterThanOrEqual(0.3);
    // No expiry follows: it eases out and is done.
    const evs = run(sw, 1000);
    expect(evs).toEqual(["done"]);
    expect(sw.look().grey).toBe(0);
  });

  it("a kill outside the window gives nothing", () => {
    const sw = new SecondWind();
    expect(sw.kill()).toBe(0);
    sw.lethal();
    run(sw, 3700);
    expect(sw.kill()).toBe(0);
  });

  it("the look: knee down over 220 ms, the world 90% grey, the outlines on, the timer drains", () => {
    const sw = new SecondWind();
    sw.lethal();
    sw.update(SECOND_WIND.dropMs);
    const a = sw.look();
    expect(a.drop).toBeCloseTo(SECOND_WIND.dropM, 5);
    expect(a.roll).toBeCloseTo((12 * Math.PI) / 180, 5);
    sw.update(1000);
    const b = sw.look();
    expect(b.grey).toBeCloseTo(0.9, 5);
    expect(b.outline).toBe(1);
    expect(b.timer).toBeGreaterThan(0.5);
    sw.update(2000);
    expect(sw.look().timer).toBeLessThan(b.timer);
    // The revive: outlines gone by 200 ms, colour back by 600 ms.
    sw.kill();
    sw.update(SECOND_WIND.outlineFadeMs);
    expect(sw.look().outline).toBe(0);
    expect(sw.look().grey).toBeCloseTo(0.9, 5);
    sw.update(SECOND_WIND.colourBackMs[1] - SECOND_WIND.outlineFadeMs);
    expect(sw.look().grey).toBeCloseTo(0, 5);
  });

  it("shots per real second are unaffected by simScale", () => {
    const shotsAt = (sim: number, sw: boolean) => {
      const a = new Arsenal(new THREE.Scene());
      a.equip(1);
      const eye = new THREE.Vector3();
      const dir = new THREE.Vector3(0, 0, -1);
      const q = new THREE.Quaternion();
      const ts = new Timescale();
      ts.push("secondWind", sim, -1, 0, 0, "secondWind");
      const real = 1 / 60;
      let shots = 0;
      for (let t = 0; t < 0.5; t += real) a.update(real, false, eye, dir, q, 1);
      // Hold the trigger for 3 real seconds, firing as fast as the gun allows (a press every frame it can).
      let held = false;
      for (let t = 0; t < 3; t += real) {
        ts.update(real);
        held = !held;
        if (a.update(weaponDt(real, real * ts.simScale, sw), held, eye, dir, q, 1)) shots++;
        if (a.ammo.mag === 0) a.topUp();
      }
      return shots;
    };
    const base = shotsAt(1, false);
    expect(base).toBeGreaterThan(5);
    expect(shotsAt(0.3, true)).toBe(base);
    // Without Second Wind's real clock the gun would slow with the world.
    expect(shotsAt(0.3, false)).toBeLessThan(base * 0.5);
  });
});
