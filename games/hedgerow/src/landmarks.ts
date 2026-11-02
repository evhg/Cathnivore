// Landmarks (plan item 43, "every level a place"): each field is somewhere, a village green, a quarry rim,
// a canal lock, standing on cells of its own. Picked from the act's own handful, so Brindle has greens and
// churchyards and Kingsmarket has market squares and locks, and placed on the cells that see least of the
// lane, so the fight barely changes while the field stops looking like the last one.

import { laneCellsOf, pathLength, pointAt, type LandmarkKind, type Level, type SetPiece } from "./engine";

export const LANDMARKS: Record<LandmarkKind, { name: string; note: string }> = {
  ford: { name: "The ford", note: "Willows and a plank footbridge where the lane wades the stream. Nothing's built on the bank." },
  green: { name: "The village green", note: "Grass and the old well. Nobody builds on a green." },
  orchard: { name: "An orchard", note: "Apple trees in rows. Cath won't cut them down for a tower." },
  quarry: { name: "The quarry", note: "A pit of pale stone with a sheer rim. Nothing stands on it." },
  bank: { name: "A raised bank", note: "High ground: towers on the bank see a quarter further." },
  farmyard: { name: "A farmyard", note: "Hay, a cart and the hens. The farm's, not yours." },
  churchyard: { name: "The churchyard", note: "A stone wall, a yew and the old headstones. Leave it be." },
  market: { name: "The market square", note: "Stalls under striped awnings. Trade goes on, whatever comes down the lane." },
  reeds: { name: "A reed bed", note: "Wet ground and reeds taller than Cath. Nothing can be built in it." },
  windmill: { name: "The windmill", note: "Sails turning on the rise. Bea's grandad built it." },
  lock: { name: "A canal lock", note: "Black and white gates on a strip of still water. No building on the towpath." },
  silo: { name: "The silo", note: "A tin grain tower with a ladder up the side. Hollowell's, and empty." },
};

/** Each act's landmarks, in the order its levels take them (docs: map.ts paints the acts in the same order). */
const ACT_KINDS: LandmarkKind[][] = [
  ["green", "orchard", "farmyard", "churchyard"], // Brindle
  ["windmill", "quarry", "bank", "farmyard"], // Highmoor
  ["reeds", "lock", "bank", "windmill"], // Saltmarsh
  ["ford", "reeds", "orchard", "lock"], // Rivermead
  ["orchard", "churchyard", "green", "bank"], // Oakvale
  ["reeds", "quarry", "lock", "windmill"], // Shingle Bay
  ["silo", "quarry", "bank", "farmyard"], // The Rift
  ["market", "churchyard", "green", "silo"], // The Ballot
  ["silo", "farmyard", "market", "lock"], // The Merger
  ["market", "lock", "churchyard", "silo"], // Kingsmarket
];

type Cell = [number, number];
/** A footprint as offsets from its corner. */
const SQUARE: Cell[] = [[0, 0], [1, 0], [0, 1], [1, 1]];
const ROW3: Cell[] = [[0, 0], [1, 0], [2, 0]];
const COL3: Cell[] = [[0, 0], [0, 1], [0, 2]];
const PAIR_H: Cell[] = [[0, 0], [1, 0]];
const PAIR_V: Cell[] = [[0, 0], [0, 1]];
const ONE: Cell[] = [[0, 0]];

function shapes(kind: LandmarkKind): Cell[][] {
  switch (kind) {
    case "green":
    case "quarry":
    case "farmyard":
    case "churchyard":
    case "market":
      return [SQUARE, ROW3, COL3, PAIR_H, PAIR_V, ONE];
    case "orchard":
    case "reeds":
    case "lock":
    case "bank":
      return [ROW3, COL3, PAIR_H, PAIR_V, ONE];
    default:
      return [PAIR_H, PAIR_V, ONE];
  }
}

function hash(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  return (h * 2246822519) >>> 0;
}

/**
 * Boss fields the best bot only wins with every plot built on: the boss is a damage check the whole field
 * just meets, so losing even one plot to scenery loses the level (measured 2026-11-02: level 50 lost with one
 * churchyard cell taken, at any start k). Their landmark is a raised bank, which keeps its plots as high ground.
 */
const FULL_FIELD = new Set([50]);

/** Which landmark kinds a level takes: one per level, two on an act's boss field. */
export function landmarkKinds(level: Pick<Level, "id" | "fords">): LandmarkKind[] {
  if (FULL_FIELD.has(level.id)) return ["bank"];
  const act = Math.min(ACT_KINDS.length, Math.max(1, Math.ceil(level.id / 10)));
  const kinds = ACT_KINDS[act - 1]!.filter((k) => k !== "ford" || !!level.fords?.length);
  const i = (level.id - 1) % 10;
  const first = kinds[i % kinds.length]!;
  if (level.id % 10 !== 0) return [first];
  return [first, kinds[(i + 1) % kinds.length]!];
}

/**
 * Stands the level's landmarks on its field. Scenery takes the cells that see least of the lane (a bank takes
 * ones that see a lot, since its point is reach); a ford stands beside its crossing. Run after terrain, oaks,
 * barns and the other set pieces, whose cells it keeps clear of.
 */
export function addLandmarks(level: Level): void {
  const lane = laneCellsOf(level);
  const taken = new Set<string>(
    [
      ...(level.terrain?.high ?? []),
      ...(level.terrain?.water ?? []),
      ...(level.oaks ?? []),
      ...(level.barns ?? []),
      ...(level.setPieces ?? []).flatMap((p) => (p.kind === "flood" || p.kind === "landmark" ? p.cells : [])),
    ].map(([c, r]) => `${c},${r}`),
  );
  const near = (c: number, r: number) => {
    let n = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (lane.has(`${c + dc},${r + dr}`)) n++;
    return n;
  };
  const free = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < level.cols && r < level.rows && !lane.has(`${c},${r}`) && !taken.has(`${c},${r}`);
  // Plots must stay plentiful: barns and scenery together never take more than a quarter of the open cells.
  const open = level.cols * level.rows - lane.size;
  let blocked = level.barns?.length ?? 0;
  const added: SetPiece[] = [];
  for (const [n, kind] of landmarkKinds(level).entries()) {
    const fordAt = kind === "ford" && level.fords?.[0] ? pointAt(level.path, (level.fords[0].from + level.fords[0].to) / 2) : null;
    let best = null as Cell[] | null;
    let bestScore = Infinity;
    for (const shape of shapes(kind)) {
      for (let r = 0; r < level.rows; r++)
        for (let c = 0; c < level.cols; c++) {
          const cells = shape.map(([dc, dr]) => [c + dc, r + dr] as Cell);
          if (!cells.every(([x, y]) => free(x, y))) continue;
          const sees = cells.reduce((a, [x, y]) => a + near(x, y), 0) / cells.length;
          let score =
            kind === "bank"
              ? -sees
              : fordAt
                ? Math.min(...cells.map(([x, y]) => Math.hypot(x + 0.5 - fordAt.x, y + 0.5 - fordAt.y))) * 4 + sees * 0.2
                : sees;
          // A boss field's second landmark keeps its distance from the first.
          if (n > 0 && added[0]?.kind === "landmark") {
            const d = Math.min(...cells.flatMap(([x, y]) => (added[0] as { cells: Cell[] }).cells.map(([a, b]) => Math.hypot(a - x, b - y))));
            if (d < 2) continue;
          }
          score += (hash(level.id * 31 + c * 7 + r * 13 + n) % 100) / 1000;
          if (score < bestScore) {
            bestScore = score;
            best = cells;
          }
        }
      if (best) break;
    }
    if (!best) continue;
    if (kind !== "bank" && blocked + best.length > open * 0.25) continue;
    if (kind !== "bank") blocked += best.length;
    for (const [x, y] of best) taken.add(`${x},${y}`);
    added.push({ kind: "landmark", type: kind, cells: best });
  }
  if (added.length) level.setPieces = [...(level.setPieces ?? []), ...added];
}

/** How far along the first lane a level's ford lies (its middle), for drawing the footbridge. */
export function fordMiddle(level: Pick<Level, "fords" | "path">): number | null {
  const f = level.fords?.[0];
  if (!f) return null;
  return Math.min(pathLength(level.path), (f.from + f.to) / 2);
}
