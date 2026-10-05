import { describe, expect, it } from "vitest";
import { AutoScale } from "../games/cathode/src/game/autoscale";

const run = (a: AutoScale, ms: number, n: number) => {
  let last: number | null = null;
  for (let i = 0; i < n; i++) last = a.frame(ms) ?? last;
  return last;
};

describe("AutoScale", () => {
  it("steps down when frames are slow, never below min", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 30, 30 * 10);
    expect(a.scale).toBe(0.6);
  });
  it("holds steady at the target", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 16.7, 30 * 20);
    expect(a.scale).toBe(1);
  });
  it("recovers slowly when there is headroom", () => {
    const a = new AutoScale({ min: 0.6, max: 1, target: 16.7 });
    run(a, 30, 30 * 4);
    const low = a.scale;
    run(a, 8, 30 * 5);
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
