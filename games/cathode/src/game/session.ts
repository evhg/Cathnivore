// One play session: builds the world, puts Cath in it and runs the frame loop that ties everything
// together: input, movement, weapons, combat, enemies, stealth, the kill-cam, bullet-time, XP and the HUD.

import { openPhotoMode } from "../ui/photomode";
import { calmCameraOn, loadPrefs } from "../prefs";
import * as THREE from "three";
import { LASER_COOLDOWN, LASER_DAMAGE, laserState, laserTouches, lasersFrom } from "./lasers";
import { createWorld } from "../render/world";
import type { Quality, World } from "../render/types";
import { Input } from "./input";
import { Player } from "./player";
import { CIVILIAN, ENFORCER, ENFORCER_SNIPER, Enemy, NURSE, NURSE_HEAL, NURSE_RANGE, ORDERLY, TURRET, HUNTER, POLICE_DRONE, RIOT_SHIELD, BOARD_GUARD, type EnemyKit, type Sight } from "./enemy";
import { RayWorld, rayGround } from "./ray";
import { Arsenal } from "./weapons";
import { Combat, type Build, type KillEvent } from "./combat";
import { Timescale } from "./feel/timescale";
import { coverWireframe } from "./coverdebug";
import { Trauma } from "./feel/trauma";
import { Spring1 } from "./feel/spring";
import { tuning } from "./feel/tuning";
import { AUTOMATIC, confirmSound, hitClass, hitStopMs, type HitEvent } from "../sim/hitevent";
import { reduceMotionOn } from "../prefs";
import { KillCam } from "./killcam";
import { Hud } from "../ui/hud";
import { Audio } from "./audio";
import { CLASS_WEAPON, Progress } from "./progress";
import { Pickups, gunDrop } from "./pickups";
import type { Item } from "../sim/loot";
import { FirstJob } from "./firstjob";
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
  stats: { frames: number; ms: number; combatMs?: number; particles?: number };
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
  stageInfo?: { hit: { x: number; y: number }; r02: number; head0: { x: number; y: number }; head1: { x: number; y: number }; puffM: number } | null;
  /** Renders a frame and counts red-dominant pixels within `r` CSS px of (x, y) (the C2 blood probe). */
  probeRed?: (x: number, y: number, r: number) => { red: number; total: number; mean: number[] };
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
const DAMAGE_TAKEN: Record<string, number> = { noir: 0.55, hardboiled: 0.85, hellWeek: 1 };
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
  const world = await createWorld(o.canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot, district: o.district }, o.onProgress);
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
  window.addEventListener("cathode:prefs", syncInput);
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
  const arsenal = new Arsenal(world.viewScene);
  // Each class walks in holding its own weapon: the Ghost the rifle, the Butcher the shotgun.
  const cls = progress.character.classes[0];
  arsenal.owned.clear();
  for (const id of progress.unlocks.weapons) arsenal.owned.add(id);
  // In hand: her class weapon if she has it, else the Kestrel, else the Pin.
  const classGun = CLASS_WEAPON[cls!] ?? "kestrel";
  arsenal.equipId(arsenal.owned.has(classGun) ? classGun : arsenal.owned.has("kestrel") ? "kestrel" : "pin");
  // The gun reflects the same neon city as the street.
  if (world.scene.environment && !world.viewScene.environment) world.viewScene.environment = world.scene.environment;
  const combat = new Combat(world, rays, enemies, o.intensity === "full");
  const killcam = new KillCam(world);
  const hud = new Hud(o.hud);
  // The case note's eyebrow: the district the job is in ("Case · The Drowned Market").
  const caseName = loadingTitle(o.district).split(" · ").pop() ?? "";
  let audio: Audio | null = null;
  try {
    audio = new Audio(inVault ? "vault" : inTower ? "tower" : inPlaza ? "plaza" : inClinic ? "clinic" : "market");
  } catch {
    // No WebAudio: play on in silence.
  }
  // Lightning: its thunder rolls in after the flash, and covers a gunshot for a couple of seconds.
  let thunderCover = 0;
  if (world.on && audio) {
    audio.externalThunder = true;
    world.on((ev) => {
      if (ev.type === "thunder") {
        setTimeout(() => audio?.thunder(), Math.max(0, ev.delay) * 1000);
        thunderCover = 2 + Math.max(0, ev.delay);
      } else if (ev.type === "casing") audio?.casing();
    });
  }
  if (audio) audio.volume = loadPrefs().volume;
  const wake = () => audio?.resume();
  // iOS counts touchend and click as gestures that may start audio, not pointerdown.
  for (const ev of ["pointerdown", "touchend", "click", "keydown"]) addEventListener(ev, wake, { capture: true });
  document.addEventListener("visibilitychange", () => audio?.suspend(document.hidden));
  const s: Session = {
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
    arsenal.equipId(id);
    const def = SLICE_WEAPONS.find((w) => w.id === id);
    if (isNew && def) hud.feedLine(`New weapon: ${def.name}`, true);
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
        light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
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
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
  s.job = job;
  const actives = new Actives();
  actives.assign(progress.character);
  actives.battery = progress.stats.battery;
  setTimeout(() => voice.say(inVault ? "startVault" : inTower ? "startTower" : inPlaza ? "startPlaza" : inClinic ? "startClinic" : "start"), 2600);

  // Dynamic resolution holds the frame rate; off in screenshot and automated runs, where frames are always slow.
  const auto = new AutoScale({ min: 0.6, max: 1, target: 1000 / 60, rescueMin: 0.4 });
  const autoOn = !o.shot && !navigator.webdriver;
  const renderScaleParam = Math.max(0.25, Math.min(1, Number(new URLSearchParams(location.search).get("rs") ?? 1) || 1));
  const resize = () => {
    // Phones: 1.5x keeps them cool. 5K desktops cap the 3D at 1.5x (the DOM HUD stays at native DPR, S8).
    const cap = input.isTouch ? 1.5 : innerHeight * devicePixelRatio > 2000 ? 1.5 : o.quality === "ultra" ? 3 : 2;
    const dpr = Math.min(devicePixelRatio, cap);
    // ?rs=0.5 forces the 3D render scale (5K screenshot runs under SwiftShader).
    const scale = (o.quality === "phone" ? 0.8 : 1) * auto.scale * renderScaleParam;
    world.resize(o.canvas.clientWidth, o.canvas.clientHeight, dpr * scale);
  };
  addEventListener("resize", resize);
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
  let sinceHurt = 99;
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
  trauma.reducedMotion = reduceMotionOn();
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

  const frame = (now: number) => {
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
    sinceHurt += dt;
    if (!dead && sinceHurt > 5 && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.06 * dt);
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
      const amp = (calm ? 0.4 : 1) * 0.0045 * progress.stats.swayMultiplier * run.sway * (focusing ? 0.12 : 1) * (1 + player.speed * 0.4);
      world.camera.rotation.x += Math.sin(swayT * 0.9) * amp;
      world.camera.rotation.y += Math.sin(swayT * 0.45) * amp * 1.4;
    }
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

    // Weapons.
    if (intent.slot >= 0) arsenal.equipSlot(intent.slot);
    if (intent.cycle && arsenal.scopedIn) arsenal.stepZoom(-intent.cycle);
    else if (intent.cycle) arsenal.cycleOwned(intent.cycle);
    if (intent.reload) arsenal.reload();
    arsenal.aiming = intent.aim && !dead;
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
      const nx = actives.takeNextShot(shot.weapon.weaponClass);
      const mul = gun.dmg * nx.mul * progress.weaponScale(shot.weapon.id);
      if (mul !== 1) shot.weapon = { ...shot.weapon, damage: shot.weapon.damage * mul };
      if (nx.pellets > 0) shot.dirs = shot.dirs.slice(0, nx.pellets);
      if (thunderCover > 0) shot.weapon = { ...shot.weapon, noise: shot.weapon.noise * 0.25 };
      grace = 0;
      const r = combat.fire(shot, build());
      if (thunderCover > 0) hud.feedLine("Covered by the thunder");
      audio?.shot(shot.weapon.weaponClass);
      if (shot.weapon.weaponClass !== "melee") {
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
    if (intent.reload && arsenal.weapon.kind !== "melee") audio?.reload();
    const canTakedown = !dead && takedownTarget() !== null;
    if (intent.takedown && canTakedown) {
      // With Cat's Cradle in hand the takedown is a garrotte: the wire reaches further (3 m) than the Pin.
      const garrotte = arsenal.weapon.id === "catsCradle";
      const pin = garrotte ? arsenal.weapon : arsenal.held[0]!.def;
      if (combat.takedown(eye, fwd, pin, garrotte ? 3 : 1.9)) {
        arsenal.strike();
        audio?.pin(true);
      }
    }
    const combatT0 = performance.now();
    combat.update(dt, build());

    // Active skills: quick-slots, thrown things, explosions, the lunge's strike.
    const ctx = { player, eye, fwd, enemies, world, maxHp: s.maxHp };
    if (!dead && intent.skill1) actives.use(0, progress.character, progress.stats, ctx);
    if (!dead && intent.skill2) actives.use(1, progress.character, progress.stats, ctx);
    actives.update(dt, progress.stats, world, world.colliders, ground, enemies);
    if (!dead) for (const d of pickups.update(dt, player.pos)) collect(d);
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
    for (const b of actives.blasts) combat.explode(b.pos, b.radius, b.damage, build(), b.silent);
    actives.blasts.length = 0;
    for (const b of deathBlasts.splice(0)) {
      world.fx.explosion(b.pos.clone(), b.radius);
      combat.explode(b.pos, b.radius, b.damage, build(), false);
      const d = b.pos.distanceTo(eye);
      if (!dead && d < b.radius) {
        s.hp = Math.max(0, s.hp - actives.absorb(b.damage * (1 - d / b.radius) * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)));
        sinceHurt = 0;
      }
    }
    for (let i = 0; i < lasers.length; i++) {
      const st = laserState(time, lasers[i]!.phase);
      const beam = laserMeshes[i]!;
      beam.visible = st.live || (st.warn && Math.floor(time * 12) % 2 === 0);
      if (st.live && !dead && laserCool <= 0 && laserTouches(lasers[i]!, player.pos)) {
        s.hp = Math.max(0, s.hp - actives.absorb(LASER_DAMAGE * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)));
        sinceHurt = 0;
        laserCool = LASER_COOLDOWN;
        hud.hurtFrom(0);
        audio?.hurt(false);
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
          s.hp = Math.max(0, s.hp - actives.absorb(e.kit.damage * run.guard * (DAMAGE_TAKEN[progress.character.difficulty] ?? 1)));
          sinceHurt = 0;
          hud.hurtFrom(bearingTo(sh.from));
          if (e.kit.drain) s.focus = Math.max(0, s.focus - e.kit.drain);
          if (!sh.melee) world.fx.tracer(sh.from, sight.chest);
          audio?.hurt(!!sh.melee);
        } else if (hitWorld) {
          world.fx.impact(hitWorld.point, hitWorld.normal, world.surfaceAt(hitWorld.point));
          world.fx.tracer(sh.from, hitWorld.point);
        }
        combat.noise(sh.from, sh.melee ? 8 : 40);
        if (sh.melee) continue;
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

    if (!dead && s.hp <= 0) {
      dead = true;
      hud.showBanner("Cath is down", "Click or tap to try again");
      setTimeout(() => addEventListener("pointerdown", () => location.reload(), { once: true }), 900);
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
    world.camera.fov = arsenal.worldFov + (calm ? 0.4 : 1) * fovPunch.update(realDt);
    world.camera.updateProjectionMatrix();
    arsenal.pose(realDt, intent.look, player.stride, player.speed, intent.sprint, player.landed, world.viewCamera, BASE_FOV);
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
      waypoint: waypoint(),
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

  /** The objective on screen, for the waypoint diamond. */
  function waypoint(): { x: number; y: number; dist: number; behind: boolean } | null {
    const t = job?.target ?? crisp?.target ?? quay?.target ?? manifest?.target ?? crispBoss?.target ?? vaneLead?.target ?? vaneBoss?.target ?? pellLead?.target ?? pellBoss?.target ?? boardLead?.target ?? boardBoss?.target ?? vaultLead?.target ?? vaultBoss?.target ?? wanted?.target ?? side?.target;
    if (!t || dead) return null;
    const p = t.clone().add(new THREE.Vector3(0, 1.2, 0)).project(world.camera);
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
  combat.bus.on("kill", (k) => {
    if (!k.last || killcam.active) return;
    const L = tuning.lastEnemySlowmo;
    timescale.hitStop(tuning.hitStop.lastEnemy);
    timescale.push("lastEnemy", L.scale, tuning.hitStop.lastEnemy + L.holdMs, 0, L.rampOutMs, "focus");
    trauma.add(tuning.kill.trauma);
    rumble("kill");
    combat.bus.emit("encounterCleared", { t: combat.clock });
  });
  const byUid = (uid: string) => enemies.find((e) => String(e.id) === uid);
  const camRight = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const toHit = new THREE.Vector3();
  function drainEvents(): void {
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
  let crateCollider: { off?: boolean } | null = null;
  const STAGES = ["hit-body", "hit-head", "hit-kill", "hit-headkill", "hit-soft", "hit-pen", "hit-armourbreak", "blocked", "peek-head", "cover-debug-market", "enemy-flinch-head-60", "wall-splat"];
  /** A world point on screen, in CSS px. */
  const toScreen = (p: THREE.Vector3) => {
    const v = p.clone().project(world.camera);
    const c = world.renderer.domElement;
    return { x: ((v.x + 1) / 2) * c.clientWidth, y: ((1 - v.y) / 2) * c.clientHeight };
  };
  s.stage = (name: string, tMs = 60): string => {
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
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    // A plain rifleman (a riot shield would eat the round), the nearest one.
    const rifle = enemies.filter((e) => e.alive && (e.kit.role ?? "rifle") === "rifle").sort((a, b) => a.position.distanceTo(eye) - b.position.distanceTo(eye));
    // Failing that, anyone armed (a civilian never counts as a target, so cover can't be "blocked" on one).
    const g = rifle[0] ?? enemies.find((e) => e.alive && !e.shield && e.kit.role !== "civilian" && e.kit.role !== "nurse" && e.kit.role !== "turret");
    if (!g) return "no enemy";
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
    s.stageInfo = { hit: toScreen(hitAt), r02, head0, head1: toScreen(g.body.joints.head), puffM: world.fx.gore?.counts.puffM ?? 0 };
    if (name === "hit-soft") hud.hitMarker("armour");
    if (name === "hit-pen") hud.hitMarker("pen");
    if (name === "hit-armourbreak") hud.hitMarker("armourBreak");
    hud.freeze(tMs);
    return hud.hitClass ?? (name === "blocked" ? "blocked" : "none");
  };
  s.probeRed = (x, y, r) => {
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
        if ((i - R) ** 2 + (j - R) ** 2 > R * R) continue;
        total++;
        const o4 = (j * R * 2 + i) * 4;
        const rr = px[o4]!;
        mean[0] += rr;
        mean[1] += px[o4 + 1]!;
        mean[2] += px[o4 + 2]!;
        if (rr > 45 && rr > px[o4 + 1]! * 1.8 && rr > px[o4 + 2]! * 1.8) red++;
      }
    return { red, total, mean: mean.map((v) => Math.round(v / Math.max(1, total))) };
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
