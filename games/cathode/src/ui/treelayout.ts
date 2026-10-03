// Skill-tree layout for the Diablo II-style tree screen (pure, no DOM, unit-tested in
// tests/cathode-ui-treelayout.test.ts).
//
// Each tree is a grid of 3 columns × 6 rows (rows unlock at levels 1/6/12/18/24/30). The catalogue only
// says which row a skill sits in, so this module picks a column for each one. Connectors are drawn as
// "circuit traces": down from the parent's centre to the top edge of the child's row, across, then down
// into the child. The layout tries every column assignment (at most a few thousand per tree) and keeps the
// one with the lowest cost, where a trace running through another node is very expensive, a crossing is
// expensive, and long sideways runs and lopsided rows cost a little.

export interface LayoutSkill {
  id: string;
  row: number;
  prereqs: readonly string[];
}

export interface NodePos {
  id: string;
  row: number;
  col: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  /** The trace as a polyline in cell units: node centres sit at (col + 0.5, row + 0.5). */
  points: Point[];
}

export interface TreeLayout {
  cols: number;
  rows: number;
  nodes: NodePos[];
  edges: LayoutEdge[];
  /** The cost the layout scored (0 is perfect); exposed for tests. */
  cost: number;
}

export const TREE_COLS = 3;
export const TREE_ROWS = 6;

/** The trace from a parent cell to a child cell: down, across at the child row's top edge, down. */
export function edgePoints(from: { row: number; col: number }, to: { row: number; col: number }): Point[] {
  const x1 = from.col + 0.5;
  const x2 = to.col + 0.5;
  const y1 = from.row + 0.5;
  const y2 = to.row + 0.5;
  if (x1 === x2) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  const mid = to.row; // the boundary just above the child
  return [
    { x: x1, y: y1 },
    { x: x1, y: mid },
    { x: x2, y: mid },
    { x: x2, y: y2 },
  ];
}

type Seg = [Point, Point];

function segments(points: readonly Point[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 1; i < points.length; i++) out.push([points[i - 1]!, points[i]!]);
  return out;
}

const EPS = 1e-9;

/** True when two axis-aligned segments touch or overlap (traces here are always axis-aligned). */
export function segmentsMeet(a: Seg, b: Seg): boolean {
  const [a1, a2] = a;
  const [b1, b2] = b;
  const ax0 = Math.min(a1.x, a2.x) - EPS;
  const ax1 = Math.max(a1.x, a2.x) + EPS;
  const ay0 = Math.min(a1.y, a2.y) - EPS;
  const ay1 = Math.max(a1.y, a2.y) + EPS;
  const bx0 = Math.min(b1.x, b2.x) - EPS;
  const bx1 = Math.max(b1.x, b2.x) + EPS;
  const by0 = Math.min(b1.y, b2.y) - EPS;
  const by1 = Math.max(b1.y, b2.y) + EPS;
  return ax0 <= bx1 && bx0 <= ax1 && ay0 <= by1 && by0 <= ay1;
}

/** True when a trace passes through a node's cell (other than its own two ends). */
export function passesThrough(points: readonly Point[], node: { row: number; col: number }): boolean {
  // A node occupies the middle of its cell; treat it as a box of ±0.3 around its centre. Traces are
  // axis-aligned, so a segment meets the box exactly when their bounding boxes overlap.
  const cx = node.col + 0.5;
  const cy = node.row + 0.5;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (
      Math.min(a.x, b.x) <= cx + 0.3 &&
      Math.max(a.x, b.x) >= cx - 0.3 &&
      Math.min(a.y, b.y) <= cy + 0.3 &&
      Math.max(a.y, b.y) >= cy - 0.3
    ) {
      return true;
    }
  }
  return false;
}

/** True when two traces cross or run along each other (traces sharing an end node are allowed to merge). */
export function tracesCross(a: LayoutEdge, b: LayoutEdge): boolean {
  if (a.from === b.from || a.to === b.to || a.from === b.to || a.to === b.from) {
    // Shared nodes: siblings may share their first vertical run, and two parents may merge into one child.
    if (a.from === b.from) return false; // siblings fan out from one parent: always fine
    if (a.to === b.to) {
      // Two parents into one child: fine unless their sideways runs overlap from the same side.
      const ax = a.points[0]!.x;
      const bx = b.points[0]!.x;
      const cx = a.points[a.points.length - 1]!.x;
      return Math.sign(ax - cx) === Math.sign(bx - cx) && ax !== cx;
    }
    return false;
  }
  return segments(a.points).some((s) => segments(b.points).some((t) => segmentsMeet(s, t)));
}

/** Scores a candidate layout (lower is better). */
export function layoutCost(nodes: readonly NodePos[], edges: readonly LayoutEdge[]): number {
  let cost = 0;
  for (const e of edges) {
    for (const n of nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      if (passesThrough(e.points, n)) cost += 100;
    }
    const first = e.points[0]!;
    const last = e.points[e.points.length - 1]!;
    cost += Math.abs(first.x - last.x) * 1;
  }
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) if (tracesCross(edges[i]!, edges[j]!)) cost += 10;
  }
  // Aesthetics: lone skills sit in the centre column, pairs on the outer columns.
  const byRow = new Map<number, NodePos[]>();
  for (const n of nodes) byRow.set(n.row, [...(byRow.get(n.row) ?? []), n]);
  for (const row of byRow.values()) {
    if (row.length === 1 && row[0]!.col !== 1) cost += 2;
    if (row.length === 2 && row.some((n) => n.col === 1)) cost += 1.5;
  }
  return cost;
}

/** Every way to put k distinct items into `cols` columns, preferred shapes first (pairs out, singles centred). */
function placements(k: number, cols: number): number[][] {
  const out: number[][] = [];
  const pick = (acc: number[]) => {
    if (acc.length === k) {
      out.push(acc);
      return;
    }
    for (let c = 0; c < cols; c++) if (!acc.includes(c)) pick([...acc, c]);
  };
  pick([]);
  const pref = (p: number[]) => (k === 1 ? (p[0] === 1 ? 0 : 1) : k === 2 && !p.includes(1) ? 0 : 1);
  return out.map((p, i) => [p, i] as const).sort((x, y) => pref(x[0]) - pref(y[0]) || x[1] - y[1]).map(([p]) => p);
}

function buildEdges(skills: readonly LayoutSkill[], pos: ReadonlyMap<string, NodePos>): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  for (const s of skills) {
    const to = pos.get(s.id);
    if (!to) continue;
    for (const p of s.prereqs) {
      const from = pos.get(p);
      if (from) edges.push({ from: p, to: s.id, points: edgePoints(from, to) });
    }
  }
  return edges;
}

/**
 * Lays out one tree: picks each skill's column to keep the traces clean. An exhaustive search with
 * branch-and-bound (every cost term is non-negative, so a partial layout that already costs more than the
 * best full one is dropped). Deterministic: ties keep the first, most conventional assignment.
 */
export function layoutTree(skills: readonly LayoutSkill[], cols = TREE_COLS, rows = TREE_ROWS): TreeLayout {
  const rowIds = Array.from(new Set(skills.map((s) => s.row))).sort((a, b) => a - b);
  const groups = rowIds.map((r) => skills.filter((s) => s.row === r));
  const options = groups.map((g) => placements(Math.min(g.length, cols), cols));
  let best: { cost: number; nodes: NodePos[]; edges: LayoutEdge[] } | null = null;
  const placed: NodePos[] = [];

  const walk = (gi: number) => {
    const pos = new Map(placed.map((n) => [n.id, n]));
    const edges = buildEdges(skills, pos);
    const cost = layoutCost(placed, edges);
    if (best && cost >= best.cost - EPS) return;
    if (gi === groups.length) {
      best = { cost, nodes: placed.slice(), edges };
      return;
    }
    const g = groups[gi]!;
    for (const place of options[gi]!) {
      g.forEach((s, i) => placed.push({ id: s.id, row: s.row, col: place[i] ?? i % cols }));
      walk(gi + 1);
      placed.length -= g.length;
    }
  };
  walk(0);

  const b = best as { cost: number; nodes: NodePos[]; edges: LayoutEdge[] } | null;
  return { cols, rows, nodes: b?.nodes ?? [], edges: b?.edges ?? [], cost: b?.cost ?? 0 };
}

const cache = new Map<string, TreeLayout>();

/** `layoutTree`, memoised by a key (the tree id): the layout never changes at runtime. */
export function cachedLayout(key: string, skills: readonly LayoutSkill[]): TreeLayout {
  let l = cache.get(key);
  if (!l) {
    l = layoutTree(skills);
    cache.set(key, l);
  }
  return l;
}

/** The SVG path `d` for a trace. */
export function tracePath(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}
