// Loot on the ground: a kill leaves a glowing bundle where the enemy fell, tinted by its best rarity, and
// Cath picks it up by walking over it. Uncollected bundles fade after a couple of minutes.

import * as THREE from "three";
import { RARITY_COLOURS, type Item, type Rarity } from "../sim/loot";
import { Beacon } from "./beacon";
import { buildGunDisplay } from "./viewmodel";
import { SLICE_WEAPONS } from "./weapons";

export interface Drop {
  items: Item[];
  scrip: number;
  /** A gun dropped by an armed enemy (weapon id): ammo for it, or the gun itself if she hasn't carried one. */
  gun?: string;
}

/** The gun an armed enemy drops, if any; `roll` is a 0-1 random number. Shields drop nothing (the shield is theirs). */
export function gunDrop(role: "rifle" | "shield" | "sniper" | "orderly" | "nurse" | "turret" | "hunter" | undefined, roll: number): string | undefined {
  if (role === "shield" || role === "turret") return undefined;
  if (roll >= (role === "sniper" ? 0.5 : 0.35)) return undefined;
  return role === "sniper" ? "widowmaker" : role === "rifle" ? "corridorAR" : "kestrel";
}

export interface Pickup {
  drop: Drop;
  pos: THREE.Vector3;
  age: number;
  mesh?: THREE.Object3D;
  beacon?: Beacon;
}

const RANK: Rarity[] = ["standard", "modded", "rare", "set", "unique"];
export const PICKUP_RADIUS = 1.6;
export const PICKUP_LIFE = 150;
/** A gun on the ground that would be a new weapon is taken with a press from this far (S7.1). */
export const PRESS_RADIUS = 3;

export function bestRarity(d: Drop): Rarity {
  let best = 0;
  for (const it of d.items) best = Math.max(best, RANK.indexOf(it.rarity));
  return RANK[best] ?? "standard";
}

export interface PickupOpts {
  /** True for a drop she must press to take (a gun she hasn't carried); everything else is walk-in. */
  needsPress?: (d: Drop) => boolean;
  /** She pressed to take this frame. */
  take?: boolean;
}

export class Pickups {
  readonly list: Pickup[] = [];
  /** The press-to-take drop in reach after the last update, for the world prompt (S7.1). */
  offer: Pickup | null = null;
  constructor(private readonly scene?: THREE.Scene) {}

  drop(pos: THREE.Vector3, d: Drop): Pickup | null {
    if (!d.items.length && !d.scrip && !d.gun) return null;
    const p: Pickup = { drop: d, pos: pos.clone(), age: 0 };
    if (this.scene) {
      const rarity = bestRarity(d);
      const gunOnly = !!d.gun && !d.items.length;
      const colour = new THREE.Color(gunOnly ? "#9fb4c7" : RARITY_COLOURS[rarity]);
      // A gun lies as itself (the real model); gear is a glowing bundle tinted by its best rarity.
      const model = d.gun ? SLICE_WEAPONS.find((w) => w.id === d.gun)?.model : undefined;
      let m: THREE.Object3D;
      if (model) {
        m = new THREE.Group();
        const g = buildGunDisplay(model);
        g.rotation.set(0, 0, Math.PI / 2);
        m.add(g);
      } else
        m = new THREE.Mesh(
          new THREE.OctahedronGeometry(d.items.length ? 0.16 : 0.1),
          new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: rarity === "standard" ? 1.2 : 3, roughness: 0.3 }),
        );
      m.position.copy(p.pos);
      this.scene.add(m);
      p.mesh = m;
      // S7.1 for loot: beam (1.6 m), rim and ring; a glint only above common; no nudge.
      const b = new Beacon({ colour: colour.getHex(), beam: 1.6, glint: rarity !== "standard", gun: model ? m : undefined, floorY: 0, glintAt: new THREE.Vector3(0, 0.4, 0) });
      b.group.position.copy(p.pos);
      this.scene.add(b.group);
      p.beacon = b;
    }
    this.list.push(p);
    return p;
  }

  /** Advance the bobbing and fading; returns the bundles `at` is standing on (and removes them). */
  update(dt: number, at: THREE.Vector3, opts: PickupOpts = {}): Drop[] {
    const got: Drop[] = [];
    this.offer = null;
    let best = Infinity;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p) continue;
      p.age += dt;
      const dx = at.x - p.pos.x;
      const dz = at.z - p.pos.z;
      const d2 = dx * dx + dz * dz;
      const level = Math.abs(at.y - p.pos.y) < 2.5;
      const press = !!opts.needsPress?.(p.drop);
      let near = !press && d2 < PICKUP_RADIUS * PICKUP_RADIUS && level;
      if (press && level && d2 < PRESS_RADIUS * PRESS_RADIUS) {
        if (opts.take && d2 < best) near = true;
        else if (d2 < best) {
          best = d2;
          this.offer = p;
        }
      }
      if (near) got.push(p.drop);
      if (near || p.age > PICKUP_LIFE) {
        this.remove(p);
        this.list.splice(i, 1);
        if (this.offer === p) this.offer = null;
      } else {
        if (p.mesh) {
          p.mesh.position.y = p.pos.y + 0.35 + Math.sin(p.age * 3) * 0.06;
          p.mesh.rotation.y = p.age * 1.8;
        }
        p.beacon?.update(dt, Math.sqrt(d2));
      }
    }
    // A press takes only the nearest one.
    if (opts.take && got.length > 1) got.length = 1;
    return got;
  }

  /** Removes every bundle on the ground (screenshot stages start clean). */
  clear(): void {
    for (const p of this.list) this.remove(p);
    this.list.length = 0;
    this.offer = null;
  }

  private remove(p: Pickup): void {
    p.beacon?.dispose();
    if (!p.mesh) return;
    this.scene?.remove(p.mesh);
    p.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
  }
}
