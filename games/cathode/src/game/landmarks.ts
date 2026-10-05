// Hub street observations: Cath comments once on a landmark the first time she walks past it.
// Seen ids are recorded as `look:<id>` in `jobsDone`.

export interface Landmark {
  id: string;
  x: number;
  z: number;
  radius: number;
  text: string;
}

export const LANDMARKS: readonly Landmark[] = [
  { id: "noodles", x: 3, z: 14, radius: 6, text: "The noodle cart. Tomas used to bring Bea a bowl on Fridays, extra spring onion." },
  { id: "stalls", x: 4, z: 30, radius: 7, text: "Half these stalls are shuttered. Candor bought the leases, then bought the silence." },
  { id: "checkpoint", x: -1.5, z: -30, radius: 8, text: "Checkpoint 7. Closed, they say. The cameras still turn." },
  { id: "market", x: 0, z: -48, radius: 8, text: "The market office. Lights on, nobody home. Somebody wants it to look that way." },
  { id: "water", x: 0, z: 62, radius: 8, text: "The water's black tonight. Tomas swam it every summer." },
];

export const lookKey = (id: string): string => `look:${id}`;

/** The first unseen landmark within reach of (x, z), marking it seen. */
export function nearLandmark(jobsDone: string[], x: number, z: number): Landmark | undefined {
  for (const l of LANDMARKS) {
    if (jobsDone.includes(lookKey(l.id))) continue;
    if ((x - l.x) ** 2 + (z - l.z) ** 2 <= l.radius * l.radius) {
      jobsDone.push(lookKey(l.id));
      return l;
    }
  }
  return undefined;
}
