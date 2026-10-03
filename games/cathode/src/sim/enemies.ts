// Hollowell Proper's food chain (design bible 4.6): corp security, the Price-War Boys, Candor's chrome and
// the machines, as data, plus Diablo-style elite modifiers and `makeEnemy`, which builds a live enemy at a
// level. Health and damage grow 8.5% and 8% a level, so a level-50 Hell Week Enforcer has about 55× the
// health of a level-1 one: Cath needs tiers, affixes and skill points, not just a bigger number of bullets.

import type { Rng } from "./rng";
import { UNAWARE, type AwarenessState } from "./stealth";
import type { DamageTarget, ZoneSpec } from "./damage";
import { clamp, type DamageType, type Difficulty, type HitZone } from "./types";

export type Faction = "hollowell" | "priceWar" | "candor" | "machine";

export interface Growth {
  base: number;
  /** Multiplier per level above 1. */
  growth: number;
}

export interface Archetype {
  id: string;
  name: string;
  faction: Faction;
  machine: boolean;
  health: Growth;
  /** Shield points (riot shields, the mech's barrier); broken first. */
  shield: Growth;
  /** Body armour share, 0..0.9. */
  armour: number;
  resist: Partial<Record<DamageType, number>>;
  zones: Partial<Record<HitZone, ZoneSpec>>;
  /** Weapon base id it carries (and can drop), or an innate attack name. */
  weapon: string;
  /** Damage per hit at level 1, and growth. */
  damage: Growth;
  /** Hits per second when firing. */
  fireRate: number;
  /** Chance a shot at Cath hits (before cover and movement). */
  accuracy: number;
  /** Metres per second. */
  walk: number;
  run: number;
  /** Full cone in degrees and range in metres. */
  vision: { cone: number; range: number };
  /** Hearing multiplier (0 = deaf). */
  hearing: number;
  /** XP at level 1; scales by level^1.4. */
  xp: number;
  /** Multiplier on the chance it drops anything. */
  dropChance: number;
  /** Extra magic find its drops roll with. */
  magicFind: number;
  /** Behaviour tags for the game layer's AI. */
  tags: readonly string[];
  blurb: string;
}

const HUMAN_ZONES: Partial<Record<HitZone, ZoneSpec>> = {
  head: {},
  torso: {},
  leftArm: {},
  rightArm: {},
  leftLeg: {},
  rightLeg: {},
};

export const ARCHETYPES: Readonly<Record<string, Archetype>> = Object.fromEntries(
  (
    [
      { id: "enforcer", name: "Hollowell Enforcer", faction: "hollowell", machine: false,
        health: { base: 100, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.25, resist: { kinetic: 0.05 },
        zones: { ...HUMAN_ZONES, head: { armour: 0.2 } }, weapon: "enforcerCarbine", damage: { base: 7, growth: 1.08 },
        fireRate: 4, accuracy: 0.35, walk: 1.6, run: 4.2, vision: { cone: 100, range: 45 }, hearing: 1, xp: 12,
        dropChance: 1, magicFind: 0, tags: ["patrol", "cover"], blurb: "Riot armour, a glowing visor and a quota." },
      { id: "riotShield", name: "Riot-Shield Enforcer", faction: "hollowell", machine: false,
        health: { base: 130, growth: 1.085 }, shield: { base: 80, growth: 1.085 }, armour: 0.35, resist: { kinetic: 0.1 },
        zones: { ...HUMAN_ZONES, head: { armour: 0.4 } }, weapon: "p9service", damage: { base: 6, growth: 1.08 },
        fireRate: 2, accuracy: 0.3, walk: 1.3, run: 3.2, vision: { cone: 90, range: 40 }, hearing: 1, xp: 18,
        dropChance: 1.1, magicFind: 0, tags: ["shield", "advance"], blurb: "A wall that walks. Flank it or break it." },
      { id: "enforcerSniper", name: "Enforcer Sniper", faction: "hollowell", machine: false,
        health: { base: 80, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.15, resist: {},
        zones: { ...HUMAN_ZONES }, weapon: "widowmaker", damage: { base: 30, growth: 1.08 },
        fireRate: 0.4, accuracy: 0.6, walk: 1.4, run: 3.8, vision: { cone: 40, range: 150 }, hearing: 0.8, xp: 20,
        dropChance: 1.2, magicFind: 10, tags: ["overwatch", "laser"], blurb: "A red laser on the wet bricks, then a crack." },
      { id: "priceWarThug", name: "Price-War Boy", faction: "priceWar", machine: false,
        health: { base: 70, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0, resist: { toxic: -0.2 },
        zones: { ...HUMAN_ZONES }, weapon: "streetSweeper", damage: { base: 9, growth: 1.08 },
        fireRate: 1.2, accuracy: 0.3, walk: 1.8, run: 5.0, vision: { cone: 120, range: 35 }, hearing: 1.1, xp: 9,
        dropChance: 0.9, magicFind: 0, tags: ["rush", "taunt"], blurb: "Julian Crisp's muscle. Loud, cheap and plenty." },
      { id: "candorChrome", name: "Candor Chrome", faction: "candor", machine: false,
        health: { base: 140, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.2, resist: { kinetic: 0.2, shock: -0.3 },
        zones: { ...HUMAN_ZONES, head: { armour: 0.3 } }, weapon: "nightShift", damage: { base: 14, growth: 1.08 },
        fireRate: 1.4, accuracy: 0.7, walk: 2.0, run: 6.5, vision: { cone: 120, range: 40 }, hearing: 1.2, xp: 22,
        dropChance: 1.1, magicFind: 5, tags: ["melee", "leap"], blurb: "Surgically \"improved\". Mantis blades and no fear." },
      { id: "cyberpsycho", name: "Cyberpsycho", faction: "candor", machine: false,
        health: { base: 260, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.3, resist: { kinetic: 0.25, shock: -0.2, toxic: 0.3 },
        zones: { ...HUMAN_ZONES, head: { armour: 0.35 } }, weapon: "repossessor", damage: { base: 22, growth: 1.08 },
        fireRate: 1, accuracy: 0.75, walk: 2.4, run: 7.5, vision: { cone: 140, range: 50 }, hearing: 1.3, xp: 45,
        dropChance: 1.6, magicFind: 15, tags: ["berserk", "melee"], blurb: "Too much chrome, not enough person." },
      { id: "healDrone", name: "Candor Heal-Drone", faction: "candor", machine: true,
        health: { base: 40, growth: 1.085 }, shield: { base: 20, growth: 1.085 }, armour: 0.1, resist: { shock: -0.5, toxic: 1 },
        zones: { torso: { severable: false }, head: { multiplier: 2, severable: false } }, weapon: "healBeam", damage: { base: 0, growth: 1 },
        fireRate: 0, accuracy: 0, walk: 3, run: 6, vision: { cone: 360, range: 30 }, hearing: 0.5, xp: 10,
        dropChance: 0.5, magicFind: 0, tags: ["flying", "healer"], blurb: "Mends the chrome. Shoot it first." },
      { id: "drone", name: "Security Drone", faction: "machine", machine: true,
        health: { base: 45, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.2, resist: { shock: -0.5, toxic: 1, incendiary: 0.2 },
        zones: { torso: { severable: false }, head: { multiplier: 2, severable: false } }, weapon: "kestrel", damage: { base: 4, growth: 1.08 },
        fireRate: 3, accuracy: 0.3, walk: 3, run: 8, vision: { cone: 360, range: 40 }, hearing: 0.5, xp: 8,
        dropChance: 0.6, magicFind: 0, tags: ["flying", "spotlight"], blurb: "A searchlight with a gun under it." },
      { id: "spiderMine", name: "Spider Mine", faction: "machine", machine: true,
        health: { base: 25, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.1, resist: { toxic: 1, shock: -0.5 },
        zones: { torso: { severable: false } }, weapon: "selfDestruct", damage: { base: 45, growth: 1.08 },
        fireRate: 0, accuracy: 1, walk: 2, run: 7, vision: { cone: 360, range: 8 }, hearing: 1.2, xp: 4,
        dropChance: 0.2, magicFind: 0, tags: ["explode", "skitter"], blurb: "Eight legs, one job." },
      { id: "sentryTurret", name: "Sentry Turret", faction: "machine", machine: true,
        health: { base: 160, growth: 1.085 }, shield: { base: 0, growth: 1 }, armour: 0.5, resist: { shock: -0.5, toxic: 1, incendiary: 0.3 },
        zones: { torso: { severable: false }, head: { multiplier: 1.5, armour: 0.3, severable: false } }, weapon: "rattlecan", damage: { base: 5, growth: 1.08 },
        fireRate: 8, accuracy: 0.4, walk: 0, run: 0, vision: { cone: 90, range: 60 }, hearing: 0, xp: 15,
        dropChance: 0.8, magicFind: 0, tags: ["static", "hackable", "sweep"], blurb: "Sweeps left, sweeps right, never blinks." },
      { id: "edMech", name: "ED-Class Mech", faction: "machine", machine: true,
        health: { base: 900, growth: 1.085 }, shield: { base: 200, growth: 1.085 }, armour: 0.55, resist: { kinetic: 0.3, shock: -0.25, toxic: 1, incendiary: 0.2 },
        zones: { head: { multiplier: 2, armour: 0.4, severable: false }, torso: {}, leftArm: { armour: 0.5 }, rightArm: { armour: 0.5 }, leftLeg: { armour: 0.5 }, rightLeg: { armour: 0.5 } },
        weapon: "lastOrders", damage: { base: 40, growth: 1.08 },
        fireRate: 0.6, accuracy: 0.5, walk: 1.5, run: 2.5, vision: { cone: 120, range: 80 }, hearing: 0.6, xp: 150,
        dropChance: 3, magicFind: 50, tags: ["boss-lite", "stomp", "rockets", "hackable"], blurb: "Two tonnes of corporate liability." },
    ] satisfies Archetype[]
  ).map((a) => [a.id, a]),
);

// ---------------------------------------------------------------------------------------------------------
// Elite modifiers
// ---------------------------------------------------------------------------------------------------------

export const ELITE_MOD_IDS = ["extraFast", "cursed", "shockEnchanted", "stoneskin", "multipleShots", "explosiveOnDeath"] as const;
export type EliteModId = (typeof ELITE_MOD_IDS)[number];

export interface EliteModDef {
  id: EliteModId;
  name: string;
  /** Word added to the elite's generated name. */
  epithet: string;
  description: string;
}

export const ELITE_MODS: Readonly<Record<EliteModId, EliteModDef>> = {
  extraFast: { id: "extraFast", name: "Extra Fast", epithet: "Quick", description: "Moves 50% faster and fires 33% faster." },
  cursed: { id: "cursed", name: "Cursed", epithet: "Hexed", description: "Each hit drains 1 s of Cath's bullet-time." },
  shockEnchanted: { id: "shockEnchanted", name: "Shock Enchanted", epithet: "Live-Wire", description: "Hits add 30% shock damage; 75% shock resistance; arcs when struck." },
  stoneskin: { id: "stoneskin", name: "Stoneskin", epithet: "Ironclad", description: "+30% armour and +40% kinetic resistance." },
  multipleShots: { id: "multipleShots", name: "Multiple Shots", epithet: "Many-Handed", description: "Fires three projectiles per shot." },
  explosiveOnDeath: { id: "explosiveOnDeath", name: "Explosive on Death", epithet: "Volatile", description: "Explodes on death: 40% of its max health as damage within 4 m." },
};

/** Elites have this much more health and pay this much more XP. */
export const ELITE_HEALTH = 2.5;
export const ELITE_XP = 3;

export interface Enemy extends DamageTarget {
  uid: string;
  archetype: string;
  name: string;
  machine: boolean;
  elite: boolean;
  mods: EliteModId[];
  weapon: string;
  /** Damage per hit and the type of it. */
  damage: number;
  damageType: DamageType;
  /** Extra shock damage share added to its hits (Shock Enchanted). */
  addedShock: number;
  fireRate: number;
  projectiles: number;
  accuracy: number;
  walk: number;
  run: number;
  vision: { cone: number; range: number };
  hearing: number;
  xp: number;
  dropChance: number;
  magicFind: number;
  /** Seconds of bullet-time each hit drains (Cursed). */
  drainsBulletTime: number;
  /** On-death explosion, if any. */
  deathExplosion?: { radius: number; damage: number; damageType: DamageType };
  awareness: AwarenessState;
  tags: readonly string[];
}

/** Monster level offsets per difficulty (Diablo II's Nightmare and Hell bumps), capped at 70. */
export const DIFFICULTY_LEVEL_OFFSET: Record<Difficulty, number> = { noir: 0, hardboiled: 15, hellWeek: 30 };
/** Chance an ordinary spawn is promoted to an elite. */
export const ELITE_CHANCE: Record<Difficulty, number> = { noir: 0.05, hardboiled: 0.1, hellWeek: 0.16 };

/** The monster level for an area on a difficulty. */
export function monsterLevel(areaLevel: number, difficulty: Difficulty): number {
  return clamp(Math.round(areaLevel + DIFFICULTY_LEVEL_OFFSET[difficulty]), 1, 70);
}

/** A value at a level from a growth curve. */
export function grow(g: Growth, level: number): number {
  return g.base * Math.pow(g.growth, Math.max(0, level - 1));
}

/** XP an archetype pays at a level (before level-gap falloff): xp × level^1.4. */
export function archetypeXp(a: Archetype, level: number): number {
  return Math.round(a.xp * Math.pow(Math.max(1, level), 1.4));
}

/** How many elite modifiers an elite rolls at a level: 1, 2 from level 20, 3 from level 40. */
export function eliteModCount(level: number): number {
  return 1 + (level >= 20 ? 1 : 0) + (level >= 40 ? 1 : 0);
}

/**
 * Builds a live enemy. `elite` is false (ordinary), true (roll modifiers on the Rng) or an explicit list.
 * Rolls on the Rng only for elite modifiers and the uid, so ordinary spawns stay cheap and predictable.
 */
export function makeEnemy(archetypeId: string, level: number, rng: Rng, elite: boolean | readonly EliteModId[] = false): Enemy {
  const a = ARCHETYPES[archetypeId];
  if (!a) throw new Error(`unknown archetype ${archetypeId}`);
  const lvl = clamp(Math.round(level), 1, 99);
  let mods: EliteModId[] = [];
  if (elite === true) mods = rng.shuffle(ELITE_MOD_IDS).slice(0, eliteModCount(lvl));
  else if (Array.isArray(elite)) mods = [...new Set(elite as readonly EliteModId[])];
  const isElite = mods.length > 0 || elite === true;
  const has = (m: EliteModId) => mods.includes(m);

  const maxHealth = Math.round(grow(a.health, lvl) * (isElite ? ELITE_HEALTH : 1));
  const shield = Math.round(grow(a.shield, lvl) * (isElite ? ELITE_HEALTH : 1));
  const resist: Partial<Record<DamageType, number>> = { ...a.resist };
  let armour = a.armour;
  let zones = a.zones;
  if (has("stoneskin")) {
    armour = Math.min(0.85, armour + 0.3);
    resist.kinetic = Math.min(0.9, (resist.kinetic ?? 0) + 0.4);
    zones = Object.fromEntries(
      Object.entries(a.zones).map(([z, spec]) => [z, spec?.armour !== undefined ? { ...spec, armour: Math.min(0.85, spec.armour + 0.3) } : spec]),
    ) as Partial<Record<HitZone, ZoneSpec>>;
  }
  if (has("shockEnchanted")) resist.shock = Math.max(resist.shock ?? 0, 0.75);
  const speed = has("extraFast") ? 1.5 : 1;
  const epithets = mods.map((m) => ELITE_MODS[m].epithet);

  return {
    uid: `${archetypeId}-${Math.floor(rng.next() * 2 ** 32).toString(36)}`,
    archetype: a.id,
    name: isElite ? `${epithets.join(" ")} ${a.name}`.trim() : a.name,
    machine: a.machine,
    elite: isElite,
    mods,
    level: lvl,
    health: maxHealth,
    maxHealth,
    shield,
    armour,
    resist,
    zones,
    severed: [],
    weapon: a.weapon,
    damage: grow(a.damage, lvl) * (isElite ? 1.25 : 1),
    damageType: "kinetic",
    addedShock: has("shockEnchanted") ? 0.3 : 0,
    fireRate: a.fireRate * (has("extraFast") ? 1.33 : 1),
    projectiles: has("multipleShots") ? 3 : 1,
    accuracy: a.accuracy,
    walk: a.walk * speed,
    run: a.run * speed,
    vision: { ...a.vision },
    hearing: a.hearing,
    xp: archetypeXp(a, lvl) * (isElite ? ELITE_XP : 1),
    dropChance: a.dropChance,
    magicFind: a.magicFind + (isElite ? 25 : 0),
    drainsBulletTime: has("cursed") ? 1 : 0,
    ...(has("explosiveOnDeath") ? { deathExplosion: { radius: 4, damage: Math.round(maxHealth * 0.4), damageType: "incendiary" as DamageType } } : {}),
    awareness: { ...UNAWARE },
    tags: a.tags,
  };
}

/** Rolls whether an ordinary spawn is an elite on this difficulty. */
export function rollElite(rng: Rng, difficulty: Difficulty): boolean {
  return rng.chance(ELITE_CHANCE[difficulty]);
}
