// Plan item 45: a swarm worth watching. A late round packs dozens of vehicles onto the same few cells of lane,
// so they draw as one blob. The rules stay as they are (Hedgerow's difficulty is bot-tuned to them); this lays the
// queue out for the eye: each vehicle is drawn a vehicle's length behind the one ahead of it on its side of the lane,
// two abreast where the lane is wide, but never more than MAX_LAG cells behind where it really is (so a tower's
// shot still lands on it). Vehicles that would need more join the column: one stacked block at the queue's tail
// whose height is their count, which shrinks as the queue is popped.

/** Furthest a vehicle is ever drawn behind its true place on the lane, in cells. */
export const MAX_LAG = 2;
/** Sideways offset of each file when two abreast, in cells. */
export const ABREAST = 0.2;

export interface ConvoyUnit {
  id: number;
  dist: number;
  lane?: 1;
  /** Its length along the lane, in cells. */
  len: number;
}

export interface ConvoySlot {
  /** Where it is drawn along its lane (cells). */
  dist: number;
  /** -1, 0 or 1: which file (0 single file). */
  side: -1 | 0 | 1;
}

export interface ConvoyColumn {
  lane?: 1;
  /** At the tail of the drawn queue (cells). */
  dist: number;
  count: number;
}

export interface Convoy {
  slots: Map<number, ConvoySlot>;
  /** Ids drawn as part of a column rather than one by one. */
  inColumn: Set<number>;
  columns: ConvoyColumn[];
}

/**
 * Lays out the vehicles on each lane, front-most first. `wide(lane)` says whether that lane takes two abreast.
 * Deterministic: ties on `dist` break by id.
 */
export function convoy(units: readonly ConvoyUnit[], wide: (lane: 1 | undefined) => boolean = () => false): Convoy {
  const slots = new Map<number, ConvoySlot>();
  const inColumn = new Set<number>();
  const columns: ConvoyColumn[] = [];
  for (const lane of [undefined, 1] as const) {
    const on = units.filter((u) => (u.lane ?? undefined) === lane).sort((a, b) => b.dist - a.dist || a.id - b.id);
    const two = wide(lane);
    // The tail of each file: where its last vehicle was drawn and how long it is.
    const tail = two ? [{ d: Infinity, len: 0 }, { d: Infinity, len: 0 }] : [{ d: Infinity, len: 0 }];
    let col: ConvoyColumn | null = null;
    for (const u of on) {
      // The file whose tail lets it sit furthest forward.
      let best = 0;
      let bestD = -Infinity;
      tail.forEach((t, i) => {
        const d = Math.min(u.dist, t.d - (t.len + u.len) / 2);
        if (d > bestD + 1e-9) {
          bestD = d;
          best = i;
        }
      });
      if (u.dist - bestD > MAX_LAG) {
        inColumn.add(u.id);
        if (!col) {
          col = { ...(lane ? { lane } : {}), dist: u.dist, count: 0 };
          columns.push(col);
        }
        col.count++;
        col.dist = Math.min(col.dist, u.dist);
        continue;
      }
      tail[best] = { d: bestD, len: u.len };
      slots.set(u.id, { dist: bestD, side: two ? (best === 0 ? -1 : 1) : 0 });
    }
  }
  return { slots, inColumn, columns };
}
