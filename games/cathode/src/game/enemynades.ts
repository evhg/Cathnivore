// C16 (S3.5): Hollowell frag grenades. A rifleman who has lost sight of her while his squad still knows where she
// is lobs one at that spot: "Frag out!" on the 600 ms arm-back, the release, a visible arc (a fading warm trail
// behind it), a 2.8 s fuse with a red light blinking at 4 Hz, and the HUD's grenade glyph once it lands within 6 m.
// One draw for the body, one for the light, one for the trail per grenade; no real lights (a light count change
// would recompile every material in the street).
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LaserDot } from "./laserfx";

/** S3.5: the fuse from the release (s), the blink rate (Hz), the blast's reach (m) and its damage at the centre. */
export const NADE_FUSE = 2.8;
export const NADE_BLINK_HZ = 4;
export const NADE_RADIUS = 5;
export const NADE_DAMAGE = 70;
const TRAIL_N = 40;
const G = 9.81;

interface Nade {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  body: THREE.Mesh;
  light: LaserDot;
  trail: Line2;
  pts: THREE.Vector3[];
  rest: boolean;
  age: number;
  radius: number;
  damage: number;
}

let bodyGeo: THREE.BufferGeometry | null = null;
function nadeGeo(): THREE.BufferGeometry {
  // A fluted frag body with its fuse head and spoon, about 9 cm tall.
  if (bodyGeo) return bodyGeo;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    prof.push(new THREE.Vector2(Math.sin(a) * 0.03 + 0.002, -Math.cos(a) * 0.036));
  }
  prof.push(new THREE.Vector2(0.012, 0.038), new THREE.Vector2(0.012, 0.05), new THREE.Vector2(0, 0.05));
  bodyGeo = new THREE.LatheGeometry(prof, 12);
  return bodyGeo;
}

export class EnemyNades {
  private readonly list: Nade[] = [];
  private readonly mat = new THREE.MeshStandardMaterial({ color: 0x2c3326, roughness: 0.45, metalness: 0.55 });
  /** Blasts this frame, for the session to resolve against her and the street's men. */
  readonly blasts: Array<{ pos: THREE.Vector3; radius: number; damage: number }> = [];

  constructor(private readonly scene: THREE.Object3D) {}

  /** The lob: from his hand to `to`, a high arc whose flight time grows with the range. */
  throw(from: THREE.Vector3, to: THREE.Vector3, fuse = NADE_FUSE, blast: { radius: number; damage: number } = { radius: NADE_RADIUS, damage: NADE_DAMAGE }): void {
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const T = THREE.MathUtils.clamp(d / 10, 0.7, 1.6);
    const vel = new THREE.Vector3((to.x - from.x) / T, (to.y - from.y) / T + 0.5 * G * T, (to.z - from.z) / T);
    const body = new THREE.Mesh(nadeGeo(), this.mat);
    body.castShadow = true;
    const light = new LaserDot(0xff2010);
    const geo = new LineGeometry();
    const pts = Array.from({ length: TRAIL_N }, () => from.clone());
    geo.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
    geo.setColors(pts.flatMap((_, i) => { const k = (i / (TRAIL_N - 1)) ** 1.4 * 0.9; return [k, k * 0.55, k * 0.32]; }));
    const lm = new LineMaterial({ linewidth: 3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false });
    const trail = new Line2(geo, lm);
    trail.frustumCulled = false;
    trail.onBeforeRender = (r) => {
      r.getDrawingBufferSize(lm.resolution);
    };
    this.scene.add(body, light, trail);
    this.list.push({ pos: from.clone(), vel, fuse, body, light, trail, pts, rest: false, age: 0, radius: blast.radius, damage: blast.damage });
    this.place(this.list[this.list.length - 1]!, 0);
  }

  /** Flight, bounces, the blinking light and the bang. `held` freezes the clock (a screenshot stage). */
  update(dt: number, ground: (x: number, z: number) => number, colliders: readonly THREE.Box3[], onBang: (at: THREE.Vector3) => void): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i]!;
      this.step(n, dt, ground, colliders);
      n.fuse -= dt;
      this.place(n, dt);
      if (n.fuse <= 0) {
        this.blasts.push({ pos: n.pos.clone().setY(n.pos.y + 0.15), radius: n.radius, damage: n.damage });
        onBang(n.pos.clone());
        this.drop(n);
        this.list.splice(i, 1);
      }
    }
  }

  /** Runs one grenade's flight forward by `t` seconds without the fuse (stages: a held moment of the arc). */
  advance(t: number, ground: (x: number, z: number) => number, colliders: readonly THREE.Box3[]): void {
    for (const n of this.list) {
      for (let s = 0; s < t; s += 1 / 60) {
        this.step(n, Math.min(1 / 60, t - s), ground, colliders);
        n.fuse -= Math.min(1 / 60, t - s);
        this.place(n, 1 / 60);
      }
    }
  }

  private step(n: Nade, dt: number, ground: (x: number, z: number) => number, colliders: readonly THREE.Box3[]): void {
    if (n.rest) return;
    n.age += dt;
    n.vel.y -= G * dt;
    const next = n.pos.clone().addScaledVector(n.vel, dt);
    const floor = ground(next.x, next.z) + 0.04;
    let wall = false;
    // Clear of his own cover first: a hand at the release can sit just inside its box.
    if (n.age > 0.15) for (const c of colliders) if (c.containsPoint(next)) wall = true;
    if (wall) {
      n.vel.x *= -0.3;
      n.vel.z *= -0.3;
      n.vel.y *= 0.5;
    } else n.pos.copy(next);
    if (n.pos.y <= floor) {
      n.pos.y = floor;
      // It skitters: a low bounce that loses most of its speed, then rolls to a stop.
      n.vel.y = Math.abs(n.vel.y) * 0.25;
      n.vel.x *= 0.45;
      n.vel.z *= 0.45;
      if (n.vel.lengthSq() < 0.15) {
        n.vel.set(0, 0, 0);
        n.rest = true;
      }
    }
  }

  private place(n: Nade, dt: number): void {
    n.body.position.copy(n.pos);
    n.body.rotation.x += dt * (n.rest ? 0 : 11);
    n.body.rotation.z += dt * (n.rest ? 0 : 7);
    // The fuse light on the head: on for half of every 250 ms.
    const on = ((NADE_FUSE - n.fuse) * NADE_BLINK_HZ) % 1 < 0.5;
    n.light.visible = on;
    n.light.place(n.pos.clone().setY(n.pos.y + 0.05), 0.08, 1, 5);
    // The trail: the newest point is the grenade; once it rests the trail drains away.
    n.pts.pop();
    n.pts.unshift(n.pos.clone());
    if (n.rest) for (let i = 1; i < n.pts.length; i++) n.pts[i]!.lerp(n.pts[i - 1]!, Math.min(1, dt * 8));
    const g = n.trail.geometry as LineGeometry;
    g.setPositions(n.pts.slice().reverse().flatMap((p) => [p.x, p.y, p.z]));
  }

  private drop(n: Nade): void {
    n.body.removeFromParent();
    n.light.removeFromParent();
    n.trail.removeFromParent();
    n.trail.geometry.dispose();
    (n.trail.material as LineMaterial).dispose();
  }

  private readonly held = new Map<object, THREE.Mesh>();
  /** The grenade in his hand through the arm-back (`at` his hand, or null once it's gone or he isn't throwing). */
  hold(key: object, at: THREE.Vector3 | null): void {
    let m = this.held.get(key);
    if (!at) {
      if (m) m.visible = false;
      return;
    }
    if (!m) {
      m = new THREE.Mesh(nadeGeo(), this.mat);
      this.held.set(key, m);
      this.scene.add(m);
    }
    m.visible = true;
    m.position.copy(at);
  }

  /** Live grenades and the share of the fuse left (the HUD ring shows any within 6 m of her). */
  live(): Array<{ pos: THREE.Vector3; left: number }> {
    return this.list.map((n) => ({ pos: n.pos, left: Math.max(0, n.fuse / NADE_FUSE) }));
  }

  clear(): void {
    for (const n of this.list) this.drop(n);
    for (const m of this.held.values()) m.visible = false;
    this.list.length = 0;
    this.blasts.length = 0;
  }
}
