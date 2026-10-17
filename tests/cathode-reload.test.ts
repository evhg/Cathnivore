import { describe, expect, it } from "vitest";
import { EMPTY, ReloadMachine, TAC, channel, pullTrigger, startReload, stepReload, type PistolMag } from "../games/cathode/src/game/feel/pistol";
import { tuning } from "../games/cathode/src/game/feel/tuning";

const K = tuning.kestrel.reload;
const gun = (ammo: number, reserve = 60): PistolMag => ({ ammo, reserve, mag: 12, locked: ammo === 0 });
const run = (h: PistolMag, rm: ReloadMachine, ms: number, step = 1000 / 60) => {
  const ev: string[] = [];
  for (let t = 0; t < ms; t += step) ev.push(...stepReload(h, rm, Math.min(step, ms - t)).events);
  return ev;
};

describe("CATHODE Kestrel reloads (S2.4, C5)", () => {
  it("a tactical reload lasts 1.55 s and commits the rounds at 60% (930 ms)", () => {
    const h = gun(5);
    const rm = new ReloadMachine();
    expect(startReload(h, rm)).toBe(true);
    expect(rm.kind).toBe("tac");
    expect(rm.commitAt).toBeCloseTo(930, 5);
    run(h, rm, 925);
    expect(h.ammo).toBe(5);
    run(h, rm, 10);
    expect(h.ammo).toBe(12);
    expect(h.reserve).toBe(53);
    run(h, rm, K.tacMs);
    expect(rm.active).toBe(false);
  });

  it("an empty reload lasts 2.05 s, commits at 1230 ms and drops the slide at 1450 ms", () => {
    const h = gun(0);
    const rm = new ReloadMachine();
    startReload(h, rm);
    expect(rm.kind).toBe("empty");
    expect(rm.commitAt).toBeCloseTo(1230, 5);
    const ev = run(h, rm, 1440);
    expect(h.ammo).toBe(12);
    expect(h.locked).toBe(true);
    expect(ev).toContain("magDrop");
    const ev2 = run(h, rm, 100);
    expect(ev2).toContain("slam");
    expect(h.locked).toBe(false);
    run(h, rm, 600);
    expect(rm.active).toBe(false);
  });

  it("fire, sprint or a swap before the commit cancels with no ammo lost", () => {
    const h = gun(4);
    const rm = new ReloadMachine();
    startReload(h, rm);
    run(h, rm, 600);
    expect(pullTrigger(h, rm)).toBe("fire");
    expect(rm.active).toBe(false);
    expect(h.ammo).toBe(3);
    expect(h.reserve).toBe(60);
    // Sprint and swap go through cancel() directly.
    startReload(h, rm);
    run(h, rm, 900);
    expect(rm.cancel()).toBe(true);
    expect(h.ammo).toBe(3);
    expect(h.reserve).toBe(60);
  });

  it("after the commit nothing cancels it", () => {
    const h = gun(4);
    const rm = new ReloadMachine();
    startReload(h, rm);
    run(h, rm, 1000);
    expect(rm.cancel()).toBe(false);
    expect(pullTrigger(h, rm)).toBe("none");
    expect(rm.active).toBe(true);
    expect(h.ammo).toBe(12);
  });

  it("the last round locks the slide; the next pull dry-fires and doesn't cancel an empty reload", () => {
    const h = gun(1);
    const rm = new ReloadMachine();
    expect(pullTrigger(h, rm)).toBe("fire");
    expect(h.ammo).toBe(0);
    expect(h.locked).toBe(true);
    expect(pullTrigger(h, rm)).toBe("dry");
    startReload(h, rm);
    run(h, rm, 300);
    expect(pullTrigger(h, rm)).toBe("none");
    expect(rm.active).toBe(true);
  });

  it("an empty gun with no reserve keeps dry-firing and never reloads", () => {
    const h = gun(0, 0);
    const rm = new ReloadMachine();
    expect(startReload(h, rm)).toBe(false);
    expect(pullTrigger(h, rm)).toBe("dry");
    expect(pullTrigger(h, rm)).toBe("dry");
  });

  it("the tactical clip seats the mag at 930 ms; the empty clip hides the old mag from 200 ms", () => {
    const seat = TAC.tracks.mag!.find((k) => Math.abs(k[0] - 930) < 1e-6)!;
    expect(seat[1]).toEqual([0, 0, 0]);
    expect(channel(EMPTY, "magVis", 100)).toBe(1);
    expect(channel(EMPTY, "magVis", 300)).toBe(0);
    expect(channel(EMPTY, "magVis", 700)).toBe(1);
    expect(channel(EMPTY, "stop", 1200)).toBe(1);
    expect(channel(EMPTY, "stop", 1460)).toBe(0);
  });
});
