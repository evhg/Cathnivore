// CATHODE's hit resolution: range falloff, hit zones, crits, shields, armour and piercing, resistances per
// damage type, and dismemberment. `resolveHit` is pure: it reads the attacker's derived stats, the weapon's
// resolved numbers and the target, rolls a crit on the Rng, and returns what happened. `applyHit` writes
// the result back onto a target.
//
// The pipeline for one trigger pull (all pellets that hit the same zone):
//   base      = weapon damage × pellets × range falloff
//   per type  = base × (1 for the weapon's type, or the attacker's "added" share for the others)
//             × class multiplier × damage-type multiplier × zone × crit × situational bonuses
//   shields   take everything first (shock does double to shields)
//   armour    removes zoneArmour × (1 − pierce) of kinetic and monowire damage, half that of elements
//   resists   remove resist[type] (negative resists amplify)

import type { Rng } from "./rng";
import { totalOf, type DerivedStats } from "./stats";
import { DAMAGE_TYPES, LIMB_ZONES, clamp, type DamageType, type HitZone } from "./types";
import type { WeaponStats } from "./weapons";

/** Base damage multiplier per zone. Head is ×2.5, ×4 for sniper rifles; Nerve scales both. */
export const ZONE_MULTIPLIER: Record<HitZone, number> = {
  head: 2.5,
  torso: 1,
  leftArm: 0.7,
  rightArm: 0.7,
  leftLeg: 0.7,
  rightLeg: 0.7,
};
export const SNIPER_HEAD_MULTIPLIER = 4;
/** A limb severs when one hit's health damage exceeds this share of max health (before sever bonuses). */
export const LIMB_SEVER_SHARE = 0.3;
/** A head comes off when a killing hit's damage exceeds this share of max health. */
export const HEAD_SEVER_SHARE = 0.6;
/** Kills with shotguns, edged blades or explosions within this many metres always sever. */
export const CLOSE_SEVER_RANGE = 6;
/** Shock damage counts double against shields. */
export const SHOCK_VS_SHIELD = 2;

export interface ZoneSpec {
  /** Overrides the default zone multiplier. */
  multiplier?: number;
  /** Overrides the target's armour share for this zone. */
  armour?: number;
  /** Whether this zone can be severed (false for a drone's core). */
  severable?: boolean;
}

/** Anything that can be shot: an enemy, a turret, Cath herself. */
export interface DamageTarget {
  level: number;
  health: number;
  maxHealth: number;
  shield: number;
  /** Share of damage armour removes, 0..0.9 (zones can override). */
  armour: number;
  /** Resistances as fractions (0.5 = 50%); negative values amplify. */
  resist: Partial<Record<DamageType, number>>;
  /** Zones this target has, with overrides. Missing zones fall back to the torso. */
  zones?: Partial<Record<HitZone, ZoneSpec>>;
  severed?: readonly HitZone[];
}

export interface HitOptions {
  /** Pellets that hit (defaults to every pellet). */
  pellets?: number;
  /** Always crit (Dead Eye, Name on the List) or never crit (for tests and previews). */
  forceCrit?: boolean;
  noCrit?: boolean;
  /** The target was unaware (stealth kill bonuses). */
  unaware?: boolean;
  /** The target is marked (Cold Read's weak spots). */
  marked?: boolean;
  /** The target is wounded: limping, crawling or missing a limb. */
  wounded?: boolean;
  /** The hit is an explosion (launchers, grenades, mines): close kills gib a limb. */
  explosion?: boolean;
  /** Extra damage multiplier from active effects (One Shot, Dossier...). */
  multiplier?: number;
  /** Gore toggle: "Reduced" intensity turns severing off. */
  severing?: boolean;
}

export interface HitResult {
  /** Total removed from shield and health. */
  damage: number;
  shieldDamage: number;
  healthDamage: number;
  /** Health damage per damage type (after every mitigation). */
  byType: Record<DamageType, number>;
  crit: boolean;
  /** The zone that came off, if any. */
  severed?: HitZone;
  killed: boolean;
  /** Damage beyond what was needed to kill (drives gibs and ragdoll force). */
  overkill: number;
  /** The target's shield and health after the hit. */
  shield: number;
  health: number;
  zoneMultiplier: number;
  falloff: number;
  /** Health returned to the attacker by life steal. */
  lifeStolen: number;
}

/** Damage multiplier at a distance: 1 until `start`, then linear to `min` at `end`. */
export function falloffAt(weapon: Pick<WeaponStats, "falloff">, distance: number): number {
  const { start, end, min } = weapon.falloff;
  if (distance <= start) return 1;
  if (distance >= end || end <= start) return min;
  return 1 + ((min - 1) * (distance - start)) / (end - start);
}

/** How many pellets of a spread shot land on a target of `radius` metres at `distance` (ADS tightens). */
export function pelletsOnTarget(weapon: Pick<WeaponStats, "pellets" | "spread">, distance: number, radius = 0.3, ads = false): number {
  if (weapon.pellets <= 1) return weapon.pellets;
  const spreadRadius = Math.max(1e-6, distance * Math.tan(((ads ? 0.3 : 1) * weapon.spread * Math.PI) / 180));
  const share = Math.min(1, (radius / spreadRadius) ** 2);
  return Math.max(1, Math.round(weapon.pellets * share));
}

/** Converts an armour rating (Cath's gear) into a damage share against an attacker of a level. */
export function armourShare(rating: number, attackerLevel: number): number {
  if (rating <= 0) return 0;
  return Math.min(0.85, rating / (rating + 40 + 12 * attackerLevel));
}

/** The zone multiplier for a weapon class and attacker (head ×2.5, ×4 snipers, × Nerve's headshot bonus). */
export function zoneMultiplier(zone: HitZone, attacker: Pick<DerivedStats, "headshotMultiplier">, weapon: Pick<WeaponStats, "cls">, target?: DamageTarget): number {
  const override = target?.zones?.[zone]?.multiplier;
  if (zone === "head") {
    const base = override ?? (weapon.cls === "sniper" ? SNIPER_HEAD_MULTIPLIER : ZONE_MULTIPLIER.head);
    return base * attacker.headshotMultiplier;
  }
  return override ?? ZONE_MULTIPLIER[zone];
}

/** Resolves one hit (one trigger pull's pellets on one zone). Rolls at most one number (the crit). */
export function resolveHit(
  attacker: DerivedStats,
  weapon: WeaponStats,
  target: DamageTarget,
  zone: HitZone,
  distance: number,
  rng: Rng,
  opts: HitOptions = {},
): HitResult {
  const cls = weapon.cls;
  const t = (k: Parameters<typeof totalOf>[1]) => totalOf(attacker.totals, k);
  // Hits on a zone the target lacks (a drone has no legs) count as torso hits.
  const hitZone: HitZone = target.zones && !target.zones[zone] ? "torso" : zone;
  const falloff = cls === "melee" ? 1 : falloffAt(weapon, distance);
  const pellets = opts.pellets ?? weapon.pellets;
  const base = weapon.damage * pellets * falloff;

  // Crit: one roll per trigger pull.
  const critChance = clamp(attacker.critChance[cls] + weapon.critBonus / 100, 0, 0.95);
  const crit = opts.forceCrit ? true : opts.noCrit ? false : rng.chance(critChance);
  const critMult = crit ? attacker.critMultiplier[cls] : 1;

  // Situational "increased" bonuses add together, like any other increased modifier.
  let situational = 0;
  if (opts.unaware) situational += t("unawareDamage").increased;
  if (opts.marked) situational += t("weakSpot").increased;
  if (opts.wounded) situational += t("woundedDamage").increased;
  if (weapon.suppressed) situational += t("suppressedDamage").increased;
  if (cls === "sniper") situational += Math.min(5, Math.floor(distance / 100)) * t("rangeDamage").flat;
  if (opts.explosion || cls === "launcher") situational += t("explosiveDamage").increased;
  const zoneMult = zoneMultiplier(hitZone, attacker, weapon, target);
  const common =
    base * attacker.gunMultiplier[cls] * zoneMult * critMult * (1 + situational / 100) * (opts.multiplier ?? 1);

  // Raw damage per type before defences.
  const raw: Record<DamageType, number> = { kinetic: 0, shock: 0, incendiary: 0, toxic: 0, monowire: 0 };
  for (const dt of DAMAGE_TYPES) {
    const share = (dt === weapon.damageType ? 1 : 0) + attacker.addedDamage[dt];
    if (share > 0) raw[dt] = common * share * attacker.damageTypeMultiplier[dt];
  }

  // Shields first. Shock counts double against them.
  let shield = target.shield;
  let shieldDamage = 0;
  const afterShield = { ...raw };
  if (shield > 0) {
    for (const dt of ["shock", ...DAMAGE_TYPES.filter((d) => d !== "shock")] as DamageType[]) {
      const factor = dt === "shock" ? SHOCK_VS_SHIELD : 1;
      const absorbed = Math.min(shield, afterShield[dt] * factor);
      shield -= absorbed;
      shieldDamage += absorbed;
      afterShield[dt] -= absorbed / factor;
      if (shield <= 0) break;
    }
  }

  // Armour, then resistances.
  const zoneArmour = target.zones?.[hitZone]?.armour ?? target.armour;
  const pierce = clamp(weapon.pierce + attacker.armourPierce[cls], 0, 0.95);
  const byType: Record<DamageType, number> = { kinetic: 0, shock: 0, incendiary: 0, toxic: 0, monowire: 0 };
  let healthDamage = 0;
  for (const dt of DAMAGE_TYPES) {
    if (afterShield[dt] <= 0) continue;
    const typePierce = dt === "monowire" ? Math.min(0.95, pierce + 0.5) : pierce;
    const armourWeight = dt === "kinetic" || dt === "monowire" ? 1 : 0.5;
    const mitigated = afterShield[dt] * (1 - clamp(zoneArmour, 0, 0.9) * (1 - typePierce) * armourWeight);
    const resisted = mitigated * (1 - clamp(target.resist[dt] ?? 0, -1, 1));
    byType[dt] = resisted;
    healthDamage += resisted;
  }

  const health = target.health - healthDamage;
  const killed = health <= 0;
  const overkill = killed ? -health : 0;

  const severed = opts.severing === false ? undefined : severCheck(attacker, weapon, target, hitZone, distance, healthDamage, killed, rng, opts);

  return {
    damage: shieldDamage + healthDamage,
    shieldDamage,
    healthDamage,
    byType,
    crit,
    ...(severed ? { severed } : {}),
    killed,
    overkill,
    shield: Math.max(0, shield),
    health: Math.max(0, health),
    zoneMultiplier: zoneMult,
    falloff,
    lifeStolen: Math.min(healthDamage, target.health) * attacker.lifeSteal,
  };
}

/** True when this target can lose this zone. */
function canSever(target: DamageTarget, zone: HitZone): boolean {
  if (zone === "torso") return false;
  if (target.severed?.includes(zone)) return false;
  const spec = target.zones?.[zone];
  if (target.zones && !spec) return false;
  return spec?.severable ?? true;
}

/** The dismemberment rule (design bible 4.4). */
function severCheck(
  attacker: DerivedStats,
  weapon: WeaponStats,
  target: DamageTarget,
  zone: HitZone,
  distance: number,
  healthDamage: number,
  killed: boolean,
  rng: Rng,
  opts: HitOptions,
): HitZone | undefined {
  const monowire = weapon.damageType === "monowire" ? 0.5 : 1;
  const threshold = (share: number) => (share * target.maxHealth * monowire) / Math.max(0.1, attacker.severMultiplier);
  const brutalClose =
    killed &&
    distance <= CLOSE_SEVER_RANGE &&
    (weapon.cls === "shotgun" || (weapon.cls === "melee" && weapon.edged) || opts.explosion === true || weapon.cls === "launcher");

  if (zone === "head") {
    if (canSever(target, "head") && killed && (healthDamage >= threshold(HEAD_SEVER_SHARE) || brutalClose)) return "head";
    return undefined;
  }
  if (zone !== "torso") {
    if (canSever(target, zone) && (healthDamage >= threshold(LIMB_SEVER_SHARE) || brutalClose)) return zone;
    return undefined;
  }
  // A torso kill at close range with a brutal weapon takes a random limb with it.
  if (brutalClose) {
    const limbs = LIMB_ZONES.filter((z) => canSever(target, z));
    if (limbs.length > 0) return rng.pick(limbs);
  }
  return undefined;
}

/** Writes a hit's outcome onto a target (health, shield and severed zones). */
export function applyHit<T extends DamageTarget>(target: T, hit: HitResult): T {
  return {
    ...target,
    health: hit.health,
    shield: hit.shield,
    severed: hit.severed ? [...(target.severed ?? []), hit.severed] : target.severed,
  };
}
