import { describe, expect, it } from "vitest";
import { AutoScale, frontDynOptions, gameDynOptions } from "../games/cathode/src/game/autoscale";

const run = (a: AutoScale, ms: number, n: number) => {
  let last: number | null = null;
  for (let i = 0; i < n; i++) last = a.frame(ms) ?? last;
  return last;
};

describe("AutoScale", () => {
  it("steps x0.9 after 30 frames above 15.5 ms", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 1000 / 60, slowMs: 15.5, fastMs: 11 });
    run(a, 16, 29);
    expect(a.scale).toBe(1);
    run(a, 16, 1);
    expect(a.scale).toBe(0.9);
  });
  it("steps x1.05 only after 120 frames below 11 ms, clamped to max", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 1000 / 60, slowMs: 15.5, fastMs: 11 });
    run(a, 30, 60);
    expect(a.scale).toBe(0.81);
    run(a, 10, 119);
    expect(a.scale).toBe(0.81);
    run(a, 10, 1);
    expect(a.scale).toBeCloseTo(0.85, 2);
    run(a, 10, 120 * 10);
    expect(a.scale).toBe(1);
  });
  it("steps down when frames are slow, never below min", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 30, 30 * 10);
    expect(a.scale).toBe(0.6);
  });
  it("holds steady at the target", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 14, 30 * 20);
    expect(a.scale).toBe(1);
  });
  it("recovers slowly when there is headroom", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 30, 30 * 4);
    const low = a.scale;
    run(a, 8, 30 * 3);
    expect(a.scale).toBe(low);
    run(a, 8, 30 * 60);
    expect(a.scale).toBe(1);
  });
  it("ignores stalls", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 500, 300);
    expect(a.scale).toBe(1);
  });
  it("dips below min only after staying slow at the floor", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7, rescueMin: 0.35 });
    run(a, 30, 30 * 6);
    expect(a.scale).toBe(0.6);
    expect(a.rescued).toBe(false);
    run(a, 30, 30 * 8);
    expect(a.rescued).toBe(true);
    expect(a.scale).toBe(0.35);
  });
});

// Plan item 317: the front door judges frames against the cap it runs at (a phone's title holds 30 fps).
describe("frontDynOptions", () => {
  it("keeps a phone's title at full scale while its 30 fps frames arrive on time", () => {
    const a = new AutoScale(frontDynOptions(true));
    run(a, 33.4, 600);
    expect(a.scale).toBe(1);
  });
  it("steps a phone down when frames miss the cap, and back up once they are on time again", () => {
    const a = new AutoScale(frontDynOptions(true));
    run(a, 50, 60);
    expect(a.scale).toBeLessThan(1);
    run(a, 33.4, 2000);
    expect(a.scale).toBe(1);
  });
  it("brings a desktop back to full scale after a hitch at the 60 fps cap", () => {
    const a = new AutoScale(frontDynOptions(false));
    run(a, 16.7, 300);
    expect(a.scale).toBe(1);
    run(a, 33, 30);
    expect(a.scale).toBe(0.9);
    run(a, 16.7, 600);
    expect(a.scale).toBe(1);
  });
});

// Plan item 317: the game's scale, fed rAF intervals, keeps a phone on time at 60 Hz at full scale (it fell to the 0.4
// thermal rescue: every 16.7 ms frame read as slow against 15.5 ms).
describe("gameDynOptions", () => {
  it("holds full scale and no rescue while a 60 Hz screen's frames arrive on time", () => {
    const a = new AutoScale(gameDynOptions());
    run(a, 16.7, 3000);
    expect(a.scale).toBe(1);
    expect(a.rescued).toBe(false);
  });
  it("steps down when frames miss vsyncs, rescues only when the floor is still slow, recovers when on time", () => {
    const a = new AutoScale(gameDynOptions());
    run(a, 25, 60);
    expect(a.scale).toBe(0.81);
    run(a, 33.4, 600);
    expect(a.rescued).toBe(true);
    run(a, 16.7, 6000);
    expect(a.scale).toBe(1);
  });
});
