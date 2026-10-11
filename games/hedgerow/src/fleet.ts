// The Fleet (Hedgerow 2, docs/design/hedgerow-2.md section 1): Grabwell/Candor's traffic as a stack of parts.
// One point of damage knocks one layer off; a vehicle whose shell is gone pops into the next rung down (and
// any extra children spawn just behind it). Every layer knocked off pays one Mark and counts towards the
// tower's Knockouts. Fleet Value (FV) is every layer a vehicle carries, children included: it sets round
// budgets and what a leak costs.
//
// Only the rules data lives here; the engine (engine.ts hitEnemy) applies it on levels with rules "fleet".
// Type-only imports keep this module free of a cycle with engine.ts.

import type { EnemyKind, TowerKind } from "./engine";

// ---- properties and damage types (Hedgerow 2 section 2: hard locks you can read) ----

/** The nine properties a vehicle can carry. Each has a look, an icon and one obvious key. */
export type Property = "stealth" | "plated" | "wrapped" | "sealed" | "reefer" | "airborne" | "reinforced" | "rebrand" | "plant";
/** Every attack has exactly one damage type (section 1). Control (slow, stun, push, hold) is tracked apart. */
export type DamageType = "sharp" | "blast" | "sting" | "chill" | "gust" | "crush" | "writ";

/** Property bits: a vehicle's properties are one small integer (`Enemy.pm`), cheap to test in the hot loops. */
export const P: Record<Property, number> = {
  stealth: 1,
  plated: 2,
  wrapped: 4,
  sealed: 8,
  reefer: 16,
  airborne: 32,
  reinforced: 64,
  rebrand: 128,
  plant: 256,
};
/** Display order: the locks first, then what changes how a vehicle behaves. */
export const PROPERTY_ORDER: Property[] = ["stealth", "airborne", "plated", "wrapped", "sealed", "reefer", "reinforced", "rebrand", "plant"];
/** What passes from a vehicle to the rungs it pops into (section 2): Stealth and Rebrand. */
export const INHERITED = P.stealth | P.rebrand;

export function propMask(props: readonly Property[] | undefined): number {
  let m = 0;
  for (const p of props ?? []) m |= P[p];
  return m;
}
export function propsOf(pm: number): Property[] {
  return PROPERTY_ORDER.filter((p) => pm & P[p]);
}

export interface PropertyInfo {
  /** "Stealth", as a chip says it. */
  name: string;
  /** Before a rung's name: "Stealth Van", "Plated Box Lorry". */
  adj: string;
  /** Icon colour (both renderers and the chips). */
  colour: string;
  /** The icon's one-glyph mark. */
  glyph: string;
  /** What it does, for the Almanac and chips. */
  lock: string;
  /** Why it got through, for the leak report. */
  why: string;
  /** What answers it. */
  key: string;
}

export const PROPERTIES: Record<Property, PropertyInfo> = {
  stealth: {
    name: "Stealth",
    adj: "Stealth",
    colour: "#4f9a58",
    glyph: "S",
    lock: "Hedge-camo: no tower can target it unless something reveals it. Passes to what it pops into.",
    why: "Nothing could see it.",
    key: "A Radio Mast reveals stealth; a Scarecrow's Lantern Eyes or a Beehive's Scent see it for themselves. Cath can only show the towers the two vehicles she is holding.",
  },
  airborne: {
    name: "Airborne",
    adj: "Airborne",
    colour: "#e8edf2",
    glyph: "A",
    lock: "Flies over the hedges: only towers that hit the air can reach it.",
    why: "It flew over everything that only hits the ground.",
    key: "Scarecrows, Beehives, Windmills and Grain Silos hit the air, and so does a Seed Cannon with Air Burst.",
  },
  plated: {
    name: "Plated",
    adj: "Plated",
    colour: "#8a96a3",
    glyph: "P",
    lock: "Steel and rivets: immune to Sharp (beaks, thorns, millstones).",
    why: "Beaks and thorns bounced off the steel.",
    key: "Anything but Sharp gets through steel: a Beehive's stings, a Windmill's gust, a Seed Cannon's blast, a Hawk Post's talons, a Grain Silo.",
  },
  wrapped: {
    name: "Wrapped",
    adj: "Wrapped",
    colour: "#9fd3ff",
    glyph: "W",
    lock: "Glossy bubble wrap: it cushions explosions, so it's immune to Blast.",
    why: "The bubble wrap cushioned the blasts.",
    key: "Beaks, stings and gusts pop bubble wrap, and so does a Seed Cannon's Scatter Shot; shells and pumpkins don't.",
  },
  sealed: {
    name: "Sealed",
    adj: "Sealed",
    colour: "#8d5bc2",
    glyph: "M",
    lock: "A purple mesh grille: immune to Sting (bees and poison).",
    why: "The mesh grille kept the bees out.",
    key: "Scarecrows, gusts and blasts get through the mesh; bees can't.",
  },
  reefer: {
    name: "Reefer",
    adj: "Reefer",
    colour: "#6fd0f0",
    glyph: "F",
    lock: "A frost box: immune to Chill and to every slow, stun, push and hold (only a Courthouse writ holds it).",
    why: "The frost box shrugged off the cold and every slow.",
    key: "Hit it, don't slow it: Scarecrows, Beehives and blasts all work on a reefer.",
  },
  reinforced: {
    name: "Reinforced",
    adj: "Reinforced",
    colour: "#f2c230",
    glyph: "R",
    lock: "Hazard bands: its shell takes twice the hits. Not immune to anything.",
    why: "Reinforced shells took twice the hits.",
    key: "More damage where it bunches up: upgrade, and splash it.",
  },
  rebrand: {
    name: "Rebrand",
    adj: "Rebranded",
    colour: "#e0508a",
    glyph: "B",
    lock: "A spinning logo: every 3 s it gets back one rung, up to what it started as. Passes to what it pops into.",
    why: "It rebranded faster than it was popped.",
    key: "Pop it fast and all at once: piercing and splash finish it before it regrows.",
  },
  plant: {
    name: "Heavy Plant",
    adj: "Heavy",
    colour: "#c99a2e",
    glyph: "H",
    lock: "Heavy plant: no push, knockback or hold, and slows work half as well.",
    why: "Heavy plant ploughed on through the slows.",
    key: "Stack damage on it: upgrade along the last stretch and save a pie.",
  },
};

/** What each damage type can't touch (section 2's matrix): Sharp bounces off Plated, and so on. */
export const IMMUNE: Record<DamageType, number> = {
  sharp: P.plated,
  blast: P.wrapped,
  sting: P.sealed,
  chill: P.reefer,
  gust: 0,
  crush: 0,
  writ: 0,
};
/** Can an attack of this type hurt a vehicle with these properties? (null: untyped, like Cath's pie.) */
export function canHurt(type: DamageType | null, pm: number): boolean {
  return type === null || (IMMUNE[type] & pm) === 0;
}
/** Can a slow, a stun, a push or a hold work on it? A Reefer shrugs off all of them (a Writ hold excepted); Heavy Plant can't be pushed or held. */
export function canControl(pm: number, kind: "slow" | "stun" | "push" | "hold", writ = false): boolean {
  if (pm & P.reefer && !(writ && kind === "hold")) return false;
  if (pm & P.plant && (kind === "push" || kind === "hold")) return writ;
  return true;
}

export const DAMAGE_NAMES: Record<DamageType, string> = {
  sharp: "Sharp",
  blast: "Blast",
  sting: "Sting",
  chill: "Chill",
  gust: "Gust",
  crush: "Crush",
  writ: "Writ",
};

/**
 * Each tower's damage type on today's tiers (section 1; paths arrive in M4): Scarecrows peck (Sharp) and a
 * Pumpkin Lobber lobs pumpkins (Blast); Seed Cannons blast, and Scatter Shot splits into Sharp seeds; Windmills
 * gust, and Mill Stones grind (Sharp); Duck Ponds chill, and Goose Patrol pecks; a Silo crushes; the
 * Courthouse serves writs. Towers that don't hit (Stall, Mast, Tent, Hall) have none.
 */
export function damageTypeOf(kind: TowerKind, spec: 0 | 1 | null | undefined): DamageType | null {
  switch (kind) {
    case "scarecrow":
      return spec === 0 ? "blast" : "sharp";
    case "hedgerow":
    case "barn":
      return "sharp";
    case "beehive":
      return "sting";
    case "cannon":
      return spec === 1 ? "sharp" : "blast";
    case "windmill":
      return spec === 1 ? "sharp" : "gust";
    case "pond":
      return spec === 0 ? "sharp" : "chill";
    case "silo":
      return "crush";
    case "court":
      return "writ";
    default:
      return null;
  }
}

/** Cath's rolling pin swings as the Baker kit's scones do (section 6): Blast. Her pie is untyped. */
export const CATH_DAMAGE: DamageType = "blast";
/** Rebrand: seconds between regaining a rung. */
export const REBRAND_SECS = 3;

/** The rung above `kind` on the way back up to `top` (Rebrand), or null if it is already there. */
export function rungAbove(top: EnemyKind, kind: EnemyKind): EnemyKind | null {
  let k: EnemyKind | undefined = top;
  let prev: EnemyKind | null = null;
  for (let guard = 0; k && guard < 20; guard++) {
    if (k === kind) return prev;
    prev = k;
    k = RUNGS[k]?.children[0];
  }
  return null;
}

export interface RungSpec {
  /** Hit points of the outer shell: each one is a layer worth a Mark. */
  shell: number;
  /** What it pops into, in order: the first takes its place, the rest spawn just behind. */
  children: EnemyKind[];
  /** Properties every one of this rung carries (an Artic is always Wrapped and Reefer). */
  props?: Property[];
  /** Properties each child gets on top of its own, by place in `children` (an Artic's Wrapped and Reefer lorries). */
  childProps?: Property[][];
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
  // Hedgerow 2 M3: the heavier rungs for Book rounds 26-45 (Plated Lorry, Artic, Car Transporter).
  steel: { shell: 1, children: ["lorry", "lorry"], props: ["plated"], speed: 1.0, colour: "#7d8894", look: "A riveted steel lorry. Beaks and thorns bounce off: it takes a blast, a sting or a gust. Two box lorries inside." },
  artic: {
    shell: 1,
    children: ["lorry", "lorry"],
    props: ["wrapped", "reefer"],
    childProps: [["wrapped"], ["reefer"]],
    speed: 1.6,
    colour: "#dfe9f2",
    look: "An articulated lorry: bubble-wrapped cab, frost-box trailer. Shells and frost do nothing. A wrapped lorry and a reefer lorry inside.",
  },
  transporter: { shell: 1, children: ["artic", "artic"], speed: 2.0, colour: "#b23a3a", look: "A double-deck car transporter, quick and long. Two artics on board." },
  // Heavy Plants (M5): long shells, no push or hold, and a fleet under the lid.
  skip: { shell: 10, children: ["pickup", "pickup", "pickup"], props: ["plant"], speed: 1.0, colour: "#e0a82e", look: "A yellow skip lorry: ten layers of plate, no push or hold, and three pickups under the lid." },
  plantdozer: { shell: 120, children: ["steel", "steel", "steel", "steel"], props: ["plant"], speed: 0.6, colour: "#f2c230", look: "A Bulldozer: 120 layers of yellow plate, no push or hold, and four plated lorries under the blade. First seen in round 36." },
  crane: { shell: 240, children: ["skip", "skip", "skip"], props: ["plant"], speed: 0.55, colour: "#d9a21b", look: "A mobile Crane: 240 layers of lattice and plate, and three Skips swinging from the hook. First seen in round 54." },
  execcar: { shell: 80, children: ["transporter", "transporter"], props: ["plant"], speed: 2.4, colour: "#15171c", look: "An Exec Car: a black limousine, quick as a Same-Day van with 80 layers of armour, and a pair of transporters in its wake. First seen in round 62." },
  borer: { shell: 400, children: ["plantdozer", "plantdozer"], props: ["plant"], speed: 0.5, colour: "#7a828c", look: "A Tunnel Borer: a rotating cutter head and 400 layers of segment ring, with two Bulldozers behind it. First seen in round 78." },
  // Act 1-3 bosses as long shells with their children (Hedgerow 2 section 1: the boss stays, its health is layers).
  boss: { shell: 300, children: ["lorry", "lorry", "lorry"], speed: 0.55, colour: "#1c1d22", look: "The Acquisition Van: a long shell, then three box lorries out of the back." },
  convoy: { shell: 600, children: ["steel", "steel"], props: ["plant"], speed: 0.5, colour: "#c43b2f", look: "Mr Crisp's Price-War Convoy: a long shell of discount signage, then two plated lorries." },
  blimp: { shell: 900, children: ["quad", "quad", "quad", "quad", "quad", "quad"], props: ["plant"], speed: 0.45, colour: "#e0508a", look: "The Brand Ambassador Blimp: it flies, it charms, and six quadcopters ride under it." },
  // Disruptors (section 1): low Fleet Value, themed rounds only. An influencer's car charms towers near it.
  influencer: { shell: 2, children: ["courier"], speed: 1.0, colour: "#f29bc4", look: "A lifestyle influencer in a pink hatchback. Towers nearby stop to watch. A courier scoots out when it pops." },
};

const fvCache = new Map<string, number>();

/**
 * Fleet Value: every layer a vehicle carries, its children's included. `pm` is the vehicle's property mask
 * (Reinforced doubles its own shell; children carry only what passes down, so their value is their own).
 */
export function fvOf(kind: EnemyKind, pm = 0): number {
  const key = `${kind}:${pm & P.reinforced}`;
  const hit = fvCache.get(key);
  if (hit !== undefined) return hit;
  const r = RUNGS[kind];
  const v = r ? r.shell * (pm & P.reinforced ? 2 : 1) + r.children.reduce((a, c) => a + fvOf(c), 0) : 1;
  fvCache.set(key, v);
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
  /** Hits the air even where today's tower is ground-only (the Grain Silo, section 2). */
  air?: boolean;
  /** Marks after every round (the Market Stall: +80 at tier 1, section 3). */
  income?: [number, number, number];
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
  silo: { cost: 550, damage: [5, 8, 12], pierce: [1, 1, 2], air: true, spec: [{ damage: 25, pierce: 2 }, { damage: 12, pierce: 8 }] },
  stall: { cost: 800, damage: [0, 0, 0], pierce: [1, 1, 1], income: [80, 150, 260], spec: [{}, {}] },
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

/**
 * Crack stages (Hedgerow 2 M5): a Heavy Plant's shell shows its wear as it goes. 0 is fresh; 1 (under 75% of the
 * shell left) scuffs it, 2 (under 50%) cracks it and 3 (under 25%) leaves it smoking. Anything with a short
 * shell has none.
 */
export function crackStage(kind: string, hp: number, maxHp: number): 0 | 1 | 2 | 3 {
  if ((RUNGS[kind as keyof typeof RUNGS]?.shell ?? 0) < 10 || maxHp <= 0) return 0;
  const f = hp / maxHp;
  return f < 0.25 ? 3 : f < 0.5 ? 2 : f < 0.75 ? 1 : 0;
}
