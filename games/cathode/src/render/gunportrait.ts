// Plan item 313: the class pick's weapon inspect, lit. The class's own gun mesh (the kit's display model, item 300's
// finishes) is shot on a black stage by the renderer the street already uses, into a small render target, once per
// angle of a slow turntable: a warm key from above the lens, a rim light in the class's colour from behind, a cool
// fill under it. The frames come back as image URLs, so the pick shows a lit 3D weapon without a second WebGL view
// (DECISIONS 2026-11-11 04:55 cut that: a second context on the pick costs more than it adds).
import * as THREE from "three";
import { buildGunDisplay, type GunModel } from "../game/viewmodel";

export interface GunTurntableOptions {
  /** Frames round the turn (one frame is the still three-quarter view). */
  frames: number;
  /** Each frame's size in device pixels. */
  width: number;
  height: number;
  /** The rim light's colour (linear RGB, the class's key). */
  rim: [number, number, number];
}

/** The still frame's angle: the kit's guns point down -z, so this turns one broadside with the muzzle to the left of
 * the frame, a little away from the lens (a three-quarter). */
export const GUN_STILL_YAW = Math.PI / 2 - 0.45;
/** How far the turntable sways each way from the still view: a whole turn passed through end-on views where a rifle
 * shrank to its muzzle. */
export const GUN_SWAY = 0.6;

/** The yaw of frame `i` of `n`: one slow sway each way, starting at the still three-quarter. */
export function turntableYaw(i: number, n: number): number {
  return GUN_STILL_YAW + (n <= 1 ? 0 : Math.sin((i / n) * Math.PI * 2) * GUN_SWAY);
}

/**
 * A small studio for one gun: `shoot(i)` renders frame `i` of the turn with `renderer` and returns its image URL
 * (webp where the browser encodes it), restoring the renderer's target and clear colour. Frames can be shot a few
 * at a time so a slow device never stalls on the whole turn. `dispose()` drops the render target.
 */
export class GunStudio {
  private readonly scene = new THREE.Scene();
  private readonly pivot = new THREE.Group();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly pixels: Uint8Array;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    model: GunModel,
    readonly o: GunTurntableOptions,
  ) {
    const gun = buildGunDisplay(model);
    this.pivot.add(gun);
    this.scene.add(this.pivot);
    // Centre the gun on the pivot and fit its longest side to the frame.
    const box = new THREE.Box3();
    gun.updateMatrixWorld(true);
    gun.traverseVisible((m) => {
      if ((m as THREE.Mesh).isMesh) box.expandByObject(m);
    });
    gun.position.sub(box.getCenter(new THREE.Vector3()));
    const size = box.getSize(new THREE.Vector3());
    const long = Math.max(size.x, size.y, size.z, 1e-3);
    const aspect = o.width / o.height;
    this.camera = new THREE.PerspectiveCamera(24, aspect, 0.01, 50);
    // Far enough that the longest side, broadside, fills about 86% of the frame's width (the gun turns no more than
    // GUN_SWAY off broadside, so it never grows past it).
    const halfW = Math.tan(THREE.MathUtils.degToRad(12)) * aspect;
    const dist = (long * 0.5) / (halfW * 0.86);
    this.camera.position.set(0, dist * 0.22, dist);
    this.camera.lookAt(0, 0, 0);

    const rimColour = new THREE.Color(o.rim[0], o.rim[1], o.rim[2]);
    const key = new THREE.DirectionalLight(0xfff1e0, 4.6);
    key.position.set(0.6, 1.4, 1.0);
    const rim = new THREE.DirectionalLight(rimColour, 4.5);
    rim.position.set(-0.8, 0.5, -1.2);
    const kick = new THREE.DirectionalLight(rimColour, 1.6);
    kick.position.set(1.2, 0.1, -0.6);
    const fill = new THREE.HemisphereLight(0x9aa8c0, 0x141418, 1.1);
    this.scene.add(key, rim, kick, fill);

    this.target = new THREE.WebGLRenderTarget(o.width, o.height, { samples: 4 });
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.pixels = new Uint8Array(o.width * o.height * 4);
    this.canvas = document.createElement("canvas");
    this.canvas.width = o.width;
    this.canvas.height = o.height;
    this.ctx = this.canvas.getContext("2d")!;
    this.image = this.ctx.createImageData(o.width, o.height);
  }

  shoot(i: number): string {
    const { renderer, o } = this;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    try {
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.setRenderTarget(this.target);
      this.pivot.rotation.y = turntableYaw(i, o.frames);
      renderer.render(this.scene, this.camera);
      renderer.readRenderTargetPixels(this.target, 0, 0, o.width, o.height, this.pixels);
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevClear, prevAlpha);
      renderer.autoClear = prevAutoClear;
    }
    // GL rows run bottom up.
    const row = o.width * 4;
    for (let y = 0; y < o.height; y++) this.image.data.set(this.pixels.subarray((o.height - 1 - y) * row, (o.height - y) * row), y * row);
    this.ctx.putImageData(this.image, 0, 0);
    const url = this.canvas.toDataURL("image/webp", 0.86);
    return url.startsWith("data:image/webp") ? url : this.canvas.toDataURL("image/png");
  }

  /** The kit's geometry and materials are shared with the world's guns: only the target is ours to drop. */
  dispose(): void {
    this.target.dispose();
  }
}

/** Plan item 313: a gun's turntable as it fills: `frames` grows to `total` one frame per animation frame. */
export interface GunReel {
  readonly total: number;
  readonly frames: string[];
}

const GUN_MODELS: ReadonlySet<string> = new Set<GunModel>(["pistol", "shotgun", "sniper", "revolver", "smg", "rifle", "launcher"]);
const reels = new Map<string, GunReel>();

/** The frames per turn and their size (device px; the case table shows them at 360x150 CSS px or more at D). */
export const GUN_REEL = { frames: 48, width: 720, height: 300 };
/** How long after a reel's first frame the rest start being shot (ms). */
const GUN_REEL_DELAY_MS = 1200;

/**
 * The reel for a weapon class lit by a class's key (cached: a class change back is instant). The first frame is shot
 * at once; with `still` (reduced motion, screenshots) it is the only one. The rest are shot from GUN_REEL_DELAY_MS on. null for a class with no gun model.
 */
export function gunReel(renderer: THREE.WebGLRenderer, weaponCls: string, rim: [number, number, number], still: boolean): GunReel | null {
  if (!GUN_MODELS.has(weaponCls)) return null;
  const total = still ? 1 : GUN_REEL.frames;
  const id = `${weaponCls}:${rim.join(",")}:${total}`;
  const had = reels.get(id);
  if (had) return had;
  const studio = new GunStudio(renderer, weaponCls as GunModel, { ...GUN_REEL, frames: GUN_REEL.frames, rim });
  const reel: GunReel = { total, frames: [studio.shoot(0)] };
  reels.set(id, reel);
  if (total <= 1) {
    studio.dispose();
    return reel;
  }
  // One frame per animation frame, starting after the class change's own audition has begun (a slow device keeps
  // its frame rate; the reel holds on frame 0 until the next frame is ready).
  const step = () => {
    reel.frames.push(studio.shoot(reel.frames.length));
    if (reel.frames.length < total) requestAnimationFrame(step);
    else studio.dispose();
  };
  setTimeout(() => requestAnimationFrame(step), GUN_REEL_DELAY_MS);
  return reel;
}
