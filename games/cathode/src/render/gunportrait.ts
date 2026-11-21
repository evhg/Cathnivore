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
  /** Plan item 588: the key's strength over the case table's (the rack's small guns need 3:1 on their dark rows). */
  exposure?: number;
  /** Plan item 588: the key's cone half-angle (radians): a pool on the case table, the whole gun on the rack. */
  pool?: number;
}

/**
 * Plan item 538: the studio's reflections, prefiltered once per renderer, so the steel's bevels and the barrel's
 * roundness catch light. Plan item 588: a noir product stage, not a grey room: black, with one long softbox strip
 * overhead, a narrow warm card to the lens's right and a faint cool floor bounce. The metal now mirrors a bright
 * strip against black (blued steel reads as polished and dark, not as one grey mass), and the polymer's coat shows
 * a single sheen line instead of a grey wash.
 */
const STUDIO_ENV_INTENSITY = 0.8;
const studioEnvs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
function studioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  let t = studioEnvs.get(renderer);
  if (!t) {
    const stage = new THREE.Scene();
    stage.background = new THREE.Color(0x000000);
    const card = (w: number, h: number, colour: number, k: number, p: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(colour).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...p);
      m.lookAt(0, 0, 0);
      stage.add(m);
      return m;
    };
    card(9, 1.4, 0xfff4e6, 5, [0, 4, 1.5]); // the softbox strip overhead, a little toward the lens
    card(1, 5, 0xffd2a0, 2.2, [4.5, 0.6, 2.5]); // the warm card, lens right
    card(10, 10, 0x6f7f9a, 0.12, [0, -4, 0]); // the floor's faint cool bounce
    const pm = new THREE.PMREMGenerator(renderer);
    t = pm.fromScene(stage, 0.02).texture;
    pm.dispose();
    for (const o of stage.children) {
      const m = o as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    studioEnvs.set(renderer, t);
  }
  return t;
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
    // Far enough that the gun's length, broadside, fills about 92% of the frame's width (the gun turns no more than
    // GUN_SWAY off broadside, so it never grows past it), and its height about 80% of the frame's (a revolver is
    // tall for its length: fitted by length alone its grip ran out of the frame). Its near half stands closer to the
    // lens, so the fits count from the near face.
    const halfH = Math.tan(THREE.MathUtils.degToRad(12));
    const halfW = halfH * aspect;
    const depth = Math.min(size.x, size.z) * 0.5;
    const dist = Math.max((long * 0.5) / (halfW * 0.92), (size.y * 0.5) / (halfH * 0.8)) + depth * 0.5;
    this.camera.position.set(0, dist * 0.22, dist);
    this.camera.lookAt(0, 0, 0);

    const rimColour = new THREE.Color(o.rim[0], o.rim[1], o.rim[2]);
    // Plan item 334: a harder key over a lower fill, so the lit and shadow faces part by 35%+ in lightness. Plan item
    // 588: the key is a spot that pools on the gun's middle and falls off toward the muzzle and the stock (a
    // directional lit every flat face one even grey: the stocks read as slabs), with a low fill so the falloff shows.
    // It hangs close over the gun with a physical (inverse-square) falloff, so even a small flat face (a grip, a
    // magazine) shades from its top down, as under a lamp a hand's width above the bench.
    const key = new THREE.SpotLight(0xfff1e0, 1, 0, o.pool ?? 0.52, 1, 2);
    key.position.set(long * 0.16, dist * 0.42, dist * 0.34);
    key.target.position.set(-long * 0.06, 0, 0);
    key.intensity = 26 * (o.exposure ?? 1) * key.position.distanceToSquared(key.target.position);
    this.scene.add(key.target);
    const rim = new THREE.DirectionalLight(rimColour, 7);
    rim.position.set(-0.8, 0.5, -1.2);
    const kick = new THREE.DirectionalLight(rimColour, 2.6);
    kick.position.set(1.2, 0.1, -0.6);
    const fill = new THREE.HemisphereLight(0x9aa8c0, 0x0a0a0c, 0.08);
    this.scene.add(key, rim, kick, fill);
    this.scene.environment = studioEnv(renderer);
    this.scene.environmentIntensity = STUDIO_ENV_INTENSITY;

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
/** Plan item 423: weapon classes drawn with another class's mesh (the Candor Seeker is an SMG with a brain: game/weapons.ts
 * gives it the smg model), so the Wirewitch's case table shows her gun, not a stencil. */
const MODEL_OF: Readonly<Record<string, GunModel>> = { smart: "smg" };
/** The display mesh for a weapon class, or null for one with none (melee). */
export function gunModelFor(weaponCls: string): GunModel | null {
  return GUN_MODELS.has(weaponCls) ? (weaponCls as GunModel) : MODEL_OF[weaponCls] ?? null;
}
const reels = new Map<string, GunReel>();

/** Plan item 313: the names' rack thumbnails: the same meshes at the still three-quarter, lit white (the rack's CSS
 * makes them monochrome and lights the picked one in the class's colour). */
export const GUN_ICON = { width: 300, height: 120 };
const icons = new Map<string, string>();
/** Plan item 588: the rack's thumbnails take a brighter key than the case table: under the pool's falloff their
 * median fell under 3:1 on the rack's dark rows (plan item 434's floor). */
const GUN_ICON_EXPOSURE = 1.8;

/** One still thumbnail of a weapon class's gun (cached), or null for a class with no gun model. Plan item 423: rimmed
 * in its class's key colour when one is given (white otherwise), so the rack's guns carry their class's light. */
export function gunIcon(renderer: THREE.WebGLRenderer, weaponCls: string, rim: [number, number, number] = [0.9, 0.92, 1]): string | null {
  const model = gunModelFor(weaponCls);
  if (!model) return null;
  const id = `${weaponCls}:${rim.join(",")}`;
  const had = icons.get(id);
  if (had) return had;
  const studio = new GunStudio(renderer, model, { ...GUN_ICON, frames: 1, rim, exposure: GUN_ICON_EXPOSURE, pool: 1.1 });
  const url = studio.shoot(0);
  studio.dispose();
  icons.set(id, url);
  return url;
}

/** The frames per turn and their size (device px; the case table shows them at 360x150 CSS px or more at D). */
export const GUN_REEL = { frames: 48, width: 720, height: 300 };
/** How long after a reel's first frame the rest start being shot (ms). */
const GUN_REEL_DELAY_MS = 1200;

/**
 * The reel for a weapon class lit by a class's key (cached: a class change back is instant). The first frame is shot
 * at once; with `still` (reduced motion, screenshots) it is the only one. The rest are shot from GUN_REEL_DELAY_MS on. null for a class with no gun model.
 */
export function gunReel(renderer: THREE.WebGLRenderer, weaponCls: string, rim: [number, number, number], still: boolean): GunReel | null {
  const model = gunModelFor(weaponCls);
  if (!model) return null;
  const total = still ? 1 : GUN_REEL.frames;
  const id = `${weaponCls}:${rim.join(",")}:${total}`;
  const had = reels.get(id);
  if (had) return had;
  const studio = new GunStudio(renderer, model, { ...GUN_REEL, frames: GUN_REEL.frames, rim });
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
