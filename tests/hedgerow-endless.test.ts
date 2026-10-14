import { describe, expect, it } from "vitest";
import { endlessLevel, endlessUnlocked, weekOf, ENDLESS_WAVES } from "../games/hedgerow/src/endless";
import { ENDLESS_HP_GROWTH, isBig, newGame, spawnHp } from "../games/hedgerow/src/engine";
import { freeplayHp, freeplayIndex } from "../games/hedgerow/src/rounds";
import { emptySave, parseSave, recordEndless } from "../games/hedgerow/src/store";

describe("endless fields", () => {
  it("are deterministic per act and week, and different across them", () => {
    expect(endlessLevel(8, 10).waves).toEqual(endlessLevel(8, 10).waves);
    expect(endlessLevel(8, 10).waves).not.toEqual(endlessLevel(8, 11).waves);
    const lv = endlessLevel(8, 3);
    expect(lv.endless).toBe(true);
    expect(lv.waves).toHaveLength(ENDLESS_WAVES);
    expect(lv.waves.every((w) => w.length > 0 && w.every((g) => g.count >= 1))).toBe(true);
    expect(lv.waves[100]!.reduce((a, g) => a + g.count, 0)).toBeGreaterThan(lv.waves[0]!.reduce((a, g) => a + g.count, 0));
  });
  it("unlock with the act's boss and make enemies tougher each wave", () => {
    expect(endlessUnlocked({ "10": 1 }, 1)).toBe(true);
    expect(endlessUnlocked({ "9": 3 }, 1)).toBe(false);
    const g = newGame(endlessLevel(8, 0));
    const a = spawnHp(g, "van");
    g.wave = 20;
    expect(spawnHp(g, "van")).toBeGreaterThan(a * 2);
    expect(weekOf(Date.UTC(2026, 0, 12))).toBe(1);
  });
  it("compound health every wave and bring the act's boss back every tenth wave from 20", () => {
    const g = newGame(endlessLevel(8, 0));
    const a = spawnHp(g, "van");
    g.wave = 40;
    expect(spawnHp(g, "van") / a / Math.pow(ENDLESS_HP_GROWTH, 40)).toBeCloseTo(1, 1);
    const lv = endlessLevel(8, 0);
    const bossWaves = lv.waves.map((w, i) => (w.some((gr) => isBig(gr.enemy)) ? i + 1 : 0)).filter(Boolean);
    expect(bossWaves.slice(0, 3)).toEqual([20, 30, 40]);
  });
  it("swing a weekly bridge across the field", () => {
    const a = endlessLevel(2, 4).setPieces!.find((p) => p.kind === "bridge");
    const b = endlessLevel(2, 5).setPieces!.find((p) => p.kind === "bridge");
    expect(a).toBeTruthy();
    expect(a).not.toEqual(b);
  });
  it("keeps the best wave only", () => {
    const d = emptySave();
    expect(recordEndless(d, 3, 12)).toBe(true);
    expect(recordEndless(d, 3, 9)).toBe(false);
    expect(parseSave(JSON.stringify(d)).endless).toEqual({ "3": 12 });
  });
  it("a Fleet act's Endless is Freeplay: the Book carries on past the boss, then replays rounds 51-80 with tougher Plants", () => {
    const lv = endlessLevel(1, 7);
    expect(lv.rules).toBe("fleet");
    expect(lv.waves).toHaveLength(ENDLESS_WAVES);
    expect(freeplayIndex(81)).toBe(50);
    expect(freeplayIndex(110)).toBe(79);
    expect(freeplayIndex(111)).toBe(50);
    expect(freeplayHp(80)).toBe(1);
    expect(freeplayHp(90)).toBeCloseTo(1.219, 2);
    const g = newGame(lv);
    const a = spawnHp(g, "van");
    g.wave = 100;
    expect(spawnHp(g, "van")).toBeGreaterThan(a);
  });
});
