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
}

interface Thrown {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  kind: "grenade" | "molotov";
  damage: number;
  radius: number;
  mesh: THREE.Mesh;
}

interface Fire {
  pos: THREE.Vector3;
  radius: number;
  dps: number;
  left: number;
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
  readonly blasts: Array<{ pos: THREE.Vector3; radius: number; damage: number }> = [];

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
    };
  }

  /** Fires a slot. Returns false (and why, in `said`) when it can't. */
  use(slot: number, c: Character, d: DerivedStats, ctx: { player: Player; eye: THREE.Vector3; fwd: THREE.Vector3; enemies: Enemy[]; world: World }): boolean {
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
      default:
        this.said.push(`${a.name}: coming in a later build`);
        return false;
    }
    this.battery -= a.battery;
    this.cd.set(a.id, a.cooldown);
    this.said.push(a.name);
    return true;
  }

  lungeAt: Enemy | null = null;
  lungeT = 0;

  update(dt: number, d: DerivedStats, world: World, colliders: THREE.Box3[], ground: (x: number, z: number) => number): void {
    this.battery = Math.min(d.battery, this.battery + d.batteryRegen * dt);
    for (const [k, v] of this.cd) this.cd.set(k, Math.max(0, v - dt));
    for (const [k, v] of this.timers) {
      this.timers.set(k, Math.max(0, v - dt));
      if (k === "mark" && v - dt <= 0) {
        for (const e of this.marked) e.setMarked(false, GLOW);
        this.marked.clear();
      }
    }
    this.lungeT = Math.max(0, this.lungeT - dt);
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
        else this.fires.push({ pos: t.pos.clone(), radius: t.radius, dps: t.damage, left: 6 });
      }
    }
    this.thrown = this.thrown.filter((t) => t.fuse > 0);
    for (const f of this.fires) {
      f.left -= dt;
      this.blasts.push({ pos: f.pos, radius: f.radius, damage: f.dps * dt });
    }
    this.fires = this.fires.filter((f) => f.left > 0);
  }
}
