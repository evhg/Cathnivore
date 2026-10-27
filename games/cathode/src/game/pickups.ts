// Loot on the ground: a kill leaves a glowing bundle where the enemy fell, tinted by its best rarity, and
// Cath picks it up by walking over it. Uncollected bundles fade after a couple of minutes.

import * as THREE from "three";
import { RARITY_COLOURS, type Item, type Rarity } from "../sim/loot";
import { Beacon } from "./beacon";
import { buildGunDisplay } from "./viewmodel";
import { SLICE_WEAPONS } from "./weapons";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DroppedProp } from "./death";
import { place } from "./body";

export interface Drop {
  items: Item[];
  scrip: number;
  /** A gun dropped by an armed enemy (weapon id): ammo for it, or the gun itself if she hasn't carried one. */
  gun?: string;
}

/** The gun an armed enemy drops, if any; `roll` is a 0-1 random number. Shields drop nothing (the shield is theirs). */
export function gunDrop(role: "rifle" | "shield" | "sniper" | "orderly" | "nurse" | "turret" | "hunter" | "thug" | undefined, roll: number): string | undefined {
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
  /** C9: a gun that fell from his hands as a two-point body; the pickup lies where it comes to rest. */
  prop?: DroppedProp;
  /** The dropped gun's length along its holder's +Y (m). */
  len?: number;
}

/** Where a dropped gun leaves his hands (C9): the grip, the way the barrel points, and how fast it's going. */
export interface DropFrom {
  hand: THREE.Vector3;
  dir: THREE.Vector3;
  vel: THREE.Vector3;
}

/**
 * C9 (S4.4 loot): gear lies as a glinting tactical pouch on the street, not a floating octahedron: a dark fabric
 * pouch with a flap, a webbing strap and buckle, and a lit tag in its best rarity's colour.
 */
export function buildPouch(colour: THREE.Color, rarity: Rarity, seed = 0): THREE.Group {
  const g = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.86, metalness: 0.02 });
  const web = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.7, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.32, metalness: 0.9 });
  const tag = new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: rarity === "standard" ? 1.4 : 3.2, roughness: 0.3 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  add(new RoundedBoxGeometry(0.21, 0.11, 0.13, 2, 0.028), fabric, 0, 0.055, 0);
  add(new RoundedBoxGeometry(0.215, 0.028, 0.1, 2, 0.012), fabric, 0, 0.118, -0.018).rotation.x = -0.12;
  add(new THREE.BoxGeometry(0.036, 0.125, 0.138), web, 0, 0.06, 0);
  add(new THREE.BoxGeometry(0.044, 0.026, 0.008), steel, 0, 0.09, 0.07);
  add(new THREE.BoxGeometry(0.13, 0.012, 0.004), tag, 0.0, 0.03, 0.067);
  // A second, smaller pouch strapped beside it on a better drop.
  if (rarity !== "standard") add(new RoundedBoxGeometry(0.09, 0.08, 0.1, 2, 0.02), fabric, 0.155, 0.04, 0.01).rotation.y = 0.2;
  g.rotation.y = (seed * 2.399) % (Math.PI * 2);
  return g;
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
  /** The street under a dropped gun (set by the session); flat by default. */
  ground: (x: number, z: number) => number = () => 0;
  /** A dropped gun lands (C9): the session plays the clatter. */
  onClatter: ((k: number, at: THREE.Vector3) => void) | null = null;
  /** The press-to-take drop in reach after the last update, for the world prompt (S7.1). */
  offer: Pickup | null = null;
  constructor(private readonly scene?: THREE.Scene) {}

  drop(pos: THREE.Vector3, d: Drop, from?: DropFrom): Pickup | null {
    if (!d.items.length && !d.scrip && !d.gun) return null;
    const p: Pickup = { drop: d, pos: pos.clone(), age: 0 };
    if (this.scene) {
      const rarity = bestRarity(d);
      const gunOnly = !!d.gun && !d.items.length;
      const colour = new THREE.Color(gunOnly ? "#9fb4c7" : RARITY_COLOURS[rarity]);
      // A gun lies as itself (the real model, fallen from his hands: C9); gear is a pouch tagged in its rarity.
      const model = d.gun ? SLICE_WEAPONS.find((w) => w.id === d.gun)?.model : undefined;
      let m: THREE.Object3D;
      if (model) {
        m = new THREE.Group();
        const g = buildGunDisplay(model);
        // The barrel (-Z) along the holder's +Y, which runs from the grip end to the muzzle end of the prop.
        g.rotation.set(Math.PI / 2, 0, 0);
        m.add(g);
        g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g);
        const c = box.getCenter(new THREE.Vector3());
        g.position.set(-c.x, -box.min.y, -c.z);
        p.len = Math.max(0.15, box.max.y - box.min.y);
        const a = from ? from.hand.clone() : p.pos.clone().setY(p.pos.y + 0.04);
        const dir = from ? from.dir.clone().normalize() : new THREE.Vector3(Math.cos(pos.x * 7.1), 0, Math.sin(pos.z * 7.1));
        const b = a.clone().addScaledVector(dir, p.len);
        p.prop = new DroppedProp(a, b, from ? from.vel : new THREE.Vector3(), from ? 2.5 : 0, (speed, at) => this.onClatter?.(Math.min(1, speed / 4), at));
        place(m, p.prop.a, p.prop.b, new THREE.Vector3(0, 1, 0));
      } else {
        m = buildPouch(colour, rarity, Math.floor(pos.x * 13 + pos.z * 7));
        m.position.copy(p.pos);
      }
      this.scene.add(m);
      p.mesh = m;
      // S7.1 for loot: beam (1.6 m), rim and ring; a glint only above common; no nudge.
      const b = new Beacon({ colour: colour.getHex(), beam: 1.6, glint: rarity !== "standard", gun: model ? m : undefined, floorY: 0, glintAt: new THREE.Vector3(0, model ? 0.12 : 0.16, 0) });
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
        if (p.prop && p.mesh && !p.prop.asleep) {
          // Falling, bouncing, coming to rest: the pickup (and its beacon) is wherever it lies.
          p.prop.step(dt, this.ground);
          place(p.mesh, p.prop.a, p.prop.b, new THREE.Vector3(0, 1, 0));
          p.pos.copy(p.prop.a).lerp(p.prop.b, 0.5);
          p.pos.y = this.ground(p.pos.x, p.pos.z);
          p.beacon?.group.position.copy(p.pos);
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
