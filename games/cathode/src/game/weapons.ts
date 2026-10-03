// The weapons Cath carries in the slice and their state machines: raise, fire, reload, the pump and the
// bolt, aiming down the sights, and the Pin's swing. Firing produces Shot requests that combat.ts resolves.
// Base numbers here are the slice's; sim/weapons.ts owns the full tables and the build scaling (ROADMAP 64).

import * as THREE from "three";
import type { WeaponClass } from "../sim/types";
import { buildGun, ViewAnim, type GunModel, type GunRig } from "./viewmodel";

export type FireKind = "hitscan" | "ballistic" | "melee";

export interface WeaponDef {
  id: string;
  name: string;
  model: GunModel;
  weaponClass: WeaponClass;
  kind: FireKind;
  damage: number;
  pellets: number;
  /** Seconds between shots (and between Pin swings). */
  cycle: number;
  mag: number;
  reserve: number;
  reload: number;
  /** Hip and aimed spread, radians. */
  spread: [number, number];
  /** How far a shot is heard, metres. */
  noise: number;
  /** Recoil kick strength. */
  kick: number;
  /** Muzzle velocity for ballistic rounds, m/s. */
  velocity?: number;
  range: number;
  /** Severs limbs easily (shotguns, the Pin at a kill). */
  brutal?: number;
  /** Explosive round: burst radius in metres (launchers). */
  blast?: number;
}

export const SLICE_WEAPONS: WeaponDef[] = [
  { id: "pin", name: "The Pin", model: "pin", weaponClass: "melee", kind: "melee", damage: 55, pellets: 1, cycle: 0.55, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 3, kick: 0, range: 2.1, brutal: 0.4 },
  { id: "kestrel", name: "Kestrel 9 (suppressed)", model: "pistol", weaponClass: "pistol", kind: "hitscan", damage: 34, pellets: 1, cycle: 0.16, mag: 12, reserve: 60, reload: 1.35, spread: [0.022, 0.004], noise: 7, kick: 0.6, range: 60 },
  { id: "fishmonger", name: "The Fishmonger", model: "shotgun", weaponClass: "shotgun", kind: "hitscan", damage: 16, pellets: 9, cycle: 0.85, mag: 6, reserve: 24, reload: 0.5, spread: [0.075, 0.05], noise: 48, kick: 1.8, range: 35, brutal: 1 },
  { id: "widowmaker", name: "Widowmaker", model: "sniper", weaponClass: "sniper", kind: "ballistic", damage: 140, pellets: 1, cycle: 1.25, mag: 5, reserve: 20, reload: 2.4, spread: [0.06, 0.0], noise: 14, kick: 2.4, velocity: 820, range: 600, brutal: 0.7 },
  { id: "oldTestament", name: "Old Testament", model: "revolver", weaponClass: "revolver", kind: "hitscan", damage: 62, pellets: 1, cycle: 0.45, mag: 6, reserve: 36, reload: 2.2, spread: [0.02, 0.003], noise: 55, kick: 2.0, range: 80, brutal: 0.5 },
  { id: "rattlecan", name: "Rattlecan", model: "smg", weaponClass: "smg", kind: "hitscan", damage: 15, pellets: 1, cycle: 0.075, mag: 30, reserve: 150, reload: 1.8, spread: [0.04, 0.016], noise: 40, kick: 0.5, range: 45 },
  { id: "corridorAR", name: "Corridor AR", model: "rifle", weaponClass: "rifle", kind: "hitscan", damage: 24, pellets: 1, cycle: 0.11, mag: 30, reserve: 120, reload: 2.1, spread: [0.03, 0.006], noise: 60, kick: 0.9, range: 120 },
  { id: "bargainBin", name: "Bargain Bin", model: "launcher", weaponClass: "launcher", kind: "hitscan", damage: 140, pellets: 1, cycle: 0.9, mag: 4, reserve: 12, reload: 3.2, spread: [0.02, 0.004], noise: 90, kick: 2.6, range: 140, blast: 5, brutal: 1 },
  { id: "nightShift", name: "Night Shift", model: "blade", weaponClass: "melee", kind: "melee", damage: 75, pellets: 1, cycle: 0.4, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 2, kick: 0, range: 2.0, brutal: 0.8 },
  { id: "repossessor", name: "Repossessor", model: "sledge", weaponClass: "melee", kind: "melee", damage: 150, pellets: 1, cycle: 1.0, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 10, kick: 0, range: 2.4, brutal: 1 },
];

export interface Shot {
  weapon: WeaponDef;
  origin: THREE.Vector3;
  /** One direction per pellet. */
  dirs: THREE.Vector3[];
  /** World position of the muzzle (for the flash and tracers). */
  muzzle: THREE.Vector3;
}

interface Held {
  def: WeaponDef;
  rig: GunRig;
  ammo: number;
  reserve: number;
}

export class Arsenal {
  readonly held: Held[];
  current = 0;
  readonly anim = new ViewAnim();
  private cd = 0;
  private reloading = 0;
  private shellReload = false;
  private raising = 0;
  private boltLeft = 0;
  private swingT = -1;
  private flashT = 0;
  aiming = false;
  /** Set when a melee swing lands its hit frame. */
  meleeNow = false;

  /** A soft key and a cool rim so the gun reads against the dark street; the muzzle light flashes on fire. */
  readonly flash = new THREE.PointLight(0xffc477, 0, 1.2, 2);

  constructor(scene: THREE.Scene) {
    const key = new THREE.DirectionalLight(0xfff0e0, 1.1);
    key.position.set(-0.5, 1, 0.6);
    const rim = new THREE.DirectionalLight(0x6fd8ff, 1.6);
    rim.position.set(1, 0.4, -1);
    const pink = new THREE.DirectionalLight(0xff2e88, 0.8);
    pink.position.set(-1, -0.2, -0.6);
    scene.add(key, rim, pink, this.flash);
    this.held = SLICE_WEAPONS.map((def) => {
      const rig = buildGun(def.model);
      rig.root.visible = false;
      scene.add(rig.root);
      return { def, rig, ammo: def.mag, reserve: def.reserve };
    });
    this.equip(1);
  }

  get weapon(): WeaponDef {
    return this.held[this.current]!.def;
  }

  get rig(): GunRig {
    return this.held[this.current]!.rig;
  }

  get ammo(): { mag: number; reserve: number } {
    const h = this.held[this.current]!;
    return { mag: h.ammo, reserve: h.reserve };
  }

  get busy(): boolean {
    return this.reloading > 0 || this.raising > 0 || this.boltLeft > 0;
  }

  equip(i: number): void {
    if (i < 0 || i >= this.held.length || (i === this.current && this.rig.root.visible)) return;
    this.rig.root.visible = false;
    this.current = i;
    this.rig.root.visible = true;
    this.raising = 0.35;
    this.reloading = 0;
    this.boltLeft = 0;
    this.swingT = -1;
  }

  private returnTo = -1;

  /** A takedown: the Pin comes out for one blow, then the gun she was holding comes back. */
  strike(): void {
    const prev = this.current;
    if (prev !== 0) {
      this.equip(0);
      this.raising = 0;
      this.returnTo = prev;
    }
    this.swingT = 0.06;
    this.cd = this.weapon.cycle;
  }

  /** Fills the held magazine from nowhere and cancels a reload (Spin Reload, Bullet Hose, Bang Bang). */
  topUp(): void {
    const h = this.held[this.current]!;
    if (h.def.mag === 0) return;
    h.ammo = h.def.mag;
    this.reloading = 0;
  }

  reload(): void {
    const h = this.held[this.current]!;
    if (h.def.mag === 0 || h.ammo >= h.def.mag || h.reserve <= 0 || this.reloading > 0) return;
    this.shellReload = h.def.weaponClass === "shotgun";
    this.reloading = h.def.reload;
  }

  /**
   * Advances timers; returns a Shot if the trigger fired this frame. `eye` and `dir` are the camera's.
   * `spreadMul` comes from the build (Aim) and stance.
   */
  update(
    dt: number,
    trigger: boolean,
    eye: THREE.Vector3,
    dir: THREE.Vector3,
    camQuat: THREE.Quaternion,
    spreadMul: number,
  ): Shot | null {
    const h = this.held[this.current]!;
    const def = h.def;
    this.cd -= dt;
    this.meleeNow = false;
    if (this.raising > 0) this.raising = Math.max(0, this.raising - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.intensity = this.flashT > 0 && def.id !== "kestrel" ? 6 : this.flashT > 0 ? 1.5 : 0;
    if (this.boltLeft > 0) this.boltLeft = Math.max(0, this.boltLeft - dt);

    // Reloads: magazines in one go; the shotgun one shell at a time (and a trigger pull cancels it).
    if (this.reloading > 0) {
      if (this.shellReload && trigger && h.ammo > 0) this.reloading = 0;
      else {
        this.reloading -= dt;
        if (this.reloading <= 0) {
          if (this.shellReload) {
            h.ammo++;
            h.reserve--;
            if (h.ammo < def.mag && h.reserve > 0) this.reloading = def.reload;
          } else {
            const take = Math.min(def.mag - h.ammo, h.reserve);
            h.ammo += take;
            h.reserve -= take;
          }
        }
      }
    }

    let shot: Shot | null = null;
    if (def.kind === "melee") {
      if (this.swingT >= 0) {
        this.swingT += dt;
        if (this.swingT >= 0.12 && this.swingT - dt < 0.12) this.meleeNow = true;
        if (this.swingT > def.cycle) {
          this.swingT = -1;
          if (this.returnTo >= 0) {
            this.equip(this.returnTo);
            this.returnTo = -1;
          }
        }
      } else if (trigger && this.cd <= 0 && this.raising <= 0) {
        this.swingT = 0;
        this.cd = def.cycle;
      }
    } else if (trigger && this.cd <= 0 && !this.busy) {
      if (h.ammo <= 0) this.reload();
      else {
        h.ammo--;
        this.cd = def.cycle;
        if (def.weaponClass === "sniper") this.boltLeft = def.cycle * 0.85;
        const spread = (this.aiming ? def.spread[1] : def.spread[0]) * spreadMul;
        const dirs: THREE.Vector3[] = [];
        for (let i = 0; i < def.pellets; i++) {
          const d = dir.clone();
          // A cone: random angle and radius (square root for an even spread).
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * spread;
          const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
          const up = new THREE.Vector3().crossVectors(right, d).normalize();
          d.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
          dirs.push(d);
        }
        // The view layer's camera sits at the origin looking down -Z, so the rig's muzzle is already in
        // camera space: carry it into the world with the eye's rotation.
        const local = new THREE.Vector3();
        this.rig.muzzle.getWorldPosition(local);
        const worldMuzzle = eye.clone().add(local.applyQuaternion(camQuat));
        shot = { weapon: def, origin: eye.clone(), dirs, muzzle: worldMuzzle };
        this.anim.fire(def.kick * (this.aiming ? 0.55 : 1));
        this.flashT = 0.06;
        this.flash.position.copy(this.rig.muzzle.getWorldPosition(new THREE.Vector3()));
        if (h.ammo === 0 && h.reserve > 0) this.reload();
      }
    }
    return shot;
  }

  /** Poses the current rig in the view scene. */
  pose(dt: number, look: { yaw: number; pitch: number }, stride: number, speed: number, sprint: boolean, landed: number, viewCamera: THREE.PerspectiveCamera, baseFov: number): void {
    const def = this.weapon;
    const r = this.rig;
    const a = this.anim;
    a.aim = THREE.MathUtils.damp(a.aim, this.aiming && !this.busy ? 1 : 0, 14, dt);
    // Dip for reloads and raising; the pump, slide and bolt travel.
    let dip = this.raising / 0.35;
    if (this.reloading > 0) dip = Math.max(dip, this.shellReload ? 0.35 : 0.6);
    if (this.boltLeft > 0) dip = Math.max(dip, 0.15);
    a.dip = THREE.MathUtils.damp(a.dip, dip, 12, dt);
    const cycle = def.cycle;
    const since = cycle - Math.max(0, this.cd);
    a.action = def.weaponClass === "pistol" ? Math.max(0, 1 - since / 0.07) : def.weaponClass === "shotgun" || def.weaponClass === "sniper" ? Math.max(0, Math.sin(Math.min(1, Math.max(0, (since - 0.15) / (cycle * 0.6))) * Math.PI)) : 0;
    a.swing = this.swingT >= 0 ? Math.sin(Math.min(1, this.swingT / 0.25) * Math.PI) * (this.swingT < 0.25 ? 1 : 0) : 0;
    a.roll = this.reloading > 0 && !this.shellReload ? 0.5 : 0;
    a.update(dt, look, stride, speed, sprint && !this.aiming, landed);
    const base = r.hip.clone().lerp(r.ads, a.aim);
    r.root.position.copy(base).add(a.pos);
    r.root.rotation.copy(a.rot);
    if (r.action) {
      if (def.weaponClass === "pistol") r.action.position.z = a.action * 0.03;
      else if (def.weaponClass === "shotgun") r.action.position.z = a.action * 0.08;
      else if (def.weaponClass === "sniper") {
        r.action.rotation.z = a.action * 1.3;
        r.action.position.z = 0.06 + Math.max(0, a.action - 0.5) * 0.12;
      }
    }
    // The scope: past 85% aim the rig hides and the overlay takes over.
    r.root.visible = !(r.scoped && a.aim > 0.85);
    const fov = THREE.MathUtils.lerp(baseFov, def.weaponClass === "sniper" ? r.adsFov : baseFov * 0.82, a.aim);
    if (Math.abs(viewCamera.fov - 55) > 0.01) viewCamera.fov = 55;
    viewCamera.updateProjectionMatrix();
    this.worldFov = fov;
  }
  /** The world camera's FOV this frame (zoom when aiming). */
  worldFov = 75;

  get scopedIn(): boolean {
    return !!this.rig.scoped && this.anim.aim > 0.85;
  }
}
