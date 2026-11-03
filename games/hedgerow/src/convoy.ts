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

import { enemyPoint, type Level } from "./engine";

/** How many vehicles high a column stacks in 3D before the rest sit on its top. */
export const COLUMN_TIERS = 8;

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
  /** Ids drawn as part of a column rather than one by one, with their place in it (0 at the bottom). */
  inColumn: Map<number, number>;
  columns: ConvoyColumn[];
}

/**
 * Lays out the vehicles on each lane, front-most first. `wide(lane)` says whether that lane takes two abreast.
 * Deterministic: ties on `dist` break by id.
 */
export function convoy(units: readonly ConvoyUnit[], wide: (lane: 1 | undefined) => boolean = () => false): Convoy {
  const slots = new Map<number, ConvoySlot>();
  const inColumn = new Map<number, number>();
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
        if (!col) {
          col = { ...(lane ? { lane } : {}), dist: u.dist, count: 0 };
          columns.push(col);
        }
        inColumn.set(u.id, col.count);
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

/**
 * Where a vehicle is drawn: its convoy slot along the lane, moved to its file's side when two abreast; a vehicle in
 * a column stands at the column's place, `tier` vehicles up (0 when it is drawn on its own).
 */
export function placeOnLane(level: Pick<Level, "path" | "path2">, e: { id: number; dist: number; lane?: 1 }, lay: Convoy): { x: number; y: number; tier: number } {
  const lane = e.lane ? { lane: e.lane } : {};
  const at = lay.inColumn.get(e.id);
  if (at !== undefined) {
    const col = lay.columns.find((c) => (c.lane ?? undefined) === (e.lane ?? undefined));
    const p = enemyPoint(level, { dist: col?.dist ?? e.dist, ...lane });
    return { ...p, tier: Math.min(at, COLUMN_TIERS - 1) };
  }
  const sl = lay.slots.get(e.id);
  const d = sl?.dist ?? e.dist;
  const p = enemyPoint(level, { dist: d, ...lane });
  if (!sl?.side) return { ...p, tier: 0 };
  const q = enemyPoint(level, { dist: d + 0.05, ...lane });
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: p.x - (dy / l) * ABREAST * sl.side, y: p.y + (dx / l) * ABREAST * sl.side, tier: 0 };
}

/** The layout for a field this frame: two abreast on a lane carrying more than `crowd` vehicles. */
export function layOutField(enemies: readonly { id: number; dist: number; lane?: 1; kind: string }[], len: (kind: string) => number, crowd: number): Convoy {
  const n = [0, 0];
  for (const e of enemies) n[e.lane ? 1 : 0]!++;
  return convoy(
    enemies.map((e) => ({ id: e.id, dist: e.dist, ...(e.lane ? { lane: e.lane } : {}), len: len(e.kind) })),
    (lane) => n[lane ? 1 : 0]! > crowd,
  );
}
