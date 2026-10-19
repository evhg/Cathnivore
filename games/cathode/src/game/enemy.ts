// Hollowell Enforcers on the street: a Body, a rifle, and a small brain. They patrol routes, notice Cath
// through a vision cone (distance, light, her stance and movement), investigate noises, search where she
// was last seen, and fight in bursts. Rules numbers (health, damage, detection) come from sim/ once wired.

import { tuning } from "./feel/tuning";
import * as THREE from "three";
import { Body, enforcerLook, place, tagUnflashed, bodyView, type BodyLook, type Zone } from "./body";
import { archFor } from "./models/enforcer";
import { buildRifle, buildShield, rifleLod, BOLT_KICK_M, type Rifle } from "./models/gear";
import { DEATH, DeathRun, DroppedProp, helmetPops, pickVariant, visorLevel, type DeathCtx, type DeathVariant } from "./death";
import { Flinch, flinchImpulse, flinchScale } from "./anim/springs";
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
  role?: "rifle" | "shield" | "sniper" | "orderly" | "nurse" | "civilian" | "turret" | "hunter";
  /** Elite modifiers (sim/enemies.ts): extraFast, stoneskin, multipleShots and the rest. */
  elite?: boolean;
  mods?: readonly string[];
  /** Seconds of Cath's bullet-time each hit drains (Cursed). */
  drain?: number;
  /** Shield bearers with this slam the shield into Cath when she's within reach (melee). */
  bash?: boolean;
  /** C10 (S3.2): a squad leader wears the helmet crest and a red visor stripe. */
  leader?: boolean;
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

/** Board Tower security: a heavier corporate shield guard that slams the shield when Cath gets close (act 4). */
export const BOARD_GUARD: EnemyKit = {
  ...RIOT_SHIELD,
  name: "Board Security",
  maxHp: 170,
  armour: 0.45,
  damage: 8,
  walk: 1.4,
  xp: 110,
  visor: 0xffc040,
  bash: true,
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

/** A Candor nurse: frail and armed with a dart pistol, but patches every ally within NURSE_RANGE. Kill her first. */
export const NURSE: EnemyKit = {
  name: "Candor Nurse",
  maxHp: 70,
  armour: 0,
  damage: 4,
  burst: [1, 0, 1.4],
  spread: 0.05,
  walk: 1.6,
  run: 4.5,
  vision: { range: 24, fov: (110 * Math.PI) / 180 },
  hearing: 1.2,
  xp: 60,
  visor: 0xff7ad0,
  role: "nurse",
};
/** A vault sentry turret: bolted down, thick plating, wide fast bursts. Never moves; flank it or break line of sight. */
export const TURRET: EnemyKit = {
  name: "Vault Turret",
  maxHp: 240,
  armour: 0.45,
  damage: 7,
  burst: [5, 0.08, 1.3],
  spread: 0.05,
  walk: 0,
  run: 0,
  vision: { range: 46, fov: (150 * Math.PI) / 180 },
  hearing: 0.8,
  xp: 110,
  visor: 0xff2a2a,
  role: "turret",
};
/** A vault hunter drone: fragile and quick, it circles Cath at mid range firing short bursts. */
export const HUNTER: EnemyKit = {
  name: "Hunter Drone",
  maxHp: 55,
  armour: 0,
  damage: 6,
  burst: [2, 0.1, 0.8],
  spread: 0.04,
  walk: 4,
  run: 9.5,
  vision: { range: 40, fov: (140 * Math.PI) / 180 },
  hearing: 1.4,
  xp: 65,
  visor: 0x30ffe0,
  role: "hunter",
};
/** A council police drone: a sturdier hunter in civic blue that patrols the plaza and hounds Cath through the rain. */
export const POLICE_DRONE: EnemyKit = {
  ...HUNTER,
  name: "Police Drone",
  maxHp: 80,
  damage: 5,
  burst: [3, 0.1, 1.0],
  xp: 80,
  visor: 0x4a8cff,
};
/** A bystander at the plaza rally: unarmed, wanders, bolts at gunfire. Killing one costs Cath (see session onKill). */
export const CIVILIAN: EnemyKit = {
  name: "Bystander",
  maxHp: 40,
  armour: 0,
  damage: 0,
  burst: [1, 0, 9],
  spread: 0,
  walk: 1.2,
  run: 5,
  vision: { range: 20, fov: (120 * Math.PI) / 180 },
  hearing: 1.6,
  xp: 0,
  visor: 0xffd9a0,
  role: "civilian",
};

/** Metres within which a nurse heals allies, the fraction of max health restored per second, and the cap. */
export const NURSE_RANGE = 9;
export const NURSE_HEAL = 0.06;

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
  /** C10: the carbine's moving parts (the bolt kicks when he fires). */
  private readonly gun: Rifle;
  hp: number;
  state: Awareness = "unaware";
  /** 0..1 detection meter: fills while she's seen, drains when she's not. */
  detect = 0;
  readonly motion: Motion;
  /** Hit flinch springs (S4.1), read by animate(). */
  readonly flinch = new Flinch();
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
  /**
   * C8 (S6.6): she is down and this is the man who did it. He stops where he is, faces her body and lowers his
   * weapon (the "stand down" pose); he fires no more.
   */
  standDown: THREE.Vector3 | null = null;
  /** Set when the session found this body and raised the alarm. */
  found = false;
  readonly vel = new THREE.Vector3();
  /** The riot shield (shield bearers only), and the sniper's laser. */
  shield: THREE.Object3D | null = null;
  private bashCd = 0;
  laser: THREE.Mesh | null = null;
  /** Sniper: seconds of steady aim built up; fires at SNIPER_CHARGE. */
  charge = 0;
  /** C9 (S4.4): how he went down, and the long gun once it has left his hands. */
  deathVariant: DeathVariant | null = null;
  drop: DroppedProp | null = null;
  /**
   * C9: what the body did this frame, for the session's audio and gore: the death rattle, joints thudding on the
   * floor (gear on a chest landing), the gun clattering, the wall-slump smear. Drained by the session.
   */
  readonly deathEvents: Array<{ kind: "rattle" | "thud" | "gear" | "clatter" | "smear" | "trail"; at: THREE.Vector3; k: number }> = [];
  /** S4.2: below 25% health he leaves a drip on the street every 1.2 m. */
  private trailFrom = new THREE.Vector3(NaN, 0, 0);
  /** The killing round's travel, flat (where the wall behind him is, for the slump smear). */
  readonly deathDir = new THREE.Vector3();
  private smeared = false;
  /** Shots this frame, for the session to resolve: from, direction. */
  readonly shots: Array<{ from: THREE.Vector3; dir: THREE.Vector3; melee?: boolean }> = [];

  constructor(
    readonly kit: EnemyKit,
    route: THREE.Vector3[],
    readonly level = 1,
    // Hollowell's roles rim in its amber; the Candor staff and bystanders who borrow the body rim in their own colour.
    look: BodyLook = enforcerLook(kit.visor, archFor(kit.role, kit.leader), ["orderly", "nurse", "hunter", "civilian"].includes(kit.role ?? "") ? kit.visor : 0xffa040),
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
      flinch: this.flinch,
      kick: 0,
    };
    // Face along the route from the start, not at whatever happens to lie north.
    const next = this.route[1];
    if (next) this.motion.yaw = Math.atan2(next.x - start.x, next.z - start.z);
    this.gun = buildRifle(bodyView.phone, kit.role === "sniper");
    this.rifle = this.gun.root;
    tagUnflashed(this.rifle);
    this.body.root.add(this.rifle);
    if (kit.role === "shield") {
      this.shield = buildShield(kit.visor, bodyView.phone);
      tagUnflashed(this.shield);
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
    if (this.kit.role === "civilian") {
      this.panic(6, at);
      return;
    }
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
    if (this.alive && this.hp < this.kit.maxHp * 0.25 && this.kit.role !== "turret") {
      if (Number.isNaN(this.trailFrom.x)) this.trailFrom.copy(this.motion.pos);
      else if (flatDist(this.trailFrom, this.motion.pos) >= 1.2) {
        this.trailFrom.copy(this.motion.pos);
        this.deathEvents.push({ kind: "trail", at: this.motion.pos.clone(), k: 1 });
      }
    }
    // Bystanders never fight: once they stop running they calm down and wander again.
    if (this.kit.role === "civilian" && this.state === "combat" && this.fleeT <= 0) this.state = "unaware";
    this.flinch.update(dt);
    // A round that just missed: a duck that eases back up, and shakier aim for a second (S1.1).
    this.suppressT = Math.max(0, this.suppressT - dt);
    this.duckT = Math.max(0, this.duckT - dt);
    this.motion.crouch += ((this.duckT > 0 && this.alive ? 0.55 : 0) - this.motion.crouch) * Math.min(1, dt * 14);
    this.motion.kick = Math.max(0, this.motion.kick - dt * 8);
    if (!this.alive) {
      this.deadFor += dt;
      this.body.physics(dt, { colliders, ground });
      this.deathTick(dt, colliders, ground);
      this.body.pose(dt);
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
        const want = this.kit.role === "hunter" ? 9 : 14;
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
        if (this.kit.role === "turret") target = null;
        if (this.kit.role === "hunter") {
          this.strafeT -= dt * 1.5;
          speed = this.kit.run;
          target = this.motion.pos.clone().add(side.clone().multiplyScalar(2)).add(along.clone().multiplyScalar(2));
        }
        if (this.kit.role === "shield") {
          // Shield bearers walk straight at her behind the shield.
          target = d > 4 ? sight.chest.clone() : null;
          speed = this.kit.walk;
          this.bashCd -= dt;
          if (this.kit.bash && seen && d <= ORDERLY_REACH && this.bashCd <= 0) {
            this.bashCd = 1.6;
            const from = this.motion.pos.clone().setY(sight.chest.y);
            this.shots.push({ from, dir: new THREE.Vector3().subVectors(sight.chest, from).normalize(), melee: true });
            this.motion.kick = 1;
          }
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
            const spread = (this.kit.spread * (1 + Math.min(3, sight.speed / 2))) / this.aimMul();
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
          const spread = (this.kit.spread * (1 + Math.min(2, sight.speed / 3)) * (0.6 + 0.4 * (dist / 10))) / this.aimMul();
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
    if (this.standDown) {
      target = null;
      face = this.standDown;
      aim = 0.15;
      this.shots.length = 0;
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
    this.motion.aim = THREE.MathUtils.damp(this.motion.aim, aim, this.standDown ? 14 : 5, dt);
    if (this.kit.role === "sniper" && this.state !== "combat") this.charge = 0;
    // S3.1: past LOD1's range the body animates at 15 Hz (every fourth frame at 60).
    this.animTick = (this.animTick + 1) % 4;
    if (this.body.lod < 2 || this.animTick === 0) {
      animate(this.body, this.motion);
      this.body.carry();
    }
    // S3.1: the faction rim comes up in a fight (0.3 at rest, 0.6 in combat).
    this.body.alert += ((this.state === "combat" ? 1 : 0) - this.body.alert) * Math.min(1, dt * 3);
    // S3.5: raising the rifle to aim flares the visor (x1.0 to x1.6): the tell that he's about to fire.
    this.body.visorAim = 1 + (tuning.enemyLook.visor.aimFlare - 1) * Math.max(0, Math.min(1, this.motion.aim));
    this.body.pose(dt);
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
        // S3.2: the sniper's laser starts at the round lens on his helmet (it reads as him looking at her).
        const helm = b.root.getObjectByName("helmet");
        if (helm && !b.helmetOff) {
          helm.updateMatrixWorld();
          helm.localToWorld(from.set(0, 0.012, 0.19));
        }
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
    if (this.drop) {
      // On the floor where it fell (C9): placed along its two points, the optic up.
      place(this.rifle, this.drop.a, this.drop.b, b.facing.clone().set(0, 1, 0));
      return;
    }
    place(this.rifle, b.joints.handR, b.joints.handL, b.facing.clone().set(0, 1, 0));
    this.rifle.scale.setScalar(b.scale);
    rifleLod(this.gun, b.lod);
    // The bolt kicks back 15 mm on each round (the recoil kick decays at 8/s).
    this.gun.bolt.position.z = Math.min(1, this.motion.kick * 2) * BOLT_KICK_M;
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

  /** Seconds of shaken aim left after a near miss, and of the duck. */
  suppressT = 0;
  duckT = 0;

  /** Accuracy multiplier: a near miss leaves them at 0.6 for a second. */
  aimMul(): number {
    return this.suppressT > 0 ? tuning.nearMiss.accuracyMul : 1;
  }

  /**
   * A round passed within half a metre of their head (S1.1): the head snaps aside about 8 degrees, they duck
   * for 400 ms and their aim is shaken for a second. Returns true when they should bark "Taking fire!".
   */
  nearMiss(dir: THREE.Vector3): boolean {
    if (!this.alive) return false;
    const N = tuning.nearMiss;
    const inv = -this.motion.yaw;
    // The head snaps aside, away from the round's path (about 8 degrees), in body space.
    const d = toBody(dir, inv);
    const imp = flinchImpulse("head", d, 1, 1);
    const k = N.flinchDeg / tuning.flinch.zones.head.pitchDeg;
    this.flinch.hit("head", { ...imp, headTip: imp.headTip * k, headYaw: 0, rootX: 0, rootZ: 0 }, d);
    this.duckT = N.duckMs / 1000;
    const fresh = this.suppressT <= 0;
    this.suppressT = N.accuracyMs / 1000;
    if (this.state !== "combat" && this.kit.role !== "civilian") {
      this.state = "combat";
      this.detect = 1;
    }
    return fresh && Math.random() < N.barkChance;
  }

  /**
   * Screenshot stages (S0): advances only the body (flinch springs, hit flash, ragdoll), with no AI or
   * movement, so a frozen frame can show the moment `t` ms after a round.
   */
  feel(dt: number, colliders: THREE.Box3[], ground: (x: number, z: number) => number): void {
    this.flinch.update(dt);
    this.body.updateFlash(dt * 1000);
    if (!this.alive) {
      this.deadFor += dt;
      this.body.physics(dt, { colliders, ground });
      this.deathTick(dt, colliders, ground);
    } else {
      animate(this.body, this.motion);
      this.body.carry();
    }
    this.body.pose(dt);
    this.placeRifle();
  }

  /** How much this archetype shrugs a hit off (S4.1): heavier kits flinch less, but always flinch. */
  get poise(): number {
    const P = tuning.flinch.poise;
    if (this.kit.role === "turret") return P.turret;
    if (this.kit.role === "shield") return P.shield;
    return this.kit.elite ? P.elite : P.default;
  }

  /**
   * A hit's flinch (S4.1): the zone's springs, kicked along the round's travel, scaled by the share of
   * health it took. `point` says which side of the body it struck.
   */
  react(zone: Zone, dir: THREE.Vector3, point: THREE.Vector3, damage: number, weaponCls = "pistol", distance = 10, segment?: string): void {
    if (!this.alive) return;
    if (segment) this.body.flash(segment);
    const inv = -this.motion.yaw;
    const d = toBody(dir, inv);
    const rel = toBody(new THREE.Vector3().subVectors(point, this.motion.pos), inv);
    const scale = flinchScale(damage, this.kit.maxHp, this.poise);
    // Which side of the body it struck: off the centre line by more than 4 cm, that side; a dead-centre hit goes
    // with the round's own sideways travel (from her right, it pushes left). Idle sway and a hash of the point
    // flipped it from run to run, so the same staged chest shot moved the head 2.6 or 9.2 px (C2 review).
    const side = Math.abs(rel.x) > 0.04 ? rel.x : d.x <= 0 ? 1 : -1;
    this.flinch.hit(zone, flinchImpulse(zone, d, side, scale, weaponCls, distance), d, side);
    // S4.1: an arm hit opens that hand 30 degrees off the grip.
    if (zone === "armL" || zone === "armR") this.body.openHand(zone === "armL" ? "L" : "R");
  }

  /** A hit: takes the damage (the flinch is react's job), and returns true if it died. */
  damage(amount: number, _push?: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.state !== "combat") {
      this.state = "combat";
      this.detect = 1;
    }
    return this.hp <= 0;
  }

  /** Screenshot stages (S0): alive, calm, unhurt and standing still, so every stage starts from the same body. */
  revive(): void {
    this.state = "unaware";
    this.hp = this.kit.maxHp;
    this.detect = 0;
    this.deadFor = 0;
    this.found = false;
    this.charge = 0;
    this.duckT = this.suppressT = 0;
    this.shots.length = 0;
    this.vel.set(0, 0, 0);
    Object.assign(this.motion, { speed: 0, phase: 0, pitch: 0, crouch: 0, aim: 0, kick: 0 });
    this.flinch.reset();
    this.body.revive();
    this.deathVariant = null;
    this.drop = null;
    this.smeared = false;
    this.deathEvents.length = 0;
    this.rifle.visible = this.kit.role !== "orderly";
    this.body.visorLevel = 1;
  }

  /**
   * The lethal frame (S4.4). `ctx` is what combat knows about the killing blow (zone, weapon, range, which side,
   * a wall or rail nearby); `forced` picks the variant outright (screenshot stages). Without a context the push
   * itself says which way it came from.
   */
  die(impulse: THREE.Vector3, at: THREE.Vector3, ctx?: Partial<DeathCtx>, forced?: DeathVariant): void {
    this.state = "dead";
    this.hp = 0;
    const yaw = this.motion.yaw;
    const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const flat = new THREE.Vector3(impulse.x, 0, impulse.z);
    const side = flat.lengthSq() > 1e-8 ? flat.normalize().dot(left) : 0;
    this.deathDir.copy(flat);
    const c: DeathCtx = { zone: "torso", weaponCls: "rifle", distance: 10, side, seed: this.id, ...ctx };
    const v = forced ?? pickVariant(c);
    this.deathVariant = v;
    // A body that is already missing parts falls as a plain ragdoll: no pose to pull a stump toward.
    const run = this.body.lost.size ? null : new DeathRun(v, c, this.motion.pos, yaw);
    let imp = impulse;
    if (v === "blownback") imp = impulse.clone().multiplyScalar(DEATH.blownMul).add(new THREE.Vector3(0, DEATH.blownUp, 0));
    this.body.onImpact = (j, speed, p) => this.deathEvents.push({ kind: j === "chest" || j === "pelvis" ? "gear" : "thud", at: p.clone(), k: Math.min(1, speed / 5) });
    this.body.goLimp(imp, at, run ?? undefined);
    if (v === "headshot" && !this.body.lost.has("head")) {
      // The head snaps back along the round: 6 m/s on the head all told (S4.4), half on the neck.
      const d = impulse.clone().normalize();
      const have = impulse.length() * Math.max(0.25, 1 - this.body.joints.head.distanceTo(at) * 0.8);
      const more = Math.max(0, DEATH.headKick - have);
      this.body.kick("head", d.clone().multiplyScalar(more));
      this.body.kick("neck", d.clone().multiplyScalar(more * 0.5));
      // 40% of the time the helmet goes: off the back of his head along the round, rolling on its shell.
      if (c.helmetPop ?? helmetPops(c.seed)) {
        const H = DEATH.helmet;
        const vel = d.multiplyScalar(H.along).add(new THREE.Vector3(0, H.up, 0));
        const spin = (c.seed % 2 ? 1 : -1) * H.spin;
        this.body.popHelmet(vel, spin, (speed, at) => this.deathEvents.push({ kind: "clatter", at: at.clone(), k: Math.min(1, speed / 5) }));
      }
    }
    this.body.deathGlow();
    this.deathEvents.push({ kind: "rattle", at: this.body.joints.head.clone(), k: 1 });
  }

  /**
   * The seconds after the lethal frame (S4.4 "every death"): the visor light goes out (fading over 900 ms with two
   * flickers), the long gun leaves the hands 200 ms into the fall (or on the first limp frame) and clatters as a
   * two-point body, and a slump down a wall leaves a smear.
   */
  private deathTick(dt: number, colliders: THREE.Box3[], ground: (x: number, z: number) => number): void {
    const ms = this.deadFor * 1000;
    this.body.visorLevel = visorLevel(ms);
    const run = this.body.dying;
    const b = this.body;
    if (!this.drop && this.rifle.visible && this.kit.role !== "orderly" && !this.shield && (!run || run.t >= Math.min(run.dur, DEATH.dropMs) || !run.active)) {
      const vel = new THREE.Vector3().subVectors(b.joints.handR, this.lastHand).divideScalar(Math.max(1e-3, dt));
      if (!Number.isFinite(vel.x) || vel.lengthSq() > 100) vel.set(0, 0, 0);
      // Thrown a little out from the body, along his front.
      vel.add(new THREE.Vector3(Math.sin(this.motion.yaw), 0.6, Math.cos(this.motion.yaw)).multiplyScalar(0.9));
      const a = b.joints.handR.clone();
      const dirG = new THREE.Vector3().subVectors(b.joints.handL, b.joints.handR);
      if (dirG.lengthSq() < 1e-4) dirG.set(0, 0, 1);
      const bb = a.clone().addScaledVector(dirG.normalize(), 0.62);
      this.drop = new DroppedProp(a, bb, vel, ((this.id % 5) - 2) * 2.5, (speed, at) => this.deathEvents.push({ kind: "clatter", at: at.clone(), k: Math.min(1, speed / 4) }));
    }
    this.lastHand.copy(b.joints.handR);
    this.drop?.step(dt, ground, colliders);
    if (this.deathVariant === "wallslump" && !this.smeared && run && run.t > 260) {
      this.smeared = true;
      // From where his shoulders hit (the neck at the slam), so the top of the run shows above his head once he
      // sits: from the chest it hid wholly behind the body (C9 review).
      this.deathEvents.push({ kind: "smear", at: b.joints.neck.clone(), k: 1 });
    }
  }
  private lastHand = new THREE.Vector3();
  private animTick = 0;

  /** S3.2: where a fired round's casing leaves the carbine (its right flank, over the grip) and how fast. */
  brass(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const b = this.body;
    const d = new THREE.Vector3().subVectors(b.joints.handL, b.joints.handR).normalize();
    const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    pos.copy(b.joints.handR).addScaledVector(d, 0.04).add(new THREE.Vector3(0, 0.08, 0)).addScaledVector(right, 0.03);
    vel.copy(right).multiplyScalar(2.2 + Math.random() * 0.6).add(new THREE.Vector3(0, 1.6 + Math.random() * 0.5, 0)).addScaledVector(d, -0.4);
  }
}

/** A world direction into body space (yaw undone): x to the body's left, z forward. */
function toBody(v: THREE.Vector3, inv: number): { x: number; y: number; z: number } {
  return { x: v.x * Math.cos(inv) + v.z * Math.sin(inv), y: v.y, z: -v.x * Math.sin(inv) + v.z * Math.cos(inv) };
}

function flatDist(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
