// The Fish Market, the first job, teaches one thing at a time (owner's playtest, 2026-10-04: "start very
// simple, and introduce game concepts and items one by one"). Cath walks in with only the Pin.
//   1. Move and look.            2. A guard with his back turned: crouch, takedown.
//   3. Tomas's pistol: aim, fire, reload, and two Enforcers under the flyover.
//   4. Her old case on the walkway: the class weapon and Focus; a sniper and a patrol between her and the
//      water taxi.                5. The water taxi: job done.
// Each stage spawns its own enemies, so nothing shoots at her before she has been shown how to answer.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Enemy } from "./enemy";
import type { Player } from "./player";
import type { Progress, Feature } from "./progress";
import { CLASS_WEAPON } from "./progress";
import { Beacon } from "./beacon";
import { buildDisplay } from "./stall";
import { buildGunLOD } from "./viewmodel";
import { SLICE_WEAPONS } from "./weapons";

export type Role = "rifle" | "shield" | "sniper";

export interface JobHost {
  player: Player;
  progress: Progress;
  scene: THREE.Scene;
  markers: Record<string, THREE.Vector3[]>;
  ground(x: number, z: number): number;
  touch: boolean;
  spawn(role: Role, route: THREE.Vector3[], opts?: { yaw?: number; passive?: boolean }): Enemy;
  /** Gives her a weapon and puts it in her hands. */
  arm(id: string): void;
  say(text: string): void;
  teach(text: string | null): void;
  banner(title: string, sub: string, kind?: "boss"): void;
  /** Rolls the ending credits (vault finale); absent in tests. */
  finale?(): void;
  /** A pooled real light (see World.light); absent in tests. */
  /** Extra loot rolls dropped at a point (bounties); absent in tests. */
  drop?(pos: THREE.Vector3, rolls: number): void;
  light?(pos: THREE.Vector3, color: THREE.Color, intensity: number, range: number): () => void;
  /** The view, so the glint keeps its on-screen size floor (S7.1); absent in tests. */
  view?(): { cam: THREE.Camera; w: number; h: number; scale: number };
  /** Makes a box solid for her and for rounds; returns the undo. Absent in tests. */
  block?(box: THREE.Box3): () => void;
  /** The new-weapon toast and sting (S7.1); absent in tests, where the banner stands in. */
  toast?(kind: string, name: string): void;
}

/** The first gun's shaft (m): tall enough to clear the stall's work lamp and read from down the street. */
const BEAM_H = 3.6;
const AMBER = new THREE.Color(0xffb347).convertSRGBToLinear();
const SODIUM = new THREE.Color(0xffa860).convertSRGBToLinear();

/**
 * Bakes the static meshes directly under `root` (or `only`, if given) into one mesh per material, so a stall of a
 * dozen boxes costs a handful of draw calls (and the same again in the shadow and mirror passes).
 */
export function mergeStatic(root: THREE.Object3D, only?: THREE.Mesh[]): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const meshes = only ?? (root.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[]);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const m of meshes) {
    const mat = m.material as THREE.Material;
    const g = m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const indexed = list.every((g) => g.index);
    const merged = mergeGeometries(indexed ? list : list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    if (!merged) continue;
    for (const m of meshes)
      if (m.material === mat) {
        m.removeFromParent();
        m.geometry.dispose();
      }
    root.add(new THREE.Mesh(merged, mat));
  }
}

/**
 * The next weapon she's handed, on show (S7.1): an open case on a market-stall trestle, the gun lying in a cut-foam
 * insert, lit from inside the lid, with the beacon over it. She takes it with a press, and the lid snaps shut.
 */
export class Case {
  readonly group = new THREE.Group();
  /** Where the gun lies (world space): the prompt, the arrow and the sightline aim here. */
  readonly gunAt: THREE.Vector3;
  readonly beacon: Beacon;
  /** How high over the gun the objective diamond floats: just above the beam's top. */
  readonly markLift = BEAM_H + 0.45;
  private lid: THREE.Group;
  private caseG: THREE.Group;
  private strip: THREE.Object3D;
  private gun: THREE.Object3D;
  private t = 0;
  private closing = -1;
  private unlight: (() => void) | null = null;
  private unblock: (() => void) | null = null;
  constructor(
    readonly pos: THREE.Vector3,
    scene: THREE.Scene,
    light?: JobHost["light"],
    /** The weapon on show, or null for a document (Crisp's ledger). */
    readonly weapon: string | null = "kestrel",
    /** Which way the stall faces (radians about y): towards where she comes from. */
    face = 0,
    block?: JobHost["block"],
  ) {
    const def = weapon ? SLICE_WEAPONS.find((w) => w.id === weapon) : undefined;
    // The gun, laid on its side along the stall, and the case sized to it.
    if (def) {
      // The real Kestrel from the kit, as a world LOD (full model up close, one mesh past 8 m, a box past 30 m).
      this.gun = buildGunLOD(def.model);
      this.gun.rotation.set(0, Math.PI / 2, Math.PI / 2);
    } else {
      // A ledger: oxblood boards, cream page edges, a brass clasp.
      const book = new THREE.Group();
      const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 1 });
      const boards = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.05, 0.22, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x4a1218, roughness: 0.55 }));
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.038, 0.205), new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 }));
      pages.position.x = 0.006;
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.054, 0.04), brass);
      clasp.position.x = 0.15;
      book.add(boards, pages, clasp);
      this.gun = book;
    }
    this.gun.updateMatrixWorld(true);
    const gs = new THREE.Box3().setFromObject(this.gun).getSize(new THREE.Vector3());
    const W = Math.max(0.5, gs.x + 0.16);
    const D = Math.max(0.3, gs.z + 0.16);
    const name = (def?.name ?? "Ledger").replace(/ \(.*\)$/, "").toUpperCase();
    const d = buildDisplay(this.gun, W, D, [name, def ? "NOT FOR SALE" : "PRIVATE"]);
    const { top, H } = d;
    this.strip = d.strip;
    mergeStatic(d.stall);
    this.group.add(d.stall);
    const caseG = d.caseG;
    this.caseG = caseG;
    mergeStatic(caseG);
    caseG.add(this.gun);
    this.lid = d.lid;
    this.lid.rotation.x = -THREE.MathUtils.degToRad(100);
    mergeStatic(this.lid, this.lid.children.filter((c) => c !== d.strip) as THREE.Mesh[]);
    caseG.add(this.lid);
    this.group.add(caseG);
    this.beacon = new Beacon({ beam: BEAM_H, glint: true, gun: this.gun, floorY: 0, glintAt: new THREE.Vector3(0, top + H + 0.05, 0) });
    // The shaft rises from just behind the gun, in front of the open lid, so the gun itself stays clear.
    this.beacon.beam.position.set(0, top + H, -D / 2 + 0.05);
    this.group.add(this.beacon.group);
    this.group.rotation.y = face;
    this.group.position.copy(pos);
    scene.add(this.group);
    this.group.updateMatrixWorld(true);
    this.gunAt = new THREE.Vector3(0, top + H + 0.04, 0).applyMatrix4(this.group.matrixWorld);
    // The trestle is solid (she walks round it, rounds stop in it); only up to its top, so the gun stays in sight.
    const table = new THREE.Box3(new THREE.Vector3(-(W / 2 + 0.32), 0, -(D / 2 + 0.22)), new THREE.Vector3(W / 2 + 0.32, top, D / 2 + 0.22)).applyMatrix4(this.group.matrixWorld);
    this.unblock = block?.(table) ?? null;
    // The work lamp's light, over the case.
    this.unlight = light?.(new THREE.Vector3(0.02, 1.7, -(D / 2 + 0.12)).applyMatrix4(this.group.matrixWorld), AMBER, 7, 5) ?? null;
  }

  /** Per frame: `from` is where Cath stands (the beam fades as she closes in). */
  update(dt: number, from?: THREE.Vector3, cam?: THREE.Camera, viewW?: number, viewH?: number, hudScale?: number): void {
    this.t += dt;
    const dist = from ? from.distanceTo(this.gunAt) : 20;
    this.beacon.update(dt, dist, cam, viewH, viewW, hudScale);
    if (this.closing >= 0) {
      // The lid snaps shut in 200 ms, then the case is hers.
      this.closing += dt;
      const k = Math.min(1, this.closing / 0.2);
      this.lid.rotation.x = -THREE.MathUtils.degToRad(100) * (1 - k * k);
      if (k >= 1 && this.gun.parent) {
        // Shut: the gun is in her hands and the beacon is out for good, so neither costs a draw call any more.
        this.gun.removeFromParent();
        this.beacon.dispose();
        // The lid's lining and lamp strip are inside the shut case now; its shell joins the case's.
        this.strip.removeFromParent();
        const meshes = [...this.caseG.children, ...this.lid.children].filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
        mergeStatic(this.caseG, meshes);
      }
    }
  }

  /** Taken: the lid closes and the beacon goes out. */
  take(): void {
    if (this.closing >= 0) return;
    this.closing = 0;
    this.beacon.group.visible = false;
  }

  get taken(): boolean {
    return this.closing >= 0;
  }

  remove(): void {
    this.group.removeFromParent();
    this.beacon.dispose();
    this.unlight?.();
    this.unblock?.();
  }
}

/** A street lamp hung over the first guard, so he reads as a silhouette in the rain from down the street. */
class Lamp {
  readonly group = new THREE.Group();
  private unlight: (() => void) | null;
  constructor(at: THREE.Vector3, scene: THREE.Scene, light?: JobHost["light"]) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.8 });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 16, 1, true), metal);
    shade.position.y = 3.3;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.6) }));
    bulb.position.y = 3.2;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3, 4), metal);
    cable.position.y = 4.9;
    // A pool of light on the wet street under him.
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.03;
    this.group.add(shade, bulb, cable, pool);
    this.group.position.copy(at);
    scene.add(this.group);
    this.unlight = light?.(at.clone().add(new THREE.Vector3(0, 3, 0)), SODIUM, 9, 9) ?? null;
  }
  remove(): void {
    this.group.removeFromParent();
    this.unlight?.();
  }
}

/** Where she stands after the first takedown (behind the guard under the lamp), facing down the street (-z). */
export const TAKEDOWN_POSE = { x: -1.5, z: 37.7, yaw: 0 };
/** The guard under the lamp. */
export const FIRST_GUARD = { x: -1.5, z: 36.5 };
/** Tomas's pistol case. */
// S7.1's placement rule: within 15 degrees of her facing at the takedown, within 10 m, in plain sight on a stall in
// the middle of the street (it used to sit 12 m off behind the pawn shop's car, 47% of the way to the screen edge).
export const FIRST_CASE = { x: -3.2, z: 29.4 };
/** Ground distance from her to a thing (its height doesn't count against reach). */
export function reach(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}
/** How close she must be to take a weapon from its case (the world prompt shows inside this). */
export const TAKE_RANGE = 3;

const KEYS = {
  move: ["WASD to move, mouse to look.", "Left thumb: move. Right thumb: look."],
  takedown: [
    "Follow the marker. C to crouch, creep up right behind him, then F for a silent takedown.",
    "Follow the marker. Tap Crouch, creep up right behind him, then tap Takedown.",
  ],
  fire: ["Left click to fire, right click to aim, R to reload.", "Fire to shoot, Aim to aim. Cath fires on her own at anyone shooting at her."],
  focus: ["Right click to aim. Hold X to slow time and steady your breath.", "Aim, then hold Focus to slow time and steady your breath."],
  done: ["K opens Cath's sheet: spend skill points there.", "The Cath button opens her sheet: spend skill points there."],
};

export class FirstJob {
  stage = 0;
  objective = "";
  done = false;
  /** Where the objective is, for the waypoint marker (null when there's nothing to point at). */
  target: THREE.Vector3 | null = null;
  private wave: Enemy[] = [];
  private pickup: Case | null = null;
  private spent: Case[] = [];
  private lamp: Lamp | null = null;
  private wait = 0;

  constructor(private readonly h: JobHost) {
    const owned = h.progress.unlocks.weapons;
    const cls = h.progress.character.classes[0]!;
    // Pick up where she left off if she's been here before (a death mid-job restarts the street).
    if (owned.includes(CLASS_WEAPON[cls] ?? "")) this.goto(4, true);
    else if (owned.includes("kestrel")) this.goto(3, true);
    else this.goto(0);
  }

  private key(k: keyof typeof KEYS): string {
    return KEYS[k][this.h.touch ? 1 : 0]!;
  }

  private teachFeatures(...fs: Feature[]): void {
    for (const f of fs) this.h.progress.teach(f);
  }

  private P(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, this.h.ground(x, z), z);
  }

  /** The case on offer right now, if any (screenshot stages and the HUD prompt read it). */
  get case(): Case | null {
    return this.pickup;
  }

  /**
   * The weapon on offer within reach (S7.1 layer 5), for the HUD's world prompt: its case and name, or null.
   */
  offer(): { at: THREE.Vector3; weapon: string } | null {
    const c = this.pickup;
    if (!c?.weapon || c.taken || this.wait > 0) return null;
    return reach(this.h.player.pos, c.gunAt) <= TAKE_RANGE ? { at: c.gunAt, weapon: c.weapon } : null;
  }

  /**
   * C9: the flyover fight on a new save, before either Enforcer is down: the first gun kill she makes here is staged
   * as the gut clutch (S4.4), the death the owner sees first.
   */
  get firstGunKill(): boolean {
    return this.stage === 3 && this.wave.length > 0 && this.wave.every((e) => e.alive) && !this.h.progress.jobsDone.includes("fishMarket");
  }

  /** She pressed to take it; true when there was something within reach. */
  take(): boolean {
    const c = this.pickup;
    if (!c || c.taken || reach(this.h.player.pos, c.gunAt) > TAKE_RANGE) return false;
    c.take();
    return true;
  }

  /** Screenshot stages (S0): jump straight to a stage; the guards of the stage before drop where they stand. */
  skipTo(stage: number): void {
    for (const e of this.wave) if (e.alive) e.die(new THREE.Vector3(0, -0.5, -1), e.body.joints.chest.clone());
    this.wave = [];
    this.lamp?.remove();
    this.lamp = null;
    this.wait = 0;
    this.goto(stage);
  }

  private goto(stage: number, resumed = false): void {
    this.stage = stage;
    // A case she has emptied stays where it stood, shut (the stall doesn't vanish); one she never took goes.
    if (this.pickup?.taken) this.spent.push(this.pickup);
    else this.pickup?.remove();
    this.pickup = null;
    const h = this.h;
    switch (stage) {
      case 0:
        this.objective = "Walk down the street.";
        this.target = this.P(-2, 46);
        h.teach(this.key("move"));
        break;
      case 1: {
        this.objective = "A Hollowell guard under the lamp ahead. Take him down quietly.";
        this.teachFeatures("crouch", "takedown");
        const g = h.spawn("rifle", [this.P(FIRST_GUARD.x, FIRST_GUARD.z)], { yaw: Math.PI, passive: true });
        this.wave = [g];
        this.lamp = new Lamp(this.P(FIRST_GUARD.x, FIRST_GUARD.z), h.scene, h.light);
        // The marker sits on him, so he can be found in the rain (owner, iPhone: "I don't see anyone").
        this.target = g.position.clone().setY(g.position.y + 1.9);
        h.teach(this.key("takedown"));
        h.say("One of Hollowell's, under the lamp. Back to me. Let's keep this quiet.");
        break;
      }
      case 2:
        this.objective = "Tomas kept a pistol by his stall. Get it.";
        this.pickup = new Case(this.P(FIRST_CASE.x, FIRST_CASE.z), h.scene, h.light, "kestrel", Math.atan2(TAKEDOWN_POSE.x - FIRST_CASE.x, TAKEDOWN_POSE.z - FIRST_CASE.z), h.block);
        this.target = this.pickup.gunAt;
        h.teach(null);
        h.say("Tomas kept a pistol by the stall. Said it was for rats.");
        break;
      case 3: {
        this.objective = "Two Enforcers under the flyover. Deal with them.";
        this.teachFeatures("aim", "reload");
        if (!resumed) h.arm("kestrel");
        if (resumed || !h.toast) h.banner(resumed ? "Checkpoint" : "New weapon: Kestrel 9", resumed ? "Back at the flyover" : "Equipped. Checkpoint saved: dying now restarts you here");
        else h.toast("New weapon", "Kestrel 9");
        this.wave = [h.spawn("rifle", [this.P(-4, 15), this.P(1.5, 15)]), h.spawn("rifle", [this.P(5, 6), this.P(5, 18)])];
        this.target = this.P(-1, 12);
        h.teach(this.key("fire"));
        if (!resumed) h.say("The Kestrel. Quiet, and it'll do.");
        break;
      }
      case 4: {
        const cls = h.progress.character.classes[0]!;
        const w = CLASS_WEAPON[cls] ?? "kestrel";
        if (!h.progress.unlocks.weapons.includes(w)) {
          this.objective = "Your old case is up on the walkway. Take the stairs.";
          const at = (h.markers.perch?.[0] ?? this.P(-9.2, 30)).clone().add(new THREE.Vector3(0.6, 0, 3));
          // No collider on the walkway: the trestle would close it off.
          this.pickup = new Case(at, h.scene, h.light, w, Math.atan2(-1 - at.x, 20 - at.z));
          this.target = this.pickup.gunAt;
          h.teach(null);
          h.say("I left a case with Tomas, years ago. He kept it up on the walkway.");
        } else this.goto(5, resumed);
        break;
      }
      case 5: {
        this.objective = "Get to the water taxi at the south steps.";
        this.teachFeatures("focus");
        const cls = h.progress.character.classes[0]!;
        const w = CLASS_WEAPON[cls] ?? "kestrel";
        if (!resumed) h.arm(w);
        if (!resumed && h.toast) h.toast("New weapon", (SLICE_WEAPONS.find((x) => x.id === w)?.name ?? w).replace(/ \(.*\)$/, ""));
        else h.banner(resumed ? "Checkpoint" : "Checkpoint saved", resumed ? "Back on the walkway" : "Dying now restarts you here");
        const far = h.markers.perch?.[1];
        this.wave = [
          ...(far ? [h.spawn("sniper", [far.clone()])] : []),
          h.spawn("rifle", [this.P(-1, -20), this.P(-2.5, -42)]),
          h.spawn("shield", [this.P(-8, -42.5), this.P(1.5, -54)]),
        ];
        this.target = h.markers.extract?.[0]?.clone() ?? null;
        h.teach(this.key("focus"));
        if (!resumed) h.say(cls === "ghost" ? "The Widowmaker. Still zeroed." : "Still oiled. Tomas looked after it.");
        break;
      }
      case 6:
        this.done = true;
        this.objective = "Job done. Julian Crisp has a name on the seat of that taxi.";
        this.target = null;
        this.teachFeatures("swap", "skills");
        if (!h.progress.jobsDone.includes("fishMarket")) h.progress.jobsDone.push("fishMarket");
        h.progress.save();
        h.banner("Job done", "The Fish Market");
        h.teach(this.key("done"));
        h.say("A water taxi, and a name left on the seat: Julian Crisp.");
        break;
    }
  }

  update(dt: number): void {
    const h = this.h;
    const v = h.view?.();
    this.pickup?.update(dt, h.player.pos, v?.cam, v?.w, v?.h, v?.scale);
    for (const c of this.spent) c.update(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    const near = (p: THREE.Vector3 | null, r: number) => !!p && h.player.pos.distanceTo(p) < r;
    const cleared = this.wave.length > 0 && this.wave.every((e) => !e.alive);
    switch (this.stage) {
      case 0:
        if (h.player.pos.z < 47) this.goto(1);
        break;
      case 1:
        if (this.wave[0]?.alive) this.target?.copy(this.wave[0].position).setY(this.wave[0].position.y + 1.9);
        if (cleared) {
          this.lamp?.remove();
          this.lamp = null;
          this.wave = [];
          this.wait = 1.2;
          this.goto(2);
        }
        break;
      case 2:
        // Weapons need a press (S7.1): the lid snaps shut, then she has it.
        if (this.pickup?.taken) {
          this.wait = 0.22;
          this.stage = 2.5;
        }
        break;
      case 2.5:
        this.goto(3);
        break;
      case 3:
        if (cleared) {
          this.wave = [];
          this.wait = 1.5;
          this.goto(4);
        }
        break;
      case 4:
        if (this.pickup?.taken) {
          this.wait = 0.22;
          this.stage = 4.5;
        }
        break;
      case 4.5:
        this.goto(5);
        break;
      case 5:
        if (near(this.target, 3)) this.goto(6);
        break;
    }
    if (this.stage === 1 && this.wave[0] && this.wave[0].alive && this.wave[0].state === "combat")
      h.teach(this.h.touch ? "He's seen you. Tap Fire to hit him with the Pin." : "He's seen you. Left click to hit him with the Pin.");
  }
}
