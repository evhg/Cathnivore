// One play session: builds the world, puts Cath in it and runs the frame loop that ties everything
// together: input, movement, weapons, combat, enemies, stealth, the kill-cam, bullet-time, XP and the HUD.

import { openPhotoMode } from "../ui/photomode";
import { calmCameraOn, damageFxLevels, loadPrefs } from "../prefs";
import * as THREE from "three";
import { beamLook, setBeaconProfile } from "./beacon";
import { LASER_COOLDOWN, LASER_DAMAGE, laserState, laserTouches, lasersFrom } from "./lasers";
import { createWorld } from "../render/world";
import type { Quality, World } from "../render/types";
import { Input } from "./input";
import { Player } from "./player";
import { CIVILIAN, ENFORCER, ENFORCER_SNIPER, Enemy, NURSE, NURSE_HEAL, NURSE_RANGE, ORDERLY, TURRET, HUNTER, POLICE_DRONE, RIOT_SHIELD, BOARD_GUARD, type EnemyKit, type Sight } from "./enemy";
import { deathGlowScale } from "./body";
import { RayWorld, rayGround } from "./ray";
import { KESTREL_DOT } from "./kestrel";
import { Arsenal } from "./weapons";
import { Combat, type Build, type KillEvent } from "./combat";
import { Timescale } from "./feel/timescale";
import { coverWireframe } from "./coverdebug";
import { Trauma } from "./feel/trauma";
import { Spring1 } from "./feel/spring";
import { impulseForPeak } from "./feel/pistol";
import { Vitals, VITALS } from "../sim/vitals";
import { HeartClock, LensBlood, PhaseMap, breath, heartBpm, muffleHz, wobble, WOUND } from "../sim/woundloop";
import { setGloveBlood } from "./gunkit";
import { VITALS_TAKEN } from "../sim/fightsim";
import type { HurtKind } from "../ui/dmgring";
import { tuning } from "./feel/tuning";
import { DroppedMags } from "./dropmag";
import { REFL_DIRS } from "./gunsound";
import { AUTOMATIC, confirmSound, hitClass, hitStopMs, type HitEvent } from "../sim/hitevent";
import { reduceMotionOn } from "../prefs";
import { KillCam } from "./killcam";
import { Hud, type HudState } from "../ui/hud";
import { Audio } from "./audio";
import { CLASS_WEAPON, Progress } from "./progress";
import { Pickups, gunDrop } from "./pickups";
import type { Item } from "../sim/loot";
import { FirstJob, TAKEDOWN_POSE, TAKE_RANGE } from "./firstjob";
import { codesFor, keyLabel } from "../controls";
import { CrispJob } from "./crispjob";
import { QuayJob } from "./quayjob";
import { ManifestJob } from "./manifestjob";
import { CrispBossJob } from "./crispboss";
import { VaneBossJob } from "./vaneboss";
import { VaneLeadJob } from "./vanelead";
import { PellLeadJob } from "./pelllead";
import { PellBossJob } from "./pellboss";
import { BoardLeadJob } from "./boardlead";
import { VaultLeadJob } from "./vaultlead";
import { BoardBossJob } from "./boardboss";
import { VaultBossJob } from "./vaultboss";
import { SideContractJob } from "./sidejob";
import { Secrets, found as secretsFound, SECRETS } from "./secrets";
import { MostWantedJob } from "./mostwantedjob";
import { mostWanted, weekKey } from "../sim/mostwanted";
import { openCaseBoard } from "../ui/caseboard";
import { openDistrictMap } from "../ui/districtmap";
import { SLICE_WEAPONS } from "./weapons";
import { WEAPON_BASES } from "../sim/weapons";
import { ngPlusEliteBonus, ngPlusLap } from "../sim/newgameplus";
import { ELITE_CHANCE } from "../sim/enemies";
import { DIFFICULTY_LABEL, unlockedDifficulties } from "../sim/difficulty";
import type { Difficulty } from "../sim/types";
import { Voice } from "./voice";
import { nearLandmark } from "./landmarks";
import { WingWatch, ZoneWatch, loadingTitle } from "./zones";
import { Actives } from "./actives";
import { openCharacter } from "../ui/character";
import { exportCode, makeSave } from "../sim/save";
import { levelUpToast } from "../ui/levelup";
import { xpForLevel, xpToNext as simXpToNext } from "../sim/stats";
import { AutoScale } from "./autoscale";
import { DeathCam, GunDrop, deathState, resyncState } from "./death-cam";
import { DeathScreen } from "../ui/deathcard";
import { deathLine, type DeathCause } from "./voice";

export interface SessionOptions {
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  touch: HTMLElement;
  quality: Quality;
  intensity: "full" | "reduced";
  shot: boolean;
  /** District id (render/levels); default the Drowned Market. */
  district?: string;
  onProgress: (share: number, label: string) => void;
  onExit: () => void;
  /** C8: a restart from the checkpoint inside the same page (the world, audio and window.cathode carried over). */
  warm?: WarmStart;
}

/** What a restart carries into the next session (S6.6 "Retry without a page reload"). */
export interface WarmStart {
  world: World;
  audio: Audio | null;
  /** The session object to rebuild in place (window.cathode keeps its identity). */
  into: Session;
  /** The death screen, still black, which the new session fades out of. */
  screen: DeathScreen;
  /** The world as built, before any session added to it. */
  baseline: WorldBaseline;
  deaths: number;
  /** The re-sync's clock (ms) when the new session takes over, and the line it shows. */
  resyncAt: number;
  resyncLine: string;
  t0: number;
}

/** The world as createWorld left it: a restart takes away everything a session added since. */
interface WorldBaseline {
  scene: Set<THREE.Object3D>;
  view: Set<THREE.Object3D>;
  colliders: THREE.Box3[];
  cover: { mats: number; obbs: number; thin: number } | null;
}

export interface Session {
  world: World;
  player: Player;
  input: Input;
  enemies: Enemy[];
  rays: RayWorld;
  arsenal: Arsenal;
  combat: Combat;
  killcam: KillCam;
  /** Cath's health. */
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  /** Bullet-time battery, seconds. */
  focus: number;
  progress: Progress;
  /** The first job's script, while it runs (tests read its stage). */
  job?: FirstJob | null;
  /** Frames rendered and a rolling frame time, for ?perf and tests. */
  stats: { frames: number; ms: number; combatMs?: number; particles?: number; lastRestartMs?: number };
  /** Test hook: freeze the AI and the clock. */
  paused: boolean;
  /** Test and screenshot hook: the HUD (subtitles, feed lines, banners). */
  hud?: Hud;
  /**
   * Screenshot hook (S0): builds a combat moment and freezes it `tMs` after the event. Stages: hit-body,
   * hit-head, hit-kill, hit-headkill, hit-soft, hit-pen, hit-armourbreak, blocked (a guard behind a steel
   * crate), peek-head (his head over it), cover-debug-market.
   */
  stage?: (name: string, tMs?: number) => string;
  /**
   * What the last stage did, in CSS px (C2 acceptance): where the round landed on screen, how many px 0.2 m
   * spans there, and the guard's head on screen at the shot and at the stage's moment.
   */
  stageInfo?: {
    hit: { x: number; y: number };
    r02: number;
    head0: { x: number; y: number };
    head1: { x: number; y: number };
    puffM: number;
    splats: { x: number; y: number; r: number }[];
    corpse: { pelvis: { x: number; y: number }; head: { x: number; y: number }; chest: { x: number; y: number } };
    /** C3: the first gun's case on screen (CSS px), and whether it is in front of the camera. */
    caseAt?: { x: number; y: number; front: boolean };
    beam?: { x0: number; y0: number; x1: number; y1: number; r: number };
  } | null;
  /** C5: the Kestrel at the stage's moment (part travel, rounds shown, the muzzle and slide on screen). */
  pistolInfo?: Record<string, unknown> | null;
  /** C4: the hands' share of viewmodel pixels and the slide's mean luminance (0..1) in the shown frame. */
  vmProbe?: (rects?: { x: number; y: number; w: number; h: number }[]) => { handShare: number; slideLum: number; vmPx: number; slidePx: number; inRects: number[] };
  /** C4: the red dot's projection and the screen centre (CSS px), and the aim blend, as the frame shows them. */
  dotProbe?: () => { x: number; y: number; cx: number; cy: number; aim: number } | null;
  /** C6: the red-dot optic's screen box (CSS px; hood, base and emitter, with the rear sight behind it), or null. */
  opticProbe?: () => { x: number; y: number; w: number; h: number } | null;
  /** Renders a frame and counts red-dominant pixels within `r` CSS px of (x, y) (the C2 blood probe). */
  probeRed?: (x: number, y: number, r: number, inner?: number) => { red: number; total: number; mean: number[] };
  /** Test hooks (S1.3 spy): the session's audio, and Cath's hurt path (hurt arc plus her hurt sound). */
  audio?: Audio | null;
  cathHurt?: (bearing: number, melee: boolean, amount?: number) => void;
  /** C7 acceptance: the frame's histogram and the edge-to-centre saturation, now and with the wound grade off. */
  probeWound?: () => { hist: number[]; now: { centre: number; edge: number }; fine: { centre: number; edge: number }; lens: number; glove: number; w: number; pulse: number };
  /** C8 acceptance: blood-red pixels in the rendered frame (hue 350..10, saturation > 0.6, value > 0.25). */
  probeBloodRed?: () => { red: number; total: number };
  /** C7: a stim's screen and sound (the wash, the slower heart, the lens wiped), as the Stim skill plays them. */
  stim?: () => void;
  /** C7 acceptance: the grade pass's mean ms with the Vitals pass idle and at its busiest. */
  benchGrade?: (n: number, rounds?: number) => { off: number; on: number; spread: [number, number]; rounds: number };
  /** Drops the session's window and document listeners (C8 restarts a session without a page reload). */
  dispose?: () => void;
  /**
   * C8 (S6.6): Retry. Takes the session down (bodies, decals, particles, pickups, the job's props and lights) and
   * rebuilds it from the saved checkpoint in the same world, audio and `window.cathode` object, as a fresh resume
   * would, with `deaths` one higher. Resolves when control is back.
   */
  restartFromCheckpoint?: () => Promise<void>;
  /** C8: deaths this visit (a restart counts one). */
  deaths?: number;
  /** C8: the death sequence while it runs (ms since the blow, and whether the card is up), else null. */
  dying?: { ms: number; card: boolean; killer: string | null; gun?: number[] | null } | null;
  /** C6 (S6.1): Guard and Flesh. `hp` mirrors their total; writing `hp` from outside still works. */
  vitals?: Vitals;
  /** C6: a hit on Cath of `amount` from a world point (null: straight ahead), with every readout. */
  hurtCath?: (amount: number, from: { x: number; y: number; z: number } | null, kind?: HurtKind) => void;
  /** Debug: what a round from `from` to `to` would do with the gun in hand. */
  traceShot?: (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }) => ReturnType<Combat["traceShot"]>;
}

declare global {
  interface Window {
    cathode?: Session;
  }
}


const BASE_FOV = 75;

/** How hard enemy rounds hit Cath by difficulty (Noir is the story setting). */
/** Damage she takes per difficulty, fitted to the Guard/Flesh model so time-to-death holds (sim/fightsim.ts). */
const DAMAGE_TAKEN: Record<string, number> = VITALS_TAKEN;
/** Seconds at the start of a job before anyone can spot her. */
const GRACE = 12;


/** Board Security is tougher than the archetype it borrows (hp x1.3, plating +0.1) and keeps its own name and bash. */
const guarded = (k: EnemyKit, base: EnemyKit): EnemyKit =>
  base.bash ? { ...k, name: base.name, bash: true, maxHp: Math.round(k.maxHp * 1.3), armour: Math.min(0.7, k.armour + 0.1), visor: base.visor } : k;
export async function startSession(o: SessionOptions): Promise<Session> {
  const inClinic = o.district === "clinic";
  const inPlaza = o.district === "plaza";
  const inTower = o.district === "tower";
  const inVault = o.district === "vault";
  const inMarket = !inClinic && !inPlaza && !inTower && !inVault;
  // Every window and document listener the session adds goes on this signal, so dispose() takes them all back.
  const life = new AbortController();
  const lifeOpt = { signal: life.signal };
  const world = o.warm?.world ?? (await createWorld(o.canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot, district: o.district }, o.onProgress));
  // C8: what the world holds before this session adds anything, so a restart can take the session back out.
  const baseline: WorldBaseline = o.warm?.baseline ?? {
    scene: new Set(world.scene.children),
    view: new Set(world.viewScene.children),
    colliders: world.colliders.slice(),
    cover: world.cover ? { mats: world.cover.mats.length, obbs: world.cover.obbs.length, thin: world.cover.thin.length } : null,
  };
  // Every light a job asks for is handed back on a restart.
  const leasedLights: Array<() => void> = [];
  const worldLight = world.light
    ? (p: THREE.Vector3, c: THREE.Color, i: number, r: number) => {
        const rm = world.light!(p, c, i, r);
        leasedLights.push(rm);
        return rm;
      }
    : undefined;
  // The phone's lifted grade (exposure 1.7) washes a dim red out, so the kill's glow runs a little brighter there.
  // It no longer has to fight the fog (the glow takes its fog back off, body.ts), and at 2.6x the tone map turned
  // it salmon: 1.5x stays a saturated dark red.
  deathGlowScale.value = o.quality === "phone" ? 1.5 : 1;
  setBeaconProfile(o.quality === "phone" ? "phone" : "desktop");
  const start = world.markers.player?.[0] ?? new THREE.Vector3();
  const ground = (x: number, z: number) => world.groundHeight(x, z);
  const player = new Player(start, world.colliders, ground);
  const input = new Input(o.canvas, o.touch);
  const syncInput = () => {
    const p = loadPrefs();
    input.holdToggle = p.holdToggle;
    input.lookScale = p.lookScale;
    input.invertY = p.invertY;
    input.binds = p.binds;
  };
  syncInput();
  window.addEventListener("cathode:prefs", syncInput, lifeOpt);
  const rays = new RayWorld(world.colliders, world.cover);
  const progress = new Progress();
  const areaLevel = Math.max(1, progress.character.level);
  const enemies: Enemy[] = [];
  let seed = 1;
  // The first job teaches the game one thing at a time and brings its own enemies; after that the street
  // is fully patrolled.
  // Screenshots skip the first job unless they ask for it (?shot&job).
  const tutorial = !progress.jobsDone.includes("fishMarket") && (!o.shot || new URLSearchParams(location.search).has("job"));
  const KITS = {
    rifle: [ENFORCER, "enforcer"],
    shield: [RIOT_SHIELD, "riotShield"],
    sniper: [ENFORCER_SNIPER, "enforcerSniper"],
  } as const;
  const spawn = (role: "rifle" | "shield" | "sniper", route: THREE.Vector3[], opts: { yaw?: number; passive?: boolean } = {}): Enemy => {
    const [base, archetype]: readonly [EnemyKit, string] = inTower && role === "shield" ? [BOARD_GUARD, "riotShield"] : KITS[role];
    const e = new Enemy({ ...guarded(Progress.kit(base, archetype, areaLevel, seed++), base), role: base.role }, route.map((p) => p.clone()), areaLevel);
    if (opts.yaw !== undefined) e.motion.yaw = opts.yaw;
    e.passive = !!opts.passive;
    world.scene.add(e.body.root);
    enemies.push(e);
    return e;
  };
  if (!tutorial) {
    for (const [key, route] of Object.entries(world.markers)) {
      if (!key.startsWith("patrol:") || !route.length) continue;
      // The route's name picks the role: "...sniper..." on a rooftop, "...shield..." for a riot team, and every
      // fourth patrol carries a shield anyway.
      const n = enemies.length;
      const civ = key.includes("civ");
      const [base, archetype] = civ
        ? [CIVILIAN, "candorChrome"]
        : key.includes("turret")
        ? [TURRET, "enforcer"]
        : key.includes("police")
        ? [POLICE_DRONE, "candorChrome"]
        : key.includes("hunter")
        ? [HUNTER, "candorChrome"]
        : key.includes("nurse")
        ? [NURSE, "candorChrome"]
        : key.includes("orderly")
        ? [ORDERLY, "candorChrome"]
        : key.includes("sniper")
        ? [ENFORCER_SNIPER, "enforcerSniper"]
        : key.includes("shield") || n % 4 === 3
          ? [inTower ? BOARD_GUARD : RIOT_SHIELD, "riotShield"]
          : [ENFORCER, "enforcer"];
      const elite = Math.random() < ELITE_CHANCE[progress.character.difficulty] + ngPlusEliteBonus(ngPlusLap(progress.jobsDone));
      const e = new Enemy({ ...guarded(Progress.kit(base, archetype, areaLevel, seed++, elite), base), role: base.role }, route.map((p) => p.clone()), areaLevel);
      if (civ) {
        e.passive = true;
        e.kit.maxHp = e.hp = CIVILIAN.maxHp;
        e.kit.name = CIVILIAN.name;
        e.kit.xp = 0;
        e.kit.damage = 0;
      }
      world.scene.add(e.body.root);
      enemies.push(e);
    }
    // A Hollowell sniper holds the far perch: take him first, or cross the street under his laser.
    const far = world.markers.perch?.[1];
    if (far) {
      const e = new Enemy({ ...Progress.kit(ENFORCER_SNIPER, "enforcerSniper", areaLevel, seed++), role: "sniper" }, [far.clone()], areaLevel);
      world.scene.add(e.body.root);
      enemies.push(e);
    }
  }
  const arsenal = new Arsenal(world.viewScene, o.quality === "phone");
  // Each class walks in holding its own weapon: the Ghost the rifle, the Butcher the shotgun.
  const cls = progress.character.classes[0];
  arsenal.owned.clear();
  for (const id of progress.unlocks.weapons) arsenal.owned.add(id);
  // In hand: her class weapon if she has it, else the Kestrel, else the Pin.
  const classGun = CLASS_WEAPON[cls!] ?? "kestrel";
  arsenal.equipId(arsenal.owned.has(classGun) ? classGun : arsenal.owned.has("kestrel") ? "kestrel" : "pin");
  // The gun reflects its own small neon room (S2.1), so it never goes black in a dark alley.
  arsenal.lightRoom(world.renderer);
  const combat = new Combat(world, rays, enemies, o.intensity === "full");
  const killcam = new KillCam(world);
  const hud = new Hud(o.hud);
  // The case note's eyebrow: the district the job is in ("Case · The Drowned Market").
  const caseName = loadingTitle(o.district).split(" · ").pop() ?? "";
  let audio: Audio | null = o.warm ? o.warm.audio : null;
  if (!o.warm) {
    try {
      audio = new Audio(inVault ? "vault" : inTower ? "tower" : inPlaza ? "plaza" : inClinic ? "clinic" : "market");
    } catch {
      // No WebAudio: play on in silence.
    }
  }
  // Lightning: its thunder rolls in after the flash, and covers a gunshot for a couple of seconds.
  let thunderCover = 0;
  let worldOff: (() => void) | null = null;
  if (world.on && audio) {
    audio.externalThunder = true;
    worldOff = world.on((ev) => {
      if (ev.type === "thunder") {
        setTimeout(() => audio?.thunder(), Math.max(0, ev.delay) * 1000);
        thunderCover = 2 + Math.max(0, ev.delay);
      } else if (ev.type === "casing") {
        // Panned to where it landed (the camera's right), quieter the further it is.
        const cam = world.camera;
        const rel = ev.pos.clone().sub(cam.getWorldPosition(new THREE.Vector3()));
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const d = rel.length();
        audio?.casing(THREE.MathUtils.clamp(rel.normalize().dot(right), -1, 1), d);
      }
    });
  }
  if (audio) audio.volume = loadPrefs().volume;
  // S2.5: the shorter, brighter tail inside (the clinic, the tower, the vault).
  if (audio) audio.gun.indoor = inClinic || inTower || inVault;
  const wake = () => audio?.resume();
  // iOS counts touchend and click as gestures that may start audio, not pointerdown.
  for (const ev of ["pointerdown", "touchend", "click", "keydown"]) addEventListener(ev, wake, { capture: true, signal: life.signal });
  document.addEventListener("visibilitychange", () => audio?.suspend(document.hidden), lifeOpt);
  const fresh: Session = {
    world,
    player,
    input,
    enemies,
    rays,
    arsenal,
    combat,
    killcam,
    hp: progress.stats.maxHealth,
    maxHp: progress.stats.maxHealth,
    level: progress.character.level,
    xp: progress.character.xp,
    focus: progress.stats.bulletTimeSeconds,
    progress,
    stats: { frames: 0, ms: 16 },
    paused: false,
  };
  // A restart rebuilds the same object, so window.cathode (and anything holding it) stays the one session.
  const s: Session = o.warm ? Object.assign(o.warm.into, fresh) : fresh;
  if (o.warm) for (const k of Object.keys(s) as Array<keyof Session>) if (!(k in fresh)) delete s[k];
  s.deaths = o.warm?.deaths ?? 0;
  s.dying = null;
  window.cathode = s;
  s.hud = hud;
  // Face down the street from the start marker, towards the extraction point.
  const ex = world.markers.extract?.[0];
  if (o.district === "clinic") player.yaw = 0;
  else if (o.district === "plaza" || o.district === "tower" || o.district === "vault") player.yaw = 0;
  else if (ex) player.yaw = Math.atan2(-(ex.x - start.x), -(ex.z - start.z));

  const build = (): Build => progress.build();

  let objective = inVault
    ? "The debt-book index is in the clerk's cage, west of the gate hall."
    : inTower
    ? "A courier's keycard is in the lobby safe, east of the marble desk."
    : inPlaza
    ? "Councillor Pell's permit strongbox is under the market awnings, west side of the square."
    : inClinic
    ? "Find Dr Vane. Her theatre is at the north end of the clinic."
    : "Get to the fish market. Somebody there knows who put Tomas in the water.";
  if (inVault) hud.showBanner("The Hollow Vault", "Act 5 · 04:50");
  else if (inTower) hud.showBanner("The Board Tower", "Act 4 · 03:30");
  else if (inPlaza) hud.showBanner("Hollowell Plaza", "Act 3 · 00:00");
  else if (inClinic) hud.showBanner("The Candor Clinic", "Act 2 · 02:10");
  else hud.showBanner("The Fish Market", "The Drowned Market · 23:40");
  const zones = new ZoneWatch();
  const wings = new WingWatch();
  const voice = new Voice((t) => hud.subtitle(t));
  /** Puts a weapon in her hands for good: owned from now on. */
  const arm = (id: string) => {
    const isNew = progress.grantWeapon(id);
    arsenal.owned.add(id);
    // S2.4: the first time she takes the Kestrel, the 900 ms hero draw with its rack.
    if (isNew && id === "kestrel") arsenal.heroNext = true;
    arsenal.equipId(id);
    const def = SLICE_WEAPONS.find((w) => w.id === id);
    // In the first job the toast announces it (S7.1); a feed line on top would say it twice.
    if (isNew && def && !tutorial) hud.feedLine(`New weapon: ${def.name}`, true);
  };
  const job = tutorial
    ? new FirstJob({
        player,
        progress,
        scene: world.scene,
        markers: world.markers,
        ground,
        touch: input.isTouch,
        spawn,
        arm,
        say: (t) => hud.subtitle(t),
        teach: (t) => hud.teach(t),
        banner: (a, b, k) => hud.showBanner(a, b, k),
        light: worldLight,
        view: () => ({ cam: world.camera, w: innerWidth, h: innerHeight, scale: hudScale }),
        block: (box) => {
          world.colliders.push(box);
          const shot = rays.add(box, "wood");
          return () => {
            const i = world.colliders.indexOf(box);
            if (i >= 0) world.colliders.splice(i, 1);
            shot.off = true;
          };
        },
        toast: (kind, name) => {
          hud.toast(kind, name, "Checkpoint saved");
          audio?.newWeapon();
        },
      })
    : null;
  // The second job, Crisp's ledger, picks up once the Fish Market is closed.
  const crisp =
    !tutorial && progress.jobsDone.includes("fishMarket") && !progress.jobsDone.includes("crispLead") && !o.shot
      ? new CrispJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const quay =
    !tutorial && progress.jobsDone.includes("crispLead") && !progress.jobsDone.includes("quayContracts") && !o.shot
      ? new QuayJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const manifest =
    !tutorial && progress.jobsDone.includes("quayContracts") && !progress.jobsDone.includes("candorManifest") && !o.shot
      ? new ManifestJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const crispBoss =
    !tutorial && progress.jobsDone.includes("candorManifest") && !progress.jobsDone.includes("crispBoss") && !o.shot
      ? new CrispBossJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const vaneLead =
    !tutorial && (inClinic || progress.jobsDone.includes("crispBoss")) && !progress.jobsDone.includes("vaneLead") && !o.shot
      ? new VaneLeadJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  // Vane's boss fight starts once the register is taken (in the clinic, right after the lead job).
  const makeVaneBoss = (): VaneBossJob | null =>
    !tutorial && progress.jobsDone.includes("vaneLead") && !progress.jobsDone.includes("vaneBoss") && !o.shot
      ? new VaneBossJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  let vaneBoss = makeVaneBoss();
  const pellLead =
    !tutorial && (inPlaza || progress.jobsDone.includes("vaneBoss")) && !progress.jobsDone.includes("pellLead") && !o.shot
      ? new PellLeadJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const makePellBoss = (): PellBossJob | null =>
    !tutorial && progress.jobsDone.includes("pellLead") && !progress.jobsDone.includes("pellBoss") && !o.shot
      ? new PellBossJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  let pellBoss = makePellBoss();
  const boardLead =
    !tutorial && (inTower || progress.jobsDone.includes("pellBoss")) && !progress.jobsDone.includes("boardLead") && !o.shot
      ? new BoardLeadJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const makeBoardBoss = (): BoardBossJob | null =>
    !tutorial && progress.jobsDone.includes("boardLead") && !progress.jobsDone.includes("boardBoss") && !o.shot
      ? new BoardBossJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  let boardBoss = makeBoardBoss();
  const vaultLead =
    !tutorial && (inVault || progress.jobsDone.includes("boardBoss")) && !progress.jobsDone.includes("vaultLead") && !o.shot
      ? new VaultLeadJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  const makeVaultBoss = (): VaultBossJob | null =>
    !tutorial && progress.jobsDone.includes("vaultLead") && !progress.jobsDone.includes("vaultBoss") && !o.shot
      ? new VaultBossJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          finale: () => hud.showCredits(() => location.assign(location.pathname)),
          light: worldLight,
        })
      : null;
  let vaultBoss = makeVaultBoss();
  const wantedWeek = weekKey(new Date());
  const wanted =
    !tutorial && progress.jobsDone.includes("hardboiledOpen") && progress.character.difficulty !== "noir" && !progress.jobsDone.includes(`mostWanted:${wantedWeek}`) && !o.shot
      ? new MostWantedJob(
        {
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
          drop: (p, n) => {
            for (let i = 0; i < n; i++) {
              const at = p.clone().add(new THREE.Vector3((i - (n - 1) / 2) * 0.9, 0, 0.6));
              at.y = world.groundHeight(at.x, at.z);
              pickups.drop(at, progress.rollLoot(areaLevel, true));
            }
          },
        },
        mostWanted(wantedWeek),
      )
      : null;
  const side =
    !tutorial && progress.jobsDone.includes("vaultBoss") && !wanted && !o.shot
      ? new SideContractJob({
          player,
          progress,
          scene: world.scene,
          markers: world.markers,
          ground,
          touch: input.isTouch,
          spawn,
          arm,
          say: (t) => hud.subtitle(t),
          teach: (t) => hud.teach(t),
          banner: (a, b, k) => hud.showBanner(a, b, k),
          light: worldLight,
        })
      : null;
  s.job = job;
  // The HUD-size setting (S8), for the glint's on-screen size floor.
  let hudScale = loadPrefs().hudScale;
  // The take key is the takedown key (F unless rebound): one interact button, never Q/E (lean).
  const takeKeyNow = () => keyLabel(codesFor(loadPrefs().binds, "takedown")[0] ?? "KeyF");
  let takeKey = takeKeyNow();
  window.addEventListener(
    "cathode:prefs",
    () => {
      hudScale = loadPrefs().hudScale;
      takeKey = takeKeyNow();
    },
    lifeOpt,
  );
  // S7.1 layer 7: Cath's nudge the first time the first gun is on screen within 12 m, and a one-time look assist
  // (up to 10 degrees of yaw over 600 ms) if the mouse is idle. Never forced: any look input cancels it.
  let nudged = false;
  let lookIdle = 0;
  let assist: { left: number; rate: number } | null = null;
  let promptShown = false;
  // A tap on the prompt (touch) is the same press.
  hud.onTake = () => (input.forced.takedown = true);
  const actives = new Actives();
  actives.assign(progress.character);
  actives.battery = progress.stats.battery;
  setTimeout(() => voice.say(inVault ? "startVault" : inTower ? "startTower" : inPlaza ? "startPlaza" : inClinic ? "startClinic" : "start"), 2600);

  // Dynamic resolution holds the frame rate; off in screenshot and automated runs, where frames are always slow.
  const auto = new AutoScale({ min: 0.6, max: 1, target: 1000 / 60, rescueMin: 0.4 });
  const autoOn = !o.shot && !navigator.webdriver;
  const renderScaleParam = Math.max(0.25, Math.min(1, Number(new URLSearchParams(location.search).get("rs") ?? 1) || 1));
  const ambColor = new THREE.Color();
  const resize = () => {
    // Phones: 1.5x keeps them cool. 5K desktops cap the 3D at 1.5x (the DOM HUD stays at native DPR, S8).
    const cap = input.isTouch ? 1.5 : innerHeight * devicePixelRatio > 2000 ? 1.5 : o.quality === "ultra" ? 3 : 2;
    const dpr = Math.min(devicePixelRatio, cap);
    // ?rs=0.5 forces the 3D render scale (5K screenshot runs under SwiftShader); it scales the world only.
    // Cath's hands and gun, and the post chain (HDR target, bloom, grade), render at `post` x the DPR, the world
    // at `scale` x the DPR (C4). Dynamic resolution and thermal rescue (auto.scale) scale BOTH: at rest a phone's
    // post runs at 0.9 (1.35x, the viewmodel crisp), and under rescue it falls with the world, so the fill-rate
    // lever still works (C4 review: post had been pinned at the full 1.5x, ~10x the pixels under rescue).
    const post = (o.quality === "phone" ? 0.9 : 1) * auto.scale;
    const scale = (o.quality === "phone" ? 0.8 : 1) * auto.scale * renderScaleParam;
    world.resize(o.canvas.clientWidth, o.canvas.clientHeight, dpr * post, Math.min(1, scale / post));
  };
  addEventListener("resize", resize, lifeOpt);
  resize();

  const levelUp = (levels: number[]) => {
    for (const l of levels) {
      s.maxHp = progress.stats.maxHealth;
      s.hp = s.maxHp;
      void levelUpToast(o.hud.parentElement ?? o.hud, l, { attributes: 5, skills: 1 });
      voice.say("levelUp");
      audio?.levelUp();
    }
    s.level = progress.character.level;
  };

  const pickups = new Pickups(world.scene);
  const secrets = new Secrets(progress.jobsDone, ground, world.scene);
  const collect = (drop: { items: Item[]; scrip: number; gun?: string }) => {
    progress.take(drop);
    if (drop.scrip) hud.feedLine(`+${drop.scrip} Scrip`);
    if (drop.gun) {
      const gdef = SLICE_WEAPONS.find((w) => w.id === drop.gun);
      if (gdef && arsenal.owned.has(gdef.id)) {
        const n = arsenal.giveAmmo(gdef.id);
        hud.feedLine(n ? `+${n} rounds (${gdef.name})` : `${gdef.name}: ammo full`);
      } else if (gdef && (!job || job.done)) {
        progress.grantWeapon(gdef.id);
        arsenal.owned.add(gdef.id);
        hud.feedLine(`New weapon: ${gdef.name} (scroll or Swap)`, true);
      }
    }
    for (const it of drop.items) {
      hud.feedItem(it.name, it.rarity);
      // After the first job, a weapon of a kind she hasn't carried yet joins her kit: one new toy at a time.
      if (it.kind === "weapon" && (!job || job.done)) {
        const cls = WEAPON_BASES[it.base]?.cls;
        const fresh = SLICE_WEAPONS.find((w) => w.weaponClass === cls && !arsenal.owned.has(w.id));
        if (fresh) {
          progress.grantWeapon(fresh.id);
          arsenal.owned.add(fresh.id);
          hud.feedLine(`New weapon: ${fresh.name} (scroll or Swap)`, true);
        }
      }
    }
  };

  let bystanders = 0;
  const onKill = (k: KillEvent) => {
    actives.onKill();
    if (k.enemy.kit.role === "civilian") {
      // No XP, no loot, and the square knows: every guard turns to where she stands.
      bystanders++;
      hud.feedLine(`Bystander down (${bystanders}). The guards heard.`, true);
      if (bystanders === 1) hud.subtitle("Bea: That was a civilian, Cath. Pell will say you did it for him.");
      for (const e of enemies) if (e.kit.role !== "civilian") e.alert(player.pos);
      return;
    }
    const bits: string[] = [];
    let bonus = 1;
    if (k.takedown) bits.push("Takedown");
    if (k.headshot) {
      bits.push("Headshot");
      bonus *= 1.25;
    }
    if (k.distance > 40) {
      bits.push(`${Math.round(k.distance)} m`);
      bonus *= 1.2;
    }
    if (k.severed.length) bits.push(k.severed.includes("head") ? "Decapitated" : "Dismembered");
    if (k.unseen) bits.push("Unseen");
    if (k.headshot && k.distance > 25) voice.say("headshot");
    else if (k.unseen) voice.say("unseenKill");
    levelUp(progress.kill(k.enemy.kit.xp, k.enemy.level, k.unseen, bonus));
    const xp = progress.lastXp;
    hud.feedLine(`+${xp} XP${bits.length ? " · " + bits.join(" · ") : ""}`, k.headshot || k.unseen);
    const found = progress.rollLoot(k.enemy.level, !!k.enemy.kit.elite);
    if (!k.takedown) found.gun = gunDrop(k.enemy.kit.role, Math.random());
    const at = k.enemy.position.clone();
    at.y = world.groundHeight(at.x, at.z);
    pickups.drop(at, found);
    const ammo = arsenal.scavenge();
    if (ammo) hud.feedLine(`+${ammo} rounds`);
    // Kills by a round confirm through the hit (drainEvents); takedowns and blasts confirm here.
    if (k.takedown || k.weapon.id === "frag" || k.weapon.blast) {
      hud.hitMarker(k.headshot ? "headKill" : "kill");
      audio?.confirm(k.headshot ? "headKill" : "kill");
      killConfirm(k.headshot ? tuning.hitStop.headKill : k.takedown ? tuning.hitStop.takedown : tuning.hitStop.kill, false);
    }
    // Volatile elites blow up where they fall (applied next frame, outside the kill loop).
    if (k.enemy.kit.mods?.includes("explosiveOnDeath")) {
      deathBlasts.push({ pos: k.enemy.body.joints.chest.clone(), radius: 4, damage: Math.round(k.enemy.kit.maxHp * 0.4) });
      hud.feedLine("Volatile: it goes up", true);
    }
  };
  const deathBlasts: { pos: THREE.Vector3; radius: number; damage: number }[] = [];

  let last = performance.now();
  let time = 0;
  // ?perf: a frame-time panel with real GPU timings (stats-gl), for checking the game on a phone.
  let perfPanel: { update(): void } | null = null;
  let perfScale: HTMLElement | null = null;
  if (new URLSearchParams(location.search).has("perf")) {
    perfScale = document.createElement("div");
    perfScale.className = "perf-scale";
    (o.hud.parentElement ?? o.hud).append(perfScale);
    void import("stats-gl").then(({ default: Stats }) => {
      const st = new Stats({ trackGPU: true, horizontal: true, minimal: false });
      void st.init(world.renderer);
      st.domElement.classList.add("perf-panel");
      (o.hud.parentElement ?? o.hud).append(st.domElement);
      perfPanel = st;
    });
  }
  let wasFire = false;
  const safe = player.pos.clone();
  let safeT = 0;
  let grace = o.shot ? 0 : GRACE;
  /** A screenshot stage has run (S0): the moment is held, so nobody shoots into it. */
  let staged = false;
  // First time on a touch screen: how the controls work, before anything can shoot at her.
  let coaching = false;
  let boardShown = false;
  if (input.isTouch && !o.shot && !navigator.webdriver) {
    let seen = false;
    try {
      seen = localStorage.getItem("cathode:coach") === "1";
    } catch {
      // No storage: show it every time.
    }
    if (!seen) {
      coaching = true;
      const c = document.createElement("div");
      c.className = "coach";
      const card = document.createElement("div");
      card.className = "coach-card";
      const h = document.createElement("h2");
      h.textContent = "How to play on a phone";
      const ol = document.createElement("ol");
      for (const [b, t] of [
        ["Left thumb:", " drag anywhere on the left to move. Push to the edge to run."],
        ["Right thumb:", " drag anywhere on the right to look and aim."],
        ["Fire:", " the red button. Aim help pulls you onto targets, and once they're shooting at you, Cath fires on her own."],
        ["Crouch", " to sneak, and get behind someone for a silent Takedown."],
      ]) {
        const li = document.createElement("li");
        const bb = document.createElement("b");
        bb.textContent = b!;
        li.append(bb, t!);
        ol.append(li);
      }
      const go = document.createElement("button");
      go.type = "button";
      go.className = "btn btn-primary";
      go.textContent = "Got it";
      go.addEventListener("click", () => {
        coaching = false;
        c.remove();
        try {
          localStorage.setItem("cathode:coach", "1");
        } catch {
          // Fine: it'll show again next time.
        }
      });
      card.append(h, ol, go);
      c.append(card);
      (o.hud.parentElement ?? o.hud).append(c);
    }
  }
  // Laser grids from `laser:*` level markers: a red curtain per pair, drawn here and checked each frame.
  const lasers = lasersFrom(world.markers);
  let laserCool = 0;
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const laserMeshes = lasers.map((l) => {
    const len = l.a.distanceTo(l.b);
    const g = new THREE.Group();
    // Seven thin beams at stepped heights read as a grid, not a slab.
    for (let k = 0; k < 7; k++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.025), laserMat);
      beam.position.y = 0.15 + k * 0.32;
      g.add(beam);
    }
    g.position.set((l.a.x + l.b.x) / 2, l.a.y, (l.a.z + l.b.z) / 2);
    g.rotation.y = -Math.atan2(l.b.z - l.a.z, l.b.x - l.a.x);
    world.scene.add(g);
    return g;
  });
  // Feel (S0): the one timescale (hit-stops), camera trauma and the kill's FOV punch.
  const timescale = new Timescale();
  const trauma = new Trauma();
  const syncMotion = () => {
    trauma.reducedMotion = reduceMotionOn();
    arsenal.reducedMotion = trauma.reducedMotion;
  };
  syncMotion();
  // A change in the pause settings reaches the gun and the camera at once.
  window.addEventListener("cathode:prefs", syncMotion, lifeOpt);
  trauma.phone = input.isTouch;
  const fovPunch = new Spring1(tuning.kill.fovSpring);
  /** A kill lands: hit-stop, FOV punch, a little camera trauma, and a rumble on a pad (S1.4). */
  function killConfirm(stopMs: number, auto: boolean): void {
    timescale.hitStop(stopMs, auto);
    fovPunch.x = tuning.kill.fovPunchDeg;
    fovPunch.v = 0;
    trauma.add(tuning.kill.trauma);
    rumble("kill");
  }
  // C6 "I know I'm hit" (S6.1, S6.2): Guard and Flesh, and every readout of a hit on the hit's frame.
  const vitals = new Vitals(s.maxHp);
  s.vitals = vitals;
  /** The camera flinch: a 9 Hz spring per axis (zeta 0.55), added after aim, so it never moves the aim. */
  const FLINCH = { freqHz: 9, zeta: 0.55 };
  const flinch = { yaw: new Spring1(FLINCH), pitch: new Spring1(FLINCH), roll: new Spring1(FLINCH), shove: new Spring1(FLINCH) };
  const shoveDir = new THREE.Vector3();
  /** The Vitals grade's hit flare (tau 160 ms) and the hit's side on screen. */
  let hurtV = 0;
  const hurtDir = new THREE.Vector2(0, 1);
  /** A blast within 6 m adds to the wound grade for 1.5 s. */
  let blastWound = 0;
  // C7 "Wounded" (S6.3, S6.4): the heart, its map onto the frame, the lens, the washes, the blood on her gloves.
  const heart = new HeartClock();
  const phase = new PhaseMap();
  let fxPrefs = loadPrefs();
  /** What the Damage effects setting keeps (S9.8), applied live. */
  let fxLv = damageFxLevels(fxPrefs.damageFx);
  const lens = new LensBlood(o.intensity === "reduced");
  lens.off = !fxLv.lens;
  window.addEventListener(
    "cathode:prefs",
    () => {
      fxPrefs = loadPrefs();
      fxLv = damageFxLevels(fxPrefs.damageFx);
      lens.off = !fxLv.lens;
      if (lens.off) lens.clear();
    },
    lifeOpt,
  );
  /** The frame clock the wounded loop runs on (real seconds; frozen under ?shot). */
  let woundClock = 0;
  /** uWound as shown: eases toward the tier's w (fast in, 1.2 s out), so regen never snaps the screen. */
  let woundShown = 0;
  /** The regen wash (held 300 ms, then out over 300 ms) and the stim's edge wash (700 ms). */
  let regenWash = 0;
  let stimWash = 0;
  /** The regen wash as the grade sees it: in over 100 ms (never a snap), held, then out with the wash. */
  const regenShown = (): number => Math.min(1, regenWash) * Math.min(1, (1.5 - regenWash) * 3);
  /** A stim's heart slowing: 0..1 of its 30 bpm, in over 2 s, held 4 s, out over 3 s. */
  let stimSlowT = -1;
  let gloveBloodV = 0;
  /** Bleeding: where the last drop fell, for one every 1.2 m. */
  const lastDrip = new THREE.Vector3(1e9, 0, 0);
  let lastFireAt = -1e9;
  let pulseNow = 0;
  /** Screenshot stages hold the eased wound and the beat where the stage put them (time is frozen under ?shot). */
  let stageWound: { shown: number; pulse: number } | null = null;
  let hitsTaken = 0;
  /** C8: damage taken this life, and the last hit (its kind, its source, where from), for the death card. */
  let damageTaken = 0;
  let lastHurt: { kind: HurtKind; key: unknown; from: THREE.Vector3 | null; share: number } | null = null;
  /** Screenshot stages: grenade bearings to show instead of the live ones. */
  let stageNades: Array<{ bearing: number; left: number }> | null = null;
  /** Keeps `vitals` and the `hp` mirror in step: anything that wrote `hp` (heals, level-ups, test hooks) lands. */
  function syncVitals(): void {
    if (Math.abs(s.maxHp - vitals.maxTotal) > 1e-6) {
      if (s.hp >= s.maxHp - 1e-6) vitals.reset(s.maxHp);
      else vitals.setMax(s.maxHp);
    }
    if (Math.abs(s.hp - vitals.total) > 1e-4) {
      if (s.hp >= s.maxHp - 1e-6) vitals.reset(s.maxHp);
      else if (s.hp > vitals.total) vitals.heal(s.hp - vitals.total);
      else {
        vitals.damage(vitals.total - s.hp);
        vitals.drain();
      }
    }
    s.hp = vitals.total;
  }
  const elevTo = (p: { x: number; y: number; z: number }) => (Math.atan2(p.y - eye.y, Math.hypot(p.x - eye.x, p.z - eye.z)) * 180) / Math.PI;
  const resolveHurt = (p: { x: number; y: number; z: number }) => ({ bearing: bearingTo(p as THREE.Vector3), elevDeg: elevTo(p) });
  /**
   * Cath takes a hit (S6.2): Guard then Flesh, the damage arc that tracks the attacker, the camera flinch and
   * trauma, the gun's jolt (and, wounded, her hand to the wound), the red flare on the hit side, and her own
   * sounds. Never hitFlesh, which is the sound of her rounds landing on an enemy (the e2e spy holds this).
   */
  function hurtCath(amount: number, from: { x: number; y: number; z: number } | null, kind: HurtKind = "bullet", key?: unknown): void {
    syncVitals();
    const r = vitals.damage(amount);
    if (r.broke) vitals.drain();
    s.hp = vitals.total;
    hitsTaken++;
    damageTaken += amount;
    lastHurt = { kind, key, from: from ? new THREE.Vector3(from.x, from.y, from.z) : null, share: amount / vitals.maxTotal };
    const maxT = vitals.maxTotal;
    const at = from ? new THREE.Vector3(from.x, from.y, from.z) : null;
    const b = at ? bearingTo(at) : 0;
    let k = THREE.MathUtils.clamp(amount / (0.1 * maxT), 0.4, 1.6);
    if (kind === "melee") k *= 2;
    hud.hurtFrom({ key: key ?? at ?? null, at, bearing: b, elevDeg: at ? elevTo(at) : 0, kind, share: amount / maxT });
    audio?.hurt(kind === "melee", { guard: r.guard > 0, flesh: r.flesh > 0, k });
    const rm = trauma.reducedMotion;
    const m = calm ? 0.4 : 1;
    const deg = Math.PI / 180;
    // Away from the source: a hit from the right turns her head left (+yaw), from ahead snaps it back (+pitch);
    // the roll leans into the hit side. A dead-ahead hit still turns a little, to a side picked by the hit count.
    const side = Math.abs(Math.sin(b)) < 0.35 ? (hitsTaken % 2 ? 0.35 : -0.35) : Math.sin(b);
    flinch.yaw.v += impulseForPeak(FLINCH, 3.0 * deg * k * m * side);
    flinch.pitch.v += impulseForPeak(FLINCH, 1.5 * deg * k * m * Math.cos(b));
    if (!rm) flinch.roll.v += impulseForPeak(FLINCH, -1.2 * deg * k * m * Math.sin(b));
    if (kind === "blast" && at) {
      shoveDir.copy(eye).sub(at).setY(0).normalize();
      flinch.shove.v += impulseForPeak(FLINCH, 0.06 * m);
    }
    trauma.add(0.18 * k);
    if (r.broke) trauma.add(0.2);
    // The gun dips and rolls away; critical or worse, every third hit she clutches the wound.
    const tier = vitals.tier;
    arsenal.hurtJolt(Math.sin(b) >= 0 ? 1 : -1, Math.min(1.6, k), (tier === "critical" || tier === "bleeding") && hitsTaken % 3 === 0);
    // The Vitals grade: a flare and a red lobe on the hit side.
    hurtV = Math.max(hurtV, 0.35 + 0.25 * Math.min(1.6, k));
    hurtDir.set(Math.sin(b), Math.cos(b));
    // C7: a heavy hit or any blow up close puts blood on the lens, on the hit's side (at most one per 400 ms).
    if (k >= 1 || kind === "melee") lens.splat(hurtDir.x, hurtDir.y, woundClock);
    // Her hand went to the wound: the glove comes away bloody.
    if ((tier === "critical" || tier === "bleeding") && hitsTaken % 3 === 0) gloveBloodV = Math.min(1, gloveBloodV + 0.45);
    if (r.broke) audio?.guardBreak();
    rumble("hurt");
  }
  s.hurtCath = (amount, from, kind) => hurtCath(amount, from, kind);
  /** The old test hook: a hit from `bearing` (radians, + right) 10 m off, of `amount` (default 12% of max). */
  function cathHurt(bearing: number, melee: boolean, amount?: number): void {
    const th = Math.atan2(-fwd.x, -fwd.z) - bearing;
    const at = player.pos.clone().add(new THREE.Vector3(-Math.sin(th) * 10, 0, -Math.cos(th) * 10));
    at.y = eye.y;
    hurtCath(amount ?? vitals.maxTotal * 0.12, at, melee ? "melee" : "bullet", "hook");
  }
  s.cathHurt = cathHurt;
  s.audio = audio;
  function rumble(kind: keyof typeof tuning.rumble): void {
    const r = tuning.rumble[kind];
    const pad = input.padActive ? navigator.getGamepads?.().find((g) => g && g.connected) : null;
    const act = (pad as (Gamepad & { vibrationActuator?: { playEffect?(t: string, p: object): Promise<unknown> } }) | null | undefined)?.vibrationActuator;
    if (!act?.playEffect) return;
    void act
      .playEffect("dual-rumble", { duration: r.ms, weakMagnitude: r.motor === "weak" ? r.mag : 0, strongMagnitude: r.motor === "strong" ? r.mag : 0 })
      .catch(() => undefined);
  }
  let jolt = 0;
  const calm = calmCameraOn();
  // The pause menu, opened by the phone's menu button (desktop pauses whenever the mouse is free).
  let menuOpen = false;
  hud.onResume = () => {
    menuOpen = false;
    input.lock();
  };
  hud.difficulty = {
    current: progress.character.difficulty,
    options: unlockedDifficulties(progress.jobsDone).map((d) => [d, DIFFICULTY_LABEL[d]]),
    apply: (v) => {
      progress.character.difficulty = v as Difficulty;
      progress.save();
    },
  };
  hud.checkpoint = () => (!job ? null : job.stage >= 4 ? "the walkway" : job.stage >= 3 ? "the flyover" : null);
  hud.onVolume = (v) => {
    if (audio) audio.volume = v;
  };
  let wasAlt = false;
  let charScreen: { close(): void; refresh(): void } | null = null;
  let swayT = 0;
  let drama = 0;
  let dead = false;
  let jobDone = false;
  const eye = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const camPosV = new THREE.Vector3();
  const camQuatV = new THREE.Quaternion();
  /** S2.6 camera pitch per shot, by class (degrees). */
  const CAM_KICK: Record<string, number> = { pistol: 1.1, revolver: 2.6, smg: 0.45, smart: 0.45, rifle: 0.7, shotgun: 4.5, sniper: 6, launcher: 5 };
  // The empty reload's spent mags lie in the street (S2.4) and clack when they land.
  const droppedMags = new DroppedMags(world.scene, ground, (p, k) => {
    if (p.distanceTo(eye) < 12) audio?.gun.magLand(k);
  });
  /**
   * S2.5 live reflections: five rays from the eye (left, right, ahead, behind, up) up to 40 m; each wall they
   * find answers the shot with a delayed, darker copy panned its way.
   */
  const reflections = (): { d: number; pan: number }[] => {
    const out: { d: number; pan: number }[] = [];
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw);
    for (const [x, y, z, pan] of REFL_DIRS) {
      const d = new THREE.Vector3(x, y, z).applyQuaternion(yaw);
      const hit = rays.cast(eye, d, tuning.gunsound.reflMaxM);
      if (hit) out.push({ d: hit.dist, pan });
    }
    return out;
  };
  /** The viewmodel's cues: the shell at 18 ms, the reload's foley, the dropped mag, the seat and the slam. */
  const drainGunCues = () => {
    for (const c of arsenal.cues.splice(0)) {
      if (c === "shell") {
        // S2.3: right 1.8-2.4, up 1.0-1.4, back 0.3 m/s (camera-relative), ±20%.
        const r = arsenal.rig;
        r.root.updateMatrixWorld(true);
        const q = world.camera.getWorldQuaternion(camQuatV);
        const port = r.port.getWorldPosition(new THREE.Vector3()).applyQuaternion(q).add(world.camera.getWorldPosition(camPosV));
        const j = () => 0.8 + Math.random() * 0.4;
        const v = new THREE.Vector3((1.8 + Math.random() * 0.6) * j(), (1.0 + Math.random() * 0.4) * j(), 0.3 * j()).applyQuaternion(q);
        world.fx.casing(port, v.add(player.vel.clone().multiplyScalar(0.9)));
      } else if (c === "dry") audio?.gun.dryFire();
      else if (c === "magDrop") {
        const mag = arsenal.rig.mag;
        if (mag) {
          const q = world.camera.getWorldQuaternion(camQuatV);
          const v = new THREE.Vector3(-0.2, -0.6, 0.1).applyQuaternion(q).add(player.vel.clone().multiplyScalar(0.8));
          droppedMags.drop(mag, world.camera.getWorldPosition(camPosV), q, v);
        }
      } else {
        if (c === "seat") trauma.add(tuning.kestrel.reload.seatTrauma);
        if (c === "slam" || c === "rackHome") trauma.add(tuning.kestrel.reload.slamTrauma);
        audio?.gun.cue(c);
      }
    }
  };

  const frame = (now: number) => {
    // C8: a restart ended this session; the next one runs its own loop.
    if (ended) return;
    // rAF timestamps can trail performance.now() (set when resuming), so never let time run backwards.
    const realDt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    if (autoOn && !s.paused && !menuOpen && auto.frame(now - last) !== null) {
      if (auto.rescued) world.cool?.();
      resize();
      if (perfScale) perfScale.textContent = `res ${Math.round(auto.scale * 100)}%${auto.rescued ? " (rescued, cool)" : ""}`;
    }
    last = now;
    const intent = input.read();
    // On desktop the game waits while the mouse is free (Esc, or before the first click).
    const portrait = input.isTouch && innerHeight > innerWidth;
    if (input.takeMenu() && !dead && !charScreen) menuOpen = true;
    const away = (!input.isTouch && !input.locked && !o.shot && !dead && !navigator.webdriver && !charScreen) || portrait || coaching || menuOpen;
    hud.showPause(away && !portrait && !coaching, input.isTouch);
    if (intent.skills && !charScreen && !killcam.active) openSheet();
    if (intent.map && !coaching && !charScreen && !killcam.active && !dead) {
      coaching = true;
      document.exitPointerLock?.();
      const t = job?.target ?? crisp?.target ?? quay?.target ?? manifest?.target ?? crispBoss?.target ?? vaneLead?.target ?? vaneBoss?.target ?? pellLead?.target ?? pellBoss?.target ?? boardLead?.target ?? boardBoss?.target ?? vaultLead?.target ?? vaultBoss?.target ?? wanted?.target ?? side?.target;
      openDistrictMap(o.hud.parentElement ?? o.hud, player.pos, t ? { x: t.x, z: t.z } : null, () => (coaching = false), progress.jobsDone);
    }
    if (intent.photo && !coaching && !charScreen && !killcam.active && !dead && !input.isTouch) {
      coaching = true;
      document.exitPointerLock?.();
      openPhotoMode(o.hud.parentElement ?? o.hud, o.canvas, render, () => {
        coaching = false;
        input.lock();
      }, world.camera);
    }
    if (s.paused || away) {
      last = now;
      render();
      requestAnimationFrame(frame);
      return;
    }
    // C8: dying is its own frame (the body cam, the grade, the card), until Retry or Quit.
    if (dying) {
      deathFrame(realDt, intent);
      render();
      requestAnimationFrame(frame);
      return;
    }

    // Time: the kill-cam slows the world right down; held focus (bullet-time) slows it while it lasts.
    const run = actives.running();
    let scale = killcam.timeScale * (killcam.active ? 1 : run.timeScale);
    const focusing = !killcam.active && intent.focus && s.focus > 0 && !wanted?.focusJammed;
    if (focusing) {
      s.focus = Math.max(0, s.focus - realDt);
      scale = 0.35;
    } else s.focus = Math.min(progress.stats.bulletTimeSeconds, s.focus + realDt * 0.15);
    // Hit-stop: a landed blow holds the world for a few frames, so it lands with weight. The lowest scale
    // wins (a stop inside slow motion returns to the slow motion); particles drift at a quarter speed.
    timescale.update(realDt);
    const fxScale = Math.min(scale, timescale.fxScale);
    scale = Math.min(scale, timescale.simScale);
    const dt = o.shot ? 0 : realDt * scale;
    const fxDt = o.shot ? 0 : realDt * fxScale;
    combat.clock += dt;
    thunderCover = Math.max(0, thunderCover - realDt);
    grace = Math.max(0, grace - dt);
    // Out of the fight for a few seconds, she gets her breath back.
    // C6: Guard comes back 4 s after a hit, Flesh only to the bleed floor (S6.1); their sounds play here.
    syncVitals();
    if (!dead) {
      for (const ev of vitals.update(dt)) {
        if (ev === "regenStart") {
          audio?.regenStart();
          regenWash = 1.5;
        }
        else if (ev === "guardFull") audio?.guardFull();
      }
      vitals.drain();
      s.hp = vitals.total;
    }
    // Slow motion looks it: the noir grade deepens while time is held.
    if (!killcam.active) {
      const want = focusing || run.timeScale < 1 || timescale.active("lastEnemy") ? 0.4 : 0;
      if (want !== drama) world.setDrama((drama = want));
    }
    time += dt;

    if (killcam.active) {
      // The kill-cam is cinema: no gun in hand, no HUD.
      arsenal.rig.root.visible = false;
      hud.visible = false;
      if (intent.fire && !wasFire) killcam.skip();
      wasFire = intent.fire;
      combat.update(dt, build());
      for (const e of enemies) {
        e.update(dt, sightOf(), rays, world.colliders, ground);
        e.body.updateFlash(o.shot ? 0 : realDt * 1000);
      }
      killcam.update(realDt);
      audio?.update(realDt, 0.2, 1);
      drainEvents();
      world.update(dt, time);
      render();
      requestAnimationFrame(frame);
      return;
    }

    hud.visible = true;
    if (!dead) {
      // Movement looks in real time (so aiming stays crisp in bullet-time) but moves in game time.
      player.aiming = arsenal.aiming;
      // C7 (S6.1): bleeding out, she can't sprint.
      if (vitals.tier === "bleeding") intent.sprint = false;
      player.step(Math.max(dt, realDt * 0.35), intent);
      keepInBounds();
    }
    // Touch: aim assist, and auto-fire on anyone already shooting at her (stealth kills stay a deliberate tap).
    input.autoFire = false;
    // (Not in a screenshot stage: no assist pulling the view, no auto-fire at the guard the stage alerted.)
    if ((input.isTouch || input.padActive) && !dead && !staged && progress.character.difficulty !== "hellWeek") {
      const t = aimAssist(intent.aim || intent.fire, realDt);
      const w = arsenal.weapon;
      input.autoFire =
        input.isTouch &&
        !!t && t.enemy.state === "combat" && t.angle < 0.04 && w.kind !== "melee" && t.enemy.position.distanceTo(player.pos) < w.range && arsenal.ammo.mag > 0;
    }
    player.applyCamera(world.camera, realDt);
    // Scope sway: a slow figure-of-eight; held breath (Focus while scoped) all but stills it.
    if (arsenal.scopedIn) {
      swayT += realDt;
      const amp = (vitals.tier === "critical" || vitals.tier === "bleeding" ? 1.6 : 1) * (calm ? 0.4 : 1) * 0.0045 * progress.stats.swayMultiplier * run.sway * (focusing ? 0.12 : 1) * (1 + player.speed * 0.4);
      world.camera.rotation.x += Math.sin(swayT * 0.9) * amp;
      world.camera.rotation.y += Math.sin(swayT * 0.45) * amp * 1.4;
    }
    // Recoil's camera share (S2.3 `recoilAt`): the springing 70% of each kick, on top of her own aim.
    const [recP, recY] = arsenal.camRecoil.update(o.shot ? 0 : realDt);
    world.camera.rotation.x += recP;
    world.camera.rotation.y += recY;
    // Trauma: one shake for every jolt the fight gives the camera (S0).
    trauma.update(realDt);
    const shake = trauma.sample();
    world.camera.rotation.x += shake.pitch;
    world.camera.rotation.y += shake.yaw;
    world.camera.rotation.z += shake.roll;
    // The camera jolts with a landed blow, in the swing's direction.
    if (jolt > 0.01) {
      jolt *= Math.exp(-realDt * 14);
      world.camera.rotation.z += (calm ? 0.25 : 1) * jolt * 0.035 * arsenal.anim.meleeSide;
      world.camera.rotation.x -= (calm ? 0.25 : 1) * jolt * 0.02;
    }
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    // C6: the hit flinch, after aim (eye and fwd are already read), so it moves the view and never the shot.
    {
      const fdt = o.shot ? 0 : realDt;
      world.camera.rotation.y += flinch.yaw.update(fdt);
      world.camera.rotation.x += flinch.pitch.update(fdt);
      world.camera.rotation.z += flinch.roll.update(fdt);
      world.camera.position.addScaledVector(shoveDir, flinch.shove.update(fdt));
      hurtV *= Math.exp(-fdt / 0.16);
      blastWound = Math.max(0, blastWound - fdt / 1.5);
      woundLoop(fdt);
    }

    // Weapons.
    if (intent.slot >= 0) arsenal.equipSlot(intent.slot);
    if (intent.cycle && arsenal.scopedIn) arsenal.stepZoom(-intent.cycle);
    else if (intent.cycle) arsenal.cycleOwned(intent.cycle);
    if (intent.reload) arsenal.reload();
    arsenal.aiming = (intent.aim || arsenal.holdAim) && !dead;
    arsenal.triggerHeld = intent.fire && !dead;
    arsenal.sprinting = intent.sprint && player.speed > 3;
    arsenal.noteInput(!!(intent.fire || intent.aim || intent.reload || intent.sprint || intent.alt || intent.slot >= 0 || intent.cycle || Math.abs(intent.look.yaw) + Math.abs(intent.look.pitch) > 1e-4 || player.speed > 0.3), o.shot ? 0 : realDt);
    const press = intent.fire && !wasFire;
    wasFire = intent.fire;
    const trigger = arsenal.weapon.kind === "melee" ? intent.fire : press;
    const spreadMul = (1 + Math.min(1.5, player.speed / 4)) * (player.onGround ? 1 : 2) * (1 - player.crouchAmt * 0.3);
    const altPress = intent.alt && !wasAlt;
    wasAlt = intent.alt;
    if (altPress && !dead) arsenal.altFire();
    const gun = actives.weaponMod(arsenal.weapon.weaponClass);
    if (gun.noReload) arsenal.topUp();
    const shot = dead ? null : arsenal.update((dt || realDt) * gun.rate, trigger, eye, fwd, world.camera.quaternion, spreadMul);
    if (shot) {
      lastFireAt = woundClock;
      const nx = actives.takeNextShot(shot.weapon.weaponClass);
      const mul = gun.dmg * nx.mul * progress.weaponScale(shot.weapon.id);
      if (mul !== 1) shot.weapon = { ...shot.weapon, damage: shot.weapon.damage * mul };
      if (nx.pellets > 0) shot.dirs = shot.dirs.slice(0, nx.pellets);
      if (thunderCover > 0) shot.weapon = { ...shot.weapon, noise: shot.weapon.noise * 0.25 };
      grace = 0;
      const r = combat.fire(shot, build());
      if (thunderCover > 0) hud.feedLine("Covered by the thunder");
      audio?.shot(shot.weapon.weaponClass, reflections());
      // Camera recoil (S2.3, S2.6): the class's kick, 70% springing back, 30% left for her to pull down.
      const camKick = CAM_KICK[shot.weapon.weaponClass] ?? 0;
      if (camKick > 0) {
        const keep = arsenal.camRecoil.kick(Math.random() * 2 - 1, (camKick / tuning.kestrel.camera.pitchDeg) * (arsenal.aiming ? 0.8 : 1) * (calm ? 0.5 : 1));
        player.pitch = THREE.MathUtils.clamp(player.pitch + keep.pitch, -1.5, 1.5);
        player.yaw += keep.yaw;
      }
      if (shot.weapon.id === "kestrel") trauma.add(tuning.kestrel.fire.trauma);
      // The Kestrel's shell leaves the port on its clip's cue (18 ms); the older guns throw theirs at once.
      if (shot.weapon.weaponClass !== "melee" && shot.weapon.id !== "kestrel") {
        // Brass out of the port, to the right and up; the world rings it on landing.
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const port = shot.muzzle.clone().addScaledVector(fwd, shot.weapon.weaponClass === "pistol" ? -0.25 : -0.45);
        world.fx.casing(port, right.multiplyScalar(2.2 + Math.random()).add(new THREE.Vector3(0, 2.4, 0)).addScaledVector(fwd, -0.3));
      }
      if (r.killcam) {
        killcam.start(r.killcam);
        hud.killcamCaption(killcam.distance);
        audio?.killcamWhoosh();
      }
    }
    if (arsenal.meleeNow) {
      const struck = combat.melee(eye, fwd, arsenal.weapon, build());
      audio?.pin(struck, arsenal.weapon.model);
      if (struck) {
        timescale.hitStop(tuning.hitStop.melee);
        jolt = 1;
      }
      if (struck && run.lifeSteal > 0) s.hp = Math.min(s.maxHp, s.hp + arsenal.weapon.damage * run.lifeSteal);
    }
    if (arsenal.slamNow) {
      arsenal.slamNow = false;
      // The sledge's ground slam: a knockdown blast just ahead of her boots.
      const at = eye.clone().addScaledVector(fwd.clone().setY(0).normalize(), 2.2);
      at.y = Math.max(0, eye.y - 1.5);
      combat.explode(at, 3, 60, build(), false);
    }
    if (arsenal.lashNow) {
      arsenal.lashNow = false;
      // Cat's Cradle's lash: the wire whips out in a wide arc and drags everything in it.
      const at = eye.clone().addScaledVector(fwd.clone().setY(0).normalize(), 2.6);
      at.y = Math.max(0, eye.y - 1.2);
      combat.explode(at, 2.6, 38, build(), false);
    }
    if (intent.reload && arsenal.weapon.kind !== "melee" && !arsenal.kestrel) audio?.reload();
    drainGunCues();
    const canTakedown = !dead && takedownTarget() !== null;
    if (intent.takedown && canTakedown) {
      // With Cat's Cradle in hand the takedown is a garrotte: the wire reaches further (3 m) than the Pin.
      const garrotte = arsenal.weapon.id === "catsCradle";
      const pin = garrotte ? arsenal.weapon : arsenal.held[0]!.def;
      if (combat.takedown(eye, fwd, pin, garrotte ? 3 : 1.9)) {
        arsenal.strike();
        // S6.1: a takedown gives back 15% of Flesh.
        syncVitals();
        vitals.healShare(0.15);
        s.hp = vitals.total;
        audio?.pin(true);
      }
    }
    // Weapons need a press (S7.1): the same key as a takedown, when there's no one to take down.
    if (intent.takedown && !canTakedown && !dead && job?.take()) audio?.promptUp();
    const combatT0 = performance.now();
    combat.update(dt, build());

    // Active skills: quick-slots, thrown things, explosions, the lunge's strike.
    const ctx = { player, eye, fwd, enemies, world, maxHp: s.maxHp };
    const healing0 = (actives as unknown as { healing: object | null }).healing;
    if (!dead && intent.skill1) actives.use(0, progress.character, progress.stats, ctx);
    if (!dead && intent.skill2) actives.use(1, progress.character, progress.stats, ctx);
    const healing1 = (actives as unknown as { healing: object | null }).healing;
    if (healing1 && healing1 !== healing0) onStim();
    actives.update(dt, progress.stats, world, world.colliders, ground, enemies);
    // Ammo and cash are walk-in; a gun she hasn't carried is taken with a press (S7.1), like the first one.
    const needsPress = (d: { gun?: string }) => !!d.gun && !arsenal.owned.has(d.gun) && (!job || job.done);
    if (!dead) for (const d of pickups.update(dt, player.pos, { needsPress, take: intent.takedown && !canTakedown })) collect(d);
    if (!dead && s.hp > 0) {
      const zone = inMarket ? zones.update(player.pos.z) : undefined;
      if (zone) hud.showBanner(zone.name, zone.sub);
      const wing = inMarket ? wings.update(progress.jobsDone, player.pos.x, player.pos.z) : undefined;
      if (wing) hud.showBanner(wing.name, wing.sub);
      const lm = inMarket ? nearLandmark(progress.jobsDone, player.pos.x, player.pos.z) : undefined;
      if (lm) {
        hud.subtitle(lm.text);
        progress.save();
      }
    }
    if (!dead) {
      for (const f of secrets.update(dt, player.pos)) {
        if (f.kind === "stash") collect({ items: [], scrip: f.scrip ?? 0 });
        else if (f.kind === "cache" && f.weapon) arm(f.weapon);
        else if (f.text) hud.subtitle(f.text);
        hud.feedLine(`Secret found (${secretsFound(progress.jobsDone)}/${SECRETS.length})`, true);
        progress.save();
      }
    }
    if (actives.refill) {
      arsenal.topUp();
      actives.refill = false;
    }
    for (const b of actives.blasts) {
      combat.explode(b.pos, b.radius, b.damage, build(), b.silent);
      if (!b.silent) blastNear(b.pos);
    }
    actives.blasts.length = 0;
    for (const b of deathBlasts.splice(0)) {
      world.fx.explosion(b.pos.clone(), b.radius);
      blastNear(b.pos);
      combat.explode(b.pos, b.radius, b.damage, build(), false);
      const d = b.pos.distanceTo(eye);
      if (!dead && d < b.radius) {
        hurtCath(actives.absorb(b.damage * (1 - d / b.radius) * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)), b.pos, "blast", b);
      }
    }
    for (let i = 0; i < lasers.length; i++) {
      const st = laserState(time, lasers[i]!.phase);
      const beam = laserMeshes[i]!;
      beam.visible = st.live || (st.warn && Math.floor(time * 12) % 2 === 0);
      if (st.live && !dead && laserCool <= 0 && laserTouches(lasers[i]!, player.pos)) {
        laserCool = LASER_COOLDOWN;
        hurtCath(actives.absorb(LASER_DAMAGE * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)), beam.position.clone().setY(eye.y), "laser", beam);
      }
    }
    laserCool -= dt;
    if (actives.heal > 0) {
      s.hp = Math.min(s.maxHp, s.hp + actives.heal);
      actives.heal = 0;
    }
    if (actives.lungeAt && actives.lungeT <= 0.05) {
      arsenal.strike();
      audio?.pin(combat.melee(eye, fwd, arsenal.held[0]!.def, build()), arsenal.held[0]!.def.model);
      actives.lungeAt = null;
    }
    for (const line of actives.said) hud.feedLine(line);
    actives.said.length = 0;

    // Enemies: perception, movement, shooting back.
    const sight = sightOf();
    // Nurses patch the wounded around them while they live.
    for (const n of enemies) {
      if (n.kit.role !== "nurse" || !n.alive) continue;
      for (const a of enemies) {
        if (a !== n && a.alive && a.hp < a.kit.maxHp && a.position.distanceTo(n.position) < NURSE_RANGE) {
          a.hp = Math.min(a.kit.maxHp, a.hp + a.kit.maxHp * NURSE_HEAL * dt);
        }
      }
    }
    // The hit flash runs on real time, so it shows through the hit-stop that freezes the body (S4.1).
    const flashMs = o.shot ? 0 : realDt * 1000;
    for (const e of enemies) {
      e.update(dt, sight, rays, world.colliders, ground);
      e.body.updateFlash(flashMs);
      // A screenshot stage is one held moment: a guard the stage round alerted doesn't shoot back into it.
      if (staged) e.shots.length = 0;
      for (const sh of e.shots) {
        if (!sh.melee) world.fx.muzzle(sh.from, sh.dir, 0.6);
        const hitWorld = rays.cast(sh.from, sh.dir, sh.melee ? 3 : 120);
        const toChest = sight.chest.clone().sub(sh.from);
        const along = toChest.dot(sh.dir);
        const miss = toChest.clone().addScaledVector(sh.dir, -along).length();
        if (!dead && along > 0 && miss < 0.3 && (!hitWorld || hitWorld.dist > along) && arsenal.parryT > 0) {
          // Parried: the blade turns the round aside in a spark.
          world.fx.impact(sight.chest, sh.dir.clone().negate(), world.surfaceAt(sight.chest));
          world.fx.tracer(sh.from, sight.chest);
        } else if (!dead && along > 0 && miss < 0.3 && (!hitWorld || hitWorld.dist > along)) {
          hurtCath(actives.absorb(e.kit.damage * run.guard * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)), sh.from, sh.melee ? "melee" : "bullet", e);
          if (e.kit.drain) s.focus = Math.max(0, s.focus - e.kit.drain);
          if (!sh.melee) world.fx.tracer(sh.from, sight.chest);
        } else if (hitWorld) {
          world.fx.impact(hitWorld.point, hitWorld.normal, world.surfaceAt(hitWorld.point));
          world.fx.tracer(sh.from, hitWorld.point);
        }
        combat.noise(sh.from, sh.melee ? 8 : 40);
        if (sh.melee) continue;
        // S2.5: a round that passes within 2 m of her head whizzes by, on its side.
        if (!dead && along > 0 && miss >= 0.3 && miss < tuning.gunsound.whizM && (!hitWorld || hitWorld.dist > along)) {
          const off = toChest.clone().addScaledVector(sh.dir, -along).negate();
          const rgt = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
          audio?.gun.whiz(THREE.MathUtils.clamp(off.normalize().dot(rgt) * 1.4, -1, 1), 1 - miss / tuning.gunsound.whizM);
        }
        const rel = sh.from.clone().sub(eye);
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        audio?.enemyShot(rel.length(), THREE.MathUtils.clamp(rel.normalize().dot(right), -1, 1));
      }
    }
    discoverBodies();
    drainEvents();

    // The first job: its stages, objective and waypoint.
    if (job) {
      job.update(dt);
      objective = job.objective;
      if (job.done && !boardShown && !o.shot) {
        boardShown = true;
        setTimeout(() => {
          coaching = true;
          openCaseBoard(o.hud.parentElement ?? o.hud, progress.jobsDone, () => (coaching = false));
        }, 9000);
      }
    }
    if (crisp) {
      crisp.update(dt);
      objective = crisp.objective;
    }
    if (quay) {
      quay.update(dt);
      objective = quay.objective;
    }
    if (manifest) {
      manifest.update(dt);
      objective = manifest.objective;
    }
    if (crispBoss) {
      crispBoss.update(dt);
      objective = crispBoss.objective;
    }
    if (vaneLead) {
      vaneLead.update(dt);
      objective = vaneLead.objective;
      if (inClinic && vaneLead.done && !vaneBoss) {
        vaneBoss = makeVaneBoss();
        if (vaneBoss) objective = vaneBoss.objective;
      }
    }
    if (vaneBoss) {
      vaneBoss.update(dt);
      objective = vaneBoss.objective;
    }
    if (pellLead) {
      pellLead.update(dt);
      objective = pellLead.objective;
      if (inPlaza && pellLead.done && !pellBoss) {
        pellBoss = makePellBoss();
        if (pellBoss) objective = pellBoss.objective;
      }
    }
    if (pellBoss) {
      pellBoss.update(dt);
      objective = pellBoss.objective;
    }
    if (boardLead) {
      boardLead.update(dt);
      objective = boardLead.objective;
      if (inTower && boardLead.done && !boardBoss) {
        boardBoss = makeBoardBoss();
        if (boardBoss) objective = boardBoss.objective;
      }
    }
    if (boardBoss) {
      boardBoss.update(dt);
      objective = boardBoss.objective;
    }
    if (vaultLead) {
      vaultLead.update(dt);
      objective = vaultLead.objective;
      if (inVault && vaultLead.done && !vaultBoss) {
        vaultBoss = makeVaultBoss();
        if (vaultBoss) objective = vaultBoss.objective;
      }
    }
    if (vaultBoss) {
      vaultBoss.update(dt);
      objective = vaultBoss.objective;
    }
    if (wanted) {
      wanted.update(dt);
      objective = wanted.objective;
    }
    if (side) {
      side.update(dt);
      objective = side.objective;
    }
    input.allow(progress.unlocks.features, arsenal.ownedIndices.length);

    // Voice cues from the street's state.
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.state === "suspicious") voice.say("seen");
      if (e.state === "combat") voice.say(e.kit.role === "shield" ? "shield" : "spotted");
      if (e.laser?.visible) voice.say("laser");
    }
    if (s.hp > 0 && s.hp < s.maxHp * 0.3) voice.say("lowHealth");
    voice.update(realDt);

    if (!dead && s.hp <= 0) beginDeath();
    if (!job && !jobDone && enemies.length && enemies.every((e) => !e.alive)) {
      jobDone = true;
      objective = "The street's quiet. Walk to the fish market's back door.";
      hud.showBanner("Street clear", "The Drowned Market");
      voice.say("clear");
    }
    if (jobDone && ex && player.pos.distanceTo(ex) < 3) {
      jobDone = false;
      objective = "Job done. More of the Drowned Market is coming (ROADMAP 74-76).";
      if (!progress.jobsDone.includes("fishMarket")) progress.jobsDone.push("fishMarket");
      progress.save();
      hud.showBanner("Job done", `Level ${progress.character.level}`);
      voice.say("done");
      voice.say("beaCall1");
      voice.say("beaCall2");
      voice.say("beaCall3");
    }

    // Sound: footsteps, the score's tension, slow motion.
    if (audio) {
      if (player.onGround) audio.steps(player.speed * realDt * (dt > 0 ? dt / realDt : 1), player.speed, player.crouchAmt, inClinic && player.pos.x > 4.2 && player.pos.x < 8.8 && player.pos.z > -22 && player.pos.z < -10 && player.pos.y < 0.4);
      let tension = 0;
      for (const e of enemies) if (e.alive) tension = Math.max(tension, e.state === "combat" ? 1 : e.state === "searching" ? 0.6 : e.detect * 0.5);
      audio.update(realDt, tension, focusing ? 0.7 : 0);
    }

    // Camera zoom while aiming, and the weapon rig.
    world.camera.fov = (arsenal.worldFov + (calm ? 0.4 : 1) * fovPunch.update(realDt)) * woundFov;
    world.camera.updateProjectionMatrix();
    if (world.ambientAt) {
      const ambC = ambColor;
      world.ambientAt(world.camera.position, ambC);
      arsenal.ambient(ambC, world.lightAt(world.camera.position), Math.max(realDt, 1 / 30));
    }
    arsenal.setView(world.camera.getWorldPosition(camPosV), world.camera.getWorldQuaternion(camQuatV));
    arsenal.pose(realDt, intent.look, player.stride, player.speed, intent.sprint, player.landed, world.viewCamera, BASE_FOV);
    drainGunCues();
    droppedMags.update(fxDt);
    world.update(dt, o.shot ? 1 : time, fxDt);

    // Combat CPU (rounds, skills, enemies, ragdolls, FX) for the S0 budget check.
    s.stats.combatMs = (s.stats.combatMs ?? 0) * 0.9 + (performance.now() - combatT0) * 0.1;
    s.stats.particles = world.fx.alive ?? 0;
    // HUD.
    const ahead = rays.cast(eye, fwd, 800);
    const groundT = rayGround(eye, fwd, world.groundHeight(eye.x, eye.z), 800);
    hud.update(realDt, {
      hp: s.hp,
      maxHp: s.maxHp,
      guard: vitals.guard,
      maxGuard: vitals.maxGuard,
      flesh: vitals.flesh,
      maxFlesh: vitals.maxFlesh,
      regen: vitals.regenerating,
      nades: stageNades ?? actives.liveGrenades().filter((n) => n.pos.distanceTo(player.pos) < 6).map((n) => ({ bearing: bearingTo(n.pos), left: n.left })),
      hurtResolve: resolveHurt,
      level: s.level,
      xp: progress.character.xp - xpForLevel(progress.character.level),
      xpNext: simXpToNext(progress.character.level),
      weapon: arsenal.weapon.name,
      mag: arsenal.ammo.mag,
      reserve: arsenal.ammo.reserve,
      magSize: arsenal.weapon.mag,
      melee: arsenal.weapon.kind === "melee",
      spread: (arsenal.aiming ? 0 : 10) * spreadMul,
      scoped: arsenal.scopedIn,
      threats: threats(),
      scopeRange: Math.min(ahead ? ahead.dist : 800, groundT ?? 800),
      wind: world.wind.x,
      objective,
      caseName,
      ...(() => {
        // The world prompt takes over from the objective marker once she's at the weapon.
        const pickup = pickupPrompt(realDt, intent.look);
        return { pickup, waypoint: pickup ? null : waypoint() };
      })(),
      ads: arsenal.aiming,
      adsBlend: arsenal.weapon.kind === "melee" ? 0 : arsenal.anim.aim,
      // Inspecting or reloading, the gun is the subject and the crosshair steps aside.
      inspect: Math.max(arsenal.inspectW, arsenal.reloadW),
      takedown: canTakedown,
      bulletTime: focusing ? 1 : 0,
      skills: [0, 1].map((i) => {
        const st = actives.state(progress.character, progress.stats, i);
        return st ? { name: st.name, ready: st.ready, key: i === 0 ? "G" : "Z" } : null;
      }),
      battery: actives.battery / Math.max(1, progress.stats.battery),
      armour: progress.stats.armour,
      defence: defenceLine(progress.stats),
    });
    // C8: the re-sync's last 350 ms, fading up out of black into her eyes, with the cyan line.
    if (resyncT >= 0) {
      resyncT += (o.shot ? 0 : realDt) * 1000;
      const rs = resyncState(resyncT);
      world.setDeath?.({ death: 0, ink: rs.ink, glitch: rs.glitch, ca: 1, grey: o.intensity === "reduced" });
      screen.resyncFrame(rs.black, null);
      if (rs.done) {
        resyncT = -1;
        world.setDeath?.({ death: 0, ink: 0, glitch: 0, ca: 1 });
        screen.resyncFrame(0, null);
      }
    }
    render();
    requestAnimationFrame(frame);
  };

  function sightOf(): Sight {
    return {
      eye: world.camera.position.clone(),
      chest: player.pos.clone().add(new THREE.Vector3(0, player.eyeHeight * 0.75, 0)),
      light: world.lightAt(player.pos.clone().add(new THREE.Vector3(0, 1, 0))),
      low: player.crouchAmt,
      speed: player.speed,
      // The first seconds of a job are hers: nobody can spot her until she's had a look round (or fires).
      stealth: dead || grace > 0 ? 0 : progress.stats.detectionMultiplier * actives.running().camo,
    };
  }

  /** Touch and gamepad aim assist: within a few degrees of an Enforcer, the crosshair is pulled onto them. */
  /** Returns the enemy it's pulling onto and how far off the crosshair it is, for auto-fire. */
  function aimAssist(engaged: boolean, dt: number): { enemy: Enemy; angle: number } | null {
    const cam = world.camera;
    const camPos = cam.position;
    const look = new THREE.Vector3();
    cam.getWorldDirection(look);
    let best: THREE.Vector3 | null = null;
    let bestE: Enemy | null = null;
    let bestA = engaged ? 0.09 : 0.06;
    for (const e of enemies) {
      if (!e.alive) continue;
      const pt = (arsenal.aiming ? e.head : e.body.joints.chest).clone();
      const to = pt.clone().sub(camPos);
      const d = to.length();
      if (d > 60) continue;
      const a = to.normalize().angleTo(look);
      if (a < bestA && rays.clear(camPos, pt)) {
        bestA = a;
        best = pt;
        bestE = e;
      }
    }
    if (!best || !bestE) return null;
    const to = best.clone().sub(camPos);
    const wantYaw = Math.atan2(-to.x, -to.z);
    const wantPitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    let dy = wantYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const k = 1 - Math.exp(-dt * (engaged ? 9 : 3));
    player.yaw += dy * k;
    player.pitch += (wantPitch - player.pitch) * k;
    return { enemy: bestE, angle: bestA };
  }

  /** The character screen (K or Tab): the game waits behind it. */
  function openSheet(): void {
    s.paused = true;
    document.exitPointerLock?.();
    const wasFocus = s.focus;
    charScreen = openCharacter(
      o.hud.parentElement ?? o.hud,
      () => progress.character,
      (next) => {
        progress.set(next);
        actives.assign(next);
        const ratio = s.hp / s.maxHp;
        s.maxHp = progress.stats.maxHealth;
        s.hp = Math.round(s.maxHp * ratio);
      },
      () => {
        charScreen = null;
        s.paused = false;
        s.focus = wasFocus;
        input.lock();
      },
      {
        tab: progress.character.unspentSkills > 0 ? "skills" : "attributes",
        exportCode: () => exportCode(makeSave(progress.character, new Date().toISOString(), { jobsDone: progress.jobsDone })),
      },
    );
  }

  /**
   * The world prompt over a weapon on offer (S7.1 layer 5), Cath's nudge and the look assist (layer 7). The prompt
   * shows within reach and only while the gun is in sight (a wall between them hides it).
   */
  // Scratch for the per-frame prompt (no allocations), and the sightline ray's last answer: cast at most every
  // 100 ms and shared by the prompt and the nudge.
  const promptCam = new THREE.Vector3();
  const promptV = new THREE.Vector3();
  let sightAt = -1;
  let sightClear = false;
  const sightline = (from: THREE.Vector3, to: THREE.Vector3): boolean => {
    const now = performance.now();
    if (staged || now - sightAt > 100) {
      sightAt = now;
      sightClear = rays.clear(from, to);
    }
    return sightClear;
  };
  function pickupPrompt(dt: number, look: { yaw: number; pitch: number }): HudState["pickup"] {
    const c = job?.case;
    if (!c?.weapon || c.taken || dead) return lootPrompt();
    const cam = world.camera;
    const camPos = cam.getWorldPosition(promptCam);
    const v = promptV.copy(c.gunAt).project(cam);
    const onScreen = v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92;
    const dist = camPos.distanceTo(c.gunAt);
    const wantNudge = !nudged && !staged && job?.stage === 2 && dist < 12 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
    const clear = (onScreen || wantNudge) && sightline(camPos, c.gunAt);
    const seen = onScreen && clear;
    // The nudge and the assist (never in a screenshot stage, never on the walkway's class case).
    if (Math.abs(look.yaw) > 1e-5 || Math.abs(look.pitch) > 1e-5) {
      lookIdle = 0;
      assist = null;
    } else lookIdle += dt;
    if (wantNudge && clear) {
      nudged = true;
      hud.subtitle("Cath: There. On the stall.");
      const to = promptV.copy(c.gunAt).sub(camPos);
      const want = Math.atan2(-to.x, -to.z);
      let d = want - player.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const left = Math.sign(d) * Math.min(Math.abs(d), THREE.MathUtils.degToRad(10));
      if (lookIdle > 0.4 && Math.abs(d) > THREE.MathUtils.degToRad(2)) assist = { left, rate: left / 0.6 };
    }
    if (assist) {
      const step = Math.sign(assist.rate) * Math.min(Math.abs(assist.rate * dt), Math.abs(assist.left));
      player.yaw += step;
      assist.left -= step;
      if (Math.abs(assist.left) < 1e-4) assist = null;
    }
    const near = Math.hypot(c.gunAt.x - player.pos.x, c.gunAt.z - player.pos.z) <= TAKE_RANGE;
    const show = near && seen;
    if (show && !promptShown) audio?.promptUp();
    promptShown = show;
    if (!show) return null;
    const def = SLICE_WEAPONS.find((w) => w.id === c.weapon);
    const el = o.canvas;
    return {
      x: ((v.x + 1) / 2) * el.clientWidth,
      y: ((1 - v.y) / 2) * el.clientHeight,
      key: input.isTouch ? "Tap" : takeKey,
      verb: "Take",
      name: (def?.name ?? c.weapon ?? "").replace(/ \(.*\)$/, ""),
      stats: def ? ([["Dmg", String(def.damage * def.pellets)], ["Rpm", `${Math.round(60 / def.cycle)}`], ["Mag", String(def.mag || "-")]] as Array<[string, string]>) : [],
    };
  }

  const lootAt = new THREE.Vector3();
  /** The world prompt over a gun on the ground she'd have to press to take (a new weapon). */
  function lootPrompt(): HudState["pickup"] {
    const p = pickups.offer;
    if (!p?.drop.gun || dead) return null;
    const at = lootAt.copy(p.pos).setY(p.pos.y + 0.4);
    const v = promptV.copy(at).project(world.camera);
    if (!(v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.92)) return null;
    // Only while it's in sight, like the first job's prompt: a gun behind a wall or a car gets no chip.
    if (!sightline(world.camera.getWorldPosition(promptCam), at)) return null;
    const def = SLICE_WEAPONS.find((w) => w.id === p.drop.gun);
    const el = o.canvas;
    return {
      x: ((v.x + 1) / 2) * el.clientWidth,
      y: ((1 - v.y) / 2) * el.clientHeight,
      key: input.isTouch ? "Tap" : takeKey,
      verb: "Take",
      name: (def?.name ?? p.drop.gun).replace(/ \(.*\)$/, ""),
      stats: def ? ([["Dmg", String(def.damage * def.pellets)], ["Rpm", `${Math.round(60 / def.cycle)}`], ["Mag", String(def.mag || "-")]] as Array<[string, string]>) : [],
    };
  }

  const wpScratch = new THREE.Vector3();
  /** The objective on screen, for the waypoint diamond. */
  function waypoint(): { x: number; y: number; dist: number; behind: boolean } | null {
    const t = job?.target ?? crisp?.target ?? quay?.target ?? manifest?.target ?? crispBoss?.target ?? vaneLead?.target ?? vaneBoss?.target ?? pellLead?.target ?? pellBoss?.target ?? boardLead?.target ?? boardBoss?.target ?? vaultLead?.target ?? vaultBoss?.target ?? wanted?.target ?? side?.target;
    if (!t || dead) return null;
    // The diamond floats 1.2 m over the objective; over the first gun's case it rides above the beacon's shaft, so
    // the beam reads whole under it instead of being capped by the marker.
    const lift = job?.case && t === job.case.gunAt ? job.case.markLift : 1.2;
    const p = wpScratch.copy(t).setY(t.y + lift).project(world.camera);
    const behind = p.z > 1;
    return { x: (behind ? -p.x : p.x) * 0.5 + 0.5, y: -p.y * 0.5 + 0.5, dist: player.pos.distanceTo(t), behind };
  }

  /**
   * The street's edges: if Cath ends up somewhere the level doesn't go (over a rail into the canal, off a
   * roof, outside the buildings), she's back at the last place she stood safely.
   */
  function keepInBounds(): void {
    const p = player.pos;
    const bd = world.bounds ?? { xMin: -26, xMax: 16, zMin: -70, zMax: 66 };
    const inside = p.x > bd.xMin && p.x < bd.xMax && p.z > bd.zMin && p.z < bd.zMax;
    const fell = p.y < -1.2 || p.y < world.groundHeight(p.x, p.z) - 1.5;
    if (inside && !fell) {
      if (player.onGround) {
        safeT += 1;
        if (safeT > 20) {
          safe.copy(p);
          safeT = 0;
        }
      }
      return;
    }
    p.copy(safe);
    player.vel.set(0, 0, 0);
    hud.feedLine("Back on the street");
  }

  function takedownTarget(): Enemy | null {
    for (const e of enemies) {
      if (!e.alive || e.state === "combat") continue;
      const to = new THREE.Vector3().subVectors(e.body.joints.chest, eye);
      if (to.length() > (arsenal.weapon.id === "catsCradle" ? 3 : 1.9) || to.normalize().dot(fwd) < 0.5) continue;
      const theirFwd = new THREE.Vector3(Math.sin(e.motion.yaw), 0, Math.cos(e.motion.yaw));
      if (theirFwd.dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) > 0.2 || e.state === "unaware") return e;
    }
    return null;
  }

  /** Enemies who see a dead colleague raise the alarm for everyone nearby. */
  function discoverBodies(): void {
    for (const body of enemies) {
      if (body.alive || body.found || body.deadFor < 1) continue;
      for (const e of enemies) {
        if (!e.alive || e.state === "combat") continue;
        const d = e.position.distanceTo(body.position);
        if (d > 22) continue;
        if (!rays.clear(e.head, body.body.joints.chest.clone().add(new THREE.Vector3(0, 0.3, 0)))) continue;
        body.found = true;
        for (const f of enemies) if (f.position.distanceTo(body.position) < 40) f.alert(body.position);
        hud.feedLine("They've found a body", true);
        voice.say("bodyFound");
        break;
      }
    }
  }

  /** The bleeding wobble's FOV breathe for this frame (1 when she isn't bleeding out). */
  let woundFov = 1;
  /**
   * C7 "Wounded" (S6.3, S6.4), once a frame on real time: w eased onto the screen, the heartbeat scheduled on the
   * audio clock and its pulse read back through the phase map, breath and muffle, the bleeding wobble and drip
   * trail, the regen and stim washes, the lens, the glove blood and the HUD's beat.
   */
  function woundLoop(fdt: number): void {
    woundClock += fdt;
    const wTarget = dead ? woundShown : Math.min(1, vitals.w + blastWound * 0.25);
    // In fast (a hit should land on its frame), out over about 1.2 s (S6.3: never snap on regen).
    const tau = wTarget > woundShown ? 0.12 : 0.4;
    woundShown += (wTarget - woundShown) * (1 - Math.exp(-fdt / tau));
    if (stimSlowT >= 0) stimSlowT += fdt;
    const stimSlow = stimSlowT < 0 ? 0 : stimSlowT < WOUND.stimSlowS ? stimSlowT / WOUND.stimSlowS : stimSlowT < 6 ? 1 : Math.max(0, 1 - (stimSlowT - 6) / 3);
    if (stimSlowT > 9) stimSlowT = -1;
    const w = vitals.w;
    // The heart: heard from critical (S6.1), scheduled 120 ms ahead on the audio clock; the frame reads the same clock.
    const audioOn = !!audio && audio.enabled;
    phase.sync(audioOn ? audio!.now : woundClock, woundClock);
    const bpm = !dead && w >= WOUND.heartFromW ? heartBpm(w, stimSlow) : 0;
    const audioT = phase.toAudio(woundClock);
    for (const lub of heart.schedule(audioT, 0.12, bpm)) if (audioOn && fxPrefs.heartbeat) audio!.heartbeat(lub, 0.55 + 0.45 * w);
    pulseNow = bpm > 0 ? heart.pulse(audioT) : pulseNow * Math.exp(-fdt / 0.1);
    if (audioOn) {
      const br = breath(w);
      audio!.wounded(fdt, { muffleHz: muffleHz(dead ? 0 : w * fxLv.muffle), breathHz: br.hz, breathLevel: dead ? 0 : br.level, firing: woundClock - lastFireAt < 0.6, heart: bpm > 0 });
    }
    // Bleeding: a slow roll and a FOV breathe (off under reduced motion or reduced damage effects), and drops on
    // the floor every 1.2 m.
    const wob = wobble(woundClock, w, trauma.reducedMotion || !fxLv.wobble || calm);
    world.camera.rotation.z += wob.roll;
    woundFov = wob.fovMul;
    if (vitals.tier === "bleeding" && !dead && player.onGround) {
      const fp = player.pos;
      if (Math.hypot(fp.x - lastDrip.x, fp.z - lastDrip.z) >= 1.2) {
        lastDrip.copy(fp);
        world.fx.drip?.(fp.clone());
      }
    }
    arsenal.adsSlow = vitals.tier === "critical" || vitals.tier === "bleeding" ? 1.2 : 1;
    regenWash = Math.max(0, regenWash - fdt / 0.3);
    stimWash = Math.max(0, stimWash - fdt / 0.7);
    lens.update(fdt);
    // Glove blood: she has it on her hands while she's wounded; it dries off over about 20 s once she's whole.
    const gloveFloor = vitals.tier === "bleeding" ? 0.55 : 0;
    gloveBloodV = vitals.tier === "fine" ? Math.max(0, gloveBloodV - fdt / 20) : Math.max(gloveBloodV, gloveFloor);
    setGloveBlood(o.intensity === "reduced" ? 0 : gloveBloodV);
    const k = fxLv.grade;
    if (stageWound) {
      woundShown = stageWound.shown;
      pulseNow = stageWound.pulse;
    }
    world.setVitals?.(hurtV * k, hurtDir.x, hurtDir.y, woundShown * k);
    // Reduced motion: the vignette beats in strength only, the ring never closes on the beat (`still`).
    world.setWounded?.({ pulse: pulseNow, regen: regenShown() * k, stim: stimWash * k, lens: lens.slots, wipe: lens.wipe, water: lens.water, fx: fxLv.ca, still: trauma.reducedMotion });
    hud.setWound(pulseNow, dead ? "fine" : vitals.tier);
  }
  /** A stim goes in (S6.3): a green-white edge wash, the heart slows 30 bpm over 2 s, she wipes the lens clean. */
  function onStim(): void {
    stimWash = 1;
    stimSlowT = 0;
    lens.startWipe();
    audio?.stim();
  }
  s.stim = onStim;
  s.dispose = () => life.abort();

  // ---- C8 "Dying, done properly" (S6.6): the body-cam fall, the held moment, the card, Retry in place ----
  const DT = tuning.death;
  const screen = o.warm?.screen ?? new DeathScreen(o.hud.parentElement ?? o.hud);
  screen.onTick = () => audio?.uiTick();
  /** The session has been taken down by a restart: its frame loop stops. */
  let ended = false;
  let restarting = false;
  const sessionT0 = performance.now();
  interface Dying {
    t: number;
    cam: DeathCam;
    killer: Enemy | null;
    killerName: string;
    gun: GunDrop | null;
    cardShown: boolean;
    cardAt: number;
    /** Ms into the re-sync (-1 until Retry). */
    resync: number;
    flares: number;
    splats: number;
    lastPress: boolean;
    /** The killer's visor material and its resting glow (it flares twice as he stands down). */
    visor: THREE.MeshStandardMaterial | null;
    visorBase: number;
    /** The cool light that rims him against the street while she lies there (handed back on Retry). */
    rimOff: (() => void) | null;
  }
  let dying: Dying | null = null;
  let droppedGun: THREE.Object3D | null = null;
  /** Screenshot stages: back to the living, from any death stage. */
  function clearDeath(): void {
    if (dying?.killer) dying.killer.standDown = null;
    if (dying?.visor) dying.visor.emissiveIntensity = dying.visorBase;
    dying?.killer?.body.setRim(0, 0, 0);
    dying?.rimOff?.();
    for (const e of enemies) e.standDown = null;
    dying = null;
    dead = false;
    s.dying = null;
    screen.hide();
    screen.resyncFrame(0, null);
    screen.clearLine();
    world.setDeath?.({ death: 0, ink: 0, glitch: 0, ca: 1 });
    if (droppedGun) world.scene.remove(droppedGun);
    droppedGun = null;
    arsenal.rig.root.visible = true;
    hud.visible = true;
    if (input.isTouch) o.touch.hidden = false;
    resyncT = -1;
    audio?.revive();
  }
  /** The new session's fade from black (ms into the re-sync; -1 when done). */
  let resyncT = o.warm ? o.warm.resyncAt : -1;
  const DEATH_WEAPON: Record<string, string> = { rifle: "Rifle", shield: "SMG", sniper: "Sniper rifle", turret: "Turret", hunter: "Drone gun", orderly: "Shock baton", nurse: "Needle", police: "Drone gun", boss: "Rifle" };
  const causeOf = (k: HurtKind | undefined, e: Enemy | null): DeathCause =>
    k === "blast" ? "blast" : k === "laser" ? "laser" : k === "melee" ? "melee" : e?.kit.role === "sniper" ? "sniper" : k ? "bullet" : "any";
  const mmss = (ms: number) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  /** The checkpoint she goes back to, for the re-sync line. */
  const checkpointLine = (): string => {
    const cp = hud.checkpoint?.();
    return cp === "the walkway" ? "RE-SYNCED · CHECKPOINT 2" : cp === "the flyover" ? "RE-SYNCED · CHECKPOINT 1" : `RE-SYNCED · ${caseName.toUpperCase() || "CHECKPOINT"}`;
  };
  const namesLeft = () => ["crispBoss", "vaneBoss", "pellBoss", "boardBoss", "vaultBoss"].filter((j) => !progress.jobsDone.includes(j)).length;

  /** The killing blow (S6.6 t = 0): input locks, the body cam takes over, the sound and the grade start. */
  function beginDeath(seedOverride?: number): void {
    dead = true;
    const killer = lastHurt?.key instanceof Enemy ? lastHurt.key : null;
    const cam = new DeathCam();
    cam.pitch0 = player.pitch;
    const seed = seedOverride ?? (o.shot ? 0.62 : Math.random());
    const from = lastHurt?.from ?? null;
    cam.start({
      feet: player.pos.clone(),
      eyeHeight: player.eyeHeight,
      yaw: player.yaw,
      vel: player.vel.clone(),
      from,
      share: lastHurt?.share ?? 0.2,
      ground: (x, z) => world.floorAt?.(x, player.pos.y + 0.4, z) ?? world.groundHeight(x, z),
      seed,
      reducedMotion: trauma.reducedMotion || calm,
    });
    const near = killer && killer.alive && killer.position.distanceTo(player.pos) <= DT.killerRangeM ? killer : null;
    if (near) {
      cam.killer = near.body.joints.chest.clone();
      near.standDown = player.pos.clone();
    }
    const cause = causeOf(lastHurt?.kind, killer);
    const dist = killer ? Math.round(killer.position.distanceTo(player.pos)) : 0;
    const by = killer
      ? `${killer.kit.name.toUpperCase()} · ${dist} M · ${(lastHurt?.kind === "melee" ? "Bare hands" : DEATH_WEAPON[killer.kit.role ?? "rifle"] ?? "Rifle").toUpperCase()}`
      : cause === "blast"
        ? "A BLAST"
        : cause === "laser"
          ? "A TRIPWIRE LASER"
          : "UNKNOWN";
    const where = caseName.toUpperCase() || "MARROW";
    screen.fill({
      eyebrow: `Flatlined · File closed · ${mmss(performance.now() - sessionT0)} · ${where}`,
      line: deathLine(cause, (seed * 7.31) % 1),
      stats: [
        ["Killed by", by],
        ["Damage taken", String(Math.round(damageTaken))],
        ["Names left", String(namesLeft())],
      ],
      touch: input.isTouch,
    });
    screen.setKiller(near ? near.kit.name : "");
    const visor = near ? ((near.body.look.visor as THREE.MeshStandardMaterial).isMeshStandardMaterial ? (near.body.look.visor as THREE.MeshStandardMaterial) : null) : null;
    dying = { t: 0, cam, killer: near, killerName: near?.kit.name ?? "", gun: null, cardShown: false, cardAt: 0, resync: -1, flares: 0, splats: 0, lastPress: true, visor, visorBase: visor?.emissiveIntensity ?? 0, rimOff: null };
    // The hit frame: the flare at full, a splat on the hit side.
    hurtV = 1;
    if (from) hurtDir.set(Math.sin(bearingTo(from as THREE.Vector3)), Math.cos(bearingTo(from as THREE.Vector3)));
    // Reduced violence: no lens blood in the death (S6.6), not even its rain stand-in.
    if (o.intensity !== "reduced") lens.splat(hurtDir.x, hurtDir.y, woundClock, true);
    arsenal.triggerHeld = false;
    arsenal.aiming = false;
    audio?.death();
    rumble("hurt");
    s.dying = { ms: 0, card: false, killer: dying.killerName || null };
  }

  /** The gun leaves her hand (S6.6): the viewmodel's gun, moved into the street, thrown toward where she'll look. */
  function dropGun(d: Dying): void {
    const rig = arsenal.rig;
    rig.root.updateMatrixWorld(true);
    const gun = rig.root.clone(true);
    // Only the gun: no gloves, no flash, no sights' glow sprites.
    gun.traverse((c) => {
      if ((c as THREE.SkinnedMesh).isSkinnedMesh || (c as THREE.Bone).isBone || (c as THREE.Light).isLight || (c as THREE.Sprite).isSprite) c.visible = false;
    });
    world.camera.updateMatrixWorld(true);
    const m = new THREE.Matrix4().multiplyMatrices(world.camera.matrixWorld, rig.root.matrixWorld);
    m.decompose(gun.position, gun.quaternion, gun.scale);
    gun.rotation.setFromQuaternion(gun.quaternion);
    world.scene.add(gun);
    droppedGun = gun;
    rig.root.visible = false;
    const toward = new THREE.Vector3(-Math.sin(d.cam.yaw), 0, -Math.cos(d.cam.yaw));
    const side = new THREE.Vector3(-toward.z, 0, toward.x);
    const drop = new GunDrop(gun, (x, z) => world.floorAt?.(x, player.pos.y + 0.4, z) ?? world.groundHeight(x, z), (k, at) => {
      const rel = at.clone().sub(world.camera.position);
      const right = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 0);
      audio?.gunClatter(k, THREE.MathUtils.clamp(rel.normalize().dot(right), -1, 1));
    });
    drop.vel.copy(toward).multiplyScalar(1.1).addScaledVector(side, 0.35).add(new THREE.Vector3(0, 0.6, 0)).addScaledVector(player.vel, 0.5);
    drop.spin.set(5.5, 3.2, -7.5);
    d.gun = drop;
  }

  /** One frame of the death sequence (real dt). */
  function deathFrame(realDt: number, intent: ReturnType<Input["read"]>, stepped = false): void {
    const d = dying!;
    const fdt = o.shot && !stepped ? 0 : realDt;
    if (d.resync >= 0) {
      d.resync += fdt * 1000;
      const rs = resyncState(d.resync);
      const st = deathState(d.t);
      world.setDeath?.({ death: st.death * (rs.ink / DT.ink), ink: rs.ink, glitch: rs.glitch, ca: st.ca, grey: o.intensity === "reduced" });
      screen.resyncFrame(rs.black, null);
      if (!restarting && d.resync >= DT.resync.inkOutMs + DT.resync.glitchMs) void restartFromCheckpoint();
      return;
    }
    // Any press after 900 ms skips to the card.
    const press = intent.fire || intent.takedown || intent.reload || intent.slot >= 0;
    if (!d.cardShown && d.t >= DT.skipMs && press && !d.lastPress) d.t = Math.max(d.t, DT.cardMs);
    d.t += fdt * 1000;
    const st = deathState(d.t);
    // The world: frozen, then a quarter speed, then held still as the frame freezes.
    const wdt = fdt * st.worldScale;
    combat.update(wdt, build());
    const sight = sightOf();
    for (const e of enemies) {
      e.update(wdt, sight, rays, world.colliders, ground);
      e.body.updateFlash(fdt * 1000);
      e.shots.length = 0;
    }
    drainEvents();
    time += wdt;
    world.update(wdt, o.shot ? 1 : time, st.t >= DT.freezeMs ? 0 : fdt * Math.max(0.25, st.worldScale));
    // The body cam.
    if (d.killer?.alive) d.cam.killer = d.killer.body.joints.chest.clone();
    d.cam.update(fdt);
    world.camera.position.copy(d.cam.pos);
    world.camera.rotation.set(d.cam.pitch, d.cam.yaw, d.cam.roll, "YXZ");
    // As she lands, the lens pushes in on him (700 to 1400 ms) until he stands about 40% of the frame tall: at fighting range he
    // is a man, not a dot (a slow telephoto push, the eye finding him).
    const push = d.killer ? Math.min(1, Math.max(0, (d.t - DT.pushFromMs) / DT.pushMs)) : 0;
    let fovK = st.fov;
    if (d.killer) {
      const dist = Math.max(2, d.killer.position.distanceTo(world.camera.position));
      fovK = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(DT.killerFrameM / dist)), DT.killerFov[0], DT.killerFov[1]);
    }
    world.camera.fov = st.fov - (st.fov - Math.min(st.fov, fovK)) * push * push * (3 - 2 * push);
    world.camera.updateProjectionMatrix();
    // The gun drops out of her hand at 120 ms and lands at 500 to 800 ms.
    if (!d.gun && d.t >= DT.gunDropMs) dropGun(d);
    d.gun?.update(fdt);
    arsenal.rig.root.visible = false;
    // The killer: his visor flares twice as he stands down over her (900 ms, 1150 ms), and from the moment she's
    // down a cool light behind and above him cuts his outline out of the street (S6.6: the camera frames him).
    if (d.killer) {
      const want = d.t >= 1150 ? 2 : d.t >= DT.fallEndMs ? 1 : 0;
      while (d.flares < want) d.flares++;
      if (d.visor) {
        const f = (at: number) => (d.t >= at ? Math.exp(-(d.t - at) / 140) : 0);
        d.visor.emissiveIntensity = d.visorBase * (1 + 3 * (f(DT.fallEndMs) + f(1150)));
      }
      // The rim comes up as she lands (500 to 900 ms) and holds.
      const rimK = Math.min(1, Math.max(0, (d.t - 500) / 400));
      // Edge-only (body.ts): the suit stays dark, outlined in a cold line, not lit into a pale mannequin.
      d.killer.body.setRim(0.16 * rimK, 0.27 * rimK, 0.46 * rimK);
      if (!d.rimOff && d.t >= 500 && worldLight) {
        const k = d.killer.position;
        const away = new THREE.Vector3(k.x - player.pos.x, 0, k.z - player.pos.z).normalize();
        d.rimOff = worldLight(k.clone().addScaledVector(away, 1.6).add(new THREE.Vector3(0, 2.4, 0)), new THREE.Color(0.55, 0.72, 1), 6, 5.5);
      }
    }
    // Two more splats on the lens during the fall (300 ms, 600 ms).
    const splatsWant = d.t >= 600 ? 2 : d.t >= 300 ? 1 : 0;
    while (d.splats < splatsWant) {
      d.splats++;
      if (o.intensity !== "reduced") lens.splat(d.splats === 1 ? -hurtDir.y : hurtDir.x * 0.6, d.splats === 1 ? hurtDir.x : -0.7, woundClock, true);
    }
    woundClock += fdt;
    lens.update(fdt);
    hurtV *= Math.exp(-fdt / 0.6);
    const k = fxLv.grade;
    world.setVitals?.(hurtV * k, hurtDir.x, hurtDir.y, woundShown * k * (1 - st.death));
    world.setWounded?.({ pulse: 0, regen: 0, stim: 0, lens: lens.slots, wipe: -1, water: lens.water, fx: fxLv.ca, still: true });
    world.setDeath?.({ death: st.death, ink: st.ink, glitch: 0, ca: 1 + (st.ca - 1) * fxLv.ca, grey: o.intensity === "reduced" });
    hud.visible = d.t < DT.stopMs;
    // The touch controls go with the HUD: nothing to press but the card's own actions.
    if (input.isTouch) o.touch.hidden = d.t >= DT.stopMs;
    screen.update({ bars: st.bars, killer: d.killerName ? st.killer : 0, card: st.card });
    if (st.card > 0 && !d.cardShown) {
      d.cardShown = true;
      d.cardAt = d.t;
      audio?.deathSting();
      document.exitPointerLock?.();
    }
    if (d.cardShown) {
      const pad = input.padActive ? navigator.getGamepads?.().find((g) => g && g.connected) : null;
      if (pad?.buttons[0]?.pressed) retry();
      else if (pad?.buttons[1]?.pressed) quitToTitle();
      else if (d.t - d.cardAt >= DT.cardRetryAfterMs && intent.fire && !d.lastPress) retry();
    }
    d.lastPress = press;
    s.dying = { ms: d.t, card: d.cardShown, killer: d.killerName || null, gun: d.gun ? d.gun.obj.position.toArray() : null };
  }

  /** Retry (S6.6): the ink recedes, a glitch, then black while the job is rebuilt; the next session fades in. */
  function retry(): void {
    const d = dying;
    if (!d || d.resync >= 0) return;
    input.lock();
    d.resync = 0;
    screen.hide();
    audio?.resync();
  }
  /** Quit to title: back to the front door (a fresh page there: the world isn't kept). */
  function quitToTitle(): void {
    ended = true;
    location.assign(location.pathname);
  }
  screen.onRetry = retry;
  screen.onQuit = quitToTitle;
  addEventListener(
    "keydown",
    (e) => {
      if (!dying?.cardShown || dying.resync >= 0) return;
      if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
        e.preventDefault();
        // Enter and Space both activate the focused action (the bar shows which); Esc is Quit's shortcut.
        if (screen.focused === 1) quitToTitle();
        else retry();
      } else if (e.code === "Escape") quitToTitle();
      else if (e.code === "ArrowDown" || e.code === "ArrowUp" || e.code === "Tab" || e.code === "KeyS" || e.code === "KeyW") {
        e.preventDefault();
        screen.focus(e.code === "ArrowUp" || e.code === "KeyW" ? 0 : e.code === "Tab" ? 1 - screen.focused : 1);
      }
    },
    lifeOpt,
  );
  // A tap on the left half of the card's screen retries (S6.6), away from the buttons.
  screen.root.addEventListener(
    "pointerdown",
    (e) => {
      if (!dying?.cardShown || dying.resync >= 0 || !input.isTouch) return;
      if ((e.target as Element | null)?.closest?.("button")) return;
      if (e.clientX < innerWidth / 2) retry();
    },
    lifeOpt,
  );

  /** Takes this session out of the world: listeners, input, everything it added to the scenes, its lights and FX. */
  function teardown(): void {
    ended = true;
    life.abort();
    input.dispose();
    worldOff?.();
    for (const rm of leasedLights.splice(0)) rm();
    // What the world keeps (its own materials and textures, shared with some of the session's objects) is never disposed.
    const keepMats = new Set<THREE.Material>();
    const keepTex = new Set<THREE.Texture>();
    for (const [sc, keep] of [
      [world.scene, baseline.scene],
      [world.viewScene, baseline.view],
    ] as const) {
      for (const c of sc.children) {
        if (!keep.has(c)) continue;
        c.traverse((n) => {
          const m = (n as THREE.Mesh).material;
          for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) {
            keepMats.add(mat);
            for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) keepTex.add(v as THREE.Texture);
          }
        });
      }
    }
    for (const [sc, keep] of [
      [world.scene, baseline.scene],
      [world.viewScene, baseline.view],
    ] as const) {
      for (const c of [...sc.children]) {
        if (keep.has(c)) continue;
        sc.remove(c);
        c.traverse((n) => {
          const m = n as THREE.Mesh;
          m.geometry?.dispose?.();
          // Per-body materials (body.ts, enemy.ts) and their textures go too, or every Retry leaks GPU programs' state.
          for (const mat of m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []) {
            if (keepMats.has(mat)) continue;
            for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture && !keepTex.has(v as THREE.Texture)) (v as THREE.Texture).dispose();
            mat.dispose();
          }
        });
      }
    }
    world.colliders.length = 0;
    world.colliders.push(...baseline.colliders);
    if (world.cover && baseline.cover) {
      world.cover.mats.length = baseline.cover.mats;
      world.cover.obbs.length = baseline.cover.obbs;
      world.cover.thin.length = baseline.cover.thin;
    }
    world.fx.clear?.();
    world.setDrama(0);
    setGloveBlood(0);
  }

  /** S6.6 Retry without a page reload: rebuild from the saved checkpoint in this world, as a fresh resume. */
  async function restartFromCheckpoint(): Promise<void> {
    if (restarting && ended) return;
    restarting = true;
    const t0 = performance.now();
    const line = checkpointLine();
    const at = dying ? Math.max(dying.resync, DT.resync.inkOutMs + DT.resync.glitchMs) : DT.resync.inkOutMs + DT.resync.glitchMs;
    screen.resyncFrame(1, null);
    teardown();
    audio?.revive();
    await startSession({ ...o, warm: { world, audio, into: s, screen, baseline, deaths: (s.deaths ?? 0) + 1, resyncAt: at, resyncLine: line, t0 } });
  }
  s.restartFromCheckpoint = restartFromCheckpoint;
  // Interleaved rounds and medians: SwiftShader's timing swings 30% between back-to-back runs.
  // The verdict is the median of 11 paired rounds (each round's busy time over its own idle time, alternating
  // which runs first so drift can't favour one side), with the spread (the 25th and 75th percentile ratios)
  // reported beside it: one lucky round can't pass it.
  s.benchGrade = (n, rounds = 11) => {
    const off: number[] = [];
    const on: number[] = [];
    const ratio: number[] = [];
    for (let r = 0; r < rounds; r++) {
      let a: number;
      let b: number;
      if (r % 2) {
        b = world.benchGrade?.(n, true) ?? 0;
        a = world.benchGrade?.(n, false) ?? 0;
      } else {
        a = world.benchGrade?.(n, false) ?? 0;
        b = world.benchGrade?.(n, true) ?? 0;
      }
      off.push(a);
      on.push(b);
      ratio.push(b / Math.max(1e-6, a));
    }
    const q = (arr: number[], f: number) => [...arr].sort((x, y) => x - y)[Math.min(arr.length - 1, Math.floor(arr.length * f))]!;
    const mOff = q(off, 0.5);
    return { off: mOff, on: mOff * q(ratio, 0.5), spread: [q(ratio, 0.25) - 1, q(ratio, 0.75) - 1], rounds };
  };

  /** A blast within 6 m (S6.2): tinnitus, the world muffled, the wound grade up for 1.5 s. */
  function blastNear(at: THREE.Vector3): void {
    const d = at.distanceTo(eye);
    if (d > 6 || dead) return;
    audio?.blastNear(d);
    blastWound = 1;
    trauma.add(0.25 * (1 - d / 6));
  }

  function bearingTo(at: THREE.Vector3): number {
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    let b = yaw - Math.atan2(-(at.x - player.pos.x), -(at.z - player.pos.z));
    while (b > Math.PI) b -= Math.PI * 2;
    while (b < -Math.PI) b += Math.PI * 2;
    return b;
  }

  function threats() {
    const out: Array<{ bearing: number; amount: number; hunting: boolean }> = [];
    // A screenshot stage shows only its hit: the guard the round just alerted draws no threat arc.
    if (staged) return out;
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    for (const e of enemies) {
      if (!e.alive || e.detect < 0.04) continue;
      const a = Math.atan2(-(e.position.x - player.pos.x), -(e.position.z - player.pos.z));
      let b = yaw - a;
      while (b > Math.PI) b -= Math.PI * 2;
      while (b < -Math.PI) b += Math.PI * 2;
      out.push({ bearing: b, amount: e.detect, hunting: e.state === "combat" });
    }
    return out;
  }

  let lastBark = -99;
  // The HUD and audio hear combat only through the bus (S0): hits, blocked rounds and shots are queued as
  // they're emitted and confirmed once per frame in drainEvents, so several pellets confirm as one.
  const frameHits: HitEvent[] = [];
  let frameBlocks = 0;
  /** Where the last round landed (the stage hooks project it for the C2 blood probe). */
  let lastHitPoint: THREE.Vector3 | null = null;
  combat.bus.on("hit", (h) => {
    frameHits.push(h);
    lastHitPoint = new THREE.Vector3(h.point.x, h.point.y, h.point.z);
  });
  combat.bus.on("blocked", () => frameBlocks++);
  combat.bus.on("fire", () => rumble("fire"));
  // The last enemy of the encounter (S1.4, S1.5): the world holds 120 ms, then runs at 0.35x for 700 ms and
  // ramps back over 250 ms, with the grade deepening while it lasts. Not during the kill-cam (it has its own).
  // The bus fires "kill" inside combat.fire(), before the shot's kill-cam starts, so the slow motion waits for
  // drainEvents (same frame, after killcam.start) to see whether a kill-cam took the moment. The kill's trauma
  // and rumble come from killConfirm on the lethal hit; this adds only the slow motion.
  let lastKillPending = false;
  combat.bus.on("kill", (k) => {
    if (k.last) lastKillPending = true;
  });
  const lastEnemySlowmo = () => {
    if (!lastKillPending) return;
    lastKillPending = false;
    if (!killcam.active) {
      const L = tuning.lastEnemySlowmo;
      timescale.hitStop(tuning.hitStop.lastEnemy);
      timescale.push("lastEnemy", L.scale, tuning.hitStop.lastEnemy + L.holdMs, 0, L.rampOutMs, "focus");
    }
    combat.bus.emit("encounterCleared", { t: combat.clock });
  };
  const byUid = (uid: string) => enemies.find((e) => String(e.id) === uid);
  const camRight = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const toHit = new THREE.Vector3();
  function drainEvents(): void {
    lastEnemySlowmo();
    for (const k of combat.kills) {
      onKill(k);
      if (k.severed.length) audio?.sever();
    }
    // Every hit: a marker by class, a dry confirm, a hit-stop from the table, and on a kill the FOV punch,
    // trauma and the target bar's collapse (S1.2 to S1.5). Several pellets in one frame confirm once, as
    // the best class among them.
    const rank = ["pen", "body", "armour", "armourBreak", "head", "kill", "headKill"] as const;
    let best: { cls: (typeof rank)[number]; d: HitEvent } | null = null;
    if (frameHits.length) {
      world.camera.getWorldPosition(camPos);
      camRight.setFromMatrixColumn(world.camera.matrixWorld, 0).normalize();
    }
    for (const d of frameHits) {
      const cls = hitClass(d);
      if (!best || rank.indexOf(cls) > rank.indexOf(best.cls)) best = { cls, d };
      const e = byUid(d.targetUid);
      if (e) hud.targetHit(e.kit.name, e.hp / e.kit.maxHp, d.lethal);
      // The wet thud sits in the world where the round landed, panned to its side.
      toHit.set(d.point.x, d.point.y, d.point.z).sub(camPos);
      const dist = toHit.length();
      audio?.hitFlesh(d.damage > 40, dist > 0.01 ? toHit.dot(camRight) / dist : 0, dist);
    }
    frameHits.length = 0;
    if (best) {
      const d = best.d;
      hud.hitMarker(best.cls);
      audio?.confirm(confirmSound(best.cls));
      const auto = AUTOMATIC.has(d.weaponCls);
      const stop = hitStopMs(d);
      if (d.lethal) killConfirm(stop, auto);
      else {
        timescale.hitStop(stop, auto);
        rumble("hit");
      }
    }
    if (frameBlocks > 0) {
      hud.blocked();
      audio?.blocked();
    }
    frameBlocks = 0;
    combat.blocks = 0;
    combat.blockEvents.length = 0;
    // A near miss can make them shout (S1.1); subtitled, at most every six seconds.
    if (combat.barks.length && combat.clock - lastBark > 6) {
      lastBark = combat.clock;
      const who = combat.barks[0]!.kit.name;
      hud.subtitle(`${who}: ${BARKS[Math.floor(Math.random() * BARKS.length)]}`);
    }
    combat.barks.length = 0;
    combat.kills.length = 0;
    combat.hits.length = 0;
  }

  function render(): void {
    const t0 = performance.now();
    world.render();
    perfPanel?.update();
    s.stats.ms = s.stats.ms * 0.9 + (performance.now() - t0) * 0.1;
    s.stats.frames++;
  }

  // ---- screenshot stages and debug hooks (S0) ----
  let coverLines: THREE.LineSegments | null = null;
  const showCover = (on: boolean) => {
    if (on && !coverLines) world.scene.add((coverLines = coverWireframe(rays)));
    if (coverLines) coverLines.visible = on;
  };
  if (new URLSearchParams(location.search).get("debug") === "cover") showCover(true);
  let stageCrate: THREE.Mesh | null = null;
  let stageHome: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  let stageGuard: Enemy | null = null;
  let crateCollider: { off?: boolean } | null = null;
  // C4 "Kestrel 9, built like a real gun": the pistol at rest, aimed, and mid-inspect, in the street where the
  // stages start (the viewmodel has its own light, so where she looks doesn't change the gun's exposure).
  // pistol-alley is the acceptance's "dark alley": the first alley off the market (z 21-25), at its mouth,
  // facing the dumpster corner away from the door's caged bulb, the only light back there.
  // C5 "Kestrel 9 in motion": the shot at 0, 20 and 45 ms, the lock, the reloads, the draws, the press-check.
  const C4_STAGES = ["pistol-idle", "pistol-ads", "pistol-inspect", "pistol-alley", "pistol-fire", "pistol-fire-ads", "pistol-lock", "pistol-reload", "pistol-reload-empty", "pistol-draw", "pistol-hero", "pistol-presscheck", "pistol-reload-cancel", "pistol-presscheck-cancel"];
  const c4Stage = (name: string, tMs: number): string => {
    staged = true;
    hud.freeze(null);
    hud.clearFeedback();
    showCover(false);
    pickups.clear();
    world.fx.clear?.();
    arsenal.freeze = false;
    arsenal.restock();
    arsenal.owned.add("kestrel");
    arsenal.equipId("kestrel");
    arsenal.settle();
    droppedMags.clear();
    if (stageHome) {
      player.pos.copy(stageHome.pos);
      player.yaw = stageHome.yaw;
      player.pitch = stageHome.pitch;
    }
    if (name === "pistol-alley") {
      player.pos.set(-16.5, ground(-16.5, 21.9), 21.9);
      player.yaw = Math.PI / 2 - 0.3;
      player.pitch = -0.05;
    }
    player.vel.set(0, 0, 0);
    for (const e of enemies) {
      if (e.alive && e.state !== "dead") e.state = "unaware";
      e.detect = 0;
    }
    s.hp = s.maxHp;
    const aimed = name === "pistol-ads" || name === "pistol-fire-ads";
    arsenal.holdAim = aimed;
    arsenal.inspectHold = name === "pistol-inspect" ? (tMs > 60 ? tMs : 900) : -1;
    arsenal.anim.aim = aimed ? 1 : 0;
    // The loop sets this from input each frame; the settle below must aim too, or it blends the gun back to the hip.
    arsenal.aiming = arsenal.holdAim;
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    // The gun settles into its pose (springs, the aim blend, the inspect's moment) before the frame is held.
    const poseOnce = (dt: number) => arsenal.pose(dt, { yaw: 0, pitch: 0 }, 0, 0, false, 0, world.viewCamera, BASE_FOV);
    arsenal.setView(world.camera.getWorldPosition(camPosV), world.camera.getWorldQuaternion(camQuatV));
    for (let i = 0; i < 90; i++) poseOnce(1 / 60);
    // C5: the moment itself, set after the gun has settled, then held (time is frozen in a shot).
    const C5 = name.startsWith("pistol-") && !["pistol-idle", "pistol-ads", "pistol-inspect", "pistol-alley"].includes(name);
    if (C5) {
      const t = Math.max(0, tMs);
      if (name === "pistol-fire" || name === "pistol-fire-ads") {
        arsenal.stageFire();
        // Step the clip and the springs through the stage's milliseconds in small steps.
        const n = Math.max(1, Math.ceil(t / 4));
        poseOnce(0);
        for (let i = 0; i < n && t > 0; i++) poseOnce(t / n / 1000);
        arsenal.stageTime(t);
      } else if (name === "pistol-lock") arsenal.stageLock();
      else if (name === "pistol-reload") arsenal.stageReload("tac", t);
      else if (name === "pistol-reload-empty") arsenal.stageReload("empty", t);
      else if (name === "pistol-draw" || name === "pistol-hero") arsenal.stageDraw(t, name === "pistol-hero");
      else if (name === "pistol-presscheck") arsenal.stagePress(t);
      else if (name === "pistol-reload-cancel" || name === "pistol-presscheck-cancel") {
        // The fire-to-cancel blend (S2.4): the reload at 400 ms (the press-check at 700), cut, then `t` ms on.
        if (name === "pistol-reload-cancel") arsenal.stageReload("tac", 400);
        else arsenal.stagePress(700);
        poseOnce(1 / 60);
        arsenal.stageCancel();
        const n = Math.max(1, Math.ceil(t / 4));
        for (let i = 0; i < n && t > 0; i++) poseOnce(t / n / 1000);
      }
      arsenal.freeze = true;
      poseOnce(1 / 60);
      arsenal.freeze = !!o.shot;
      arsenal.cues.length = 0;
      s.pistolInfo = pistolInfo();
    } else s.pistolInfo = pistolInfo();
    hud.freeze(tMs);
    return "ok";
  };
  /** C5 acceptance: the Kestrel's parts and where its muzzle and slide land on screen (CSS px). */
  const pistolInfo = (): Record<string, unknown> => {
    const r = arsenal.rig;
    const P = r.parts;
    r.root.updateMatrixWorld(true);
    const c = world.renderer.domElement;
    const scr = (v: THREE.Vector3) => {
      const p = v.clone().project(world.viewCamera);
      return { x: ((p.x + 1) / 2) * c.clientWidth, y: ((1 - p.y) / 2) * c.clientHeight };
    };
    const mz = r.muzzle.getWorldPosition(new THREE.Vector3());
    const side = mz.clone().add(new THREE.Vector3(0.05, 0, 0));
    const m = scr(mz);
    const ms = scr(side);
    // The slide's rear face now and where it sits at rest (its parent's frame): the visible travel on screen.
    const slide = P.slide!;
    const rear = slide.localToWorld(new THREE.Vector3(0, 0.03, 0.036));
    const home = slide.parent!.localToWorld(new THREE.Vector3(slide.position.x, slide.position.y + 0.03, 0.036));
    const fm = r.flashMesh;
    let puffM = 0;
    if (fm && fm.visible) {
      // Its own width across the bore (x and y in its frame, times its scale): a world box of the tilted mesh
      // measures the gun's cant, not the puff.
      const m = fm as THREE.Mesh;
      m.geometry.computeBoundingBox();
      const sz = m.geometry.boundingBox!.getSize(new THREE.Vector3());
      const sc = m.getWorldScale(new THREE.Vector3());
      puffM = Math.max(sz.x * sc.x, sz.y * sc.y);
    }
    const st = arsenal.pistolState;
    return {
      ...st,
      slideMm: slide.position.z * 1000,
      slidePx: Math.hypot(scr(rear).x - scr(home).x, scr(rear).y - scr(home).y),
      stopDeg: ((P.slideStop?.rotation.x ?? 0) * 180) / Math.PI,
      hammerDeg: ((P.hammer?.rotation.x ?? 0) * 180) / Math.PI,
      barrelDeg: ((P.barrel?.rotation.x ?? 0) * 180) / Math.PI,
      magOffMm: (r.mag?.position.length() ?? 0) * 1000,
      magVisible: r.mag?.visible ?? false,
      magRound: P.magRound?.visible ?? false,
      chamberRound: P.chamberRound?.visible ?? false,
      flashOn: !!fm?.visible,
      puffM,
      smoke: arsenal.smoke.count,
      muzzle: m,
      muzzleR05: Math.hypot(ms.x - m.x, ms.y - m.y),
      ammo: arsenal.ammo,
    };
  };
  /**
   * C4 acceptance probe: renders the viewmodel alone as flat masks (hands and arms, the slide, the rest of the
   * gun) and returns the hands' share of viewmodel pixels, and the slide's mean luminance in the real frame.
   */
  s.dotProbe = () => {
    const dot = arsenal.rig.parts.reddot;
    if (!dot) return null;
    arsenal.rig.root.updateMatrixWorld(true);
    const v = dot.localToWorld(new THREE.Vector3(KESTREL_DOT[0] - dot.position.x, KESTREL_DOT[1] - dot.position.y, KESTREL_DOT[2] - dot.position.z)).project(world.viewCamera);
    const c = world.renderer.domElement;
    return { x: ((v.x + 1) / 2) * c.clientWidth, y: ((1 - v.y) / 2) * c.clientHeight, cx: c.clientWidth / 2, cy: c.clientHeight / 2, aim: arsenal.anim.aim };
  };
  s.opticProbe = () => {
    const dot = arsenal.rig.parts.reddot;
    if (!dot || !dot.visible) return null;
    arsenal.rig.root.updateMatrixWorld(true);
    const c = world.renderer.domElement;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    // The housing in the dot mount's own frame: 25 mm wide, 24 mm tall, from 18 mm ahead to 30 mm behind (the
    // emitter bump and the rear sight).
    for (const px of [-0.0135, 0.0135])
      for (const py of [-0.002, 0.024])
        for (const pz of [-0.018, 0.03]) {
          const v = dot.localToWorld(new THREE.Vector3(px, py, pz)).project(world.viewCamera);
          const sx = ((v.x + 1) / 2) * c.clientWidth;
          const sy = ((1 - v.y) / 2) * c.clientHeight;
          x0 = Math.min(x0, sx);
          y0 = Math.min(y0, sy);
          x1 = Math.max(x1, sx);
          y1 = Math.max(y1, sy);
        }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  s.vmProbe = (rects = []) => {
    render();
    const r = world.renderer;
    const c = r.domElement;
    const w = c.width;
    const h = c.height;
    // The real frame's pixels first (the canvas as shown, post and all).
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g2 = cv.getContext("2d", { willReadFrequently: true })!;
    g2.drawImage(c, 0, 0, w, h);
    const frame = g2.getImageData(0, 0, w, h).data;
    const rt = new THREE.WebGLRenderTarget(w, h);
    const flat = (col: number) => new THREE.MeshBasicMaterial({ color: col });
    const mats = { arm: flat(0xff0000), slide: flat(0x00ff00), gun: flat(0x0000ff) };
    const saved: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const slide = arsenal.rig.parts.slide;
    const isUnder = (o: THREE.Object3D, p?: THREE.Object3D) => {
      for (let q: THREE.Object3D | null = o; q; q = q.parent) if (q === p) return true;
      return false;
    };
    const hidden: THREE.Object3D[] = [];
    world.viewScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Smoke and the crown's glow aren't the gun (C5): out of the mask.
      if (m.name.startsWith("vm:") && m.visible) {
        m.visible = false;
        hidden.push(m);
        return;
      }
      saved.push([m, m.material]);
      m.material = (m as THREE.SkinnedMesh).isSkinnedMesh ? mats.arm : slide && isUnder(m, slide) && m.userData.kit === "opaque" ? mats.slide : mats.gun;
    });
    const bg = world.viewScene.background;
    world.viewScene.background = null;
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(world.viewScene, world.viewCamera);
    const px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(rt, 0, 0, w, h, px);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    world.viewScene.background = bg;
    for (const [m, mat] of saved) m.material = mat;
    for (const m of hidden) m.visible = true;
    for (const m of Object.values(mats)) m.dispose();
    rt.dispose();
    let arm = 0;
    let all = 0;
    let slideN = 0;
    let lum = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (px[o + 3]! < 128) continue;
        all++;
        if (px[o]! > 128) arm++;
        else if (px[o + 1]! > 128) {
          slideN++;
          // The render target is bottom-up; the canvas copy is top-down.
          const f = ((h - 1 - y) * w + x) * 4;
          lum += (0.2126 * frame[f]! + 0.7152 * frame[f + 1]! + 0.0722 * frame[f + 2]!) / 255;
        }
      }
    // C4 review: how much of the viewmodel lands inside each HUD box (CSS px in, the share of the box out).
    const sx = w / c.clientWidth;
    const sy = h / c.clientHeight;
    const inRects = rects.map((b) => {
      const x0 = Math.max(0, Math.floor(b.x * sx));
      const x1 = Math.min(w, Math.ceil((b.x + b.w) * sx));
      const y0 = Math.max(0, Math.floor(b.y * sy));
      const y1 = Math.min(h, Math.ceil((b.y + b.h) * sy));
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) if (px[((h - 1 - y) * w + x) * 4 + 3]! >= 128) n++;
      const area = Math.max(1, (x1 - x0) * (y1 - y0));
      return n / area;
    });
    return { handShare: all ? arm / all : 0, slideLum: slideN ? lum / slideN : 0, vmPx: all, slidePx: slideN, inRects };
  };
  // C3 "You can't miss the first gun": the first job's case and the HUD around it (needs ?job).
  const C3_STAGES = ["pickup-first-from-takedown", "pickup-prompt", "objective-offscreen", "hud-combat", "pickup-taken"];
  const c3Stage = (name: string, tMs: number): string => {
    if (!job) return "no job (load with &job)";
    hud.freeze(null);
    hud.clearFeedback();
    showCover(false);
    pickups.clear();
    world.fx.clear?.();
    // Stage hygiene: enemies a stage reset kills (skipTo clears the wave) are props of the previous shot, not
    // bodies she dropped: they leave the frame instead of piling up corpses (and draw calls) between stages.
    // (The first guard, downed by a reset from stage 1, is the takedown's body and stays.)
    const wasAlive = job.stage >= 3 ? enemies.filter((e) => e.alive) : [];
    if (name === "pickup-taken") {
      // The moment after the press: the lid shut, the toast in, the Kestrel drawn.
      if (job.stage !== 2) job.skipTo(2);
      const taken = job.case;
      taken?.take();
      taken?.update(0.25);
      job.skipTo(3);
    } else if (name === "hud-combat") {
      if (job.stage !== 3) job.skipTo(3);
    } else if (job.stage !== 2) job.skipTo(2);
    for (const e of wasAlive)
      if (!e.alive) {
        e.body.root.visible = false;
        e.rifle.visible = false;
      }
    for (const e of enemies) {
      if (e.alive && e.state !== "dead") e.state = "unaware";
      e.detect = 0;
    }
    s.hp = s.maxHp;
    // She stands where the takedown left her, looking the way she was looking: down the street.
    const ground0 = ground(TAKEDOWN_POSE.x, TAKEDOWN_POSE.z);
    player.pos.set(TAKEDOWN_POSE.x, ground0, TAKEDOWN_POSE.z);
    player.yaw = TAKEDOWN_POSE.yaw;
    player.pitch = -0.04;
    const box = job.case;
    if (name === "pickup-prompt" && box) {
      // Two metres short of the case, looking at it.
      const to = new THREE.Vector3(box.pos.x - player.pos.x, 0, box.pos.z - player.pos.z);
      const d = to.length();
      to.normalize();
      player.pos.addScaledVector(to, Math.max(0, d - 2.1));
      player.pos.y = ground(player.pos.x, player.pos.z);
      player.yaw = Math.atan2(-to.x, -to.z);
      player.pitch = -0.32;
    }
    // Turned away from it: the arrow on the screen's edge has to bring her round.
    if (name === "objective-offscreen") player.yaw = TAKEDOWN_POSE.yaw - 2.1;
    if (name === "hud-combat" || name === "pickup-taken") {
      arsenal.restock();
      if (arsenal.weapon.id !== "kestrel") {
        arsenal.owned.add("kestrel");
        arsenal.equipId("kestrel");
      }
      arsenal.settle();
    }
    player.vel.set(0, 0, 0);
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    // The guard she put down settles where he fell.
    for (let t = 0; t < 1.2; t += 1 / 60) {
      for (const e of enemies) e.feel(1 / 60, world.colliders, ground);
      world.update(0, 1, 1 / 60);
    }
    staged = true;
    // The beacon at its moment: the glint mid-flash, the beam for where she stands (time is frozen in a shot).
    box?.update(0.175, player.pos, world.camera, innerWidth, innerHeight, hudScale);
    const at = box ? box.gunAt.clone() : null;
    if (name === "pickup-taken") hud.toast("New weapon", "Kestrel 9", "Checkpoint saved");
    // The combat HUD on its own: no toast or feed lines left from arming her.
    if (name === "hud-combat") hud.clearFeedback();
    const v = at?.clone().project(world.camera);
    const z0 = { x: 0, y: 0 };
    // The beam's projected column (from 0.3 m over the case to 1.8 m up) and its half-width on screen, so the
    // shots can check it actually reads (a luminance probe), not just that it's in frame.
    let beam: { x0: number; y0: number; x1: number; y1: number; r: number } | undefined;
    if (box && box.beacon.beam.parent && box.beacon.beam.visible) {
      const b0 = box.beacon.beam.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
      const b1 = b0.clone().add(new THREE.Vector3(0, 1.5, 0));
      const p0 = toScreen(b0);
      const p1 = toScreen(b1);
      const side = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 0).multiplyScalar(beamLook(o.quality === "phone" ? "phone" : "desktop").radius);
      const pr = toScreen(b0.clone().add(side));
      beam = { x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, r: Math.max(1, Math.hypot(pr.x - p0.x, pr.y - p0.y)) };
    }
    s.stageInfo = { hit: z0, r02: 0, head0: z0, head1: z0, puffM: 0, splats: [], corpse: { pelvis: z0, head: z0, chest: z0 }, caseAt: at && v ? { ...toScreen(at), front: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 } : undefined, beam };
    hud.freeze(tMs);
    return "ok";
  };
  const STAGES = ["hit-body", "hit-head", "hit-kill", "hit-headkill", "hit-soft", "hit-pen", "hit-armourbreak", "blocked", "peek-head", "cover-debug-market", "enemy-flinch-head-60", "wall-splat"];
  /** A world point on screen, in CSS px. */
  const toScreen = (p: THREE.Vector3) => {
    const v = p.clone().project(world.camera);
    const c = world.renderer.domElement;
    return { x: ((v.x + 1) / 2) * c.clientWidth, y: ((1 - v.y) / 2) * c.clientHeight };
  };
  /** A stage starts with her whole and still: no flinch ringing, no flare, no grenade, full Guard and Flesh. */
  const calmVitals = () => {
    if (dead || dying || resyncT >= 0) clearDeath();
    for (const sp of Object.values(flinch)) {
      sp.x = 0;
      sp.v = 0;
    }
    hurtV = 0;
    blastWound = 0;
    stageNades = null;
    trauma.value = 0;
    vitals.reset(s.maxHp);
    s.hp = vitals.total;
    world.setVitals?.(0, 0, 1, 0);
    heart.reset();
    lens.clear();
    woundShown = 0;
    regenWash = stimWash = 0;
    stimSlowT = -1;
    pulseNow = 0;
    gloveBloodV = 0;
    setGloveBlood(0);
    woundFov = 1;
    stageWound = null;
    world.setWounded?.({ pulse: 0, regen: 0, stim: 0, lens: lens.slots, wipe: -1 });
    hud.setWound(0, "fine");
  };
  // C6 "I know I'm hit": a hit from 90 degrees right, one from behind, the hit that breaks Guard, and a live
  // grenade 3 m off to the front left, each held `tMs` after the moment, in the street the pistol stages use.
  const C6_STAGES = ["player-hurt-100", "player-hurt-behind", "vitals-guardbreak", "grenade-near", "player-hurt-melee", "player-hurt-critical"];
  // C7 "Wounded": the four states of the wounded loop, each held `tMs` after its moment (S6.3).
  //   vitals-hurt      Flesh 45%, Guard whole: no heart yet, the edges just starting to go;
  //   vitals-critical  Flesh 20% after a heavy hit from the right: the heart on its beat, blood on the lens, she
  //                    clutched the wound so the glove is bloody;
  //   vitals-bleeding  Flesh 5%: everything at its worst, two splats, the bar swelling on the beat;
  //   vitals-regen     Flesh 25% and Guard coming back, 300 ms in: the cyan breath along the edge.
  const C7_STAGES = ["vitals-hurt", "vitals-critical", "vitals-bleeding", "vitals-regen"];
  const c7Setup = (name: string, tMs: number): void => {
    const maxT = vitals.maxTotal;
    const at = (fleshShare: number, guardShare: number) => {
      vitals.flesh = vitals.maxFlesh * fleshShare;
      vitals.guard = vitals.maxGuard * guardShare;
      s.hp = vitals.total;
      hud.primeVitals(vitals.guardFrac, vitals.fleshFrac);
    };
    const age = tMs / 1000;
    if (name === "vitals-hurt") {
      at(0.45, 1);
      stageWound = { shown: vitals.w, pulse: 0 };
      return;
    }
    if (name === "vitals-critical") {
      at(0.2 + (0.1 * maxT) / vitals.maxFlesh, 0);
      hitsTaken = 2;
      cathHurt(0.95, false, maxT * 0.1);
      gloveBloodV = 0.7;
      for (const sl of lens.slots) if (sl.age >= 0) sl.age = age;
      stageWound = { shown: vitals.w, pulse: 1 };
      return;
    }
    if (name === "vitals-bleeding") {
      at(0.05 + (0.12 * maxT) / vitals.maxFlesh, 0);
      cathHurt(-0.9, false, maxT * 0.12);
      for (const sl of lens.slots) if (sl.age >= 0) sl.age = age;
      // An earlier one on the other side, older and running.
      const i = lens.splat(1, 0.35, woundClock + 10, true);
      if (i >= 0) lens.slots[i]!.age = Math.min(1.5, age + 0.7);
      gloveBloodV = 1;
      stageWound = { shown: vitals.w, pulse: 1 };
      return;
    }
    // vitals-regen: down to a quarter of Flesh, then 4.0 s without a hit and `tMs` into Guard coming back.
    at(0.25, 0);
    vitals.damage(0);
    vitals.drain();
    let started = false;
    for (let t = 0; t < VITALS.regenDelayS + age - 1e-9; t += 1 / 60) for (const ev of vitals.update(1 / 60)) if (ev === "regenStart") started = true;
    vitals.drain();
    s.hp = vitals.total;
    if (started) regenWash = Math.max(0, 1.5 - age / 0.3);
    stageWound = { shown: vitals.w, pulse: 0.35 };
  };
  const c6Stage = (name: string, tMs: number): string => {
    c4Stage("pistol-idle", 0);
    hud.freeze(null);
    hud.clearFeedback();
    calmVitals();
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const maxT = vitals.maxTotal;
    hitsTaken = 0;
    hud.primeVitals(1, 1);
    if (C7_STAGES.includes(name)) c7Setup(name, tMs);
    else if (name === "grenade-near") stageNades = [{ bearing: -0.55, left: 0.3 }];
    else if (name === "vitals-guardbreak") {
      // Guard already chipped, then the hit that breaks it and carries into Flesh.
      vitals.damage(maxT * 0.3);
      vitals.drain();
      s.hp = vitals.total;
      hud.primeVitals(vitals.guardFrac, vitals.fleshFrac);
      cathHurt(-0.7, false, maxT * 0.2);
    } else if (name === "player-hurt-critical") {
      // Down to critical (Flesh at 20%): the third hit there is the one she clutches.
      vitals.damage(maxT * (0.4 + 0.6 * 0.8));
      vitals.drain();
      s.hp = vitals.total;
      hitsTaken = 2;
      hud.primeVitals(vitals.guardFrac, vitals.fleshFrac);
      cathHurt(0.6, false, maxT * 0.04);
    } else if (name === "player-hurt-melee") cathHurt(-1.2, true, maxT * 0.1);
    else cathHurt(name === "player-hurt-behind" ? Math.PI * 0.94 : Math.PI / 2, false, maxT * 0.1);
    // The moment, `tMs` on: the flinch, the flare, the gun's jolt; the HUD is held there by freeze().
    const sec = tMs / 1000;
    const n = Math.max(1, Math.ceil(sec * 240));
    for (let i = 0; i < n && sec > 0; i++) for (const sp of Object.values(flinch)) sp.update(sec / n);
    hurtV *= Math.exp(-sec / 0.16);
    arsenal.stepHurt(sec);
    trauma.value = 0;
    hud.freeze(tMs);
    return "ok";
  };
  // C8 "Dying, done properly": the fall at 400 ms (knees gone, the gun leaving her hand), 1200 ms (on the floor,
  // the killer framed, the letterbox in), 2000 ms (frozen, the ink in), the card, and the re-sync (`resync` the
  // ink receding into the glitch, `resync-in` the fade up into the checkpoint with its line). The killer is a
  // rifleman 9 m out, a little right, who has just shot her.
  const C8_STAGES = ["death-400", "death-1200", "death-2000", "death-card", "resync", "resync-in"];
  const c8Stage = (name: string, tMs: number): string => {
    c4Stage("pistol-idle", 0);
    hud.freeze(null);
    hud.clearFeedback();
    calmVitals();
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    if (name === "resync-in") {
      // The new session's first frames: her eyes back at the checkpoint, the fade up from black, the line.
      resyncT = Math.max(DT.resync.inkOutMs + DT.resync.glitchMs, tMs || 700);
      const rs = resyncState(resyncT);
      world.setDeath?.({ death: 0, ink: rs.ink, glitch: rs.glitch, ca: 1, grey: o.intensity === "reduced" });
      screen.resyncFrame(rs.black, checkpointLine(), true);
      return "ok";
    }
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const right = new THREE.Vector3(-flat.z, 0, flat.x);
    const g = enemies.filter((e) => e.alive && (e.kit.role ?? "rifle") === "rifle").sort((a, b) => a.position.distanceTo(eye) - b.position.distanceTo(eye))[0];
    if (g) {
      g.revive();
      const at = eye.clone().addScaledVector(flat, 9).addScaledVector(right, 1.6);
      at.y = ground(at.x, at.z);
      g.motion.pos.copy(at);
      g.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z);
      g.state = "combat";
      g.flinch.reset();
      const sightHer: Sight = { eye: eye.clone(), chest: player.pos.clone().add(new THREE.Vector3(0, player.eyeHeight * 0.75, 0)), light: 1, low: 0, speed: 0, stealth: 1 };
      for (let i = 0; i < 30; i++) g.update(1 / 30, sightHer, rays, world.colliders, ground);
      g.shots.length = 0;
    }
    // A fight's worth of damage taken, then the round that kills her.
    damageTaken = Math.round(vitals.maxTotal * 1.6);
    vitals.flesh = vitals.maxFlesh * 0.08;
    vitals.guard = 0;
    s.hp = vitals.total;
    const from = g ? g.body.joints.chest.clone() : eye.clone().addScaledVector(flat, 9);
    hurtCath(vitals.maxTotal * 0.3, from, "bullet", g ?? undefined);
    beginDeath(0.62);
    const none = input.read();
    const target = name === "death-card" ? Math.max(tMs, DT.cardMs + DT.cardFadeMs + 100) : name === "resync" ? DT.cardMs + DT.cardFadeMs + 100 : Number(name.split("-")[1]) || tMs;
    const step = 1000 / 60;
    for (let t = 0; t < target; t += step) deathFrame(Math.min(step, target - t) / 1000, none, true);
    if (name === "resync") {
      // Retry pressed on the card, `tMs` into the re-sync (held short of the rebuild).
      const d = dying!;
      d.resync = Math.min(tMs || 420, DT.resync.inkOutMs + DT.resync.glitchMs - 1);
      screen.hide();
      const rs = resyncState(d.resync);
      const st = deathState(d.t);
      world.setDeath?.({ death: st.death * (rs.ink / DT.ink), ink: rs.ink, glitch: rs.glitch, ca: st.ca, grey: o.intensity === "reduced" });
      screen.resyncFrame(rs.black, null);
      restarting = true;
    }
    return "ok";
  };
  s.stage = (name: string, tMs = 60): string => {
    restarting = false;
    if (C8_STAGES.includes(name)) return c8Stage(name, tMs);
    if (C6_STAGES.includes(name) || C7_STAGES.includes(name)) return c6Stage(name, tMs);
    calmVitals();
    if (C3_STAGES.includes(name)) return c3Stage(name, tMs);
    if (C4_STAGES.includes(name)) return c4Stage(name, tMs);
    arsenal.holdAim = false;
    arsenal.inspectHold = -1;
    if (!STAGES.includes(name)) return `unknown stage ${name}`;
    staged = true;
    s.stageInfo = null;
    // The flinch stage is a head hit, held 60 ms after the round (C2).
    if (name === "enemy-flinch-head-60") tMs = 60;
    hud.freeze(null);
    hud.clearFeedback();
    // Nothing carries over from the stage before: ammo, loot on the ground, particles and decals.
    arsenal.restock();
    pickups.clear();
    world.fx.clear?.();
    showCover(name === "cover-debug-market");
    if (name === "cover-debug-market") {
      if (stageCrate) stageCrate.visible = false;
      if (crateCollider) crateCollider.off = true;
      hud.freeze(tMs);
      return "ok";
    }
    // Every stage starts from the same place: Cath where the first stage found her, looking the same way, and the
    // same guard, put back on his feet if an earlier stage killed him. A stage that inherits the last one's aim
    // frames a different street and measures a different flinch (C2 review).
    if (!stageHome) stageHome = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
    player.pos.copy(stageHome.pos);
    player.yaw = stageHome.yaw;
    player.pitch = stageHome.pitch;
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    if (stageGuard && stageGuard.body.lost.size === 0 && enemies.includes(stageGuard)) {
      if (!stageGuard.alive) stageGuard.revive();
    } else stageGuard = null;
    // A plain rifleman (a riot shield would eat the round), the nearest one.
    const rifle = enemies.filter((e) => e.alive && (e.kit.role ?? "rifle") === "rifle").sort((a, b) => a.position.distanceTo(eye) - b.position.distanceTo(eye));
    // Failing that, anyone armed (a civilian never counts as a target, so cover can't be "blocked" on one).
    const g = stageGuard ?? rifle[0] ?? enemies.find((e) => e.alive && !e.shield && e.kit.role !== "civilian" && e.kit.role !== "nurse" && e.kit.role !== "turret");
    if (!g) return "no enemy";
    stageGuard = g;
    g.revive();
    // A guard 10 m down the crosshair, facing her, unaware.
    // A phone screen is small: the cover stages bring the crate and the guard in so his head over it reads.
    const near = o.quality === "phone" && (name === "blocked" || name === "peek-head") ? 0.6 : 1;
    let at = eye.clone().addScaledVector(flat, 10 * near);
    if (name === "wall-splat") {
      // A wall within reach behind him: look around for a solid face 8 to 30 m off, and stand him 1.4 m in front.
      // The nearest wall 9 to 16 m off (so he stands about 10 m out), searched around the view.
      const yaw0 = Math.atan2(flat.x, flat.z);
      let best = Infinity;
      for (let k = 0; k < 48; k++) {
        const a = yaw0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.13;
        const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const from = eye.clone().setY(ground(eye.x, eye.z) + 1.3);
        const h = rays.cast(from, d, 16);
        if (h && h.dist > 9 && Math.abs(h.normal.y) < 0.3 && Math.abs(h.dist - 11.4) < best) {
          best = Math.abs(h.dist - 11.4);
          at = from.clone().addScaledVector(d, h.dist - 1.4);
          flat.copy(d);
        }
      }
    }
    at.y = ground(at.x, at.z);
    g.motion.pos.copy(at);
    g.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z);
    // A calm street: nobody hunting her, no hurt arcs, full health, so the frame shows only this hit.
    for (const e of enemies) {
      if (e.alive && e.state !== "dead") e.state = "unaware";
      e.detect = 0;
    }
    s.hp = s.maxHp;
    g.hp = g.kit.maxHp;
    // A stage starts from a body at rest: a previous stage's flinch still ringing would add to (or cancel) this one.
    g.flinch.reset();
    const sightFar: Sight = { eye: new THREE.Vector3(0, -500, 0), chest: new THREE.Vector3(0, -500, 0), light: 0, low: 1, speed: 0, stealth: 0 };
    g.update(0.0001, sightFar, rays, world.colliders, ground);
    // Blocked: a steel crate 6 m out, chest high on him, so his head shows over it.
    const crated = name === "blocked" || name === "peek-head";
    if (crated && !stageCrate) {
      const c = eye.clone().addScaledVector(flat, 6 * near);
      c.y = ground(c.x, c.z);
      // A rusted market cargo crate in the street's own material, its collider the oriented box it is.
      const mat = world.material?.("rust") ?? new THREE.MeshStandardMaterial({ color: 0x5a4a40, metalness: 0.6, roughness: 0.6 });
      stageCrate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.25, 0.9), mat);
      stageCrate.castShadow = stageCrate.receiveShadow = true;
      stageCrate.position.set(c.x, c.y + 0.625, c.z);
      const yaw = Math.atan2(flat.x, flat.z);
      stageCrate.rotation.y = yaw;
      world.scene.add(stageCrate);
      stageCrate.updateMatrixWorld();
      const half = new THREE.Vector3(0.7, 0.625, 0.45);
      const bounds = new THREE.Box3().setFromObject(stageCrate);
      crateCollider = rays.add(bounds, "metal", false, { center: stageCrate.position.clone(), half, yaw });
    }
    if (stageCrate) stageCrate.visible = crated;
    if (crateCollider) crateCollider.off = !crated;
    const joint = name === "hit-head" || name === "hit-headkill" || name === "peek-head" || name === "enemy-flinch-head-60" ? g.body.joints.head : g.body.joints.chest;
    const aim = joint.clone();
    // Blocked: the round goes into the crate's upper face, square on, with the guard's head showing behind it.
    if (name === "blocked" && stageCrate) aim.copy(stageCrate.position).y += 0.35;
    if (name === "hit-kill" || name === "hit-headkill") g.hp = 1;
    const w = SLICE_WEAPONS.find((x) => x.id === "kestrel")!;
    // The shot is a Kestrel round, so she holds the Kestrel.
    if (arsenal.weapon.id !== "kestrel") {
      arsenal.owned.add("kestrel");
      arsenal.equipId("kestrel");
    }
    arsenal.settle();
    // The crosshair sits on the round's point of aim, so the frame shows what she'd see down the sights.
    const look = aim.clone().sub(eye).normalize();
    player.pitch = Math.asin(THREE.MathUtils.clamp(look.y, -1, 1));
    player.yaw = Math.atan2(-look.x, -look.z);
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const origin = eye.clone().addScaledVector(fwd, 0.3);
    const dir = aim.clone().sub(origin).normalize();
    combat.quiet = true;
    lastHitPoint = null;
    // No random crit: a stage shows the same class every time.
    combat.fire({ weapon: w, origin, muzzle: origin.clone(), dirs: [dir] } as unknown as Parameters<Combat["fire"]>[0], { ...build(), crit: 0 });
    combat.quiet = false;
    drainEvents();
    const hitAt = (lastHitPoint as THREE.Vector3 | null)?.clone() ?? aim.clone();
    const head0 = toScreen(g.body.joints.head);
    // The world moves on to the stage's moment: the body flinches or falls, blood flies and lands (S0, C2).
    const stepS = 1 / 60;
    for (let t = 0; t + 1e-6 < tMs / 1000; t += stepS) {
      const h = Math.min(stepS, tMs / 1000 - t);
      for (const e of enemies) e.feel(h, world.colliders, ground);
      world.update(0, 1, h);
    }
    // Classes the street can't produce on cue yet (no plates until C15): show them over the real hit.
    const r02 = Math.abs(toScreen(hitAt.clone().addScaledVector(new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 0), 0.2)).x - toScreen(hitAt).x);
    // The wall splats, on screen: centre and radius (CSS px), for the wall-splat probe.
    const camX = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 0);
    const splats = (world.fx.gore?.splats ?? []).map((sp) => {
      const c = toScreen(sp.point);
      return { x: c.x, y: c.y, r: Math.abs(toScreen(sp.point.clone().addScaledVector(camX, sp.size / 2)).x - c.x) };
    });
    // Where the body is now (the kill stage looks for the corpse): pelvis and head on screen.
    const corpse = { pelvis: toScreen(g.body.joints.pelvis), head: toScreen(g.body.joints.head), chest: toScreen(g.body.joints.chest) };
    s.stageInfo = { hit: toScreen(hitAt), r02, head0, head1: toScreen(g.body.joints.head), puffM: world.fx.gore?.counts.puffM ?? 0, splats, corpse };
    if (name === "hit-soft") hud.hitMarker("armour");
    if (name === "hit-pen") hud.hitMarker("pen");
    if (name === "hit-armourbreak") hud.hitMarker("armourBreak");
    hud.freeze(tMs);
    return hud.hitClass ?? (name === "blocked" ? "blocked" : "none");
  };
  s.probeRed = (x, y, r, inner = 0) => {
    render();
    const c = world.renderer.domElement;
    const k = c.width / Math.max(1, c.clientWidth);
    const R = Math.max(1, Math.round(r * k));
    const cv = document.createElement("canvas");
    cv.width = cv.height = R * 2;
    const g2 = cv.getContext("2d", { willReadFrequently: true })!;
    g2.drawImage(c, Math.round(x * k) - R, Math.round(y * k) - R, R * 2, R * 2, 0, 0, R * 2, R * 2);
    const px = g2.getImageData(0, 0, R * 2, R * 2).data;
    let red = 0;
    let total = 0;
    const mean = [0, 0, 0];
    for (let j = 0; j < R * 2; j++)
      for (let i = 0; i < R * 2; i++) {
        const d2 = (i - R) ** 2 + (j - R) ** 2;
        if (d2 > R * R || d2 < (inner * k) ** 2) continue;
        total++;
        const o4 = (j * R * 2 + i) * 4;
        const rr = px[o4]!;
        mean[0] = mean[0]! + rr;
        mean[1] = mean[1]! + px[o4 + 1]!;
        mean[2] = mean[2]! + px[o4 + 2]!;
        if (rr > 45 && rr > px[o4 + 1]! * 1.8 && rr > px[o4 + 2]! * 1.8) red++;
      }
    return { red, total, mean: mean.map((v) => Math.round(v / Math.max(1, total))) };
  };
  /**
   * C7 acceptance: the frame as an 8x8x8 RGB histogram (shares), and the edge-to-centre saturation probe: mean HSV
   * saturation in the centre (r < 0.12 of the height) and in a ring (0.26 to 0.38, inside the blood vignette),
   * for the frame as it stands and for the same frame with the wound grade off (lens off for both, so the probe
   * reads the grade, not a splat).
   */
  /**
   * C8 acceptance: pixels of the rendered frame (full resolution) with hue 350..10 degrees, saturation above 0.6 and
   * value above 0.25: blood red. Reduced violence's death-2000 must have none.
   */
  s.probeBloodRed = () => {
    const c = world.renderer.domElement;
    const cv = document.createElement("canvas");
    cv.width = c.width;
    cv.height = c.height;
    const g2 = cv.getContext("2d", { willReadFrequently: true })!;
    render();
    g2.drawImage(c, 0, 0);
    const px = g2.getImageData(0, 0, cv.width, cv.height).data;
    let red = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]! / 255;
      const g = px[i + 1]! / 255;
      const b = px[i + 2]! / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      if (mx <= 0.25 || mx - mn <= 0.6 * mx || mx !== r) continue;
      // Red is the max: hue = 60 * (g - b) / (mx - mn), within +-10 degrees of 0.
      const h = (60 * (g - b)) / (mx - mn);
      if (h <= 10 && h >= -10) red++;
    }
    return { red, total: px.length / 4 };
  };
  s.probeWound = () => {
    const c = world.renderer.domElement;
    const W = 192;
    const H = Math.max(1, Math.round((W * c.height) / Math.max(1, c.width)));
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g2 = cv.getContext("2d", { willReadFrequently: true })!;
    const grab = () => {
      render();
      g2.drawImage(c, 0, 0, c.width, c.height, 0, 0, W, H);
      return g2.getImageData(0, 0, W, H).data;
    };
    const sat = (px: Uint8ClampedArray) => {
      const acc = { centre: 0, nc: 0, edge: 0, ne: 0 };
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const r = Math.hypot(i - W / 2, j - H / 2) / H;
          const zone = r < 0.12 ? 0 : r > 0.26 && r < 0.38 ? 1 : -1;
          if (zone < 0) continue;
          const o4 = (j * W + i) * 4;
          const mx = Math.max(px[o4]!, px[o4 + 1]!, px[o4 + 2]!);
          const mn = Math.min(px[o4]!, px[o4 + 1]!, px[o4 + 2]!);
          const sv = mx > 8 ? (mx - mn) / mx : 0;
          if (zone === 0) {
            acc.centre += sv;
            acc.nc++;
          } else {
            acc.edge += sv;
            acc.ne++;
          }
        }
      return { centre: acc.centre / Math.max(1, acc.nc), edge: acc.edge / Math.max(1, acc.ne) };
    };
    const px = grab();
    const hist = new Array(512).fill(0) as number[];
    for (let o4 = 0; o4 < px.length; o4 += 4) hist[(px[o4]! >> 5) * 64 + (px[o4 + 1]! >> 5) * 8 + (px[o4 + 2]! >> 5)]!++;
    const n = px.length / 4;
    const u = world as unknown as { setWounded?: World["setWounded"] };
    const noLens = lens.slots.map((sl) => ({ ...sl, age: -1 }));
    const pulse = pulseNow;
    u.setWounded?.({ pulse, regen: regenShown(), stim: stimWash, lens: noLens, wipe: -1 });
    const now = sat(grab());
    world.setVitals?.(0, 0, 1, 0);
    u.setWounded?.({ pulse: 0, regen: 0, stim: 0, lens: noLens, wipe: -1 });
    const fine = sat(grab());
    // Back as it was.
    world.setVitals?.(hurtV, hurtDir.x, hurtDir.y, woundShown);
    u.setWounded?.({ pulse, regen: regenShown(), stim: stimWash, lens: lens.slots, wipe: lens.wipe });
    render();
    return { hist: hist.map((v) => v / n), now, fine, lens: lens.active, glove: gloveBloodV, w: woundShown, pulse };
  };
  s.traceShot = (from, to) => combat.traceShot(new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z), arsenal.weapon, build());
  // window.cathode.combat (S0): replay HitEvents through the bus exactly as combat emits them, and trace a shot.
  combat.held = () => ({ w: arsenal.weapon, build: build() });
  combat.replay = (events) => {
    for (const h of events) combat.bus.emit("hit", h);
    drainEvents();
    return hud.hitClass;
  };

  const stageParam = new URLSearchParams(location.search).get("stage");
  if (stageParam) {
    const tParam = Number(new URLSearchParams(location.search).get("t") ?? 60);
    const wait = () => (s.stats.frames >= 3 ? s.stage!(stageParam, tParam) : setTimeout(wait, 100));
    setTimeout(wait, 100);
  }
  (window as unknown as { ruin?: Session }).ruin = s;

  // C8: a restart lands here with the screen still black; the line goes up as the fade starts.
  world.setDeath?.({ death: 0, ink: 0, glitch: 0, ca: 1 });
  if (o.warm) {
    screen.resyncFrame(1, o.warm.resyncLine);
    s.stats.lastRestartMs = Math.round(performance.now() - o.warm.t0);
  }
  requestAnimationFrame(frame);
  return s;
}

/** What a guard shouts when a round cracks past his head. */
const BARKS = ["Taking fire!", "Contact, she's shooting!", "Shots, get down!", "Where's that coming from?"];

const RESIST_TAG: Record<string, string> = { kinetic: "KIN", shock: "SHK", toxic: "TOX", incendiary: "FIRE", monowire: "WIRE" };

/** One short line for the HUD: armour rating and every non-zero resistance. */
function defenceLine(st: { armour: number; resistances: Record<string, number> }): string {
  const bits: string[] = [];
  if (st.armour > 0) bits.push(`ARM ${Math.round(st.armour)}`);
  for (const [k, v] of Object.entries(st.resistances)) {
    if (Math.abs(v) >= 0.005) bits.push(`${RESIST_TAG[k] ?? k.slice(0, 3).toUpperCase()} ${Math.round(v * 100)}%`);
  }
  return bits.join(" · ");
}
