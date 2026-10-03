// Cath's body in first person: walking, sprinting, crouching, sliding, jumping, mantling and leaning, with
// collision against the world's boxes. Positions are her feet; the camera sits at eye height above them.

import * as THREE from "three";
import type { Intent } from "./input";

export type Stance = "stand" | "crouch" | "slide";

export const PLAYER = {
  radius: 0.32,
  height: 1.74,
  crouchHeight: 1.12,
  eye: 1.62,
  crouchEye: 1.0,
  walk: 4.3,
  sprint: 7.2,
  crouchSpeed: 2.3,
  aimSpeed: 2.6,
  accel: 14,
  airAccel: 3,
  friction: 10,
  gravity: 19,
  jump: 5.6,
  slideSpeed: 10,
  slideTime: 0.8,
  /** How high a ledge Cath can pull herself onto, above her feet. */
  mantle: 1.45,
  step: 0.42,
  lean: 0.38,
} as const;

const tmpBox = new THREE.Box3();

export class Player {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  stance: Stance = "stand";
  onGround = false;
  /** 0..1 eased crouch amount, for the camera. */
  crouchAmt = 0;
  leanAmt = 0;
  private slideLeft = 0;
  private mantling: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  /** Distance walked, for head bob and footsteps. */
  stride = 0;
  /** Set by the frame for the camera's landing dip. */
  landed = 0;
  /** Speed multiplier from build and gear. */
  speedMul = 1;
  aiming = false;

  constructor(
    start: THREE.Vector3,
    private readonly colliders: THREE.Box3[],
    private readonly ground: (x: number, z: number) => number,
  ) {
    this.pos.copy(start);
    this.pos.y = ground(start.x, start.z);
  }

  get height(): number {
    return THREE.MathUtils.lerp(PLAYER.height, PLAYER.crouchHeight, this.crouchAmt);
  }

  get eyeHeight(): number {
    return THREE.MathUtils.lerp(PLAYER.eye, PLAYER.crouchEye, this.crouchAmt);
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  /** True when moving fast enough to be noisy and easy to spot. */
  get moving(): boolean {
    return this.speed > 0.6;
  }

  step(dt: number, intent: Intent): void {
    this.yaw -= intent.look.yaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + intent.look.pitch, -1.5, 1.5);
    this.leanAmt = THREE.MathUtils.damp(this.leanAmt, this.onGround ? intent.lean : 0, 10, dt);

    if (this.mantling) {
      const m = this.mantling;
      m.t += dt / 0.38;
      const t = Math.min(1, m.t);
      // Up first, then over: a little arc.
      this.pos.set(
        THREE.MathUtils.lerp(m.from.x, m.to.x, t * t),
        THREE.MathUtils.lerp(m.from.y, m.to.y, Math.sin((t * Math.PI) / 2)),
        THREE.MathUtils.lerp(m.from.z, m.to.z, t * t),
      );
      if (t >= 1) {
        this.mantling = null;
        this.vel.set(0, 0, 0);
        this.onGround = true;
      }
      return;
    }

    // Stance: crouch toggles; crouching while sprinting starts a slide.
    if (intent.crouch) {
      if (this.stance === "stand" && this.onGround && this.speed > PLAYER.walk + 0.5) {
        this.stance = "slide";
        this.slideLeft = PLAYER.slideTime;
        const fwd = new THREE.Vector3(this.vel.x, 0, this.vel.z).normalize();
        this.vel.x = fwd.x * PLAYER.slideSpeed;
        this.vel.z = fwd.z * PLAYER.slideSpeed;
      } else if (this.stance === "crouch") {
        if (this.canStand()) this.stance = "stand";
      } else this.stance = "crouch";
    }
    if (this.stance === "slide") {
      this.slideLeft -= dt;
      if (this.slideLeft <= 0 || this.speed < 2.5) this.stance = "crouch";
    }
    if (intent.sprint && this.stance === "crouch" && intent.move.y > 0 && this.canStand()) this.stance = "stand";
    this.crouchAmt = THREE.MathUtils.damp(this.crouchAmt, this.stance === "stand" ? 0 : 1, 14, dt);

    // Desired velocity on the ground plane.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const fwd = new THREE.Vector3(-sin, 0, -cos);
    const right = new THREE.Vector3(cos, 0, -sin);
    const wish = new THREE.Vector3().addScaledVector(fwd, intent.move.y).addScaledVector(right, intent.move.x);
    const sprinting = intent.sprint && intent.move.y > 0.3 && this.stance === "stand" && !this.aiming;
    let max =
      this.stance === "crouch" ? PLAYER.crouchSpeed : this.aiming ? PLAYER.aimSpeed : sprinting ? PLAYER.sprint : PLAYER.walk;
    max *= this.speedMul;

    if (this.stance === "slide") {
      // A slide coasts and bleeds speed; steering is slight.
      const f = Math.max(0, 1 - 1.6 * dt);
      this.vel.x *= f;
      this.vel.z *= f;
    } else if (this.onGround) {
      const target = wish.multiplyScalar(max);
      const k = 1 - Math.exp(-(wish.lengthSq() > 0 ? PLAYER.accel : PLAYER.friction) * dt);
      this.vel.x += (target.x - this.vel.x) * k;
      this.vel.z += (target.z - this.vel.z) * k;
    } else {
      this.vel.x += wish.x * max * PLAYER.airAccel * dt * 0.3;
      this.vel.z += wish.z * max * PLAYER.airAccel * dt * 0.3;
    }

    if (intent.jump && this.onGround) {
      if (!this.tryMantle(fwd)) {
        if (this.stance !== "stand" && this.canStand()) this.stance = "stand";
        this.vel.y = PLAYER.jump;
        this.onGround = false;
      }
    } else if (intent.jump && !this.onGround) this.tryMantle(fwd);

    this.vel.y -= PLAYER.gravity * dt;
    const wasGround = this.onGround;
    const fall = this.vel.y;
    this.moveAxis("x", this.vel.x * dt);
    this.moveAxis("z", this.vel.z * dt);
    this.moveY(this.vel.y * dt);
    if (this.onGround && !wasGround) this.landed = Math.min(1, -fall / 12);
    if (this.onGround) this.stride += this.speed * dt;
  }

  private bodyBox(at: THREE.Vector3, out: THREE.Box3): THREE.Box3 {
    const r = PLAYER.radius;
    out.min.set(at.x - r, at.y + 0.02, at.z - r);
    out.max.set(at.x + r, at.y + this.height, at.z + r);
    return out;
  }

  private blocked(at: THREE.Vector3): THREE.Box3 | null {
    this.bodyBox(at, tmpBox);
    for (const c of this.colliders) if (c.intersectsBox(tmpBox)) return c;
    return null;
  }

  private canStand(): boolean {
    const r = PLAYER.radius;
    tmpBox.min.set(this.pos.x - r, this.pos.y + 0.05, this.pos.z - r);
    tmpBox.max.set(this.pos.x + r, this.pos.y + PLAYER.height, this.pos.z + r);
    return !this.colliders.some((c) => c.intersectsBox(tmpBox));
  }

  private moveAxis(axis: "x" | "z", d: number): void {
    if (d === 0) return;
    const next = this.pos.clone();
    next[axis] += d;
    const hit = this.blocked(next);
    if (!hit) {
      this.pos.copy(next);
      return;
    }
    // Step up low edges (kerbs, stairs) when on the ground.
    const lift = hit.max.y - this.pos.y;
    if (this.onGround && lift > 0 && lift <= PLAYER.step) {
      next.y = hit.max.y + 0.001;
      if (!this.blocked(next)) {
        this.pos.copy(next);
        return;
      }
    }
    // Slide along the face: clamp to it.
    const r = PLAYER.radius + 0.001;
    this.pos[axis] = d > 0 ? hit.min[axis] - r : hit.max[axis] + r;
    this.vel[axis] = 0;
  }

  private moveY(d: number): void {
    const next = this.pos.clone();
    next.y += d;
    let floor = this.ground(next.x, next.z);
    // Box tops count as floor when we come down onto them.
    this.bodyBox(next, tmpBox);
    for (const c of this.colliders) {
      if (c.intersectsBox(tmpBox)) {
        if (d <= 0 && c.max.y <= this.pos.y + 0.05) floor = Math.max(floor, c.max.y);
        else if (d > 0) {
          next.y = c.min.y - this.height - 0.001;
          this.vel.y = 0;
        }
      }
    }
    if (next.y <= floor) {
      next.y = floor;
      this.vel.y = 0;
      this.onGround = true;
    } else this.onGround = next.y - floor < 0.04 && this.vel.y <= 0;
    this.pos.copy(next);
  }

  /** Pull up onto a ledge in front, if there is one within reach. */
  private tryMantle(fwd: THREE.Vector3): boolean {
    const probe = this.pos.clone().addScaledVector(fwd, PLAYER.radius + 0.35);
    for (const c of this.colliders) {
      if (probe.x < c.min.x || probe.x > c.max.x || probe.z < c.min.z || probe.z > c.max.z) continue;
      const top = c.max.y - this.pos.y;
      if (top < PLAYER.step || top > PLAYER.mantle) continue;
      const to = new THREE.Vector3(probe.x, c.max.y + 0.001, probe.z).addScaledVector(fwd, 0.25);
      const saved = this.pos.clone();
      this.pos.copy(to);
      const clear = !this.blocked(to);
      this.pos.copy(saved);
      if (!clear) continue;
      this.mantling = { from: this.pos.clone(), to, t: 0 };
      return true;
    }
    return false;
  }

  get isMantling(): boolean {
    return this.mantling !== null;
  }

  /** Writes the eye transform into the camera: bob, lean and landing dip included. */
  applyCamera(cam: THREE.PerspectiveCamera, dt: number, bob = 1): void {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const right = new THREE.Vector3(cos, 0, -sin);
    const bobAmt = this.onGround && this.stance !== "slide" ? Math.min(1, this.speed / PLAYER.sprint) * bob : 0;
    const by = Math.sin(this.stride * 1.9) * 0.035 * bobAmt;
    const bx = Math.cos(this.stride * 0.95) * 0.03 * bobAmt;
    this.landed = Math.max(0, this.landed - dt * 3);
    cam.position
      .copy(this.pos)
      .addScaledVector(right, bx + this.leanAmt * PLAYER.lean)
      .add(new THREE.Vector3(0, this.eyeHeight + by - this.landed * 0.12 - Math.abs(this.leanAmt) * 0.06, 0));
    cam.rotation.set(this.pitch, this.yaw, -this.leanAmt * 0.18 - (this.stance === "slide" ? 0.05 : 0), "YXZ");
  }
}
