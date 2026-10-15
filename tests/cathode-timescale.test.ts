import { describe, expect, it } from "vitest";
import { Timescale } from "../games/cathode/src/game/feel/timescale";
import { tuning } from "../games/cathode/src/game/feel/tuning";

const step = (ts: Timescale, ms: number, dt = 1 / 240) => {
  const out: number[] = [];
  for (let t = 0; t < ms; t += dt * 1000) {
    ts.update(dt);
    out.push(ts.simScale);
  }
  return out;
};

describe("CATHODE timescale (S0)", () => {
  it("overlapping pushes resolve to the minimum, not the product", () => {
    const ts = new Timescale();
    ts.push("killcam", 0.2, 1000, 0, 0, "killcam");
    ts.push("focus", 0.35, 1000, 0, 0, "focus");
    expect(ts.simScale).toBeCloseTo(0.2);
    ts.push("death", 0.1, 500, 0, 0, "death");
    expect(ts.simScale).toBeCloseTo(0.1);
  });

  it("a tie goes to the higher priority", () => {
    const ts = new Timescale();
    ts.push("a", 0.5, 1000, 0, 0, "hitStop");
    ts.push("b", 0.5, 1000, 0, 0, "death");
    expect(ts.simScale).toBe(0.5);
  });

  it("hit-stops take the larger stop, never stack, and cap at 150 ms", () => {
    const ts = new Timescale();
    expect(ts.hitStop(60)).toBe(60);
    expect(ts.hitStop(40)).toBe(0);
    expect(ts.simScale).toBe(0);
    step(ts, 30);
    const extra = ts.hitStop(60);
    expect(extra).toBeGreaterThan(25);
    expect(extra).toBeLessThan(36);
    const fresh = new Timescale();
    expect(fresh.hitStop(400)).toBe(tuning.hitStop.cap);
    const held = step(fresh, 200);
    const frozen = held.filter((s) => s === 0).length / 240;
    expect(frozen * 1000).toBeLessThanOrEqual(151);
  });

  it("a hit-stop inside slow motion returns to the slow motion, not to 1.0", () => {
    const ts = new Timescale();
    ts.push("slowmo", 0.35, 1000, 0, 0, "killcam");
    ts.hitStop(60);
    expect(ts.simScale).toBe(0);
    step(ts, 100);
    expect(ts.simScale).toBeCloseTo(0.35);
  });

  it("ramps are monotonic", () => {
    const ts = new Timescale();
    ts.push("last", 0.35, 300, 100, 250, "killcam");
    const s = step(ts, 700);
    const rampIn = s.slice(0, 24);
    for (let i = 1; i < rampIn.length; i++) expect(rampIn[i]!).toBeLessThanOrEqual(rampIn[i - 1]! + 1e-9);
    const rampOut = s.slice(96, 168);
    for (let i = 1; i < rampOut.length; i++) expect(rampOut[i]!).toBeGreaterThanOrEqual(rampOut[i - 1]! - 1e-9);
    expect(s[s.length - 1]).toBe(1);
  });

  it("nothing holds longer than 3 s except death", () => {
    const ts = new Timescale();
    ts.push("long", 0.2, 10_000, 0, 0, "killcam");
    step(ts, 3100, 1 / 60);
    expect(ts.simScale).toBe(1);
    const d = new Timescale();
    d.push("death", 0.2, 10_000, 0, 0, "death");
    step(d, 3100, 1 / 60);
    expect(d.simScale).toBe(0.2);
  });

  it("particles drift at a quarter speed during a hit-stop", () => {
    const ts = new Timescale();
    ts.hitStop(60);
    expect(ts.simScale).toBe(0);
    expect(ts.fxScale).toBe(tuning.hitStop.fxScale);
  });

  it("the real (render) dt is never scaled: the stop ends after its real duration whatever the sim scale", () => {
    const ts = new Timescale();
    ts.push("slow", 0.1, 2000, 0, 0, "killcam");
    ts.hitStop(100);
    step(ts, 110);
    expect(ts.simScale).toBeCloseTo(0.1);
  });

  it("automatic fire: stops in any 100 ms window sum to 30 ms or less", () => {
    const ts = new Timescale();
    let granted = 0;
    // 10 rounds at 75 ms, each asking for a 40 ms kill stop.
    const window: { at: number; ms: number }[] = [];
    let clock = 0;
    for (let i = 0; i < 10; i++) {
      const g = ts.hitStop(40, true);
      window.push({ at: clock, ms: g });
      granted += g;
      for (let k = 0; k < 18; k++) {
        ts.update(1 / 240);
        clock += 1000 / 240;
      }
    }
    for (const w of window) {
      const sum = window.filter((x) => x.at >= w.at && x.at < w.at + 100).reduce((s, x) => s + x.ms, 0);
      expect(sum).toBeLessThanOrEqual(30 + 1e-6);
    }
    expect(granted).toBeGreaterThan(0);
  });
});
