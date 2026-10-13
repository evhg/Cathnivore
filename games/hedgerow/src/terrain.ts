// Terrain that matters: high ground (+25% range) and water (Duck Ponds only). Generated from each level's
// lane so every level has a few choice plots; hand-built test levels carry no terrain.

import { laneCellsOf, type Level } from "./engine";

/** Act places that are wet: Saltmarsh (3), Rivermead (4), Shingle Bay (6). */
const WET_ACTS = new Set([3, 4, 6]);

function hash(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  return (h * 2246822519) >>> 0;
}

export function addTerrain(level: Level): void {
  if (level.id < 4) return;
  const lane = laneCellsOf(level);
  const cells: Array<{ c: number; r: number; near: number; adj: number }> = [];
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++) {
      if (lane.has(`${c},${r}`)) continue;
      let near = 0;
      let adj = 0;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          if (!lane.has(`${c + dc},${r + dr}`)) continue;
          near++;
          if (Math.abs(dc) + Math.abs(dr) === 1) adj++;
        }
      cells.push({ c, r, near, adj });
    }
  const used = new Set<string>();
  const far = (c: number, r: number) =>
    [...used].every((k) => {
      const [a, b] = k.split(",").map(Number);
      return Math.hypot(a! - c, b! - r) >= 3;
    });
  const pick = (pool: typeof cells, n: number, seed: number, backed = false) => {
    const out: Array<[number, number]> = [];
    // `backed`: prefer plots one cell back from the lane (adj 0), then by how much lane they see.
    const w = (x: (typeof cells)[number]) => x.near - (backed ? x.adj * 2 : 0);
    const sorted = [...pool].sort(
      (a, b) => w(b) - w(a) || hash(seed + a.c * 31 + a.r) - hash(seed + b.c * 31 + b.r),
    );
    for (const x of sorted) {
      if (out.length >= n) break;
      if (!far(x.c, x.r)) continue;
      used.add(`${x.c},${x.r}`);
      out.push([x.c, x.r]);
    }
    return out;
  };
  // High ground sits one cell back from the lane, where the extra reach matters.
  const high = pick(
    cells.filter((x) => x.near >= 3),
    level.id >= 11 ? 3 : 2,
    level.id,
    true,
  );
  const act = Math.ceil(level.id / 10);
  const water = WET_ACTS.has(act)
    ? pick(
        cells.filter((x) => x.adj >= 1 && x.near >= 3),
        3,
        level.id * 7,
      )
    : [];
  level.terrain = { high, water };
}

/** Fallen oaks (H12): from level 5 on, Fleet levels lose their best plain plot to an oak that costs OAK_COST to clear. */
export function addOaks(level: Level): void {
  if (level.id < 5 || level.rules !== "fleet") return;
  const lane = laneCellsOf(level);
  const t = level.terrain ?? { high: [], water: [] };
  const taken = new Set([...t.high, ...t.water].map(([c, r]) => `${c},${r}`));
  const cells: Array<{ c: number; r: number; near: number }> = [];
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++) {
      if (lane.has(`${c},${r}`) || taken.has(`${c},${r}`)) continue;
      let near = 0;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (lane.has(`${c + dc},${r + dr}`)) near++;
      cells.push({ c, r, near });
    }
  cells.sort((a, b) => b.near - a.near || hash(level.id * 13 + a.c * 31 + a.r) - hash(level.id * 13 + b.c * 31 + b.r));
  const out: Array<[number, number]> = [];
  for (const x of cells) {
    if (out.length >= (level.id >= 20 ? 2 : 1)) break;
    if (out.some(([c, r]) => Math.hypot(c - x.c, r - x.r) < 3)) continue;
    out.push([x.c, x.r]);
  }
  level.oaks = out;
}
