// Active skills in the street: two quick-slots fed by the rules core (sim/skills activeSkill), cooldowns,
// the battery, and what each effect type actually does to the world. Effect types the slice doesn't play
// yet say so instead of failing silently.

import * as THREE from "three";
import { ALL_SKILLS } from "../sim/classes";
import { activeSkill, type ActiveSkillState } from "../sim/skills";
import type { Character } from "../sim/character";
import type { DerivedStats } from "../sim/stats";
import type { Enemy } from "./enemy";
import type { World } from "../render/types";
import type { Player } from "./player";

/** Effects that run for a while, read by the session each frame. */
export interface Running {
  /** Detection multiplier (Optic Camo, Vanish): 1 when nothing is running. */
  camo: number;
  /** Scope sway multiplier (Held Breath). */
  sway: number;
  /** World time scale from skills (Slow Time). */
  timeScale: number;
  /** Marked enemies take this much extra damage. */
  markBonus: number;
  /** Damage taken is multiplied by this (Juggernaut): 1 when nothing is running. */
  guard: number;
  /** Health returned per point of melee damage dealt (Red Harvest): 0 when nothing is running. */
  lifeSteal: number;
}

interface Thrown {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  kind: "grenade" | "molotov" | "gas";
  damage: number;
  radius: number;
  mesh: THREE.Mesh;
}

interface Fire {
  pos: THREE.Vector3;
  radius: number;
  dps: number;
  left: number;
  silent?: boolean;
}

/** A planted mine, a sentry turret or a drone: things that keep working after the key press. */
interface Deployed {
  kind: "mine" | "turret" | "drone";
  pos: THREE.Vector3;
  left: number;
  damage: number;
  /** Seconds between shots (turret) or 0 for continuous damage per second (drone). */
  rate: number;
  cool: number;
  mesh: THREE.Mesh;
}

const GLOW = new THREE.MeshBasicMaterial({ color: 0xffb347 });

export class Actives {
  readonly slots: Array<string | null> = [null, null];
  private cd = new Map<string, number>();
  private timers = new Map<string, number>();
  private params = new Map<string, Record<string, unknown>>();
  battery = 50;
  private thrown: Thrown[] = [];
  private fires: Fire[] = [];
  readonly marked = new Set<Enemy>();
  /** Lines for the HUD feed ("Optic Camo", "Not in this build yet"). */
  readonly said: string[] = [];
  /** Explosions this frame, for the session to resolve damage against enemies. */
  readonly blasts: Array<{ pos: THREE.Vector3; radius: number; damage: number; silent?: boolean }> = [];
  /** Health to give Cath this frame (Stim), for the session to apply. */
  heal = 0;
  /** Set by Spin Reload, Fan the Hammer and Bang Bang: the session tops up the held magazine, then clears it. */
  refill = false;
  /** Next-shot buffs: shots left and damage multiplier, per kind ("spin", "oneShot", "slug"). */
  private next = new Map<string, { shots: number; mul: number }>();
  private shells: Array<{ at: number; pos: THREE.Vector3 }> = [];
  private clock = 0;
  private groundAt: (x: number, z: number) => number = () => 0;
  private bangStacks = 0;
  private healing: { left: number; rate: number } | null = null;
  private deployed: Deployed[] = [];
  private panicking: Array<{ pos: THREE.Vector3; radius: number; left: number }> = [];
  /** Absorb pool from a shield drone and when it drops. */
  shield = 0;

  /** Picks the first two learned actives, in tree order, unless the player has set them. */
  assign(c: Character): void {
    const learned = ALL_SKILLS.filter((s) => s.active && (c.skills[s.id] ?? 0) > 0).map((s) => s.id);
    for (let i = 0; i < 2; i++) if (!this.slots[i] || !learned.includes(this.slots[i]!)) this.slots[i] = learned.filter((id) => !this.slots.includes(id))[0] ?? null;
  }

  state(c: Character, d: DerivedStats, slot: number): (ActiveSkillState & { ready: number }) | null {
    const id = this.slots[slot];
    if (!id) return null;
    const a = activeSkill(c, id, d.totals, d.cooldownReduction);
    if (!a) return null;
    const left = this.cd.get(id) ?? 0;
    return { ...a, ready: a.cooldown > 0 ? 1 - left / a.cooldown : 1 };
  }

  running(): Running {
    const on = (k: string) => (this.timers.get(k) ?? 0) > 0;
    const p = (k: string, f: string, dflt: number) => (on(k) ? Number(this.params.get(k)?.[f] ?? dflt) : 1);
    return {
      camo: Math.min(p("opticCamo", "detection", 0.1), on("vanish") ? 0.1 : 1),
      sway: on("heldBreath") ? 1 - Number(this.params.get("heldBreath")?.sway ?? 50) / 100 : 1,
      timeScale: on("bulletTime") ? 0.25 : 1,
      markBonus: 1.25,
      guard: (on("juggernaut") ? 1 - Number(this.params.get("juggernaut")?.reduction ?? 40) / 100 : 1) * (on("battleFrame") ? 0.5 : 1),
      lifeSteal: on("redHarvest") ? Number(this.params.get("redHarvest")?.lifeSteal ?? 20) / 100 : 0,
    };
  }

  /** Gun buffs for the weapon class in hand: damage and fire-rate multipliers, and whether reloads are free. */
  weaponMod(cls: string): { dmg: number; rate: number; noReload: boolean } {
    const on = (k: string) => (this.timers.get(k) ?? 0) > 0;
    const v = (k: string, f: string, dflt = 0) => Number(this.params.get(k)?.[f] ?? dflt) / 100;
    let dmg = 1;
    let rate = 1;
    let noReload = false;
    if (on("bulletHose") && (cls === "smg" || cls === "pistol")) {
      rate += v("bulletHose", "fireRate", 40);
      noReload = true;
    }
    if (on("fan") && (cls === "revolver" || cls === "pistol")) {
      rate += 5;
      noReload = true;
      dmg *= v("fan", "damage", 60);
    }
    if (on("sixForSix") && (cls === "revolver" || cls === "pistol")) dmg *= 1 + v("sixForSix", "damage", 20) + 0.5;
    if (on("leadRain") && cls === "smg") dmg *= 1 + v("leadRain", "damage", 30);
    if (on("dragonsBreath") && cls === "shotgun") dmg *= 1 + v("dragonsBreath", "burn", 40);
    if (on("hollowChild")) dmg *= 1 + v("hollowChild", "damage", 40);
    if (on("battleFrame")) dmg *= 1.5;
    if (on("bangBang")) dmg *= 1 + this.bangStacks * v("bangBang", "damagePerKill", 8);
    return { dmg, rate, noReload };
  }

  /** Damage aimed at Cath: the shield drone's pool soaks it up first. Returns what gets through. */
  absorb(amount: number): number {
    const soak = Math.min(this.shield, amount);
    this.shield -= soak;
    return amount - soak;
  }

  /** A kill landed: Bang Bang refills the magazine and stacks damage while it runs. */
  onKill(): void {
    if ((this.timers.get("bangBang") ?? 0) > 0) {
      this.bangStacks++;
      this.refill = true;
    }
  }

  /** A shot is leaving the gun: next-shot buffs apply to it and are used up. */
  takeNextShot(cls: string): { mul: number; pellets: number } {
    let mul = 1;
    let pellets = 0;
    const eat = (k: string, ok: boolean) => {
      const n = this.next.get(k);
      if (!n || !ok) return;
      mul *= n.mul;
      if (k === "slug") pellets = 1;
      if (--n.shots <= 0) this.next.delete(k);
    };
    eat("spin", cls !== "sniper" && cls !== "shotgun" && cls !== "melee");
    eat("oneShot", cls === "sniper");
    eat("slug", cls === "shotgun");
    return { mul, pellets };
  }

  /** Fires a slot. Returns false (and why, in `said`) when it can't. */
  use(slot: number, c: Character, d: DerivedStats, ctx: { player: Player; eye: THREE.Vector3; fwd: THREE.Vector3; enemies: Enemy[]; world: World; maxHp: number }): boolean {
    const a = this.state(c, d, slot);
    if (!a) {
      this.said.push(slot === 0 ? "No active skill learned yet (K)" : "Learn a second active skill (K)");
      return false;
    }
    if (a.ready < 1) return false;
    if (this.battery < a.battery) {
      this.said.push("Battery low");
      return false;
    }
    const fx = a.effect as unknown as Record<string, unknown> & { type: string };
    const num = (k: string, dflt = 0) => Number(fx[k] ?? dflt);
    const timed = (key: string, seconds: number) => {
      this.timers.set(key, seconds);
      this.params.set(key, fx);
    };
    switch (fx.type) {
      case "heldBreath":
        timed("heldBreath", num("seconds", 4));
        break;
      case "bulletTime":
        timed("bulletTime", num("seconds", 2));
        break;
      case "opticCamo":
        timed("opticCamo", num("seconds", 4));
        break;
      case "vanish": {
        timed("vanish", num("seconds", 3));
        const r = num("radius", 25);
        for (const e of ctx.enemies) if (e.alive && e.position.distanceTo(ctx.player.pos) < r) e.lose(ctx.player.pos);
        break;
      }
      case "mark": {
        const r = num("radius", 20);
        for (const e of ctx.enemies) {
          if (!e.alive || e.position.distanceTo(ctx.player.pos) > r) continue;
          this.marked.add(e);
          e.setMarked(true, GLOW);
        }
        timed("mark", num("seconds", 12));
        break;
      }
      case "lunge": {
        // Dash at the nearest enemy in front, up to v metres.
        const reach = num("meters", 6);
        let best: Enemy | null = null;
        let bestD = reach;
        for (const e of ctx.enemies) {
          if (!e.alive) continue;
          const to = e.position.clone().sub(ctx.player.pos);
          const dist = to.length();
          if (dist < bestD && to.setY(0).normalize().dot(new THREE.Vector3(ctx.fwd.x, 0, ctx.fwd.z).normalize()) > 0.8) {
            best = e;
            bestD = dist;
          }
        }
        if (!best) {
          this.said.push("Nothing in reach");
          return false;
        }
        const dir = best.position.clone().sub(ctx.player.pos).setY(0).normalize();
        ctx.player.vel.x = dir.x * Math.min(18, bestD * 4);
        ctx.player.vel.z = dir.z * Math.min(18, bestD * 4);
        this.lungeAt = best;
        this.lungeT = 0.3;
        break;
      }
      case "warCry": {
        const r = num("radius", 10);
        for (const e of ctx.enemies) if (e.alive && e.position.distanceTo(ctx.player.pos) < r) e.panic(num("seconds", 3), ctx.player.pos);
        break;
      }
      case "grenade":
      case "molotov": {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 10, 8),
          new THREE.MeshStandardMaterial({ color: fx.type === "grenade" ? 0x2a3020 : 0x5a3a10, roughness: 0.5, metalness: 0.4 }),
        );
        ctx.world.scene.add(m);
        const pos = ctx.eye.clone().addScaledVector(ctx.fwd, 0.5);
        const vel = ctx.fwd.clone().multiplyScalar(16).add(new THREE.Vector3(0, 3.5, 0));
        this.thrown.push({
          pos,
          vel,
          fuse: fx.type === "grenade" ? 1.8 : 9,
          kind: fx.type,
          damage: fx.type === "grenade" ? num("damage", 80) : num("dps", 20),
          radius: num("radius", 5),
          mesh: m,
        });
        break;
      }
      case "stim": {
        const secs = num("seconds", 3);
        this.healing = { left: secs, rate: (ctx.maxHp * num("heal", 30)) / 100 / secs };
        break;
      }
      case "bulletHose":
      case "sixForSix":
      case "leadRain":
      case "dragonsBreath":
        timed(fx.type, num("seconds", 6));
        break;
      case "bangBang":
        this.bangStacks = 0;
        timed("bangBang", num("seconds", 8));
        break;
      case "fanTheHammer":
        timed("fan", num("duration", 0.6));
        this.refill = true;
        break;
      case "spinReload":
        this.refill = true;
        this.next.set("spin", { shots: Math.max(1, num("shots", 3)), mul: 1 + num("damage", 20) / 100 });
        break;
      case "oneShot":
        this.next.set("oneShot", { shots: 1, mul: 1 + num("damage", 100) / 100 });
        break;
      case "slug":
        this.next.set("slug", { shots: 1, mul: 9 * (num("damage", 130) / 100) });
        break;
      case "deadEye": {
        // Time slows and the nearest few enemies in front are painted: they take bonus damage.
        timed("bulletTime", num("seconds", 3));
        const cands = ctx.enemies
          .filter((e) => e.alive && e.body.joints.chest.clone().sub(ctx.eye).normalize().dot(ctx.fwd) > 0.5)
          .sort((a, b) => a.position.distanceTo(ctx.player.pos) - b.position.distanceTo(ctx.player.pos))
          .slice(0, Math.max(1, num("marks", 3)));
        for (const e of cands) {
          this.marked.add(e);
          e.setMarked(true, GLOW);
        }
        timed("mark", num("seconds", 3) + 2);
        break;
      }
      case "barrage": {
        // Shells walk in on the spot she is looking at.
        const p = ctx.eye.clone();
        for (let i = 0; i < 60 && p.y > this.groundAt(p.x, p.z) + 0.1; i++) p.addScaledVector(ctx.fwd, 1);
        const n = Math.max(1, num("shells", 8));
        const span = num("seconds", 4);
        this.params.set("barrage", fx);
        for (let i = 0; i < n; i++) {
          const q = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
          q.y = this.groundAt(q.x, q.z) + 0.2;
          this.shells.push({ at: this.clock + 0.5 + (i / n) * span, pos: q });
        }
        break;
      }
      case "juggernaut":
        timed("juggernaut", num("seconds", 10));
        break;
      case "cleave": {
        // A wide swing: everything within reach in front of her.
        this.blasts.push({ pos: ctx.eye.clone().addScaledVector(ctx.fwd, 1.4), radius: num("radius", 2.5), damage: num("damage", 120) * 0.6, silent: true });
        break;
      }
      case "overload":
      case "shortFuse":
      case "monowireWhip": {
        // Shock or wire on whoever she is looking at; the fuse also catches their neighbours.
        const range = fx.type === "monowireWhip" ? num("range", 8) : 35;
        const t = this.aimed(ctx, range);
        if (!t) {
          this.said.push("No target");
          return false;
        }
        const radius = fx.type === "shortFuse" ? num("radius", 4) : 1.2;
        this.blasts.push({ pos: t.body.joints.chest.clone(), radius, damage: num("damage", 100) * 0.7, silent: true });
        ctx.world.fx.tracer(ctx.eye.clone().addScaledVector(ctx.fwd, 0.4), t.body.joints.chest);
        break;
      }
      case "dossier":
      case "nameOnTheList": {
        const t = this.aimed(ctx, 60);
        if (!t) {
          this.said.push("No target");
          return false;
        }
        this.marked.add(t);
        t.setMarked(true, GLOW);
        timed("mark", num("seconds", 10));
        break;
      }
      case "finisher": {
        // Execute whoever is in reach in front and already hurt; the blade gives her health back.
        const t = this.aimed(ctx, 4);
        if (!t || t.hp > t.kit.maxHp * (num("threshold", 20) / 100)) {
          this.said.push(t ? "Too healthy to finish" : "Nothing in reach");
          return false;
        }
        this.blasts.push({ pos: t.body.joints.chest.clone(), radius: 1.5, damage: (t.hp + 20) * 4, silent: true });
        this.heal += (ctx.maxHp * num("heal", 15)) / 100;
        break;
      }
      case "redHarvest":
        timed("redHarvest", num("seconds", 8));
        break;
      case "judgementDay":
        this.blasts.push({ pos: ctx.eye.clone().addScaledVector(ctx.fwd, num("range", 10) * 0.45), radius: num("range", 10) * 0.55, damage: num("damage", 300) * 0.6 });
        break;
      case "curtainCall": {
        // One shot that jumps from the target to its neighbours.
        const first = this.aimed(ctx, 60);
        if (!first) {
          this.said.push("No target");
          return false;
        }
        const hit = new Set<Enemy>([first]);
        let from = first;
        for (let i = 0; i < num("chains", 3); i++) {
          const next = ctx.enemies
            .filter((e) => e.alive && !hit.has(e) && e.position.distanceTo(from.position) < 12)
            .sort((a, b) => a.position.distanceTo(from.position) - b.position.distanceTo(from.position))[0];
          if (!next) break;
          hit.add(next);
          from = next;
        }
        let prev = ctx.eye.clone().addScaledVector(ctx.fwd, 0.4);
        for (const e of hit) {
          this.blasts.push({ pos: e.body.joints.chest.clone(), radius: 1.2, damage: num("damage", 150) * 0.7, silent: true });
          ctx.world.fx.tracer(prev, e.body.joints.chest);
          prev = e.body.joints.chest.clone();
        }
        break;
      }
      case "cyberpsychosis": {
        const t = this.aimed(ctx, 40);
        if (!t) {
          this.said.push("No target");
          return false;
        }
        // The mad one turns on its friends: it panics and its neighbours are scorched.
        t.panic(num("seconds", 6), ctx.player.pos);
        this.blasts.push({ pos: t.body.joints.chest.clone(), radius: 5, damage: 30, silent: true });
        break;
      }
      case "blackout": {
        const r = num("radius", 30);
        for (const e of ctx.enemies) {
          if (!e.alive || e.position.distanceTo(ctx.player.pos) > r) continue;
          e.lose(ctx.player.pos);
          e.panic(num("seconds", 4), ctx.player.pos);
        }
        timed("vanish", Math.min(3, num("seconds", 4)));
        break;
      }
      case "brew": {
        const pos = ctx.eye.clone().addScaledVector(ctx.fwd, 0.5);
        const vel = ctx.fwd.clone().multiplyScalar(14).add(new THREE.Vector3(0, 3, 0));
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0x7a2a6a, roughness: 0.5 }));
        ctx.world.scene.add(m);
        this.thrown.push({ pos, vel, fuse: 1.0, kind: "gas", damage: num("dps", 25), radius: num("radius", 8), mesh: m });
        this.brewing = { radius: num("radius", 8), seconds: num("seconds", 10) };
        break;
      }
      case "shieldDrone":
        this.shield = num("shield", 60);
        timed("shieldDrone", num("seconds", 15));
        break;
      case "battleFrame":
        timed("battleFrame", num("seconds", 12));
        break;
      case "hollowChild":
        timed("hollowChild", num("seconds", 10));
        break;
      case "mine": {
        const mines = this.deployed.filter((d) => d.kind === "mine");
        if (mines.length >= num("max", 3)) this.drop(mines[0]!);
        const pos = ctx.player.pos.clone().addScaledVector(ctx.fwd.clone().setY(0).normalize(), 1.2);
        pos.y = this.groundAt(pos.x, pos.z) + 0.04;
        this.deploy(ctx.world, { kind: "mine", pos, left: 600, damage: num("damage", 90) * 0.8, rate: 0, cool: 0 }, 0x6a7a2a, 0.12);
        break;
      }
      case "turret": {
        const pos = ctx.player.pos.clone().addScaledVector(ctx.fwd.clone().setY(0).normalize(), 1.5);
        pos.y = this.groundAt(pos.x, pos.z) + 0.35;
        this.deploy(ctx.world, { kind: "turret", pos, left: 25, damage: num("damage", 8), rate: 1 / Math.max(1, num("fireRate", 4)), cool: 0 }, 0x405060, 0.3);
        break;
      }
      case "hornet":
      case "familiar": {
        const pos = ctx.eye.clone().add(new THREE.Vector3(0.5, 0.5, 0));
        this.deploy(ctx.world, { kind: "drone", pos, left: fx.type === "hornet" ? num("seconds", 20) : 30, damage: num("dps", 10), rate: 0, cool: 0 }, 0xffd070, 0.1);
        break;
      }
      case "gas": {
        const pos = ctx.eye.clone().addScaledVector(ctx.fwd, 0.5);
        const vel = ctx.fwd.clone().multiplyScalar(14).add(new THREE.Vector3(0, 3, 0));
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3c5a2a, roughness: 0.5, metalness: 0.3 }));
        ctx.world.scene.add(m);
        this.thrown.push({ pos, vel, fuse: 1.2, kind: "gas", damage: num("dps", 12), radius: num("radius", 5), mesh: m });
        break;
      }
      default:
        this.said.push(`${a.name}: coming in a later build`);
        return false;
    }
    this.battery -= a.battery;
    this.cd.set(a.id, a.cooldown);
    this.said.push(a.name);
    return true;
  }

  /** The living enemy nearest the crosshair within `range` and a 12 degree cone. */
  private aimed(ctx: { eye: THREE.Vector3; fwd: THREE.Vector3; enemies: Enemy[] }, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDot = Math.cos((12 * Math.PI) / 180);
    for (const e of ctx.enemies) {
      if (!e.alive) continue;
      const to = e.body.joints.chest.clone().sub(ctx.eye);
      const dist = to.length();
      if (dist > range) continue;
      const dot = to.normalize().dot(ctx.fwd);
      if (dot > bestDot) {
        best = e;
        bestDot = dot;
      }
    }
    return best;
  }

  private brewing: { radius: number; seconds: number } | null = null;

  private deploy(world: World, d: Omit<Deployed, "mesh">, color: number, size: number): void {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: d.kind === "drone" ? color : 0, emissiveIntensity: 0.6 }));
    mesh.position.copy(d.pos);
    world.scene.add(mesh);
    this.deployed.push({ ...d, mesh });
  }

  private drop(d: Deployed): void {
    d.mesh.removeFromParent();
    this.deployed = this.deployed.filter((x) => x !== d);
  }

  lungeAt: Enemy | null = null;
  lungeT = 0;

  update(dt: number, d: DerivedStats, world: World, colliders: THREE.Box3[], ground: (x: number, z: number) => number, enemies: Enemy[] = []): void {
    this.battery = Math.min(d.battery, this.battery + d.batteryRegen * dt);
    this.clock += dt;
    this.groundAt = ground;
    const due = this.shells.filter((sh) => sh.at <= this.clock);
    for (const sh of due) {
      world.fx.explosion(sh.pos.clone(), 3);
      this.blasts.push({ pos: sh.pos.clone(), radius: 4, damage: Number(this.params.get("barrage")?.damage ?? 200) });
    }
    this.shells = this.shells.filter((sh) => sh.at > this.clock);
    for (const [k, v] of this.cd) this.cd.set(k, Math.max(0, v - dt));
    for (const [k, v] of this.timers) {
      this.timers.set(k, Math.max(0, v - dt));
      if (k === "mark" && v - dt <= 0) {
        for (const e of this.marked) e.setMarked(false, GLOW);
        this.marked.clear();
      }
    }
    this.lungeT = Math.max(0, this.lungeT - dt);
    if ((this.timers.get("shieldDrone") ?? 0) <= 0) this.shield = 0;
    this.updateDeployed(dt, world, enemies);
    if (this.healing) {
      this.heal += this.healing.rate * Math.min(dt, this.healing.left);
      this.healing.left -= dt;
      if (this.healing.left <= 0) this.healing = null;
    }
    // Thrown things: arcs, bounces off walls and the floor, then the bang.
    for (const t of this.thrown) {
      t.vel.y -= 9.81 * dt;
      const next = t.pos.clone().addScaledVector(t.vel, dt);
      const floor = ground(next.x, next.z);
      let hit = next.y <= floor + 0.05;
      for (const c of colliders) if (c.containsPoint(next)) hit = true;
      if (hit) {
        if (t.kind === "molotov") t.fuse = 0;
        t.vel.multiplyScalar(-0.35);
        t.vel.y = Math.abs(t.vel.y);
      } else t.pos.copy(next);
      t.pos.y = Math.max(t.pos.y, floor + 0.05);
      t.mesh.position.copy(t.pos);
      t.fuse -= dt;
      if (t.fuse <= 0) {
        t.mesh.removeFromParent();
        world.fx.explosion(t.pos.clone(), t.kind === "grenade" ? t.radius : t.radius * 0.6);
        if (t.kind === "grenade") this.blasts.push({ pos: t.pos.clone(), radius: t.radius, damage: t.damage });
        else {
          const brew = t.kind === "gas" ? this.brewing : null;
          this.fires.push({ pos: t.pos.clone(), radius: t.radius, dps: t.damage, left: brew ? brew.seconds : t.kind === "gas" ? 8 : 6, silent: t.kind === "gas" });
          if (brew) this.panicking.push({ pos: t.pos.clone(), radius: brew.radius, left: brew.seconds });
          this.brewing = null;
        }
      }
    }
    this.thrown = this.thrown.filter((t) => t.fuse > 0);
    for (const f of this.fires) {
      f.left -= dt;
      this.blasts.push({ pos: f.pos, radius: f.radius, damage: f.dps * dt, silent: f.silent });
    }
    this.fires = this.fires.filter((f) => f.left > 0);
  }

  /** Mines wait for a footstep, turrets and drones pick the nearest enemy; brew clouds keep victims panicking. */
  private updateDeployed(dt: number, world: World, enemies: Enemy[]): void {
    for (const p of this.panicking) {
      if (p.left <= 0) continue;
      p.left -= dt;
      for (const e of enemies) if (e.alive && e.position.distanceTo(p.pos) < p.radius) e.panic(1.5, p.pos);
    }
    this.panicking = this.panicking.filter((p) => p.left > 0);
    for (const d of [...this.deployed]) {
      d.left -= dt;
      if (d.left <= 0) {
        this.drop(d);
        continue;
      }
      if (d.kind === "mine") {
        if (enemies.some((e) => e.alive && e.position.distanceTo(d.pos) < 2.2)) {
          world.fx.explosion(d.pos.clone(), 3);
          this.blasts.push({ pos: d.pos.clone().setY(d.pos.y + 0.3), radius: 4.5, damage: d.damage });
          this.drop(d);
        }
        continue;
      }
      const range = d.kind === "turret" ? 30 : 25;
      let t: Enemy | null = null;
      let best = range;
      for (const e of enemies) {
        const dist = e.alive ? e.position.distanceTo(d.pos) : Infinity;
        if (dist < best) {
          best = dist;
          t = e;
        }
      }
      if (d.kind === "drone") {
        d.pos.y += Math.sin(this.clock * 3) * dt * 0.3;
        d.mesh.position.copy(d.pos);
      }
      if (!t) continue;
      if (d.kind === "drone") {
        d.pos.lerp(t.body.joints.chest.clone().add(new THREE.Vector3(0, 0.6, 0)), Math.min(1, dt * 1.5));
        d.mesh.position.copy(d.pos);
        this.blasts.push({ pos: t.body.joints.chest.clone(), radius: 1, damage: d.damage * dt, silent: true });
      } else if ((d.cool -= dt) <= 0) {
        d.cool = d.rate;
        world.fx.tracer(d.pos.clone(), t.body.joints.chest);
        this.blasts.push({ pos: t.body.joints.chest.clone(), radius: 0.8, damage: d.damage * 1.4, silent: false });
      }
    }
  }
}
