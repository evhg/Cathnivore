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

import * as THREE from "three";
import { createWorld } from "./world";
import type { Quality, World } from "./types";
import { buildFrontCath, type FrontCath } from "./frontcath";

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
   * C14 (S9.5): the wardrobe. A close three-quarter framing of her with a key light in the class's colour (400 ms),
   * and the class's 1.2 s idle. null goes back to the title loop. `instant` (screenshots) skips the eases.
   */
  wardrobe(cls: string | null, instant?: boolean): void;
  /** Pointer or tilt, each -1..1. */
  parallax(x: number, y: number): void;
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

/**
 * The four framings in Cath's frame (x her left, y up, z ahead of her), metres: behind her right shoulder, her
 * right profile low, behind her left shoulder high, her left side. `look` is the point the lens aims at; the
 * camera then turns so she sits on the right third.
 */
const FRAMES: ReadonlyArray<{ pos: [number, number, number]; look: [number, number, number] }> = [
  // Low, so the umbrella's crown rises clear of the TOMAS EGGS fascia instead of cutting across its lettering.
  { pos: [-1.9, 1.2, -5.6], look: [0.2, 1.25, 0.5] },
  { pos: [-4.7, 1.1, -2.4], look: [0, 1.15, 0.6] },
  { pos: [0.6, 1.9, -6.2], look: [0, 1.25, 0.6] },
  { pos: [4.6, 1.3, -2.6], look: [0, 1.15, 0.4] },
];

/**
 * The wardrobe framing (S9.5), in her frame: a close three-quarter from the front, off her left shoulder, head to
 * mid-thigh. From this side the umbrella's shaft stands clear of her face, and her free left hand (the class idles
 * reach with it) is toward the lens.
 */
const WARDROBE = { pos: [1.2, 1.5, 1.75] as [number, number, number], look: [0.04, 1.3, 0.0] as [number, number, number] };
/** Each class's key light (linear RGB): Ghost cyan, Butcher blood, Gunslinger tungsten, Wirewitch violet, Fixer amber. */
const CLASS_KEY: Record<string, [number, number, number]> = {
  // The Ghost's cyan is pushed hard: at the same energy as the Butcher's red it read as neutral on her (C14 review).
  ghost: [0.18, 1.1, 1.8],
  butcher: [1.0, 0.04, 0.07],
  gunslinger: [1.0, 0.7, 0.36],
  wirewitch: [0.55, 0.18, 1.0],
  fixer: [1.0, 0.5, 0.1],
};

const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

export async function openFrontScene(canvas: HTMLCanvasElement, o: FrontSceneOptions): Promise<FrontScene> {
  const world = await createWorld(canvas, { quality: o.quality, intensity: o.intensity, shot: o.shot }, o.onProgress);
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
  if (world.light) {
    if (world.liveLight) removers.push(world.liveLight(pink));
    else removers.push(world.light(toWorld(0.4, 2.7, 2.2), new THREE.Color(1.0, 0.09, 0.42), pinkI, 6));
    removers.push(world.light(toWorld(-2.4, 1.9, -1.6), new THREE.Color(0.08, 0.62, 0.85), phone ? 3.5 : 4, 6));
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
  const wd = { w: 0, target: 0, cls: null as string | null };
  const wPos = toWorld(...WARDROBE.pos);
  const wLook = toWorld(...WARDROBE.look);
  const key = { pos: toWorld(1.35, 1.8, 1.15), color: new THREE.Color(0, 0, 0), intensity: 0, range: 7 };
  const keyWant = new THREE.Color(0, 0, 0);
  let keyRemove: (() => void) | null = null;
  function wardrobeStep(dt: number): void {
    const k = 1 - Math.exp(-dt * 4.2);
    wd.w += (wd.target - wd.w) * k;
    if (Math.abs(wd.target - wd.w) < 0.001) wd.w = wd.target;
    // About 400 ms to the new colour.
    key.color.lerp(keyWant, 1 - Math.exp(-dt * 9));
    key.intensity = (phone ? 7 : 9) * wd.w;
    pink.intensity = pinkI * (1 - 0.78 * wd.w);
    cath.tint(key.color, 0.6 * wd.w);
    if (wd.w > 0.002 && !keyRemove && world.liveLight) keyRemove = world.liveLight(key);
    if (wd.w <= 0.002 && keyRemove) {
      keyRemove();
      keyRemove = null;
    }
  }

  function aim(t: number, dt: number): void {
    const u = (((t / LOOP_S) % 1) + 1) % 1;
    posCurve.getPointAt(u, p);
    lookCurve.getPointAt(u, l);
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
    }
    cam.position.copy(p);
    m4.lookAt(p, l, up);
    cam.quaternion.setFromRotationMatrix(m4);
    // Her on the right third: turn the lens left by the angle that puts her at 0.3 of the half-width.
    const aspect = Math.max(0.5, cam.aspect);
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect);
    const fr = (aspect < 1.2 ? 0.12 : framing) * (1 - smoother(Math.min(1, wd.w)));
    cam.rotateY(Math.atan(Math.tan(half) * fr));
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
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    // The 3D DPR caps at 1.5 at 5K and on phones (S8); the phone scene runs at 0.75 render scale (S9.2 cost).
    const cap = phone || innerHeight * devicePixelRatio > 2000 ? 1.5 : 2;
    const dpr = Math.min(devicePixelRatio, cap);
    const scale = (phone ? 0.75 : 1) * o.renderScale;
    world.resize(w, h, dpr * (phone ? 0.9 : 1), Math.min(1, scale / (phone ? 0.9 : 1)));
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
    frame(step);
  };
  // The first frame now, so the canvas never shows black once the scene is ready.
  aim(0, 0);
  frame(1 / 60);
  raf = requestAnimationFrame(loop);

  const scene: FrontScene = {
    world,
    cath,
    stats,
    get time() {
      return time;
    },
    set time(v: number) {
      time = v;
    },
    setFraming(k) {
      framing = THREE.MathUtils.clamp(k, 0, 0.9);
    },
    wardrobe(cls, instant) {
      wd.cls = cls;
      wd.target = cls ? 1 : 0;
      const c = cls ? CLASS_KEY[cls] ?? CLASS_KEY.ghost! : [0, 0, 0];
      keyWant.setRGB(c[0]!, c[1]!, c[2]!);
      if (cls) cath.play(cls, instant ? 0.5 : undefined);
      if (instant) {
        wd.w = wd.target;
        key.color.copy(keyWant);
        wardrobeStep(0);
        frame(0);
      }
    },
    focusBias(v) {
      spring.tb = THREE.MathUtils.clamp(v, -1, 1);
    },
    parallax(x, y) {
      spring.tx = THREE.MathUtils.clamp(x, -1, 1);
      spring.ty = THREE.MathUtils.clamp(y, -1, 1);
    },
    setTime(t) {
      time = t;
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
      for (const c of chalk) c.removeFromParent();
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
