// Plan item 12: the district map as a drawn plan. This module is pure layout (no DOM): it turns a district,
// Cath's position, the objective, the save and the level's colliders into a sheet in metres: ground (blocks,
// pavement, road, quay, canal, flood), the solid things at body height as ink, the landmarks, rooms, secrets
// and the objective, and every label placed so that no two overlap (tests/cathode-mapplan.test.ts).
// districtmap.ts draws it as SVG with the viewBox in metres, so a label's size is set once, here.

import { LANDMARKS } from "../game/landmarks";
import { SECRETS, secretKey } from "../game/secrets";
import { MAP_BOUNDS, WINGS, ZONES } from "../game/zones";
import { districtBounds, districtLabels } from "../render/levels";

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type LabelKind = "zone" | "sub" | "room" | "landmark" | "goal" | "cath" | "exit" | "wing" | "fly";

export interface PlanLabel {
  kind: LabelKind;
  text: string;
  /** Left baseline of the text, in metres. */
  x: number;
  z: number;
  size: number;
  /** Its box, for overlap tests. */
  box: Rect;
  /** The point it names, when it was pushed away from it (a leader line is drawn). */
  leader?: { x: number; z: number };
}

export type GroundKind = "block" | "pavement" | "road" | "quay" | "water" | "flood" | "floor";

export interface Plan {
  /** The whole sheet (paper), in metres: x across, z down. */
  sheet: Rect;
  /** The walkable or drawn area inside the sheet's margins. */
  bounds: Rect;
  ground: { kind: GroundKind; r: Rect }[];
  /** The flyover deck, drawn dashed over everything. */
  flyover?: Rect;
  /** Zone dividers across the west block (z values). */
  dividers: number[];
  /** Solid things at body height, as footprints. */
  solids: Rect[];
  secrets: { x: number; z: number; kind: string }[];
  wings: Rect[];
  goal?: { x: number; z: number };
  cath: { x: number; z: number };
  labels: PlanLabel[];
  /** Where the compass and scale bar sit (bottom-right margin). */
  legend: { x: number; z: number };
}

/** Rough advance width per character, as a share of the font size (condensed caps; serif italic). */
const ADVANCE: Record<LabelKind, number> = { zone: 0.62, sub: 0.5, room: 0.62, landmark: 0.56, goal: 0.66, cath: 0.66, exit: 0.6, wing: 0.62, fly: 0.56 };
export const LABEL_SIZE: Record<LabelKind, number> = { zone: 2.7, sub: 2.3, room: 3, landmark: 2.4, goal: 2.5, cath: 2.5, exit: 2.3, wing: 2.3, fly: 2.1 };

export function labelWidth(kind: LabelKind, text: string, size = LABEL_SIZE[kind]): number {
  return text.length * size * ADVANCE[kind];
}

function boxOf(x: number, z: number, w: number, size: number): Rect {
  // The box is the font's line box (what the browser measures), from above the caps to below the descenders.
  return { x0: x - 0.3, z0: z - size * 1.15, x1: x + w + 0.3, z1: z + size * 0.36 };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}

function inside(r: Rect, s: Rect): boolean {
  return r.x0 >= s.x0 && r.x1 <= s.x1 && r.z0 >= s.z0 && r.z1 <= s.z1;
}

/** Greedy placement: the first candidate spot near the point that clears every placed label and keep-out. */
class Placer {
  readonly labels: PlanLabel[] = [];
  constructor(private readonly sheet: Rect, private readonly keepOut: Rect[] = []) {}

  free(r: Rect): boolean {
    return inside(r, this.sheet) && !this.labels.some((l) => overlaps(l.box, r)) && !this.keepOut.some((k) => overlaps(k, r));
  }

  /** Places a label exactly (zones, rooms): it is pushed down a little until it clears. */
  fixed(kind: LabelKind, text: string, x: number, z: number, centred = false): PlanLabel | undefined {
    const size = LABEL_SIZE[kind];
    const w = labelWidth(kind, text, size);
    const x0 = Math.min(this.sheet.x1 - w - 0.4, Math.max(this.sheet.x0 + 0.4, centred ? x - w / 2 : x));
    for (let dz = 0; dz <= 12; dz += 0.6) {
      for (const s of dz ? [1, -1] : [1]) {
        const zz = z + s * dz;
        const box = boxOf(x0, zz, w, size);
        if (this.free(box)) return this.push({ kind, text, x: x0, z: zz, size, box });
      }
    }
    return undefined;
  }

  /** Places a label beside a point: right, left, above, below, then further out with a leader line. */
  near(kind: LabelKind, text: string, px: number, pz: number, gap = 1.6): PlanLabel | undefined {
    const size = LABEL_SIZE[kind];
    const w = labelWidth(kind, text, size);
    const mid = size * 0.3;
    const spots: [number, number][] = [
      [px + gap, pz + mid],
      [px - gap - w, pz + mid],
      [px - w / 2, pz - gap],
      [px - w / 2, pz + gap + size * 0.8],
    ];
    for (let r = 2; r <= 30; r += 1.5) {
      for (const dz of [0, -r, r]) {
        spots.push([px + gap + r * 0.6, pz + mid + dz], [px - gap - w - r * 0.6, pz + mid + dz]);
      }
    }
    for (const [x, z] of spots) {
      const box = boxOf(x, z, w, size);
      if (!this.free(box)) continue;
      const far = Math.min(Math.abs(box.x0 - px), Math.abs(box.x1 - px)) > gap + 1 || Math.min(Math.abs(box.z0 - pz), Math.abs(box.z1 - pz)) > gap + 1;
      return this.push({ kind, text, x, z, size, box, leader: far ? { x: px, z: pz } : undefined });
    }
    return undefined;
  }

  private push(l: PlanLabel): PlanLabel {
    this.labels.push(l);
    return l;
  }
}

/** Collider footprints at body height inside the area: walls, stalls, cars, desks. */
export function solidsFrom(colliders: readonly { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[], area: Rect): Rect[] {
  const out: Rect[] = [];
  for (const c of colliders) {
    if (c.max.y < 0.5 || c.min.y > 1.5) continue;
    const r = { x0: Math.max(area.x0, c.min.x), z0: Math.max(area.z0, c.min.z), x1: Math.min(area.x1, c.max.x), z1: Math.min(area.z1, c.max.z) };
    if (r.x1 - r.x0 < 0.05 || r.z1 - r.z0 < 0.05 || (r.x1 - r.x0) * (r.z1 - r.z0) < 0.08) continue;
    out.push(r);
  }
  return out;
}

const round = (v: number): number => Math.round(v * 100) / 100;

/** The market's street, in the same metres as level.ts's `L`: west block, pavement, road, quay, canal. */
function marketGround(b: Rect): Plan["ground"] {
  const blocks: Plan["ground"] = [];
  // The west block, cut by its two alleys.
  let z = b.z0;
  for (const a of [{ z0: -45, z1: -41 }, { z0: 21, z1: 25 }]) {
    blocks.push({ kind: "block", r: { x0: b.x0, z0: z, x1: -10, z1: a.z0 } });
    z = a.z1;
  }
  blocks.push({ kind: "block", r: { x0: b.x0, z0: z, x1: -10, z1: b.z1 } });
  return [
    ...blocks,
    { kind: "pavement", r: { x0: -10, z0: -68, x1: -6.5, z1: 64 } },
    { kind: "road", r: { x0: -6.5, z0: -68, x1: 3.5, z1: 64 } },
    { kind: "quay", r: { x0: 3.5, z0: -68, x1: 9, z1: 64 } },
    { kind: "water", r: { x0: 9, z0: b.z0, x1: b.x1, z1: b.z1 } },
    // The black water past the street's north end, and the flooded dip.
    { kind: "water", r: { x0: -10, z0: 64, x1: 9, z1: b.z1 } },
    { kind: "flood", r: { x0: -6.5, z0: -34, x1: 3.5, z1: -10 } },
  ];
}

export interface PlanInput {
  district: string;
  at: { x: number; z: number };
  objective: { x: number; z: number } | null;
  jobsDone: readonly string[];
  colliders: readonly { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }[];
}

export function mapPlan({ district, at, objective, jobsDone, colliders }: PlanInput): Plan {
  const local = districtBounds(district);
  const market = !local;
  const bounds: Rect = local ? { x0: local.xMin, z0: local.zMin, x1: local.xMax, z1: local.zMax } : { x0: MAP_BOUNDS.xMin, z0: MAP_BOUNDS.zMin, x1: MAP_BOUNDS.xMax, z1: MAP_BOUNDS.zMax };
  // Paper margins: room for callouts, and at least 0.42 wide for every metre tall so a narrow interior keeps
  // its notes legible. The bottom margin holds the way out, the compass and the scale bar.
  const h = bounds.z1 - bounds.z0 + 4 + 12;
  const minW = Math.max(bounds.x1 - bounds.x0 + 4, h * (market ? 0.5 : 0.52));
  const extra = (minW - (bounds.x1 - bounds.x0)) / 2;
  const sheet: Rect = { x0: bounds.x0 - extra, z0: bounds.z0 - 4, x1: bounds.x1 + extra, z1: bounds.z1 + 12 };
  const legend = { x: sheet.x1 - 3, z: sheet.z1 - 3 };
  const cath = { x: Math.min(bounds.x1, Math.max(bounds.x0, at.x)), z: Math.min(bounds.z1, Math.max(bounds.z0, at.z)) };
  const goal = objective ? { x: Math.min(bounds.x1, Math.max(bounds.x0, objective.x)), z: Math.min(bounds.z1, Math.max(bounds.z0, objective.z)) } : undefined;
  // Markers and the legend are keep-outs for labels.
  const keep: Rect[] = [
    { x0: cath.x - 1.4, z0: cath.z - 1.4, x1: cath.x + 1.4, z1: cath.z + 1.4 },
    { x0: legend.x - 17, z0: legend.z - 9, x1: sheet.x1, z1: sheet.z1 },
  ];
  if (goal) keep.push({ x0: goal.x - 3.4, z0: goal.z - 3.4, x1: goal.x + 3.4, z1: goal.z + 3.4 });
  const place = new Placer(sheet, keep);
  if (goal) place.near("goal", "Objective", goal.x, goal.z, 4.4);
  place.near("cath", "Cath", cath.x, cath.z, 1.8);

  const secrets: Plan["secrets"] = [];
  const wings: Rect[] = [];
  const dividers: number[] = [];
  let ground: Plan["ground"];
  let flyover: Rect | undefined;
  if (market) {
    ground = marketGround(bounds);
    flyover = { x0: sheet.x0, z0: -1, x1: sheet.x1, z1: 13 };
    const fw = labelWidth("fly", "Flyover overhead");
    place.fixed("fly", "Flyover overhead", sheet.x1 - fw - 1, -1 + 2.8);
    for (const zone of ZONES) {
      const z0 = Math.max(bounds.z0, zone.zMin);
      if (zone.zMin > bounds.z0) dividers.push(zone.zMin);
      const left = SECRETS.filter((s) => s.z >= zone.zMin && s.z < zone.zMax && !jobsDone.includes(secretKey(s.id))).length;
      place.fixed("zone", zone.name, sheet.x0 + 1, z0 + 3.6);
      place.fixed("sub", left ? `${zone.sub}, ${left} hidden` : zone.sub, sheet.x0 + 1, z0 + 7.5);
    }
    for (const w of WINGS) {
      if (!jobsDone.includes(w.needs)) continue;
      wings.push({ x0: w.xMin, z0: w.zMin, x1: bounds.x1 + 1, z1: w.zMax });
      place.near("wing", w.name, bounds.x1, (w.zMin + w.zMax) / 2);
    }
    for (const s of SECRETS) if (jobsDone.includes(secretKey(s.id))) secrets.push({ x: s.x, z: s.z, kind: s.kind });
    for (const l of LANDMARKS) {
      if (l.needs && !jobsDone.includes(l.needs)) continue;
      place.near("landmark", l.name, l.x, l.z);
    }
    place.near("exit", "Water taxi", 6.6, -60.5);
  } else {
    ground = [{ kind: "floor", r: bounds }];
    for (const [name, x, z] of districtLabels(district)) place.fixed("room", name, x, z, true);
    place.fixed("exit", "Way out", (bounds.x0 + bounds.x1) / 2, bounds.z1 + 3, true);
  }
  const solids = solidsFrom(colliders, bounds).map((r) => ({ x0: round(r.x0), z0: round(r.z0), x1: round(r.x1), z1: round(r.z1) }));
  return { sheet, bounds, ground, flyover, dividers, solids, secrets, wings, goal, cath, labels: place.labels, legend };
}
