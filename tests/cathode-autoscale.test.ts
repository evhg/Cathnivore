import { describe, expect, it } from "vitest";
import { AutoScale } from "../games/cathode/src/game/autoscale";

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
