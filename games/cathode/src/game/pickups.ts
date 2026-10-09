// Loot on the ground: a kill leaves a glowing bundle where the enemy fell, tinted by its best rarity, and
// Cath picks it up by walking over it. Uncollected bundles fade after a couple of minutes.

import * as THREE from "three";
import { RARITY_COLOURS, type Item, type Rarity } from "../sim/loot";

export interface Drop {
  items: Item[];
  scrip: number;
  /** A gun dropped by an armed enemy (weapon id): ammo for it, or the gun itself if she hasn't carried one. */
  gun?: string;
}

/** The gun an armed enemy drops, if any; `roll` is a 0-1 random number. Shields drop nothing (the shield is theirs). */
export function gunDrop(role: "rifle" | "shield" | "sniper" | "orderly" | undefined, roll: number): string | undefined {
  if (role === "shield") return undefined;
  if (roll >= (role === "sniper" ? 0.5 : 0.35)) return undefined;
  return role === "sniper" ? "widowmaker" : role === "rifle" ? "corridorAR" : "kestrel";
}

export interface Pickup {
  drop: Drop;
  pos: THREE.Vector3;
  age: number;
  mesh?: THREE.Object3D;
}

const RANK: Rarity[] = ["standard", "modded", "rare", "set", "unique"];
export const PICKUP_RADIUS = 1.6;
export const PICKUP_LIFE = 150;

export function bestRarity(d: Drop): Rarity {
  let best = 0;
  for (const it of d.items) best = Math.max(best, RANK.indexOf(it.rarity));
  return RANK[best] ?? "standard";
}

export class Pickups {
  readonly list: Pickup[] = [];
  constructor(private readonly scene?: THREE.Scene) {}

  drop(pos: THREE.Vector3, d: Drop): Pickup | null {
    if (!d.items.length && !d.scrip && !d.gun) return null;
    const p: Pickup = { drop: d, pos: pos.clone(), age: 0 };
    if (this.scene) {
      const rarity = bestRarity(d);
      const colour = new THREE.Color(d.gun && !d.items.length ? "#9fb4c7" : RARITY_COLOURS[rarity]);
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(d.items.length ? 0.16 : 0.1),
        new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: rarity === "standard" ? 1.2 : 3, roughness: 0.3 }),
      );
      m.position.copy(p.pos);
      this.scene.add(m);
      p.mesh = m;
    }
    this.list.push(p);
    return p;
  }

  /** Advance the bobbing and fading; returns the bundles `at` is standing on (and removes them). */
  update(dt: number, at: THREE.Vector3): Drop[] {
    const got: Drop[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p) continue;
      p.age += dt;
      const dx = at.x - p.pos.x;
      const dz = at.z - p.pos.z;
      const near = dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS && Math.abs(at.y - p.pos.y) < 2.5;
      if (near) got.push(p.drop);
      if (near || p.age > PICKUP_LIFE) {
        this.remove(p);
        this.list.splice(i, 1);
      } else if (p.mesh) {
        p.mesh.position.y = p.pos.y + 0.35 + Math.sin(p.age * 3) * 0.06;
        p.mesh.rotation.y = p.age * 1.8;
      }
    }
    return got;
  }

  private remove(p: Pickup): void {
    if (!p.mesh) return;
    this.scene?.remove(p.mesh);
    const m = p.mesh as THREE.Mesh;
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }
}
