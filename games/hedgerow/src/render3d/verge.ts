// Plan item 66: the country round the 3D field, dressed from the 2D field's set: sheep grazing, pines, clumps of
// wild flowers and an old scarecrow, out on the verges beyond the hedge and along the lane where it runs off the
// field. Pure (no three.js), seeded by the level, so a level always looks the same and tests can check that
// nothing lands on a plot, on the lane or in the sea.
import type { Level } from "../engine";
import { rng } from "../theme";

export type VergeKind = "sheep" | "pine" | "flowers" | "scarecrow";

export interface VergeItem {
  kind: VergeKind;
  /** Cell units: x across the columns, y down the rows (the same as the field's own coordinates). */
  x: number;
  y: number;
  /** Turn about the vertical, radians. */
  ry: number;
  /** Size multiplier around 1. */
  s: number;
}

/** Distance from (x, y) (cell units) to the nearest lane centreline, the first segment extended off the field. */
export function laneDistance(level: Level, x: number, y: number): number {
  let best = Infinity;
  for (const path of [level.path, level.path2].filter(Boolean) as Array<Level["path"]>) {
    const pts = path.map(([c, r]) => [c + 0.5, r + 0.5] as const);
    const [a, b] = [pts[0]!, pts[1]!];
    const dx = Math.sign(a[0] - b[0]);
    const dy = Math.sign(a[1] - b[1]);
    const all = [[a[0] + dx * 30, a[1] + dy * 30] as const, ...pts];
    for (let i = 1; i < all.length; i++) {
      const [ax, ay] = all[i - 1]!;
      const [bx, by] = all[i]!;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)));
    }
  }
  return best;
}

/** The sea beside a coastal act's field (acts 3, 4 and 6), with a margin for its sloping bank. */
export function inSea(level: Level, x: number, y: number): boolean {
  const act = Math.floor((level.id - 1) / 10);
  if (act === 2) return x < -2.1;
  if (act === 3) return x > level.cols + 2.1;
  if (act === 5) return y > level.rows + 2.1;
  return false;
}

/** How far out from the field's edge a point is (0 inside the grid). */
function outside(level: Level, x: number, y: number): number {
  return Math.hypot(Math.max(0, -x, x - level.cols), Math.max(0, -y, y - level.rows));
}

/** Clear of the field, its hedge, the lane and its verge, the sea, and the far side's houses and landmarks. */
export function vergeSpotOk(level: Level, x: number, y: number, clear = 0.8): boolean {
  const out = outside(level, x, y);
  if (out < clear || out > 3.6) return false;
  if (y < 0 && out > 1.7) return false; // the far row of houses and the act's landmarks
  if (laneDistance(level, x, y) < clear) return false;
  return !inSea(level, x, y);
}

/** What each act grazes and grows on its verges (Kingsmarket is night in the city: flowers in planters only). */
const COUNTS: Record<VergeKind, number[]> = {
  sheep: [6, 7, 3, 4, 3, 2, 0, 3, 0, 0],
  pine: [3, 5, 1, 2, 4, 1, 0, 1, 1, 2],
  flowers: [26, 22, 16, 24, 22, 12, 8, 18, 6, 8],
  scarecrow: [1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
};

export function vergeScatter(level: Level): VergeItem[] {
  const act = Math.max(0, Math.min(9, Math.floor((level.id - 1) / 10)));
  const rand = rng(level.id * 65537 + 911);
  const items: VergeItem[] = [];
  const spacing: Record<VergeKind, number> = { sheep: 0.55, pine: 0.9, flowers: 0.35, scarecrow: 1.2 };
  const W = level.cols + 8;
  const H = level.rows + 8;
  for (const kind of ["scarecrow", "pine", "sheep", "flowers"] as VergeKind[]) {
    const want = COUNTS[kind][act] ?? 0;
    let placed = 0;
    // Sheep graze in a flock or two: each after the first tries near an earlier one.
    for (let tries = 0; placed < want && tries < want * 40; tries++) {
      let x = -4 + rand() * W;
      let y = -4 + rand() * H;
      const flock = items.filter((i) => i.kind === "sheep");
      if (kind === "sheep" && flock.length && rand() < 0.75) {
        const f = flock[Math.floor(rand() * flock.length)]!;
        x = f.x + (rand() - 0.5) * 1.4;
        y = f.y + (rand() - 0.5) * 1.4;
      }
      if (!vergeSpotOk(level, x, y, kind === "pine" ? 1.1 : 0.8)) continue;
      // Nothing tall on the near side, between the camera and the field.
      if ((kind === "pine" || kind === "scarecrow") && y > level.rows - 0.5) continue;
      if (items.some((i) => Math.hypot(i.x - x, i.y - y) < Math.max(spacing[i.kind], spacing[kind]))) continue;
      items.push({ kind, x, y, ry: rand() * Math.PI * 2, s: 0.85 + rand() * 0.3 });
      placed++;
    }
  }
  return items;
}
