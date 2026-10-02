// Map layouts for Hedgerow (owner, 2026-10-02: "every level almost looks exactly the same"). Each level
// gets a lane shape from a small family of templates, sized and mirrored by a seed, so neighbouring levels
// look and play differently: a spiral into a farmhouse in the middle, a ring round the field, a staircase,
// vertical snakes, hooks, long switchbacks. Paths are cell waypoints whose consecutive points share a row
// or a column (the engine's lane format); the last point is the farmhouse.

import type { Level } from "./engine";

export type Shape = "snakeH" | "snakeV" | "spiral" | "ring" | "stairs" | "hook" | "switchback";

type P = [number, number];

function mirror(path: P[], cols: number, rows: number, fx: boolean, fy: boolean): P[] {
  return path.map(([c, r]) => [fx ? cols - 1 - c : c, fy ? rows - 1 - r : r]);
}

/** Drops waypoints that don't turn, so every point is a corner (or an end). */
function corners(path: P[]): P[] {
  const out: P[] = [path[0]!];
  for (let i = 1; i < path.length - 1; i++) {
    const [a, b, c] = [out[out.length - 1]!, path[i]!, path[i + 1]!];
    const straight = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
    if (!straight) out.push(b);
  }
  out.push(path[path.length - 1]!);
  return out;
}

function build(shape: Shape, cols: number, rows: number): P[] {
  const R = rows - 1;
  const Cm = cols - 1;
  switch (shape) {
    case "snakeH": {
      // Rows 1, 3, 5... left to right and back, entering from the left edge.
      const p: P[] = [[0, 1]];
      let right = true;
      for (let r = 1; r <= R - 1; r += 2) {
        p.push([right ? Cm - 1 : 1, r]);
        if (r + 2 <= R - 1) p.push([right ? Cm - 1 : 1, r + 2]);
        right = !right;
      }
      const last = p[p.length - 1]!;
      p.push([last[0] > cols / 2 ? Cm : 0, last[1]]);
      return p;
    }
    case "snakeV": {
      const p: P[] = [[1, 0]];
      let down = true;
      for (let c = 1; c <= Cm - 1; c += 2) {
        p.push([c, down ? R - 1 : 1]);
        if (c + 2 <= Cm - 1) p.push([c + 2, down ? R - 1 : 1]);
        down = !down;
      }
      const last = p[p.length - 1]!;
      p.push([last[0], last[1] > rows / 2 ? R : 0]);
      return p;
    }
    case "spiral": {
      // In along the top edge, clockwise and inwards with a row of plots between turns, ending in the middle.
      const p: P[] = [[0, 0]];
      let [left, top, right, bottom] = [0, 0, Cm, R];
      for (let guard = 0; guard < 6; guard++) {
        if (right - left < 1) break;
        p.push([right, top]);
        if (bottom - top < 2) break;
        p.push([right, bottom]);
        right -= 2;
        if (right - left < 0) break;
        p.push([left, bottom]);
        bottom -= 2;
        if (bottom - (top + 2) < 0) break;
        top += 2;
        p.push([left, top]);
        left += 2;
      }
      return dedupe(p);
    }
    case "ring": {
      // Round the outside, then straight in to a farmhouse near the middle.
      const mid = Math.floor(rows / 2);
      return [
        [0, 0],
        [Cm, 0],
        [Cm, R],
        [0, R],
        [0, mid],
        [Math.floor(cols / 2), mid],
      ];
    }
    case "stairs": {
      const p: P[] = [[0, 0]];
      let [c, r] = [0, 0];
      let horiz = true;
      while (c < Cm || r < R) {
        if (horiz) c = Math.min(Cm, c + 2);
        else r = Math.min(R, r + 2);
        p.push([c, r]);
        horiz = !horiz;
        if (c === Cm && r < R) {
          p.push([c, R]);
          break;
        }
        if (r === R && c < Cm) {
          p.push([Cm, r]);
          break;
        }
      }
      return dedupe(p);
    }
    case "hook": {
      // Down one side, along the bottom, up the far side, and back in to a farmhouse in the middle.
      return [
        [1, 0],
        [1, R - 1],
        [Cm - 1, R - 1],
        [Cm - 1, 2],
        [3, 2],
        [3, R - 3],
      ];
    }
    case "switchback": {
      // Long horizontal runs with short drops: fewer, longer straights.
      const p: P[] = [[0, 0]];
      let right = true;
      for (let r = 0; r <= R; r += 3) {
        p.push([right ? Cm : 0, r]);
        if (r + 3 <= R) p.push([right ? Cm : 0, r + 3]);
        right = !right;
      }
      return dedupe(p);
    }
  }
}

function dedupe(p: P[]): P[] {
  const out: P[] = [];
  for (const q of p) {
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}

/** Cells a path covers, in order; null if it crosses itself or breaks the lane format. */
function walk(path: P[], cols: number, rows: number): string[] | null {
  const cells: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const [x, y] = path[i]!;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    if (i === 0) {
      cells.push(`${x},${y}`);
      continue;
    }
    const [px, py] = path[i - 1]!;
    if (px !== x && py !== y) return null;
    const dx = Math.sign(x - px);
    const dy = Math.sign(y - py);
    let cx = px;
    let cy = py;
    while (cx !== x || cy !== y) {
      cx += dx;
      cy += dy;
      cells.push(`${cx},${cy}`);
    }
  }
  return new Set(cells).size === cells.length ? cells : null;
}

const ROTATION: Shape[] = ["snakeH", "spiral", "stairs", "snakeV", "ring", "hook", "switchback"];

/**
 * Gives a level a new layout: the shape rotates through the family (so neighbours differ), mirrored by the
 * level id. Keeps the level's own size. Returns false (and leaves the level alone) if a shape doesn't fit.
 */
export function relayout(level: Level): boolean {
  const shape = ROTATION[(level.id * 3 + Math.floor(level.id / 10)) % ROTATION.length]!;
  const fx = level.id % 2 === 1;
  const fy = level.id % 4 >= 2;
  const raw = build(shape, level.cols, level.rows);
  if (raw.length < 2) return false;
  const path = corners(mirror(raw, level.cols, level.rows, fx, fy));
  const cells = walk(path, level.cols, level.rows);
  // The staircase is meant to be short and sharp; everything else should be a proper long lane.
  if (!cells || cells.length < (shape === "stairs" ? 11 : Math.max(12, level.cols + level.rows))) return false;
  // Every lane cell needs a plot beside it somewhere, and there must be room to build.
  const lane = new Set(cells);
  const plots = level.cols * level.rows - lane.size;
  if (plots < 10) return false;
  level.path = path;
  return true;
}

export function shapeOf(level: Level): Shape {
  return ROTATION[(level.id * 3 + Math.floor(level.id / 10)) % ROTATION.length]!;
}

// ---- winding routes (owner, 2026-10-02 third playtest: "the route is always very simple and similar") ----

/** Map size by act: the fields grow as the story moves from the hills to Kingsmarket. */
export function fieldSize(id: number): { cols: number; rows: number } {
  if (id <= 10) return { cols: 7, rows: 9 };
  if (id <= 20) return { cols: 8, rows: 10 };
  if (id <= 40) return { cols: 9, rows: 11 };
  if (id <= 70) return { cols: 9, rows: 12 };
  return { cols: 10, rows: 12 };
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * A long, self-avoiding lane through a coarse grid of junctions two cells apart, so two stretches of lane
 * always have a row of plots between them. Random walks (seeded by the level) that like to keep going
 * straight for a while, then turn; the best of a few hundred tries is the longest with plenty of corners,
 * capped so the field keeps room to build. Returns cell waypoints, or null if nothing good was found.
 */
export function windingPath(id: number, cols: number, rows: number): P[] | null {
  const nc = Math.floor((cols + 1) / 2);
  const nr = Math.floor((rows + 1) / 2);
  const rand = rng(id * 7919 + 17);
  const target = Math.round(nc * nr * (0.68 + rand() * 0.14));
  const dirs: P[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  let best: P[] | null = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    // Start on the top or left edge (mirroring later puts the spawn on any side).
    const fromTop = rand() < 0.5;
    const start: P = fromTop ? [Math.floor(rand() * nc), 0] : [0, Math.floor(rand() * nr)];
    const seen = new Set([`${start[0]},${start[1]}`]);
    const walk: P[] = [start];
    let dir: P = fromTop ? [0, 1] : [1, 0];
    const straightness = 0.45 + rand() * 0.35;
    while (walk.length < target) {
      const [x, y] = walk[walk.length - 1]!;
      const free = dirs.filter(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < nc && ny < nr && !seen.has(`${nx},${ny}`);
      });
      if (!free.length) break;
      // Don't walk into a dead end if there's a choice: prefer cells with somewhere to go next.
      const exits = (d: P) =>
        dirs.filter(([ex, ey]) => {
          const nx = x + d[0] + ex;
          const ny = y + d[1] + ey;
          return nx >= 0 && ny >= 0 && nx < nc && ny < nr && !seen.has(`${nx},${ny}`) && !(nx === x && ny === y);
        }).length;
      const live = free.filter((d) => exits(d) > 0 || walk.length + 1 >= target);
      const pool = live.length ? live : free;
      const ahead = pool.find(([dx, dy]) => dx === dir[0] && dy === dir[1]);
      const pick = ahead && rand() < straightness ? ahead : pool[Math.floor(rand() * pool.length)]!;
      dir = pick;
      const next: P = [x + pick[0], y + pick[1]];
      seen.add(`${next[0]},${next[1]}`);
      walk.push(next);
    }
    const cells = walk.map(([x, y]) => [x * 2, y * 2] as P);
    const path = corners(cells);
    const turns = path.length - 2;
    // Long, lots of corners, but not a uniform zigzag: reward straights of mixed length.
    const lens = new Set<number>();
    for (let i = 1; i < path.length; i++)
      lens.add(Math.abs(path[i]![0] - path[i - 1]![0]) + Math.abs(path[i]![1] - path[i - 1]![1]));
    const score = walk.length * 3 + Math.min(turns, 12) * 2 + lens.size * 2 - Math.max(0, turns - 14) * 3;
    if (walk.length >= target * 0.8 && score > bestScore) {
      bestScore = score;
      best = path;
    }
  }
  return best;
}

/** Gives a level a bigger field and a winding route of its own. Returns false (level untouched) if none fits. */
export function rewind(level: Level): boolean {
  const { cols, rows } = fieldSize(level.id);
  const raw = windingPath(level.id, cols, rows);
  if (!raw) return false;
  const path = corners(mirror(raw, cols, rows, level.id % 2 === 0, level.id % 3 === 0));
  const cells = walk(path, cols, rows);
  if (!cells || cells.length < cols + rows + 4) return false;
  // The spawn must be on the edge of the field.
  const [sx, sy] = path[0]!;
  if (sx !== 0 && sy !== 0 && sx !== cols - 1 && sy !== rows - 1) return false;
  level.cols = cols;
  level.rows = rows;
  level.path = path;
  return true;
}
