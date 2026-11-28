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

/**
 * A vehicle's slot along the lane, as a share of its sprite scale (plan item 657: at 0.55 nose-to-tail lorries
 * overlapped by a third and a packed queue read as one heap; at 0.62 they overlap a quarter at most).
 */
export const SLOT_LEN = 0.62;

/**
 * A vehicle's 3D slot along the lane, as a share of its model's length (plan item 657). Plan item 757: 1.25 (was
 * 1.08), a quarter of a van's length of road between queued vans, so a convoy reads as vehicles on a road and not
 * one wall across the farm.
 */
export const GAP_3D = 1.25;

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
  /**
   * Plan item 684: where its head (the first to join) is drawn, nose to tail behind the file's last drawn vehicle;
   * absent when that would be behind the gate (the column then waits at the depot, only its count shown).
   */
  at?: number;
}

export interface Convoy {
  slots: Map<number, ConvoySlot>;
  /** Ids drawn as part of a column rather than one by one, with their place in it (0 at the bottom). */
  inColumn: Map<number, number>;
  /** Plan item 657: which column each of those ids stands in (a lane can have one per queue). */
  columnOf: Map<number, ConvoyColumn>;
  columns: ConvoyColumn[];
}

/** An empty layout (before the first frame). */
export function noConvoy(): Convoy {
  return { slots: new Map(), inColumn: new Map(), columnOf: new Map(), columns: [] };
}

/** The column on `lane` nearest `dist` that isn't in `skip`, or undefined. */
export function columnNear(lay: Convoy, lane: 1 | undefined, dist: number, skip?: ReadonlySet<ConvoyColumn>): ConvoyColumn | undefined {
  let best: ConvoyColumn | undefined;
  for (const c of lay.columns) {
    if ((c.lane ?? undefined) !== (lane ?? undefined) || skip?.has(c)) continue;
    if (!best || Math.abs(c.dist - dist) < Math.abs(best.dist - dist)) best = c;
  }
  return best;
}

/**
 * Lays out the vehicles on each lane, front-most first. `wide(lane)` says whether that lane takes two abreast.
 * Deterministic: ties on `dist` break by id.
 */
export function convoy(units: readonly ConvoyUnit[], wide: (lane: 1 | undefined) => boolean = () => false, start: (lane: 1 | undefined) => number = () => 0): Convoy {
  const slots = new Map<number, ConvoySlot>();
  const inColumn = new Map<number, number>();
  const columnOf = new Map<number, ConvoyColumn>();
  const columns: ConvoyColumn[] = [];
  for (const lane of [undefined, 1] as const) {
    const on = units.filter((u) => (u.lane ?? undefined) === lane).sort((a, b) => b.dist - a.dist || a.id - b.id);
    const two = wide(lane);
    // Plan item 707: where a vehicle is first drawn clear of the depot (cells): before that it waits in the column.
    const from = start(lane);
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
      // Plan item 657: a place behind the lane's start would be drawn clamped onto the gate, every such vehicle on
      // one spot (the heap on the depot's pier), so those join the column too.
      if (u.dist - bestD > MAX_LAG || bestD < from) {
        // Plan item 657: a queue further back (the depot's, behind an ambush's burst mid-lane) gets its own column,
        // so one queue's overflow is never drawn at the other's place.
        if (!col || col.dist - u.dist > MAX_LAG) {
          col = { ...(lane ? { lane } : {}), dist: u.dist, count: 0 };
          // Plan item 684: its head is drawn in the file, a vehicle's length behind the last one (it stood on the
          // queue's leader before, 3-5 deep); the vehicles after it queue behind it.
          if (bestD >= from) {
            col.at = bestD;
            tail[best] = { d: bestD, len: u.len };
          }
          columns.push(col);
        }
        inColumn.set(u.id, col.count);
        columnOf.set(u.id, col);
        col.count++;
        col.dist = Math.min(col.dist, u.dist);
        continue;
      }
      tail[best] = { d: bestD, len: u.len };
      slots.set(u.id, { dist: bestD, side: two ? (best === 0 ? -1 : 1) : 0 });
    }
  }
  return { slots, inColumn, columnOf, columns };
}

/**
 * Where a vehicle is drawn: its convoy slot along the lane, moved to its file's side when two abreast; a vehicle in
 * a column stands at the column's place, `tier` vehicles up (0 when it is drawn on its own).
 */
export function placeOnLane(level: Pick<Level, "path" | "path2">, e: { id: number; dist: number; lane?: 1 }, lay: Convoy): { x: number; y: number; tier: number } {
  const lane = e.lane ? { lane: e.lane } : {};
  const at = lay.inColumn.get(e.id);
  if (at !== undefined) {
    const col = lay.columnOf.get(e.id);
    const p = enemyPoint(level, { dist: col?.at ?? Math.max(0, col?.dist ?? e.dist), ...lane });
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

/**
 * The layout for a field this frame. Plan item 684: always single file (two abreast put a packed lane's vehicles over
 * the plots either side, 3-5 deep); what can't be shown waits in a column, counted on its chip.
 */
export function layOutField(enemies: readonly { id: number; dist: number; lane?: 1; kind: string }[], len: (kind: string) => number, start?: (lane: 1 | undefined) => number): Convoy {
  return convoy(enemies.map((e) => ({ id: e.id, dist: e.dist, ...(e.lane ? { lane: e.lane } : {}), len: len(e.kind) })), undefined, start);
}
