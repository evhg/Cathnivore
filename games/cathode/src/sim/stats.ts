// CATHODE's character numbers: the four attributes, the XP curve, monster XP and the one modifier system
// every bonus goes through. Skills, affixes, chips, firmware chains, set bonuses and cyberware all emit
// `Modifier`s keyed by stat name, and `deriveStats` folds them Diablo-style:
//
//   value = (base + Σ flat) × (1 + Σ increased / 100) × Π (1 + more / 100)
//
// "Increased" bonuses add together before multiplying; each "more" bonus multiplies on its own. So ten
// sources of +10% increased damage give ×2, while two sources of 50% more damage give ×2.25. Attributes
// feed the same sums: 1 Aim is +1% increased gun damage, exactly like a +1% affix.

import {
  ATTRIBUTES,
  DAMAGE_TYPES,
  WEAPON_CLASSES,
  clamp,
  type AttributeId,
  type Attributes,
  type ClassId,
  type DamageType,
  type Difficulty,
  type TreeId,
  type WeaponClass,
} from "./types";

// ---------------------------------------------------------------------------------------------------------
// Levels and experience
// ---------------------------------------------------------------------------------------------------------

export const MAX_LEVEL = 60;
/** Attribute points granted on each level-up (design bible 4.1). */
export const ATTRIBUTE_POINTS_PER_LEVEL = 5;
/** Skill points granted on each level-up. Story jobs grant extra ones (Diablo II's Den of Evil rule). */
export const SKILL_POINTS_PER_LEVEL = 1;

/** XP needed to go from `level` to `level + 1`: round(120 × L^1.85). 0 at the level cap. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(120 * Math.pow(Math.max(1, level), 1.85));
}

/** Total XP needed to reach `level` from a fresh level-1 character (0 for level 1). */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) total += xpToNext(l);
  return total;
}

/** The level a character with this much total XP has reached. */
export function levelForXp(xp: number): number {
  let level = 1;
  let need = xpToNext(1);
  let spent = 0;
  while (level < MAX_LEVEL && xp >= spent + need) {
    spent += need;
    level++;
    need = xpToNext(level);
  }
  return level;
}

/**
 * The XP share a kill pays at a given level gap (Diablo II-like). Monsters up to 5 levels below Cath pay
 * in full; each further level below costs 15% (never below 5%). Monsters more than 5 levels above pay
 * player/monster of their XP, so rushing a low character through Hell Week isn't free.
 */
export function xpFalloff(playerLevel: number, monsterLevel: number): number {
  const gap = playerLevel - monsterLevel;
  if (gap > 5) return Math.max(0.05, 1 - (gap - 5) * 0.15);
  if (gap < -5) return clamp(playerLevel / monsterLevel, 0.05, 1);
  return 1;
}

export interface KillXpOptions {
  /** The kill happened while no enemy saw Cath: +50% (design bible 4.5), plus any `unseenXp` bonus. */
  unseen?: boolean;
  /** Extra XP multiplier from the character's `xpGain` stat (1 = none). */
  xpMultiplier?: number;
  /** Extra unseen-kill bonus percent (the Ghost's Nobody Home). */
  unseenBonus?: number;
}

/** XP for one kill: the monster's XP, the level-gap falloff, the unseen bonus and xpGain. */
export function killXp(
  monsterXp: number,
  monsterLevel: number,
  playerLevel: number,
  opts: KillXpOptions = {},
): number {
  let xp = monsterXp * xpFalloff(playerLevel, monsterLevel);
  if (opts.unseen) xp *= 1.5 + (opts.unseenBonus ?? 0) / 100;
  xp *= opts.xpMultiplier ?? 1;
  return Math.max(1, Math.round(xp));
}

/** The "Ghost" bonus for clearing a whole area unseen: 25% of the XP the area paid, at least 50. */
export function ghostBonusXp(areaXp: number): number {
  return Math.max(50, Math.round(areaXp * 0.25));
}

// ---------------------------------------------------------------------------------------------------------
// Classes' starting attributes
// ---------------------------------------------------------------------------------------------------------

/** Every class starts with 80 points, spread to suit its fantasy. */
export const CLASS_START_ATTRIBUTES: Record<ClassId, Attributes> = {
  ghost: { grit: 15, aim: 25, nerve: 25, wire: 15 },
  butcher: { grit: 35, aim: 15, nerve: 15, wire: 15 },
  gunslinger: { grit: 20, aim: 30, nerve: 15, wire: 15 },
  wirewitch: { grit: 15, aim: 15, nerve: 20, wire: 30 },
  fixer: { grit: 20, aim: 20, nerve: 15, wire: 25 },
};

// ---------------------------------------------------------------------------------------------------------
// The modifier system
// ---------------------------------------------------------------------------------------------------------

/** Stats that can also be qualified by weapon class, e.g. `damage.sniper` or `magazine.smg`. */
export const QUALIFIABLE_STATS = [
  "damage",
  "critChance",
  "critMultiplier",
  "fireRate",
  "reloadSpeed",
  "magazine",
  "armourPierce",
  "recoil",
  "spread",
] as const;
export type QualifiableStat = (typeof QUALIFIABLE_STATS)[number];

/**
 * Every plain stat name. Units: health, armour, shield, battery, carry and counts are flat numbers;
 * critChance, critMultiplier, resistances, armourPierce, lifeSteal and other "chance" stats are percentage
 * points in `flat`; everything else is usually raised with `increased`/`more` percent.
 */
export const PLAIN_STATS = [
  // Attributes (flat points) and "+n to all attributes".
  ...ATTRIBUTES,
  "allAttributes",
  // Survival.
  "maxHealth",
  "healthRegen",
  "lifeOnKill",
  "lifeSteal",
  "armour",
  "shield",
  "shieldRecharge",
  "damageReduction",
  "allResist",
  "secondWind",
  "rageDamage",
  "rageDamageReduction",
  "carry",
  // Damage.
  "meleeDamage",
  "gunDamage",
  "headshot",
  "weakSpot",
  "woundedDamage",
  "unawareDamage",
  "suppressedDamage",
  "rangeDamage",
  "lastRoundDamage",
  "styleDamage",
  "explosiveDamage",
  "explosiveRadius",
  "dotDamage",
  "dotDuration",
  "bleed",
  "burnVulnerability",
  "shieldPierce",
  // Handling.
  "adsSpeed",
  "sway",
  "projectileSpeed",
  "chargeSpeed",
  "lockSpeed",
  "homing",
  "pellets",
  "penetration",
  "ricochet",
  "ricochetDamage",
  "knockback",
  "sever",
  "frenzy",
  "dualWield",
  "suppression",
  "grinderSplash",
  "cookOff",
  "cluster",
  "throwRange",
  // Stealth and the long shot.
  "stealth",
  "darkStealth",
  "detection",
  "noise",
  "footstepNoise",
  "subsonic",
  "bodyConceal",
  "takedownRange",
  "takedownSpeed",
  "bulletTime",
  "bulletTimeOnKill",
  "killCamChance",
  "marks",
  "markDuration",
  "blindSpot",
  // Movement and style.
  "moveSpeed",
  "styleGain",
  "comboWindow",
  "slideCrit",
  // Cyberware and hacking.
  "cyberCapacity",
  "hackStrength",
  "hackRange",
  "hackCost",
  "chainTargets",
  "hijackDamage",
  "battery",
  "batteryRegen",
  "batteryOnKill",
  "cooldown",
  // Gadgets and the familiar.
  "deployableDamage",
  "deployableHealth",
  "deployableCount",
  "deployableDuration",
  "deployableCrit",
  "familiarDamage",
  "familiarRespawn",
  "stimPotency",
  // Hybrid capstone hooks.
  "deadSignal",
  "wetworkGrenade",
  "trickShot",
  "remoteDetonation",
  "saloonDoor",
  "smartMouth",
  // Rewards.
  "xpGain",
  "unseenXp",
  "magicFind",
  "scripFind",
  // Also the unqualified versions of the qualifiable stats.
  ...QUALIFIABLE_STATS,
] as const;

export type PlainStat = (typeof PLAIN_STATS)[number];
/** Every stat key a modifier can target. */
export type StatKey =
  | PlainStat
  | `${QualifiableStat}.${WeaponClass}`
  | `resist.${DamageType}`
  | `dmgType.${DamageType}`
  | `added.${DamageType}`
  | "skills.all"
  | `skills.class.${ClassId}`
  | `skills.tree.${TreeId}`;

export type ModKind = "flat" | "increased" | "more";

/** One bonus. `value` is raw for flat, percent for increased and more (negative values reduce). */
export interface Modifier {
  stat: StatKey;
  kind: ModKind;
  value: number;
  /** Where it came from (a skill id, an item name), for tooltips and debugging. */
  source?: string;
}

export const flat = (stat: StatKey, value: number, source?: string): Modifier => ({ stat, kind: "flat", value, source });
export const inc = (stat: StatKey, value: number, source?: string): Modifier => ({
  stat,
  kind: "increased",
  value,
  source,
});
export const more = (stat: StatKey, value: number, source?: string): Modifier => ({ stat, kind: "more", value, source });

/** The summed modifiers for one stat: Σ flat, Σ increased (%) and the product of every (1 + more/100). */
export interface StatTotal {
  flat: number;
  increased: number;
  more: number;
}

export type StatTotals = Partial<Record<StatKey, StatTotal>>;

const ZERO: StatTotal = Object.freeze({ flat: 0, increased: 0, more: 1 });

/** Sums any number of modifier lists into per-stat totals. */
export function sumModifiers(...lists: readonly (readonly Modifier[])[]): StatTotals {
  const totals: StatTotals = {};
  for (const list of lists) {
    for (const m of list) {
      const t = (totals[m.stat] ??= { flat: 0, increased: 0, more: 1 });
      if (m.kind === "flat") t.flat += m.value;
      else if (m.kind === "increased") t.increased += m.value;
      else t.more *= 1 + m.value / 100;
    }
  }
  return totals;
}

/** The total for one stat (zeros when nothing touches it). */
export function totalOf(totals: StatTotals, key: StatKey): StatTotal {
  return totals[key] ?? ZERO;
}

/** Applies a stat's totals to a base: (base + flat) × (1 + increased%) × more. `extraInc` adds percent. */
export function applyTotals(base: number, total: StatTotal, extraInc = 0): number {
  return (base + total.flat) * Math.max(0, 1 + (total.increased + extraInc) / 100) * total.more;
}

/** The "+n to skills" a character's gear gives a skill in a class and tree. */
export function skillBonus(totals: StatTotals, cls: ClassId | null, tree: TreeId | null): number {
  let n = totalOf(totals, "skills.all").flat;
  if (cls) n += totalOf(totals, `skills.class.${cls}`).flat;
  if (tree) n += totalOf(totals, `skills.tree.${tree}`).flat;
  return Math.floor(n);
}

// ---------------------------------------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------------------------------------

/** The parts of a character `deriveStats` needs (a full `Character` fits). */
export interface StatsSubject {
  level: number;
  /** Allocated attributes, including the class's starting ones. */
  attributes: Attributes;
  difficulty?: Difficulty;
}

/** Resistance penalty per difficulty, in percentage points (Diablo II's Nightmare and Hell penalties). */
export const DIFFICULTY_RESIST_PENALTY: Record<Difficulty, number> = { noir: 0, hardboiled: -20, hellWeek: -50 };
/** Resistances cap at 75% (Diablo II). */
export const MAX_RESIST = 75;
export const BASE_CRIT_CHANCE = 5;
export const BASE_CRIT_MULTIPLIER = 150;
/** Cath's base run speed in metres per second (sprinting is ×1.6 in the game layer). */
export const BASE_MOVE_SPEED = 4.5;
export const BASE_BULLET_TIME = 2;
export const BASE_TAKEDOWN_RANGE = 2;

/** Every number the game layer reads off a character, derived from attributes, gear and skills. */
export interface DerivedStats {
  level: number;
  /** Final attributes after gear and skill bonuses. */
  attributes: Attributes;
  maxHealth: number;
  /** Health regenerated per second. */
  healthRegen: number;
  carry: number;
  /** Damage multiplier for melee weapons (Grit +1% each). */
  meleeMultiplier: number;
  /** Damage multiplier per weapon class (Aim +1% each for guns; melee uses the melee multiplier). */
  gunMultiplier: Record<WeaponClass, number>;
  /** Critical chance 0..0.75 per weapon class (5% + Aim × 0.5%). */
  critChance: Record<WeaponClass, number>;
  /** Critical damage multiplier per weapon class (×1.5 base). */
  critMultiplier: Record<WeaponClass, number>;
  /** Recoil multiplier per weapon class (Aim −0.4% each, floored at 0.15). */
  recoilMultiplier: Record<WeaponClass, number>;
  /** Spread multiplier per weapon class. */
  spreadMultiplier: Record<WeaponClass, number>;
  fireRateMultiplier: Record<WeaponClass, number>;
  reloadSpeedMultiplier: Record<WeaponClass, number>;
  magazineMultiplier: Record<WeaponClass, number>;
  /** Armour ignored, 0..0.9, per weapon class (on top of the weapon's own pierce). */
  armourPierce: Record<WeaponClass, number>;
  /** Aim-down-sights speed multiplier (Aim +0.5% each). */
  adsSpeed: number;
  /** Scope sway multiplier (lower is steadier). */
  swayMultiplier: number;
  /** Stealth in percent (Nerve +1% each, plus gear and skills). */
  stealth: number;
  /** Multiplier on how fast enemies' detection meters fill (1 / (1 + stealth%)), 0.1..3. */
  detectionMultiplier: number;
  /** Multiplier on Cath's own noise radii (footsteps use `footstepNoiseMultiplier` too). */
  noiseMultiplier: number;
  footstepNoiseMultiplier: number;
  /** Seconds of bullet-time per activation (2 s base, Nerve +0.5% each). */
  bulletTimeSeconds: number;
  /** Multiplier applied to the head zone's base multiplier (Nerve +1% each). */
  headshotMultiplier: number;
  cyberwareCapacity: number;
  /** Hack strength multiplier (Wire +1% each). */
  hackStrength: number;
  battery: number;
  batteryRegen: number;
  /** Run speed in m/s. */
  moveSpeed: number;
  /** Resistances 0..0.75 (can go negative on Hell Week) per damage type. */
  resistances: Record<DamageType, number>;
  /** Armour rating (see damage.ts `armourShare` for how it becomes mitigation). */
  armour: number;
  shield: number;
  /** Share of damage taken removed before armour, 0..0.5. */
  damageReduction: number;
  /** Multiplier on outgoing damage per damage type. */
  damageTypeMultiplier: Record<DamageType, number>;
  /** Extra damage added as each type, as a share of the hit's base damage. */
  addedDamage: Record<DamageType, number>;
  /** Share of max health restored on kill. */
  lifeOnKill: number;
  /** Share of damage dealt returned as health. */
  lifeSteal: number;
  /** Cooldown reduction 0..0.6. */
  cooldownReduction: number;
  xpMultiplier: number;
  magicFind: number;
  scripFind: number;
  /** Silent takedown reach in metres. */
  takedownRange: number;
  /** Extra marks (Cold Read, Dead Eye). */
  marks: number;
  /** Multiplier on severing: thresholds are divided by it. */
  severMultiplier: number;
  /** Every stat's raw totals, for the many skill hooks (`totalOf(d.totals, "ricochet").flat`). */
  totals: StatTotals;
}

const perClass = <T>(f: (c: WeaponClass) => T): Record<WeaponClass, T> =>
  Object.fromEntries(WEAPON_CLASSES.map((c) => [c, f(c)])) as Record<WeaponClass, T>;
const perType = <T>(f: (t: DamageType) => T): Record<DamageType, T> =>
  Object.fromEntries(DAMAGE_TYPES.map((t) => [t, f(t)])) as Record<DamageType, T>;

/** The combined total of a stat and its weapon-class qualified version. */
function qualified(totals: StatTotals, stat: QualifiableStat, cls: WeaponClass): StatTotal {
  const a = totalOf(totals, stat);
  const b = totalOf(totals, `${stat}.${cls}`);
  return { flat: a.flat + b.flat, increased: a.increased + b.increased, more: a.more * b.more };
}

/**
 * Derives every number the game needs from a character, its equipment's modifiers and its skills'
 * modifiers (see `skills.ts` `skillModifiers` and `loot.ts` `equipmentModifiers`).
 */
export function deriveStats(
  character: StatsSubject,
  equipment: readonly Modifier[],
  skills: readonly Modifier[],
): DerivedStats {
  const totals = sumModifiers(equipment, skills);
  const t = (k: StatKey) => totalOf(totals, k);

  const all = t("allAttributes").flat;
  const attributes = Object.fromEntries(
    ATTRIBUTES.map((a: AttributeId) => [a, Math.floor(applyTotals(character.attributes[a] + all, t(a)))]),
  ) as Attributes;
  const { grit, aim, nerve, wire } = attributes;
  const level = character.level;

  const melee = applyTotals(1, sumTotals(t("damage"), t("meleeDamage"), t("damage.melee")), grit);
  const gunMultiplier = perClass((c) =>
    c === "melee" ? melee : applyTotals(1, sumTotals(t("damage"), t("gunDamage"), t(`damage.${c}`)), aim),
  );
  const critChance = perClass((c) => clamp((BASE_CRIT_CHANCE + aim * 0.5 + qualified(totals, "critChance", c).flat) / 100, 0, 0.75));
  const critMultiplier = perClass((c) => applyTotals(BASE_CRIT_MULTIPLIER, qualified(totals, "critMultiplier", c)) / 100);
  const recoilMultiplier = perClass((c) => Math.max(0.15, applyTotals(1, qualified(totals, "recoil", c), -0.4 * aim)));
  const spreadMultiplier = perClass((c) => Math.max(0.2, applyTotals(1, qualified(totals, "spread", c))));
  const fireRateMultiplier = perClass((c) => applyTotals(1, qualified(totals, "fireRate", c)));
  const reloadSpeedMultiplier = perClass((c) => applyTotals(1, qualified(totals, "reloadSpeed", c)));
  const magazineMultiplier = perClass((c) => applyTotals(1, qualified(totals, "magazine", c)));
  const armourPierce = perClass((c) => clamp(qualified(totals, "armourPierce", c).flat / 100, 0, 0.9));

  const stealth = nerve + t("stealth").increased + t("stealth").flat;
  const detectionMultiplier = clamp(t("detection").more * Math.max(0.1, 1 + t("detection").increased / 100) / (1 + Math.max(0, stealth) / 100), 0.1, 3);

  const penalty = DIFFICULTY_RESIST_PENALTY[character.difficulty ?? "noir"];
  const resistances = perType((d) =>
    clamp(t(`resist.${d}`).flat + t("allResist").flat + penalty, -100, MAX_RESIST) / 100,
  );

  return {
    level,
    attributes,
    maxHealth: Math.round(applyTotals(60 + 5 * level + 2 * grit, t("maxHealth"))),
    healthRegen: applyTotals(0, t("healthRegen")),
    carry: Math.round(applyTotals(40 + 2 * grit, t("carry"))),
    meleeMultiplier: melee,
    gunMultiplier,
    critChance,
    critMultiplier,
    recoilMultiplier,
    spreadMultiplier,
    fireRateMultiplier,
    reloadSpeedMultiplier,
    magazineMultiplier,
    armourPierce,
    adsSpeed: applyTotals(1, t("adsSpeed"), 0.5 * aim),
    swayMultiplier: Math.max(0.1, applyTotals(1, t("sway"))),
    stealth,
    detectionMultiplier,
    noiseMultiplier: Math.max(0.05, applyTotals(1, t("noise"))),
    footstepNoiseMultiplier: Math.max(0.05, applyTotals(1, sumTotals(t("noise"), t("footstepNoise")))),
    bulletTimeSeconds: applyTotals(BASE_BULLET_TIME, t("bulletTime"), 0.5 * nerve),
    headshotMultiplier: applyTotals(1, t("headshot"), nerve),
    cyberwareCapacity: Math.floor(applyTotals(10 + 2 * wire, t("cyberCapacity"))),
    hackStrength: applyTotals(1, t("hackStrength"), wire),
    battery: Math.round(applyTotals(50 + wire, t("battery"))),
    batteryRegen: applyTotals(2, t("batteryRegen")),
    moveSpeed: applyTotals(BASE_MOVE_SPEED, t("moveSpeed")),
    resistances,
    armour: Math.round(applyTotals(0, t("armour"))),
    shield: Math.round(applyTotals(0, t("shield"))),
    damageReduction: clamp(t("damageReduction").flat / 100, 0, 0.5),
    damageTypeMultiplier: perType((d) => applyTotals(1, t(`dmgType.${d}`))),
    addedDamage: perType((d) => Math.max(0, t(`added.${d}`).flat / 100)),
    lifeOnKill: Math.max(0, t("lifeOnKill").flat / 100),
    lifeSteal: clamp(t("lifeSteal").flat / 100, 0, 0.5),
    cooldownReduction: clamp(t("cooldown").flat / 100, 0, 0.6),
    xpMultiplier: applyTotals(1, t("xpGain")),
    magicFind: Math.max(0, t("magicFind").flat),
    scripFind: Math.max(0, t("scripFind").flat),
    takedownRange: applyTotals(BASE_TAKEDOWN_RANGE, t("takedownRange")),
    marks: Math.floor(t("marks").flat),
    severMultiplier: applyTotals(1, t("sever")),
    totals,
  };
}

function sumTotals(...ts: StatTotal[]): StatTotal {
  const out = { flat: 0, increased: 0, more: 1 };
  for (const x of ts) {
    out.flat += x.flat;
    out.increased += x.increased;
    out.more *= x.more;
  }
  return out;
}
