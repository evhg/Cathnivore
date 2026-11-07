// C13 (docs/design/cathode-combat.md S9.2, S9.4): the title's live scene. The Drowned Market, built by the same
// renderer the game uses (render/world.ts), with Cath standing at the north end of the street where the job starts,
// under her umbrella, lit from behind by a pink sign and filled cyan. The camera runs a 36 s Catmull-Rom loop
// through four framings around her at FOV 38, always behind or beside her (silhouette first), with her on the
// right third so the menu column has the left. Mouse or tilt parallax (±1.5 degrees yaw, ±1 pitch) through a
// 2 Hz spring, biased half a degree toward the focused menu row. Rain runs down the lens through the post chain's
// four lens slots in water mode (C7's uLens).
//
// Starting the game is a camera move (`push`): 1.6 s on a smootherstep spline past her right shoulder to the first
// person eye at the job's start. Then `handover` gives the world to the game session (Cath and the scene lights
// leave it; the street, its build and its shaders stay warm), so no second load runs for the market.

import { CATH_HERO } from "../game/armdress";
import * as THREE from "three";
import { createWorld } from "./world";
import { AutoScale } from "../game/autoscale";
import type { Quality, World } from "./types";
import { buildFrontCath, type FaceExpression, type FrontCath } from "./frontcath";
import { buildFrontNeon, NEON_H, NEON_W } from "./frontneon";

export interface FrontSceneOptions {
  quality: Quality;
  intensity: "full" | "reduced";
  /** Screenshot run: the clock only moves through `setTime`. */
  shot: boolean;
  /** Reduced motion: no dolly, no parallax, no lens rain sliding (a still framing). */
  still: boolean;
  /** Forced 3D render scale (?rs=). */
  renderScale: number;
  set: { signDark: boolean; tally: number };
  /** Plan item 203: the key-art shoot (`?keyart`): a poster light on Cath (a warm key on her coat and face, a cool rim). */
  keyart?: boolean;
  onProgress?: (share: number, label: string) => void;
}

export interface FrontScene {
  readonly world: World;
  readonly cath: FrontCath;
  /** The focused menu row, -1..1 from the middle (the camera leans half a degree toward it). */
  focusBias(v: number): void;
  /** Where she sits across the frame: 0 centre, 1 the right edge (default 0.42, the right third). */
  setFraming(k: number): void;
  /**
   * Plan item 148: on an upright phone's title, the free rectangle (CSS px in the canvas) her whole figure stands in,
   * from umbrella to shoes: above The List, at the right. null keeps the loop's own framing.
   */
  setStage(r: { left: number; top: number; right: number; bottom: number } | null): void;
  /**
   * Plan item 161: on a landscape class pick, the free rectangle (CSS px) between the class list and the stat sheet;
   * the wardrobe fits her whole figure, umbrella to shoes, centred in it. null keeps the wardrobe's own framing.
   */
  setPickStage(r: { left: number; top: number; right: number; bottom: number } | null): void;
  /** Plan item 24: 1 while the age gate is up on an upright phone (the lens aims low so she stands above the copy), 0 to ease back. */
  setLift(k: number): void;
  /**
   * C14 (S9.5): the wardrobe. A close three-quarter framing of her with a key light in the class's colour (400 ms),
   * and the class's 1.2 s idle. null goes back to the title loop. `instant` (screenshots) skips the eases.
   */
  wardrobe(cls: string | null, instant?: boolean): void;
  /** Plan item 136: the class audition playing now (its class and 0..1 through its 3 s), or null. */
  readonly vignette: { kind: string; u: number; prop: "rifle" | "shotgun" | null } | null;
  /** Plan item 180: the class stance she holds on the pick (its kind and blend weight, 1 when settled). */
  figurePose(): { kind: string | null; w: number; blendS: number; hand: [number, number, number] };
  /** Plan item 140: the expression painted on her face now. */
  readonly expression: FaceExpression;
  /** Plan item 112: the class whose look and idle she's showing (null on the title). */
  readonly dressed: string | null;
  /** The class kit she wears over the coat (null on the title). */
  readonly kit: string | null;
  /** Pointer or tilt, each -1..1. */
  parallax(x: number, y: number): void;
  /** Plan item 175: her idle loop now (breath, weight shift, umbrella sway, blinks). */
  readonly idle: FrontCath["idle"];
  /** Plan item 82: her projected box on screen, in CSS px (for the layout checks). */
  /** Her projected box; `body` leaves the umbrella out (plan item 159: what a menu plate must stay clear of). */
  figureBox(body?: boolean): { left: number; top: number; right: number; bottom: number };
  /** Plan item 258: the neon sign's projected box (its tubes), in CSS px. */
  neonBox(): { left: number; top: number; right: number; bottom: number };
  /** Plan item 117: her face's projected box (chin to crown, ear to ear), in CSS px. */
  faceBox(): { left: number; top: number; right: number; bottom: number };
  /** Plan item 247: the projected box of what she holds in her hands now (the rifle, the shotgun, the carried case),
   *  or null when her hands are empty, and how many of its projected vertices fall inside her face box (0: the prop
   *  stays off her face; a rifle held upright beside her cheek may share the face box's bounds but not its pixels). */
  propBox(): { left: number; top: number; right: number; bottom: number; inFace: number } | null;
  /** Plan item 205: the painted eyes' and cheeks' centres on screen, in CSS px (for the face's contrast check). */
  facePoints(): { eyes: Array<{ x: number; y: number }>; cheeks: Array<{ x: number; y: number }> };
  /** Loop time in seconds (screenshots; the live loop also advances it). */
  time: number;
  setTime(t: number): void;
  /** The push into the street; resolves when the camera is at the first-person eye. */
  push(seconds?: number): Promise<void>;
  /** Stops drawing (the last frame stays on the canvas behind the loading screen). */
  freeze(): void;
  /** Takes Cath and the scene's lights out and gives the world to the game. The scene stops for good. */
  handover(): World;
  dispose(): void;
  readonly stats: { frames: number; drawCalls: number; triangles: number; cathTriangles: number; ms: number };
}

const LOOP_S = 36;
const FOV = 38;
/** Cath stands 1.2 m north of the job's start, facing south down the street: the push passes her shoulder. */
const CATH_BACK = 1.2;
/** Plan items 148 and 258: how far past her the neon sign hangs (m). */
const NEON_BEHIND = 1.2;

/**
 * The four framings in Cath's frame (x her left, y up, z ahead of her), metres. Plan item 117: the face of every
 * game is seen from the front now, a three-quarter each side of her, knees to umbrella, close enough that her face
 * reads (120 px or more at 1440x900), all on her left: her right fist holds the umbrella's shaft, which crossed her
 * face from the right. Front left, her left side, nearly face on and high, front left high. The pink sign
 * ahead of her rims her and lights her face; the street she looks down is behind the lens. `look` is the point the
 * lens aims at; the camera then turns so she sits on the right third.
 */
/** Plan item 117: how far she turns to the lens on the title, radians (toward her left). */
const TITLE_TURN = 0.42;
const FRAMES: ReadonlyArray<{ pos: [number, number, number]; look: [number, number, number] }> = [
  { pos: [1.12, 1.48, 2.34], look: [0.05, 1.36, 0] },
  { pos: [2.02, 1.38, 1.64], look: [0, 1.34, 0] },
  { pos: [0.47, 1.62, 2.58], look: [0, 1.38, 0] },
  { pos: [1.55, 1.56, 2.16], look: [0, 1.34, 0] },
];

/**
 * The wardrobe framing (S9.5), in her frame: the title's framing brought in a step, a three-quarter from behind
 * her left shoulder, head to toe, the class's key light rimming her coat. The close front three-quarter (C14 slice
 * 2) put her unsculpted face and jointed limbs at the centre of every frame (C14 review); this one reads her by
 * silhouette, coat and umbrella, as the title does, until the figure is sculpted.
 */
// Plan item 42: now her face is sculpted (plan item 9), the wardrobe turns to her: a front three-quarter from
// knees up, so the class pick shows who's walking back in.
const WARDROBE = { pos: [1.05, 1.5, 2.45] as [number, number, number], look: [0.05, 1.28, 0] as [number, number, number] };
/** Each class's key light (linear RGB): Ghost cyan, Butcher blood, Gunslinger tungsten, Wirewitch violet, Fixer amber. */
const CLASS_KEY: Record<string, [number, number, number]> = {
  // The Ghost's cyan is pushed hard: at the same energy as the Butcher's red it read as neutral on her (C14 review).
  ghost: [0.18, 1.1, 1.8],
  butcher: [1.0, 0.04, 0.07],
  gunslinger: [1.0, 0.7, 0.36],
  wirewitch: [0.55, 0.18, 1.0],
  fixer: [1.0, 0.5, 0.1],
};
/**
 * Plan item 42: each class's coat in the pick (the outfit swap, 400 ms with the turn). The Ghost keeps her black
 * trench; the Butcher wears the olive field jacket, the Gunslinger the oxblood duster, the Wirewitch a waxed teal
 * mac, the Fixer midnight wool (the wardrobe's own coats, game/armdress.ts, where there is one).
 */
const CLASS_COAT: Record<string, number | null> = { ghost: null, butcher: 0x2f3324, gunslinger: 0x3a2018, wirewitch: 0x14282c, fixer: 0x171b2b };

const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/** Plan item 140: the face each class shows in the pick: the ghost and the butcher set, the wirewitch winks. */
const CLASS_EXPRESSION: Record<string, FaceExpression> = { ghost: "determined", butcher: "determined", gunslinger: "smirk", wirewitch: "wink", fixer: "smirk" };

export async function openFrontScene(canvas: HTMLCanvasElement, o: FrontSceneOptions): Promise<FrontScene> {
  const world = await createWorld(canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot }, o.onProgress);
  // Behind the menus the street can afford less: a half-resolution mirror, shadows every second frame (render/world.ts).
  world.calm?.(true);
  const phone = o.quality === "phone";
  const cam = world.camera;
  cam.fov = FOV;
  cam.near = 0.05;
  cam.updateProjectionMatrix();

  // ---- where she stands ----
  const start = world.markers.player?.[0]?.clone() ?? new THREE.Vector3(-2.5, 0, 57);
  const feet = new THREE.Vector3(start.x + 0.6, 0, start.z + CATH_BACK);
  feet.y = world.floorAt?.(feet.x, feet.y + 1, feet.z) ?? world.groundHeight(feet.x, feet.z);
  const cath = buildFrontCath(phone);
  cath.group.position.copy(feet);
  cath.group.rotation.y = Math.PI; // facing -z (south), the way the player starts
  world.scene.add(cath.group);
  world.renderer.domElement.dataset.expression = cath.expressionNow;
  // Plan item 205: her painted face's expression (the title's is the calm smirk).
  world.renderer.domElement.dataset.cathExpr = cath.expressionNow;
  // Plan item 147: the title's Cath is the full hero model (fingers, tailored trench, moving hair).
  world.renderer.domElement.dataset.cathLod = "hero";
  // Plan item 254: she is drawn as an inked illustration (toon bands and an ink line on her biggest parts).
  if (cath.inkParts > 0) world.renderer.domElement.dataset.cathShading = "ink";
  // Local frame -> world.
  const toWorld = (x: number, y: number, z: number, out = new THREE.Vector3()) => out.set(-x, y, -z).add(feet);
  // The back light: pink, high and ahead of her (the camera is always behind or beside her, so it rims her
  // silhouette and the umbrella's edge); a cool cyan fill from behind her right; a small warm kick on the coat.
  const removers: Array<() => void> = [];
  const rimLight = toWorld(0.4, 2.7, 2.2);
  // The pink is live: in the wardrobe (where the lens is in front of her) it steps back for the class's key.
  const pinkI = phone ? 9 : 10;
  const pink = { pos: toWorld(0.4, 2.7, 2.2), color: new THREE.Color(1.0, 0.09, 0.42), intensity: pinkI, range: 6 };
  const rimDir = new THREE.Vector3();
  // Plan item 148: the neon sign that is her key and rim; the pink lights stutter with its tubes.
  const neon = buildFrontNeon(phone);
  world.scene.add(neon.group);
  const neonRimI = phone ? 7 : 9;
  const neonRim = { pos: toWorld(-1.2, 1.8, -2.4), color: new THREE.Color(1.0, 0.09, 0.42), intensity: neonRimI, range: 5 };
  world.renderer.domElement.dataset.keyLight = "neon";
  if (world.light) {
    if (world.liveLight) removers.push(world.liveLight(pink));
    else removers.push(world.light(toWorld(0.4, 2.7, 2.2), new THREE.Color(1.0, 0.09, 0.42), pinkI, 6));
    removers.push(world.light(toWorld(-2.4, 1.9, -1.6), new THREE.Color(0.08, 0.62, 0.85), phone ? 3.5 : 4, 6));
    // Plan item 148: the neon blade behind her rims her from behind in its own pink.
    if (world.liveLight) removers.push(world.liveLight(neonRim));
    // Plan item 117: a soft face key, warm white, low and ahead of her left cheek, under the umbrella's edge, so
    // her face reads from the front (the pink sign alone left it a dark oval).
    removers.push(world.light(toWorld(0.5, 1.95, 0.85), new THREE.Color(1.0, 0.8, 0.72), 2.4, 1.9));
    // Plan item 203: the poster's light, for the key-art shoot only. A warm tungsten key low ahead of her left (the
    // lens's side) lifts the black trench off the street; a second, softer one at face height; a cool cyan rim from
    // behind her right parts her from the dark.
    if (o.keyart) {
      // Plan item 221: the key at 6.5 (20 polished the trench to chrome) and a small face key, so she reads as the
      // mum in the rain; the coat's lacquer is taken down to wool for the poster only.
      removers.push(world.light(toWorld(0.9, 1.2, 1.6), new THREE.Color(1.0, 0.72, 0.5), 6.5, 3.2));
      removers.push(world.light(toWorld(0.45, 1.68, 0.75), new THREE.Color(1.0, 0.82, 0.7), 3, 1.6));
      cath.group.traverse((obj) => {
        const mats = (obj as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          const pm = m as THREE.MeshPhysicalMaterial;
          if (!pm.isMeshPhysicalMaterial || pm.clearcoat < 0.5) continue;
          pm.clearcoat = 0.12;
          pm.clearcoatRoughness = 0.5;
          pm.roughness = Math.max(pm.roughness, 0.85);
        }
      });
      removers.push(world.light(toWorld(-0.9, 1.6, -0.9), new THREE.Color(0.2, 0.8, 1.0), 12, 3.2));
      world.renderer.domElement.dataset.keyart = "1";
    }
  }

  // ---- progress set pieces (S9.2): the egg shop's sign dark after the Fish Market, a chalk tally of the names ----
  {
    // Tomas Reed's TOMAS EGGS fascia on the west side, beside where she stands (aInfo.x is the sign's intensity, y
    // its flicker). On the title it is the hero landmark: held under clipping so its letters read (it blew out to
    // a white box), and after the Fish Market it goes out.
    const k = o.set.signDark ? 0.03 : 0.2;
    world.scene.traverse((obj) => {
      const g = (obj as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      const info = g?.attributes.aInfo as THREE.BufferAttribute | undefined;
      const pos = g?.attributes.position as THREE.BufferAttribute | undefined;
      if (!info || !pos) return;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        if (x < -7 && z > 45.4 && z < 55.1 && pos.getY(i) < 8) {
          info.setX(i, info.getX(i) * k);
          if (o.set.signDark) info.setY(i, 0);
        }
      }
      info.needsUpdate = true;
    });
  }
  const chalk: THREE.Object3D[] = [];
  if (o.set.tally > 0) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      g.strokeStyle = "rgba(235,232,224,0.85)";
      g.lineCap = "round";
      let x = 24;
      for (let i = 0; i < o.set.tally; i++) {
        g.lineWidth = 5 + (i % 2);
        g.beginPath();
        g.moveTo(x + (i % 3) * 2, 22);
        g.lineTo(x - 3 + (i % 2) * 4, 104);
        g.stroke();
        x += 26;
      }
      if (o.set.tally >= 5) {
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(12, 92);
        g.lineTo(x - 6, 34);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false, color: 0x8f8c86 }));
    plane.position.set(-9.84, 1.55, feet.z + 1.6);
    plane.rotation.y = Math.PI / 2;
    world.scene.add(plane);
    chalk.push(plane);
  }

  // ---- the camera loop ----
  const posCurve = new THREE.CatmullRomCurve3(
    FRAMES.map((f) => toWorld(...f.pos)),
    true,
    "centripetal",
  );
  const lookCurve = new THREE.CatmullRomCurve3(
    FRAMES.map((f) => toWorld(...f.look)),
    true,
    "centripetal",
  );
  const p = new THREE.Vector3();
  const l = new THREE.Vector3();
  // Parallax springs (2 Hz, critically damped).
  const spring = { x: 0, vx: 0, y: 0, vy: 0, tx: 0, ty: 0, bias: 0, tb: 0, vb: 0 };
  const W = 2 * Math.PI * 2;
  let time = 0;
  let framing = 0.42;
  let lift = 0;
  let liftWant = 0;
  let pushT = -1;
  let pushDur = 1.6;
  let pushDone: (() => void) | null = null;
  const pushFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const eye = new THREE.Vector3(start.x, (world.floorAt?.(start.x, start.y + 1, start.z) ?? start.y) + 1.62, start.z);
  const pushCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, "centripetal");
  const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0, "YXZ"));
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const up = new THREE.Vector3(0, 1, 0);

  // ---- the wardrobe (C14): its framing blends over the loop; its key light changes colour over 400 ms ----
  const wd = { w: 0, target: 0, cls: null as string | null, turn: 0, flash: 0, cut: 0, cutCls: "ghost" };
  /**
   * Plan item 136: a class change is a 3 s audition. The lens cuts to the class's own angle (closer, and from below,
   * above or the side: the Ghost low and tight, the Butcher from under her fist, the Gunslinger squared off from her
   * left, the Wirewitch from above her rig, the Fixer from her right), holds through the pose, then eases home over
   * the last 0.7 s. [push toward her as a fraction of the distance, rise in m, step sideways in m]
   */
  const VIGNETTE_S = 3;
  const CUT_EASE_S = 0.7;
  const CUT: Record<string, [number, number, number]> = {
    ghost: [0.16, -0.1, 0.06],
    butcher: [0.1, -0.22, -0.08],
    gunslinger: [0.08, -0.04, 0.24],
    wirewitch: [0.14, 0.16, -0.05],
    fixer: [0.12, 0.04, -0.22],
  };
  const side = new THREE.Vector3();
  /** Plan item 129: a class change flashes her key (its 250 ms dolly became item 136's cut). */
  const FLASH_S = 0.32;
  /** Plan item 42: a change of class turns her out and back to the lens over 400 ms (none under reduced motion). */
  const TURN_S = 0.4;
  const wPos = toWorld(...WARDROBE.pos);
  const wLook = toWorld(...WARDROBE.look);
  const key = { pos: toWorld(1.35, 1.8, 1.15), color: new THREE.Color(0, 0, 0), intensity: 0, range: 7 };
  const keyWant = new THREE.Color(0, 0, 0);
  const coatBase = new THREE.Color(CATH_HERO.trench);
  const coatNow = coatBase.clone();
  const coatWant = coatBase.clone();
  let keyRemove: (() => void) | null = null;
  // Plan item 247: a warm face key for the pick, high on the side away from the lens and just ahead of her (short lighting), so her cheek,
  // brow and jaw take a shadow side instead of reading as one flat lit oval. Short range: it lights her head
  // and collar only, not the coat (the class key colours that).
  // Plan item 247, slice 3: at 3.8 it washed her face to a pale, flat white at high quality; softer and warmer, her
  // skin keeps its colour and the shadow side its modelling.
  const faceKey = { pos: toWorld(-0.38, 1.95, 0.5), color: new THREE.Color(1.0, 0.72, 0.52), intensity: 0, range: 1.25 };
  let faceKeyRemove: (() => void) | null = null;
  function wardrobeStep(dt: number): void {
    const k = 1 - Math.exp(-dt * 4.2);
    wd.w += (wd.target - wd.w) * k;
    if (Math.abs(wd.target - wd.w) < 0.001) wd.w = wd.target;
    // About 400 ms to the new colour.
    key.color.lerp(keyWant, 1 - Math.exp(-dt * 9));
    // Plan item 129: the kit-on flash, the key light at 2.6x the moment the kit goes on, easing back over 320 ms.
    if (wd.flash > 0) wd.flash = Math.max(0, wd.flash - dt);
    const flash = wd.flash > 0 ? 1.6 * Math.pow(wd.flash / FLASH_S, 2) : 0;
    key.intensity = (phone ? 7 : 9) * wd.w * (1 + flash);
    let yaw = Math.PI;
    if (wd.turn > 0) {
      wd.turn = Math.max(0, wd.turn - dt);
      const u = 1 - wd.turn / TURN_S;
      yaw = Math.PI + 0.6 * Math.sin(Math.PI * u) * (1 - u * 0.15);
    }
    // Plan item 117: on the title she turns a little to the lens (which is always on her left there), so her face
    // is three-quarter, not profile; the wardrobe keeps her square to its own framing.
    cath.group.rotation.y = yaw + TITLE_TURN * (1 - smoother(Math.min(1, wd.w)));
    // The coat eases to the class's cloth over the same 400 ms as the key.
    coatNow.lerp(coatWant, 1 - Math.exp(-dt * 9));
    // Back at the black trench, the model's own cloth (the phone's is a shade lighter) takes over again.
    const home = coatWant.equals(coatBase) && Math.abs(coatNow.r - coatBase.r) + Math.abs(coatNow.g - coatBase.g) + Math.abs(coatNow.b - coatBase.b) < 0.002;
    cath.coat(home ? null : coatNow);
    const lit = neon.level(time, o.still);
    pink.intensity = pinkI * (1 - 0.78 * wd.w) * (0.35 + 0.65 * lit);
    neonRim.intensity = neonRimI * (1 - 0.6 * wd.w) * lit;
    cath.tint(key.color, Math.min(1, 0.6 * wd.w * (1 + 0.5 * flash)));
    faceKey.intensity = (phone ? 2.0 : 2.2) * wd.w;
    if (wd.w > 0.002 && !keyRemove && world.liveLight) {
      keyRemove = world.liveLight(key);
      faceKeyRemove = world.liveLight(faceKey);
    }
    if (wd.w <= 0.002 && keyRemove) {
      faceKeyRemove?.();
      faceKeyRemove = null;
      keyRemove();
      keyRemove = null;
    }
  }

  // ---- plan item 148: the upright phone's title frames her whole, inside the stage the menus leave ----
  let stage: { left: number; top: number; right: number; bottom: number } | null = null;
  let pickStage: { left: number; top: number; right: number; bottom: number } | null = null;
  // A sparse cloud of her posed figure in her own frame (every 7th vertex), so the fit costs a few hundred
  // projections; re-sampled every 20 fits as her idle moves.
  // Plan item 161: the class pick fits her body, head to shoes, without the umbrella (its canopy may crop at the
  // top), so her face keeps item 129's size while she stands whole.
  const allCloud: THREE.Vector3[] = [];
  const bodyCloud: THREE.Vector3[] = [];
  let cloud = allCloud;
  let cloudAge = Infinity;
  let cloudBody = false;
  function sampleCloud(): void {
    cloud = cloudBody ? bodyCloud : allCloud;
    cloud.length = 0;
    cath.group.updateMatrixWorld(true);
    const inv = cath.group.matrixWorld.clone().invert();
    const mm = new THREE.Matrix4();
    const skip = new Set<THREE.Object3D>();
    if (cloudBody) cath.umbrellaTop.parent?.traverse((o) => skip.add(o));
    // Plan item 251: on the title, only what is drawn. The other classes' kits hang hidden on her (a hidden group,
    // visible meshes), and the Fixer's case and the Butcher's extras widened her box, so the title framed her left,
    // under the menu. The class pick (centred) keeps measuring every kit: its framings were tuned on that box.
    const walk = cloudBody ? cath.group.traverse.bind(cath.group) : cath.group.traverseVisible.bind(cath.group);
    walk((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh || !m.visible || skip.has(m)) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
      if (!pos) return;
      mm.multiplyMatrices(inv, m.matrixWorld);
      // Small parts (a splash quad, a ring) keep every vertex: one sample of four corners misses its edge.
      const step = pos.count < 64 ? 1 : 7;
      for (let i = 0; i < pos.count; i += step) cloud.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mm));
    });
    cloudAge = 0;
  }
  const fitPos = new THREE.Vector3();
  const fitQuat = new THREE.Quaternion();
  const fitV = new THREE.Vector3();
  const fitDir = new THREE.Vector3();
  const fitAim = new THREE.Vector3();
  const keepPos = new THREE.Vector3();
  const keepQuat = new THREE.Quaternion();
  function cloudBox(): { l: number; r: number; t: number; b: number } {
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    cath.group.updateMatrixWorld();
    let l = Infinity, r = -Infinity, t = -Infinity, b = Infinity;
    for (const c of cloud) {
      fitV.copy(c).applyMatrix4(cath.group.matrixWorld).project(cam);
      l = Math.min(l, fitV.x);
      r = Math.max(r, fitV.x);
      t = Math.max(t, fitV.y);
      b = Math.min(b, fitV.y);
    }
    return { l, r, t, b };
  }
  /**
   * Puts the camera where her figure's box fills the stage's height, right-aligned in it (NDC from the CSS rect).
   * Centred (plan item 161, the class pick's stage between its columns), the box fits both ways and sits in the middle.
   */
  function fitStage(from: THREE.Vector3, s = stage!, centred = false): void {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    if (cloudBody !== centred) {
      cloudBody = centred;
      cloudAge = Infinity;
    }
    if (cloudAge++ >= 20) sampleCloud();
    const nt = 1 - (2 * s.top) / h, nb = 1 - (2 * s.bottom) / h, nr = (2 * s.right) / w - 1, nl = (2 * s.left) / w - 1;
    const hv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const hh = hv * cam.aspect;
    // The lens keeps the loop's bearing round her, a little below her waist, looking level at her middle.
    fitDir.subVectors(from, feet).setY(0).normalize();
    fitAim.set(feet.x, feet.y + 1.05, feet.z);
    // Converge: place, turn by the angles so far, measure, then correct the distance and the angles.
    let d = 4;
    let yaw = 0;
    let pitch = 0;
    for (let pass = 0; pass < 4; pass++) {
      cam.position.copy(fitAim).addScaledVector(fitDir, d);
      cam.position.y = feet.y + 0.95;
      m4.lookAt(cam.position, fitAim, up);
      cam.quaternion.setFromRotationMatrix(m4);
      cam.rotateY(yaw);
      cam.rotateX(pitch);
      const bx = cloudBox();
      if (pass === 3) break;
      d *= centred ? Math.max((bx.t - bx.b) / (nt - nb), (bx.r - bx.l) / (nr - nl)) : (bx.t - bx.b) / (nt - nb);
      // Turn and tilt so the box's middle lands on the stage's (its right edge on the stage's right).
      const half = (bx.r - bx.l) / 2;
      const tx = centred ? (nl + nr) / 2 : Math.max(nl + half, nr - half);
      const ty = (nt + nb) / 2;
      yaw += Math.atan(hh * tx) - Math.atan(hh * ((bx.l + bx.r) / 2));
      pitch -= Math.atan(hv * ty) - Math.atan(hv * ((bx.t + bx.b) / 2));
    }
    fitPos.copy(cam.position);
    fitQuat.copy(cam.quaternion);
  }

  // Plan item 258: the sign hangs in the street behind her but is placed on screen, in the widest clear space
  // beside her figure for the screen she's on (right of her on the desktop title and pick, under the menu on the
  // upright title, beside her on the upright pick), sized to that space, and eased there so it never jumps.
  // (Item 148 hung it behind her head upright, where its tubes caged her face.)
  const neonTubes = neon.group.getObjectByName("front-neon-tubes") as THREE.Mesh;
  // Her projected vertices (CSS px), resampled every 0.2 s; the sign keeps clear of her within its own band.
  const herPts: number[] = [];
  let herAge = Infinity;
  const neonNow = { x: 0, y: 0, s: 0, set: false };
  const neonDir = new THREE.Vector3();
  const neonFwd = new THREE.Vector3();
  const neonFace = new THREE.Vector3();
  function measureHer(w: number, h: number): void {
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    cath.group.updateMatrixWorld(true);
    herPts.length = 0;
    cath.group.traverseVisible((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
      if (!pos) return;
      const step = pos.count < 64 ? 1 : 17;
      for (let i = 0; i < pos.count; i += step) {
        fitV.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam);
        if (fitV.z > 1) continue;
        herPts.push(((fitV.x + 1) / 2) * w, ((1 - fitV.y) / 2) * h);
      }
    });
    herAge = 0;
  }
  /** Her left and right edges (CSS px) between two heights. */
  function herSpan(y0: number, y1: number): { l: number; r: number } {
    let l = Infinity, r = -Infinity;
    for (let i = 0; i < herPts.length; i += 2) {
      const y = herPts[i + 1]!;
      if (y < y0 || y > y1) continue;
      l = Math.min(l, herPts[i]!);
      r = Math.max(r, herPts[i]!);
    }
    return { l, r };
  }
  function placeNeon(dt: number): void {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    herAge += dt;
    if (herAge > 0.2 || o.still || dt === 0) measureHer(w, h);
    const pick = wd.w > 0.5;
    const upright = cam.aspect < 1;
    const gap = 0.012 * w;
    // The band for this screen, then the clear space beside her in it.
    const [y0, y1] = !upright ? (pick ? [0.2 * h, 0.48 * h] : [0.13 * h, 0.5 * h]) : pick ? [0.1 * h, 0.5 * h] : [0.555 * h, 0.715 * h];
    const her = herSpan(y0, y1);
    const lo = !upright && pick && pickStage ? pickStage.left + gap : 0.04 * w;
    const hi = !upright && pick && pickStage ? pickStage.right - gap : 0.97 * w;
    const right: [number, number] = [Math.max(lo, her.r + gap), hi];
    const left: [number, number] = [lo, Math.min(hi, her.l - gap)];
    // The title's menu is left of her: on the desktop the sign takes her right; upright, the space under the menu,
    // left of her. The pick takes the wider side.
    const [x0, x1] = !pick ? (upright ? left : right) : right[1] - right[0] >= left[1] - left[0] ? right : left;
    const aspect = NEON_W / NEON_H;
    const sw = Math.max(48, Math.min(x1 - x0, (y1 - y0) * aspect, 0.2 * Math.max(w, h)));
    const tx = (x0 + x1) / 2, ty = (y0 + y1) / 2;
    const k = !neonNow.set || o.still || dt === 0 ? 1 : 1 - Math.exp(-dt / 0.35);
    neonNow.x += (tx - neonNow.x) * k;
    neonNow.y += (ty - neonNow.y) * k;
    neonNow.s += (sw - neonNow.s) * k;
    neonNow.set = true;
    // Through that pixel, a few metres past her.
    neonDir.set((neonNow.x / w) * 2 - 1, 1 - (neonNow.y / h) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    cam.getWorldDirection(neonFwd);
    const dist = cam.position.distanceTo(feet) + NEON_BEHIND;
    neon.group.position.copy(cam.position).addScaledVector(neonDir, dist);
    const depth = dist * neonDir.dot(neonFwd);
    const perPx = (2 * depth * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / h;
    neon.group.scale.setScalar((neonNow.s * perPx) / NEON_W);
    neonFace.set(cam.position.x, neon.group.position.y, cam.position.z);
    neon.group.lookAt(neonFace);
    neon.group.updateMatrixWorld(true);
  }

  let idleS = 0;
  let idleK = 0;
  const idleHead = new THREE.Vector3();
  const idleReduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function aim(t: number, dt: number): void {
    const u = (((t / LOOP_S) % 1) + 1) % 1;
    posCurve.getPointAt(u, p);
    lookCurve.getPointAt(u, l);
    // The gate on an upright phone: the copy fills the lower half, so the lens aims low and steps back to lift
    // her into the upper window; accepting eases it back into the title's framing in one move.
    lift += (liftWant - lift) * (o.still || dt === 0 ? 1 : 1 - Math.exp(-dt * 1.6));
    if (lift > 0.001 && cam.aspect < 1) {
      const e = smoother(Math.min(1, lift));
      l.y -= 1.1 * e;
      p.sub(l).multiplyScalar(1 + 0.3 * e).add(l);
    }
    if (wd.w > 0) {
      const e = smoother(Math.min(1, wd.w));
      p.lerp(wPos, e);
      l.lerp(wLook, e);
      // A phone held upright: the copy takes the lower half on a dark band, so the lens aims low and lifts her
      // (head to waist) into the upper window, from a step further back.
      if (cam.aspect < 1) {
        l.y -= 0.15 * e;
        p.sub(l).multiplyScalar(1 + 0.35 * e).add(l);
      }
      // Plan item 136: the audition's cut, held, then eased home.
      if (wd.cut > 0) {
        wd.cut = Math.max(0, wd.cut - dt);
        const c = CUT[wd.cutCls] ?? CUT.ghost!;
        const k = smoother(Math.min(1, wd.cut / CUT_EASE_S)) * e;
        side.subVectors(l, p).cross(up).normalize();
        p.lerp(l, c[0] * k);
        p.y += c[1] * k;
        p.addScaledVector(side, c[2] * k);
      }
    }
    // Plan item 82: ...and the lens aims higher there, so she stands in the lower half under the menu.
    if (cam.aspect < 1) {
      const e = (1 - smoother(Math.min(1, lift))) * (1 - smoother(Math.min(1, wd.w)));
      l.y += 0.7 * e;
      p.sub(l).multiplyScalar(1 + 0.3 * e).add(l);
    }
    cam.position.copy(p);
    m4.lookAt(p, l, up);
    cam.quaternion.setFromRotationMatrix(m4);
    // Her on the right third: turn the lens left by the angle that puts her at 0.3 of the half-width.
    const aspect = Math.max(0.5, cam.aspect);
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect);
    // Plan item 82: on an upright phone's title she stands in the right half, below the menu (she was centred
    // behind it); the age gate's lift and the wardrobe keep their own framing.
    const upright = cam.aspect < 1 ? 1 - smoother(Math.min(1, lift)) : 0;
    const fr = (aspect < 1.2 ? 0.12 + 0.5 * upright : framing) * (1 - smoother(Math.min(1, wd.w)));
    cam.rotateY(Math.atan(Math.tan(half) * fr));
    // Plan item 148: the upright title fits her whole into the stage instead (blended out by the gate's lift and
    // the wardrobe, which keep their own framings).
    const fitK = stage && cam.aspect < 1 ? upright * (1 - smoother(Math.min(1, wd.w))) : 0;
    if (fitK > 0.001) {
      keepPos.copy(cam.position);
      keepQuat.copy(cam.quaternion);
      fitStage(p);
      cam.position.copy(keepPos).lerp(fitPos, fitK);
      cam.quaternion.copy(keepQuat).slerp(fitQuat, fitK);
    }
    // Plan item 161: a landscape class pick stands her whole between the list and the sheet, key-lit, centred.
    const pickK = pickStage && cam.aspect >= 1 ? smoother(Math.min(1, wd.w)) : 0;
    if (pickK > 0.001) {
      keepPos.copy(cam.position);
      keepQuat.copy(cam.quaternion);
      fitStage(p, pickStage!, true);
      cam.position.copy(keepPos).lerp(fitPos, pickK);
      cam.quaternion.copy(keepQuat).slerp(fitQuat, pickK);
    }
    // Plan item 187: left alone on the title for 6 s, the lens dollies slowly in along its line to her head (so her
    // head keeps its place on screen) toward waist-up; any input eases it back. None under reduced motion.
    const titleK = (1 - smoother(Math.min(1, lift))) * (1 - smoother(Math.min(1, wd.w))) * (pickStage || pushT >= 0 ? 0 : 1);
    idleS = titleK > 0.5 ? idleS + dt : 0;
    const idleWant = idleReduce || o.still ? 0 : smoother(THREE.MathUtils.clamp((idleS - 6) / 8, 0, 1));
    idleK += (idleWant - idleK) * (idleWant < idleK ? 1 - Math.exp(-dt / 0.25) : 1);
    if (idleK * titleK > 0.001) {
      // Upright, her face sits just under the title's line with the menu beside it, so the lens dollies toward
      // her crown instead: the top of her head keeps its place and the face grows down and out, clear of both.
      const upr = cam.aspect < 1;
      idleHead.set(0, upr ? 0.12 : 0, upr ? 0.04 : 0).applyMatrix4(cath.head.matrixWorld);
      const g = 1 + (upr ? 0.3 : 0.45) * idleK * titleK;
      cam.position.sub(idleHead).divideScalar(g).add(idleHead);
    }
    canvas.dataset.idlePush = (idleK * titleK).toFixed(2);
    if (!o.still) {
      const k = Math.min(dt, 1 / 20);
      spring.vx += (W * W * (spring.tx - spring.x) - 2 * W * spring.vx) * k;
      spring.x += spring.vx * k;
      spring.vy += (W * W * (spring.ty - spring.y) - 2 * W * spring.vy) * k;
      spring.y += spring.vy * k;
      spring.vb += (W * W * (spring.tb - spring.bias) - 2 * W * spring.vb) * k;
      spring.bias += spring.vb * k;
      cam.rotateY(THREE.MathUtils.degToRad(-1.5 * spring.x));
      cam.rotateX(THREE.MathUtils.degToRad(-1 * spring.y - 0.5 * spring.bias));
    }
    placeNeon(dt);
  }

  // ---- rain on the lens: the four lens slots in water mode, each drop sliding then fading ----
  const LENS = [
    { x: 0.78, y: 0.7, cell: 0, phase: 0.0, size: 0.8, rot: 0.3 },
    { x: 0.22, y: 0.36, cell: 1, phase: 0.45, size: 0.65, rot: 1.9 },
    { x: 0.6, y: 0.2, cell: 2, phase: 0.2, size: 0.7, rot: 4.1 },
    { x: 0.9, y: 0.32, cell: 3, phase: 0.7, size: 0.55, rot: 2.6 },
  ];
  const lensOut = LENS.map((s) => ({ x: s.x, y: s.y, cell: s.cell, age: -1, size: s.size, rot: s.rot }));
  function lens(t: number): void {
    if (!world.setWounded) return;
    const cycle = 2.6;
    LENS.forEach((s, i) => {
      const c = (t / cycle + s.phase + i * 0.13) % 1.6;
      const out = lensOut[i]!;
      out.age = c < 1 ? c * 1.6 : -1;
      // Each time a drop comes back it lands somewhere new.
      const n = Math.floor((t / cycle + s.phase + i * 0.13) / 1.6);
      out.x = (s.x + n * 0.317) % 1;
      out.y = 0.15 + ((s.y + n * 0.211) % 0.75);
      if (o.still) out.age = 0.6;
    });
    world.setWounded({ pulse: 0, regen: 0, stim: 0, wipe: -1, water: true, lens: lensOut, still: o.still });
  }

  // ---- the loop ----
  const stats = { frames: 0, drawCalls: 0, triangles: 0, cathTriangles: cath.triangles, ms: 0 };
  let running = true;
  let frozen = false;
  let last = performance.now();
  let raf = 0;
  let acc = 0;
  let since = 0;
  // Phones hold 30 fps, desktops 60 (S9.2 cost: a 144 Hz 5K panel must not draw the title 144 times a second).
  // Automated runs draw once every 3 s: software WebGL stalls the main thread for seconds a frame, and every key,
  // timer and axe pass in the front door would wait behind it.
  const frameMin = typeof navigator !== "undefined" && navigator.webdriver ? 3 : phone ? 1 / 30 : 1 / 60;
  // Dynamic resolution on the title too (owner, 2026-11-02: the umbrella scene was "very stuttery" on an M3 Max):
  // when frames run long the street renders a little smaller, so the 60 fps cap holds evenly instead of dropping
  // frames. Off in screenshot and automated runs, where every frame is slow.
  const dyn = new AutoScale({ min: 0.6, max: 1, target: 1000 / 60, slowMs: 18, fastMs: 12 });
  const dynOn = !o.shot && !(typeof navigator !== "undefined" && navigator.webdriver);
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    // The 3D DPR caps at 1.5 at 5K (S8). Plan item 216: a phone's front door renders at the device's ratio, capped
    // at 2 (at 1.35 with a 0.75 world her face went soft at 390 px); the world there runs at 0.85 of it (S9.2
    // cost) and the dynamic scale takes it down further when frames run long.
    const cap = phone ? 2 : innerHeight * devicePixelRatio > 2000 ? 1.5 : 2;
    const dpr = Math.min(devicePixelRatio, cap);
    const scale = (phone ? 0.85 : 1) * o.renderScale * dyn.scale;
    world.resize(w, h, dpr, Math.min(1, scale));
    cam.fov = FOV;
    cam.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  function frame(dt: number): void {
    const t0 = performance.now();
    if (pushT >= 0) {
      pushT += dt;
      const u = smoother(Math.min(1, pushT / pushDur));
      pushCurve.getPoint(u, cam.position);
      q.copy(pushFrom.quat).slerp(endQuat, smoother(Math.min(1, pushT / (pushDur * 0.85))));
      cam.quaternion.copy(q);
      cam.fov = FOV + (75 - FOV) * u;
      cam.updateProjectionMatrix();
      if (pushT >= pushDur && pushDone) {
        const d = pushDone;
        pushDone = null;
        d();
      }
    } else {
      wardrobeStep(dt);
      aim(time, dt);
    }
    cath.update(dt, time, world.wind);
    // The rain round the sign dims as the wardrobe's class key takes over.
    neon.update(time, o.still, cam, 1 - 0.7 * wd.w);
    // The rim follows the back light as the camera moves round her.
    cam.updateMatrixWorld();
    rimDir.copy(rimLight).sub(cam.position).normalize().transformDirection(cam.matrixWorldInverse);
    cath.setRim(rimDir);
    lens(time);
    world.update(dt, time);
    world.render();
    stats.frames++;
    stats.ms = performance.now() - t0;
    if (world.perf) {
      stats.drawCalls = world.perf.drawCalls;
      stats.triangles = world.perf.triangles;
    }
  }

  const loop = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (frozen) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (o.shot) return;
    acc += dt;
    since += dt;
    if (acc < frameMin - 0.002) return;
    // Keep the remainder at the 60 fps cap so a 144 Hz panel paces evenly (2 or 3 vsyncs a frame, 60 on average).
    acc = frameMin < 0.05 ? Math.max(0, Math.min(acc - frameMin, frameMin)) : 0;
    const step = since;
    since = 0;
    time += o.still ? 0 : step;
    // At the 60 fps cap a frame on time is ~16.7 ms apart; a longer gap means the GPU missed one.
    if (dynOn && dyn.frame(step * 1000) !== null) resize();
    frame(step);
  };
  // Every shader the frame needs compiles in the background first (render/warm.ts): drawing the first frame
  // straight away compiled ~80 programs on the main thread and froze the page for seconds.
  aim(0, 0);
  // Plan item 136: the class kits compile here too, not on her first change of class.
  cath.showAllKits(true);
  try {
    await world.warm?.();
  } finally {
    cath.showAllKits(false);
  }
  // The first frame now, so the canvas never shows black once the scene is ready.
  frame(1 / 60);
  // Plan item 175: the blink's shut-eyed face uploads now, with the first frame's textures, not on her first blink.
  world.renderer.initTexture(cath.blinkMap);
  raf = requestAnimationFrame(loop);

  const corner = new THREE.Vector3();
  const scene: FrontScene = {
    world,
    cath,
    stats,
    neonBox() {
      const r = world.renderer.domElement.getBoundingClientRect();
      neonTubes.geometry.computeBoundingBox();
      const bb = neonTubes.geometry.boundingBox!;
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
        corner.applyMatrix4(neonTubes.matrixWorld).project(cam);
        const x = r.left + ((corner.x + 1) / 2) * r.width;
        const y = r.top + ((1 - corner.y) / 2) * r.height;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
      return { left, top, right, bottom };
    },
    figureBox(body = false) {
      // Every vertex of her (and her umbrella), projected: a box hugging what is drawn, not her 3D bounds.
      const r = world.renderer.domElement.getBoundingClientRect();
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      cath.group.updateMatrixWorld(true);
      const skip = new Set<THREE.Object3D>();
      if (body) cath.umbrellaTop.parent?.traverse((o) => skip.add(o));
      cath.group.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible || skip.has(m)) return;
        const pos = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
        if (!pos) return;
        for (let i = 0; i < pos.count; i += 3) {
          corner.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam);
          const x = r.left + ((corner.x + 1) / 2) * r.width;
          const y = r.top + ((1 - corner.y) / 2) * r.height;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      });
      return { left, top, right, bottom };
    },
    propBox() {
      const r = world.renderer.domElement.getBoundingClientRect();
      const f = scene.faceBox();
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, inFace = 0;
      cath.group.updateMatrixWorld(true);
      const held = (o: THREE.Object3D | null): boolean => {
        for (; o; o = o.parent) {
          if (!o.visible) return false;
          if (o.name === "prop-rifle" || o.name === "prop-shotgun" || o.name === "kit-fixer-case-carried") return true;
        }
        return false;
      };
      cath.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !held(m)) return;
        const pos = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          corner.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam);
          const x = r.left + ((corner.x + 1) / 2) * r.width;
          const y = r.top + ((1 - corner.y) / 2) * r.height;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          if (x > f.left && x < f.right && y > f.top && y < f.bottom) inFace++;
        }
      });
      return left === Infinity ? null : { left, top, right, bottom, inFace };
    },
    faceBox() {
      const r = world.renderer.domElement.getBoundingClientRect();
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      cath.group.updateMatrixWorld(true);
      // The skull is 0.072 x 0.098 x 0.088 m round the head's origin; the hair adds a little at the crown.
      for (const x of [-0.08, 0.08]) for (const y of [-0.1, 0.12]) for (const z of [-0.02, 0.1]) {
        corner.set(x, y, z).applyMatrix4(cath.head.matrixWorld).project(cam);
        const sx = r.left + ((corner.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - corner.y) / 2) * r.height;
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
      return { left, top, right, bottom };
    },
    facePoints() {
      const r = world.renderer.domElement.getBoundingClientRect();
      cath.group.updateMatrixWorld(true);
      // The painted face's coordinates (frontcath.ts paintFace) on the skull's front surface.
      const at = (x: number, y: number, z: number) => {
        corner.set(x, y, z).applyMatrix4(cath.head.matrixWorld).project(cam);
        return { x: r.left + ((corner.x + 1) / 2) * r.width, y: r.top + ((1 - corner.y) / 2) * r.height };
      };
      return { eyes: [at(-0.0275, 0.006, 0.09), at(0.0275, 0.006, 0.09)], cheeks: [at(-0.04, -0.022, 0.082), at(0.04, -0.022, 0.082)] };
    },
    get time() {
      return time;
    },
    set time(v: number) {
      time = v;
    },
    setStage(r) {
      stage = r;
      cloudAge = Infinity;
    },
    setPickStage(r) {
      pickStage = r;
      cloudAge = Infinity;
    },
    setLift(k) {
      liftWant = THREE.MathUtils.clamp(k, 0, 1);
    },
    setFraming(k) {
      framing = THREE.MathUtils.clamp(k, 0, 0.9);
    },
    get dressed() {
      return wd.cls;
    },
    get idle() {
      return cath.idle;
    },
    get expression() {
      return cath.expressionNow;
    },
    get vignette() {
      return cath.clipState;
    },
    figurePose() {
      return cath.poseState;
    },
    get kit() {
      return cath.wearing;
    },
    wardrobe(cls, instant) {
      const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!instant && !o.still && cls && wd.cls && cls !== wd.cls) {
        // Reduced motion keeps the flash (light, not movement) and drops the turn and the cut.
        // Plan item 136: the audition's cut replaces item 129's dolly (a cut, not a push, reads as a new shot).
        if (!reduce) {
          wd.turn = TURN_S;
          wd.cut = VIGNETTE_S;
          wd.cutCls = cls;
        }
        wd.flash = FLASH_S;
      }
      wd.cls = cls;
      wd.target = cls ? 1 : 0;
      const c = cls ? CLASS_KEY[cls] ?? CLASS_KEY.ghost! : [0, 0, 0];
      keyWant.setRGB(c[0]!, c[1]!, c[2]!);
      const coatHex = cls ? CLASS_COAT[cls] : null;
      coatWant.copy(coatHex != null ? new THREE.Color(coatHex) : coatBase);
      if (cls) cath.play(cls, instant ? 0.5 : undefined, VIGNETTE_S);
      // Plan item 180: and she keeps the class's pose once its audition is done (a cut under reduced motion).
      cath.stance(cls, instant || reduce || o.still);
      cath.kit(cls);
      // Plan item 140: her face for the class (the title's smirk with none), on the canvas for the front's checks.
      const expr = cls ? CLASS_EXPRESSION[cls] ?? "smirk" : "smirk";
      cath.expression(expr);
      world.renderer.domElement.dataset.expression = expr;
      world.renderer.domElement.dataset.cathExpr = expr;
      // Plan item 161: the class on her stage, for the pick's checks (set at once; the swap plays over it).
      // Plan item 187: the class pick has her own look to the lens; the menu gaze is the title's.
      if (cls) cath.look(null);
      if (cls) world.renderer.domElement.dataset.class = cls;
      else delete world.renderer.domElement.dataset.class;
      if (instant) {
        wd.w = wd.target;
        key.color.copy(keyWant);
        coatNow.copy(coatWant);
        wardrobeStep(0);
        frame(0);
      }
    },
    focusBias(v) {
      spring.tb = THREE.MathUtils.clamp(v, -1, 1);
      idleS = 0;
      // Plan item 187: her eyes go to the focused row (the gaze target is published for the tests).
      cath.look(v);
      world.renderer.domElement.dataset.gaze = cath.gaze.toFixed(2);
    },
    parallax(x, y) {
      if (Math.abs(x - spring.tx) + Math.abs(y - spring.ty) > 0.02) idleS = 0;
      spring.tx = THREE.MathUtils.clamp(x, -1, 1);
      spring.ty = THREE.MathUtils.clamp(y, -1, 1);
    },
    setTime(t) {
      time = t;
      cloudAge = Infinity;
      // Settle the hem, the smoke and the springs as a live run would have, then draw once.
      const steps = 30;
      for (let i = 0; i < steps; i++) cath.update(1 / 30, t - (steps - i) / 30, world.wind);
      spring.x = spring.tx;
      spring.y = spring.ty;
      spring.bias = spring.tb;
      frame(0);
    },
    push(seconds = 1.6) {
      pushDur = o.still ? 0.3 : seconds;
      pushFrom.pos.copy(cam.position);
      pushFrom.quat.copy(cam.quaternion);
      const pts = pushCurve.points;
      pts[0]!.copy(cam.position);
      // Past her right shoulder, then into the street at eye height.
      toWorld(-0.42, 1.68, 0.15, pts[1]!);
      pts[2]!.copy(eye).add(new THREE.Vector3(0, 0.05, 0.45));
      pts[3]!.copy(eye);
      pushCurve.updateArcLengths();
      pushT = 0;
      return new Promise<void>((resolve) => {
        pushDone = resolve;
        if (o.shot) {
          // Screenshot runs draw the end of the push at once.
          pushT = pushDur;
          frame(0);
        }
      });
    },
    freeze() {
      frozen = true;
    },
    handover() {
      running = false;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      for (const r of removers) r();
      // The wardrobe's class key light leaves with her (it must not hang in the street once play starts).
      keyRemove?.();
      keyRemove = null;
      faceKeyRemove?.();
      faceKeyRemove = null;
      for (const c of chalk) c.removeFromParent();
      neon.dispose();
      delete world.renderer.domElement.dataset.keyLight;
      cath.dispose();
      world.setWounded?.({ pulse: 0, regen: 0, stim: 0, wipe: -1, lens: [], water: false });
      return world;
    },
    dispose() {
      scene.handover();
      world.dispose();
    },
  };
  return scene;
}
