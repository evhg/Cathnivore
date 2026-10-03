import { describe, expect, it } from "vitest";
import {
  CLASS_START_ATTRIBUTES,
  MAX_LEVEL,
  applyTotals,
  deriveStats,
  flat,
  inc,
  killXp,
  levelForXp,
  more,
  sumModifiers,
  xpFalloff,
  xpForLevel,
  xpToNext,
  type StatsSubject,
} from "../games/cathode/src/sim/stats";
import { CLASS_IDS } from "../games/cathode/src/sim/types";
import { createRng, hashSeed } from "../games/cathode/src/sim/rng";

const ghost: StatsSubject = { level: 1, attributes: { ...CLASS_START_ATTRIBUTES.ghost } };

describe("CATHODE rng", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const sa = Array.from({ length: 10 }, () => a.next());
    expect(Array.from({ length: 10 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 10 }, () => c.next())).not.toEqual(sa);
    expect(createRng("week-12").next()).toBe(createRng(hashSeed("week-12")).next());
  });

  it("keeps int, weighted and chance in range and roughly fair", () => {
    const r = createRng(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) {
      const n = r.int(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      counts[r.weighted([["a", 3], ["b", 1]] as const)]++;
    }
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.6);
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
  });
});

describe("CATHODE XP curve", () => {
  it("is round(120 × L^1.85) per level", () => {
    expect(xpToNext(1)).toBe(120);
    expect(xpToNext(2)).toBe(Math.round(120 * 2 ** 1.85));
    expect(xpToNext(10)).toBe(Math.round(120 * 10 ** 1.85));
    expect(xpToNext(59)).toBe(Math.round(120 * 59 ** 1.85));
    expect(xpToNext(MAX_LEVEL)).toBe(0);
  });

  it("grows every level and round-trips through levelForXp", () => {
    for (let l = 1; l < MAX_LEVEL - 1; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    for (const l of [1, 2, 7, 15, 30, 59, 60]) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      if (l > 1) expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
  });

  it("falls off with the level gap and pays +50% for unseen kills", () => {
    expect(xpFalloff(10, 10)).toBe(1);
    expect(xpFalloff(10, 5)).toBe(1);
    expect(xpFalloff(20, 10)).toBeCloseTo(0.25);
    expect(xpFalloff(60, 1)).toBe(0.05);
    expect(xpFalloff(10, 30)).toBeCloseTo(10 / 30);
    expect(killXp(100, 10, 10)).toBe(100);
    expect(killXp(100, 10, 10, { unseen: true })).toBe(150);
    expect(killXp(100, 10, 10, { unseen: true, unseenBonus: 20 })).toBe(170);
  });
});

describe("CATHODE attributes and derived stats", () => {
  it("gives every class 80 starting points with its own emphasis", () => {
    for (const c of CLASS_IDS) {
      const a = CLASS_START_ATTRIBUTES[c];
      expect(a.grit + a.aim + a.nerve + a.wire).toBe(80);
    }
    expect(CLASS_START_ATTRIBUTES.butcher.grit).toBeGreaterThan(CLASS_START_ATTRIBUTES.ghost.grit);
    expect(CLASS_START_ATTRIBUTES.wirewitch.wire).toBeGreaterThan(CLASS_START_ATTRIBUTES.gunslinger.wire);
  });

  it("derives each attribute's bonuses from the bible's table", () => {
    const base = deriveStats(ghost, [], []);
    const plus = (a: "grit" | "aim" | "nerve" | "wire") =>
      deriveStats({ ...ghost, attributes: { ...ghost.attributes, [a]: ghost.attributes[a] + 10 } }, [], []);
    const g = plus("grit");
    expect(g.maxHealth - base.maxHealth).toBe(20);
    expect(g.carry - base.carry).toBe(20);
    expect(g.meleeMultiplier - base.meleeMultiplier).toBeCloseTo(0.1);
    const a = plus("aim");
    expect(a.gunMultiplier.sniper - base.gunMultiplier.sniper).toBeCloseTo(0.1);
    expect(a.critChance.pistol - base.critChance.pistol).toBeCloseTo(0.05);
    expect(base.recoilMultiplier.rifle - a.recoilMultiplier.rifle).toBeCloseTo(0.04);
    expect(a.adsSpeed).toBeGreaterThan(base.adsSpeed);
    const n = plus("nerve");
    expect(n.stealth - base.stealth).toBe(10);
    expect(n.headshotMultiplier - base.headshotMultiplier).toBeCloseTo(0.1);
    expect(n.bulletTimeSeconds).toBeGreaterThan(base.bulletTimeSeconds);
    expect(n.detectionMultiplier).toBeLessThan(base.detectionMultiplier);
    const w = plus("wire");
    expect(w.cyberwareCapacity - base.cyberwareCapacity).toBe(20);
    expect(w.hackStrength - base.hackStrength).toBeCloseTo(0.1);
    expect(w.battery - base.battery).toBe(10);
  });

  it("applies the difficulty resistance penalty and the 75% cap", () => {
    const mods = [flat("resist.shock", 120), flat("allResist", 10)];
    expect(deriveStats(ghost, mods, []).resistances.shock).toBe(0.75);
    expect(deriveStats(ghost, mods, []).resistances.toxic).toBeCloseTo(0.1);
    expect(deriveStats({ ...ghost, difficulty: "hellWeek" }, mods, []).resistances.toxic).toBeCloseTo(-0.4);
  });
});

describe("CATHODE modifier stacking", () => {
  it("adds flat, sums increased and multiplies more", () => {
    const t = sumModifiers([flat("maxHealth", 10), inc("maxHealth", 20), inc("maxHealth", 30), more("maxHealth", 50), more("maxHealth", 50)]);
    const total = t.maxHealth!;
    expect(total.flat).toBe(10);
    expect(total.increased).toBe(50);
    expect(total.more).toBeCloseTo(2.25);
    expect(applyTotals(90, total)).toBeCloseTo(100 * 1.5 * 2.25);
  });

  it("feeds attribute bonuses from gear into the derivation", () => {
    const base = deriveStats(ghost, [], []);
    const geared = deriveStats(ghost, [flat("aim", 10), flat("allAttributes", 5)], []);
    expect(geared.attributes.aim).toBe(ghost.attributes.aim + 15);
    expect(geared.attributes.grit).toBe(ghost.attributes.grit + 5);
    expect(geared.gunMultiplier.rifle - base.gunMultiplier.rifle).toBeCloseTo(0.15);
  });

  it("combines plain and weapon-class qualified stats, and more beats increased at scale", () => {
    const d = deriveStats(ghost, [inc("damage.sniper", 50), inc("gunDamage", 25), more("damage.sniper", 20)], []);
    const aim = ghost.attributes.aim;
    expect(d.gunMultiplier.sniper).toBeCloseTo((1 + (aim + 75) / 100) * 1.2);
    expect(d.gunMultiplier.smg).toBeCloseTo(1 + (aim + 25) / 100);
    expect(d.gunMultiplier.melee).toBeCloseTo(d.meleeMultiplier);
  });
});
