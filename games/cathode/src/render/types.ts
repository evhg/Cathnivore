import type { FleshHit } from "./gore";
// The contract between the renderer (src/render/) and the game layer (src/game/). The renderer owns the
// scene, lighting, post-processing and effects; the game layer owns the camera's transform, the player,
// enemies and rules. Keep this file small and stable: both sides build against it.

import type { CoverMat } from "../sim/penetration";
import type { Obb, ShotCollider } from "./builder";
import type * as THREE from "three";

export type Quality = "phone" | "high" | "ultra";

export interface WorldOptions {
  quality: Quality;
  /** "full" or "reduced": reduced draws no blood, decals or gibs (hit sparks only). */
  intensity: "full" | "reduced";
  /** Screenshot mode: fixed time and seed, rain frozen mid-fall, so shots compare cleanly. */
  shot?: boolean;
  /** District id from the registry (render/levels); default "market". */
  district?: string;
}

/** What a bullet hit, for impact effects and sound. */
export type Surface = "concrete" | "metal" | "glass" | "water" | "wood" | "flesh" | "chrome";

export interface Effects {
  /** Particles alive right now (the S0 budget check). */
  readonly alive?: number;
  /** Drops every particle, decal, casing and flash light (screenshot stages start clean). */
  clear?(): void;
  /** A muzzle flash with a brief real light at `pos`, pointing along `dir`. */
  /** A muzzle flash; `suppressed` (the Kestrel, S2.3) is a small warm light with no white flash in the world. */
  muzzle(pos: THREE.Vector3, dir: THREE.Vector3, size?: number, suppressed?: boolean): void;
  /** A bullet impact on the world: dust or sparks or a splash by surface, plus a hole decal. */
  impact(pos: THREE.Vector3, normal: THREE.Vector3, surface: Surface, scale?: number): void;
  /** Blood from a wound, sprayed along `dir`; `amount` 0..1 scales droplets and the splatter decals. */
  blood(pos: THREE.Vector3, dir: THREE.Vector3, amount: number): void;
  /** A round in flesh (S4.5): entry puff, spurt, exit spray, wall splat and a wound on the segment. */
  flesh?(hit: FleshHit): void;
  /** Live gore counts against their caps (the soak test, the budget sidecar). */
  readonly gore?: {
    counts: { mist: number; drops: number; wounds: number; puffM: number };
    caps: { mist: number; drops: number; wounds: number };
    splats: readonly { point: THREE.Vector3; size: number }[];
    /** C9: pools under bodies at rest, the wall-slump smear and drips under the badly hurt. */
    pool(at: THREE.Vector3, R: number, seed: number, owner?: object): void;
    hasPool(owner: object): boolean;
    smear(top: THREE.Vector3, normal: THREE.Vector3): void;
    trail(at: THREE.Vector3): void;
    readonly pools: { readonly pools: readonly { at: THREE.Vector3; r: number; age: number }[]; age(s: number): void };
  };
  /** Sparks and coolant from a cyborg or machine hit. */
  sparks(pos: THREE.Vector3, dir: THREE.Vector3, amount: number): void;
  /**
   * C15 (S4.3): a round on a standing plate: 6-14 hot sparks (#FFD8A0 to #FF7A1A, 120-260 ms, 4-9 m/s) thrown off the
   * plate about its normal (+-35 degrees), a few paint chips, a pin of light. `amount` 0..1; `broke` throws more.
   */
  armourSparks?(pos: THREE.Vector3, normal: THREE.Vector3, dir: THREE.Vector3, amount: number, broke?: boolean): void;
  /** C15: a shattered visor: 12-20 amber-tinted glass shards flying off the face, falling, 1.2 s. */
  shards?(pos: THREE.Vector3, dir: THREE.Vector3, tint: THREE.Color): void;
  /** C15: a vented coolant pack: an 800 ms orange plume out of his back, hissing. */
  vent?(pos: THREE.Vector3, dir: THREE.Vector3): void;
  /** C7: Cath bleeding out leaves drops on the floor where she stands (S6.1: one every 1.2 m). */
  drip?(pos: THREE.Vector3): void;
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
  /** What each collider is made of, rotated props' oriented boxes, and shot-only cover (S1.1). */
  readonly cover?: { mats: CoverMat[]; obbs: (Obb | null)[]; thin: ShotCollider[] };
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
  /** One of the street's shared materials by key ("rust", "wood"...), for props added after the build. */
  material?(key: string): THREE.Material | undefined;
  /** How lit a point is, 0 (black) to 1 (under a lamp): stealth reads it. */
  lightAt(p: THREE.Vector3): number;
  /** The baked light's colour around a point (linear RGB): the viewmodel takes a share of it (C4). */
  ambientAt?(p: THREE.Vector3, out: THREE.Color): THREE.Color;
  /** The surface a world ray hit (for impacts), from the collider it struck. */
  surfaceAt(p: THREE.Vector3): Surface;
  /** Per-frame animation: rain, signs flickering, steam, effects. */
  /** `fxDt` runs the particles (a hit-stop freezes the sim but lets blood drift at a quarter speed). */
  update(dt: number, time: number, fxDt?: number): void;
  render(): void;
  /** Sheds work when the device is running hot (shadow refresh rate); optional so test worlds can skip it. */
  cool?(): void;
  /** `pixelRatio` is the canvas's (Cath's viewmodel and the post chain render at it); the world renders at
   * `pixelRatio * worldScale` (dynamic resolution). */
  resize(width: number, height: number, pixelRatio: number, worldScale?: number): void;
  /** Slow-motion/kill-cam grading: 0 normal, 1 full (desaturated, vignetted, depth of field). */
  setDrama(amount: number): void;
  /** C6/C7 Vitals grade (S6.4): `hurt` 0..1, the hit's side on screen (unit, +x right, +y up), `wound` w 0..1. */
  setVitals?(hurt: number, dirX: number, dirY: number, wound: number): void;
  /**
   * C7 (S6.3, S6.4): the wounded loop's screen. `pulse` the heartbeat 0..1, `regen` and `stim` the two washes,
   * `lens` the four lens-blood slots (sim/woundloop.ts LensSlot; age < 0 is empty) and the stim wipe's front.
   */
  setWounded?(o: { pulse: number; regen: number; stim: number; lens: ReadonlyArray<{ x: number; y: number; cell: number; age: number; size: number; rot?: number }>; wipe: number; water?: boolean; fx?: number; still?: boolean }): void;
  /**
   * C8 (S6.6): the death grade. `death` 0..1 (colour out, red in, edges closing), `ink` 0..1 (blood ink from the
   * edges; `grey` under reduced violence), `glitch` 0..1 (the re-sync), `ca` the edge CA multiplier (1..3).
   */
  /**
   * C17 (S6.5): Second Wind. `grey` 0..0.9 drains the world (flashes keep their colour); `outline` 0..1 draws a red
   * outline round each of `meshes` over the finished frame, through walls.
   */
  setSecondWind?(o: { grey: number; outline: number; meshes: Iterable<THREE.Mesh> }): void;
  /** C17 (S5.3): the kill-cam's whip-pan smear: (dx, dy) the pan's direction on screen, `k` 0..1. */
  setWhip?(dx: number, dy: number, k: number): void;
  /** C17: the bullet follow's heat haze round screen point (x, y) (UV, y up), radius `r` (screen heights), strength `k`. */
  setHaze?(x: number, y: number, r: number, k: number): void;
  /** C17: the kill-cam depth of field's focal point, in screen UV (0..1, y up); (0.5, 0.5) is the centre. */
  setFocus?(x: number, y: number): void;
  /** C14 (S9.7): the pause grade, 0..1. */
  setPause?(k: number): void;
  setDeath?(o: { death: number; ink: number; glitch: number; ca: number; grey?: boolean }): void;
  /** C7 acceptance: the grade pass's mean ms per draw with the Vitals pass idle or at its busiest. */
  benchGrade?(n: number, on: boolean | { wound: number; hurt: number; pulse: number; lens: number }): number;
  /** Wind for ballistics and rain, metres per second along x and z. */
  /** The district's walkable bounds, when it defines them (interiors). */
  readonly bounds?: { xMin: number; xMax: number; zMin: number; zMax: number };
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
  /**
   * Optional: a game-placed light (linear colour), shared out through the real-light pool so adding one
   * never changes the scene's light count (no shader recompile hitch). Returns its remover.
   */
  light?(pos: THREE.Vector3, color: THREE.Color, intensity: number, range: number): () => void;
  /** C14: like `light`, but the caller keeps the object and may change its colour and intensity every frame. */
  liveLight?(l: { pos: THREE.Vector3; color: THREE.Color; intensity: number; range: number }): () => void;
  /** Optional: the last render's CPU time in ms, draw calls and triangles (for ?perf). */
  readonly perf?: { renderMs: number; drawCalls: number; triangles: number };
}

export type CreateWorld = (
  canvas: HTMLCanvasElement,
  options: WorldOptions,
  onProgress?: (share: number, label: string) => void,
) => Promise<World>;
