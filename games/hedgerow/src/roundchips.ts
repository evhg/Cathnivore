// Plan item 168: the coming rounds as an illustrated timeline. Each round ahead is a chip: its lead vehicle, a
// stacked bar of its mix in each vehicle's colour, its count, and a painted banner when it's a boss round or a
// round a twist bites (the flood round). Pure: main.ts builds the DOM from these.
import { ENEMIES, isBig, setPiece, type EnemyKind, type Level, type WaveGroup } from "./engine";

/** Each vehicle's livery, as the field paints it (the swarm tints where the field has one). */
const LIVERY: Partial<Record<EnemyKind, string>> = {
  van: "#5b7fb0",
  courier: "#d2694a",
  hatchback: "#e0b13a",
  pickup: "#b5533c",
  sprinter: "#8a6fb3",
  lorry: "#4f6fa0",
  quad: "#7a9c4a",
  drone: "#9a8fb5",
  wrapped: "#c9b48a",
  steel: "#6d7680",
  truck: "#3f6b8c",
  convoy: "#556b2f",
  influencer: "#d06aa0",
  blimp: "#b0a3d4",
  bulldozer: "#d9a23a",
  megadozer: "#b8811f",
  phantom: "#7d8694",
  clinic: "#5fa3a0",
  tender: "#c25a5a",
  ship: "#4a7a8f",
  lawyer: "#3b3f58",
  lobbyist: "#7a4b6b",
  carrier: "#5a6e7f",
  rival: "#a8433a",
  swarm: "#9a8fb5",
  bus: "#c9783a",
  boss: "#8f2f2f",
  board: "#4b3b5e",
  director: "#2f3b4f",
};
const SPARE = ["#5b7fb0", "#c9783a", "#7a9c4a", "#8a6fb3", "#d2694a", "#4a7a8f", "#b5533c", "#9a8fb5"];

/** A vehicle's colour on the mix bar (a stable spare for one without a livery). */
export function livery(kind: EnemyKind): string {
  const c = LIVERY[kind];
  if (c) return c;
  let h = 0;
  for (const ch of kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE[h % SPARE.length]!;
}

export interface MixSegment {
  kind: EnemyKind;
  count: number;
  /** Its share of the round, in % (the segments sum to 100). */
  pct: number;
}

/** A round's mix: one segment per vehicle kind, biggest first. */
export function roundMix(groups: readonly WaveGroup[]): MixSegment[] {
  const by = new Map<EnemyKind, number>();
  for (const g of groups) by.set(g.enemy, (by.get(g.enemy) ?? 0) + g.count);
  const total = [...by.values()].reduce((a, b) => a + b, 0) || 1;
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, count, pct: (count * 100) / total }));
}

export type RoundBanner = { twist: "flood" | "boss"; label: string };

/** The banner a round ahead carries: the flood round first (the river is the bigger surprise), then a boss. */
export function roundBanner(level: Level, wave: number): RoundBanner | null {
  const flood = setPiece(level, "flood");
  if (flood && flood.wave === wave) return { twist: "flood", label: "Flood" };
  const groups = level.waves[wave] ?? [];
  if (groups.some((g) => isBig(g.enemy))) return { twist: "boss", label: "Boss" };
  return null;
}

/** The round's lead: the group with the most health on the lane. */
export function roundLead(groups: readonly WaveGroup[]): EnemyKind {
  return groups.reduce((a, b) => (ENEMIES[b.enemy].hp * b.count > ENEMIES[a.enemy].hp * a.count ? b : a)).enemy;
}
