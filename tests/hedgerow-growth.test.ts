// Plan item 59: the field grows through the level, a leak tramples the plot nearest the exit, and the win
// ripens it all. Drawing only.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { cropOf, cropStage, cropStages, growthPlots, harvestAt, ripeCount, shownCrops, HARVEST_SECONDS } from "../games/hedgerow/src/growth";
import { plotLooks } from "../games/hedgerow/src/plotlook";
import { drainEvents, newGame, sendWave, stepGame } from "../games/hedgerow/src/engine";

const level13 = LEVELS.find((l) => l.id === 13)!;
const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("growth", () => {
  it("is deterministic per level, rounds and leaks", () => {
    for (const level of LEVELS.slice(0, 20)) {
      const a = [...cropStages(level, 4, 2)];
      const b = [...cropStages({ ...level }, 4, 2)];
      expect(b).toEqual(a);
      expect(cropStage(level, 4, 2, growthPlots(level)[0]!.col, growthPlots(level)[0]!.row)).toBe(a.find(([k]) => k === growthPlots(level)[0]!.key)![1]);
    }
  });

  it("covers every plain plot, bare at round 1 and mostly ripe by the last round", () => {
    for (const level of LEVELS.filter((l) => !l.endless)) {
      const first = cropStages(level, 0, 0);
      expect(first.size).toBe(plotLooks(level).size);
      expect([...first.values()].every((s) => s === 0), `level ${level.id}`).toBe(true);
      const last = cropStages(level, level.waves.length, 0);
      expect(ripeCount(last, new Set()) / Math.max(1, last.size), `level ${level.id}`).toBeGreaterThan(0.4);
    }
  });

  it("never shrinks as rounds clear", () => {
    const n = level13.waves.length;
    let prev = -1;
    let prevRipe = -1;
    for (let r = 0; r <= n; r++) {
      const m = cropStages(level13, r, 0);
      expect(sum(m)).toBeGreaterThanOrEqual(prev);
      expect(ripeCount(m, new Set())).toBeGreaterThanOrEqual(prevRipe);
      prev = sum(m);
      prevRipe = ripeCount(m, new Set());
    }
    expect(prevRipe).toBeGreaterThan(ripeCount(cropStages(level13, 1, 0), new Set()));
  });

  it("ripens the farmhouse end first", () => {
    const plots = growthPlots(level13);
    const mid = cropStages(level13, Math.floor(level13.waves.length / 2), 0);
    const near: number[] = plots.slice(0, 5).map((p) => mid.get(p.key)!);
    const far: number[] = plots.slice(-5).map((p) => mid.get(p.key)!);
    expect(near.reduce((a, b) => a + b, 0)).toBeGreaterThan(far.reduce((a, b) => a + b, 0));
  });

  it("tramples the growing plot nearest the exit, one stage per leak, skipping towers", () => {
    const rounds = level13.waves.length - 2;
    const clean = cropStages(level13, rounds, 0);
    const plots = growthPlots(level13);
    const target = plots.find((p) => clean.get(p.key)! > 0)!;
    const one = cropStages(level13, rounds, 1);
    const changed = [...one].filter(([k, s]) => clean.get(k) !== s);
    expect(changed).toEqual([[target.key, clean.get(target.key)! - 1]]);
    // A tower on that plot: the leak tramples the next one out instead.
    const towered = cropStages(level13, rounds, 1, new Set([target.key]));
    const next = plots.find((p) => p.key !== target.key && clean.get(p.key)! > 0)!;
    expect(towered.get(target.key)).toBe(clean.get(target.key));
    expect(towered.get(next.key)).toBe(clean.get(next.key)! - 1);
    // Leaks never take a plot below bare.
    expect([...cropStages(level13, rounds, 10_000).values()].every((s) => s === 0)).toBe(true);
  });

  it("ripens every empty plot in a wave from the farmhouse on a win", () => {
    const game = { level: level13, paid: level13.waves.length, towers: [], leaks: 3, phase: "won" as const };
    const start = shownCrops(game, 0);
    const done = shownCrops(game, HARVEST_SECONDS + 0.01);
    expect([...done.values()].every((s) => s === 3)).toBe(true);
    expect(ripeCount(start, new Set())).toBeLessThan(done.size);
    const plots = growthPlots(level13);
    expect(harvestAt(plots[0]!)).toBeLessThan(harvestAt(plots[plots.length - 1]!));
  });

  it("grows the act's own crop", () => {
    expect(cropOf({ id: 3 })).toBe("wheat");
    expect(cropOf({ id: 13 })).toBe("cabbage");
    expect(cropOf({ id: 38 })).toBe("pumpkin");
    expect(cropOf({ id: 50 })).toBe("lavender");
  });

  it("counts every vehicle that reaches the farmhouse, and nothing else changes", () => {
    // An empty field on a forked level: the first wave walks straight to the farmhouse.
    const g = newGame(LEVELS.find((l) => l.path2)!);
    sendWave(g);
    let events = 0;
    for (let i = 0; i < 150 * 30 && g.phase === "wave"; i++) {
      stepGame(g);
      events += drainEvents(g).filter((e) => e.type === "leak").length;
    }
    expect(events).toBeGreaterThan(0);
    expect(g.leaks).toBe(events);
  });
});
