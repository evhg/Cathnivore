// Plan item 72: the round's threat staged before Go. Between rounds the next convoy queues at the Hollowell
// gate: its lead vehicles, in the order they will pull out, and a count plate for the whole round. Pure, so
// both renderers draw the same queue and the unit tests can hold it to the wave it previews. It reads the
// round's real spawns (engine.waveSpawns, twists applied), so the plate counts what Go will actually send.

import type { EnemyKind } from "./engine";

/** One spawn of a round, as engine.waveSpawns gives it. */
export interface GateSpawn {
  at: number;
  kind: EnemyKind;
  lane?: 1 | undefined;
  ambush?: unknown;
}

export interface GateQueue {
  /** The first vehicles to leave lane 1's gate, in spawn order (at most `max`). */
  leads: EnemyKind[];
  /** The same for lane 2's gate (levels with a second lane). */
  leads2: EnemyKind[];
  /** Every vehicle lane 1 will send this round, for its count plate (ambushers included). */
  count: number;
  /** Lane 2's share of the round, for its plate. */
  count2: number;
  /** Whether a boss or other big vehicle is in the round (the camera eases to the gate for these). */
  boss: boolean;
}

/** The queue a round's spawns make at the gate(s). `isBig` marks bosses and other heavy plant. */
export function gateQueue(spawns: readonly GateSpawn[] | undefined, isBig: (k: EnemyKind) => boolean, max = 4): GateQueue | null {
  if (!spawns?.length) return null;
  const ordered = spawns.map((sp, order) => ({ sp, order })).sort((a, b) => a.sp.at - b.sp.at || a.order - b.order);
  const leads: EnemyKind[] = [];
  const leads2: EnemyKind[] = [];
  let count = 0;
  let count2 = 0;
  for (const { sp } of ordered) {
    const two = sp.lane === 1;
    if (two) count2++;
    else count++;
    // Ambushers break cover mid-lane, so they never stand in the gate's queue.
    if (sp.ambush) continue;
    const row = two ? leads2 : leads;
    if (row.length < max) row.push(sp.kind);
  }
  return { leads, leads2, count, count2, boss: spawns.some((sp) => isBig(sp.kind)) };
}
