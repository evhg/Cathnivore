// Cath's character record and the rules that grow it: XP and level-ups, attribute points, story-job
// skill points, the second class, equipment, Scrip and respecs. `characterStats` is the full pipeline
// the game layer calls whenever any of that changes:
//
//   equipment modifiers (loot.ts) → "+skills" → skill modifiers (skills.ts) → deriveStats (stats.ts)

import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  CLASS_START_ATTRIBUTES,
  MAX_LEVEL,
  SKILL_POINTS_PER_LEVEL,
  deriveStats,
  levelForXp,
  sumModifiers,
  xpForLevel,
  type DerivedStats,
} from "./stats";
import { addSecondClass, pointsSpent, respecCost, skillModifiers, type Result } from "./skills";
import {
  canEquip,
  cyberwareLoad,
  equipmentModifiers,
  itemWeaponStats,
  makeItem,
  slotKind,
  type EquipSlot,
  type Equipment,
  type Item,
} from "./loot";
import type { WeaponStats } from "./weapons";
import type { AttributeId, Attributes, ClassId, Difficulty } from "./types";

export interface Character {
  name: string;
  /** [primary] or [primary, second]. */
  classes: ClassId[];
  level: number;
  /** Total XP earned. */
  xp: number;
  /** Allocated attributes, including the class's starting 80. */
  attributes: Attributes;
  unspentAttributes: number;
  unspentSkills: number;
  /** Hard skill points by skill id. */
  skills: Record<string, number>;
  inventory: Item[];
  equipment: Equipment;
  activeWeapon: "weapon1" | "weapon2";
  /** Money. */
  scrip: number;
  difficulty: Difficulty;
  /** Respecs bought so far (each doubles the next price). */
  respecs: number;
  /** Free respecs banked (one after the act 1 boss). */
  freeRespecs: number;
  /** Story jobs whose bonus skill point has been claimed. */
  rewardsClaimed: string[];
}

/** Each class's starting weapon (the Pin is always in the second slot). */
export const STARTING_WEAPON: Record<ClassId, string> = {
  ghost: "widowmaker",
  butcher: "streetSweeper",
  gunslinger: "oldTestament",
  wirewitch: "kestrel",
  fixer: "kestrel",
};

/** A fresh level-1 Cath of a class: coat, gloves, boots, a fedora, her class weapon and the Pin. */
export function newCharacter(cls: ClassId, difficulty: Difficulty = "noir"): Character {
  return {
    name: "Cath",
    classes: [cls],
    level: 1,
    xp: 0,
    attributes: { ...CLASS_START_ATTRIBUTES[cls] },
    unspentAttributes: 0,
    unspentSkills: 1,
    skills: {},
    inventory: [],
    equipment: {
      head: makeItem("fedora", { uid: "start-head" }),
      coat: makeItem("trench", { uid: "start-coat" }),
      gloves: makeItem("leatherGloves", { uid: "start-gloves" }),
      boots: makeItem("chelseaBoots", { uid: "start-boots" }),
      weapon1: makeItem(STARTING_WEAPON[cls], { uid: "start-weapon" }),
      weapon2: makeItem("thePin", { uid: "start-pin" }),
    },
    activeWeapon: "weapon1",
    scrip: 50,
    difficulty,
    respecs: 0,
    freeRespecs: 0,
    rewardsClaimed: [],
  };
}

export interface XpGain {
  character: Character;
  /** Each new level reached, in order (empty when none). */
  levelUps: number[];
}

/** Adds XP and applies any level-ups: +5 attribute points and +1 skill point each. */
export function gainXp(c: Character, amount: number): XpGain {
  const cap = xpForLevel(MAX_LEVEL);
  const xp = Math.min(cap, c.xp + Math.max(0, Math.round(amount)));
  const level = levelForXp(xp);
  const levelUps: number[] = [];
  for (let l = c.level + 1; l <= level; l++) levelUps.push(l);
  const gained = levelUps.length;
  return {
    character: {
      ...c,
      xp,
      level: Math.max(c.level, level),
      unspentAttributes: c.unspentAttributes + gained * ATTRIBUTE_POINTS_PER_LEVEL,
      unspentSkills: c.unspentSkills + gained * SKILL_POINTS_PER_LEVEL,
    },
    levelUps,
  };
}

/** Spends unspent attribute points. */
export function allocateAttribute(c: Character, attr: AttributeId, points = 1): Result<Character> {
  if (points < 1 || !Number.isInteger(points)) return { ok: false, reason: "spend whole points" };
  if (c.unspentAttributes < points) return { ok: false, reason: "not enough attribute points" };
  return {
    ok: true,
    value: { ...c, unspentAttributes: c.unspentAttributes - points, attributes: { ...c.attributes, [attr]: c.attributes[attr] + points } },
  };
}

/** Claims a story job's bonus skill point (once per job, Diablo II's Den of Evil). */
export function claimSkillReward(c: Character, jobId: string): Result<Character> {
  if (c.rewardsClaimed.includes(jobId)) return { ok: false, reason: "already claimed" };
  return { ok: true, value: { ...c, unspentSkills: c.unspentSkills + 1, rewardsClaimed: [...c.rewardsClaimed, jobId] } };
}

/** Takes the second class at level 15. */
export function takeSecondClass(c: Character, cls: ClassId): Result<Character> {
  const r = addSecondClass(c, cls);
  return r.ok ? { ok: true, value: { ...r.value, classes: [...r.value.classes] } } : r;
}

/** Points a full reset returns: every skill point and every attribute point above the class start. */
export function respecRefund(c: Character): { skills: number; attributes: number } {
  const start = CLASS_START_ATTRIBUTES[c.classes[0] ?? "ghost"];
  const attrs = (Object.keys(start) as AttributeId[]).reduce((s, a) => s + Math.max(0, c.attributes[a] - start[a]), 0);
  return { skills: pointsSpent(c), attributes: attrs };
}

/** Resets skills and attributes, spending a free respec if banked, else Scrip. */
export function respecCharacter(c: Character): Result<Character> {
  const free = c.freeRespecs > 0;
  const cost = free ? 0 : respecCost(c.respecs, c.level);
  if (c.scrip < cost) return { ok: false, reason: `a respec costs ${cost} Scrip` };
  const refund = respecRefund(c);
  return {
    ok: true,
    value: {
      ...c,
      skills: {},
      unspentSkills: c.unspentSkills + refund.skills,
      attributes: { ...CLASS_START_ATTRIBUTES[c.classes[0] ?? "ghost"] },
      unspentAttributes: c.unspentAttributes + refund.attributes,
      scrip: c.scrip - cost,
      respecs: free ? c.respecs : c.respecs + 1,
      freeRespecs: free ? c.freeRespecs - 1 : c.freeRespecs,
    },
  };
}

/** Moves an inventory item into an equipment slot (the old one goes back to the inventory). */
export function equip(c: Character, uid: string, slot: EquipSlot): Result<Character> {
  const item = c.inventory.find((i) => i.uid === uid);
  if (!item) return { ok: false, reason: "not in the inventory" };
  if (slotKind(slot) !== item.slot) return { ok: false, reason: `${item.name} doesn't go there` };
  const stats = characterStats(c);
  if (!canEquip(item, c.level, stats.attributes)) return { ok: false, reason: `Cath can't use ${item.name} yet` };
  const inventory = c.inventory.filter((i) => i.uid !== uid);
  const old = c.equipment[slot];
  if (old) inventory.push(old);
  const equipment = { ...c.equipment, [slot]: item };
  if (item.slot === "cyberware" && cyberwareLoad(equipment) > stats.cyberwareCapacity) {
    return { ok: false, reason: `not enough cyberware capacity (${stats.cyberwareCapacity})` };
  }
  return { ok: true, value: { ...c, inventory, equipment } };
}

/** Moves an equipped item back to the inventory. */
export function unequip(c: Character, slot: EquipSlot): Result<Character> {
  const item = c.equipment[slot];
  if (!item) return { ok: false, reason: "nothing equipped there" };
  const equipment = { ...c.equipment };
  delete equipment[slot];
  return { ok: true, value: { ...c, equipment, inventory: [...c.inventory, item] } };
}

/** Every derived number for the character, with the active weapon's mods counted. */
export function characterStats(c: Character): DerivedStats {
  const gear = equipmentModifiers(c.equipment, c.activeWeapon);
  const skills = skillModifiers(c, sumModifiers(gear));
  return deriveStats(c, gear, skills);
}

/** The active weapon's resolved numbers, or null when the hand is empty. */
export function activeWeaponStats(c: Character): WeaponStats | null {
  const item = c.equipment[c.activeWeapon];
  return item ? itemWeaponStats(item) : null;
}
