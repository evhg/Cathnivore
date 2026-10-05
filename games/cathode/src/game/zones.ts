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
