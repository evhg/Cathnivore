// The Fish Market, the first job, teaches one thing at a time (owner's playtest, 2026-10-04: "start very
// simple, and introduce game concepts and items one by one"). Cath walks in with only the Pin.
//   1. Move and look.            2. A guard with his back turned: crouch, takedown.
//   3. Tomas's pistol: aim, fire, reload, and two Enforcers under the flyover.
//   4. Her old case on the walkway: the class weapon and Focus; a sniper and a patrol between her and the
//      water taxi.                5. The water taxi: job done.
// Each stage spawns its own enemies, so nothing shoots at her before she has been shown how to answer.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Enemy } from "./enemy";
import type { Player } from "./player";
import type { Progress, Feature } from "./progress";
import { CLASS_WEAPON } from "./progress";
import { Beacon } from "./beacon";
import { buildGunDisplay } from "./viewmodel";
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

const AMBER = new THREE.Color(0xffb347).convertSRGBToLinear();
const SODIUM = new THREE.Color(0xffa860).convertSRGBToLinear();

/**
 * The next weapon she's handed, on show (S7.1): an open case on a market-stall trestle, the gun lying in a cut-foam
 * insert, lit from inside the lid, with the beacon over it. She takes it with a press, and the lid snaps shut.
 */
export class Case {
  readonly group = new THREE.Group();
  /** Where the gun lies (world space): the prompt, the arrow and the sightline aim here. */
  readonly gunAt: THREE.Vector3;
  readonly beacon: Beacon;
  private lid: THREE.Group;
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
    const leather = new THREE.MeshStandardMaterial({ color: 0x1e1410, roughness: 0.42, metalness: 0.08 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 1 });
    // Crimson velvet: a black gun reads against it from down the street.
    const foam = new THREE.MeshStandardMaterial({ color: 0x5a0f1c, roughness: 0.92, emissive: 0x1a0306 });
    const lining = new THREE.MeshStandardMaterial({ color: 0x2a0d12, roughness: 0.8, emissive: 0x3a1a08, emissiveIntensity: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.75 });
    const tarp = new THREE.MeshStandardMaterial({ color: 0x3f5a57, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb347).multiplyScalar(2.2) });
    // The gun, laid on its side along the stall, and the case sized to it.
    if (def) {
      this.gun = buildGunDisplay(def.model);
      this.gun.rotation.set(0, Math.PI / 2, Math.PI / 2);
    } else {
      // A ledger: oxblood boards, cream page edges, a brass clasp.
      const book = new THREE.Group();
      const boards = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.05, 0.22, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x4a1218, roughness: 0.55 }));
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.038, 0.205), new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9 }));
      pages.position.x = 0.006;
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.054, 0.04), brass);
      clasp.position.x = 0.15;
      book.add(boards, pages, clasp);
      this.gun = book;
    }
    this.gun.updateMatrixWorld(true);
    const gb = new THREE.Box3().setFromObject(this.gun);
    const gs = gb.getSize(new THREE.Vector3());
    const W = Math.max(0.5, gs.x + 0.14);
    const D = Math.max(0.3, gs.z + 0.14);
    const top = 0.92;
    // The stall: a trestle under a wet tarp, crates beneath.
    const stall = new THREE.Group();
    const board = new THREE.Mesh(new RoundedBoxGeometry(W + 0.5, 0.05, D + 0.36, 2, 0.01), wood);
    board.position.y = top - 0.025;
    const cloth = new THREE.Mesh(new RoundedBoxGeometry(W + 0.54, 0.012, D + 0.4, 1, 0.004), tarp);
    cloth.position.y = top + 0.006;
    stall.add(board, cloth);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - 0.05, 0.05), wood);
        leg.position.set(sx * (W / 2 + 0.17), (top - 0.05) / 2, sz * (D / 2 + 0.12));
        leg.rotation.z = sx * 0.06;
        stall.add(leg);
      }
    // A wet tarp hangs off the front edge, and a work lamp on a pole leans over the case.
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.54, 0.16), tarp);
    drape.position.set(0, top - 0.08, D / 2 + 0.2);
    stall.add(drape);
    const metal = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.8 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 8), metal);
    pole.position.set(-(W / 2 + 0.17), 0.95, -(D / 2 + 0.12));
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, W / 2 + 0.2, 8), metal);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-(W / 4 + 0.07), 1.88, -(D / 2 + 0.12));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 16, 1, true), metal);
    shade.position.set(0.02, 1.83, -(D / 2 + 0.12));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.4, 1.4) }));
    bulb.position.set(0.02, 1.79, -(D / 2 + 0.12));
    stall.add(pole, arm, shade, bulb);
    const crate = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.38, 0.4, 2, 0.02), wood);
    crate.position.set(-W / 4, 0.19, 0);
    crate.rotation.y = 0.2;
    stall.add(crate);
    this.group.add(stall);
    // The case: a leather shell with brass corners, foam inside, the lid open past upright (100 degrees).
    const caseG = new THREE.Group();
    caseG.position.y = top + 0.012;
    const H = 0.09;
    const shell = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 2, 0.015), leather);
    shell.position.y = H / 2;
    const insert = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.012, D - 0.04), foam);
    insert.position.y = H + 0.001;
    caseG.add(shell, insert);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const c = new THREE.Mesh(new RoundedBoxGeometry(0.04, H + 0.01, 0.04, 1, 0.008), brass);
        c.position.set(sx * (W / 2 - 0.015), H / 2, sz * (D / 2 - 0.015));
        caseG.add(c);
      }
    for (const sx of [-1, 1]) {
      const latch = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.035, 0.015, 1, 0.005), brass);
      latch.position.set(sx * W * 0.28, H * 0.7, D / 2 + 0.006);
      caseG.add(latch);
    }
    // The gun sits in the foam, a little proud of it, centred.
    const gc = gb.getCenter(new THREE.Vector3());
    this.gun.position.set(-gc.x, H + 0.012 - gb.min.y, -gc.z);
    caseG.add(this.gun);
    // The lid hinges on the back edge; its lining glows warm, a lamp strip along the top lights the gun.
    this.lid = new THREE.Group();
    this.lid.position.set(0, H, -D / 2);
    const lidShell = new THREE.Mesh(new RoundedBoxGeometry(W, 0.04, D, 2, 0.012), leather);
    lidShell.position.set(0, 0.02, D / 2);
    const lidLining = new THREE.Mesh(new THREE.BoxGeometry(W - 0.05, 0.004, D - 0.05), lining);
    lidLining.position.set(0, -0.002, D / 2);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.006, 0.012), glow);
    strip.position.set(0, -0.004, D - 0.03);
    this.lid.add(lidShell, lidLining, strip);
    this.lid.rotation.x = -THREE.MathUtils.degToRad(100);
    caseG.add(this.lid);
    this.group.add(caseG);
    this.beacon = new Beacon({ beam: 3.5, glint: true, gun: this.gun, floorY: 0, glintAt: new THREE.Vector3(0, top + H + 0.05, 0) });
    // The shaft rises from just behind the gun, in front of the open lid, so the gun itself stays clear.
    this.beacon.beam.position.set(0, top + H, -D / 2 + 0.05);
    this.group.add(this.beacon.group);
    this.group.rotation.y = face;
    this.group.position.copy(pos);
    scene.add(this.group);
    this.group.updateMatrixWorld(true);
    this.gunAt = new THREE.Vector3(0, top + H + 0.04, 0).applyMatrix4(this.group.matrixWorld);
    // The trestle is solid (she walks round it, rounds stop in it); only up to its top, so the gun stays in sight.
    const table = new THREE.Box3(new THREE.Vector3(-(W / 2 + 0.27), 0, -(D / 2 + 0.2)), new THREE.Vector3(W / 2 + 0.27, top, D / 2 + 0.2)).applyMatrix4(this.group.matrixWorld);
    this.unblock = block?.(table) ?? null;
    // The work lamp's light, over the case.
    this.unlight = light?.(new THREE.Vector3(0.02, 1.7, -(D / 2 + 0.05)).applyMatrix4(this.group.matrixWorld), AMBER, 7, 5) ?? null;
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
      if (k >= 1) this.gun.visible = false;
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
