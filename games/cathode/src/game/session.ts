// One play session: builds the world, puts Cath in it and runs the frame loop that ties everything
// together: input, movement, weapons, combat, enemies, stealth, the kill-cam, bullet-time, XP and the HUD.

import * as THREE from "three";
import { createWorld } from "../render/world";
import type { Quality, World } from "../render/types";
import { Input } from "./input";
import { Player } from "./player";
import { ENFORCER, Enemy, type Sight } from "./enemy";
import { RayWorld } from "./ray";
import { Arsenal } from "./weapons";
import { Combat, type Build, type KillEvent } from "./combat";
import { KillCam } from "./killcam";
import { Hud } from "../ui/hud";

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

/** XP needed to go from level L to L+1 (docs/design/cathode.md 4.1). */
export function xpToNext(level: number): number {
  return Math.round(120 * Math.pow(level, 1.85));
}

const BASE_FOV = 75;

export async function startSession(o: SessionOptions): Promise<Session> {
  const world = await createWorld(o.canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot }, o.onProgress);
  const start = world.markers.player?.[0] ?? new THREE.Vector3();
  const ground = (x: number, z: number) => world.groundHeight(x, z);
  const player = new Player(start, world.colliders, ground);
  const input = new Input(o.canvas, o.touch);
  const rays = new RayWorld(world.colliders);
  const enemies: Enemy[] = [];
  for (const [key, route] of Object.entries(world.markers)) {
    if (!key.startsWith("patrol:") || !route.length) continue;
    const e = new Enemy(ENFORCER, route.map((p) => p.clone()));
    world.scene.add(e.body.root);
    enemies.push(e);
  }
  const arsenal = new Arsenal(world.viewScene);
  // The gun reflects the same neon city as the street.
  if (world.scene.environment && !world.viewScene.environment) world.viewScene.environment = world.scene.environment;
  const combat = new Combat(world, rays, enemies, o.intensity === "full");
  const killcam = new KillCam(world);
  const hud = new Hud(o.hud);
  const s: Session = {
    world,
    player,
    input,
    enemies,
    rays,
    arsenal,
    combat,
    killcam,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    focus: 4,
    stats: { frames: 0, ms: 16 },
    paused: false,
  };
  window.cathode = s;
  // Face down the street from the start marker, towards the extraction point.
  const ex = world.markers.extract?.[0];
  if (ex) player.yaw = Math.atan2(-(ex.x - start.x), -(ex.z - start.z));

  const build = (): Build => ({
    damage: () => 1 + 0.04 * (s.level - 1),
    headshot: 1,
    crit: 0.05,
    critMul: 1.5,
  });

  let objective = "Get to the fish market. Somebody there knows who put Tomas in the water.";
  hud.showBanner("The Fish Market", "The Drowned Market · 23:40");

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, o.quality === "ultra" ? 3 : 2);
    const scale = o.quality === "phone" ? 0.8 : 1;
    world.resize(o.canvas.clientWidth, o.canvas.clientHeight, dpr * scale);
  };
  addEventListener("resize", resize);
  resize();

  const gainXp = (amount: number) => {
    s.xp += amount;
    while (s.xp >= xpToNext(s.level)) {
      s.xp -= xpToNext(s.level);
      s.level++;
      s.maxHp += 8;
      s.hp = s.maxHp;
      hud.showBanner(`Level ${s.level}`, "5 attribute points · 1 skill point");
    }
  };

  const onKill = (k: KillEvent) => {
    const bits: string[] = [];
    let xp = k.enemy.kit.xp;
    if (k.takedown) bits.push("Takedown");
    if (k.headshot) {
      bits.push("Headshot");
      xp *= 1.25;
    }
    if (k.distance > 40) {
      bits.push(`${Math.round(k.distance)} m`);
      xp *= 1.2;
    }
    if (k.severed.length) bits.push(k.severed.includes("head") ? "Decapitated" : "Dismembered");
    if (k.unseen) {
      bits.push("Unseen");
      xp *= 1.5;
    }
    xp = Math.round(xp);
    gainXp(xp);
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
    if (s.paused) {
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
    } else s.focus = Math.min(4, s.focus + realDt * 0.15);
    const dt = o.shot ? 0 : realDt * scale;
    time += dt;

    if (killcam.active) {
      if (intent.fire && !wasFire) killcam.skip();
      wasFire = intent.fire;
      combat.update(dt, build());
      for (const e of enemies) e.update(dt, sightOf(), rays, world.colliders, ground);
      killcam.update(realDt);
      drainEvents();
      world.update(dt, time);
      render();
      requestAnimationFrame(frame);
      return;
    }

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
      if (r.killcam) killcam.start(r.killcam);
    }
    if (arsenal.meleeNow) combat.melee(eye, fwd, arsenal.weapon, build());
    const canTakedown = !dead && takedownTarget() !== null;
    if (intent.takedown && canTakedown) {
      const pin = arsenal.held[0]!.def;
      if (combat.takedown(eye, fwd, pin)) arsenal.equip(arsenal.current);
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
        } else if (hitWorld) {
          world.fx.impact(hitWorld.point, hitWorld.normal, world.surfaceAt(hitWorld.point));
          world.fx.tracer(sh.from, hitWorld.point);
        }
        combat.noise(sh.from, 40);
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
      hud.showBanner("Job done", `Level ${s.level} · ${s.xp} XP`);
    }

    // Camera zoom while aiming, and the weapon rig.
    world.camera.fov = arsenal.worldFov;
    world.camera.updateProjectionMatrix();
    arsenal.pose(realDt, intent.look, player.stride, player.speed, intent.sprint, player.landed, world.viewCamera, BASE_FOV);
    world.update(dt, o.shot ? 1 : time);

    // HUD.
    const ahead = rays.cast(eye, fwd, 800);
    hud.update(realDt, {
      hp: s.hp,
      maxHp: s.maxHp,
      level: s.level,
      xp: s.xp,
      xpNext: xpToNext(s.level),
      weapon: arsenal.weapon.name,
      mag: arsenal.ammo.mag,
      reserve: arsenal.ammo.reserve,
      melee: arsenal.weapon.kind === "melee",
      spread: (arsenal.aiming ? 0 : 10) * spreadMul,
      scoped: arsenal.scopedIn,
      threats: threats(),
      scopeRange: ahead ? ahead.dist : 800,
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
      stealth: dead ? 0 : 1,
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
    for (const k of combat.kills) onKill(k);
    for (const h of combat.hits) if (!h.killed) hud.hitMarker(false);
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
