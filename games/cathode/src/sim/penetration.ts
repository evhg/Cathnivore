// Rounds through cover (docs/design/cathode-combat.md S1.1). A round passes through at most one layer (two
// for the sniper), and keeps a share of its damage that depends on what it went through. Pure: no three.js.

import type { WeaponClass } from "./types";

/** What a collider is made of, for impacts and penetration. */
export type CoverMat = "concrete" | "metal" | "metalSheet" | "glass" | "drywall" | "cloth" | "wood" | "flesh" | "water" | "chrome";
/** How a prop takes bullets: solid blocks movement and rounds; thin blocks rounds only; none blocks nothing. */
export type CoverKind = "solid" | "thin" | "none";

/** Share of damage kept after passing through, or null when a round never passes. */
export const PASS_THROUGH: Record<CoverMat, number | null> = {
  glass: 0.7,
  drywall: 0.6,
  cloth: 0.6,
  wood: 0.45,
  metalSheet: 0.35,
  metal: null,
  concrete: null,
  chrome: null,
  flesh: null,
  water: null,
};

/** How many layers a weapon class can punch through: the sniper two, everything else one, melee none. */
export function penetrationOf(cls: WeaponClass, bonus = 0): number {
  if (cls === "melee" || cls === "launcher") return 0;
  return (cls === "sniper" ? 2 : 1) + bonus;
}

/** Sheet metal needs real penetration (the sniper, or a +penetration mod); glass, cloth, drywall and wood don't. */
export function passes(mat: CoverMat, cls: WeaponClass, bonus = 0): boolean {
  if (penetrationOf(cls, bonus) <= 0) return false;
  if (PASS_THROUGH[mat] === null) return false;
  if (mat === "metalSheet") return cls === "sniper" || bonus >= 1;
  return true;
}

export interface PenetrationResult {
  /** The share of damage left after every layer passed (1 = untouched). */
  damageMul: number;
  /** Index of the layer that stopped the round, or -1 if it went through all of them. */
  stoppedAt: number;
  /** Layers it passed through. */
  passed: number;
}

/** Walks a round through the layers in its path, nearest first. */
export function penetrate(layers: CoverMat[], cls: WeaponClass, bonus = 0): PenetrationResult {
  let budget = penetrationOf(cls, bonus);
  let mul = 1;
  let passed = 0;
  for (let i = 0; i < layers.length; i++) {
    const m = layers[i]!;
    if (budget <= 0 || !passes(m, cls, bonus)) return { damageMul: mul, stoppedAt: i, passed };
    mul *= PASS_THROUGH[m]!;
    budget--;
    passed++;
  }
  return { damageMul: mul, stoppedAt: -1, passed };
}
