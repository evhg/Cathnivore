// The contract between the renderer (src/render/) and the game layer (src/game/). The renderer owns the
// scene, lighting, post-processing and effects; the game layer owns the camera's transform, the player,
// enemies and rules. Keep this file small and stable: both sides build against it.

import type * as THREE from "three";

export type Quality = "phone" | "high" | "ultra";

export interface WorldOptions {
  quality: Quality;
  /** "full" or "reduced": reduced draws no blood, decals or gibs (hit sparks only). */
  intensity: "full" | "reduced";
  /** Screenshot mode: fixed time and seed, rain frozen mid-fall, so shots compare cleanly. */
  shot?: boolean;
}

/** What a bullet hit, for impact effects and sound. */
export type Surface = "concrete" | "metal" | "glass" | "water" | "wood" | "flesh" | "chrome";

export interface Effects {
  /** A muzzle flash with a brief real light at `pos`, pointing along `dir`. */
  muzzle(pos: THREE.Vector3, dir: THREE.Vector3, size?: number): void;
  /** A bullet impact on the world: dust or sparks or a splash by surface, plus a hole decal. */
  impact(pos: THREE.Vector3, normal: THREE.Vector3, surface: Surface): void;
  /** Blood from a wound, sprayed along `dir`; `amount` 0..1 scales droplets and the splatter decals. */
  blood(pos: THREE.Vector3, dir: THREE.Vector3, amount: number): void;
  /** Sparks and coolant from a cyborg or machine hit. */
  sparks(pos: THREE.Vector3, dir: THREE.Vector3, amount: number): void;
  /** A brass casing ejected from `pos` with `vel`; it bounces and rings on the ground. */
  casing(pos: THREE.Vector3, vel: THREE.Vector3): void;
  /** A tracer streak from a to b (sniper rounds, the kill-cam). */
  tracer(a: THREE.Vector3, b: THREE.Vector3): void;
  /** An explosion: light, fire, smoke, debris. */
  explosion(pos: THREE.Vector3, radius: number): void;
}

/**
 * Things the world tells the game layer about (optional to consume): thunder (sound, and masking for
 * subsonic shots, design bible §4.5) and casings landing (the ring of brass on wet concrete).
 */
export type WorldEvent =
  | { type: "thunder"; strength: number; delay: number }
  | { type: "casing"; pos: THREE.Vector3; surface: Surface };

export interface World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  /** The player's eye. The game layer moves it; the renderer only reads it. */
  readonly camera: THREE.PerspectiveCamera;
  /** Static collision boxes in world space, for the player, AI line of sight and bullets. */
  readonly colliders: THREE.Box3[];
  /** Named points authored with the level: "player" (one), "patrol:<name>" (routes), "perch" (sniper spots), "extract". */
  readonly markers: Record<string, THREE.Vector3[]>;
  /**
   * First-person layer: Cath's hands and weapon. Rendered after the world with the depth buffer cleared and
   * its own narrow-FOV camera (so the gun never clips into walls), but through the same post chain so
   * muzzle flashes bloom. The game layer owns its contents and moves viewCamera's FOV for aiming.
   */
  readonly viewScene: THREE.Scene;
  readonly viewCamera: THREE.PerspectiveCamera;
  readonly fx: Effects;
  /** Walkable floor height under (x, z), including stairs and ramps. */
  groundHeight(x: number, z: number): number;
  /** How lit a point is, 0 (black) to 1 (under a lamp): stealth reads it. */
  lightAt(p: THREE.Vector3): number;
  /** The surface a world ray hit (for impacts), from the collider it struck. */
  surfaceAt(p: THREE.Vector3): Surface;
  /** Per-frame animation: rain, signs flickering, steam, effects. */
  update(dt: number, time: number): void;
  render(): void;
  resize(width: number, height: number, pixelRatio: number): void;
  /** Slow-motion/kill-cam grading: 0 normal, 1 full (desaturated, vignetted, depth of field). */
  setDrama(amount: number): void;
  /** Wind for ballistics and rain, metres per second along x and z. */
  readonly wind: { x: number; z: number };
  dispose(): void;
  /** Optional: subscribe to world events; returns an unsubscribe function. */
  on?(listener: (e: WorldEvent) => void): () => void;
  /** Optional: the highest walkable surface at (x, z) at or below y + 0.5 (stairs, walkways, roofs, else the ground). */
  floorAt?(x: number, y: number, z: number): number;
  /**
   * Optional: dress a game-layer MeshStandardMaterial for the street: the baked neon light volume as
   * indirect light, and rain wetness (darker, glossier, streaked). Replaces its onBeforeCompile. Safe in
   * viewScene too (no fog there, so it only keeps the standard shading).
   */
  wetten?(material: THREE.MeshStandardMaterial, wetness?: number): void;
  /** Optional: the last render's CPU time in ms, draw calls and triangles (for ?perf). */
  readonly perf?: { renderMs: number; drawCalls: number; triangles: number };
}

export type CreateWorld = (
  canvas: HTMLCanvasElement,
  options: WorldOptions,
  onProgress?: (share: number, label: string) => void,
) => Promise<World>;
