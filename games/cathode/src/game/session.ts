// One play session: builds the world, puts Cath in it and runs the frame loop that ties everything
// together: input, movement, weapons, combat, enemies, stealth, the kill-cam, bullet-time, XP and the HUD.

import { loadPrefs } from "../prefs";
import * as THREE from "three";
import { createWorld } from "../render/world";
import type { Quality, World } from "../render/types";
import { Input } from "./input";
import { Player } from "./player";
import { ENFORCER, ENFORCER_SNIPER, Enemy, RIOT_SHIELD, type Sight } from "./enemy";
import { RayWorld, rayGround } from "./ray";
import { Arsenal } from "./weapons";
import { Combat, type Build, type KillEvent } from "./combat";
import { KillCam } from "./killcam";
import { Hud } from "../ui/hud";
import { Audio } from "./audio";
import { CLASS_WEAPON, Progress } from "./progress";
import { Pickups } from "./pickups";
import type { Item } from "../sim/loot";
import { FirstJob } from "./firstjob";
import { CrispJob } from "./crispjob";
import { QuayJob } from "./quayjob";
import { ManifestJob } from "./manifestjob";
import { CrispBossJob } from "./crispboss";
import { VaneBossJob } from "./vaneboss";
import { PellBossJob } from "./pellboss";
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
import { ELITE_CHANCE } from "../sim/enemies";
import { DIFFICULTY_LABEL, unlockedDifficulties } from "../sim/difficulty";
import type { Difficulty } from "../sim/types";
import { Voice } from "./voice";
import { nearLandmark } from "./landmarks";
import { ZoneWatch } from "./zones";
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
  stats: { frames: number; ms: number };
  /** Test hook: freeze the AI and the clock. */
  paused: boolean;
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


export async function startSession(o: SessionOptions): Promise<Session> {
  const world = await createWorld(o.canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot }, o.onProgress);
  const start = world.markers.player?.[0] ?? new THREE.Vector3();
  const ground = (x: number, z: number) => world.groundHeight(x, z);
  const player = new Player(start, world.colliders, ground);
  const input = new Input(o.canvas, o.touch);
  const rays = new RayWorld(world.colliders);
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
    const [base, archetype] = KITS[role];
    const e = new Enemy({ ...Progress.kit(base, archetype, areaLevel, seed++), role: base.role }, route.map((p) => p.clone()), areaLevel);
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
      const [base, archetype] = key.includes("sniper")
        ? [ENFORCER_SNIPER, "enforcerSniper"]
        : key.includes("shield") || n % 4 === 3
          ? [RIOT_SHIELD, "riotShield"]
          : [ENFORCER, "enforcer"];
      const elite = Math.random() < ELITE_CHANCE[progress.character.difficulty];
      const e = new Enemy({ ...Progress.kit(base, archetype, areaLevel, seed++, elite), role: base.role }, route.map((p) => p.clone()), areaLevel);
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
  let audio: Audio | null = null;
  try {
    audio = new Audio();
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
  // Face down the street from the start marker, towards the extraction point.
  const ex = world.markers.extract?.[0];
  if (ex) player.yaw = Math.atan2(-(ex.x - start.x), -(ex.z - start.z));

  const build = (): Build => progress.build();

  let objective = "Get to the fish market. Somebody there knows who put Tomas in the water.";
  hud.showBanner("The Fish Market", "The Drowned Market · 23:40");
  const zones = new ZoneWatch();
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
        banner: (a, b) => hud.showBanner(a, b),
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
          banner: (a, b) => hud.showBanner(a, b),
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
          banner: (a, b) => hud.showBanner(a, b),
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
          banner: (a, b) => hud.showBanner(a, b),
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
          banner: (a, b) => hud.showBanner(a, b),
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
  const vaneBoss =
    !tutorial && progress.jobsDone.includes("crispBoss") && !progress.jobsDone.includes("vaneBoss") && !o.shot
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
          banner: (a, b) => hud.showBanner(a, b),
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
  const pellBoss =
    !tutorial && progress.jobsDone.includes("vaneBoss") && !progress.jobsDone.includes("pellBoss") && !o.shot
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
          banner: (a, b) => hud.showBanner(a, b),
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
  const boardBoss =
    !tutorial && progress.jobsDone.includes("pellBoss") && !progress.jobsDone.includes("boardBoss") && !o.shot
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
          banner: (a, b) => hud.showBanner(a, b),
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
  const vaultBoss =
    !tutorial && progress.jobsDone.includes("boardBoss") && !progress.jobsDone.includes("vaultBoss") && !o.shot
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
          banner: (a, b) => hud.showBanner(a, b),
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
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
          banner: (a, b) => hud.showBanner(a, b),
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
          banner: (a, b) => hud.showBanner(a, b),
          light: world.light ? (p, c, i, r) => world.light!(p, c, i, r) : undefined,
        })
      : null;
  s.job = job;
  const actives = new Actives();
  actives.assign(progress.character);
  actives.battery = progress.stats.battery;
  setTimeout(() => voice.say("start"), 2600);

  // Dynamic resolution holds the frame rate; off in screenshot and automated runs, where frames are always slow.
  const auto = new AutoScale({ min: 0.55, max: 1, target: 1000 / 60, rescueMin: 0.35 });
  const autoOn = !o.shot && !navigator.webdriver;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, o.quality === "ultra" ? 3 : 2);
    const scale = (o.quality === "phone" ? 0.8 : 1) * auto.scale;
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
  const collect = (drop: { items: Item[]; scrip: number }) => {
    progress.take(drop);
    if (drop.scrip) hud.feedLine(`+${drop.scrip} Scrip`);
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

  const onKill = (k: KillEvent) => {
    actives.onKill();
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
    const at = k.enemy.position.clone();
    at.y = world.groundHeight(at.x, at.z);
    pickups.drop(at, found);
    const ammo = arsenal.scavenge();
    if (ammo) hud.feedLine(`+${ammo} rounds`);
    hud.hitMarker(true);
  };

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
  let hitStop = 0;
  let jolt = 0;
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
      const t = job?.target ?? crisp?.target ?? quay?.target ?? manifest?.target ?? crispBoss?.target ?? vaneBoss?.target ?? pellBoss?.target ?? boardBoss?.target ?? vaultBoss?.target ?? wanted?.target ?? side?.target;
      openDistrictMap(o.hud.parentElement ?? o.hud, player.pos, t ? { x: t.x, z: t.z } : null, () => (coaching = false), progress.jobsDone);
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
    // Hit-stop: a landed blow holds the world for a few frames, so it lands with weight.
    if (hitStop > 0) {
      hitStop -= realDt;
      scale *= 0.06;
    }
    const dt = o.shot ? 0 : realDt * scale;
    thunderCover = Math.max(0, thunderCover - realDt);
    grace = Math.max(0, grace - dt);
    // Out of the fight for a few seconds, she gets her breath back.
    sinceHurt += dt;
    if (!dead && sinceHurt > 5 && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.06 * dt);
    // Slow motion looks it: the noir grade deepens while time is held.
    if (!killcam.active) {
      const want = focusing || run.timeScale < 1 ? 0.4 : 0;
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
      for (const e of enemies) e.update(dt, sightOf(), rays, world.colliders, ground);
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
    if (input.isTouch && !dead && progress.character.difficulty !== "hellWeek") {
      const t = aimAssist(intent.aim || intent.fire, realDt);
      const w = arsenal.weapon;
      input.autoFire =
        !!t && t.enemy.state === "combat" && t.angle < 0.04 && w.kind !== "melee" && t.enemy.position.distanceTo(player.pos) < w.range && arsenal.ammo.mag > 0;
    }
    player.applyCamera(world.camera, realDt);
    // Scope sway: a slow figure-of-eight; held breath (Focus while scoped) all but stills it.
    if (arsenal.scopedIn) {
      swayT += realDt;
      const amp = 0.0045 * progress.stats.swayMultiplier * run.sway * (focusing ? 0.12 : 1) * (1 + player.speed * 0.4);
      world.camera.rotation.x += Math.sin(swayT * 0.9) * amp;
      world.camera.rotation.y += Math.sin(swayT * 0.45) * amp * 1.4;
    }
    // The camera jolts with a landed blow, in the swing's direction.
    if (jolt > 0.01) {
      jolt *= Math.exp(-realDt * 14);
      world.camera.rotation.z += jolt * 0.035 * arsenal.anim.meleeSide;
      world.camera.rotation.x -= jolt * 0.02;
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
        audio?.killcamWhoosh();
      }
    }
    if (arsenal.meleeNow) {
      const struck = combat.melee(eye, fwd, arsenal.weapon, build());
      audio?.pin(struck, arsenal.weapon.model);
      if (struck) {
        hitStop = 0.07;
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
    combat.update(dt, build());

    // Active skills: quick-slots, thrown things, explosions, the lunge's strike.
    const ctx = { player, eye, fwd, enemies, world, maxHp: s.maxHp };
    if (!dead && intent.skill1) actives.use(0, progress.character, progress.stats, ctx);
    if (!dead && intent.skill2) actives.use(1, progress.character, progress.stats, ctx);
    actives.update(dt, progress.stats, world, world.colliders, ground, enemies);
    if (!dead) for (const d of pickups.update(dt, player.pos)) collect(d);
    if (!dead && s.hp > 0) {
      const zone = zones.update(player.pos.z);
      if (zone) hud.showBanner(zone.name, zone.sub);
      const lm = nearLandmark(progress.jobsDone, player.pos.x, player.pos.z);
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
    for (const e of enemies) {
      e.update(dt, sight, rays, world.colliders, ground);
      for (const sh of e.shots) {
        world.fx.muzzle(sh.from, sh.dir, 0.6);
        const hitWorld = rays.cast(sh.from, sh.dir, 120);
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
          if (e.kit.drain) s.focus = Math.max(0, s.focus - e.kit.drain);
          world.fx.tracer(sh.from, sight.chest);
          audio?.hitFlesh(false);
        } else if (hitWorld) {
          world.fx.impact(hitWorld.point, hitWorld.normal, world.surfaceAt(hitWorld.point));
          world.fx.tracer(sh.from, hitWorld.point);
        }
        combat.noise(sh.from, 40);
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
    if (vaneBoss) {
      vaneBoss.update(dt);
      objective = vaneBoss.objective;
    }
    if (pellBoss) {
      pellBoss.update(dt);
      objective = pellBoss.objective;
    }
    if (boardBoss) {
      boardBoss.update(dt);
      objective = boardBoss.objective;
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
      if (player.onGround) audio.steps(player.speed * realDt * (dt > 0 ? dt / realDt : 1), player.speed, player.crouchAmt);
      let tension = 0;
      for (const e of enemies) if (e.alive) tension = Math.max(tension, e.state === "combat" ? 1 : e.state === "searching" ? 0.6 : e.detect * 0.5);
      audio.update(realDt, tension, focusing ? 0.7 : 0);
    }

    // Camera zoom while aiming, and the weapon rig.
    world.camera.fov = arsenal.worldFov;
    world.camera.updateProjectionMatrix();
    arsenal.pose(realDt, intent.look, player.stride, player.speed, intent.sprint, player.landed, world.viewCamera, BASE_FOV);
    world.update(dt, o.shot ? 1 : time);

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
      melee: arsenal.weapon.kind === "melee",
      spread: (arsenal.aiming ? 0 : 10) * spreadMul,
      scoped: arsenal.scopedIn,
      threats: threats(),
      scopeRange: Math.min(ahead ? ahead.dist : 800, groundT ?? 800),
      wind: world.wind.x,
      objective,
      waypoint: waypoint(),
      takedown: canTakedown,
      bulletTime: focusing ? 1 : 0,
      skills: [0, 1].map((i) => {
        const st = actives.state(progress.character, progress.stats, i);
        return st ? { name: st.name, ready: st.ready, key: i === 0 ? "G" : "Z" } : null;
      }),
      battery: actives.battery / Math.max(1, progress.stats.battery),
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

  /** Touch aim assist: within a few degrees of an Enforcer, the crosshair is pulled onto them. */
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
    const t = job?.target ?? crisp?.target ?? quay?.target ?? manifest?.target ?? crispBoss?.target ?? vaneBoss?.target ?? pellBoss?.target ?? boardBoss?.target ?? vaultBoss?.target ?? wanted?.target ?? side?.target;
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
    const inside = p.x > -26 && p.x < 16 && p.z > -70 && p.z < 66;
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

  function threats() {
    const out: Array<{ bearing: number; amount: number; hunting: boolean }> = [];
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

  function drainEvents(): void {
    for (const k of combat.kills) {
      onKill(k);
      if (k.severed.length) audio?.sever();
    }
    for (const h of combat.hits) {
      if (!h.killed) hud.hitMarker(false);
      audio?.hitFlesh(h.damage > 40);
    }
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

  requestAnimationFrame(frame);
  return s;
}

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
