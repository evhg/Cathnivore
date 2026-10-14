// The Round Book (Hedgerow 2, docs/design/hedgerow-2.md section 5): one canonical list of rounds, the same on
// every play, so a player learns "the Sprinter rush is round 6" and "the first Box Lorry is round 10". Story
// levels play a window of it. Each round has a theme, a one-line card and a Fleet Value budget of about
// 18 * r^1.5 (0.6 of it on a breather, 1.6 on a spike). M2 authored rounds 1-30; M3 applies the properties
// (Wrapped at 8, Sealed at 15, Reefer at 18, Stealth at 22, Plated at 26, Rebrand at 30) and writes 31-45.

import type { EnemyKind, WaveGroup } from "./engine";
import { fvOf, propMask, roundBonus, type Property } from "./fleet";

export type { Property };

export interface BookGroup {
  rung: EnemyKind;
  count: number;
  /** Seconds between spawns. */
  gap: number;
  /** Seconds into the round before the group starts. */
  delay?: number;
  /** Properties every vehicle in the group carries (Stealth, Plated...), on top of its rung's own. */
  props?: Property[];
  /** Lock scouts: they slip past Cath, so only the field's key stops them. */
  scout?: true;
}

export interface BookRound {
  /** The round's name on its card. */
  theme: string;
  /** The one-line card. */
  card: string;
  groups: BookGroup[];
  breather?: boolean;
  /** A spike round: 1.6 times the budget. */
  spike?: boolean;
}

const g = (rung: EnemyKind, count: number, gap: number, delay = 0, props?: Property[]): BookGroup => ({
  rung,
  count,
  gap,
  ...(delay ? { delay } : {}),
  ...(props ? { props } : {}),
});

/** Rounds 1-45. Index 0 is round 1. */
export const BOOK: BookRound[] = [
  { theme: "Couriers", card: "Scooters with parcels, one tap each, and a few hatchbacks. Pop one and watch it peel.", groups: [g("courier", 12, 0.8), g("hatchback", 3, 1.6, 3)] },
  { theme: "Hatchbacks", card: "Pop a hatchback and a courier scoots on.", groups: [g("courier", 25, 0.5), g("hatchback", 13, 1, 3)] },
  { theme: "The vans", card: "Three layers to a van: van, hatchback, courier.", groups: [g("courier", 20, 0.4), g("hatchback", 22, 0.6, 2), g("van", 10, 1.1, 5)] },
  { theme: "Morning run", card: "Hatchbacks and vans, nose to tail.", groups: [g("hatchback", 30, 0.383), g("courier", 30, 0.255, 1.7), g("van", 18, 0.595, 5.1)] },
  { theme: "Pickups", card: "Pickups are quick on the straights. Under each one, a van.", groups: [g("van", 24, 0.425), g("hatchback", 30, 0.297, 1.7), g("pickup", 9, 1.02, 6.8), g("courier", 33, 0.212, 3.4)] },
  { theme: "Same-Day rush", card: "Round 6: the violet Same-Day vans. Fastest thing on the lane.", groups: [g("van", 35, 0.34), g("hatchback", 35, 0.297, 1.7), g("sprinter", 18, 0.595, 3.4)] },
  { theme: "School run", card: "Vans, pickups and a few Same-Day vans.", groups: [g("van", 55, 0.255), g("pickup", 30, 0.383, 2.55), g("sprinter", 10, 0.68, 7.65)] },
  { theme: "Bubble wrap", card: "Round 8: the first bubble-wrapped Same-Day vans. Wrap cushions blasts; beaks and stings pop it.", groups: [g("pickup", 50, 0.255), g("sprinter", 16, 0.595, 3.4, ["wrapped"]), g("van", 42, 0.255, 1.7)] },
  { theme: "Rush hour", card: "Thirty Same-Day vans and a queue behind them. Hedges pay off here.", groups: [g("sprinter", 30, 0.383), g("pickup", 50, 0.255, 1.7), g("van", 45, 0.255, 3.4)] },
  { theme: "The first Box Lorry", card: "Round 10: Box Lorries. Pop the box and two Same-Day vans burst out.", groups: [g("lorry", 12, 0.84, 2.8), g("sprinter", 50, 0.21), g("pickup", 47, 0.21, 1.4)] },
  { theme: "A breather", card: "A lighter round. Spend, upgrade, stack the next one if you dare.", breather: true, groups: [g("van", 60, 0.175), g("pickup", 30, 0.28, 1.4), g("sprinter", 19, 0.42, 3.5)] },
  { theme: "Drone swarm", card: "Round 12: drones and quadcopters. Only towers that hit the air can reach them.", groups: [g("drone", 120, 0.084), g("quad", 60, 0.175, 2.1), g("lorry", 20, 0.49, 1.4), g("pickup", 46, 0.21, 2.8), g("sprinter", 9, 0.7, 5.6)] },
  { theme: "Lorries and rush vans", card: "Thirty Box Lorries. Splash where they pop.", groups: [g("lorry", 30, 0.35), g("sprinter", 60, 0.175, 1.4), g("pickup", 54, 0.175, 3.5)] },
  { theme: "Convoy", card: "A spike: lorries nose to tail, Same-Day vans weaving through.", spike: true, groups: [g("lorry", 64, 0.175), g("sprinter", 160, 0.07, 2.1)] },
  { theme: "Sealed lorries", card: "Round 15: Sealed lorries. A mesh grille keeps the bees out: Scarecrows and gusts get through.", groups: [g("lorry", 50, 0.245, 0, ["sealed"]), g("sprinter", 60, 0.175, 1.4), g("pickup", 49, 0.175, 3.5)] },
  { theme: "Air and road", card: "Lorries below, quadcopters above.", groups: [g("lorry", 60, 0.21), g("quad", 40, 0.245, 2.1), g("sprinter", 74, 0.14, 4.2)] },
  { theme: "The wall", card: "A spike: a solid wall of Box Lorries.", spike: true, groups: [g("lorry", 112, 0.119), g("sprinter", 157, 0.077, 2.8)] },
  { theme: "Cold chain", card: "Round 18: Reefer lorries. Frost boxes shrug off every slow and hold: hit them instead.", groups: [g("lorry", 80, 0.168, 0, ["reefer"]), g("quad", 60, 0.175, 2.8), g("sprinter", 63, 0.14, 4.2)] },
  { theme: "Long haul", card: "Ninety lorries and a hundred rush vans.", groups: [g("lorry", 90, 0.154), g("sprinter", 100, 0.119, 2.1)] },
  { theme: "The hundred and sixty", card: "A spike: a hundred and sixty Box Lorries. Everything you've got.", spike: true, groups: [g("lorry", 160, 0.084), g("sprinter", 163, 0.07, 2.1)] },
  { theme: "Air lift", card: "A hundred quadcopters over a hundred lorries.", groups: [g("lorry", 110, 0.126), g("quad", 100, 0.126, 2.1), g("sprinter", 44, 0.21, 5.6)] },
  { theme: "Stealth lorries", card: "Round 22: Stealth lorries. Bring a Radio Mast: Cath only shows the two she holds.", groups: [g("lorry", 120, 0.119, 0, ["stealth"]), g("sprinter", 108, 0.112, 2.1)] },
  { theme: "A breather", card: "Pickups and a few lorries. Catch your breath.", breather: true, groups: [g("lorry", 60, 0.21), g("pickup", 100, 0.126, 1.4), g("sprinter", 26, 0.35, 4.2)] },
  { theme: "Gridlock", card: "A spike: lorries end to end.", spike: true, groups: [g("lorry", 224, 0.063), g("sprinter", 184, 0.07, 2.1)] },
  { theme: "Drone cloud", card: "Two hundred quadcopters. Look up.", groups: [g("lorry", 150, 0.091), g("quad", 200, 0.063, 1.4)] },
  { theme: "Plated lorries", card: "Round 26: Plated lorries. Beaks and thorns bounce off steel: bring stings, a gust or a blast.", groups: [g("lorry", 160, 0.084, 0, ["plated"]), g("sprinter", 125, 0.098, 2.1)] },
  { theme: "Depot day", card: "The whole depot comes out.", groups: [g("lorry", 170, 0.084), g("sprinter", 131, 0.098, 2.1)] },
  { theme: "Peak season", card: "Christmas deliveries, in October.", groups: [g("lorry", 180, 0.077), g("sprinter", 137, 0.091, 2.1)] },
  { theme: "Overtime", card: "A spike: three hundred lorries on overtime.", spike: true, groups: [g("lorry", 304, 0.045), g("sprinter", 230, 0.056, 2.1)] },
  { theme: "Rebrand", card: "Round 30: Rebranded lorries grow back a rung every 3 s. Pop them fast and all at once.", groups: [g("lorry", 200, 0.07, 0, ["rebrand"]), g("sprinter", 152, 0.084, 2.1)] },
  // Rounds 31-45 (M3). Round 36 is where M5's first Bulldozer will land; until Plants exist it is heavy haulage.
  { theme: "Steel", card: "Round 31: Plated Lorries, riveted steel all over. Two box lorries inside each.", groups: [g("steel", 100, 0.2), g("lorry", 73, 0.25, 2)] },
  { theme: "Plated convoy", card: "A spike: a hundred and fifty steel lorries, quadcopters overhead.", spike: true, groups: [g("steel", 150, 0.14), g("lorry", 120, 0.15, 2), g("quad", 148, 0.1, 4)] },
  { theme: "The Artic", card: "Round 33: Artics. Bubble-wrapped cab, frost-box trailer: no blasts, no slows.", groups: [g("artic", 100, 0.2), g("lorry", 60, 0.3, 2), g("sprinter", 90, 0.2, 4)] },
  { theme: "Car transporters", card: "Round 34: Car Transporters, two artics on every deck.", groups: [g("transporter", 50, 0.4), g("lorry", 110, 0.18, 2), g("sprinter", 2, 0.5, 4)] },
  { theme: "A breather", card: "Lorries and pickups. Spend, upgrade, stack if you dare.", breather: true, groups: [g("lorry", 120, 0.18), g("pickup", 150, 0.1, 2), g("sprinter", 63, 0.3, 4)] },
  { theme: "The first Bulldozer", card: "Round 36: Bulldozers. A heavy plant: 120 layers, no push or hold. Stack damage; it breaks into plated lorries.", groups: [g("plantdozer", 8, 3), g("transporter", 25, 0.8, 2), g("steel", 46, 0.4, 3)] },
  { theme: "Night freight", card: "Round 37: Stealth transporters. Masts along the whole lane.", groups: [g("transporter", 50, 0.4, 0, ["stealth"]), g("steel", 74, 0.25, 2)] },
  { theme: "Gridlock", card: "A spike: a hundred transporters and the artics behind them.", spike: true, groups: [g("transporter", 100, 0.2), g("artic", 89, 0.25, 2)] },
  { theme: "Sealed steel", card: "Round 39: Sealed steel lorries. Neither beaks nor bees: gusts, blasts and silos.", groups: [g("steel", 120, 0.18, 0, ["sealed"]), g("transporter", 34, 0.5, 2), g("sprinter", 5, 0.5, 4)] },
  { theme: "Rebrand transporters", card: "Round 40: Rebranded transporters. Pop them before they grow back.", groups: [g("transporter", 60, 0.35, 0, ["rebrand"]), g("artic", 75, 0.25, 2), g("drone", 9, 0.5, 3)] },
  { theme: "A breather", card: "Artics and lorries. Catch your breath.", breather: true, groups: [g("artic", 80, 0.25), g("lorry", 90, 0.2, 2), g("sprinter", 1, 0.5, 4)] },
  { theme: "Reinforced", card: "Round 42: Reinforced steel. Hazard bands: every shell takes twice the hits.", groups: [g("steel", 120, 0.18, 0, ["reinforced"]), g("transporter", 43, 0.45, 2)] },
  { theme: "Air bridge", card: "Transporters below, three hundred quadcopters above.", groups: [g("transporter", 80, 0.25), g("quad", 300, 0.07, 2), g("artic", 18, 1, 3)] },
  { theme: "The big push", card: "A spike: a hundred and forty transporters. Everything you've got.", spike: true, groups: [g("transporter", 140, 0.15), g("steel", 79, 0.25, 2), g("pickup", 2, 0.5, 4), g("drone", 2, 0.5, 4)] },
  { theme: "End of the line", card: "Round 45: transporters and steel to close the book's first half.", groups: [g("transporter", 90, 0.22), g("steel", 52, 0.38, 2), g("drone", 8, 0.5, 3)] },
  // Rounds 46-55 (M5): Plants. FV about 18 * r^1.5 (a Bulldozer is 212, a Skip 22).
  { theme: "Yard work", card: "Round 46: Bulldozers and Skips share the lane. Plants shrug off pushes: pile damage on.", groups: [g("plantdozer", 10, 2.2), g("skip", 40, 0.5, 1), g("transporter", 36, 0.6, 3), g("steel", 40, 0.3, 4)] },
  { theme: "Skip run", card: "A hundred and twenty Skips, each with three pickups under the lid.", groups: [g("skip", 120, 0.2), g("transporter", 62, 0.35, 2), g("sprinter", 40, 0.4, 3)] },
  { theme: "Rebrand Skip flood", card: "Round 48: Rebranded Skips. Each regrows a rung every 3 s: pop them together.", spike: true, groups: [g("skip", 220, 0.1, 0, ["rebrand"]), g("transporter", 100, 0.2, 3)] },
  { theme: "Haulage", card: "Bulldozers in line abreast, transporters behind.", groups: [g("plantdozer", 12, 1.8), g("transporter", 50, 0.4, 2), g("artic", 50, 0.3, 3)] },
  { theme: "Stealth plant", card: "Round 50: Stealth Bulldozers. A Mast shows them, and Plants can't be held.", groups: [g("plantdozer", 10, 2, 0, ["stealth"]), g("skip", 60, 0.3, 2), g("transporter", 60, 0.3, 3)] },
  { theme: "Plated yard", card: "Plated Skips and a bulldozer escort.", groups: [g("skip", 80, 0.3, 0, ["plated"]), g("plantdozer", 8, 2.5, 2), g("transporter", 66, 0.3, 3)] },
  { theme: "Wrapped", card: "Wrapped Skips: blasts are cushioned.", groups: [g("skip", 100, 0.24, 0, ["wrapped"]), g("plantdozer", 9, 2, 3), g("transporter", 58, 0.3, 3)] },
  { theme: "A breather", card: "A lighter round. Spend your Marks.", breather: true, groups: [g("transporter", 45, 0.3), g("steel", 60, 0.2, 2), g("plantdozer", 3, 4, 4)] },
  { theme: "Crane Convoy", card: "Round 54: the first Cranes. 240 layers each, and three Skips swinging from the hook. A spike: everything you've got.", spike: true, groups: [g("crane", 14, 1.5), g("plantdozer", 8, 2.5, 2), g("transporter", 115, 0.17, 4)] },
];

/**
 * Rounds 55-80 (M5). Hand-chosen compositions, fitted to the budget: each group is a share of the round's
 * Fleet Value, spread over `span` seconds, so a round is always within a few percent of 18 * r^1.5.
 */
interface Mix {
  rung: EnemyKind;
  share: number;
  span: number;
  delay?: number;
  props?: Property[];
}
function fit(round: number, theme: string, card: string, mix: Mix[], flag?: "breather" | "spike"): BookRound {
  const mult = flag === "breather" ? 0.6 : flag === "spike" ? 1.6 : 1;
  const b = 18 * Math.pow(round, 1.5) * mult;
  const groups = mix.map((m) => {
    const count = Math.max(1, Math.round((m.share * b) / fvOf(m.rung, propMask(m.props))));
    return g(m.rung, count, Math.round((m.span / count) * 1000) / 1000, m.delay ?? 0, m.props);
  });
  return { theme, card, groups, ...(flag ? { [flag]: true } : {}) };
}
BOOK.push(
  fit(55, "Convoy line", "Round 55: transporters, Skips and Bulldozers in one long line.", [{ rung: "transporter", share: 0.45, span: 20 }, { rung: "skip", share: 0.3, span: 18, delay: 1 }, { rung: "plantdozer", share: 0.25, span: 16, delay: 2 }]),
  fit(56, "Frozen yard", "Round 56: Reefer Skips. A frost box shrugs off every slow and hold.", [{ rung: "skip", share: 0.4, span: 20, props: ["reefer"] }, { rung: "transporter", share: 0.6, span: 20, delay: 1 }]),
  fit(57, "Skip rushes", "Round 57: three tight Skip rushes. One ability can't answer all three.", [{ rung: "skip", share: 0.25, span: 2.5 }, { rung: "skip", share: 0.25, span: 2.5, delay: 8 }, { rung: "skip", share: 0.25, span: 2.5, delay: 16 }, { rung: "transporter", share: 0.25, span: 20 }]),
  fit(58, "Stealth haulage", "Round 58: Stealth transporters and Bulldozers. A Radio Mast shows them all.", [{ rung: "transporter", share: 0.5, span: 20, props: ["stealth"] }, { rung: "plantdozer", share: 0.25, span: 18, props: ["stealth"], delay: 1 }, { rung: "steel", share: 0.25, span: 18, delay: 2 }]),
  fit(59, "Plated plant", "Round 59: Plated Bulldozers and Skips. Beaks and thorns bounce off.", [{ rung: "plantdozer", share: 0.4, span: 20, props: ["plated"] }, { rung: "skip", share: 0.3, span: 18, props: ["plated"], delay: 1 }, { rung: "transporter", share: 0.3, span: 18, delay: 2 }]),
  fit(60, "Rebrand haul", "Round 60: Rebranded transporters and artics. Pop them together.", [{ rung: "transporter", share: 0.5, span: 20, props: ["rebrand"] }, { rung: "artic", share: 0.5, span: 20, delay: 1, props: ["rebrand"] }]),
  fit(61, "A breather", "A lighter round of lorries and a few Skips. Spend, upgrade, stack.", [{ rung: "transporter", share: 0.6, span: 20 }, { rung: "skip", share: 0.4, span: 18, delay: 1 }], "breather"),
  fit(62, "The first Exec Car", "Round 62: Exec Cars. Black limos, quick and armoured, with transporters in their wake.", [{ rung: "execcar", share: 0.5, span: 20 }, { rung: "transporter", share: 0.3, span: 20, delay: 1 }, { rung: "skip", share: 0.2, span: 18, delay: 2 }]),
  fit(63, "Executive rush", "A spike: Exec Cars and Skips, all at once.", [{ rung: "execcar", share: 0.4, span: 16 }, { rung: "skip", share: 0.6, span: 20, delay: 1 }], "spike"),
  fit(64, "Air bridge", "Round 64: quadcopters above, transporters below.", [{ rung: "quad", share: 0.5, span: 20 }, { rung: "transporter", share: 0.5, span: 20, delay: 1 }]),
  fit(65, "Sealed plants", "Round 65: Sealed Skips and Bulldozers. A mesh grille keeps the bees out.", [{ rung: "skip", share: 0.4, span: 20, props: ["sealed"] }, { rung: "plantdozer", share: 0.3, span: 18, props: ["sealed"], delay: 1 }, { rung: "transporter", share: 0.3, span: 18, delay: 2 }]),
  fit(66, "Wrapped haul", "Round 66: Wrapped Cranes. Blasts are cushioned.", [{ rung: "crane", share: 0.4, span: 20, props: ["wrapped"] }, { rung: "transporter", share: 0.6, span: 20, delay: 1 }]),
  fit(67, "Crane pair", "Round 67: Cranes with Skips on the hook and transporters behind.", [{ rung: "crane", share: 0.4, span: 20 }, { rung: "skip", share: 0.3, span: 18, delay: 1 }, { rung: "transporter", share: 0.3, span: 18, delay: 2 }]),
  fit(68, "Mixed locks", "Round 68: stealth, steel and a frost box in one line.", [{ rung: "transporter", share: 0.3, span: 20, props: ["stealth"] }, { rung: "plantdozer", share: 0.3, span: 18, props: ["plated"], delay: 1 }, { rung: "skip", share: 0.4, span: 18, props: ["reefer"], delay: 2 }]),
  fit(69, "A breather", "Catch your breath: a Bulldozer or two and a long line of lorries.", [{ rung: "transporter", share: 0.7, span: 20 }, { rung: "plantdozer", share: 0.3, span: 15, delay: 3 }], "breather"),
  fit(70, "Reinforced Plants", "Round 70: Reinforced Plants. Hazard bands: every shell takes twice the hits.", [{ rung: "plantdozer", share: 0.4, span: 20, props: ["reinforced"] }, { rung: "skip", share: 0.3, span: 18, props: ["reinforced"], delay: 1 }, { rung: "crane", share: 0.3, span: 18, delay: 2 }]),
  fit(71, "Executive convoy", "A spike: Exec Cars in procession, transporters in their wake.", [{ rung: "execcar", share: 0.6, span: 18 }, { rung: "transporter", share: 0.4, span: 20, delay: 1 }], "spike"),
  fit(72, "Rebrand Execs", "Round 72: Rebranded Exec Cars grow a rung back every 3 s.", [{ rung: "execcar", share: 0.5, span: 20, props: ["rebrand"] }, { rung: "artic", share: 0.5, span: 20, delay: 1 }]),
  fit(73, "Plant parade", "Round 73: every Plant in the yard, one after another.", [{ rung: "skip", share: 0.3, span: 20 }, { rung: "plantdozer", share: 0.3, span: 18, delay: 1 }, { rung: "crane", share: 0.2, span: 16, delay: 2 }, { rung: "execcar", share: 0.2, span: 16, delay: 3 }]),
  fit(74, "Carrier wing", "Round 74: a wing of quadcopters over Bulldozers and transporters.", [{ rung: "quad", share: 0.5, span: 20 }, { rung: "transporter", share: 0.3, span: 20, delay: 1 }, { rung: "plantdozer", share: 0.2, span: 16, delay: 2 }]),
  fit(75, "Stealth plants", "Round 75: Stealth Bulldozers and Cranes. Bring the Mast.", [{ rung: "plantdozer", share: 0.35, span: 20, props: ["stealth"] }, { rung: "crane", share: 0.3, span: 18, props: ["stealth"], delay: 1 }, { rung: "transporter", share: 0.35, span: 18, delay: 2 }]),
  fit(76, "Lockdown", "Round 76: every lock at once. Sealed, Wrapped, Reefer and Plated.", [{ rung: "transporter", share: 0.25, span: 20, props: ["sealed"] }, { rung: "skip", share: 0.25, span: 18, props: ["wrapped"], delay: 1 }, { rung: "plantdozer", share: 0.25, span: 18, props: ["reefer"], delay: 2 }, { rung: "execcar", share: 0.25, span: 16, props: ["plated"], delay: 3 }]),
  fit(77, "A breather", "The last quiet round before the Borer. Spend everything.", [{ rung: "transporter", share: 0.6, span: 20 }, { rung: "skip", share: 0.4, span: 18, delay: 2 }], "breather"),
  fit(78, "Tunnel Borer", "Round 78: the Tunnel Borer. 400 layers of segment ring, two Bulldozers behind its cutter head.", [{ rung: "borer", share: 0.6, span: 12 }, { rung: "execcar", share: 0.2, span: 16, delay: 1 }, { rung: "transporter", share: 0.2, span: 18, delay: 2 }]),
  fit(79, "The last push", "A spike: Cranes, Bulldozers and Skips, nose to tail.", [{ rung: "plantdozer", share: 0.3, span: 20 }, { rung: "skip", share: 0.3, span: 20, delay: 1 }, { rung: "crane", share: 0.3, span: 18, delay: 2 }, { rung: "execcar", share: 0.1, span: 12, delay: 3 }], "spike"),
  fit(80, "The finale", "Round 80: a Tunnel Borer, Cranes, Bulldozers and Exec Cars. The Book ends here; Freeplay follows.", [{ rung: "borer", share: 0.3, span: 14 }, { rung: "crane", share: 0.2, span: 18, delay: 1 }, { rung: "plantdozer", share: 0.2, span: 18, delay: 2 }, { rung: "execcar", share: 0.15, span: 16, delay: 3 }, { rung: "transporter", share: 0.15, span: 20, delay: 4 }]),
);

/**
 * Act-themed swaps (section 5: "each act swaps about 3 Book rounds for act-themed ones"). Neighbouring story
 * levels can share a window (levels 2 and 3 both play rounds 2-13), so the second of each pair swaps three of
 * its rounds for themed ones of the same Fleet Value, leaving the rounds to remember (6, 10, 12, 14) alone.
 * Keyed by level id, then by Book round.
 */
export const SWAPS: Record<number, Record<number, BookRound>> = {
  // Mara's Field (M3 review, "flat 120/120, then a cliff"): the farm gate brings graded pressure. The first Box
  // Lorries come spaced out and a little lighter, so a tier 2 field bleeds over rounds 10-12 rather than dying in
  // two; round 11 is a short sharp Same-Day rush; and the drone round closes on a long rush that a field still on
  // tier 2 has to answer, and that dents a small or badly placed tier 3 field (four on random plots still win).
  1: {
    // M4: a little lighter on the farm (towers now grow a tier at a time along paths), so four Scarecrows on
    // whichever plots looked right still see the wrap off.
    8: { theme: "Bubble wrap", card: "Round 8: the first bubble-wrapped Same-Day vans. Wrap cushions blasts; beaks and stings pop it.", groups: [g("pickup", 40, 0.3), g("sprinter", 16, 0.595, 3.4, ["wrapped"]), g("van", 34, 0.3, 1.7)] },
    10: { theme: "The first Box Lorry", card: "Round 10: Box Lorries. Pop the box and two Same-Day vans burst out.", groups: [g("lorry", 10, 1.0, 2.8), g("sprinter", 40, 0.26), g("pickup", 38, 0.26, 1.4)] },
    11: { theme: "Farm gate rush", card: "A spike: forty-five Same-Day vans through the farm gate in two seconds.", spike: true, groups: [g("sprinter", 45, 0.035)] },
    12: { theme: "Drone swarm", card: "Round 12: drones and quadcopters, then a hundred Same-Day vans racing home under them.", spike: true, groups: [g("drone", 100, 0.1), g("quad", 45, 0.22, 2.1), g("sprinter", 100, 0.07, 10)] },
  },
  // Pie for the Road: the village fete.
  3: {
    5: { theme: "Pie delivery", card: "Hatchbacks racing pies to the fete, and the vans behind them.", groups: [g("hatchback", 60, 0.21), g("van", 27, 0.42, 2)] },
    9: { theme: "Fete traffic", card: "Everyone's driving to the fete: vans, then pickups.", groups: [g("van", 95, 0.15), g("pickup", 50, 0.25, 3)] },
    13: { theme: "Pie lorries", card: "Fifty Box Lorries of pies, with pickups tailgating.", groups: [g("lorry", 50, 0.28), g("pickup", 74, 0.2, 2)] },
  },
  // Bank Holiday: day trippers and queues.
  6: {
    4: { theme: "Day trippers", card: "Hatchbacks off to the coast, a few vans among them.", groups: [g("hatchback", 45, 0.22), g("van", 18, 0.35, 3)] },
    7: { theme: "Bank holiday queue", card: "Pickups bumper to bumper, rush vans losing patience.", groups: [g("pickup", 60, 0.2), g("van", 15, 0.4, 2), g("sprinter", 10, 0.4, 5)] },
    11: { theme: "Picnic traffic", card: "A lighter round of hatchbacks and vans. Spend, upgrade, stack if you dare.", breather: true, groups: [g("hatchback", 80, 0.12), g("van", 45, 0.2, 2), g("pickup", 25, 0.3, 5)] },
  },
  // Forty Drones: the delivery drones come early.
  8: {
    8: { theme: "Drone post", card: "A hundred delivery drones, then pickups and vans under them.", groups: [g("drone", 100, 0.1), g("pickup", 50, 0.2, 2), g("van", 35, 0.2, 4)] },
    13: { theme: "Quad lift", card: "A hundred quadcopters over thirty Box Lorries.", groups: [g("quad", 100, 0.12), g("lorry", 30, 0.3, 2), g("pickup", 54, 0.15, 4)] },
    16: { theme: "Air freight", card: "Box Lorries, quadcopters and rush vans, all at once.", groups: [g("lorry", 50, 0.24), g("quad", 100, 0.12, 2), g("sprinter", 60, 0.15, 4)] },
  },
  // Night Shift (M3, the M2 review's curve): at night the towers reach less far, so the same Fleet Value comes
  // spaced out over the round rather than in one wall; level 9 had played harder than the boss level after it.
  9: {
    13: { theme: "Night lorries", card: "Box Lorries in the dark, well spaced, rush vans and pickups behind.", groups: [g("lorry", 30, 0.6), g("sprinter", 60, 0.3, 2), g("pickup", 54, 0.35, 3)] },
    16: { theme: "Night flights", card: "Lorries, quadcopters and rush vans, one after another in the dark.", groups: [g("lorry", 60, 0.35), g("quad", 40, 0.5, 2), g("sprinter", 74, 0.28, 3)] },
    17: { theme: "Night convoy", card: "A long night convoy of Box Lorries, rush vans in their headlights.", spike: true, groups: [g("lorry", 112, 0.2), g("sprinter", 157, 0.14, 2)] },
  },
  // The Acquisition (M3, the M2 review's curve): the boss level brings act 1's locks back together, so it
  // plays harder than the night before it rather than easier.
  10: {
    13: { theme: "Cold storage", card: "Reefer lorries: no slow or hold touches a frost box. Hit them hard.", groups: [g("lorry", 50, 0.3, 0, ["reefer"]), g("sprinter", 59, 0.2, 2)] },
    16: { theme: "Sealed air", card: "Sealed lorries below, quadcopters above: the bees can't get in.", groups: [g("lorry", 70, 0.25, 0, ["sealed"]), g("quad", 40, 0.3, 2), g("pickup", 65, 0.2, 4)] },
  },
  // Act 2, Highmoor (M3). Cheap Eggs: the egg vans in a hurry.
  12: {
    7: { theme: "Egg vans", card: "99p eggs, delivered fast: hatchbacks, vans and rush vans.", groups: [g("hatchback", 40, 0.3), g("van", 50, 0.25, 2), g("sprinter", 21, 0.4, 4)] },
    9: { theme: "Egg rush", card: "Seventy Same-Day vans racing to the market gate.", groups: [g("sprinter", 70, 0.2), g("van", 45, 0.3, 2)] },
    13: { theme: "Discount lorries", card: "Fifty Box Lorries of cut-price eggs, rush vans behind.", groups: [g("lorry", 50, 0.3), g("sprinter", 59, 0.2, 2)] },
  },
  // Moor Fog: something hides in it before round 22 does.
  16: {
    9: { theme: "Moor traffic", card: "Vans and pickups feeling their way through the fog.", groups: [g("van", 95, 0.15), g("pickup", 50, 0.25, 3)] },
    11: { theme: "Fog crawlers", card: "A lighter round of vans and pickups. Spend, upgrade, stack if you dare.", breather: true, groups: [g("van", 85, 0.2), g("pickup", 35, 0.3, 2)] },
    16: { theme: "Hidden in the fog", card: "Stealth pickups in the fog, lorries behind. A Radio Mast sees them.", groups: [g("pickup", 100, 0.12, 0, ["stealth"]), g("lorry", 68, 0.25, 2)] },
  },
  // The Cattle Grid: Hollowell bolt steel plates on.
  19: {
    11: { theme: "Steel scouts", card: "Plated vans on a lighter round. Beaks bounce off: bring stings or a gust.", breather: true, groups: [g("van", 65, 0.2, 0, ["plated"]), g("pickup", 50, 0.25, 2)] },
    13: { theme: "Plated lorries", card: "Fifty plated Box Lorries. Steel stops beaks and thorns.", groups: [g("lorry", 50, 0.3, 0, ["plated"]), g("sprinter", 59, 0.2, 2)] },
    16: { theme: "Steel and air", card: "Plated lorries below, quadcopters above.", groups: [g("lorry", 70, 0.25, 0, ["plated"]), g("quad", 40, 0.3, 2), g("pickup", 65, 0.2, 4)] },
  },
  // Act 3, Saltmarsh: the influencers arrive by the coachload.
  21: {
    11: { theme: "The first coachload", card: "Influencers in pink hatchbacks: towers near them stop to watch.", breather: true, groups: [g("influencer", 70, 0.25), g("van", 45, 0.3, 2), g("pickup", 12, 0.5, 4)] },
  },
  22: {
    13: { theme: "Coachloads", card: "Eighty influencers, then the lorries they're filming.", groups: [g("influencer", 80, 0.2), g("lorry", 40, 0.3, 3), g("sprinter", 33, 0.3, 5)] },
    16: { theme: "Live stream", card: "A hundred influencers streaming live, lorries and quadcopters behind.", groups: [g("influencer", 100, 0.18), g("lorry", 60, 0.25, 2), g("quad", 63, 0.25, 4)] },
    19: { theme: "Influencer parade", card: "A hundred and fifty influencers in a parade, eighty lorries behind.", groups: [g("influencer", 150, 0.12), g("lorry", 80, 0.2, 2), g("sprinter", 32, 0.3, 4)] },
  },
  // Golden Hour: they come late for the sunset light.
  28: {
    16: { theme: "Golden hour", card: "Vans, lorries and rush vans in the low sun.", groups: [g("van", 100, 0.15), g("lorry", 60, 0.25, 2), g("sprinter", 38, 0.3, 4)] },
    19: { theme: "Late shift", card: "A hundred lorries and their pickups.", groups: [g("lorry", 100, 0.2), g("pickup", 60, 0.2, 2), g("sprinter", 30, 0.3, 4)] },
    21: { theme: "Sunset influencers", card: "A hundred and twenty influencers filming the sunset, a hundred lorries behind.", groups: [g("influencer", 120, 0.15), g("lorry", 100, 0.2, 2), g("sprinter", 54, 0.3, 4)] },
  },
};

/** The Book's lock rounds to remember (section 5), and the words their scouts' card adds. */
export const LOCK_ROUNDS: ReadonlyArray<readonly [number, Property]> = [
  [15, "sealed"],
  [18, "reefer"],
  [22, "stealth"],
  [26, "plated"],
  [30, "rebrand"],
];
const SCOUT_NAMES: Partial<Record<Property, string>> = { sealed: "Sealed", reefer: "Reefer", stealth: "Stealth", plated: "Plated", rebrand: "Rebranded" };
/**
 * How many scouts ride ahead of a lock round: Same-Day vans, 5 layers each and quick, which slip past Cath (she
 * can't hold them, so she can't show them to the towers either). A field without the key loses up to 40
 * Goodwill to them, not 120, and its leak report names the lock.
 */
export const SCOUTS = 8;

/**
 * Scouts (M3 review: "acts 2-3 fall off a one-round cliff"). When an act 2-3 level's window reaches a lock round
 * whose lock it hasn't shown before (Stealth and Plated anywhere in the window, the others when the window ends
 * on them, or two rounds after), a few small vehicles with that lock ride in three or so
 * rounds earlier, so a field that can't answer it leaks a little, hears why, and has rounds left to build the
 * key. Returns the lock and the round it warns of, or null.
 */
export function scoutsFor(levelId: number | undefined, round: number): { prop: Property; lockRound: number } | null {
  if (levelId === undefined || levelId < 11 || levelId > 50) return null;
  const w = windowFor(levelId);
  const base = (r: number) => SWAPS[levelId]?.[r] ?? BOOK[r - 1];
  const isLock = (r: number) => LOCK_ROUNDS.some(([l]) => l === r);
  for (const [R, prop] of LOCK_ROUNDS) {
    // Stealth and Plated stop most of a field (nothing sees the one; beaks and thorns bounce off the other), so
    // they're scouted wherever the window meets them; the rest only where the window ends on them.
    if (R > w.to || (R < w.to - 2 && prop !== "stealth" && prop !== "plated")) continue;
    const at = [R - 3, R - 4, R - 2].find((r) => r >= w.from && !isLock(r) && !base(r)?.spike);
    if (at !== round) continue;
    let seen = false;
    for (let r = w.from; r < R; r++) if (base(r)?.groups.some((x) => x.props?.includes(prop))) seen = true;
    if (!seen) return { prop, lockRound: R };
  }
  return null;
}

/**
 * Traffic (M3 review: acts 2-3 ran flat, the best bot kept 100% on most of them and k sat on its floor). Act 2's
 * rounds bring about 1.4 times the Book's vehicles and act 3's about 1.6 times, spawned that much closer together so a round
 * lasts as long; act 1 plays the Book as written. Income grows with it (a Mark a layer), so the purse that
 * opens a level is what the tuner's k now has to cover, and the middle of a level presses a modest build.
 */
export function trafficOf(levelId: number | undefined): number {
  if (levelId === undefined) return 1;
  return TRAFFIC[levelId] ?? 1;
}
/**
 * Per level, set by hand from the tuner's fits (BALANCE.md): about 1.4 in act 2 and 1.6 in act 3, less where a
 * twist already presses (Fortified, fog, night) and on the boss levels, more where the twist helps the field
 * (Crowds, rain, Air drop). The tuner still fits only k.
 */
const TRAFFIC: Record<number, number> = {
  11: 1.45, 12: 1.4, 13: 1.4, 14: 1.45, 15: 1.6, 16: 1.45, 17: 1.25, 18: 1.5, 19: 1.4, 20: 1.15,
  21: 1.7, 22: 1.7, 23: 1.7, 24: 1.7, 25: 1.45, 26: 1.05, 27: 1.5, 28: 1.2, 29: 1.7, 30: 1.6,
  31: 1.8, 32: 1.8, 33: 1.8, 34: 1.8, 35: 1.7, 36: 1.8, 37: 1.8, 38: 1.8, 39: 1.8, 40: 1.5,
  41: 1.8, 42: 1.8, 43: 1.8, 44: 1.8, 45: 1.7, 46: 1.8, 47: 1.8, 48: 1.8, 49: 1.8, 50: 1.5,
};

const VEHICLE_WORDS = "lorries|vans|quadcopters|transporters|influencers|drones|pickups|hatchbacks|artics|couriers";
const NUMBER_WORDS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  "a hundred": 100, "a hundred and twenty": 120, "a hundred and forty": 140, "a hundred and fifty": 150, "a hundred and sixty": 160,
  "two hundred": 200, "three hundred": 300,
};
const COUNT_RE = new RegExp(
  `\\b(${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join("|")}|\\d{2,3})(?= (?:[A-Za-z-]+ ){0,2}(?:${VEHICLE_WORDS})\\b)`,
  "gi",
);

/** A card's vehicle counts ("Thirty Box Lorries", "a hundred rush vans") times a level's traffic, as numbers. */
export function scaleCard(card: string, m: number): string {
  if (m === 1) return card;
  return card.replace(COUNT_RE, (w) => String(Math.round((NUMBER_WORDS[w.toLowerCase()] ?? Number(w)) * m)));
}

/** The round a level plays: its act-themed swap, or the Book's, at the act's traffic, with any scouts riding in it. */
export function roundFor(levelId: number | undefined, round: number): BookRound | undefined {
  const base = (levelId !== undefined ? SWAPS[levelId]?.[round] : undefined) ?? BOOK[freeplayIndex(round)];
  const m = trafficOf(levelId);
  const r =
    base && m !== 1
      ? { ...base, card: scaleCard(base.card, m), groups: base.groups.map((x) => ({ ...x, count: Math.round(x.count * m), gap: x.gap / m, ...(x.delay ? { delay: x.delay / m } : {}) })) }
      : base;
  const sc = r && scoutsFor(levelId, round);
  if (!r || !sc) return r;
  const name = SCOUT_NAMES[sc.prop] ?? sc.prop;
  return {
    ...r,
    card: `${r.card} Scouts: ${SCOUTS} ${name} Same-Day vans ride ahead of round ${sc.lockRound}, too quick for Cath to catch.`,
    groups: [...r.groups, { ...g("sprinter", SCOUTS, 0.45, 2.5, [sc.prop]), scout: true }],
  };
}

/** Freeplay (past round 80) replays the Book's last 30 rounds, ever tougher: the Book index a round reads. */
export function freeplayIndex(round: number): number {
  return round > BOOK.length && BOOK.length >= 80 ? 50 + ((round - 51) % 30) : round - 1;
}

/** Freeplay's Plant health: 2% more for every round past the Book's 80. */
export function freeplayHp(round: number): number {
  return round > 80 ? Math.pow(1.02, round - 80) : 1;
}

/** The rounds the Book has so far. */
export const BOOK_ROUNDS = BOOK.length;

/** The Fleet Value a round is written to: about 18 * r^1.5, 0.6 of that on a breather. */
export function budget(round: number): number {
  const b = 18 * Math.pow(round, 1.5);
  const r = BOOK[round - 1];
  return r?.breather ? b * 0.6 : r?.spike ? b * 1.6 : b;
}

/** The Fleet Value a Book round actually sends (a level's swap of it, if it has one). */
export function roundFV(round: number, levelId?: number): number {
  const r = roundFor(levelId, round);
  if (!r) return 0;
  return r.groups.reduce((a, x) => a + x.count * fvOf(x.rung, propMask(x.props)), 0);
}

/** A Book round as the engine's wave groups (a level's swap of it, if it has one). */
export function bookWave(round: number, levelId?: number): WaveGroup[] {
  const r = roundFor(levelId, round);
  if (!r) throw new Error(`The Round Book has no round ${round} yet.`);
  return r.groups.map((x) => {
    const pm = propMask(x.props);
    return { enemy: x.rung, count: x.count, gap: x.gap, delay: x.delay ?? 0, ...(pm ? { pm } : {}), ...(x.scout ? { scout: true as const } : {}) };
  });
}

/** Everything the Book pays before `round` starts: pops plus round bonuses (start Marks are a share of it). */
export function incomeBefore(round: number): number {
  let total = 0;
  for (let r = 1; r < round; r++) total += roundFV(r) + roundBonus(r);
  return total;
}

/** A story level's window of the Book (section 5): its length and the round it ends on. */
export function windowFor(id: number): { from: number; to: number } {
  const len = Math.min(30, 12 + Math.floor(id / 5));
  // The last level closes the Book on its finale (the formula alone gives 79).
  const to = id >= 100 ? 80 : Math.min(80, 12 + Math.round(0.68 * (id - 1)));
  return { from: Math.max(1, to - len + 1), to };
}
