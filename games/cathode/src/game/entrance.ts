// Plan item 7 (2026-11-01): scripted entrances. An encounter's guards no longer just stand where they spawn: they
// come in. A breach blows a door off its frame and they run through the dust; a rappel drops them down a rope
// from a roof edge or a gantry; a van brakes across the street and they climb out of its side door. The jobs ask
// for one through `spawn(role, route, { entrance })`; the session owns the meshes and the timing here. In the
// unit tests (no session) the guard simply stands at his route's start, so the rules stay the same.

import * as THREE from "three";
import type { Enemy } from "./enemy";

export type EntranceKind = "breach" | "rappel" | "van";

export interface EntranceSpec {
  kind: EntranceKind;
  /** Breach: the door he comes through. Van: where the van starts its run. Rappel: the rope's anchor (height used). */
  from: THREE.Vector3;
  /** Seconds before it starts (a second man after the first). */
  delay?: number;
  /** Van: where it pulls up (else alongside where he lands). */
  stop?: THREE.Vector3;
  /** Holds it until Cath comes within this many metres of where he lands (so it happens in front of her). */
  trigger?: number;
  /** Breach: the gap's width (m); over 1.6 m it is a pair of leaves that blow apart. */
  doorW?: number;
}

/** One line per entrance that fired: e2e reads it through `window.cathode.entrances`. */
export interface EntranceEvent {
  kind: EntranceKind;
  role: string;
  at: { x: number; y: number; z: number };
  t: number;
}

/** Seconds on the rope: quicker per metre on a long drop (a 3.6 m vent takes 1.2 s, the vault's 18 m line 2.8 s). */
const rappelS = (drop: number) => Math.min(2.8, Math.max(1.2, 0.75 + drop * 0.115));
/** Where a man waiting for his entrance is parked: under the street, so no round, probe or sight line finds him. */
const HIDDEN = -60;
const BREACH_S = 0.9;
const VAN_DRIVE_S = 2.2;
const VAN_OUT_S = 0.7;

interface Live {
  spec: EntranceSpec;
  e: Enemy;
  /** Where he ends up (his route's first point). */
  to: THREE.Vector3;
  t: number;
  fired: boolean;
  group: THREE.Group | null;
  rope?: THREE.Mesh;
  doors?: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; rest: boolean }[];
  van?: { body: THREE.Group; path: [THREE.Vector3, THREE.Vector3]; yaw: number };
}

export interface EntranceHost {
  scene: THREE.Scene;
  ground(x: number, z: number): number;
  /** Dust, sparks and grit (the world's impact FX); absent in tests. */
  burst?(pos: THREE.Vector3, normal: THREE.Vector3): void;
  /** A boom for the breach and the van's door. */
  sound?(kind: "breach" | "brake" | "door"): void;
  /** Where Cath is, so the man turns to her as he lands. */
  player(): THREE.Vector3;
  light?(pos: THREE.Vector3, color: THREE.Color, intensity: number, range: number): () => void;
}

const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.55, metalness: 0.6 });
const vanPaint = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.35, metalness: 0.4 });
const vanStripe = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff8a20, emissiveIntensity: 1.4, roughness: 0.5 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.08, metalness: 0.9 });
const tyre = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.9 });
const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 3 });
const tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 2.2 });
const ropeMat = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.95 });

/** A Hollowell response van: a long panel body, a cab, wheels, headlamps, the amber company stripe. */
function makeVan(): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    g.add(b);
    return b;
  };
  box(2.1, 2.1, 3.6, vanPaint, 0, 1.45, -0.7);
  box(2.0, 1.4, 1.5, vanPaint, 0, 1.1, 1.75);
  box(1.9, 0.7, 0.05, glass, 0, 1.5, 2.5).rotation.x = -0.35;
  box(2.12, 0.12, 3.62, vanStripe, 0, 1.25, -0.7);
  box(0.3, 0.14, 0.04, lamp, 0.7, 0.95, 2.51);
  box(0.3, 0.14, 0.04, lamp, -0.7, 0.95, 2.51);
  box(0.2, 0.3, 0.04, tail, 0.85, 1.1, -2.52);
  box(0.2, 0.3, 0.04, tail, -0.85, 1.1, -2.52);
  box(2.15, 0.25, 0.3, steel, 0, 0.45, 2.45);
  for (const [x, z] of [[1, 1.6], [-1, 1.6], [1, -1.6], [-1, -1.6]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 14), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.4, z);
    g.add(w);
  }
  return g;
}

const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export class Entrances {
  readonly log: EntranceEvent[] = [];
  private live: Live[] = [];
  private clock = 0;

  constructor(private readonly h: EntranceHost) {}

  /** True while anyone is still on his way in. */
  get busy(): boolean {
    return this.live.some((l) => l.e.alive && !this.doneWith(l));
  }

  /**
   * Stages `e` (already spawned at his route's start) coming in by `spec`. He holds fire and moves on the script
   * until he lands, then he joins the fight already alerted to her.
   */
  add(e: Enemy, spec: EntranceSpec): void {
    const to = e.motion.pos.clone();
    const l: Live = { spec, e, to, t: -(spec.delay ?? 0), fired: false, group: null };
    e.passive = true;
    e.entering = true;
    // Out of sight (and out of reach of rounds: parked under the street) until his entrance starts.
    e.body.root.visible = false;
    e.lift = HIDDEN;
    if (spec.kind === "breach") {
      // The door stands shut in its frame until it blows.
      const dir = new THREE.Vector3().subVectors(to, spec.from).setY(0).normalize();
      const along = new THREE.Vector3(dir.z, 0, -dir.x);
      const w = spec.doorW ?? 1;
      const leaves = w > 1.6 ? 2 : 1;
      const lw = w / leaves - 0.04;
      const g = new THREE.Group();
      l.doors = [];
      for (let i = 0; i < leaves; i++) {
        const off = leaves === 1 ? 0 : (i === 0 ? -1 : 1) * (lw / 2 + 0.02);
        const door = new THREE.Mesh(new THREE.BoxGeometry(lw, 2.4, 0.07), steel);
        door.castShadow = true;
        door.position.copy(spec.from).addScaledVector(along, off).setY(this.h.ground(spec.from.x, spec.from.z) + 1.2);
        door.rotation.y = Math.atan2(dir.x, dir.z);
        g.add(door);
        // Each leaf blows out and away from the middle, tumbling.
        const vel = dir.clone().multiplyScalar(6 + Math.random() * 2).addScaledVector(along, Math.sign(off) * 2.2).setY(2.2 + Math.random());
        l.doors.push({ mesh: door, vel, spin: new THREE.Vector3(-4 - Math.random() * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2), rest: true });
      }
      this.h.scene.add(g);
      l.group = g;
    }
    this.live.push(l);
  }

  private doneWith(l: Live): boolean {
    const k = l.spec.kind;
    return l.t >= (k === "rappel" ? rappelS(l.spec.from.y - l.to.y) : k === "breach" ? BREACH_S : VAN_DRIVE_S + VAN_OUT_S);
  }

  private fire(l: Live): void {
    l.fired = true;
    const { e, spec } = l;
    e.body.root.visible = spec.kind !== "van";
    e.lift = spec.kind === "rappel" ? Math.max(2, spec.from.y - l.to.y) : spec.kind === "van" ? HIDDEN : 0;
    this.log.push({ kind: spec.kind, role: e.kit.role ?? "rifle", at: { x: l.to.x, y: l.to.y, z: l.to.z }, t: this.clock });
    const g = l.group ?? new THREE.Group();
    if (!l.group) this.h.scene.add(g);
    l.group = g;
    if (spec.kind === "rappel") {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 5), ropeMat);
      g.add(rope);
      l.rope = rope;
    } else if (spec.kind === "breach" && l.doors) {
      const dir = new THREE.Vector3().subVectors(l.to, spec.from).setY(0).normalize();
      const door = l.doors[0]!.mesh;
      for (const d of l.doors) d.rest = false;
      e.motion.pos.copy(spec.from).setY(this.h.ground(spec.from.x, spec.from.z));
      for (let i = 0; i < 4; i++) this.h.burst?.(spec.from.clone().setY(door.position.y - 0.8 + i * 0.5), dir);
      this.h.sound?.("breach");
      // Through the door at a run: a breach is already a fight.
      e.passive = false;
      e.entering = false;
      if (e.alive) e.alert(this.h.player());
      const off = this.h.light?.(door.position.clone().addScaledVector(dir, 0.6), new THREE.Color(1, 0.75, 0.45), 14, 9);
      if (off) setTimeout(off, 160);
    } else {
      const body = makeVan();
      const to = l.to;
      // The van stops alongside where he lands, its side door facing the fight.
      const fromFlat = spec.from.clone().setY(this.h.ground(spec.from.x, spec.from.z));
      const run = new THREE.Vector3().subVectors(to, fromFlat).setY(0);
      const side = new THREE.Vector3(run.z, 0, -run.x).normalize();
      const stop = spec.stop?.clone() ?? to.clone().addScaledVector(side, 1.6);
      stop.y = this.h.ground(stop.x, stop.z);
      const yaw = Math.atan2(stop.x - fromFlat.x, stop.z - fromFlat.z);
      body.position.copy(fromFlat);
      body.rotation.y = yaw;
      g.add(body);
      l.van = { body, path: [fromFlat, stop], yaw };
    }
  }

  update(dt: number): void {
    this.clock += dt;
    for (const l of this.live) {
      if (!l.fired && l.spec.trigger !== undefined && flat(this.h.player(), l.to) > l.spec.trigger) continue;
      l.t += dt;
      if (l.t < 0) continue;
      if (!l.fired) this.fire(l);
      const { e, spec } = l;
      // On the rope, or still in the van, he stays where the script has him (his patrol would walk him off).
      if (e.alive && e.entering && (spec.kind === "rappel" || e.lift === HIDDEN)) e.motion.pos.set(l.to.x, e.motion.pos.y, l.to.z);
      if (spec.kind === "rappel") {
        const k = Math.min(1, l.t / rappelS(spec.from.y - l.to.y));
        // Fast down the rope, braking at the end.
        const ease = 1 - (1 - k) * (1 - k);
        const top = spec.from.y - l.to.y;
        e.lift = e.alive ? Math.max(0, top * (1 - ease)) : 0;
        if (l.rope) {
          const anchorY = spec.from.y;
          const footY = l.to.y + e.lift + 1.5;
          const len = Math.max(0.1, anchorY - footY);
          l.rope.scale.y = len;
          l.rope.position.set(l.to.x, footY + len / 2, l.to.z);
        }
      } else if (spec.kind === "breach" && l.doors) {
        for (const d of l.doors) {
          if (d.rest) continue;
          d.vel.y -= 9.8 * dt;
          d.mesh.position.addScaledVector(d.vel, dt);
          d.mesh.rotation.x += d.spin.x * dt;
          d.mesh.rotation.y += d.spin.y * dt;
          d.mesh.rotation.z += d.spin.z * dt;
          const g = this.h.ground(d.mesh.position.x, d.mesh.position.z) + 0.05;
          if (d.mesh.position.y < g) {
            // Lands flat with a clang.
            d.mesh.position.y = g;
            d.mesh.rotation.set(-Math.PI / 2, d.mesh.rotation.y, 0);
            d.rest = true;
            this.h.sound?.("door");
          }
        }
      } else if (spec.kind === "van" && l.van) {
        const v = l.van;
        const k = Math.min(1, l.t / VAN_DRIVE_S);
        // Hard braking: most of the run in the first half.
        const ease = 1 - Math.pow(1 - k, 3);
        v.body.position.lerpVectors(v.path[0], v.path[1], ease);
        v.body.rotation.x = k < 1 ? 0 : Math.sin(Math.min(1, (l.t - VAN_DRIVE_S) / 0.25) * Math.PI) * -0.04;
        if (k >= 1 && !e.body.root.visible) {
          e.body.root.visible = true;
          e.lift = 0;
          e.motion.pos.copy(v.path[1]).lerp(l.to, 0.45);
          this.h.sound?.("brake");
        }
      }
      if (!this.doneWith(l) || !e.entering) {
        if (!e.alive && e.lift !== 0 && e.body.root.visible) e.lift = 0;
        continue;
      }
      e.lift = 0;
      e.entering = false;
      e.passive = false;
      l.rope?.removeFromParent();
      if (e.alive) e.alert(this.h.player());
    }
  }

  /** Drops every live entrance's meshes (a restart, the end of the session). */
  dispose(): void {
    for (const l of this.live) l.group?.removeFromParent();
    this.live = [];
  }
}
