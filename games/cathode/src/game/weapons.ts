// The weapons Cath carries in the slice and their state machines: raise, fire, reload, the pump and the
// bolt, aiming down the sights, and the Pin's swing. Firing produces Shot requests that combat.ts resolves.
// Base numbers here are the slice's; sim/weapons.ts owns the full tables and the build scaling (ROADMAP 64).

import * as THREE from "three";
import type { WeaponClass } from "../sim/types";
import { buildGun, SwingTrail, ViewAnim, type GunModel, type GunRig } from "./viewmodel";
import { Arms, POSES, SHOULDER_L, SHOULDER_L_ADS, SHOULDER_R, SHOULDER_R_ADS, lerpPose, type HandPose } from "./hands";
import { eventsBetween, sampleClip, type Clip, type Sample } from "./feel/clip";
import { Spring1, Spring3 } from "./feel/spring";
import { tuning } from "./feel/tuning";
import { CamRecoil, DRAW, EMPTY as EMPTY_CLIP, TAC as TAC_CLIP, FIRE, HERO, Heat, PRESS_CHECK, ReloadMachine, channel, impulseForPeak, pullTrigger, startReload, stepReload, track } from "./feel/pistol";
import { GunSmoke } from "./gunsmoke";
import { ARSENAL, ClassReload, chan, isHero, recoilPattern, type ClassFeel, type HeroModel } from "./feel/arsenal";

const KF = tuning.kestrel;
const DEG = Math.PI / 180;

/**
 * The inspect (S2.2 layer 3): she turns the gun to read its left flank, tips it to look down the dot, and
 * brings it back. Offsets on the rig root, in its own space (m, rad).
 */
export const INSPECT: Clip = {
  dur: 2600,
  tracks: {
    root: [
      [0, [0, 0, 0], [0, 0, 0]],
      [420, [-0.036, 0.05, -0.06], [0.12, 0.74, 0.36], "inOut"],
      [1350, [-0.032, 0.054, -0.06], [0.17, 0.8, 0.33]],
      [1800, [-0.03, 0.03, 0.01], [-0.32, 0.25, -0.15], "inOut"],
      [2150, [-0.03, 0.03, 0.01], [-0.3, 0.22, -0.12]],
      [2600, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
  },
  events: [[80, "cloth"], [1750, "cloth"], [2550, "settle"]],
};

/** Inspecting, the shoulders the arms reach from (camera space): out and down, so the forearms fall away. */
const SHOULDER_R_INSPECT = new THREE.Vector3(0.06, -0.66, 0.12);
const SHOULDER_L_INSPECT = new THREE.Vector3(-0.12, -0.55, 0.2);
/** C5: reloading, the firing shoulder low and out to the right (camera space). */
// Low, out and level with the eye, so the forearm runs steeply down and out of the frame (C5 review).
const SHOULDER_R_RELOAD = new THREE.Vector3(0.5, -1.0, 0);
/** C5: on a locked slide the firing shoulder drops part-way (clear of the weapon HUD at bottom right). */
const SHOULDER_R_LOCK = new THREE.Vector3(0.46, -0.84, -0.02);
/** C5: racking the slide, the support shoulder low and out to the left. */
const SHOULDER_L_RACK = new THREE.Vector3(-0.42, -0.78, -0.12);

/** How far from the gun's origin toward the firing wrist the inspect turns about (0 the origin, 1 the wrist). */
export const INSPECT_PIVOT = 0.6;

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
  { id: "bargainBin", name: "Bargain Bin", model: "launcher", weaponClass: "launcher", kind: "hitscan", damage: 190, pellets: 1, cycle: 0.9, mag: 1, reserve: 12, reload: 2.6, spread: [0.02, 0.004], noise: 90, kick: 2.6, range: 140, blast: 5, brutal: 1 },
  { id: "nightShift", name: "Night Shift", model: "blade", weaponClass: "melee", kind: "melee", damage: 75, pellets: 1, cycle: 0.4, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 2, kick: 0, range: 2.0, brutal: 0.8 },
  { id: "repossessor", name: "Repossessor", model: "sledge", weaponClass: "melee", kind: "melee", damage: 150, pellets: 1, cycle: 1.0, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 10, kick: 0, range: 2.4, brutal: 1 },
  { id: "candorSeeker", name: "Candor Seeker", model: "smg", weaponClass: "smart", kind: "hitscan", damage: 17, pellets: 1, cycle: 0.14, mag: 24, reserve: 120, reload: 2.0, spread: [0.05, 0.02], noise: 45, kick: 0.5, range: 120 },
  { id: "catsCradle", name: "Cat's Cradle", model: "wire", weaponClass: "melee", kind: "melee", damage: 62, pellets: 1, cycle: 0.5, mag: 0, reserve: 0, reload: 0, spread: [0, 0], noise: 1, kick: 0, range: 4.5, brutal: 1 },
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
  /** Capacity (the pistol rules read it). */
  mag: number;
  /** The slide is locked back on an empty magazine (pistols). */
  locked: boolean;
}

/**
 * Where the support hand goes to clutch the wound (view space), and how it turns there (C6). Her sternum is
 * below the frame: the hand drops off the gun and out of view (C7 review: held in frame, a fist seen from
 * behind read as a grey ball), so the clutch reads as the gun going one-handed, sagging and rolling away.
 */
const CLUTCH_AT = new THREE.Vector3(-0.05, -0.21, -0.15);
const CLUTCH_TURN = new THREE.Euler(0.5, 0.6, 0.9);

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
  /** A running estimate of the frame time (s), for S2.3's flash frame count. */
  private frameDt = 1 / 60;
  /** Alt-fire in progress: shots still queued, the cycle they fire at, how wide, how many barrels. */
  private altQueue = 0;
  private altCycle = 0;
  private altSpread = 1;
  private altBarrels = 1;
  private altDmg = 1;
  aiming = false;
  /** Set when a melee swing lands its hit frame. */
  meleeNow = false;

  /** A soft key and a cool rim so the gun reads against the dark street; the muzzle light flashes on fire. */
  readonly flash = new THREE.PointLight(0xffc477, 0, 1.2, 2);

  private readonly trail: SwingTrail;
  private readonly tipV = new THREE.Vector3();
  private readonly midV = new THREE.Vector3();

  /** Cath's arms (hands.ts): one skinned mesh each, riding the gun in hand. */
  readonly arms: Arms;
  private readonly scene: THREE.Scene;

  /** The phone profile (the suppressed shot holds an extra frame there, S2.3). */
  private readonly phone: boolean;

  constructor(scene: THREE.Scene, phone = false) {
    this.scene = scene;
    this.phone = phone;
    this.trail = new SwingTrail(scene);
    this.arms = new Arms(phone);
    // S2.1 viewmodel lighting: a warm key from the upper left, a cyan rim from behind right, and a faint magenta
    // fill from below so the underside of the gun never goes black. The environment (lightRoom) adds the strips.
    // On a phone the gun is small and the street behind it bright and busy: a stronger key and rim, and a second,
    // cooler rim from the left, so the silhouette separates (C4 review: "a dark smear" at 844x390).
    const key = new THREE.DirectionalLight(0xf4f1ee, phone ? 1.5 : 1.2);
    this.key = key;
    this.keyBase = { color: key.color.clone(), intensity: key.intensity };
    key.position.set(-0.6, 1, 0.45);
    const rim = new THREE.DirectionalLight(0x5fd8ff, phone ? 1.5 : 0.8);
    rim.position.set(1, 0.35, -1);
    const fill = new THREE.DirectionalLight(0xff3f8f, 0.35);
    this.fill = fill;
    this.fillBase = fill.color.clone();
    fill.position.set(-0.4, -0.6, -0.4);
    scene.add(key, rim, fill, this.flash);
    if (phone) {
      const rimL = new THREE.DirectionalLight(0xb8d8ff, 0.9);
      rimL.position.set(-1, 0.6, -0.8);
      scene.add(rimL);
    }
    this.held = SLICE_WEAPONS.map((def) => {
      const rig = buildGun(def.model, phone);
      rig.root.visible = false;
      scene.add(rig.root);
      return { def, rig, ammo: def.mag, reserve: def.reserve, mag: def.mag, locked: false };
    });
    this.smoke = new GunSmoke(scene, phone);
    this.gripLDyn.name = "gripL:dyn";
    this.equip(1);
  }

  // ---- C5 "Kestrel 9 in motion" ----
  /** The pistol's reload rules and clip (S2.4). */
  readonly rm = new ReloadMachine();
  /** Ms since the pistol's last shot (the FIRE clip), -1 when it has played out. */
  private fireMs = -1;
  /** The draw (or the hero draw) playing, ms in; -1 when none. */
  private drawMs = -1;
  private drawClip: Clip = DRAW;
  /** The idle press-check, ms in; -1 when none. */
  private pressMs = -1;
  private idleS = 0;
  private pressedThisIdle = false;
  /** Viewmodel recoil springs (S2.3): rotation (pitch, yaw, roll) and position. */
  private readonly recRot = new Spring3(KF.recoil.rot);
  private readonly recPos = new Spring3(KF.recoil.pos);
  /** The camera's share of recoil (S2.3 `recoilAt`): the session adds its offset to the view. */
  readonly camRecoil = new CamRecoil();
  readonly heat = new Heat();
  readonly smoke: GunSmoke;
  /** Clip cues since the session last drained them (sound, the shell, the dropped mag, trauma). */
  readonly cues: string[] = [];
  /** The fire button is down (the trigger preloads 3 mm). */
  triggerHeld = false;
  /** She's sprinting (cancels a reload that hasn't committed). */
  sprinting = false;
  /** The next equip of the pistol plays the 900 ms hero draw (the first pickup). */
  heroNext = false;
  /** A swap asked for after the reload committed: it happens when the reload ends. */
  private pendingEquip = -1;
  /** C6 (S6.2): the gun dips and rolls away from a hit on Cath, on two springs. */
  private readonly hurtDip = new Spring1({ freqHz: 7, zeta: 0.5 });
  private readonly hurtRoll = new Spring1({ freqHz: 7, zeta: 0.5 });
  /** C6: ms into "clutching the wound" (the support hand off the gun to the sternum); -1 when not. */
  private clutchMs = -1;
  /** The clutch's weight this frame (0..1; tests and screenshots read it). */
  clutchW = 0;
  /**
   * Cath is hit (S6.2): the gun dips 2.5 cm and rolls 4 degrees away from `side` (-1 left .. 1 right), scaled by
   * `k`. `clutch` pulls the support hand to her sternum for 350 ms, then back over 250 ms.
   */
  hurtJolt(side: number, k: number, clutch: boolean): void {
    const m = this.reducedMotion ? 0.5 : 1;
    this.hurtDip.v += impulseForPeak({ freqHz: 7, zeta: 0.5 }, 0.025 * k * m);
    this.hurtRoll.v += impulseForPeak({ freqHz: 7, zeta: 0.5 }, ((4 * Math.PI) / 180) * k * m * (side >= 0 ? 1 : -1));
    if (clutch && this.kestrel) this.clutchMs = 0;
  }
  /** Screenshot stages: the jolt and the clutch `sec` seconds on (the frame itself may run at dt 0). */
  stepHurt(sec: number): void {
    const n = Math.max(1, Math.ceil(sec * 240));
    for (let i = 0; i < n && sec > 0; i++) {
      this.hurtDip.update(sec / n);
      this.hurtRoll.update(sec / n);
    }
    if (this.clutchMs >= 0) this.clutchMs += sec * 1000;
  }
  /** The support hand's frame while a clip moves it off the grip (to the mag, or over the slide). */
  private readonly gripLDyn = new THREE.Object3D();
  private readonly poseLDyn: HandPose = { curl: [0, 0, 0, 0], wrap: 0, thumb: [0, 0, 0], thumbCurl: [0, 0], indexLift: 0 };
  private readonly mA = new THREE.Matrix4();
  private readonly mB = new THREE.Matrix4();
  private readonly pA = new THREE.Vector3();
  private readonly pB = new THREE.Vector3();
  private readonly qA = new THREE.Quaternion();
  private readonly qB = new THREE.Quaternion();
  private readonly sV = new THREE.Vector3();
  private readonly smp: Sample = { pos: [0, 0, 0], rot: [0, 0, 0] };
  private readonly smp2: Sample = { pos: [0, 0, 0], rot: [0, 0, 0] };

  // ---- C18 "Every gun is a hero" ----
  /** The class's reload (null on the pistol and melee weapons). */
  cr: ClassReload | null = null;
  /** Ms since a hero gun's last shot (its fire clip), -1 when it has played out. */
  heroFireMs = -1;
  /** Shots in the current burst (the SMG and rifle's recoil pattern), and the time since the last. */
  private burstN = 0;
  private sinceShot = 9;
  /** This shot's camera kick (degrees, [pitch, yaw]): the session applies it. */
  readonly heroKick: [number, number] = [0, 0];
  /** Rounds fired by the current gun (the tracer every third). */
  roundsFired = 0;
  /** The firing hand's frame while the sniper works the bolt. */
  private readonly gripRDyn = new THREE.Object3D();
  private readonly poseRDyn: HandPose = { curl: [0, 0, 0, 0], wrap: 0, thumb: [0, 0, 0], thumbCurl: [0, 0], indexLift: 0 };
  private heroLast: { clip: Clip; t: number } | null = null;
  private heroGhost: { clip: Clip; t: number; ms: number } | null = null;
  private heroTrig = 0;
  private heroHandR = 0;
  /** The hero gun in hand, if it is one. */
  get hero(): ClassFeel | null {
    const m = this.weapon.model;
    return isHero(m) && this.rig.parts.hero ? ARSENAL[m as HeroModel] : null;
  }
  /** Reduced motion: the clips turn the gun half as far (S2.4). */
  reducedMotion = false;
  /** C7 (S6.1): critical or worse, aiming down the sights takes 20% longer (1.2). */
  adsSlow = 1;
  /** Screenshot stages hold the pistol's clips and springs where they were left (time frozen). */
  freeze = false;
  /** C18 stages: the gun in hand is put away (the arsenal lineup). */
  hideGun = false;

  /** The Kestrel (the only gun with the full C5 part list); other pistols keep the older motion. */
  get kestrel(): boolean {
    return this.weapon.weaponClass === "pistol" && !!this.rig.parts.magRound;
  }

  /** Where the pistol is (for the stages and tests). */
  /**
   * How far into a reload's turn the gun is (0..1): the HUD fades the crosshair with it, as AAA shooters do, so
   * the turned gun and the can never sit on a live reticle (C5 review).
   */
  get reloadW(): number {
    // The draw and the hero draw too (C5 review: mid-rack the slide crossed the centre under a live crosshair):
    // the reticle is away through the clip and back over its last 120 ms.
    let draw = 0;
    if (this.drawMs >= 0) draw = THREE.MathUtils.clamp((this.drawClip.dur - this.drawMs) / 120, 0, 1);
    return Math.max(THREE.MathUtils.clamp(this.armW, 0, 1), draw);
  }

  get pistolState(): { fireMs: number; drawMs: number; pressMs: number; reload: string | null; reloadMs: number; committed: boolean; locked: boolean; heat: number } {
    const h = this.held[this.current]!;
    return { fireMs: this.fireMs, drawMs: this.drawMs, pressMs: this.pressMs, reload: this.rm.kind, reloadMs: this.rm.t, committed: this.rm.committed, locked: h.locked, heat: this.heat.v };
  }

  /** Any input this frame cancels the press-check and restarts the idle clock (S2.4 inspect). */
  noteInput(any: boolean, dt: number): void {
    if (any) {
      this.idleS = 0;
      this.pressedThisIdle = false;
      if (this.pressMs >= 0) this.pressMs = -1;
      return;
    }
    this.idleS += dt;
    if (this.idleS >= KF.inspect.idleS && !this.pressedThisIdle && this.kestrel && !this.busy && this.inspectT < 0 && this.fireMs < 0) {
      this.pressedThisIdle = true;
      this.pressMs = 0;
    }
  }

  /** The camera's view this frame (smoke stays in the world). */
  setView(eye: THREE.Vector3, q: THREE.Quaternion): void {
    this.smoke.setView(eye, q);
  }

  /** The dry fire on an empty pistol: two clicks, no flash, no recoil; then the empty reload plays. */
  private dryFire(): void {
    const h = this.held[this.current]!;
    this.cues.push("dry");
    this.cd = 0.22;
    startReload(h, this.rm);
  }

  /** Screenshot stages: the pistol fires now (the clip, the springs, the puff), wherever its rounds are. */
  stageFire(): void {
    const h = this.held[this.current]!;
    if (h.ammo <= 0) h.ammo = 1;
    this.cd = 0;
    this.lastClip = this.ghost = null;
    this.rm.cancel();
    this.firePistolFx();
    // The shot spends its round, so the HUD and the gun agree in the held frame (12/60 becomes 11/60).
    h.ammo -= 1;
  }

  /** C18 stages: a hero gun fires now (its clip, springs, flash), the round spent. */
  stageHeroFire(): void {
    const f = this.hero;
    if (!f) return;
    const h = this.held[this.current]!;
    if (h.ammo <= 1) h.ammo = 2;
    this.cd = 0;
    this.heroLast = this.heroGhost = null;
    this.cr?.cancel();
    this.fireHeroFx(f);
    h.ammo -= 1;
  }

  /** C18 stages: a hero gun's reload (tac or empty; the shotgun's shells) held at `ms`. */
  stageHeroReload(kind: "tac" | "empty", ms: number): void {
    const h = this.held[this.current]!;
    if (!this.cr) return;
    this.heroLast = this.heroGhost = null;
    this.cr.kind = null;
    this.heroFireMs = -1;
    h.ammo = kind === "empty" ? 0 : Math.max(1, Math.floor(h.mag / 3));
    this.cr.start(h);
    this.cr.step(h, ms);
    this.cues.length = 0;
  }

  /** C18 stages and tests: the hero gun's state. */
  get heroState(): { fireMs: number; reload: string | null; phase: string | null; reloadMs: number; committed: boolean; flashOn: boolean; handW: number; handR: number; burst: number } {
    const c = this.cr;
    return { fireMs: this.heroFireMs, reload: c?.kind ?? null, phase: c?.phase ?? null, reloadMs: c?.t ?? 0, committed: !!c?.committed, flashOn: !!this.rig.flashMesh?.visible, handW: this.handW, handR: this.heroHandR, burst: this.burstN };
  }

  /** Screenshot stages: a reload (tac or empty) held at `ms`. */
  stageReload(kind: "tac" | "empty", ms: number): void {
    const h = this.held[this.current]!;
    this.lastClip = this.ghost = null;
    this.rm.kind = null;
    h.ammo = kind === "empty" ? 0 : 5;
    h.locked = kind === "empty";
    startReload(h, this.rm);
    stepReload(h, this.rm, ms);
    this.cues.length = 0;
  }

  /** Screenshot stages: the last round gone, the slide locked. */
  stageLock(): void {
    const h = this.held[this.current]!;
    this.lastClip = this.ghost = null;
    this.rm.kind = null;
    h.ammo = 0;
    h.locked = true;
    this.lockW = 1;
  }

  /** Screenshot stages: the stage's milliseconds have passed for the flash too (the puff shows one frame). */
  stageTime(ms: number): void {
    this.flashT = Math.max(0, this.flashT - ms / 1000);
  }

  /** Screenshot stages: a fire-to-cancel of the reload (or any input ending the press-check) right now. */
  stageCancel(): void {
    if (!this.rm.cancel()) this.pressMs = -1;
  }

  /** Screenshot stages: the idle press-check held at `ms`. */
  stagePress(ms: number): void {
    this.pressMs = ms;
  }

  /** Screenshot stages: the draw (or the hero draw) held at `ms`. */
  stageDraw(ms: number, hero = false): void {
    this.drawClip = hero ? HERO : DRAW;
    this.drawMs = ms;
    this.raising = Math.max(0.001, (this.drawClip.dur - ms) / 1000);
  }

  /** The pistol's shot choreography: the clip, the recoil springs, heat, smoke, the camera kick. */
  private firePistolFx(): void {
    this.fireMs = 0;
    const R = KF.recoil;
    const m = this.aiming ? R.adsMul : 1;
    const side = Math.random() < 0.5 ? -1 : 1;
    // Position: back 3 cm and up 0.5 cm; rotation: muzzle up 6°, a ±2° roll (S2.3).
    this.recPos.shove(0, impulseForPeak(R.pos, R.shoveY * m), impulseForPeak(R.pos, R.shoveZ * m));
    this.recRot.shove(impulseForPeak(R.rot, R.pitchDeg * DEG * m), impulseForPeak(R.rot, 0.6 * DEG * side * m), impulseForPeak(R.rot, R.rollDeg * DEG * side * m));
    this.heat.shot();
    // S2.3 allows the crown light and puff to hold a second frame below 50 fps: on a phone a one-frame puff at
    // 30 fps barely lifted the muzzle (C5 review 2: luminance 43 to 50), so it holds two there.
    this.flashT = (KF.puff.lightMs + (this.phone ? KF.puff.phoneHoldMs : 0)) / 1000;
    const r = this.rig;
    r.root.updateMatrixWorld(true);
    const mz = r.muzzle.getWorldPosition(new THREE.Vector3());
    const pt = r.port.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(r.root.matrixWorld);
    this.smoke.puff(mz, pt, fwd, this.heat.smokeMul);
    // The puff's warm light sits off the crown on her side of the can (the view camera is at the origin), so the
    // front of the can and the crown's rim catch it and her gloves, a hand's length back, don't.
    this.flash.position.copy(mz).addScaledVector(mz.clone().normalize(), -KF.puff.vmEyeM);
    this.flash.position.y += KF.puff.vmUpM;
  }

  /**
   * C18: a hero gun's shot (S2.3 per class, S2.6): its fire clip from 0 ms, the recoil springs shoved by the
   * class (heavier guns kick harder and the spring's peak is reached through the same S2.3 springs), the
   * patterned camera kick for the SMG and rifle, the flash for one frame (two below 50 fps and for the shotgun
   * and launcher), the smoke and the barrel's heat.
   */
  private fireHeroFx(f: ClassFeel): void {
    this.heroFireMs = 0;
    this.roundsFired++;
    if (this.sinceShot > 0.28) this.burstN = 0;
    this.sinceShot = 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    const [kp, ky] = recoilPattern(f.model, this.burstN, side);
    this.burstN++;
    this.heroKick[0] = kp;
    this.heroKick[1] = ky;
    const R = KF.recoil;
    const m = (this.aiming ? R.adsMul : 1) * (this.reducedMotion ? 0.6 : 1);
    const sh = f.shove;
    this.recPos.shove(0, impulseForPeak(R.pos, sh.y * m), impulseForPeak(R.pos, sh.z * m));
    this.recRot.shove(impulseForPeak(R.rot, sh.pitchDeg * DEG * m), impulseForPeak(R.rot, 0.5 * DEG * side * m), impulseForPeak(R.rot, sh.rollDeg * DEG * side * m));
    this.heat.shot();
    // S2.3 counts rendered frames: one at 50 fps or above (two below), whatever the device; the shotgun's and the
    // launcher's own two. Half a frame short, so the timer runs out on the frame after the last one.
    const frames = f.flash.frames + (this.frameDt > 1 / 50 ? 1 : 0);
    this.flashT = (frames - 0.5) * this.frameDt;
    const r = this.rig;
    r.root.updateMatrixWorld(true);
    const mz = r.muzzle.getWorldPosition(this.pA);
    const pt = r.port.getWorldPosition(this.pB);
    const fwd = this.sV.set(0, 0, -1).transformDirection(r.root.matrixWorld);
    this.smoke.puff(mz, pt, fwd, this.heat.smokeMul * (f.model === "shotgun" || f.model === "launcher" ? 2 : 1));
    // Phone: 3 cm out, the inverse-square light burned the barrel's own faces white and the phone's blur spread
    // them into a glowing square over the street (C18 review). Out 12 cm it lights the gun and gloves evenly.
    this.flash.position.copy(mz).addScaledVector(fwd, this.phone ? 0.12 : 0.03);
  }

  /** The hero clip posing the gun this frame (reload or draw) with its weight; a cut clip eases out. */
  private heroClip(ms: number): { clip: Clip; t: number; w: number } | null {
    const live = this.cr?.active ? { clip: this.cr.clip, t: this.cr.t } : this.drawMs >= 0 ? { clip: this.drawClip, t: this.drawMs } : null;
    const last = this.heroLast;
    this.heroLast = live;
    if (live) {
      this.heroGhost = null;
      return { ...live, w: 1 };
    }
    if (last && last.t + ms < last.clip.dur - 1) this.heroGhost = { clip: last.clip, t: last.t, ms: 0 };
    const g = this.heroGhost;
    if (!g) return null;
    g.ms += ms;
    const p = g.ms / KF.cancelBlendMs;
    if (p >= 1) {
      this.heroGhost = null;
      return null;
    }
    return { clip: g.clip, t: g.t, w: (1 - p) * (1 - p) * (1 - p) };
  }

  /** Moves a hand's dynamic frame from its grip toward `target` (an empty on the gun) by `w`, posing it between. */
  private blendHand(r: GunRig, dyn: THREE.Object3D, from: THREE.Object3D, target: THREE.Object3D, w: number, poseFrom: HandPose, poseTo: HandPose, poseOut: HandPose): void {
    if (dyn.parent !== r.root) r.root.add(dyn);
    r.root.updateMatrixWorld(true);
    const inv = this.mA.copy(r.root.matrixWorld).invert();
    this.mB.multiplyMatrices(inv, target.matrixWorld).decompose(this.pB, this.qB, this.sV);
    const k = w * w * (3 - 2 * w);
    dyn.position.lerpVectors(from.position, this.pB, k);
    dyn.quaternion.slerpQuaternions(from.quaternion, this.qB, k);
    dyn.userData.thumb = k < 0.4 ? from.userData.thumb : undefined;
    lerpPose(poseFrom, poseTo, k, poseOut);
  }

  /** The parts a class's clips move (its fire, reloads and the shotgun's shell clips), cached per class. */
  private static readonly heroParts = new Map<string, string[]>();
  private static partsOf(f: ClassFeel): string[] {
    let list = Arsenal.heroParts.get(f.model);
    if (!list) {
      const skip = new Set(["gun", "hand", "hand2", "handR", "arm", "magVis", "rounds", "caseVis", "trigger"]);
      const names = new Set<string>();
      for (const c of [f.fire, f.tac, f.empty]) for (const k of Object.keys(c.tracks)) if (!skip.has(k)) names.add(k);
      if (f.model === "shotgun") names.add("pump");
      list = [...names];
      Arsenal.heroParts.set(f.model, list);
    }
    return list;
  }

  /**
   * C18: a hero gun in motion (S2.2 layers 3 and 4, S2.3 and S2.4 per class): the reload or draw clip on the gun
   * root (turned about a point toward the firing wrist), the fire clip's own turn (the pump, the bolt), the recoil
   * springs, every moving part from the fire and reload clips on its rest pose, the magazine (or loader, shell,
   * round) shown and hidden, the bolt held open on an empty mag, both hands off to what the clips reach for, the
   * smoke and the heat.
   */
  private poseHero(dt: number, r: GunRig, f: ClassFeel): void {
    const ms = dt * 1000;
    const h = this.held[this.current]!;
    const P = r.parts;
    if (this.heroFireMs >= 0) {
      const t0 = this.heroFireMs;
      this.heroFireMs += ms;
      for (const e of eventsBetween(f.fire, t0 === 0 ? -1 : t0, this.heroFireMs)) if (e !== "fire") this.cues.push(e);
      if (this.heroFireMs > f.fire.dur) {
        this.heroFireMs = -1;
        // An empty gun reloads once its pump or bolt has played out.
        if (h.ammo <= 0 && h.reserve > 0) this.reload();
      }
    }
    if (this.drawMs >= 0) {
      const nt = this.drawMs + ms;
      for (const e of eventsBetween(this.drawClip, this.drawMs, nt)) this.cues.push(e);
      this.drawMs = nt >= this.drawClip.dur ? -1 : nt;
    }
    const cl = this.heroClip(ms);
    const cw = cl ? cl.w : 0;
    const reloading = !!cl && cl.clip !== this.drawClip;
    const k = cl ? track(cl.clip, "gun", cl.t, this.smp) : null;
    if (k) {
      const sc = (this.cr?.active && this.aiming ? 0.5 : 1) * (this.reducedMotion ? 0.5 : 1) * cw;
      this.turnGun(r, k.rot[0] * sc, k.rot[1] * sc, k.rot[2] * sc, [k.pos[0] * cw, k.pos[1] * cw, k.pos[2] * cw]);
    }
    const ft = this.heroFireMs;
    const fk = ft >= 0 ? track(f.fire, "gun", ft, this.smp2) : null;
    if (fk) {
      const sc = (this.aiming ? 0.4 : 1) * (this.reducedMotion ? 0.5 : 1);
      this.turnGun(r, fk.rot[0] * sc, fk.rot[1] * sc, fk.rot[2] * sc, [fk.pos[0] * sc, fk.pos[1] * sc, fk.pos[2] * sc]);
    }
    this.armW = reloading ? chan(cl!.clip, "arm", cl!.t, 0) * cw : 0;
    const [rp, ry, rr] = this.recRot.update(dt);
    const [px, py, pz] = this.recPos.update(dt);
    // S2.2 layer 5: heavier guns ride the same springs with less travel (the spring sees the class's mass).
    const wm = 1 / Math.sqrt(f.mass);
    r.root.rotation.x += rp * (0.5 + 0.5 * wm);
    r.root.rotation.y += ry;
    r.root.rotation.z += rr;
    r.root.position.x += px;
    r.root.position.y += py;
    r.root.position.z += pz;

    // Every moving part: its rest pose plus the fire clip's and the reload clip's offsets.
    for (const name of Arsenal.partsOf(f)) {
      const part = P[name];
      if (!part) continue;
      const rest = part.userData.rest as { pos: number[]; rot: number[] } | undefined;
      let x = 0, y = 0, z = 0, rx = 0, ry2 = 0, rz = 0;
      if (ft >= 0) {
        const a = track(f.fire, name, ft, this.smp);
        if (a) {
          x += a.pos[0]; y += a.pos[1]; z += a.pos[2];
          rx += a.rot[0]; ry2 += a.rot[1]; rz += a.rot[2];
        }
      }
      if (reloading) {
        const b = track(cl!.clip, name, cl!.t, this.smp2);
        if (b) {
          x += b.pos[0] * cw; y += b.pos[1] * cw; z += b.pos[2] * cw;
          rx += b.rot[0] * cw; ry2 += b.rot[1] * cw; rz += b.rot[2] * cw;
        }
      }
      // The bolt held open on an empty magazine (the SMG and the rifle), until the empty reload's charge.
      if (name === "bolt" && h.ammo <= 0 && !this.cr?.active && (f.model === "smg" || f.model === "rifle")) z = Math.max(z, f.model === "smg" ? 0.016 : 0.03);
      if (rest) {
        part.position.set(rest.pos[0]! + x, rest.pos[1]! + y, rest.pos[2]! + z);
        part.rotation.set(rest.rot[0]! + rx, rest.rot[1]! + ry2, rest.rot[2]! + rz);
      } else {
        part.position.set(x, y, z);
        part.rotation.set(rx, ry2, rz);
      }
    }
    // What the support hand carries: shown through its clip (the mag stays shown outside a reload).
    const vis = reloading ? chan(cl!.clip, "magVis", cl!.t, f.model === "revolver" || f.model === "shotgun" ? 0 : 1) > 0.5 : f.model !== "revolver" && f.model !== "shotgun";
    const carried = f.model === "revolver" ? P.loader : f.model === "shotgun" ? P.shell : f.model === "launcher" ? P.round : P.mag;
    if (carried) carried.visible = f.model === "launcher" ? reloading && vis : vis;
    if (f.model === "revolver") {
      if (P.rounds) P.rounds.visible = reloading ? chan(cl!.clip, "rounds", cl!.t, 1) > 0.5 : h.ammo > 0 || true;
      if (P.loaderRounds) P.loaderRounds.visible = !(reloading && cl!.t >= 1440);
    }
    if (f.model === "launcher" && P.case) P.case.visible = reloading ? chan(cl!.clip, "caseVis", cl!.t, 1) > 0.5 : true;
    if (P.magRound) P.magRound.visible = reloading ? true : h.ammo >= 2;

    // The trigger: the fire clip's travel, or 30% preload while the button is held.
    this.heroTrig = ft >= 0 ? chan(f.fire, "trigger", ft, 0) : 0;
    if (this.triggerHeld && this.cd <= 0.02 && h.ammo > 0) this.heroTrig = Math.max(this.heroTrig, 0.3);
    if (P.trigger && (P.trigger as THREE.Group).isGroup) P.trigger.rotation.x = -0.32 * this.heroTrig;

    // The support hand: to the first target (the mag, the loader, a shell, the round) or the second (the
    // charging handle); the firing hand to the bolt.
    const w1 = cl ? THREE.MathUtils.clamp(chan(cl.clip, "hand", cl.t, 0) * cw, 0, 1) : 0;
    const w2 = cl ? THREE.MathUtils.clamp(chan(cl.clip, "hand2", cl.t, 0) * cw, 0, 1) : 0;
    this.handW = Math.max(w1, w2);
    // The revolver's loader comes up from low left (the rack shoulder), not from under the grip.
    this.handOnMag = w1 >= w2 && f.model !== "revolver";
    if (this.handW > 0.001 && r.gripL) {
      const target = P[(w1 >= w2 ? f.handTo[0] : f.handTo[1]) ?? f.handTo[0]];
      if (target) this.blendHand(r, this.gripLDyn, r.gripL, target, this.handW, r.poseL ?? POSES.foreL!, w1 >= w2 ? POSES.magL! : POSES.rackL!, this.poseLDyn);
    }
    let wR = 0;
    if (f.handRTo) {
      wR = ft >= 0 ? chan(f.fire, "handR", ft, 0) : 0;
      if (reloading) wR = Math.max(wR, chan(cl!.clip, "handR", cl!.t, 0) * cw);
    }
    this.heroHandR = THREE.MathUtils.clamp(wR, 0, 1);
    if (this.heroHandR > 0.001 && f.handRTo && P[f.handRTo]) this.blendHand(r, this.gripRDyn, r.gripR, P[f.handRTo]!, this.heroHandR, r.poseR, POSES.rackL!, this.poseRDyn);

    this.heat.update(dt);
    if (this.smoke.glow.parent !== r.root) r.root.add(this.smoke.glow);
    this.smoke.glow.position.copy(r.muzzle.position);
    this.smoke.glow.position.z += 0.007;
    this.smoke.tint(this.ambTint, this.ambLevel);
    this.smoke.update(dt, this.heat.glow);
  }

  /**
   * The viewmodel's own reflections (S2.1): a PMREM of a tiny dark room with four neon strips (red, cyan, amber,
   * white), so metal always has something to reflect and the gun never renders black in a dark alley.
   */
  lightRoom(renderer: THREE.WebGLRenderer): void {
    // C8: a restart rebuilds the Arsenal in the same view scene; its room is already lit (and stays warm).
    if (this.scene.environment) return;
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x07080b);
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshBasicMaterial({ color: 0x161a22, side: THREE.BackSide }));
    room.add(box);
    const strip = (c: number, k: number, p: [number, number, number], s: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...s), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }));
      m.position.set(...p);
      room.add(m);
    };
    strip(0xff2a47, 3, [-2.9, 0.6, -1], [0.05, 0.12, 3]);
    strip(0x3fe0ff, 3.4, [2.9, 0.9, -0.5], [0.05, 0.14, 3.4]);
    strip(0xffb35a, 1.1, [0, 1.95, 0.9], [3.2, 0.05, 0.25]);
    strip(0xffffff, 4, [-1.2, 1.95, -1.6], [1.6, 0.05, 0.4]);
    // A broad soft panel ahead and above: what the slide's top and flanks mostly see from the eye.
    strip(0xc8d4ff, 0.55, [0, 1.2, -2.95], [4.5, 1.6, 0.05]);
    strip(0xffd2a8, 0.35, [-2.95, 0.2, 1.2], [0.05, 1.4, 2.5]);
    // A floor glow, the wet street's bounce.
    strip(0x2a3a5a, 1.2, [0, -1.95, -1], [5, 0.05, 3]);
    const gen = new THREE.PMREMGenerator(renderer);
    const env = gen.fromScene(room, 0.02).texture;
    gen.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = 1;
  }

  private readonly key: THREE.DirectionalLight;
  private readonly keyBase: { color: THREE.Color; intensity: number };
  private readonly fill: THREE.DirectionalLight;
  private readonly fillBase: THREE.Color;
  private readonly ambTint = new THREE.Color(1, 1, 1);
  private ambLevel = 0.5;

  /**
   * The viewmodel picks up the place it's in (C4 review: the gun looked pasted on, identical in the neon street
   * and the dark alley): `color` is the baked light around the camera (linear RGB), `level` 0..1 how lit it is.
   * A quarter of the key and fill take the light's hue (normalised, so it tints without darkening), and the key
   * eases down at most 12% in the dark: the gun still never goes black (the 0.08 slide-luminance floor).
   */
  ambient(color: THREE.Color, level: number, dt: number): void {
    const m = Math.max(color.r, color.g, color.b);
    const k = 1 - Math.exp(-dt * 3);
    if (m > 1e-4) this.ambTint.lerp(new THREE.Color(color.r / m, color.g / m, color.b / m), k);
    this.ambLevel += (THREE.MathUtils.clamp(level, 0, 1) - this.ambLevel) * k;
    this.key.color.copy(this.keyBase.color).lerp(this.keyBase.color.clone().multiply(this.ambTint), 0.25);
    this.key.intensity = this.keyBase.intensity * THREE.MathUtils.lerp(0.88, 1.04, this.ambLevel);
    this.fill.color.copy(this.fillBase).lerp(this.ambTint, 0.3);
  }

  private inspectT = -1;
  /** How far into the inspect's turn the gun is (0..1): the shoulders drop away and the HUD fades the crosshair. */
  inspectW = 0;
  private readonly pivV = new THREE.Vector3();
  private readonly pivW = new THREE.Vector3();
  /** Screenshot stages: hold the aim regardless of input, and hold the inspect at this moment (ms; -1 = play it). */
  holdAim = false;
  inspectHold = -1;
  private readonly shR = new THREE.Vector3();
  private readonly shL = new THREE.Vector3();

  /** Starts the inspect (C5 binds it to a key; the pistol-inspect stage holds a moment of it). */
  inspect(atMs = 0): void {
    if (this.busy) return;
    this.inspectT = atMs / 1000;
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
    return this.reloading > 0 || this.raising > 0 || this.boltLeft > 0 || this.rm.active || !!this.cr?.active;
  }

  /** Weapons Cath actually has: everything else stays in the case until she finds or earns it. */
  readonly owned = new Set<string>(SLICE_WEAPONS.map((w) => w.id));

  /** The owned weapons, in display order (number keys pick from these). */
  get ownedIndices(): number[] {
    return this.held.map((h, i) => (this.owned.has(h.def.id) ? i : -1)).filter((i) => i >= 0);
  }

  /** Number key n picks the n-th owned weapon. */
  equipSlot(n: number): void {
    const i = this.ownedIndices[n];
    if (i !== undefined) this.equip(i);
  }

  /** The next (or previous) owned weapon. */
  cycleOwned(dir: number): void {
    const list = this.ownedIndices;
    if (list.length < 2) return;
    const at = Math.max(0, list.indexOf(this.current));
    this.equip(list[(at + dir + list.length) % list.length]!);
  }

  equipId(id: string): void {
    const i = this.held.findIndex((h) => h.def.id === id);
    if (i >= 0) this.equip(i);
  }

  equip(i: number): void {
    if (i < 0 || i >= this.held.length || (i === this.current && this.rig.root.visible)) return;
    if (!this.owned.has(this.held[i]!.def.id)) return;
    // S2.4: a swap cancels a reload that hasn't committed; after the commit it waits for the reload to end.
    if (this.rm.active) {
      if (this.rm.committed) {
        this.pendingEquip = i;
        return;
      }
      this.rm.cancel();
    }
    if (this.cr?.active) {
      if (this.cr.committed && this.cr.kind !== "shell") {
        this.pendingEquip = i;
        return;
      }
      this.cr.cancel();
    }
    this.pendingEquip = -1;
    this.rig.root.visible = false;
    this.current = i;
    this.rig.root.visible = true;
    this.arms.attach(this.rig.root);
    this.inspectT = -1;
    this.raising = 0.35;
    this.reloading = 0;
    this.boltLeft = 0;
    this.swingT = -1;
    this.altQueue = 0;
    this.fireMs = -1;
    this.pressMs = -1;
    this.drawMs = -1;
    this.heroFireMs = -1;
    this.heroLast = this.heroGhost = null;
    this.burstN = 0;
    const hf = this.hero;
    this.cr = hf ? new ClassReload(hf) : null;
    if (this.kestrel || hf) {
      // S2.4: the 450 ms draw, or on the Kestrel's first pickup the 900 ms hero draw with its rack.
      this.drawClip = this.heroNext && this.kestrel ? HERO : DRAW;
      if (this.kestrel) this.heroNext = false;
      this.drawMs = 0;
      this.raising = this.drawClip.dur / 1000;
      this.cues.push("draw");
    }
  }

  /** C11: after a takedown the gun in hand comes back up with its draw. */
  redraw(): void {
    this.rig.root.visible = false;
    this.equip(this.current);
  }

  /** Screenshot stages (time frozen): the gun is up and ready, not caught mid-draw or mid-reload. */
  settle(): void {
    this.raising = 0;
    this.reloading = 0;
    this.boltLeft = 0;
    this.rm.kind = null;
    this.fireMs = -1;
    this.drawMs = -1;
    this.pressMs = -1;
    this.lastClip = this.ghost = null;
    this.cr?.cancel();
    if (this.cr) this.cr.kind = null;
    this.heroFireMs = -1;
    this.heroLast = this.heroGhost = null;
    this.burstN = 0;
    this.flashT = 0;
    this.heat.v = 0;
    this.smoke.clear();
    this.camRecoil.reset();
    for (const s of [this.recRot, this.recPos])
      for (const c of [s.x, s.y, s.z]) c.x = c.v = 0;
    for (const h of this.held) h.locked = h.def.weaponClass === "pistol" && h.ammo <= 0;
    this.cues.length = 0;
  }

  /** Screenshot stages: every gun back to a full magazine and its starting reserve. */
  restock(): void {
    for (const h of this.held) {
      h.ammo = h.def.mag;
      h.reserve = h.def.reserve;
      h.locked = false;
    }
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

  /** Ammo scavenged off a body: about half a magazine for the gun in hand, a little for the rest, capped at the starting reserve x1.5. Returns what the held gun got. */
  scavenge(): number {
    let got = 0;
    this.held.forEach((h, i) => {
      if (h.def.mag === 0) return;
      const room = Math.floor(h.def.reserve * 1.5) - h.reserve;
      const n = Math.max(0, Math.min(room, Math.ceil(h.def.mag * (i === this.current ? 0.5 : 0.2))));
      h.reserve += n;
      if (i === this.current) got = n;
    });
    return got;
  }

  /** Ammo from a dropped gun: a magazine and a half of reserve for that weapon (capped at 2x its starting reserve). Returns rounds added. */
  giveAmmo(id: string): number {
    const h = this.held.find((x) => x.def.id === id);
    if (!h || h.def.mag === 0) return 0;
    const n = Math.max(0, Math.min(Math.ceil(h.def.mag * 1.5), h.def.reserve * 2 - h.reserve));
    h.reserve += n;
    return n;
  }

  /** Fills the held magazine from nowhere and cancels a reload (Spin Reload, Bullet Hose, Bang Bang). */
  topUp(): void {
    const h = this.held[this.current]!;
    if (h.def.mag === 0) return;
    h.ammo = h.def.mag;
    h.locked = false;
    this.reloading = 0;
    this.rm.kind = null;
    if (this.cr) this.cr.kind = null;
  }

  /** What the alt-fire button does with the weapon in hand, for the HUD and tests. */
  get altKind(): "burst" | "fan" | "both" | "slam" | "parry" | "charge" | "lash" | null {
    switch (this.weapon.weaponClass) {
      case "pistol":
      case "smg":
      case "rifle":
      case "smart":
        return "burst";
      // C18: the Bargain Bin is a single break-open tube, so its alt is a hot load, not a burst.
      case "launcher":
      case "sniper":
        return "charge";
      case "revolver":
        return "fan";
      case "shotgun":
        return "both";
      default:
        return this.weapon.id === "repossessor" ? "slam" : this.weapon.id === "nightShift" ? "parry" : this.weapon.id === "catsCradle" ? "lash" : null;
    }
  }

  /** Set when a slam lands; the session turns it into a knockdown blast. */
  slamNow = false;

  /** Set when the monowire's lash cracks; the session turns it into a wide, shallow sweep. */
  lashNow = false;

  /** Seconds left of a parry: while above zero, incoming bullets are deflected. */
  parryT = 0;

  /** Starts the weapon's alt-fire (burst, fanned hammer, both barrels, ground slam). Returns whether it began. */
  altFire(): boolean {
    const h = this.held[this.current]!;
    const kind = this.altKind;
    if (!kind || this.cd > 0 || this.busy || this.altQueue > 0) return false;
    if (kind === "parry") {
      this.swingT = 0;
      this.parryT = 0.5;
      this.cd = 0.9;
      return true;
    }
    if (kind === "lash") {
      this.swingT = 0;
      this.cd = this.weapon.cycle * 1.6;
      this.lashNow = true;
      return true;
    }
    if (kind === "slam") {
      this.swingT = 0;
      this.cd = this.weapon.cycle * 1.3;
      this.slamNow = true;
      return true;
    }
    if (h.ammo <= 0) return false;
    this.altSpread = 1;
    this.altBarrels = 1;
    this.altCycle = this.weapon.cycle;
    this.altDmg = 1;
    if (kind === "charge") {
      // An overcharged round: a held breath and a hotter load, steadier and 60% harder, then a long bolt.
      this.altQueue = 1;
      this.altSpread = 0.3;
      this.altDmg = 1.6;
      this.altCycle = this.weapon.cycle * 1.4;
    } else if (kind === "burst") {
      const wc = this.weapon.weaponClass;
      this.altQueue = Math.min(h.ammo, wc === "rifle" || wc === "smart" ? 5 : 3);
    } else if (kind === "fan") {
      this.altQueue = h.ammo;
      this.altCycle = this.weapon.cycle * 0.22;
      this.altSpread = 3;
    } else {
      this.altQueue = 1;
      this.altBarrels = Math.min(2, h.ammo);
    }
    return true;
  }

  reload(): void {
    const h = this.held[this.current]!;
    if (this.kestrel) {
      if (this.raising <= 0 && this.inspectT < 0) startReload(h, this.rm);
      return;
    }
    if (this.cr) {
      // C18: the class's reload (the shotgun's shell by shell); not over a shot's pump or bolt.
      if (this.raising <= 0 && this.heroFireMs < 0 && this.inspectT < 0) this.cr.start(h);
      return;
    }
    if (h.def.mag === 0 || h.ammo >= h.def.mag || h.reserve <= 0 || this.reloading > 0) return;
    this.shellReload = h.def.weaponClass === "shotgun";
    this.reloading = h.def.reload;
    this.reloadTotal = h.def.reload;
    this.reloadEmpty = h.ammo <= 0;
  }
  private reloadTotal = 1;
  /** The slide locks back on an empty magazine and drops on a fresh one. */
  private reloadEmpty = false;

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
    // A held screenshot moment: the session still ticks real time here (`dt || realDt`), so nothing may advance.
    if (this.freeze) dt = 0;
    const h = this.held[this.current]!;
    const def = h.def;
    this.cd -= dt;
    this.parryT = Math.max(0, this.parryT - dt);
    this.meleeNow = false;
    if (this.raising > 0) this.raising = Math.max(0, this.raising - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    if (dt > 0) this.frameDt += (Math.min(dt, 0.1) - this.frameDt) * 0.1;
    // The Kestrel's can: a small warm light for 40 ms (S2.3), not the open guns' blaze. A hero class lights the gun
    // by its own flash (S2.6's `light`, 8 is the old 6); on a phone at 30%, or its lifted grade blows the gun and
    // gloves flat white-orange (C18 review).
    const can = def.id === "kestrel";
    const open = this.hero ? this.hero.flash.light * 0.75 : 6;
    this.flash.intensity = this.flashT > 0 ? (can ? KF.puff.vmLight * (this.phone ? KF.puff.phoneLightMul : 1) : open * (this.phone ? 0.3 : 1)) : 0;
    this.flash.distance = can ? KF.puff.vmRangeM : 1.2;
    const pistol = this.kestrel;
    if (pistol && this.rm.active) {
      // S2.4: sprinting cancels a reload that hasn't committed; after the commit it plays out.
      if (this.sprinting && this.rm.cancel()) this.cues.push("reloadCancel");
      else {
        const r = stepReload(h, this.rm, dt * 1000);
        this.cues.push(...r.events);
        if (r.done && this.pendingEquip >= 0) {
          const i = this.pendingEquip;
          this.pendingEquip = -1;
          this.equip(i);
          return null;
        }
      }
    }
    if (this.boltLeft > 0) this.boltLeft = Math.max(0, this.boltLeft - dt);
    // C18: a hero gun's reload. Sprinting cancels one that hasn't committed; a pull between shotgun shells (or
    // before a mag's commit) ends it and fires, the shells already in stay in.
    const cr = this.cr;
    this.sinceShot += dt;
    if (cr?.active) {
      const cut = (this.sprinting || (trigger && h.ammo > 0)) && cr.cancel();
      if (cut) this.cues.push("reloadCancel");
      else {
        const r = cr.step(h, dt * 1000);
        this.cues.push(...r.events);
        if (r.done && this.pendingEquip >= 0) {
          const i = this.pendingEquip;
          this.pendingEquip = -1;
          this.equip(i);
          return null;
        }
      }
    }

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
    } else if ((trigger || this.altQueue > 0) && this.cd <= 0 && (pistol || cr ? this.raising <= 0 && !cr?.active : !this.busy)) {
      // The Kestrel's pull (S2.3/S2.4): it cancels a reload that hasn't committed, dry-fires on a locked slide.
      const pull = pistol ? pullTrigger(h, this.rm) : h.ammo > 0 ? "fire" : "empty";
      if (pull === "dry") {
        this.altQueue = 0;
        if (trigger) this.dryFire();
      } else if (pull === "none") {
        this.altQueue = 0;
      } else if (pull === "empty") {
        this.altQueue = 0;
        this.reload();
      } else {
        const barrels = this.altQueue > 0 ? this.altBarrels : 1;
        const dmgMul = this.altQueue > 0 ? this.altDmg : 1;
        const widen = this.altQueue > 0 ? this.altSpread : 1;
        if (!pistol) h.ammo -= barrels;
        this.cd = this.altQueue > 0 ? this.altCycle : def.cycle;
        if (barrels > 1) this.cd = def.cycle * 1.2;
        if (this.altQueue > 0) this.altQueue--;
        if (def.weaponClass === "sniper" && !cr) this.boltLeft = def.cycle * 0.85;
        const spread = (this.aiming ? def.spread[1] : def.spread[0]) * spreadMul * widen;
        const dirs: THREE.Vector3[] = [];
        for (let i = 0; i < def.pellets * barrels; i++) {
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
        shot = { weapon: dmgMul !== 1 ? { ...def, damage: def.damage * dmgMul } : def, origin: eye.clone(), dirs, muzzle: worldMuzzle };
        this.flash.position.copy(this.rig.muzzle.getWorldPosition(new THREE.Vector3()));
        if (pistol) this.firePistolFx();
        else if (cr) this.fireHeroFx(cr.feel);
        else {
          this.anim.fire(def.kick * (this.aiming ? 0.55 : 1));
          this.flashT = 0.06;
          if (h.ammo === 0 && h.reserve > 0) this.reload();
        }
      }
    }
    return shot;
  }

  /** Poses the current rig in the view scene. */
  pose(dt: number, look: { yaw: number; pitch: number }, stride: number, speed: number, sprint: boolean, landed: number, viewCamera: THREE.PerspectiveCamera, baseFov: number): void {
    const def = this.weapon;
    const r = this.rig;
    const a = this.anim;
    const pistol = this.kestrel;
    const hero = this.hero;
    // C18: the hero guns' draws, reloads, pumps and bolts are clips too (S2.4 for every class).
    const clipGun = pistol || !!hero;
    // S2.4: she can aim during a pistol reload (the clip turns at half strength), not during the draw. S2.6: each
    // class comes up to the sights at its own speed (ADS ms), slower in the critical tier.
    const adsK = hero ? (14 * 220) / hero.adsMs : 14;
    a.aim = THREE.MathUtils.damp(a.aim, this.aiming && (clipGun ? this.raising <= 0 : !this.busy) ? 1 : 0, adsK / Math.max(1, this.adsSlow), dt);
    // Dip for reloads and raising; the pump, slide and bolt travel. The Kestrel's draw and reloads are clips.
    let dip = clipGun ? 0 : this.raising / 0.35;
    if (this.reloading > 0) dip = Math.max(dip, this.shellReload ? 0.35 : 0.6);
    if (this.boltLeft > 0) dip = Math.max(dip, 0.15);
    a.dip = THREE.MathUtils.damp(a.dip, dip, 12, dt);
    const cycle = def.cycle;
    const since = cycle - Math.max(0, this.cd);
    a.action = def.weaponClass === "pistol" ? Math.max(0, 1 - since / 0.07) : def.weaponClass === "shotgun" || def.weaponClass === "sniper" ? Math.max(0, Math.sin(Math.min(1, Math.max(0, (since - 0.15) / (cycle * 0.6))) * Math.PI)) : 0;
    const melee = def.kind === "melee";
    const swinging = this.swingT >= 0;
    // Melee weapons swing on keyframes, alternating forehand and backhand; others keep the old nudge (parry).
    if (melee && swinging && a.meleeT < 0) a.meleeSide = -a.meleeSide;
    a.meleeT = melee && swinging ? this.swingT : -1;
    a.swing = !melee && swinging ? Math.sin(Math.min(1, this.swingT / 0.25) * Math.PI) * (this.swingT < 0.25 ? 1 : 0) : 0;
    a.roll = this.reloading > 0 && !this.shellReload ? 0.5 : 0;
    if (clipGun) a.action = 0;
    a.update(dt, look, stride, speed, sprint && !this.aiming, landed);
    const base = r.hip.clone().lerp(r.ads, a.aim);
    r.root.position.copy(base).add(a.pos);
    r.root.rotation.copy(a.rot);
    if (r.hipRot) {
      const k = 1 - a.aim;
      r.root.rotation.x += r.hipRot[0] * k;
      r.root.rotation.y += r.hipRot[1] * k;
      r.root.rotation.z += r.hipRot[2] * k;
    }
    if (pistol) this.posePistol(this.freeze ? 0 : dt, r);
    else if (hero) this.poseHero(this.freeze ? 0 : dt, r, hero);
    // C6: the hit's jolt, on top of everything the gun is doing.
    const hd = this.hurtDip.update(this.freeze ? 0 : dt);
    const hr = this.hurtRoll.update(this.freeze ? 0 : dt);
    r.root.position.y -= hd;
    r.root.position.x += hr * 0.1;
    r.root.rotation.z += hr;
    // The inspect clip, layered on top (S2.2 layer 3); any action cancels it.
    this.inspectW = 0;
    if (this.inspectHold >= 0) this.inspectT = this.inspectHold / 1000 - dt;
    if (this.inspectT >= 0) {
      if (this.busy || this.aiming || this.cd > 0 || swinging) this.inspectT = -1;
      else {
        this.inspectT += dt;
        if (this.inspectT * 1000 >= INSPECT.dur) this.inspectT = -1;
        else {
          const k = sampleClip(INSPECT, this.inspectT * 1000).root!;
          // The turn pivots part-way back toward the wrist (C4 review: turning about the slide swung the grip,
          // and with it the whole forearm, into the camera): the hand stays low and right, the gun turns in it.
          const pv = this.pivV.copy(r.gripR.position).multiplyScalar(INSPECT_PIVOT);
          r.root.updateMatrix();
          const before = this.pivW.copy(pv).applyMatrix4(r.root.matrix);
          r.root.rotation.x += k.rot[0];
          r.root.rotation.y += k.rot[1];
          r.root.rotation.z += k.rot[2];
          r.root.updateMatrix();
          r.root.position.add(before.sub(pv.applyMatrix4(r.root.matrix)));
          r.root.position.x += k.pos[0];
          r.root.position.y += k.pos[1];
          r.root.position.z += k.pos[2];
          this.inspectW = Math.min(1, Math.abs(k.rot[1]) / 0.7);
        }
      }
    }
    // The smear behind a melee swing, through the strike only.
    if (melee && swinging && this.swingT > 0.07 && this.swingT < 0.24) {
      r.root.updateMatrixWorld(true);
      const tip = r.muzzle.getWorldPosition(this.tipV);
      const mid = this.midV.copy(r.muzzle.position).multiplyScalar(0.45);
      r.root.localToWorld(mid);
      this.trail.update(dt, tip, mid);
    } else this.trail.update(dt, null, null);
    if (r.flashMesh) {
      // The open guns' flash (S2.3): one frame at 50 fps or above, two below; a random roll and ±25% scale.
      const on = hero ? this.flashT > 0 : this.flashT > 0.03;
      const was = r.flashMesh.visible;
      r.flashMesh.visible = on;
      if (on && (!was || !hero)) {
        r.flashMesh.rotation.z = Math.random() * Math.PI;
        if (hero) r.flashMesh.scale.setScalar(0.75 + Math.random() * 0.5);
      }
    }
    // Pistol reload: the magazine drops, a fresh one seats, and an empty gun has its slide dropped on it.
    let reloadP = -1;
    if (def.weaponClass === "pistol" && this.reloading > 0) reloadP = 1 - this.reloading / this.reloadTotal;
    if (r.mag && !clipGun) {
      let out = 0;
      if (reloadP >= 0) out = reloadP < 0.2 ? 0 : reloadP < 0.4 ? (reloadP - 0.2) / 0.2 : reloadP < 0.65 ? 1 : Math.max(0, 1 - (reloadP - 0.65) / 0.15);
      r.mag.position.y = -out * 0.09;
      r.mag.position.z = out * 0.015;
    }
    // An empty pistol holds its slide back; the reload drops it on the fresh magazine.
    const held = this.held[this.current]!;
    const h0 = held;
    const lock = def.weaponClass === "pistol" && (held.ammo <= 0 || (reloadP >= 0 && this.reloadEmpty && reloadP < 0.85)) ? 1 : 0;
    if (r.action && !clipGun) {
      if (def.weaponClass === "pistol") r.action.position.z = Math.max(a.action, lock) * 0.024;
      else if (def.weaponClass === "shotgun") r.action.position.z = a.action * 0.08;
      else if (def.weaponClass === "sniper") {
        r.action.rotation.z = a.action * 1.3;
        r.action.position.z = 0.06 + Math.max(0, a.action - 0.5) * 0.12;
      }
    }
    // The Kestrel's small parts: the slide stop rises 12° on a locked slide, the hammer falls on the shot and
    // re-cocks as the slide returns, the trigger travels 5 mm while the shot breaks.
    const firing = def.kind !== "melee" && since < 0.07 && h0.ammo >= 0 && this.cd > 0;
    const P = r.parts;
    if (!clipGun) {
      if (P.slideStop) P.slideStop.rotation.x = lock * 0.21;
      if (P.hammer) P.hammer.rotation.x = since < 0.03 && this.cd > 0 ? 0.96 * Math.min(1, Math.max(0, (since - 0.012) / 0.018)) : 0.96;
      if (P.trigger) P.trigger.rotation.x = firing ? -0.24 : 0;
      if (P.barrel) P.barrel.rotation.x = def.weaponClass === "pistol" ? Math.min(1, Math.max(a.action, lock) * 1.6) * 0.052 : 0;
    }
    // Her hands on the grip, the index onto the trigger while the shot breaks.
    this.shR.lerpVectors(r.shoulderR ?? SHOULDER_R, SHOULDER_R_ADS, a.aim);
    this.shL.lerpVectors(r.shoulderL ?? SHOULDER_L, SHOULDER_L_ADS, a.aim);
    // Inspecting, the elbows drop out and down so the forearms fall away under the turned gun instead of
    // pointing at the lens (C4 review: the sleeve filled a quarter of the frame).
    if (this.inspectW > 0) {
      this.shR.lerp(SHOULDER_R_INSPECT, this.inspectW);
      this.shL.lerp(SHOULDER_L_INSPECT, this.inspectW);
    }
    // C5: racking, the support shoulder drops out and left, so that forearm comes up from the corner, not across.
    if (clipGun && this.handW > 0 && !this.handOnMag) this.shL.lerp(SHOULDER_L_RACK, this.handW);
    // C5: through a reload the firing shoulder drops out and right, so the forearm falls away under the gun.
    if (clipGun && this.armW > 0) this.shR.lerp(SHOULDER_R_RELOAD, this.armW * (hero && hero.model !== "revolver" ? 0.6 : 1));
    // The lock's turn swings the firing forearm level across the bottom of the frame (over the ammo block):
    // drop that shoulder part-way too, so the arm falls away under the turned gun.
    if (pistol && this.lockW > 0.001) this.shR.lerp(SHOULDER_R_LOCK, this.lockW * 0.7);
    // The Kestrel's trigger finger curls while the shot breaks and while the button is held (the preload).
    const curl = pistol ? Math.min(1, this.trigMm / KF.fire.triggerMm) : hero ? this.heroTrig : firing ? 1 : 0;
    const dyn = clipGun && (this.handW > 0.001 || this.clutchW > 0.001);
    const gl = dyn ? this.gripLDyn : r.gripL;
    const pl = dyn ? this.poseLDyn : r.poseL;
    const dynR = !!hero && this.heroHandR > 0.001;
    this.arms.pose(r.root, dynR ? this.gripRDyn : r.gripR, gl, dynR ? this.poseRDyn : r.poseR, pl, dynR ? 0 : curl, this.shR, this.shL);
    // The scope: past 85% aim the rig hides and the overlay takes over.
    r.root.visible = !this.hideGun && !(r.scoped && a.aim > 0.85);
    const fov = THREE.MathUtils.lerp(baseFov, def.weaponClass === "sniper" ? r.adsFov * Arsenal.ZOOMS[this.zoom]! : baseFov * 0.82, a.aim);
    // S2.1: the viewmodel draws at 54° whatever the world's FOV (a gun that sits further out when aimed narrows it).
    const vmFov = THREE.MathUtils.lerp(54, r.adsVmFov ?? 54, a.aim);
    if (Math.abs(viewCamera.fov - vmFov) > 0.01) viewCamera.fov = vmFov;
    viewCamera.updateProjectionMatrix();
    this.worldFov = fov;
  }
  /** The trigger's travel this frame (mm) and the support hand's weight off the grip (0..1). */
  private trigMm = 0;
  private handW = 0;

  /** The firing shoulder's reload drop this frame (0..1), and whether the support hand's target is the mag. */
  private armW = 0;
  private handOnMag = false;

  /** The clip playing on the Kestrel this frame (reload, draw, press-check), if any, at full weight. */
  private liveClip(): { clip: Clip; t: number } | null {
    if (this.rm.active) return { clip: this.rm.clip, t: this.rm.t };
    if (this.drawMs >= 0) return { clip: this.drawClip, t: this.drawMs };
    if (this.pressMs >= 0) return { clip: PRESS_CHECK, t: this.pressMs };
    return null;
  }

  /** The clip sampled last frame (to catch one that stopped early) and a cancelled clip fading out. */
  private lastClip: { clip: Clip; t: number } | null = null;
  private ghost: { clip: Clip; t: number; ms: number } | null = null;

  /**
   * The clip posing the Kestrel this frame with its weight. A clip cut short (fire, sprint or a swap cancelling a
   * reload; any input cancelling the press-check) doesn't snap to the hip: its last pose (gun, mag, hand, arm,
   * slide) eases out to nothing over KF.cancelBlendMs (C5 review: every fire-to-cancel popped in one frame).
   */
  private pistolClip(ms: number): { clip: Clip; t: number; w: number } | null {
    const live = this.liveClip();
    const last = this.lastClip;
    this.lastClip = live;
    if (live) {
      this.ghost = null;
      return { ...live, w: 1 };
    }
    // Stopped early: it had more than this frame's step to run (a natural end crosses its duration this frame).
    if (last && last.t + ms < last.clip.dur - 1) this.ghost = { clip: last.clip, t: last.t, ms: 0 };
    const g = this.ghost;
    if (!g) return null;
    g.ms += ms;
    const p = g.ms / KF.cancelBlendMs;
    if (p >= 1) {
      this.ghost = null;
      return null;
    }
    // Ease-out: most of the way home early, settling gently.
    return { clip: g.clip, t: g.t, w: (1 - p) * (1 - p) * (1 - p) };
  }

  /** The lock pose's weight (0..1), eased toward a locked slide. */
  private lockW = 0;

  /** Turns the gun root by (x, y, z) radians about a point most of the way back to the firing wrist, then moves it. */
  private turnGun(r: GunRig, x: number, y: number, z: number, pos: readonly number[]): void {
    const pv = this.pivV.copy(r.gripR.position).multiplyScalar(INSPECT_PIVOT);
    r.root.updateMatrix();
    const before = this.pivW.copy(pv).applyMatrix4(r.root.matrix);
    r.root.rotation.x += x;
    r.root.rotation.y += y;
    r.root.rotation.z += z;
    r.root.updateMatrix();
    r.root.position.add(before.sub(pv.applyMatrix4(r.root.matrix)));
    r.root.position.x += pos[0]!;
    r.root.position.y += pos[1]!;
    r.root.position.z += pos[2]!;
  }

  /**
   * The Kestrel in motion (C5, S2.2 layers 3 and 4, S2.3, S2.4): the clip on the gun root (turned about a point
   * near the wrist, so the hand stays planted), the recoil springs, then every moving part from the fire clip,
   * the reload clip or the lock, the support hand off to the mag or the slide, the smoke and the crown's heat.
   */
  private posePistol(dt: number, r: GunRig): void {
    const ms = dt * 1000;
    const h = this.held[this.current]!;
    const P = r.parts;
    // Clocks: the shot's clip, the draw, the press-check (the reload's own clock runs in update()).
    if (this.fireMs >= 0) {
      const t0 = this.fireMs;
      this.fireMs += ms;
      for (const e of eventsBetween(FIRE, t0 === 0 ? -1 : t0, this.fireMs)) if (e !== "fire") this.cues.push(e);
      if (this.fireMs > FIRE.dur) this.fireMs = -1;
    }
    for (const which of ["draw", "press"] as const) {
      const cur = which === "draw" ? this.drawMs : this.pressMs;
      if (cur < 0) continue;
      const clip = which === "draw" ? this.drawClip : PRESS_CHECK;
      const nt = cur + ms;
      // The draw's first cue ("draw") is pushed by equip().
      for (const e of eventsBetween(clip, cur, nt)) this.cues.push(e);
      const done = nt >= clip.dur;
      if (which === "draw") this.drawMs = done ? -1 : nt;
      else this.pressMs = done ? -1 : nt;
    }
    if (this.pressMs >= 0 && (this.busy || this.aiming || this.cd > 0)) this.pressMs = -1;

    // The clip on the gun root: about a pivot most of the way back to the firing wrist.
    const cl = this.pistolClip(ms);
    const cw = cl ? cl.w : 0;
    const reloadClip = !!cl && (cl.clip === TAC_CLIP || cl.clip === EMPTY_CLIP);
    const k = cl ? track(cl.clip, "gun", cl.t, this.smp) : null;
    if (k) {
      // S2.4: clip rotations at half strength while aiming through a reload, and under reduced motion.
      const s = (this.rm.active && this.aiming ? 0.5 : 1) * (this.reducedMotion ? 0.5 : 1) * cw;
      this.turnGun(r, k.rot[0] * s, k.rot[1] * s, k.rot[2] * s, [k.pos[0] * cw, k.pos[1] * cw, k.pos[2] * cw]);
    }
    this.armW = reloadClip ? channel(cl!.clip, "arm", cl!.t, 0) * cw : 0;
    // The lock (C5 review: at hip the 24 mm of slide travel runs straight away from the eye and doesn't read):
    // on an empty, locked slide the gun turns its left flank and the top to her, so the bare bronze barrel
    // ahead of the slide, the empty port and the raised stop face the camera. Eased in over about 120 ms.
    const lockTo = h.locked && !this.rm.active && this.anim.aim < 0.5 ? 1 : 0;
    this.lockW += (lockTo - this.lockW) * (1 - Math.exp(-ms / 45));
    if (this.lockW > 0.001) {
      const L = KF.lock.pose;
      const w = this.lockW * this.lockW * (3 - 2 * this.lockW) * (this.reducedMotion ? 0.5 : 1);
      this.turnGun(r, L.rot[0] * DEG * w, L.rot[1] * DEG * w, L.rot[2] * DEG * w, [L.pos[0] * w, L.pos[1] * w, L.pos[2] * w]);
    }
    // Recoil springs (S2.3): 14 Hz rotation, 16 Hz position.
    const [rp, ry, rr] = this.recRot.update(dt);
    const [px, py, pz] = this.recPos.update(dt);
    r.root.rotation.x += rp;
    r.root.rotation.y += ry;
    r.root.rotation.z += rr;
    r.root.position.x += px;
    r.root.position.y += py;
    r.root.position.z += pz;

    // The slide: the shot's clip, a rack or press-check, the empty reload's lock and slam, or the lock itself.
    const F = KF.fire;
    const ft = this.fireMs >= 0 ? this.fireMs : -1;
    let slide = ft >= 0 ? track(FIRE, "slide", ft, this.smp)!.pos[2] : 0;
    const clipSlide = cl ? track(cl.clip, "slide", cl.t, this.smp) : null;
    if (this.rm.kind === "empty" && clipSlide) slide = clipSlide.pos[2];
    else {
      if (clipSlide) slide = Math.max(slide, clipSlide.pos[2] * cw);
      if (h.locked) slide = F.slideM;
    }
    if (P.slide) P.slide.position.z = slide;
    // The barrel tilts on the shot's clip, or with the slide's travel past 3 mm (locked, racked, checked).
    let tilt = ft >= 0 ? track(FIRE, "barrel", ft, this.smp)!.rot[0] : 0;
    if (ft < 0) tilt = THREE.MathUtils.clamp((slide - 0.003) / 0.008, 0, 1) * F.barrelTiltDeg * DEG;
    if (P.barrel) P.barrel.rotation.x = tilt;
    // The hammer falls on the break and re-cocks; the slide stop is up on a locked slide until the thumb drops it.
    if (P.hammer) P.hammer.rotation.x = ft >= 0 ? track(FIRE, "hammer", ft, this.smp)!.rot[0] : F.hammerDeg * DEG;
    const stopUp = this.rm.kind === "empty" ? channel(EMPTY_CLIP, "stop", this.rm.t, 1) : h.locked ? 1 : 0;
    if (P.slideStop) P.slideStop.rotation.x = stopUp * KF.lock.stopDeg * DEG;
    // The trigger: full travel while the shot breaks, 3 mm of preload while the button is held.
    this.trigMm = ft >= 0 ? track(FIRE, "trigger", ft, this.smp)!.pos[0] : 0;
    if (this.triggerHeld && this.cd <= 0.02 && !h.locked) this.trigMm = Math.max(this.trigMm, F.preloadMm);
    if (P.trigger) P.trigger.rotation.x = -this.trigMm * 0.048;

    // The magazine: the reload's track (out, to the pouch, back in), hidden while the old one falls free.
    const magT = reloadClip ? track(cl!.clip, "mag", cl!.t, this.smp) : null;
    if (r.mag) {
      if (magT) {
        r.mag.position.set(magT.pos[0] * cw, magT.pos[1] * cw, magT.pos[2] * cw);
        r.mag.rotation.set(magT.rot[0] * cw, magT.rot[1] * cw, magT.rot[2] * cw);
      } else {
        r.mag.position.set(0, 0, 0);
        r.mag.rotation.set(0, 0, 0);
      }
      r.mag.visible = reloadClip ? channel(cl!.clip, "magVis", cl!.t, 1) > 0.5 : true;
    }
    // The rounds: a fresh mag shows brass; the gun's own mag shows its top round while it has one under the
    // chambered round; the chamber is empty on a locked slide (and through an empty reload until the slam).
    if (P.magRound) P.magRound.visible = this.rm.active ? this.rm.kind === "empty" || this.rm.t > 520 || h.ammo >= 2 : h.ammo >= 2;
    if (P.chamberRound) P.chamberRound.visible = h.ammo >= 1 && !h.locked && !(this.rm.kind === "empty" && this.rm.t < KF.reload.slideStopMs + KF.reload.slamMs);

    // The support hand: off the grip to the mag (reloads) or over the slide (the rack, the press-check).
    this.handW = cl ? THREE.MathUtils.clamp(channel(cl.clip, "hand", cl.t, 0) * cw, 0, 1) : 0;
    this.handOnMag = reloadClip;
    if (this.handW > 0.001 && r.gripL) {
      const target = reloadClip ? P.magHand : P.rackHand;
      if (target) {
        if (this.gripLDyn.parent !== r.root) r.root.add(this.gripLDyn);
        r.root.updateMatrixWorld(true);
        const inv = this.mA.copy(r.root.matrixWorld).invert();
        this.mB.multiplyMatrices(inv, target.matrixWorld).decompose(this.pB, this.qB, this.sV);
        this.pA.copy(r.gripL.position);
        this.qA.copy(r.gripL.quaternion);
        const w = this.handW * this.handW * (3 - 2 * this.handW);
        this.gripLDyn.position.lerpVectors(this.pA, this.pB, w);
        this.gripLDyn.quaternion.slerpQuaternions(this.qA, this.qB, w);
        this.gripLDyn.userData.thumb = w < 0.4 ? r.gripL.userData.thumb : undefined;
        lerpPose(r.poseL ?? POSES.pistolL!, reloadClip ? POSES.magL! : POSES.rackL!, w, this.poseLDyn);
      }
    }
    // C6 (S6.2): clutching the wound. In with the hit (120 ms), held to 350 ms, back on the grip over 250 ms.
    this.clutchW = 0;
    if (this.clutchMs >= 0) {
      this.clutchMs += dt * 1000;
      const t = this.clutchMs;
      this.clutchW = t < 120 ? t / 120 : t < 350 ? 1 : Math.max(0, 1 - (t - 350) / 250);
      if (t >= 600) this.clutchMs = -1;
    }
    if (this.clutchW > 0.001 && this.handW <= 0.001 && r.gripL) {
      if (this.gripLDyn.parent !== r.root) r.root.add(this.gripLDyn);
      r.root.updateMatrixWorld(true);
      // Her sternum, in the view's space: low, centre-left and close, then into the gun's frame.
      this.pB.copy(CLUTCH_AT);
      if (r.root.parent) r.root.parent.localToWorld(this.pB);
      r.root.worldToLocal(this.pB);
      const w = this.clutchW * this.clutchW * (3 - 2 * this.clutchW);
      this.gripLDyn.position.lerpVectors(r.gripL.position, this.pB, w);
      this.qB.setFromEuler(CLUTCH_TURN).premultiply(r.gripL.quaternion);
      this.gripLDyn.quaternion.slerpQuaternions(r.gripL.quaternion, this.qB, w);
      this.gripLDyn.userData.thumb = w < 0.4 ? r.gripL.userData.thumb : undefined;
      lerpPose(r.poseL ?? POSES.pistolL!, POSES.magL!, w, this.poseLDyn);
    }

    // Smoke in the world and the crown's heat glow (S2.3).
    this.heat.update(dt);
    if (this.smoke.glow.parent !== r.root) r.root.add(this.smoke.glow);
    this.smoke.glow.position.copy(r.muzzle.position);
    this.smoke.glow.position.z += 0.007;
    this.smoke.tint(this.ambTint, this.ambLevel);
    this.smoke.update(dt, this.heat.glow);
  }

  /** The world camera's FOV this frame (zoom when aiming). */
  worldFov = 75;

  /** Scope magnification steps: multipliers on the scope's FOV (wider to tighter). */
  static readonly ZOOMS = [1.6, 1, 0.55] as const;
  /** Current scope step; the wheel moves it while scoped in. */
  zoom = 1;

  /** Steps the scope zoom by dir (+1 tighter, -1 wider); returns whether it changed. */
  stepZoom(dir: number): boolean {
    const z = Math.max(0, Math.min(Arsenal.ZOOMS.length - 1, this.zoom + Math.sign(dir)));
    const changed = z !== this.zoom;
    this.zoom = z;
    return changed;
  }

  get scopedIn(): boolean {
    return !!this.rig.scoped && this.anim.aim > 0.85;
  }
}
