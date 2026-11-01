// Swarm readability (two-week plan item 10): a late round packs dozens of vehicles nose to tail on the lane,
// which reads as one blob. Vehicles that queue within a car's length of each other on the same lane form a
// cluster; a cluster of more than SWARM_MIN shows a count badge with its make-up by type, on both renderers.

import type { EnemyKind } from "./engine";

/** Clusters bigger than this get a badge. */
export const SWARM_MIN = 12;
/** Two vehicles closer than this along the lane (in cells) are in the same queue. */
export const SWARM_GAP = 0.55;

export interface SwarmUnit {
  kind: EnemyKind;
  dist: number;
  lane?: 1;
}

export interface Swarm {
  count: number;
  /** The middle of the queue along its lane (cells), where the badge goes. */
  dist: number;
  lane?: 1;
  /** Its make-up, the commonest type first. */
  kinds: Array<{ kind: EnemyKind; n: number }>;
}

/** The queues of more than SWARM_MIN vehicles, front-most first. */
export function swarms(units: readonly SwarmUnit[]): Swarm[] {
  const out: Swarm[] = [];
  for (const lane of [undefined, 1] as const) {
    const on = units.filter((u) => (u.lane ?? undefined) === lane).sort((a, b) => b.dist - a.dist);
    let start = 0;
    for (let i = 1; i <= on.length; i++) {
      if (i < on.length && on[i - 1]!.dist - on[i]!.dist <= SWARM_GAP) continue;
      const run = on.slice(start, i);
      start = i;
      if (run.length <= SWARM_MIN) continue;
      const tally = new Map<EnemyKind, number>();
      for (const u of run) tally.set(u.kind, (tally.get(u.kind) ?? 0) + 1);
      const kinds = [...tally].map(([kind, n]) => ({ kind, n })).sort((a, b) => b.n - a.n);
      out.push({ count: run.length, dist: (run[0]!.dist + run.at(-1)!.dist) / 2, ...(lane ? { lane } : {}), kinds });
    }
  }
  return out.sort((a, b) => b.dist - a.dist);
}
