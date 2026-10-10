// The Round Book (Hedgerow 2, docs/design/hedgerow-2.md section 5): one canonical list of rounds, the same on
// every play, so a player learns "the Sprinter rush is round 6" and "the first Box Lorry is round 10". Story
// levels play a window of it. Each round has a theme, a one-line card and a Fleet Value budget of about
// 18 * r^1.5 (0.6 of it on a breather, 1.6 on a spike). M2 authors rounds 1-30; properties (wrapped, sealed, stealth...)
// are listed for M3 and not yet applied by the engine.

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
  { theme: "Couriers", card: "Scooters with parcels. One tap each.", groups: [g("courier", 18, 0.8)] },
  { theme: "Hatchbacks", card: "Pop a hatchback and a courier scoots on.", groups: [g("courier", 25, 0.5), g("hatchback", 13, 1, 3)] },
  { theme: "The vans", card: "Three layers to a van: van, hatchback, courier.", groups: [g("courier", 20, 0.4), g("hatchback", 22, 0.6, 2), g("van", 10, 1.1, 5)] },
  { theme: "Morning run", card: "Hatchbacks and vans, nose to tail.", groups: [g("hatchback", 30, 0.45), g("courier", 30, 0.3, 2), g("van", 18, 0.7, 6)] },
  { theme: "Pickups", card: "Pickups are quick on the straights. Under each one, a van.", groups: [g("van", 24, 0.5), g("hatchback", 30, 0.35, 2), g("pickup", 9, 1.2, 8), g("courier", 33, 0.25, 4)] },
  { theme: "Same-Day rush", card: "Round 6: the violet Same-Day vans. Fastest thing on the lane.", groups: [g("van", 35, 0.4), g("hatchback", 35, 0.35, 2), g("sprinter", 18, 0.7, 4)] },
  { theme: "School run", card: "Vans, pickups and a few Same-Day vans.", groups: [g("van", 55, 0.3), g("pickup", 30, 0.45, 3), g("sprinter", 10, 0.8, 9)] },
  { theme: "Pickups and parcels", card: "A long line of pickups with rush vans behind.", groups: [g("pickup", 50, 0.3), g("sprinter", 16, 0.7, 4, ["wrapped"]), g("van", 42, 0.3, 2)] },
  { theme: "Rush hour", card: "Thirty Same-Day vans and a queue behind them. Hedges pay off here.", groups: [g("sprinter", 30, 0.45), g("pickup", 50, 0.3, 2), g("van", 45, 0.3, 4)] },
  { theme: "The first Box Lorry", card: "Round 10: Box Lorries. Pop the box and two Same-Day vans burst out.", groups: [g("lorry", 12, 1.2, 4), g("sprinter", 50, 0.3), g("pickup", 47, 0.3, 2)] },
  { theme: "A breather", card: "A lighter round. Spend, upgrade, stack the next one if you dare.", breather: true, groups: [g("van", 60, 0.25), g("pickup", 30, 0.4, 2), g("sprinter", 19, 0.6, 5)] },
  { theme: "Drone swarm", card: "Round 12: drones and quadcopters. Only towers that hit the air can reach them.", groups: [g("drone", 120, 0.12), g("quad", 60, 0.25, 3), g("lorry", 20, 0.7, 2), g("pickup", 46, 0.3, 4), g("sprinter", 9, 1, 8)] },
  { theme: "Lorries and rush vans", card: "Thirty Box Lorries. Splash where they pop.", groups: [g("lorry", 30, 0.5), g("sprinter", 60, 0.25, 2), g("pickup", 54, 0.25, 5)] },
  { theme: "Convoy", card: "A spike: lorries nose to tail, Same-Day vans weaving through.", spike: true, groups: [g("lorry", 64, 0.25), g("sprinter", 160, 0.1, 3)] },
  { theme: "Sealed lorries", card: "Round 15: lorries with mesh grilles, and their Same-Day vans.", groups: [g("lorry", 50, 0.35, 0, ["sealed"]), g("sprinter", 60, 0.25, 2), g("pickup", 49, 0.25, 5)] },
  { theme: "Air and road", card: "Lorries below, quadcopters above.", groups: [g("lorry", 60, 0.3), g("quad", 40, 0.35, 3), g("sprinter", 74, 0.2, 6)] },
  { theme: "The wall", card: "A spike: a solid wall of Box Lorries.", spike: true, groups: [g("lorry", 112, 0.17), g("sprinter", 157, 0.11, 4)] },
  { theme: "Reefers", card: "Round 18: refrigerated lorries, with quadcopters overhead.", groups: [g("lorry", 80, 0.24, 0, ["reefer"]), g("quad", 60, 0.25, 4), g("sprinter", 63, 0.25, 6)] },
  { theme: "Long haul", card: "Ninety lorries and a hundred rush vans.", groups: [g("lorry", 90, 0.22), g("sprinter", 100, 0.17, 3)] },
  { theme: "The hundred and sixty", card: "A spike: a hundred and sixty Box Lorries. Everything you've got.", spike: true, groups: [g("lorry", 160, 0.12), g("sprinter", 163, 0.1, 3)] },
  { theme: "Air lift", card: "A hundred quadcopters over a hundred lorries.", groups: [g("lorry", 110, 0.18), g("quad", 100, 0.18, 3), g("sprinter", 44, 0.3, 8)] },
  { theme: "Stealth lorries", card: "Round 22: lorries in hedge camouflage.", groups: [g("lorry", 120, 0.17, 0, ["stealth"]), g("sprinter", 108, 0.16, 3)] },
  { theme: "A breather", card: "Pickups and a few lorries. Catch your breath.", breather: true, groups: [g("lorry", 60, 0.3), g("pickup", 100, 0.18, 2), g("sprinter", 26, 0.5, 6)] },
  { theme: "Gridlock", card: "A spike: lorries end to end.", spike: true, groups: [g("lorry", 224, 0.09), g("sprinter", 184, 0.1, 3)] },
  { theme: "Drone cloud", card: "Two hundred quadcopters. Look up.", groups: [g("lorry", 150, 0.13), g("quad", 200, 0.09, 2)] },
  { theme: "Plated lorries", card: "Round 26: riveted steel lorries.", groups: [g("lorry", 160, 0.12, 0, ["plated"]), g("sprinter", 125, 0.14, 3)] },
  { theme: "Depot day", card: "The whole depot comes out.", groups: [g("lorry", 170, 0.12), g("sprinter", 131, 0.14, 3)] },
  { theme: "Peak season", card: "Christmas deliveries, in October.", groups: [g("lorry", 180, 0.11), g("sprinter", 137, 0.13, 3)] },
  { theme: "Overtime", card: "A spike: three hundred lorries on overtime.", spike: true, groups: [g("lorry", 304, 0.065), g("sprinter", 230, 0.08, 3)] },
  { theme: "Rebrand", card: "Round 30: lorries that repaint themselves.", groups: [g("lorry", 200, 0.1, 0, ["rebrand"]), g("sprinter", 152, 0.12, 3)] },
];

/** The rounds the Book has so far. */
export const BOOK_ROUNDS = BOOK.length;

/** The Fleet Value a round is written to: about 18 * r^1.5, 0.6 of that on a breather. */
export function budget(round: number): number {
  const b = 18 * Math.pow(round, 1.5);
  const r = BOOK[round - 1];
  return r?.breather ? b * 0.6 : r?.spike ? b * 1.6 : b;
}

/** The Fleet Value a Book round actually sends. */
export function roundFV(round: number): number {
  const r = BOOK[round - 1];
  if (!r) return 0;
  return r.groups.reduce((a, x) => a + x.count * fvOf(x.rung), 0);
}

/** A Book round as the engine's wave groups. */
export function bookWave(round: number): WaveGroup[] {
  const r = BOOK[round - 1];
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
