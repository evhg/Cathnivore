// The Round Book (Hedgerow 2, docs/design/hedgerow-2.md section 5): one canonical list of rounds, the same on
// every play, so a player learns "the Sprinter rush is round 6" and "the first Box Lorry is round 10". Story
// levels play a window of it. Each round has a theme, a one-line card and a Fleet Value budget of about
// 18 * r^1.5 (0.6 of it on a breather, 1.6 on a spike). M2 authors rounds 1-30; properties (wrapped, sealed, stealth...)
// are listed for M3 and not yet applied by the engine, so until then their themes and cards stay neutral (M3
// renames rounds 15, 18, 22, 26 and 30 when it applies sealed, reefer, stealth, plated and rebrand).

import type { EnemyKind, WaveGroup } from "./engine";
import { fvOf, roundBonus } from "./fleet";

export type Property = "wrapped" | "sealed" | "reefer" | "stealth" | "plated" | "rebrand";

export interface BookGroup {
  rung: EnemyKind;
  count: number;
  /** Seconds between spawns. */
  gap: number;
  /** Seconds into the round before the group starts. */
  delay?: number;
  /** Properties the group will carry once M3 lands (data only for now). */
  props?: Property[];
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

/** Rounds 1-30. Index 0 is round 1. */
export const BOOK: BookRound[] = [
  { theme: "Couriers", card: "Scooters with parcels, one tap each, and a few hatchbacks. Pop one and watch it peel.", groups: [g("courier", 12, 0.8), g("hatchback", 3, 1.6, 3)] },
  { theme: "Hatchbacks", card: "Pop a hatchback and a courier scoots on.", groups: [g("courier", 25, 0.5), g("hatchback", 13, 1, 3)] },
  { theme: "The vans", card: "Three layers to a van: van, hatchback, courier.", groups: [g("courier", 20, 0.4), g("hatchback", 22, 0.6, 2), g("van", 10, 1.1, 5)] },
  { theme: "Morning run", card: "Hatchbacks and vans, nose to tail.", groups: [g("hatchback", 30, 0.383), g("courier", 30, 0.255, 1.7), g("van", 18, 0.595, 5.1)] },
  { theme: "Pickups", card: "Pickups are quick on the straights. Under each one, a van.", groups: [g("van", 24, 0.425), g("hatchback", 30, 0.297, 1.7), g("pickup", 9, 1.02, 6.8), g("courier", 33, 0.212, 3.4)] },
  { theme: "Same-Day rush", card: "Round 6: the violet Same-Day vans. Fastest thing on the lane.", groups: [g("van", 35, 0.34), g("hatchback", 35, 0.297, 1.7), g("sprinter", 18, 0.595, 3.4)] },
  { theme: "School run", card: "Vans, pickups and a few Same-Day vans.", groups: [g("van", 55, 0.255), g("pickup", 30, 0.383, 2.55), g("sprinter", 10, 0.68, 7.65)] },
  { theme: "Pickups and parcels", card: "A long line of pickups with rush vans behind.", groups: [g("pickup", 50, 0.255), g("sprinter", 16, 0.595, 3.4, ["wrapped"]), g("van", 42, 0.255, 1.7)] },
  { theme: "Rush hour", card: "Thirty Same-Day vans and a queue behind them. Hedges pay off here.", groups: [g("sprinter", 30, 0.383), g("pickup", 50, 0.255, 1.7), g("van", 45, 0.255, 3.4)] },
  { theme: "The first Box Lorry", card: "Round 10: Box Lorries. Pop the box and two Same-Day vans burst out.", groups: [g("lorry", 12, 0.84, 2.8), g("sprinter", 50, 0.21), g("pickup", 47, 0.21, 1.4)] },
  { theme: "A breather", card: "A lighter round. Spend, upgrade, stack the next one if you dare.", breather: true, groups: [g("van", 60, 0.175), g("pickup", 30, 0.28, 1.4), g("sprinter", 19, 0.42, 3.5)] },
  { theme: "Drone swarm", card: "Round 12: drones and quadcopters. Only towers that hit the air can reach them.", groups: [g("drone", 120, 0.084), g("quad", 60, 0.175, 2.1), g("lorry", 20, 0.49, 1.4), g("pickup", 46, 0.21, 2.8), g("sprinter", 9, 0.7, 5.6)] },
  { theme: "Lorries and rush vans", card: "Thirty Box Lorries. Splash where they pop.", groups: [g("lorry", 30, 0.35), g("sprinter", 60, 0.175, 1.4), g("pickup", 54, 0.175, 3.5)] },
  { theme: "Convoy", card: "A spike: lorries nose to tail, Same-Day vans weaving through.", spike: true, groups: [g("lorry", 64, 0.175), g("sprinter", 160, 0.07, 2.1)] },
  { theme: "Lorry park", card: "Round 15: fifty Box Lorries, Same-Day vans and pickups behind them.", groups: [g("lorry", 50, 0.245, 0, ["sealed"]), g("sprinter", 60, 0.175, 1.4), g("pickup", 49, 0.175, 3.5)] },
  { theme: "Air and road", card: "Lorries below, quadcopters above.", groups: [g("lorry", 60, 0.21), g("quad", 40, 0.245, 2.1), g("sprinter", 74, 0.14, 4.2)] },
  { theme: "The wall", card: "A spike: a solid wall of Box Lorries.", spike: true, groups: [g("lorry", 112, 0.119), g("sprinter", 157, 0.077, 2.8)] },
  { theme: "Cold chain", card: "Round 18: Box Lorries below, quadcopters above, rush vans behind.", groups: [g("lorry", 80, 0.168, 0, ["reefer"]), g("quad", 60, 0.175, 2.8), g("sprinter", 63, 0.14, 4.2)] },
  { theme: "Long haul", card: "Ninety lorries and a hundred rush vans.", groups: [g("lorry", 90, 0.154), g("sprinter", 100, 0.119, 2.1)] },
  { theme: "The hundred and sixty", card: "A spike: a hundred and sixty Box Lorries. Everything you've got.", spike: true, groups: [g("lorry", 160, 0.084), g("sprinter", 163, 0.07, 2.1)] },
  { theme: "Air lift", card: "A hundred quadcopters over a hundred lorries.", groups: [g("lorry", 110, 0.126), g("quad", 100, 0.126, 2.1), g("sprinter", 44, 0.21, 5.6)] },
  { theme: "Heavy traffic", card: "Round 22: a hundred and twenty Box Lorries with rush vans weaving through.", groups: [g("lorry", 120, 0.119, 0, ["stealth"]), g("sprinter", 108, 0.112, 2.1)] },
  { theme: "A breather", card: "Pickups and a few lorries. Catch your breath.", breather: true, groups: [g("lorry", 60, 0.21), g("pickup", 100, 0.126, 1.4), g("sprinter", 26, 0.35, 4.2)] },
  { theme: "Gridlock", card: "A spike: lorries end to end.", spike: true, groups: [g("lorry", 224, 0.063), g("sprinter", 184, 0.07, 2.1)] },
  { theme: "Drone cloud", card: "Two hundred quadcopters. Look up.", groups: [g("lorry", 150, 0.091), g("quad", 200, 0.063, 1.4)] },
  { theme: "Nose to tail", card: "Round 26: a hundred and sixty Box Lorries and their rush vans.", groups: [g("lorry", 160, 0.084, 0, ["plated"]), g("sprinter", 125, 0.098, 2.1)] },
  { theme: "Depot day", card: "The whole depot comes out.", groups: [g("lorry", 170, 0.084), g("sprinter", 131, 0.098, 2.1)] },
  { theme: "Peak season", card: "Christmas deliveries, in October.", groups: [g("lorry", 180, 0.077), g("sprinter", 137, 0.091, 2.1)] },
  { theme: "Overtime", card: "A spike: three hundred lorries on overtime.", spike: true, groups: [g("lorry", 304, 0.045), g("sprinter", 230, 0.056, 2.1)] },
  { theme: "Last orders", card: "Round 30: two hundred Box Lorries. The end of the day.", groups: [g("lorry", 200, 0.07, 0, ["rebrand"]), g("sprinter", 152, 0.084, 2.1)] },
];

/**
 * Act-themed swaps (section 5: "each act swaps about 3 Book rounds for act-themed ones"). Neighbouring story
 * levels can share a window (levels 2 and 3 both play rounds 2-13), so the second of each pair swaps three of
 * its rounds for themed ones of the same Fleet Value, leaving the rounds to remember (6, 10, 12, 14) alone.
 * Keyed by level id, then by Book round.
 */
export const SWAPS: Record<number, Record<number, BookRound>> = {
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
};

/** The round a level plays: its act-themed swap, or the Book's. */
export function roundFor(levelId: number | undefined, round: number): BookRound | undefined {
  return (levelId !== undefined ? SWAPS[levelId]?.[round] : undefined) ?? BOOK[round - 1];
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
  return r.groups.reduce((a, x) => a + x.count * fvOf(x.rung), 0);
}

/** A Book round as the engine's wave groups (a level's swap of it, if it has one). */
export function bookWave(round: number, levelId?: number): WaveGroup[] {
  const r = roundFor(levelId, round);
  if (!r) throw new Error(`The Round Book has no round ${round} yet.`);
  return r.groups.map((x) => ({ enemy: x.rung, count: x.count, gap: x.gap, delay: x.delay ?? 0 }));
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
