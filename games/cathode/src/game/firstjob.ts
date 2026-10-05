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
  banner(title: string, sub: string): void;
  /** A pooled real light (see World.light); absent in tests. */
  /** Extra loot rolls dropped at a point (bounties); absent in tests. */
  drop?(pos: THREE.Vector3, rolls: number): void;
  light?(pos: THREE.Vector3, color: THREE.Color, intensity: number, range: number): () => void;
}

const AMBER = new THREE.Color(0xffb347).convertSRGBToLinear();
const SODIUM = new THREE.Color(0xffa860).convertSRGBToLinear();

/** A glowing case to walk into: the next thing she's handed. */
export class Case {
  readonly group = new THREE.Group();
  private t = Math.random() * 6;
  private unlight: (() => void) | null = null;
  constructor(
    readonly pos: THREE.Vector3,
    scene: THREE.Scene,
    light?: JobHost["light"],
  ) {
    const leather = new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.45, metalness: 0.1 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 1 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.14, 0.4, 2, 0.03), leather);
    const band = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.02, 0.42, 1, 0.008), glow);
    const latch = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.05, 0.03, 1, 0.01), brass);
    latch.position.set(0, 0, 0.21);
    this.group.add(box, band, latch);
    // A thin shaft of light up into the rain, so it can be found from down the street.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.25, 9, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    beam.position.y = 4.5;
    this.group.add(beam);
    this.unlight = light?.(pos.clone().add(new THREE.Vector3(0, 1.2, 0)), AMBER, 4, 6) ?? null;
    this.group.position.copy(pos);
    scene.add(this.group);
  }

  update(dt: number): void {
    this.t += dt;
    this.group.position.y = this.pos.y + 0.75 + Math.sin(this.t * 2) * 0.05;
    this.group.rotation.y += dt * 0.8;
  }

  remove(): void {
    this.group.removeFromParent();
    this.unlight?.();
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

  private goto(stage: number, resumed = false): void {
    this.stage = stage;
    this.pickup?.remove();
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
        const g = h.spawn("rifle", [this.P(-1.5, 36.5)], { yaw: Math.PI, passive: true });
        this.wave = [g];
        this.lamp = new Lamp(this.P(-1.5, 36.5), h.scene, h.light);
        // The marker sits on him, so he can be found in the rain (owner, iPhone: "I don't see anyone").
        this.target = g.position.clone().setY(g.position.y + 1.9);
        h.teach(this.key("takedown"));
        h.say("One of Hollowell's, under the lamp. Back to me. Let's keep this quiet.");
        break;
      }
      case 2:
        this.objective = "Tomas kept a pistol by his stall. Get it.";
        this.pickup = new Case(this.P(-7.6, 30.5), h.scene, h.light);
        this.target = this.pickup.pos;
        h.teach(null);
        h.say("Tomas kept a pistol by the stall. Said it was for rats.");
        break;
      case 3: {
        this.objective = "Two Enforcers under the flyover. Deal with them.";
        this.teachFeatures("aim", "reload");
        if (!resumed) h.arm("kestrel");
        h.banner(resumed ? "Checkpoint" : "Checkpoint saved", resumed ? "Back at the flyover" : "Dying now restarts you here");
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
          this.pickup = new Case(at, h.scene, h.light);
          this.target = this.pickup.pos;
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
        h.banner(resumed ? "Checkpoint" : "Checkpoint saved", resumed ? "Back on the walkway" : "Dying now restarts you here");
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
    this.pickup?.update(dt);
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
        if (near(this.pickup?.pos ?? null, 1.4)) this.goto(3);
        break;
      case 3:
        if (cleared) {
          this.wave = [];
          this.wait = 1.5;
          this.goto(4);
        }
        break;
      case 4:
        if (near(this.pickup?.pos ?? null, 1.4)) this.goto(5);
        break;
      case 5:
        if (near(this.target, 3)) this.goto(6);
        break;
    }
    if (this.stage === 1 && this.wave[0] && this.wave[0].alive && this.wave[0].state === "combat")
      h.teach(this.h.touch ? "He's seen you. Tap Fire to hit him with the Pin." : "He's seen you. Left click to hit him with the Pin.");
  }
}
