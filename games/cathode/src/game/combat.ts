// Resolving violence: hitscan rounds and shotgun pellets, ballistic sniper rounds with drop and wind, the
// Pin's swing, silent takedowns, hit zones, armour, severed limbs, gore, noise, and the kill events the
// session turns into XP and the kill-cam. Numbers mirror sim/damage.ts's rules for the slice.

import * as THREE from "three";
import type { World } from "../render/types";
import type { Enemy } from "./enemy";
import type { RayWorld } from "./ray";
import type { Shot, WeaponDef } from "./weapons";
import type { Zone } from "./body";
import type { WeaponClass } from "../sim/types";

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
}

export interface Build {
  /** Damage multiplier per weapon class, from attributes and skills. */
  damage: (weaponClass: WeaponClass) => number;
  headshot: number;
  crit: number;
  critMul: number;
}

const EXPLOSIVE: WeaponDef = { id: "frag", name: "Frag grenade", model: "pin", weaponClass: "melee", kind: "melee", damage: 0, pellets: 1, cycle: 0, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 60, kick: 0, range: 0 };

const ZONE_MUL: Record<Zone, number> = { head: 2.5, torso: 1, armL: 0.7, armR: 0.7, legL: 0.75, legR: 0.75 };
const GRAVITY = 9.81;

export class Combat {
  readonly projectiles: Projectile[] = [];
  readonly kills: KillEvent[] = [];
  readonly hits: HitEvent[] = [];
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
      const killed = wasAlive && e.damage(dmg, dir.clone().multiplyScalar(6));
      if (this.gore) {
        this.world.fx.blood(e.body.joints.chest, dir, Math.min(1, dmg / 50));
        // Close to the blast, limbs go.
        if (!silent && (k > 0.55 || (killed && k > 0.3)))
          for (const seg of ["forearmL", "forearmR", "shinL", "shinR"])
            if (Math.random() < k * 0.7) e.body.sever(seg, dir.clone().multiplyScalar(6 + k * 8).add(new THREE.Vector3(0, 4, 0)));
      }
      if (killed) {
        e.die(dir.clone().multiplyScalar(8 + 10 * k).add(new THREE.Vector3(0, 5 * k, 0)), at);
        this.kills.push({ enemy: e, weapon: EXPLOSIVE, zone: "torso", headshot: false, distance: d, unseen, severed: [], takedown: false });
      } else if (wasAlive) this.hits.push({ enemy: e, zone: "torso", damage: dmg, point: e.body.joints.chest.clone(), killed: false });
    }
  }

  /** Wakes every enemy within earshot of a noise. */
  noise(at: THREE.Vector3, radius: number): void {
    for (const e of this.enemies) e.hear(at, radius);
  }

  private anyHunting(): boolean {
    return this.enemies.some((e) => e.alive && e.state === "combat");
  }

  fire(shot: Shot, build: Build): { killcam: Projectile | null } {
    const w = shot.weapon;
    this.world.fx.muzzle(shot.muzzle, shot.dirs[0]!, w.weaponClass === "shotgun" ? 1.4 : w.weaponClass === "sniper" ? 1.2 : 0.7);
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
    for (const dir of shot.dirs) this.hitscan(shot.origin, dir, w, build, unseen);
    return { killcam: null };
  }

  private hitscan(origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponDef, build: Build, unseen: boolean): void {
    const hitW = this.rays.cast(origin, dir, w.range);
    const maxD = hitW ? hitW.dist : w.range;
    this.blocked = null;
    const hitE = this.nearestEnemy(origin, dir, maxD);
    if (w.blast) {
      // Launchers: the round bursts where it lands (instant flight for now), enemy or wall.
      const at = hitE ? hitE.point : hitW ? hitW.point.clone().addScaledVector(dir, -0.3) : origin.clone().addScaledVector(dir, w.range);
      this.world.fx.explosion(at.clone(), w.blast);
      this.explode(at, w.blast, w.damage, build);
      return;
    }
    if (!hitE && this.blocked) {
      const b = this.blocked as { point: THREE.Vector3; normal: THREE.Vector3 };
      this.world.fx.impact(b.point, b.normal, "metal");
      this.world.fx.tracer(origin.clone().addScaledVector(dir, 1.2), b.point);
      return;
    }
    if (hitE) {
      this.world.fx.tracer(origin.clone().addScaledVector(dir, 1.2), hitE.point);
      this.strike(hitE.enemy, hitE.seg, hitE.point, dir, w, build, origin.distanceTo(hitE.point), unseen, false);
    } else if (hitW) {
      this.world.fx.impact(hitW.point, hitW.normal, this.world.surfaceAt(hitW.point));
      if (w.weaponClass !== "shotgun" || Math.random() < 0.35) this.world.fx.tracer(origin.clone().addScaledVector(dir, 1.2), hitW.point);
    }
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
    let dmg = w.damage * build.damage(w.weaponClass) * mul * falloff * (crit ? build.critMul : 1) * (1 - armour);
    if (!e.alive) dmg *= 0.5;
    if (e.marked) dmg *= 1.25;
    const wasAlive = e.alive;

    this.shotDamage.set(segName, (this.shotDamage.get(segName) ?? 0) + dmg);
    if (seg.def.zone === "head" || !this.gore) this.world.fx.sparks(point, dir.clone().negate(), 0.4);
    if (this.gore) this.world.fx.blood(point, dir, Math.min(1, dmg / 60));

    const push = dir.clone().multiplyScalar(w.weaponClass === "shotgun" ? 3 : w.weaponClass === "sniper" ? 6 : 1.5);
    const killed = wasAlive && e.damage(dmg, push);
    this.hits.push({ enemy: e, zone, damage: dmg, point, killed });

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
      e.die(dir.clone().multiplyScalar(w.weaponClass === "sniper" ? 9 : w.weaponClass === "shotgun" ? 7 : 3.5).add(new THREE.Vector3(0, 1, 0)), point);
      this.kills.push({ enemy: e, weapon: w, zone, headshot: zone === "head", distance: dist, unseen, severed, takedown });
    } else if (severed.length && e.alive) {
      // Losing a leg or an arm puts them down for good.
      e.damage(e.hp + 1, push);
      e.die(push.multiplyScalar(2), point);
      this.kills.push({ enemy: e, weapon: w, zone, headshot: false, distance: dist, unseen, severed, takedown });
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
  takedown(eye: THREE.Vector3, dir: THREE.Vector3, pin: WeaponDef): Enemy | null {
    for (const e of this.enemies) {
      if (!e.alive || e.state === "combat") continue;
      const to = new THREE.Vector3().subVectors(e.body.joints.chest, eye);
      const d = to.length();
      if (d > 1.9 || to.normalize().dot(dir) < 0.5) continue;
      const theirFwd = new THREE.Vector3(Math.sin(e.motion.yaw), 0, Math.cos(e.motion.yaw));
      const behind = theirFwd.dot(new THREE.Vector3(dir.x, 0, dir.z).normalize()) > 0.2;
      if (!behind && e.state !== "unaware") continue;
      const unseen = !this.anyHunting();
      e.damage(e.hp + 1, dir.clone());
      e.die(dir.clone().multiplyScalar(2.5).add(new THREE.Vector3(0, 0.5, 0)), e.body.joints.neck);
      if (this.gore) this.world.fx.blood(e.body.joints.neck, dir, 0.7);
      this.kills.push({ enemy: e, weapon: pin, zone: "head", headshot: false, distance: d, unseen, severed: [], takedown: true });
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
        const dmg = p.weapon.damage * build.damage("sniper") * mul * (1 - eHit.enemy.kit.armour * 0.3);
        return { enemy: eHit.enemy, zone, dist: travelled + eHit.dist, kill: eHit.enemy.alive && dmg >= eHit.enemy.hp };
      }
      if (wHit) return null;
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
          this.strike(eHit.enemy, eHit.seg, eHit.point, dir, p.weapon, build, p.travelled + eHit.dist, !this.anyHunting() || p.cam, false);
          this.world.fx.tracer(p.from, eHit.point);
          p.alive = false;
        } else if (wHit) {
          this.world.fx.impact(wHit.point, wHit.normal, this.world.surfaceAt(wHit.point));
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
