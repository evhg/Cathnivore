// Plan item 29: the compass tape's model. A thin tape at the top of the HUD shows the points of the compass
// within a span either side of where Cath faces, and a red-pencil tick for the objective (and the district's
// lieutenant once known). North is -z, the way she faces at yaw 0 (player.ts: forward = (-sin yaw, 0, -cos yaw)),
// so her heading clockwise from north is -yaw. Pure maths here; hud.ts draws it.

const TAU = Math.PI * 2;

/** An angle wrapped into (-PI, PI]. */
export function wrap(a: number): number {
  const w = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return w === -Math.PI ? Math.PI : w;
}

/** Her heading in radians clockwise from north, for a camera yaw. */
export const headingOf = (yaw: number): number => wrap(-yaw);

/** The bearing (radians clockwise from north) from one ground point to another. */
export function bearingTo(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, -(to.z - from.z));
}

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export interface TapeMark {
  label: (typeof POINTS)[number];
  /** -1 at the tape's left end, 1 at its right. */
  x: number;
}

/** The compass points on the tape for a heading, with `span` radians either side of centre. */
export function tapeMarks(heading: number, span = Math.PI / 3): TapeMark[] {
  const out: TapeMark[] = [];
  POINTS.forEach((label, i) => {
    const rel = wrap((i * Math.PI) / 4 - heading);
    if (Math.abs(rel) <= span) out.push({ label, x: rel / span });
  });
  return out;
}

export interface TapeTick {
  /** Relative bearing, radians (positive to her right). */
  rel: number;
  /** -1..1 on the tape, clamped to an end when the mark is behind the tape's span. */
  x: number;
  /** Off the tape: the tick sits pinned at that end as an arrow. */
  off: boolean;
}

/** Where a world point sits on the tape. */
export function tapeTick(heading: number, from: { x: number; z: number }, to: { x: number; z: number }, span = Math.PI / 3): TapeTick {
  const rel = wrap(bearingTo(from, to) - heading);
  const off = Math.abs(rel) > span;
  return { rel, x: off ? Math.sign(rel) : rel / span, off };
}
