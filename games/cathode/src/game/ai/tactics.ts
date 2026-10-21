// S11 + S3.5, one fighter's firefight (docs/design/cathode-combat.md C16): he runs to the cover the director gives
// him, and from it he hides, peeks over crouch cover, leans round full cover, blind-fires over it when a round has just
// cracked past him, reloads out loud behind it, and moves when she gets round its side. Every burst is telegraphed
// (the carbine comes up and the visor flares, a rising chirp), opens with two rounds that miss on purpose, and then
// hits at the squad's ramped chance. Riflemen and sergeants only: shields, snipers and the Candor staff keep theirs.

import * as THREE from "three";
import type { Enemy, Sight } from "../enemy";
import type { RayWorld } from "../ray";
import { muzzleOf } from "../animate";
import { RELOAD_KEYS } from "../animate";
import { hitChance, isFlanked, missDistance, RECOVER_MS, type SquadRole } from "./squad";
import type { CoverPoint } from "./cover";
import type { Director } from "./director";
import { moraleAccuracy, moraleBand } from "../../sim/morale";

export type ActKind = "move" | "hide" | "peek" | "lean" | "blind" | "reload" | "open" | "surrender";

/** S3.5 action timings (ms): rise, active range, drop. */
export const ACT = {
  peek: { rise: 250, active: [900, 1600] as const, drop: 250 },
  lean: { rise: 220, active: [1000, 1800] as const, drop: 220 },
  blind: { rise: 150, active: [800, 800] as const, drop: 150 },
  /** The burst's telegraph (raise, flare, chirp) and recovery; rounds 90 ms apart, 3 to 5 a burst. */
  burst: { windup: 350, gap: 90, recover: 250, rounds: [3, 5] as const },
  reload: 2200,
  /** The surrender's kneel; he holds it this long before he runs. */
  kneel: 500,
  surrenderHold: 8000,
  /** Blind fire's accuracy multiplier. */
  blindAcc: 0.3,
} as const;

/** A carbine's magazine (rounds). */
export const MAG = 15;

export interface TacEvent {
  kind: "chirp" | "magOut" | "magIn" | "bolt" | "reloadStart" | "flanked" | "surrender" | "fallBack" | "contact";
  side?: "left" | "right";
}

const UP = new THREE.Vector3(0, 1, 0);

export class Tactics {
  act: ActKind = "open";
  /** ms into the act, and its planned active length. */
  t = 0;
  activeMs = 0;
  /** The cover point he holds or is running to (index into the director's list), and the point. */
  coverIdx = -1;
  cover: CoverPoint | null = null;
  /** Seconds of unbroken sight of her (the accuracy ramp). */
  losT = 0;
  /** The burst: ms into its windup (-1 none), rounds left, the round's index within the burst, ms to the next. */
  windup = -1;
  roundsLeft = 0;
  round = 0;
  gapMs = 0;
  /** ms until he may start another burst. */
  coolMs = 600;
  mag = MAG;
  /** ms into a reload (-1 none). */
  reloadMs = -1;
  /** The eased pose layers, written into motion.tac. */
  readonly pose = { lean: 0, blind: 0, reload: -1, hands: 0 };
  private crouchWant = 0;
  private leanWant = 0;
  private blindWant = 0;
  private handsWant = 0;
  /** ms since she got round his cover (-1: she hasn't); the move comes within RECOVER_MS. */
  flankedMs = -1;
  private flankWait = 400;
  /** Progress watch for a run to cover. */
  private stuckT = 0;
  private bestD = Infinity;
  private moveT = 0;
  /** ms into the surrender (-1 none). */
  surrenderMs = -1;
  /** The last near miss (s ago). */
  lastNearMiss = 99;
  readonly events: TacEvent[] = [];
  /** Seconds he's been trying to move without getting anywhere (the sim's "stuck" metric). */
  stuckFor = 0;
  /** True once morale sent him back (the bark is said once). */
  fellBack = false;

  constructor(
    readonly self: Enemy,
    readonly director: Director,
  ) {}

  get exposed(): boolean {
    return this.act === "peek" || this.act === "lean" || this.act === "blind";
  }

  /** Called from Enemy.update in combat. Returns the movement plan; may push shots onto the enemy. */
  step(dt: number, seen: boolean, sight: Sight, rays: RayWorld): { target: THREE.Vector3 | null; speed: number; face: THREE.Vector3 | null; aim: number } {
    const e = this.self;
    const ms = dt * 1000;
    this.lastNearMiss += dt;
    this.losT = seen ? this.losT + dt : 0;
    // S3.5: a slide or a dodge resets the ramp (she's moving faster than a sprint).
    if (sight.speed > 7.5) this.losT = 0;
    const m = this.director.memberOf(e);
    const role: SquadRole = m?.role ?? "hold";
    const cath = sight.chest;
    const last = e.lastKnown;
    let target: THREE.Vector3 | null = null;
    let speed = 0;
    let face: THREE.Vector3 | null = last;
    let aim = 0.6;

    // ---- surrender: kneel, hands up; after 8 s untouched, he runs ----
    if (this.surrenderMs >= 0) {
      this.surrenderMs += ms;
      this.crouchWant = this.surrenderMs < ACT.kneel ? 1.4 * (this.surrenderMs / ACT.kneel) : 1.4;
      this.handsWant = 1;
      this.ease(dt);
      if (this.surrenderMs > ACT.surrenderHold) {
        this.surrenderMs = -1;
        this.handsWant = 0;
        e.panic(30, cath);
      }
      return { target: null, speed: 0, face: cath, aim: 0 };
    }

    // ---- morale ----
    const lastAlive = this.director.lastAlive(e);
    const band = moraleBand(e.morale, lastAlive);
    if (band === "broken" && !e.unarmed && !e.fleeing) {
      this.surrender();
      return { target: null, speed: 0, face: cath, aim: 0 };
    }
    if (band === "fallback" && !this.fellBack) {
      this.fellBack = true;
      this.events.push({ kind: "fallBack" });
      this.release();
    }

    // ---- reload (behind cover if he has it, wherever he is if not) ----
    if (this.reloadMs >= 0) {
      const was = this.reloadMs;
      this.reloadMs += ms;
      const K = RELOAD_KEYS;
      if (was < K.out && this.reloadMs >= K.out) this.events.push({ kind: "magOut" });
      if (was < K.in && this.reloadMs >= K.in) this.events.push({ kind: "magIn" });
      if (was < K.bolt && this.reloadMs >= K.bolt) this.events.push({ kind: "bolt" });
      if (this.reloadMs >= ACT.reload) {
        this.reloadMs = -1;
        this.mag = MAG;
        this.coolMs = 300;
      }
    } else if (this.mag <= 0 && this.windup < 0 && this.roundsLeft <= 0) {
      this.reloadMs = 0;
      this.events.push({ kind: "reloadStart" });
      if (this.exposed) this.setAct("hide");
    }

    // ---- cover: keep it, or get a new one ----
    const flatCath = { x: cath.x, z: cath.z };
    const knows = this.director.knows(e);
    const cp = this.cover;
    if (cp && knows && this.act !== "move" && isFlanked({ x: cp.fx, z: cp.fz }, cp, flatCath)) {
      if (this.flankedMs < 0) {
        this.flankedMs = 0;
        this.flankWait = 200 + Math.random() * (RECOVER_MS - 250);
        // Which side she came round, as he faces his cover.
        const lx = cp.fz;
        const lz = -cp.fx;
        const side = (cath.x - cp.x) * lx + (cath.z - cp.z) * lz > 0 ? "left" : "right";
        this.events.push({ kind: "flanked", side });
      }
      this.flankedMs += ms;
      if (this.flankedMs >= this.flankWait) {
        this.release();
        this.flankedMs = -1;
      }
    } else if (this.act !== "move") this.flankedMs = -1;

    if (!this.cover || this.wantsNewCover(role)) {
      const pick = this.director.pickCover(e, role, band === "fallback");
      if (pick) {
        this.take(pick.idx, pick.point);
        this.setAct("move");
      } else if (!this.cover) this.setAct("open");
    }

    // ---- open ground: no cover to use (none near, or the district has none) ----
    if (this.act === "open") {
      this.crouchWant = 0;
      this.leanWant = 0;
      this.blindWant = 0;
      face = seen ? cath : last;
      aim = 1;
      const toward = new THREE.Vector3(cath.x - e.position.x, 0, cath.z - e.position.z);
      const d = toward.length();
      toward.normalize();
      const side = new THREE.Vector3(-toward.z, 0, toward.x).multiplyScalar(this.director.strafeSign(e));
      const along = toward.clone().multiplyScalar(d > 18 ? 1 : d < 8 ? -1 : 0);
      target = e.position.clone().add(side.add(along).multiplyScalar(3));
      speed = e.kit.walk * 1.3;
      this.fire(dt, seen, sight, rays, role, 1);
      this.ease(dt);
      return { target, speed, face, aim };
    }

    const c = this.cover!;
    const spot = new THREE.Vector3(c.x, c.y, c.z);

    // ---- running to cover ----
    if (this.act === "move") {
      target = spot;
      const d = Math.hypot(e.position.x - c.x, e.position.z - c.z);
      speed = d > 3 ? e.runSpeed : e.kit.walk * 1.4;
      face = null;
      aim = 0.35;
      this.crouchWant = d < 2 && c.kind === "crouch" ? 0.6 : 0;
      this.moveT += dt;
      if (d < this.bestD - 0.25) {
        this.bestD = d;
        this.stuckT = 0;
      } else this.stuckT += dt;
      this.stuckFor = this.stuckT;
      if (this.stuckT > 1.6) {
        // Walled off: forget this point and try another.
        this.director.ban(e, this.coverIdx);
        this.release();
        this.stuckFor = 0;
      } else if (d < 0.3) {
        this.setAct("hide");
        this.stuckFor = 0;
      }
      // A token holder who has her in sight on the way still shoots (walking pace).
      if (seen && m?.token && d < 6) {
        speed = Math.min(speed, e.kit.walk);
        face = cath;
        aim = 1;
        this.fire(dt, seen, sight, rays, role, 0.8);
      } else this.dropBurst();
      this.ease(dt);
      return { target, speed, face, aim };
    }

    // ---- in cover ----
    this.stuckFor = 0;
    this.t += ms;
    // Hold the spot (and step out to the side to lean, back in to hide).
    const leanStep = this.act === "lean" ? 0.38 * Math.min(1, this.t / ACT.lean.rise) : 0;
    target = spot.clone().add(new THREE.Vector3(c.fz * c.lean, 0, -c.fx * c.lean).multiplyScalar(leanStep));
    speed = e.kit.walk * 1.2;
    const coverFace = new THREE.Vector3(c.x + c.fx, c.y, c.z + c.fz);
    const shooter = !!m?.token || role === "suppress";
    if (this.reloadMs >= 0) {
      this.setActIf("hide");
      this.crouchWant = c.kind === "crouch" ? 1.6 : 0.25;
      this.leanWant = 0;
      this.blindWant = 0;
      face = coverFace;
      aim = 0.3;
    } else if (this.act === "hide") {
      this.crouchWant = c.kind === "crouch" ? 1.6 : 0;
      this.leanWant = 0;
      this.blindWant = 0;
      face = knows ? last : coverFace;
      aim = 0.45;
      if (this.t >= this.activeMs) {
        // Out again: blind fire when a round just cracked past him, peek or lean otherwise. A man with no token
        // and no suppression job looks without shooting (he keeps the squad's eyes on her).
        if (this.lastNearMiss < 1.5 && knows && (c.kind === "full" || shooter)) this.setAct("blind");
        else this.setAct(c.kind === "crouch" ? "peek" : "lean");
      }
    } else {
      const spec = ACT[this.act as "peek" | "lean" | "blind"];
      const rise = this.t < spec.rise;
      const dropping = this.t > spec.rise + this.activeMs;
      const k = rise ? this.t / spec.rise : dropping ? Math.max(0, 1 - (this.t - spec.rise - this.activeMs) / spec.drop) : 1;
      if (this.act === "peek") this.crouchWant = 1.6 - 1.3 * k;
      else if (this.act === "lean") {
        this.crouchWant = 0;
        this.leanWant = c.lean * k;
      } else {
        this.crouchWant = c.kind === "crouch" ? 1.6 : 0.9;
        this.blindWant = k;
      }
      face = seen ? cath : last;
      aim = this.act === "blind" ? 1 : 0.5 + 0.5 * k;
      if (!rise && !dropping) {
        const acc = this.act === "blind" ? ACT.blindAcc : 1;
        // Blind fire needs no sight of her: he sprays at where she was.
        if (shooter || this.act === "blind") this.fire(dt, this.act === "blind" ? knows : seen, sight, rays, role, acc);
      } else if (dropping) this.dropBurst();
      if (this.t >= spec.rise + this.activeMs + spec.drop) {
        this.dropBurst();
        this.setAct("hide");
      }
    }
    this.ease(dt);
    return { target, speed, face, aim };
  }

  /** Back to a fresh fighter (a revive or a stage reset). */
  reset(): void {
    this.release();
    this.act = "open";
    this.t = 0;
    this.losT = 0;
    this.dropBurst();
    this.coolMs = 600;
    this.mag = MAG;
    this.reloadMs = -1;
    this.surrenderMs = -1;
    this.flankedMs = -1;
    this.fellBack = false;
    this.lastNearMiss = 99;
    this.crouchWant = this.leanWant = this.blindWant = this.handsWant = 0;
    Object.assign(this.pose, { lean: 0, blind: 0, reload: -1, hands: 0 });
    this.events.length = 0;
  }

  /** The kneel and hands-up; the carbine goes down in the street. */
  surrender(): void {
    if (this.surrenderMs >= 0) return;
    this.surrenderMs = 0;
    this.release();
    this.act = "surrender";
    this.dropBurst();
    this.reloadMs = -1;
    this.events.push({ kind: "surrender" });
    this.self.dropRifle();
  }

  get surrendered(): boolean {
    return this.surrenderMs >= 0;
  }

  /** A round cracked past his head (the session's near-miss check). */
  nearMiss(): void {
    this.lastNearMiss = 0;
    // Exposed and shaken: he drops back into cover early.
    if (this.exposed && this.act !== "blind") {
      const spec = ACT[this.act as "peek" | "lean"];
      this.activeMs = Math.min(this.activeMs, Math.max(0, this.t - spec.rise));
    }
  }

  private wantsNewCover(role: SquadRole): boolean {
    if (!this.cover || this.act === "move") return false;
    // The flanker leaves once he's reached his spot only when the squad gives him a new job; advance pushes up.
    if (role === "advance" && this.act === "hide" && this.t > 1200 && this.director.tooFar(this.self)) return true;
    if (role === "flank" && this.act === "hide" && this.t > 600 && !this.director.flankSpot(this.self)) return true;
    return false;
  }

  private take(idx: number, p: CoverPoint): void {
    this.director.claim(this.self, idx);
    this.coverIdx = idx;
    this.cover = p;
    this.stuckT = 0;
    this.bestD = Infinity;
    this.moveT = 0;
  }

  /** Lets go of his cover (another is picked next frame). */
  release(): void {
    this.director.unclaim(this.self);
    this.coverIdx = -1;
    this.cover = null;
    this.act = "open";
  }

  private setAct(a: ActKind): void {
    this.act = a;
    this.t = 0;
    if (a === "hide") this.activeMs = (this.director.memberOf(this.self)?.token ? 450 : 900) + Math.random() * 900;
    else if (a === "peek" || a === "lean" || a === "blind") {
      const [lo, hi] = ACT[a].active;
      this.activeMs = lo + Math.random() * (hi - lo);
    }
  }

  private setActIf(a: ActKind): void {
    if (this.act !== a) this.setAct(a);
  }

  private dropBurst(): void {
    this.windup = -1;
    this.roundsLeft = 0;
  }

  /**
   * Bursts: a 350 ms windup (the chirp; the visor's flare rides the raised aim), then 3 to 5 rounds 90 ms apart, the
   * first two of each burst wide on purpose; then 250 ms of recovery and the kit's pause.
   */
  private fire(dt: number, seen: boolean, sight: Sight, rays: RayWorld, role: SquadRole, accMul: number): void {
    const e = this.self;
    const ms = dt * 1000;
    if (this.reloadMs >= 0 || e.unarmed || !e.rifleUp) return;
    this.coolMs -= ms;
    if (this.windup < 0 && this.roundsLeft <= 0) {
      if (!seen || this.coolMs > 0 || this.mag <= 0) return;
      this.windup = 0;
      this.events.push({ kind: "chirp" });
      return;
    }
    if (this.windup >= 0) {
      this.windup += ms;
      if (this.windup < ACT.burst.windup) return;
      this.windup = -1;
      const [a, b] = ACT.burst.rounds;
      this.roundsLeft = Math.min(this.mag, a + Math.floor(Math.random() * (b - a + 1)));
      this.round = 0;
      this.gapMs = 0;
    }
    this.gapMs -= ms;
    if (this.gapMs > 0) return;
    this.gapMs = ACT.burst.gap;
    this.roundsLeft--;
    this.mag--;
    const m = this.director.memberOf(e);
    const p = hitChance({
      round: this.round,
      losT: this.losT,
      token: !!m?.token,
      role,
      difficulty: this.director.difficulty,
      mul: e.aimMul() * moraleAccuracy(e.morale, this.director.lastAlive(e)) * accMul * (1 - Math.min(0.35, sight.speed / 14)),
    });
    const hit = Math.random() < p;
    const warning = this.round < 2;
    this.round++;
    const from = new THREE.Vector3();
    const dir = new THREE.Vector3();
    muzzleOf(e.body, from, dir);
    const aimAt = (seen ? sight.chest : e.lastKnown.clone().setY(e.lastKnown.y + 1.2)).clone();
    const line = aimAt.clone().sub(from).normalize();
    if (hit) {
      aimAt.add(new THREE.Vector3((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16));
    } else {
      // Off to a side or high, so the round snaps past her head or sparks the wall beside her.
      const sideV = new THREE.Vector3().crossVectors(line, UP).normalize();
      const ang = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.6;
      const off = sideV.multiplyScalar(Math.cos(ang)).add(UP.clone().multiplyScalar(Math.abs(Math.sin(ang)) * 0.8 + 0.15));
      aimAt.addScaledVector(off.normalize(), missDistance(Math.random, warning));
    }
    e.shots.push({ from, dir: aimAt.sub(from).normalize(), warning });
    e.motion.kick = 1;
    void rays;
    if (this.roundsLeft <= 0) {
      this.coolMs = ACT.burst.recover + e.kit.burst[2] * 1000 * (0.6 + Math.random() * 0.5);
    }
  }

  private ease(dt: number): void {
    const k = Math.min(1, dt * 12);
    const e = this.self;
    e.motion.crouch += (this.crouchWant - e.motion.crouch) * k;
    this.pose.lean += (this.leanWant - this.pose.lean) * k;
    this.pose.blind += (this.blindWant - this.pose.blind) * Math.min(1, dt * 16);
    this.pose.hands += (this.handsWant - this.pose.hands) * Math.min(1, dt * 7);
    this.pose.reload = this.reloadMs;
    e.motion.tac = this.pose;
  }
}
