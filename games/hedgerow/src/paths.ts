// Upgrade paths (Hedgerow 2 section 3, milestone M4): on fleet levels the Scarecrow, Hedgerow, Beehive, Seed
// Cannon and Radio Mast grow along three paths of three tiers each (the Crown, tier 4, arrives in M5). A
// tower's build is `Tower.path`, three numbers such as [3, 2, 0]: "3-2-0".
//
// The crosspath rule: a tower buys into at most two paths, and only one of them goes past tier 2. Tier 1 and 2
// are stat changes you can see, with one utility on tier 2 (detection, air, plating); tier 3 adds a new
// behaviour and a new silhouette, and opens at level 6 (where specialisations used to).
//
// The other towers keep today's tiers and two specialisations; the panel shows them through the legacy
// adapter (`legacyPath`): tier 2 and tier 3 as path A's first two steps, a specialisation as its third.
//
// Rules data only: the engine (engine.ts towerStats, upgrade) applies it. Type-only imports keep this module
// free of a cycle with engine.ts.

import type { TowerKind } from "./engine";
import type { DamageType } from "./fleet";

/** A tower's build: tiers bought along paths A, B and C. */
export type Path = [number, number, number];
export type PathIndex = 0 | 1 | 2;

/** The towers that grow along paths (M4). The rest use the legacy adapter until M7. */
export const PATH_KINDS = ["scarecrow", "hedgerow", "beehive", "cannon", "mast", "pond", "silo", "windmill", "stall", "court"] as const;
export type PathKind = (typeof PATH_KINDS)[number];

export function hasPaths(kind: TowerKind): kind is PathKind {
  return (PATH_KINDS as readonly string[]).includes(kind);
}

/** Tiers per path in M4 (the Crown, tier 4, comes in M5). */
export const PATH_TIERS = 3;
/** The level from which a tier 3 can be bought (where the old specialisations opened). */
export const T3_FIRST_LEVEL = 6;

/**
 * What one tier changes. Adds and multipliers stack across a tower's tiers in any order; the "set" fields
 * (type, global, sweep, slow, sticky...) belong to exactly one tier of a tower, so the order never matters.
 */
export interface PathMod {
  /** + layers per hit. */
  damage?: number;
  /** + vehicles per shot. */
  pierce?: number;
  /** × fire rate (the cooldown is divided by it; a Windmill's gusts come that much faster). */
  rate?: number;
  /** + cells a gust shoves everything back (Windmill). */
  push?: number;
  /** + Marks paid after every cleared round (Market Stall). */
  income?: number;
  /** + seconds an injunction holds (Courthouse). */
  injunction?: number;
  /** Serves every enemy, not only the big ones (Courthouse). */
  classAction?: boolean;
  /** × range, then + cells. */
  range?: number;
  rangeAdd?: number;
  /** × splash radius. */
  splash?: number;
  /** Sees Stealth itself (only this tower: a Mast reveals for everyone). */
  detect?: boolean;
  /** Hits Airborne. */
  air?: boolean;
  /** Its damage type changes (Scatter Shot's Sharp seeds, Hawk Post's Crush talons). */
  type?: DamageType;
  crit?: { every: number; mult: number };
  /** Separate targets per shot (Crow Caller's fan of crows). */
  fan?: number;
  /** Instead of aimed shots, a 360° sweep of everything in range every this many seconds (Whirling Scythe). */
  sweep?: number;
  /** Reaches anywhere on the field (Hawk Post, Broadcast Tower). */
  global?: boolean;
  /** Seconds a hit stuns what it hits (not Heavy Plant or Reefer). */
  stun?: number;
  /** × layers against a vehicle with a shell of more than one layer (bosses, Plant). */
  shellMul?: number;
  /** Layers a hit knocks off Heavy Plant and bosses, at least. */
  plantDamage?: number;
  /** Cells a hit shoves what it hits back up the lane (not Heavy Plant or Reefer). */
  knockback?: number;
  /** Layers a second for `secs` after a sting; `spread` passes it to everything the vehicle pops into. */
  poison?: { dps: number; secs: number; spread?: boolean };
  /** Speed factor everything in range is slowed to (the strongest slow on a vehicle wins). */
  slow?: number;
  /** Whatever it hits is slowed to `factor` for `secs`. */
  sticky?: { factor: number; secs: number };
  /** Sharp damage a second to everything in reach. */
  thorns?: number;
  /** Thorn piles on the lane: each one takes a layer off the next `hits` vehicles to cross it. */
  piles?: { hits: number; every: number; max: number };
  /** Every `every` seconds, holds the first `count` non-Plant vehicles in range still for `secs`. */
  hold?: { secs: number; every: number; count: number };
  /** Vehicles in range take this much extra (whole layers, carried in fractions per tower). */
  vuln?: number;
  /** × fire rate for every tower in range (towers here; the Siren and the Pollinator). */
  buff?: number;
  /** × range for every tower in range (the Clinic). */
  rangeAura?: number;
  /** Towers in range shake off charm and jam. */
  cleanse?: boolean;
  /** Goodwill back after every cleared round. */
  mend?: number;
}

export interface PathTier {
  name: string;
  blurb: string;
  cost: number;
  /** One short line for the sheet: what it adds. */
  adds: string;
  mod: PathMod;
  /** A Crown's ability (M5): used by hand from the tower's sheet, then on a cooldown. */
  ability?: CrownAbility;
}

export interface CrownAbility {
  kind: "blackout" | "stoop" | "standup" | "freeze" | "strike" | "triage";
  name: string;
  /** What it does, for the button. */
  blurb: string;
  /** Seconds before it can be used again. */
  cooldown: number;
  /** Seconds a surge lasts (blackout, standup) or a freeze holds (freeze). */
  secs?: number;
  /** Cells the effect reaches (standup, freeze). Standup with `all` boosts every tower kind, not just its own. */
  reach?: number;
  all?: boolean;
  /** Layers a strike takes off the strongest enemy; Goodwill a triage mends. */
  amount?: number;
}

export interface PathDef {
  name: string;
  /** One word for the column heading on a phone. */
  short: string;
  tiers: [PathTier, PathTier, PathTier];
  /** The Crown (tier 4, M5): bought on a path at tier 3, once per field. Not every path has one yet. */
  crown?: PathTier;
}

export interface TowerPaths {
  paths: [PathDef, PathDef, PathDef];
}

export const PATHS: Record<PathKind, TowerPaths> = {
  scarecrow: {
    paths: [
      {
        name: "Flock",
        short: "Flock",
        tiers: [
          { name: "Sharp Beaks", cost: 100, adds: "+1 pierce, +10% range", blurb: "The crows on its arms join in: every throw goes through one more vehicle, and they spot from further off.", mod: { pierce: 1, range: 1.1 } },
          { name: "Quick Crows", cost: 200, adds: "fires 30% faster, +1 pierce, +10% range", blurb: "The crows fetch the turnips back and spot for it from further still: faster throws that go through one more.", mod: { rate: 1.3, pierce: 1, range: 1.1 } },
          {
            name: "Crow Caller",
            cost: 1000,
            adds: "3 crows a shot, every 3rd crits ×3",
            blurb: "It calls the whole rookery: three crows to three targets, and every third swoop lands three times as hard.",
            mod: { fan: 3, pierce: 1, crit: { every: 3, mult: 3 } },
          },
        ],
        crown: {
          name: "Murder of Crows",
          cost: 20000,
          adds: "12 crows a shot, 2 layers each, pierce 6",
          blurb: "The whole sky comes down: twelve crows, each a heavier hit than the Caller's, and every third still lands three times over.",
          mod: { fan: 12, damage: 1, pierce: 1 },
          ability: { kind: "blackout", name: "Blackout Sky", blurb: "Fires three times as fast for 8 seconds.", cooldown: 45, secs: 8 },
        },
      },
      {
        name: "Lookout",
        short: "Lookout",
        tiers: [
          { name: "Tall Hat", cost: 90, adds: "+25% range", blurb: "A taller hat. It sees further down the lane.", mod: { range: 1.25 } },
          { name: "Lantern Eyes", cost: 220, adds: "sees Stealth", blurb: "Lanterns behind the eyes: it spots hedge-camo for itself.", mod: { detect: true } },
          {
            name: "Hawk Post",
            cost: 1200,
            adds: "map-wide, 4 layers, Crush cracks Plated",
            blurb: "A hawk on the post. It strikes anywhere on the field, and its talons crush steel.",
            mod: { global: true, damage: 3, type: "crush" },
          },
        ],
        crown: {
          name: "Falconer",
          cost: 24000,
          adds: "30 layers a strike, ×3 on Plants",
          blurb: "A falconer with a gauntlet and a very large bird. Anywhere on the field, thirty layers at a time, and three times that to a Plant's shell.",
          mod: { damage: 26, shellMul: 3 },
          ability: { kind: "stoop", name: "Stoop", blurb: "Breaks the shell of the strongest Heavy Plant on the field.", cooldown: 40 },
        },
      },
      {
        name: "Scythe",
        short: "Scythe",
        tiers: [
          { name: "Quick Arms", cost: 110, adds: "fires 30% faster", blurb: "Looser straw in the shoulders. It throws faster.", mod: { rate: 1.3 } },
          { name: "Two Hands", cost: 240, adds: "2 layers a throw, 15% faster", blurb: "A turnip in each hand: every throw knocks two layers off.", mod: { rate: 1.15, damage: 1 } },
          {
            name: "Whirling Scythe",
            cost: 1300,
            adds: "spins: hits 8 around it every 0.4 s",
            blurb: "It takes up the scythe and spins: everything in reach, all round it, every 0.4 seconds. Quick Arms, Two Hands, Rally and a Siren all spin it faster.",
            // 0.6 s before the path's own rate tiers (x1.3, x1.15), so 0.4 s as bought.
            mod: { sweep: 0.6, pierce: 6 },
          },
        ],
        crown: {
          name: "Wicker Giant",
          cost: 28000,
          adds: "spins 2× as fast, pierce +2",
          blurb: "Straw, willow and spite, three storeys of it. It flails twice as fast as the Scythe, and nothing gets past an arm that long.",
          mod: { rate: 2.2, pierce: 2 },
          ability: { kind: "standup", name: "Stand Up", blurb: "Scarecrows within 3 cells fire three times as fast for 8 seconds.", cooldown: 50, secs: 8 },
        },
      },
    ],
  },
  hedgerow: {
    paths: [
      {
        name: "Blackthorn",
        short: "Thorn",
        tiers: [
          { name: "Thorny", cost: 60, adds: "scratches: ½ layer/s", blurb: "Blackthorn in the mix. Everything in reach gets scratched.", mod: { thorns: 0.5 } },
          { name: "Thorn Piles", cost: 130, adds: "drops 8-hit thorn piles", blurb: "Cut thorn heaped in the lane: each pile takes a layer off the next eight vehicles over it.", mod: { piles: { hits: 8, every: 2.5, max: 3 } } },
          {
            name: "Hawthorn Spikes",
            cost: 550,
            adds: "20-hit piles, faster",
            blurb: "Hawthorn, the longest spikes in the county. Bigger piles, laid faster.",
            mod: { piles: { hits: 20, every: 1.6, max: 4 }, thorns: 0.5 },
          },
        ],
      },
      {
        name: "Bramble Maze",
        short: "Maze",
        tiers: [
          { name: "Brambles", cost: 50, adds: "slows to 52%", blurb: "Brambles through the hedge: everything slows right down.", mod: { slow: 0.52 } },
          { name: "Thick Hedge", cost: 110, adds: "slows to 45%, +0.3 range", blurb: "Let it grow out across the lane. It reaches further, and grips harder.", mod: { slow: 0.45, rangeAdd: 0.3 } },
          { name: "The Maze", cost: 500, adds: "slows to 35%, +30% range", blurb: "A maze of hedge across the lane. Nothing comes through it quickly.", mod: { slow: 0.35, range: 1.3 } },
        ],
      },
      {
        name: "Haybale",
        short: "Hay",
        tiers: [
          { name: "Loose Bales", cost: 55, adds: "slows to 55%", blurb: "Bales tumbled into the lane slow the traffic down.", mod: { slow: 0.55 } },
          { name: "Haybale", cost: 130, adds: "holds 3 still for 1 s", blurb: "Every few seconds a round bale rolls out and holds three vehicles still (not Heavy Plant).", mod: { hold: { secs: 1, every: 3, count: 3 } } },
          {
            name: "Tractor Shed",
            cost: 600,
            adds: "tractors ram: 2 layers, knockback",
            blurb: "The farmhands bring the tractor. It rams vehicles back up the lane.",
            mod: { damage: 2, pierce: 3, knockback: 0.5, rate: 0.85 },
          },
        ],
      },
    ],
  },
  beehive: {
    paths: [
      {
        name: "Killer Bees",
        short: "Killer",
        tiers: [
          { name: "Angry Swarm", cost: 150, adds: "+3 pierce", blurb: "An angrier swarm stings more of them.", mod: { pierce: 3 } },
          { name: "Venom", cost: 300, adds: "poison: 1 layer/s for 3 s", blurb: "The stings keep burning.", mod: { poison: { dps: 1, secs: 3 } } },
          {
            name: "Killer Queen",
            cost: 1500,
            adds: "+1 layer, poison spreads on pop",
            blurb: "An ill-tempered queen. Harder stings, and the poison spreads to whatever a vehicle pops into.",
            mod: { damage: 1, poison: { dps: 2, secs: 3, spread: true } },
          },
        ],
      },
      {
        name: "Honey",
        short: "Honey",
        tiers: [
          { name: "Wide Swarm", cost: 130, adds: "+15% range", blurb: "The bees range further from the hive.", mod: { range: 1.15 } },
          { name: "Honey", cost: 300, adds: "stuck: 65% speed for 1.5 s", blurb: "The swarm drips honey. Whatever it stings is stuck in it.", mod: { sticky: { factor: 0.65, secs: 1.5 } } },
          {
            name: "Honey Marsh",
            cost: 1600,
            adds: "a honey patch: everything in range at 50%",
            blurb: "Honey all over the lane. Everything in reach wades through it, and the stings stick harder.",
            mod: { slow: 0.5, sticky: { factor: 0.5, secs: 2 }, pierce: 4 },
          },
        ],
      },
      {
        name: "Scent",
        short: "Scent",
        tiers: [
          { name: "Quick Wings", cost: 150, adds: "fires 25% faster", blurb: "Faster wings, faster stings.", mod: { rate: 1.25 } },
          { name: "Scent", cost: 280, adds: "sees Stealth", blurb: "The bees smell what the eye can't: it stings hedge-camo.", mod: { detect: true } },
          {
            name: "Pollinator",
            cost: 1500,
            adds: "towers in range fire 15% faster",
            blurb: "The bees work the whole field: every tower in reach fires faster, this one most of all.",
            mod: { buff: 1.15, rate: 1.2 },
          },
        ],
      },
    ],
  },
  cannon: {
    paths: [
      {
        name: "Big Shells",
        short: "Shells",
        tiers: [
          { name: "Bigger Bore", cost: 250, adds: "+20% splash, +4 pierce", blurb: "A wider barrel, a wider burst.", mod: { splash: 1.2, pierce: 4 } },
          { name: "Heavy Shells", cost: 450, adds: "+1 layer a hit", blurb: "Seed potatoes the size of a fist.", mod: { damage: 1 } },
          {
            name: "Pumpkin Lobber",
            cost: 2400,
            adds: "pumpkins: +2 layers, stun 0.3 s",
            blurb: "Prize pumpkins. They burst wide and leave everything under them dazed (not Heavy Plant).",
            mod: { damage: 2, splash: 1.25, stun: 0.3 },
          },
        ],
      },
      {
        name: "Flak",
        short: "Flak",
        tiers: [
          { name: "Fast Loader", cost: 200, adds: "fires 30% faster", blurb: "Pip rigs a hopper. It reloads faster.", mod: { rate: 1.3 } },
          { name: "Air Burst", cost: 300, adds: "hits Airborne, fires 15% faster", blurb: "Shells that burst in the air: drones too.", mod: { air: true, rate: 1.15 } },
          {
            name: "Scatter Shot",
            cost: 1900,
            adds: "Sharp seeds: +8 pierce, beats Wrapped",
            blurb: "Every shell splits into a spray of sharp seed. Bubble wrap can't cushion it.",
            mod: { type: "sharp", pierce: 8, rate: 1.3 },
          },
        ],
      },
      {
        name: "Wrecker",
        short: "Wreck",
        tiers: [
          { name: "Long Barrel", cost: 150, adds: "+0.5 range", blurb: "A drainpipe for a barrel. It reaches further.", mod: { rangeAdd: 0.5 } },
          { name: "Shell Cracker", cost: 500, adds: "×2 on big shells", blurb: "Hardened shot: double layers off anything with a long shell.", mod: { shellMul: 2 } },
          {
            name: "Wrecking Shot",
            cost: 2600,
            adds: "12 layers off Plant and bosses, knockback",
            blurb: "One shot that wrecks heavy plant. Smaller vehicles are blown back up the lane.",
            mod: { plantDamage: 12, knockback: 0.5 },
          },
        ],
      },
    ],
  },
  mast: {
    paths: [
      {
        name: "Pirate Radio",
        short: "Pirate",
        tiers: [
          { name: "Tall Aerial", cost: 200, adds: "+25% range", blurb: "A longer aerial reveals more lane.", mod: { range: 1.25 } },
          { name: "Pirate Radio", cost: 400, adds: "vehicles in range take +25%", blurb: "Sol goes live and reads out their number plates: everything in range takes more.", mod: { vuln: 1.25 } },
          { name: "Broadcast Tower", cost: 2000, adds: "reveals the whole field, +50% taken", blurb: "It broadcasts to the whole county. Nothing on the field hides, and everything takes half again.", mod: { global: true, vuln: 1.5 } },
        ],
      },
      {
        name: "Clinic",
        short: "Clinic",
        tiers: [
          { name: "First Aid", cost: 180, adds: "towers in range shrug off charm and jam", blurb: "Ines sets up a first-aid post: towers in reach ignore influencers and paperwork.", mod: { cleanse: true } },
          { name: "Clinic", cost: 360, adds: "towers in range +15% range", blurb: "Tea, biscuits and a better view: towers in reach see further.", mod: { rangeAura: 1.15 } },
          { name: "Ward Round", cost: 1800, adds: "+25% range aura, +2 Goodwill a round", blurb: "A proper ward. Towers in reach see much further, and the village mends after every round.", mod: { rangeAura: 1.25, mend: 2, range: 1.2 } },
        ],
      },
      {
        name: "Siren",
        short: "Siren",
        tiers: [
          { name: "Loudhailer", cost: 200, adds: "towers in range fire 8% faster", blurb: "A loudhailer on the mast gees everyone up.", mod: { buff: 1.08 } },
          { name: "Siren", cost: 400, adds: "towers in range fire 15% faster", blurb: "A wailing siren. Every tower in reach fires faster.", mod: { buff: 1.15 } },
          {
            name: "Village Alarm",
            cost: 2000,
            adds: "+25% fire rate aura, slows to 80%",
            blurb: "The whole village turns out: towers in reach fire much faster, and drivers slow down to look.",
            mod: { buff: 1.25, slow: 0.8, range: 1.15 },
          },
        ],
      },
    ],
  },
  pond: {
    paths: [
      {
        name: "Freeze",
        short: "Freeze",
        tiers: [
          { name: "Cold Snap", cost: 140, adds: "slows to 60%", blurb: "A cold morning on the pond. Everything nearby crawls.", mod: { slow: 0.6 } },
          { name: "Thin Ice", cost: 380, adds: "stuns 0.4 s a hit", blurb: "The ducks skate over thin ice and the lorries stop to look.", mod: { stun: 0.4 } },
          { name: "Shatter", cost: 2200, adds: "vehicles in range take +40%, +6 pierce", blurb: "Frozen vehicles crack like glass: everything nearby takes far more.", mod: { vuln: 1.4, pierce: 6, slow: 0.5 } },
        ],
      },
      {
        name: "Mud",
        short: "Mud",
        tiers: [
          { name: "Wet Bank", cost: 120, adds: "+25% range", blurb: "The bank floods a little further each night.", mod: { range: 1.25 } },
          { name: "Bog", cost: 360, adds: "sticks for 2 s at 40%", blurb: "Whatever is hit sinks in to its axles.", mod: { sticky: { factor: 0.4, secs: 2 } } },
          { name: "Quagmire", cost: 2000, adds: "slows to 45%, sticks for 4 s", blurb: "A bog nothing leaves in a hurry, and wider than it was.", mod: { slow: 0.45, sticky: { factor: 0.3, secs: 4 }, range: 1.2 } },
        ],
      },
      {
        name: "Geese",
        short: "Geese",
        tiers: [
          { name: "Honk", cost: 130, adds: "+1 layer", blurb: "Geese on the bank. They bite.", mod: { damage: 1 } },
          { name: "Gander", cost: 340, adds: "+1 layer, knockback", blurb: "A big gander who shoves lorries back down the lane.", mod: { damage: 1, knockback: 0.4 } },
          { name: "Goose Army", cost: 2100, adds: "+4 layers, +6 pierce, fires 30% faster", blurb: "The whole flock turns out. Nobody has ever won an argument with them.", mod: { damage: 4, pierce: 6, rate: 1.3, type: "sharp" } },
        ],
      },
    ],
  },
  silo: {
    paths: [
      {
        name: "Elevator",
        short: "Lift",
        tiers: [
          { name: "Bigger Hopper", cost: 200, adds: "+2 layers", blurb: "A bigger hopper holds a bigger load.", mod: { damage: 2 } },
          { name: "Heavy Grain", cost: 500, adds: "×2 on big shells", blurb: "Dense shot that tears through anything with a long shell.", mod: { shellMul: 2 } },
          { name: "Combine", cost: 2400, adds: "+10 layers, +7 pierce, 12 layers off Plant", blurb: "A combine harvester in a silo. It takes a line of vehicles clean off the road.", mod: { damage: 10, pierce: 7, plantDamage: 12 } },
        ],
      },
      {
        name: "Spotter",
        short: "Spot",
        tiers: [
          { name: "Binoculars", cost: 180, adds: "+25% range", blurb: "Farmer Hale with a pair of binoculars.", mod: { range: 1.25 } },
          { name: "Spyglass", cost: 420, adds: "sees Stealth", blurb: "Nothing hides from the old spyglass.", mod: { detect: true } },
          { name: "Eye of the Shire", cost: 2200, adds: "vehicles in range take +35%, crits", blurb: "The whole shire watches through it: vehicles in reach take more, and some take a lot more.", mod: { vuln: 1.35, crit: { every: 4, mult: 3 } } },
        ],
      },
      {
        name: "Supply",
        short: "Supply",
        tiers: [
          { name: "Quick Chute", cost: 180, adds: "fires 25% faster", blurb: "A well-oiled chute.", mod: { rate: 1.25 } },
          { name: "Conveyor", cost: 440, adds: "fires 25% faster, hits Airborne", blurb: "A conveyor raises the grain to the sky.", mod: { rate: 1.25, air: true } },
          { name: "Harvest Airlift", cost: 2100, adds: "fires 60% faster, +3 pierce", blurb: "Grain by the helicopter-load.", mod: { rate: 1.6, pierce: 3 } },
        ],
      },
    ],
  },
  windmill: {
    paths: [
      {
        name: "Gale",
        short: "Gale",
        tiers: [
          { name: "Stiff Sails", cost: 60, adds: "gust shoves +0.3 cells", blurb: "New canvas on the sails. The gust has real weight now.", mod: { push: 0.3 } },
          { name: "Headwind", cost: 140, adds: "gust +0.4 cells, +20% range, +2 pierce", blurb: "The mill turns to face the lane: a longer reach and a harder shove.", mod: { push: 0.4, range: 1.2, pierce: 2 } },
          { name: "Cyclone", cost: 1800, adds: "gust +0.8 cells, +8 pierce", blurb: "The sails spin so hard the air itself throws lorries back down the road.", mod: { push: 0.8, pierce: 8 } },
        ],
      },
      {
        name: "Tempo",
        short: "Tempo",
        tiers: [
          { name: "Oiled Hub", cost: 60, adds: "gusts 30% faster", blurb: "A drop of oil in the hub. The sails never stop.", mod: { rate: 1.3 } },
          { name: "Twin Sails", cost: 150, adds: "gusts 30% faster, +1 layer, +2 pierce", blurb: "A second set of sails, turning the other way.", mod: { rate: 1.3, damage: 1, pierce: 2 } },
          { name: "Whirlwind", cost: 1900, adds: "gusts 50% faster, +2 layers, +6 pierce", blurb: "Bea stops counting the gusts. There is just wind.", mod: { rate: 1.5, damage: 2, pierce: 6 } },
        ],
      },
      {
        name: "Mill",
        short: "Mill",
        tiers: [
          { name: "Millstone", cost: 60, adds: "+1 layer", blurb: "Everything the gust throws is ground a little finer.", mod: { damage: 1 } },
          { name: "Sharpened Sails", cost: 140, adds: "+1 layer, Sharp", blurb: "Iron-edged sails that cut, not just batter.", mod: { damage: 1, type: "sharp" } },
          { name: "Grinder", cost: 1800, adds: "+3 layers, +10 pierce, ×2 on big shells", blurb: "The millstones come out of the cellar and into the wind.", mod: { damage: 3, pierce: 10, shellMul: 2 } },
        ],
      },
    ],
  },
  stall: {
    paths: [
      {
        name: "Trade",
        short: "Trade",
        tiers: [
          { name: "Fresh Produce", cost: 120, adds: "+40 Marks a round", blurb: "Ines stacks the crates higher. People queue.", mod: { income: 40 } },
          { name: "Loyalty Cards", cost: 280, adds: "+80 Marks a round", blurb: "Stamp ten, get one free. The village is hooked.", mod: { income: 80 } },
          { name: "Farmers' Market", cost: 1600, adds: "+260 Marks a round", blurb: "The whole county sets up beside her. The till never closes.", mod: { income: 260 } },
        ],
      },
      {
        name: "Cheer",
        short: "Cheer",
        tiers: [
          { name: "Bunting", cost: 120, adds: "towers in range fire 25% faster", blurb: "Flags over every tower. Spirits lift.", mod: { buff: 1.25 } },
          { name: "Brass Band", cost: 280, adds: "towers in range fire 35% faster, +25% range", blurb: "A brass band on a crate. Everyone fires in time.", mod: { buff: 1.35, range: 1.25 } },
          { name: "Street Party", cost: 1700, adds: "towers in range fire 50% faster, +40 Marks a round", blurb: "The road is shut, the bunting is out and every tower is dancing.", mod: { buff: 1.5, range: 1.2, income: 40 } },
        ],
      },
      {
        name: "Charity",
        short: "Charity",
        tiers: [
          { name: "Tea Urn", cost: 100, adds: "+1 Goodwill a round", blurb: "A tea urn on the counter. Spirits mend.", mod: { mend: 1 } },
          { name: "Bake Sale", cost: 240, adds: "+2 Goodwill, +25 Marks a round", blurb: "Mrs Okafor's lemon drizzle sells out by ten.", mod: { mend: 2, income: 25 } },
          { name: "Village Fete", cost: 1500, adds: "+4 Goodwill, +90 Marks a round", blurb: "Tombola, coconut shy and a great deal of goodwill.", mod: { mend: 4, income: 90 } },
        ],
      },
    ],
  },
  court: {
    paths: [
      {
        name: "Injunction",
        short: "Writ",
        tiers: [
          { name: "Stay of Proceedings", cost: 140, adds: "injunctions hold 1.5 s longer", blurb: "Mara reads the small print aloud. Slowly.", mod: { injunction: 1.5 } },
          { name: "Gag Order", cost: 320, adds: "injunctions hold 3 s longer", blurb: "The boss will now be quiet. And still.", mod: { injunction: 3 } },
          { name: "Supreme Court", cost: 1800, adds: "injunctions hold 7 s longer, +30% range", blurb: "There is no appeal. There is only the gavel.", mod: { injunction: 7, range: 1.3 } },
        ],
      },
      {
        name: "Docket",
        short: "Docket",
        tiers: [
          { name: "Fast Track", cost: 130, adds: "serves 30% more often", blurb: "Mara skips the queue and the tea break.", mod: { rate: 1.3 } },
          { name: "Duty Solicitor", cost: 300, adds: "serves 60% more often, +20% range", blurb: "Three clerks, one stamp, no waiting.", mod: { rate: 1.6, range: 1.2 } },
          { name: "Night Court", cost: 1700, adds: "serves twice as often, +40% range", blurb: "The lights never go out and neither do the hearings.", mod: { rate: 2.2, range: 1.4 } },
        ],
      },
      {
        name: "Class Action",
        short: "Class",
        tiers: [
          { name: "Group Claim", cost: 160, adds: "serves every vehicle in range, not just bosses", blurb: "Mara files on behalf of everyone who ever got a parking ticket.", mod: { classAction: true } },
          { name: "Summons", cost: 340, adds: "+1 s hold, +20% range", blurb: "A hand-delivered summons, in triplicate.", mod: { injunction: 1, range: 1.2 } },
          { name: "Mass Tort", cost: 1900, adds: "+2.5 s hold, serves 50% more often", blurb: "Every van in the county, in one filing.", mod: { injunction: 2.5, rate: 1.5 } },
        ],
      },
    ],
  },
};

/** Crowns for the other four path towers (M5): passive, one per path, one of each per field. */
const C = (name: string, cost: number, adds: string, blurb: string, mod: PathMod, ability?: CrownAbility): PathTier => ({ name, cost, adds, blurb, mod, ...(ability ? { ability } : {}) });
const PASSIVE_CROWNS: Record<Exclude<PathKind, "scarecrow">, [PathTier, PathTier, PathTier]> = {
  hedgerow: [
    C("Impenetrable Thicket", 18000, "60-hit piles, laid 2× as fast, scratches +1/s", "A thicket no lorry has ever left. Piles of sixty, laid twice as fast, and every thorn bites.", { piles: { hits: 60, every: 0.8, max: 6 }, thorns: 1 }, { kind: "freeze", name: "Overgrow", blurb: "Every ground enemy within 4 cells is rooted for 2.5 seconds.", cooldown: 40, secs: 2.5, reach: 4 }),
    C("Labyrinth", 16000, "slows to 22%, +50% range", "The hedge maze of a stately home, laid across the lane. Nothing finds its way out.", { slow: 0.22, range: 1.5 }, { kind: "freeze", name: "Lost in the Maze", blurb: "Every ground enemy within 6 cells is rooted for 3 seconds.", cooldown: 50, secs: 3, reach: 6 }),
    C("Hay Barn", 20000, "holds 6 for 2 s, rams 4 layers", "A whole barn of hay, a whole barn of farmhands: six held still, and the tractor hits like a train.", { hold: { secs: 2, every: 4, count: 6 }, damage: 2, knockback: 1 }, { kind: "blackout", name: "Hay Rush", blurb: "Fires three times as fast for 8 seconds.", cooldown: 45, secs: 8 }),
  ],
  beehive: [
    C("Hornet Nest", 22000, "+6 pierce, +2 layers, poison spreads 3 layers/s", "The bees have called in the hornets. Nobody asked them to.", { pierce: 6, damage: 2, poison: { dps: 3, secs: 4, spread: true } }, { kind: "blackout", name: "Swarm Frenzy", blurb: "Fires three times as fast for 8 seconds.", cooldown: 45, secs: 8 }),
    C("Royal Jelly", 20000, "slows to 35%, stuck for 3 s, +25% range", "Royal jelly by the bucket. The whole lane is a sticky floor.", { slow: 0.35, sticky: { factor: 0.35, secs: 3 }, range: 1.25 }, { kind: "freeze", name: "Honey Flood", blurb: "Every ground enemy within 6 cells is stuck fast for 3 seconds.", cooldown: 50, secs: 3, reach: 6 }),
    C("Colony", 24000, "towers in range fire 30% faster", "A whole colony working the field: every tower in reach fires faster, and the hive fastest of all.", { buff: 1.3, rate: 1.4 }, { kind: "standup", name: "Hive Mind", blurb: "Every tower within 4 cells fires three times as fast for 6 seconds.", cooldown: 55, secs: 6, reach: 4, all: true }),
  ],
  cannon: [
    C("Giant Pumpkin Mortar", 26000, "+50% splash, +3 layers, +8 pierce", "The village giant-vegetable winner, loaded with its own prize.", { splash: 1.5, damage: 3, pierce: 8 }, { kind: "strike", name: "Pumpkin Drop", blurb: "One enormous pumpkin takes 40 layers off the strongest enemy on the field.", cooldown: 40, amount: 40 }),
    C("Grapeshot", 22000, "fires 2× as fast, hits Airborne, +30% range", "Pip's scrapyard flak storm: a hail of bolts at the whole sky.", { rate: 2, air: true, range: 1.3 }, { kind: "blackout", name: "Flak Storm", blurb: "Fires three times as fast for 6 seconds.", cooldown: 40, secs: 6 }),
    C("Siege Cannon", 28000, "×3 on big shells, +6 layers on Plants", "Hand-me-down from a castle. It does not care what the shell is made of.", { shellMul: 3, plantDamage: 6 }, { kind: "strike", name: "Siege Volley", blurb: "A castle's worth of shot takes 80 layers off the strongest enemy on the field.", cooldown: 55, amount: 80 }),
  ],
  mast: [
    C("Radio Free Hedgerow", 26000, "reveals the field, vehicles take +90%", "Sol broadcasts the whole county's weak spots on every frequency.", { global: true, detect: true, vuln: 1.9 }, { kind: "freeze", name: "Dead Air", blurb: "Every ground enemy on the field is rooted for 1.5 seconds.", cooldown: 60, secs: 1.5, reach: 99 }),
    C("Field Hospital", 24000, "+40% range aura, +5 Goodwill a round", "Ines turns the village hall into a field hospital. Everyone feels better, and sees further.", { rangeAura: 1.4, cleanse: true, mend: 5 }, { kind: "triage", name: "Triage", blurb: "Mends 15 Goodwill at once.", cooldown: 60, amount: 15 }),
    C("Emergency Broadcast", 26000, "towers in range fire 30% faster", "Every siren in the county, at once. Nobody in range is slow now.", { buff: 1.3, rate: 1.2 }, { kind: "standup", name: "All Hands", blurb: "Every tower within 5 cells fires three times as fast for 6 seconds.", cooldown: 55, secs: 6, reach: 5, all: true }),
  ],
  pond: [
    C("Frost Fair", 22000, "vehicles take +80%, slows to 30%, +10 pierce", "The pond freezes over and the whole village skates. Nothing on the lane moves, and everything cracks.", { vuln: 1.8, slow: 0.3, pierce: 10 }, { kind: "freeze", name: "Deep Freeze", blurb: "Every ground enemy within 6 cells is frozen solid for 3 seconds.", cooldown: 60, secs: 3, reach: 6 }),
    C("Bog of Ages", 20000, "slows to 25%, stuck for 5 s, +40% range", "A bog older than the village. It has never let anything go.", { slow: 0.25, sticky: { factor: 0.2, secs: 5 }, range: 1.4 }, { kind: "freeze", name: "Sinkhole", blurb: "Every ground enemy within 5 cells is stuck fast for 3 seconds.", cooldown: 50, secs: 3, reach: 5 }),
    C("Goose Army", 21000, "+8 layers, +12 pierce, fires 2× as fast", "Every goose in the county, and a few from the next one over.", { damage: 8, pierce: 12, rate: 2, knockback: 0.6 }, { kind: "blackout", name: "Honk Charge", blurb: "Fires three times as fast for 8 seconds.", cooldown: 45, secs: 8 }),
  ],
  silo: [
    C("Combine Harvester", 28000, "+25 layers, +14 pierce, 40 off Plant", "The silo and the combine are one machine now. The lane is a field.", { damage: 25, pierce: 14, plantDamage: 40 }, { kind: "strike", name: "Full Harvest", blurb: "A whole season's grain takes 60 layers off the strongest enemy on the field.", cooldown: 45, amount: 60 }),
    C("All-Seeing Eye", 24000, "reveals the field, vehicles take +60%", "Farmer Hale sees everything from up there. So does everyone else, now.", { global: true, detect: true, vuln: 1.6 }, { kind: "freeze", name: "Spotlight", blurb: "Every ground enemy on the field is rooted for 1.5 seconds.", cooldown: 60, secs: 1.5, reach: 99 }),
    C("Airlift Depot", 26000, "fires 2.5× as fast, +8 pierce", "Grain by the tonne, from the sky, forever.", { rate: 2.5, pierce: 8 }, { kind: "blackout", name: "Airdrop", blurb: "Fires three times as fast for 6 seconds.", cooldown: 40, secs: 6 }),
  ],
  windmill: [
    C("Hurricane", 22000, "gust +1.5 cells, +12 pierce, +20% range", "A named storm, grinding corn. Nothing on the lane stays where it was.", { push: 1.5, pierce: 12, range: 1.2 }, { kind: "freeze", name: "Eye of the Storm", blurb: "Every ground enemy within 6 cells is rooted for 2.5 seconds.", cooldown: 50, secs: 2.5, reach: 6 }),
    C("Perpetual Motion", 21000, "gusts 2.2× as fast, +4 layers, +8 pierce", "Bea finally gets the mill to turn itself. Physicists are writing letters.", { rate: 2.2, damage: 4, pierce: 8 }, { kind: "blackout", name: "Full Sail", blurb: "Gusts three times as fast for 8 seconds.", cooldown: 45, secs: 8 }),
    C("Stone Mill", 24000, "+15 layers, +14 pierce, 30 off Plant", "A mill that grinds anything: lorries, bosses, the occasional bank.", { damage: 15, pierce: 14, plantDamage: 30, shellMul: 2 }, { kind: "strike", name: "Grindstone", blurb: "The great stone takes 50 layers off the strongest enemy on the field.", cooldown: 45, amount: 50 }),
  ],
  court: [
    C("Eternal Stay", 22000, "injunctions hold 14 s longer, +40% range", "Time itself waits on the paperwork.", { injunction: 14, range: 1.4 }, { kind: "freeze", name: "Habeas Corpus", blurb: "Every enemy on the field stops for 4 seconds.", cooldown: 50, secs: 4 }),
    C("Round-the-Clock Bench", 20000, "serves 3.5× as often, +50% range", "Four judges in shifts. Nobody has seen the sun in weeks.", { rate: 3.5, range: 1.5 }, { kind: "freeze", name: "Emergency Hearing", blurb: "Everything on the field stops for 3 seconds.", cooldown: 40, secs: 3 }),
    C("Landmark Ruling", 24000, "serves everything, holds 6 s longer, 2× as often", "A ruling that rewrites the road.", { classAction: true, injunction: 6, rate: 2 }, { kind: "strike", name: "Contempt of Court", blurb: "The strongest enemy on the field loses 40 layers.", cooldown: 45, amount: 40 }),
  ],
  stall: [
    C("Grand Bazaar", 20000, "+900 Marks a round", "Every stall in the county under one roof, and a cut of every sale.", { income: 900 }, { kind: "triage", name: "Flash Sale", blurb: "Everything must go: Goodwill mends at once.", cooldown: 60, amount: 6 }),
    C("Carnival", 22000, "towers in range fire 80% faster, +30% range", "Fairground lights, a brass band and a great deal of candyfloss.", { buff: 1.8, range: 1.3 }, { kind: "standup", name: "Carnival Night", blurb: "Every tower within 4 cells fires three times as fast for 6 seconds.", cooldown: 55, secs: 6, reach: 4, all: true }),
    C("Jubilee", 18000, "+8 Goodwill, +400 Marks a round", "A royal jubilee: bunting from here to the coast and money in every tin.", { mend: 8, income: 400 }, { kind: "triage", name: "Jubilee Cheer", blurb: "Goodwill mends at once.", cooldown: 60, amount: 8 }),
  ],
};
for (const [k, crowns] of Object.entries(PASSIVE_CROWNS) as [Exclude<PathKind, "scarecrow">, [PathTier, PathTier, PathTier]][])
  crowns.forEach((c, i) => (PATHS[k].paths[i]!.crown = c));


/** Is this build allowed? At most two paths bought into, at most one past tier 2, none past PATH_TIERS. */
export function pathLegal(p: readonly number[]): boolean {
  if (p.length !== 3) return false;
  let used = 0;
  let deep = 0;
  for (const n of p) {
    if (!Number.isInteger(n) || n < 0 || n > PATH_TIERS) return false;
    if (n > 0) used++;
    if (n > 2) deep++;
  }
  return used <= 2 && deep <= 1;
}

/** The build after buying the next tier of path `i`. */
export function nextPath(p: Path, i: PathIndex): Path {
  const n: Path = [p[0], p[1], p[2]];
  n[i] += 1;
  return n;
}

/**
 * Why path `i` can't take its next tier (null if it can): it's at the top, the crosspath rule, or tier 3 isn't
 * open on this level yet.
 */
export function pathBlock(p: Path, i: PathIndex, levelId: number): string | null {
  if (p[i] >= PATH_TIERS) return "Top tier.";
  const n = nextPath(p, i);
  if (!pathLegal(n)) {
    const used = p.filter((x) => x > 0).length;
    if (p[i] === 0 && used >= 2) return "Crosspath: a tower takes at most two paths.";
    return "Crosspath: only one path goes past tier 2.";
  }
  if (n[i] >= 3 && levelId < T3_FIRST_LEVEL) return `Tier 3 opens at level ${T3_FIRST_LEVEL}.`;
  return null;
}

/** The price of path `i`'s next tier (null at the top). */
export function pathCost(kind: PathKind, p: Path, i: PathIndex): number | null {
  if (p[i] >= PATH_TIERS) return null;
  return PATHS[kind].paths[i].tiers[p[i]]!.cost;
}

/** Everything a build has cost in upgrades. */
export function pathSpent(kind: PathKind, p: Path): number {
  let s = 0;
  for (const i of [0, 1, 2] as const) for (let k = 0; k < p[i]; k++) s += PATHS[kind].paths[i].tiers[k]!.cost;
  return s;
}

/** The tiers a build has bought, in path order. */
export function boughtTiers(kind: PathKind, p: Path): PathTier[] {
  const out: PathTier[] = [];
  for (const i of [0, 1, 2] as const) for (let k = 0; k < p[i]; k++) out.push(PATHS[kind].paths[i].tiers[k]!);
  return out;
}

/** "3-2-0". */
export function buildName(p: readonly number[]): string {
  return p.join("-");
}

/** The tier-3 path of a build, if it has one (it decides the tower's silhouette). */
export function topPath(p: readonly number[]): PathIndex | null {
  const i = p.findIndex((n) => n >= 3);
  return i < 0 ? null : (i as PathIndex);
}

/** The display tier (1-3) for a path tower: 1 plus its deepest path, capped at 3 (a tier 3 shows its own look). */
export function pathTier(p: readonly number[]): 1 | 2 | 3 {
  return Math.min(3, 1 + Math.min(2, Math.max(p[0]!, p[1]!, p[2]!))) as 1 | 2 | 3;
}

/** A build with every path held to tier 2 (a lobbyist's whispers make a tower forget its tier 3). */
export function capPath(p: Path): Path {
  return [Math.min(2, p[0]), Math.min(2, p[1]), Math.min(2, p[2])];
}

/**
 * The legacy adapter: a tower without paths shows its tiers as path A (tier 2 and 3 as A1 and A2, a
 * specialisation as A3). It is also how an old spec maps to a path (save v3, replays).
 */
export function legacyPath(tier: number, spec: 0 | 1 | null | undefined): Path {
  return [Math.max(0, Math.min(2, tier - 1)) + (tier >= 4 && spec != null ? 1 : 0), 0, 0];
}

/**
 * The nearest path for an old specialisation of a path tower: the path whose tier 3 does the same job
 * (Scarecrow Pumpkin Lobber → Flock... see the table). Used to read old saves' and replays' spec choices.
 */
export const SPEC_TO_PATH: Record<PathKind, [PathIndex, PathIndex]> = {
  // Pumpkin Lobber (splash) → Scythe (crowds); Crow Caller → Flock.
  scarecrow: [2, 0],
  // Blackthorn → Blackthorn; Bramble Maze → Bramble Maze.
  hedgerow: [0, 1],
  // Killer Queen → Killer Bees; Honey Trap → Honey.
  beehive: [0, 1],
  // Pumpkin Mortar → Big Shells; Scatter Shot → Flak.
  cannon: [0, 1],
  // Pirate Radio → Pirate Radio; Emergency Siren → Siren.
  mast: [0, 2],
  // Duck swarm → Geese; the cold spec → Freeze.
  pond: [2, 0],
  // Heavy grain → Elevator; the wide spec → Supply.
  silo: [0, 2],
  // Gust-damage spec → Mill; the push spec → Gale.
  windmill: [2, 0],
  // Income spec → Trade; the cheer spec → Cheer.
  stall: [0, 1],
  // Writ spec → Injunction; the class-action spec → Class Action.
  court: [0, 2],
};

/** An old tier and spec as a build on paths (tiers 2 and 3 along the spec's path; the spec its tier 3). */
export function specToPath(kind: PathKind, tier: number, spec: 0 | 1 | null | undefined): Path {
  const i = spec != null ? SPEC_TO_PATH[kind][spec] : SPEC_TO_PATH[kind][0];
  const p: Path = [0, 0, 0];
  p[i] = Math.max(0, Math.min(2, tier - 1)) + (tier >= 4 && spec != null ? 1 : 0);
  return p;
}

/**
 * Named builds for the bots (and the tuner's logs): `crow-3-2-0` is a Scarecrow taking Flock to 3 and
 * Lookout to 2. The order in which a bot buys a build's tiers: every path's tier 1, then tier 2, then the 3.
 */
export const BUILD_PREFIX: Record<PathKind, string> = { scarecrow: "crow", hedgerow: "hedge", beehive: "bees", cannon: "cannon", mast: "mast", court: "court", pond: "pond", silo: "silo", windmill: "mill", stall: "stall" };

export function parseBuild(name: string): { kind: PathKind; path: Path } | null {
  const m = /^([a-z]+)-(\d)-(\d)-(\d)$/.exec(name);
  if (!m) return null;
  const kind = (Object.keys(BUILD_PREFIX) as PathKind[]).find((k) => BUILD_PREFIX[k] === m[1]);
  const path: Path = [Number(m[2]), Number(m[3]), Number(m[4])];
  return kind && pathLegal(path) ? { kind, path } : null;
}

/**
 * The next path to buy towards `goal` from `p`, or null if it's there (or past it). The main path (the deepest
 * in the goal) goes to tier 2 first, then the other path to its goal, then the main path's tier 3: the order a
 * player saving for a tier 3 buys in.
 */
export function stepToward(p: Path, goal: Path): PathIndex | null {
  const order = ([0, 1, 2] as const).filter((i) => goal[i] > 0).sort((a, b) => goal[b] - goal[a] || a - b);
  for (const i of order) if (p[i] < Math.min(2, goal[i])) return i;
  for (const i of order) if (p[i] < goal[i]) return i;
  return null;
}
