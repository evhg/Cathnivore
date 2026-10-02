// Hedgerow's engine: a pure, deterministic tower-defence simulation with no DOM. The world advances in
// fixed steps of STEP seconds (30 Hz), so the same build orders always give the same result, in tests, in
// the level bot and in the browser. Distances are in grid cells; the lane is a polyline through cell
// centres. Towers are hitscan: a shot lands the moment it fires, and the renderer draws the flight from the
// `events` list.

export const STEP = 1 / 30;

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
  | "hall";
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
  | "swarm"
  | "bus"
  | "board"
  | "director"
  | "hollowcandor"
  | "candor"
  | "remnant";

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
  /** Shots ignore armour (the Grain Silo). */
  pierce?: boolean;
  /** Reveals stealth units in range and marks everything in range: they take this much extra damage (the Radio Mast). */
  reveal?: [number, number, number];
  /** Towers within this range of the tent ignore influencer charm (the Clinic Tent). */
  cleanse?: boolean;
  /** Seconds it freezes a boss in range each time it fires (the Courthouse's Injunction). */
  injunction?: [number, number, number];
  /** Damage multiplier on every tower on the map, wherever it stands (the Union Hall). */
  aura?: [number, number, number];
}

export const TOWERS: Record<TowerKind, TowerSpec> = {
  hedgerow: {
    name: "Hedgerow",
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
    blurb: "Throws turnips at the front of the queue.",
    cost: 80,
    upgrades: [70, 110],
    range: [2.4, 2.7, 3.1],
    damage: [8, 13, 20],
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
    income: [12, 20, 30],
  },
  pond: {
    name: "Duck Pond",
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
    blurb: "A slow, heavy grain-shot that ignores armour. Bulldozers hate it.",
    cost: 150,
    upgrades: [110, 170],
    range: [2.6, 2.9, 3.2],
    damage: [40, 66, 100],
    cooldown: [2.2, 2, 1.8],
    slow: [1, 1, 1],
    pierce: true,
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
    income: [18, 30, 45],
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
  /** Flies over the lane: Cath cannot hold it. */
  flying?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  van: { name: "Delivery van", hp: 98, speed: 0.9, bounty: 9, leak: 1 },
  boss: {
    name: "The Acquisition Van",
    hp: 1800,
    speed: 0.55,
    bounty: 150,
    leak: 5,
  },
  drone: {
    name: "Delivery drone",
    hp: 35,
    speed: 1.8,
    bounty: 6,
    leak: 1,
    flying: true,
  },
  truck: {
    name: "0.99 price-war truck",
    hp: 150,
    speed: 0.8,
    bounty: 10,
    leak: 2,
    splits: { kind: "drone", count: 2 },
  },
  convoy: {
    name: "Mr Crisp's Price-War Convoy",
    hp: 2700,
    speed: 0.5,
    bounty: 200,
    leak: 6,
    splits: { kind: "truck", count: 3 },
  },
  influencer: {
    name: "Lifestyle influencer",
    hp: 70,
    speed: 1.0,
    bounty: 10,
    leak: 1,
    charm: 1.2,
  },
  blimp: {
    name: "The Brand Ambassador Blimp",
    hp: 3300,
    speed: 0.45,
    bounty: 250,
    leak: 7,
    charm: 1.8,
    flying: true,
  },
  bulldozer: {
    name: "Site-clearance bulldozer",
    hp: 260,
    speed: 0.7,
    bounty: 14,
    leak: 3,
    armor: 0.5,
  },
  megadozer: {
    name: "The Mega-Dozer",
    hp: 4200,
    speed: 0.42,
    bounty: 300,
    leak: 8,
    armor: 0.5,
    splits: { kind: "bulldozer", count: 2 },
  },
  phantom: {
    name: "Unbranded courier",
    hp: 90,
    speed: 1.2,
    bounty: 12,
    leak: 1,
    stealth: true,
  },
  tender: {
    name: "Fast tender",
    hp: 190,
    speed: 1.1,
    bounty: 13,
    leak: 2,
    armor: 0.3,
  },
  ship: {
    name: "The Container Ship",
    hp: 5600,
    speed: 0.4,
    bounty: 400,
    leak: 10,
    armor: 0.35,
    splits: { kind: "tender", count: 4 },
  },
  lawyer: {
    name: "Corporate lawyer",
    hp: 170,
    speed: 0.95,
    bounty: 13,
    leak: 2,
    jam: 1.3,
  },
  swarm: {
    name: "The Lawyer Swarm",
    hp: 6000,
    speed: 0.45,
    bounty: 450,
    leak: 10,
    jam: 2,
    splits: { kind: "lawyer", count: 5 },
  },
  bus: {
    name: "Pell's Campaign Bus",
    hp: 7200,
    speed: 0.5,
    bounty: 500,
    leak: 10,
    armor: 0.2,
    splits: { kind: "influencer", count: 6 },
  },
  director: {
    name: "Company director",
    hp: 1500,
    speed: 0.7,
    bounty: 40,
    leak: 3,
    armor: 0.25,
  },
  board: {
    name: "The Board of Directors",
    hp: 8000,
    speed: 0.5,
    bounty: 550,
    leak: 10,
    armor: 0.2,
    splits: { kind: "director", count: 5 },
  },
  hollowcandor: {
    name: "HollowCandor",
    hp: 7000,
    speed: 0.45,
    bounty: 400,
    leak: 10,
    armor: 0.25,
    jam: 1.5,
    splits: { kind: "candor", count: 2 },
  },
  candor: {
    name: "Candor, unmerged",
    hp: 4500,
    speed: 0.6,
    bounty: 300,
    leak: 6,
    armor: 0.15,
    heal: 20,
    splits: { kind: "remnant", count: 3 },
  },
  remnant: {
    name: "Hollow remnant",
    hp: 1400,
    speed: 0.9,
    bounty: 60,
    leak: 3,
    stealth: true,
  },
  clinic: {
    name: "Vane's Clinic-in-a-Box",
    hp: 4800,
    speed: 0.42,
    bounty: 350,
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
      income: 55,
      buff: 1.55,
    },
    {
      name: "Pie Stand",
      blurb: "Cath's pies, on sale. Every stand gets her next pie out of the oven sooner.",
      cost: 180,
      income: 30,
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
      income: 85,
    },
  ],
};

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
  pierce: boolean;
  cleanse: boolean;
  thorns: number;
  crit: { every: number; mult: number } | null;
  poison: { dps: number; secs: number } | null;
  sticky: { factor: number; secs: number } | null;
  knockback: number;
  classAction: boolean;
  pieHaste: number;
  mend: number;
}

const statCache = new WeakMap<object, { key: string; stats: TowerStats }>();

/** The numbers a tower fights with at its tier, and with its specialisation at tier 4. */
export function towerStats(
  t: Pick<Tower, "kind" | "tier"> & { spec?: 0 | 1 | null },
): TowerStats {
  const key = `${t.kind}:${t.tier}:${t.spec ?? ""}`;
  const hit = statCache.get(t);
  if (hit && hit.key === key) return hit.stats;
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
    pierce: !!s.pierce,
    cleanse: !!s.cleanse,
    thorns: 0,
    crit: null,
    poison: null,
    sticky: null,
    knockback: 0,
    classAction: false,
    pieHaste: 0,
    mend: 0,
  };
  if (t.tier === 4 && t.spec != null) {
    const o: Partial<Specialisation> = { ...SPECIALISATIONS[t.kind][t.spec] };
    delete o.name;
    delete o.blurb;
    delete o.cost;
    Object.assign(stats, o);
  }
  statCache.set(t, { key, stats });
  return stats;
}

// ---- bosses: every boss has signature moves on a timer ----

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
  const path = game.level.path;
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
    const p = pointAt(path, e.dist);
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
          born.push({
            id: game.nextId++,
            kind: move.spawn!.kind,
            dist: Math.max(0, e.dist - 0.4 - i * 0.4),
            hp: ENEMIES[move.spawn!.kind].hp,
            slowed: false,
            stun: 0,
            wave: e.wave,
          });
        break;
      case "charge":
        e.charge = move.secs!;
        break;
      case "mend":
        for (const o of game.enemies) if (o.hp > 0) o.hp = Math.min(ENEMIES[o.kind].hp, o.hp + ENEMIES[o.kind].hp * 0.15);
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
}

export interface StoryLine {
  who: "cath" | "mara" | "bea" | "tomas" | "sol" | "narrator";
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
  startMarks: number;
  goodwill: number;
  towers: TowerKind[];
  waves: WaveGroup[][];
  before: StoryLine[];
  after: StoryLine[];
  /** What finishing the level unlocks (a tier, a skin or a lore card). */
  reward: string;
}

export type TargetMode = "first" | "last" | "strong" | "close";
export const TARGET_MODES: TargetMode[] = ["first", "last", "strong", "close"];

export interface Tower {
  id: number;
  kind: TowerKind;
  col: number;
  row: number;
  tier: 1 | 2 | 3 | 4;
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
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  dist: number;
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
  /** Bosses: seconds until the next signature move, and which move is next. */
  moveCd?: number;
  moveIdx?: number;
  /** Seconds left charging at double speed. */
  charge?: number;
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
  damage: 15,
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
  heroHp: number;
  heroDamage: number;
  /** Fraction off every tower's price. */
  discount: number;
  /** Multiplies the bonus for calling a wave early. */
  earlyBonus: number;
  /** Multiplies hedgerow-type slows' strength (lower = stronger). */
  slow: number;
}

export const NO_PERKS: Perks = {
  marks: 0,
  goodwill: 0,
  pieCooldown: 1,
  pieRadius: 1,
  heroHp: 1,
  heroDamage: 1,
  discount: 0,
  earlyBonus: 1,
  slow: 1,
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
  | { type: "leak"; x: number; y: number; kind?: EnemyKind; lost?: number }
  | { type: "wave"; wave: number; early?: number }
  | { type: "cleared"; wave: number; reward: number }
  | { type: "pie"; x?: number; y?: number; radius?: number }
  | { type: "swing"; x: number; y: number }
  | { type: "heroDown" }
  | { type: "heroUp" }
  | { type: "injunction"; x: number; y: number }
  | { type: "split"; x: number; y: number; kind: EnemyKind }
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
  spawnQueue: Array<{ at: number; kind: EnemyKind; wave?: number }>;
  enemies: Enemy[];
  towers: Tower[];
  nextId: number;
  pathLength: number;
  events: GameEvent[];
  /** Seconds until Cath's pie is ready again. */
  pieCd: number;
  hero: Hero;
  perks: Perks;
  /** Goodwill at the start, after perks: stars are measured against it. */
  maxGoodwill: number;
}

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

export function isPlot(level: Level, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= level.cols || row >= level.rows)
    return false;
  return !laneCells(level.path).has(`${col},${row}`);
}

/** Where Cath stands at the start: on the lane, two thirds of the way down. */
export function heroPost(level: Level): { x: number; y: number } {
  return pointAt(level.path, pathLength(level.path) * 0.66);
}

export function newGame(level: Level, perks: Perks = NO_PERKS): Game {
  const post = heroPost(level);
  const maxHp = Math.round(HERO.hp * perks.heroHp);
  const goodwill = level.goodwill + perks.goodwill;
  return {
    level,
    tick: 0,
    phase: "build",
    marks: level.startMarks + perks.marks,
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
    events: [],
    pieCd: 0,
    perks,
    hero: {
      x: post.x,
      y: post.y,
      tx: post.x,
      ty: post.y,
      hp: maxHp,
      maxHp,
      damage: HERO.damage * perks.heroDamage,
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
  return game.towers.find((t) => t.col === col && t.row === row);
}

export function sellValue(tower: Tower): number {
  return Math.floor(tower.spent * 0.7);
}

export function towerCost(game: Game, kind: TowerKind): number {
  return Math.round(TOWERS[kind].cost * (1 - game.perks.discount));
}

/** The price of the next tier (null at tier 3, where the two specialisations are priced separately, and at 4). */
export function upgradeCost(tower: Tower): number | null {
  return tower.tier >= 3 ? null : TOWERS[tower.kind].upgrades[tower.tier - 1]!;
}

export function specCost(tower: Tower, spec: 0 | 1): number | null {
  return tower.tier === 3 ? SPECIALISATIONS[tower.kind][spec].cost : null;
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
  if (!isPlot(game.level, col, row))
    return { ok: false, reason: "You can only build beside the lane." };
  if (towerAt(game, col, row))
    return { ok: false, reason: "That plot is taken." };
  const cost = towerCost(game, kind);
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` };
  game.marks -= cost;
  game.towers.push({
    id: game.nextId++,
    kind,
    col,
    row,
    tier: 1,
    spec: null,
    target: "first",
    shots: 0,
    cd: 0,
    spent: cost,
  });
  return { ok: true };
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
    const cost = SPECIALISATIONS[tower.kind][spec].cost;
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
  return Math.round((12 + game.wave * 3) * game.perks.earlyBonus);
}

/** True while a wave is out but fully spawned and more waves remain: the next one can be called early. */
export function canCallEarly(game: Game): boolean {
  return (
    game.phase === "wave" &&
    game.spawnQueue.length === 0 &&
    game.wave < game.level.waves.length
  );
}

/** Starts the next wave: between waves, or early (for a bonus) once the current wave is all on the lane. */
export function sendWave(game: Game): ActionResult {
  if (game.phase === "won" || game.phase === "lost")
    return { ok: false, reason: "The level is over." };
  if (game.phase === "wave" && !canCallEarly(game))
    return { ok: false, reason: "A wave is already on its way." };
  const groups = game.level.waves[game.wave];
  if (!groups) return { ok: false, reason: "No more waves." };
  const early = game.phase === "wave" ? earlyBonus(game) : 0;
  const wave = game.wave + 1;
  const queue: Game["spawnQueue"] = [];
  for (const g of groups)
    for (let i = 0; i < g.count; i++)
      queue.push({ at: g.delay + i * g.gap, kind: g.enemy, wave });
  queue.sort((a, b) => a.at - b.at);
  game.spawnQueue = queue;
  game.waveClock = 0;
  game.wave = wave;
  game.phase = "wave";
  game.marks += early;
  game.events.push(
    early ? { type: "wave", wave, early } : { type: "wave", wave },
  );
  return { ok: true };
}

/** Sends Cath somewhere on the map. She walks; she can't hold anything while she walks. */
export function moveHero(game: Game, x: number, y: number): ActionResult {
  if (game.phase === "won" || game.phase === "lost")
    return { ok: false, reason: "The level is over." };
  if (game.hero.down > 0)
    return { ok: false, reason: "Cath is catching her breath." };
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

/** How hard an enemy hits Cath while she holds it, in hit points a second. */
export function enemyHit(kind: EnemyKind): number {
  return Math.min(30, Math.max(5, ENEMIES[kind].hp / 14));
}

/** Lawyers' paperwork: towers in range fire at half rate. */
function jammed(game: Game, t: Tower): boolean {
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].jam;
    if (!r || e.hp <= 0) continue;
    const p = pointAt(game.level.path, e.dist);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

/** An influencer's followers are watching it, not the road: towers in its charm range hold fire. */
export function charmed(game: Game, t: Tower): boolean {
  for (const c of game.towers) {
    const cs = towerStats(c);
    if (cs.cleanse && Math.hypot(c.col - t.col, c.row - t.row) <= cs.range)
      return false;
  }
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].charm;
    if (!r || e.hp <= 0) continue;
    const p = pointAt(game.level.path, e.dist);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

/** Radio Masts see through stealth: an enemy within a mast's range is revealed and marked. */
export function markMultiplier(game: Game, e: Enemy): number {
  const p = pointAt(game.level.path, e.dist);
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
  return !ENEMIES[e.kind].stealth || markMultiplier(game, e) > 1;
}

function damageEnemy(
  game: Game,
  e: Enemy,
  amount: number,
  pierce: boolean,
): void {
  const armor = ENEMIES[e.kind].armor ?? 0;
  e.hp -= (pierce ? amount : amount * (1 - armor)) * markMultiplier(game, e);
}

function stepHero(game: Game): void {
  const h = game.hero;
  const path = game.level.path;
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
    const stepLen = Math.min(d, HERO.speed * STEP);
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
      const p = pointAt(path, e.dist);
      return Math.hypot(p.x - h.x, p.y - h.y) <= HERO.reach + 0.25;
    });
    if (h.holding.length < HERO.holds) {
      const near = game.enemies
        .filter((e) => {
          if (e.hp <= 0 || h.holding.includes(e.id)) return false;
          const spec = ENEMIES[e.kind];
          if (spec.flying || isBig(e.kind) || !isRevealed(game, e))
            return false;
          const p = pointAt(path, e.dist);
          return Math.hypot(p.x - h.x, p.y - h.y) <= HERO.reach;
        })
        .sort((a, b) => b.dist - a.dist || a.id - b.id);
      for (const e of near) {
        if (h.holding.length >= HERO.holds) break;
        h.holding.push(e.id);
      }
    }
  }
  for (const e of game.enemies) e.held = h.holding.includes(e.id);

  // Held enemies hit back.
  let hurt = 0;
  for (const e of game.enemies) if (e.held) hurt += enemyHit(e.kind);
  if (hurt > 0) h.hp -= hurt * STEP;
  else h.hp = Math.min(h.maxHp, h.hp + HERO.regen * STEP);
  if (h.hp <= 0) {
    h.hp = 0;
    h.down = HERO.respawn;
    h.holding = [];
    for (const e of game.enemies) e.held = false;
    game.events.push({ type: "heroDown" });
    return;
  }

  // Swinging the rolling pin at whatever she holds, or anything in reach.
  h.cd -= STEP;
  if (h.cd > 0) return;
  let target = game.enemies.find((e) => e.held && e.hp > 0);
  if (!target) {
    let best = Infinity;
    for (const e of game.enemies) {
      if (e.hp <= 0 || !isRevealed(game, e)) continue;
      const p = pointAt(path, e.dist);
      const dd = Math.hypot(p.x - h.x, p.y - h.y);
      if (dd <= HERO.reach + 0.15 && dd < best) {
        best = dd;
        target = e;
      }
    }
  }
  if (!target) {
    h.cd = 0;
    return;
  }
  const before = target.hp;
  damageEnemy(game, target, h.damage, false);
  if (before > 0 && target.hp <= 0) h.kills += 1;
  const p = pointAt(path, target.dist);
  h.facing = p.x >= h.x ? 1 : -1;
  h.cd = HERO.cooldown;
  game.events.push({ type: "swing", x: p.x, y: p.y });
}

function pickTarget(
  game: Game,
  t: Tower,
  range: number,
): Enemy | undefined {
  const path = game.level.path;
  const mode = t.target ?? "first";
  let target: Enemy | undefined;
  let best = -Infinity;
  for (const e of game.enemies) {
    if (e.hp <= 0 || !isRevealed(game, e)) continue;
    const p = pointAt(path, e.dist);
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

export function stepGame(game: Game): void {
  if (game.phase !== "wave") return;
  game.tick += 1;
  game.waveClock += STEP;
  if (game.pieCd > 0) game.pieCd = Math.max(0, game.pieCd - STEP);
  const path = game.level.path;

  while (
    game.spawnQueue.length > 0 &&
    game.spawnQueue[0]!.at <= game.waveClock
  ) {
    const next = game.spawnQueue.shift()!;
    game.enemies.push({
      id: game.nextId++,
      kind: next.kind,
      dist: 0,
      hp: ENEMIES[next.kind].hp,
      slowed: false,
      stun: 0,
      wave: next.wave ?? game.wave,
    });
  }

  stepHero(game);
  bossMoves(game);
  for (const t of game.towers) if (t.out && t.out > 0) t.out = Math.max(0, t.out - STEP);

  // Hedgerows slow whatever is in range; the strongest one wins, they don't stack. Honey sticks.
  for (const enemy of game.enemies) {
    const p = pointAt(path, enemy.dist);
    let factor = 1;
    for (const t of game.towers) {
      const s = towerStats(t);
      if (s.slow >= 1 || !towerActive(t)) continue;
      if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= s.range)
        factor = Math.min(factor, 1 - (1 - s.slow) / game.perks.slow);
    }
    if (enemy.stickyLeft && enemy.stickyLeft > 0) {
      factor = Math.min(factor, enemy.sticky ?? 1);
      enemy.stickyLeft -= STEP;
    }
    enemy.slowed = factor < 1;
    if (enemy.stun > 0) enemy.stun -= STEP;
    else if (!enemy.held)
      enemy.dist +=
        ENEMIES[enemy.kind].speed * Math.max(0.05, factor) * (enemy.charge && enemy.charge > 0 ? 2.2 : 1) * STEP;
    if (enemy.poisonLeft && enemy.poisonLeft > 0) {
      enemy.hp -= (enemy.poison ?? 0) * STEP;
      enemy.poisonLeft -= STEP;
    }
  }

  // Clinic-in-a-Box and friends patch up whatever is beside them.
  for (const h of game.enemies) {
    const heal = ENEMIES[h.kind].heal;
    if (!heal || h.hp <= 0) continue;
    for (const e of game.enemies) {
      if (e === h || e.hp <= 0) continue;
      if (Math.abs(e.dist - h.dist) <= 1.6)
        e.hp = Math.min(ENEMIES[e.kind].hp, e.hp + heal * STEP);
    }
  }

  for (const t of game.towers) {
    const spec = towerStats(t);
    if (!towerActive(t)) continue;
    // Blackthorn scratches everything in reach, all the time.
    if (spec.thorns > 0) {
      for (const e of game.enemies) {
        if (e.hp <= 0) continue;
        const p = pointAt(path, e.dist);
        if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= spec.range)
          damageEnemy(game, e, spec.thorns * STEP, false);
      }
    }
    if (spec.injunction > 0) {
      t.cd -= STEP;
      if (t.cd > 0) continue;
      let served = false;
      for (const e of game.enemies) {
        if (e.hp <= 0 || (!isBig(e.kind) && !spec.classAction)) continue;
        const p = pointAt(path, e.dist);
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
    t.cd -= STEP;
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
    const p = pointAt(path, target.dist);
    let dmg = spec.damage;
    for (const b of game.towers) {
      const bs = towerStats(b);
      if (bs.buff > 1 && Math.hypot(b.col - t.col, b.row - t.row) <= bs.range)
        dmg *= bs.buff;
      if (bs.aura > 1) dmg *= bs.aura;
    }
    t.shots = (t.shots ?? 0) + 1;
    const crit = !!spec.crit && t.shots % spec.crit.every === 0;
    if (crit) dmg *= spec.crit!.mult;
    const hit = (e: Enemy) => {
      damageEnemy(game, e, dmg, spec.pierce);
      if (spec.poison) {
        e.poison = spec.poison.dps;
        e.poisonLeft = spec.poison.secs;
      }
      if (spec.sticky) {
        e.sticky = spec.sticky.factor;
        e.stickyLeft = spec.sticky.secs;
      }
      if (spec.knockback && !isBig(e.kind) && !e.held)
        e.dist = Math.max(0, e.dist - spec.knockback);
    };
    hit(target);
    if (spec.splash) {
      for (const e of game.enemies) {
        if (e === target || e.hp <= 0) continue;
        const q = pointAt(path, e.dist);
        if (Math.hypot(q.x - p.x, q.y - p.y) <= spec.splash) hit(e);
      }
    }
    t.cd = spec.cooldown;
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
    const p = pointAt(path, e.dist);
    if (e.hp <= 0) {
      const bounty = ENEMIES[e.kind].bounty;
      game.marks += bounty;
      const split = ENEMIES[e.kind].splits;
      if (split) {
        for (let i = 0; i < split.count; i++) {
          spawned.push({
            id: game.nextId++,
            kind: split.kind,
            dist: Math.max(0, e.dist - i * 0.35),
            hp: ENEMIES[split.kind].hp,
            slowed: false,
            stun: 0,
            wave: e.wave,
          });
        }
        game.events.push({ type: "split", x: p.x, y: p.y, kind: split.kind });
      }
      game.events.push({ type: "kill", x: p.x, y: p.y, bounty, kind: e.kind });
    } else if (e.dist >= game.pathLength) {
      const lost = ENEMIES[e.kind].leak;
      game.goodwill -= lost;
      game.events.push({ type: "leak", x: p.x, y: p.y, kind: e.kind, lost });
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
      game.enemies.some((e) => (e.wave ?? game.wave) === w);
    if (pending) break;
    game.paid = w;
    let reward = 20 + w * 5;
    let mend = 0;
    for (const t of game.towers) {
      const s = towerStats(t);
      reward += s.income;
      mend += s.mend;
    }
    game.marks += reward;
    if (mend > 0)
      game.goodwill = Math.min(game.maxGoodwill, game.goodwill + mend);
    game.events.push({ type: "cleared", wave: w, reward });
  }

  if (game.spawnQueue.length === 0 && game.enemies.length === 0) {
    game.phase = game.wave >= game.level.waves.length ? "won" : "build";
  }
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
    const p = pointAt(game.level.path, lead.dist);
    x = p.x;
    y = p.y;
  }
  const radius = pieRadius(game);
  for (const e of game.enemies) {
    const p = pointAt(game.level.path, e.dist);
    if (Math.hypot(p.x - x, p.y - y) > radius) continue;
    e.stun = Math.max(e.stun, isBig(e.kind) ? PIE_STUN / 2 : PIE_STUN);
    e.hp -= PIE_DAMAGE;
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
