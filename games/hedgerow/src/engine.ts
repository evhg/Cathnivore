// Hedgerow's engine: a pure, deterministic tower-defence simulation with no DOM. The world advances in
// fixed steps of STEP seconds (30 Hz), so the same build orders always give the same result, in tests, in
// the level bot and in the browser. Distances are in grid cells; the lane is a polyline through cell
// centres. Towers are hitscan: a shot lands the moment it fires, and the renderer draws the flight from the
// `events` list.

export const STEP = 1 / 30;

import { CHILD_GAP, FLEET_HERO_DAMAGE, FLEET_PIE_DAMAGE, FLEET_TOWERS, LIVE_CAP, PIERCE_REACH, RUNGS, fleetSpecPrice, fleetUpgradePrice, fvOf, popRate, roundBonus, stackBonus } from "./fleet";

export type TowerKind =
  | "hedgerow"
  | "scarecrow"
  | "beehive"
  | "stall"
  | "pond"
  | "barn"
  | "silo"
  | "mast"
  | "tent"
  | "court"
  | "hall"
  | "windmill"
  | "cannon";
export type EnemyKind =
  | "van"
  | "drone"
  | "boss"
  | "truck"
  | "convoy"
  | "influencer"
  | "blimp"
  | "bulldozer"
  | "megadozer"
  | "phantom"
  | "clinic"
  | "tender"
  | "ship"
  | "lawyer"
  | "lobbyist"
  | "carrier"
  | "rival"
  | "swarm"
  | "bus"
  | "board"
  | "director"
  | "hollowcandor"
  | "candor"
  | "remnant"
  | "wrapped"
  // The Fleet's rungs (Hedgerow 2, fleet.ts). "van" and "drone" double as the Van and Drone rungs.
  | "courier"
  | "hatchback"
  | "pickup"
  | "sprinter"
  | "lorry"
  | "quad";

export interface TowerSpec {
  name: string;
  blurb: string;
  cost: number;
  /** Upgrade cost to reach tier 2 and tier 3. */
  upgrades: [number, number];
  range: [number, number, number];
  /** Damage per shot (0 for the hedgerow). */
  damage: [number, number, number];
  /** Seconds between shots. */
  cooldown: [number, number, number];
  /** Enemies within this many cells of the target also take the damage (0 = single target). */
  splash?: number;
  /** Speed multiplier applied to enemies in range (1 = none). */
  slow: [number, number, number];
  /** Damage multiplier given to other towers in range (the Market Stall). */
  buff?: [number, number, number];
  /** Marks earned at the end of every wave. */
  income?: [number, number, number];
  /** Shots ignore armour (the Grain Silo). Was `pierce` before Hedgerow 2 gave pierce a number. */
  ignoresArmour?: boolean;
  /** Can't reach flying enemies (drones, the Blimp). */
  groundOnly?: boolean;
  /** Reveals stealth units in range and marks everything in range: they take this much extra damage (the Radio Mast). */
  reveal?: [number, number, number];
  /** Towers within this range of the tent ignore influencer charm (the Clinic Tent). */
  cleanse?: boolean;
  /** Seconds it freezes a boss in range each time it fires (the Courthouse's Injunction). */
  injunction?: [number, number, number];
  /** Damage multiplier on every tower on the map, wherever it stands (the Union Hall). */
  aura?: [number, number, number];
  /** A gust every `every` seconds: everything in range is shoved `push` cells back and takes `damage` (the Windmill). */
  gust?: { push: [number, number, number]; every: [number, number, number] };
}

export const TOWERS: Record<TowerKind, TowerSpec> = {
  hedgerow: {
    name: "Hedgerow",
    groundOnly: true,
    blurb: "Thick, thorny and cheap. Slows everything that passes.",
    cost: 50,
    upgrades: [45, 75],
    range: [1.3, 1.5, 1.7],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [0.62, 0.5, 0.4],
  },
  scarecrow: {
    name: "Scarecrow",
    blurb: "Throws turnips at the front of the queue. Scarecrows spook each other: each one right next door makes it throw 20% slower.",
    cost: 80,
    upgrades: [80, 125],
    range: [2.4, 2.7, 3.1],
    damage: [7, 11.5, 17.5],
    cooldown: [0.8, 0.68, 0.55],
    slow: [1, 1, 1],
  },
  beehive: {
    name: "Beehive",
    blurb: "A swarm that stings everything near its target.",
    cost: 120,
    upgrades: [90, 140],
    range: [2.0, 2.2, 2.5],
    damage: [6, 10, 15],
    cooldown: [1.1, 1, 0.9],
    slow: [1, 1, 1],
    splash: 1.1,
  },
  stall: {
    name: "Market Stall",
    blurb: "Earns Marks after every wave and cheers on the towers beside it.",
    cost: 100,
    upgrades: [80, 120],
    range: [1.6, 1.9, 2.2],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    buff: [1.2, 1.3, 1.45],
    income: [8, 13, 20],
  },
  pond: {
    name: "Duck Pond",
    groundOnly: true,
    blurb: "Slows every vehicle nearby, and the ducks splash whatever is left.",
    cost: 110,
    upgrades: [85, 130],
    range: [1.8, 2.0, 2.2],
    damage: [4, 7, 11],
    cooldown: [1, 0.9, 0.8],
    slow: [0.75, 0.66, 0.56],
    splash: 0.9,
  },
  barn: {
    name: "Co-op Barn",
    groundOnly: true,
    blurb:
      "Farmhands spill out and block the lane: a hard slow, and a few solid whacks.",
    cost: 100,
    upgrades: [80, 120],
    range: [1.4, 1.6, 1.8],
    damage: [4, 7, 11],
    cooldown: [0.9, 0.8, 0.7],
    slow: [0.5, 0.4, 0.32],
  },
  silo: {
    name: "Grain Silo",
    groundOnly: true,
    blurb: "A slow, heavy grain-shot that ignores armour. Bulldozers hate it.",
    cost: 150,
    upgrades: [110, 170],
    range: [2.6, 2.9, 3.2],
    damage: [40, 66, 100],
    cooldown: [2.2, 2, 1.8],
    slow: [1, 1, 1],
    ignoresArmour: true,
  },
  mast: {
    name: "Radio Mast",
    blurb:
      "Sol's mast. Shows up stealth units in range and marks everything there for extra damage.",
    cost: 90,
    upgrades: [70, 110],
    range: [2.2, 2.5, 2.8],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    reveal: [1.2, 1.3, 1.45],
  },
  tent: {
    name: "Clinic Tent",
    blurb:
      "Ines's tent. Towers beside it shake off charm and fire faster, thanks to a great deal of tea.",
    cost: 110,
    upgrades: [80, 120],
    range: [1.8, 2.1, 2.4],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    buff: [1.15, 1.25, 1.35],
    cleanse: true,
  },
  court: {
    name: "Courthouse",
    blurb:
      "Mara's courthouse. Serves an Injunction on any boss in range: it stops dead until the paperwork clears.",
    cost: 180,
    upgrades: [120, 180],
    range: [2.2, 2.5, 2.8],
    damage: [0, 0, 0],
    cooldown: [9, 8, 7],
    slow: [1, 1, 1],
    injunction: [2.5, 3.5, 4.5],
  },
  hall: {
    name: "Farmers' Union Hall",
    blurb:
      "Tomas's hall. Every tower on the map hits harder, and Market Day pays out after each wave.",
    cost: 220,
    upgrades: [150, 220],
    range: [0, 0, 0],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    aura: [1.1, 1.17, 1.25],
    income: [12, 20, 30],
  },
  windmill: {
    name: "Windmill",
    blurb:
      "Bea's old mill. Every few seconds its sails throw a gust down the lane: everything nearby is blown back and battered.",
    cost: 130,
    upgrades: [95, 140],
    range: [1.7, 1.9, 2.1],
    damage: [6, 10, 16],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    gust: { push: [0.55, 0.7, 0.85], every: [3.2, 2.9, 2.6] },
  },
  cannon: {
    name: "Seed Cannon",
    groundOnly: true,
    blurb: "Pip's contraption. Lobs a sack of seed potatoes a very long way, and it bursts over everything below.",
    cost: 190,
    upgrades: [130, 190],
    range: [3.3, 3.7, 4.1],
    damage: [26, 42, 64],
    cooldown: [2.4, 2.2, 2.0],
    slow: [1, 1, 1],
    splash: 1.25,
  },
};

export interface EnemySpec {
  name: string;
  hp: number;
  /** Cells per second. */
  speed: number;
  bounty: number;
  /** Goodwill lost when it reaches the farmhouse. */
  leak: number;
  /** What it breaks into when destroyed. */
  splits?: { kind: EnemyKind; count: number };
  /** Towers within this many cells of it are charmed and stop shooting. */
  charm?: number;
  /** Fraction of non-piercing damage it shrugs off. */
  armor?: number;
  /** Towers cannot target it unless a Radio Mast has it in range. */
  stealth?: boolean;
  /** Other enemies within 1.6 cells regain this many hit points a second. */
  heal?: number;
  /** Towers within this many cells of it fire at half rate (paperwork). */
  jam?: number;
  /** Towers within this many cells of it forget their specialisation and fight as plain tier 3 (megastructures are immune). */
  lobby?: number;
  /** Rams Cath for this many hit points a second while within 1.1 cells of her, held or not. */
  ram?: number;
  /** Launches this many of a kind every `every` seconds while it is on the lane. */
  launch?: { kind: EnemyKind; count: number; every: number };
  /** Flies over the lane: Cath cannot hold it. */
  flying?: boolean;
  /** Heavy plant: slows and honey only half work on it, and gusts and knockback can't move it. Every boss is heavy. */
  heavy?: boolean;
  /** Bubble wrap: single-target shots do only WRAP_LEAK of their damage until something area-wide (splash,
   * a piercing shot, a gust, a pie) pops it. Thorns, poison and Cath hit it in full. */
  shield?: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  van: { name: "Delivery van", hp: 98, speed: 0.9, bounty: 7, leak: 1 },
  // The Fleet's rungs. On fleet levels their shells, children and speeds come from fleet.ts RUNGS; these
  // health pools only apply if one ever turns up on a classic field (act 1's Endless).
  courier: { name: "Scooter courier", hp: 40, speed: 0.9, bounty: 3, leak: 1 },
  hatchback: { name: "Hatchback", hp: 60, speed: 1.2, bounty: 5, leak: 1 },
  pickup: { name: "Pickup", hp: 110, speed: 1.4, bounty: 8, leak: 1 },
  sprinter: { name: "Same-Day van", hp: 80, speed: 1.6, bounty: 8, leak: 1 },
  lorry: { name: "Box lorry", hp: 170, speed: 0.9, bounty: 12, leak: 2 },
  quad: { name: "Cargo quadcopter", hp: 60, speed: 1.5, bounty: 6, leak: 1, flying: true },
  wrapped: { name: "Bubble-wrapped van", hp: 90, speed: 0.85, bounty: 9, leak: 1, shield: 1 },
  boss: {
    name: "The Acquisition Van",
    hp: 1800,
    speed: 0.55,
    bounty: 120,
    leak: 5,
  },
  drone: {
    name: "Delivery drone",
    hp: 35,
    speed: 1.8,
    bounty: 5,
    leak: 1,
    flying: true,
  },
  truck: {
    name: "0.99 price-war truck",
    heavy: true,
    hp: 150,
    speed: 0.8,
    bounty: 8,
    leak: 2,
    splits: { kind: "drone", count: 2 },
  },
  convoy: {
    name: "Mr Crisp's Price-War Convoy",
    hp: 2700,
    speed: 0.5,
    bounty: 160,
    leak: 6,
    splits: { kind: "truck", count: 3 },
  },
  influencer: {
    name: "Lifestyle influencer",
    hp: 70,
    speed: 1.0,
    bounty: 8,
    leak: 1,
    charm: 1.2,
  },
  blimp: {
    name: "The Brand Ambassador Blimp",
    hp: 3300,
    speed: 0.45,
    bounty: 200,
    leak: 7,
    charm: 1.8,
    flying: true,
  },
  bulldozer: {
    name: "Site-clearance bulldozer",
    heavy: true,
    hp: 260,
    speed: 0.7,
    bounty: 11,
    leak: 3,
    armor: 0.5,
  },
  megadozer: {
    name: "The Mega-Dozer",
    hp: 4200,
    speed: 0.42,
    bounty: 240,
    leak: 8,
    armor: 0.5,
    splits: { kind: "bulldozer", count: 2 },
  },
  phantom: {
    name: "Unbranded courier",
    hp: 90,
    speed: 1.2,
    bounty: 10,
    leak: 1,
    stealth: true,
  },
  tender: {
    name: "Fast tender",
    heavy: true,
    hp: 190,
    speed: 1.1,
    bounty: 10,
    leak: 2,
    armor: 0.3,
  },
  ship: {
    name: "The Container Ship",
    hp: 5600,
    speed: 0.4,
    bounty: 320,
    leak: 10,
    armor: 0.35,
    splits: { kind: "tender", count: 4 },
  },
  lobbyist: {
    name: "Lobbyist",
    heavy: true,
    hp: 420,
    speed: 0.75,
    bounty: 14,
    leak: 2,
    lobby: 1.6,
  },
  carrier: {
    name: "Drone carrier",
    hp: 360,
    speed: 0.6,
    bounty: 16,
    leak: 3,
    flying: true,
    launch: { kind: "drone", count: 2, every: 5 },
  },
  rival: {
    name: "Pell on a quad bike",
    hp: 1100,
    speed: 1.25,
    bounty: 48,
    leak: 5,
    ram: 12,
  },
  lawyer: {
    name: "Corporate lawyer",
    hp: 170,
    speed: 0.95,
    bounty: 10,
    leak: 2,
    jam: 1.3,
  },
  swarm: {
    name: "The Lawyer Swarm",
    hp: 6000,
    speed: 0.45,
    bounty: 360,
    leak: 10,
    jam: 2,
    splits: { kind: "lawyer", count: 5 },
  },
  bus: {
    name: "Pell's Campaign Bus",
    hp: 7200,
    speed: 0.5,
    bounty: 400,
    leak: 10,
    armor: 0.2,
    splits: { kind: "influencer", count: 6 },
  },
  director: {
    name: "Company director",
    heavy: true,
    hp: 1500,
    speed: 0.7,
    bounty: 32,
    leak: 3,
    armor: 0.25,
  },
  board: {
    name: "The Board of Directors",
    hp: 8000,
    speed: 0.5,
    bounty: 440,
    leak: 10,
    armor: 0.2,
    splits: { kind: "director", count: 5 },
  },
  hollowcandor: {
    name: "HollowCandor",
    hp: 7000,
    speed: 0.45,
    bounty: 320,
    leak: 10,
    armor: 0.25,
    jam: 1.5,
    splits: { kind: "candor", count: 2 },
  },
  candor: {
    name: "Candor, unmerged",
    hp: 4500,
    speed: 0.6,
    bounty: 240,
    leak: 6,
    armor: 0.15,
    heal: 20,
    splits: { kind: "remnant", count: 3 },
  },
  remnant: {
    name: "Hollow remnant",
    hp: 1400,
    speed: 0.9,
    bounty: 48,
    leak: 3,
    stealth: true,
  },
  clinic: {
    name: "Vane's Clinic-in-a-Box",
    hp: 4800,
    speed: 0.42,
    bounty: 280,
    leak: 9,
    heal: 14,
    splits: { kind: "phantom", count: 3 },
  },
};

// ---- tier 4: every tower branches into one of two specialisations ----

export interface Specialisation {
  name: string;
  blurb: string;
  cost: number;
  range?: number;
  damage?: number;
  cooldown?: number;
  slow?: number;
  splash?: number;
  buff?: number;
  income?: number;
  reveal?: number;
  injunction?: number;
  aura?: number;
  /** Damage a second to everything in range, armour applies (Blackthorn). */
  thorns?: number;
  /** Every `every`-th shot lands for `mult` times the damage. */
  crit?: { every: number; mult: number };
  /** Everything hit keeps taking `dps` for `secs`. */
  poison?: { dps: number; secs: number };
  /** Everything hit is slowed to `factor` for `secs`. */
  sticky?: { factor: number; secs: number };
  /** Ordinary enemies hit are shoved this many cells back up the lane. */
  knockback?: number;
  /** The Injunction stops ordinary enemies too, not just bosses. */
  classAction?: boolean;
  /** Each one cuts the pie's cooldown by this fraction (down to 40%). */
  pieHaste?: number;
  /** Goodwill restored after every cleared wave. */
  mend?: number;
  /** Gust overrides (Windmill): push and seconds between gusts. */
  gustPush?: number;
  gustEvery?: number;
  ignoresArmour?: boolean;
  /** Can hit flying enemies (a megastructure overriding a ground-only tower). */
  air?: boolean;
  cleanse?: boolean;
}

export const SPEC_FIRST_LEVEL = 6;

export const SPECIALISATIONS: Record<
  TowerKind,
  [Specialisation, Specialisation]
> = {
  hedgerow: [
    {
      name: "Blackthorn",
      blurb: "Thorns like fish hooks. Everything in reach takes a steady scratching.",
      cost: 150,
      thorns: 14,
      slow: 0.4,
    },
    {
      name: "Bramble Maze",
      blurb: "A tangle so dense the vans crawl at a quarter speed.",
      cost: 140,
      slow: 0.25,
      range: 2.1,
    },
  ],
  scarecrow: [
    {
      name: "Pumpkin Lobber",
      blurb: "Swaps turnips for prize pumpkins. They burst over a crowd.",
      cost: 200,
      damage: 36,
      cooldown: 0.85,
      splash: 0.95,
    },
    {
      name: "Crow Caller",
      blurb: "Long sight, quick hands, and every third throw brings the crows down too.",
      cost: 210,
      damage: 24,
      cooldown: 0.42,
      range: 3.7,
      crit: { every: 3, mult: 3 },
    },
  ],
  beehive: [
    {
      name: "Killer Queen",
      blurb: "An ill-tempered queen. Stings keep burning for three seconds.",
      cost: 230,
      damage: 20,
      poison: { dps: 12, secs: 3 },
    },
    {
      name: "Honey Trap",
      blurb: "The swarm drips honey. Whatever it stings is stuck in it.",
      cost: 220,
      splash: 1.5,
      damage: 16,
      sticky: { factor: 0.55, secs: 1.6 },
    },
  ],
  stall: [
    {
      name: "Farmers' Market",
      blurb: "A proper Saturday market. Takes a fortune and cheers louder.",
      cost: 200,
      income: 36,
      buff: 1.55,
    },
    {
      name: "Pie Stand",
      blurb: "Cath's pies, on sale. Every stand gets her next pie out of the oven sooner.",
      cost: 180,
      income: 20,
      buff: 1.45,
      pieHaste: 0.3,
    },
  ],
  pond: [
    {
      name: "Goose Patrol",
      blurb: "Geese. Nobody argues with geese. They peck hard and shove vans back up the lane.",
      cost: 210,
      damage: 22,
      splash: 1.1,
      knockback: 0.35,
    },
    {
      name: "Lily Marsh",
      blurb: "The pond spreads into a wide, sucking marsh.",
      cost: 200,
      slow: 0.4,
      range: 2.7,
    },
  ],
  barn: [
    {
      name: "Tractor Shed",
      blurb: "The farmhands bring the tractor. Things get shunted.",
      cost: 200,
      damage: 26,
      cooldown: 0.6,
      knockback: 0.5,
    },
    {
      name: "Haybale Wall",
      blurb: "Round bales across the lane. Almost nothing gets through quickly.",
      cost: 190,
      slow: 0.2,
      range: 2.0,
    },
  ],
  silo: [
    {
      name: "Combine",
      blurb: "One enormous blow that goes straight through any armour.",
      cost: 280,
      damage: 210,
      cooldown: 1.8,
    },
    {
      name: "Grain Elevator",
      blurb: "Rains grain over a crowd, armour and all.",
      cost: 270,
      damage: 120,
      splash: 1.1,
    },
  ],
  mast: [
    {
      name: "Pirate Radio",
      blurb: "Sol goes live. Everything in range is exposed, and takes far more damage.",
      cost: 180,
      reveal: 1.75,
      range: 3.1,
    },
    {
      name: "Emergency Siren",
      blurb: "A wailing siren. Drivers in range slow down and get marked.",
      cost: 170,
      reveal: 1.4,
      slow: 0.7,
    },
  ],
  tent: [
    {
      name: "Field Hospital",
      blurb: "Ines runs a real ward. Neighbours fight harder and a Goodwill is restored after every wave.",
      cost: 200,
      buff: 1.4,
      mend: 1,
    },
    {
      name: "Tea Urn",
      blurb: "A tea urn the size of a tractor. Every tower near it is fired up.",
      cost: 190,
      buff: 1.55,
      range: 2.9,
    },
  ],
  court: [
    {
      name: "High Court",
      blurb: "Mara takes it to the High Court. Longer injunctions, served more often.",
      cost: 260,
      injunction: 6.5,
      cooldown: 5.5,
    },
    {
      name: "Class Action",
      blurb: "Everyone in range is named in the suit: bosses and drivers alike stop dead.",
      cost: 250,
      injunction: 3.5,
      classAction: true,
    },
  ],
  hall: [
    {
      name: "General Strike",
      blurb: "The whole county downs tools against them. Every tower hits much harder.",
      cost: 320,
      aura: 1.38,
    },
    {
      name: "Co-op Bank",
      blurb: "Tomas opens a bank that lends to farms. It pays out handsomely after every wave.",
      cost: 300,
      income: 55,
    },
  ],
  windmill: [
    {
      name: "Storm Sails",
      blurb: "Canvas the size of a barn roof. The gusts blow vans a long way back, more often.",
      cost: 220,
      range: 2.5,
      gustPush: 1.25,
      gustEvery: 2.2,
    },
    {
      name: "Mill Stones",
      blurb: "The millstones turn on the lane itself. Short gusts, but they grind through armour.",
      cost: 230,
      damage: 48,
      gustPush: 0.6,
      gustEvery: 1.6,
      ignoresArmour: true,
    },
  ],
  cannon: [
    {
      name: "Pumpkin Mortar",
      blurb: "Prize pumpkins at extreme range. Slow, and devastating where they land.",
      cost: 270,
      damage: 150,
      splash: 1.7,
      cooldown: 2.8,
      range: 4.6,
    },
    {
      name: "Scatter Shot",
      blurb: "Loads of seed at once. Fires three times as often over a tighter patch.",
      cost: 250,
      damage: 44,
      cooldown: 0.8,
      splash: 1.0,
    },
  ],
};

/** Towers on high ground see this much further. */
export const HIGH_GROUND_RANGE = 1.25;

export interface TowerStats {
  range: number;
  damage: number;
  cooldown: number;
  slow: number;
  splash: number;
  buff: number;
  income: number;
  reveal: number;
  injunction: number;
  aura: number;
  /** Shots ignore armour (the Grain Silo, Mill Stones, the Harvester). */
  ignoresArmour: boolean;
  /** How many vehicles one shot can hit (fleet levels; 1 on classic ones). */
  pierce: number;
  /** Can hit flying enemies. */
  air: boolean;
  cleanse: boolean;
  thorns: number;
  crit: { every: number; mult: number } | null;
  poison: { dps: number; secs: number } | null;
  sticky: { factor: number; secs: number } | null;
  knockback: number;
  classAction: boolean;
  pieHaste: number;
  mend: number;
  gustPush: number;
  gustEvery: number;
  /** Veteran rank from kills (0 to 3). */
  rank: number;
  /** Damage multiplier against each class of enemy (TOWER_VS; megastructures are even-handed). */
  vs: Record<EnemyClass, number>;
}

// ---- megastructures: two grown towers side by side merge into one ----

export type MegaId =
  | "harvester"
  | "honeymarsh"
  | "fortress"
  | "grandmarket"
  | "tribunal"
  | "stormhive"
  | "barrage"
  | "sanctuary";

export interface MegaSpec extends Specialisation {
  /** The two towers it is made from (either order, side by side, both tier 3 or more). */
  from: [TowerKind, TowerKind];
}

export const MEGA_FIRST_LEVEL = 12;
export const MEGA_FEE = 220;

export const MEGAS: Record<MegaId, MegaSpec> = {
  harvester: {
    from: ["scarecrow", "silo"],
    name: "The Harvester",
    blurb: "A scarecrow riding a silo. It reaps the lane: huge, armour-piercing blows, and every fourth one is brutal.",
    cost: MEGA_FEE,
    range: 3.6,
    damage: 150,
    cooldown: 0.9,
    ignoresArmour: true,
    air: true,
    crit: { every: 4, mult: 2.5 },
  },
  honeymarsh: {
    from: ["beehive", "pond"],
    name: "Honey Marsh",
    blurb: "Bees over a bog. Everything in it is stuck, stung and poisoned.",
    cost: MEGA_FEE,
    range: 2.8,
    damage: 28,
    cooldown: 0.8,
    splash: 1.6,
    slow: 0.45,
    poison: { dps: 14, secs: 3 },
    sticky: { factor: 0.5, secs: 2 },
  },
  fortress: {
    from: ["hedgerow", "barn"],
    name: "Hawthorn Fortress",
    blurb: "Barn and hedge grown into one wall. The lane crawls past thorns and farmhands with shovels.",
    cost: MEGA_FEE,
    range: 2.2,
    damage: 24,
    cooldown: 0.6,
    slow: 0.2,
    thorns: 30,
    knockback: 0.35,
    air: false,
  },
  grandmarket: {
    from: ["stall", "hall"],
    name: "Grand Market",
    blurb: "Tomas's hall becomes the county market. Rich pay-outs, loud cheers, and everyone hits harder.",
    cost: MEGA_FEE,
    range: 2.6,
    buff: 1.6,
    aura: 1.22,
    income: 80,
  },
  tribunal: {
    from: ["mast", "court"],
    name: "The Tribunal",
    blurb: "Mara broadcasts the hearing live. Everything in range is exposed, marked, and stopped by injunction.",
    cost: MEGA_FEE,
    range: 3.2,
    reveal: 1.8,
    injunction: 4,
    cooldown: 5,
    classAction: true,
  },
  stormhive: {
    from: ["windmill", "beehive"],
    name: "Stormhive",
    blurb: "The mill's sails carry the bees. Gusts blow vans back into a cloud of stings.",
    cost: MEGA_FEE,
    range: 2.6,
    damage: 34,
    cooldown: 0.7,
    splash: 1.4,
    gustPush: 0.9,
    gustEvery: 2.4,
  },
  barrage: {
    from: ["cannon", "scarecrow"],
    name: "Turnip Barrage",
    blurb: "A scarecrow crew on a battery of seed cannons. Constant, long-range, everything in a wide patch.",
    cost: MEGA_FEE,
    range: 4.3,
    damage: 72,
    cooldown: 0.75,
    splash: 1.3,
    air: true,
  },
  sanctuary: {
    from: ["tent", "pond"],
    name: "Sanctuary",
    blurb: "A field hospital by the water. Towers near it fire up and shake off charm; vans wade; Goodwill mends.",
    cost: MEGA_FEE,
    range: 2.6,
    buff: 1.5,
    slow: 0.5,
    cleanse: true,
    mend: 2,
    air: false,
  },
};

/** The megastructure two kinds make together, if any. */
export function megaFor(a: TowerKind, b: TowerKind): MegaId | null {
  for (const [id, m] of Object.entries(MEGAS) as Array<[MegaId, MegaSpec]>)
    if ((m.from[0] === a && m.from[1] === b) || (m.from[0] === b && m.from[1] === a)) return id;
  return null;
}

/** Kills for each veteran rank. */
export const RANKS = [15, 40, 90];

export function rankOf(kills: number): number {
  let n = 0;
  for (const k of RANKS) if (kills >= k) n++;
  return n;
}

// The cache compares the fields stats depend on one by one (no string key: towerStats runs thousands of
// times a step on a big field, docs/design/hedgerow-2.md section 8).
interface StatKey {
  kind: TowerKind;
  tier: number;
  spec: 0 | 1 | null | undefined;
  high: boolean | undefined;
  rangeMul: number | undefined;
  dmgMul: number | undefined;
  mega: MegaId | undefined;
  rank: number;
  fleet: boolean | undefined;
  stats: TowerStats;
}
const statCache = new WeakMap<object, StatKey>();

/** The numbers a tower fights with at its tier, and with its specialisation at tier 4. */
export function towerStats(
  t: Pick<Tower, "kind" | "tier"> & {
    spec?: 0 | 1 | null;
    high?: boolean;
    rangeMul?: number;
    dmgMul?: number;
    mega?: MegaId;
    kills?: number;
    fleet?: boolean;
  },
): TowerStats {
  // Fleet towers have no veteran ranks: their Knockouts are the counter (Hedgerow 2 cuts RANKS).
  const rank = t.fleet ? 0 : rankOf(t.kills ?? 0);
  const hit = statCache.get(t);
  if (
    hit &&
    hit.kind === t.kind &&
    hit.tier === t.tier &&
    (hit.spec ?? null) === (t.spec ?? null) &&
    !!hit.high === !!t.high &&
    (hit.rangeMul ?? 1) === (t.rangeMul ?? 1) &&
    (hit.dmgMul ?? 1) === (t.dmgMul ?? 1) &&
    hit.mega === t.mega &&
    hit.rank === rank &&
    !!hit.fleet === !!t.fleet
  )
    return hit.stats;
  const s = TOWERS[t.kind];
  const i = Math.min(t.tier, 3) - 1;
  const stats: TowerStats = {
    range: s.range[i]!,
    damage: s.damage[i]!,
    cooldown: s.cooldown[i]!,
    slow: s.slow[i]!,
    splash: s.splash ?? 0,
    buff: s.buff?.[i] ?? 1,
    income: s.income?.[i] ?? 0,
    reveal: s.reveal?.[i] ?? 1,
    injunction: s.injunction?.[i] ?? 0,
    aura: s.aura?.[i] ?? 1,
    ignoresArmour: !!s.ignoresArmour,
    pierce: 1,
    air: !s.groundOnly,
    cleanse: !!s.cleanse,
    thorns: 0,
    crit: null,
    poison: null,
    sticky: null,
    knockback: 0,
    classAction: false,
    pieHaste: 0,
    mend: 0,
    gustPush: s.gust?.push[i] ?? 0,
    gustEvery: s.gust?.every[i] ?? 0,
    rank,
    vs: { light: 1, heavy: 1, air: 1, ...TOWER_VS[t.kind] },
  };
  const over: Partial<MegaSpec> | null = t.mega
    ? { ...MEGAS[t.mega] }
    : t.tier === 4 && t.spec != null
      ? { ...SPECIALISATIONS[t.kind][t.spec] }
      : null;
  if (over) {
    delete over.name;
    delete over.blurb;
    delete over.cost;
    delete over.from;
    if (t.mega) {
      // A megastructure is its own building: it keeps only what its recipe gives it.
      Object.assign(stats, { damage: 0, slow: 1, splash: 0, buff: 1, income: 0, reveal: 1, injunction: 0, aura: 1, ignoresArmour: false, air: true, cleanse: false, gustPush: 0, gustEvery: 0, vs: { light: 1, heavy: 1, air: 1 } });
    }
    Object.assign(stats, over);
  }
  if (t.fleet) fleetStats(t, stats);
  if (t.high && stats.range > 0) stats.range *= HIGH_GROUND_RANGE;
  if (t.rangeMul) stats.range *= t.rangeMul;
  if (t.dmgMul) {
    stats.damage *= t.dmgMul;
    stats.thorns *= t.dmgMul;
  }
  if (rank > 0) {
    stats.range *= 1 + 0.04 * rank;
    stats.damage *= 1 + 0.1 * rank;
    stats.thorns *= 1 + 0.1 * rank;
  }
  statCache.set(t, { kind: t.kind, tier: t.tier, spec: t.spec, high: t.high, rangeMul: t.rangeMul, dmgMul: t.dmgMul, mega: t.mega, rank, fleet: t.fleet, stats });
  return stats;
}

// ---- bosses: every boss has signature moves on a timer ----

/** Fleet levels: a tower's hits in layers and pierce (fleet.ts FLEET_TOWERS); range, splash and slows stay. */
function fleetStats(t: { kind: TowerKind; tier: number; spec?: 0 | 1 | null; mega?: MegaId }, stats: TowerStats): void {
  const f = FLEET_TOWERS[t.kind];
  // No soft counters on the Fleet: TOWER_VS is cut (M3 brings hard property locks instead).
  stats.vs = { light: 1, heavy: 1, air: 1 };
  if (t.mega) {
    // Megastructures: today's numbers in layers (about 8 health to a layer), hitting up to 10 vehicles.
    if (stats.damage > 0) stats.damage = Math.max(1, Math.round(stats.damage / 8));
    stats.thorns /= 12;
    if (stats.poison) stats.poison = { dps: stats.poison.dps / 12, secs: stats.poison.secs };
    stats.pierce = 10;
    return;
  }
  const i = Math.min(t.tier, 3) - 1;
  stats.damage = f.damage[i]!;
  stats.pierce = f.pierce[i]!;
  if (f.cooldown && !(t.tier === 4 && t.spec != null && SPECIALISATIONS[t.kind][t.spec].cooldown)) stats.cooldown = f.cooldown[i]!;
  if (t.tier === 4 && t.spec != null) {
    const fs = f.spec[t.spec];
    if (fs.damage !== undefined) stats.damage = fs.damage;
    if (fs.pierce !== undefined) stats.pierce = fs.pierce;
    if (fs.cooldown !== undefined) stats.cooldown = fs.cooldown;
    stats.thorns = fs.thorns ?? (stats.thorns > 0 ? stats.thorns / 12 : 0);
    if (stats.poison) stats.poison = { dps: fs.poison ?? 1, secs: stats.poison.secs };
  }
}

export interface BossMove {
  kind: "spawn" | "charge" | "stomp" | "pulse" | "mend" | "takeover";
  /** What a spawn calls in. */
  spawn?: { kind: EnemyKind; count: number };
  /** Seconds: of the charge, or that towers stay knocked out. */
  secs?: number;
  /** Reach of a pulse or a stomp, in cells. */
  radius?: number;
  /** What the banner says. */
  text: string;
}

export const BOSS_MOVES: Partial<Record<EnemyKind, { every: number; moves: BossMove[] }>> = {
  boss: {
    every: 7,
    moves: [{ kind: "spawn", spawn: { kind: "van", count: 2 }, text: "makes an offer: two more vans" }],
  },
  convoy: {
    every: 7,
    moves: [{ kind: "charge", secs: 2, text: "slashes prices and charges" }],
  },
  blimp: {
    every: 8,
    moves: [{ kind: "pulse", radius: 2.4, secs: 3, text: "runs a brand activation: nearby towers stop to watch" }],
  },
  megadozer: {
    every: 7,
    moves: [{ kind: "stomp", radius: 2.2, secs: 6, text: "flattens the nearest tower" }],
  },
  clinic: {
    every: 6,
    moves: [{ kind: "mend", text: "hands out a wellness drop: everything heals" }],
  },
  ship: {
    every: 7,
    moves: [{ kind: "spawn", spawn: { kind: "tender", count: 2 }, text: "lowers two fast tenders" }],
  },
  swarm: {
    every: 8,
    moves: [{ kind: "spawn", spawn: { kind: "lawyer", count: 2 }, text: "files more paperwork: two more lawyers" }],
  },

  bus: {
    every: 6,
    moves: [{ kind: "spawn", spawn: { kind: "influencer", count: 2 }, text: "drops off two influencers" }],
  },
  board: {
    every: 8,
    moves: [{ kind: "takeover", radius: 3, secs: 8, text: "stages a hostile takeover of the best tower in reach" }],
  },
  candor: {
    every: 7,
    moves: [{ kind: "mend", text: "merges with what's left: everything heals" }],
  },
  hollowcandor: {
    every: 5,
    moves: [
      { kind: "spawn", spawn: { kind: "remnant", count: 2 }, text: "sheds two hollow remnants" },
      { kind: "stomp", radius: 2.4, secs: 6, text: "crushes the nearest tower" },
      { kind: "pulse", radius: 2.6, secs: 3, text: "broadcasts: every tower nearby stops to listen" },
      { kind: "charge", secs: 2.5, text: "surges forward" },
      { kind: "takeover", radius: 3.2, secs: 8, text: "acquires the best tower in reach" },
    ],
  },
};

function bossMoves(game: Game): void {
  const born: Enemy[] = [];
  for (const e of game.enemies) {
    const plan = BOSS_MOVES[e.kind];
    if (!plan || e.hp <= 0) continue;
    if (e.charge && e.charge > 0) e.charge -= STEP;
    if (e.moveCd === undefined) e.moveCd = plan.every * 0.6;
    if (e.stun > 0) continue;
    e.moveCd -= STEP;
    if (e.moveCd > 0) continue;
    e.moveCd = plan.every;
    const move = plan.moves[(e.moveIdx ?? 0) % plan.moves.length]!;
    e.moveIdx = (e.moveIdx ?? 0) + 1;
    const p = enemyPoint(game.level, e);
    const hit: number[] = [];
    const near = (r: number) =>
      game.towers
        .filter((t) => (t.out ?? 0) <= 0 && Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r)
        .sort(
          (a, b) =>
            Math.hypot(a.col + 0.5 - p.x, a.row + 0.5 - p.y) - Math.hypot(b.col + 0.5 - p.x, b.row + 0.5 - p.y) ||
            a.id - b.id,
        );
    switch (move.kind) {
      case "spawn":
        for (let i = 0; i < move.spawn!.count; i++)
          born.push(makeEnemy(game, move.spawn!.kind, Math.max(0, e.dist - 0.4 - i * 0.4), e.lane, e.wave));
        break;
      case "charge":
        e.charge = move.secs!;
        break;
      case "mend":
        for (const o of game.enemies) if (o.hp > 0) o.hp = Math.min(maxHpOf(o), o.hp + maxHpOf(o) * 0.15);
        break;
      case "stomp": {
        const t = near(move.radius!)[0];
        if (t) {
          t.out = move.secs!;
          hit.push(t.id);
        }
        break;
      }
      case "takeover": {
        const t = near(move.radius!).sort((a, b) => b.tier - a.tier || b.spent - a.spent)[0];
        if (t) {
          t.out = move.secs!;
          hit.push(t.id);
        }
        break;
      }
      case "pulse":
        for (const t of near(move.radius!)) {
          t.out = move.secs!;
          hit.push(t.id);
        }
        break;
    }
    game.events.push({
      type: "bossMove",
      kind: e.kind,
      move: move.kind,
      x: p.x,
      y: p.y,
      text: `${ENEMIES[e.kind].name} ${move.text}.`,
      towers: hit,
    });
  }
  game.enemies.push(...born);
}

/** Whether a tower is working: not knocked out by a boss. */
export function towerActive(t: Tower): boolean {
  return (t.out ?? 0) <= 0;
}

export interface WaveGroup {
  enemy: EnemyKind;
  count: number;
  /** Seconds between spawns in this group. */
  gap: number;
  /** Seconds after the wave starts that the group begins. */
  delay: number;
  /** 1 = the second lane (only on levels with `path2`). */
  lane?: 1;
  /** An ambush: the group bursts out of cover this fraction of the way down the lane instead of at the spawn. */
  ambush?: number;
}

export interface StoryLine {
  who: "cath" | "mara" | "bea" | "tomas" | "sol" | "ines" | "pip" | "pell" | "crisp" | "vane" | "narrator";
  expression?: "smirk" | "delighted" | "determined" | "worried" | "wink";
  text: string;
}

export interface Level {
  id: number;
  name: string;
  place: string;
  cols: number;
  rows: number;
  /** Cell waypoints; consecutive points share a row or a column. The last one is the farmhouse. */
  path: Array<[number, number]>;
  /** A second lane from another spawn; it ends at the same farmhouse. Enemies in a group with `lane: 1` use it. */
  path2?: Array<[number, number]>;
  /** Plots that aren't plain grass: high ground (+range) and water (ponds only). */
  terrain?: { high: Array<[number, number]>; water: Array<[number, number]> };
  startMarks: number;
  goodwill: number;
  towers: TowerKind[];
  waves: WaveGroup[][];
  before: StoryLine[];
  after: StoryLine[];
  /** What finishing the level unlocks (a tier, a skin or a lore card). */
  reward: string;
  /** The level's twists: what makes it a different problem (docs/design/hedgerow-v2.md section 2). */
  twists?: TwistId[];
  /** Enemy health multiplier, found by the tuner (scripts/hedgerow-tune.ts) so the curve is fair. */
  hpScale?: number;
  /** An Endless field: generated waves that never stop growing (endless.ts). The run ends when Goodwill does. */
  endless?: boolean;
  /** Set pieces (ROADMAP 54): the level itself changes during the fight. */
  setPieces?: SetPiece[];
  /**
   * Hedgerow 2's transition flag (docs/design/hedgerow-2.md "What changes"): "fleet" levels play layered
   * Fleet rungs from the Round Book (fleet.ts, rounds.ts), pay a Mark a layer and charge leaks their Fleet
   * Value; "classic" (the default) levels keep health pools, bounties and HP_SCALE until they convert.
   */
  rules?: "classic" | "fleet";
  /** Fleet levels: the window of the Round Book this level plays (wave 1 is Book round `from`). */
  book?: { from: number; to: number };
}

/** Is this a Hedgerow 2 fleet level? */
export function isFleet(level: Pick<Level, "rules">): boolean {
  return level.rules === "fleet";
}

/** The Round Book's number for one of a fleet level's waves (1-based); the wave itself on classic levels. */
export function bookRound(level: Pick<Level, "book">, wave: number): number {
  return level.book ? level.book.from + wave - 1 : wave;
}

/**
 * - flood: when wave `wave` is called the river rises over `cells`: towers there (bar Duck Ponds) are washed
 *   out for 15 s, the plots take only ponds from then on, and vehicles wade through lane `from`-`to` at 60%.
 *   Scouts warn a wave ahead.
 * - bridge: a swing bridge at lane distance `dist` opens for `open` seconds out of every `period`; while it's
 *   open nothing crosses, so traffic bunches up in front of it.
 * - blackout: a night with no lamps. Towers and Cath light `light` cells around them; anything outside that
 *   can't be targeted.
 */
export type SetPiece =
  | { kind: "flood"; wave: number; cells: Array<[number, number]>; from: number; to: number }
  | { kind: "bridge"; dist: number; lane?: 1; period: number; open: number }
  | { kind: "blackout"; light: number };

export function setPiece<K extends SetPiece["kind"]>(level: Pick<Level, "setPieces">, kind: K): Extract<SetPiece, { kind: K }> | undefined {
  return level.setPieces?.find((p) => p.kind === kind) as Extract<SetPiece, { kind: K }> | undefined;
}

/** Whether the flood is up and this plot is under it. */
export function flooded(game: Game, col: number, row: number): boolean {
  const f = setPiece(game.level, "flood");
  return !!f && game.wave >= f.wave && f.cells.some(([c, r]) => c === col && r === row);
}

/** Whether the swing bridge is open (impassable) right now. */
export function bridgeOpen(game: Pick<Game, "level" | "tick">, tick = game.tick): boolean {
  const b = setPiece(game.level, "bridge");
  if (!b) return false;
  const t = (tick * STEP) % b.period;
  return t >= b.period - b.open;
}

export type TwistId =
  | "fog"
  | "night"
  | "rain"
  | "wind"
  | "drought"
  | "tight"
  | "rush"
  | "armoured"
  | "air"
  | "protected"
  | "nocath"
  | "noscarecrow"
  | "crowd"
  | "fast"
  | "fortified"
  | "market";

export const TWISTS: Record<TwistId, { name: string; rule: string }> = {
  fog: { name: "Fog", rule: "Towers reach 20% less far." },
  night: { name: "Night", rule: "Towers reach 25% less far; vehicles are 10% faster." },
  rain: { name: "Rain", rule: "Everything on the lane is 15% slower; Beehives do half damage." },
  wind: { name: "High wind", rule: "Scarecrows and Silos do 25% less damage; drones fly 30% faster." },
  drought: { name: "Drought", rule: "No Duck Ponds; slowing towers are 30% weaker." },
  tight: { name: "Tight budget", rule: "40% fewer Marks to start; wave rewards +50%." },
  rush: { name: "Rush hour", rule: "Waves don't wait: the next starts 6 s after the last has arrived." },
  armoured: { name: "Armoured", rule: "Every enemy has 25% more armour." },
  air: { name: "Air drop", rule: "Every wave brings extra drones." },
  protected: { name: "Protected land", rule: "Only half the plots can be built on." },
  nocath: { name: "Cath's away", rule: "Cath isn't on the field." },
  noscarecrow: { name: "Scarecrow ban", rule: "No Scarecrows this level." },
  crowd: { name: "Crowds", rule: "Twice as many enemies at half health and half bounty, packed close." },
  fast: { name: "Express", rule: "Enemies are 25% faster; bounties +50%." },
  fortified: { name: "Fortified", rule: "Enemies have 30% more health." },
  market: { name: "Market day", rule: "Income +50%." },
};

export function hasTwist(level: Pick<Level, "twists">, id: TwistId): boolean {
  return !!level.twists?.includes(id);
}

/** Can this tower be built in this level (unlocked, and not banned or dried up by a twist)? */
export function towerAllowed(level: Level, kind: TowerKind): boolean {
  if (!level.towers.includes(kind)) return false;
  if (kind === "scarecrow" && hasTwist(level, "noscarecrow")) return false;
  if (kind === "pond" && hasTwist(level, "drought")) return false;
  return true;
}

export type TargetMode = "first" | "last" | "strong" | "close";
export const TARGET_MODES: TargetMode[] = ["first", "last", "strong", "close"];

export interface Tower {
  id: number;
  kind: TowerKind;
  col: number;
  row: number;
  tier: 1 | 2 | 3 | 4;
  /** Built on high ground: +25% range. */
  high?: boolean;
  /** The level's twists on this tower: range and damage multipliers (fog, night, wind, rain). */
  rangeMul?: number;
  dmgMul?: number;
  /** Which tier-4 specialisation it took (null below tier 4). */
  spec?: 0 | 1 | null;
  /** Which enemy in range it shoots at. */
  target?: TargetMode;
  /** Shots fired, for every-nth-shot crits. */
  shots?: number;
  /** Seconds left knocked out by a boss (it neither fires nor slows). */
  out?: number;
  cd: number;
  spent: number;
  /** Merged into a megastructure: which one, and the second plot it now also covers. */
  mega?: MegaId;
  annex?: [number, number];
  /** Kills (veteran ranks at RANKS). */
  kills?: number;
  /** Seconds until its next gust (windmills). */
  gustCd?: number;
  /** Built on a fleet level: priced and fighting in layers (fleet.ts FLEET_TOWERS). */
  fleet?: boolean;
  /** Layers knocked off (fleet levels): the tower's Knockouts, and the Marks it has earned. */
  ko?: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  dist: number;
  /** 1 = walks the level's second lane. */
  lane?: 1;
  hp: number;
  slowed: boolean;
  /** Seconds left frozen in place (Cath's pie, an injunction). */
  stun: number;
  /** The wave it came with (its bounty counts towards that wave's clear). */
  wave?: number;
  /** Poison: damage a second, and seconds left. */
  poison?: number;
  poisonLeft?: number;
  /** Honey: speed factor, and seconds left. */
  sticky?: number;
  stickyLeft?: number;
  /** Held up by Cath. */
  held?: boolean;
  /** Cath was holding it when she was knocked down (so a leak names her, not the towers). */
  dropped?: boolean;
  /** Full health after the level's scaling and twists (defaults to the kind's). */
  maxHp?: number;
  /** Bosses: seconds until the next signature move, and which move is next. */
  moveCd?: number;
  moveIdx?: number;
  /** Seconds until a carrier launches its next drones. */
  launchCd?: number;
  /** Seconds left charging at double speed. */
  charge?: number;
  /** Bubble wrap left: single-target hits it still shrugs off. */
  shield?: number;
  /** The tower that hit it last (for veteran kills). */
  lastHit?: number;
  /** Seconds before another gust can move it (gusts don't chain-lock a vehicle in place). */
  gustCd?: number;
}

/** Cath on the battlefield: she walks where she's told, holds up to two vehicles and whacks them. */
export interface Hero {
  x: number;
  y: number;
  tx: number;
  ty: number;
  hp: number;
  maxHp: number;
  damage: number;
  cd: number;
  /** Seconds until she's back on her feet (0 = up). */
  down: number;
  /** Ids of the enemies she is holding. */
  holding: number[];
  facing: 1 | -1;
  kills: number;
}

export const HERO = {
  hp: 150,
  speed: 2.6,
  reach: 0.62,
  /** Hedgerow 2 M1: 15 → 10, and only at what she isn't holding: she holds vehicles for the towers. */
  damage: 10,
  cooldown: 0.6,
  regen: 9,
  respawn: 9,
  holds: 2,
};

/** Seed Bank perks bought with stars between levels (store.ts). All neutral by default. */
export interface Perks {
  marks: number;
  goodwill: number;
  /** Multiplies the pie's cooldown. */
  pieCooldown: number;
  /** Multiplies the pie's radius. */
  pieRadius: number;
  /** Multiplies how long the neighbours hold the lane. */
  neighbours: number;
  /** Multiplies how long Rally lasts. */
  rally: number;
  heroHp: number;
  heroDamage: number;
  /** Fraction off every tower's price. */
  discount: number;
  /** Multiplies the bonus for calling a wave early. */
  earlyBonus: number;
  /** Multiplies hedgerow-type slows' strength (lower = stronger). */
  slow: number;
  // ---- Cath's own growth (her level, attributes and talents: store.ts) ----
  /** Multiplies every tower's damage (Leadership, Matriarch). */
  towerDamage: number;
  heroSpeed: number;
  /** Extra vehicles she can hold at once (Iron Pin). */
  heroHolds: number;
  /** Multiplies the time she's down (Second Wind). */
  heroRespawn: number;
  /** Multiplies the damage she takes while holding (Hold the Line). */
  holdGuard: number;
  pieDamage: number;
  pieStun: number;
  /** A burning pie: everything hit keeps taking this much a second for 4 s (Hot Oven). */
  pieBurn: number;
  /** Multiplies what a boss duel takes off the boss (Duellist). */
  duel: number;
}

export const NO_PERKS: Perks = {
  marks: 0,
  goodwill: 0,
  pieCooldown: 1,
  pieRadius: 1,
  neighbours: 1,
  rally: 1,
  heroHp: 1,
  heroDamage: 1,
  discount: 0,
  earlyBonus: 1,
  slow: 1,
  towerDamage: 1,
  heroSpeed: 1,
  heroHolds: 0,
  heroRespawn: 1,
  holdGuard: 1,
  pieDamage: 1,
  pieStun: 1,
  pieBurn: 0,
  duel: 1,
};

export type GameEvent =
  | {
      type: "shot";
      kind: TowerKind;
      tower: number;
      enemy: number;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      crit?: boolean;
      spec?: 0 | 1 | null;
    }
  | { type: "kill"; x: number; y: number; bounty: number; kind: EnemyKind }
  | { type: "leak"; x: number; y: number; kind?: EnemyKind; lost?: number; dropped?: boolean }
  | { type: "wave"; wave: number; early?: number }
  | { type: "cleared"; wave: number; reward: number }
  | { type: "pie"; x?: number; y?: number; radius?: number }
  | { type: "neighbours"; x: number; y: number }
  | { type: "rally" }
  | { type: "swing"; x: number; y: number }
  | { type: "heroDown" }
  | { type: "heroUp" }
  | { type: "injunction"; x: number; y: number }
  | { type: "split"; x: number; y: number; kind: EnemyKind }
  | { type: "flood"; x: number; y: number; warn: boolean }
  | { type: "bridge"; open: boolean; x: number; y: number }
  | { type: "gust"; tower: number; x: number; y: number; radius: number }
  | { type: "pop"; x: number; y: number }
  /** Fleet levels: a hit knocked `n` layers off; `from` is what was hit and `to` what it is now (null: gone). */
  | { type: "knock"; x: number; y: number; from: EnemyKind; to: EnemyKind | null; n: number; tower?: number }
  | { type: "rankUp"; tower: number; rank: number; x: number; y: number }
  | { type: "merge"; tower: number; mega: MegaId; x: number; y: number }
  | { type: "ambush"; x: number; y: number; kind: EnemyKind; lane?: 1; in: number }
  | { type: "duel"; kind: EnemyKind }
  | { type: "duelStrike"; quality: number; round: number }
  | { type: "duelEnd"; kind: EnemyKind; won: boolean; total: number }
  | {
      type: "bossMove";
      kind: EnemyKind;
      move: BossMove["kind"];
      x: number;
      y: number;
      text: string;
      /** Towers it knocked out. */
      towers: number[];
    };

export type Phase = "build" | "wave" | "won" | "lost";

export interface Game {
  /** A Heroic run: one Goodwill and no pies. Winning one earns the level's fourth star. */
  heroic: boolean;
  level: Level;
  tick: number;
  phase: Phase;
  marks: number;
  goodwill: number;
  /** Waves sent so far. */
  wave: number;
  /** Waves cleared and paid for. */
  paid: number;
  waveClock: number;
  spawnQueue: Array<{ at: number; kind: EnemyKind; wave?: number; lane?: 1; ambush?: number }>;
  enemies: Enemy[];
  towers: Tower[];
  nextId: number;
  pathLength: number;
  pathLength2: number;
  events: GameEvent[];
  /** Seconds until Cath's pie is ready again. */
  pieCd: number;
  /** Seconds until she can Call the Neighbours / Rally again. */
  neighboursCd: number;
  rallyCd: number;
  /** The farmhands' barricade: lane distance and seconds left (0 = none). */
  barricade: { dist: number; left: number; lane?: 1 } | null;
  /** Seconds of Rally left: towers fire faster. */
  rallyLeft: number;
  hero: Hero;
  perks: Perks;
  /** Goodwill at the start, after perks: stars are measured against it. */
  maxGoodwill: number;
  /**
   * Which of Cath's abilities cast themselves (Hedgerow 2 section 7: manual by default; a player earns each
   * Auto toggle by casting it by hand three times). Cath herself always holds her post: she never roams.
   */
  auto: AutoCast;
  /** Seconds until the Auto abilities think again. */
  aiCd: number;
  /** Rush hour: seconds until the next wave is forced. */
  rushIn?: number;
  /** One-on-one boss duels on (the browser turns them on; sims and the tuner leave them off). */
  duels: boolean;
  /** The duel in progress: the battlefield holds its breath until it's over. */
  duel: Duel | null;
  /** Boss kinds Cath has already duelled this level. */
  dueled: EnemyKind[];
  /** Fleet levels: children waiting at their parent while the lane is at LIVE_CAP, oldest first. */
  emitQueue: Array<{ kind: EnemyKind; dist: number; lane?: 1; wave?: number }>;
  /** Fleet levels: pop income not yet paid, in thousandths of a Mark (paid out as whole Marks). */
  popMilli: number;
  /** Fleet levels: every layer knocked off so far, and every layer that leaked (Fleet Value). */
  popped: number;
  leaked: number;
}

export interface Duel {
  enemy: number;
  kind: EnemyKind;
  /** Rounds struck so far (0 to DUEL_ROUNDS), and each one's quality (0 to 1). */
  round: number;
  strikes: number[];
  /** Seconds into the current round. */
  clock: number;
}

export const DUEL_ROUNDS = 3;
/** Seconds a round waits for a strike before Cath swings on her own (at half quality). */
export const DUEL_AUTO = 4;
/** Fraction of the boss's health one perfect strike takes. */
export const DUEL_BITE = 0.09;

export function pathLength(path: Level["path"]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++)
    total +=
      Math.abs(path[i]![0] - path[i - 1]![0]) +
      Math.abs(path[i]![1] - path[i - 1]![1]);
  return total;
}

/** Cell-centre position (in cell units, x to the right) at `dist` cells along the lane. */
export function pointAt(
  path: Level["path"],
  dist: number,
): { x: number; y: number } {
  let left = Math.max(0, dist);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    if (left <= len || i === path.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      return { x: ax + (bx - ax) * t + 0.5, y: ay + (by - ay) * t + 0.5 };
    }
    left -= len;
  }
  const last = path[path.length - 1]!;
  return { x: last[0] + 0.5, y: last[1] + 0.5 };
}

/** Which way the lane runs at `dist`: unit x and y. */
export function headingAt(
  path: Level["path"],
  dist: number,
): { dx: number; dy: number } {
  let left = Math.max(0, dist);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    if (left <= len || i === path.length - 1)
      return { dx: Math.sign(bx - ax), dy: Math.sign(by - ay) };
    left -= len;
  }
  return { dx: 1, dy: 0 };
}

const laneCache = new WeakMap<Level["path"], Set<string>>();

/** Where an enemy stands, on whichever lane it walks. */
export function enemyPoint(level: Pick<Level, "path" | "path2">, e: { dist: number; lane?: 1 }) {
  return pointAt(e.lane && level.path2 ? level.path2 : level.path, e.dist);
}

export function laneCells(path: Level["path"]): Set<string> {
  const hit = laneCache.get(path);
  if (hit) return hit;
  const cells = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax;
    let y = ay;
    cells.add(`${x},${y}`);
    while (x !== bx || y !== by) {
      x += dx;
      y += dy;
      cells.add(`${x},${y}`);
    }
  }
  laneCache.set(path, cells);
  return cells;
}

const levelLaneCache = new WeakMap<object, Set<string>>();

/** Every lane cell on the level, both lanes together. */
export function laneCellsOf(level: Pick<Level, "path" | "path2">): Set<string> {
  if (!level.path2) return laneCells(level.path);
  const hit = levelLaneCache.get(level);
  if (hit) return hit;
  const cells = new Set([...laneCells(level.path), ...laneCells(level.path2)]);
  levelLaneCache.set(level, cells);
  return cells;
}

export function isPlot(level: Level, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= level.cols || row >= level.rows)
    return false;
  return !laneCellsOf(level).has(`${col},${row}`);
}

export type PlotKind = "plain" | "high" | "water";

export function plotKind(level: Level, col: number, row: number): PlotKind {
  const t = level.terrain;
  if (!t) return "plain";
  if (t.high.some(([c, r]) => c === col && r === row)) return "high";
  if (t.water.some(([c, r]) => c === col && r === row)) return "water";
  return "plain";
}

/** Where Cath stands at the start: on the lane, two thirds of the way down. */
export function heroPost(level: Level): { x: number; y: number } {
  return pointAt(level.path, pathLength(level.path) * 0.66);
}

/** Cath's abilities that can be cast by hand or left on Auto. */
export type Ability = "pie" | "neighbours" | "rally";
export const ABILITIES: readonly Ability[] = ["pie", "neighbours", "rally"];
export type AutoCast = Record<Ability, boolean>;
/** Nothing casts itself: the default for a player and for the bots, which cast for themselves. */
export const MANUAL: AutoCast = { pie: false, neighbours: false, rally: false };
/** Hand casts before an ability earns its Auto toggle. */
export const AUTO_AFTER_CASTS = 3;
/** How far Cath may stand from her post (she re-aims from it; she never walks to the trouble). */
export const POST_RADIUS = 0.05;

export function newGame(
  level: Level,
  perks: Perks = NO_PERKS,
  auto: Partial<AutoCast> = {},
  heroic = false,
): Game {
  const post = heroPost(level);
  const maxHp = Math.round(HERO.hp * perks.heroHp);
  const goodwill = heroic ? 1 : level.goodwill + perks.goodwill;
  return {
    heroic,
    level,
    tick: 0,
    phase: "build",
    marks: Math.round(level.startMarks * (hasTwist(level, "tight") ? 0.6 : 1)) + perks.marks,
    goodwill,
    maxGoodwill: goodwill,
    wave: 0,
    paid: 0,
    waveClock: 0,
    spawnQueue: [],
    enemies: [],
    towers: [],
    nextId: 1,
    pathLength: pathLength(level.path),
    pathLength2: level.path2 ? pathLength(level.path2) : 0,
    events: [],
    pieCd: 0,
    neighboursCd: 0,
    rallyCd: 0,
    barricade: null,
    rallyLeft: 0,
    perks,
    auto: { ...MANUAL, ...auto },
    aiCd: 0,
    duels: false,
    duel: null,
    dueled: [],
    emitQueue: [],
    popMilli: 0,
    popped: 0,
    leaked: 0,
    hero: {
      x: post.x,
      y: post.y,
      tx: post.x,
      ty: post.y,
      hp: maxHp,
      maxHp,
      damage: (isFleet(level) ? FLEET_HERO_DAMAGE : HERO.damage) * perks.heroDamage,
      cd: 0,
      down: 0,
      holding: [],
      facing: 1,
      kills: 0,
    },
  };
}

export function towerAt(
  game: Game,
  col: number,
  row: number,
): Tower | undefined {
  return game.towers.find(
    (t) => (t.col === col && t.row === row) || (t.annex && t.annex[0] === col && t.annex[1] === row),
  );
}

export function sellValue(tower: Tower): number {
  return Math.floor(tower.spent * 0.7);
}

export function towerCost(game: Pick<Game, "perks" | "level">, kind: TowerKind): number {
  const base = isFleet(game.level) ? FLEET_TOWERS[kind].cost : TOWERS[kind].cost;
  return Math.round(base * (1 - game.perks.discount));
}

/** The price of the next tier (null at tier 3, where the two specialisations are priced separately, and at 4). */
export function upgradeCost(tower: Pick<Tower, "kind" | "tier" | "fleet">): number | null {
  if (tower.tier >= 3) return null;
  if (tower.fleet) return fleetUpgradePrice(tower.kind, tower.tier as 1 | 2);
  return TOWERS[tower.kind].upgrades[tower.tier - 1]!;
}

export function specCost(tower: Pick<Tower, "kind" | "tier" | "fleet">, spec: 0 | 1): number | null {
  if (tower.tier !== 3) return null;
  return tower.fleet ? fleetSpecPrice(tower.kind) : SPECIALISATIONS[tower.kind][spec].cost;
}

export function specsUnlocked(level: Level): boolean {
  return level.id >= SPEC_FIRST_LEVEL;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

export function place(
  game: Game,
  kind: TowerKind,
  col: number,
  row: number,
): ActionResult {
  if (game.phase === "won" || game.phase === "lost")
    return { ok: false, reason: "The level is over." };
  if (!game.level.towers.includes(kind))
    return { ok: false, reason: "Not unlocked yet." };
  if (!towerAllowed(game.level, kind))
    return { ok: false, reason: kind === "pond" ? "The ponds have dried up." : "Scarecrows are banned here." };
  if (isProtected(game.level, col, row))
    return { ok: false, reason: "Protected land: nothing can be built here." };
  if (!isPlot(game.level, col, row))
    return { ok: false, reason: "You can only build beside the lane." };
  if (towerAt(game, col, row))
    return { ok: false, reason: "That plot is taken." };
  if (kind !== "pond" && flooded(game, col, row))
    return { ok: false, reason: "Flooded: only a Duck Pond goes here now." };
  const ground = plotKind(game.level, col, row);
  if (ground === "water" && kind !== "pond")
    return { ok: false, reason: "Too wet: only a Duck Pond goes on water." };
  const cost = towerCost(game, kind);
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` };
  game.marks -= cost;
  game.towers.push({
    id: game.nextId++,
    kind,
    col,
    row,
    tier: 1,
    high: ground === "high" || undefined,
    ...twistMods(game.level, kind),
    spec: null,
    target: "first",
    shots: 0,
    cd: 0,
    spent: cost,
    ...(isFleet(game.level) ? { fleet: true, ko: 0 } : {}),
  });
  return { ok: true };
}

/** Twists that change a tower's numbers for the whole level. */
export function twistMods(level: Level, kind: TowerKind): { rangeMul?: number; dmgMul?: number } {
  let range = 1;
  let dmg = 1;
  if (hasTwist(level, "fog")) range *= 0.8;
  if (hasTwist(level, "night")) range *= 0.75;
  if (hasTwist(level, "wind") && (kind === "scarecrow" || kind === "silo")) dmg *= 0.75;
  if (hasTwist(level, "rain") && kind === "beehive") dmg *= 0.5;
  return { ...(range !== 1 ? { rangeMul: range } : {}), ...(dmg !== 1 ? { dmgMul: dmg } : {}) };
}

/** Protected land: on those levels, every other plot is off limits. */
export function isProtected(level: Level, col: number, row: number): boolean {
  return hasTwist(level, "protected") && (col + row) % 2 === 1;
}

/** Endless: every wave's enemies have this much more health than the last one's (compounding). */
export const ENDLESS_HP_GROWTH = 1.075;

/** Full health for a new enemy: the kind's, scaled by the tuner and by fortified and crowd twists. */
export function spawnHp(game: Game, kind: EnemyKind): number {
  // Fleet levels never scale health: a rung's shell is its shell (difficulty comes from the Round Book).
  const rung = isFleet(game.level) ? RUNGS[kind] : undefined;
  if (rung) return rung.shell;
  let hp = ENEMIES[kind].hp * (game.level.hpScale ?? 1);
  if (game.level.endless) hp *= Math.pow(ENDLESS_HP_GROWTH, game.wave);
  if (hasTwist(game.level, "fortified")) hp *= 1.3;
  if (hasTwist(game.level, "crowd") && !isBig(kind)) hp *= 0.5;
  return Math.round(hp);
}

/** A new enemy on the lane. */
export function makeEnemy(game: Game, kind: EnemyKind, dist: number, lane: 1 | undefined, wave: number | undefined): Enemy {
  const hp = spawnHp(game, kind);
  const shield = ENEMIES[kind].shield;
  return {
    id: game.nextId++,
    kind,
    lane,
    dist,
    hp,
    maxHp: hp,
    slowed: false,
    stun: 0,
    wave,
    ...(shield ? { shield } : {}),
  };
}

/** What a single-target shot does to an enemy still in its bubble wrap. */
export const WRAP_LEAK = 0.15;

/** Pops an enemy's bubble wrap (splash, piercing shots, gusts, pies). */
export function popWrap(game: Game, e: Enemy): void {
  if (!e.shield) return;
  e.shield = 0;
  const q = enemyPoint(game.level, e);
  game.events.push({ type: "pop", x: q.x, y: q.y });
}

export function maxHpOf(e: Enemy): number {
  return e.maxHp ?? ENEMIES[e.kind].hp;
}

/** How fast an enemy moves under the level's twists (before slows). */
export function speedOf(game: Game, e: Enemy): number {
  let v = (isFleet(game.level) ? RUNGS[e.kind]?.speed : undefined) ?? ENEMIES[e.kind].speed;
  if (hasTwist(game.level, "night")) v *= 1.1;
  if (hasTwist(game.level, "rain")) v *= 0.85;
  if (hasTwist(game.level, "fast")) v *= 1.25;
  if (hasTwist(game.level, "wind") && ENEMIES[e.kind].flying) v *= 1.3;
  return v;
}

function armorOf(game: Game, e: Enemy): number {
  const a = ENEMIES[e.kind].armor ?? 0;
  return hasTwist(game.level, "armoured") ? Math.min(0.75, a + 0.25) : a;
}

/** Upgrades a tower one tier. From tier 3 it needs `spec`: which of the two specialisations to take. */
export function upgrade(game: Game, id: number, spec?: 0 | 1): ActionResult {
  const tower = game.towers.find((t) => t.id === id);
  if (!tower) return { ok: false, reason: "No such tower." };
  if (tower.tier >= 4) return { ok: false, reason: "Already fully grown." };
  if (tower.tier === 3) {
    if (!specsUnlocked(game.level))
      return {
        ok: false,
        reason: `Specialisations open at level ${SPEC_FIRST_LEVEL}.`,
      };
    if (spec !== 0 && spec !== 1)
      return { ok: false, reason: "Choose a specialisation." };
    const cost = specCost(tower, spec)!;
    if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` };
    game.marks -= cost;
    tower.spent += cost;
    tower.tier = 4;
    tower.spec = spec;
    return { ok: true };
  }
  const cost = upgradeCost(tower)!;
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` };
  game.marks -= cost;
  tower.spent += cost;
  tower.tier = (tower.tier + 1) as 2 | 3;
  return { ok: true };
}

export function sell(game: Game, id: number): ActionResult {
  const i = game.towers.findIndex((t) => t.id === id);
  if (i < 0) return { ok: false, reason: "No such tower." };
  game.marks += sellValue(game.towers[i]!);
  game.towers.splice(i, 1);
  return { ok: true };
}

export function setTarget(
  game: Game,
  id: number,
  mode: TargetMode,
): ActionResult {
  const tower = game.towers.find((t) => t.id === id);
  if (!tower) return { ok: false, reason: "No such tower." };
  tower.target = mode;
  return { ok: true };
}

/** Marks for calling the next wave before the current one is cleared. */
export function earlyBonus(game: Game): number {
  // Fleet levels: 10 + the stacked round's Book number (section 4).
  const base = isFleet(game.level) ? stackBonus(bookRound(game.level, game.wave + 1)) : 10 + game.wave;
  return Math.round(base * game.perks.earlyBonus);
}

/** True while a wave is out but fully spawned and more waves remain: the next one can be called early. */
export function canCallEarly(game: Game): boolean {
  return (
    game.phase === "wave" &&
    game.wave < game.level.waves.length &&
    game.waveClock >= EARLY_MIN_GAP
  );
}

/** Seconds a wave must have been running before the next can be called (stops double taps sending two). */
export const EARLY_MIN_GAP = 1;

/**
 * Starts the next wave: between waves, or early (for a bonus) at any time once the current one has been
 * on the lane a moment. An early wave's spawns join the queue after whatever is still to come.
 */
export function sendWave(game: Game, forced = false): ActionResult {
  if (game.phase === "won" || game.phase === "lost")
    return { ok: false, reason: "The level is over." };
  if (game.phase === "wave" && !canCallEarly(game))
    return { ok: false, reason: "A wave is already on its way." };
  const groups = game.level.waves[game.wave];
  if (!groups) return { ok: false, reason: "No more waves." };
  const early = game.phase === "wave" && !forced ? earlyBonus(game) : 0;
  const wave = game.wave + 1;
  const queue: Game["spawnQueue"] = [];
  const crowd = hasTwist(game.level, "crowd");
  let total = 0;
  for (const g of groups) {
    const big = isBig(g.enemy);
    const n = crowd && !big ? g.count * 2 : g.count;
    const gap = crowd && !big ? g.gap / 2 : g.gap;
    total += n;
    for (let i = 0; i < n; i++)
      queue.push({ at: g.delay + i * gap, kind: g.enemy, wave, lane: g.lane, ...(g.ambush ? { ambush: g.ambush } : {}) });
  }
  if (hasTwist(game.level, "air")) {
    const extra = Math.ceil(total * 0.4);
    for (let i = 0; i < extra; i++) queue.push({ at: 1.5 + i * 0.7, kind: "drone", wave, lane: i % 2 && game.level.path2 ? 1 : undefined });
  }
  // Re-base everything still queued to a fresh clock, then add the new wave after a short gap.
  const pending = game.phase === "wave" ? game.spawnQueue.map((q) => ({ ...q, at: q.at - game.waveClock })) : [];
  const after = pending.length ? Math.max(0, ...pending.map((q) => q.at)) + 1.5 : 0;
  game.spawnQueue = pending.concat(queue.map((q) => ({ ...q, at: q.at + after }))).sort((a, b) => a.at - b.at);
  game.waveClock = 0;
  game.wave = wave;
  game.phase = "wave";
  game.marks += early;
  const flood = setPiece(game.level, "flood");
  if (flood && wave === flood.wave) {
    for (const t of game.towers)
      if (t.kind !== "pond" && flood.cells.some(([c, r]) => (c === t.col && r === t.row) || (t.annex && t.annex[0] === c && t.annex[1] === r)))
        t.out = Math.max(t.out ?? 0, 15);
    const mid = pointAt(game.level.path, (flood.from + flood.to) / 2);
    game.events.push({ type: "flood", x: mid.x, y: mid.y, warn: false });
  } else if (flood && wave === flood.wave - 1) {
    const mid = pointAt(game.level.path, (flood.from + flood.to) / 2);
    game.events.push({ type: "flood", x: mid.x, y: mid.y, warn: true });
  }
  // Scouts spot the ambushes: where they'll burst out, and how soon.
  const warned = new Set<string>();
  for (const q of game.spawnQueue) {
    if (!q.ambush || q.wave !== wave) continue;
    const k = `${q.lane ?? 0}:${q.ambush}`;
    if (warned.has(k)) continue;
    warned.add(k);
    const len = q.lane ? game.pathLength2 : game.pathLength;
    const p = enemyPoint(game.level, { dist: q.ambush * len, lane: q.lane });
    game.events.push({ type: "ambush", x: p.x, y: p.y, kind: q.kind, lane: q.lane, in: q.at });
  }
  game.events.push(
    early ? { type: "wave", wave, early } : { type: "wave", wave },
  );
  return { ok: true };
}

/** True between rounds: nothing on the lane and nothing still to come, so Cath may change post. */
export function betweenRounds(game: Game): boolean {
  return game.phase === "build" || (game.phase === "wave" && game.enemies.length === 0 && game.spawnQueue.length === 0 && game.emitQueue.length === 0);
}

/**
 * Gives Cath a new post (Hedgerow 2 section 6). Only between rounds: during a round she holds her post.
 * She walks there; she can't hold anything while she walks.
 */
export function moveHero(game: Game, x: number, y: number): ActionResult {
  if (game.phase === "won" || game.phase === "lost")
    return { ok: false, reason: "The level is over." };
  if (game.hero.down > 0)
    return { ok: false, reason: "Cath is catching her breath." };
  if (!betweenRounds(game))
    return { ok: false, reason: "Cath holds her post during a wave. Move her between waves." };
  const cx = Math.min(game.level.cols - 0.3, Math.max(0.3, x));
  const cy = Math.min(game.level.rows - 0.3, Math.max(0.3, y));
  game.hero.tx = cx;
  game.hero.ty = cy;
  return { ok: true };
}

/** A big enemy: a boss. Bosses can't be held, are served injunctions and shrug off half a pie. */
export function isBig(kind: EnemyKind): boolean {
  return ENEMIES[kind].hp >= 1500;
}

/** Heavy plant (bulldozers, trucks, tenders...) and every boss: half-slowed, and too heavy to blow or knock back. */
export function isHeavy(kind: EnemyKind): boolean {
  return !!ENEMIES[kind].heavy || isBig(kind);
}

export type EnemyClass = "light" | "heavy" | "air";

/** What sort of target an enemy is, for TOWER_VS: anything that flies is air, whatever its size. */
export function enemyClass(kind: EnemyKind): EnemyClass {
  return ENEMIES[kind].flying ? "air" : isHeavy(kind) ? "heavy" : "light";
}

/**
 * Hard counters: each tower's damage against each class of enemy. Turnips and gusts bring down drones,
 * stings and splashes shred light traffic, and only grain-shot and seed sacks really dent heavy plant.
 */
export const TOWER_VS: Partial<Record<TowerKind, Partial<Record<EnemyClass, number>>>> = {
  scarecrow: { air: 1.6, heavy: 0.45 },
  beehive: { light: 1.4, heavy: 0.3 },
  pond: { light: 1.2, heavy: 0.4 },
  barn: { heavy: 0.6 },
  silo: { heavy: 1.8, light: 0.55 },
  windmill: { air: 1.7, heavy: 0.4 },
  cannon: { heavy: 1.35, light: 0.8 },
};

/** How hard an enemy hits Cath while she holds it, in hit points a second. */
export function enemyHit(kind: EnemyKind): number {
  return Math.min(30, Math.max(5, ENEMIES[kind].hp / 14));
}

/** Scarecrows spook each other: each other Scarecrow in the eight plots around one slows its throwing by 20%. */
export const SCARECROW_CROWDING = 0.2;
export function crowding(game: Game, t: Tower): number {
  if (t.kind !== "scarecrow" || t.mega) return 1;
  let n = 0;
  for (const o of game.towers)
    if (o !== t && o.kind === "scarecrow" && !o.mega && Math.max(Math.abs(o.col - t.col), Math.abs(o.row - t.row)) === 1) n++;
  return 1 + SCARECROW_CROWDING * n;
}

/** Lawyers' paperwork: towers in range fire at half rate. */
function jammed(game: Game, t: Tower): boolean {
  if (ctx && !ctx.jam) return false;
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].jam;
    if (!r || e.hp <= 0) continue;
    const p = enemyPoint(game.level, e);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

/** A lobbyist's whispers: a specialised tower in range forgets its branch and fights as a plain tier 3. */
export function lobbied(game: Game, t: Tower): boolean {
  if (t.tier < 4 || t.mega) return false;
  if (ctx && !ctx.lobby) return false;
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].lobby;
    if (!r || e.hp <= 0) continue;
    const p = enemyPoint(game.level, e);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

/** An influencer's followers are watching it, not the road: towers in its charm range hold fire. */
export function charmed(game: Game, t: Tower): boolean {
  if (ctx && !ctx.charm) return false;
  for (const c of game.towers) {
    const cs = towerStats(c);
    if (cs.cleanse && Math.hypot(c.col - t.col, c.row - t.row) <= cs.range)
      return false;
  }
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].charm;
    if (!r || e.hp <= 0) continue;
    const p = enemyPoint(game.level, e);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

/** Radio Masts see through stealth: an enemy within a mast's range is revealed and marked. */
export function markMultiplier(game: Game, e: Enemy): number {
  if (ctx && !ctx.reveal) return 1;
  const p = enemyPoint(game.level, e);
  let m = 1;
  for (const t of game.towers) {
    const s = towerStats(t);
    if (s.reveal <= 1) continue;
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= s.range)
      m = Math.max(m, s.reveal);
  }
  return m;
}

export function isRevealed(game: Game, e: Enemy): boolean {
  const dark = setPiece(game.level, "blackout");
  if (dark && !lit(game, e, dark.light)) return false;
  if (!ENEMIES[e.kind].stealth || markMultiplier(game, e) > 1) return true;
  // Cath spots anything sneaking past close to her (unless she's down or away).
  const h = game.hero;
  if (h.down > 0 || hasTwist(game.level, "nocath")) return false;
  const p = enemyPoint(game.level, e);
  return Math.hypot(p.x - h.x, p.y - h.y) <= CATH_SPOTS;
}

/** Blackout: is the enemy within the light of a working tower, or of Cath? */
function lit(game: Game, e: Enemy, light: number): boolean {
  const p = enemyPoint(game.level, e);
  const h = game.hero;
  if (h.down <= 0 && !hasTwist(game.level, "nocath") && Math.hypot(p.x - h.x, p.y - h.y) <= light) return true;
  for (const t of game.towers) {
    if ((t.out ?? 0) > 0) continue;
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= light) return true;
  }
  return false;
}

/** The slowest anything can be made to go, as a share of its speed. */
export const SLOW_FLOOR = 0.3;

/** How close a stealth vehicle has to come before Cath sees it. */
export const CATH_SPOTS = 1.3;

function damageEnemy(
  game: Game,
  e: Enemy,
  amount: number,
  ignoresArmour: boolean,
  by?: number,
): void {
  if (isFleet(game.level)) {
    hitEnemy(game, e, amount, by);
    return;
  }
  const armor = armorOf(game, e);
  e.hp -= (ignoresArmour ? amount : amount * (1 - armor)) * markMultiplier(game, e);
}

/**
 * Fleet levels (Hedgerow 2 section 1): `amount` layers off a vehicle. Each layer pays a Mark (in fixed point)
 * and counts towards the hitting tower's Knockouts. When the shell is gone the vehicle becomes its first
 * child on the same frame (same id, same spot) and the overflow carries into it; further children spawn
 * CHILD_GAP cells behind, or wait in the emission queue while the lane is at LIVE_CAP. Returns the layers
 * knocked off. Deterministic: children are made in the rung table's order.
 */
export function hitEnemy(game: Game, e: Enemy, amount: number, by?: number): number {
  if (!(amount > 0) || e.hp <= 0) return 0;
  const from = e.kind;
  let left = amount;
  let removed = 0;
  while (left > 1e-9 && e.hp > 0) {
    const take = Math.min(left, e.hp);
    e.hp -= take;
    left -= take;
    removed += take;
    if (e.hp > 1e-9) break;
    const kids = RUNGS[e.kind]?.children ?? [];
    if (!kids.length) {
      e.hp = 0;
      break;
    }
    // Pop: the shell is gone, the next rung down carries on from the same spot.
    const first = kids[0]!;
    e.kind = first;
    e.hp = e.maxHp = spawnHp(game, first);
    e.shield = undefined;
    for (let i = 1; i < kids.length; i++) {
      const dist = Math.max(0, e.dist - i * CHILD_GAP);
      if (game.enemies.length >= LIVE_CAP) game.emitQueue.push({ kind: kids[i]!, dist, lane: e.lane, wave: e.wave });
      else game.enemies.push(makeEnemy(game, kids[i]!, dist, e.lane, e.wave));
    }
  }
  if (removed <= 0) return 0;
  payLayers(game, removed, by);
  const p = enemyPoint(game.level, e);
  game.events.push({ type: "knock", x: p.x, y: p.y, from, to: e.hp > 0 ? e.kind : null, n: removed, ...(by !== undefined ? { tower: by } : {}) });
  return removed;
}

/** Fleet levels: a Mark a layer (less after round 50), paid as whole Marks, and the tower's Knockouts. */
function payLayers(game: Game, layers: number, by?: number): void {
  game.popped += layers;
  game.popMilli += Math.round(layers * popRate(bookRound(game.level, Math.max(1, game.wave))));
  const whole = Math.floor(game.popMilli / 1000);
  if (whole > 0) {
    game.marks += whole;
    game.popMilli -= whole * 1000;
  }
  if (by !== undefined && by >= 0) {
    const t = ctx ? ctx.byId.get(by) : game.towers.find((x) => x.id === by);
    if (t) t.ko = (t.ko ?? 0) + layers;
  }
}

/** Fleet Value still on a vehicle: what's left of its shell plus all its children. */
export function remainingFV(e: Pick<Enemy, "kind" | "hp">): number {
  const kids = RUNGS[e.kind]?.children ?? [];
  return Math.max(0, e.hp) + kids.reduce((a, k) => a + fvOf(k), 0);
}

function stepHero(game: Game): void {
  const h = game.hero;
  if (hasTwist(game.level, "nocath")) return;
  if (h.down > 0) {
    h.down = Math.max(0, h.down - STEP);
    if (h.down === 0) {
      h.hp = h.maxHp;
      game.events.push({ type: "heroUp" });
    }
    return;
  }
  // Walking.
  const dx = h.tx - h.x;
  const dy = h.ty - h.y;
  const d = Math.hypot(dx, dy);
  if (d > 0.02) {
    const stepLen = Math.min(d, HERO.speed * game.perks.heroSpeed * STEP);
    h.x += (dx / d) * stepLen;
    h.y += (dy / d) * stepLen;
    if (Math.abs(dx) > 0.01) h.facing = dx > 0 ? 1 : -1;
    h.holding = [];
  } else {
    // Holding: keep what's still in reach, then pick up more, furthest along first.
    const byId = new Map(game.enemies.map((e) => [e.id, e]));
    h.holding = h.holding.filter((id) => {
      const e = byId.get(id);
      if (!e || e.hp <= 0) return false;
      const p = enemyPoint(game.level, e);
      return Math.hypot(p.x - h.x, p.y - h.y) <= HERO.reach + 0.25;
    });
    const holds = HERO.holds + game.perks.heroHolds;
    if (h.holding.length < holds) {
      const near = game.enemies
        .filter((e) => {
          if (e.hp <= 0 || h.holding.includes(e.id)) return false;
          const spec = ENEMIES[e.kind];
          if (spec.flying || isBig(e.kind) || !isRevealed(game, e))
            return false;
          const p = enemyPoint(game.level, e);
          return Math.hypot(p.x - h.x, p.y - h.y) <= HERO.reach;
        })
        .sort((a, b) => b.dist - a.dist || a.id - b.id);
      for (const e of near) {
        if (h.holding.length >= holds) break;
        h.holding.push(e.id);
      }
    }
  }
  for (const e of game.enemies) e.held = h.holding.includes(e.id);

  // Held enemies hit back.
  let hurt = 0;
  for (const e of game.enemies) if (e.held) hurt += enemyHit(e.kind);
  for (const e of game.enemies) {
    const ram = ENEMIES[e.kind].ram;
    if (!ram || e.hp <= 0 || e.dist <= 0) continue;
    const p = enemyPoint(game.level, e);
    if (Math.hypot(p.x - h.x, p.y - h.y) <= 1.1 && !e.held) hurt += ram;
  }
  if (hurt > 0) h.hp -= hurt * game.perks.holdGuard * (learning(game.level) ? LEARNING_HURT : 1) * STEP;
  else h.hp = Math.min(h.maxHp, h.hp + HERO.regen * STEP);
  if (h.hp <= 0) {
    h.hp = 0;
    h.down = HERO.respawn * game.perks.heroRespawn;
    h.holding = [];
    for (const e of game.enemies) {
      if (e.held) e.dropped = true;
      e.held = false;
    }
    game.events.push({ type: "heroDown" });
    return;
  }

  // Swinging the rolling pin (Hedgerow 2 M1): her hands are full with what she holds (the towers finish
  // those), so she swings only at anything else within reach. She holds the line without farming the kills.
  h.cd -= STEP;
  if (h.cd > 0) return;
  let target: Enemy | undefined;
  let best = Infinity;
  for (const e of game.enemies) {
    if (e.hp <= 0 || e.held || !isRevealed(game, e)) continue;
    const p = enemyPoint(game.level, e);
    const dd = Math.hypot(p.x - h.x, p.y - h.y);
    if (dd <= HERO.reach + 0.15 && dd < best) {
      best = dd;
      target = e;
    }
  }
  let dmg = h.damage;
  if (!target && learning(game.level)) {
    // Levels 1-5: with nothing else in reach she works on what she holds, gently, so a thin build that
    // misses her post doesn't lose the van she has pinned. The towers still take most of the kills.
    target = game.enemies.find((e) => e.held && e.hp > 0);
    dmg = h.damage * HELD_SWING;
  }
  if (!target) {
    h.cd = 0;
    return;
  }
  const before = target.hp;
  damageEnemy(game, target, dmg, false, -1);
  if (before > 0 && target.hp <= 0) h.kills += 1;
  const p = enemyPoint(game.level, target);
  h.facing = p.x >= h.x ? 1 : -1;
  h.cd = HERO.cooldown;
  game.events.push({ type: "swing", x: p.x, y: p.y });
}

/** Is Cath's post inside the reach of a tower that does damage? She holds vehicles for the towers to finish. */
export function heroCovered(game: Game, x = game.hero.tx, y = game.hero.ty): boolean {
  for (const t of game.towers) {
    const s = towerStats(t);
    if (s.damage > 0 && Math.hypot(t.col + 0.5 - x, t.row + 0.5 - y) <= s.range) return true;
  }
  return false;
}

/**
 * Where to draw Cath's post between rounds (M1 review): her post, or where she'd stand if put down at
 * `preview`, and whether a tower reaches it. Nothing during a round, while she's down or on a no-Cath level.
 */
export function postMarker(game: Game, preview: { x: number; y: number } | null = null): { x: number; y: number; covered: boolean } | null {
  if (hasTwist(game.level, "nocath") || game.hero.down > 0 || game.phase === "won" || game.phase === "lost" || !betweenRounds(game)) return null;
  const p = preview ?? { x: game.hero.tx, y: game.hero.ty };
  return { x: p.x, y: p.y, covered: heroCovered(game, p.x, p.y) };
}

/** Levels 1-5 teach the game: Cath finishes what she holds (gently) and takes less from it. */
export function learning(level: Level): boolean {
  return level.id <= 5 && !level.endless;
}
/** Her swing at a held vehicle on the learning levels, as a share of her damage. */
export const HELD_SWING = 0.2;
/** What held vehicles do to her on the learning levels, as a share. */
export const LEARNING_HURT = 0.6;

/** Lane distance remaining to the farmhouse for an enemy (on whichever lane it's on). */
function toGo(game: Game, e: Enemy): number {
  return (e.lane ? game.pathLength2 : game.pathLength) - e.dist;
}

/**
 * Casting sense: the pie on the thickest crowd or a boss, the neighbours when something nears the farmhouse,
 * a rally on a big wave. The engine runs it only for abilities on Auto; the level bots call it themselves
 * (they stand in for a competent player pressing the buttons).
 */
export function castAbilities(game: Game, which: Partial<AutoCast> = { pie: true, neighbours: true, rally: true }): void {
  if (game.phase !== "wave" || game.enemies.length === 0) return;
  if (which.pie && !game.heroic && pieUnlocked(game.level) && game.pieCd <= 0) {
    const r = pieRadius(game);
    let best: Enemy | undefined;
    let bestScore = 0;
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const p = enemyPoint(game.level, e);
      let score = isBig(e.kind) ? 6 : 0;
      for (const o of game.enemies) {
        if (o.hp <= 0) continue;
        const q = enemyPoint(game.level, o);
        if (Math.hypot(q.x - p.x, q.y - p.y) <= r) score += 1;
      }
      if (score > bestScore || (score === bestScore && best && toGo(game, e) < toGo(game, best))) {
        best = e;
        bestScore = score;
      }
    }
    if (best && bestScore >= 5) {
      const p = enemyPoint(game.level, best);
      throwPie(game, p.x, p.y);
    }
  }
  if (which.neighbours && neighboursUnlocked(game.level) && game.neighboursCd <= 0 && game.enemies.some((e) => e.hp > 0 && toGo(game, e) < 3))
    callNeighbours(game);
  if (
    which.rally &&
    rallyUnlocked(game.level) &&
    game.rallyCd <= 0 &&
    (game.enemies.length >= 10 || game.enemies.some((e) => isBig(e.kind)))
  )
    callRally(game);
}

function pickTarget(
  game: Game,
  t: Tower,
  range: number,
): Enemy | undefined {
  const mode = t.target ?? "first";
  let target: Enemy | undefined;
  let best = -Infinity;
  const air = towerStats(t).air;
  if (ctx && isFleet(game.level)) {
    // Fleet levels: only what the lane index puts in reach; ties go to the earliest on the lane list, as a scan would.
    let bestAt = Infinity;
    for (const i of candidates(game, towerWindowsOf(game, t, range))) {
      const e = game.enemies[i]!;
      if (e.hp <= 0 || !isRevealed(game, e)) continue;
      if (!air && ENEMIES[e.kind].flying) continue;
      const p = enemyPoint(game.level, e);
      const d = Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y);
      if (d > range) continue;
      const score = mode === "first" ? e.dist : mode === "last" ? -e.dist : mode === "strong" ? e.hp : -d;
      if (score > best || (score === best && i < bestAt)) {
        best = score;
        bestAt = i;
        target = e;
      }
    }
    return target;
  }
  for (const e of game.enemies) {
    if (e.hp <= 0 || !isRevealed(game, e)) continue;
    if (!air && ENEMIES[e.kind].flying) continue;
    const p = enemyPoint(game.level, e);
    const d = Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y);
    if (d > range) continue;
    const score =
      mode === "first"
        ? e.dist
        : mode === "last"
          ? -e.dist
          : mode === "strong"
            ? e.hp
            : -d;
    if (score > best) {
      best = score;
      target = e;
    }
  }
  return target;
}

// ---- per-step lookups (docs/design/hedgerow-2.md section 8: 350 vehicles and 40 towers in 2 ms) ----

/**
 * Built once at the top of a step and dropped at its end, so the hot loops don't redo work that can't change
 * within a step: towers by id, which towers slow, boost or reveal, whether any disruptor is on the lane, and
 * (fleet levels) the vehicles sorted by lane distance so a tower finds what's in its reach by binary search
 * instead of scanning every vehicle. Every answer is exactly what the plain scan would give.
 */
interface StepCtx {
  byId: Map<number, Tower>;
  /** Any tower that reveals (and marks) stealth. */
  reveal: boolean;
  charm: boolean;
  jam: boolean;
  lobby: boolean;
  /** Towers whose buff or aura multiplies others' damage, in field order. */
  boosters: Array<{ t: Tower; s: TowerStats }>;
  /** Fleet levels: the lane index (null until first asked for, or after something moved). */
  lanes: LaneIndex | null;
}
interface LaneIndex {
  /** Per lane (0 and 1): vehicles sorted by distance, then by place in game.enemies. */
  dist: [number[], number[]];
  at: [number[], number[]];
  /** game.enemies.length when built: anything after it (children popped this step) is checked one by one. */
  built: number;
}
let ctx: StepCtx | null = null;

function laneIndex(game: Game): LaneIndex {
  if (ctx!.lanes) return ctx!.lanes;
  const rows: [Array<[number, number]>, Array<[number, number]>] = [[], []];
  game.enemies.forEach((e, i) => rows[e.lane && game.level.path2 ? 1 : 0].push([e.dist, i]));
  const idx: LaneIndex = { dist: [[], []], at: [[], []], built: game.enemies.length };
  for (const l of [0, 1] as const) {
    rows[l].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    idx.dist[l] = rows[l].map((r) => r[0]);
    idx.at[l] = rows[l].map((r) => r[1]);
  }
  ctx!.lanes = idx;
  return idx;
}

/** Something moved along the lane mid-step (knockback, a gust): rebuild the index when next asked. */
function laneMoved(): void {
  if (ctx) ctx.lanes = null;
}

const WINDOW_EPS = 1e-6;
/**
 * The stretches of a lane (as [from, to] distances) whose points lie within `r` of (x, y): one per straight
 * at most, since distance to a line is convex. Padded by a hair so an exact range check on what they hold
 * gives the same answer as checking every vehicle.
 */
export function laneWindows(path: Level["path"], x: number, y: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (path.length < 2) return [[-Infinity, Infinity]];
  const rr = r + WINDOW_EPS;
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    const last = i === path.length - 1;
    if (len === 0) {
      if (last && Math.hypot(ax + 0.5 - x, ay + 0.5 - y) <= rr) out.push([acc - WINDOW_EPS, Infinity]);
      continue;
    }
    // Point at s along this straight: A + (B - A) * s / len. Solve |P(s) - C|^2 <= rr^2 for s.
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const ox = ax + 0.5 - x;
    const oy = ay + 0.5 - y;
    const qa = ux * ux + uy * uy;
    const qb = 2 * (ox * ux + oy * uy);
    const qc = ox * ox + oy * oy - rr * rr;
    const disc = qb * qb - 4 * qa * qc;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const s1 = (-qb - sq) / (2 * qa);
      const s2 = (-qb + sq) / (2 * qa);
      if (s2 >= -WINDOW_EPS && s1 <= len + WINDOW_EPS) {
        const lo = acc + Math.max(0, s1) - WINDOW_EPS;
        // Past the lane's end everything stands on its last point.
        const hi = last && s2 >= len ? Infinity : acc + Math.min(len, s2) + WINDOW_EPS;
        out.push([lo, hi]);
      }
    }
    acc += len;
  }
  // Merge touching stretches.
  out.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const w of out) {
    const top = merged[merged.length - 1];
    if (top && w[0] <= top[1]) top[1] = Math.max(top[1], w[1]);
    else merged.push([w[0], w[1]]);
  }
  return merged;
}

const towerWindows = new WeakMap<Tower, { col: number; row: number; r: number; level: Level; w: [Array<[number, number]>, Array<[number, number]>] }>();
function windowsOf(game: Game, x: number, y: number, r: number): [Array<[number, number]>, Array<[number, number]>] {
  return [laneWindows(game.level.path, x, y, r), game.level.path2 ? laneWindows(game.level.path2, x, y, r) : []];
}
function towerWindowsOf(game: Game, t: Tower, r: number) {
  const hit = towerWindows.get(t);
  if (hit && hit.col === t.col && hit.row === t.row && hit.r === r && hit.level === game.level) return hit.w;
  const w = windowsOf(game, t.col + 0.5, t.row + 0.5, r);
  towerWindows.set(t, { col: t.col, row: t.row, r, level: game.level, w });
  return w;
}

/**
 * Places in game.enemies of every vehicle that might be inside these windows (a superset: callers still check
 * the exact range), plus everything that joined the lane since the index was built.
 */
function candidates(game: Game, w: [Array<[number, number]>, Array<[number, number]>]): number[] {
  const idx = laneIndex(game);
  const out: number[] = [];
  for (const l of [0, 1] as const) {
    const ds = idx.dist[l];
    for (const [lo, hi] of w[l]) {
      let a = 0;
      let b = ds.length;
      while (a < b) {
        const m = (a + b) >> 1;
        if (ds[m]! < lo) a = m + 1;
        else b = m;
      }
      for (let k = a; k < ds.length && ds[k]! <= hi; k++) out.push(idx.at[l][k]!);
    }
  }
  for (let i = idx.built; i < game.enemies.length; i++) out.push(i);
  return out;
}

export function stepGame(game: Game): void {
  if (game.phase !== "wave") return;
  if (game.duel) {
    // The battlefield holds its breath while Cath and the boss square up.
    game.duel.clock += STEP;
    if (game.duel.clock >= DUEL_AUTO) duelStrike(game, 0.5);
    return;
  }
  const byId = new Map<number, Tower>();
  const boosters: StepCtx["boosters"] = [];
  let reveal = false;
  for (const t of game.towers) {
    byId.set(t.id, t);
    const s = towerStats(t);
    if (s.reveal > 1) reveal = true;
    if (s.buff > 1 || s.aura > 1) boosters.push({ t, s });
  }
  ctx = { byId, reveal, charm: true, jam: true, lobby: true, boosters, lanes: null };
  try {
    step(game);
  } finally {
    ctx = null;
  }
}

function step(game: Game): void {
  game.tick += 1;
  const fleet = isFleet(game.level);
  const bridge = setPiece(game.level, "bridge");
  if (bridge && bridgeOpen(game) !== bridgeOpen(game, game.tick - 1)) {
    const p = enemyPoint(game.level, { dist: bridge.dist, lane: bridge.lane });
    game.events.push({ type: "bridge", open: bridgeOpen(game), x: p.x, y: p.y });
  }
  game.waveClock += STEP;
  if (game.pieCd > 0) game.pieCd = Math.max(0, game.pieCd - STEP);
  if (game.neighboursCd > 0) game.neighboursCd = Math.max(0, game.neighboursCd - STEP);
  if (game.rallyCd > 0) game.rallyCd = Math.max(0, game.rallyCd - STEP);
  if (game.rallyLeft > 0) game.rallyLeft = Math.max(0, game.rallyLeft - STEP);
  if (game.barricade) {
    game.barricade.left -= STEP;
    if (game.barricade.left <= 0) game.barricade = null;
  }
  game.aiCd -= STEP;
  if (game.aiCd <= 0) {
    game.aiCd = 0.5;
    if (game.auto.pie || game.auto.neighbours || game.auto.rally) castAbilities(game, game.auto);
  }

  while (
    game.spawnQueue.length > 0 &&
    game.spawnQueue[0]!.at <= game.waveClock
  ) {
    const next = game.spawnQueue.shift()!;
    const len = next.lane ? game.pathLength2 : game.pathLength;
    const e = makeEnemy(game, next.kind, next.ambush ? next.ambush * len : 0, next.lane, next.wave ?? game.wave);
    game.enemies.push(e);
    if (game.duels && isBig(next.kind) && !game.duel && !game.dueled.includes(next.kind)) startDuel(game, e);
  }
  // Fleet children that waited for room on the lane come out in the order they popped.
  while (game.emitQueue.length > 0 && game.enemies.length < LIVE_CAP) {
    const q = game.emitQueue.shift()!;
    game.enemies.push(makeEnemy(game, q.kind, q.dist, q.lane, q.wave));
  }
  // Rush hour: once a wave is all on the lane, the next follows 6 s later whether you're ready or not.
  if (hasTwist(game.level, "rush") && game.spawnQueue.length === 0 && game.wave < game.level.waves.length) {
    game.rushIn = (game.rushIn ?? 6) - STEP;
    if (game.rushIn <= 0) {
      game.rushIn = 6;
      game.waveClock = Math.max(game.waveClock, EARLY_MIN_GAP);
      sendWave(game, true);
    }
  } else game.rushIn = 6;

  stepHero(game);
  bossMoves(game);
  for (const t of game.towers) if (t.out && t.out > 0) t.out = Math.max(0, t.out - STEP);

  // Hedgerows slow whatever is in range; the strongest one wins, they don't stack. Honey sticks.
  const slowers: Array<{ t: Tower; s: TowerStats }> = [];
  for (const t of game.towers) {
    const s = towerStats(t);
    if (s.slow < 1 && towerActive(t)) slowers.push({ t, s });
  }
  for (const enemy of game.enemies) {
    const p = enemyPoint(game.level, enemy);
    const flying = !!ENEMIES[enemy.kind].flying;
    let factor = 1;
    for (const { t, s } of slowers) {
      if (flying && !s.air) continue;
      if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= s.range)
        factor = Math.min(factor, 1 - ((1 - s.slow) / game.perks.slow) * (hasTwist(game.level, "drought") ? 0.7 : 1));
    }
    if (enemy.stickyLeft && enemy.stickyLeft > 0) {
      factor = Math.min(factor, enemy.sticky ?? 1);
      enemy.stickyLeft -= STEP;
    }
    // Heavy plant ploughs on through hedges and honey at half the slow, and nothing stops anything outright.
    if (isHeavy(enemy.kind)) factor = 1 - (1 - factor) / 2;
    factor = Math.max(SLOW_FLOOR, factor);
    enemy.slowed = factor < 1;
    if (enemy.gustCd && enemy.gustCd > 0) enemy.gustCd -= STEP;
    if (enemy.stun > 0) enemy.stun -= STEP;
    else if (!enemy.held) {
      let move =
        speedOf(game, enemy) * factor * (enemy.charge && enemy.charge > 0 ? 2.2 : 1) * STEP;
      const flood = setPiece(game.level, "flood");
      if (flood && !enemy.lane && game.wave >= flood.wave && enemy.dist >= flood.from && enemy.dist <= flood.to && !ENEMIES[enemy.kind].flying)
        move *= 0.6;
      const bridge = setPiece(game.level, "bridge");
      if (bridge && (enemy.lane ?? 0) === (bridge.lane ?? 0) && enemy.dist <= bridge.dist && !ENEMIES[enemy.kind].flying && bridgeOpen(game))
        move = Math.max(0, Math.min(move, bridge.dist - enemy.dist));
      const bar = game.barricade;
      if (bar && enemy.lane === bar.lane && enemy.dist <= bar.dist) {
        // Farmhands stop anything on foot dead; bosses only slow to a crawl.
        if (isBig(enemy.kind)) move *= 0.25;
        else move = Math.max(0, Math.min(move, bar.dist - enemy.dist));
      }
      enemy.dist += move;
    }
    if (enemy.poisonLeft && enemy.poisonLeft > 0) {
      if (fleet) hitEnemy(game, enemy, (enemy.poison ?? 0) * STEP, enemy.lastHit);
      else enemy.hp -= (enemy.poison ?? 0) * STEP;
      enemy.poisonLeft -= STEP;
    }
  }

  // Carriers launch drones from their own spot on the lane.
  const launched: Enemy[] = [];
  for (const c of game.enemies) {
    const l = ENEMIES[c.kind].launch;
    if (!l || c.hp <= 0 || c.dist <= 0) continue;
    c.launchCd = (c.launchCd ?? l.every) - STEP;
    if (c.launchCd > 0) continue;
    c.launchCd = l.every;
    for (let i = 0; i < l.count; i++) launched.push(makeEnemy(game, l.kind, Math.max(0, c.dist - i * 0.3), c.lane, c.wave));
    const p = enemyPoint(game.level, c);
    game.events.push({ type: "split", x: p.x, y: p.y, kind: l.kind });
  }
  game.enemies.push(...launched);

  // Clinic-in-a-Box and friends patch up whatever is beside them.
  for (const h of game.enemies) {
    const heal = ENEMIES[h.kind].heal;
    if (!heal || h.hp <= 0) continue;
    for (const e of game.enemies) {
      if (e === h || e.hp <= 0) continue;
      if (Math.abs(e.dist - h.dist) <= 1.6)
        e.hp = Math.min(maxHpOf(e), e.hp + heal * STEP);
    }
  }

  // Disruptors on the lane (children popped below can't be one, so this holds for the rest of the step).
  ctx!.charm = ctx!.jam = ctx!.lobby = false;
  for (const e of game.enemies) {
    const k = ENEMIES[e.kind];
    if (k.charm) ctx!.charm = true;
    if (k.jam) ctx!.jam = true;
    if (k.lobby) ctx!.lobby = true;
  }
  for (const t of game.towers) {
    const spec = lobbied(game, t) ? towerStats({ ...t, tier: 3, spec: null }) : towerStats(t);
    if (!towerActive(t)) continue;
    // Blackthorn scratches everything in reach, all the time.
    if (spec.thorns > 0) {
      for (const e of game.enemies) {
        if (e.hp <= 0 || (!spec.air && ENEMIES[e.kind].flying)) continue;
        const p = enemyPoint(game.level, e);
        if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= spec.range) {
          damageEnemy(game, e, spec.thorns * STEP, false, t.id);
          e.lastHit = t.id;
        }
      }
    }
    // Windmills: a gust every few seconds shoves everything in reach back up the lane and batters it.
    if (spec.gustEvery > 0) {
      t.gustCd = (t.gustCd ?? spec.gustEvery * 0.5) - STEP;
      if (t.gustCd <= 0) {
        let blew = false;
        // On fleet levels a gust batters at most `pierce` vehicles (it still blows back everything in reach).
        let batter = fleet ? spec.pierce : Infinity;
        for (const e of [...game.enemies]) {
          if (e.hp <= 0 || !isRevealed(game, e) || (!spec.air && ENEMIES[e.kind].flying)) continue;
          const q = enemyPoint(game.level, e);
          if (Math.hypot(t.col + 0.5 - q.x, t.row + 0.5 - q.y) > spec.range) continue;
          blew = true;
          e.lastHit = t.id;
          popWrap(game, e);
          if (!spec.splash && spec.damage > 0 && batter-- > 0)
            damageEnemy(
              game,
              e,
              fleet ? Math.max(1, Math.round(spec.damage * game.perks.towerDamage)) : spec.damage * game.perks.towerDamage * spec.vs[enemyClass(e.kind)],
              spec.ignoresArmour,
              t.id,
            );
          if (!isHeavy(e.kind) && !e.held && (e.gustCd ?? 0) <= 0) {
            e.dist = Math.max(0, e.dist - spec.gustPush);
            e.gustCd = 2;
            laneMoved();
          }
        }
        if (blew) {
          game.events.push({ type: "gust", tower: t.id, x: t.col + 0.5, y: t.row + 0.5, radius: spec.range });
          t.gustCd = spec.gustEvery;
        } else t.gustCd = 0;
      }
      // A plain windmill does all its work in the gust.
      if (!spec.splash) continue;
    }
    if (spec.injunction > 0) {
      t.cd -= STEP;
      if (t.cd > 0) continue;
      let served = false;
      for (const e of game.enemies) {
        if (e.hp <= 0 || (!isBig(e.kind) && !spec.classAction)) continue;
        const p = enemyPoint(game.level, e);
        if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= spec.range) {
          e.stun = Math.max(e.stun, spec.injunction);
          served = true;
        }
      }
      if (served)
        game.events.push({ type: "injunction", x: t.col + 0.5, y: t.row + 0.5 });
      t.cd = served ? spec.cooldown : 0;
      continue;
    }
    if (spec.damage === 0) continue;
    t.cd -= game.rallyLeft > 0 ? STEP * RALLY_SPEEDUP : STEP;
    if (t.cd > 0 && jammed(game, t)) t.cd += STEP / 2;
    if (t.cd > 0) continue;
    if (charmed(game, t)) {
      t.cd = 0;
      continue;
    }
    const target = pickTarget(game, t, spec.range);
    if (!target) {
      t.cd = 0;
      continue;
    }
    const p = enemyPoint(game.level, target);
    let dmg = spec.damage * game.perks.towerDamage;
    for (const { t: b, s: bs } of ctx!.boosters) {
      if (bs.buff > 1 && Math.hypot(b.col - t.col, b.row - t.row) <= bs.range)
        dmg *= bs.buff;
      if (bs.aura > 1) dmg *= bs.aura;
    }
    t.shots = (t.shots ?? 0) + 1;
    const crit = !!spec.crit && t.shots % spec.crit.every === 0;
    if (crit) dmg *= spec.crit!.mult;
    // Fleet hits are whole layers.
    if (fleet) dmg = Math.max(1, Math.round(dmg));
    const area = spec.splash > 0 || spec.ignoresArmour;
    const hit = (e: Enemy) => {
      e.lastHit = t.id;
      const d = fleet ? dmg : dmg * spec.vs[enemyClass(e.kind)];
      if (e.shield && !area) damageEnemy(game, e, d * WRAP_LEAK, false, t.id);
      else {
        popWrap(game, e);
        damageEnemy(game, e, d, spec.ignoresArmour, t.id);
      }
      if (spec.poison) {
        e.poison = spec.poison.dps;
        e.poisonLeft = spec.poison.secs;
      }
      if (spec.sticky) {
        e.sticky = spec.sticky.factor;
        e.stickyLeft = spec.sticky.secs;
      }
      if (spec.knockback && !isHeavy(e.kind) && !e.held) {
        e.dist = Math.max(0, e.dist - spec.knockback);
        laneMoved();
      }
    };
    hit(target);
    if (fleet) {
      // Pierce: the shot carries on into whatever is beside its target (or, for splash, under the burst),
      // nearest first, and leftover pierce reaches children that popped out this very tick.
      const reach = spec.splash > 0 ? spec.splash : PIERCE_REACH;
      const done = new Set<number>([target.id]);
      let left = spec.pierce - 1;
      const w = windowsOf(game, p.x, p.y, reach);
      for (let pass = 0; pass < 4 && left > 0; pass++) {
        const near: Array<{ e: Enemy; d: number }> = [];
        for (const i of candidates(game, w)) {
          const e = game.enemies[i]!;
          if (done.has(e.id) || e.hp <= 0 || (!spec.air && ENEMIES[e.kind].flying) || !isRevealed(game, e)) continue;
          const q = enemyPoint(game.level, e);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d <= reach) near.push({ e, d });
        }
        if (!near.length) break;
        near.sort((a, b) => a.d - b.d || a.e.id - b.e.id);
        for (const { e } of near) {
          if (left <= 0) break;
          done.add(e.id);
          hit(e);
          left--;
        }
      }
    } else if (spec.splash) {
      for (const e of game.enemies) {
        if (e === target || e.hp <= 0) continue;
        if (!spec.air && ENEMIES[e.kind].flying) continue;
        const q = enemyPoint(game.level, e);
        if (Math.hypot(q.x - p.x, q.y - p.y) <= spec.splash) hit(e);
      }
    }
    t.cd = spec.cooldown * (fleet ? 1 : crowding(game, t));
    game.events.push({
      type: "shot",
      kind: t.kind,
      tower: t.id,
      enemy: target.id,
      fromX: t.col + 0.5,
      fromY: t.row + 0.5,
      toX: p.x,
      toY: p.y,
      crit,
      spec: t.spec ?? null,
    });
  }

  const alive: Enemy[] = [];
  const spawned: Enemy[] = [];
  for (const e of game.enemies) {
    const p = enemyPoint(game.level, e);
    if (e.hp <= 0 && fleet) {
      // Fleet: every layer was paid as it came off; the last one just leaves a scrap of parcel tape.
      game.events.push({ type: "kill", x: p.x, y: p.y, bounty: 0, kind: e.kind });
    } else if (e.hp <= 0) {
      // Crowds come at half health and pay half a bounty, or a crowd level would rain Marks.
      const crowd = hasTwist(game.level, "crowd") && !isBig(e.kind) ? 0.5 : 1;
      const bounty = Math.max(1, Math.round(ENEMIES[e.kind].bounty * crowd * (hasTwist(game.level, "fast") ? 1.5 : 1)));
      game.marks += bounty;
      const killer = e.lastHit !== undefined ? game.towers.find((t) => t.id === e.lastHit) : undefined;
      if (killer) {
        const before = rankOf(killer.kills ?? 0);
        killer.kills = (killer.kills ?? 0) + 1;
        const after = rankOf(killer.kills);
        if (after > before)
          game.events.push({ type: "rankUp", tower: killer.id, rank: after, x: killer.col + 0.5, y: killer.row + 0.5 });
      }
      const split = ENEMIES[e.kind].splits;
      if (split) {
        for (let i = 0; i < split.count; i++) {
          spawned.push(makeEnemy(game, split.kind, Math.max(0, e.dist - i * 0.35), e.lane, e.wave));
        }
        game.events.push({ type: "split", x: p.x, y: p.y, kind: split.kind });
      }
      game.events.push({ type: "kill", x: p.x, y: p.y, bounty, kind: e.kind });
    } else if (e.dist >= (e.lane ? game.pathLength2 : game.pathLength)) {
      // Fleet: a leak costs every layer that got through (rounded up); classic: the kind's leak.
      const lost = fleet ? Math.ceil(remainingFV(e) - 1e-9) : ENEMIES[e.kind].leak;
      if (fleet) game.leaked += remainingFV(e);
      game.goodwill -= lost;
      game.events.push({ type: "leak", x: p.x, y: p.y, kind: e.kind, lost, ...(e.dropped ? { dropped: true } : {}) });
    } else alive.push(e);
  }
  game.enemies = alive.concat(spawned);

  if (game.goodwill <= 0) {
    game.goodwill = 0;
    game.phase = "lost";
    return;
  }

  // Pay for every wave that has been fully cleared, in order.
  while (game.paid < game.wave) {
    const w = game.paid + 1;
    const pending =
      game.spawnQueue.some((q) => (q.wave ?? game.wave) === w) ||
      game.emitQueue.some((q) => (q.wave ?? game.wave) === w) ||
      game.enemies.some((e) => (e.wave ?? game.wave) === w);
    if (pending) break;
    game.paid = w;
    // Marks are meant to be scarce: a wave pays a little, and Endless pays less the longer it runs.
    let reward = fleet ? roundBonus(bookRound(game.level, w)) : game.level.endless ? 10 + Math.min(w, 15) * 2 : 14 + w * 3;
    let mend = 0;
    let income = 0;
    for (const t of game.towers) {
      const s = towerStats(t);
      income += s.income;
      mend += s.mend;
    }
    if (hasTwist(game.level, "tight")) reward *= 1.5;
    if (hasTwist(game.level, "market")) income *= 1.5;
    if (game.level.endless) income *= 0.5;
    reward = Math.round(reward + income);
    game.marks += reward;
    if (mend > 0)
      game.goodwill = Math.min(game.maxGoodwill, game.goodwill + mend);
    game.events.push({ type: "cleared", wave: w, reward });
  }

  if (game.spawnQueue.length === 0 && game.enemies.length === 0 && game.emitQueue.length === 0) {
    game.phase = game.wave >= game.level.waves.length ? "won" : "build";
  }
}

export const NEIGHBOURS_FIRST_LEVEL = 12;
export const NEIGHBOURS_COOLDOWN = 45;
export const NEIGHBOURS_SECS = 10;
export const RALLY_FIRST_LEVEL = 25;
export const RALLY_COOLDOWN = 50;
export const RALLY_SECS = 6;
export const RALLY_SPEEDUP = 1.5;

export function neighboursUnlocked(level: Level): boolean {
  return level.id >= NEIGHBOURS_FIRST_LEVEL;
}

export function rallyUnlocked(level: Level): boolean {
  return level.id >= RALLY_FIRST_LEVEL;
}

/** Three farmhands step into the lane just ahead of the leading enemy and hold it for a few seconds. */
export function callNeighbours(game: Game): ActionResult {
  if (!neighboursUnlocked(game.level))
    return { ok: false, reason: "The neighbours aren't on your side yet." };
  if (game.phase !== "wave") return { ok: false, reason: "Save them for a wave." };
  if (game.neighboursCd > 0) return { ok: false, reason: "They're still getting their boots back on." };
  if (game.enemies.length === 0) return { ok: false, reason: "Nothing to block." };
  const lead = game.enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
  const dist = Math.min((lead.lane ? game.pathLength2 : game.pathLength) - 1, lead.dist + 0.8);
  const p = enemyPoint(game.level, { dist, lane: lead.lane });
  game.barricade = { dist, lane: lead.lane, left: NEIGHBOURS_SECS * game.perks.neighbours };
  game.neighboursCd = NEIGHBOURS_COOLDOWN;
  game.events.push({ type: "neighbours", x: p.x, y: p.y });
  return { ok: true };
}

/** "Come on, all of you!": every tower fires half as fast again for a few seconds. */
export function callRally(game: Game): ActionResult {
  if (!rallyUnlocked(game.level)) return { ok: false, reason: "Nobody's marching yet." };
  if (game.phase !== "wave") return { ok: false, reason: "Save it for a wave." };
  if (game.rallyCd > 0) return { ok: false, reason: "Cath needs her breath back." };
  if (game.towers.length === 0) return { ok: false, reason: "Nobody to rally." };
  game.rallyLeft = RALLY_SECS * game.perks.rally;
  game.rallyCd = RALLY_COOLDOWN;
  game.events.push({ type: "rally" });
  return { ok: true };
}

export const PIE_COOLDOWN = 30;
export const PIE_STUN = 3;
export const PIE_RADIUS = 1.7;
export const PIE_DAMAGE = 40;
export const PIE_FIRST_LEVEL = 3;

export function pieUnlocked(level: Level): boolean {
  return level.id >= PIE_FIRST_LEVEL;
}

/** The pie's cooldown after Pie Stands and perks. */
export function pieCooldown(game: Game): number {
  let m = game.perks.pieCooldown;
  for (const t of game.towers) m *= 1 - towerStats(t).pieHaste;
  return PIE_COOLDOWN * Math.max(0.4, m);
}

export function pieRadius(game: Game): number {
  return PIE_RADIUS * game.perks.pieRadius;
}

/**
 * Cath throws a pie at (x, y): everything within the splash freezes for a few seconds (bosses half as
 * long) and takes a dollop of damage. Without a target she aims at whatever is furthest down the lane.
 */
export function throwPie(game: Game, x?: number, y?: number): ActionResult {
  if (game.heroic) return { ok: false, reason: "No pies in a Heroic run." };
  if (!pieUnlocked(game.level))
    return { ok: false, reason: "Cath has not baked one yet." };
  if (game.phase !== "wave")
    return { ok: false, reason: "Save it for a wave." };
  if (game.pieCd > 0)
    return { ok: false, reason: "Still cooling on the windowsill." };
  if (game.enemies.length === 0)
    return { ok: false, reason: "Nothing to throw it at." };
  if (x === undefined || y === undefined) {
    const lead = game.enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
    const p = enemyPoint(game.level, lead);
    x = p.x;
    y = p.y;
  }
  const radius = pieRadius(game);
  for (const e of [...game.enemies]) {
    const p = enemyPoint(game.level, e);
    if (Math.hypot(p.x - x, p.y - y) > radius) continue;
    popWrap(game, e);
    const stun = PIE_STUN * game.perks.pieStun;
    e.stun = Math.max(e.stun, isBig(e.kind) ? stun / 2 : stun);
    if (isFleet(game.level)) hitEnemy(game, e, Math.round(FLEET_PIE_DAMAGE * game.perks.pieDamage), -1);
    else e.hp -= PIE_DAMAGE * game.perks.pieDamage;
    if (game.perks.pieBurn > 0) {
      e.poison = Math.max(e.poison ?? 0, game.perks.pieBurn);
      e.poisonLeft = 4;
    }
  }
  game.pieCd = pieCooldown(game);
  game.events.push({ type: "pie", x, y, radius });
  return { ok: true };
}

export function stars(game: Game): 0 | 1 | 2 | 3 {
  if (game.phase !== "won") return 0;
  const kept = game.goodwill / game.maxGoodwill;
  return kept >= 0.9 ? 3 : kept >= 0.5 ? 2 : 1;
}

export function drainEvents(game: Game): GameEvent[] {
  const events = game.events;
  game.events = [];
  return events;
}

// ---- one-on-one boss duels ----

/** A boss rolls onto the lane: Cath steps out to meet it. */
export function startDuel(game: Game, e: Enemy): void {
  if (hasTwist(game.level, "nocath") || game.hero.down > 0) return;
  game.duel = { enemy: e.id, kind: e.kind, round: 0, strikes: [], clock: 0 };
  game.dueled.push(e.kind);
  game.events.push({ type: "duel", kind: e.kind });
}

/** One strike of the duel, its quality from 0 (a miss) to 1 (perfect timing). The third strike settles it. */
export function duelStrike(game: Game, quality: number): ActionResult {
  const d = game.duel;
  if (!d) return { ok: false, reason: "No duel on." };
  const q = Math.max(0, Math.min(1, quality));
  d.strikes.push(q);
  d.round += 1;
  d.clock = 0;
  game.events.push({ type: "duelStrike", quality: q, round: d.round });
  if (d.round < DUEL_ROUNDS) return { ok: true };
  game.duel = null;
  const total = d.strikes.reduce((a, b) => a + b, 0);
  const boss = game.enemies.find((e) => e.id === d.enemy);
  const won = total >= 1.5;
  if (boss && boss.hp > 0) {
    const bite = maxHpOf(boss) * DUEL_BITE * total * game.perks.duel;
    if (isFleet(game.level)) hitEnemy(game, boss, Math.min(bite, boss.hp - 1), -1);
    else boss.hp -= bite;
    boss.stun = Math.max(boss.stun, won ? 1 + total : 0.5);
  }
  if (!won) {
    // She took a beating: back to the farmhouse to recover.
    game.hero.down = HERO.respawn * 0.5 * game.perks.heroRespawn;
    game.hero.holding = [];
    game.events.push({ type: "heroDown" });
  }
  game.events.push({ type: "duelEnd", kind: d.kind, won, total });
  return { ok: true };
}

// ---- merging two grown towers into a megastructure ----

export interface MergeOption {
  /** The tower that becomes the megastructure, and its neighbour that joins it. */
  tower: number;
  partner: number;
  mega: MegaId;
  cost: number;
}

export function megasUnlocked(level: Level): boolean {
  return level.id >= MEGA_FIRST_LEVEL;
}

/** Megastructures a tower could become with a grown neighbour beside it (empty below tier 3 or before level 12). */
export function mergeOptions(game: Game, id: number): MergeOption[] {
  const t = game.towers.find((x) => x.id === id);
  if (!t || t.mega || t.tier < 3 || !megasUnlocked(game.level)) return [];
  const out: MergeOption[] = [];
  for (const o of game.towers) {
    if (o === t || o.mega || o.tier < 3) continue;
    if (Math.abs(o.col - t.col) + Math.abs(o.row - t.row) !== 1) continue;
    const mega = megaFor(t.kind, o.kind);
    if (mega) out.push({ tower: t.id, partner: o.id, mega, cost: MEGAS[mega].cost });
  }
  return out;
}

/** Merges a tower with its grown neighbour: one megastructure, covering both plots. */
export function merge(game: Game, id: number, partner: number): ActionResult {
  if (game.phase === "won" || game.phase === "lost") return { ok: false, reason: "The level is over." };
  const opt = mergeOptions(game, id).find((o) => o.partner === partner);
  if (!opt) return { ok: false, reason: "Those two can't merge." };
  if (game.marks < opt.cost) return { ok: false, reason: `Needs ${opt.cost} Marks.` };
  const t = game.towers.find((x) => x.id === id)!;
  const p = game.towers.find((x) => x.id === partner)!;
  game.marks -= opt.cost;
  t.mega = opt.mega;
  t.annex = [p.col, p.row];
  t.spent += p.spent + opt.cost;
  t.kills = Math.max(t.kills ?? 0, p.kills ?? 0);
  t.tier = 4;
  t.high = t.high || p.high;
  t.cd = 0;
  game.towers.splice(game.towers.indexOf(p), 1);
  game.events.push({ type: "merge", tower: t.id, mega: opt.mega, x: (t.col + p.col) / 2 + 0.5, y: (t.row + p.row) / 2 + 0.5 });
  return { ok: true };
}
