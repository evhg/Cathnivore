// Hollowell Enforcers on the street: a Body, a rifle, and a small brain. They patrol routes, notice Cath
// through a vision cone (distance, light, her stance and movement), investigate noises, search where she
// was last seen, and fight in bursts. Rules numbers (health, damage, detection) come from sim/ once wired.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Body, enforcerLook, place, type BodyLook } from "./body";
import { animate, muzzleOf, type Motion } from "./animate";
import type { RayWorld } from "./ray";

export type Awareness = "unaware" | "suspicious" | "searching" | "combat" | "dead";

export interface EnemyKit {
  name: string;
  maxHp: number;
  armour: number;
  /** Damage per rifle round at the player. */
  damage: number;
  /** Rounds per burst, seconds between rounds, seconds between bursts. */
  burst: [number, number, number];
  /** Accuracy spread at 10 m, radians. */
  spread: number;
  walk: number;
  run: number;
  vision: { range: number; fov: number };
  hearing: number;
  xp: number;
  visor: number;
  /** Rifleman, a shield bearer (a riot shield stops rounds from the front), or a sniper with a laser. */
  role?: "rifle" | "shield" | "sniper" | "orderly";
  /** Elite modifiers (sim/enemies.ts): extraFast, stoneskin, multipleShots and the rest. */
  elite?: boolean;
  mods?: readonly string[];
  /** Seconds of Cath's bullet-time each hit drains (Cursed). */
  drain?: number;
}

export const RIOT_SHIELD: EnemyKit = {
  name: "Riot-Shield Enforcer",
  maxHp: 130,
  armour: 0.35,
  damage: 6,
  burst: [2, 0.25, 1.2],
  spread: 0.06,
  walk: 1.2,
  run: 3,
  vision: { range: 30, fov: (90 * Math.PI) / 180 },
  hearing: 1,
  xp: 80,
  visor: 0xff3040,
  role: "shield",
};

export const ENFORCER_SNIPER: EnemyKit = {
  name: "Enforcer Sniper",
  maxHp: 80,
  armour: 0.15,
  damage: 34,
  burst: [1, 0, 3.2],
  spread: 0.004,
  walk: 1.1,
  run: 3.5,
  vision: { range: 80, fov: (60 * Math.PI) / 180 },
  hearing: 0.7,
  xp: 90,
  visor: 0x30d0ff,
  role: "sniper",
};

/** A Candor orderly: unarmed but augmented. Sprints at Cath and lunges when close (clinic, act 2). */
export const ORDERLY: EnemyKit = {
  name: "Candor Orderly",
  maxHp: 120,
  armour: 0.2,
  damage: 14,
  burst: [1, 0, 0.9],
  spread: 0,
  walk: 2,
  run: 6.5,
  vision: { range: 26, fov: (120 * Math.PI) / 180 },
  hearing: 1.2,
  xp: 70,
  visor: 0x58ffb0,
  role: "orderly",
};

/** Metres within which an orderly strikes, and the lunge speed it closes the last few metres at. */
export const ORDERLY_REACH = 2.1;
export const ORDERLY_LUNGE = 11;

export const ENFORCER: EnemyKit = {
  name: "Hollowell Enforcer",
  maxHp: 110,
  armour: 0.15,
  damage: 9,
  burst: [3, 0.11, 1.4],
  spread: 0.045,
  walk: 1.35,
  run: 4.2,
  vision: { range: 34, fov: (110 * Math.PI) / 180 },
  hearing: 1,
  xp: 60,
  visor: 0xffa040,
};

/** What an enemy perceives about Cath this frame, computed by the session. */
export interface Sight {
  /** Cath's eye and chest points. */
  eye: THREE.Vector3;
  chest: THREE.Vector3;
  /** 0..1: how lit she is. */
  light: number;
  /** 0..1: crouched or sliding counts as low. */
  low: number;
  /** m/s. */
  speed: number;
  /** Detection multiplier from her build (Nerve, skills, gear): below 1 is harder to see. */
  stealth: number;
}

let nextId = 1;

/** Seconds between an enemy spotting Cath and its first shot. */
export const REACTION = 0.9;

/** Seconds of steady aim a sniper needs before firing. */
export const SNIPER_CHARGE = 1.5;

export class Enemy {
  readonly id = nextId++;
  readonly body: Body;
  readonly rifle: THREE.Group;
  hp: number;
  state: Awareness = "unaware";
  /** 0..1 detection meter: fills while she's seen, drains when she's not. */
  detect = 0;
  readonly motion: Motion;
  private route: THREE.Vector3[];
  private routeIdx = 0;
  private wait = 0;
  readonly lastKnown = new THREE.Vector3();
  private searchLeft = 0;
  private fireCd = 0;
  private burstLeft = 0;
  private strafe = 1;
  private strafeT = 0;
  /** Seconds since death, for clean-up and the kill-cam. */
  deadFor = 0;
  /** Set when the session found this body and raised the alarm. */
  found = false;
  readonly vel = new THREE.Vector3();
  /** The riot shield (shield bearers only), and the sniper's laser. */
  shield: THREE.Mesh | null = null;
  laser: THREE.Mesh | null = null;
  /** Sniper: seconds of steady aim built up; fires at SNIPER_CHARGE. */
  charge = 0;
  /** Shots this frame, for the session to resolve: from, direction. */
  readonly shots: Array<{ from: THREE.Vector3; dir: THREE.Vector3; melee?: boolean }> = [];

  constructor(
    readonly kit: EnemyKit,
    route: THREE.Vector3[],
    readonly level = 1,
    look: BodyLook = enforcerLook(kit.visor),
  ) {
    this.body = new Body(look);
    this.hp = kit.maxHp;
    this.route = route.length ? route : [new THREE.Vector3()];
    const start = this.route[0]!.clone();
    this.motion = {
      pos: start,
      yaw: 0,
      speed: 0,
      phase: Math.random() * 6,
      pitch: 0,
      crouch: 0,
      aim: 0,
      flinch: new THREE.Vector3(),
      kick: 0,
    };
    // Face along the route from the start, not at whatever happens to lie north.
    const next = this.route[1];
    if (next) this.motion.yaw = Math.atan2(next.x - start.x, next.z - start.z);
    this.rifle = buildRifle(look);
    this.body.root.add(this.rifle);
    if (kit.role === "shield") {
      const g = new RoundedBoxGeometry(0.62, 1.05, 0.05, 2, 0.02);
      this.shield = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.82 }),
      );
      const slot = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.06, 0.055, 1, 0.01), look.visor);
      slot.position.set(0, 0.32, 0);
      this.shield.add(slot);
      this.body.root.add(this.shield);
    }
    if (kit.role === "sniper") {
      const lg = new THREE.CylinderGeometry(0.004, 0.004, 1, 4, 1, true);
      lg.translate(0, 0.5, 0);
      lg.rotateX(Math.PI / 2);
      this.laser = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.laser.visible = false;
      this.body.root.add(this.laser);
    }
  }

  get alive(): boolean {
    return this.state !== "dead";
  }

  get position(): THREE.Vector3 {
    return this.motion.pos;
  }

  /** The head joint, for headshot checks and the kill-cam. */
  get head(): THREE.Vector3 {
    return this.body.joints.head;
  }

  /** Hears a noise at `at` with loudness radius `radius` (metres). */
  hear(at: THREE.Vector3, radius: number): void {
    if (!this.alive) return;
    const d = at.distanceTo(this.motion.pos);
    if (d > radius * this.kit.hearing) return;
    if (this.state === "combat") return;
    this.lastKnown.copy(at);
    if (d < radius * 0.5) this.state = "searching";
    else if (this.state === "unaware") this.state = "suspicious";
    this.searchLeft = 12;
    this.detect = Math.max(this.detect, 0.35);
  }

  /** Raises the alarm: every living enemy that gets this goes to searching at a point. */
  alert(at: THREE.Vector3): void {
    if (!this.alive || this.state === "combat") return;
    this.state = "searching";
    this.lastKnown.copy(at);
    this.searchLeft = 20;
  }

  update(dt: number, sight: Sight, rays: RayWorld, colliders: THREE.Box3[], ground: (x: number, z: number) => number): void {
    this.shots.length = 0;
    this.motion.flinch.multiplyScalar(Math.max(0, 1 - dt * 6));
    this.motion.kick = Math.max(0, this.motion.kick - dt * 8);
    if (!this.alive) {
      this.deadFor += dt;
      this.body.physics(dt, { colliders, ground });
      this.body.pose();
      this.placeRifle();
      return;
    }

    // ---- perception ----
    const eye = this.head.clone().add(new THREE.Vector3(0, -0.05, 0));
    const toCath = new THREE.Vector3().subVectors(sight.chest, eye);
    const dist = toCath.length();
    const fwd = new THREE.Vector3(Math.sin(this.motion.yaw), 0, Math.cos(this.motion.yaw));
    const flat = new THREE.Vector3(toCath.x, 0, toCath.z).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(fwd.dot(flat), -1, 1));
    const alert = this.state === "combat" || this.state === "searching";
    const range = this.kit.vision.range * (alert ? 1.3 : 1);
    const inCone = angle < (this.kit.vision.fov / 2) * (alert ? 1.3 : 1) || dist < 2.2;
    let seen = false;
    if (!(this.passive && this.state === "unaware") && dist < range && inCone && (rays.clear(eye, sight.chest) || rays.clear(eye, sight.eye))) {
      seen = true;
      // How fast the meter fills: close, lit, upright and moving fills fastest.
      const near = 1 - dist / range;
      const light = 0.25 + 0.75 * sight.light;
      const stance = 1 - 0.55 * sight.low;
      const move = 0.6 + Math.min(1, sight.speed / 5) * 0.8;
      const centre = 1 - (angle / (this.kit.vision.fov / 2)) * 0.5;
      const rate = (0.35 + 2.6 * near * near) * light * stance * move * centre * sight.stealth * (alert ? 2 : 1);
      this.detect = Math.min(1, this.detect + rate * dt);
      if (this.detect > 0.3) this.lastKnown.copy(sight.chest).setY(ground(sight.chest.x, sight.chest.z));
    } else {
      this.detect = Math.max(0, this.detect - dt * (this.state === "combat" ? 0.12 : 0.22));
    }

    // ---- state ----
    if (this.detect >= 1 && this.state !== "combat") {
      this.state = "combat";
      // A beat to react: the first round comes a moment after they've seen her, not instantly.
      this.fireCd = Math.max(this.fireCd, REACTION);
    }
    else if (this.state === "unaware" && this.detect > 0.45) {
      this.state = "suspicious";
      this.searchLeft = 10;
    } else if (this.state === "combat" && this.detect < 0.35) {
      this.state = "searching";
      this.searchLeft = 18;
    }
    if (this.state === "suspicious" || this.state === "searching") {
      this.searchLeft -= dt;
      if (this.searchLeft <= 0 && this.detect < 0.2) this.state = "unaware";
    }

    // ---- movement ----
    let target: THREE.Vector3 | null = null;
    let speed = 0;
    let face: THREE.Vector3 | null = null;
    let aim = 0;
    switch (this.state) {
      case "unaware": {
        const wp = this.route[this.routeIdx]!;
        if (this.wait > 0) this.wait -= dt;
        else if (flatDist(this.motion.pos, wp) < 0.4) {
          this.routeIdx = (this.routeIdx + 1) % this.route.length;
          this.wait = this.route.length > 1 ? 1.5 + Math.random() * 2.5 : 4;
        } else {
          target = wp;
          speed = this.kit.walk;
        }
        break;
      }
      case "suspicious":
        // Stop and stare towards what caught the eye, then go and look.
        face = this.lastKnown;
        if (this.searchLeft < 7) {
          target = this.lastKnown;
          speed = this.kit.walk * 1.1;
        }
        aim = 0.4;
        break;
      case "searching":
        target = this.lastKnown;
        speed = this.kit.walk * 1.6;
        aim = 0.7;
        if (flatDist(this.motion.pos, this.lastKnown) < 1) {
          // Sweep around the spot.
          this.lastKnown.add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
        }
        break;
      case "combat": {
        face = sight.chest;
        aim = 1;
        // Keep a fighting distance: close in from far, back off when she's on top of them, strafe between.
        const want = 14;
        const d = flatDist(this.motion.pos, sight.chest);
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafe = Math.random() < 0.5 ? -1 : 1;
          this.strafeT = 1.2 + Math.random() * 1.8;
        }
        const side = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(this.strafe);
        const along = flat.clone().multiplyScalar(d > want + 4 ? 1 : d < want - 6 ? -1 : 0);
        target = this.motion.pos.clone().add(side.add(along).multiplyScalar(3));
        speed = d > want + 8 ? this.kit.run : this.kit.walk * 1.4;
        if (this.kit.role === "shield") {
          // Shield bearers walk straight at her behind the shield.
          target = d > 4 ? sight.chest.clone() : null;
          speed = this.kit.walk;
        }
        if (this.kit.role === "orderly") {
          // Orderlies never keep their distance: sprint, lunge over the last few metres, then strike.
          target = d > 1.3 ? sight.chest.clone() : null;
          speed = d < 7 && d > ORDERLY_REACH ? ORDERLY_LUNGE : this.kit.run;
          this.fireCd -= dt;
          if (seen && d <= ORDERLY_REACH && this.fireCd <= 0) {
            this.fireCd = this.kit.burst[2] * (0.8 + Math.random() * 0.4);
            const from = this.motion.pos.clone().setY(sight.chest.y);
            this.shots.push({ from, dir: new THREE.Vector3().subVectors(sight.chest, from).normalize(), melee: true });
            this.motion.kick = 1;
          }
          break;
        }
        if (this.kit.role === "sniper") {
          // Snipers hold their spot and build a steady aim; the laser gives her a second to move.
          target = null;
          this.charge = seen ? this.charge + dt : Math.max(0, this.charge - dt * 2);
          if (this.charge >= SNIPER_CHARGE) {
            this.charge = 0;
            const from = new THREE.Vector3();
            const dir = new THREE.Vector3();
            muzzleOf(this.body, from, dir);
            const aimDir = new THREE.Vector3().subVectors(sight.chest, from).normalize();
            const spread = this.kit.spread * (1 + Math.min(3, sight.speed / 2));
            aimDir.x += (Math.random() - 0.5) * spread;
            aimDir.y += (Math.random() - 0.5) * spread;
            this.shots.push({ from, dir: aimDir.normalize() });
            this.motion.kick = 1;
          }
          break;
        }
        // Fire in bursts while she's in sight.
        this.fireCd -= dt;
        if (seen && this.fireCd <= 0) {
          if (this.burstLeft <= 0) this.burstLeft = this.kit.burst[0];
          this.burstLeft--;
          this.fireCd = this.burstLeft > 0 ? this.kit.burst[1] : this.kit.burst[2] * (0.7 + Math.random() * 0.6);
          const from = new THREE.Vector3();
          const dir = new THREE.Vector3();
          muzzleOf(this.body, from, dir);
          const aimDir = new THREE.Vector3().subVectors(sight.chest, from).normalize();
          const spread = this.kit.spread * (1 + Math.min(2, sight.speed / 3)) * (0.6 + 0.4 * (dist / 10));
          aimDir.x += (Math.random() - 0.5) * spread;
          aimDir.y += (Math.random() - 0.5) * spread;
          aimDir.z += (Math.random() - 0.5) * spread;
          this.shots.push({ from, dir: aimDir.normalize() });
          if (this.kit.mods?.includes("multipleShots")) {
            for (const side of [-1, 1]) {
              const d = aimDir.clone();
              d.x += -aimDir.z * 0.05 * side;
              d.z += aimDir.x * 0.05 * side;
              this.shots.push({ from: from.clone(), dir: d.normalize() });
            }
          }
          this.motion.kick = 1;
        }
        break;
      }
    }

    if (this.fleeT > 0) {
      this.fleeT -= dt;
      this.shots.length = 0;
      const away = this.motion.pos.clone().sub(this.fleeFrom).setY(0).normalize().multiplyScalar(6);
      target = this.motion.pos.clone().add(away);
      speed = this.kit.run;
      face = null;
      aim = 0;
    }
    if (this.tag) this.tag.position.copy(this.head).add(new THREE.Vector3(0, 0.45, 0));
    const step = new THREE.Vector3();
    if (target) {
      step.subVectors(target, this.motion.pos).setY(0);
      const len = step.length();
      if (len > 0.05) step.multiplyScalar(Math.min(speed, len / dt) / len);
      else step.set(0, 0, 0);
    }
    this.vel.lerp(step, 1 - Math.exp(-8 * dt));
    this.moveWithCollision(this.vel.clone().multiplyScalar(dt), colliders);
    // Snipers stand on their perch (a roof or walkway above the street's floor).
    this.motion.pos.y = this.kit.role === "sniper" ? Math.max(ground(this.motion.pos.x, this.motion.pos.z), this.route[0]!.y) : ground(this.motion.pos.x, this.motion.pos.z);
    this.motion.speed = Math.hypot(this.vel.x, this.vel.z);
    this.motion.phase += this.motion.speed * dt * 3.1;
    const lookAt = face ?? (this.motion.speed > 0.2 ? this.motion.pos.clone().add(this.vel) : null);
    if (lookAt) {
      const want = Math.atan2(lookAt.x - this.motion.pos.x, lookAt.z - this.motion.pos.z);
      let dy = want - this.motion.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.motion.yaw += dy * Math.min(1, dt * (this.state === "combat" ? 9 : 4));
      if (face) {
        const dh = face.y - (this.motion.pos.y + 1.5);
        this.motion.pitch = THREE.MathUtils.damp(this.motion.pitch, Math.atan2(dh, flatDist(this.motion.pos, face)), 6, dt);
      }
    }
    this.motion.aim = THREE.MathUtils.damp(this.motion.aim, aim, 5, dt);
    if (this.kit.role === "sniper" && this.state !== "combat") this.charge = 0;
    animate(this.body, this.motion);
    this.body.carry();
    this.body.pose();
    this.placeRifle();
  }

  private moveWithCollision(d: THREE.Vector3, colliders: THREE.Box3[]): void {
    const r = 0.3;
    const p = this.motion.pos;
    p.x += d.x;
    p.z += d.z;
    for (const c of colliders) {
      if (c.max.y < p.y + 0.4 || c.min.y > p.y + 1.7) continue;
      const cx = THREE.MathUtils.clamp(p.x, c.min.x, c.max.x);
      const cz = THREE.MathUtils.clamp(p.z, c.min.z, c.max.z);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const dd = dx * dx + dz * dz;
      if (dd < r * r) {
        if (dd > 1e-8) {
          const l = Math.sqrt(dd);
          p.x = cx + (dx / l) * r;
          p.z = cz + (dz / l) * r;
        } else {
          // Inside: push out along the shallow axis.
          const ox = Math.min(p.x - c.min.x, c.max.x - p.x);
          const oz = Math.min(p.z - c.min.z, c.max.z - p.z);
          if (ox < oz) p.x = p.x - c.min.x < c.max.x - p.x ? c.min.x - r : c.max.x + r;
          else p.z = p.z - c.min.z < c.max.z - p.z ? c.min.z - r : c.max.z + r;
        }
      }
    }
  }

  private placeRifle(): void {
    const b = this.body;
    if (this.shield) {
      // Held on the left forearm, square to the way they face.
      const s = this.shield;
      const lost = b.lost.has("forearmL") || b.lost.has("upperArmL") || !this.alive;
      if (lost && s.parent === b.root && !this.alive) {
        // Dropped: it falls flat where they stood.
        s.position.set(this.motion.pos.x, this.motion.pos.y + 0.03, this.motion.pos.z);
        s.rotation.set(-Math.PI / 2, 0, this.motion.yaw);
      } else if (!lost) {
        s.position.copy(b.joints.handL).addScaledVector(b.facing, 0.12).add(new THREE.Vector3(0, 0.08, 0));
        s.rotation.set(0, this.motion.yaw, 0);
      }
    }
    if (this.laser) {
      const show = this.alive && this.state === "combat" && this.charge > 0.05;
      this.laser.visible = show;
      if (show) {
        const from = new THREE.Vector3();
        const dir = new THREE.Vector3();
        muzzleOf(b, from, dir);
        this.laser.position.copy(from);
        this.laser.lookAt(from.clone().add(dir));
        this.laser.scale.set(1 + this.charge, 1 + this.charge, 60);
        (this.laser.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.6 * (this.charge / SNIPER_CHARGE);
      }
    }
    if (this.kit.role === "orderly" || (b.lost.has("forearmR") && b.lost.has("forearmL"))) {
      this.rifle.visible = false;
      return;
    }
    place(this.rifle, b.joints.handR, b.joints.handL, b.facing.clone().set(0, 1, 0));
  }

  private fleeT = 0;
  private fleeFrom = new THREE.Vector3();
  private tag: THREE.Mesh | null = null;

  /** Vanish: they lose her and go back to searching somewhere near where she was. */
  lose(at: THREE.Vector3): void {
    if (!this.alive) return;
    this.state = "searching";
    this.detect = 0.15;
    this.searchLeft = 12;
    this.lastKnown.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12));
  }

  /** War Cry: they run from her for a while and don't shoot. */
  panic(seconds: number, from: THREE.Vector3): void {
    if (!this.alive) return;
    this.fleeT = seconds;
    this.fleeFrom.copy(from);
    if (this.state !== "combat") this.state = "combat";
    this.detect = 1;
  }

  get fleeing(): boolean {
    return this.fleeT > 0;
  }

  /** Mark: an amber tag over the head, visible through walls. */
  setMarked(on: boolean, mat: THREE.Material): void {
    if (on && !this.tag) {
      const g = new THREE.OctahedronGeometry(0.09, 0);
      this.tag = new THREE.Mesh(g, mat);
      this.tag.renderOrder = 999;
      (this.tag.material as THREE.Material).depthTest = false;
      this.body.root.add(this.tag);
    }
    if (this.tag) this.tag.visible = on;
    this.marked = on;
  }
  marked = false;
  /** Tutorial guards: they don't notice her until something happens to them. */
  passive = false;

  /** A hit: knocks the body (flinch), and returns true if it died. */
  damage(amount: number, push: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    // Into body space for the flinch.
    const inv = -this.motion.yaw;
    this.motion.flinch.x += (push.x * Math.cos(inv) - push.z * Math.sin(inv)) * 0.06;
    this.motion.flinch.z += (push.x * Math.sin(inv) + push.z * Math.cos(inv)) * 0.06;
    if (this.state !== "combat") {
      this.state = "combat";
      this.detect = 1;
    }
    return this.hp <= 0;
  }

  die(impulse: THREE.Vector3, at: THREE.Vector3): void {
    this.state = "dead";
    this.hp = 0;
    this.body.goLimp(impulse, at);
  }
}

function flatDist(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** A compact bullpup rifle, built along +Y from the trigger hand towards the support hand. */
function buildRifle(look: BodyLook): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.45, metalness: 0.7 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  add(new RoundedBoxGeometry(0.06, 0.62, 0.1, 2, 0.015), dark, 0, 0.12, 0.03); // receiver
  add(new THREE.CylinderGeometry(0.013, 0.013, 0.32, 8), dark, 0, 0.58, 0.05); // barrel
  add(new RoundedBoxGeometry(0.04, 0.1, 0.09, 2, 0.01), look.armour, 0, 0.3, 0.1); // optic
  add(new RoundedBoxGeometry(0.03, 0.08, 0.016, 1, 0.005), look.visor, 0, 0.3, 0.155); // optic glow
  add(new RoundedBoxGeometry(0.045, 0.06, 0.14, 2, 0.01), dark, 0, 0.0, -0.06); // grip
  add(new RoundedBoxGeometry(0.05, 0.08, 0.16, 2, 0.012), dark, 0, -0.18, -0.04); // magazine (behind the grip)
  return g;
}
