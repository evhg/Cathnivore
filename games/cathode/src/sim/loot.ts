// CATHODE's loot, Diablo II-style: item bases for every gear slot, five rarities, level-banded prefixes
// and suffixes, generated rare names, fixed uniques and sets, sockets and chips, and firmware chains (the
// runewords: an ordered run of chips in a standard socketed weapon of the right class).
//
// An `Item` is plain data, so it saves as JSON. `itemModifiers` turns one into character-wide modifiers
// for `deriveStats`; `itemWeaponStats` resolves a weapon's own numbers (its local affixes, chips, chain,
// tier and parts). `rollDrop` is the only source of randomness, and it is deterministic given the Rng.

import { type Rng } from "./rng";
import { type ModKind, type Modifier, type StatKey } from "./stats";
import {
  CLASS_IDS,
  DIFFICULTIES,
  WEAPON_CLASSES,
  type Attributes,
  type ClassId,
  type Difficulty,
  type WeaponClass,
} from "./types";
import {
  WEAPON_BASES,
  meetsRequirements,
  weaponStats,
  type PartSlot,
  type Tier,
  type WeaponBase,
  type WeaponMod,
  type WeaponStatKey,
  type WeaponStats,
} from "./weapons";

// ---------------------------------------------------------------------------------------------------------
// Slots and bases
// ---------------------------------------------------------------------------------------------------------

export type ArmourSlot = "head" | "coat" | "gloves" | "boots" | "cyberware";
export type GearSlot = ArmourSlot | "weapon";
/** The nine equipment slots: head, coat, gloves, boots, three cyberware, two weapons (swap with 1/2). */
export const EQUIP_SLOTS = ["head", "coat", "gloves", "boots", "cyber1", "cyber2", "cyber3", "weapon1", "weapon2"] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];
export type Equipment = Partial<Record<EquipSlot, Item>>;

/** The gear slot an equipment slot holds. */
export function slotKind(slot: EquipSlot): GearSlot {
  if (slot.startsWith("cyber")) return "cyberware";
  if (slot.startsWith("weapon")) return "weapon";
  return slot as ArmourSlot;
}

export interface GearBase {
  id: string;
  name: string;
  slot: ArmourSlot;
  level: number;
  /** Implicit modifiers every copy carries (armour on clothes, the implant's effect on cyberware). */
  implicit: readonly Modifier[];
  requirements: Partial<Attributes>;
  maxSockets: number;
  /** Cyberware capacity used (cyberware only). */
  capacity?: number;
}

const g = (stat: StatKey, value: number, kind: ModKind = "flat"): Modifier => ({ stat, kind, value });

export const GEAR_BASES: Readonly<Record<string, GearBase>> = Object.fromEntries(
  (
    [
      { id: "fedora", name: "Fedora", slot: "head", level: 1, implicit: [g("armour", 6)], requirements: {}, maxSockets: 2 },
      { id: "cloche", name: "Cloche Hat", slot: "head", level: 8, implicit: [g("armour", 10), g("stealth", 5, "increased")], requirements: { nerve: 20 }, maxSockets: 2 },
      { id: "riotVisor", name: "Riot Visor", slot: "head", level: 15, implicit: [g("armour", 28)], requirements: { grit: 35 }, maxSockets: 3 },
      { id: "wiredHood", name: "Wired Hood", slot: "head", level: 20, implicit: [g("armour", 14), g("hackStrength", 10, "increased")], requirements: { wire: 35 }, maxSockets: 3 },
      { id: "trench", name: "Charcoal Trench", slot: "coat", level: 1, implicit: [g("armour", 20)], requirements: {}, maxSockets: 3 },
      { id: "duster", name: "Leather Duster", slot: "coat", level: 10, implicit: [g("armour", 34)], requirements: { grit: 25 }, maxSockets: 3 },
      { id: "armouredMac", name: "Armoured Mac", slot: "coat", level: 22, implicit: [g("armour", 55)], requirements: { grit: 40 }, maxSockets: 4 },
      { id: "silkLinedCoat", name: "Silk-Lined Coat", slot: "coat", level: 30, implicit: [g("armour", 40), g("stealth", 10, "increased")], requirements: { nerve: 40 }, maxSockets: 4 },
      { id: "leatherGloves", name: "Black Leather Gloves", slot: "gloves", level: 1, implicit: [g("armour", 4)], requirements: {}, maxSockets: 1 },
      { id: "knuckleGloves", name: "Knuckle Gloves", slot: "gloves", level: 9, implicit: [g("armour", 8), g("meleeDamage", 5, "increased")], requirements: { grit: 25 }, maxSockets: 2 },
      { id: "wiredGloves", name: "Wired Gloves", slot: "gloves", level: 18, implicit: [g("armour", 8), g("reloadSpeed", 5, "increased")], requirements: { wire: 30 }, maxSockets: 2 },
      { id: "chelseaBoots", name: "Chelsea Boots", slot: "boots", level: 1, implicit: [g("armour", 5)], requirements: {}, maxSockets: 1 },
      { id: "heeledBoots", name: "Heeled Boots", slot: "boots", level: 10, implicit: [g("armour", 8), g("moveSpeed", 3, "increased")], requirements: { nerve: 20 }, maxSockets: 2 },
      { id: "tacticalBoots", name: "Tactical Boots", slot: "boots", level: 20, implicit: [g("armour", 16), g("footstepNoise", -15, "increased")], requirements: { grit: 30 }, maxSockets: 2 },
      { id: "opticImplant", name: "Optic Implant", slot: "cyberware", level: 1, implicit: [g("critChance", 2), g("adsSpeed", 10, "increased")], requirements: {}, maxSockets: 1, capacity: 8 },
      { id: "reflexBooster", name: "Reflex Booster", slot: "cyberware", level: 6, implicit: [g("bulletTime", 0.5), g("moveSpeed", 5, "increased")], requirements: { wire: 20 }, maxSockets: 1, capacity: 12 },
      { id: "subdermal", name: "Subdermal Plating", slot: "cyberware", level: 10, implicit: [g("armour", 30), g("maxHealth", 20)], requirements: { grit: 20 }, maxSockets: 1, capacity: 14 },
      { id: "neuralJack", name: "Neural Jack", slot: "cyberware", level: 14, implicit: [g("hackStrength", 15, "increased"), g("battery", 10)], requirements: { wire: 30 }, maxSockets: 2, capacity: 16 },
      { id: "shieldEmitter", name: "Shield Emitter", slot: "cyberware", level: 24, implicit: [g("shield", 60)], requirements: { wire: 40 }, maxSockets: 2, capacity: 20 },
    ] satisfies GearBase[]
  ).map((b) => [b.id, b]),
);

// ---------------------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------------------

export const RARITIES = ["standard", "modded", "rare", "unique", "set"] as const;
export type Rarity = (typeof RARITIES)[number];
/** Display colour per rarity (white, blue, yellow, gold, green). */
export const RARITY_COLOURS: Record<Rarity, string> = {
  standard: "#d8d8d8",
  modded: "#5b8cff",
  rare: "#f2d14b",
  unique: "#c8a165",
  set: "#4fd17a",
};

export interface RolledAffix {
  id: string;
  /** Index into the affix's bands. */
  band: number;
  value: number;
}

export interface Item {
  uid: string;
  kind: "weapon" | "gear" | "chip";
  /** Weapon base id, gear base id or chip id. */
  base: string;
  slot: GearSlot | "chip";
  rarity: Rarity;
  /** Item level: the monster level it dropped from. */
  level: number;
  name: string;
  affixes: RolledAffix[];
  sockets: number;
  /** Chip ids in socket order. */
  chips: string[];
  /** Gunsmith tier (weapons). */
  tier: Tier;
  /** Fitted weapon parts. */
  parts: Partial<Record<PartSlot, string>>;
  uniqueId?: string;
  setPieceId?: string;
  /** Rolled values for the unique's or set piece's fixed modifiers, in order. */
  rolls?: number[];
}

// ---------------------------------------------------------------------------------------------------------
// Affixes
// ---------------------------------------------------------------------------------------------------------

/** Where an affix can roll: a weapon class or an armour slot. */
export type AffixSlot = WeaponClass | ArmourSlot;

export interface AffixBand {
  /** Minimum item level. */
  level: number;
  min: number;
  max: number;
  /** The band's own name ("Sharp", "Vicious", "Brutal"), defaulting to the family's. */
  name?: string;
}

/** A mod an affix (or unique, set, chip or chain) grants: character-wide (`stat`) or weapon-local (`local`). */
export type ModTarget = { stat: StatKey; kind: ModKind } | { local: WeaponStatKey; kind: "flat" | "increased" };

export interface AffixDef {
  id: string;
  kind: "prefix" | "suffix";
  name: string;
  /** Text with `{v}` for the value. */
  text: string;
  slots: readonly AffixSlot[];
  target: ModTarget;
  bands: readonly AffixBand[];
  weight: number;
}

const ALL_WEAPONS: readonly AffixSlot[] = WEAPON_CLASSES;
const GUN_SLOTS: readonly AffixSlot[] = WEAPON_CLASSES.filter((c) => c !== "melee");
const MAG_GUNS: readonly AffixSlot[] = ["pistol", "revolver", "smg", "shotgun", "rifle", "sniper", "smart", "launcher"];
const CLOTHES: readonly AffixSlot[] = ["head", "coat", "gloves", "boots"];
const ARMOUR_ALL: readonly AffixSlot[] = ["head", "coat", "gloves", "boots", "cyberware"];
const EVERYTHING: readonly AffixSlot[] = [...ALL_WEAPONS, ...ARMOUR_ALL];

const band = (level: number, min: number, max: number, name?: string): AffixBand => ({ level, min, max, name });
const S = (stat: StatKey, kind: ModKind = "flat"): ModTarget => ({ stat, kind });
const L = (local: WeaponStatKey, kind: "flat" | "increased" = "increased"): ModTarget => ({ local, kind });

const CLASS_SUFFIX: Record<ClassId, string> = {
  ghost: "of the Ghost",
  butcher: "of the Butcher",
  gunslinger: "of the Gunslinger",
  wirewitch: "of the Wirewitch",
  fixer: "of the Fixer",
};

export const AFFIXES: readonly AffixDef[] = [
  // Prefixes: weapons.
  { id: "vicious", kind: "prefix", name: "Vicious", text: "+{v}% damage", slots: ALL_WEAPONS, target: L("damage"), weight: 12,
    bands: [band(1, 15, 30, "Sharp"), band(12, 31, 55, "Vicious"), band(24, 56, 85, "Brutal"), band(36, 86, 120, "Savage"), band(48, 121, 160, "Merciless")] },
  { id: "twitchy", kind: "prefix", name: "Hair-Trigger", text: "+{v}% fire rate", slots: ALL_WEAPONS, target: L("fireRate"), weight: 6,
    bands: [band(3, 5, 10, "Twitchy"), band(18, 11, 16, "Hair-Trigger"), band(36, 17, 24, "Frantic")] },
  { id: "piercing", kind: "prefix", name: "Piercing", text: "Ignores {v}% armour", slots: ALL_WEAPONS, target: L("pierce", "flat"), weight: 6,
    bands: [band(5, 5, 10, "Piercing"), band(20, 11, 20, "Penetrating"), band(40, 21, 30, "Armour-Eating")] },
  { id: "steady", kind: "prefix", name: "Steady", text: "{v}% recoil", slots: GUN_SLOTS, target: L("recoil"), weight: 6,
    bands: [band(1, -10, -5, "Steady"), band(20, -20, -11, "Rock-Steady")] },
  { id: "drumFed", kind: "prefix", name: "Drum-Fed", text: "+{v}% magazine size", slots: MAG_GUNS, target: L("magazine"), weight: 6,
    bands: [band(2, 15, 30, "Loaded"), band(22, 31, 60, "Drum-Fed")] },
  { id: "hushed", kind: "prefix", name: "Hushed", text: "{v}% noise", slots: GUN_SLOTS, target: L("noise"), weight: 5,
    bands: [band(4, -35, -20, "Quiet"), band(24, -55, -36, "Hushed")] },
  { id: "humming", kind: "prefix", name: "Crackling", text: "+{v}% damage added as shock", slots: ALL_WEAPONS, target: S("added.shock"), weight: 5,
    bands: [band(6, 5, 10, "Humming"), band(20, 11, 20, "Crackling"), band(38, 21, 35, "Arcing")] },
  { id: "burning", kind: "prefix", name: "Burning", text: "+{v}% damage added as incendiary", slots: ALL_WEAPONS, target: S("added.incendiary"), weight: 5,
    bands: [band(6, 5, 10, "Smouldering"), band(20, 11, 20, "Burning"), band(38, 21, 35, "Napalm")] },
  { id: "venomous", kind: "prefix", name: "Venomous", text: "+{v}% damage added as toxic", slots: ALL_WEAPONS, target: S("added.toxic"), weight: 5,
    bands: [band(6, 5, 10, "Tainted"), band(20, 11, 20, "Venomous"), band(38, 21, 35, "Plague")] },
  { id: "filament", kind: "prefix", name: "Razor", text: "+{v}% damage added as monowire", slots: ["melee"], target: S("added.monowire"), weight: 4,
    bands: [band(10, 8, 15, "Razor"), band(30, 16, 30, "Filament")] },
  { id: "cruel", kind: "prefix", name: "Cruel", text: "+{v}% critical damage", slots: [...ALL_WEAPONS, "gloves"], target: S("critMultiplier"), weight: 6,
    bands: [band(4, 10, 20, "Cruel"), band(18, 21, 35, "Wicked"), band(34, 36, 50, "Ruthless")] },
  { id: "gory", kind: "prefix", name: "Gory", text: "+{v}% severing", slots: ["melee", "shotgun", "launcher"], target: S("sever", "increased"), weight: 4,
    bands: [band(5, 10, 25, "Gory"), band(25, 26, 50, "Butchering")] },
  { id: "gilded", kind: "prefix", name: "Gilded", text: "+{v}% Scrip found", slots: EVERYTHING, target: S("scripFind"), weight: 4,
    bands: [band(3, 10, 25, "Gilded"), band(25, 26, 50, "Golden")] },
  // Prefixes: armour.
  { id: "plated", kind: "prefix", name: "Plated", text: "+{v} armour", slots: CLOTHES, target: S("armour"), weight: 12,
    bands: [band(1, 10, 25, "Reinforced"), band(12, 26, 60, "Plated"), band(28, 61, 120, "Kevlar-Lined"), band(44, 121, 200, "Riot-Grade")] },
  { id: "hearty", kind: "prefix", name: "Hearty", text: "+{v} health", slots: [...CLOTHES, "cyberware"], target: S("maxHealth"), weight: 10,
    bands: [band(1, 10, 20, "Hale"), band(12, 21, 40, "Hearty"), band(24, 41, 70, "Iron-Lunged"), band(40, 71, 110, "Unkillable")] },
  { id: "shimmering", kind: "prefix", name: "Shimmering", text: "+{v} shield", slots: ["coat", "cyberware", "head"], target: S("shield"), weight: 6,
    bands: [band(8, 10, 25, "Shimmering"), band(24, 26, 60, "Refracting"), band(42, 61, 110, "Prismatic")] },
  { id: "velvet", kind: "prefix", name: "Velvet", text: "+{v}% stealth", slots: ["head", "coat", "boots"], target: S("stealth", "increased"), weight: 6,
    bands: [band(2, 5, 10, "Shadowed"), band(16, 11, 20, "Velvet"), band(34, 21, 30, "Unseen")] },
  { id: "charged", kind: "prefix", name: "Charged", text: "+{v} battery", slots: ["cyberware", "gloves", "head"], target: S("battery"), weight: 6,
    bands: [band(3, 5, 15, "Charged"), band(22, 16, 30, "Overclocked")] },
  { id: "haunted", kind: "prefix", name: "Haunted", text: "+{v}% hack strength", slots: ["cyberware", "head", "gloves", "smart"], target: S("hackStrength", "increased"), weight: 5,
    bands: [band(5, 5, 12, "Wired"), band(24, 13, 25, "Haunted")] },
  { id: "storied", kind: "prefix", name: "Storied", text: "+{v} to all skills", slots: EVERYTHING, target: S("skills.all"), weight: 1,
    bands: [band(36, 1, 1, "Storied")] },
  // Suffixes.
  { id: "ofTheMarket", kind: "suffix", name: "of the Drowned Market", text: "+{v}% magic find", slots: EVERYTHING, target: S("magicFind"), weight: 6,
    bands: [band(1, 5, 10, "of Salvage"), band(12, 11, 25, "of the Drowned Market"), band(30, 26, 40, "of the Black Market")] },
  { id: "ofAim", kind: "suffix", name: "of the Marksman", text: "+{v} Aim", slots: [...ALL_WEAPONS, "gloves", "head"], target: S("aim"), weight: 8,
    bands: [band(1, 2, 5, "of the Eye"), band(14, 6, 10, "of the Marksman"), band(30, 11, 15, "of the Hawk")] },
  { id: "ofGrit", kind: "suffix", name: "of the Bull", text: "+{v} Grit", slots: [...ALL_WEAPONS, "coat", "boots"], target: S("grit"), weight: 8,
    bands: [band(1, 2, 5, "of the Ox"), band(14, 6, 10, "of the Bull"), band(30, 11, 15, "of the Wall")] },
  { id: "ofNerve", kind: "suffix", name: "of Still Water", text: "+{v} Nerve", slots: [...ALL_WEAPONS, "head", "boots"], target: S("nerve"), weight: 8,
    bands: [band(1, 2, 5, "of Ice"), band(14, 6, 10, "of Still Water"), band(30, 11, 15, "of the Grave")] },
  { id: "ofWire", kind: "suffix", name: "of Fibre", text: "+{v} Wire", slots: [...ALL_WEAPONS, "cyberware", "gloves"], target: S("wire"), weight: 8,
    bands: [band(1, 2, 5, "of Copper"), band(14, 6, 10, "of Fibre"), band(30, 11, 15, "of the Grid")] },
  { id: "ofPrecision", kind: "suffix", name: "of the Surgeon", text: "+{v}% critical chance", slots: [...ALL_WEAPONS, "gloves"], target: S("critChance"), weight: 6,
    bands: [band(4, 2, 4, "of Precision"), band(24, 5, 8, "of the Surgeon")] },
  { id: "ofHunger", kind: "suffix", name: "of Hunger", text: "+{v}% health on kill", slots: [...ALL_WEAPONS, "coat"], target: S("lifeOnKill"), weight: 5,
    bands: [band(3, 1, 2, "of Hunger"), band(22, 3, 5, "of the Wolf")] },
  { id: "ofTheLeech", kind: "suffix", name: "of the Leech", text: "{v}% life steal", slots: [...ALL_WEAPONS, "gloves"], target: S("lifeSteal"), weight: 5,
    bands: [band(6, 1, 3, "of the Leech"), band(28, 4, 7, "of the Vampire")] },
  { id: "ofGrounding", kind: "suffix", name: "of Grounding", text: "+{v}% shock resistance", slots: ARMOUR_ALL, target: S("resist.shock"), weight: 6,
    bands: [band(1, 10, 20, "of Grounding"), band(20, 21, 35, "of Insulation")] },
  { id: "ofAshes", kind: "suffix", name: "of Ashes", text: "+{v}% incendiary resistance", slots: ARMOUR_ALL, target: S("resist.incendiary"), weight: 6,
    bands: [band(1, 10, 20, "of Asbestos"), band(20, 21, 35, "of Ashes")] },
  { id: "ofTheGasmask", kind: "suffix", name: "of the Gasmask", text: "+{v}% toxic resistance", slots: ARMOUR_ALL, target: S("resist.toxic"), weight: 6,
    bands: [band(1, 10, 20, "of the Gasmask"), band(20, 21, 35, "of Antidote")] },
  { id: "ofKevlar", kind: "suffix", name: "of Kevlar", text: "+{v}% kinetic resistance", slots: ARMOUR_ALL, target: S("resist.kinetic"), weight: 5,
    bands: [band(4, 5, 10, "of Kevlar"), band(24, 11, 20, "of Plate")] },
  { id: "ofTheRain", kind: "suffix", name: "of the Rain", text: "+{v}% to all resistances", slots: ARMOUR_ALL, target: S("allResist"), weight: 3,
    bands: [band(10, 5, 10, "of the Rain"), band(32, 11, 20, "of the Storm")] },
  { id: "ofHaste", kind: "suffix", name: "of Haste", text: "+{v}% move speed", slots: ["boots"], target: S("moveSpeed", "increased"), weight: 8,
    bands: [band(1, 5, 10, "of Haste"), band(20, 11, 20, "of the Chase")] },
  { id: "ofQuickHands", kind: "suffix", name: "of Quick Hands", text: "+{v}% reload speed", slots: MAG_GUNS, target: L("reloadSpeed"), weight: 6,
    bands: [band(2, 10, 20, "of Quick Hands"), band(22, 21, 35, "of Sleight")] },
  { id: "ofTheSkull", kind: "suffix", name: "of the Skull", text: "+{v}% headshot damage", slots: [...GUN_SLOTS, "head"], target: S("headshot", "increased"), weight: 5,
    bands: [band(6, 10, 20, "of the Skull"), band(26, 21, 40, "of Execution")] },
  { id: "ofClockwork", kind: "suffix", name: "of Clockwork", text: "{v}% cooldown reduction", slots: ["cyberware", "head"], target: S("cooldown"), weight: 4,
    bands: [band(8, 3, 6, "of Patience"), band(30, 7, 12, "of Clockwork")] },
  { id: "ofLessons", kind: "suffix", name: "of Lessons", text: "+{v}% experience", slots: ["head", "cyberware"], target: S("xpGain", "increased"), weight: 3,
    bands: [band(5, 3, 6, "of Lessons"), band(30, 7, 10, "of Hard Lessons")] },
  { id: "ofSlowSeconds", kind: "suffix", name: "of Slow Seconds", text: "+{v} s bullet-time", slots: ["cyberware", "head", "sniper"], target: S("bulletTime"), weight: 4,
    bands: [band(6, 0.2, 0.5, "of Slow Seconds"), band(30, 0.6, 1.0, "of Frozen Time")] },
  ...CLASS_IDS.map(
    (cls): AffixDef => ({
      id: `of_${cls}`,
      kind: "suffix",
      name: CLASS_SUFFIX[cls],
      text: `+{v} to ${cls[0]?.toUpperCase()}${cls.slice(1)} skills`,
      slots: EVERYTHING,
      target: S(`skills.class.${cls}`),
      weight: 1.5,
      bands: [band(10, 1, 1), band(32, 2, 2)],
    }),
  ),
];

export const AFFIX_BY_ID: Readonly<Record<string, AffixDef>> = Object.fromEntries(AFFIXES.map((a) => [a.id, a]));

/** The affix slot an item rolls against: its weapon class, or its armour slot. */
export function affixSlotOf(item: Pick<Item, "kind" | "base" | "slot">): AffixSlot | null {
  if (item.kind === "weapon") return WEAPON_BASES[item.base]?.cls ?? null;
  if (item.kind === "gear") return item.slot as ArmourSlot;
  return null;
}

function rollValue(rng: Rng, lo: number, hi: number): number {
  if (Number.isInteger(lo) && Number.isInteger(hi)) return rng.int(lo, hi);
  return Math.round(rng.float(lo, hi) * 10) / 10;
}

/** Rolls one affix of a kind for an item slot and item level, avoiding families already on the item. */
export function rollAffix(rng: Rng, slot: AffixSlot, ilvl: number, kind: "prefix" | "suffix", taken: readonly string[]): RolledAffix | null {
  const pool = AFFIXES.filter(
    (a) => a.kind === kind && a.slots.includes(slot) && !taken.includes(a.id) && (a.bands[0]?.level ?? 99) <= ilvl,
  );
  if (pool.length === 0) return null;
  const def = rng.weighted(pool.map((a) => [a, a.weight] as const));
  const eligible = def.bands.map((b, i) => [i, b] as const).filter(([, b]) => b.level <= ilvl);
  // The highest eligible band 60% of the time, otherwise any eligible band.
  const top = eligible[eligible.length - 1];
  if (!top) return null;
  const [bandIndex, b] = rng.chance(0.6) ? top : rng.pick(eligible);
  return { id: def.id, band: bandIndex, value: rollValue(rng, b.min, b.max) };
}

/** An affix's display name for its band. */
export function affixName(a: RolledAffix): string {
  const def = AFFIX_BY_ID[a.id];
  return def?.bands[a.band]?.name ?? def?.name ?? a.id;
}

/** An affix's text with its value ("+42% damage"). */
export function affixText(a: RolledAffix): string {
  const def = AFFIX_BY_ID[a.id];
  return def ? def.text.split("{v}").join(String(a.value)) : a.id;
}

// ---------------------------------------------------------------------------------------------------------
// Rare names
// ---------------------------------------------------------------------------------------------------------

const RARE_FIRST = [
  "Rain", "Neon", "Grave", "Velvet", "Ash", "Static", "Gutter", "Chrome", "Midnight", "Widow", "Salt", "Cinder",
  "Hollow", "Smoke", "Ink", "Pearl", "Rust", "Blood", "Ghost", "Last", "Cold", "Black", "Silk", "Wire",
] as const;
const RARE_WEAPON = [
  "Lullaby", "Kiss", "Verdict", "Sermon", "Alibi", "Confession", "Nocturne", "Eulogy", "Whisper", "Debt", "Promise",
  "Ledger", "Requiem", "Toast", "Testimony", "Goodnight",
] as const;
const RARE_GEAR = [
  "Shroud", "Veil", "Mantle", "Shell", "Hide", "Grip", "Step", "Halo", "Cowl", "Wrap", "Collar", "Stride", "Circuit", "Lens",
] as const;

/** A generated two-word rare name ("Neon Alibi", "Widow Veil"). */
export function rareName(rng: Rng, kind: "weapon" | "gear"): string {
  return `${rng.pick(RARE_FIRST)} ${rng.pick(kind === "weapon" ? RARE_WEAPON : RARE_GEAR)}`;
}

// ---------------------------------------------------------------------------------------------------------
// Uniques and sets
// ---------------------------------------------------------------------------------------------------------

/** A fixed modifier with a roll range (min = max for fixed values). */
export type FixedMod = ModTarget & { min: number; max: number };
const fx = (target: ModTarget, min: number, max = min): FixedMod => ({ ...target, min, max });

export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  kind: "weapon" | "gear";
  level: number;
  mods: readonly FixedMod[];
  sockets?: number;
  lore: string;
}

export const UNIQUES: readonly UniqueDef[] = [
  { id: "lullaby", name: "Lullaby", base: "widowmaker", kind: "weapon", level: 8, lore: "Bea never knew what was under the bed while Cath sang.",
    mods: [fx(L("damage"), 80, 110), fx(S("nerve"), 10, 15), fx(S("skills.tree.longshot"), 1, 2), fx(S("bulletTimeOnKill"), 1)] },
  { id: "fishmonger", name: "The Fishmonger", base: "coachGun", kind: "weapon", level: 12, lore: "Tomas's stall had one for rats. It got bigger rats.",
    mods: [fx(L("damage"), 90, 130), fx(S("sever", "increased"), 50), fx(S("lifeOnKill"), 3)] },
  { id: "mercy", name: "Mercy", base: "thePin", kind: "weapon", level: 5, lore: "The Pin, rewrapped in red leather. It hasn't earned its name.",
    mods: [fx(L("damage"), 100, 140), fx(S("critChance"), 10), fx(S("takedownSpeed", "increased"), 30)] },
  { id: "neonPsalm", name: "Neon Psalm", base: "pearlHandle", kind: "weapon", level: 16, lore: "Six verses. Nobody stays for the sermon.",
    mods: [fx(L("damage"), 70, 100), fx(S("ricochet"), 1), fx(S("critMultiplier"), 30, 45)] },
  { id: "debtCollector", name: "Debt Collector", base: "repossessor", kind: "weapon", level: 24, lore: "Interest compounds. So does the swing.",
    mods: [fx(L("damage"), 120, 160), fx(S("knockback", "increased"), 50), fx(S("scripFind"), 25, 35)] },
  { id: "sewingCircle", name: "Sewing Circle", base: "sewingMachine", kind: "weapon", level: 20, lore: "Stitch and bitch, with a body count.",
    mods: [fx(L("damage"), 60, 90), fx(L("magazine"), 50), fx(S("added.toxic"), 15)] },
  { id: "paperMoon", name: "Paper Moon", base: "ladybird", kind: "weapon", level: 10, lore: "Small enough to forget. Nobody does.",
    mods: [fx(L("damage"), 60, 80), fx(S("unawareDamage", "increased"), 50), fx(S("stealth", "increased"), 15)] },
  { id: "gridGhost", name: "Grid Ghost", base: "rail9", kind: "weapon", level: 34, lore: "It hums the old network's carrier tone.",
    mods: [fx(L("damage"), 90, 120), fx(L("penetration", "flat"), 2), fx(S("added.shock"), 25), fx(S("skills.class.wirewitch"), 1)] },
  { id: "closingTime", name: "Closing Time", base: "lastOrders", kind: "weapon", level: 30, lore: "You don't have to go home. You can't stay here.",
    mods: [fx(L("damage"), 80, 120), fx(S("explosiveRadius", "increased"), 30), fx(S("resist.incendiary"), 20)] },
  { id: "longGoodbye", name: "The Long Goodbye", base: "trench", kind: "gear", level: 18, lore: "Charcoal wool, one button missing. She never sewed it back.",
    mods: [fx(S("armour"), 80, 120), fx(S("stealth", "increased"), 20), fx(S("allResist"), 10), fx(S("maxHealth"), 40)] },
  { id: "widowsVeil", name: "Widow's Veil", base: "cloche", kind: "gear", level: 22, lore: "Black net, black hat, nobody looks twice.",
    mods: [fx(S("nerve"), 15), fx(S("stealth", "increased"), 25), fx(S("headshot", "increased"), 20)] },
  { id: "gumshoes", name: "Gumshoes", base: "heeledBoots", kind: "gear", level: 14, lore: "Rubber soles under the patent leather. Tailing made elegant.",
    mods: [fx(S("moveSpeed", "increased"), 15), fx(S("footstepNoise", "increased"), -50), fx(S("nerve"), 10)] },
  { id: "velvetKnuckles", name: "Velvet Knuckles", base: "knuckleGloves", kind: "gear", level: 16, lore: "Soft to the touch. That's the trick.",
    mods: [fx(S("meleeDamage", "increased"), 40), fx(S("critChance"), 5), fx(S("grit"), 10)] },
  { id: "blackBox", name: "Black Box", base: "reflexBooster", kind: "gear", level: 26, lore: "Recovered from a crash. It still remembers the last second.",
    mods: [fx(S("bulletTime"), 1.5), fx(S("cooldown"), 10), fx(S("battery"), 25)] },
  { id: "candorsConscience", name: "Candor's Conscience", base: "neuralJack", kind: "gear", level: 40, lore: "Candor had one once. It was removed.",
    mods: [fx(S("hackStrength", "increased"), 40), fx(S("skills.tree.ghostInTheWire"), 2), fx(S("wire"), 15)] },
];

export interface SetPieceDef {
  id: string;
  name: string;
  setId: string;
  base: string;
  kind: "weapon" | "gear";
  level: number;
  mods: readonly FixedMod[];
}

export interface SetDef {
  id: string;
  name: string;
  pieces: readonly string[];
  /** Bonuses by number of pieces worn (2, 3, 4...), cumulative. */
  bonuses: Readonly<Record<number, readonly Modifier[]>>;
  lore: string;
}

export const SETS: readonly SetDef[] = [
  {
    id: "widowsWeeds",
    name: "The Widow's Weeds",
    pieces: ["widowsHat", "widowsTrench", "widowsGloves", "widowsDue"],
    lore: "Mourning clothes for a woman with a list.",
    bonuses: {
      2: [g("stealth", 20, "increased")],
      3: [g("bulletTime", 1), g("headshot", 50, "increased")],
      4: [g("skills.class.ghost", 2), g("damage.sniper", 20, "more")],
    },
  },
  {
    id: "marketDay",
    name: "Market Day",
    pieces: ["oilskinApron", "guttingGloves", "wellingtons"],
    lore: "What Tomas wore on Saturdays. Cath wears it on the worst ones.",
    bonuses: {
      2: [g("armour", 60), g("lifeOnKill", 3)],
      3: [g("skills.class.butcher", 1), g("meleeDamage", 30, "more"), g("sever", 50, "increased")],
    },
  },
];

export const SET_PIECES: readonly SetPieceDef[] = [
  { id: "widowsHat", name: "Widow's Hat", setId: "widowsWeeds", base: "fedora", kind: "gear", level: 12, mods: [fx(S("nerve"), 8), fx(S("armour"), 20)] },
  { id: "widowsTrench", name: "Widow's Trench", setId: "widowsWeeds", base: "trench", kind: "gear", level: 14, mods: [fx(S("armour"), 50), fx(S("maxHealth"), 30)] },
  { id: "widowsGloves", name: "Widow's Gloves", setId: "widowsWeeds", base: "leatherGloves", kind: "gear", level: 13, mods: [fx(S("aim"), 8), fx(S("critChance"), 3)] },
  { id: "widowsDue", name: "Widow's Due", setId: "widowsWeeds", base: "widowmaker", kind: "weapon", level: 15, mods: [fx(L("damage"), 60), fx(S("headshot", "increased"), 25)] },
  { id: "oilskinApron", name: "Oilskin Apron", setId: "marketDay", base: "duster", kind: "gear", level: 10, mods: [fx(S("armour"), 40), fx(S("resist.toxic"), 20)] },
  { id: "guttingGloves", name: "Gutting Gloves", setId: "marketDay", base: "knuckleGloves", kind: "gear", level: 10, mods: [fx(S("meleeDamage", "increased"), 20), fx(S("lifeSteal"), 3)] },
  { id: "wellingtons", name: "Wellingtons", setId: "marketDay", base: "chelseaBoots", kind: "gear", level: 10, mods: [fx(S("grit"), 10), fx(S("moveSpeed", "increased"), 8)] },
];

export const UNIQUE_BY_ID: Readonly<Record<string, UniqueDef>> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));
export const SET_PIECE_BY_ID: Readonly<Record<string, SetPieceDef>> = Object.fromEntries(SET_PIECES.map((p) => [p.id, p]));
export const SET_BY_ID: Readonly<Record<string, SetDef>> = Object.fromEntries(SETS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------------------------
// Chips and firmware chains
// ---------------------------------------------------------------------------------------------------------

export interface ChipDef {
  id: string;
  name: string;
  level: number;
  /** What the chip does socketed in a weapon. */
  weapon: readonly FixedMod[];
  /** What it does socketed in armour or cyberware. */
  gear: readonly FixedMod[];
}

export const CHIPS: readonly ChipDef[] = [
  { id: "ash", name: "Ash", level: 1, weapon: [fx(S("added.incendiary"), 10)], gear: [fx(S("resist.incendiary"), 10)] },
  { id: "rain", name: "Rain", level: 1, weapon: [fx(L("noise"), -15)], gear: [fx(S("stealth", "increased"), 8)] },
  { id: "cold", name: "Cold", level: 3, weapon: [fx(S("critMultiplier"), 20)], gear: [fx(S("nerve"), 5)] },
  { id: "neon", name: "Neon", level: 3, weapon: [fx(S("added.shock"), 10)], gear: [fx(S("resist.shock"), 10)] },
  { id: "rust", name: "Rust", level: 5, weapon: [fx(L("pierce", "flat"), 10)], gear: [fx(S("armour"), 15)] },
  { id: "salt", name: "Salt", level: 5, weapon: [fx(S("lifeOnKill"), 2)], gear: [fx(S("maxHealth"), 15)] },
  { id: "smoke", name: "Smoke", level: 8, weapon: [fx(L("fireRate"), 10)], gear: [fx(S("moveSpeed", "increased"), 5)] },
  { id: "glass", name: "Glass", level: 10, weapon: [fx(S("critChance"), 3)], gear: [fx(S("magicFind"), 10)] },
  { id: "ink", name: "Ink", level: 12, weapon: [fx(S("added.toxic"), 10)], gear: [fx(S("resist.toxic"), 10)] },
  { id: "bone", name: "Bone", level: 14, weapon: [fx(S("sever", "increased"), 20)], gear: [fx(S("grit"), 5)] },
  { id: "static", name: "Static", level: 16, weapon: [fx(L("reloadSpeed"), 20)], gear: [fx(S("battery"), 10)] },
  { id: "pearl", name: "Pearl", level: 18, weapon: [fx(S("headshot", "increased"), 15)], gear: [fx(S("aim"), 5)] },
  { id: "ember", name: "Ember", level: 22, weapon: [fx(L("damage"), 15)], gear: [fx(S("allResist"), 5)] },
  { id: "tide", name: "Tide", level: 26, weapon: [fx(L("penetration", "flat"), 1)], gear: [fx(S("wire"), 5)] },
  { id: "velvetChip", name: "Velvet", level: 32, weapon: [fx(S("unawareDamage", "increased"), 30)], gear: [fx(S("stealth", "increased"), 15)] },
  { id: "chrome", name: "Chrome", level: 40, weapon: [fx(S("skills.all"), 1)], gear: [fx(S("maxHealth"), 20), fx(S("battery"), 20)] },
];

export const CHIP_BY_ID: Readonly<Record<string, ChipDef>> = Object.fromEntries(CHIPS.map((c) => [c.id, c]));

export interface FirmwareChain {
  id: string;
  name: string;
  /** Weapon classes it works in (the class requirement). */
  weaponClasses: readonly WeaponClass[];
  /** The ordered chip sequence; the weapon needs exactly this many sockets. */
  chips: readonly string[];
  description: string;
  mods: readonly FixedMod[];
  /** A behaviour hook for the game layer. */
  effect: { type: string; [param: string]: number | string };
}

export const FIRMWARE_CHAINS: readonly FirmwareChain[] = [
  { id: "lastCall", name: "Last Call", weaponClasses: ["sniper"], chips: ["ash", "rain", "cold"],
    description: "Kills in bullet-time refill bullet-time.", effect: { type: "lastCall", refill: 1 },
    mods: [fx(L("damage"), 60), fx(S("bulletTimeOnKill"), 2), fx(S("headshot", "increased"), 25)] },
  { id: "fishMarket", name: "Fish Market", weaponClasses: ["shotgun"], chips: ["salt", "bone", "rust"],
    description: "Every close kill severs; kills heal 5%.", effect: { type: "alwaysSeverClose", meters: 8 },
    mods: [fx(L("damage"), 80), fx(S("sever", "increased"), 100), fx(S("lifeOnKill"), 5)] },
  { id: "neonRequiem", name: "Neon Requiem", weaponClasses: ["revolver", "pistol"], chips: ["neon", "glass", "pearl"],
    description: "Crits arc shock to the nearest enemy.", effect: { type: "critArc", chains: 1 },
    mods: [fx(S("added.shock"), 30), fx(S("critChance"), 10), fx(S("ricochet"), 1)] },
  { id: "rainmaker", name: "Rainmaker", weaponClasses: ["smg", "rifle"], chips: ["rain", "smoke", "rain", "static"],
    description: "A quiet storm: half the noise, bigger mags, faster fire.", effect: { type: "rainmaker" },
    mods: [fx(L("fireRate"), 25), fx(L("magazine"), 50), fx(L("noise"), -50)] },
  { id: "undertow", name: "Undertow", weaponClasses: ["melee"], chips: ["tide", "bone", "ink"],
    description: "Hits drag enemies under: poison and heavy bleeding.", effect: { type: "undertow", slow: 30 },
    mods: [fx(S("added.toxic"), 25), fx(S("bleed"), 50), fx(S("lifeSteal"), 5)] },
  { id: "blackoutDrunk", name: "Blackout Drunk", weaponClasses: ["smart"], chips: ["static", "neon", "ink"],
    description: "Tagged targets get short-circuited; hacks chain twice.", effect: { type: "tagOverload", damage: 50 },
    mods: [fx(S("chainTargets"), 2), fx(S("added.shock"), 20), fx(S("hackStrength", "increased"), 30)] },
  { id: "silverTongue", name: "Silver Tongue", weaponClasses: ["pistol"], chips: ["pearl", "velvetChip"],
    description: "A subsonic whisper that ends conversations.", effect: { type: "silent" },
    mods: [fx(S("unawareDamage", "increased"), 60), fx(S("subsonic"), 1), fx(S("stealth", "increased"), 20), fx(L("noise"), -80)] },
  { id: "deadMansSwitch", name: "Dead Man's Switch", weaponClasses: ["launcher"], chips: ["ash", "smoke", "ember"],
    description: "Explosions leave burning ground; victims cook off.", effect: { type: "burningGround", seconds: 5 },
    mods: [fx(S("explosiveRadius", "increased"), 40), fx(S("explosiveDamage", "increased"), 50), fx(S("cookOff"), 60)] },
  { id: "coldComfort", name: "Cold Comfort", weaponClasses: ["rifle", "sniper"], chips: ["cold", "rust", "glass", "salt"],
    description: "Armour means nothing to a patient shooter.", effect: { type: "patience", stillBonus: 25 },
    mods: [fx(L("damage"), 50), fx(L("pierce", "flat"), 25), fx(S("critChance"), 6)] },
];

/** The firmware chain an item's chips form, if any: a standard, fully socketed weapon of the right class. */
export function chainOf(item: Item): FirmwareChain | null {
  if (item.kind !== "weapon" || item.rarity !== "standard") return null;
  const cls = WEAPON_BASES[item.base]?.cls;
  if (!cls || item.chips.length !== item.sockets) return null;
  return (
    FIRMWARE_CHAINS.find(
      (c) =>
        c.weaponClasses.includes(cls) &&
        c.chips.length === item.chips.length &&
        c.chips.every((chip, i) => item.chips[i] === chip),
    ) ?? null
  );
}

/** Puts a chip into the next free socket. Chips are permanent (no removal), as with Diablo II runes. */
export function socketChip(item: Item, chipId: string): Item | null {
  if (!CHIP_BY_ID[chipId] || item.kind === "chip" || item.chips.length >= item.sockets) return null;
  const next = { ...item, chips: [...item.chips, chipId] };
  const chain = chainOf(next);
  return chain ? { ...next, name: `${chain.name} (${WEAPON_BASES[item.base]?.name ?? item.base})` } : next;
}

// ---------------------------------------------------------------------------------------------------------
// Turning items into modifiers
// ---------------------------------------------------------------------------------------------------------

function fixedToMods(mods: readonly FixedMod[], rolls: readonly number[] | undefined, source: string): {
  global: Modifier[];
  local: WeaponMod[];
} {
  const global: Modifier[] = [];
  const local: WeaponMod[] = [];
  mods.forEach((m, i) => {
    const value = rolls?.[i] ?? m.max;
    if ("stat" in m) global.push({ stat: m.stat, kind: m.kind, value, source });
    else local.push({ stat: m.local, kind: m.kind, value });
  });
  return { global, local };
}

/** Every global and weapon-local mod an item carries (affixes, unique/set mods, chips and chain). */
export function itemMods(item: Item): { global: Modifier[]; local: WeaponMod[] } {
  const global: Modifier[] = [];
  const local: WeaponMod[] = [];
  const add = (r: { global: Modifier[]; local: WeaponMod[] }) => {
    global.push(...r.global);
    local.push(...r.local);
  };
  if (item.kind === "chip") return { global, local };
  const gear = item.kind === "gear" ? GEAR_BASES[item.base] : undefined;
  if (gear) global.push(...gear.implicit.map((m) => ({ ...m, source: item.name })));
  for (const a of item.affixes) {
    const def = AFFIX_BY_ID[a.id];
    if (!def) continue;
    if ("stat" in def.target) global.push({ stat: def.target.stat, kind: def.target.kind, value: a.value, source: item.name });
    else local.push({ stat: def.target.local, kind: def.target.kind, value: a.value });
  }
  const unique = item.uniqueId ? UNIQUE_BY_ID[item.uniqueId] : undefined;
  if (unique) add(fixedToMods(unique.mods, item.rolls, unique.name));
  const piece = item.setPieceId ? SET_PIECE_BY_ID[item.setPieceId] : undefined;
  if (piece) add(fixedToMods(piece.mods, item.rolls, piece.name));
  for (const chipId of item.chips) {
    const chip = CHIP_BY_ID[chipId];
    if (chip) add(fixedToMods(item.kind === "weapon" ? chip.weapon : chip.gear, undefined, chip.name));
  }
  const chain = chainOf(item);
  if (chain) add(fixedToMods(chain.mods, undefined, chain.name));
  return { global, local };
}

/** The character-wide modifiers an item grants (for `deriveStats`). Weapon-local mods are excluded. */
export function itemModifiers(item: Item): Modifier[] {
  return itemMods(item).global;
}

/** A weapon item's resolved numbers: base, item level, tier, parts, local affixes, chips and chain. */
export function itemWeaponStats(item: Item): WeaponStats | null {
  const b = WEAPON_BASES[item.base];
  if (item.kind !== "weapon" || !b) return null;
  return weaponStats(b, { itemLevel: item.level, tier: item.tier, parts: item.parts, mods: itemMods(item).local, name: item.name });
}

/** Set bonuses for the worn pieces, cumulative by piece count. */
export function setBonuses(items: readonly Item[]): Modifier[] {
  const counts = new Map<string, Set<string>>();
  for (const it of items) {
    const piece = it.setPieceId ? SET_PIECE_BY_ID[it.setPieceId] : undefined;
    if (!piece) continue;
    const set = counts.get(piece.setId) ?? new Set<string>();
    set.add(piece.id);
    counts.set(piece.setId, set);
  }
  const out: Modifier[] = [];
  for (const [setId, worn] of counts) {
    const def = SET_BY_ID[setId];
    if (!def) continue;
    for (const [n, mods] of Object.entries(def.bonuses)) {
      if (worn.size >= Number(n)) out.push(...mods.map((m) => ({ ...m, source: def.name })));
    }
  }
  return out;
}

/** Every modifier the worn equipment grants, with only the active weapon counted (weapon swap). */
export function equipmentModifiers(equipment: Equipment, activeWeapon: "weapon1" | "weapon2" = "weapon1"): Modifier[] {
  const worn = EQUIP_SLOTS.filter((s) => !(slotKind(s) === "weapon" && s !== activeWeapon))
    .map((s) => equipment[s])
    .filter((i): i is Item => i !== undefined);
  return [...worn.flatMap(itemModifiers), ...setBonuses(worn)];
}

/** Cyberware capacity the equipped implants use (compare with `DerivedStats.cyberwareCapacity`). */
export function cyberwareLoad(equipment: Equipment): number {
  return (["cyber1", "cyber2", "cyber3"] as const).reduce((sum, s) => {
    const it = equipment[s];
    return sum + (it ? (GEAR_BASES[it.base]?.capacity ?? 0) : 0);
  }, 0);
}

/** An item's attribute requirements (its base's). */
export function itemRequirements(item: Item): Partial<Attributes> {
  if (item.kind === "weapon") return WEAPON_BASES[item.base]?.requirements ?? {};
  if (item.kind === "gear") return GEAR_BASES[item.base]?.requirements ?? {};
  return {};
}

/** The character level an item needs: its highest affix band, its unique/set level or its chip level. */
export function itemLevelRequirement(item: Item): number {
  let lvl = 1;
  if (item.kind === "chip") return CHIP_BY_ID[item.base]?.level ?? 1;
  for (const a of item.affixes) lvl = Math.max(lvl, AFFIX_BY_ID[a.id]?.bands[a.band]?.level ?? 1);
  if (item.uniqueId) lvl = Math.max(lvl, UNIQUE_BY_ID[item.uniqueId]?.level ?? 1);
  if (item.setPieceId) lvl = Math.max(lvl, SET_PIECE_BY_ID[item.setPieceId]?.level ?? 1);
  return lvl;
}

/** True when a character can equip an item. */
export function canEquip(item: Item, level: number, attributes: Attributes): boolean {
  return item.kind !== "chip" && level >= itemLevelRequirement(item) && meetsRequirements(attributes, itemRequirements(item));
}

// ---------------------------------------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------------------------------------

/** Base odds per item before magic find (Diablo II-like). */
export const BASE_RARITY_CHANCE = { unique: 1 / 500, set: 1 / 250, rare: 1 / 30, modded: 1 / 6 } as const;
const DIFFICULTY_LOOT: Record<Difficulty, number> = { noir: 1, hardboiled: 1.3, hellWeek: 1.6 };

/** Magic find with Diablo II's diminishing returns for the better rarities. */
export function effectiveMagicFind(mf: number, rarity: "unique" | "set" | "rare" | "modded"): number {
  const k = { unique: 250, set: 500, rare: 600, modded: Infinity }[rarity];
  return k === Infinity ? mf : (mf * k) / (mf + k);
}

/** The probability of each rarity for one item (checked in order unique, set, rare, modded). */
export function rarityChances(magicFind: number, elite: boolean, difficulty: Difficulty): Record<Exclude<Rarity, "standard">, number> {
  const d = DIFFICULTY_LOOT[difficulty];
  const e = elite ? 3 : 1;
  const p = (r: "unique" | "set" | "rare" | "modded", mult: number) =>
    Math.min(0.9, BASE_RARITY_CHANCE[r] * (1 + effectiveMagicFind(magicFind, r) / 100) * mult);
  return { unique: p("unique", e * d), set: p("set", e * d), rare: p("rare", e * d), modded: p("modded", (elite ? 2 : 1) * d) };
}

/** Rolls a rarity for one item. */
export function rollRarity(rng: Rng, magicFind: number, elite: boolean, difficulty: Difficulty = "noir"): Rarity {
  const c = rarityChances(magicFind, elite, difficulty);
  if (rng.chance(c.unique)) return "unique";
  if (rng.chance(c.set)) return "set";
  if (rng.chance(c.rare)) return "rare";
  if (rng.chance(c.modded)) return "modded";
  return "standard";
}

/** A uid drawn from the Rng, so a seed reproduces a drop exactly (uids included). */
function newUid(rng: Rng): string {
  const a = Math.floor(rng.next() * 2 ** 32).toString(36).padStart(7, "0");
  const b = Math.floor(rng.next() * 2 ** 32).toString(36).padStart(7, "0");
  return a + b;
}
let uidCounter = 0;

/** Creates an item directly (shops, quest rewards, tests). */
export function makeItem(
  base: string,
  opts: Partial<Omit<Item, "base">> & { uid?: string } = {},
): Item {
  const weapon = WEAPON_BASES[base];
  const gear = GEAR_BASES[base];
  const chip = CHIP_BY_ID[base];
  const kind: Item["kind"] = weapon ? "weapon" : gear ? "gear" : chip ? "chip" : "gear";
  return {
    uid: opts.uid ?? `item-${base}-${(uidCounter = (uidCounter + 1) % 100000)}`,
    kind,
    base,
    slot: weapon ? "weapon" : gear ? gear.slot : "chip",
    rarity: opts.rarity ?? "standard",
    level: opts.level ?? weapon?.level ?? gear?.level ?? chip?.level ?? 1,
    name: opts.name ?? weapon?.name ?? gear?.name ?? chip?.name ?? base,
    affixes: opts.affixes ?? [],
    sockets: opts.sockets ?? 0,
    chips: opts.chips ?? [],
    tier: opts.tier ?? 1,
    parts: opts.parts ?? {},
    ...(opts.uniqueId ? { uniqueId: opts.uniqueId } : {}),
    ...(opts.setPieceId ? { setPieceId: opts.setPieceId } : {}),
    ...(opts.rolls ? { rolls: opts.rolls } : {}),
  };
}

/** Makes a unique or set piece with rolled values (or max rolls when no rng is given). */
export function makeUnique(id: string, rng?: Rng, level?: number): Item | null {
  const u = UNIQUE_BY_ID[id];
  const p = SET_PIECE_BY_ID[id];
  const def = u ?? p;
  if (!def) return null;
  const rolls = def.mods.map((m) => (rng ? rollValue(rng, m.min, m.max) : m.max));
  return makeItem(def.base, {
    uid: rng ? newUid(rng) : undefined,
    rarity: u ? "unique" : "set",
    level: Math.max(def.level, level ?? def.level),
    name: def.name,
    sockets: u?.sockets ?? 0,
    rolls,
    ...(u ? { uniqueId: u.id } : { setPieceId: def.id }),
  });
}

/** Rolls one non-chip item of a given rarity at an item level. */
export function rollItem(rng: Rng, ilvl: number, rarity: Rarity, kind: "weapon" | "gear"): Item {
  if (rarity === "unique" || rarity === "set") {
    const pool =
      rarity === "unique"
        ? UNIQUES.filter((u) => u.level <= ilvl && u.kind === kind).map((u) => u.id)
        : SET_PIECES.filter((p) => p.level <= ilvl && p.kind === kind).map((p) => p.id);
    if (pool.length > 0) {
      const item = makeUnique(rng.pick(pool), rng, ilvl);
      if (item) return item;
    }
    rarity = "rare"; // Diablo II: no eligible unique becomes a rare.
  }
  const bases: (WeaponBase | GearBase)[] =
    kind === "weapon"
      ? Object.values(WEAPON_BASES).filter((b) => b.level <= ilvl)
      : Object.values(GEAR_BASES).filter((b) => b.level <= ilvl);
  const b = rng.pick(bases);
  const item = makeItem(b.id, { uid: newUid(rng), rarity, level: ilvl });
  const slot = affixSlotOf(item);
  const affixes: RolledAffix[] = [];
  const addAffix = (k: "prefix" | "suffix") => {
    if (!slot) return;
    const a = rollAffix(rng, slot, ilvl, k, affixes.map((x) => x.id));
    if (a) affixes.push(a);
  };
  if (rarity === "modded") {
    const roll = rng.int(0, 2); // 0: prefix, 1: suffix, 2: both
    if (roll !== 1) addAffix("prefix");
    if (roll !== 0) addAffix("suffix");
    const pre = affixes.find((a) => AFFIX_BY_ID[a.id]?.kind === "prefix");
    const suf = affixes.find((a) => AFFIX_BY_ID[a.id]?.kind === "suffix");
    item.name = [pre ? affixName(pre) : "", b.name, suf ? affixName(suf) : ""].filter(Boolean).join(" ");
  } else if (rarity === "rare") {
    const n = rng.int(3, 5);
    let prefixes = 0;
    let suffixes = 0;
    for (let i = 0; i < n; i++) {
      const k = prefixes >= 3 ? "suffix" : suffixes >= 3 ? "prefix" : rng.chance(0.5) ? "prefix" : "suffix";
      const before = affixes.length;
      addAffix(k);
      if (affixes.length > before) {
        if (k === "prefix") prefixes++;
        else suffixes++;
      }
    }
    item.name = rareName(rng, kind);
  }
  item.affixes = affixes;
  // Sockets: standard items roll them most often (they're the firmware chain bases).
  const maxSockets = "maxSockets" in b ? b.maxSockets : 0;
  const socketChance = { standard: 0.3, modded: 0.15, rare: 0.1, unique: 0, set: 0 }[rarity];
  if (maxSockets > 0 && rng.chance(socketChance)) {
    item.sockets = rarity === "standard" ? rng.int(1, maxSockets) : rng.int(1, Math.min(2, maxSockets));
  }
  return item;
}

/** Rolls a chip that can drop at this item level (higher chips are rarer). */
export function rollChip(rng: Rng, ilvl: number): Item {
  const pool = CHIPS.filter((c) => c.level <= ilvl);
  const chip = rng.weighted(pool.map((c) => [c, 1 / (1 + c.level / 8)] as const));
  return makeItem(chip.id, { uid: newUid(rng), level: ilvl });
}

export interface DropResult {
  items: Item[];
  scrip: number;
}

export interface DropOptions {
  /** Multiplier on the chance of dropping anything (archetype tweaks: mechs drop more, mines less). */
  dropChance?: number;
}

/**
 * The loot from one kill: deterministic given the Rng state. Ordinary enemies drop an item 30% of the time
 * and Scrip half the time; elites always drop two items (50% for a third) and always Scrip, with ×3 odds
 * of rare, set and unique items.
 */
export function rollDrop(
  rng: Rng,
  monsterLevel: number,
  difficulty: Difficulty,
  magicFind: number,
  elite: boolean,
  opts: DropOptions = {},
): DropResult {
  const ilvl = Math.max(1, Math.min(99, Math.round(monsterLevel)));
  const chance = opts.dropChance ?? 1;
  let count = 0;
  if (elite) count = 2 + (rng.chance(0.5 * chance) ? 1 : 0);
  else count = rng.chance(0.3 * chance) ? 1 : 0;
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const type = rng.weighted([
      ["weapon", 40],
      ["gear", 45],
      ["chip", 15],
    ] as const);
    if (type === "chip") items.push(rollChip(rng, ilvl));
    else items.push(rollItem(rng, ilvl, rollRarity(rng, magicFind, elite, difficulty), type));
  }
  const diffIndex = DIFFICULTIES.indexOf(difficulty);
  const scrip = rng.chance(elite ? 1 : 0.5 * chance) ? Math.round(rng.int(3, 8) * ilvl * (1 + 0.5 * diffIndex) * (elite ? 2 : 1)) : 0;
  return { items, scrip };
}
