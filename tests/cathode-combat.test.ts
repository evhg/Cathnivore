import { describe, expect, it } from "vitest";
import {
  CLOSE_SEVER_RANGE,
  applyHit,
  armourShare,
  falloffAt,
  pelletsOnTarget,
  resolveHit,
  type DamageTarget,
} from "../games/cathode/src/sim/damage";
import { rangeLadder, simulateShot, solveShot, swayAmplitude } from "../games/cathode/src/sim/ballistics";
import {
  ARCHETYPES,
  ELITE_HEALTH,
  eliteModCount,
  makeEnemy,
  monsterLevel,
} from "../games/cathode/src/sim/enemies";
import { activeWeaponStats, characterStats, gainXp, newCharacter, type Character } from "../games/cathode/src/sim/character";
import { spendSkill } from "../games/cathode/src/sim/skills";
import { createRng } from "../games/cathode/src/sim/rng";
import { CLASS_START_ATTRIBUTES, deriveStats, flat } from "../games/cathode/src/sim/stats";
import { WEAPON_BASES, weaponStats } from "../games/cathode/src/sim/weapons";
import { xpForLevel } from "../games/cathode/src/sim/stats";

const ghost = newCharacter("ghost");
const ghostStats = characterStats(ghost);
const widowmaker = activeWeaponStats(ghost)!;
const rng = () => createRng(99);

const dummy = (over: Partial<DamageTarget> = {}): DamageTarget => ({
  level: 1,
  health: 1000,
  maxHealth: 1000,
  shield: 0,
  armour: 0,
  resist: {},
  ...over,
});

describe("CATHODE balance anchors", () => {
  it("a level-1 Ghost one-shots an Enforcer with a sniper headshot; a body shot leaves it alive, even a crit", () => {
    const enforcer = makeEnemy("enforcer", 1, rng());
    const unarmoured = { ...enforcer, armour: 0, zones: { ...enforcer.zones, head: {} } };
    for (const target of [enforcer, unarmoured]) {
      expect(resolveHit(ghostStats, widowmaker, target, "head", 120, rng(), { noCrit: true }).killed).toBe(true);
    }
    expect(resolveHit(ghostStats, widowmaker, enforcer, "torso", 120, rng(), { noCrit: true }).killed).toBe(false);
    expect(resolveHit(ghostStats, widowmaker, enforcer, "torso", 120, rng(), { forceCrit: true }).killed).toBe(false);
    expect(resolveHit(ghostStats, widowmaker, unarmoured, "torso", 120, rng(), { noCrit: true }).killed).toBe(false);
  });

  it("a level-10 Butcher's shotgun severs limbs at close range", () => {
    let b: Character = gainXp(newCharacter("butcher"), xpForLevel(10)).character;
    expect(b.level).toBe(10);
    const r = spendSkill(b, "butcher.pointBlank", 5);
    if (r.ok) b = r.value;
    const stats = characterStats(b);
    const gun = activeWeaponStats(b)!;
    expect(gun.cls).toBe("shotgun");
    const enforcer = makeEnemy("enforcer", 10, rng());
    for (const limb of ["leftArm", "rightLeg"] as const) {
      const hit = resolveHit(stats, gun, enforcer, limb, 3, rng(), { noCrit: true, pellets: pelletsOnTarget(gun, 3) });
      expect(hit.severed).toBe(limb);
    }
    // At 20 m the spread and falloff leave the limb on.
    const far = resolveHit(stats, gun, enforcer, "leftArm", 20, rng(), { noCrit: true, pellets: pelletsOnTarget(gun, 20) });
    expect(far.severed).toBeUndefined();
  });

  it("Hell Week level-50 enemies shrug off a starter build", () => {
    const enforcer = makeEnemy("enforcer", monsterLevel(20, "hellWeek"), rng());
    expect(enforcer.level).toBe(50);
    const hit = resolveHit(ghostStats, widowmaker, enforcer, "head", 120, rng(), { forceCrit: true });
    expect(hit.killed).toBe(false);
    expect(enforcer.maxHealth / makeEnemy("enforcer", 1, rng()).maxHealth).toBeGreaterThan(40);
  });
});

describe("CATHODE hit resolution", () => {
  const plain = deriveStats({ level: 1, attributes: { grit: 0, aim: 0, nerve: 0, wire: 0 } }, [], []);
  const rifle = weaponStats(WEAPON_BASES.corridorAR!);
  const sniper = weaponStats(WEAPON_BASES.widowmaker!);

  it("multiplies by zone: head ×2.5, sniper head ×4, limbs ×0.7, and Nerve scales the head", () => {
    const at = (w = rifle, zone: "head" | "torso" | "leftLeg" = "torso", s = plain) =>
      resolveHit(s, w, dummy(), zone, 10, rng(), { noCrit: true }).healthDamage;
    expect(at(rifle, "head") / at(rifle, "torso")).toBeCloseTo(2.5);
    expect(at(sniper, "head") / at(sniper, "torso")).toBeCloseTo(4);
    expect(at(rifle, "leftLeg") / at(rifle, "torso")).toBeCloseTo(0.7);
    const nervy = deriveStats({ level: 1, attributes: { grit: 0, aim: 0, nerve: 50, wire: 0 } }, [], []);
    expect(at(sniper, "head", nervy) / at(sniper, "torso", nervy)).toBeCloseTo(6);
  });

  it("crits multiply by the crit multiplier and follow the crit chance", () => {
    const normal = resolveHit(plain, rifle, dummy(), "torso", 10, rng(), { noCrit: true });
    const crit = resolveHit(plain, rifle, dummy(), "torso", 10, rng(), { forceCrit: true });
    expect(crit.crit).toBe(true);
    expect(crit.healthDamage / normal.healthDamage).toBeCloseTo(1.5);
    const r = createRng(3);
    let crits = 0;
    for (let i = 0; i < 4000; i++) if (resolveHit(plain, rifle, dummy(), "torso", 10, r).crit) crits++;
    expect(crits / 4000).toBeGreaterThan(0.035);
    expect(crits / 4000).toBeLessThan(0.065);
  });

  it("armour mitigates a share, piercing ignores part of it, elements are half-mitigated", () => {
    const bare = resolveHit(plain, rifle, dummy(), "torso", 10, rng(), { noCrit: true }).healthDamage;
    const armoured = resolveHit(plain, rifle, dummy({ armour: 0.5 }), "torso", 10, rng(), { noCrit: true }).healthDamage;
    expect(armoured / bare).toBeCloseTo(1 - 0.5 * (1 - rifle.pierce));
    const piercer = deriveStats({ level: 1, attributes: { grit: 0, aim: 0, nerve: 0, wire: 0 } }, [flat("armourPierce", 50)], []);
    const pierced = resolveHit(piercer, rifle, dummy({ armour: 0.5 }), "torso", 10, rng(), { noCrit: true }).healthDamage;
    expect(pierced).toBeGreaterThan(armoured);
    const shockGun = { ...rifle, damageType: "shock" as const };
    const shock = resolveHit(plain, shockGun, dummy({ armour: 0.5 }), "torso", 10, rng(), { noCrit: true }).healthDamage;
    expect(shock / bare).toBeCloseTo(1 - 0.5 * 0.5 * (1 - rifle.pierce));
  });

  it("applies resistances per damage type, negative ones amplify, and added damage is resisted separately", () => {
    const bare = resolveHit(plain, rifle, dummy(), "torso", 10, rng(), { noCrit: true }).healthDamage;
    expect(resolveHit(plain, rifle, dummy({ resist: { kinetic: 0.5 } }), "torso", 10, rng(), { noCrit: true }).healthDamage).toBeCloseTo(bare / 2);
    expect(resolveHit(plain, rifle, dummy({ resist: { kinetic: -0.5 } }), "torso", 10, rng(), { noCrit: true }).healthDamage).toBeCloseTo(bare * 1.5);
    const shocky = deriveStats({ level: 1, attributes: { grit: 0, aim: 0, nerve: 0, wire: 0 } }, [flat("added.shock", 50)], []);
    const hit = resolveHit(shocky, rifle, dummy({ resist: { shock: 1 } }), "torso", 10, rng(), { noCrit: true });
    expect(hit.byType.shock).toBe(0);
    expect(hit.byType.kinetic).toBeCloseTo(bare);
  });

  it("breaks shields first, and shock does double to shields", () => {
    const bare = resolveHit(plain, rifle, dummy(), "torso", 10, rng(), { noCrit: true }).healthDamage;
    const shielded = resolveHit(plain, rifle, dummy({ shield: 10 }), "torso", 10, rng(), { noCrit: true });
    expect(shielded.shieldDamage).toBe(10);
    expect(shielded.shield).toBe(0);
    expect(shielded.healthDamage).toBeCloseTo(bare - 10);
    const tough = resolveHit(plain, rifle, dummy({ shield: 1000 }), "torso", 10, rng(), { noCrit: true });
    expect(tough.healthDamage).toBe(0);
    const shockHit = resolveHit(plain, { ...rifle, damageType: "shock" }, dummy({ shield: 1000 }), "torso", 10, rng(), { noCrit: true });
    expect(shockHit.shieldDamage).toBeCloseTo(tough.shieldDamage * 2);
  });

  it("falls off with range and reports kills and overkill", () => {
    expect(falloffAt(rifle, 10)).toBe(1);
    expect(falloffAt(rifle, rifle.falloff.end + 50)).toBe(rifle.falloff.min);
    const mid = falloffAt(rifle, (rifle.falloff.start + rifle.falloff.end) / 2);
    expect(mid).toBeCloseTo((1 + rifle.falloff.min) / 2);
    const kill = resolveHit(plain, sniper, dummy({ health: 10, maxHealth: 1000 }), "torso", 10, rng(), { noCrit: true });
    expect(kill.killed).toBe(true);
    expect(kill.overkill).toBeCloseTo(kill.healthDamage - 10);
    expect(applyHit(dummy({ health: 10 }), kill).health).toBe(0);
  });

  it("severs on big limb hits, on close brutal kills, never twice, and not with the gore toggle off", () => {
    const big = resolveHit(plain, sniper, dummy({ health: 100, maxHealth: 100 }), "leftArm", 30, rng(), { noCrit: true });
    expect(big.severed).toBe("leftArm");
    expect(resolveHit(plain, sniper, dummy({ health: 100, maxHealth: 100, severed: ["leftArm"] }), "leftArm", 30, rng(), { noCrit: true }).severed).toBeUndefined();
    expect(resolveHit(plain, sniper, dummy({ health: 100, maxHealth: 100 }), "leftArm", 30, rng(), { noCrit: true, severing: false }).severed).toBeUndefined();
    // A small killing blow from a shotgun at 3 m takes a limb with it; the blunt Pin doesn't.
    const shotgun = { ...weaponStats(WEAPON_BASES.streetSweeper!), damage: 1 };
    const close = resolveHit(plain, shotgun, dummy({ health: 1, maxHealth: 1000 }), "torso", 3, rng(), { noCrit: true });
    expect(close.killed).toBe(true);
    expect(close.severed).toBeDefined();
    const farKill = resolveHit(plain, shotgun, dummy({ health: 1, maxHealth: 1000 }), "torso", CLOSE_SEVER_RANGE + 1, rng(), { noCrit: true });
    expect(farKill.severed).toBeUndefined();
    const pin = { ...weaponStats(WEAPON_BASES.thePin!), damage: 1 };
    expect(resolveHit(plain, pin, dummy({ health: 1, maxHealth: 1000 }), "torso", 1, rng(), { noCrit: true }).severed).toBeUndefined();
    const katana = { ...weaponStats(WEAPON_BASES.nightShift!), damage: 1 };
    expect(resolveHit(plain, katana, dummy({ health: 1, maxHealth: 1000 }), "head", 1, rng(), { noCrit: true }).severed).toBe("head");
  });

  it("turns Cath's armour rating into a share that big attackers cut through", () => {
    expect(armourShare(0, 10)).toBe(0);
    expect(armourShare(200, 1)).toBeGreaterThan(armourShare(200, 30));
    expect(armourShare(1e6, 1)).toBeLessThanOrEqual(0.85);
  });
});

describe("CATHODE ballistics", () => {
  const o = { x: 0, y: 0, z: 0 };
  const fwd = { x: 0, y: 0, z: 1 };
  const still = { x: 0, y: 0, z: 0 };

  it("drops under gravity, more with range, and slows with drag", () => {
    const shot = simulateShot(o, fwd, 850, still, 600);
    expect(shot.timeOfFlight).toBeGreaterThan(600 / 850);
    const dropAt = (z: number) => {
      const s = shot.samples.find((p) => p.pos.z >= z)!;
      return -s.pos.y;
    };
    expect(dropAt(200)).toBeGreaterThan(0);
    expect(dropAt(400)).toBeGreaterThan(dropAt(200) * 3);
    expect(Math.hypot(shot.endVelocity.x, shot.endVelocity.y, shot.endVelocity.z)).toBeLessThan(850);
    expect(shot.end.z).toBeCloseTo(600, 3);
  });

  it("drifts downwind, more with range and stronger wind", () => {
    const drift = (wind: number, range: number) => simulateShot(o, fwd, 850, { x: wind, y: 0, z: 0 }, range).end.x;
    expect(drift(5, 300)).toBeGreaterThan(0);
    expect(drift(-5, 300)).toBeLessThan(0);
    expect(drift(5, 600)).toBeGreaterThan(drift(5, 300) * 2);
    expect(drift(10, 300)).toBeCloseTo(drift(5, 300) * 2, 1);
  });

  it("builds a range ladder whose holdover grows with range and shrinks with muzzle velocity", () => {
    const ladder = rangeLadder(850);
    expect(ladder.map((r) => r.range)).toEqual([100, 200, 300, 400]);
    expect(Math.abs(ladder[0]!.dropMils)).toBeLessThan(0.01);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!.dropMils).toBeGreaterThan(ladder[i - 1]!.dropMils);
    expect(rangeLadder(1100)[3]!.dropMils).toBeLessThan(ladder[3]!.dropMils);
    const raw = rangeLadder(850, [100, 200], 0);
    expect(raw[0]!.dropMeters).toBeGreaterThan(0);
  });

  it("stops at a hit reported by the step function", () => {
    const shot = simulateShot(o, fwd, 850, still, 1000, (_a, b) => b.z > 250);
    expect(shot.hit).toBe(true);
    expect(shot.end.z).toBeLessThan(260);
  });

  it("solves holdover, windage and lead that put the round on a moving target", () => {
    const target = { x: 0, y: 0, z: 300 };
    const sol = solveShot(o, target, { x: 2, y: 0, z: 0 }, 850, { x: 4, y: 0, z: 0 });
    expect(sol.holdoverMils).toBeCloseTo(rangeLadder(850, [300])[0]!.dropMils, 1);
    expect(Math.abs(sol.leadMils)).toBeGreaterThan(1);
    const aimed = simulateShot(o, sol.aimDir, 850, { x: 4, y: 0, z: 0 }, 300);
    const moved = { x: 2 * aimed.timeOfFlight, y: 0, z: 300 };
    expect(Math.hypot(aimed.end.x - moved.x, aimed.end.y - moved.y)).toBeLessThan(0.05);
    expect(swayAmplitude(0.6, 1, 50)).toBeCloseTo(0.3);
  });
});

describe("CATHODE enemies and elites", () => {
  it("has every archetype the bible names, with stats that scale by level", () => {
    for (const id of ["enforcer", "riotShield", "enforcerSniper", "priceWarThug", "candorChrome", "drone", "spiderMine", "sentryTurret", "edMech"]) {
      expect(ARCHETYPES[id], id).toBeDefined();
      const lo = makeEnemy(id, 1, rng());
      const hi = makeEnemy(id, 30, rng());
      expect(hi.maxHealth).toBeGreaterThan(lo.maxHealth);
      expect(hi.xp).toBeGreaterThan(lo.xp);
    }
    expect(makeEnemy("riotShield", 5, rng()).shield).toBeGreaterThan(0);
    expect(makeEnemy("sentryTurret", 5, rng()).hearing).toBe(0);
  });

  it("applies elite modifiers and their counts by level", () => {
    const base = makeEnemy("enforcer", 10, rng());
    const fast = makeEnemy("enforcer", 10, rng(), ["extraFast"]);
    expect(fast.elite).toBe(true);
    expect(Math.abs(fast.maxHealth - base.maxHealth * ELITE_HEALTH)).toBeLessThanOrEqual(1.5);
    expect(fast.run).toBeCloseTo(base.run * 1.5);
    expect(fast.name).toContain("Quick");
    const stone = makeEnemy("enforcer", 10, rng(), ["stoneskin"]);
    expect(stone.armour).toBeCloseTo(base.armour + 0.3);
    expect(stone.zones?.head?.armour).toBeCloseTo(0.5);
    expect(makeEnemy("enforcer", 10, rng(), ["shockEnchanted"]).resist.shock).toBe(0.75);
    expect(makeEnemy("enforcer", 10, rng(), ["multipleShots"]).projectiles).toBe(3);
    expect(makeEnemy("enforcer", 10, rng(), ["cursed"]).drainsBulletTime).toBe(1);
    expect(makeEnemy("enforcer", 10, rng(), ["explosiveOnDeath"]).deathExplosion?.damage).toBeGreaterThan(0);
    expect(eliteModCount(5)).toBe(1);
    expect(eliteModCount(45)).toBe(3);
    const rolled = makeEnemy("candorChrome", 45, createRng(8), true);
    expect(rolled.mods).toHaveLength(3);
    expect(new Set(rolled.mods).size).toBe(3);
    expect(makeEnemy("candorChrome", 45, createRng(8), true)).toEqual(rolled);
  });

  it("makes elite stoneskin enforcers harder to hurt than plain ones", () => {
    const stats = deriveStats({ level: 10, attributes: { ...CLASS_START_ATTRIBUTES.ghost } }, [], []);
    const plain = makeEnemy("enforcer", 10, rng());
    const stone = makeEnemy("enforcer", 10, rng(), ["stoneskin"]);
    const a = resolveHit(stats, widowmaker, plain, "torso", 50, rng(), { noCrit: true }).healthDamage;
    const b = resolveHit(stats, widowmaker, stone, "torso", 50, rng(), { noCrit: true }).healthDamage;
    expect(b).toBeLessThan(a * 0.7);
  });
});
