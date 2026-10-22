// The kill-cams (docs/design/cathode-combat.md S5.3; the rules are sim/killcam.ts).
//   Bullet follow (a ballistic round predict() saw kill): time 0.1, the camera 0.5 m behind the round at FOV 50,
//   orbiting it at 8 deg/s; the round a 0.6 m #FFE0B0 streak with a heat shimmer. No steering: the round flies as
//   fired, and a round that misses after all cuts straight back. Impact: time 0.05 for 200 ms with the x-ray (desktop,
//   full violence), then an orbit of the body at 0.3 to 1000 ms, a ramp to 1 over 250 ms and a 120 ms whip-pan.
//   Last-man orbit (everything else): time 0.25, the camera 3.5 m out at 1.4 m, 35 deg off her line, FOV 45, 2.39:1
//   bars in over 150 ms, orbiting at 20 deg/s for 900 ms while he falls, then a 250 ms ramp, bars out and the cut.
// Any input skips after 300 ms (the session asks `canSkip`). The camera's FOV is handed back on the way out.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { World } from "../render/types";
import type { Enemy } from "./enemy";
import { place } from "./body";
import { KILLCAM, bulletDone, bulletScale, canSkip, orbitBars, orbitDone, orbitScale, whipAt, type KillCamShot } from "../sim/killcam";

const UP = new THREE.Vector3(0, 1, 0);

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

/**
 * The face of the skull, in one merged geometry (one draw): the brow ridge, the cheekbones (zygomatic arches), the
 * maxilla and a row of teeth. In the skull's frame: Y up the neck, +Z where he faces.
 */
function skullFaceGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const brow = new THREE.TorusGeometry(0.066, 0.011, 6, 18, Math.PI * 0.82);
  brow.rotateX(Math.PI / 2);
  brow.rotateY(Math.PI * 0.59);
  brow.scale(1, 1, 0.75);
  brow.translate(0, 0.162, 0.03);
  parts.push(brow);
  for (const x of [-1, 1]) {
    const arch = new THREE.CapsuleGeometry(0.009, 0.05, 2, 6);
    arch.rotateZ(Math.PI / 2);
    arch.rotateY(x * 0.55);
    arch.translate(x * 0.064, 0.112, 0.052);
    parts.push(arch);
    const cheek = new THREE.SphereGeometry(0.019, 8, 6);
    cheek.scale(1, 0.8, 0.7);
    cheek.translate(x * 0.045, 0.103, 0.082);
    parts.push(cheek);
  }
  const maxilla = new THREE.BoxGeometry(0.066, 0.03, 0.04);
  maxilla.translate(0, 0.078, 0.078);
  parts.push(maxilla);
  for (let i = 0; i < 10; i++) {
    const a = ((i - 4.5) / 4.5) * 0.95;
    const t = new THREE.BoxGeometry(0.0085, 0.015, 0.008);
    t.rotateY(a);
    t.translate(Math.sin(a) * 0.04, 0.058, 0.062 + Math.cos(a) * 0.034);
    parts.push(t);
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
  g.computeVertexNormals();
  return g;
}

/** The fracture: a jagged line of dark slivers across the cranium's front, turned to face the round on impact. */
function crackGeometry(): THREE.BufferGeometry {
  const pts: Array<[number, number]> = [[-0.02, 0.215], [0.004, 0.198], [-0.006, 0.182], [0.016, 0.168], [0.01, 0.15]];
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const b = new THREE.BoxGeometry(0.0035, len + 0.003, 0.006);
    b.rotateZ(-Math.atan2(x1 - x0, y1 - y0));
    // On the cranium's surface (radius about 0.088, scaled 1.12 deep).
    b.translate((x0 + x1) / 2, (y0 + y1) / 2, 0.094);
    parts.push(b);
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!;
}

/** The skeleton, hung on the body's joints: capsule long bones, a lathe skull and pelvis, a ribcage of arcs. */
class Skeleton {
  readonly root = new THREE.Group();
  private parts: Array<{ o: THREE.Object3D; a: string; b: string; stretch: boolean }> = [];
  readonly skull = new THREE.Group();
  readonly ribs = new THREE.Group();
  /** The fracture line on the struck side (hidden until the round lands). */
  readonly crack = new THREE.Mesh(crackGeometry(), socketMat);

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
    const face = new THREE.Mesh(skullFaceGeometry(), boneMat);
    face.name = "face";
    this.skull.add(face);
    this.crack.name = "crack";
    this.crack.visible = false;
    this.skull.add(this.crack);
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
  /** A bullet follow whose round missed after all (the cooldown it took is handed back). */
  onMiss?: () => void;
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
  /** Metres from her to the target at the trigger pull (for the caption). */
  distance = 0;
  /**
   * Set by the caller before a start: the lower third's label (by trigger: "Long shot", "Last man · Headshot",
   * "Multi-kill"; null shows none) and the range predict() measured at the trigger pull (0: measure it here).
   */
  caption: string | null = null;
  shotDistance = 0;
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
  /** The orbit's home direction from him: his face, turned 35 degrees toward her side (never his back). */
  private readonly home = new THREE.Vector3();
  /** The round's distance to the target when the follow began (the FOV push runs on how much of it is left). */
  private flight0 = 1;
  // Scratch (the cam runs every frame: no allocation).
  private readonly tmp = new THREE.Vector3();
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  // The kill-cam's own lighting: a warm key from the camera's side and a cool rim behind him, through the world's
  // light pool (no new light in the scene, so no shader recompile), so the Enforcer's materials read instead of a
  // grey figure in the noir grade.
  private readonly key = { pos: new THREE.Vector3(), color: new THREE.Color(1.0, 0.78, 0.6), intensity: 0, range: 6 };
  private readonly rim = { pos: new THREE.Vector3(), color: new THREE.Color(0.35, 0.8, 1.0), intensity: 0, range: 6 };
  private lightsOff: Array<() => void> = [];

  constructor(
    private readonly world: World,
    private readonly opts: KillCamOptions = { xray: false },
  ) {
    // The round: a hot streak (a core and a softer glow) behind a brass slug, and a heat shimmer round it. The
    // slug is drawn half again as big as life: from half a metre behind, the real 9 mm is a speck.
    this.streak = new THREE.Group();
    const S = KILLCAM.bullet.streak;
    // The streak fades to nothing along its tail (vertex alpha) and ends short of the lens (the camera rides
    // 0.5 m behind the round), so it reads as a hot trace ahead of the camera, never a bar through the frame.
    const len = Math.min(S.length, KILLCAM.bullet.back * 0.7);
    const core = new THREE.Mesh(taperedTrail(0.0042, 0.0008, len), new THREE.MeshBasicMaterial({ color: S.color, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const glow = new THREE.Mesh(taperedTrail(0.016, 0.003, len * 0.8), new THREE.MeshBasicMaterial({ color: 0xffb070, vertexColors: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const slug = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.018, 4, 10), new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.22, emissive: 0x5a3200, emissiveIntensity: 1.4 }));
    slug.rotation.x = Math.PI / 2;
    slug.scale.setScalar(1.5);
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffe0b0, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
    haze.scale.set(0.07, 0.07, 1);
    this.streak.add(core, glow, slug, haze);
    this.streak.visible = false;
    this.streak.name = "killcam:round";
    world.scene.add(this.streak);
  }

  /** Rides a ballistic round onto `target` (whose `joint` predict() saw it strike). */
  startBullet(round: FollowedRound, target: Enemy, joint: "head" | "chest"): void {
    const dist = this.shotDistance;
    this.begin("bullet", target);
    this.round = round;
    this.joint = joint;
    this.dir.copy(round.vel).normalize();
    const aim = joint === "head" ? target.body.joints.head : target.body.joints.chest;
    this.flight0 = Math.max(0.5, round.pos.distanceTo(aim));
    this.distance = dist > 0 ? dist : this.flight0;
    this.streak.visible = true;
    this.world.setDrama(0.4);
  }

  /** The last-man orbit round the man just killed, from `eye` (where she is). */
  startOrbit(target: Enemy, eye: THREE.Vector3): void {
    const dist = this.shotDistance;
    this.begin("orbit", target);
    this.from.copy(eye);
    this.distance = dist > 0 ? dist : eye.distanceTo(target.body.joints.chest);
    // The camera swings off her line toward the side she hit (the side of him that faced her), in front of him.
    this.dir.copy(target.body.joints.chest).sub(eye).setY(0).normalize();
    this.aim(target);
    this.world.setDrama(0.45);
  }

  /**
   * Where the camera orbits from: in front of his face, turned 35 degrees toward her (the side she struck), and
   * which way the orbit then turns (on round toward her line). `dir` is her line onto him, flat.
   */
  private aim(target: Enemy): void {
    // His chest's real front, from the shoulders (a falling man spins: his animated yaw no longer says where his
    // face is). The body faces +Z with his left shoulder at +X, so front = up x (right - left).
    const j = target.body.joints;
    const face = this.v1.subVectors(j.shoulderR, j.shoulderL);
    face.crossVectors(UP, face).setY(0);
    if (face.lengthSq() < 0.01 * 0.01) face.copy(target.body.facing).setY(0);
    if (face.lengthSq() < 1e-6) face.copy(this.dir).negate();
    face.normalize();
    // Toward her: the turn that takes his face toward the line back to her.
    const toHer = this.v2.copy(this.dir).negate();
    this.sign = this.v3.crossVectors(face, toHer).y >= 0 ? 1 : -1;
    const between = Math.acos(THREE.MathUtils.clamp(face.dot(toHer), -1, 1));
    const off = Math.min(between, (KILLCAM.orbit.offDeg * Math.PI) / 180);
    this.home.copy(face).applyAxisAngle(UP, this.sign * off);
  }

  private begin(shot: KillCamShot, target: Enemy): void {
    const caption = this.caption;
    if (this.active) this.finish();
    this.caption = caption;
    this.shotDistance = 0;
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
    if (this.world.liveLight && !this.lightsOff.length) this.lightsOff.push(this.world.liveLight(this.key), this.world.liveLight(this.rim));
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
    if (!this.active) return;
    this.updateChips(realDt * this.timeScale);
    if (this.skel && this.target) this.skel.pose(this.target);
    this.light();
  }

  /** The key from the camera's side and above, the rim from behind him; the focus on his head. */
  private light(): void {
    const tgt = this.target;
    if (!tgt) return;
    const cam = this.world.camera;
    const head = tgt.body.joints.head;
    const toCam = this.v1.copy(cam.position).sub(head).setY(0);
    if (toCam.lengthSq() < 1e-6) toCam.set(0, 0, 1);
    toCam.normalize();
    const across = this.v2.crossVectors(toCam, UP).multiplyScalar(this.sign);
    const k = this.shot === "bullet" && this.sinceImpact < 0 ? 0.6 : 1;
    this.key.pos.copy(head).addScaledVector(toCam, 1.3).addScaledVector(across, 0.9).add(this.v3.set(0, 0.7, 0));
    this.key.intensity = 11 * k;
    this.rim.pos.copy(head).addScaledVector(toCam, -1.4).addScaledVector(across, -0.6).add(this.v3.set(0, 0.5, 0));
    this.rim.intensity = 16 * k;
    // The depth of field's focal point: his head, wherever it is on screen (the blur grows away from it).
    const p = this.v3.copy(head).project(cam);
    this.world.setFocus?.(THREE.MathUtils.clamp(p.x * 0.5 + 0.5, 0, 1), THREE.MathUtils.clamp(p.y * 0.5 + 0.5, 0, 1));
  }

  private updateOrbit(realDt: number): void {
    const O = KILLCAM.orbit;
    const cam = this.world.camera;
    const tgt = this.target!;
    const j = tgt.body.joints;
    // Head to hips in frame, the head in the upper third: look a little above the middle of the two.
    const centre = this.tmp.copy(j.pelvis).lerp(j.head, 0.56);
    const span = Math.max(0.5, j.head.distanceTo(j.pelvis));
    // The distance that makes head-to-hips about 55% of the frame's height at this FOV.
    const fit = THREE.MathUtils.clamp(span / (0.55 * 2 * Math.tan(THREE.MathUtils.degToRad(O.fov) / 2)), 1.5, O.radius);
    const a = this.sign * ((O.degS * Math.PI) / 180) * (this.ms / 1000);
    // In front of his face, off toward her side (his face and the struck side are seen, never his back).
    const back = this.v1.copy(this.home).applyAxisAngle(UP, a);
    let r = fit;
    const want = this.v2.copy(centre).addScaledVector(back, r);
    want.y = centre.y + 0.12;
    // Never inside a wall: pull in to clear it.
    if (this.opts.cast) {
      const d = this.v3.copy(want).sub(centre);
      const len = d.length();
      const hit = this.opts.cast(centre, d.divideScalar(len), len);
      if (hit !== null) {
        r = Math.max(1.2, hit - 0.3);
        want.copy(centre).addScaledVector(back, r);
        want.y = centre.y + 0.12;
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
        this.miss();
        return;
      }
      this.sinceImpact = 0;
      this.aim(tgt);
      if (this.opts.xray) this.xray(true);
      this.crack(this.v1.copy(p.pos).lerp(aimPt, 0.5));
      this.opts.onCrack?.();
      this.world.setDrama(0.45);
    } else if (this.sinceImpact >= 0) this.sinceImpact += realDt * 1000;
    if (this.sinceImpact < 0 && this.ms > B.flightCapMs) {
      // Too long a flight for cinema: cut back and let it land on its own.
      this.miss();
      return;
    }
    this.side.crossVectors(this.dir, UP).normalize().multiplyScalar(this.sign);
    this.streak.visible = p.alive;
    if (p.alive) {
      this.dir.copy(p.vel).normalize();
      this.streak.position.copy(p.pos);
      this.streak.lookAt(this.tmp.copy(p.pos).add(this.dir));
      // The push: the FOV closes from 50 toward 20 as the round eats the distance, so the man grows in the frame.
      const left = THREE.MathUtils.clamp(p.pos.distanceTo(aimPt) / this.flight0, 0, 1);
      const fov = B.fov - 30 * Math.pow(1 - left, 0.6);
      this.setFov(fov);
      // 0.5 m behind the round and a little to the side, looking along the flight: the target sits on the line
      // ahead (the frame's centre), the round large in the lower third, its trail running back toward the lens.
      const t = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
      const up = this.v1.crossVectors(this.side, this.dir).normalize();
      if (up.y < 0) up.negate();
      const spin = (this.sign * ((B.orbitDegS * Math.PI) / 180) * this.ms) / 1000;
      const lift = B.back * t * 0.36;
      const across = B.back * t * 0.22 * cam.aspect;
      cam.position.copy(p.pos).addScaledVector(this.dir, -B.back).addScaledVector(up, lift).addScaledVector(this.side, across * Math.cos(spin) * 0.6);
      this.lookAt.copy(cam.position).addScaledVector(this.dir, 40);
      this.bars = Math.min(1, this.ms / KILLCAM.orbit.barsMs);
    } else {
      // The body: swung round to his side as the round arrives, then a slow orbit as he goes down.
      const t = this.sinceImpact;
      // Framed on the whole man (head to hips), 2.3 m out and opening, a little above him.
      const centre = this.tmp.copy(aimPt).lerp(tgt.body.joints.pelvis, 0.4 + Math.min(1, t / 900) * 0.12);
      const a = this.sign * (t / 1000) * 0.5;
      const off = this.v1.copy(this.home).applyAxisAngle(UP, a).multiplyScalar(2.0 + t / 1500);
      const want = this.v2.copy(centre).add(off);
      want.y += 0.25;
      cam.position.lerp(want, 1 - Math.exp(-realDt * (t < B.impactMs ? 9 : 4)));
      this.lookAt.lerp(centre, 1 - Math.exp(-realDt * 10));
      this.setFov(THREE.MathUtils.lerp(cam.fov, 50, Math.min(1, t / 600)));
      if (this.xrayOn && t > B.xrayMs) this.xray(false);
      this.whip = whipAt(t);
      this.bars = Math.max(0, 1 - Math.max(0, t - B.orbitEndMs) / B.rampMs);
      if (bulletDone(t)) {
        this.finish();
        return;
      }
    }
    cam.lookAt(this.lookAt);
  }

  private miss(): void {
    this.missed = true;
    this.opts.onMiss?.();
    this.finish();
  }

  private setFov(f: number): void {
    const cam = this.world.camera;
    if (Math.abs(cam.fov - f) > 1e-3) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }

  /** The struck bone cracks (a fracture line on the side the round came from) and sheds 6 to 10 white chips. */
  private crack(at: THREE.Vector3): void {
    if (!this.xrayOn || !this.skel || !this.target) return;
    // The chips leave from the bone's surface where the round went in, slowly, so they stay in the frame.
    const from = this.v2.copy(this.target.body.joints[this.joint === "head" ? "head" : "chest"]).addScaledVector(this.dir, this.joint === "head" ? -0.07 : -0.11);
    from.lerp(at, 0.25);
    const n = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const g = new THREE.TetrahedronGeometry(0.007 + Math.random() * 0.008);
      const m = new THREE.Mesh(g, chipMat);
      m.position.copy(from);
      const v = this.dir.clone().multiplyScalar(0.5 + Math.random() * 0.4).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, Math.random() * 0.55, (Math.random() - 0.5) * 0.7));
      this.world.scene.add(m);
      this.chips.push({ m, v, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20) });
    }
    // The bone itself: the fracture turns to face the round, the jaw drops, the ribs jolt apart along the shot.
    this.skel.pose(this.target);
    if (this.joint === "head") {
      const local = this.v3.copy(this.dir).negate().applyQuaternion(this.q.copy(this.skel.skull.quaternion).invert());
      this.skel.crack.rotation.y = Math.atan2(local.x, local.z);
      this.skel.crack.visible = true;
      for (const c of this.skel.skull.children) if (c.name === "jaw") c.rotation.x += 0.35;
    } else {
      for (const c of this.skel.ribs.children) {
        if (c.position.lengthSq() < 1e-8) continue;
        c.position.addScaledVector(this.v3.copy(c.position).normalize(), 0.012);
        c.position.x += (Math.random() - 0.5) * 0.01;
        c.position.z += (Math.random() - 0.5) * 0.01;
      }
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
    this.caption = null;
    this.shotDistance = 0;
    this.bars = 0;
    this.whip = 0;
    this.streak.visible = false;
    for (const off of this.lightsOff) off();
    this.lightsOff = [];
    this.key.intensity = this.rim.intensity = 0;
    if (this.fov0 > 0) this.setFov(this.fov0);
    this.world.setDrama(0);
    this.world.setFocus?.(0.5, 0.5);
  }
}
