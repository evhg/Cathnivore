// One play session: builds the world, puts Cath in it and runs the frame loop that ties everything
// together: input, movement, weapons, combat, enemies, stealth, the kill-cam, bullet-time, XP and the HUD.

import { openPhotoMode } from "../ui/photomode";
import { calmCameraOn, damageFxLevels, loadPrefs } from "../prefs";
import * as THREE from "three";
import { buildGunDisplay, type GunModel } from "./viewmodel";
import { beamLook, setBeaconProfile } from "./beacon";
import { LASER_COOLDOWN, LASER_DAMAGE, laserState, laserTouches, lasersFrom } from "./lasers";
import { createWorld } from "../render/world";
import type { Quality, World } from "../render/types";
import { Input } from "./input";
import { Player } from "./player";
import { CIVILIAN, ENFORCER, ENFORCER_SNIPER, Enemy, NURSE, NURSE_HEAL, NURSE_RANGE, ORDERLY, TURRET, HUNTER, POLICE_DRONE, RIOT_SHIELD, BOARD_GUARD, type EnemyKit, type Sight } from "./enemy";
import { bodyView, deadCost, deathGlowScale, type Body } from "./body";
import { POOLS } from "../render/pools";
import { deathFx, type DeathVariant } from "./death";
import { RayWorld, rayGround } from "./ray";
import { KESTREL_DOT } from "./kestrel";
import { Arsenal } from "./weapons";
import { Combat, encounterCleared, type Build, type KillEvent } from "./combat";
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
import { AUTOMATIC, confirmSound, hardHit, hitClass, hitStopMs, type HitEvent } from "../sim/hitevent";
import { reduceMotionOn } from "../prefs";
import { KillCam } from "./killcam";
import { KillCamRules } from "../sim/killcam";
import { Orbs, TD, Takedown, targetScript } from "./takedown";
import { archGeometry } from "./models/enforcer";
import { TAKEDOWN, TAKEDOWN_VARIANTS, blowsInOrder, pickTakedownVariant, syncPoint, takedownEligible, takedownRewards, variantById, type Rect, type TakedownApproach, type TakedownVariantId } from "../sim/takedown";
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
import { namesLeft } from "../ui/frontcopy";
import { Actives } from "./actives";
import { openCharacter } from "../ui/character";
import { exportCode, makeSave } from "../sim/save";
import { levelUpToast } from "../ui/levelup";
import { xpForLevel, xpToNext as simXpToNext } from "../sim/stats";
import { AutoScale } from "./autoscale";
import { DeathCam, GunDrop, deathState, resyncState } from "./death-cam";
import { DeathScreen } from "../ui/deathcard";
import { deathLine, type DeathCause } from "./voice";
import { ESC_DEBOUNCE_MS, nextResuming, pauseView } from "./pausegate";
import { clearDebris, clearShards, liveDebris } from "./armourfx";
import { HELM_Y } from "./rig";
import { plateWear } from "../sim/armour";
import { makeStagger } from "../sim/stagger";
import { Director } from "./ai/director";
import { RELOAD_KEYS } from "./animate";
import { layFlat, litEdges, stageFlash } from "./laserfx";
import { EnemyNades, NADE_RADIUS } from "./enemynades";
import { cargoCrate, concretePillar } from "./coverprops";
import { loadCover } from "./ai/coverload";
import { BARK_LINES } from "./ai/squad";
import { SECOND_WIND, SecondWind, weaponDt, type SecondWindLook } from "../sim/secondwind";

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
  /** C8/C15: she started dying (the page drops a loading card still easing out, so it never sits over the fall). */
  onDying?: () => void;
  /** C8: a restart from the checkpoint inside the same page (the world, audio and window.cathode carried over). */
  warm?: WarmStart;
  /** C13: the world the title scene already built for this district (the push hands it over: no second load). */
  world?: World;
  /** C13: the front door names the area itself (main.ts #area-title), so the HUD's district banner stays off. */
  areaTitle?: boolean;
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
    /** C16: the sniper's laser sampled along its length on screen (CSS px; only the samples in frame). */
    laser?: { x: number; y: number }[];
    /** C9: how he died, and the pool under him on screen (CSS px). */
    variant?: string | null;
    pool?: { x: number; y: number; rx: number; ry: number; age: number } | null;
    asleep?: boolean;
    /** C9: joint heights over the street under them (m), for the pose checks (a slump sits, a fall is down). */
    heights?: Record<string, number>;
    /** C10: the review lineup's box on screen (CSS px), and how far each hand is open on the hit-arm stage (degrees). */
    box?: { x: number; y: number; w: number; h: number };
    handOpen?: { L: number; R: number };
    /** C10: the segment the stage's round struck, and the hands on screen (CSS px) with 0.12 m in px, for the hand crop. */
    seg?: string | null;
    hands?: { L: { x: number; y: number }; R: { x: number; y: number }; r: number };
    /** C11: the takedown at the stage's moment: its clock, whether her arm and his helmet are in frame, the bars. */
    /** C11: the tell stage: his head and helmet top on screen and where the chip is anchored (CSS px). */
    tell?: { head: { x: number; y: number }; helmetTop: { x: number; y: number }; chip: { x: number; y: number } | null };
    /** C15: the plates' states, his reaction, the carrier under the chest plate on screen (CSS px, with 5 cm in px), the loose plates. */
    armour?: { crack?: { x: number; y: number; r: number } | null; plates: Record<string, string>; visor: number; reaction: string | null; t: number; under: { x: number; y: number; r: number }; face: { x: number; y: number; r: number }; debris: { x: number; y: number; asleep: boolean }[]; meter: number; heights: Record<string, number>; arms?: string; shards?: number; crawling?: boolean; wound?: { limp: string | null; hang: string | null; hunch: number } | null };
    takedown?: { t: number; active: boolean; headIn: boolean; armIn: boolean; handR: { x: number; y: number }; handL: { x: number; y: number }; bars: number; helmetShare: number; prop: string; propIn: boolean; muzzle: { x: number; y: number } | null; debug?: Record<string, number[] | null> };
  } | null;
  /** C9 acceptance: inside an ellipse (CSS px), the share of bright pixels (a highlight: the neon in the pool) and of dark-red ones. */
  probePool?: (x: number, y: number, rx: number, ry: number, o?: { quick?: boolean; noRender?: boolean }) => { bright: number; red: number; total: number; maxLum: number };
  /** C5: the Kestrel at the stage's moment (part travel, rounds shown, the muzzle and slide on screen). */
  pistolInfo?: Record<string, unknown> | null;
  /** C4: the hands' share of viewmodel pixels and the slide's mean luminance (0..1) in the shown frame. */
  vmProbe?: (rects?: { x: number; y: number; w: number; h: number }[]) => { handShare: number; slideLum: number; vmPx: number; slidePx: number; inRects: number[] };
  /** C4: the red dot's projection and the screen centre (CSS px), and the aim blend, as the frame shows them. */
  dotProbe?: () => { x: number; y: number; cx: number; cy: number; aim: number } | null;
  /** C6: the red-dot optic's screen box (CSS px; hood, base and emitter, with the rear sight behind it), or null. */
  opticProbe?: () => { x: number; y: number; w: number; h: number } | null;
  /**
   * C10 acceptance: the staged guard's own pixels (a flat mask render) against the street around him: their mean
   * luminance (0..1) in the shown frame, and his height on screen (CSS px).
   */
  /** C10: a close-up of the hit-arm stage's struck hand from 1.1 m off his struck side (true), or back to her view (false). */
  zoom?: (on: boolean) => boolean;
  probeEnemy?: () => { enemy: number; street: number; ratio: number; px: number; heightPx: number; box: { x: number; y: number; w: number; h: number } } | null;
  /** C10: the silhouette lineup scaled so its tallest figure is 64 px tall, as a PNG data URL. */
  silhouetteThumb?: () => string | null;
  /** Renders a frame and counts red-dominant pixels within `r` CSS px of (x, y) (the C2 blood probe). */
  probeRed?: (x: number, y: number, r: number, inner?: number) => { red: number; total: number; mean: number[]; skin: number; glow: number };
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
  /** C17 e2e: starts a last-man orbit on the nearest live enemy. */
  killcamTest?: () => boolean;
  /** C17 (S5.3): the kill-cam's state and the world's sim scale this frame. */
  killcamState?: () => { active: boolean; shot: string | null; ms: number; sinceImpact: number; xray: boolean; scale: number; returnMs: number };
  /** C17 (S6.5): Second Wind's state (phase, real ms in, charges left this checkpoint). */
  secondWind?: { phase: string; t: number; left: number };
  /** C8: the death sequence while it runs (ms since the blow, and whether the card is up), else null. */
  dying?: { ms: number; card: boolean; killer: string | null; gun?: number[] | null } | null;
  /** C6 (S6.1): Guard and Flesh. `hp` mirrors their total; writing `hp` from outside still works. */
  vitals?: Vitals;
  /** C6: a hit on Cath of `amount` from a world point (null: straight ahead), with every readout. */
  hurtCath?: (amount: number, from: { x: number; y: number; z: number } | null, kind?: HurtKind) => void;
  /** C11: the takedown director (tests read `active`, `lockMs`, `target`, `variant`). */
  takedown?: Takedown;
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
  const world = o.warm?.world ?? o.world ?? (await createWorld(o.canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot, district: o.district }, o.onProgress));
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
  deathGlowScale.rimPow = o.quality === "phone" ? 1.2 : 0;
  deathGlowScale.rimGain = o.quality === "phone" ? 0.22 : 1;
  deadCost.cheap = o.quality === "phone";
  // C10: the enemies' LODs, geometry profile and cloth read the view (?lod=0|1|2 forces a LOD for review shots).
  bodyView.phone = o.quality === "phone";
  {
    const fl = new URLSearchParams(location.search).get("lod");
    bodyView.forceLod = fl === "0" || fl === "1" || fl === "2" ? (Number(fl) as 0 | 1 | 2) : -1;
  }
  setBeaconProfile(o.quality === "phone" ? "phone" : "desktop");
  const start = world.markers.player?.[0] ?? new THREE.Vector3();
  /** C14: the key-art stage hides her gun for good (screenshot runs only). */
  let keyArt = false;
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
      // Screenshots never roll an elite (C15 review): an affix changes his name, his HP and so what a staged round does.
      const elite = !o.shot && Math.random() < ELITE_CHANCE[progress.character.difficulty] + ngPlusEliteBonus(ngPlusLap(progress.jobsDone));
      // C10 (S3.2): every fifth rifle patrol is led by a sergeant (the helmet crest and the red visor stripe).
      const leader = base === ENFORCER && n % 5 === 1;
      const e = new Enemy({ ...guarded(Progress.kit(base, archetype, areaLevel, seed++, elite), base), role: base.role, leader }, route.map((p) => p.clone()), areaLevel);
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
  // C16 (S11): the street's Hollowell men fight as squads from the district's cover (loaded as its own chunk).
  const director = new Director(progress.character.difficulty);
  // C16 (S3.5): their frag grenades, lobbed where the squad last saw her.
  const nades = new EnemyNades(world.scene);
  director.form(enemies);
  void loadCover(o.district).then((pts) => (director.cover = pts));
  /** S10: the squads' barks: the subtitle in the faction's colour and the line over the radio, placed where he is. */
  function sayBarks(): void {
    for (const b of director.barks) {
      if (o.shot) continue;
      hud.bark(barkSpeaker(b.e), b.line);
      const rel = b.e.position.clone().sub(world.camera.position);
      const look = world.camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize();
      audio?.radio(b.line, rel.length(), THREE.MathUtils.clamp(rel.normalize().dot(right), -1, 1));
    }
    director.barks.length = 0;
  }
  // C17 (S5.3): the kill-cams and their rules (the setting, the 20 s cooldown, the first three kills of a new save).
  // The x-ray is desktop only and never under reduced violence.
  const killcam = new KillCam(world, {
    xray: o.quality !== "phone" && o.intensity !== "reduced",
    cast: (f, d, l) => rays.cast(f, d, l, { thin: false })?.dist ?? null,
    onCrack: () => audio?.xrayCrack(),
    onMiss: () => {
      kcMissUndo?.();
      kcMissUndo = null;
    },
  });
  const kcRules = new KillCamRules(loadPrefs().killCams);
  window.addEventListener("cathode:prefs", () => (kcRules.setting = loadPrefs().killCams), lifeOpt);
  let sessionKills = 0;
  /** Undoes the bullet follow's cooldown if its round misses after all. */
  let kcMissUndo: (() => void) | null = null;
  /** Kills of this save so far: a save that has levelled or finished a job is long past its first three. */
  const killsThisSave = () => (progress.character.level > 1 || progress.jobsDone.length > 0 ? 99 : sessionKills);
  /** Any input skips the kill-cam after 300 ms (S5.3): keys, clicks and taps, as well as the fire button. */
  let kcSkip = false;
  /** Real ms (the game's clamped frame clock) since a skip, and how long the world took to run at full speed again. */
  let kcSkipAt = 0;
  let kcReturnMs = -1;
  const kcInput = () => {
    if (killcam.active) kcSkip = true;
  };
  window.addEventListener("keydown", kcInput, lifeOpt);
  window.addEventListener("pointerdown", kcInput, lifeOpt);
  let kcWas = false;
  /** The kill-cam's way in: the HUD clears to the bars, the audio drops an octave, the whoosh. */
  function kcBegin(): void {
    kcSkip = false;
    kcWas = true;
    audio?.killcam(true);
    if (killcam.caption) hud.killcamCaption(killcam.caption, killcam.distance);
  }
  /** And out: the reverse whoosh, the bars gone, the gun back, the camera on her again. */
  function kcEnd(): void {
    kcWas = false;
    audio?.killcam(false);
    hud.killcamBars(0, 0);
    world.setWhip?.(0, 0, 0);
    arsenal.rig.root.visible = true;
  }
  let lastSimScale = 1;
  // The bullet follow is decided at the trigger pull, from predict() (S5.3: only a round it sees kill).
  combat.killcamGate = (pred) => {
    if (o.shot || killcam.active || td.active || dead || secondWind.active) return false;
    const k = {
      now: performance.now(),
      last: encounterCleared(pred.enemy, enemies),
      headshot: pred.zone === "head",
      severed: false,
      takedown: false,
      ballistic: true,
      predicted: true,
      distance: pred.dist,
      killsThisSave: killsThisSave() + 1,
      finale: false,
    };
    k.finale = !!job && k.last;
    if (kcRules.wouldTrigger(k) !== "bullet") return false;
    // Committed at the trigger pull; a round that misses after all hands the cooldown back (killcam.onMiss).
    kcRules.note(k);
    const prev = kcRules.commit(k.now);
    kcMissUndo = () => kcRules.rollback(prev);
    killcam.caption = k.last ? (k.headshot ? "Last man · Headshot" : "Last man") : "Long shot";
    killcam.shotDistance = pred.dist;
    return true;
  };
  // C11: the paired takedown (her arms in the street, the camera, the target's body script) and its reward orbs.
  const td = new Takedown(world.scene, o.quality === "phone");
  td.castRay = (from, dir, len) => rays.cast(from, dir, len)?.dist ?? null;
  const orbs = new Orbs(world.scene, (x, z) => world.groundHeight(x, z));
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
  // One area title on arrival: the front door's (main.ts) when it shows one, else the HUD's banner.
  if (o.areaTitle && !o.warm) {
    // main.ts shows #area-title once the session is up; it plays alone (3.2 s), then the HUD draws in.
    hud.hold(3300);
  } else if (inVault) hud.showBanner("The Hollow Vault", "Act 5 · 04:50");
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
  // Not over a screenshot stage: a stage that takes a while to set up would get the opening line across it.
  setTimeout(() => staged || voice.say(inVault ? "startVault" : inTower ? "startTower" : inPlaza ? "startPlaza" : inClinic ? "startClinic" : "start"), 2600);

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
  pickups.ground = (x, z) => world.groundHeight(x, z);
  pickups.onClatter = (k, at) => {
    world.camera.getWorldPosition(camPos);
    camRight.setFromMatrixColumn(world.camera.matrixWorld, 0).normalize();
    toHit.copy(at).sub(camPos);
    const d = toHit.length();
    audio?.gunClatter((k * 0.8) / (1 + d / 14), d > 0.01 ? toHit.dot(camRight) / d : 0);
  };
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
    if (k.enemy.kit.role !== "civilian" && secondWind.active) secondWindRevive();
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
    // C9: gear falls beside him (on his left), so its beacon doesn't stand through the body.
    if (!found.gun) at.add(new THREE.Vector3(Math.cos(k.enemy.motion.yaw) * 0.75, 0, -Math.sin(k.enemy.motion.yaw) * 0.75));
    at.y = world.groundHeight(at.x, at.z);
    // C9: a gun in the loot is the one in his hands: it falls from them (his own rifle model goes) and lies where it lands.
    const eb = k.enemy.body;
    const dr = k.enemy.drop;
    const yawE = k.enemy.motion.yaw;
    const from = !found.gun || !k.enemy.rifle.visible
      ? undefined
      : dr
        ? { hand: dr.a.clone(), dir: dr.b.clone().sub(dr.a), vel: new THREE.Vector3() }
        : { hand: eb.joints.handR.clone(), dir: eb.joints.handL.clone().sub(eb.joints.handR), vel: new THREE.Vector3(Math.sin(yawE) * 0.9, 1.2, Math.cos(yawE) * 0.9) };
    if (from) k.enemy.rifle.visible = false;
    // C11: a takedown's gear falls once she has let him go (a beacon mid-sequence pulls the eye off the moment).
    if (k.takedown && td.active) tdAfter.push(() => pickups.drop(at, found, from));
    else pickups.drop(at, found, from);
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
  /** C16 review: a firefight stage is the fight alone (no objective diamond floating over the street). */
  let stageQuiet = false;
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
    Enemy.calmFlicker = trauma.reducedMotion;
    bodyView.calm = trauma.reducedMotion;
    deathFx.steady = trauma.reducedMotion;
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
  s.killcamState = () => ({ active: killcam.active, shot: killcam.shot, ms: killcam.ms, sinceImpact: killcam.sinceImpact, xray: killcam.xrayOn, scale: lastSimScale, returnMs: kcReturnMs });
  // C17 (S6.5): Second Wind, once per checkpoint (none on Hell Week; the Second Wind skill adds a charge, and its
  // value tops up the revive).
  const swSkill = (progress.stats as unknown as Record<string, number>).secondWind ?? 0;
  const secondWind = new SecondWind({ hellWeek: progress.character.difficulty === "hellWeek", extraCharges: swSkill > 0 ? 1 : 0 });
  const SW_NONE: SecondWindLook = { grey: 0, outline: 0, drop: 0, roll: 0, timer: 0, title: 0 };
  let swLook = SW_NONE;
  let swShown = false;
  let swCheckpoint: string | null | undefined = undefined;
  const swState = () => (s.secondWind = { phase: secondWind.phase, t: secondWind.t, left: secondWind.left });
  swState();
  /** The meshes Second Wind outlines: every live enemy (bystanders never). */
  const swOut: THREE.Mesh[] = [];
  const swMeshes = (): THREE.Mesh[] => {
    swOut.length = 0;
    for (const list of [enemies, lineup])
      for (const e of list) if (e.alive && e.kit.role !== "civilian" && e.body.root.visible) e.body.outlineMeshes(swOut, o.quality === "phone");
    return swOut;
  };
  /** The killing blow, taken (S6.5 t = 0): a 140 ms hit-stop, the flare at full, Flesh at 1, the gasp and the drone. */
  function startSecondWind(): void {
    vitals.setTotal(1);
    s.hp = vitals.total;
    timescale.hitStop(SECOND_WIND.stopMs);
    hurtV = 1;
    trauma.add(0.35);
    rumble("hurt");
    audio?.secondWind();
    hud.feedLine("Second Wind", true);
    swState();
  }
  /** A kill in the window: she gets up (+30% Flesh, plus the skill's value), time and colour come back. */
  function secondWindRevive(): void {
    const share = secondWind.kill();
    if (share <= 0) return;
    vitals.healShare(share + swSkill / 100);
    s.hp = vitals.total;
    timescale.release("secondWind");
    audio?.secondWindEnd(true);
    swState();
  }
  /** Second Wind's frame (real time): its clock, the slow motion, the grade, the outlines, the plate and the knee. */
  let swAvoid: { x: number; y: number; w: number; h: number } | null = null;
  function secondWindFrame(realDt: number): void {
    // A new checkpoint gives the charge back.
    const cp = hud.checkpoint?.() ?? null;
    if (swCheckpoint === undefined) swCheckpoint = cp;
    else if (cp !== swCheckpoint) {
      swCheckpoint = cp;
      secondWind.checkpoint();
    }
    if (secondWind.phase === "ready" || secondWind.phase === "spent") {
      if (swShown) {
        swShown = false;
        swLook = SW_NONE;
        world.setSecondWind?.({ grey: 0, outline: 0, meshes: [] });
        hud.secondWind(0, 0);
        swState();
      }
      return;
    }
    const ev = secondWind.update(o.shot ? 0 : realDt * 1000);
    if (ev === "window") timescale.push("secondWind", SECOND_WIND.scale, -1, 0, SECOND_WIND.rampOutMs, "secondWind");
    if (ev === "expired") {
      // No kill: the death, from its 400 ms state and without a second hit-stop.
      timescale.release("secondWind");
      audio?.secondWindEnd(false);
      swShown = false;
      swLook = SW_NONE;
      world.setSecondWind?.({ grey: 0, outline: 0, meshes: [] });
      hud.secondWind(0, 0);
      swState();
      vitals.setTotal(0);
      s.hp = 0;
      beginDeath(undefined, SECOND_WIND.deathFromMs);
      return;
    }
    swLook = secondWind.look();
    // The vitals' box is read once as Second Wind opens (one layout read, not one a frame).
    if (!swShown) swAvoid = hud.vitalsBox();
    swShown = true;
    world.setSecondWind?.({ grey: swLook.grey, outline: swLook.outline, meshes: swMeshes(), avoid: swAvoid });
    hud.secondWind(swLook.title, swLook.timer);
    // Inside it she can't be killed again: the window is the whole chance.
    if (secondWind.active && vitals.total < 1) {
      vitals.setTotal(1);
      s.hp = vitals.total;
    }
    swState();
  }
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
  /** C8: the last hit (its kind, its source, where from), for the death card. */
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
  // C14 (S9.7, game/pausegate.ts): a resume that hasn't got the pointer back yet waits on "click to resume"
  // instead of letting the free mouse reopen the pause; pauseAt debounces the Esc that freed the pointer.
  let resuming = false;
  let pauseAt = -1e9;
  hud.onResume = () => {
    menuOpen = false;
    resuming = true;
    input.lock();
  };
  // C14 (S9.7): the pause menu's Case board and Character open those screens in its place.
  let wantMap = false;
  let wantSheet = false;
  hud.onCaseBoard = () => {
    menuOpen = false;
    wantMap = true;
  };
  hud.onCharacter = () => {
    menuOpen = false;
    wantSheet = true;
  };
  hud.caseNote = () => {
    // The in-city time: the job starts at 01:12 and a game minute passes every ten seconds.
    const m = 72 + Math.floor(combat.clock / 10);
    return {
      objective,
      district: loadingTitle(o.district).split(" · ").pop() ?? "",
      time: `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      names: namesLeft(progress.jobsDone),
    };
  };
  /** C14: the pause grade, 0..1, eased over 200 ms. */
  let pauseK = 0;
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
  // C18 review r2: scratch for the gun cues (shells, empties, the back-blast, a dropped mag), so a shot allocates nothing.
  const cueA = new THREE.Vector3();
  const cueB = new THREE.Vector3();
  const cueC = new THREE.Vector3();
  const cueEye = new THREE.Vector3();
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
        const port = r.port.getWorldPosition(cueA).applyQuaternion(q).add(world.camera.getWorldPosition(camPosV));
        const j = () => 0.8 + Math.random() * 0.4;
        const v = cueB.set((1.8 + Math.random() * 0.6) * j(), (1.0 + Math.random() * 0.4) * j(), 0.3 * j()).applyQuaternion(q);
        world.fx.casing(port, v.addScaledVector(player.vel, 0.9));
      } else if (c === "eject" || c === "backblast") {
        // C18: the revolver's six empties off the ejector star, the launcher's spent case, the back-blast.
        const r = arsenal.rig;
        r.root.updateMatrixWorld(true);
        const q = world.camera.getWorldQuaternion(camQuatV);
        const eyeW = world.camera.getWorldPosition(cueEye);
        if (c === "backblast") {
          const back = cueB.set(0.05, 0.02, 1).applyQuaternion(q);
          world.fx.muzzle(cueA.copy(eyeW).addScaledVector(back, 0.5), back, 1.1);
          audio?.gun.cue("backblast");
        } else {
          const from = (r.parts.cylinder ?? r.parts.case ?? r.port).getWorldPosition(cueA).applyQuaternion(q).add(eyeW);
          const n = arsenal.weapon.model === "revolver" ? 6 : 1;
          // fx.casing copies both vectors into its pooled casing, so the scratch is safe to reuse each round.
          for (let i = 0; i < n; i++) world.fx.casing(from, cueC.set(-0.4 + Math.random() * 0.5, -0.6 - Math.random() * 0.8, 0.6 + Math.random() * 0.4).applyQuaternion(q).addScaledVector(player.vel, 0.9));
          audio?.gun.cue("eject");
        }
      } else if (c === "dry") audio?.gun.dryFire();
      else if (c === "magDrop") {
        const mag = arsenal.rig.mag;
        if (mag) {
          const q = world.camera.getWorldQuaternion(camQuatV);
          const v = cueB.set(-0.2, -0.6, 0.1).applyQuaternion(q).addScaledVector(player.vel, 0.8);
          droppedMags.drop(mag, world.camera.getWorldPosition(camPosV), q, v);
        }
      } else {
        if (c === "seat") trauma.add(tuning.kestrel.reload.seatTrauma);
        if (c === "slam" || c === "rackHome" || c === "pumpHome" || c === "craneClose" || c === "breechClose") trauma.add(tuning.kestrel.reload.slamTrauma);
        audio?.gun.cue(c);
      }
    }
  };

  const frame = (now: number) => {
    // C8: a restart ended this session; the next one runs its own loop.
    if (ended) return;
    // rAF timestamps can trail performance.now() (set when resuming), so never let time run backwards.
    const realDt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    const prevNow = last;
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
    resuming = nextResuming(resuming, input.locked, menuOpen);
    const view = pauseView({
      touch: input.isTouch,
      locked: input.locked,
      exempt: !!o.shot || navigator.webdriver,
      dead,
      charScreen: !!charScreen,
      portrait,
      coaching,
      menuOpen,
      resuming,
    });
    const away = view.frozen;
    if (view.menu && !hud.pauseOn) pauseAt = performance.now();
    hud.showPause(view.menu, input.isTouch);
    hud.showResumeHint(view.clickToResume);
    {
      const want = hud.pauseOn ? 1 : 0;
      pauseK = o.shot || trauma.reducedMotion ? want : want > pauseK ? Math.min(1, pauseK + realDt / 0.2) : Math.max(0, pauseK - realDt / 0.15);
      world.setPause?.(pauseK);
      audio?.pause(want === 1);
    }
    if (wantSheet && !charScreen && !killcam.active) {
      wantSheet = false;
      openSheet();
    }
    if (intent.skills && !charScreen && !killcam.active) openSheet();
    if ((intent.map || wantMap) && !coaching && !charScreen && !killcam.active && !dead) {
      wantMap = false;
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
      // The death is cinema on the real clock: a slow frame (a loaded box, a phone hitch) advances it by up to 250 ms,
      // not the 50 ms a gameplay step is held to, so the card comes due in seconds however few frames get drawn.
      // (Stepped 50 ms at a time, so the bodies and the dropped gun integrate as they always do.)
      for (let rem = Math.max(0, Math.min(0.25, (now - prevNow) / 1000)), n = 0; n === 0 || (rem > 1e-4 && dying && n < 5); n++) {
        const h = Math.min(0.05, rem);
        deathFrame(h, intent);
        rem -= h;
      }
      render();
      requestAnimationFrame(frame);
      return;
    }

    // C17 (S5.3): any input skips the kill-cam after 300 ms, and the skip lands on this frame: the world is back at
    // full speed and the camera on her eyes before anything is drawn (the press that skips never fires the gun).
    if (killcam.active && ((intent.fire && !wasFire) || kcSkip)) {
      kcSkip = false;
      if (killcam.skippable) {
        kcSkipAt = 1e-3;
        killcam.skip();
        kcEnd();
        wasFire = intent.fire;
      }
    }
    if (kcSkipAt) kcSkipAt += realDt * 1000;
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
    secondWindFrame(realDt);
    timescale.update(realDt);
    world.camera.getWorldPosition(bodyView.eye);
    const fxScale = Math.min(scale, timescale.fxScale);
    scale = Math.min(scale, timescale.simScale);
    const dt = o.shot ? 0 : realDt * scale;
    lastSimScale = scale;
    if (kcSkipAt && !killcam.active && scale >= 1) {
      kcReturnMs = kcSkipAt;
      kcSkipAt = 0;
    }
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

    // C11: a takedown owns the frame until it ends (input locked).
    if (td.active) {
      takedownFrame(realDt, dt);
      wasFire = intent.fire;
      render();
      requestAnimationFrame(frame);
      return;
    }

    if (killcam.active) {
      // The kill-cam is cinema: no gun in hand, the HUD down to the 2.39:1 bars (and the range plate on a long shot).
      arsenal.rig.root.visible = false;
      hud.visible = true;
      kcSkip = false;
      wasFire = intent.fire;
      if (killcam.active) {
        combat.update(dt, build());
        for (const e of enemies) {
          e.update(dt, sightOf(), rays, world.colliders, ground);
          e.body.updateFlash(o.shot ? 0 : realDt * 1000);
        }
        killcam.update(o.shot ? 0 : realDt);
        const aspect = innerWidth / Math.max(1, innerHeight);
        hud.killcamBars(killcam.bars, aspect, killcam.captionLevel);
        world.setWhip?.(1, 0, trauma.reducedMotion ? 0 : killcam.whip);
        audio?.update(realDt, 0.2, 1);
        drainEvents();
        world.update(dt, time, fxDt);
      }
      if (!killcam.active) kcEnd();
      render();
      requestAnimationFrame(frame);
      return;
    }
    if (kcWas) kcEnd();

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
    // C17 (S6.5): Second Wind puts her on one knee: the eye drops 35 cm and the camera rolls 12 degrees.
    if (swLook.drop > 0 || swLook.roll > 0) {
      world.camera.position.y -= swLook.drop;
      world.camera.rotation.z += (trauma.reducedMotion ? 0 : calm ? 0.4 : 1) * swLook.roll;
    }
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
    // C17 (S6.5): in a Second Wind the gun fires and reloads on real time, whatever the world's scale.
    const shot = dead ? null : arsenal.update(weaponDt(realDt, dt || realDt, secondWind.active) * gun.rate, trigger, eye, fwd, world.camera.quaternion, spreadMul);
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
      // C18: a hero gun kicks its class's pitch, and the SMG and rifle follow their pattern (S2.6).
      const heroGun = !!arsenal.hero;
      const camKick = heroGun ? arsenal.heroKick[0] : CAM_KICK[shot.weapon.weaponClass] ?? 0;
      if (camKick > 0) {
        const kmul = (camKick / tuning.kestrel.camera.pitchDeg) * (arsenal.aiming ? 0.8 : 1) * (calm ? 0.5 : 1);
        const side = heroGun ? THREE.MathUtils.clamp(arsenal.heroKick[1] / Math.max(1e-6, tuning.kestrel.camera.yawDeg * (camKick / tuning.kestrel.camera.pitchDeg)), -3, 3) : Math.random() * 2 - 1;
        const keep = arsenal.camRecoil.kick(side, kmul);
        player.pitch = THREE.MathUtils.clamp(player.pitch + keep.pitch, -1.5, 1.5);
        player.yaw += keep.yaw;
      }
      if (shot.weapon.id === "kestrel") trauma.add(tuning.kestrel.fire.trauma);
      else if (heroGun) trauma.add(Math.min(0.3, 0.04 + (arsenal.hero!.shove.pitchDeg / 100)));
      // The Kestrel's shell leaves the port on its clip's cue (18 ms); the older guns throw theirs at once.
      if (shot.weapon.weaponClass !== "melee" && shot.weapon.id !== "kestrel" && !heroGun) {
        // Brass out of the port, to the right and up; the world rings it on landing.
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        const port = shot.muzzle.clone().addScaledVector(fwd, shot.weapon.weaponClass === "pistol" ? -0.25 : -0.45);
        world.fx.casing(port, right.multiplyScalar(2.2 + Math.random()).add(new THREE.Vector3(0, 2.4, 0)).addScaledVector(fwd, -0.3));
      }
      if (r.killcam?.target) {
        killcam.startBullet(r.killcam, r.killcam.target.enemy, r.killcam.target.joint);
        kcBegin();
        audio?.killcamWhoosh();
      }
    }
    if (arsenal.meleeNow) {
      const struck = combat.melee(eye, fwd, arsenal.weapon, build());
      audio?.pin(struck, arsenal.weapon.model);
      if (struck) {
        timescale.hitStop(tuning.hitStop.melee);
        jolt = 1;
        // C18 (S2.6 melee): a connect shakes the view (+0.2) and throws a spark off whatever it met.
        trauma.add(0.2);
        world.fx.impact(eye.clone().addScaledVector(fwd, Math.min(1.4, arsenal.weapon.range * 0.6)), fwd.clone().negate(), "metal", 0.35);
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
    if (intent.reload && arsenal.weapon.kind !== "melee" && !arsenal.kestrel && !arsenal.hero) audio?.reload();
    drainGunCues();
    const tdCand = dead ? null : takedownCandidate();
    const canTakedown = tdCand !== null;
    // C11 (S5.1): the tell, the first time a man becomes takeable: his rim and visor pulse, a two-tone tick.
    for (const e of enemies) e.body.eligible = !!tdCand && tdCand.e === e;
    if (tdCand && tdCand.e.id !== tdTold) {
      audio?.takedownTell();
      // The close-up's geometry is built (once per archetype, cached) while the tell is up, not on the press.
      const arch = tdCand.e.body.look.arch;
      setTimeout(() => archGeometry(arch, 0, o.quality === "phone", true), 0);
    }
    tdTold = tdCand ? tdCand.e.id : -1;
    if (intent.takedown && tdCand) startTakedown(tdCand);
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
    // C11 (S5.2): the takedown's orbs home in after 400 ms; red into Flesh, cyan into Guard, gold a half magazine.
    if (!dead && orbs.list.length) {
      for (const ob of orbs.update(dt, player.pos.clone().add(new THREE.Vector3(0, 1.0, 0)))) {
        syncVitals();
        if (ob.kind === "health") vitals.heal(ob.amount);
        else if (ob.kind === "guard") vitals.guard = Math.min(vitals.maxGuard, vitals.guard + ob.amount);
        else {
          const h = arsenal.held[arsenal.current];
          if (h && h.def.mag > 0) h.reserve += Math.ceil(h.def.mag * ob.amount);
        }
        s.hp = vitals.total;
        audio?.orb(ob.kind);
      }
    }
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
    // C16: men a job brought in join a squad; the squads share what they saw last frame and deal roles and tokens.
    for (const e of enemies) director.enlist(e);
    if (!staged) director.update(dt, sight.chest);
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
      // C15 (S4.2): a crawl that ran out ends in his death: credit it like a kill.
      if (e.bledOut) {
        e.bledOut = false;
        combat.bledOut(e);
      }
      // A screenshot stage is one held moment: a guard the stage round alerted doesn't shoot back into it.
      if (staged) e.shots.length = 0;
      for (const sh of e.shots) {
        if (!sh.melee) {
          world.fx.muzzle(sh.from, sh.dir, 0.6);
          // C10: his carbine throws its brass too (snipers and turrets eject nothing you'd see).
          if (e.kit.role === "rifle" || e.kit.role === undefined || e.kit.role === "shield") {
            const bp = new THREE.Vector3();
            const bv = new THREE.Vector3();
            e.brass(bp, bv);
            world.fx.casing(bp, bv);
          }
        }
        const hitWorld = rays.cast(sh.from, sh.dir, sh.melee ? 3 : 120);
        const toChest = sight.chest.clone().sub(sh.from);
        const along = toChest.dot(sh.dir);
        const miss = toChest.clone().addScaledVector(sh.dir, -along).length();
        if (!dead && along > 0 && miss < 0.3 && (!hitWorld || hitWorld.dist > along) && arsenal.parryT > 0) {
          // Parried: the blade turns the round aside in a spark.
          world.fx.impact(sight.chest, sh.dir.clone().negate(), world.surfaceAt(sight.chest));
          world.fx.tracer(sh.from, sight.chest);
        } else if (!dead && along > 0 && miss < 0.3 && (!hitWorld || hitWorld.dist > along)) {
          hurtCath(actives.absorb(e.kit.damage * (sh.mul ?? 1) * run.guard * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)), sh.from, sh.melee ? "melee" : "bullet", e);
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
    // C16: the squads' telegraphs and reload beats (sound, the spent mag), then their barks.
    director.drain(enemies, (e, ev) => {
      const rel = e.position.clone().sub(eye);
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const pan = THREE.MathUtils.clamp(rel.clone().normalize().dot(right), -1, 1);
      if (ev.kind === "chirp") audio?.chirp(rel.length(), pan);
      else if (ev.kind === "magOut") {
        e.dropMag();
        audio?.enemyReload("out", rel.length(), pan);
      } else if (ev.kind === "magIn") audio?.enemyReload("in", rel.length(), pan);
      else if (ev.kind === "bolt") audio?.enemyReload("bolt", rel.length(), pan);
      else if (ev.kind === "throw" && ev.at) {
        const to = ev.at.clone();
        to.y = ground(to.x, to.z);
        nades.throw(e.body.joints.handL.clone(), to);
      }
    });
    for (const e of enemies) nades.hold(e, e.alive && e.motion.tac && (e.motion.tac.throw ?? -1) >= 120 && (e.motion.tac.throw ?? -1) < 600 ? e.body.joints.handL : null);
    if (!staged) {
      nades.update(dt, ground, world.colliders, (at) => {
        world.fx.explosion(at.clone(), NADE_RADIUS * 0.6);
        blastNear(at);
      });
      for (const b of nades.blasts) {
        // Her chest in the open within the blast: damage falls off with distance; a wall between them stops it.
        const d = b.pos.distanceTo(sight.chest);
        if (dead || d > b.radius || !rays.clear(b.pos, sight.chest)) continue;
        const k = 1 - d / b.radius;
        hurtCath(actives.absorb(b.damage * k * k * run.guard * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)), b.pos, "blast", b);
      }
      nades.blasts.length = 0;
    }
    sayBarks();
    discoverBodies();
    drainEvents();

    // The first job: its stages, objective and waypoint.
    if (job) {
      job.update(dt);
      combat.firstGunKill = job.firstGunKill;
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

    if (!dead && s.hp <= 0) {
      // C17 (S6.5): the killing blow, once per checkpoint, is a Second Wind instead.
      if (secondWind.active) {
        vitals.setTotal(1);
        s.hp = vitals.total;
      } else if (secondWind.lethal()) startSecondWind();
      else beginDeath();
    }
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
      nades: stageNades ?? [...actives.liveGrenades(), ...nades.live()].filter((n) => n.pos.distanceTo(player.pos) < 6).map((n) => ({ bearing: bearingTo(n.pos), left: n.left })),
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
      takedownAt: tdCand ? tdChipAt(tdCand.e) : null,
      takedownKey: input.isTouch ? "Tap" : takeKeyNow(),
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
      world.setDeath?.({ death: 0, ink: rs.ink, glitch: resyncGlitch(rs.glitch), ca: 1, grey: o.intensity === "reduced" });
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

  // C18 review r2: the scoped glint's aim, reused (sightOf runs per enemy per frame while she's scoped).
  const glintAim = new THREE.Vector3();
  function sightOf(): Sight {
    return {
      eye: world.camera.position.clone(),
      chest: player.pos.clone().add(new THREE.Vector3(0, player.eyeHeight * 0.75, 0)),
      light: world.lightAt(player.pos.clone().add(new THREE.Vector3(0, 1, 0))),
      low: player.crouchAmt,
      speed: player.speed,
      // The first seconds of a job are hers: nobody can spot her until she's had a look round (or fires).
      stealth: dead || grace > 0 ? 0 : progress.stats.detectionMultiplier * actives.running().camo,
      glint: arsenal.scopedIn ? { aim: world.camera.getWorldDirection(glintAim) } : null,
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
  function openSheet(tab?: "attributes" | "skills" | "inventory"): void {
    s.paused = true;
    document.exitPointerLock?.();
    const wasFocus = s.focus;
    const sheet: { close(): void; refresh(): void } = openCharacter(
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
        // A staged reopen may already have replaced this sheet: only the current one clears the slot.
        if (charScreen !== sheet) return;
        charScreen = null;
        s.paused = false;
        s.focus = wasFocus;
        input.lock();
      },
      {
        tab: tab ?? (progress.character.unspentSkills > 0 ? "skills" : "attributes"),
        exportCode: () => exportCode(makeSave(progress.character, new Date().toISOString(), { jobsDone: progress.jobsDone })),
      },
    );
    charScreen = sheet;
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
    if (!t || dead || stageQuiet) return null;
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

  /** C11: scratch vectors for the per-frame takedown scan and chip (no allocations per enemy per frame). */
  const tdTo = new THREE.Vector3();
  const tdChest = new THREE.Vector3();
  const tdChip = new THREE.Vector3();
  const tdBest = { e: null as Enemy | null, approach: "behind" as TakedownApproach, side: 1 };

  /** C11 (S5.1): the man she could take down now (the nearest eligible), the approach, and her side of him. */
  function takedownCandidate(): { e: Enemy; approach: TakedownApproach; side: number } | null {
    const wire = arsenal.weapon.id === "catsCradle";
    // Ghost's Silent Takedown reaches further (stats.takedownRange over its 2 m base).
    const bonus = Math.max(0, progress.stats.takedownRange - 2);
    tdBest.e = null;
    let bestD = Infinity;
    const cl = (x: number) => Math.max(-1, Math.min(1, x));
    for (const e of enemies) {
      if (!e.alive) continue;
      const to = tdTo.subVectors(e.position, player.pos).setY(0);
      const dist = to.length();
      if (dist > TAKEDOWN.wireRangeM + bonus || dist < 1e-4 || dist >= bestD) continue;
      to.multiplyScalar(1 / dist);
      const toChest = tdChest.subVectors(e.body.joints.chest, eye).normalize();
      const yaw = e.motion.yaw;
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      const role = e.kit.role ?? "";
      const r = takedownEligible(
        {
          state: e.state,
          hpFrac: e.hp / e.kit.maxHp,
          dist: Math.max(0, dist - bonus),
          // His back is -theirFwd and the way to her is -to: the angle between them is theirFwd's to `to`.
          fromBack: Math.acos(cl(sy * to.x + cy * to.z)),
          viewOff: Math.acos(cl(toChest.dot(fwd))),
          machine: role === "turret" || role === "hunter" || e.kit === POLICE_DRONE,
          staggered: e.staggered,
          knockedDown: e.knockedDown,
          crawling: e.crawling,
          surrendered: !!e.tac?.surrendered,
        },
        wire,
      );
      if (!r.ok) continue;
      bestD = dist;
      tdBest.e = e;
      tdBest.approach = r.approach;
      // His left is (cos yaw, 0, -sin yaw).
      tdBest.side = -(to.x * cy - to.z * sy) >= 0 ? 1 : -1;
    }
    return tdBest.e ? (tdBest as { e: Enemy; approach: TakedownApproach; side: number }) : null;
  }

  /**
   * C11 (S5.1): the takedown chip's point on screen: beside his helmet at his visor line (the leader runs in to it),
   * on his right, or his left when that would run off the screen; null off screen. (C11 review 2: over his helmet
   * it sat on the overhead signs of the street behind him.)
   */
  function tdChipAt(e: Enemy): { x: number; y: number; left: boolean } | null {
    const c = world.renderer.domElement;
    const camR = vUp.setFromMatrixColumn(world.camera.matrixWorld, 0);
    const h = tdChip.copy(e.body.joints.head).project(world.camera);
    if (h.z > 1 || Math.abs(h.x) > 1 || Math.abs(h.y) > 1) return null;
    const hx = ((h.x + 1) / 2) * c.clientWidth;
    const left = hx > c.clientWidth * 0.66;
    const v = tdChip.copy(e.body.joints.head).addScaledVector(camR, left ? -0.26 : 0.26).project(world.camera);
    if (v.z > 1) return null;
    return { x: Math.min(c.clientWidth, Math.max(0, ((v.x + 1) / 2) * c.clientWidth)), y: Math.min(c.clientHeight, Math.max(0, ((1 - v.y) / 2) * c.clientHeight)), left };
  }
  const vUp = new THREE.Vector3();

  /** The sequence's own lights, and their removal. */
  const tdLights: Array<() => void> = [];
  const tdLightsOff = () => {
    for (const off of tdLights.splice(0)) off();
  };
  /** What waits for the end of the sequence (the dead man's gear). */
  const tdAfter: Array<() => void> = [];
  /** The man she last heard the tell for (the tick plays once per man). */
  let tdTold = -1;
  /** Unseen at the press (the kill feed's "Unseen" is decided before the world reacts). */
  let tdUnseen = false;
  /** The body last drawn at hero detail (one at a time). */
  let tdHero: Enemy | null = null;

  /** C11 (S5.2): the press. He is turned to the approach and handed to the script; she is pulled in; time slows. */
  function startTakedown(c: { e: Enemy; approach: TakedownApproach; side: number }, force?: TakedownVariantId): void {
    const e = c.e;
    const first = !!job && job.stage === 1;
    const pistol = arsenal.weapon.weaponClass === "pistol" && arsenal.weapon.kind !== "melee";
    const yaw0 = e.motion.yaw;
    const fwdE = new THREE.Vector3(Math.sin(yaw0), 0, Math.cos(yaw0));
    const left = new THREE.Vector3(Math.cos(yaw0), 0, -Math.sin(yaw0));
    const g = ground(e.position.x, e.position.z);
    // Side C needs a wall on his far side within 1.5 m.
    let wallM: number | null = null;
    if (c.approach === "side") {
      const h = rays.cast(new THREE.Vector3(e.position.x, g + 1.2, e.position.z), left.clone().multiplyScalar(-c.side), 1.5, { thin: false });
      if (h) wallM = h.dist;
    }
    const v = force ? variantById(force) : pickTakedownVariant({ approach: c.approach, pistol, wall: wallM !== null, seed: e.id * 13.1 + Math.floor(combat.clock * 10), recent: td.recent, first });
    const toHer = new THREE.Vector3().subVectors(player.pos, e.position).setY(0).normalize();
    const along = c.approach === "behind" ? fwdE.clone().negate() : c.approach === "front" ? fwdE.clone() : c.approach === "side" ? left.clone().multiplyScalar(c.side) : toHer;
    const rects: Rect[] = [];
    for (const b of world.colliders) {
      if (b.max.y < g + 0.25 || b.min.y > g + 1.8) continue;
      // Not a box he stands in (a stall's awning post, a kerb under him).
      if (e.position.x > b.min.x && e.position.x < b.max.x && e.position.z > b.min.z && e.position.z < b.max.z) continue;
      rects.push({ minX: b.min.x, minZ: b.min.z, maxX: b.max.x, maxZ: b.max.z });
    }
    const sp = syncPoint(e.position, along, v.syncM, rects, player.pos);
    const sync = new THREE.Vector3(sp.x, ground(sp.x, sp.z), sp.z);
    // Turned to the approach (snapped in the first 120 ms, under the camera's ease): she is where the script says.
    const to = new THREE.Vector3().subVectors(sync, e.position).setY(0);
    if (to.lengthSq() > 1e-6) {
      to.normalize();
      if (v.approach === "behind") e.motion.yaw = Math.atan2(-to.x, -to.z);
      else if (v.approach === "front" || v.approach === "surrender") e.motion.yaw = Math.atan2(to.x, to.z);
      else if (v.approach === "side") e.motion.yaw = Math.atan2(-c.side * to.z, c.side * to.x);
    }
    tdUnseen = !enemies.some((x) => x.alive && x.state === "combat");
    e.die(new THREE.Vector3(), e.body.joints.chest.clone(), { zone: "head", weaponCls: "melee", distance: 0.8, side: 0, seed: e.id }, undefined, targetScript(v, c.side, wallM ?? 1));
    e.body.eligible = false;
    // The close-up: his body at hero detail for the sequence (and where she leaves him), the last one's back to LOD0.
    if (tdHero && tdHero !== e) tdHero.body.heroDetail(false);
    tdHero = e;
    e.body.heroDetail(true);
    td.reduced = reduceMotionOn();
    td.begin({ target: e, variant: v, approach: v.approach, from: player.pos.clone(), sync, side: c.side, pistol, first, wallM: wallM ?? undefined }, world.camera);
    timescale.push("takedown", td.worldScale, -1, 120, 300, "takedown");
    combat.noise(e.position, TAKEDOWN.noiseM);
    combat.bus.emit("takedownStart", { t: combat.clock, targetUid: String(e.id) });
    director.takedownSeen(e.position);
    audio?.takedownGrab();
    hud.cinema(Math.max(0.002, td.bars()));
    world.viewScene.visible = false;
    // The shot's own practicals (from the real-light pool: no shader recompiles): a cyan rim beyond her right
    // shoulder that draws her hair and his helmet out of the night, and a low cool fill from behind the lens on her
    // back and arms. They go with the sequence.
    tdLightsOff();
    if (worldLight) {
      const f = new THREE.Vector3().subVectors(e.position, sync).setY(0).normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const eyeAt = sync.clone().add(new THREE.Vector3(0, TD.eye, 0));
      tdLights.push(worldLight(eyeAt.clone().addScaledVector(f, 1.5).addScaledVector(r, 1.1).add(new THREE.Vector3(0, 0.7, 0)), new THREE.Color(0.35, 0.85, 1.6), 9, 4));
      // (C11 review 3: at 3 the fill left her sleeves and his back flat black silhouettes against the lamp; a
      // stronger, warmer one from just over the lens shows the gabardine's weave, the cuffs and his harness.)
      tdLights.push(worldLight(eyeAt.clone().addScaledVector(f, -1.1).addScaledVector(r, 0.45).add(new THREE.Vector3(0, 0.35, 0)), new THREE.Color(0.85, 0.78, 0.82), 7, 3.2));
    }
    player.vel.set(0, 0, 0);
  }

  /** C11: a takedown's frame. Input is locked; the director has the camera, her arms and his body. */
  function takedownFrame(realDt: number, dt: number): void {
    const e = td.target as Enemy | null;
    arsenal.rig.root.visible = false;
    // (A screenshot stage's frame is frozen: the stage steps the sequence itself.)
    const bodyMs = td.update(o.shot ? 0 : realDt * 1000);
    takedownEvents(e, realDt);
    // Everyone else in slowed time; him on the sequence's own clock.
    for (const x of enemies) {
      if (x === e) continue;
      x.update(dt, sightOf(), rays, world.colliders, ground);
      x.body.updateFlash(o.shot ? 0 : realDt * 1000);
    }
    if (e) {
      e.feel(o.shot ? 0 : bodyMs / 1000, world.colliders, ground);
      // His kill glow runs on the sequence's clock (it held at full red for the whole sequence before).
      e.body.updateFlash(o.shot ? 0 : bodyMs);
    }
    combat.update(dt, build());
    drainEvents();
    takedownCamera(realDt);
    audio?.update(realDt, 0.6, td.worldScale);
    world.update(dt, time);
  }

  /** C11 review: the pair framed from her left, 2.4 m off (the `-x` stages). */
  let tdSideView: Enemy | null = null;
  function sideView(): void {
    if (!tdSideView) return;
    const n = tdSideView.body.joints.neck;
    const mid = n.clone().lerp(player.pos.clone().setY(n.y), 0.5);
    const side = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    mid.y = ground(mid.x, mid.z) + 1.1;
    world.camera.position.copy(mid).addScaledVector(side, -2.6).add(new THREE.Vector3(0, 0.15, 0));
    world.camera.lookAt(mid);
    world.camera.fov = 50;
    world.camera.updateProjectionMatrix();
    world.camera.updateMatrixWorld();
    hud.cinema(0);
  }

  /** The takedown's camera this frame: first person where she now stands, handed to the director's framing. */
  function takedownCamera(realDt: number): void {
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    const fp = { pos: world.camera.position.clone(), quat: world.camera.quaternion.clone(), fov: arsenal.worldFov };
    if (td.active) td.applyCamera(world.camera, fp);
    trauma.update(realDt);
    const shake = trauma.sample();
    world.camera.rotation.x += shake.pitch;
    world.camera.rotation.y += shake.yaw;
    world.camera.updateMatrixWorld();
    hud.cinema(td.active ? Math.max(0.002, td.bars()) : 0);
    if (tdSideView) sideView();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
  }

  /** Plays what the director's last step said: blows, the kill, the lay-down, the line, the end. */
  function takedownEvents(e: Enemy | null, realDt: number): void {
    // The magnet: her capsule rides to the sync point; she faces him.
    player.pos.copy(td.feet);
    player.yaw = td.yaw;
    player.pitch = THREE.MathUtils.lerp(player.pitch, -0.12, Math.min(1, realDt * 6));
    player.vel.set(0, 0, 0);
    for (const ev of td.events) {
      if (ev.kind === "impact" && ev.at) {
        const lethal = !!ev.lethal;
        // A shot finisher's lethal round is a headshot kill (S5.2 Front A: 110 ms); a blow, the takedown's 80.
        timescale.hitStop(lethal ? (td.variant!.kind === "shot" ? tuning.hitStop.headKill : tuning.hitStop.takedown) : 60);
        trauma.add(lethal ? 0.35 : 0.22);
        audio?.takedownImpact(td.variant!.kind, lethal);
        const gunShot = td.variant!.kind === "shot" && td.rig.props.pistol.rig.root.visible && (lethal || td.variant!.id === "frontKick");
        if (gunShot && e) {
          // A gun finisher (S5.2: "110 ms hit-stop, wall splat behind, headshot drop"): a contact shot, so the can
          // can't eat it all: a short hot flash at the muzzle pressed under his jaw, then C2's flesh hit (the mist,
          // the exit spray and the splat on the wall behind him) along the round's way out.
          // (Drawn a few cm short of the muzzle, toward the lens: at the muzzle it would be inside his jaw.)
          world.fx.muzzle(td.rig.muzzle.clone().addScaledVector(td.rig.axis, -0.05).lerp(world.camera.position, 0.08), td.rig.axis, 0.4, false);
          // Front B's double tap is fired from her feet at a man 2 to 3 m off on his back: the round lands in his
          // chest, not at her muzzle (C11 review 3: the mist bloomed at the gun and hid him behind a red cloud).
          const contact = td.variant!.id !== "frontKick";
          const J = e.body.joints;
          const hitAt = contact ? td.rig.muzzle.clone().addScaledVector(td.rig.axis, 0.06) : J.chest.clone().lerp(J.head, 0.3);
          const hitDir = contact ? td.rig.axis.clone() : hitAt.clone().sub(td.rig.muzzle).normalize();
          const seg = e.body.segs.get(contact ? "head" : "upperChest");
          if (world.fx.flesh) world.fx.flesh({ point: hitAt, dir: hitDir, damage: e.kit.maxHp, maxHp: e.kit.maxHp, weaponCls: "pistol", distance: contact ? 0.3 : hitAt.distanceTo(td.rig.muzzle), anchor: seg?.group, owner: e, root: e.body.root, head: contact, lethal });
          // And the spatter that reads at arm's length: droplets out along the round and back across his chest at her.
          if (world.fx.gore) {
            world.fx.blood(hitAt, hitDir, 1);
            if (contact) world.fx.blood(td.rig.muzzle, vUp.copy(world.camera.position).sub(td.rig.muzzle).normalize(), 0.7);
          }
        } else if (world.fx.gore && td.variant!.kind !== "choke") world.fx.blood(ev.at, ev.dir ?? new THREE.Vector3(0, 1, 0), lethal ? 0.85 : 0.5);
        hud.cinemaFlash();
        rumble(lethal ? "kill" : "hit");
        combat.bus.emit("takedownImpact", { t: combat.clock, targetUid: String(e?.id ?? "") });
      } else if (ev.kind === "lethal" && e) {
        e.lethal();
        const garrotte = arsenal.weapon.id === "catsCradle";
        combat.takedownKill(e, garrotte ? arsenal.weapon : arsenal.held[0]!.def, 0.8, tdUnseen);
      } else if (ev.kind === "lay") audio?.takedownLay();
      else if (ev.kind === "line") hud.subtitle("Cath: Shh. Sleep now.");
      else if (ev.kind === "end") endTakedown(e);
    }
    td.events.length = 0;
  }

  /** The sequence is over: control back, rewards out, the body left where she laid it. */
  function endTakedown(e: Enemy | null): void {
    timescale.release("takedown");
    hud.cinema(0);
    world.viewScene.visible = true;
    arsenal.rig.root.visible = true;
    tdLightsOff();
    for (const f of tdAfter.splice(0)) f();
    // The gun comes back up with its draw (a staged frame has no time: it is simply up).
    if (o.shot) arsenal.settle();
    else arsenal.redraw();
    if (!e) return;
    combat.bus.emit("takedownEnd", { t: combat.clock, targetUid: String(e.id) });
    // S6.1: a takedown gives back 15% of Flesh; S5.2: the orbs pop from the body.
    syncVitals();
    vitals.healShare(0.15);
    s.hp = vitals.total;
    if (e.kit.role !== "civilian") orbs.spawn(takedownRewards(td.variant!, s.maxHp, e.id), e.body.joints.chest.clone().add(new THREE.Vector3(0, 0.15, 0)), e.id);
    const xp = progress.lastXp;
    if (xp > 0) hud.riseChip(`+${xp} XP`, toScreen(e.body.joints.chest.clone().add(new THREE.Vector3(0, 0.5, 0))));
  }

  /** Enemies who see a dead colleague raise the alarm for everyone nearby. */
  function discoverBodies(): void {
    // A screenshot stage's body is set dressing for the shot: nobody raises the alarm over it.
    if (staged) return;
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
    /** The pad's A and B last frame (edge-detected: a held A from the fall never skips the card). */
    padA: boolean;
    padB: boolean;
    /** The killer's body and its visor's resting level (it flares twice as he stands down). */
    visor: Body | null;
    visorBase: number;
    /** The cool light that rims him against the street while she lies there (handed back on Retry). */
    rimOff: (() => void) | null;
  }
  let dying: Dying | null = null;
  /** The re-sync's tear and slice glitch, or none under reduced motion (only the ink-out and the black fade play). */
  const resyncGlitch = (g: number): number => (trauma.reducedMotion ? 0 : g);
  let droppedGun: THREE.Object3D | null = null;
  /** Screenshot stages: back to the living, from any death stage. */
  function clearDeath(): void {
    if (dying?.killer) dying.killer.standDown = null;
    if (dying?.visor) dying.visor.visorLevel = dying.visorBase;
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
  /** The checkpoint she goes back to, for the re-sync line. */
  const checkpointLine = (): string => {
    const cp = hud.checkpoint?.();
    return cp === "the walkway" ? "RE-SYNCED · CHECKPOINT 2" : cp === "the flyover" ? "RE-SYNCED · CHECKPOINT 1" : `RE-SYNCED · ${caseName.toUpperCase() || "CHECKPOINT"}`;
  };

  /** The killing blow (S6.6 t = 0): input locks, the body cam takes over, the sound and the grade start. */
  function beginDeath(seedOverride?: number, fromMs = 0): void {
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
      ? `Killed by ${killer.kit.name} · ${dist} m · ${(lastHurt?.kind === "melee" ? "bare hands" : (DEATH_WEAPON[killer.kit.role ?? "rifle"] ?? "Rifle").toLowerCase())}`
      : cause === "blast"
        ? "Killed by a blast"
        : cause === "laser"
          ? "Killed by a tripwire laser"
          : "Killed in the dark";
    screen.fill({
      line: deathLine(cause, (seed * 7.31) % 1),
      facts: by,
      touch: input.isTouch,
    });
    screen.setKiller(near ? near.kit.name : "");
    const visor = near ? near.body : null;
    dying = { t: 0, cam, killer: near, killerName: near?.kit.name ?? "", gun: null, cardShown: false, cardAt: 0, resync: -1, flares: 0, splats: 0, lastPress: true, padA: true, padB: true, visor, visorBase: visor?.visorLevel ?? 0, rimOff: null };
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
    o.onDying?.();
    // C17: a Second Wind that ran out joins the death at its 400 ms state (the knee and the fall already begun).
    if (fromMs > 0) {
      const none = input.read();
      const step = 1000 / 60;
      for (let t = 0; t < fromMs; t += step) deathFrame(Math.min(step, fromMs - t) / 1000, none, true);
    }
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
      world.setDeath?.({ death: st.death * (rs.ink / DT.ink), ink: rs.ink, glitch: resyncGlitch(rs.glitch), ca: st.ca, grey: o.intensity === "reduced" });
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
    // As she lands, the lens pushes in on him (550 to 1100 ms) until he stands about 40% of the frame tall: at fighting range he
    // is a man, not a dot (a slow telephoto push, the eye finding him).
    const push = d.killer ? Math.min(1, Math.max(0, (d.t - DT.pushFromMs) / DT.pushMs)) : 0;
    let fovK = st.fov;
    if (d.killer) {
      const dist = Math.max(2, d.killer.position.distanceTo(world.camera.position));
      fovK = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(DT.killerFrameM / dist)), DT.killerFov[0], DT.killerFov[1]);
    }
    world.camera.fov = st.fov - (st.fov - Math.min(st.fov, fovK)) * push * push * (3 - 2 * push);
    world.camera.updateProjectionMatrix();
    // As the card comes due, the lens pans so he stands in the right third: the card is left-aligned, and the
    // headline must never run across him (a turn about the lens's own vertical, so it holds through the roll).
    if (d.killer) {
      const due = Math.min(1, Math.max(0, (d.t - (DT.cardMs - 500)) / 600));
      if (due > 0) {
        const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(world.camera.fov) / 2) * world.camera.aspect);
        world.camera.rotateY(Math.atan(DT.cardKillerX * Math.tan(halfH)) * due * due * (3 - 2 * due));
      }
    }
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
        d.visor.visorLevel = d.visorBase * (1 + 3 * (f(DT.fallEndMs) + f(1150)));
      }
      // The rim comes up as she lands (500 to 900 ms) and holds.
      const rimK = Math.min(1, Math.max(0, (d.t - 500) / 400));
      // Edge-only (body.ts): the suit stays dark, outlined in a cold line, not lit into a pale mannequin.
      // On the phone, at half render scale, a thin dim edge breaks up into dots: wider and brighter there.
      const rimL = rimK * (o.quality === "phone" ? 1.9 : 1);
      d.killer.body.setRim(0.16 * rimL, 0.27 * rimL, 0.46 * rimL, o.quality === "phone" ? 1.8 : 3);
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
      const a = !!pad?.buttons[0]?.pressed;
      const b = !!pad?.buttons[1]?.pressed;
      // Every way off the card waits the same 600 ms and wants a fresh press, not one held from the fall.
      const ready = d.t - d.cardAt >= DT.cardRetryAfterMs;
      if (ready && a && !d.padA) retry();
      else if (ready && b && !d.padB) quitToTitle();
      else if (ready && intent.fire && !d.lastPress) retry();
      d.padA = a;
      d.padB = b;
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
  // C14 (S9.7): Escape (or P) opens the pause on the keypress itself (not the next frame: a slow GPU must not make it
  // lag), and one more press resumes; a page inside it (Settings, Controls) goes back a level first.
  addEventListener(
    "keydown",
    (e) => {
      if (e.repeat || (e.code !== "Escape" && e.code !== "KeyP") || dead || dying || charScreen || coaching || killcam.active) return;
      if ((e.target as Element | null)?.closest?.("input, textarea")) return;
      if (hud.pauseOn) {
        if (hud.pauseBack()) return;
        // The same press that freed the pointer (Chrome may deliver it after the unlock): not a resume.
        if (performance.now() - pauseAt < ESC_DEBOUNCE_MS) return;
        menuOpen = false;
        resuming = true;
        hud.showPause(false, input.isTouch);
        hud.showResumeHint(!input.isTouch && !input.locked && !navigator.webdriver && !o.shot);
        input.lock();
      } else if (!menuOpen) {
        menuOpen = true;
        resuming = false;
        document.exitPointerLock?.();
        // Opened by this press itself: the next press resumes at once (only a frame-opened pause debounces).
        pauseAt = -1e9;
        hud.showResumeHint(false);
        hud.showPause(true, input.isTouch);
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
    world.setSecondWind?.({ grey: 0, outline: 0, meshes: [] });
    audio?.secondWindEnd(false, true);
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
  /** And the segment it struck (the C10 hit-arm stage reports it). */
  let lastHitSeg: string | null = null;
  /** C10: what `s.zoom` frames (the hit-arm stage's struck hand), and whether the close-up is on. */
  let zoomAt: (() => { at: THREE.Vector3; from: THREE.Vector3 }) | null = null;
  let zoomOn = false;
  combat.bus.on("hit", (h) => {
    frameHits.push(h);
    if (h.disarmed && !o.shot) hud.feedLine("Disarmed", true);
    lastHitPoint = new THREE.Vector3(h.point.x, h.point.y, h.point.z);
    lastHitSeg = h.seg;
  });
  combat.bus.on("blocked", () => frameBlocks++);
  // C15 (S4.2, S4.3): the armour and stagger beats the feed and the squad call out. A stagger names the takedown
  // window and the crit it opens; a plate coming off can draw "Plate's gone!" (30%, at most once per 10 s).
  let plateBarkAt = -1e9;
  // S10 "Pain": a squad man grunts over his open mic on 40% of the hits that don't kill him and on every stagger,
  // never twice inside 350 ms (a burst is one grunt, not a stutter).
  const gruntAt = new Map<string, number>();
  const grunt = (uid: string, point: { x: number; y: number; z: number }, force: boolean) => {
    const e = byUid(uid);
    if (!audio || !e || !e.alive || !director.squadOf(e)) return;
    const last = gruntAt.get(uid) ?? -1e9;
    if (combat.clock - last < 0.35 || (!force && Math.random() >= 0.4)) return;
    gruntAt.set(uid, combat.clock);
    world.camera.getWorldPosition(camPos);
    camRight.setFromMatrixColumn(world.camera.matrixWorld, 0).normalize();
    toHit.set(point.x, point.y, point.z).sub(camPos);
    const dist = toHit.length();
    audio.pain(dist, dist > 0.01 ? toHit.dot(camRight) / dist : 0);
  };
  combat.bus.on("stagger", (h) => {
    if (!o.shot) hud.feedLine(h.reaction === "knockdown" ? "Knocked down · Takedown" : "Staggered · Crit · Takedown", true);
    grunt(h.targetUid, h.point, true);
  });
  combat.bus.on("plateBreak", () => {
    if (o.shot || combat.clock - plateBarkAt < 10 || Math.random() >= 0.3) return;
    plateBarkAt = combat.clock;
    const who = enemies.find((x) => x.alive && x.state === "combat" && director.squadOf(x));
    if (who) director.say(who, "plate");
  });
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
  /**
   * C9 (S4.4, S4.5): what the dead and the dying did this frame. The rattle as he goes, thuds as he lands (gear on a
   * chest landing), the gun clattering, the smear down the wall behind a slump, drips under the badly hurt, and a
   * pool under each body once it has been still for 600 ms (or 1.5 s down).
   */
  function drainDeaths(): void {
    world.camera.getWorldPosition(camPos);
    camRight.setFromMatrixColumn(world.camera.matrixWorld, 0).normalize();
    const place = (at: THREE.Vector3) => {
      toHit.copy(at).sub(camPos);
      const d = toHit.length();
      return { pan: d > 0.01 ? toHit.dot(camRight) / d : 0, d };
    };
    const gore = world.fx.gore;
    for (const e of enemies) {
      for (const ev of e.deathEvents) {
        const { pan, d } = place(ev.at);
        if (ev.kind === "rattle") audio?.deathRattle(pan, d);
        else if (ev.kind === "thud" || ev.kind === "gear") audio?.bodyThud(ev.k, pan, d, ev.kind === "gear");
        else if (ev.kind === "clatter") audio?.gunClatter(ev.k * 0.8, pan);
        else if (ev.kind === "smear" && gore) {
          const hit = rays.cast(ev.at, e.deathDir.lengthSq() > 0 ? e.deathDir : new THREE.Vector3(0, 0, -1), 1.8, { thin: false });
          // From his shoulders (the event comes from the neck), so the top of the run shows over his head as he sits.
          if (hit && Math.abs(hit.normal.y) < 0.4) gore.smear(hit.point.clone().add(new THREE.Vector3(0, 0.08, 0)), hit.normal.clone());
        } else if (ev.kind === "trail") gore?.trail(ev.at);
      }
      e.deathEvents.length = 0;
      if (!gore || e.alive || !e.body.ragdoll || !e.body.root.visible || gore.hasPool(e)) continue;
      const b = e.body;
      if ((b.asleep && b.asleepFor * 1000 >= POOLS.afterSleepMs) || e.deadFor * 1000 >= POOLS.afterRagdollMs) {
        const at = b.joints.chest.clone().lerp(b.joints.pelvis, 0.45);
        gore.pool(at, POOLS.radius[e.deathVariant ?? "base"] ?? POOLS.radius.base!, e.id, e);
      }
    }
  }
  /**
   * C17 (S5.3): each kill goes to the kill-cam rules (the multi-kill count, the cooldown). A kill that earns the
   * orbit starts it here, before the last-enemy slow motion, which then stands aside. A takedown is its own cinema
   * (it counts for the cooldown but plays no second camera), and so is a Second Wind's revive.
   */
  function judgeKillCams(): void {
    for (const k of combat.kills) {
      if (k.enemy.kit.role === "civilian") continue;
      sessionKills++;
      const last = !k.takedown ? encounterCleared(k.enemy, enemies) : !enemies.some((x) => x !== k.enemy && x.alive && x.state === "combat");
      const kk = {
        now: performance.now(),
        last,
        headshot: k.headshot,
        severed: k.severed.length > 0,
        takedown: k.takedown,
        ballistic: false,
        predicted: false,
        distance: k.distance,
        killsThisSave: killsThisSave(),
        finale: !!job && last,
      };
      // Judged first and committed only when the camera really plays: a takedown, a revive or a death that would
      // have earned one counts toward a multi-kill but never starts the cooldown.
      const shot = kcRules.wouldTrigger(kk);
      if (!shot || o.shot || killcam.active || k.takedown || td.active || dead || secondWind.active || secondWind.phase === "revived") {
        kcRules.note(kk);
        continue;
      }
      kcRules.kill(kk);
      killcam.caption = last ? (k.headshot ? "Last man · Headshot" : "Last man") : "Multi-kill";
      killcam.startOrbit(k.enemy, eye);
      kcBegin();
      audio?.killcamWhoosh();
    }
  }
  function drainEvents(): void {
    drainDeaths();
    judgeKillCams();
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
      // The impact, in the world where it landed: meat on flesh, a metal tonk on armour (S4.5).
      toHit.set(d.point.x, d.point.y, d.point.z).sub(camPos);
      const dist = toHit.length();
      const pan = dist > 0.01 ? toHit.dot(camRight) / dist : 0;
      if (hardHit(d)) audio?.hitPlate(d.damage > 20 || !!d.plateBroke, pan, dist);
      else audio?.hitFlesh(d.damage > 40, pan, dist);
      if (!d.lethal) grunt(d.targetUid, d.point, false);
    }
    frameHits.length = 0;
    if (best) {
      const d = best.d;
      hud.hitMarker(best.cls);
      audio?.confirm(confirmSound(best.cls, d));
      // A crit that didn't kill (the stagger window's guaranteed one, or a lucky round) says so in the feed (S4.2).
      if (d.crit && !d.lethal && !o.shot) hud.feedLine("Crit", true);
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
    // A near miss can make them shout (S1.1): "Taking fire!" through the squad's radio and its rate limits (S10).
    if (combat.barks.length && combat.clock - lastBark > 6) {
      const who = combat.barks[0]!;
      if (director.squadOf(who) ? director.say(who, "suppressed") : true) {
        lastBark = combat.clock;
        if (!director.squadOf(who)) hud.bark(barkSpeaker(who), BARKS[Math.floor(Math.random() * BARKS.length)]!);
      }
    }
    combat.barks.length = 0;
    combat.kills.length = 0;
    combat.hits.length = 0;
  }

  function render(): void {
    const t0 = performance.now();
    if (keyArt) world.viewScene.visible = false;
    // C10: the review lineups aren't in the street's enemy list: their visors, blinks and LODs still tick.
    for (const e of lineup) e.body.pose();
    if (reviewRender) reviewRender();
    else if (zoomOn && zoomAt) {
      // The close-up: the camera moved off his struck side and turned on the hand, a lens 0.4 m across, her gun hidden.
      const cam = world.camera;
      const q = cam.quaternion.clone();
      const pos = cam.position.clone();
      const fov = cam.fov;
      const z = zoomAt();
      cam.position.copy(cam.parent ? cam.parent.worldToLocal(z.from.clone()) : z.from);
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(0.2 / z.from.distanceTo(z.at)));
      cam.lookAt(z.at);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const vs = world.viewScene.visible;
      world.viewScene.visible = false;
      // The blood puff hides the glove 1.1 m from the lens (C10 review: "a red mist blob"): the close-up judges the
      // hand, so the particles sit this frame out.
      const motes: THREE.Object3D[] = [];
      world.scene.traverse((o) => {
        const mote = (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || o.name === "gore:mist" || o.name === "gore:drops" || o.name === "fx:light" || o.name === "fx:matter";
        if (mote && o.visible) {
          o.visible = false;
          motes.push(o);
        }
      });
      world.render();
      for (const o of motes) o.visible = true;
      world.viewScene.visible = vs;
      cam.quaternion.copy(q);
      cam.position.copy(pos);
      cam.fov = fov;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    } else world.render();
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
  let stageChar: Progress["character"] | null = null;
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
    if (gunLineup) gunLineup.visible = false;
    if (streetVmEnv) world.viewScene.environment = streetVmEnv;
    hud.review(false);
    arsenal.hideGun = false;
    hud.freeze(null);
    hud.clearFeedback();
    showCover(false);
    pickups.clear();
    orbs.clear();
    if (td.active) {
      td.finish();
      timescale.release("takedown");
      hud.cinema(0);
      world.viewScene.visible = true;
    }
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
  // C18 "Every gun is a hero": each class at rest, 20 ms after a shot, mid-reload (and aimed, and the empty
  // reload), and the seven guns side by side. `<model>-fire` also lights the street with the class's flash (the
  // acceptance probes the wet floor), and `heroInfo` carries the parts and probe points for the runner.
  const C18_MODELS: Record<string, string> = { revolver: "oldTestament", smg: "rattlecan", rifle: "corridorAR", shotgun: "fishmonger", sniper: "widowmaker", launcher: "bargainBin" };
  const C18_RE = /^(revolver|smg|rifle|shotgun|sniper|launcher)-(idle|ads|fire|reload|reload-mid|reload-empty)$/;
  let gunLineup: THREE.Group | null = null;
  const c18Stage = (name: string, tMs: number): string => {
    // The Kestrel's stage set-up (the street, the calm, the settled gun), then the class.
    c4Stage("pistol-idle", 0);
    if (gunLineup) gunLineup.visible = false;
    arsenal.rig.root.visible = true;
    if (name === "arsenal-lineup") return lineupStage();
    const m = C18_RE.exec(name)!;
    const model = m[1]!;
    const moment = m[2]!;
    arsenal.owned.add(C18_MODELS[model]!);
    arsenal.equipId(C18_MODELS[model]!);
    arsenal.settle();
    const aimed = moment === "ads";
    arsenal.holdAim = aimed;
    arsenal.aiming = aimed;
    arsenal.anim.aim = aimed ? 1 : 0;
    const poseOnce = (dt: number) => arsenal.pose(dt, { yaw: 0, pitch: 0 }, 0, 0, false, 0, world.viewCamera, BASE_FOV);
    arsenal.setView(world.camera.getWorldPosition(camPosV), world.camera.getWorldQuaternion(camQuatV));
    for (let i = 0; i < 90; i++) poseOnce(1 / 60);
    const f = arsenal.hero!;
    const t = Math.max(0, tMs);
    if (moment === "fire") {
      arsenal.stageHeroFire();
      poseOnce(0);
      const n = Math.max(1, Math.ceil(t / 4));
      for (let i = 0; i < n && t > 0; i++) poseOnce(t / n / 1000);
      arsenal.stageTime(t);
      // The flash's light on the street (the one shared PointLight, S2.3), held at its value `t` ms in.
      const r = arsenal.rig;
      r.root.updateMatrixWorld(true);
      const q = world.camera.getWorldQuaternion(camQuatV);
      const mz = r.muzzle.getWorldPosition(new THREE.Vector3()).applyQuaternion(q).add(world.camera.getWorldPosition(camPosV));
      world.fx.muzzle(mz, world.camera.getWorldDirection(new THREE.Vector3()), f.flash.sizeM * 6, false, { intensity: f.flash.light, range: f.flash.lightRangeM });
    } else if (moment === "reload" || moment === "reload-mid" || moment === "reload-empty") {
      const at = moment === "reload-mid" ? (f.model === "shotgun" ? 260 + 200 : Math.round(f.tac.dur * 0.45)) : t;
      arsenal.stageHeroReload(moment === "reload-empty" ? "empty" : "tac", at);
    }
    arsenal.freeze = true;
    poseOnce(1 / 60);
    arsenal.freeze = !!o.shot;
    arsenal.cues.length = 0;
    s.pistolInfo = heroInfo();
    hud.freeze(tMs);
    return "ok";
  };
  /**
   * The seven guns on their left flanks, one real-world scale, as an armoury plate (C18 review: the HUD sat over
   * it, the scales lied and the guns went black): handguns and the SMG on the left, long guns on the right, each
   * with its name, under a studio key, a warm top rim and a cool kick, with a studio softbox swapped in for the
   * viewmodel's reflections so the Cerakote, the bronze and the faction plates read.
   */
  let lineupEnv: THREE.Texture | null = null;
  let streetVmEnv: THREE.Texture | null = null;
  const LINEUP: [GunModel, string, number][] = [
    // model, name, column (0 handguns, 1 long guns)
    ["pistol", "KESTREL 9", 0],
    ["revolver", "OLD TESTAMENT", 0],
    ["smg", "RATTLECAN", 0],
    ["rifle", "CORRIDOR AR", 1],
    ["shotgun", "FISHMONGER", 1],
    ["sniper", "WIDOWMAKER", 1],
    ["launcher", "BARGAIN BIN", 1],
  ];
  const nameTag = (text: string): THREE.Mesh => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 96;
    const g = c.getContext("2d");
    if (g) {
      // C13T: caps labels track at most 0.06em (3 px on 60 px; C18 review r2: 8 px on 52 px was 0.15em).
      g.font = '600 60px "Cathode UI", "Cathode UI Fallback", sans-serif';
      g.textBaseline = "middle";
      (g as unknown as { letterSpacing: string }).letterSpacing = "3px";
      g.fillStyle = "#3fe0ff";
      g.fillRect(0, 30, 4, 36);
      g.fillStyle = "rgba(236, 232, 226, 0.92)";
      g.fillText(text, 26, 50);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 96 / 1024), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    m.name = `tag:${text}`;
    return m;
  };
  const studioEnv = (): THREE.Texture => {
    if (lineupEnv) return lineupEnv;
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x050608);
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), new THREE.MeshBasicMaterial({ color: 0x0b0c10, side: THREE.BackSide }));
    room.add(box);
    const panel = (c: number, k: number, p: [number, number, number], sz: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...sz), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }));
      m.position.set(...p);
      room.add(m);
    };
    // A big softbox behind the camera and above (what the flanks face), a strip over the top, a cyan kick behind.
    panel(0xfff4ea, 1.1, [-0.6, 1.3, 2.95], [2.2, 1.0, 0.05]);
    panel(0xffd8b0, 2.4, [0, 1.95, 0.4], [4.2, 0.05, 0.6]);
    panel(0x3fe0ff, 2.2, [2.0, 0.4, -2.95], [1.2, 2.2, 0.05]);
    panel(0x8090a8, 0.5, [0, -1.95, 1.2], [5, 0.05, 2.5]);
    const gen = new THREE.PMREMGenerator(world.renderer);
    lineupEnv = gen.fromScene(room, 0.03).texture;
    gen.dispose();
    return lineupEnv;
  };
  const lineupStage = (): string => {
    arsenal.hideGun = true;
    arsenal.rig.root.visible = false;
    hud.review(true);
    if (!gunLineup) {
      gunLineup = new THREE.Group();
      gunLineup.name = "arsenal-lineup";
      // A studio plate behind them: a graphite sweep, a soft pool of light behind each column, a dark vignette.
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.ShaderMaterial({
        depthWrite: false,
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "varying vec2 vUv; void main() { vec2 p = (vUv - 0.5) * vec2(1.8, 1.0); float a = exp(-dot(p - vec2(-0.2, 0.06), p - vec2(-0.2, 0.06)) * 9.0); float b = exp(-dot(p - vec2(0.22, 0.04), p - vec2(0.22, 0.04)) * 7.0); float v = smoothstep(1.1, 0.2, length(p)); vec3 c = vec3(0.0008, 0.0009, 0.0012) + vec3(0.0045, 0.0048, 0.0058) * v * v + vec3(0.009, 0.0085, 0.008) * (a + b); gl_FragColor = vec4(c, 1.0); }",
      }));
      plate.position.set(0, 0, -2.6);
      plate.renderOrder = -1;
      gunLineup.add(plate);
      // The studio lights: they ride the group, so they're only on while the plate is up.
      // C18 review r2: a hero-shot rig on a near-black plate: the key, a hot warm top rim and a cool kick that
      // trace every edge and bevel, and a second warm rim from behind-left so the muzzles' ends separate too.
      const key = new THREE.DirectionalLight(0xfff1e4, 1.5);
      key.position.set(-0.5, 0.8, 1);
      const top = new THREE.DirectionalLight(0xffd2a0, 2.8);
      top.position.set(0.2, 1, -0.3);
      const kick = new THREE.DirectionalLight(0x5fd8ff, 2.6);
      kick.position.set(1, 0.1, -0.6);
      const rim = new THREE.DirectionalLight(0xffcf9a, 1.8);
      rim.position.set(-1, 0.35, -0.8);
      gunLineup.add(key, top, kick, rim);
      for (const [model, label] of LINEUP) {
        const g = buildGunDisplay(model, o.quality === "phone");
        const box = new THREE.Box3().setFromObject(g);
        const c = box.getCenter(new THREE.Vector3());
        const holder = new THREE.Group();
        holder.name = `lineup:${model}`;
        g.position.sub(c);
        holder.add(g);
        // The left flank to her, muzzle left, turned a few degrees so the top and the plate catch the key.
        holder.rotation.set(0.1, Math.PI / 2 - 0.16, 0, "YXZ");
        holder.userData.size = box.getSize(new THREE.Vector3());
        const tag = nameTag(label);
        tag.name = `tag:${model}`;
        gunLineup.add(holder, tag);
      }
      world.viewScene.add(gunLineup);
    }
    // Lay out for this view: one scale for all seven (S2.6's real sizes), two columns inside a safe margin.
    const cam = world.viewCamera;
    const Z = 1.3;
    const H = 2 * Z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const W = H * cam.aspect;
    // C18 review r2: each column has its own scale (the handguns at one scale, the long guns at another), so the
    // handguns fill their column instead of sitting small beside a dead gap.
    const colWs = [W * 0.34, W * 0.44];
    const gap = H * 0.035;
    const cols: [GunModel, number][][] = [[], []];
    for (const [m, , col] of LINEUP) cols[col]!.push([m, col]);
    const sizeOf = (m: GunModel) => (gunLineup!.getObjectByName(`lineup:${m}`)!.userData.size as THREE.Vector3);
    const tagH = H * 0.045;
    const colH = (list: [GunModel, number][], k: number) => list.reduce((a, [m]) => a + sizeOf(m).y * k + tagH + gap, -gap);
    const ks = cols.map((l, ci) => Math.min(colWs[ci]! / Math.max(...l.map(([m]) => sizeOf(m).z)), (H * 0.8) / colH(l, 1)));
    // The long guns fill the rack's height; muzzles and names align left in each column.
    const span = colH(cols[1]!, ks[1]!);
    for (let ci = 0; ci < 2; ci++) {
      const list = cols[ci]!;
      const k = ks[ci]!;
      const left = (ci === 0 ? -0.43 : -0.05) * W;
      // The handguns sit as a group, centred, a little looser than the rack.
      const g2 = ci === 1 ? gap + (span - colH(list, k)) / Math.max(1, list.length - 1) : gap + Math.max(0, span - colH(list, k)) / Math.max(1, list.length - 1);
      let y = ci === 1 ? span / 2 : (colH(list, k) + (g2 - gap) * (list.length - 1)) / 2;
      for (const [m] of list) {
        const sz = sizeOf(m);
        const h = gunLineup.getObjectByName(`lineup:${m}`)!;
        h.scale.setScalar(k);
        h.position.set(left + (sz.z * k) / 2, y - (sz.y * k) / 2, -Z);
        const tag = gunLineup.getObjectByName(`tag:${m}`)!;
        const tw = H * 0.4;
        tag.scale.setScalar(tw);
        tag.position.set(left + tw / 2, y - sz.y * k - tagH * 0.6, -Z);
        y -= sz.y * k + tagH + g2;
      }
    }
    if (world.viewScene.environment !== studioEnv()) streetVmEnv = world.viewScene.environment;
    world.viewScene.environment = studioEnv();
    gunLineup.visible = true;
    s.pistolInfo = null;
    hud.freeze(0);
    return "ok";
  };
  /** C18 acceptance: the hero gun's state, its muzzle on screen, and a floor point beside the gun to probe. */
  const heroInfo = (): Record<string, unknown> => {
    const r = arsenal.rig;
    r.root.updateMatrixWorld(true);
    const c = world.renderer.domElement;
    const scrV = (v: THREE.Vector3, cam: THREE.Camera) => {
      const p = v.clone().project(cam);
      return { x: ((p.x + 1) / 2) * c.clientWidth, y: ((1 - p.y) / 2) * c.clientHeight };
    };
    const mz = r.muzzle.getWorldPosition(new THREE.Vector3());
    // The wet street 3 m ahead and 1.2 m left of her line of sight, where neither hand nor gun sits.
    const fwd = world.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const eyeW = world.camera.getWorldPosition(new THREE.Vector3());
    const fp = eyeW.clone().addScaledVector(fwd, 3).addScaledVector(left, 1.2);
    fp.y = ground(fp.x, fp.z);
    const fr = eyeW.clone().addScaledVector(fwd, 3).addScaledVector(left, 1.6);
    fr.y = ground(fr.x, fr.z);
    const floor = scrV(fp, world.camera);
    const floorR = Math.hypot(scrV(fr, world.camera).x - floor.x, scrV(fr, world.camera).y - floor.y);
    const parts: Record<string, number[]> = {};
    for (const n of ["bolt", "pump", "cylinder", "crane", "breech", "mag", "charge", "ejector", "loader", "shell", "round"]) {
      const p = r.parts[n];
      if (p) parts[n] = [p.position.x * 1000, p.position.y * 1000, p.position.z * 1000, (p.rotation.x * 180) / Math.PI, (p.rotation.y * 180) / Math.PI, (p.rotation.z * 180) / Math.PI, p.visible ? 1 : 0];
    }
    return { hero: arsenal.hero?.model ?? null, ...arsenal.heroState, muzzle: scrV(mz, world.viewCamera), floor, floorR, parts, ammo: arsenal.ammo };
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
    orbs.clear();
    if (td.active) {
      td.finish();
      timescale.release("takedown");
      hud.cinema(0);
      world.viewScene.visible = true;
    }
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
  /**
   * C9 "Deaths that land": a kill at close range with the variant forced, framed on the body at the stage's
   * moment (the base hit stage, a distance, a forced death, a wall behind him, and how he is turned).
   */
  const C9_STAGES: Record<string, { base: string; dist: number; variant: DeathVariant; wall?: boolean; turn?: number; pool?: boolean; helmet?: boolean; ms: number }> = {
    "death-gutclutch": { base: "hit-kill", dist: 4.6, variant: "gutclutch", ms: 450 },
    "death-wallslump": { base: "hit-kill", dist: 4.6, variant: "wallslump", wall: true, ms: 1200 },
    "death-headshot": { base: "hit-headkill", dist: 4.6, variant: "headshot", helmet: true, ms: 300 },
    "death-knees": { base: "hit-kill", dist: 4.6, variant: "knees", ms: 650 },
    "death-blownback": { base: "hit-kill", dist: 4.6, variant: "blownback", ms: 350 },
    "death-spin": { base: "hit-kill", dist: 4.6, variant: "spin", turn: 1.25, ms: 400 },
    "blood-pool": { base: "hit-kill", dist: 4.6, variant: "gutclutch", pool: true, ms: 8000 },
  };
  let c9: (typeof C9_STAGES)[string] | null = null;
  /**
   * C15 "Armour that breaks, enemies that stagger": a Kestrel round on the stage guard with his armour or stagger
   * meter set up so that this round does the thing (cracks the chest plate, breaks it, shatters the visor, staggers
   * him from the front or the back, knocks him down), shot at its moment and framed close and three-quarters on so
   * the plate, the carrier under it, the face, the steps read.
   */
  const C15_STAGES: Record<string, { base: string; dist: number; ms: number; turn?: number; pre: (g: Enemy, raw: number) => void; frame: "plate" | "head" | "body" | "back" | "front" | "side" | "quarter"; weapon?: string; rounds?: number; aimUp?: boolean; aimAt?: (g: Enemy) => THREE.Vector3; tick?: (g: Enemy, dt: number) => void; far?: number; shield?: boolean }> = {
    // The e2e's check (C15): six Corridor AR rounds into a fresh guard's chest from 8 m break the front plate.
    "plate-rifle-6": { base: "hit-body", dist: 8, ms: 40, frame: "body", weapon: "corridorAR", rounds: 6, pre: (g) => (g.hp = g.kit.maxHp * 3) },
    "enemy-plate-cracked": {
      base: "hit-body",
      dist: 3.4,
      ms: 140,
      frame: "plate",
      // High on the plate, clear of the carbine he holds across his belly.
      aimAt: (g) => g.body.joints.chest.clone().lerp(g.body.joints.neck, 0.4),
      // The round leaves the plate at 45%: cracked, not broken; and no stagger in the way of the crack.
      pre: (g, raw) => {
        const p = g.armour!.plates.chestF;
        p.hp = p.maxHp * 0.45 + raw;
        g.stag.staggerCd = 2;
      },
    },
    "enemy-plate-broken": {
      base: "hit-body",
      dist: 3.4,
      ms: 650,
      frame: "plate",
      // Further back than the crack, so the plate is in the street at his feet (C15 review: it hung by her muzzle).
      far: 2.3,
      pre: (g, raw) => {
        const p = g.armour!.plates.chestF;
        p.hp = Math.min(p.maxHp * 0.3, raw * 0.5);
        p.state = "cracked";
        g.syncPlates();
        g.stag.staggerCd = 2;
      },
    },
    "visor-shatter": {
      base: "hit-head",
      dist: 3.4,
      ms: 120,
      frame: "head",
      pre: (g) => {
        g.armour!.visor = 1;
        g.syncPlates();
        // A Kestrel headshot through a cracked visor kills a fresh guard: this one lives to show the face and the snap.
        g.hp = g.kit.maxHp * 3;
      },
    },
    // The front stagger is shot from in front of him (three-quarters, his rifle side away): the steps back toward the
    // lens, the dropped weapon arm and the folding head read; side-on they collapsed into a crouch (C15 review).
    "enemy-stagger-front": { base: "hit-body", dist: 5.5, ms: 200, frame: "front", far: 3.6, pre: (g) => (g.stag.meter = 0.34) },
    // Between the shoulder blades (the back plate), clear of the coolant can low on his spine; framed in profile, so
    // the forward pitch and the flung arms read as a stumble, not a jog away.
    "enemy-stagger-back": { base: "hit-body", dist: 5.5, ms: 200, turn: Math.PI, frame: "quarter", far: 3.4, aimUp: true, pre: (g) => (g.stag.meter = 0.34) },
    "enemy-knockdown": { base: "hit-body", dist: 5.5, ms: 1000, frame: "body", pre: (g) => (g.stag.meter = 0.79) },
    // C15 (S4.3): a round through his weapon forearm takes the carbine; 700 ms on he's drawing the sidearm off his
    // thigh, the carbine in the street.
    "enemy-disarm": {
      base: "hit-body",
      dist: 4,
      ms: 1250,
      frame: "front",
      far: 2.8,
      aimAt: (g) => g.body.joints.handR.clone().lerp(g.body.joints.elbowR, 0.3),
      pre: (g) => {
        g.hp = g.kit.maxHp * 3;
        combat.forceDisarm = 0;
      },
    },
    // C15 (S4.2): knocked down at 9% health he doesn't get up: he goes over onto his front and crawls.
    "enemy-crawl": {
      base: "hit-body",
      dist: 5.5,
      ms: 3900,
      frame: "side",
      far: 3.4,
      pre: (g, raw) => {
        g.hp = g.kit.maxHp * 0.09 + raw * 0.9;
        g.stag.meter = 0.79;
        g.lastKnown.copy(player.pos);
        Enemy.forceCrawl = true;
      },
    },
    // C15 (the C10 carry-over): the round that wears a riot shield through breaks it in three; 450 ms on the pieces
    // are coming down round him and he reels back a step without it.
    "enemy-shield-break": {
      base: "hit-body",
      dist: 4.5,
      ms: 450,
      frame: "front",
      far: 3.6,
      shield: true,
      // Into the face of the shield, square on.
      aimAt: (g) => (g.shield ? g.shield.getWorldPosition(new THREE.Vector3()) : g.body.joints.chest.clone()),
      pre: (g) => {
        g.shieldHp = 0.01;
      },
    },
    // C15 (S4.2): a guard carrying his wounds: the left leg limping, the left arm hanging, hunched below 25%.
    "enemy-wounded": {
      base: "hit-body",
      dist: 5.5,
      ms: 900,
      frame: "front",
      far: 4.2,
      aimAt: (g) => g.body.joints.footR.clone().lerp(g.body.joints.kneeR, 0.5),
      pre: (g, raw) => {
        g.hp = g.kit.maxHp * 0.22 + raw * 1.8;
        g.wounds.dmg.legL = g.kit.maxHp * 0.2;
        g.wounds.dmg.armL = g.kit.maxHp * 0.2;
        g.wounds.dmg.torso = g.kit.maxHp * 0.4;
        g.stag.staggerCd = 5;
        g.stag.knockCd = 5;
      },
      tick: (g, dt) => {
        g.motion.speed = 1.1;
        g.motion.phase += 1.1 * dt * 3.1;
      },
    },
  };
  let c15: (typeof C15_STAGES)[string] | null = null;
  /** C9: a body's joint heights over the street under each joint (m), rounded to the centimetre. */
  const jointHeights = (g: Enemy): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const j of ["pelvis", "chest", "head", "kneeL", "kneeR", "footL", "footR"] as const) {
      const p = g.body.joints[j];
      out[j] = Math.round((p.y - ground(p.x, p.z)) * 100) / 100;
    }
    return out;
  };
  const STAGES = ["hit-arm", "hit-body", "hit-head", "hit-kill", "hit-headkill", "hit-soft", "hit-pen", "hit-armourbreak", "blocked", "peek-head", "cover-debug-market", "enemy-flinch-head-60", "wall-splat"];
  /** A world point on screen, in CSS px. */
  const toScreen = (p: THREE.Vector3) => {
    const v = p.clone().project(world.camera);
    const c = world.renderer.domElement;
    return { x: ((v.x + 1) / 2) * c.clientWidth, y: ((1 - v.y) / 2) * c.clientHeight };
  };
  /** A stage starts with her whole and still: no flinch ringing, no flare, no grenade, full Guard and Flesh. */
  const calmVitals = () => {
    if (dead || dying || resyncT >= 0) clearDeath();
    // Nor does an earlier stage's kill XP: every stage shows her at the level the first one found her at.
    if (!stageChar) stageChar = progress.character;
    else if (progress.character !== stageChar) {
      progress.set(stageChar);
      s.maxHp = progress.stats.maxHealth;
      s.level = progress.character.level;
    }
    // A staged level-up raises the HUD's level for its frame; the next stage shows her real one again.
    s.level = progress.character.level;
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
      world.setDeath?.({ death: 0, ink: rs.ink, glitch: resyncGlitch(rs.glitch), ca: 1, grey: o.intensity === "reduced" });
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
      g.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z) + (c9?.turn ?? 0);
      g.state = "combat";
      g.flinch.reset();
      const sightHer: Sight = { eye: eye.clone(), chest: player.pos.clone().add(new THREE.Vector3(0, player.eyeHeight * 0.75, 0)), light: 1, low: 0, speed: 0, stealth: 1 };
      for (let i = 0; i < 30; i++) g.update(1 / 30, sightHer, rays, world.colliders, ground);
      g.shots.length = 0;
    }
    // The round that kills her.
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
      world.setDeath?.({ death: st.death * (rs.ink / DT.ink), ink: rs.ink, glitch: resyncGlitch(rs.glitch), ca: st.ca, grey: o.intensity === "reduced" });
      screen.resyncFrame(rs.black, null);
      restarting = true;
    }
    return "ok";
  };
  // ---- C10 "Enforcer v2" review stages ----
  // enemy-front-10m / enemy-back-10m: the stage guard 10 m down the street, idle, facing her or turned away.
  // turntable-<arch>: four of one archetype side by side, turned 0, 45, 90 and 180 degrees, 4.6 m off.
  // silhouette-lineup: the archetypes side by side as flat black on mid grey (S3.1's silhouette test).
  // guard-from-10m: the owner's audit frame, the first job's guard under his lamp 10 m off, with no diamond (&job).
  // firefight-<n> (S0 performance, scripts/cathode-perf.mjs): n riflemen shouldered and firing at her, spread 6 to
  // 16 m down the street ahead, in the whole lit, reflected scene (the street's own enemies all hidden, so the
  // count is exactly n; any n works, these two are the budget's): the draw-call and triangle budget frame.
  const C10_STAGES = ["firefight-6", "firefight-12", "enemy-front-10m", "enemy-back-10m", "turntable-enforcer", "turntable-riot", "turntable-sniper", "turntable-leader", "silhouette-lineup", "guard-from-10m"];
  let reviewRender: (() => void) | null = null;
  let lineup: Enemy[] = [];
  let probeGuard: Enemy | null = null;
  const LINEUP_KITS: Record<string, EnemyKit> = { enforcer: ENFORCER, leader: { ...ENFORCER, name: "Enforcer Sergeant", leader: true }, riot: RIOT_SHIELD, sniper: ENFORCER_SNIPER };
  const clearReview = () => {
    for (const e of lineup) e.body.dispose();
    lineup = [];
    reviewRender = null;
    probeGuard = null;
    hud.review(false);
    world.viewScene.visible = true;
  };
  const sightNone = (): Sight => ({ eye: new THREE.Vector3(0, -500, 0), chest: new THREE.Vector3(0, -500, 0), light: 0, low: 1, speed: 0, stealth: 0 });
  /** Puts the camera at `from` (her feet), looking at `at`. */
  const lookFrom = (from: THREE.Vector3, at: THREE.Vector3) => {
    player.pos.copy(from);
    player.vel.set(0, 0, 0);
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    const d = at.clone().sub(eye).normalize();
    player.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    player.yaw = Math.atan2(-d.x, -d.z);
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
  };
  const c10Stage = (name: string, tMs: number): string => {
    hud.freeze(null);
    hud.clearFeedback();
    showCover(false);
    pickups.clear();
    orbs.clear();
    if (td.active) {
      td.finish();
      timescale.release("takedown");
      hud.cinema(0);
      world.viewScene.visible = true;
    }
    world.fx.clear?.();
    if (stageCrate) stageCrate.visible = false;
    if (crateCollider) crateCollider.off = true;
    staged = true;
    s.stageInfo = null;
    for (const e of enemies) {
      if (e.alive && e.state !== "dead") e.state = "unaware";
      e.detect = 0;
    }
    s.hp = s.maxHp;
    if (name === "guard-from-10m") {
      if (!job) return "no job (load with &job)";
      job.skipTo(1);
      // No diamond: the frame asks whether he reads on his own.
      job.target = null;
      const g = enemies.find((e) => e.alive && e.passive);
      if (!g) return "no guard";
      g.update(0.0001, sightNone(), rays, world.colliders, ground);
      const from = new THREE.Vector3(g.position.x, 0, g.position.z + 10);
      from.y = ground(from.x, from.z);
      lookFrom(from, g.body.joints.chest.clone());
      probeGuard = g;
      hud.freeze(tMs);
      return "ok";
    }
    if (!stageHome) stageHome = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
    player.pos.copy(stageHome.pos);
    player.yaw = stageHome.yaw;
    player.pitch = stageHome.pitch;
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const side = new THREE.Vector3(-flat.z, 0, flat.x);
    if (name === "enemy-front-10m" || name === "enemy-back-10m") {
      if (stageGuard && stageGuard.body.lost.size === 0 && enemies.includes(stageGuard)) {
        if (!stageGuard.alive) stageGuard.revive();
      } else stageGuard = null;
      const rifle = enemies.filter((e) => e.alive && (e.kit.role ?? "rifle") === "rifle").sort((a, b) => a.position.distanceTo(eye) - b.position.distanceTo(eye));
      const g = stageGuard ?? rifle[0];
      if (!g) return "no enemy";
      stageGuard = g;
      g.revive();
      const at = eye.clone().addScaledVector(flat, 10);
      at.y = ground(at.x, at.z);
      g.motion.pos.copy(at);
      g.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z) + (name === "enemy-back-10m" ? Math.PI : 0);
      g.hp = g.kit.maxHp;
      g.flinch.reset();
      g.update(0.0001, sightNone(), rays, world.colliders, ground);
      // Framed on him, a touch left of centre so the reticle sits beside him and not on his chest.
      lookFrom(stageHome.pos, g.body.joints.chest.clone().addScaledVector(side, -0.55));
      probeGuard = g;
      hud.freeze(tMs);
      return "ok";
    }
    const ff = /^firefight-(\d+)$/.exec(name);
    if (ff) {
      const n = Number(ff[1]);
      // Every street enemy out (the far ones' LOD2 and mirror stand-ins were 20 calls of their own): exactly n.
      const hide = enemies.filter((e) => e.body.root.visible);
      for (const e of hide) e.body.root.visible = false;
      lineupHidden.push(...hide);
      bodyView.eye.copy(eye);
      for (let i = 0; i < n; i++) {
        const e = new Enemy({ ...ENFORCER }, [new THREE.Vector3()], 1);
        const ang = ((i % 6) / 5 - 0.5) * 0.9;
        const dist = 6 + (i / Math.max(1, n - 1)) * 10;
        const at = eye.clone().addScaledVector(flat, Math.cos(ang) * dist).addScaledVector(side, Math.sin(ang) * dist);
        at.y = ground(at.x, at.z);
        e.motion.pos.copy(at);
        e.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z);
        e.motion.aim = 1;
        e.motion.kick = 0.6;
        e.passive = true;
        world.scene.add(e.body.root);
        e.update(0.0001, sightNone(), rays, world.colliders, ground);
        e.motion.aim = 1;
        e.motion.kick = 0.6;
        e.body.pose();
        lineup.push(e);
      }
      lookFrom(stageHome.pos, eye.clone().addScaledVector(flat, 10).setY(ground(eye.x, eye.z) + 1.2));
      hud.freeze(tMs);
      return "ok";
    }
    // The lineups: their own figures in the open street ahead, the street's own enemies out of the frame.
    const arch = name.startsWith("turntable-") ? name.slice("turntable-".length) : null;
    const kits = arch ? [arch, arch, arch, arch] : ["enforcer", "leader", "riot", "sniper"];
    const turns = arch ? [0, Math.PI / 4, Math.PI / 2, Math.PI] : [0.35, 0.35, 0.35, 0.35];
    const centre = eye.clone().addScaledVector(flat, arch ? 3.6 : 4.4);
    const gap = arch ? 0.95 : 1.05;
    for (const [i, k] of kits.entries()) {
      const kit = LINEUP_KITS[k];
      if (!kit) return `unknown archetype ${k}`;
      const e = new Enemy({ ...kit }, [new THREE.Vector3()], 1);
      const at = centre.clone().addScaledVector(side, (i - (kits.length - 1) / 2) * gap);
      at.y = ground(at.x, at.z);
      e.motion.pos.copy(at);
      e.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z) + turns[i]!;
      e.passive = true;
      world.scene.add(e.body.root);
      e.update(0.0001, sightNone(), rays, world.colliders, ground);
      lineup.push(e);
    }
    const hide = enemies.filter((e) => e.body.root.visible && e.body.root.position.distanceTo(centre) < 30);
    for (const e of hide) e.body.root.visible = false;
    lineupHidden.push(...hide);
    world.viewScene.visible = false;
    hud.review(true);
    lookFrom(stageHome.pos, centre.clone().setY(ground(centre.x, centre.z) + 0.95));
    bodyView.eye.copy(eye);
    {
      // The lineup's box on screen (CSS px), for the review crop.
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const e of lineup)
        for (const j of ["head", "footL", "footR", "handL", "handR", "shoulderL", "shoulderR"] as const) {
          const p = toScreen(e.body.joints[j].clone().add(new THREE.Vector3(0, j === "head" ? 0.2 : j.startsWith("foot") ? -0.08 : 0, 0)));
          x0 = Math.min(x0, p.x);
          x1 = Math.max(x1, p.x);
          y0 = Math.min(y0, p.y);
          y1 = Math.max(y1, p.y);
        }
      const z0 = { x: 0, y: 0 };
      s.stageInfo = { hit: z0, r02: 0, head0: z0, head1: z0, puffM: 0, splats: [], corpse: { pelvis: z0, head: z0, chest: z0 }, box: { x: x0 - 30, y: y0 - 20, w: x1 - x0 + 60, h: y1 - y0 + 40 } };
    }
    if (name === "silhouette-lineup") {
      const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const grey = new THREE.Color(0x808080);
      const keep = new Set<THREE.Object3D>();
      for (const e of lineup) e.body.root.traverse((o) => keep.add(o));
      reviewRender = () => {
        const sc = world.scene;
        const off: THREE.Object3D[] = [];
        sc.traverse((o) => {
          const m = o as THREE.Mesh & THREE.Points & THREE.Line & THREE.Sprite;
          if ((m.isMesh || m.isPoints || m.isLine || m.isSprite) && m.visible && !keep.has(o)) {
            m.visible = false;
            off.push(m);
          }
        });
        const bg = sc.background;
        const fog = sc.fog;
        const ov = sc.overrideMaterial;
        sc.background = grey;
        sc.fog = null;
        sc.overrideMaterial = black;
        const r = world.renderer;
        const tm = r.toneMapping;
        r.toneMapping = THREE.NoToneMapping;
        r.setRenderTarget(null);
        // The world resets the renderer's counters itself (autoReset is off): without this the review frame's
        // calls piled up frame on frame and the draw-call budget check read 600-800 for four figures.
        r.info.reset();
        r.render(sc, world.camera);
        r.toneMapping = tm;
        sc.background = bg;
        sc.fog = fog;
        sc.overrideMaterial = ov;
        for (const m of off) m.visible = true;
      };
    }
    hud.freeze(tMs);
    return "ok";
  };
  // ---- C16 "Firefights with intent": a guard in cover, held at the S3.5 beat each stage names ----
  // enemy-peek: risen over a crouch-high crate 7 m out, head and chest showing, carbine on her. enemy-lean: rolled
  // out round a pillar. enemy-blindfire: head down behind the crate, the carbine over it, firing. enemy-reload-<ms>:
  // kneeling behind the crate seen from 50 degrees off, the support hand at the pouch and the spent mag in the street.
  // enemy-telegraph-<ms>: the sniper 22 m out with his laser that far into its sweep up the street to her.
  // bark-subtitle: the reload with its "Reloading!" over the radio.
  // enemy-grenade-<ms>: "Frag out!" from behind the crate, the grenade `ms` after the release on its arc to her,
  // its fuse light blinking and the HUD's grenade glyph on the ring.
  const C16_STAGES = ["enemy-peek", "enemy-lean", "enemy-blindfire", "enemy-reload", "enemy-telegraph", "bark-subtitle", "enemy-grenade"];
  let c16Props: THREE.Object3D[] = [];
  const c16Stage = (name: string, tMs: number): string => {
    hud.freeze(null);
    hud.clearFeedback();
    hud.clearBarks();
    showCover(false);
    pickups.clear();
    orbs.clear();
    world.fx.clear?.();
    nades.clear();
    if (stageCrate) stageCrate.visible = false;
    if (crateCollider) crateCollider.off = true;
    for (const p of c16Props) p.removeFromParent();
    c16Props = [];
    staged = true;
    stageQuiet = true;
    s.stageInfo = null;
    s.hp = s.maxHp;
    for (const e of enemies) {
      if (e.alive) e.state = "unaware";
      e.detect = 0;
    }
    if (!stageHome) stageHome = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
    player.pos.copy(stageHome.pos);
    player.yaw = stageHome.yaw;
    player.pitch = stageHome.pitch;
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const side = new THREE.Vector3(-flat.z, 0, flat.x);
    const hide = enemies.filter((e) => e.body.root.visible);
    for (const e of hide) e.body.root.visible = false;
    lineupHidden.push(...hide);
    bodyView.eye.copy(eye);
    const base = name.replace(/-\d+$/, "");
    const sniper = base === "enemy-telegraph";
    const reload = base === "enemy-reload" || base === "bark-subtitle";
    const lean = base === "enemy-lean";
    const kit = sniper ? { ...ENFORCER_SNIPER, role: "sniper" as const } : { ...ENFORCER };
    const e = new Enemy(kit, [new THREE.Vector3()], 1);
    e.passive = true;
    e.stagePose = true;
    // Close enough that he fills about a third of the frame (S3.5's beats have to read without the stage's name).
    const dist = sniper ? 18 : lean ? 3.3 : base === "enemy-grenade" ? 5.2 : 2.55;
    // The cover: a rusted cargo crate (1.15 m) or a concrete pillar (2.4 m) square to her line.
    const coverAt = eye.clone().addScaledVector(flat, dist - (lean ? 0.75 : 0.64)).addScaledVector(side, lean ? 0.72 : 0);
    coverAt.y = ground(coverAt.x, coverAt.z);
    const yawTo = Math.atan2(flat.x, flat.z);
    if (!sniper) {
      // Built like the street's art: a corrugated Hollowell crate, or a chamfered pillar weeping rust over a puddle.
      const matOf = (k: string) => world.material?.(k);
      const prop = lean ? concretePillar(0.9, 2.4, matOf) : cargoCrate(1.5, 1.15, 0.8, matOf);
      prop.position.copy(coverAt);
      // Its +z face (the crate's stencil, the pillar's poster and corner guards) toward her.
      prop.rotation.y = yawTo + Math.PI;
      world.scene.add(prop);
      c16Props.push(prop);
    }
    // Round the pillar his hips stay 0.2 m behind its edge (his feet hidden): the 25 degree roll of his spine is what
    // carries his head, one shoulder and the carbine out past it (C16 review: at 0.36 he stood clear of it).
    const at = eye.clone().addScaledVector(flat, dist).addScaledVector(side, sniper ? 1.5 : lean ? 0.56 : reload ? 0.3 : 0);
    if (!sniper) at.addScaledVector(flat, 0.05);
    at.y = ground(at.x, at.z);
    e.motion.pos.copy(at);
    // The camera: square on, or 50 degrees off for the reload (so the kneeling man shows past the crate's end).
    let from = stageHome.pos.clone();
    if (reload) {
      // C16 review: from where she stands, 20 degrees off his line: the crate hides him to the helmet, the shoulder
      // and the carbine's receiver showing past its end, and the mag he dropped lying out in the street in front.
      const off = side.clone().multiplyScalar(1.15).addScaledVector(flat, -3.2);
      from = at.clone().add(off);
      from.y = ground(from.x, from.z);
    }
    const eyeAt = from.clone().setY(from.y + 1.6);
    e.motion.yaw = Math.atan2(eyeAt.x - at.x, eyeAt.z - at.z);
    if (reload) {
      // Facing his cover, head down over the carbine, turned a little toward the crate's open end.
      const face = flat.clone().negate().addScaledVector(side, 0.35).normalize();
      e.motion.yaw = Math.atan2(face.x, face.z);
    }
    e.motion.aim = 1;
    e.motion.pitch = Math.atan2(eyeAt.y - (at.y + 1.5), Math.hypot(eyeAt.x - at.x, eyeAt.z - at.z));
    const grenade = base === "enemy-grenade";
    const pose = { lean: 0, blind: 0, reload: -1, hands: 0, throw: -1 };
    if (base === "enemy-peek") e.motion.crouch = 0.15;
    else if (grenade) {
      e.motion.crouch = 0.6;
      e.motion.aim = 0.25;
      pose.throw = 600;
    }
    else if (lean) pose.lean = -1;
    else if (base === "enemy-blindfire") {
      e.motion.crouch = 1.6;
      pose.blind = 1;
      e.motion.kick = 0.7;
    } else if (reload) {
      // Down on his heels rather than on one knee: his helmet and visor clear the lid, the rest of him behind it.
      e.motion.crouch = 1.25;
      e.motion.aim = 0.3;
      e.motion.pitch = -0.25;
    }
    e.motion.tac = pose;
    world.scene.add(e.body.root);
    lineup.push(e);
    const sight = sniper ? { ...sightNone(), chest: eyeAt.clone().setY(eyeAt.y - 0.35), eye: eyeAt.clone() } : sightNone();
    const ms = tMs === 40 ? Number(/-(\d+)$/.exec(name)?.[1] ?? (sniper ? 300 : reload ? 1000 : grenade ? 520 : 0)) : tMs;
    if (sniper) {
      // The sweep: the laser starts a step short of her feet and is `ms` into its 450 ms climb to her chest.
      e.state = "combat";
      e.charge = Math.max(0.06, ms / 1000);
      e.laserHold = ms / 1000;
      const f = sight.chest.clone().setY(ground(sight.chest.x, sight.chest.z) + 0.02);
      e.laserFrom.copy(f.add(new THREE.Vector3(at.x - f.x, 0, at.z - f.z).setLength(1.6)));
      e.laserAim.copy(sight.chest);
    }
    if (sniper) e.detect = 1;
    for (let i = 0; i < 4; i++) e.update(0.0001, sight as Sight, rays, world.colliders, ground);
    if (sniper) {
      e.state = "combat";
      e.detect = 1;
      e.charge = Math.max(0.06, ms / 1000);
      e.motion.aim = 1;
      e.update(0.0001, sight as Sight, rays, world.colliders, ground);
    }
    if (reload) {
      // Run the hand up to the drop, let the mag go, and let it fall and settle for the rest of the beat.
      pose.reload = Math.min(ms, RELOAD_KEYS.out);
      e.update(0.0001, sightNone(), rays, world.colliders, ground);
      if (ms >= RELOAD_KEYS.out) {
        e.dropMag();
        for (let t = RELOAD_KEYS.out; t < ms; t += 16) e.stepMags(0.016, ground, world.colliders);
      }
      pose.reload = ms;
      e.update(0.0001, sightNone(), rays, world.colliders, ground);
    }
    e.body.pose();
    if (grenade) {
      // Released from his hand at 600 ms, lobbed to land a step in front of her and off to her left, then held `ms`
      // into its flight; he's into the follow-through.
      const from = e.body.joints.handL.clone();
      const to = eye.clone().addScaledVector(flat, 1.4).addScaledVector(side, -1.2);
      to.y = ground(to.x, to.z);
      nades.throw(from, to);
      // The street's colliders are left out of the held arc: the stage shows the throw, not whatever it might clip.
      nades.advance(ms / 1000, ground, []);
      pose.throw = 600 + Math.min(ms, 550);
      e.update(0.0001, sightNone(), rays, world.colliders, ground);
      e.body.pose();
      hud.bark("Enforcer", "Frag out!", true);
    }
    if (base === "enemy-blindfire") {
      // The burst over the top, held on a round: the flash star at the muzzle, its light on the crate and his
      // arms, and the smoke it leaves hanging above the cover.
      const mf = new THREE.Vector3();
      const md = new THREE.Vector3();
      e.muzzle(mf, md);
      // Not the live flash: its light sits at the muzzle tip, just past the crate's lip, and floods the face toward her.
      for (const p of stageFlash(mf, md)) {
        world.scene.add(p);
        c16Props.push(p);
      }
      // C16 review: the carbine over the lid was a dark shape on a dark street. A cold top light from a neon sign up
      // and to her right, cut tight to the gun and his gloves, picks out the receiver's top, the magazine and the
      // knuckles over the lip (a light from behind him lit only faces turned away from her).
      const gunAt = e.body.grip.clone().lerp(e.body.foregrip, 0.5);
      const rimGun = new THREE.SpotLight(0xa8e4ff, 36, 4.5, 0.16, 0.45, 1.2);
      rimGun.position.copy(gunAt).addScaledVector(flat, -0.9).addScaledVector(side, 1.3).setY(gunAt.y + 1.2);
      rimGun.target.position.copy(gunAt);
      world.scene.add(rimGun, rimGun.target);
      c16Props.push(rimGun, rimGun.target);
    }
    // A review light over the cover, like the street's sodium lamps (the turntable's key and a cold rim): the stage spot
    // is between two lamps, where a man behind a crate is a silhouette.
    {
      // The key comes from a sodium lamp up and to the side of him (a lamp head on its arm is in the street), its narrow
      // cone landing on him and the cover top, not pooling on the road in front of her. A cold rim from behind and
      // the other side cuts his helmet and shoulders off the cover and the street behind.
      const target = sniper ? e.motion.pos : at;
      const key = new THREE.SpotLight(0xffb070, sniper ? 40 : 16, 9, 0.3, 0.7, 1.6);
      // Round the pillar the lamp is on her side of it (he leans out into it; the pool falls behind him).
      key.position.copy(target).addScaledVector(flat, lean ? -1.6 : 0.6).addScaledVector(side, -2.2).setY(target.y + 4.4);
      key.target.position.copy(target).setY(target.y + 1.1);
      const rim = new THREE.SpotLight(0x58d8ff, sniper ? 60 : 18, 10, 0.34, 0.5, 1.4);
      rim.position.copy(target).addScaledVector(flat, 2.4).addScaledVector(side, 1.8).setY(target.y + 3.4);
      rim.target.position.copy(target).setY(target.y + 1.2);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.12, 14), world.material?.("glowSodium") ?? new THREE.MeshBasicMaterial({ color: 0xffa050 }));
      lamp.position.copy(key.position);
      for (const l of [key, rim]) {
        world.scene.add(l, l.target);
        c16Props.push(l, l.target);
      }
      world.scene.add(lamp);
      c16Props.push(lamp);
      if (lean) {
        // Neon spill from across the street on the pillar's face (unlit, it read as a black slab), cut tight to the
        // pillar so it doesn't pool on the road.
        const spill = new THREE.SpotLight(0x8fb8ff, 24, 8, 0.22, 0.6, 1.5);
        spill.position.copy(coverAt).addScaledVector(flat, -3.2).addScaledVector(side, 2.4).setY(coverAt.y + 3);
        spill.target.position.copy(coverAt).setY(coverAt.y + 1.4);
        world.scene.add(spill, spill.target);
        c16Props.push(spill, spill.target);
      }
    }
    // She holds the Kestrel (the stages read as the fight, not the tutorial's Pin).
    if (arsenal.weapon.id !== "kestrel") {
      arsenal.owned.add("kestrel");
      arsenal.equipId("kestrel");
    }
    arsenal.settle();
    if (base === "bark-subtitle") hud.bark("Enforcer", "Reloading!", true);
    // Framed with him left of centre, clear of the pistol in her right hand.
    const camDir = e.body.joints.chest.clone().sub(eyeAt).setY(0).normalize();
    const camRight = new THREE.Vector3(-camDir.z, 0, camDir.x);
    lookFrom(from, sniper ? e.body.joints.chest.clone().lerp(eyeAt.clone().setY(at.y), 0.2).addScaledVector(camRight, 3.2) : e.body.joints.chest.clone().addScaledVector(camRight, reload ? 0.3 : 0.45).setY(base === "enemy-blindfire" ? coverAt.y + 1.05 : e.body.joints.chest.y - 0.1));
    probeGuard = e;
    if (reload && e.magDrops.length) {
      // The spent mag skidded out past the crate's end into the street, where she can see it: lying on its side a
      // step in front of the cover (placed along a ray through the frame, so it's always in shot), its steel edges
      // catching the lamp (a lit rim on every edge, not a pool of light on the road).
      const m = e.magDrops[e.magDrops.length - 1]!.obj;
      world.scene.attach(m);
      world.camera.updateMatrixWorld();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(-0.04, -0.5), world.camera);
      const gy = ground(coverAt.x, coverAt.z);
      const t = (gy - ray.ray.origin.y) / ray.ray.direction.y;
      const lie = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t > 0 ? t : 2.5);
      lie.y = ground(lie.x, lie.z);
      m.position.copy(lie);
      layFlat(m, yawTo + 0.9);
      // Its bounding box decides how high it sits so it lies on the road, not in it.
      const bb = new THREE.Box3().setFromObject(m);
      m.position.y += lie.y + 0.004 - bb.min.y;
      for (const p of litEdges(m)) c16Props.push(p);
    }
    if (sniper && e.laser) {
      // The beam's samples on screen, for the shot runner's pixel probe (it fails the stage with no red along them).
      world.camera.updateMatrixWorld();
      const u = e.laser.material.uniforms;
      const a = (u.uFrom!.value as THREE.Vector3).clone();
      const b = (u.uTo!.value as THREE.Vector3).clone();
      const pts: { x: number; y: number }[] = [];
      const c = world.renderer.domElement;
      // Evenly spaced on screen (the beam's far metres crowd into a few pixels by the sniper), the near end clipped
      // in front of the lens as the shader clips it.
      const va = a.applyMatrix4(world.camera.matrixWorldInverse);
      const vb = b.applyMatrix4(world.camera.matrixWorldInverse);
      if (va.z > -0.3) va.lerp(vb, (va.z + 0.3) / (va.z - vb.z));
      if (vb.z > -0.3) vb.lerp(va, (vb.z + 0.3) / (vb.z - va.z));
      const na = va.applyMatrix4(world.camera.projectionMatrix);
      const nb = vb.applyMatrix4(world.camera.projectionMatrix);
      for (let i = 0; i <= 24; i++) {
        const n = na.clone().lerp(nb, i / 24);
        if (Math.abs(n.x) > 0.98 || Math.abs(n.y) > 0.98) continue;
        // In page CSS px: the canvas can sit offset or overscanned (the phone's safe-area layout).
        const r = c.getBoundingClientRect();
        pts.push({ x: r.left + ((n.x + 1) / 2) * r.width, y: r.top + ((1 - n.y) / 2) * r.height });
      }
      s.stageInfo = { hit: { x: 0, y: 0 }, r02: 0, head0: { x: 0, y: 0 }, head1: { x: 0, y: 0 }, puffM: 0, splats: [], corpse: { pelvis: { x: 0, y: 0 }, head: { x: 0, y: 0 }, chest: { x: 0, y: 0 } }, laser: pts };
    }
    hud.freeze(tMs);
    return "ok";
  };

  // ---- C16 review: squad-firefight, a whole squad fighting from built cover ----
  // The live fight the milestone is for, held on one frame from where she stands: six Hollowell men spread over the
  // street's cover 5 to 13 m out, each in a different S3.5 beat at once. The near-left one risen over a crate and
  // firing, one blind-firing over the crate ahead, one rolled out round a pillar, one kneeling behind the
  // near-right crate reloading (his spent mag out in the street, "Reloading!" on the radio), the flanker running wide
  // round her left at low ready, and the sergeant down behind the far crate watching over it. Nobody in the open but
  // the flanker. (firefight-<n> stays the perf gate's lineup.)
  /**
   * C17 (S5.3) kill-cam stages: killcam-orbit-<ms> (the last-man orbit round a 10 m headshot kill), killcam-bullet-<ms>
   * (the bullet follow <ms> into its flight at a guard up to 34 m down the street, the round short of his head) and
   * xray-<ms> (<ms> after a headshot's impact, the x-ray on at desktop sizes). The world runs at the cam's own scale.
   */
  const killcamStage = (kind: string, ms: number): string => {
    if (killcam.active) killcam.finish();
    kcEnd();
    const lethal = kind !== "killcam-bullet";
    const r = s.stage!(lethal ? "hit-headkill" : "enemy-front-10m", lethal ? 40 : 60);
    const g = stageGuard;
    if (!g) return r || "no enemy";
    hud.freeze(null);
    hud.clearFeedback();
    hud.clearBarks();
    pickups.clear();
    const home = stageHome?.pos ?? player.pos;
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const step = 1000 / 60;
    const run = (total: number) => {
      for (let t = 0; t < total && killcam.active; t += step) {
        const h = Math.min(step, total - t) / 1000;
        killcam.update(h);
        const sc = killcam.timeScale;
        for (const e of enemies) {
          e.feel(h * sc, world.colliders, ground);
          e.body.updateFlash(h * 1000);
        }
        world.update(0, 1, h * sc);
      }
    };
    if (kind === "killcam-orbit") {
      killcam.caption = "Last man · Headshot";
      killcam.startOrbit(g, eye.clone().setY(home.y + player.eyeHeight));
      kcBegin();
      run(ms);
    } else if (kind === "killcam-bullet") {
      // Down the street as far as it is clear (up to 34 m), facing her.
      const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const clear = rays.cast(eye, flat, 40, { thin: false })?.dist ?? 40;
      const at = eye.clone().addScaledVector(flat, Math.max(12, Math.min(34, clear - 2.5)));
      at.y = ground(at.x, at.z);
      g.motion.pos.copy(at);
      g.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z);
      for (let k = 0; k < 3; k++) g.update(0.0001, sightNone(), rays, world.colliders, ground);
      const head = g.body.joints.head.clone();
      const dir = head.clone().sub(eye).normalize();
      const d = eye.distanceTo(head);
      const round = { pos: eye.clone().addScaledVector(dir, Math.min(d - 1.6, 0.08 * ms)), vel: dir.clone().multiplyScalar(800), alive: true };
      killcam.caption = d > 30 ? "Long shot" : "Last man · Headshot";
      killcam.shotDistance = d;
      killcam.startBullet(round, g, "head");
      kcBegin();
      killcam.update(0.0001);
      killcam.ms = ms;
    } else {
      const head = g.body.joints.head.clone();
      const dir = head.clone().sub(eye).normalize();
      // The range is hers to him at the trigger pull (the round starts at his head only for the stage).
      killcam.caption = "Last man · Headshot";
      killcam.shotDistance = eye.distanceTo(head);
      killcam.startBullet({ pos: head, vel: dir.multiplyScalar(800), alive: false }, g, "head");
      kcBegin();
      run(ms);
    }
    hud.killcamBars(killcam.bars, innerWidth / Math.max(1, innerHeight), killcam.captionLevel);
    if (s.stageInfo) (s.stageInfo as Record<string, unknown>).killcam = killcam.active ? killcam.frameInfo() : null;
    world.setWhip?.(1, 0, killcam.whip);
    arsenal.rig.root.visible = false;
    return "ok";
  };
  /** C17 e2e: a last-man orbit on the nearest live enemy, now (the skip and the return are what is tested). */
  s.killcamTest = () => {
    let e = enemies.filter((x) => x.alive && x.kit.role !== "civilian").sort((a, b) => a.position.distanceTo(player.pos) - b.position.distanceTo(player.pos))[0];
    if (!e) {
      // No one in the street yet (the first job spawns its guards later): a stand-in 8 m ahead of her.
      const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const at = player.pos.clone().addScaledVector(flat, 8);
      at.y = ground(at.x, at.z);
      e = new Enemy({ ...ENFORCER }, [new THREE.Vector3()], 1);
      e.passive = true;
      e.motion.pos.copy(at);
      world.scene.add(e.body.root);
      lineup.push(e);
      e.update(0.0001, sightNone(), rays, world.colliders, ground);
    }
    killcam.startOrbit(e, eye.clone());
    kcBegin();
    return true;
  };
  const squadStage = (tMs: number): string => {
    hud.freeze(null);
    hud.clearFeedback();
    hud.clearBarks();
    showCover(false);
    pickups.clear();
    orbs.clear();
    world.fx.clear?.();
    nades.clear();
    if (stageCrate) stageCrate.visible = false;
    if (crateCollider) crateCollider.off = true;
    for (const p of c16Props) p.removeFromParent();
    c16Props = [];
    staged = true;
    stageQuiet = true;
    s.stageInfo = null;
    s.hp = s.maxHp;
    for (const e of enemies) {
      if (e.alive) e.state = "unaware";
      e.detect = 0;
    }
    if (!stageHome) stageHome = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
    player.pos.copy(stageHome.pos);
    player.yaw = stageHome.yaw;
    player.pitch = stageHome.pitch;
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const side = new THREE.Vector3(-flat.z, 0, flat.x);
    const hide = enemies.filter((e) => e.body.root.visible);
    for (const e of hide) e.body.root.visible = false;
    lineupHidden.push(...hide);
    bodyView.eye.copy(eye);
    const yawTo = Math.atan2(flat.x, flat.z);
    const matOf = (k: string) => world.material?.(k);
    const spot = (d: number, sd: number) => {
      const v = eye.clone().addScaledVector(flat, d).addScaledVector(side, sd);
      v.y = ground(v.x, v.z);
      return v;
    };
    const prop = (o: THREE.Object3D, at: THREE.Vector3, turn = 0) => {
      o.position.copy(at);
      o.rotation.y = yawTo + turn;
      world.scene.add(o);
      c16Props.push(o);
    };
    type Beat = { d: number; s: number; cover: "crate" | "pillar" | null; behind: number; off: number; turn: number; kit?: EnemyKit; set: (e: Enemy, pose: { lean: number; blind: number; reload: number; hands: number; throw: number }) => void; fire?: boolean };
    const beats: Beat[] = [
      // Near left: risen over the crate, shouldered, firing.
      { d: 5.4, s: -2.0, cover: "crate", behind: 0.64, off: 0.2, turn: 0.12, fire: true, set: (e) => { e.motion.crouch = 0.15; e.motion.kick = 0.7; } },
      // Right of centre: head down behind the crate, the carbine over it.
      { d: 7.6, s: 0.05, cover: "crate", behind: 0.64, off: -0.15, turn: -0.08, fire: true, set: (e, p) => { e.motion.crouch = 1.6; p.blind = 1; e.motion.kick = 0.7; } },
      // Up the street, left of centre: rolled out round the pillar's right edge, hips behind it.
      { d: 11, s: -1.0, cover: "pillar", behind: 0.75, off: 0.22, turn: 0, set: (_e, p) => { p.lean = 1; } },
      // Near right: kneeling behind the crate, reloading.
      { d: 4.6, s: 3.0, cover: "crate", behind: 0.64, off: 0.1, turn: -0.2, set: (e) => { e.motion.crouch = 1.6; e.motion.aim = 0.3; e.motion.pitch = -0.25; } },
      // The flanker: out wide on her left, running at low ready.
      { d: 6.6, s: -4.6, cover: null, behind: 0, off: 0, turn: 0, set: (e) => { e.motion.aim = 0.15; e.motion.crouch = 0.25; } },
      // The sergeant, down behind the far crate, watching over it.
      { d: 12.6, s: 2.2, cover: "crate", behind: 0.64, off: 0, turn: 0.1, kit: { ...ENFORCER, name: "Enforcer Sergeant", leader: true }, set: (e) => { e.motion.crouch = 0.75; e.motion.aim = 0.6; } },
    ];

    const eyeAt = eye.clone();
    let reloader: Enemy | null = null;
    for (const [i, b] of beats.entries()) {
      const coverAt = spot(b.d, b.s);
      if (b.cover) prop(b.cover === "pillar" ? concretePillar(0.9, 2.4, matOf) : cargoCrate(1.5, 1.15, 0.8, matOf), coverAt, b.turn + Math.PI);
      const at = spot(b.d + b.behind, b.s + b.off);
      const e = new Enemy({ ...(b.kit ?? ENFORCER) }, [new THREE.Vector3()], 1);
      e.passive = true;
      e.stagePose = true;
      e.motion.pos.copy(at);
      e.motion.yaw = Math.atan2(eyeAt.x - at.x, eyeAt.z - at.z);
      e.motion.aim = 1;
      e.motion.pitch = Math.atan2(eyeAt.y - (at.y + 1.5), Math.hypot(eyeAt.x - at.x, eyeAt.z - at.z));
      const pose = { lean: 0, blind: 0, reload: -1, hands: 0, throw: -1 };
      b.set(e, pose);
      e.motion.tac = pose;
      world.scene.add(e.body.root);
      lineup.push(e);
      for (let k = 0; k < 4; k++) e.update(0.0001, sightNone(), rays, world.colliders, ground);
      if (i === 3) {
        reloader = e;
        // Facing his cover, the hand gone to the pouch 1 s in, the empty mag already in the street.
        pose.reload = RELOAD_KEYS.out;
        e.update(0.0001, sightNone(), rays, world.colliders, ground);
        e.dropMag();
        pose.reload = 1000;
        e.update(0.0001, sightNone(), rays, world.colliders, ground);
      }
      if (i === 4) {
        // Running wide round her left: facing along his run, mid-stride.
        const run = flat.clone().multiplyScalar(-0.35).addScaledVector(side, -1).normalize();
        e.motion.yaw = Math.atan2(run.x, run.z);
        e.stageStride(4.6, 1.1);
      }
      e.body.pose();
      if (b.fire) {
        const mf = new THREE.Vector3();
        const md = new THREE.Vector3();
        e.muzzle(mf, md);
        for (const p of stageFlash(mf, md)) {
          world.scene.add(p);
          c16Props.push(p);
        }
      }
    }
    if (reloader && reloader.magDrops.length) {
      // His spent mag skidded out past the crate's end toward her.
      const m = reloader.magDrops[reloader.magDrops.length - 1]!.obj;
      world.scene.attach(m);
      const lie = spot(beats[3]!.d - 0.7, beats[3]!.s - 1.0);
      m.position.copy(lie);
      layFlat(m, yawTo - 0.6);
      const bb = new THREE.Box3().setFromObject(m);
      m.position.y += lie.y + 0.004 - bb.min.y;
      for (const p of litEdges(m)) c16Props.push(p);
    }
    // The street's sodium heads over the fight (the turntable's key and a cold rim, as the single-guard stages):
    // a warm key over each pair of men and a cold rim from up the street, so every silhouette cuts off the cover.
    for (const [d, sd, tgt] of [[6.0, -1.6, -2.6], [8.2, 1.4, 0.6], [11.4, 0.4, -0.8]] as const) {
      const at = spot(d, tgt);
      const key = new THREE.SpotLight(0xffb070, 22, 11, 0.42, 0.75, 1.6);
      key.position.copy(spot(d - 1.2, sd)).setY(at.y + 5);
      key.target.position.copy(at).setY(at.y + 0.9);
      world.scene.add(key, key.target);
      c16Props.push(key, key.target);
    }
    const rim = new THREE.SpotLight(0x58d8ff, 40, 22, 0.5, 0.6, 1.4);
    rim.position.copy(spot(16, 1.5)).setY(eye.y + 3.5);
    rim.target.position.copy(spot(7, 0)).setY(eye.y - 0.4);
    world.scene.add(rim, rim.target);
    c16Props.push(rim, rim.target);
    if (arsenal.weapon.id !== "kestrel") {
      arsenal.owned.add("kestrel");
      arsenal.equipId("kestrel");
    }
    arsenal.settle();
    hud.bark("Enforcer", BARK_LINES.suppressed[0]!, true);
    hud.bark("Enforcer", BARK_LINES.reload[0]!, true);
    lookFrom(stageHome.pos, eye.clone().addScaledVector(flat, 9).addScaledVector(side, 0.2).setY(ground(eye.x, eye.z) + 0.85));
    hud.freeze(tMs);
    return "ok";
  };

  const lineupHidden: Enemy[] = [];
  const endReview = () => {
    clearReview();
    for (const p of c16Props) p.removeFromParent();
    c16Props = [];
    for (const e of lineupHidden) e.body.root.visible = true;
    lineupHidden.length = 0;
  };
  s.zoom = (on: boolean) => {
    zoomOn = on && !!zoomAt;
    return zoomOn;
  };
  s.probeEnemy = () => {
    const g = probeGuard;
    if (!g) return null;
    render();
    const r = world.renderer;
    const c = r.domElement;
    const w = c.width;
    const h = c.height;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g2 = cv.getContext("2d", { willReadFrequently: true })!;
    g2.drawImage(c, 0, 0, w, h);
    const frame = g2.getImageData(0, 0, w, h).data;
    // His mask: everything else hidden, his meshes flat white, no fog, into a target the canvas's size.
    const rt = new THREE.WebGLRenderTarget(w, h);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const keep = new Set<THREE.Object3D>();
    g.body.root.traverse((o) => keep.add(o));
    const off: THREE.Object3D[] = [];
    world.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) && o.visible && !keep.has(o)) {
        o.visible = false;
        off.push(o);
      }
    });
    const sc = world.scene;
    const bg = sc.background;
    const fog = sc.fog;
    sc.background = null;
    sc.fog = null;
    sc.overrideMaterial = white;
    const prevT = r.getRenderTarget();
    const prevC = r.getClearColor(new THREE.Color());
    const prevA = r.getClearAlpha();
    r.setRenderTarget(rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(sc, world.camera);
    const px = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(rt, 0, 0, w, h, px);
    r.setRenderTarget(prevT);
    r.setClearColor(prevC, prevA);
    sc.overrideMaterial = null;
    sc.background = bg;
    sc.fog = fog;
    for (const o of off) o.visible = true;
    white.dispose();
    rt.dispose();
    const lum = (o: number) => (0.2126 * frame[o]! + 0.7152 * frame[o + 1]! + 0.0722 * frame[o + 2]!) / 255;
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    let n = 0;
    let sum = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3]! < 128) continue;
        const fy = h - 1 - y;
        n++;
        sum += lum((fy * w + x) * 4);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, fy);
        y1 = Math.max(y1, fy);
      }
    if (!n) return { enemy: 0, street: 0, ratio: 0, px: 0, heightPx: 0, box: { x: 0, y: 0, w: 0, h: 0 } };
    // The street around him: a box one figure-width out each side and a fifth of his height above and below,
    // his own pixels left out.
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    let sn = 0;
    let ss = 0;
    for (let y = Math.max(0, y0 - Math.round(bh * 0.2)); y <= Math.min(h - 1, y1 + Math.round(bh * 0.2)); y++)
      for (let x = Math.max(0, x0 - bw); x <= Math.min(w - 1, x1 + bw); x++) {
        if (px[((h - 1 - y) * w + x) * 4 + 3]! >= 128) continue;
        sn++;
        ss += lum((y * w + x) * 4);
      }
    const enemy = sum / n;
    const street = ss / Math.max(1, sn);
    const k = w / c.clientWidth;
    return { enemy, street, ratio: enemy / Math.max(1e-4, street), px: n, heightPx: bh / k, box: { x: x0 / k, y: y0 / k, w: bw / k, h: bh / k } };
  };
  s.silhouetteThumb = () => {
    if (!lineup.length) return null;
    render();
    const c = world.renderer.domElement;
    const w = c.width;
    const h = c.height;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g2 = cv.getContext("2d", { willReadFrequently: true })!;
    g2.drawImage(c, 0, 0);
    const px = g2.getImageData(0, 0, w, h).data;
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (px[(y * w + x) * 4]! < 64) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) return null;
    const k = 64 / (y1 - y0 + 1);
    const pad = 8;
    const out = document.createElement("canvas");
    out.width = Math.round((x1 - x0 + 1) * k) + pad * 2;
    out.height = 64 + pad * 2;
    const o2 = out.getContext("2d")!;
    o2.fillStyle = "#808080";
    o2.fillRect(0, 0, out.width, out.height);
    o2.imageSmoothingQuality = "high";
    o2.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, out.width - pad * 2, 64);
    return out.toDataURL("image/png");
  };
  /**
   * C11 "Takedowns": a takedown frozen `ms` into its sequence. `takedown-<ms>` is Behind A on the guard under the
   * lamp (with &job; otherwise the nearest rifleman, stood in the street); `takedown-front-<ms>` is Front A (the
   * collar grab, the Kestrel in hand); `takedown-<variantId>-<ms>` any other, for review.
   */
  const c11Stage = (name: string): string => {
    // A trailing "-x" frames the pair from the side, 2.4 m off (a review view of the choreography, not a game shot).
    const xView = name.endsWith("-x");
    if (xView) name = name.slice(0, -2);
    // `takedown-tell`: the moment before, the guard eligible and the world chip over his helmet (no press).
    const tell = name === "takedown-tell";
    if (tell) name = "takedown-0";
    // The owner's audit frame 16 re-shot: the guard where she laid him, 1.2 s after the sequence.
    if (name === "takedown-body") name = "takedown-2400";
    const m = /^takedown-(?:([A-Za-z]+)-)?(\d+)$/.exec(name);
    if (!m) return `unknown stage ${name}`;
    const ms = Number(m[2]);
    const id = (m[1] === "front" ? "frontCollar" : m[1] ?? "behindWrap") as TakedownVariantId;
    const v = TAKEDOWN_VARIANTS.find((x) => x.id === id);
    if (!v) return `unknown takedown ${id}`;
    if (td.active) td.finish();
    tdLightsOff();
    timescale.release("takedown");
    hud.cinema(0);
    world.viewScene.visible = true;
    hud.freeze(null);
    hud.clearFeedback();
    showCover(false);
    pickups.clear();
    orbs.clear();
    world.fx.clear?.();
    arsenal.restock();
    const pistolNeeded = v.weapon === "pistol";
    if (pistolNeeded && arsenal.weapon.id !== "kestrel") {
      arsenal.owned.add("kestrel");
      arsenal.equipId("kestrel");
    }
    arsenal.settle();
    let g: Enemy | null = null;
    if (job) {
      job.skipTo(1);
      g = enemies.filter((e) => e.alive).sort((a, b) => a.position.distanceTo(player.pos) - b.position.distanceTo(player.pos))[0] ?? null;
      // The stage before's bodies leave the shot.
      for (const e of enemies) if (!e.alive) e.body.root.visible = e.rifle.visible = false;
    } else {
      if (stageGuard && !enemies.includes(stageGuard)) stageGuard = null;
      g = stageGuard ?? enemies.filter((e) => (e.kit.role ?? "rifle") === "rifle" && e.body.lost.size === 0).sort((a, b) => a.position.distanceTo(player.pos) - b.position.distanceTo(player.pos))[0] ?? null;
      if (g) {
        stageGuard = g;
        if (!stageHome) stageHome = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
        const f = new THREE.Vector3(-Math.sin(stageHome.yaw), 0, -Math.cos(stageHome.yaw));
        g.revive();
        g.body.root.visible = true;
        g.motion.pos.copy(stageHome.pos).addScaledVector(f, 4);
        g.motion.pos.y = ground(g.motion.pos.x, g.motion.pos.z);
        g.motion.yaw = Math.atan2(f.x, f.z);
      }
    }
    if (!g) return "no enemy";
    for (const e of enemies) {
      if (e.alive) e.state = "unaware";
      e.detect = 0;
    }
    g.revive();
    g.rifle.visible = true;
    g.passive = true;
    if (v.approach === "front") g.hp = g.kit.maxHp * 0.15;
    // Cath 1.3 m off him along the approach, looking at him; the guard settles into his stance.
    const yaw = g.motion.yaw;
    const gf = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const gl = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const off = v.approach === "behind" ? gf.clone().negate() : v.approach === "front" ? gf.clone() : gl.clone();
    player.pos.copy(g.motion.pos).addScaledVector(off, 1.3);
    player.pos.y = ground(player.pos.x, player.pos.z);
    player.yaw = Math.atan2(off.x, off.z);
    player.pitch = -0.18;
    player.vel.set(0, 0, 0);
    player.applyCamera(world.camera, 0);
    world.camera.updateMatrixWorld();
    for (let t = 0; t < 0.5; t += 1 / 60) {
      g.feel(1 / 60, world.colliders, ground);
      world.update(0, 1, 1 / 60);
    }
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    staged = true;
    if (tell) {
      s.stageInfo = {
        hit: { x: 0, y: 0 }, r02: 0, head0: { x: 0, y: 0 }, head1: toScreen(g.body.joints.head), puffM: 0, splats: [],
        corpse: { pelvis: toScreen(g.body.joints.pelvis), head: toScreen(g.body.joints.head), chest: toScreen(g.body.joints.chest) },
        variant: "tell",
        tell: { head: toScreen(g.body.joints.head), helmetTop: toScreen(g.body.joints.head.clone().add(new THREE.Vector3(0, 0.17, 0))), chip: tdChipAt(g) },
      };
      hud.freeze(0);
      return "ok";
    }
    const approach: TakedownApproach = v.approach;
    const toHer = new THREE.Vector3().subVectors(player.pos, g.position).setY(0).normalize();
    td.rig.keepDebug = true;
    startTakedown({ e: g, approach, side: toHer.dot(gl) >= 0 ? 1 : -1 }, v.id);
    // The sequence to its moment, at 60 Hz: her arms, his body, the blows' blood (the particles step too).
    const step = 1000 / 60;
    // (`ms` is the sequence's own clock: a blow's hit-stop holds it, so 800 is 800 ms of the choreography.)
    for (let i = 0; i < 600 && td.active && td.t < ms; i++) {
      const bodyMs = td.update(Math.min(step, Math.max(1, ms - td.t)));
      takedownEvents(g, step / 1000);
      g.feel(bodyMs / 1000, world.colliders, ground);
      g.body.updateFlash(bodyMs);
      combat.update(0, build());
      drainEvents();
      world.update(0, 1, step / 1000);
    }
    // Past the end (the re-shot audit frame 16, `takedown-body`, is 2400): the body settles where she laid him, and
    // she looks down at him, as a player does after the camera comes home.
    if (!td.active && ms > v.durMs) {
      for (let t = v.durMs; t < ms; t += step) {
        g.feel(step / 1000, world.colliders, ground);
        world.update(0, 1, step / 1000);
      }
      // A step back off him first: from where she stood over him the lens looked straight down onto his back.
      const mid = g.body.joints.pelvis.clone().lerp(g.body.joints.chest, 0.5);
      const back = player.pos.clone().sub(mid).setY(0);
      if (back.lengthSq() > 1e-6) player.pos.copy(mid).addScaledVector(back.normalize(), 1.9).setY(0);
      player.pos.y = ground(player.pos.x, player.pos.z);
      player.applyCamera(world.camera, 0);
      world.camera.getWorldPosition(eye);
      const to = mid.sub(eye);
      player.yaw = Math.atan2(-to.x, -to.z);
      player.pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
      player.applyCamera(world.camera, 0);
    }
    // The world's own hit-stop and slow motion are the live game's; the frozen frame shows the pose. A stage on a
    // blow's own ms shows its hit-stop as played: the blood hangs, having drifted at fxScale 0.25 (about 30 ms of
    // particle time over the stop), not still balled up inside the muzzle flash.
    if (blowsInOrder(v).includes(ms)) for (let i = 0; i < 2; i++) world.update(0, 1, 0.016);
    takedownCamera(0);
    tdSideView = xView ? g : null;
    if (xView) sideView();
    world.camera.updateMatrixWorld();
    const J = g.body.joints;
    const onScreen = (p: THREE.Vector3) => {
      const q = p.clone().project(world.camera);
      return q.z < 1 && Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1;
    };
    const handR = td.rig.wrist.clone();
    const handL = td.rig.wristL.clone();
    // The helmet's share of the frame (C11 review: a lens inside the helmet showed one ring over 70% of it): a
    // 0.17 m sphere at his head, projected.
    const camR = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 0);
    const camU = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 1);
    const hc = J.head.clone().project(world.camera);
    const hx = J.head.clone().addScaledVector(camR, 0.17).project(world.camera);
    const hy = J.head.clone().addScaledVector(camU, 0.17).project(world.camera);
    const helmetShare = hc.z < 1 ? Math.min(1, (Math.PI * Math.abs(hx.x - hc.x) * Math.abs(hy.y - hc.y)) / 4) : 0;
    const prop = td.rig.props.pistol.rig.root.visible ? "pistol" : td.rig.props.pin.rig.root.visible ? "pin" : "fist";
    const muzzleW = prop === "fist" ? null : td.rig.muzzle.clone();
    const z0 = { x: 0, y: 0 };
    s.stageInfo = {
      hit: z0, r02: 0, head0: z0, head1: toScreen(J.head), puffM: 0, splats: [], corpse: { pelvis: toScreen(J.pelvis), head: toScreen(J.head), chest: toScreen(J.chest) },
      variant: v.id,
      asleep: g.body.asleep,
      heights: jointHeights(g),
      takedown: {
        t: td.active ? td.t : v.durMs,
        active: td.active,
        headIn: onScreen(J.head),
        armIn: onScreen(handR) || (td.rig.hasL && onScreen(handL)),
        handR: toScreen(handR),
        handL: toScreen(handL),
        bars: td.active ? td.bars() : 0,
        helmetShare,
        prop,
        propIn: !!muzzleW && onScreen(muzzleW) && onScreen(handR),
        muzzle: muzzleW ? toScreen(muzzleW) : null,
        debug: { ...td.rig.debug, neck: J.neck.toArray(), head: J.head.toArray(), feet: player.pos.toArray(), cam: world.camera.position.toArray() },
      },
    };
    hud.freeze(ms);
    return "ok";
  };

  s.stage = (name: string, tMs = 60): string => {
    // C17: every stage starts out of Second Wind and out of any kill-cam (stages share one page).
    if (secondWind.active || secondWind.phase === "revived" || swShown) {
      secondWind.reset();
      timescale.release("secondWind");
      secondWindFrame(0);
      vitals.reset(s.maxHp);
      s.hp = vitals.total;
    }
    if (killcam.active) killcam.finish();
    if (kcWas) kcEnd();
    stageQuiet = false;
    tdSideView = null;
    tdAfter.length = 0;
    endReview();
    restarting = false;
    if (name.startsWith("takedown-")) {
      calmVitals();
      return c11Stage(name);
    }
    // C13T: the pause menu over the street, and the level-up held at its settled beat. A sheet staged before
    // closes, so the next stage is not shot under it.
    if (charScreen && !name.startsWith("sheet")) charScreen.close();
    menuOpen = false;
    (o.hud.parentElement ?? o.hud).querySelector(".lvl-toast")?.remove();
    if (name === "pause") {
      calmVitals();
      menuOpen = true;
      return "ok";
    }
    // C14 (S9.6): the district's establishing frame for the loading screen's key art (scripts/cathode-keyart.mjs
    // renders it once per district into public/keyart/): her start, a little above her eye, no gun, no HUD.
    if (name === "keyart") {
      calmVitals();
      keyArt = true;
      o.hud.hidden = true;
      o.touch.hidden = true;
      player.pos.y += 0.45;
      player.pitch = -0.07;
      // scripts/cathode-keyart.mjs can move the lens off her start for a district whose start frame reads as a
      // blockout (C14 review: the clinic): &kx=&kz= metres, &kyaw=&kpitch= degrees, &ky= metres up.
      {
        const kq = new URLSearchParams(location.search);
        const num = (k: string) => (kq.has(k) ? Number(kq.get(k)) || 0 : null);
        const kx = num("kx");
        const kz = num("kz");
        const ky = num("ky");
        const kyaw = num("kyaw");
        const kpitch = num("kpitch");
        if (kx !== null) player.pos.x += kx;
        if (kz !== null) player.pos.z += kz;
        if (ky !== null) player.pos.y += ky;
        if (kyaw !== null) player.yaw += THREE.MathUtils.degToRad(kyaw);
        if (kpitch !== null) player.pitch = THREE.MathUtils.degToRad(kpitch);
      }
      return "ok";
    }
    // C13T: the character sheet (dossier) on its skills tab.
    if (name === "sheet" || name === "sheet-attributes" || name === "sheet-inventory") {
      calmVitals();
      const tab = name === "sheet" ? undefined : (name.slice(6) as "attributes" | "inventory");
      charScreen?.close();
      charScreen = null;
      openSheet(tab);
      return "ok";
    }
    if (name === "levelup") {
      calmVitals();
      // The staged moment agrees with itself (C13T review): the HUD's vitals read the level the stage announces.
      const lv = progress.character.level + 1;
      s.level = lv;
      void levelUpToast(o.hud.parentElement ?? o.hud, lv, { attributes: 5, skills: 1 }, true);
      return "ok";
    }
    c15 = C15_STAGES[name.replace(/-\d+$/, "")] ?? C15_STAGES[name] ?? null;
    if (c15) {
      const m = /-(\d+)$/.exec(name);
      if (m && tMs === 40) tMs = Number(m[1]);
      else if (tMs === 40) tMs = c15.ms;
      name = c15.base;
    }
    c9 = C9_STAGES[name.replace(/-\d+s?$/, "")] ?? null;
    if (c9) {
      const m = /-(\d+)(s?)$/.exec(name);
      if (m && tMs === 40) tMs = Number(m[1]) * (m[2] ? 1000 : 1);
      else if (tMs === 40) tMs = c9.ms;
      name = c9.base;
    }
    if (C8_STAGES.includes(name)) return c8Stage(name, tMs);
    if (C6_STAGES.includes(name) || C7_STAGES.includes(name)) return c6Stage(name, tMs);
    calmVitals();
    const kcm = /^(killcam-orbit|killcam-bullet|xray)-(\d+)$/.exec(name);
    if (kcm) return killcamStage(kcm[1]!, Number(kcm[2]));
    if (name === "squad-firefight") return squadStage(tMs);
    // C17 (S6.5): player-secondwind, `tMs` into a Second Wind (default 1200), over the squad firefight: red outlines
    // on a grey world, the men behind the crates seen through them, the flashes in colour.
    if (name === "player-secondwind") {
      const r = squadStage(0);
      secondWind.stageAt(tMs > 60 ? tMs : 1200);
      vitals.setTotal(1);
      s.hp = vitals.total;
      if (!timescale.active("secondWind")) timescale.push("secondWind", SECOND_WIND.scale, -1, 0, SECOND_WIND.rampOutMs, "secondWind");
      secondWindFrame(0);
      return r;
    }
    if (C10_STAGES.includes(name) || /^firefight-\d+$/.test(name)) return c10Stage(name, tMs);
    if (C16_STAGES.includes(name.replace(/-\d+$/, ""))) return c16Stage(name, tMs);
    if (C3_STAGES.includes(name)) return c3Stage(name, tMs);
    if (C4_STAGES.includes(name)) return c4Stage(name, tMs);
    if (C18_RE.test(name) || name === "arsenal-lineup") return c18Stage(name, tMs);
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
    orbs.clear();
    if (td.active) {
      td.finish();
      timescale.release("takedown");
      hud.cinema(0);
      world.viewScene.visible = true;
    }
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
    // C15's shield stage takes the nearest riot-shield bearer instead (and leaves the stage guard as he is).
    const shieldMan = c15?.shield ? enemies.filter((e) => e.kit.role === "shield" && e.body.lost.size === 0).sort((a, b) => a.position.distanceTo(eye) - b.position.distanceTo(eye))[0] : undefined;
    if (c15?.shield && !shieldMan) return "no shield bearer";
    const g = shieldMan ?? stageGuard ?? rifle[0] ?? enemies.find((e) => e.alive && !e.shield && e.kit.role !== "civilian" && e.kit.role !== "nurse" && e.kit.role !== "turret");
    if (!g) return "no enemy";
    if (!shieldMan) stageGuard = g;
    // The stage guard steps out of the shield bearer's way (they would stand in the same spot).
    else if (stageGuard && stageGuard !== g) {
      stageGuard.motion.pos.x += 40;
      stageGuard.body.root.visible = false;
      // (His joints too, or rounds still meet him where he stood.)
      stageGuard.feel(1e-4, world.colliders, ground);
    }
    if (!shieldMan && stageGuard) stageGuard.body.root.visible = true;
    g.revive();
    // A guard 10 m down the crosshair, facing her, unaware.
    // A phone screen is small: the cover stages bring the crate and the guard in so his head over it reads.
    const near = o.quality === "phone" && (name === "blocked" || name === "peek-head") ? 0.6 : 1;
    // hit-arm stands him at 4 m: the struck hand opening is a few centimetres of glove and must show in the frame.
    let at = eye.clone().addScaledVector(flat, (c9?.dist ?? c15?.dist ?? (name === "hit-arm" ? 4 : 10)) * near);
    if (c9?.wall) {
      // A wall 1 m behind him: find a solid face 5 to 9 m off around the view and stand him 0.9 m in front of it.
      const yaw0 = Math.atan2(flat.x, flat.z);
      let best = Infinity;
      for (let k = 0; k < 60; k++) {
        const a = yaw0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.1;
        const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const from = eye.clone().setY(ground(eye.x, eye.z) + 1.2);
        const h = rays.cast(from, d, 10, { thin: false });
        // Prefer a lit wall: a slump in the dark reads as nothing.
        const score = h ? Math.abs(h.dist - 6.2) - Math.min(1, world.lightAt(h.point.clone().addScaledVector(h.normal, 0.4).setY(ground(h.point.x, h.point.z) + 0.8))) * 4 : Infinity;
        // The middle of one building's face: rays 0.6 m either side hit the same wall within 15 cm, so he isn't set
        // at a building's edge, where the downpipe runs and cuts through his head (C9 review).
        const sideV = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(0.6);
        const flatWall =
          !!h &&
          [1, -1].every((sg) => {
            const h2 = rays.cast(from.clone().addScaledVector(sideV, sg), d, 10, { thin: false });
            return !!h2 && h2.box === h.box && Math.abs(h2.dist - h.dist) < 0.15;
          });
        if (h && flatWall && h.dist > 4.8 && Math.abs(h.normal.y) < 0.3 && score < best) {
          best = score;
          at = from.clone().addScaledVector(d, h.dist - 0.9);
          flat.copy(d);
        }
      }
    } else if (name === "wall-splat") {
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
    g.motion.yaw = Math.atan2(eye.x - at.x, eye.z - at.z) + (c15?.turn ?? 0);
    clearDebris();
    clearShards();
    // A calm street: nobody hunting her, no hurt arcs, full health, so the frame shows only this hit.
    for (const e of enemies) {
      if (e.alive && e.state !== "dead") e.state = "unaware";
      e.detect = 0;
    }
    s.hp = s.maxHp;
    g.hp = g.kit.maxHp;
    // A stage starts from a body at rest: a previous stage's flinch still ringing would add to (or cancel) this one.
    g.flinch.reset();
    // Nor does an earlier stage's stagger: its crit window would make this stage's round a crit, its cooldowns block it.
    Object.assign(g.stag, makeStagger());
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
    // C10: hit-arm takes the round on the support forearm, nearer the elbow (the hand that opens stays clear of the marker).
    const joint = name === "hit-arm" ? g.body.joints.elbowL.clone().lerp(g.body.joints.handL, 0.3) : name === "hit-head" || name === "hit-headkill" || name === "peek-head" || name === "enemy-flinch-head-60" ? g.body.joints.head : g.body.joints.chest;
    const aim = c15?.aimAt ? c15.aimAt(g) : c15?.aimUp ? g.body.joints.chest.clone().lerp(g.body.joints.neck, 0.55) : joint.clone();
    // Blocked: the round goes into the crate's upper face, square on, with the guard's head showing behind it.
    if (name === "blocked" && stageCrate) aim.copy(stageCrate.position).y += 0.35;
    if (name === "hit-kill" || name === "hit-headkill") g.hp = 1;
    // The C1/C2 flesh stages are about blood on flesh: they shoot the guard as if unplated (C15 has its own stages).
    g.armourOff = !c15;
    if (c15 && g.armour) {
      const wc = SLICE_WEAPONS.find((x) => x.id === (c15!.weapon ?? "kestrel"))!;
      // The stage's "raw" is what this round takes off a plate (its class's wear), so the pre-set lands on the state.
      c15.pre(g, plateWear(wc.weaponClass, wc.damage * build().damage(wc.weaponClass)));
    }
    const wid = c15?.weapon ?? "kestrel";
    const w = SLICE_WEAPONS.find((x) => x.id === wid)!;
    // The shot is a Kestrel round (or the stage's own gun), so she holds it.
    if (arsenal.weapon.id !== wid) {
      arsenal.owned.add(wid);
      arsenal.equipId(wid);
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
    combat.forceVariant = c9?.variant ?? null;
    combat.forceHelmet = c9 ? (c9.helmet ?? false) : null;
    lastHitPoint = null;
    lastHitSeg = null;
    zoomAt = null;
    zoomOn = false;
    // No random crit: a stage shows the same class every time.
    for (let i = 0; i < (c15?.rounds ?? 1); i++) combat.fire({ weapon: w, origin, muzzle: origin.clone(), dirs: [dir] } as unknown as Parameters<Combat["fire"]>[0], { ...build(), crit: 0 });
    combat.quiet = false;
    combat.forceVariant = null;
    combat.forceHelmet = null;
    combat.forceDisarm = null;
    drainEvents();
    // A death stage shows the death: no loot beam standing through the body.
    if (c9) pickups.clear();
    const hitAt = (lastHitPoint as THREE.Vector3 | null)?.clone() ?? aim.clone();
    const head0 = toScreen(g.body.joints.head);
    // The world moves on to the stage's moment: the body flinches or falls, blood flies and lands (S0, C2).
    const stepS = 1 / 60;
    // A pool stage runs the body until it sleeps and the pool starts, then ages the pool to the stage's moment.
    const simMs = c9?.pool ? 3200 : tMs;
    for (let t = 0; t + 1e-6 < simMs / 1000; t += stepS) {
      const h = Math.min(stepS, simMs / 1000 - t);
      if (c15?.tick) c15.tick(g, h);
      for (const e of enemies) e.feel(h, world.colliders, ground);
      if (c9) drainDeaths();
      world.update(0, 1, h);
    }
    Enemy.forceCrawl = null;
    const gp = world.fx.gore?.pools;
    if (c9?.pool && gp) {
      const p0 = gp.pools.find(() => true);
      if (p0) gp.age(Math.max(0, tMs / 1000 - p0.age));
      world.update(0, 1, 0);
    }
    let poolInfo: { x: number; y: number; rx: number; ry: number; age: number } | null = null;
    if (c9) {
      // Framed on him where he lies (or on the pool), from a little closer, looking down at the street.
      const pl = gp?.pools[gp.pools.length - 1];
      const focus = c9.pool && pl ? pl.at.clone() : g.body.joints.chest.clone().lerp(g.body.joints.pelvis, 0.5).lerp(g.body.joints.head, c9.variant === "wallslump" ? 0.3 : 0);
      const back = new THREE.Vector3(eye.x - focus.x, 0, eye.z - focus.z);
      // A phone's screen is small: it frames the body closer, so he isn't a 60 px figure behind her gun.
      const want = (c9.pool ? 3.2 : 3.3) * (o.quality === "phone" ? 0.72 : 1);
      // A body at rest is shot from beside it (a three-quarter view from the side she stands on): lying along the
      // line of fire, it is foreshortened into a lump whatever its pose (C9 review).
      const axis = new THREE.Vector3().subVectors(g.body.joints.head, g.body.joints.pelvis).setY(0);
      let otherSide: THREE.Vector3 | null = null;
      const lying = (c9.pool || tMs >= 1500) && c9.variant !== "wallslump" && axis.lengthSq() > 0.09;
      if (lying) {
        axis.normalize();
        // From the side that puts his head on the left of the frame, clear of her gun (the curl: from his front,
        // so the hands on the wound show).
        const side = new THREE.Vector3(-axis.z, 0, axis.x);
        if (c9.variant === "gutclutch") {
          const J = g.body.joints;
          const front = new THREE.Vector3().subVectors(J.hipL, J.hipR).cross(new THREE.Vector3().subVectors(J.neck, J.pelvis)).setY(0);
          if (side.dot(front) < 0) side.negate();
        } else {
          // Looking along -d from d's side: his head is on the left when axis . (d x up) > 0.
          const d0 = side.clone().multiplyScalar(0.95).addScaledVector(axis, -0.3);
          if (axis.dot(new THREE.Vector3(-d0.z, 0, d0.x)) < 0) side.negate();
        }
        // Three-quarters on from the side, a little toward his feet; the other side if a wall is in the way.
        for (const sg of [1, -1]) {
          const d = side.clone().multiplyScalar(sg).multiplyScalar(0.95).addScaledVector(axis, -0.3).normalize();
          const from = focus.clone().setY(ground(focus.x, focus.z) + 1.2);
          const hit = rays.cast(from, d, want + 0.6, { thin: false });
          if (!hit || sg === -1) {
            player.pos.set(focus.x + d.x * (want - 0.3), 0, focus.z + d.z * (want - 0.3));
            player.pos.y = ground(player.pos.x, player.pos.z);
            break;
          }
        }
      } else if (!c9.pool && (c9.variant === "gutclutch" || c9.variant === "knees" || c9.variant === "blownback" || c9.variant === "headshot" || c9.variant === "spin")) {
        // The fall itself is shot three-quarters on from the side: head on, the clutch, the knee going down and
        // the flight backward all collapse into the same upright figure (C9 review).
        const facing = new THREE.Vector3(Math.sin(g.motion.yaw), 0, Math.cos(g.motion.yaw));
        const side = new THREE.Vector3(-facing.z, 0, facing.x);
        if (side.dot(back) < 0) side.negate();
        const d = facing.clone().multiplyScalar(0.5).addScaledVector(side, 0.87).normalize();
        const from = focus.clone().setY(ground(focus.x, focus.z) + 1.2);
        if (rays.cast(from, d, want + 0.6, { thin: false })) d.addScaledVector(side, -1.74).normalize();
        const dist = want + 0.4;
        player.pos.set(focus.x + d.x * dist, 0, focus.z + d.z * dist);
        player.pos.y = ground(player.pos.x, player.pos.z);
        // The other side, for the foreground check below.
        const d2 = facing.clone().multiplyScalar(0.5).addScaledVector(side, d.dot(side) > 0 ? -0.87 : 0.87).normalize();
        if (!rays.cast(from, d2, want + 0.6, { thin: false })) otherSide = focus.clone().addScaledVector(d2, dist).setY(0);
      } else if (c9.variant === "wallslump") {
        // The sit is shot three-quarters on, 40 degrees off the wall's normal: head on, the legs run straight at
        // the lens and he reads as a man standing against the shutter (C9 review). The side with room wins.
        const n = back.clone().normalize();
        const from = focus.clone().setY(ground(focus.x, focus.z) + 1.2);
        for (const sg of [1, -1]) {
          const d = n.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), sg * 0.7);
          if (!rays.cast(from, d, want + 0.6, { thin: false }) || sg === -1) {
            player.pos.set(focus.x + d.x * want, 0, focus.z + d.z * want);
            player.pos.y = ground(player.pos.x, player.pos.z);
            break;
          }
        }
      } else if (back.length() > want) {
        back.setLength(back.length() - want);
        player.pos.sub(back);
        player.pos.y = ground(player.pos.x, player.pos.z);
      }
      const pool = !!c9.pool;
      const headKill = c9.variant === "headshot";
      const frameOn = () => {
        player.applyCamera(world.camera, 0);
        world.camera.updateMatrixWorld();
        world.camera.getWorldPosition(eye);
        const look2 = focus.clone().add(new THREE.Vector3(0, pool ? 0 : 0.1, 0)).sub(eye).normalize();
        player.pitch = Math.asin(THREE.MathUtils.clamp(look2.y, -1, 1)) + (pool ? 0.04 : 0);
        // A touch off centre to the left, clear of the gun in her right hand.
        // The pool stage puts him further left, so the crosshair sits on the open pool and not on the body.
        // The head kill's ring is the biggest marker: he falls left of it, not under it (C9 review).
        player.yaw = Math.atan2(-look2.x, -look2.z) - (pool ? 0.24 : lying ? 0.28 : headKill ? 0.24 : 0.13);
        player.applyCamera(world.camera, 0);
        world.camera.updateMatrixWorld();
        poolInfo = null;
        if (pl) {
          const c = toScreen(pl.at);
          const camX = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 0);
          const rx = Math.abs(toScreen(pl.at.clone().addScaledVector(camX, pl.r * 0.7)).x - c.x);
          const fwdFlat = new THREE.Vector3().setFromMatrixColumn(world.camera.matrixWorld, 2).setY(0).normalize();
          const ry = Math.abs(toScreen(pl.at.clone().addScaledVector(fwdFlat, pl.r * 0.7)).y - c.y);
          poolInfo = { x: c.x, y: c.y, rx, ry, age: pl.age };
        }
      };
      frameOn();
      if (otherSide && s.probePool) {
        // A big out-of-focus sign or window reflected in the wet street at her feet, under the vitals, reads as a
        // rendering artefact (C9 review): if this side has one and the other side doesn't, shoot from the other.
        const vw = world.renderer.domElement.clientWidth;
        const vh = world.renderer.domElement.clientHeight;
        const fgAt = () => s.probePool!(vw * 0.36, vh * 0.86, vw * 0.3, vh * 0.13, { quick: true }).bright;
        const here = player.pos.clone();
        const a = fgAt();
        if (a > 0.02) {
          player.pos.set(otherSide.x, ground(otherSide.x, otherSide.z), otherSide.z);
          frameOn();
          if (fgAt() > a * 0.5) {
            player.pos.copy(here);
            frameOn();
          }
        }
      }
      if (c9.pool && pl && poolInfo && s.probePool) {
        // A pool is only as good as what it reflects: from beside the body the planar mirror can show a dark
        // shopfront, and the pool reads as a flat maroon disc (C9 review). So walk round the pool at the same
        // distance and keep the view where the most neon lands in it (the body still in frame).
        const r0 = new THREE.Vector3(player.pos.x - focus.x, 0, player.pos.z - focus.z);
        const dist = r0.length();
        const from = focus.clone().setY(ground(focus.x, focus.z) + 1.2);
        const vw = world.renderer.domElement.clientWidth;
        const vh = world.renderer.domElement.clientHeight;
        let best: { score: number; pos: THREE.Vector3 } | null = null;
        const tries: [number, number][] = [];
        for (let i = 0; i < 12; i++) tries.push([i <= 6 ? i * 0.5236 : (i - 12) * 0.5236, dist]);
        for (const [a, dd] of tries) {
          const d = r0.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
          if (a !== 0 && rays.cast(from, d, dd + 0.6, { thin: false })) continue;
          player.pos.set(focus.x + d.x * dd, 0, focus.z + d.z * dd);
          player.pos.y = ground(player.pos.x, player.pos.z);
          frameOn();
          const pi = poolInfo as { x: number; y: number; rx: number; ry: number } | null;
          const ch = toScreen(g.body.joints.chest);
          if (!pi || ch.x < vw * 0.08 || ch.x > vw * 0.92 || ch.y < vh * 0.1 || ch.y > vh * 0.85) continue;
          const pr = s.probePool(pi.x, pi.y, pi.rx, pi.ry, { quick: true });
          // It must still read as blood (a pool that mirrors a lit sign whole goes milky), then the most highlight up
          // to a few percent (lights caught in it, not a sheet of them); a near-even pair goes to the side framing.
          // And no big out-of-focus sign reflection filling the foreground under the vitals (C9 review: it read as
          // a rendering artefact): the bright share of the lower-left of the frame counts against a view.
          const fg = s.probePool(vw * 0.28, vh * 0.82, vw * 0.22, vh * 0.14, { noRender: true });
          const score = (pr.red >= 0.25 ? 1 : 0) + Math.min(pr.bright, 0.06) * 10 + pr.red * 0.1 - fg.bright * 2 - Math.abs(a) * 0.0005;
          if (!best || score > best.score) best = { score, pos: player.pos.clone() };
        }
        if (best) player.pos.copy(best.pos);
        frameOn();
      }
    }
    if (c15) {
      // Framed close and three-quarters on (from his right, her left), at eye height: the plate, the carrier under it
      // and the face read at every size; the staggers and the knockdown from further back, the whole man in frame.
      const J = g.body.joints;
      // (The head a touch under the point of aim: it snaps back and down, and the frame keeps it near the middle.)
      // (The head from 3.2 m takes in his shoulders and the hand coming up to the helmet; the broken plate from 2.3 m
      // looks a little down, so the plate in the street at his feet is in frame.)
      const focus = c15.frame === "head" ? J.head.clone().lerp(J.chest, 0.3) : c15.frame === "plate" ? (c15.far ? J.chest.clone().lerp(J.pelvis, 0.45) : J.chest.clone().lerp(J.neck, 0.35)) : J.pelvis.clone().lerp(J.chest, 0.6);
      // The broken plate's frame takes in the plate where it fell, part way to it from his chest.
      const fallen = c15.frame === "plate" && c15.far ? liveDebris()[0] : undefined;
      if (fallen) focus.lerp(fallen.position, 0.4);
      const facing = new THREE.Vector3(Math.sin(g.motion.yaw), 0, Math.cos(g.motion.yaw));
      const side = new THREE.Vector3(-facing.z, 0, facing.x);
      const close = c15.far ?? (c15.frame === "head" ? 2.5 : c15.frame === "plate" ? 1.45 : 3.0);
      // The whole-body frames stand at the same distance on every screen (the takedown chip's 2.5 m reach must agree
      // between desktop and phone, C15 review); the close-ups come in on the phone's small screen.
      const dist = close * (o.quality === "phone" && (c15.frame === "plate" || c15.frame === "head") ? 0.85 : 1);
      const sk = c15.frame === "plate" || c15.frame === "head" ? 0.36 : 0.5;
      // The head from in front and off his right (the hand that goes to the helmet is his left, on the far side); the
      // staggers square to the reaction axis (side-on, a touch in front), so the pitch, the steps and the flung arms read.
      const off =
        c15.frame === "head"
          ? facing.clone().multiplyScalar(0.93).addScaledVector(side, sk)
          : c15.frame === "body" || c15.frame === "back"
            ? side.clone().multiplyScalar(0.95).addScaledVector(facing, c15.frame === "back" ? -0.3 : 0.3)
            : c15.frame === "front"
              ? facing.clone().multiplyScalar(0.88).addScaledVector(side, 0.47)
              : c15.frame === "side"
                ? side.clone().addScaledVector(facing, 0.12)
                : c15.frame === "quarter"
                  ? side.clone().multiplyScalar(0.8).addScaledVector(facing, 0.6)
                : facing.clone().multiplyScalar(0.93).addScaledVector(side, -sk);
      // The knockdown falls away from her: frame him from the side he fell along.
      if (name === "hit-body" && g.knockedDown) off.copy(side).multiplyScalar(-0.9).addScaledVector(facing, 0.44);
      off.normalize();
      const from = focus.clone().setY(ground(focus.x, focus.z) + 1.2);
      if (rays.cast(from, off, dist + 0.4, { thin: false })) off.reflect(side).normalize();
      player.pos.set(focus.x + off.x * dist, 0, focus.z + off.z * dist);
      player.pos.y = ground(player.pos.x, player.pos.z);
      player.applyCamera(world.camera, 0);
      world.camera.updateMatrixWorld();
      world.camera.getWorldPosition(eye);
      const look2 = focus.clone().sub(eye).normalize();
      player.pitch = Math.asin(THREE.MathUtils.clamp(look2.y, -1, 1));
      // A touch off centre to the left, clear of the gun in her right hand.
      player.yaw = Math.atan2(-look2.x, -look2.z) - (c15.frame === "body" || c15.frame === "back" || c15.frame === "front" || c15.frame === "side" || c15.frame === "quarter" ? 0.1 : c15.frame === "head" ? 0.12 : 0.16);
      player.applyCamera(world.camera, 0);
      world.camera.updateMatrixWorld();
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
    s.stageInfo = { hit: toScreen(hitAt), r02, head0, head1: toScreen(g.body.joints.head), puffM: world.fx.gore?.counts.puffM ?? 0, splats, corpse, variant: g.deathVariant, pool: poolInfo, asleep: g.body.asleep, heights: c9 ? jointHeights(g) : undefined, handOpen: { L: g.body.handOpenDeg("L"), R: g.body.handOpenDeg("R") }, seg: lastHitSeg, hands: name === "hit-arm" ? { L: toScreen(g.body.joints.handL), R: toScreen(g.body.joints.handR), r: Math.abs(toScreen(g.body.joints.handL.clone().addScaledVector(camX, 0.12)).x - toScreen(g.body.joints.handL).x) } : undefined };
    if (c15 && g.armour) {
      const J = g.body.joints;
      const up = new THREE.Vector3().subVectors(J.neck, J.chest).normalize();
      const fwdB = new THREE.Vector3(Math.sin(g.motion.yaw), 0, Math.cos(g.motion.yaw));
      const under = J.chest.clone().addScaledVector(up, 0.08).addScaledVector(fwdB, 0.13);
      // The eye strip the shattered visor opens (enforcer.ts face(): head bone, y0 + 1.2 cm, 11.7 cm forward).
      const headBone = g.body.root.getObjectByName("head");
      headBone?.updateWorldMatrix(true, false);
      const face = headBone ? headBone.localToWorld(new THREE.Vector3(0, HELM_Y + 0.008, 0.117)) : J.head.clone().addScaledVector(up, 0.01 - 0.12).addScaledVector(fwdB, 0.12);
      const px = (p: THREE.Vector3) => Math.abs(toScreen(p.clone().addScaledVector(camX, 0.05)).x - toScreen(p).x);
      // Where the fracture radiates from (the chest bone's crackAt), on screen.
      const chestBone = g.body.root.getObjectByName("chest");
      chestBone?.updateWorldMatrix(true, false);
      const crackW = chestBone && g.body.crackAt.z !== 0 ? chestBone.localToWorld(g.body.crackAt.clone()) : null;
      s.stageInfo.armour = {
        crack: crackW ? { ...toScreen(crackW), r: px(crackW) * 2 } : null,
        plates: Object.fromEntries(Object.values(g.armour.plates).map((p) => [p.id, p.state])),
        visor: g.armour.visor,
        reaction: g.reaction?.kind ?? null,
        t: g.reaction?.t ?? 0,
        under: { ...toScreen(under), r: px(under) },
        face: { ...toScreen(face), r: px(face) * 0.7 },
        debris: liveDebris().map((d) => ({ ...toScreen(d.position), asleep: d.asleep })),
        meter: g.stag.meter,
        heights: jointHeights(g),
        arms: g.motion.arms?.mode ?? "rifle",
        shards: g.shards.length,
        crawling: g.crawling,
        wound: g.motion.wound ? { limp: g.motion.wound.limp, hang: g.motion.wound.hang, hunch: g.motion.wound.hunch } : null,
      };
    }
    if (name === "hit-arm") {
      // Seen from her side of him and off his struck shoulder, 1.1 m out: from where she stands the hand is end-on behind
      // his rifle, dark on dark.
      const right = /R$/.test(lastHitSeg ?? "");
      const hand = right ? g.body.joints.handR : g.body.joints.handL;
      const out = (right ? g.body.joints.shoulderR : g.body.joints.shoulderL).clone().sub(g.body.joints.chest).setY(0).normalize();
      const toHer = eye.clone().sub(hand).setY(0).normalize();
      zoomAt = () => ({ at: hand, from: hand.clone().addScaledVector(out.clone().add(toHer).normalize(), 1.1).add(new THREE.Vector3(0, 0.25, 0)) });
    }
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
    let skin = 0;
    let glow = 0;
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
        // C15: skin (a warm hue 5 to 50 degrees, moderately saturated, lit): the face behind a shattered visor.
        const gg = px[o4 + 1]!;
        const bb = px[o4 + 2]!;
        const mx = Math.max(rr, gg, bb);
        const mn = Math.min(rr, gg, bb);
        // C15: the hot amber of a fresh crack's seam (or an ember): bright, red-led, orange to amber, well off grey (the
        // seam's core reads peach through the rain's haze, so the blue channel's gap is absolute, not a ratio).
        if (rr >= 140 && rr - px[o4 + 2]! >= 70 && px[o4 + 1]! >= rr * 0.3 && px[o4 + 1]! <= rr * 0.9) glow++;
        if (mx === rr && gg >= bb && mx >= 60 && mx - mn >= 0.18 * mx && mx - mn <= 0.8 * mx) {
          const hue = (60 * (gg - bb)) / Math.max(1, mx - mn);
          if (hue >= 5 && hue <= 50) skin++;
        }
      }
    return { red, total, mean: mean.map((v) => Math.round(v / Math.max(1, total))), skin, glow };
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
  s.probePool = (x, y, rx, ry, po = {}) => {
    const c = world.renderer.domElement;
    const k = c.width / Math.max(1, c.clientWidth);
    const W = Math.max(2, Math.round(rx * 2 * k));
    const H = Math.max(2, Math.round(ry * 2 * k));
    const grab = (draw = true) => {
      if (draw) render();
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const g2 = cv.getContext("2d", { willReadFrequently: true })!;
      g2.drawImage(c, Math.round((x - rx) * k), Math.round((y - ry) * k), W, H, 0, 0, W, H);
      return g2.getImageData(0, 0, W, H).data;
    };
    // The pool alone counts: a pixel where a body lying in it (with its cold rim) is drawn is not highlight, so the
    // frame is grabbed with the bodies hidden and again as shown, and only pixels that match are the pool's.
    // `quick` (the stage's own search, many views): one frame with the bodies hidden, read as is; `noRender` reads
    // the frame already drawn.
    const shown = enemies.filter((e) => e.body.root.visible);
    for (const e of shown) e.body.root.visible = false;
    const bare = grab(!po.noRender);
    for (const e of shown) e.body.root.visible = true;
    const px = po.quick || po.noRender ? bare : grab();
    let bright = 0;
    let red = 0;
    let total = 0;
    let maxLum = 0;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W - 0.5;
        const v = (j + 0.5) / H - 0.5;
        if (u * u + v * v > 0.25) continue;
        total++;
        const o4 = (j * W + i) * 4;
        const r = px[o4]!;
        const gg = px[o4 + 1]!;
        const b = px[o4 + 2]!;
        if (Math.abs(r - bare[o4]!) + Math.abs(gg - bare[o4 + 1]!) + Math.abs(b - bare[o4 + 2]!) > 24) continue;
        const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
        maxLum = Math.max(maxLum, lum);
        if (lum > 0.3) bright++;
        if (r > 25 && r > gg * 1.6 && r > b * 1.6) red++;
      }
    return { bright: bright / Math.max(1, total), red: red / Math.max(1, total), total, maxLum };
  };
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
  s.takedown = td;
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
/** The name a bark's subtitle carries: the sergeant by rank, the rest by their kit's last word. */
function barkSpeaker(e: Enemy): string {
  if (e.kit.leader) return "Sergeant";
  return e.kit.name.split(" ").pop() ?? e.kit.name;
}

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
