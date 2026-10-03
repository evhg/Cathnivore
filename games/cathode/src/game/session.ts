// One play session: builds the world, puts Cath in it and runs the frame loop that ties everything
// together: input, movement, weapons, combat, enemies, stealth, the kill-cam, bullet-time, XP and the HUD.

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
import { Progress } from "./progress";
import { xpForLevel, xpToNext as simXpToNext } from "../sim/stats";

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
    const e = new Enemy({ ...Progress.kit(base, archetype, areaLevel, seed++), role: base.role }, route.map((p) => p.clone()), areaLevel);
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
  const arsenal = new Arsenal(world.viewScene);
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
  const wake = () => audio?.resume();
  addEventListener("pointerdown", wake);
  addEventListener("keydown", wake);
  wake();
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

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, o.quality === "ultra" ? 3 : 2);
    const scale = o.quality === "phone" ? 0.8 : 1;
    world.resize(o.canvas.clientWidth, o.canvas.clientHeight, dpr * scale);
  };
  addEventListener("resize", resize);
  resize();

  const levelUp = (levels: number[]) => {
    for (const l of levels) {
      s.maxHp = progress.stats.maxHealth;
      s.hp = s.maxHp;
      hud.showBanner(`Level ${l}`, "5 attribute points · 1 skill point · K to spend");
      audio?.levelUp();
    }
    s.level = progress.character.level;
  };

  const onKill = (k: KillEvent) => {
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
    levelUp(progress.kill(k.enemy.kit.xp, k.enemy.level, k.unseen, bonus));
    const xp = progress.lastXp;
    hud.feedLine(`+${xp} XP${bits.length ? " · " + bits.join(" · ") : ""}`, k.headshot || k.unseen);
    hud.hitMarker(true);
  };

  let last = performance.now();
  let time = 0;
  let wasFire = false;
  let dead = false;
  let jobDone = false;
  const eye = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  const frame = (now: number) => {
    const realDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const intent = input.read();
    // On desktop the game waits while the mouse is free (Esc, or before the first click).
    const away = !input.isTouch && !input.locked && !o.shot && !dead && !navigator.webdriver;
    hud.showPause(away);
    if (s.paused || away) {
      last = performance.now();
      world.render();
      requestAnimationFrame(frame);
      return;
    }

    // Time: the kill-cam slows the world right down; held focus (bullet-time) slows it while it lasts.
    let scale = killcam.timeScale;
    const focusing = !killcam.active && intent.focus && s.focus > 0;
    if (focusing) {
      s.focus = Math.max(0, s.focus - realDt);
      scale = 0.35;
    } else s.focus = Math.min(progress.stats.bulletTimeSeconds, s.focus + realDt * 0.15);
    const dt = o.shot ? 0 : realDt * scale;
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
    }
    player.applyCamera(world.camera, realDt);
    world.camera.getWorldPosition(eye);
    world.camera.getWorldDirection(fwd);

    // Weapons.
    if (intent.slot >= 0) arsenal.equip(intent.slot);
    if (intent.cycle) arsenal.equip((arsenal.current + intent.cycle + arsenal.held.length) % arsenal.held.length);
    if (intent.reload) arsenal.reload();
    arsenal.aiming = intent.aim && !dead;
    const press = intent.fire && !wasFire;
    wasFire = intent.fire;
    const trigger = arsenal.weapon.kind === "melee" ? intent.fire : press;
    const spreadMul = (1 + Math.min(1.5, player.speed / 4)) * (player.onGround ? 1 : 2) * (1 - player.crouchAmt * 0.3);
    const shot = dead ? null : arsenal.update(dt || realDt, trigger, eye, fwd, world.camera.quaternion, spreadMul);
    if (shot) {
      const r = combat.fire(shot, build());
      audio?.shot(shot.weapon.weaponClass);
      if (r.killcam) {
        killcam.start(r.killcam);
        audio?.killcamWhoosh();
      }
    }
    if (arsenal.meleeNow) audio?.pin(combat.melee(eye, fwd, arsenal.weapon, build()));
    if (intent.reload && arsenal.weapon.kind !== "melee") audio?.reload();
    const canTakedown = !dead && takedownTarget() !== null;
    if (intent.takedown && canTakedown) {
      const pin = arsenal.held[0]!.def;
      if (combat.takedown(eye, fwd, pin)) {
        arsenal.strike();
        audio?.pin(true);
      }
    }
    combat.update(dt, build());

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
        if (!dead && along > 0 && miss < 0.3 && (!hitWorld || hitWorld.dist > along)) {
          s.hp = Math.max(0, s.hp - e.kit.damage);
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

    if (!dead && s.hp <= 0) {
      dead = true;
      hud.showBanner("Cath is down", "Click or tap to try again");
      setTimeout(() => addEventListener("pointerdown", () => location.reload(), { once: true }), 900);
    }
    if (!jobDone && enemies.length && enemies.every((e) => !e.alive)) {
      jobDone = true;
      objective = "The street's quiet. Walk to the fish market's back door.";
      hud.showBanner("Street clear", "The Drowned Market");
    }
    if (jobDone && ex && player.pos.distanceTo(ex) < 3) {
      jobDone = false;
      objective = "Job done. More of the Drowned Market is coming (ROADMAP 74-76).";
      if (!progress.jobsDone.includes("fishMarket")) progress.jobsDone.push("fishMarket");
      progress.save();
      hud.showBanner("Job done", `Level ${progress.character.level}`);
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
      takedown: canTakedown,
      bulletTime: focusing ? 1 : 0,
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
      stealth: dead ? 0 : progress.stats.detectionMultiplier,
    };
  }

  function takedownTarget(): Enemy | null {
    for (const e of enemies) {
      if (!e.alive || e.state === "combat") continue;
      const to = new THREE.Vector3().subVectors(e.body.joints.chest, eye);
      if (to.length() > 1.9 || to.normalize().dot(fwd) < 0.5) continue;
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
    s.stats.ms = s.stats.ms * 0.9 + (performance.now() - t0) * 0.1;
    s.stats.frames++;
  }

  requestAnimationFrame(frame);
  return s;
}
