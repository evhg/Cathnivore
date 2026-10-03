// The kill-cam: on a long killing shot the camera rides the round in slow motion, cuts to an X-ray of the
// target as it arrives (skull and ribs under the armour), then lingers on the fall. Tap or click skips it.

import * as THREE from "three";
import type { World } from "../render/types";
import type { Projectile } from "./combat";
import type { Enemy } from "./enemy";
import { place } from "./body";

const bone = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0x7fc8ff, emissiveIntensity: 1.6, roughness: 0.4 });
const shell = new THREE.MeshBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending });
const socket = new THREE.MeshBasicMaterial({ color: 0x020408 });

/** A stylised skeleton hung on the same joints as the body. */
class Skeleton {
  readonly root = new THREE.Group();
  private parts: Array<{ o: THREE.Object3D; a: string; b: string }> = [];
  private skull: THREE.Group;

  constructor() {
    const limb = (a: string, b: string, r: number) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 1, 8), bone);
      m.position.y = 0.5;
      g.add(m);
      this.root.add(g);
      this.parts.push({ o: g, a, b });
    };
    limb("pelvis", "neck", 0.022); // spine
    for (const s of ["L", "R"]) {
      limb(`shoulder${s}`, `elbow${s}`, 0.02);
      limb(`elbow${s}`, `hand${s}`, 0.016);
      limb(`hip${s}`, `knee${s}`, 0.026);
      limb(`knee${s}`, `foot${s}`, 0.022);
    }
    // The ribcage: arcs around the chest.
    const ribs = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.13 - i * 0.008, 0.008, 6, 20, Math.PI * 1.5), bone);
      t.rotation.set(Math.PI / 2, 0, Math.PI * 0.25);
      t.position.y = 0.05 + i * 0.045;
      ribs.add(t);
    }
    this.root.add(ribs);
    this.parts.push({ o: ribs, a: "chest", b: "neck" });
    const pelvis = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16, Math.PI), bone);
    pelvis.rotation.x = Math.PI / 2;
    const pg = new THREE.Group();
    pg.add(pelvis);
    this.root.add(pg);
    this.parts.push({ o: pg, a: "pelvis", b: "chest" });
    // The skull, with sockets and a jaw.
    this.skull = new THREE.Group();
    const cran = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), bone);
    cran.scale.set(0.9, 1, 1.1);
    cran.position.y = 0.14;
    this.skull.add(cran);
    for (const x of [-0.035, 0.035]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), socket);
      e.position.set(x, 0.13, 0.09);
      this.skull.add(e);
    }
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), bone);
    jaw.position.set(0, 0.05, 0.05);
    this.skull.add(jaw);
    this.root.add(this.skull);
    this.parts.push({ o: this.skull, a: "neck", b: "head" });
  }

  pose(e: Enemy): void {
    const j = e.body.joints as Record<string, THREE.Vector3>;
    for (const p of this.parts) place(p.o, j[p.a]!, j[p.b]!, e.body.facing);
    for (const p of this.parts) {
      // Limbs are unit cylinders: stretch them to the bone's length.
      if (p.o.children.length === 1 && (p.o.children[0] as THREE.Mesh).geometry instanceof THREE.CylinderGeometry)
        p.o.scale.set(1, j[p.a]!.distanceTo(j[p.b]!), 1);
    }
    // Hide the bones of anything severed.
    this.skull.visible = !e.body.lost.has("head");
  }

  crack(): void {
    // The impact: the skull's pieces jolt apart.
    for (const c of this.skull.children) c.position.multiplyScalar(1.35);
  }
}

export class KillCam {
  active = false;
  private p: Projectile | null = null;
  private target: Enemy | null = null;
  private phase: "flight" | "xray" | "after" = "flight";
  private t = 0;
  private scale = 0.03;
  private bullet: THREE.Mesh;
  private skel: Skeleton | null = null;
  private saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private orbit = 0;
  private lookAt = new THREE.Vector3();

  constructor(private readonly world: World) {
    const g = new THREE.CapsuleGeometry(0.006, 0.03, 4, 8);
    g.rotateX(Math.PI / 2);
    this.bullet = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb08d3c, metalness: 1, roughness: 0.25, emissive: 0x2a1a00 }));
    this.bullet.visible = false;
    world.scene.add(this.bullet);
  }

  start(p: Projectile): void {
    if (!p.target) return;
    this.active = true;
    this.p = p;
    this.target = p.target.enemy;
    this.phase = "flight";
    this.t = 0;
    const dist = p.pos.distanceTo(this.target.body.joints.chest);
    // Stretch the flight to about 1.6 s of real time, however far it is.
    this.scale = Math.min(0.2, dist / (p.vel.length() * 1.6));
    this.bullet.visible = true;
    this.orbit = Math.random() < 0.5 ? -1 : 1;
    this.world.setDrama(0.6);
  }

  /** Game time passes at this rate while the kill-cam runs. */
  get timeScale(): number {
    if (!this.active) return 1;
    return this.phase === "flight" ? this.scale : this.phase === "xray" ? this.scale * 0.4 : 0.22;
  }

  skip(): void {
    if (this.active) this.finish();
  }

  /** Moves the world camera for the shot. Real (unscaled) dt. */
  update(realDt: number): void {
    if (!this.active || !this.p || !this.target) return;
    const cam = this.world.camera;
    this.t += realDt;
    const p = this.p;
    const tgt = this.target;
    const dir = p.vel.clone().normalize();
    const aimPt = p.target!.joint === "head" ? tgt.body.joints.head : tgt.body.joints.chest;
    const left = p.alive ? p.pos.distanceTo(aimPt) : 0;
    if (this.phase === "flight" && left < 3.2) {
      this.phase = "xray";
      this.t = 0;
      this.xray(true);
      this.world.setDrama(1);
    }
    if (this.phase !== "after" && !p.alive) {
      this.phase = "after";
      this.t = 0;
      this.skel?.crack();
    }
    this.bullet.visible = p.alive;
    if (p.alive) {
      this.bullet.position.copy(p.pos);
      this.bullet.lookAt(p.pos.clone().add(dir));
    }
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(this.orbit);
    if (this.phase === "flight") {
      cam.position.copy(p.pos).addScaledVector(dir, -0.55).addScaledVector(side, 0.12).add(new THREE.Vector3(0, 0.06, 0));
      this.lookAt.copy(p.pos).addScaledVector(dir, 0.6);
    } else if (this.phase === "xray") {
      // Swing to the side of the target as the round arrives.
      const k = Math.min(1, this.t / 0.35);
      const want = aimPt.clone().addScaledVector(side, 1.4).addScaledVector(dir, -0.6).add(new THREE.Vector3(0, 0.15, 0));
      cam.position.lerp(want, 0.15 + 0.5 * k);
      this.lookAt.lerp(aimPt, 0.3);
    } else {
      // The fall: a slow orbit out.
      const centre = tgt.body.joints.chest;
      const a = this.t * 0.5 * this.orbit;
      const off = side.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(2.2 + this.t * 0.6);
      cam.position.lerp(centre.clone().add(off).add(new THREE.Vector3(0, 0.9, 0)), 0.08);
      this.lookAt.lerp(centre, 0.2);
      if (this.t > 0.45) this.xray(false);
      if (this.t > 1.7) this.finish();
    }
    cam.lookAt(this.lookAt);
    if (this.skel) this.skel.pose(tgt);
  }

  private xray(on: boolean): void {
    if (!this.target) return;
    if (on && !this.skel) {
      this.skel = new Skeleton();
      this.world.scene.add(this.skel.root);
      this.target.body.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          this.saved.set(m, m.material);
          m.material = shell;
        }
      });
      this.target.rifle.visible = false;
    } else if (!on && this.skel) {
      for (const [m, mat] of this.saved) m.material = mat;
      this.saved.clear();
      this.skel.root.removeFromParent();
      this.skel = null;
      this.target.rifle.visible = true;
    }
  }

  private finish(): void {
    this.xray(false);
    this.active = false;
    this.p = null;
    this.target = null;
    this.bullet.visible = false;
    this.world.setDrama(0);
  }
}
