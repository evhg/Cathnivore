// Plan item 135: Cath's debrief after a round with leaks. Which stretch of lane nothing covered (the longest run of
// lane cells outside every tower's reach, or the least covered run when all of it is in reach), and the empty plot
// beside its middle where she'd build next. Pure, so it is unit-tested without a field.

export interface Reach {
  col: number;
  row: number;
  /** Reach in cells, centre to centre. */
  range: number;
}

export interface Debrief {
  /** The stretch's cells, in lane order. */
  cells: Array<[number, number]>;
  /** The empty plot nearest the stretch's middle, or null when there is none. */
  plot: { col: number; row: number } | null;
}

const covers = (t: Reach, c: number, r: number) => Math.hypot(t.col - c, t.row - r) <= t.range;

/** The longest run of the lane's cells with the fewest towers reaching them (none, when any run is bare). */
export function weakStretch(path: ReadonlyArray<readonly [number, number]>, towers: readonly Reach[]): Array<[number, number]> {
  if (!path.length) return [];
  const cover = path.map(([c, r]) => towers.filter((t) => covers(t, c, r)).length);
  const low = Math.min(...cover);
  let best: [number, number] = [0, 0];
  for (let i = 0; i < path.length; ) {
    if (cover[i] !== low) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < path.length && cover[j + 1] === low) j++;
    if (j - i > best[1] - best[0] || (best[0] === 0 && best[1] === 0 && cover[0] !== low)) best = [i, j];
    i = j + 1;
  }
  return path.slice(best[0], best[1] + 1).map(([c, r]) => [c, r]);
}

/** The debrief for a field: the weakest stretch over all its lanes and the free plot nearest its middle. */
export function leakDebrief(
  lanes: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  towers: readonly Reach[],
  freePlot: (col: number, row: number) => boolean,
  cols: number,
  rows: number,
): Debrief {
  let cells: Array<[number, number]> = [];
  for (const lane of lanes) {
    const s = weakStretch(lane, towers);
    if (s.length > cells.length) cells = s;
  }
  if (!cells.length) return { cells, plot: null };
  const [mc, mr] = cells[Math.floor(cells.length / 2)]!;
  let plot: Debrief["plot"] = null;
  let bestD = Infinity;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (!freePlot(c, r)) continue;
      const d = Math.hypot(c - mc, r - mr);
      if (d < bestD) [bestD, plot] = [d, { col: c, row: r }];
    }
  return { cells, plot };
}
