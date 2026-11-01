import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import { ENTRIES, type Entry } from "../games/cathode/src/game/encounters";

/**
 * Plan item 7: every scripted entrance is staged against the district's real geometry. A man lands on open floor;
 * a rope hangs from a real ceiling or the edge of a real roof with nothing in the way; a van has a clear road and
 * doesn't plough through a standing crowd; a breach blows a door out of a real gap between two jambs.
 */
const inside = (cols: THREE.Box3[], p: THREE.Vector3, pad = 0) => cols.some((c) => c.clone().expandByScalar(pad).containsPoint(p));

type Crowd = { x: number; z: number; radius: number; rect?: [number, number] };
/** Ground distance from a point to a crowd's disc or rectangle (0 inside). */
const crowdDist = (g: Crowd, x: number, z: number) => g.rect ? Math.hypot(Math.max(0, Math.abs(x - g.x) - g.rect[0] / 2), Math.max(0, Math.abs(z - g.z) - g.rect[1] / 2)) : Math.max(0, Math.hypot(x - g.x, z - g.z) - g.radius);

function check(id: string, name: string, e: Entry, cols: THREE.Box3[], crowds: Crowd[]): string[] {
  const bad: string[] = [];
  const at = (y: number) => new THREE.Vector3(e.to.x, e.to.y + y, e.to.z);
  if (inside(cols, at(1), 0.25)) bad.push("lands inside a collider");
  if (e.kind === "rappel") {
    for (let y = 0.4; y < e.from.y - e.to.y - 0.15; y += 0.25) if (inside(cols, at(y))) {
      bad.push(`rope blocked at ${(e.to.y + y).toFixed(1)} m`);
      break;
    }
    const a = e.from;
    // A ceiling right over the rope, or a roof whose top is at the anchor within 1.2 m of the rope.
    const ceiling = cols.some((c) => Math.abs(c.min.y - a.y) < 0.3 && a.x >= c.min.x && a.x <= c.max.x && a.z >= c.min.z && a.z <= c.max.z);
    const ledge = cols.some((c) => Math.abs(c.max.y - a.y) < 0.3 && c.clone().expandByVector(new THREE.Vector3(1.2, 0, 1.2)).containsPoint(new THREE.Vector3(a.x, c.max.y - 0.01, a.z)));
    if (!ceiling && !ledge) bad.push(`the rope's anchor at ${a.y} m hangs from nothing`);
  }
  if (e.kind === "van") {
    const from = e.from, stop = e.stop!;
    const dir = new THREE.Vector3().subVectors(stop, from).setY(0);
    const len = dir.length();
    dir.normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    for (let d = 0; d <= len; d += 0.5) {
      const c = from.clone().addScaledVector(dir, d);
      // The van is 2.1 m wide and 5.2 m long: probe its corners and centre line, 0.3 to 2.4 m up.
      for (const s of [-1.05, 0, 1.05]) for (const f of [-2.6, 0, 2.6]) for (const y of [0.4, 1.4, 2.3]) {
        const p = c.clone().addScaledVector(side, s).addScaledVector(dir, f).setY(stop.y + y);
        if (inside(cols, p)) {
          bad.push(`van hits a collider at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`);
          d = len + 1;
          break;
        }
      }
      for (const g of crowds) if (crowdDist(g, c.x, c.z) < 1.6) {
        bad.push(`van drives through the crowd at ${g.x},${g.z}`);
        d = len + 1;
        break;
      }
    }
  }
  if (e.kind === "breach") {
    const f = e.from;
    const dir = new THREE.Vector3().subVectors(e.to, f).setY(0).normalize();
    const along = new THREE.Vector3(dir.z, 0, -dir.x);
    if (inside(cols, new THREE.Vector3(f.x, f.y + 1, f.z))) bad.push("the door stands inside a wall");
    const half = (e.doorW ?? 1) / 2 + 0.35;
    const jambs = [1, -1].filter((s) => inside(cols, f.clone().addScaledVector(along, s * half).setY(f.y + 1), 0.2)).length;
    // Either a gap between two jambs, or a door set in a wall right behind it (the vault's lift).
    const backed = inside(cols, f.clone().addScaledVector(dir, -0.9).setY(f.y + 1));
    if (jambs < 2 && !backed) bad.push(`the door has ${jambs} jamb(s) and no wall behind it`);
  }
  return bad.map((b) => `${id}.${name}: ${b}`);
}

describe("NIGHT SHIFT scripted entrances (plan item 7)", () => {
  for (const [id, list] of Object.entries(ENTRIES)) {
    it(`${id}: at least two entrances, each staged on the real geometry`, () => {
      const lv = buildDistrict(id, "high");
      const cols = lv.builder.colliders;
      const crowds: Crowd[] = (lv as { crowds?: Crowd[] }).crowds ?? [];
      const entries = Object.entries(list) as [string, Entry][];
      expect(entries.length).toBeGreaterThanOrEqual(2);
      const bad = entries.flatMap(([n, e]) => check(id, n, e, cols, crowds));
      expect(bad).toEqual([]);
    });
  }
});
