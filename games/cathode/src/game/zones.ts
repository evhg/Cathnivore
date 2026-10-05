// Named quarters of the Drowned Market: a banner when Cath crosses into a new one (not saved).

export interface Zone {
  id: string;
  name: string;
  sub: string;
  zMin: number;
  zMax: number;
}

export const ZONES: readonly Zone[] = [
  { id: "waterfront", name: "The Waterfront", sub: "Black water · low tide", zMin: 45, zMax: 1e3 },
  { id: "stalls", name: "Stall Row", sub: "Shuttered leases", zMin: 20, zMax: 45 },
  { id: "noodle", name: "Noodle Lane", sub: "Steam and neon", zMin: -20, zMax: 20 },
  { id: "arcade", name: "The South Arcade", sub: "Candor's dead drops", zMin: -40, zMax: -20 },
  { id: "quay", name: "North Quay", sub: "Crisp's patch", zMin: -1e3, zMax: -40 },
];

export function zoneAt(z: number): Zone | undefined {
  return ZONES.find((q) => z >= q.zMin && z < q.zMax);
}

/** Tracks the current zone and reports a newly entered one (never the spawn zone's first frame). */
export class ZoneWatch {
  private cur: string | undefined;
  update(z: number): Zone | undefined {
    const q = zoneAt(z);
    if (!q || q.id === this.cur) return undefined;
    const first = this.cur === undefined;
    this.cur = q.id;
    return first ? undefined : q;
  }
}

/** The street's extent, matching the session's bounds (north, -z, is up on the map). */
export const MAP_BOUNDS = { xMin: -26, xMax: 16, zMin: -70, zMax: 66 } as const;

/** A world point as 0-1 map coordinates (x right, y down), clamped to the map. */
export function mapPoint(x: number, z: number): { x: number; y: number } {
  const b = MAP_BOUNDS;
  const c = (v: number): number => Math.max(0, Math.min(1, v));
  return { x: c((x - b.xMin) / (b.xMax - b.xMin)), y: c((z - b.zMin) / (b.zMax - b.zMin)) };
}

/** Zone bands as 0-1 vertical spans on the map. */
export function zoneBands(): { zone: Zone; y0: number; y1: number }[] {
  return ZONES.map((zone) => ({ zone, y0: mapPoint(0, zone.zMin).y, y1: mapPoint(0, zone.zMax).y }));
}

export interface DistrictLead {
  id: string;
  name: string;
  act: number;
  /** The job that opens it. */
  needs: string;
  open: boolean;
}

/** The districts beyond the quay: teasers on the map, open once the previous act's boss is down. */
export function districtLeads(jobsDone: readonly string[]): DistrictLead[] {
  const rows = [
    { id: "clinic", name: "Candor Clinic", act: 2, needs: "crispBoss" },
    { id: "plaza", name: "Hollowell Plaza", act: 3, needs: "vaneBoss" },
    { id: "tower", name: "The Board Tower", act: 4, needs: "pellBoss" },
    { id: "vault", name: "The Hollow Vault", act: 5, needs: "boardBoss" },
  ];
  return rows.map((r) => ({ ...r, open: jobsDone.includes(r.needs) }));
}

export interface Wing {
  id: string;
  name: string;
  sub: string;
  xMin: number;
  zMin: number;
  zMax: number;
  /** The job that opens it. */
  needs: string;
}

/** Districts reached from the quay's east edge; their banners and map marks appear once the previous boss is down. */
export const WINGS: readonly Wing[] = [
  { id: "clinicBay", name: "The Clinic Bay", sub: "Candor's surgery, Dr Vane's patch", xMin: 14, zMin: 16, zMax: 42, needs: "crispBoss" },
];

export function wingAt(jobsDone: readonly string[], x: number, z: number): Wing | undefined {
  return WINGS.find((w) => jobsDone.includes(w.needs) && x >= w.xMin && z >= w.zMin && z < w.zMax);
}

/** Announces a wing once on entry, and again after she leaves and returns. */
export class WingWatch {
  private cur: string | undefined;
  update(jobsDone: readonly string[], x: number, z: number): Wing | undefined {
    const w = wingAt(jobsDone, x, z);
    if (w?.id === this.cur) return undefined;
    this.cur = w?.id;
    return w;
  }
}
