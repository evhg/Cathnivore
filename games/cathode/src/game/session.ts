// One play session: builds the world, puts Cath in it and runs the frame loop. The game's systems
// (weapons, enemies, stealth, the kill-cam, the HUD) hang off this loop.

import * as THREE from "three";
import { createWorld } from "../render/world";
import type { Quality, World } from "../render/types";
import { Input } from "./input";
import { Player } from "./player";

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
  /** Frames rendered and a rolling frame time, for ?perf and tests. */
  stats: { frames: number; ms: number };
}

declare global {
  interface Window {
    cathode?: Session;
  }
}

export async function startSession(o: SessionOptions): Promise<Session> {
  const world = await createWorld(o.canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot }, o.onProgress);
  const start = world.markers.player?.[0] ?? new THREE.Vector3();
  const player = new Player(start, world.colliders, (x, z) => world.groundHeight(x, z));
  const input = new Input(o.canvas, o.touch);
  const session: Session = { world, player, input, stats: { frames: 0, ms: 16 } };
  window.cathode = session;

  const crosshair = document.createElement("div");
  crosshair.className = "crosshair";
  o.hud.append(crosshair);

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, o.quality === "phone" ? 2 : o.quality === "high" ? 2 : 3);
    const scale = o.quality === "phone" ? 0.8 : 1;
    world.resize(o.canvas.clientWidth, o.canvas.clientHeight, dpr * scale);
  };
  addEventListener("resize", resize);
  resize();

  let last = performance.now();
  let time = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    const intent = input.read();
    player.step(dt, intent);
    player.applyCamera(world.camera, dt);
    world.update(o.shot ? 0 : dt, o.shot ? 1 : time);
    const t0 = performance.now();
    world.render();
    session.stats.ms = session.stats.ms * 0.9 + (performance.now() - t0) * 0.1;
    session.stats.frames++;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return session;
}
