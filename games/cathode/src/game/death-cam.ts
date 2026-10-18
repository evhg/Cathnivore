// C8 "Dying, done properly" (docs/design/cathode-combat.md S6.6): the death sequence's clock and its body cam.
//
// `deathState(tMs)` is the whole timeline as plain numbers (the grade's uDeath and uInk, the CA, the FOV, the
// letterbox, the killer's name, the card, the world muffle), so the screen, the sound and the tests read one
// table. Everything in it only ever moves one way, which the tests hold.
//
// `DeathCam` is the camera's body: three Verlet particles (head, chest, hips) seeded from her capsule's velocity
// and the killing blow. The hips drop first (her knees go), then the chest falls forward or back by the side the
// round came from, and the head stops `groundM` off the floor. The camera rides the head, looks along chest to
// head biased toward the killer, rolls 60 to 80 degrees into the floor, and from 900 ms turns to frame him while he
// stands down. It runs on real time at a fixed 1/240 s step, so a screenshot stage replays the same fall.
//
// `GunDrop` is the gun leaving her hand: the viewmodel's gun moved into the street with a spin, bouncing and
// clattering on the floor between 500 and 800 ms.

import * as THREE from "three";
import { tuning } from "./feel/tuning";

const D = tuning.death;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (t: number, from: number, ms: number) => clamp01((t - from) / ms);
const easeOut = (x: number) => 1 - (1 - x) * (1 - x) * (1 - x);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export interface DeathState {
  /** Real ms since the killing blow. */
  t: number;
  phase: "stop" | "fall" | "settle" | "freeze" | "card";
  /** The grade's uDeath (desaturate, bleed to red, close the edges). */
  death: number;
  /** The grade's uInk (blood ink flooding in from the edges). */
  ink: number;
  /** Chromatic aberration multiplier (1 normal, 3 at its widest). */
  ca: number;
  /** The world camera's FOV (degrees). */
  fov: number;
  /** The 2.39:1 letterbox, 0..1 of the way in. */
  bars: number;
  /** The killer's name in the corner, 0..1. */
  killer: number;
  /** The death card's opacity, 0..1. */
  card: number;
  /** The world's lowpass (Hz). */
  muffleHz: number;
  /** World time: 1 normal, `slow` while she falls, 0 once the frame freezes. */
  worldScale: number;
  /** Input may skip to the card. */
  skippable: boolean;
  /** The fall's progress (0 standing, 1 on the floor). */
  fall: number;
}

/** The death sequence at `tMs` real ms after the killing blow (S6.6). */
export function deathState(tMs: number): DeathState {
  const t = Math.max(0, tMs);
  const death1 = D.death1 * easeOut(ramp(t, D.stopMs, D.death1Ms - D.stopMs));
  const death2 = (D.death2 - D.death1) * easeInOut(ramp(t, D.fallEndMs, D.settleEndMs - D.fallEndMs));
  const fall = easeInOut(ramp(t, D.stopMs, D.fallEndMs - D.stopMs));
  const mu = easeOut(ramp(t, D.stopMs, D.muffleMs));
  const slowIn = t < D.stopMs ? 0 : D.slow;
  // The world: frozen by the hit-stop, then slowed, easing toward real time, then held still as the frame freezes.
  const out = ramp(t, D.stopMs + D.slowHoldMs, D.slowOutMs);
  const worldScale = t < D.stopMs || t >= D.freezeMs ? 0 : slowIn + (1 - slowIn) * out;
  const phase: DeathState["phase"] = t < D.stopMs ? "stop" : t < D.fallEndMs ? "fall" : t < D.freezeMs ? "settle" : t < D.cardMs ? "freeze" : "card";
  return {
    t,
    phase,
    death: death1 + death2,
    ink: D.ink * easeInOut(ramp(t, D.inkFromMs, D.inkMs)),
    ca: 1 + (D.caMul - 1) * easeOut(ramp(t, D.stopMs, D.death1Ms - D.stopMs)),
    fov: D.fovFrom + (D.fovTo - D.fovFrom) * fall,
    bars: easeOut(ramp(t, D.barsFromMs, D.barsMs)),
    killer: easeOut(ramp(t, D.fallEndMs, 260)),
    card: easeOut(ramp(t, D.cardMs, D.cardFadeMs)),
    muffleHz: 22000 * Math.pow(D.muffleHz / 22000, mu),
    worldScale,
    skippable: t >= D.skipMs,
    fall,
  };
}

/** The re-sync transition (S6.6, 900 ms): the ink recedes, a glitch, then a fade from black into her eyes. */
export function resyncState(tMs: number): { ink: number; glitch: number; black: number; done: boolean } {
  const R = D.resync;
  const t = Math.max(0, tMs);
  const ink = D.ink * (1 - easeInOut(ramp(t, 0, R.inkOutMs)));
  const g = ramp(t, R.inkOutMs, R.glitchMs);
  const glitch = t < R.inkOutMs || t > R.inkOutMs + R.glitchMs ? 0 : Math.sin(g * Math.PI) * 0.6 + 0.4 * (1 - g);
  // Black through the ink and the glitch's last frames, then the 350 ms fade up into first person.
  const black = t < R.inkOutMs ? 0 : t < R.inkOutMs + R.glitchMs ? 0.35 + 0.65 * g : 1 - easeOut(ramp(t, R.inkOutMs + R.glitchMs, R.fadeMs));
  return { ink, glitch, black, done: t >= R.totalMs };
}

type V = THREE.Vector3;

export interface DeathSeed {
  /** Her feet, eye height and capsule velocity at the blow. */
  feet: V;
  eyeHeight: number;
  yaw: number;
  vel: V;
  /** Where the killing round came from (null: unknown, straight ahead). */
  from: V | null;
  /** The killing blow as a share of her max health (scales the impulse). */
  share: number;
  /** The floor under (x, z). */
  ground: (x: number, z: number) => number;
  /** 0..1, picks the roll and the side she falls to. */
  seed: number;
  reducedMotion?: boolean;
}

const STEP = 1 / 240;
const LINKS: Array<[number, number, number]> = [
  [0, 1, 0.3],
  [1, 2, 0.45],
];

/** The death camera's body: head 0, chest 1, hips 2. */
export class DeathCam {
  readonly p: V[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private prev: V[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private t = 0;
  private acc = 0;
  private seedV!: DeathSeed;
  private hips0 = 0;
  /** Which way the chest goes: away from the round (unit, flat). */
  private fallDir = new THREE.Vector3();
  private rollSign = 1;
  private rollRad = 0;
  /** The killer's chest (null: none in range, or dead). */
  killer: V | null = null;
  /** The camera pose this step: position, and yaw/pitch/roll in the player's convention. */
  readonly pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  roll = 0;
  private eye0 = new THREE.Vector3();

  start(s: DeathSeed): void {
    this.seedV = s;
    this.t = 0;
    this.acc = 0;
    const f = s.feet;
    const head = new THREE.Vector3(f.x, f.y + s.eyeHeight, f.z);
    const chest = new THREE.Vector3(f.x, f.y + s.eyeHeight * 0.78, f.z);
    const hips = new THREE.Vector3(f.x, f.y + s.eyeHeight * 0.55, f.z);
    this.eye0.copy(head);
    this.hips0 = hips.y;
    this.p[0]!.copy(head);
    this.p[1]!.copy(chest);
    this.p[2]!.copy(hips);
    // Away from the round, flat: a hit from the front sends her back, one from behind pitches her forward.
    const look = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const away = s.from ? new THREE.Vector3(f.x - s.from.x, 0, f.z - s.from.z) : look.clone().negate();
    if (away.lengthSq() < 1e-6) away.copy(look).negate();
    away.normalize();
    // Never straight back or forward: the body twists a little to the seeded side, so the fall reads.
    const twist = (s.seed - 0.5) * 0.7;
    this.fallDir.copy(away).applyAxisAngle(new THREE.Vector3(0, 1, 0), twist);
    const right = new THREE.Vector3(-look.z, 0, look.x);
    // Roll into the floor on the side the body twists toward (or the hit's side).
    const side = s.from ? Math.sign(new THREE.Vector3(s.from.x - f.x, 0, s.from.z - f.z).dot(right)) || 1 : s.seed < 0.5 ? -1 : 1;
    this.rollSign = -side;
    this.rollRad = THREE.MathUtils.degToRad(D.rollDeg[0] + (D.rollDeg[1] - D.rollDeg[0]) * s.seed);
    // The impulse: her capsule's velocity plus the blow (0.6 to 2.0 m/s by its size), mostly into the chest.
    const imp = D.impulseMps[0] + (D.impulseMps[1] - D.impulseMps[0]) * clamp01(s.share / 0.35);
    const kick = away.clone().multiplyScalar(imp);
    const v = s.vel.clone().setY(Math.min(0, s.vel.y));
    for (let i = 0; i < 3; i++) {
      const w = i === 1 ? 1 : i === 0 ? 0.8 : 0.35;
      this.prev[i]!.copy(this.p[i]!).addScaledVector(v.clone().add(kick.clone().multiplyScalar(w)), -STEP);
    }
    this.yaw = s.yaw;
    this.pitch = 0;
    this.roll = 0;
    this.pos.copy(head);
  }

  /** Advances the body by `dt` real seconds (fixed 1/240 s steps) and updates the camera pose. */
  update(dt: number): void {
    this.acc += Math.min(0.1, Math.max(0, dt));
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step();
    }
    this.pose();
  }

  /** Real ms since start. */
  get ms(): number {
    return this.t * 1000;
  }

  private step(): void {
    const s = this.seedV;
    this.t += STEP;
    const ms = this.t * 1000;
    const g = -9.8;
    for (let i = 0; i < 3; i++) {
      const p = this.p[i]!;
      const q = this.prev[i]!;
      const vx = (p.x - q.x) * 0.992;
      const vy = (p.y - q.y) * 0.992;
      const vz = (p.z - q.z) * 0.992;
      q.copy(p);
      p.x += vx;
      p.y += vy + g * STEP * STEP * (i === 2 ? 0.6 : 1);
      p.z += vz;
    }
    // The hit-stop holds her up: nothing falls in the first 120 ms but the blow's shove.
    if (ms < D.stopMs) {
      for (let i = 0; i < 3; i++) {
        const p = this.p[i]!;
        const q = this.prev[i]!;
        p.y = q.y;
      }
    }
    // Knees first (powered): the hips are driven down 0.5 m by about 500 ms.
    if (ms >= D.stopMs && ms < D.fallEndMs) {
      const want = this.hips0 - D.hipsDropM * easeInOut(ramp(ms, D.stopMs, 380));
      const h = this.p[2]!;
      if (h.y > want) h.y += (want - h.y) * 0.08;
      // Then the chest goes over: a push along the fall direction that builds after the knees give.
      const over = ramp(ms, 260, 320) * (1 - ramp(ms, 700, 200));
      this.p[1]!.addScaledVector(this.fallDir, 0.0009 * over);
      this.p[0]!.addScaledVector(this.fallDir, 0.0016 * over);
    }
    // Distance links (head-chest, chest-hips), a few passes.
    for (let k = 0; k < 4; k++) {
      for (const [a, b, len] of LINKS) {
        const pa = this.p[a]!;
        const pb = this.p[b]!;
        const d = pb.clone().sub(pa);
        const l = d.length() || 1e-6;
        const corr = (l - len) / l / 2;
        pa.addScaledVector(d, corr);
        pb.addScaledVector(d, -corr);
      }
      // The floor: the head stops 0.12 m off it, the chest and hips just above, with friction.
      for (let i = 0; i < 3; i++) {
        const p = this.p[i]!;
        const fl = s.ground(p.x, p.z) + (i === 0 ? D.groundM : i === 1 ? 0.13 : 0.11);
        if (p.y < fl) {
          p.y = fl;
          const q = this.prev[i]!;
          q.x += (p.x - q.x) * 0.35;
          q.z += (p.z - q.z) * 0.35;
          if (q.y < p.y) q.y = p.y;
        }
      }
    }
  }

  private pose(): void {
    const s = this.seedV;
    const ms = this.t * 1000;
    const st = deathState(ms);
    const head = this.p[0]!;
    if (s.reducedMotion) {
      // Reduced motion: no roll, no tumble; the camera slides 0.8 m down and holds.
      this.pos.copy(this.eye0).setY(this.eye0.y - D.reducedSlideM * st.fall);
      this.yaw = s.yaw;
      this.pitch = this.pitch0 * (1 - st.fall);
      this.roll = 0;
      return;
    }
    // The camera rides the head (the Verlet body gives the drop its weight and the shove its direction).
    this.pos.copy(head);
    // Where she looks: her own view as she goes, turning toward the killer as she falls (40%), then settling on
    // him once she's down (S6.6: "frames him").
    let yawK = this.seedV.yaw;
    let pitchK = 0.04;
    if (this.killer) {
      const to = this.killer.clone().sub(head);
      yawK = Math.atan2(-to.x, -to.z);
      pitchK = THREE.MathUtils.clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.2, 0.3);
    }
    let dy = yawK - s.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const frame = this.killer ? D.killerBias * st.fall + (D.killerFrame - D.killerBias) * easeInOut(ramp(ms, D.fallEndMs, 600)) : 0;
    // Settled, the view drifts 0.4 degrees a second.
    const drift = (THREE.MathUtils.degToRad(D.driftDegS) * Math.max(0, ms - D.fallEndMs)) / 1000;
    this.yaw = s.yaw + dy * frame + drift * this.rollSign;
    // The pitch: from hers, through the tumble (back: the head snaps up; forward: it pitches at the floor), to a
    // body cam's look along the ground.
    const along = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const back = this.fallDir.dot(along) < 0;
    const tumble = Math.sin(Math.PI * Math.min(1, st.fall * 1.15)) * (back ? 0.42 : -0.5);
    const settle = this.killer ? pitchK * frame + 0.05 * (1 - frame) : 0.05;
    this.pitch = this.pitch0 + (settle - this.pitch0) * st.fall + tumble;
    this.roll = this.rollSign * this.rollRad * easeOut(st.fall);
  }

  /** The pitch she was looking at when she died (the fall starts from her own view). */
  pitch0 = 0;

  /** Replays the fall from the start to `ms` (screenshot stages). */
  sampleAt(ms: number): void {
    const k = this.killer;
    const p0 = this.pitch0;
    this.start(this.seedV);
    this.killer = k;
    this.pitch0 = p0;
    for (let t = 0; t < ms - 1e-9; t += 1000 / 60) this.update(Math.min(1000 / 60, ms - t) / 1000);
  }
}

/**
 * The gun leaves her hand (S6.6): a rigid body with a spin, gravity, and a bounce on the floor (restitution 0.3).
 * `onClatter(strength)` sounds each landing harder than a tap.
 */
export class GunDrop {
  readonly obj: THREE.Object3D;
  readonly vel = new THREE.Vector3();
  readonly spin = new THREE.Vector3();
  private rested = false;
  private acc = 0;
  landings = 0;
  constructor(
    obj: THREE.Object3D,
    private readonly ground: (x: number, z: number) => number,
    private readonly onClatter: (strength: number, at: THREE.Vector3) => void,
    private readonly halfHeight = 0.03,
  ) {
    this.obj = obj;
  }

  update(dt: number): void {
    if (this.rested) return;
    this.acc += Math.min(0.1, Math.max(0, dt));
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.vel.y -= 9.8 * STEP;
      this.obj.position.addScaledVector(this.vel, STEP);
      this.obj.rotation.x += this.spin.x * STEP;
      this.obj.rotation.y += this.spin.y * STEP;
      this.obj.rotation.z += this.spin.z * STEP;
      const fl = this.ground(this.obj.position.x, this.obj.position.z) + this.halfHeight;
      if (this.obj.position.y < fl) {
        this.obj.position.y = fl;
        const hit = -this.vel.y;
        if (hit > 0.6) {
          this.landings++;
          this.onClatter(Math.min(1, hit / 4), this.obj.position);
        }
        this.vel.y = hit * 0.3;
        this.vel.x *= 0.55;
        this.vel.z *= 0.55;
        this.spin.multiplyScalar(0.45);
        if (hit < 0.6 && this.vel.lengthSq() < 0.04) {
          // Lying flat on the floor.
          this.vel.set(0, 0, 0);
          this.spin.set(0, 0, 0);
          this.obj.rotation.x = Math.round(this.obj.rotation.x / Math.PI) * Math.PI;
          this.obj.rotation.z = Math.PI / 2;
          this.rested = true;
        }
      }
    }
  }

  get atRest(): boolean {
    return this.rested;
  }
}
