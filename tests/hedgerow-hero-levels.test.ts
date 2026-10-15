import { describe, expect, it } from "vitest";
import { HERO_MAX_LEVEL, levelFor, levelScale, xpFor } from "../games/hedgerow/src/hero";
import { playLevel } from "../games/hedgerow/src/bot";
import { LEVELS } from "../games/hedgerow/src/levels";
import { newGame } from "../games/hedgerow/src/engine";

describe("Cath's in-run levels", () => {
  it("rise on a steady curve and cap at 20", () => {
    expect(levelFor(0)).toBe(1);
    expect(xpFor(1)).toBe(0);
    for (let l = 2; l <= HERO_MAX_LEVEL; l++) expect(xpFor(l)).toBeGreaterThan(xpFor(l - 1));
    expect(levelFor(1e9)).toBe(HERO_MAX_LEVEL);
    expect(levelScale(1)).toEqual({ damage: 1, hp: 1 });
    expect(levelScale(11).damage).toBeCloseTo(1.5);
  });

  it("grows on a Fleet level and stays level 1 on a classic one", () => {
    const fleet = playLevel(LEVELS[9]!, "best");
    expect(fleet.hero.level).toBeGreaterThan(1);
    expect(fleet.hero.maxHp).toBeGreaterThan(newGame(LEVELS[9]!).hero.maxHp);
    expect(newGame(LEVELS[50]!).hero.level).toBe(1);
  }, 60_000); // bot-driven: about 5 s alone, slower under full-suite load
});

describe("Last Orders", () => {
  it("unlocks at level 10, hits the field, then cools down", async () => {
    const { callLastOrders, lastOrdersDamage, sendWave, stepGame, LAST_ORDERS_COOLDOWN } = await import("../games/hedgerow/src/engine");
    const g = newGame(LEVELS[0]!);
    expect(callLastOrders(g).ok).toBe(false);
    g.hero.level = 10;
    expect(callLastOrders(g).ok).toBe(false); // not in a round
    sendWave(g, true);
    for (let i = 0; i < 600 && g.enemies.length === 0; i++) stepGame(g);
    expect(g.enemies.length).toBeGreaterThan(0);
    expect(callLastOrders(g).ok).toBe(true);
    expect(g.lastOrdersCd).toBe(LAST_ORDERS_COOLDOWN);
    expect(callLastOrders(g).ok).toBe(false);
    expect(lastOrdersDamage(10)).toBe(3);
    expect(lastOrdersDamage(20)).toBe(5);
  });
});
