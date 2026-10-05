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
