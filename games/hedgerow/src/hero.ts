import type { Perks } from "./engine";

// Cath levels up inside a run (Hedgerow 2 M6): every layer the field pops feeds her, so she grows with the
// round book instead of standing still. Pure maths; the engine applies the result to the Hero. Classic
// levels never call it, so acts 4 to 10 play as before.

export const HERO_MAX_LEVEL = 20;
/** Gain per level on top of the level-1 body, before the save's attributes. */
export const HERO_LEVEL_GAIN = { damage: 0.05, hp: 0.05 };

/** Popped layers needed to reach `level` (level 1 is free). */
export function xpFor(level: number): number {
  const n = Math.max(0, Math.min(HERO_MAX_LEVEL, Math.floor(level)) - 1);
  return Math.round(92 * Math.pow(n, 2.2));
}

/** Her level for a count of popped layers. */
export function levelFor(popped: number): number {
  let lv = 1;
  while (lv < HERO_MAX_LEVEL && popped >= xpFor(lv + 1)) lv++;
  return lv;
}

/** Multiplier on her base damage and health at a level. */
export function levelScale(level: number): { damage: number; hp: number } {
  const n = Math.max(0, level - 1);
  return { damage: 1 + HERO_LEVEL_GAIN.damage * n, hp: 1 + HERO_LEVEL_GAIN.hp * n };
}

/** Cath's kit (Hedgerow 2 M6): a play style picked from her sheet, folded into the run's perks. */
export type KitId = "baker" | "organiser" | "warden";
export interface Kit {
  id: KitId;
  name: string;
  blurb: string;
  apply: (p: Perks) => void;
}
export const KITS: Kit[] = [
  {
    id: "baker",
    name: "Baker",
    blurb: "Pies come 15% sooner and hit 15% harder.",
    apply: (p) => ((p.pieCooldown *= 0.85), (p.pieDamage *= 1.15)),
  },
  {
    id: "organiser",
    name: "Organiser",
    blurb: "Neighbours hold 25% longer, rallies last 20% longer and calling a round early pays 15% more.",
    apply: (p) => ((p.neighbours *= 1.25), (p.rally *= 1.2), (p.earlyBonus *= 1.15)),
  },
  {
    id: "warden",
    name: "Warden",
    blurb: "Cath has 20% more health and takes 10% less damage while holding the lane.",
    apply: (p) => ((p.heroHp *= 1.2), (p.holdGuard *= 0.9)),
  },
];

export function kitOf(id: string | undefined): Kit | null {
  return KITS.find((k) => k.id === id) ?? null;
}
