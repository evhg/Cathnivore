// Resolving violence: hitscan rounds and shotgun pellets, ballistic sniper rounds with drop and wind, the
// Pin's swing, silent takedowns, hit zones, armour, severed limbs, gore, noise, and the kill events the
// session turns into XP and the kill-cam. Numbers mirror sim/damage.ts's rules for the slice.

import * as THREE from "three";
import type { World } from "../render/types";
import type { Enemy } from "./enemy";
import type { RayWorld } from "./ray";
import type { Shot, WeaponDef } from "./weapons";
import type { Zone } from "./body";
import { DEATH, type DeathCtx, type DeathVariant } from "./death";
import type { WeaponClass } from "../sim/types";
import { CombatBus } from "./feel/bus";
import { tuning } from "./feel/tuning";
import { AUTOMATIC, type HitEvent as HitData, type HitLayer, type Vec3Like } from "../sim/hitevent";
import { PASS_THROUGH, passes, penetrationOf, type CoverMat } from "../sim/penetration";
import { surfaceOf } from "../render/builder";

export interface KillEvent {
  enemy: Enemy;
  weapon: WeaponDef;
  zone: Zone;
  headshot: boolean;
  distance: number;
  /** Nobody was hunting Cath when it happened. */
  unseen: boolean;
  severed: string[];
  takedown: boolean;
}

export interface HitEvent {
  enemy: Enemy;
  zone: Zone;
  damage: number;
  point: THREE.Vector3;
  killed: boolean;
  /** The full event the bus carried (S0). */
  data?: HitData;
}

/** A round cover ate with an enemy in line behind it (S1.1). */
export interface BlockEvent {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  mat: CoverMat;
  enemy: Enemy;
}

/** What `traceShot` reports: what a round from `from` towards `to` would do, without firing it. */
export interface ShotTrace {
  blockedBy: string | null;
  mat: CoverMat | null;
  enemy: string | null;
  zone: Zone | null;
  damage: number;
  pen: boolean;
}

interface Projectile {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  weapon: WeaponDef;
  from: THREE.Vector3;
  travelled: number;
  /** The kill-cam is riding this round. */
  cam: boolean;
  /** For the kill-cam: the target it's predicted to hit (the round homes on it, a cinematic cheat). */
  target?: { enemy: Enemy; joint: "head" | "chest" };
  alive: boolean;
  /** Layers of cover it can still punch through (S1.1: two for the sniper). */
  pen?: number;
  /** Share of damage left after the cover it went through. */
  mul?: number;
}

export interface Build {
  /** Damage multiplier per weapon class, from attributes and skills. */
  damage: (weaponClass: WeaponClass) => number;
  headshot: number;
  crit: number;
  critMul: number;
}

const EXPLOSIVE: WeaponDef = { id: "frag", name: "Frag grenade", model: "pin", weaponClass: "melee", kind: "melee", damage: 0, pellets: 1, cycle: 0, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 60, kick: 0, range: 0 };

/** Hostiles that count toward an encounter (bystanders and nurses don't fight). */
const NON_COMBATANT = new Set(["civilian", "nurse"]);

/**
 * True when a kill ends the fight (S1.4's last enemy): no other armed enemy is in combat or searching, and
 * none stands within `nearM` of the one that fell.
 */
export function encounterCleared(
  fallen: { position: THREE.Vector3 },
  enemies: { alive: boolean; state: string; position: THREE.Vector3; kit: { role?: string } }[],
  nearM = 20,
): boolean {
  return !enemies.some(
    (x) => x !== fallen && x.alive && !NON_COMBATANT.has(x.kit.role ?? "rifle") && (x.state === "combat" || x.state === "searching" || x.position.distanceTo(fallen.position) < nearM),
  );
}

const ZONE_MUL: Record<Zone, number> = { head: 2.5, torso: 1, armL: 0.7, armR: 0.7, legL: 0.75, legR: 0.75 };
const GRAVITY = 9.81;

export class Combat {
  readonly projectiles: Projectile[] = [];
  readonly kills: KillEvent[] = [];
  readonly hits: HitEvent[] = [];
  /** Rounds that cover or a shield stopped with a living enemy in line behind (for the "blocked" cue). */
  blocks = 0;
  /** This frame's blocked rounds, with where and what stopped them. */
  readonly blockEvents: BlockEvent[] = [];
  /** Combat only emits; HUD, audio, FX and camera listen (S0). */
  readonly bus = new CombatBus();
  /** Session wiring: the gun in hand and the build, the defaults for traceShot (window.cathode.combat.traceShot). */
  held?: () => { w: WeaponDef; build: Build };
  /** Set by the session (S0 debug, window.cathode.combat.replay): emits HitEvents on the bus and confirms them. */
  replay?: (events: HitData[]) => string | null;
  /** Seconds since the session began, for event stamps. */
  clock = 0;
  /** The last round's penetration share and whether it went through cover. */
  private penMul = 1;
  private penThrough = false;
  /** Penetration bonus from the build (skills, legendaries). */
  penBonus = 0;
  /** Screenshot stages: no tracer or muzzle flash (seen end-on from the eye, a frozen tracer fills the frame). */
  quiet = false;
  /** The last round a riot shield stopped (for sparks). */
  blocked: { point: THREE.Vector3; normal: THREE.Vector3 } | null = null;
  /** Damage dealt to each segment by the current shot (pellets add up). */
  private shotDamage = new Map<string, number>();

  constructor(
    private readonly world: World,
    private readonly rays: RayWorld,
    private readonly enemies: Enemy[],
    private readonly gore: boolean,
  ) {}

  /** Explosions: damage falls off from the centre; close ones tear limbs off. */
  explode(at: THREE.Vector3, radius: number, damage: number, build: Build, silent = false): void {
    if (!silent) this.noise(at, 60);
    for (const e of this.enemies) {
      const d = e.body.joints.chest.distanceTo(at);
      if (d > radius) continue;
      if (!this.rays.clear(at.clone().add(new THREE.Vector3(0, 0.3, 0)), e.body.joints.chest)) continue;
      const k = 1 - d / radius;
      const dmg = damage * k * build.damage("launcher") * (1 - e.kit.armour * 0.5);
      const dir = e.body.joints.chest.clone().sub(at).normalize();
      const unseen = !this.anyHunting();
      const wasAlive = e.alive;
      if (wasAlive) e.react("torso", dir, e.body.joints.chest, dmg, "launcher", d, "chest");
      const killed = wasAlive && e.damage(dmg, dir.clone().multiplyScalar(6));
      if (this.gore) {
        this.world.fx.blood(e.body.joints.chest, dir, Math.min(1, dmg / 50));
        // Close to the blast, limbs go.
        if (!silent && (k > 0.55 || (killed && k > 0.3)))
          for (const seg of ["forearmL", "forearmR", "shinL", "shinR"])
            if (Math.random() < k * 0.7) e.body.sever(seg, dir.clone().multiplyScalar(6 + k * 8).add(new THREE.Vector3(0, 4, 0)));
      }
      if (killed) {
        e.die(dir.clone().multiplyScalar(8 + 10 * k).add(new THREE.Vector3(0, 5 * k, 0)), at, { ...this.deathCtx(e, "torso", dir, "launcher", d, false), explosive: true });
        this.killed({ enemy: e, weapon: EXPLOSIVE, zone: "torso", headshot: false, distance: d, unseen, severed: [], takedown: false });
      } else if (wasAlive) this.hits.push({ enemy: e, zone: "torso", damage: dmg, point: e.body.joints.chest.clone(), killed: false });
    }
  }

  /** Wakes every enemy within earshot of a noise. */
  noise(at: THREE.Vector3, radius: number): void {
    for (const e of this.enemies) e.hear(at, radius);
  }

  /** Records a kill and tells the bus (S0): the HUD, audio and camera listen for "kill". */
  private killed(k: KillEvent): void {
    this.kills.push(k);
    // The last of the encounter (S1.4): nobody else armed is fighting or hunting, and nobody armed stands close
    // by. A takedown has its own moment (C11), so it never counts.
    const last = !k.takedown && encounterCleared(k.enemy, this.enemies);
    this.bus.emit("kill", { t: this.clock, targetUid: String(k.enemy.id), headshot: k.headshot, weaponCls: k.weapon.weaponClass, last });
  }

  private anyHunting(): boolean {
    return this.enemies.some((e) => e.alive && e.state === "combat");
  }

  fire(shot: Shot, build: Build): { killcam: Projectile | null } {
    const w = shot.weapon;
    if (!this.quiet) this.bus.emit("fire", { t: this.clock, weaponCls: w.weaponClass, auto: AUTOMATIC.has(w.weaponClass) });
    if (!this.quiet) this.world.fx.muzzle(shot.muzzle, shot.dirs[0]!, w.weaponClass === "shotgun" ? 1.4 : w.weaponClass === "sniper" ? 1.2 : 0.7, w.id === "kestrel");
    this.noise(shot.origin, w.noise);
    if (w.kind === "ballistic") {
      const dir = shot.dirs[0]!;
      const p: Projectile = {
        pos: shot.origin.clone(),
        vel: dir.clone().multiplyScalar(w.velocity ?? 800),
        weapon: w,
        from: shot.origin.clone(),
        travelled: 0,
        cam: false,
        alive: true,
        pen: penetrationOf(w.weaponClass, this.penBonus),
        mul: 1,
      };
      // Predict where it lands: if it's a long kill, the session rides it with the kill-cam.
      const pred = this.predict(p, build);
      if (pred && pred.kill && pred.dist > 18) {
        p.cam = true;
        p.target = { enemy: pred.enemy, joint: pred.zone === "head" ? "head" : "chest" };
      }
      this.projectiles.push(p);
      return { killcam: p.cam ? p : null };
    }
    this.shotDamage.clear();
    const unseen = !this.anyHunting();
    if (w.weaponClass === "smart") this.curve(shot);
    for (const dir of shot.dirs) this.hitscan(shot.origin, dir, w, build, unseen);
    return { killcam: null };
  }

  /** Smart rounds bend toward the living enemy nearest her crosshair, inside an 8 degree cone and in the clear. */
  private curve(shot: Shot): void {
    const aim = shot.dirs[0]!;
    let best: Enemy | null = null;
    let bestAng = 0.14;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const to = e.body.joints.chest.clone().sub(shot.origin);
      const ang = to.clone().normalize().angleTo(aim);
      if (ang < bestAng && this.rays.clear(shot.origin, e.body.joints.chest)) {
        best = e;
        bestAng = ang;
      }
    }
    if (!best) return;
    const lock = best.body.joints.chest.clone().sub(shot.origin).normalize();
    for (const d of shot.dirs) d.lerp(lock, 0.85).normalize();
  }

  private hitscan(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponDef, build: Build, unseen: boolean): void {
    this.blocked = null;
    const path = this.resolvePath(origin, dir, w.range, w.weaponClass);
    const stop = path.stop;
    const maxD = stop ? stop.dist : w.range;
    const hitE = this.nearestEnemy(origin, dir, maxD);
    if (w.blast) {
      // Launchers: the round bursts where it lands (instant flight for now), enemy or wall.
      const at = hitE ? hitE.point : stop ? stop.point.clone().addScaledVector(dir, -0.3) : origin.clone().addScaledVector(dir, w.range);
      this.world.fx.explosion(at.clone(), w.blast);
      this.explode(at, w.blast, w.damage, build);
      return;
    }
    // Cover the round went through before it reached its end: an impact on both faces.
    const end = hitE ? hitE.dist : maxD;
    let mul = 1;
    let through = false;
    for (const l of path.passed) {
      if (l.dist >= end) break;
      mul *= PASS_THROUGH[l.mat] ?? 1;
      through = true;
      const s = surfaceOf(l.mat);
      this.world.fx.impact(l.point, l.normal, s);
      if (l.exit > l.dist + 0.005 && l.exit < end) this.world.fx.impact(origin.clone().addScaledVector(dir, l.exit), dir.clone(), s);
    }
    if (!hitE && this.blocked) {
      // A riot shield took it.
      const b = this.blocked as { point: THREE.Vector3; normal: THREE.Vector3 };
      this.world.fx.impact(b.point, b.normal, "metal");
      this.blocks++;
      this.world.fx.tracer(origin.clone().addScaledVector(dir, 1.2), b.point);
      return;
    }
    if (hitE) {
      if (!this.quiet) this.world.fx.tracer(origin.clone().addScaledVector(dir, 1.2), hitE.point);
      this.penMul = mul;
      this.penThrough = through;
      this.strike(hitE.enemy, hitE.seg, hitE.point, dir, w, build, origin.distanceTo(hitE.point), unseen, false);
      this.penMul = 1;
      this.penThrough = false;
      this.nearMisses(origin, dir, hitE.dist, hitE.enemy);
    } else if (stop) {
      const surf = surfaceOf(stop.mat);
      // Cover only counts as "blocked" if someone alive stood behind it, close to the line of fire.
      const behind = this.blockedTarget(origin, dir, stop.dist, w.range);
      if (behind) {
        this.blocks++;
        this.blockEvents.push({ point: stop.point.clone(), normal: stop.normal.clone(), mat: stop.mat, enemy: behind });
        this.bus.emit("blocked", { t: this.clock, point: stop.point, normal: stop.normal, mat: stop.mat, targetUid: String(behind.id) });
        // Overstated (pillar 4): a hard surface also throws a fan of sparks.
        if (stop.mat === "metal" || stop.mat === "metalSheet" || stop.mat === "concrete" || stop.mat === "chrome") {
          const [lo, hi] = tuning.blocked.sparks;
          this.world.fx.sparks(stop.point, stop.normal, (lo + Math.random() * (hi - lo)) / 20);
        }
      }
      // One impact, overstated by tuning.blocked.impactMul when cover stopped a round meant for someone.
      this.world.fx.impact(stop.point, stop.normal, stop.thin ? surf : this.world.surfaceAt(stop.point), behind ? tuning.blocked.impactMul : 1);
      if (!this.quiet && (w.weaponClass !== "shotgun" || Math.random() < 0.35)) this.world.fx.tracer(origin.clone().addScaledVector(dir, 1.2), stop.point);
      this.nearMisses(origin, dir, stop.dist, null);
    } else this.nearMisses(origin, dir, w.range, null);
  }

  /**
   * The layers a round meets, nearest first: the ones it passes (glass, cloth, drywall, wood; sheet metal
   * with real penetration) and the one that stops it. Penetration spends one layer per pass (S1.1).
   */
  private resolvePath(origin: THREE.Vector3, dir: THREE.Vector3, range: number, cls: WeaponClass) {
    const layers = this.rays.castAll(origin, dir, range, 4);
    let budget = penetrationOf(cls, this.penBonus);
    const passed: typeof layers = [];
    for (const l of layers) {
      if (budget > 0 && passes(l.mat, cls, this.penBonus)) {
        passed.push(l);
        budget--;
        continue;
      }
      return { passed, stop: l };
    }
    // Ran out of layers within the four nearest: if the budget is spent, a farther wall might still stop it.
    if (layers.length === 4) {
      const last = layers[3]!;
      const more = this.rays.cast(origin.clone().addScaledVector(dir, last.exit + 0.01), dir, range - last.exit - 0.01);
      if (more) return { passed, stop: { ...more, dist: more.dist + last.exit + 0.01, exit: more.exit + last.exit + 0.01 } };
    }
    return { passed, stop: null };
  }

  /**
   * The enemy cover cheated her of: alive, a joint within 1 m of the ray beyond the cover, and visible from
   * where she fired (rounds stop at thin cover; eyes see through glass). That's "you were aiming at him".
   */
  private blockedTarget(origin: THREE.Vector3, dir: THREE.Vector3, coverD: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestMiss: number = tuning.blocked.nearRayM;
    const to = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e.kit.role === "civilian") continue;
      for (const j of [e.body.joints.head, e.body.joints.chest, e.body.joints.pelvis]) {
        to.subVectors(j, origin);
        const along = to.dot(dir);
        if (along <= coverD || along > range) continue;
        const miss = to.addScaledVector(dir, -along).length();
        if (miss >= bestMiss) continue;
        const seen = [e.body.joints.head, e.body.joints.chest, e.body.joints.pelvis].some((p) => this.rays.clear(origin, p));
        if (!seen) continue;
        best = e;
        bestMiss = miss;
      }
    }
    return best;
  }

  /** Rounds that pass within half a metre of a head make that enemy flinch, duck and shoot worse (S1.1). */
  private nearMisses(origin: THREE.Vector3, dir: THREE.Vector3, upTo: number, struck: Enemy | null): void {
    const to = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || e === struck) continue;
      to.subVectors(e.body.joints.head, origin);
      const along = to.dot(dir);
      if (along <= 0 || along > upTo + 0.5) continue;
      const miss = to.addScaledVector(dir, -along).length();
      if (miss > tuning.nearMiss.radiusM) continue;
      const bark = e.nearMiss(dir);
      this.bus.emit("nearMiss", { t: this.clock, targetUid: String(e.id), miss });
      if (bark) this.barks.push(e);
    }
  }

  /** Enemies who shouted "Taking fire!" this frame (the session voices them). */
  readonly barks: Enemy[] = [];

  /** What a round from `from` towards `to` would do (the `traceShot` debug hook): no damage, no effects. */
  traceShot(fromV: Vec3Like, toV: Vec3Like, weapon?: WeaponDef, withBuild?: Build): ShotTrace {
    const held = this.held?.();
    const w = weapon ?? held?.w;
    const build = withBuild ?? held?.build;
    if (!w || !build) throw new Error("traceShot: no weapon or build");
    const from = new THREE.Vector3(fromV.x, fromV.y, fromV.z);
    const to = new THREE.Vector3(toV.x, toV.y, toV.z);
    const dir = to.clone().sub(from).normalize();
    const path = this.resolvePath(from, dir, w.range, w.weaponClass);
    const maxD = path.stop ? path.stop.dist : w.range;
    const hitE = this.nearestEnemy(from, dir, maxD);
    const out: ShotTrace = { blockedBy: null, mat: null, enemy: null, zone: null, damage: 0, pen: false };
    if (!hitE) {
      if (path.stop) {
        out.blockedBy = path.stop.thin ? "thin" : "solid";
        out.mat = path.stop.mat;
      }
      return out;
    }
    let mul = 1;
    for (const l of path.passed) if (l.dist < hitE.dist) {
      mul *= PASS_THROUGH[l.mat] ?? 1;
      out.pen = true;
      out.mat = l.mat;
    }
    let zm = ZONE_MUL[hitE.zone];
    if (hitE.zone === "head") zm *= build.headshot;
    out.enemy = String(hitE.enemy.id);
    out.zone = hitE.zone;
    out.damage = w.damage * build.damage(w.weaponClass) * zm * mul * (1 - hitE.enemy.kit.armour);
    return out;
  }

  private nearestEnemy(origin: THREE.Vector3, dir: THREE.Vector3, maxD: number) {
    let best: { enemy: Enemy; seg: string; zone: Zone; point: THREE.Vector3; dist: number } | null = null;
    for (const e of this.enemies) {
      if (!e.alive && e.deadFor > 4) continue;
      // Cheap reject: distance from the ray to the body's centre.
      const c = e.body.joints.chest;
      const to = new THREE.Vector3().subVectors(c, origin);
      const along = to.dot(dir);
      if (along < 0 || along > maxD + 1.5) continue;
      if (to.addScaledVector(dir, -along).length() > 1.5) continue;
      const h = e.body.raycast(origin, dir, maxD);
      if (!h || (best && h.dist >= best.dist)) continue;
      // A riot shield in the way stops the round.
      if (e.shield && e.alive) {
        const t = rayShield(e.shield, origin, dir);
        if (t !== null && t < h.dist) {
          this.blocked = { point: origin.clone().addScaledVector(dir, t), normal: dir.clone().negate() };
          continue;
        }
      }
      best = { enemy: e, seg: h.seg.name, zone: h.seg.zone, point: h.point, dist: h.dist };
    }
    return best;
  }

  /**
   * C9: the next gun kill is the first of a new save (the first job's flyover fight): it plays the gut clutch, the
   * death the spec stages for the owner's first gunfight. The session sets it; the first gun kill clears it.
   */
  firstGunKill = false;
  /** Screenshot stages (C9): the next kill dies this way, whatever the hit says. */
  forceVariant: DeathVariant | null = null;

  /**
   * What the street around a dying body says (S4.4's variant triggers): a wall within 1.2 m behind him along the
   * round, or a rail-height box edge (0.9 to 1.2 m) within 1 m, and which side the round came from.
   */
  deathCtx(e: Enemy, zone: Zone, dir: THREE.Vector3, weaponCls: string, distance: number, firstGunKill: boolean): DeathCtx {
    const yaw = e.motion.yaw;
    const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const flat = new THREE.Vector3(dir.x, 0, dir.z);
    if (flat.lengthSq() < 1e-8) flat.copy(fwd).negate();
    flat.normalize();
    const pel = e.body.joints.pelvis;
    const gy = e.motion.pos.y;
    let wallBehind: number | null = null;
    for (const hgt of [1.0, 1.35]) {
      const h = this.rays.cast(new THREE.Vector3(pel.x, gy + hgt, pel.z), flat, DEATH.wallM, { thin: false });
      if (h && Math.abs(h.normal.y) < 0.4) wallBehind = Math.min(wallBehind ?? Infinity, h.dist);
    }
    // A wall is a wall only if it is tall: a box he could fall over is a rail instead.
    let rail: { z: number; h: number } | null = null;
    for (const c of this.world.colliders ?? []) {
      const top = c.max.y - gy;
      if (top < DEATH.rail.lo || top > DEATH.rail.hi) continue;
      const cx = Math.max(c.min.x, Math.min(pel.x, c.max.x));
      const cz = Math.max(c.min.z, Math.min(pel.z, c.max.z));
      const dx = cx - pel.x;
      const dz = cz - pel.z;
      if (Math.hypot(dx, dz) > DEATH.rail.m) continue;
      // The rail must lie the way the round pushes him.
      if (dx * flat.x + dz * flat.z <= 0.05) continue;
      rail = { z: dx * fwd.x + dz * fwd.z, h: top };
      break;
    }
    if (rail) wallBehind = null;
    return { zone, weaponCls, distance, side: flat.dot(left), wallBehind, rail, firstGunKill, seed: e.id * 31 + Math.round(distance * 10) };
  }

  /** One round (or pellet, or swing) lands on an enemy. */
  private strike(e: Enemy, segName: string, point: THREE.Vector3, dir: THREE.Vector3, w: WeaponDef, build: Build, dist: number, unseen: boolean, takedown: boolean): void {
    const seg = e.body.segs.get(segName);
    if (!seg) return;
    const zone = seg.def.zone;
    // Falloff past half range for shotguns and pistols.
    const falloff = w.weaponClass === "shotgun" ? THREE.MathUtils.clamp(1.4 - dist / 14, 0.25, 1) : w.weaponClass === "pistol" ? THREE.MathUtils.clamp(1.3 - dist / 50, 0.5, 1) : 1;
    let mul = ZONE_MUL[zone];
    if (zone === "head") mul *= build.headshot * (w.weaponClass === "sniper" ? 1.6 : 1);
    const crit = Math.random() < build.crit;
    const armour = w.weaponClass === "sniper" ? e.kit.armour * 0.3 : e.kit.armour;
    let dmg = w.damage * build.damage(w.weaponClass) * mul * falloff * (crit ? build.critMul : 1) * (1 - armour) * this.penMul;
    if (!e.alive) dmg *= 0.5;
    if (e.marked) dmg *= 1.25;
    const wasAlive = e.alive;

    this.shotDamage.set(segName, (this.shotDamage.get(segName) ?? 0) + dmg);
    // Reduced violence swaps blood for sparks; at full intensity a flesh hit is blood only (blue coolant sparks on
    // a headshot read as "machine", not "hit", until visors break in C15).
    if (!this.gore) this.world.fx.sparks(point, dir.clone().negate(), 0.4);
    // Flesh (S4.5): puff, spurt, exit spray, wall splat and a wound on the segment. Reduced violence draws ink.
    if (this.world.fx.flesh) this.world.fx.flesh({ point, dir, damage: dmg, maxHp: e.kit.maxHp, weaponCls: w.weaponClass, distance: dist, anchor: seg.group, owner: e, root: e.body.root, head: zone === "head", lethal: wasAlive && dmg >= e.hp });
    else if (this.gore) this.world.fx.blood(point, dir, Math.min(1, dmg / 60));

    const push = dir.clone().multiplyScalar(w.weaponClass === "shotgun" ? 3 : w.weaponClass === "sniper" ? 6 : 1.5);
    // The body takes it (S4.1): the hit segment's chain flinches along the round, before the damage lands.
    if (wasAlive) e.react(zone, dir, point, dmg, w.weaponClass, dist, segName);
    const killed = wasAlive && e.damage(dmg, push);
    // Torso hits on a vested enemy land on the plate (S1.2's armour marker); the head is always flesh for now.
    const layer: HitLayer = e.kit.armour >= 0.3 && zone === "torso" && w.weaponClass !== "sniper" ? "plate" : "flesh";
    const data: HitData = {
      t: this.clock,
      targetUid: String(e.id),
      seg: segName,
      zone,
      point: point.clone(),
      normal: dir.clone().negate(),
      dir: dir.clone(),
      distance: dist,
      weaponCls: w.weaponClass,
      damage: dmg,
      crit,
      layer,
      penetrated: this.penThrough,
      lethal: killed,
      reaction: wasAlive ? "flinch" : "none",
    };
    this.hits.push({ enemy: e, zone, damage: dmg, point, killed, data });
    if (wasAlive) this.bus.emit("hit", data);

    // Severing: a big hit to a limb or the head takes it off (full intensity only).
    const severed: string[] = [];
    if (this.gore) {
      const total = this.shotDamage.get(segName)!;
      const brutal = w.brutal ?? 0;
      const limb = zone !== "torso" && zone !== "head";
      const headOff = zone === "head" && (killed || !e.alive) && (w.weaponClass === "sniper" || (w.weaponClass === "shotgun" && dist < 7) || total > 150);
      const limbOff = limb && total > e.kit.maxHp * (0.55 - brutal * 0.25) && (killed || !e.alive || total > e.kit.maxHp * 0.7);
      if (headOff || limbOff) {
        const fly = dir.clone().multiplyScalar(4 + brutal * 5).add(new THREE.Vector3(0, 2.5, 0));
        severed.push(...e.body.sever(segName, fly));
        this.world.fx.blood(point, dir, 1);
        this.world.fx.blood(point, new THREE.Vector3(0, 1, 0), 1);
      }
    }

    if (killed) {
      const gun = w.kind !== "melee";
      const ctx = this.deathCtx(e, zone, dir, w.weaponClass, dist, gun && this.firstGunKill);
      if (gun) this.firstGunKill = false;
      const imp = DEATH.impulse[w.weaponClass] ?? 3.5;
      e.die(dir.clone().multiplyScalar(imp).add(new THREE.Vector3(0, 1, 0)), point, ctx, this.forceVariant ?? undefined);
      this.killed({ enemy: e, weapon: w, zone, headshot: zone === "head", distance: dist, unseen, severed, takedown });
    } else if (severed.length && e.alive) {
      // Losing a leg or an arm puts them down for good.
      e.damage(e.hp + 1, push);
      e.die(push.multiplyScalar(2), point, this.deathCtx(e, zone, dir, w.weaponClass, dist, false));
      this.killed({ enemy: e, weapon: w, zone, headshot: false, distance: dist, unseen, severed, takedown });
    }
  }

  /** The Pin: hits the first enemy in a short arc in front. */
  melee(eye: THREE.Vector3, dir: THREE.Vector3, w: WeaponDef, build: Build): boolean {
    const unseen = !this.anyHunting();
    let best: Enemy | null = null;
    let bestD = w.range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const to = new THREE.Vector3().subVectors(e.body.joints.chest, eye);
      const d = to.length();
      if (d > bestD) continue;
      if (to.normalize().dot(dir) < 0.6) continue;
      best = e;
      bestD = d;
    }
    if (!best) return false;
    const segName = dir.y > 0.05 ? "head" : "chest";
    const point = best.body.joints[segName === "head" ? "head" : "chest"].clone();
    this.shotDamage.clear();
    this.strike(best, segName, point, dir, w, build, bestD, unseen, false);
    this.noise(eye, w.noise);
    return true;
  }

  /** A silent takedown from behind (or on anyone not yet hunting her) within reach: instant and quiet. */
  takedown(eye: THREE.Vector3, dir: THREE.Vector3, pin: WeaponDef, reach = 1.9): Enemy | null {
    for (const e of this.enemies) {
      if (!e.alive || e.state === "combat") continue;
      const to = new THREE.Vector3().subVectors(e.body.joints.chest, eye);
      const d = to.length();
      if (d > reach || to.normalize().dot(dir) < 0.5) continue;
      const theirFwd = new THREE.Vector3(Math.sin(e.motion.yaw), 0, Math.cos(e.motion.yaw));
      const behind = theirFwd.dot(new THREE.Vector3(dir.x, 0, dir.z).normalize()) > 0.2;
      if (!behind && e.state !== "unaware") continue;
      const unseen = !this.anyHunting();
      e.damage(e.hp + 1, dir.clone());
      e.die(dir.clone().multiplyScalar(2.5).add(new THREE.Vector3(0, 0.5, 0)), e.body.joints.neck, this.deathCtx(e, "torso", dir, "melee", d, false));
      if (this.gore) this.world.fx.blood(e.body.joints.neck, dir, 0.7);
      this.killed({ enemy: e, weapon: pin, zone: "head", headshot: false, distance: d, unseen, severed: [], takedown: true });
      return e;
    }
    return null;
  }

  /** Simulates a ballistic round's whole flight against the current scene, without side effects. */
  predict(p: Projectile, build: Build): { enemy: Enemy; zone: Zone; dist: number; kill: boolean } | null {
    const pos = p.pos.clone();
    const vel = p.vel.clone();
    const step = 1 / 240;
    let travelled = 0;
    let pen = p.pen ?? 0;
    let penMul = p.mul ?? 1;
    for (let i = 0; i < 240 * 3 && travelled < p.weapon.range; i++) {
      const next = pos.clone().addScaledVector(vel, step);
      vel.y -= GRAVITY * step;
      vel.x += this.world.wind.x * 0.02 * step * 60;
      vel.z += this.world.wind.z * 0.02 * step * 60;
      const seg = next.clone().sub(pos);
      const len = seg.length();
      const dir = seg.divideScalar(len);
      const wHit = this.rays.cast(pos, dir, len);
      const eHit = this.nearestEnemy(pos, dir, wHit ? wHit.dist : len);
      if (eHit) {
        const zone = eHit.zone;
        let mul = ZONE_MUL[zone];
        if (zone === "head") mul *= build.headshot * 1.6;
        const dmg = p.weapon.damage * build.damage("sniper") * mul * penMul * (1 - eHit.enemy.kit.armour * 0.3);
        return { enemy: eHit.enemy, zone, dist: travelled + eHit.dist, kill: eHit.enemy.alive && dmg >= eHit.enemy.hp };
      }
      if (wHit) {
        if (pen <= 0 || !passes(wHit.mat, p.weapon.weaponClass, this.penBonus)) return null;
        // Through it: carry on from just past the far face, weaker.
        pen--;
        penMul *= PASS_THROUGH[wHit.mat] ?? 1;
        const out = Math.min(wHit.exit + 0.01, len);
        travelled += out;
        pos.addScaledVector(dir, out);
        continue;
      }
      travelled += len;
      pos.copy(next);
    }
    return null;
  }

  /** Flies ballistic rounds. `dt` is game time (slowed during the kill-cam). */
  update(dt: number, build: Build): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      let left = dt;
      while (left > 0 && p.alive) {
        const step = Math.min(left, 1 / 240);
        left -= step;
        if (p.target) {
          // The kill-cam's cheat: steer gently onto the predicted joint so the shot lands as shown.
          const aim = p.target.enemy.body.joints[p.target.joint === "head" ? "head" : "chest"].clone();
          if (p.target.joint === "head") aim.y -= 0.12;
          const want = aim.sub(p.pos).normalize().multiplyScalar(p.vel.length());
          p.vel.lerp(want, Math.min(1, step * 30));
        } else {
          p.vel.y -= GRAVITY * step;
          p.vel.x += this.world.wind.x * 0.02 * step * 60;
          p.vel.z += this.world.wind.z * 0.02 * step * 60;
        }
        const move = p.vel.clone().multiplyScalar(step);
        const len = move.length();
        const dir = move.clone().divideScalar(len);
        const wHit = this.rays.cast(p.pos, dir, len);
        const eHit = this.nearestEnemy(p.pos, dir, wHit ? wHit.dist : len);
        if (eHit) {
          this.shotDamage.clear();
          this.penMul = p.mul ?? 1;
          this.penThrough = (p.mul ?? 1) < 1;
          this.strike(eHit.enemy, eHit.seg, eHit.point, dir, p.weapon, build, p.travelled + eHit.dist, !this.anyHunting() || p.cam, false);
          this.penMul = 1;
          this.penThrough = false;
          this.world.fx.tracer(p.from, eHit.point);
          p.alive = false;
        } else if (wHit && (p.pen ?? 0) > 0 && passes(wHit.mat, p.weapon.weaponClass, this.penBonus)) {
          // Through the cover (S1.1): an impact on both faces, a share of the damage kept, one layer spent.
          const s = surfaceOf(wHit.mat);
          this.world.fx.impact(wHit.point, wHit.normal, s);
          const out = Math.min(wHit.exit + 0.01, len);
          if (wHit.exit > wHit.dist + 0.005) this.world.fx.impact(p.pos.clone().addScaledVector(dir, wHit.exit), dir.clone(), s);
          p.pen = (p.pen ?? 0) - 1;
          p.mul = (p.mul ?? 1) * (PASS_THROUGH[wHit.mat] ?? 1);
          p.pos.addScaledVector(dir, out);
          p.travelled += out;
        } else if (wHit) {
          // Cover ate a long shot meant for someone: the same "blocked" cue as hitscan rounds.
          const behind = this.blockedTarget(p.pos, dir, wHit.dist, p.weapon.range - p.travelled);
          if (behind) {
            this.blocks++;
            this.blockEvents.push({ point: wHit.point.clone(), normal: wHit.normal.clone(), mat: wHit.mat, enemy: behind });
            this.bus.emit("blocked", { t: this.clock, point: wHit.point, normal: wHit.normal, mat: wHit.mat, targetUid: String(behind.id) });
          }
          this.world.fx.impact(wHit.point, wHit.normal, wHit.thin ? surfaceOf(wHit.mat) : this.world.surfaceAt(wHit.point), behind ? tuning.blocked.impactMul : 1);
          this.world.fx.tracer(p.from, wHit.point);
          this.noise(wHit.point, 6);
          p.alive = false;
        } else {
          p.pos.add(move);
          p.travelled += len;
          if (p.travelled > p.weapon.range || p.pos.y < -20) p.alive = false;
        }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (!this.projectiles[i]!.alive) this.projectiles.splice(i, 1);
  }
}

export type { Projectile };

/** Distance along a ray to a riot shield (an oriented thin box), or null. */
function rayShield(shield: THREE.Mesh, origin: THREE.Vector3, dir: THREE.Vector3): number | null {
  shield.updateMatrixWorld();
  const inv = new THREE.Matrix4().copy(shield.matrixWorld).invert();
  const o = origin.clone().applyMatrix4(inv);
  const d = dir.clone().transformDirection(inv);
  const box = new THREE.Box3(new THREE.Vector3(-0.31, -0.53, -0.04), new THREE.Vector3(0.31, 0.53, 0.04));
  const hit = new THREE.Ray(o, d).intersectBox(box, new THREE.Vector3());
  return hit ? hit.applyMatrix4(shield.matrixWorld).distanceTo(origin) : null;
}
