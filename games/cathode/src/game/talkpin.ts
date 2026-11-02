import * as THREE from "three";

/**
 * Plan item 42: where the talk's two-shot stands them. She has him pinned to the nearest wall in reach: his back
 * to it (`back` off the face), her a step in front. Scans 24 directions at chest height from where she stands and
 * takes the nearest wall between `min` and `max` metres away, so there is room for both of them on her side of
 * it. Null when no wall is in reach (the two-shot then stands them face to face where she was).
 */
export function wallPin(
  at: THREE.Vector3,
  colliders: readonly THREE.Box3[],
  opts: { min?: number; max?: number; back?: number; gap?: number } = {},
): { him: THREE.Vector3; her: THREE.Vector3; toWall: THREE.Vector3 } | null {
  const min = opts.min ?? 1.45;
  const max = opts.max ?? 3.2;
  const back = opts.back ?? 0.3;
  const gap = opts.gap ?? 1.05;
  const origin = new THREE.Vector3(at.x, at.y + 1.2, at.z);
  const ray = new THREE.Ray(origin, new THREE.Vector3());
  const hit = new THREE.Vector3();
  let best: { d: number; dir: THREE.Vector3 } | null = null;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    ray.direction.set(Math.sin(a), 0, Math.cos(a));
    // The nearest box this way: a wall only counts if nothing stands nearer along the line, and if it is far
    // enough away squarely too (a close wall grazed at a slant would put him at an angle to it, with no room).
    let near = Infinity;
    let nearBox: THREE.Box3 | null = null;
    for (const b of colliders) {
      // Skip boxes she stands inside (the floor slab, a room volume) and anything under knee height.
      if (b.containsPoint(origin) || b.max.y < at.y + 0.9) continue;
      if (!ray.intersectBox(b, hit)) continue;
      const d = hit.distanceTo(origin);
      if (d < near) {
        near = d;
        nearBox = b;
      }
    }
    if (!nearBox || near < min || near > max || nearBox.distanceToPoint(origin) < min * 0.8) continue;
    if (!best || near < best.d) best = { d: near, dir: ray.direction.clone() };
  }
  if (!best) return null;
  const toWall = best.dir;
  const him = at.clone().addScaledVector(toWall, best.d - back);
  const her = him.clone().addScaledVector(toWall, -gap);
  him.y = at.y;
  her.y = at.y;
  return { him, her, toWall };
}

/** How far she can see from `from` along `dir` (horizontal) before a box: the lens backs off walls by this. */
export function clearance(from: THREE.Vector3, dir: THREE.Vector3, colliders: readonly THREE.Box3[], cap = 10): number {
  const ray = new THREE.Ray(from, dir.clone().normalize());
  const hit = new THREE.Vector3();
  let near = cap;
  for (const b of colliders) {
    if (b.containsPoint(from) || !ray.intersectBox(b, hit)) continue;
    near = Math.min(near, hit.distanceTo(from));
  }
  return near;
}
