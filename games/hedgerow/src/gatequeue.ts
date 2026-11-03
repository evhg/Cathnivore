// Plan item 72: the round's threat staged before Go. Between rounds the next convoy queues at the Hollowell
// gate: its lead vehicles, in the order they will pull out, and a count plate for the whole round. Pure, so
// both renderers draw the same queue and the unit tests can hold it to the wave it previews.

import type { EnemyKind, WaveGroup } from "./engine";

export interface GateQueue {
  /** The first vehicles to leave the gate, in spawn order (at most `max`). */
  leads: EnemyKind[];
  /** Every vehicle in the round, for the count plate. */
  count: number;
  /** Lane 2's share of the round (levels with a second lane), for a second plate. */
  count2: number;
  /** Whether a boss or other big vehicle is in the round (the camera eases to the gate for these). */
  boss: boolean;
}

/** The queue a round's groups make at the gate. `isBig` marks bosses and other heavy plant. */
export function gateQueue(groups: readonly WaveGroup[] | undefined, isBig: (k: EnemyKind) => boolean, max = 4): GateQueue | null {
  if (!groups?.length) return null;
  const spawns: { kind: EnemyKind; t: number; order: number }[] = [];
  let order = 0;
  let count = 0;
  let count2 = 0;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      // Only the first few of each group can be among the leads; the rest only count.
      if (i < max) spawns.push({ kind: g.enemy, t: g.delay + i * g.gap, order: order++ });
      if (g.lane === 1) count2++;
      else count++;
    }
  }
  spawns.sort((a, b) => a.t - b.t || a.order - b.order);
  const kinds = new Set(groups.map((g) => g.enemy));
  return { leads: spawns.slice(0, max).map((s) => s.kind), count, count2, boss: [...kinds].some(isBig) };
}
