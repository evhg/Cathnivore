// Words for loot: rarity names, modifier lines ("+12% stealth", "+1 to Longshot skills") and an item's
// type line. Pure (no DOM), so the tooltip text is unit-tested in tests/cathode-ui-text.test.ts.

import { CLASSES, TREES } from "../sim/classes";
import type { FixedMod, Item, Rarity } from "../sim/loot";
import { GEAR_BASES } from "../sim/loot";
import type { ModKind, StatKey } from "../sim/stats";
import type { ClassId, TreeId } from "../sim/types";
import { WEAPON_BASES, type WeaponStatKey } from "../sim/weapons";

export const RARITY_LABEL: Record<Rarity, string> = {
  standard: "Standard",
  modded: "Modded",
  rare: "Rare",
  unique: "Unique",
  set: "Set",
};

export const WEAPON_CLASS_LABEL: Record<string, string> = {
  pistol: "Pistol",
  revolver: "Revolver",
  smg: "SMG",
  shotgun: "Shotgun",
  rifle: "Assault rifle",
  sniper: "Sniper rifle",
  launcher: "Launcher",
  smart: "Smart gun",
  melee: "Melee",
};

const SLOT_LABEL: Record<string, string> = {
  head: "Hat",
  coat: "Coat",
  gloves: "Gloves",
  boots: "Boots",
  cyberware: "Cyberware",
  weapon: "Weapon",
  chip: "Chip",
};

/** "Sniper rifle", "Coat", "Cyberware", "Chip". */
export function itemTypeLine(item: Item): string {
  if (item.kind === "weapon") return WEAPON_CLASS_LABEL[WEAPON_BASES[item.base]?.cls ?? ""] ?? "Weapon";
  return SLOT_LABEL[item.slot] ?? "Gear";
}

/** The base item's own name when the item has a different one ("Widowmaker" under "Lullaby"). */
export function baseName(item: Item): string | null {
  const name = WEAPON_BASES[item.base]?.name ?? GEAR_BASES[item.base]?.name ?? null;
  return name && name !== item.name ? name : null;
}

const STAT_LABEL: Partial<Record<string, string>> = {
  grit: "Grit",
  aim: "Aim",
  nerve: "Nerve",
  wire: "Wire",
  allAttributes: "all attributes",
  maxHealth: "health",
  healthRegen: "health per second",
  lifeOnKill: "health on kill",
  lifeSteal: "life steal",
  armour: "armour",
  shield: "shield",
  damageReduction: "damage reduction",
  allResist: "all resistances",
  carry: "carry",
  meleeDamage: "melee damage",
  gunDamage: "gun damage",
  damage: "damage",
  headshot: "headshot damage",
  unawareDamage: "damage to unaware enemies",
  suppressedDamage: "suppressed weapon damage",
  explosiveDamage: "explosive damage",
  explosiveRadius: "explosion radius",
  critChance: "critical chance",
  critMultiplier: "critical damage",
  fireRate: "fire rate",
  reloadSpeed: "reload speed",
  magazine: "magazine size",
  adsSpeed: "aim speed",
  moveSpeed: "move speed",
  stealth: "stealth",
  footstepNoise: "footstep noise",
  noise: "noise",
  bulletTime: " s bullet-time",
  bulletTimeOnKill: " s bullet-time on kill",
  hackStrength: "hack strength",
  battery: "battery",
  cooldown: "cooldown reduction",
  magicFind: "magic find",
  scripFind: "Scrip find",
  sever: "dismemberment",
  knockback: "knockback",
  ricochet: "ricochet",
  takedownSpeed: "takedown speed",
  chainTargets: "hack chain targets",
  cookOff: "cook-off chance",
  bleed: "bleed damage",
  subsonic: "subsonic rounds",
  penetration: "penetration",
  pierce: "armour pierce",
  critBonus: "critical chance",
  recoil: "recoil",
  spread: "spread",
  range: "range",
  velocity: "muzzle velocity",
  sway: "scope sway",
  pellets: "pellets",
};

/** Flat stats that read as percentage points ("+5% critical chance"). */
const PERCENT_FLAT = new Set([
  "critChance",
  "critMultiplier",
  "lifeOnKill",
  "lifeSteal",
  "damageReduction",
  "allResist",
  "cooldown",
  "magicFind",
  "scripFind",
  "cookOff",
  "bleed",
  "pierce",
  "critBonus",
]);

const DAMAGE_TYPE_LABEL: Record<string, string> = {
  kinetic: "kinetic",
  shock: "shock",
  incendiary: "fire",
  toxic: "toxic",
  monowire: "monowire",
};

/** Splits camelCase into words ("lastRoundDamage" → "last round damage"). */
export function words(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function fmtValue(v: number): string {
  return String(Math.abs(Math.round(v * 10) / 10));
}

function sign(v: number): string {
  return v < 0 ? "−" : "+";
}

/** One modifier as a tooltip line. Local weapon stats pass `local: true`. */
export function modText(stat: StatKey | WeaponStatKey, kind: ModKind, value: number, local = false): string {
  const v = fmtValue(value);
  const s = sign(value);
  if (stat.startsWith("skills.")) {
    const [, scope, id] = stat.split(".");
    const what =
      scope === "all"
        ? "all skills"
        : scope === "class"
          ? `${CLASSES[id as ClassId]?.name ?? id} skills`
          : `${TREES[id as TreeId]?.name ?? id} skills`;
    return `${s}${v} to ${what}`;
  }
  if (stat.startsWith("resist.")) return `${s}${v}% ${DAMAGE_TYPE_LABEL[stat.slice(7)] ?? stat.slice(7)} resistance`;
  if (stat.startsWith("added.")) return `Adds ${v}% of damage as ${DAMAGE_TYPE_LABEL[stat.slice(6)] ?? stat.slice(6)}`;
  if (stat.startsWith("dmgType.")) return `${s}${v}% ${DAMAGE_TYPE_LABEL[stat.slice(8)] ?? stat.slice(8)} damage`;
  const [base = stat, cls] = stat.split(".");
  let label = STAT_LABEL[base] ?? words(base);
  if (cls) label = `${WEAPON_CLASS_LABEL[cls]?.toLowerCase() ?? cls} ${label}`;
  if (local && !cls && kind !== "flat") label = `weapon ${label}`;
  if (base === "subsonic") return "Fires subsonic rounds";
  if (kind !== "flat") label = label.trim().replace(/^s /, "");
  if (kind === "more") return `${v}% ${value < 0 ? "less" : "more"} ${label}`;
  if (kind === "increased") return `${s}${v}% ${label}`;
  if (base === "bulletTime" || base === "bulletTimeOnKill") return `${s}${v}${label}`;
  return PERCENT_FLAT.has(base) ? `${s}${v}% ${label}` : `${s}${v} ${label}`;
}

/** A unique, set or chip modifier at a rolled value (or its max when unrolled). */
export function fixedModText(m: FixedMod, value?: number): string {
  const v = value ?? m.max;
  if ("stat" in m) return modText(m.stat, m.kind, v);
  return modText(m.local, m.kind, v, true);
}

/** Thousands-separated Scrip ("2,500 Scrip"). */
export function scripText(n: number): string {
  return `${Math.round(n).toLocaleString("en-GB")} Scrip`;
}
