// C15 "Armour that breaks" (docs/design/cathode-combat.md S4.3): an Enforcer's plates, his visor, the coolant pack
// on his back and the one disarm he can suffer, as pure data. Combat asks `armourHit` what a round did (which
// layer it met, how much reached the man, whether a plate cracked or broke, the visor's stage) and the game draws
// it (game/armourfx.ts). No three.js here: the tests read the same numbers the game plays.

import type { HitZone, HitLayer } from "./hitevent";

export type PlateId = "chestF" | "chestB" | "pauldronL" | "pauldronR" | "helmet" | "coolant";
export type PlateState = "intact" | "cracked" | "broken";

export interface Plate {
  id: PlateId;
  /** The segment it rides (game/rig.ts names). */
  seg: string;
  hp: number;
  maxHp: number;
  /** Share of a round the plate keeps from the man while it stands. */
  absorb: number;
  state: PlateState;
}

/** S4.3's Enforcer table: each plate's HP as a share of his max HP, and what it absorbs. */
export const PLATE_SPEC: Record<PlateId, { seg: string; share: number; absorb: number }> = {
  chestF: { seg: "chest", share: 0.4, absorb: 0.65 },
  chestB: { seg: "chest", share: 0.3, absorb: 0.65 },
  pauldronL: { seg: "upperArmL", share: 0.15, absorb: 0.5 },
  pauldronR: { seg: "upperArmR", share: 0.15, absorb: 0.5 },
  helmet: { seg: "head", share: 0.2, absorb: 0.5 },
  // The weak point (S4.3): not armour but a can of coolant. A round on it does double, and at 0 HP it vents.
  coolant: { seg: "chest", share: 0.12, absorb: 0 },
};

export const ARMOUR = {
  /** A plate is cracked at or below this share of its HP (S4.3). */
  crackAt: 0.5,
  /** The pauldron covers the outer 120 degrees of the upper arm only. */
  pauldronArcDeg: 120,
  /** S4.2 head multipliers: the visor up 2.0, broken 2.5 (the sniper keeps its own 4.0). */
  headVisor: 2.0,
  headBare: 2.5,
  sniperHead: 4.0,
  /** A weak point takes double (S4.2). */
  weakMul: 2.0,
  /** Torso flesh with the plate gone, and the limbs (S4.2). */
  torsoFlesh: 1.0,
  limb: 0.75,
  /** The vent: an 800 ms plume, a 1.4 s stagger, and no more sprinting. */
  ventMs: 800,
  ventStaggerMs: 1400,
  /** Disarm: a pistol-class or heavier round on the weapon forearm or hand rolls 0.25 + 0.5 x damage / max HP. */
  disarmBase: 0.25,
  disarmScale: 0.5,
  /** Shotguns inside this range spread a pellet's damage across the plate and its neighbours. */
  shotgunSplitM: 6,
  /** The visor's crack flicker (14 Hz for 300 ms) and the shatter's shards. */
  visorFlickerHz: 14,
  visorFlickerMs: 300,
} as const;

/** Weapon classes heavy enough to disarm or to stagger with a head hit ("pistol-class or heavier"). */
export const PISTOL_OR_HEAVIER: ReadonlySet<string> = new Set(["pistol", "revolver", "rifle", "shotgun", "sniper", "launcher", "smart"]);

export interface Armour {
  plates: Record<PlateId, Plate>;
  /** 0 intact, 1 cracked, 2 shattered (the face shows). */
  visor: 0 | 1 | 2;
  vented: boolean;
  disarmed: boolean;
}

/** A fresh suit of Enforcer armour for a man of `maxHp`. `plates` limits which he wears (a sniper wears none). */
export function makeArmour(maxHp: number, plates: readonly PlateId[] = Object.keys(PLATE_SPEC) as PlateId[]): Armour {
  const out = {} as Record<PlateId, Plate>;
  for (const id of Object.keys(PLATE_SPEC) as PlateId[]) {
    const s = PLATE_SPEC[id];
    const worn = plates.includes(id);
    const hp = worn ? s.share * maxHp : 0;
    out[id] = { id, seg: s.seg, hp, maxHp: hp, absorb: s.absorb, state: worn ? "intact" : "broken" };
  }
  return { plates: out, visor: plates.includes("helmet") ? 0 : 2, vented: !plates.includes("coolant"), disarmed: false };
}

/** Back on his feet as new (screenshot stages). */
export function resetArmour(a: Armour): void {
  for (const p of Object.values(a.plates)) {
    if (p.maxHp > 0) {
      p.hp = p.maxHp;
      p.state = "intact";
    }
  }
  a.visor = a.plates.helmet.maxHp > 0 ? 0 : 2;
  a.vented = a.plates.coolant.maxHp <= 0;
  a.disarmed = false;
}

/**
 * Where a round met the armour, from the hit's geometry in the segment's own frame:
 *   `side`: the hit point round the segment (unit, x to the body's left, z forward, in body space);
 *   `along`: how far up the segment it struck (0 at its root, 1 at its end).
 * The pauldron covers the outer 120 degrees of the upper arm (and only its upper 60%); the chest front plate the
 * front half of the chest and upper chest; the back plate the back half, except the coolant can low on the spine.
 */
export function plateFor(zone: HitZone, seg: string, side: { x: number; z: number }, along: number, fromFront: boolean): PlateId | "visor" | null {
  if (zone === "head") return fromFront ? "visor" : "helmet";
  if (zone === "torso") {
    if (seg === "abdomen") return null;
    if (side.z >= 0) return "chestF";
    // The coolant pack sits low on the back, on the spine: the middle 0.12 m of the lower chest's back.
    if (seg === "chest" && Math.abs(side.x) < 0.38 && along < 0.85) return "coolant";
    return "chestB";
  }
  if (seg === "upperArmL" || seg === "upperArmR") {
    // Outer: away from the body's centre line. The arc is centred on the outward axis.
    const out = seg === "upperArmL" ? 1 : -1;
    const ang = Math.acos(Math.max(-1, Math.min(1, side.x * out))) * (180 / Math.PI);
    if (ang <= ARMOUR.pauldronArcDeg / 2 && along <= 0.6) return seg === "upperArmL" ? "pauldronL" : "pauldronR";
  }
  return null;
}

export interface ArmourHit {
  layer: HitLayer;
  plateId?: PlateId;
  /** What reaches the man (after the plate's share), with the zone multiplier applied. */
  body: number;
  /** What the plate took. */
  plate: number;
  /** The zone multiplier used (head 2.0 with the visor up, 2.5 without). */
  zoneMul: number;
  cracked?: boolean;
  broke?: boolean;
  /** The visor's stage after this round, when it was the visor that met it. */
  visorStage?: 0 | 1 | 2;
  /** The coolant can vented on this round. */
  vented?: boolean;
}

/**
 * One round (or pellet) on an armoured man. `raw` is the round's damage before the zone multiplier. Mutates the
 * armour (plate HP and states, the visor stage, the vent).
 *   - A standing plate keeps `absorb` of the round from him; the plate itself takes the full round.
 *   - Cracked at 50% of its HP, broken at 0 (the overflow goes to him as flesh).
 *   - The first head hit from the front cracks the visor, the second shatters it: the head multiplier rises
 *     from 2.0 to 2.5 (the sniper's 4.0 stays).
 *   - The coolant can takes double, and at 0 vents.
 */
export function armourHit(a: Armour, zone: HitZone, where: PlateId | "visor" | null, raw: number, weaponCls: string): ArmourHit {
  const sniper = weaponCls === "sniper";
  if (zone === "head") {
    const visorUp = a.visor < 2;
    const zoneMul = sniper ? ARMOUR.sniperHead : visorUp ? ARMOUR.headVisor : ARMOUR.headBare;
    if (where === "visor" && visorUp) {
      a.visor = (a.visor + 1) as 1 | 2;
      return { layer: "visor", body: raw * zoneMul, plate: 0, zoneMul, visorStage: a.visor, ...(a.visor === 2 ? { broke: true } : { cracked: true }) };
    }
    const helm = a.plates.helmet;
    if (where === "helmet" && helm.state !== "broken") {
      const r = damagePlate(helm, raw * zoneMul);
      return { layer: "plate", plateId: "helmet", body: r.through, plate: r.taken, zoneMul, ...r.flags };
    }
    return { layer: "flesh", body: raw * zoneMul, plate: 0, zoneMul };
  }
  if (where === "coolant") {
    const c = a.plates.coolant;
    if (c.state !== "broken") {
      const dmg = raw * ARMOUR.weakMul;
      c.hp = Math.max(0, c.hp - dmg);
      const vented = c.hp <= 0;
      if (vented) {
        c.state = "broken";
        a.vented = true;
      } else if (c.hp <= c.maxHp * ARMOUR.crackAt) c.state = "cracked";
      return { layer: "weakpoint", plateId: "coolant", body: dmg, plate: dmg, zoneMul: ARMOUR.weakMul, ...(vented ? { vented: true, broke: true } : {}) };
    }
    return { layer: "flesh", body: raw * ARMOUR.torsoFlesh, plate: 0, zoneMul: ARMOUR.torsoFlesh };
  }
  const zoneMul = zone === "torso" ? ARMOUR.torsoFlesh : ARMOUR.limb;
  if (where && where !== "visor") {
    const p = a.plates[where];
    if (p.state !== "broken") {
      const r = damagePlate(p, raw * zoneMul);
      return { layer: "plate", plateId: where, body: r.through, plate: r.taken, zoneMul, ...r.flags };
    }
  }
  return { layer: "flesh", body: raw * zoneMul, plate: 0, zoneMul };
}

/** The plate takes the round; the man takes (1 - absorb) of it, and all of whatever is left when it breaks. */
function damagePlate(p: Plate, dmg: number): { through: number; taken: number; flags: { cracked?: boolean; broke?: boolean } } {
  const was = p.state;
  const taken = Math.min(p.hp, dmg);
  p.hp -= taken;
  const overflow = dmg - taken;
  const through = taken * (1 - p.absorb) + overflow;
  const flags: { cracked?: boolean; broke?: boolean } = {};
  if (p.hp <= 1e-6) {
    p.hp = 0;
    p.state = "broken";
    flags.broke = true;
  } else if (p.hp <= p.maxHp * ARMOUR.crackAt && was === "intact") {
    p.state = "cracked";
    flags.cracked = true;
  }
  return { through, taken, flags };
}

/** Which plates a close shotgun pellet's damage spreads over (S4.3): the struck plate and its neighbours. */
export function shotgunSplit(where: PlateId): PlateId[] {
  switch (where) {
    case "chestF":
      return ["chestF", "pauldronL", "pauldronR"];
    case "chestB":
      return ["chestB", "coolant"];
    case "pauldronL":
      return ["pauldronL", "chestF"];
    case "pauldronR":
      return ["pauldronR", "chestF"];
    default:
      return [where];
  }
}

/**
 * The disarm roll (S4.3): a forearm or hand hit on the weapon arm from a pistol-class weapon or heavier rolls
 * 0.25 + 0.5 x damage / max HP, once per man. `roll` is a uniform 0..1. Mutates `a.disarmed` when it lands.
 */
export function disarmRoll(a: Armour, seg: string, weaponCls: string, damage: number, maxHp: number, roll: number, weaponArm: "L" | "R" = "R"): boolean {
  if (a.disarmed) return false;
  if (seg !== `forearm${weaponArm}` && seg !== `hand${weaponArm}`) return false;
  if (!PISTOL_OR_HEAVIER.has(weaponCls)) return false;
  const p = Math.min(1, ARMOUR.disarmBase + ARMOUR.disarmScale * (damage / Math.max(1, maxHp)));
  if (roll >= p) return false;
  a.disarmed = true;
  return true;
}

/** The disarm chance itself, for the tests and the HUD. */
export function disarmChance(damage: number, maxHp: number): number {
  return Math.min(1, ARMOUR.disarmBase + ARMOUR.disarmScale * (damage / Math.max(1, maxHp)));
}

/** Plate states as the shader reads them: 0 intact, 1 cracked, 2 broken. */
export function stateCode(s: PlateState): 0 | 1 | 2 {
  return s === "intact" ? 0 : s === "cracked" ? 1 : 2;
}
