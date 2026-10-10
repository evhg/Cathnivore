// The Fleet (Hedgerow 2, docs/design/hedgerow-2.md section 1): Grabwell/Candor's traffic as a stack of parts.
// One point of damage knocks one layer off; a vehicle whose shell is gone pops into the next rung down (and
// any extra children spawn just behind it). Every layer knocked off pays one Mark and counts towards the
// tower's Knockouts. Fleet Value (FV) is every layer a vehicle carries, children included: it sets round
// budgets and what a leak costs.
//
// Only the rules data lives here; the engine (engine.ts hitEnemy) applies it on levels with rules "fleet".
// Type-only imports keep this module free of a cycle with engine.ts.

import type { EnemyKind, TowerKind } from "./engine";

export interface RungSpec {
  /** Hit points of the outer shell: each one is a layer worth a Mark. */
  shell: number;
  /** What it pops into, in order: the first takes its place, the rest spawn just behind. */
  children: EnemyKind[];
  /** Cells per second. */
  speed: number;
  /** Paint for the pop burst of particles (the colour of this rung's body). */
  colour: string;
  /** A one-line look for the Almanac and the new-unit card. */
  look: string;
}

/** The rungs, Courier to Box Lorry, plus the Airborne ones, and act 1's boss as a phased shell. */
export const RUNGS: Partial<Record<EnemyKind, RungSpec>> = {
  courier: { shell: 1, children: [], speed: 0.9, colour: "#5ec0a8", look: "An e-scooter courier with a parcel box. One tap and it's gone." },
  hatchback: { shell: 1, children: ["courier"], speed: 1.2, colour: "#e8b23a", look: "A little yellow hatchback. Pop it and a courier scoots out." },
  van: { shell: 1, children: ["hatchback"], speed: 1.5, colour: "#f4f6f8", look: "The white delivery van. Pop it and a hatchback carries on." },
  pickup: { shell: 1, children: ["van"], speed: 2.3, colour: "#4a7fc4", look: "An open pickup, quick on the straights. Under it, a van." },
  sprinter: { shell: 1, children: ["pickup"], speed: 2.6, colour: "#8a4fd0", look: 'A violet "Same-Day" rush van, the fastest thing on the lane. Under it, a pickup.' },
  lorry: { shell: 1, children: ["sprinter", "sprinter"], speed: 1.6, colour: "#24345e", look: "A navy box lorry. Pop the box and two Same-Day vans burst out." },
  drone: { shell: 1, children: [], speed: 1.8, colour: "#cfd6de", look: "A delivery drone. It flies: only towers that hit the air can reach it." },
  quad: { shell: 1, children: ["drone", "drone"], speed: 1.6, colour: "#f08a3c", look: "A cargo quadcopter. Pop it and two drones peel off." },
  boss: { shell: 300, children: ["lorry", "lorry", "lorry"], speed: 0.55, colour: "#1c1d22", look: "The Acquisition Van: a long shell, then three box lorries out of the back." },
};

const fvCache = new Map<EnemyKind, number>();

/** Fleet Value: every layer a vehicle carries, its children's included. */
export function fvOf(kind: EnemyKind): number {
  const hit = fvCache.get(kind);
  if (hit !== undefined) return hit;
  const r = RUNGS[kind];
  const v = r ? r.shell + r.children.reduce((a, c) => a + fvOf(c), 0) : 1;
  fvCache.set(kind, v);
  return v;
}

/** Whether a kind is a fleet rung (drawn instanced, priced in layers). */
export function isRung(kind: EnemyKind): boolean {
  return RUNGS[kind] !== undefined;
}

/** The rung a vehicle becomes when its shell is popped (null for the last one). */
export function nextRung(kind: EnemyKind): EnemyKind | null {
  return RUNGS[kind]?.children[0] ?? null;
}

/** At most this many vehicles on the lane at once; children over it wait at their parent (section 8). */
export const LIVE_CAP = 350;
/** How far behind its parent each extra child spawns, in cells. */
export const CHILD_GAP = 0.06;
/** How far a piercing shot carries past its target to find the next vehicle, in cells. */
export const PIERCE_REACH = 0.75;
/** Goodwill on a fleet level (Normal). A leak costs whatever Fleet Value got through. */
export const FLEET_GOODWILL = 120;
/** Marks for every round cleared: 60 + the Book's round number. */
export function roundBonus(round: number): number {
  return 60 + round;
}
/** Marks for stacking a round on top of the one still out: 10 + the stacked round's number. */
export function stackBonus(round: number): number {
  return 10 + round;
}
/** Pop income in thousandths of a Mark per layer: full to round 50, then falling off (section 4). */
export function popRate(round: number): number {
  return round <= 50 ? 1000 : round <= 60 ? 500 : round <= 75 ? 200 : 100;
}

/** Cath on fleet levels: two layers a swing (she holds the line; the towers do the popping). */
export const FLEET_HERO_DAMAGE = 2;
/** Layers her pie knocks off everything it lands on (section 6). */
export const FLEET_PIE_DAMAGE = 3;

export interface FleetSpecStats {
  damage?: number;
  pierce?: number;
  cooldown?: number;
  thorns?: number;
  poison?: number;
}

/**
 * How each tower fights the Fleet: its price, and per tier the layers a hit knocks off, how many vehicles one
 * shot can hit (pierce) and, where it differs from today's, the seconds between shots. Range, splash, slows
 * and gusts are today's (engine.ts TOWERS). Upgrade and specialisation prices scale with the base price.
 */
export interface FleetTower {
  cost: number;
  damage: [number, number, number];
  pierce: [number, number, number];
  cooldown?: [number, number, number];
  /** Thorns (Blackthorn) and poison (Killer Queen) in layers a second. */
  spec: [FleetSpecStats, FleetSpecStats];
}

export const FLEET_TOWERS: Record<TowerKind, FleetTower> = {
  scarecrow: {
    cost: 200,
    damage: [1, 1, 2],
    pierce: [2, 4, 4],
    cooldown: [0.85, 0.65, 0.55],
    spec: [{ damage: 2, pierce: 10 }, { damage: 1, pierce: 4 }],
  },
  hedgerow: { cost: 100, damage: [0, 0, 0], pierce: [1, 1, 1], spec: [{ thorns: 1.2 }, {}] },
  beehive: {
    cost: 300,
    damage: [1, 1, 2],
    pierce: [6, 8, 10],
    cooldown: [0.95, 0.8, 0.7],
    spec: [{ damage: 2, pierce: 8, poison: 1 }, { damage: 1, pierce: 12 }],
  },
  windmill: { cost: 350, damage: [1, 2, 2], pierce: [10, 12, 16], spec: [{ damage: 2, pierce: 14 }, { damage: 3, pierce: 12 }] },
  cannon: { cost: 500, damage: [1, 2, 3], pierce: [18, 20, 24], spec: [{ damage: 6, pierce: 30 }, { damage: 2, pierce: 14 }] },
  pond: { cost: 400, damage: [1, 1, 2], pierce: [4, 6, 8], spec: [{ damage: 2, pierce: 8 }, {}] },
  barn: { cost: 450, damage: [1, 1, 2], pierce: [2, 3, 3], spec: [{ damage: 3, pierce: 4 }, {}] },
  silo: { cost: 550, damage: [5, 8, 12], pierce: [1, 1, 2], spec: [{ damage: 25, pierce: 2 }, { damage: 12, pierce: 8 }] },
  stall: { cost: 800, damage: [0, 0, 0], pierce: [1, 1, 1], spec: [{}, {}] },
  mast: { cost: 400, damage: [0, 0, 0], pierce: [1, 1, 1], spec: [{}, {}] },
  tent: { cost: 450, damage: [0, 0, 0], pierce: [1, 1, 1], spec: [{}, {}] },
  court: { cost: 750, damage: [0, 0, 0], pierce: [1, 1, 1], spec: [{}, {}] },
  hall: { cost: 900, damage: [0, 0, 0], pierce: [1, 1, 1], spec: [{}, {}] },
};

/**
 * Fleet upgrade prices as multiples of the tower's base (section 3's goal gradient: each step costs more
 * than the last, so a tier 3 is something you save for): tier 2 at 1x, tier 3 at 2.5x and a tier 4
 * specialisation at 5x, rounded to 5.
 */
export const FLEET_TIER_PRICE: [number, number] = [1, 2.5];
export const FLEET_SPEC_PRICE = 5;
export function fleetUpgradePrice(kind: TowerKind, tier: 1 | 2): number {
  return Math.round((FLEET_TOWERS[kind].cost * FLEET_TIER_PRICE[tier - 1]!) / 5) * 5;
}
export function fleetSpecPrice(kind: TowerKind): number {
  return Math.round((FLEET_TOWERS[kind].cost * FLEET_SPEC_PRICE) / 5) * 5;
}
