// The kill-cams (docs/design/cathode-combat.md S5.3; the rules are sim/killcam.ts).
//   Bullet follow (a ballistic round predict() saw kill): time 0.1, the camera 0.5 m behind the round at FOV 50,
//   orbiting it at 8 deg/s; the round a 0.6 m #FFE0B0 streak with a heat shimmer. No steering: the round flies as
//   fired, and a round that misses after all cuts straight back. Impact: time 0.05 for 200 ms with the x-ray (desktop,
//   full violence), then an orbit of the body at 0.3 to 1000 ms, a ramp to 1 over 250 ms and a 120 ms whip-pan.
//   Last-man orbit (everything else): time 0.25, the camera 3.5 m out at 1.4 m, 35 deg off her line, FOV 45, 2.39:1
//   bars in over 150 ms, orbiting at 20 deg/s for 900 ms while he falls, then a 250 ms ramp, bars out and the cut.
// Any input skips after 300 ms (the session asks `canSkip`). The camera's FOV is handed back on the way out.

import * as THREE from "three";
import type { World } from "../render/types";
import type { Enemy } from "./enemy";
import { place } from "./body";
import { KILLCAM, bulletDone, bulletScale, canSkip, orbitBars, orbitDone, orbitScale, whipAt, type KillCamShot } from "../sim/killcam";

const XRAY_BLUE = new THREE.Color("#9fd8ff");

/** Bone: a bright, slightly blue-white emissive, so it holds its colour through the kill-cam's grade. */
const boneMat = new THREE.MeshStandardMaterial({ color: 0xd8eeff, emissive: 0x5ab8ff, emissiveIntensity: 1.6, roughness: 0.45, metalness: 0 });
const socketMat = new THREE.MeshBasicMaterial({ color: 0x020408 });
const chipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff2ff, emissiveIntensity: 2.2, roughness: 0.3 });

/** The x-ray shell: the body as a translucent #9FD8FF fresnel (bright at the silhouette, thin across the middle). */
function shellMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, depthWrite: false, side: THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uXray = { value: XRAY_BLUE };
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform vec3 uXray;\nvoid main() {").replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
      float fr = pow( 1.0 - abs( dot( normalize( normal ), normalize( vViewPosition ) ) ), 2.2 );
      gl_FragColor = vec4( uXray * ( 0.35 + 2.4 * fr ), 0.25 * ( 0.35 + 1.65 * fr ) );`,
    );
  };
  m.customProgramCacheKey = () => "cathode-xray-shell";
  return m;
}
const shellMat = shellMaterial();

/**
 * A trail along -Z from the origin (the round's nose) to -len: a cone from `r0` to `r1`, its vertex alpha 1 at the
 * nose to 0 at the tail.
 */
function taperedTrail(r0: number, r1: number, len: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, len, 8, 6, true);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -len / 2);
  const pos = g.attributes.position!;
  const col = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, -pos.getZ(i) / len));
    const a = Math.pow(1 - u, 2.6);
    col.set([1, 1, 1, a], i * 4);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 4));
  return g;
}

let dotTex: THREE.Texture | null = null;
/** A soft round dot (the heat shimmer round the round). */
function softDot(): THREE.Texture {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.4, "rgba(255,255,255,0.35)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

/** A skull from a lathe (cranium, brow, cheek, jaw line), sockets, a nasal hole and a hinged jaw. */
function skullGeometry(): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const prof: Array<[number, number]> = [
    [0.0, 0.0],
    [0.045, 0.004],
    [0.06, 0.03],
    [0.066, 0.06],
    [0.078, 0.09],
    [0.088, 0.13],
    [0.09, 0.165],
    [0.082, 0.2],
    [0.062, 0.228],
    [0.032, 0.243],
    [0.0, 0.248],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 20);
}

/** The skeleton, hung on the body's joints: capsule long bones, a lathe skull and pelvis, a ribcage of arcs. */
class Skeleton {
  readonly root = new THREE.Group();
  private parts: Array<{ o: THREE.Object3D; a: string; b: string; stretch: boolean }> = [];
  readonly skull = new THREE.Group();
  readonly ribs = new THREE.Group();

  constructor() {
    const limb = (a: string, b: string, r: number) => {
      const g = new THREE.Group();
      // A unit capsule along +Y, knuckled at both ends (the epiphyses read as joints, not tubes).
      const shaft = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1 - 2 * r, 3, 8), boneMat);
      shaft.position.y = 0.5;
      g.add(shaft);
      for (const y of [0.04, 0.96]) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(r * 1.55, 10, 8), boneMat);
        k.position.y = y;
        k.scale.set(1, 0.7, 1);
        g.add(k);
      }
      this.root.add(g);
      this.parts.push({ o: g, a, b, stretch: true });
    };
    limb("pelvis", "neck", 0.016);
    for (const s of ["L", "R"]) {
      limb(`shoulder${s}`, `elbow${s}`, 0.018);
      limb(`elbow${s}`, `hand${s}`, 0.014);
      limb(`hip${s}`, `knee${s}`, 0.024);
      limb(`knee${s}`, `foot${s}`, 0.02);
    }
    // Clavicles: shoulder to shoulder through the neck's base.
    limb("shoulderL", "shoulderR", 0.011);
    // Ribs: seven pairs of tapering arcs off the spine, the sternum down the front.
    for (let i = 0; i < 7; i++) {
      const w = 0.125 - Math.abs(i - 2.5) * 0.009;
      const t = new THREE.Mesh(new THREE.TorusGeometry(w, 0.0065, 5, 22, Math.PI * 1.7), boneMat);
      t.rotation.set(Math.PI / 2 + 0.18, 0, Math.PI * 0.15 + Math.PI);
      t.scale.set(1, 0.72, 1);
      t.position.set(0, 0.04 + i * 0.04, -0.015);
      this.ribs.add(t);
    }
    const sternum = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.17, 2, 6), boneMat);
    sternum.position.set(0, 0.17, 0.085);
    this.ribs.add(sternum);
    this.root.add(this.ribs);
    this.parts.push({ o: this.ribs, a: "chest", b: "neck", stretch: false });
    // The pelvis: a lathed bowl.
    const bowl = new THREE.Mesh(
      new THREE.LatheGeometry([new THREE.Vector2(0.05, -0.06), new THREE.Vector2(0.12, -0.02), new THREE.Vector2(0.14, 0.06), new THREE.Vector2(0.11, 0.1)], 16),
      boneMat,
    );
    bowl.scale.set(1, 1, 0.7);
    const pg = new THREE.Group();
    pg.add(bowl);
    this.root.add(pg);
    this.parts.push({ o: pg, a: "pelvis", b: "chest", stretch: false });
    // The skull.
    const cran = new THREE.Mesh(skullGeometry(), boneMat);
    cran.scale.set(0.95, 1, 1.12);
    cran.position.y = 0.02;
    this.skull.add(cran);
    for (const x of [-0.034, 0.034]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), socketMat);
      e.position.set(x, 0.135, 0.083);
      e.scale.set(1, 0.85, 0.6);
      this.skull.add(e);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 3), socketMat);
    nose.position.set(0, 0.1, 0.095);
    nose.rotation.x = Math.PI;
    this.skull.add(nose);
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.011, 5, 14, Math.PI), boneMat);
    jaw.rotation.set(Math.PI / 2 + 0.35, 0, Math.PI);
    jaw.position.set(0, 0.045, 0.03);
    jaw.name = "jaw";
    this.skull.add(jaw);
    this.root.add(this.skull);
    this.parts.push({ o: this.skull, a: "neck", b: "head", stretch: false });
  }

  pose(e: Enemy): void {
    const j = e.body.joints as Record<string, THREE.Vector3>;
    for (const p of this.parts) {
      const a = j[p.a];
      const b = j[p.b];
      if (!a || !b) continue;
      place(p.o, a, b, e.body.facing);
      if (p.stretch) p.o.scale.set(1, Math.max(0.02, a.distanceTo(b)), 1);
    }
    this.skull.visible = !e.body.lost.has("head");
  }
}

interface Chip {
  m: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
}

export interface KillCamOptions {
  /** The x-ray at the impact: desktop with full violence only (S5.3). */
  xray: boolean;
  /** Where a camera ray first meets the world from `from` along `dir` within `len` (null: clear). */
  cast?: (from: THREE.Vector3, dir: THREE.Vector3, len: number) => number | null;
  /** The crack's sound, on the impact frame. */
  onCrack?: () => void;
}

/** What the kill-cam needs of a round in flight. */
export interface FollowedRound {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
}

export class KillCam {
  active = false;
  shot: KillCamShot | null = null;
  /** Real ms since it began, and since the round struck (bullet follow; -1 in flight). */
  ms = 0;
  sinceImpact = -1;
  /** Metres from the muzzle to the target when the shot started (for the caption). */
  distance = 0;
  /** The 2.39:1 bars, 0..1, and the whip-pan smear, 0..1. */
  bars = 0;
  whip = 0;
  /** The x-ray shell is on. */
  xrayOn = false;
  private round: FollowedRound | null = null;
  private target: Enemy | null = null;
  private joint: "head" | "chest" = "chest";
  private dir = new THREE.Vector3();
  private side = new THREE.Vector3();
  private sign = 1;
  private readonly streak: THREE.Group;
  private skel: Skeleton | null = null;
  private saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private chips: Chip[] = [];
  private lookAt = new THREE.Vector3();
  private fov0 = 0;
  private from = new THREE.Vector3();
  private missed = false;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly world: World,
    private readonly opts: KillCamOptions = { xray: false },
  ) {
    // The round: a 0.6 m streak (a hot core and a softer glow) and a heat shimmer behind it.
    this.streak = new THREE.Group();
    const S = KILLCAM.bullet.streak;
    // The streak fades to nothing along its tail (vertex alpha), so with the camera riding half a metre behind the
    // round it reads as a hot trace ahead of the lens, not a bar through it.
    const core = new THREE.Mesh(taperedTrail(0.0028, 0.0006, S.length), new THREE.MeshBasicMaterial({ color: S.color, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glow = new THREE.Mesh(taperedTrail(0.011, 0.002, S.length * 0.8), new THREE.MeshBasicMaterial({ color: 0xffb070, vertexColors: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const slug = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.018, 3, 8), new THREE.MeshStandardMaterial({ color: 0xb08d3c, metalness: 1, roughness: 0.25, emissive: 0x3a2200 }));
    slug.rotation.x = Math.PI / 2;
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffe0b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    haze.scale.set(0.05, 0.05, 1);
    this.streak.add(core, glow, slug, haze);
    this.streak.visible = false;
    this.streak.name = "killcam:round";
    world.scene.add(this.streak);
  }

  /** Rides a ballistic round onto `target` (whose `joint` predict() saw it strike). */
  startBullet(round: FollowedRound, target: Enemy, joint: "head" | "chest"): void {
    this.begin("bullet", target);
    this.round = round;
    this.joint = joint;
    this.dir.copy(round.vel).normalize();
    this.distance = round.pos.distanceTo(target.body.joints.chest);
    this.streak.visible = true;
    this.world.setDrama(0.4);
  }

  /** The last-man orbit round the man just killed, from `eye` (where she is). */
  startOrbit(target: Enemy, eye: THREE.Vector3): void {
    this.begin("orbit", target);
    this.from.copy(eye);
    this.distance = eye.distanceTo(target.body.joints.chest);
    this.dir.copy(target.body.joints.chest).sub(eye).setY(0).normalize();
    this.world.setDrama(0.45);
  }

  private begin(shot: KillCamShot, target: Enemy): void {
    if (this.active) this.finish();
    this.active = true;
    this.shot = shot;
    this.target = target;
    this.ms = 0;
    this.sinceImpact = -1;
    this.bars = 0;
    this.whip = 0;
    this.missed = false;
    this.sign = Math.random() < 0.5 ? -1 : 1;
    this.fov0 = this.world.camera.fov;
  }

  /** Game time passes at this rate while the kill-cam runs. */
  get timeScale(): number {
    if (!this.active) return 1;
    if (this.shot === "orbit") return orbitScale(this.ms);
    if (this.missed) return 1;
    return bulletScale(this.sinceImpact < 0 ? null : this.sinceImpact);
  }

  /** Any input skips after 300 ms. */
  get skippable(): boolean {
    return this.active && canSkip(this.ms);
  }

  skip(): boolean {
    if (!this.skippable) return false;
    this.finish();
    return true;
  }

  /** Moves the world camera for the shot. Real (unscaled) dt. */
  update(realDt: number): void {
    if (!this.active || !this.target) return;
    this.ms += realDt * 1000;
    if (this.shot === "orbit") this.updateOrbit(realDt);
    else this.updateBullet(realDt);
    this.updateChips(realDt * this.timeScale);
    if (this.skel && this.target) this.skel.pose(this.target);
  }

  private updateOrbit(realDt: number): void {
    const O = KILLCAM.orbit;
    const cam = this.world.camera;
    const tgt = this.target!;
    const j = tgt.body.joints;
    const centre = this.tmp.copy(j.chest).lerp(j.pelvis, 0.4);
    const a = this.sign * ((O.offDeg * Math.PI) / 180 + ((O.degS * Math.PI) / 180) * (this.ms / 1000));
    const back = this.dir.clone().negate().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    let r: number = O.radius;
    const ground = Math.min(j.footL.y, j.footR.y);
    const want = new THREE.Vector3(centre.x, ground + O.height, centre.z).addScaledVector(back, r);
    // Never inside a wall: pull in to clear it.
    if (this.opts.cast) {
      const d = want.clone().sub(centre);
      const len = d.length();
      const hit = this.opts.cast(centre, d.divideScalar(len), len);
      if (hit !== null) {
        r = Math.max(1.2, hit - 0.3);
        want.set(centre.x, ground + O.height, centre.z).addScaledVector(back, r);
      }
    }
    if (this.ms <= realDt * 1000 + 1) {
      cam.position.copy(want);
      this.lookAt.copy(centre);
    } else {
      cam.position.lerp(want, 1 - Math.exp(-realDt * 10));
      this.lookAt.lerp(centre, 1 - Math.exp(-realDt * 8));
    }
    cam.lookAt(this.lookAt);
    this.setFov(O.fov);
    this.bars = orbitBars(this.ms);
    if (orbitDone(this.ms)) this.finish();
  }

  private updateBullet(realDt: number): void {
    const B = KILLCAM.bullet;
    const cam = this.world.camera;
    const tgt = this.target!;
    const p = this.round!;
    const aimPt = this.joint === "head" ? tgt.body.joints.head : tgt.body.joints.chest;
    if (this.sinceImpact < 0 && !p.alive) {
      // Struck: him (the cam's shot), or something else after all (a miss cuts straight back).
      if (tgt.alive) {
        this.missed = true;
        this.finish();
        return;
      }
      this.sinceImpact = 0;
      if (this.opts.xray) this.xray(true);
      this.crack(p.pos.clone().lerp(aimPt, 0.5));
      this.opts.onCrack?.();
      this.world.setDrama(0.45);
    } else if (this.sinceImpact >= 0) this.sinceImpact += realDt * 1000;
    if (this.sinceImpact < 0 && this.ms > B.flightCapMs) {
      // Too long a flight for cinema: cut back and let it land on its own.
      this.missed = true;
      this.finish();
      return;
    }
    this.side.crossVectors(this.dir, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(this.sign);
    this.streak.visible = p.alive;
    if (p.alive) {
      this.dir.copy(p.vel).normalize();
      this.streak.position.copy(p.pos);
      this.streak.lookAt(this.tmp.copy(p.pos).add(this.dir));
      // 0.5 m behind the round, a little off its axis, turning round it at 8 deg/s.
      const spin = (this.sign * ((B.orbitDegS * Math.PI) / 180) * this.ms) / 1000 + 0.6;
      const up = new THREE.Vector3().crossVectors(this.side, this.dir).normalize();
      // Just above the line of flight and a hair off it: the trail runs away from the lens, the round sits a little
      // under the centre and the target grows ahead of it.
      const off = this.side.clone().multiplyScalar(Math.cos(spin) * 0.035).addScaledVector(up, 0.06 + Math.sin(spin) * 0.02);
      cam.position.copy(p.pos).addScaledVector(this.dir, -B.back).add(off);
      this.lookAt.copy(p.pos).addScaledVector(this.dir, 9);
      this.setFov(B.fov);
    } else {
      // The body: swung round to his side as the round arrives, then a slow orbit as he goes down.
      const t = this.sinceImpact;
      const centre = this.tmp.copy(aimPt).lerp(tgt.body.joints.pelvis, Math.min(1, t / 900) * 0.5);
      const a = this.sign * (0.25 + (t / 1000) * 0.7);
      const off = this.side.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(1.5 + t / 1200);
      const want = centre.clone().add(off).addScaledVector(this.dir, -0.5).add(new THREE.Vector3(0, 0.25, 0));
      cam.position.lerp(want, 1 - Math.exp(-realDt * (t < B.impactMs ? 9 : 4)));
      this.lookAt.lerp(centre, 1 - Math.exp(-realDt * 10));
      this.setFov(THREE.MathUtils.lerp(B.fov, 55, Math.min(1, t / 600)));
      if (this.xrayOn && t > B.xrayMs) this.xray(false);
      this.whip = whipAt(t);
      if (bulletDone(t)) {
        this.finish();
        return;
      }
    }
    cam.lookAt(this.lookAt);
  }

  private setFov(f: number): void {
    const cam = this.world.camera;
    if (Math.abs(cam.fov - f) > 1e-3) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }

  /** The struck bone cracks and sheds 6 to 10 white chips. */
  private crack(at: THREE.Vector3): void {
    if (!this.xrayOn || !this.skel) return;
    const n = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const g = new THREE.TetrahedronGeometry(0.008 + Math.random() * 0.01);
      const m = new THREE.Mesh(g, chipMat);
      m.position.copy(at);
      const v = this.dir.clone().multiplyScalar(1.4 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 2.2, Math.random() * 1.8, (Math.random() - 0.5) * 2.2));
      this.world.scene.add(m);
      this.chips.push({ m, v, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20) });
    }
    // The bone itself: the skull's plates (or the ribs) jolt apart along the shot.
    const part = this.joint === "head" ? this.skel.skull : this.skel.ribs;
    for (const c of part.children) {
      if (c.name === "jaw") c.rotation.x += 0.35;
      else c.position.addScaledVector(c.position.clone().normalize(), 0.012).add(new THREE.Vector3((Math.random() - 0.5) * 0.01, 0, (Math.random() - 0.5) * 0.01));
    }
  }

  private updateChips(dt: number): void {
    for (const c of this.chips) {
      c.v.y -= 9.8 * dt;
      c.m.position.addScaledVector(c.v, dt);
      c.m.rotation.x += c.spin.x * dt;
      c.m.rotation.y += c.spin.y * dt;
    }
  }

  private xray(on: boolean): void {
    const tgt = this.target;
    if (!tgt) return;
    if (on && !this.skel) {
      this.skel = new Skeleton();
      this.skel.root.name = "killcam:skeleton";
      this.world.scene.add(this.skel.root);
      tgt.body.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.visible && m.name.startsWith("body:lod")) {
          this.saved.set(m, m.material);
          m.material = shellMat;
        } else if (m.isMesh && m.visible && m.name !== "outline") {
          // Gear and the cloth go too: only the shell and the bones.
          this.saved.set(m, m.material);
          m.visible = false;
        }
      });
      tgt.rifle.visible = false;
      this.skel.pose(tgt);
      this.xrayOn = true;
    } else if (!on && this.skel) {
      for (const [m, mat] of this.saved) {
        if (m.material === shellMat) m.material = mat;
        else m.visible = true;
      }
      this.saved.clear();
      this.skel.root.removeFromParent();
      this.skel = null;
      this.xrayOn = false;
      for (const c of this.chips) c.m.removeFromParent();
      this.chips = [];
    }
  }

  /** Screenshot stages: holds the x-ray on (or off) as it would be `msAfterImpact` in. */
  stageXray(on: boolean): void {
    this.xray(on);
    if (on) this.crack(this.target!.body.joints[this.joint === "head" ? "head" : "chest"].clone());
  }

  finish(): void {
    this.xray(false);
    this.active = false;
    this.round = null;
    this.target = null;
    this.shot = null;
    this.bars = 0;
    this.whip = 0;
    this.streak.visible = false;
    if (this.fov0 > 0) this.setFov(this.fov0);
    this.world.setDrama(0);
  }
}
