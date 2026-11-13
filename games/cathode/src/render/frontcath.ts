// C13 (docs/design/cathode-combat.md S9.2): Cath on the title, in 3D. Silhouette first, lit from behind: a
// belted charcoal trench with a 12-particle Verlet hem in the wind, dark hair up in a low knot (CATHODE's noir
// look, docs/design/cathode.md section 2), heeled boots, black gloves, a black umbrella (a lathe canopy on 8 ribs,
// rain running off the rib tips) and a cigarette whose ember breathes and puffs smoke every 14 s. Idle: breathing at
// 0.25 Hz and a weight shift every 7 to 11 s. Built once from lathes and tubes (about 14k triangles), 4 materials.
//
// Feet on y = 0 at the group's origin, facing +z, +x her left. The group is placed by render/frontscene.ts.

import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { CATH_HERO } from "../game/armdress";
import { LAYER_NO_REFLECT } from "./reflection";

/** Plan item 140: the painted face's expressions (the title's smirk, the class pick's). */
export type FaceExpression = "smirk" | "determined" | "wink";

export interface FrontCath {
  readonly group: THREE.Group;
  /** World-space points the scene lights and frames from. */
  readonly head: THREE.Object3D;
  readonly ember: THREE.Object3D;
  readonly umbrellaTop: THREE.Object3D;
  update(dt: number, t: number, wind: { x: number; z: number }): void;
  /** The back light's direction in view space (toward the light), for the rim. */
  setRim(viewDir: THREE.Vector3): void;
  /**
   * C14 (S9.5): a 1.2 s class idle, from the next update (or held at `u`, 0..1, for screenshots): ghost glances over
   * her shoulder, butcher rolls her neck, gunslinger squares up, wirewitch twirls the umbrella, fixer checks her cuff.
   */
  play(kind: string, u?: number, seconds?: number): void;
  /**
   * Plan item 180: the class's signature pose, held while she wears it (the audition's pose, kept): a change of class
   * lets the old one go and takes up the new over 300 ms (plan item 278); `instant` cuts (reduced motion, screenshots). null: none.
   */
  stance(kind: string | null, instant?: boolean): void;
  /** Plan item 180: the stance she holds now, its weight (0..1; 1 once the blend is done), how long the last blend took (loop s) and her posing hand. */
  readonly poseState: { kind: string | null; w: number; blendS: number; hand: [number, number, number] };
  /** Plan item 136: the class idle playing now, how far through it is (0..1) and the gun in her hand, or null. */
  readonly clipState: { kind: string; u: number; prop: "rifle" | "shotgun" | null } | null;
  /**
   * Plan item 187: where she looks, -1..1 down the title menu (the menu sits to her right of frame): her head turns
   * toward it and tips to the focused row, easing there in about 150 ms (`instant` cuts). `gaze` is the target now.
   */
  look(v: number | null, instant?: boolean): void;
  readonly gaze: number;
  /** C14: pulls her rim from the street's pink toward `c` by `w` (0..1): the wardrobe's class colour. */
  tint(c: THREE.Color, w: number): void;
  /** Plan item 16: indoors the umbrella is furled and hangs from her fist, and no rain runs off it. */
  indoors(on: boolean): void;
  /** Plan item 42: the coat's cloth colour (the class pick's outfit swap); null puts her black trench back. */
  coat(c: THREE.Color | null): void;
  /** Plan item 112: the class's kit over the coat (ghost's rifle sling, butcher's apron, gunslinger's holster,
   *  wirewitch's wire rig, fixer's tie); null takes it off. One kit shows at a time. */
  kit(cls: string | null): void;
  /** Plan item 136: every kit shown at once (true) or back to the one she wears, so the warm-up compiles their
   *  shaders before the first class change (one compiled mid-pick stalled the frame). */
  showAllKits(on: boolean): void;
  /** The kit she's wearing (null for none). */
  readonly wearing: string | null;
  /** Plan item 140: repaints her face with this expression (a no-op when it's already showing). Plan item 275:
   *  each expression's map is painted once and kept; `keepBlink` leaves the blink frame as it is (the title's turn). */
  expression(e: FaceExpression, keepBlink?: boolean): void;
  /** Plan item 275: the title's two faces and the blink, for the scene to upload up front. */
  faceMaps(): THREE.Texture[];
  readonly expressionNow: FaceExpression;
  /** Plan item 175: the idle loop now: breath (-1..1), the weight shift (-1..1), the umbrella's sway (rad), blinks so
   *  far and whether the lids are shut this frame. */
  readonly idle: { breath: number; weight: number; sway: number; blinks: number; blinking: boolean };
  /** Plan item 175: the shut-eyed face, for the scene to upload up front (not on her first blink). */
  readonly blinkMap: THREE.Texture;
  dispose(): void;
  readonly triangles: number;
  /** Plan item 254: how many of her parts carry the ink line. */
  readonly inkParts: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A lathe from (radius, height) pairs, squashed front to back (a torso is not round). */
function lathe(profile: Array<[number, number]>, segs: number, depth = 0.74): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  );
  g.scale(1, 1, depth);
  g.computeVertexNormals();
  return g;
}

/** A tapered tube between two points (a limb), capped with spheres at both ends. */
function limb(a: THREE.Vector3, b: THREE.Vector3, ra: number, rb: number, segs = 12): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(rb, ra, len, segs, 3, true);
  g.translate(0, len / 2, 0);
  const capA = new THREE.SphereGeometry(ra, segs, 6);
  const capB = new THREE.SphereGeometry(rb, segs, 6);
  capB.translate(0, len, 0);
  const merged = mergeGeos([g, capA, capB]);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  merged.applyQuaternion(q);
  merged.translate(a.x, a.y, a.z);
  return merged;
}

/**
 * Plan item 319 slice 38: one smooth tube through `pts` whose radius eases through `rad` (one per point), rounded
 * at the tip. A finger built as capsules chained joint to joint showed every cap as a bead under a gloss line.
 */
function taperTube(pts: THREE.Vector3[], rad: number[], segs: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts);
  const n = 12;
  const g = new THREE.TubeGeometry(curve, n, 1, segs, false);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPointAt(u, c);
    const f = u * (rad.length - 1);
    const k = Math.min(rad.length - 2, Math.floor(f));
    const r = rad[k]! + (rad[k + 1]! - rad[k]!) * (f - k);
    for (let j = 0; j <= segs; j++) {
      const idx = i * (segs + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  const tip = new THREE.SphereGeometry(rad[rad.length - 1]!, segs, 6);
  const end = pts[pts.length - 1]!;
  tip.translate(end.x, end.y, end.z);
  const base = new THREE.SphereGeometry(rad[0]!, segs, 6);
  base.translate(pts[0]!.x, pts[0]!.y, pts[0]!.z);
  const out = mergeGeos([g, tip, base]);
  g.dispose(); tip.dispose(); base.dispose();
  return out;
}

/**
 * A body part turned along a→b with a radius profile (t from 0 at a to 1 at b), squashed to `depth` front to back
 * around `up` (a thigh is wider than deep). Closed at both ends.
 */
function turned(a: THREE.Vector3, b: THREE.Vector3, profile: Array<[number, number]>, segs: number, depth = 1, twist = 0): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const pts = [new THREE.Vector2(0.0005, 0)];
  for (const [t, r] of profile) pts.push(new THREE.Vector2(r, t * len));
  pts.push(new THREE.Vector2(0.0005, len));
  const g = new THREE.LatheGeometry(pts, segs);
  g.scale(1, 1, depth);
  if (twist) g.rotateY(twist);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  g.computeVertexNormals();
  return g;
}

/** The radius of a `turned` profile at t (linear between its points). */
function profR(profile: ReadonlyArray<readonly [number, number]>, t: number): number {
  for (let i = 0; i < profile.length - 1; i++) {
    const [t0, r0] = profile[i]!;
    const [t1, r1] = profile[i + 1]!;
    if (t <= t1) return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0 || 1);
  }
  return profile[profile.length - 1]![1];
}

/**
 * Plan item 319: a cuff strap, a 1.4 cm leather band 2.5 mm proud of a sleeve of radius `r` (squashed to `depth`
 * like the sleeve's `turned`), centred on `at` along `dir`, its edges eased in.
 */
function cuffBand(at: THREE.Vector3, dir: THREE.Vector3, r: number, depth: number, segs: number): THREE.BufferGeometry {
  const h = 0.007;
  const a = at.clone().addScaledVector(dir, -h);
  const b = at.clone().addScaledVector(dir, h);
  return turned(a, b, [[0, r + 0.0006], [0.15, r + 0.0025], [0.85, r + 0.0025], [1, r + 0.0006]], segs, depth);
}

/** Plan item 227: the baked wool normal maps, by name and size (null where there is no 2D canvas). */
const WOOL_CACHE = new Map<string, THREE.CanvasTexture | null>();

/**
 * Plan item 319 slice 24: the face's lids and lips as smooth bumps on the unit skull (amp, cx, cy, rx, ry, mirrored
 * to both sides), shared by the skull's displacement and the face shader's relief shade, so the two never drift.
 */
const FACE_RELIEF: ReadonlyArray<readonly [number, number, number, number, number, boolean]> = [
  // The upper lid between the lash line (the painted eye's top, y 0.165) and the crease: a fold whose lower half,
  // turned down toward the lashes, lies in shade, then the crease itself, then the brow bone catching the light.
  [0.03, 0.4, 0.2, 0.24, 0.06, true],
  [-0.014, 0.41, 0.255, 0.22, 0.032, true],
  // The mouth's corners tuck in.
  [-0.012, 0.235, -0.47, 0.07, 0.06, true],
  // The upper lip leans out at its top (the philtrum's foot) and turns down into the mouth's line.
  [0.03, 0, -0.415, 0.28, 0.07, false],
  // The mouth's line.
  [-0.014, 0, -0.475, 0.26, 0.03, false],
  // The lower lip, fuller, its top turned up to the light.
  [0.04, 0, -0.53, 0.25, 0.08, false],
  // The hollow under the lower lip. Plan item 319 slice 33: half as deep (-0.02), since with the lip's underside and
  // the painted shade it drew a grey patch under her mouth like a goatee.
  [-0.01, 0, -0.63, 0.2, 0.065, false],
];
/** How strongly the relief's slope (a soft top light) and its dips (cavity) shade the face. */
const RELIEF_SLOPE = 0.75;
const RELIEF_CAVITY = 2.2;

/** Plan item 227: squeezes a geometry's uv.y into [v0, v1] (a sleeve part's span of the whole sleeve's map). */
function vSpan(g: THREE.BufferGeometry, v0: number, v1: number): THREE.BufferGeometry {
  const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  if (uv) for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * (v1 - v0));
  return g;
}

/** Merges non-indexed copies of geometries that share position and normal attributes. */
function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const p of parts) n += p.attributes.position!.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    pos.set(p.attributes.position!.array as Float32Array, o * 3);
    nor.set(p.attributes.normal!.array as Float32Array, o * 3);
    o += p.attributes.position!.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return g;
}

/**
 * Plan item 254: the toon ramp. Three flats (shadow, mid, light) with a soft edge a few hundredths wide, so the band
 * lines are drawn, not stair-stepped, at any size.
 */
const INK_BAND = /* glsl */ `
float inkBand( float x ) {
  return mix( 0.4 * smoothstep( 0.08, 0.14, x ), 0.9, smoothstep( 0.45, 0.52, x ) );
}
// Plan item 319: wool's flats, the same levels with wide shoulders. Its weave and nap live in the normal map, and
// the hard steps above cut that noise into hard dark dashes all over the coat (the critique's plastic streaks).
float inkBandWool( float x ) {
  return mix( 0.4 * smoothstep( 0.0, 0.3, x ), 0.9, smoothstep( 0.32, 0.7, x ) );
}`;
const TOON_PHYSICAL = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  "float dotNL = saturate( dot( geometryNormal, directLight.direction ) );",
  "float dotNL = inkBand( saturate( dot( geometryNormal, directLight.direction ) ) );",
);
const TOON_WOOL = TOON_PHYSICAL.replace("inkBand(", "inkBandWool(");

/**
 * Plan item 254: the ink line, an inverted hull. Each outlined part draws once more, back faces only, pushed out
 * along its normal by a fixed width in screen pixels (in clip space, so it is the same line at any distance), in
 * near-black ink. Where her arm crosses her coat the hull shows between them too: the drawn contour of a figure.
 */
const INK_VERT = /* glsl */ `
uniform vec2 uInk;
attribute vec3 inkNormal;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  // Plan item 319 slice 64: the hull sits 6 mm behind its part, so it shows only where the part ends against
  // something farther (its silhouette), not in a crease inside it: the nose's far flank pushed its back faces out
  // over the near cheek as a dotted dark line beside the nose (the critique's 'slash' at P).
  mv.xyz += normalize( mv.xyz ) * 0.006;
  vec4 clip = projectionMatrix * mv;
  vec2 d = ( projectionMatrix * vec4( normalize( normalMatrix * inkNormal ), 0.0 ) ).xy;
  float l = length( d );
  clip.xy += ( l > 1e-5 ? d / l : vec2( 0.0 ) ) * uInk * clip.w;
  gl_Position = clip;
}`;
const INK_FRAG = /* glsl */ `
uniform vec3 uInkColor;
void main() {
  gl_FragColor = vec4( uInkColor, 1.0 );
}`;
/** The line's width in CSS pixels at a 900 px tall view (1.5 px at D, as the plan asks), scaled with the view. */
const INK_PX = 1.5;
/** Plan item 254: the hair shine band's strength (times the face key and the strands' colour). */
// Plan item 289: 2.4 -> 1.6, the crown's band a gloss line rather than a pale patch by the parting.
const HAIR_SHINE = 1.6;
/** The outlined parts: her largest body meshes, at most this many (the draw-call budget: +12). */
const INK_MAX = 12;

/**
 * Plan item 319: the hull's push direction, one normal per point in space. Where a part's normals split (a lapel's
 * bevel, a hair lock's edge, the hood's rim, every seam of a lathe) each copy of a vertex was pushed its own way, so
 * the hull tore open there and the lit body and the street showed through as white specks and notches along the
 * line (critique, 11-12 13:40). Every copy at one position now takes the average of their normals.
 */
function inkNormals(g: THREE.BufferGeometry): void {
  if (g.attributes.inkNormal) return;
  const pos = g.attributes.position!;
  const nor = g.attributes.normal!;
  const q = (v: number) => Math.round(v * 2e4);
  const sum = new Map<string, [number, number, number]>();
  const keys: string[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${q(pos.getX(i))},${q(pos.getY(i))},${q(pos.getZ(i))}`;
    keys.push(k);
    const a = sum.get(k) ?? [0, 0, 0];
    a[0] += nor.getX(i);
    a[1] += nor.getY(i);
    a[2] += nor.getZ(i);
    sum.set(k, a);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = sum.get(keys[i]!)!;
    const l = Math.hypot(a[0], a[1], a[2]);
    // A knife edge whose two sides cancel (a card's front and back) keeps its own normal.
    if (l < 1e-4) {
      out[i * 3] = nor.getX(i);
      out[i * 3 + 1] = nor.getY(i);
      out[i * 3 + 2] = nor.getZ(i);
    } else {
      out[i * 3] = a[0] / l;
      out[i * 3 + 1] = a[1] / l;
      out[i * 3 + 2] = a[2] / l;
    }
  }
  g.setAttribute("inkNormal", new THREE.BufferAttribute(out, 3));
}

export function buildFrontCath(phone: boolean): FrontCath {
  const group = new THREE.Group();
  group.name = "front-cath";
  const S = phone ? 0.6 : 1; // segment scale on phone
  const seg = (n: number) => Math.max(6, Math.round(n * S));

  // ---- materials (4) ----
  // Plan item 227: wool, not plastic. Matte (roughness 0.86), a low sheen and only a light clearcoat for the rain
  // (the old 0.85 clearcoat over 0.6 roughness lit the trench like a moulded shell).
  const coatMat = phone
    ? new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.84, metalness: 0 })
    : new THREE.MeshPhysicalMaterial({ color: CATH_HERO.trench, roughness: 0.86, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.5, sheen: 0.32, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x6a7080) });
  // Plan item 227: the cloth baked once into a normal map, untiled, laid on the lathe's (around, up) UV: a gabardine
  // twill and wool's uneven nap everywhere, and the folds a real coat has where it is held, gathered under the belt,
  // creased at the elbow, turned at the hem. `bands` is the fold height at (u, v) on top of the weave.
  const woolNormal = (W: number, bands: (u: number, v: number) => number, seed: number) => {
    const H = W;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    if (!g) return null;
    let sd = seed;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    // Value noise on a wrapping lattice, three octaves: the nap.
    const lat = (n: number) => {
      const a = new Float32Array(n * n);
      for (let i = 0; i < a.length; i++) a[i] = rnd();
      return (x: number, y: number) => {
        const fx = x * n;
        const fy = y * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const v = (i: number, j: number) => a[(((j % n) + n) % n) * n + (((i % n) + n) % n)]!;
        const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
        const bot = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
        return top + (bot - top) * sy;
      };
    };
    const n1 = lat(24);
    const n2 = lat(64);
    const n3 = lat(160);
    const h = new Float32Array(W * H);
    // Plan item 319 slice 31: a rib every 8 px at a third of its old depth. At 4 px and 0.35 the twill beat against
    // the screen's pixels into broad diagonal moiré across the coat at D (critique, 11-12 08:35); the nap and the
    // soft wool bands now carry the cloth, and the rib only a fine grain up close.
    const twill = W / 8;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const v = y / H;
        const nap = n1(u, v) * 0.9 + n2(u, v) * 0.55 + n3(u, v) * 0.35;
        const rib = 0.5 + 0.5 * Math.sin(((x + y * 0.6) / W) * Math.PI * 2 * twill);
        h[y * W + x] = rib * 0.12 + nap * 1.1 + bands(u, v) * 6;
      }
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const at = (xx: number, yy: number) => h[Math.min(H - 1, Math.max(0, yy)) * W + ((xx + W) % W)]!;
        const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
        const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
        const il = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        const o = (y * W + x) * 4;
        img.data[o] = (-dx * il * 0.5 + 0.5) * 255;
        img.data[o + 1] = (-dy * il * 0.5 + 0.5) * 255;
        img.data[o + 2] = (il * 0.5 + 0.5) * 255;
        img.data[o + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  // Baked once a page (the title, the pick and the warm-up build her more than once).
  const woolCached = (key: string, W: number, bands: (u: number, v: number) => number, seed: number) => {
    const k = `${key}:${W}`;
    if (!WOOL_CACHE.has(k)) WOOL_CACHE.set(k, woolNormal(W, bands, seed));
    return WOOL_CACHE.get(k) ?? null;
  };
  const bump = (d: number, w: number) => Math.exp(-(d * d) / (w * w));
  // The coat's lathe runs hem (v 0) to collar (v 1) over 15 profile rows: the belt is row 6, the hem fold row 1.
  const BELT_V = 6 / 14;
  const HEM_V = 1 / 14;
  const coatBands = (u: number, v: number) => {
    const a = u * Math.PI * 2;
    // Gathered under the belt: short vertical ridges above and below it, fading out from the belt.
    // Irregular (two beating frequencies), and only a hand's width either side, so they read as cloth, not ribs.
    const gather = (Math.sin(a * 31 + Math.sin(a * 7) * 2.2) * 0.6 + Math.sin(a * 53 + 1.1) * 0.4) * bump(v - BELT_V, 0.03) * (1 - bump(v - BELT_V, 0.01));
    // Drape: long soft folds falling from the belt, wider and deeper toward the hem.
    const below = Math.max(0, Math.min(1, (BELT_V - v) / BELT_V));
    const drape = Math.sin(a * 9 + 1.7 + Math.sin(a * 3 + v * 5) * 0.9) * below * below * 0.8;
    // Drag lines across the back and chest above the belt (the cloth pulled to the shoulders).
    const drag = v > BELT_V ? Math.sin(a * 5 + v * 26) * bump(v - 0.7, 0.12) * 0.25 : 0;
    // The turned hem: a ridge at the fold and its stitch line a finger above.
    const hem = bump(v - HEM_V, 0.012) * 0.9 - bump(v - (HEM_V + 0.03), 0.004) * 0.35;
    return gather * 0.45 + drape * 2.2 + drag + hem;
  };
  // A sleeve's UV runs shoulder (v 0) to cuff (v 1) with the elbow at v 0.5, whether it is one tube (her umbrella
  // arm) or two bones (her left): creases bunch at the elbow, a seam turns the cuff back.
  const sleeveBands = (u: number, v: number) => {
    const a = u * Math.PI * 2;
    // Elbow creases: rings that wander, deepest on the inside of the bend and fading round the outside.
    const inner = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.cos(a - Math.PI), 2);
    const crease = (Math.sin(v * 90 + Math.sin(a * 2) * 1.8) * 0.5 + 0.5) * bump(v - 0.5, 0.08) * inner;
    // Drag lines from the elbow down the forearm, and the cuff's turn-back seam.
    const drag = Math.sin(a * 3 + v * 30) * bump(v - 0.68, 0.08) * 0.3;
    const seam = -bump(v - 0.93, 0.006) * 0.5;
    return crease * 1.4 + drag + seam;
  };
  const clothNormal = woolCached("coat", phone ? 256 : 512, coatBands, 11);
  const sleeveNormal = woolCached("sleeve", phone ? 128 : 256, sleeveBands, 29);
  if (clothNormal) {
    coatMat.normalMap = clothNormal;
    coatMat.normalScale.set(0.75, 0.75);
  }
  // Gloves, boots, hair and the umbrella: near-black with a wet sheen.
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.32, metalness: 0.05 });
  // Plan item 319: her gloves are soft kid leather, a touch warmer and less glossy than the belt and umbrella, so the
  // fingers read as a hand in leather, not black clumps of patent (the critique's 'black-clump gloves').
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1b181c, roughness: 0.5, metalness: 0.03 });
  // Hair: combed-back strands as a streaked colour and roughness map (a shine band reads as hair, not a helmet).
  const strands = (() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#2a1c17";
      g.fillRect(0, 0, 64, 128);
      let sd = 7;
      const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        const x = rnd() * 64;
        const l = 40 + rnd() * 30;
        g.fillStyle = `rgba(${rnd() < 0.5 ? "90,64,52" : "10,6,5"},${0.25 + rnd() * 0.35})`;
        g.fillRect(x, 0, 0.6 + rnd() * 1.2, 128);
        void l;
      }
      // Plan item 140: a shine band across the strands, a third of the way down (the crown on the cap, the
      // shoulders on the long hair), broken by the strands so it reads as glossy hair, not a painted stripe.
      // Plan item 289: a narrow, cool gloss line (a 40-texel beige wash read as a blonde streak down her coat).
      const band = g.createLinearGradient(0, 36, 0, 52);
      band.addColorStop(0, "rgba(196,170,164,0)");
      band.addColorStop(0.5, "rgba(196,170,164,0.5)");
      band.addColorStop(1, "rgba(196,170,164,0)");
      g.fillStyle = band;
      for (let x = 0; x < 64; x += 1) {
        const w = 0.45 + 0.55 * rnd();
        const dy = (rnd() - 0.5) * 5;
        g.globalAlpha = w;
        g.fillRect(x, 36 + dy, 1, 16);
      }
      g.globalAlpha = 1;
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  })();
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x9a8678, map: strands, roughness: 0.38, metalness: 0, sheen: 0.6, sheenRoughness: 0.3, sheenColor: new THREE.Color(0x7a5a48) });
  const skinMat = new THREE.MeshStandardMaterial({ color: CATH_HERO.skin, roughness: 0.55, metalness: 0 });
  const mats: THREE.Material[] = [coatMat, blackMat, gloveMat, hairMat, skinMat];
  const coatMats: (THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial)[] = [coatMat];
  const coat0 = coatMat.color.clone();
  // The back light's rim (S9.2 "lit from behind"): a Fresnel edge in --neon-pink, strongest on the side facing
  // the light, with a cool cyan edge on the far side. The street's real lights add to it; the rim is what
  // makes her read as a silhouette against the neon at any framing.
  // Plan item 319 slice 46: the hair's rim under a hood (1 bare-headed): the hood blocks the back light, so the
  // hair's outline lit a pale line against the hood's dark lining.
  const hairRimU = { uHairRim: { value: 1 }, uHairHood: { value: 0 } };
  const rimU = {
    uRimDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    // Plan item 82: a stronger rim on a phone, where she stands small in the lower half under the menu.
    // Plan item 89: stronger at D too, so her hair and profile read against the street (1.1 left a silhouette).
    uRimA: { value: new THREE.Color(1.0, 0.3, 0.52).multiplyScalar(phone ? 1.5 : 1.45) },
    uRimB: { value: new THREE.Color(0.1, 0.55, 0.8).multiplyScalar(phone ? 0.45 : 0.4) },
    // Plan item 140: a warm face key from the lens's upper left (view space, so it follows every framing), on her
    // skin and face only: the street's pink washed her face to a flat oval. A soft wrap keeps the far cheek modelled.
    uKeyDir: { value: new THREE.Vector3(-0.45, 0.5, 0.75).normalize() },
    // Plan item 148: a step brighter, the noir poster's lit face (mean luminance 0.22 -> 0.25 at D).
    uKey: { value: new THREE.Color(1.0, 0.86, 0.74).multiplyScalar(phone ? 1.45 : 1.3) },
  };
  const rimA0 = rimU.uRimA.value.clone();
  const key0 = rimU.uKey.value.clone();
  const tmpC = new THREE.Color();
  const rimify = (m: THREE.MeshStandardMaterial, gain: number, key = 0, glint = 0, shine = 0, hair = false, skin = 0, edge: "flat" | "wool" | "leather" = "flat", inside = 1) => {
    // Plan item 275: on the face (the material with catch-lights) the key falls in planes, as a portrait's light does:
    // the planes turned from it (under the cheekbone, the far cheek, the jaw's side) step down to a little over half,
    // so the face is modelled by the mesh's planes rather than lit as one smooth oval.
    // Plan item 319: a softer step (0.4-0.62 -> 0.3-0.68) on the denser skull, whose finer curves the hard step cut
    // into dark bands beside the mouth. Slice 9: wider again (0.1-0.85): the step still drew the jaw as a polygon.
    const planes = glint > 0 ? " * ( 0.45 + 0.55 * smoothstep( 0.1, 0.85, dot( normal, uKeyDir ) ) )" : "";
    // Plan item 319 slice 13: on the face the key wraps further round (a skin's soft light: 0.5 + 0.5 * n.l, power 1.2),
    // so the cheek and jaw turned from it fall to a warm half-light instead of nothing, which drew a dirty brown band
    // down the far cheek in three-quarter view. The rest of her keeps the narrower wrap.
    const wrap = glint > 0 ? "pow( saturate( dot( normal, uKeyDir ) * 0.5 + 0.5 ), 1.2 )" : "pow( saturate( dot( normal, uKeyDir ) * 0.7 + 0.3 ), 1.5 )";
    let keyTerm = key > 0 ? `totalEmissiveRadiance += ${key.toFixed(2)} * uKey * diffuseColor.rgb * ${wrap}${planes};` : "";
    // The face's catch-lights (#fffaf4, the only texels this white in linear: the sclera is 0.75) mirror the key, so
    // the eyes hold a bright point under the street's grade.
    if (glint > 0) keyTerm += `\ntotalEmissiveRadiance += ${glint.toFixed(2)} * uKey * smoothstep( 0.86, 0.9, min( diffuseColor.r, min( diffuseColor.g, diffuseColor.b ) ) );`;
    // Plan item 254: the hair's shine band, an illustrator's highlight: a hard-edged band across the crown where the
    // hair turns to face the lens and the key (view-space normal half way up), broken by the strands' own map, so
    // her hair reads as glossy dark hair under the flats rather than a matte brown shell.
    // Plan item 319: the band is the strands' own colour brightened (it was that plus a flat grey, which where the
    // cap shows between the front locks drew a smooth pale-grey arc by the parting), so it reads as warm brown gloss.
    if (shine > 0)
      keyTerm += `\n{ float up = dot( normal, normalize( vec3( uKeyDir.x * 0.4, 0.62, 0.78 ) ) ); float ring = smoothstep( 0.82, 0.85, up ) * ( 1.0 - smoothstep( 0.89, 0.92, up ) ); totalEmissiveRadiance += ${shine.toFixed(2)} * ring * uKey * diffuseColor.rgb * 2.2; }`;
    // Plan item 289: a narrower, cooler band (the wide warm one lit a pale blotch beside the parting at the title).
    // Plan item 306: the face is lit by the street's brightness, not its colour: its light is rebuilt as the skin's own
    // albedo times the light's luminance (the pick's ice key and the cyan sign tinted her a cold blue-white), its
    // saturation is raised by the share the noir grade drains from midtones (post.ts keeps 55%), so she grades to warm
    // skin rather than grey, and its brightness rolls off with a soft knee so skin never clips and the painted eyes,
    // liner and lips keep their contrast. Only the face (the material with catch-lights); the coat keeps the street.
    // Plan item 306 slice 2: the neck and ears (skin) take the same warm, colour-free light at \`skin\` of the face's
    // brightness, so the throat sits in the jaw's shade under the face instead of a grey-teal band below a warm face.
    const skinTone = glint > 0 ? 1 : skin;
    // Plan item 319 slice 52: on the face the knee squeezed the key's planes to almost nothing (a 2:1 key read 1.5:1),
    // so the face read as one even peach mask (critiques 11:00 and 13:40); the turn from the key now shades it after
    // the knee, down to 0.64 where it faces away (0.58 cost her far eye its 3:1 on the cheek), a little warmer in the shade (skin's subsurface red).
    // Plan item 319 slice 39: the light rebuilt from the albedo's luminance cancels a grey vertex shade, so the neck's
    // jaw shadow (its vertex colours) is applied again after it, as a brightness.
    // Plan item 319 slice 68: after it, the face's very edge (grazing the lens) falls to 0.8, so the cheek turns into
    // the hair and hood instead of ending at them as a pale plate's rim (critique 11-13 03:35, point 1). Narrow, so the
    // far cheek beside the eye keeps its light (the eyes' 3:1); a jaw-underside shade tried with it cost that too.
    const skinLight =
      skinTone > 0
        ? `{
            const vec3 W = vec3( 0.2126, 0.7152, 0.0722 );
            float la = max( dot( diffuseColor.rgb, W ), 1e-4 );
            float l = dot( outgoingLight, W );
            vec3 c = mix( outgoingLight, diffuseColor.rgb * ( l / la ), 0.8 );
            float lc = dot( c, W );
            c = max( vec3( 0.0 ), mix( vec3( lc ), c, 1.7 ) ) * vec3( 1.05, 1.0, 0.93 );
            float l2 = lc / ( 1.0 + lc / 1.4 );
            outgoingLight = c * ( lc > 1e-4 ? l2 / lc : 1.0 ) * ${skinTone.toFixed(2)};
            ${glint > 0 ? "{ float ks = mix( 0.64, 1.0, smoothstep( -0.05, 0.7, dot( normal, uKeyDir ) ) ); outgoingLight *= ks * vec3( 1.0, 1.0 - 0.12 * ( 1.0 - ks ), 1.0 - 0.24 * ( 1.0 - ks ) ); float fe = saturate( dot( normal, normalize( vViewPosition ) ) ); float sh = mix( 0.8, 1.0, smoothstep( 0.02, 0.22, fe ) ); outgoingLight *= sh * vec3( 1.0, 1.0 - 0.1 * ( 1.0 - sh ), 1.0 - 0.2 * ( 1.0 - sh ) ); }" : ""}
            ${glint > 0 ? "" : "#ifdef USE_COLOR\n            outgoingLight *= dot( vColor.rgb, W );\n            #endif"}
          }
          #include <opaque_fragment>`
        : "#include <opaque_fragment>";
    // Plan item 319 slice 46: a two-sided shell's inside (the Ghost's hood) sits in its own shade: lit like the
    // outside, the strip of lining between her hair and the brim drew a pale fringe round her face.
    const insideShade = inside < 1 ? `if ( !gl_FrontFacing ) outgoingLight *= ${inside.toFixed(2)};\n` : "";
    // Plan item 319 slice 62: under the Ghost's hood her hair takes the street's light only through the face opening,
    // so it keeps its own warm brown: the gloss and sheen of the cyan sign behind her drew a teal streak down the
    // hair's outline between her cheek and the hood's lining. Hooded, the hair's light goes to its luminance in a warm
    // brown (a quarter of the hue kept) and a step darker, the hood's shade.
    const hoodShade = hair
      ? "{ float hl = dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) ); outgoingLight = mix( outgoingLight, mix( vec3( hl ) * vec3( 1.06, 0.95, 0.82 ), outgoingLight, 0.25 ) * 0.8, uHairHood ); }\n"
      : "";
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, rimU, hair ? hairRimU : {});
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <opaque_fragment>", insideShade + hoodShade + skinLight)
        .replace("#include <common>", "#include <common>\nuniform vec3 uRimDir;\nuniform vec3 uRimA;\nuniform vec3 uRimB;\nuniform vec3 uKeyDir;\nuniform vec3 uKey;\n" + (hair ? "uniform float uHairRim;\nuniform float uHairHood;\n" : "") + INK_BAND)
        // Plan item 254: the street's direct lights fall on her in three bands (an inked illustration's flats), not
        // a smooth Lambert falloff; the ambient and the reflections stay smooth, so the dark band still models.
        // Plan item 319: not on the face (the material with catch-lights): banded, the street's light cut her jaw and
        // cheek into flat triangles with a hard dark wedge under the jaw (critique 17:15); the face takes it smooth.
        // Slice 18: nor on the rest of her skin (neck, ears): banded, the neck's turn drew a hard vertical seam under
        // the smoothly lit jaw.
        .replace("#include <lights_physical_pars_fragment>", glint > 0 || skin > 0 ? "#include <lights_physical_pars_fragment>" : edge === "wool" ? TOON_WOOL : TOON_PHYSICAL)
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            // Plan item 319: wool's rim follows the cloth's own turn, with only a quarter of the weave's normal: at
            // the grazing edge the full weave flipped texels in and out of the rim, a fringe of pale flecks down the
            // sleeves' edges.
            ${edge === "wool" ? "vec3 rimN = normalize( mix( nonPerturbedNormal, normal, 0.25 ) );" : "vec3 rimN = normal;"}
            float facing = saturate( dot( rimN, normalize( vViewPosition ) ) );
            // A wide, soft Fresnel (C13 review: the narrow pow-4 edge drew as one-pixel pink stair-steps).
            float fr0 = pow( 1.0 - facing, 2.2 );
            // Plan item 254: most of the rim is a hard-edged flat (an inked illustration's back-light shape), a
            // little of the soft falloff kept so the band's edge is drawn, not stair-stepped.
            float fr = mix( smoothstep( 0.0, 1.0, fr0 ), smoothstep( 0.26, 0.34, fr0 ), 0.7 );
            // Plan item 289: hair is thin locks whose surfaces mostly turn from the lens, so the wide flat lit whole
            // strands pink-white (a pale ribbon down her coat, a lavender helmet): on hair the rim keeps to the outer
            // edge, and a two-sided sheet's inside keeps little of it, so her hair reads dark and glossy.
            // Plan item 319 slice 56: a softer, dimmer band (0.5-0.62 at full -> 0.42-0.82 at 0.45): the thin locks' turned
            // edges flipped pixels in and out of the hard band, a jagged pale fringe down every lock at 4x.
            ${hair ? "fr = smoothstep( 0.42, 0.82, fr0 ) * 0.45 * ( gl_FrontFacing ? 1.0 : 0.25 ) * uHairRim;" : ""}
            // Plan item 319: the coat is wool, which takes a back light as a soft, dim bloom along its turn, not item
            // 254's hard flat (a bright white band down the coat's edge read as vinyl); its own weave normal breaks it.
            ${edge === "wool" ? "fr = smoothstep( 0.06, 0.9, fr0 ) * 0.5;" : ""}
            // Plan item 319: gloves, belt and umbrella are thin black leather: the flat lit whole fingers pale (the
            // umbrella fist read as a skeleton's bones), so leather keeps a narrow gloss line on its outer edge only.
            ${edge === "leather" ? "fr = smoothstep( 0.46, 0.6, fr0 );" : ""}
            float side = dot( rimN, uRimDir );
            vec3 rimC = uRimA * smoothstep( -0.2, 0.7, side ) + uRimB * smoothstep( 0.1, -0.8, side );
            // Plan item 319 slice 11: wool scatters the street's neon, so its rim keeps half the sign's colour and less
            // of its strength (the critique read a pink and cyan sheen down the coat as vinyl).
            ${edge === "wool" ? "rimC = mix( vec3( dot( rimC, vec3( 0.2126, 0.7152, 0.0722 ) ) ), rimC, 0.5 ) * 0.75;" : ""}
            // Plan item 319 slice 22: dark hair lights at its edge in its own warm brown-gold, with only a trace of the
            // signs' hue (the critique read the locks' pink and cyan edges as plastic cards, not hair).
            ${hair ? "rimC = mix( vec3( dot( rimC, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * vec3( 1.0, 0.8, 0.6 ), rimC, 0.3 ) * 0.8;" : ""}
            // Plan item 319 slice 46: a two-sided shell's inside (the Ghost's hood) takes no rim.
            ${inside < 1 ? "fr *= gl_FrontFacing ? 1.0 : 0.0;" : ""}
            totalEmissiveRadiance += ${gain.toFixed(2)} * fr * rimC;
            ${keyTerm}
          }`,
        );
    };
    m.customProgramCacheKey = () => `front-rim-${gain}-${key}-${glint}-${shine}-${hair}-${edge}-${inside}`;
  };
  rimify(coatMat, 1, 0, 0, 0, false, 0, "wool");
  // Plan item 227: the sleeves' own cloth, creased at the elbow and seamed at the cuff.
  const sleeveMat = coatMat.clone();
  if (sleeveNormal) sleeveMat.normalMap = sleeveNormal;
  coatMats.push(sleeveMat);
  rimify(sleeveMat, 1, 0, 0, 0, false, 0, "wool");
  mats.push(sleeveMat);
  // Plan item 271: the coat itself (its skirt carries the fold shade as vertex colours; the lapels and epaulettes,
  // merged with no colour attribute, stay on coatMat).
  const skirtMat = coatMat.clone();
  skirtMat.vertexColors = true;
  coatMats.push(skirtMat);
  rimify(skirtMat, 1, 0, 0, 0, false, 0, "wool");
  {
    // The coat reads by its sheen and rim more than its dark diffuse, so the shade darkens all of its light, once.
    const rimOnly = skirtMat.onBeforeCompile;
    skirtMat.onBeforeCompile = (sh, r) => {
      rimOnly.call(skirtMat, sh, r);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <color_fragment>", "")
        .replace("#include <opaque_fragment>", "outgoingLight *= vColor.rgb;\n#include <opaque_fragment>");
    };
    skirtMat.customProgramCacheKey = () => "front-rim-skirt";
  }
  mats.push(skirtMat);
  rimify(blackMat, 0.8, 0, 0, 0, false, 0, "leather");
  rimify(gloveMat, 0.8, 0, 0, 0, false, 0, "leather");
  rimify(hairMat, 1.2, 0, 0, HAIR_SHINE, true);
  rimify(skinMat, 0.35, 0.8, 0, 0, false, 0.72);

  let tris = 0;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    tris += (geo.index ? geo.index.count : geo.attributes.position!.count) / 3;
    return m;
  };
  // Plan item 247: parts that never move against their bone and are never touched again (no name, no live
  // geometry) are added with addS and merged per bone and material once she is built: 68 meshes were 68 draw calls
  // (twice over with her shadow), most of them small pieces of black leather riding the same bone.
  const statics: THREE.Mesh[] = [];
  const addS = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = group): void => {
    statics.push(add(geo, mat, parent));
  };

  // A pelvis pivot carries the body above the legs (the weight shift sways it); the chest carries breathing.
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  group.add(pelvis);
  const chest = new THREE.Group();
  chest.position.set(0, 0.24, 0);
  pelvis.add(chest);

  // ---- legs and heeled boots (in the group: the feet stay planted) ----
  // Contrapposto: her weight on the right leg, the left a half step forward, turned out, its knee bent. Plan item
  // 271: dark sheer tights to the ankle (a warm skin under charcoal, with a sheen down the shin that shapes the knee
  // and calf), then heeled ankle boots in glossy leather on a lighter sole and a stacked heel, so the foot reads as
  // a boot with a heel and a sole at the class pick, not as two black tubes on spikes.
  const tightsMat = phone
    ? new THREE.MeshStandardMaterial({ color: 0x33231f, roughness: 0.38, metalness: 0 })
    : new THREE.MeshPhysicalMaterial({ color: 0x33231f, roughness: 0.42, metalness: 0, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x8a6050) });
  mats.push(tightsMat);
  rimify(tightsMat, 0.8);
  const bootMat = phone
    ? new THREE.MeshStandardMaterial({ color: 0x120e0d, roughness: 0.22, metalness: 0.08 })
    : new THREE.MeshPhysicalMaterial({ color: 0x120e0d, roughness: 0.3, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.18 });
  mats.push(bootMat);
  rimify(bootMat, 1);
  // The sole's edge and the stacked heel: a worn tan leather, a step lighter than the upper.
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.6, metalness: 0 });
  mats.push(soleMat);
  rimify(soleMat, 0.7);
  // Plan item 247: both legs' tights are one mesh (one draw call, not two).
  const thighs: THREE.BufferGeometry[] = [];
  const legs: THREE.Mesh[] = [];
  for (const side of [1, -1]) {
    const free = side > 0; // her left leg: forward, the knee bent
    const fwd = free ? 0.05 : 0;
    const hip = V(0.078 * side, 0.92, 0.0);
    const knee = V(0.068 * side, 0.5, 0.012 + fwd * 0.6 + (free ? 0.03 : 0));
    const ankle = V(0.075 * side + (free ? 0.012 : 0), 0.105, -0.005 + fwd);
    // Thigh: full at the top, slim to the knee.
    thighs.push(turned(hip, knee, [[0, 0.066], [0.15, 0.068], [0.45, 0.06], [0.8, 0.047], [1, 0.042]], seg(14), 0.92));
    // The knee cap and the shin: a knee that swells a little, a full calf high on the back, a slim ankle. Plan item
    // 319 slice 69: a fuller calf and ankle (0.05/0.025 -> 0.055/0.029), so below the hem at P she stands on legs
    // with a shape, not two straight sticks.
    thighs.push(turned(knee.clone().add(V(0, 0.02, 0)), ankle.clone().add(V(0, 0.04, 0)), [[0, 0.044], [0.06, 0.046], [0.14, 0.043], [0.3, 0.055], [0.46, 0.052], [0.7, 0.038], [0.88, 0.031], [1, 0.029]], seg(14), 0.9));
    // The ankle boot: a shaft from above the ankle bone with a turned cuff, the instep down to the ball, a pointed
    // toe box flat on the ground.
    // The free foot turns out about 25 degrees, so its heel and the sole's arch show in profile to the camera.
    const out = free ? 0.42 : 0.08;
    const along = (d: number, y: number) => V(ankle.x + Math.sin(out) * d * side, y, ankle.z + Math.cos(out) * d);
    const ball = along(0.1, 0.03);
    const toe = along(0.165, 0.016);
    addS(turned(V(ankle.x, 0.205, ankle.z - 0.004), V(ankle.x, 0.08, ankle.z - 0.01), [[0, 0.036], [0.08, 0.036], [0.12, 0.031], [0.6, 0.029], [1, 0.034]], seg(12), 0.95), bootMat);
    addS(turned(along(-0.03, 0.1), ball, [[0, 0.034], [0.4, 0.034], [1, 0.03]], seg(10), 0.7, Math.PI / 2), bootMat);
    addS(turned(ball, toe, [[0, 0.03], [0.5, 0.026], [0.85, 0.014], [1, 0.004]], seg(10), 0.55, Math.PI / 2), bootMat);
    // The sole: a lighter slab under the toe box, its edge standing proud of the upper, and the arch's welt rising
    // from the ball to the heel's top.
    addS(turned(along(0.05, 0.009), along(0.17, 0.007), [[0, 0.031], [0.4, 0.035], [0.85, 0.02], [1, 0.007]], seg(10), 0.32), soleMat);
    addS(turned(along(0.06, 0.02), along(-0.045, 0.08), [[0, 0.026], [1, 0.024]], seg(8), 0.22), soleMat);
    // The stacked heel: a tapered block, 7 cm, under the back of the boot.
    const heel = new THREE.CylinderGeometry(0.016, 0.011, 0.075, 8);
    heel.scale(1, 1, 1.3);
    heel.rotateY(out * side);
    const hp = along(-0.04, 0.0375);
    heel.translate(hp.x, hp.y, hp.z);
    addS(heel, soleMat);
  }
  legs.push(add(mergeGeometries(thighs)!, tightsMat));

  // A contact shadow under her: soft, darkest under the boots (ambient occlusion the street's lights can't give).
  const shadowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      grd.addColorStop(0, "rgba(0,0,0,0.85)");
      grd.addColorStop(0.45, "rgba(0,0,0,0.5)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
  mats.push(shadowMat);
  // The contact shadow and the two shoe blobs, baked into one mesh (plan item 247: one draw call, not three); the
  // blobs come after the pool in the index, so they still darken over it.
  const shadowGeo = mergeGeometries([
    new THREE.PlaneGeometry(0.62, 0.5).rotateX(-Math.PI / 2).translate(0.005, 0.004, 0.04),
    ...[1, -1].map((side) => new THREE.PlaneGeometry(0.13, 0.26).rotateX(-Math.PI / 2).translate(0.08 * side, 0.005, 0.06 + (side > 0 ? 0.05 : 0))),
  ]);
  const contact = new THREE.Mesh(shadowGeo!, shadowMat);
  contact.renderOrder = -1;
  group.add(contact);

  // ---- the trench: body lathe from collar to hem (belted waist), hem rows driven by the Verlet ring ----
  // Profile in the pelvis frame (y up from the pelvis pivot at 0.92 m).
  const coatProfile: Array<[number, number]> = [
    [0.001, 0.555],
    [0.07, 0.55],
    // Plan item 147: a tailored line, not a box: the shoulders slope and round off (no square corner), the
    // chest and back taper to a cinched waist, and below the belt the skirt flares to the hem.
    [0.105, 0.53], // collar base
    // Plan item 319 slice 73: 7 mm narrower at the shoulder (the 11-13 critique: wide boxy shoulders under a small head).
    [0.151, 0.505], // shoulder slope
    [0.168, 0.47], // the rounded shoulder
    [0.164, 0.42],
    [0.158, 0.34], // chest
    [0.136, 0.24],
    [0.106, 0.12], // the belted waist
    [0.132, 0.05],
    [0.174, -0.05], // hips
    [0.202, -0.19],
    [0.232, -0.33],
    [0.266, -0.46], // the hem, just below the knee: the skirt flares from the belt
    [0.262, -0.475],
  ];
  const HEM_FROM = 10; // profile rows from here down follow the hem particles
  const coatSegs = seg(48); // plan item 271: enough segments to carry the skirt's folds in the silhouette
  // LatheGeometry faces outward when the profile climbs: hem first.
  coatProfile.reverse();
  const HEM_ROWS = coatProfile.length - HEM_FROM;
  const coatGeo = lathe(coatProfile, coatSegs, 0.7);
  {
    // Folds: the skirt falls in soft pleats below the belt (more at the hem), a back vent and a front overlap.
    const p = coatGeo.attributes.position as THREE.BufferAttribute;
    // Plan item 271: each fold's trough in its own shade (an illustrator's fold shadow: the street's flats alone left
    // crest and trough within 1.3:1), and the back pleat's split a dark line.
    const shade = new Float32Array(p.count * 3).fill(1);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.08) continue;
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z / 0.7);
      if (r < 1e-4) continue;
      const a = Math.atan2(z / 0.7, x);
      const depth = Math.min(1, (0.08 - y) / 0.5);
      // Deep, irregular drape folds (a turned cone reads as a mannequin): two families plus a sharper crease.
      const fold = Math.sin(a * 7 + 0.6) * 0.5 + Math.sin(a * 13 + 2.1) * 0.3 + Math.pow(Math.abs(Math.sin(a * 5 + 1.3)), 6) * 0.55;
      // A back vent: the two skirts part a little at the back below the hips.
      const vent = Math.max(0, 1 - Math.abs(Math.atan2(x, -z / 0.7)) / 0.18) * Math.max(0, (-0.12 - y) / 0.35);
      // Plan item 271: deeper at the hem, and a pinched trough between crests so each fold casts its own shade.
      const trough = -Math.pow(Math.max(0, -Math.sin(a * 7 + 0.6)), 3) * 0.6;
      const k = 1 + (fold + trough) * 0.2 * depth * depth - vent * 0.05;
      // Plan item 247: the hem was a flat ring (one height all round). Cloth hangs lower at a fold's crest and rides
      // up in its trough, the front overlap drops a little past the skirt and the vent lifts where it parts.
      const hemK = THREE.MathUtils.smoothstep(-y, 0.33, 0.46);
      const front = Math.max(0, Math.sin(a));
      const dy = hemK * (-0.014 * fold - 0.016 * front * front * front + 0.03 * vent);
      p.setXYZ(i, x * k, y + dy, z * k);
      const lit = THREE.MathUtils.smoothstep(fold + trough, -0.75, 0.55);
      const fade = Math.min(1, (0.08 - y) / 0.14);
      const c = 1 + fade * (0.5 * lit - 0.68 * (1 - lit) - 0.5 * vent);
      shade.fill(Math.max(0.3, c), i * 3, i * 3 + 3);
    }
    coatGeo.setAttribute("color", new THREE.BufferAttribute(shade, 3));
    coatGeo.computeVertexNormals();
  }
  const coat = add(coatGeo, skirtMat, pelvis);
  coat.name = "coat";
  const coatRest = (coatGeo.attributes.position!.array as Float32Array).slice();
  // The belt and its buckle, and a popped collar.
  const belt = new THREE.TorusGeometry(0.112, 0.015, 6, seg(28));
  belt.rotateX(Math.PI / 2);
  belt.scale(1, 1, 0.72);
  belt.translate(0, 0.12, 0);
  addS(belt, blackMat, pelvis);
  // The popped collar: open at the throat (a gap at the front), flaring out as it rises, and the notched lapels
  // folded back over the chest; double-breasted buttons; epaulettes on the shoulders; a buckle on the belt.
  {
    const open = 1.15; // radians left open at the front
    // Plan item 319: a lower stand (it rose to her chin, a lone slab beside the jaw in three-quarter view) that
    // folds over at the top and falls outward, so the collar shows a rolled edge of cloth, not a cut sheet.
    const pts = [
      // Slice 44: the stand 1.6 cm lower and the fold rounder, so in three-quarter view the far side lies as a soft
      // roll on the shoulder (it stood 5 cm over it, a slab with a flat top beside her neck at D).
      [0.1, 0.495],
      [0.104, 0.525],
      [0.11, 0.55],
      [0.117, 0.56],
      [0.123, 0.558],
      // Plan item 319 slice 20: rounder (22 -> 32 sides). Slice 21: the fall slopes down onto the shoulder (it ended
      // at y 0.542, hanging 3 cm over the coat's shoulder slope, so in three-quarter view the far side stood as a
      // level slab with air under it); now it lies on the cloth like a turned-down collar.
      [0.129, 0.548],
      [0.135, 0.535],
      [0.141, 0.524],
      [0.147, 0.515],
    ].map(([r, y]) => new THREE.Vector2(r!, y!));
    // Lathe angle 0 faces +x; +z (her front) is at π/2 in three's lathe (x = sin, z = cos): start past the gap.
    const collar = new THREE.LatheGeometry(pts, Math.max(24, seg(32)), open / 2, Math.PI * 2 - open);
    {
      // Plan item 9: a collar that stands tallest at the back and falls toward the front, its stand rolling out
      // over the top (it read as a uniform funnel round her neck), so her jaw and hair show at the sides.
      const p = collar.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const r = Math.hypot(x, z) || 1;
        const front = Math.max(0, z / r);
        const up = Math.min(1, (y - 0.495) / 0.06);
        // The front corners fall onto the lapels' tops (the gorge), joining collar and lapel.
        // Slice 44: the back stands a fifth lower and the fall's outer edge curls down onto the coat, so in
        // three-quarter view the far side reads as a rolled collar, not a slab with a flat top over the shoulder.
        const back = Math.max(0, -z / r);
        const ny = 0.495 + (y - 0.495) * (1 - 0.5 * front * front - 0.2 * back);
        const roll = 1 + 0.02 * up * up * (1 - front);
        p.setXYZ(i, x * roll, ny, z * roll);
      }
    }
    // Slice 44: squashed front to back nearer the coat's own 0.7 (0.82 stood it off the coat's back and front).
    collar.scale(1, 1, 0.76);
    collar.computeVertexNormals();
    // Its own material: the collar is seen from inside too (double-sided), the coat is not (no shadow acne).
    const collarMat = coatMat.clone();
    collarMat.side = THREE.DoubleSide;
    coatMats.push(collarMat);
    rimify(collarMat, 1, 0, 0, 0, false, 0, "wool");
    mats.push(collarMat);
    const collarMesh = add(collar, collarMat, pelvis);
    collarMesh.name = "collar";
    statics.push(collarMesh);
  }
  // The coat's radius at a height in the pelvis frame, from its profile (for laying things on its surface).
  const rAtCoat = (y: number) => {
    for (let i = 0; i < coatProfile.length - 1; i++) {
      const [r0, y0] = coatProfile[i]!;
      const [r1, y1] = coatProfile[i + 1]!;
      if ((y - y0) * (y - y1) <= 0 && y0 !== y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return 0.15;
  };
  for (const side of [1, -1]) {
    // A lapel. Plan item 147: a notched lapel with a bevelled edge, laid on the chest's curve (it was one flat
    // triangle pair, which caught the light as a pale wedge and showed on one side only): from the collar's
    // corner it widens to the notch under the shoulder, a pointed peak, then narrows down to the top button.
    // Plan item 319: the lapels open into a V over her cream silk blouse (VISION's bible), their inner edges
    // meeting low at the top button (they ran straight down at x 0.04 over a closed front, two pale-edged flaps).
    const outline: Array<[number, number]> = [
      [0.036, 0.505],
      [0.1, 0.462],
      [0.112, 0.425], // the notch
      [0.098, 0.418],
      [0.138, 0.398], // the peak
      [0.118, 0.35],
      [0.078, 0.296],
      [0.03, 0.268],
      [0.004, 0.276],
    ];
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x * side, y)));
    // Plan item 319: tessellated before it is laid on the chest (the extrusion's face was only its nine outline
    // points, so between them it stayed a flat card), its face welded so it shades as one rolled cloth surface.
    const lap = mergeVertices(
      new TessellateModifier(phone ? 0.02 : 0.011, 6).modify(
        new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0035, bevelSegments: 2, curveSegments: 1 }),
      ),
      1e-5,
    );
    {
      // Lay it on the coat: the lathe's front surface is z = 0.7 * sqrt(r(y)^2 - x^2), r from the profile. The
      // inner edge stands a touch prouder than the outer, as a lapel rolls.
      const rAt = rAtCoat;
      const p = lap.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const r = rAt(y);
        const surf = 0.7 * Math.sqrt(Math.max(0, r * r - x * x));
        // The roll: the cloth turns over along a line from the collar's corner to the top button, standing proudest
        // just outside it and easing down to lie flat on the chest toward the outer edge (it was linear in x).
        const rollX = 0.036 + ((y - 0.505) / (0.268 - 0.505)) * (0.004 - 0.036);
        const d = Math.max(0, Math.abs(x) - Math.abs(rollX));
        // Slice 43: a fuller roll (0.007 -> 0.012 proud, narrower), so the turned edge catches the light as a soft ridge.
        const roll = 0.001 + 0.012 * Math.exp(-Math.pow((d - 0.01) / 0.024, 2));
        p.setZ(i, surf + 0.0055 + roll + p.getZ(i));
      }
      lap.computeVertexNormals();
      // Plan item 319 slice 34: the lapel's bevelled edge faces the lens like its face. Its sides turned edge-on, so
      // the wool rim lit them full: a pale line round each lapel and down the V read as white flecks on the ink edge
      // (critique, 11-12 08:35); the ink hull still draws the contour. (Moving the lapels onto skirtMat for a vertex
      // shade cost 4 draw calls in a phone firefight, at its budget.)
      const nr = lap.attributes.normal as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < nr.count; i++) {
        v.fromBufferAttribute(nr, i);
        // Slice 43: only the edge-on bevel turns (z under 0.55); the face keeps the chest's curve and the roll, which
        // the old 0.6-0.93 window flattened to face the lens, so each lapel lit as one flat paper card.
        const k = 1 - THREE.MathUtils.smoothstep(v.z, 0.25, 0.55);
        if (k < 1) {
          // Slice 43: the face turns as rolled cloth: up and in along the roll line (it catches the light), and away
          // toward the outer edge and the peak (into shade), so the lapel reads with a lit roll and a shaded fall.
          const px = Math.abs(p.getX(i));
          const py = p.getY(i);
          const rollX = Math.abs(0.036 + ((py - 0.505) / (0.268 - 0.505)) * (0.004 - 0.036));
          const out = THREE.MathUtils.smoothstep(px - rollX, 0.01, 0.09);
          const ridge = Math.exp(-Math.pow((px - rollX - 0.006) / 0.014, 2));
          v.x += side * (0.55 * out - 0.25 * ridge) * (1 - k);
          v.y += (0.3 * ridge - 0.15 * out) * (1 - k);
          v.normalize();
          nr.setXYZ(i, v.x, v.y, v.z);
        }
        if (k > 0) {
          v.set(v.x * (1 - k), v.y * (1 - k), v.z + (1 - v.z) * k).normalize();
          nr.setXYZ(i, v.x, v.y, v.z);
        }
      }
    }
    addS(lap, coatMat, pelvis);
    // Buttons: two columns of three down the front.
    for (let i = 0; i < 3; i++) {
      const bt = new THREE.SphereGeometry(0.009, 8, 6);
      bt.scale(1, 1, 0.5);
      // On the chest's surface (they stood about 2 cm proud of it).
      const by = 0.25 - i * 0.075;
      const br = rAtCoat(by);
      bt.translate(0.06 * side, by, 0.7 * Math.sqrt(Math.max(0, br * br - 0.0036)) + 0.004);
      addS(bt, blackMat, pelvis);
    }
    // Epaulette: a flat strap across the shoulder to the collar.
    const ep = new THREE.BoxGeometry(0.1, 0.012, 0.045);
    ep.rotateZ(-0.38 * side);
    ep.translate(0.129 * side, 0.488, -0.004);
    const epMesh = add(ep, coatMat, pelvis);
    epMesh.name = "epaulette";
    statics.push(epMesh);
  }
  {
    // Plan item 319: the cream silk blouse in the lapels' V, and the fine gold chain with its small leaf pendant
    // (VISION's character bible), laid on the coat's front surface.
    const onCoat = (x: number, y: number, lift: number) => {
      const r = rAtCoat(y);
      return 0.7 * Math.sqrt(Math.max(0, r * r - x * x)) + lift;
    };
    const blouse = new THREE.BufferGeometry();
    {
      // Subdivide down the V so the panel follows the chest's curve, then lay each vertex on the surface. The rows
      // include the coat profile's own heights: a chord across its widest row (0.47) dipped under the coat.
      // Its top runs up over the coat's shoulder line to the throat (a band of coat showed under her neck).
      const TOP = 0.542;
      const ys = [...Array.from({ length: 14 }, (_, j) => TOP - ((TOP - 0.272) * j) / 13), ...coatProfile.map(([, y]) => y).filter((y) => y < TOP && y > 0.272)];
      ys.sort((a, b) => b - a);
      const verts: number[] = [];
      for (let j = 0; j < ys.length - 1; j++) {
        const y0 = ys[j]!;
        const y1 = ys[j + 1]!;
        // Plan item 319: no wider than the lapels' inner corners (x 0.036) above them, less their roll, so no pale wedge of silk
        // shows between a lapel's top edge and the collar (the 'white gaps at the lapels').
        const w0 = Math.min(0.03, (0.052 * (y0 - 0.272)) / 0.248);
        const w1 = Math.min(0.03, (0.052 * (y1 - 0.272)) / 0.248);
        const q = [[-w0, y0], [w1, y1], [w0, y0], [-w0, y0], [-w1, y1], [w1, y1]];
        for (const [x, y] of q) verts.push(x!, y!, onCoat(x!, y!, 0.0035));
      }
      blouse.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      blouse.computeVertexNormals();
    }
    const silkMat = new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 0.42, metalness: 0, emissive: 0x2c241c });
    rimify(silkMat, 0.5);
    mats.push(silkMat);
    addS(blouse, silkMat, pelvis);
    // Under her chin and the collar the V fell into shadow as dark as the coat; silk keeps its own soft light.
    statics[statics.length - 1]!.receiveShadow = false;
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8b25c, roughness: 0.3, metalness: 0.35, emissive: 0x3a2a0c });
    mats.push(goldMat);
    const chainPts = [[-0.034, 0.512], [-0.02, 0.468], [0, 0.444], [0.02, 0.468], [0.034, 0.512]].map(
      ([x, y]) => new THREE.Vector3(x!, y!, onCoat(x!, y!, 0.006)),
    );
    addS(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chainPts), seg(20), 0.0016, 4, false), goldMat, pelvis);
    const leaf = new THREE.SphereGeometry(1, 8, 6);
    leaf.scale(0.0065, 0.012, 0.0025);
    leaf.rotateZ(0.35);
    leaf.translate(0.002, 0.432, onCoat(0, 0.432, 0.007));
    addS(leaf, goldMat, pelvis);
  }
  const buckle = new THREE.TorusGeometry(0.022, 0.005, 4, 4);
  buckle.rotateZ(Math.PI / 4);
  buckle.scale(1.3, 1, 1);
  buckle.translate(0.0, 0.12, 0.09);
  addS(buckle, blackMat, pelvis);
  // Belt tails hanging at her right hip.
  addS(limb(V(-0.1, 0.1, 0.09), V(-0.115, -0.08, 0.1), 0.012, 0.01, 6), blackMat, pelvis);

  // ---- neck, head, the low knot ----
  // Plan item 9: a neck with a shape (slimmer under the jaw, flaring into the shoulders, set a little forward and
  // narrower front to back), not a plain cylinder.
  // Plan item 289: shorter and tapered (the same-person check: a long tube under the head read as a lollipop).
  // Plan item 319 slice 23: slimmer under the jaw (0.035 -> 0.031; the 11-12 05:20 critique read it as wide as the jaw).
  // Slice 73: a touch fuller again (0.031 -> 0.0335) now the head is 1.14: a thin neck under it read as a doll's.
  const neck = turned(V(0, 0.27, -0.004), V(0, 0.41, 0.01), [[0, 0.049], [0.3, 0.0395], [0.7, 0.034], [1, 0.0335]], Math.max(28, seg(32)), 0.86);
  // Plan item 319: the neck in the jaw's shadow, darkest just under it and lit toward the collar (a bright, evenly
  // lit pipe made the head float); vertex colours, so the neck and ears stay one merged draw per bone.
  {
    const p = neck.attributes.position as THREE.BufferAttribute;
    const shade = new Float32Array(p.count * 3);
    // Slice 39: deeper and closer under the jaw (0.58 -> 0.42 over the top third, was a ramp over the whole neck that
    // left the throat as bright as the cheek, so the jaw read only as an outline), and warmer in the shade, as skin is.
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // Slice 57: the sides turn away too (the critique: a wide, straight-sided, evenly lit neck read as a cylinder
      // plugged into the collar): the throat's front stays lit and the sides fall off past half the radius, most
      // under the jaw, so the neck rounds and narrows to the eye.
      const zc = THREE.MathUtils.lerp(-0.004, 0.01, THREE.MathUtils.clamp((y - 0.27) / 0.14, 0, 1));
      const x = p.getX(i), z = (p.getZ(i) - zc) / 0.86;
      const side = THREE.MathUtils.smoothstep(Math.abs(x) / Math.max(1e-5, Math.hypot(x, z)), 0.2, 0.97);
      // Slice 76: the jaw's shadow starts lower (0.33..0.395 -> 0.3..0.385): since slice 72 lowered the head, its jaw
      // hid the shaded top and the bare neck under the chin lit as bright as the cheek (a pale pipe at the title).
      const jaw = 0.58 * THREE.MathUtils.smoothstep(y, 0.3, 0.385);
      const d = Math.min(0.72, jaw + side * (0.36 + 0.14 * THREE.MathUtils.smoothstep(y, 0.3, 0.38)) * (1 - jaw * 0.5));
      shade[i * 3] = 1 - d * 0.9;
      shade[i * 3 + 1] = 1 - d;
      shade[i * 3 + 2] = 1 - d * 1.05;
    }
    neck.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  }
  skinMat.vertexColors = true;
  addS(neck, skinMat, chest);
  const headPivot = new THREE.Group();
  // Plan item 289: the head a step larger (1.08) and set lower, so the neck shows ~30% less above the collar.
  // Plan item 319 slice 40: 4 mm lower (0.428 -> 0.424), since the jaw line's rise toward the ear bared that much
  // more neck under it.
  // Plan item 319 slice 72: a step larger again (1.08 -> 1.14) and 6 mm lower: the 11-13 critique read a small head
  // on a long thin neck over wide shoulders, a doll's head on a mannequin.
  headPivot.position.set(0, 0.418, 0.014);
  headPivot.scale.setScalar(1.14);
  chest.add(headPivot);
  // The head: an egg with a jaw. The lower front narrows to a chin, the cheekbones sit high, a small nose; C14 (S9.5,
  // the wardrobe sees her from the front): shallow eye sockets under a soft brow, full cheekbones, a lip line.
  // Plan item 319: dense enough that the jaw, chin and cheek planes hold their own curves (40x28, and 24x17 on a
  // phone, drew the jaw as straight facets at a 70 px+ face); a phone keeps 64x44 however low its segment scale.
  const skull = new THREE.SphereGeometry(1, Math.max(64, seg(80)), Math.max(44, seg(56)));
  // Plan item 319 slice 24: the skull's lids and lips also shade it. The face's key wraps wide (slice 13), so the
  // modelled lids and lips barely turned from it and the face read as a decal on a smooth egg (critique, 11-12
  // 05:20). The same relief that displaces the skull is evaluated per pixel from the face's UVs (a phone's skull has
  // rows 0.07 apart, wider than the lid's crease): a soft top light from its slope (the lid fold's underside and the
  // upper lip turned down go darker, the lid's top and the lower lip catch it) and a little cavity where it dips.
  {
    const p = skull.attributes.position as THREE.BufferAttribute;
    // Plan item 319 slice 25: smooth bumps ((1 - r^2)^2), not cones: a cone's slope breaks at its rim and its peak,
    // and the cheek's rim drew a corner in the jaw's silhouette.
    const bump = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
      const q = 1 - Math.min(1, ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      return q * q;
    };
    const shadeRelief = (x: number, y: number): number => {
      let r = 0;
      for (const [amp, cx, cy, rx, ry, mirror] of FACE_RELIEF) {
        const sb = (bx: number) => {
          const q = 1 - Math.min(1, ((x - bx) / rx) ** 2 + ((y - cy) / ry) ** 2);
          return q * q;
        };
        r += amp * (mirror ? sb(cx) + sb(-cx) : sb(cx));
      }
      return r;
    };
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const front = Math.max(0, z);
      // Sockets, brow, cheekbones and lips, on the front only (normalised head units).
      let dz = shadeRelief(x, y);
      for (const sx of [-1, 1]) {
        dz -= 0.07 * Math.pow(bump(x, y, 0.36 * sx, 0.06, 0.2, 0.13), 1.5);
        // Plan item 319 slice 2: the brow ridge under the painted brow (it sat a brow's width below it, so the brow
        // was painted on a slope), carried out to the brow's tail.
        dz += 0.04 * bump(x, y, 0.38 * sx, 0.29, 0.3, 0.09);
        // Plan item 319 slice 2: the eye modelled in its socket: a rounded ball under the painted almond, and the upper
        // lid a fold above it, so the eye catches the key along the lid and turns away at the corners.
        dz += 0.032 * bump(x, y, 0.39 * sx, 0.055, 0.22, 0.12);
        // Plan item 319 slice 25: the cheek's fullness lower and broader (0.05 at y -0.2, 0.26x0.2 -> 0.038 at -0.17,
        // 0.32x0.3), so it runs into the jaw's taper instead of bulging out and turning a corner at the jaw.
        // Slice 40: higher and shorter (-0.17, 0.3 tall -> -0.13, 0.25), so its foot no longer widens the jaw's side.
        dz += 0.038 * bump(x, y, 0.5 * sx, -0.13, 0.32, 0.25);
        // Plan item 275: the cheek planes: a ridge along the cheekbone and a hollow below it, angled down toward the
        // mouth's corner, so the side of the face turns away from the key in a plane, not a smooth curve.
        dz += 0.03 * bump(x, y, 0.52 * sx, -0.08, 0.2, 0.07);
        // Plan item 319: shallower (0.045 -> 0.015) now the denser skull resolves it: at full depth it lit as a
        // grey smudge beside each corner of her mouth.
        dz -= 0.015 * Math.pow(bump(x, y, 0.5 * sx, -0.4, 0.17, 0.13), 1.2);
      }
      // Plan item 319 slice 2: the lips modelled, not one blob: the upper lip a forward band along the painted bow, the
      // lower lip fuller under it, and the hollow between the lower lip and the chin, so the mouth has a lit lower lip
      // and a shaded upper one from the mesh, as the paint has.
      // Slice 24: the lids and lips now live in shadeRelief (deeper, and shading as well as displacing).
      // Plan item 319 slice 40: the chin modelled forward. Below the mouth the egg turned down in one broad plane
      // from the lip to the jaw's edge (view normal.y < -0.45 all the way), so the lower face read as a flat,
      // heavy underside. A soft mound under the lip's hollow brings the chin's front up to face the lens, and its
      // underside turns away in a shorter, quicker curve.
      dz += 0.085 * bump(x, y, 0, -0.8, 0.3, 0.24);
      z += dz * front;
      // Jaw: below the cheekbones the sides draw in, the chin comes forward.
      if (y < 0) {
        const k = -y;
        // Plan item 260: a heart-shaped face, not an egg: the cheeks draw in sooner (k^1.5, so no crease at the
        // cheekbone line) to a narrower, pointed chin.
        // Plan item 275: a softer point and a shorter chin (the long V read as a mannequin's at title distance).
        // Plan item 289: 0.42 -> 0.48, a narrower chin (the shorter face read wide at the jaw).
        // Plan item 319 slice 15: 0.48 -> 0.54 (the critique, 11-12, read the jaw wide and the lower face long).
        // Plan item 319 slice 25: the jaw starts without a kink: `ks` eases in over the cheekbone line (k < 0.15) so
        // the chin's push and the face's shortening don't crease the face at eye level, and the front's push forward
        // and the back's draw-in blend across the side (z -0.25..0.25), where the two branches met in a step that
        // drew a hard corner at the jaw in three-quarter view.
        const ks = k < 0.15 ? (k * k) / 0.3 : k - 0.075;
        // Slice 25: drawn in more gradually (0.54 k^1.6 -> 0.5 k^1.25), so the jaw's angle is a curve, not a corner.
        // Slice 40: the taper starts sooner and ends narrower (0.5 k^1.25 -> 0.56 k^1.1), so the jaw runs in a long
        // convex curve from the cheekbone to a small chin, not straight down the cheek and round a corner.
        x *= 1 - 0.56 * Math.pow(k, 1.1);
        // Slice 40: the jaw line rises from the chin toward the ear: the lower head's sides and back lift (up to 0.11
        // at the side, none at the chin's front), so its underside slopes up and back instead of lying as one flat
        // shelf whose edge met the cheek in a corner.
        // Slice 67: under the chin (k > 0.6) the lift is 0.14 and fades only at the chin's front (z 0.3-0.95): the
        // underside behind the chin hung below it as a pale lump under the near cheek at the D pick. The cheek above
        // keeps 0.11 over z 0-0.8 (lifting it too turned the cheek beside the eye and lost the eyes' 3:1 contrast).
        const ss = THREE.MathUtils.smoothstep;
        const lift = ks * THREE.MathUtils.lerp(0.11 * (1 - ss(z, 0.0, 0.8)), 0.14 * (1 - ss(z, 0.3, 0.95)), ss(k, 0.6, 0.9));
        z = THREE.MathUtils.lerp(z * (1 - 0.45 * ks), z * (1 - 0.1 * ks) + 0.06 * ks, THREE.MathUtils.smoothstep(z, -0.25, 0.25));
        // Plan item 289: the lower face shorter (0.95 -> 0.86), a rounder face, not a long flat egg.
        // Plan item 319 slice 15: shorter again (0.86 -> 0.8), so the chin sits closer under her mouth.
        y = -k + 0.2 * ks + lift;
      }
      // Nose: a small, straight ridge from between the eyes, its tip a little above the lip.
      // Plan item 319 slice 19: a rounded profile ((1 - r^2)^2.6, flat-topped with soft sides), not a cone: the cone's
      // sharp apex lit one flank and shaded the other as a hard-edged wedge once the face's key went smooth.
      // Below the tip it falls gently (0.34, not 0.26), so the underside doesn't turn from the key into a dark dot at P.
      const nr = Math.hypot(x / 0.12, (y + 0.2) / (y < -0.2 ? 0.34 : 0.26));
      const nose = nr < 1 ? Math.pow(1 - nr * nr, 2.6) * front : 0;
      z += nose * 0.13;
      p.setXYZ(i, x, y, z);
    }
  }
  skull.scale(0.072, 0.098, 0.088);
  skull.translate(0, 0.0, 0.01);
  skull.computeVertexNormals();
  // The cap's shape before its scale and tilt: `v` 0..1 from the crown to the hairline, `az` 0 at her front.
  // Plan item 175: shared with the locks laid over it.
  // Plan item 319 slice 50: f^2.2 (was 3.2): the hairline falls from the parting to the temples on a rounder curve,
  // so the forehead is a soft arch rather than flat across the top with a corner where it dropped to the temple.
  // Slice 60: the front reaches a little further (0.43 -> 0.415), so the forehead is shorter and the cap's edge sits
  // lower on the skull, not a skull-cap above a tall, bare brow.
  const capReach = (az: number) => {
    const f = Math.max(0, Math.cos(az));
    const peak = Math.exp(-(az * az) / 0.02) * 0.025;
    return Math.PI * (0.8 - 0.415 * Math.pow(f, 2.2)) + peak * Math.PI;
  };
  const capShape = (v: number, az: number, out = 0) => {
    const polar = v * capReach(az);
    let x = Math.sin(polar) * Math.sin(az);
    let y = Math.cos(polar);
    let z = Math.sin(polar) * Math.cos(az);
    const part = Math.max(0, 1 - Math.abs(x) / 0.1) * Math.max(0, z) * Math.max(0, y) * 0.05;
    const crown = (1 + Math.max(0, y) * Math.max(0, -z) * 0.08 + 0.05 * (1 - Math.max(0, y)) * (1 - Math.max(0, z))) * (1 + out);
    x *= crown;
    z *= crown;
    y = y * crown - part;
    return V(x, y, z);
  };
  const capPlace = new THREE.Matrix4().makeTranslation(0, 0.012, -0.004).multiply(new THREE.Matrix4().makeRotationX(-0.2)).multiply(new THREE.Matrix4().makeScale(0.081, 0.104, 0.1));
  // C14: her face, painted (VISION: large bright eyes with a neat winged liner and two highlights, soft brows with
  // the right one a touch raised, a little colour on the cheeks, rose lips in a half-smile). Painted on the skull's
  // own UVs in metres: u = 0.25 is her front, +x her left (the viewer's right), the canvas top is her crown.
  // Plan item 140: painted per expression (smirk on the title, determined, a wink), repainted on a change.
  // Plan item 319 slice 49: the hair cap's front edge in the face's paint coordinates (metres, as paintFace draws),
  // projected from the skull's centre: under it the paint lays a soft shade and fine hairs, so the forehead meets the
  // hair in a feathered hairline instead of the cap's hard cut (the top-left of her forehead in three-quarter view).
  const hairline: Array<[number, number]> = [];
  for (let a = -1.5; a <= 1.5001; a += 0.025) {
    const q = capShape(1, a).applyMatrix4(capPlace);
    const n = V(q.x / 0.072, q.y / 0.098, (q.z - 0.01) / 0.088).normalize();
    const phi = Math.atan2(n.z, -n.x);
    hairline.push([0.072 * (phi - Math.PI / 2), 0.098 * (Math.PI / 2 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)))]);
  }
  const hairLayer = document.createElement("canvas");
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = 2048;
  faceCanvas.height = 1024;
  // Plan item 175: a second face with both eyes shut, the blink's frame (swapped in as the map for ~130 ms, so the
  // material keeps its shader; repainted with the open face on an expression change).
  const blinkCanvas = document.createElement("canvas");
  blinkCanvas.width = faceCanvas.width;
  blinkCanvas.height = faceCanvas.height;
  const paintFace = (expr: FaceExpression, shut = false, into?: HTMLCanvasElement): void => {
    const canvas = into ?? (shut ? blinkCanvas : faceCanvas);
    const W = canvas.width;
    const H = canvas.height;
    const g = canvas.getContext("2d");
    if (g) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#d9ad98";
      g.fillRect(0, 0, W, H);
      // Metres on the face -> canvas: 1 normalised unit is H/π pixels, x in units of 0.072 m, y of 0.098 m.
      const k = H / Math.PI;
      g.setTransform(k / 0.072, 0, 0, -k / 0.098, W / 4, H / 2);
      const blob = (x: number, y: number, rx: number, ry: number, col: string, a: number) => {
        g.save();
        g.translate(x, y);
        g.scale(rx, ry);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, col.replace("A", String(a)));
        gr.addColorStop(1, col.replace("A", "0"));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, 1, 0, Math.PI * 2);
        g.fill();
        g.restore();
      };
      // Shading: warm cheeks, a cooler shadow under the cheekbones and the brow, the lids a touch smoky.
      for (const sx of [-1, 1]) {
        // Plan item 289: more cheek warmth, so the face isn't a pale flat oval at title distance.
        // Plan item 289: the blush higher, on the apples of the cheeks.
        // Plan item 319: softer, warmer and wider (0.74 rose in a 2x1.3 cm oval): after the skin light's saturation
        // lift, the far cheek's blush in a three-quarter view read as a red blotch (a bruise on the class pick).
        blob(0.039 * sx, -0.01, 0.025, 0.016, "rgba(228,124,124,A)", 0.5);
        blob(0.045 * sx, -0.034, 0.016, 0.01, "rgba(120,70,62,A)", 0.22);
        blob(0.026 * sx, 0.011, 0.016, 0.009, "rgba(92,58,62,A)", 0.45);
      }
      // Plan item 9: modelling painted in, so the face holds its shape under a flat light: a contour down each side
      // of the face to the jaw, a highlight down the bridge of the nose and on the brow bone and chin, soft shadow
      // either side of the nose and under the jaw line.
      // Plan item 319 slice 13: the dense skull (slice 1) models its own sides and jaw, so the painted contours there
      // are lighter (0.42/0.3 -> 0.2/0.15): doubled with the real shade they drew a dark band down the far cheek.
      for (const sx of [-1, 1]) {
        blob(0.062 * sx, -0.02, 0.016, 0.05, "rgba(150,88,78,A)", 0.2); // the side planes of the face
        // Plan item 319 slice 65: the hanging hair's shadow on the face's outer edge, temple to jaw, so the cheek
        // turns into the hair rather than ending at it as a hard pale edge (the critique: 'a plate').
        blob(0.074 * sx, -0.012, 0.01, 0.048, "rgba(112,64,58,A)", 0.34);
        blob(0.05 * sx, -0.068, 0.02, 0.012, "rgba(130,76,68,A)", 0.06); // along the jaw (slice 75: 0.15 -> 0.06)
        blob(0.009 * sx, -0.006, 0.004, 0.016, "rgba(150,92,80,A)", 0.22); // either side of the nose
        blob(0.026 * sx, 0.027, 0.016, 0.005, "rgba(255,226,210,A)", 0.3); // the brow bone
        blob(0.034 * sx, -0.006, 0.012, 0.006, "rgba(255,230,214,A)", 0.28); // top of the cheekbone
      }
      blob(0, 0.0, 0.004, 0.02, "rgba(255,232,218,A)", 0.4); // the bridge of the nose
      blob(0, 0.05, 0.02, 0.016, "rgba(255,230,214,A)", 0.22); // the forehead
      blob(0, -0.074, 0.01, 0.006, "rgba(255,228,212,A)", 0.3); // the chin
      // Plan item 260: the underside of the jaw in shadow, so the chin ends in a turned edge, not a pale flat.
      // Plan item 319 slice 75: wider (0.07x0.02 -> 0.095x0.026), so it reaches the near jaw's underside, which the
      // pick's low fill lit as a pale step under a painted jaw band (the 'mask' seam at the D pick).
      blob(0, -0.1, 0.095, 0.026, "rgba(120,66,58,A)", 0.55);
      blob(0, -0.024, 0.008, 0.004, "rgba(110,62,54,A)", 0.26); // under the nose
      blob(0, -0.06, 0.016, 0.006, "rgba(120,72,62,A)", 0.12); // under the lip (slice 33: 0.25 -> 0.12)
      // Plan item 260: a drawn nose (the shadow side of the bridge, a lit tip and two small nostrils) and a deeper
      // contour under the cheekbones, so the face has planes at title distance rather than reading as a smooth egg.
      // Plan item 275: the shadow side of the bridge darker and wider, and a shadow under the tip, so the nose holds.
      // Plan item 319 slice 64: on a phone the shadow side is softer and wider (0.45 -> 0.28) and its stroke starts
      // below the eyes' line at two-thirds strength: at a 57 px face both read as one dark slash between the eyes.
      blob(-0.0062, phone ? -0.011 : -0.008, phone ? 0.0045 : 0.0035, phone ? 0.011 : 0.014, "rgba(132,74,62,A)", phone ? 0.28 : 0.45);
      // Plan item 319 slice 19: the tip's shadow and the nostrils lighter (0.5/0.7 -> 0.32/0.42): at P they merged into
      // one dark dot under a nose the rounded ridge now models.
      blob(0, -0.0225, 0.0085, 0.0032, "rgba(104,56,48,A)", 0.32);
      g.strokeStyle = phone ? "rgba(118,62,52,0.5)" : "rgba(118,62,52,0.8)";
      g.lineCap = "round";
      g.lineWidth = 0.0022;
      g.beginPath();
      g.moveTo(-0.0055, phone ? -0.006 : 0.004);
      g.quadraticCurveTo(-0.0075, -0.012, -0.0068, -0.02);
      g.stroke();
      // Plan item 319 slice 48: the shadow line turns under the tip into the nostril's wing, an illustrator's nose
      // (the critique read a lone faint stroke as a smudge at title distance), thinner as it turns.
      g.lineWidth = 0.0017;
      g.beginPath();
      g.moveTo(-0.0068, -0.02);
      g.quadraticCurveTo(-0.0066, -0.0252, -0.0018, -0.0262);
      g.stroke();
      blob(0.001, -0.019, 0.006, 0.004, "rgba(255,236,222,A)", 0.45);
      g.fillStyle = "rgba(96,48,42,0.42)";
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.ellipse(0.0045 * sx, -0.0245, 0.0022, 0.0011, -0.3 * sx, 0, Math.PI * 2);
        g.fill();
        blob(0.052 * sx, -0.04, 0.012, 0.02, "rgba(140,78,70,A)", 0.24); // slice 13: 0.42 -> 0.24, as above
      }
      // Plan item 319 slice 49: the feathered hairline. A soft warm shade a few millimetres deep under the cap's edge
      // (the hair's own shadow on the forehead), then fine hairs combed back into it, denser at the edge, so the skin
      // fades into the hair rather than ending at the cap's line.
      {
        // Drawn on a layer, then faded out below the brows (y 0.012 -> 0.03 m), so the forehead and temples take it
        // and the cheeks beside the hanging locks don't.
        hairLayer.width = W;
        hairLayer.height = H;
        const h = hairLayer.getContext("2d");
        if (h) {
          h.setTransform(g.getTransform());
          h.lineJoin = "round";
          h.lineCap = "round";
          const path = (dy: number) => {
            h.beginPath();
            hairline.forEach(([x, y], i) => (i ? h.lineTo(x, y + dy) : h.moveTo(x, y + dy)));
          };
          // Slice 60: a deeper shade (0.09/0.13 -> 0.14/0.2), so the edge reads as hair's shadow at D, not a cut.
          // Layered strokes, widest and faintest first, rather than a canvas blur filter (Safari's 2D canvas ignores it).
          for (let w = 0.014; w > 0.0015; w -= 0.0015) {
            h.strokeStyle = w > 0.006 ? "rgba(110,60,50,0.14)" : "rgba(56,32,26,0.2)";
            h.lineWidth = w;
            path(w > 0.006 ? -0.002 : 0);
            h.stroke();
          }
          // Fine hairs: deterministic, 1.1 mm apart, each 1.5-4.5 mm long, leaning away from the face's centre line.
          let seed = 7;
          const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
          for (let i = 1; i < hairline.length; i++) {
            const [x0, y0] = hairline[i - 1]!;
            const [x1, y1] = hairline[i]!;
            const len = Math.hypot(x1 - x0, y1 - y0);
            for (let t = 0; t < len; t += 0.0011) {
              const x = x0 + ((x1 - x0) * t) / len;
              const y = y0 + ((y1 - y0) * t) / len;
              const l = 0.0015 + rnd() * 0.003;
              const lean = Math.sign(x) * (0.25 + rnd() * 0.35);
              h.strokeStyle = `rgba(40,24,20,${(0.35 + rnd() * 0.35).toFixed(2)})`;
              h.lineWidth = 0.0005 + rnd() * 0.0004;
              h.beginPath();
              h.moveTo(x, y + 0.0008);
              h.quadraticCurveTo(x + lean * l * 0.2, y - l * 0.5, x + lean * l * 0.5, y - l);
              h.stroke();
            }
          }
          h.globalCompositeOperation = "destination-in";
          const fade = h.createLinearGradient(0, 0.012, 0, 0.03);
          fade.addColorStop(0, "rgba(0,0,0,0)");
          fade.addColorStop(1, "rgba(0,0,0,1)");
          h.fillStyle = fade;
          h.fillRect(-0.2, -0.2, 0.4, 0.4);
          h.globalCompositeOperation = "source-over";
          g.save();
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.drawImage(hairLayer, 0, 0);
          g.restore();
        }
      }
      // The eyes: almond whites, a hazel iris, the pupil, two highlights, a winged liner and a lower lash line.
      for (const sx of [-1, 1]) {
        // Plan item 140: at title distance (a 120 px face) item 9's eyes read as two dots; 1.3x again, set a little
        // wider, every part of the eye scaled with them (E), the catch-lights larger still.
        // Plan item 289: larger again (1.3 -> 1.5): small eyes under heavy brows read stern.
        const E = 1.5;
        const ex = 0.0285 * sx;
        const ey = 0.006;
        // Plan item 9: larger, brighter eyes (the bible's "large bright eyes"), about a fifth up on C14's.
        const hw = 0.0135 * E;
        const hh = 0.0069 * E;
        // A wink closes her left eye (the viewer's right) to a lashed curve, the wing still out past it; a blink
        // (plan item 175) closes both.
        if (shut || (expr === "wink" && sx > 0)) {
          g.strokeStyle = "#120a08";
          g.lineCap = "round";
          g.lineWidth = 0.0024 * E;
          g.beginPath();
          g.moveTo(ex - hw * sx, ey + hh * 0.2);
          g.quadraticCurveTo(ex, ey - hh * 1.1, ex + hw * sx, ey + hh * 0.5);
          g.lineTo(ex + (hw + 0.0058 * E) * sx, ey + hh * 1.3);
          g.stroke();
          g.strokeStyle = "rgba(110,64,58,0.55)";
          g.lineWidth = 0.001 * E;
          g.beginPath();
          g.moveTo(ex - hw * 0.8 * sx, ey + hh * 1.2);
          g.quadraticCurveTo(ex, ey + hh * 2.2, ex + hw * sx, ey + hh * 1.4);
          g.stroke();
        } else {
        const almond = () => {
          g.beginPath();
          g.moveTo(ex - hw, ey);
          g.bezierCurveTo(ex - hw * 0.5, ey + hh * 1.5, ex + hw * 0.5, ey + hh * 1.6, ex + hw, ey + hh * 0.2);
          g.bezierCurveTo(ex + hw * 0.5, ey - hh * 1.3, ex - hw * 0.5, ey - hh * 1.25, ex - hw, ey);
          g.closePath();
        };
        // Plan item 319 slice 10: a soft warm taupe on the lid under the brow, so the liner sits in make-up, not on bare
        // skin (the critique read a black band over a doll's eye).
        blob(ex + hw * 0.2 * sx, ey + hh * 1.9, hw * 1.15, hh * 1.25, "rgba(118,72,66,A)", 0.34);
        // Plan item 319 slice 32: the open eye a sixth narrower (the lids, liner and lashes squashed about the eye's
        // line; the iris stays round, so the lids cover its top and foot), and the irises turned in a touch rather
        // than out: wide whites round both irises, each set outward, read as a blank, startled stare off camera
        // (critique, 11-12 08:35), not the bible's knowing smirk.
        const lidK = 0.84;
        const squash = () => {
          g.translate(0, ey);
          g.scale(1, lidK);
          g.translate(0, -ey);
        };
        g.save();
        g.save();
        squash();
        almond();
        g.restore();
        // Plan item 260: a warmer white (a pure white read as a doll's stare under the toon key).
        g.fillStyle = "#e4d4cb";
        g.fill();
        g.clip();
        const ix = ex - 0.0005 * E * sx;
        // A hazel iris: a warm amber ring round the pupil, darkening to a limbal ring at the edge.
        // Plan item 260: a larger iris, less white round it (the bible's "large bright eyes" are the iris).
        const ir = 0.0082 * E;
        const iris = g.createRadialGradient(ix, ey + 0.0004, 0, ix, ey + 0.0004, ir);
        // Plan item 205: a deeper hazel, so the eye holds as a dark shape at title distance (3:1 on the cheek).
        // Plan item 260: a warm amber core, so the iris reads hazel under the toon flats rather than grey.
        // Plan item 289: a brighter amber core (the same-person check read the iris as dull grey-brown).
        iris.addColorStop(0, "#8a561c");
        iris.addColorStop(0.45, "#9a6424");
        iris.addColorStop(0.8, "#32200f");
        iris.addColorStop(1, "#1e120a");
        g.fillStyle = iris;
        g.beginPath();
        g.ellipse(ix, ey + 0.0004, ir, ir * (0.072 / 0.098) * 1.36, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#2e1c10";
        g.beginPath();
        g.ellipse(ix, ey + 0.0004, ir, ir * (0.072 / 0.098) * 1.36, 0, 0, Math.PI * 2);
        g.lineWidth = 0.0012 * E;
        g.strokeStyle = "#24160c";
        g.stroke();
        g.beginPath();
        g.ellipse(ix, ey + 0.0004, 0.0046 * E, 0.0046 * E, 0, 0, Math.PI * 2);
        g.fill();
        // The lid's shadow across the top of the iris.
        // Plan item 275: a heavier lid: its shadow lies across the top third of the iris, so the look is hers, not a
        // doll's stare.
        // Plan item 319 slice 10: lighter (0.78 -> 0.55), so the iris's top reads as shaded hazel, not a black bar.
        g.fillStyle = "rgba(40,20,16,0.55)";
        g.fillRect(ex - hw, ey + hh * 0.45, hw * 2, hh * 1.3);
        g.fillStyle = "#fffaf4";
        g.beginPath();
        // Plan item 275: two small, sharp catchlights (item 9's broad ones washed the iris to grey at title distance).
        g.ellipse(ix - 0.0026 * E, ey + 0.0026 * E, 0.0019 * E, 0.0016 * E, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(ix + 0.0026 * E, ey - 0.0024 * E, 0.0009 * E, 0.0008 * E, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        g.save();
        squash();
        // The liner: heavier on the upper lid, out to a wing that lifts past the outer corner.
        g.fillStyle = "#120a08";
        const ox = ex + hw * sx;
        g.beginPath();
        g.moveTo(ex - hw * sx * 1.02, ey - 0.0002);
        g.bezierCurveTo(ex - hw * 0.5 * sx, ey + hh * 1.55, ex + hw * 0.5 * sx, ey + hh * 1.65, ox, ey + hh * 0.25);
        // Plan item 205: a heavier upper line and a longer wing (the liner is what reads at title distance).
        // Plan item 319 slice 10: a slim line that thickens outward to a sharp, lifted wing (the critique: a heavy band
        // over the lid, no visible wing). The line is about two-thirds of item 205's depth; the wing runs further out and up.
        g.lineTo(ox + 0.0118 * E * sx, ey + hh * 2.45);
        g.lineTo(ox - 0.0004 * E * sx, ey + hh * 1.0);
        g.bezierCurveTo(ex + hw * 0.45 * sx, ey + hh * 3.0, ex - hw * 0.5 * sx, ey + hh * 2.2, ex - hw * sx * 1.02, ey - 0.0002);
        g.closePath();
        g.fill();
        // Plan item 260: three lashes flicked out from the outer half of the lid, so the liner reads as lashes too.
        g.strokeStyle = "#120a08";
        g.lineCap = "round";
        g.lineWidth = 0.0016 * E;
        for (const [f, l] of [[0.25, 0.0042], [0.55, 0.0052], [0.82, 0.0058]] as const) {
          const lx = ex + hw * (f * 2 - 1) * 0.9 * sx;
          const ly = ey + hh * (1.9 - 0.9 * f * f);
          g.beginPath();
          g.moveTo(lx, ly);
          g.quadraticCurveTo(lx + l * 0.35 * sx, ly + l * 0.8, lx + l * 0.9 * sx, ly + l * 0.95);
          g.stroke();
        }
        g.strokeStyle = "rgba(30,16,12,0.9)";
        g.lineWidth = 0.002 * E;
        g.beginPath();
        g.moveTo(ex - hw * 0.7 * sx, ey - hh * 0.95);
        g.quadraticCurveTo(ex + hw * 0.3 * sx, ey - hh * 1.35, ex + hw * sx, ey + hh * 0.1);
        g.stroke();
        // The lid crease.
        g.strokeStyle = "rgba(110,64,58,0.55)";
        g.lineWidth = 0.001 * E;
        g.beginPath();
        g.moveTo(ex - hw * 0.8 * sx, ey + hh * 2.1);
        g.quadraticCurveTo(ex + hw * 0.1 * sx, ey + hh * 3.3, ex + hw * 1.05 * sx, ey + hh * 1.9);
        g.stroke();
        g.restore();
        }
        // Soft brows, her right (sx -1) a touch higher at the arch.
        // Plan item 140: higher over the larger eyes, a little fuller and longer.
        // Determined: both level, drawn down at the inner ends. A wink lowers the winking side's brow.
        // Plan item 275: the bible's raised right brow, there in every look (most in the smirk), and clear at title distance.
        const raise = sx < 0 ? (expr === "smirk" ? 0.0068 : expr === "wink" ? 0.0042 : 0.0026) : 0;
        // Plan item 289: set higher over the larger eyes, lighter and arched.
        const by = 0.0315 + raise - (expr === "wink" && sx > 0 ? 0.0018 : 0);
        const inner = expr === "determined" ? -0.0034 : 0;
        // Plan item 205: a fuller, darker brow, so it holds as a stroke at title distance.
        // Plan item 275: fuller at the head, tapering to the tail, peaking two-thirds out.
        // Plan item 319 slice 9: a dark warm brown, not near-black, and a fifth slimmer at the head (the critique
        // read thick dark bars), still a stroke at title distance.
        // Plan item 319 slice 57: a third deeper again, its lower edge bowed further and the head fuller, and a
        // shade darker, so the brows hold as strokes on a 57 px phone face (the critique: brows gone at P).
        g.fillStyle = "#1e0f08";
        g.beginPath();
        g.moveTo(0.0085 * sx, by - 0.0012 + inner);
        // Plan item 319 slice 42: the raised brow also arches (its peak lifts by most of the raise again, its head and
        // tail don't), so it reads as one quizzical brow, not a level pair set at two heights (the critique: level
        // brows, a flat expression).
        const arch = raise * 0.8;
        g.quadraticCurveTo(0.03 * sx, by + 0.0102 + arch, 0.0475 * sx, by - 0.0036 - arch * 0.3);
        // Plan item 289: a deeper brow body (the lower edge bowed down), so the brows hold as strokes at title distance.
        g.quadraticCurveTo(0.03 * sx, by + 0.0002 + arch, 0.0085 * sx, by - 0.0084 + inner);
        g.closePath();
        g.fill();
      }
      // Rose lips in a half-smile: her left corner lifts a little.
      // Plan item 140: fuller (1.3x) and a deeper, more saturated rose, so they read as lips at title distance.
      const my = -0.047;
      g.save();
      g.translate(0, my);
      // The corners: the smirk lifts her left (the viewer's right), a wink both, determined presses them level.
      // Plan item 319 slice 9: the smirk's lifted corner higher (0.0038 -> 0.0056): it read as a neutral line.
      const [lc, rc] = expr === "determined" ? [0.0006, 0.0008] : expr === "wink" ? [0.0028, 0.004] : [0.0018, 0.0056];
      // Plan item 289: a little wider again (1.3 -> 1.42), so the rose mouth carries at title distance.
      g.scale(1.42, expr === "determined" ? 1.18 : 1.45);
      g.translate(0, -my);
      g.fillStyle = "#b02a4c";
      g.beginPath();
      g.moveTo(-0.0165, my + lc);
      g.bezierCurveTo(-0.009, my + 0.0058, -0.003, my + 0.0072, 0, my + 0.0048);
      g.bezierCurveTo(0.003, my + 0.0072, 0.009, my + 0.0062, 0.0168, my + rc);
      g.bezierCurveTo(0.009, my - 0.0072, -0.009, my - 0.0078, -0.0165, my + lc);
      g.closePath();
      g.fill();
      // Plan item 275: the upper lip turned from the light (deeper rose) under a lit edge along the cupid's bow.
      g.fillStyle = "#86203c";
      g.beginPath();
      g.moveTo(-0.0165, my + lc);
      g.bezierCurveTo(-0.009, my + 0.0058, -0.003, my + 0.0072, 0, my + 0.0048);
      g.bezierCurveTo(0.003, my + 0.0072, 0.009, my + 0.0062, 0.0168, my + rc);
      g.bezierCurveTo(0.008, my + 0.0018, -0.008, my + 0.0012, -0.0165, my + lc);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,226,214,0.75)";
      g.lineWidth = 0.0009;
      g.beginPath();
      g.moveTo(-0.012, my + 0.0058);
      g.bezierCurveTo(-0.006, my + 0.0084, -0.0025, my + 0.0088, 0, my + 0.0064);
      g.bezierCurveTo(0.0025, my + 0.0088, 0.006, my + 0.0086, 0.0124, my + 0.0062);
      g.stroke();
      g.strokeStyle = "#5e1e28";
      g.lineWidth = 0.0011;
      g.beginPath();
      g.moveTo(-0.0165, my + lc);
      g.bezierCurveTo(-0.008, my + 0.0012, 0.008, my + 0.0018, 0.0168, my + rc);
      g.stroke();
      // Plan item 319 slice 59: the smirk's lifted corner tucks into a short soft crease that curls up past it (the
      // critique read the lifted corner alone as a blank look; the bible's default is a confident half-smile).
      if (expr === "smirk" || expr === "wink") {
        g.strokeStyle = "rgba(94,30,40,0.6)";
        g.lineWidth = 0.0012;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(0.0158, my + rc - 0.0006);
        g.quadraticCurveTo(0.0196, my + rc + 0.0004, 0.0204, my + rc + 0.0034);
        g.stroke();
      }
      // The gloss on the lower lip.
      blob(0.003, my - 0.0032, 0.0062, 0.0017, "rgba(255,232,236,A)", 0.8);
      g.restore();
    }
  };
  let faceExpr: FaceExpression = "smirk";
  paintFace(faceExpr);
  paintFace(faceExpr, true);
  let faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 4;
  // Plan item 275: one open-faced map per expression, painted once and kept, so the title's turn between two looks
  // swaps a map instead of repainting and re-uploading 2048x1024 every 10 s (a frame hitch on a phone).
  const faceTexes = new Map<FaceExpression, THREE.CanvasTexture>([[faceExpr, faceTex]]);
  const faceMap = (e: FaceExpression): THREE.CanvasTexture => {
    let tex = faceTexes.get(e);
    if (!tex) {
      const c = document.createElement("canvas");
      c.width = faceCanvas.width;
      c.height = faceCanvas.height;
      paintFace(e, false, c);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      faceTexes.set(e, tex);
    }
    return tex;
  };
  const blinkTex = new THREE.CanvasTexture(blinkCanvas);
  blinkTex.colorSpace = THREE.SRGBColorSpace;
  blinkTex.anisotropy = 4;
  // Plan item 306: matte skin (0.5 laid a broad white sheen over the face under the pick's strong key).
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: faceTex, roughness: 0.82, metalness: 0, fog: false });
  rimify(faceMat, 0.25, 1, 4);
  // Plan item 319 slice 24: the relief's shade multiplies the face's final light (after item 306's skin light, which
  // rebuilds the light from the albedo's luminance and so would cancel it as an albedo or vertex colour). A touch
  // warmer in the shade (skin's subsurface red), so the crease and the mouth's line read as skin, not grime.
  // Slice 33: warmer again (green and blue 0.05/0.1 -> 0.14/0.26 of the shade), so the lip's underside reads rose.
  {
    const rim = faceMat.onBeforeCompile.bind(faceMat);
    const f = (n: number) => n.toFixed(4);
    const terms = FACE_RELIEF.map(([amp, cx, cy, rx, ry, mirror]) =>
      mirror
        ? `r += ${f(amp)} * ( rb( p, vec2( ${f(cx)}, ${f(cy)} ), vec2( ${f(rx)}, ${f(ry)} ) ) + rb( p, vec2( ${f(-cx)}, ${f(cy)} ), vec2( ${f(rx)}, ${f(ry)} ) ) );`
        : `r += ${f(amp)} * rb( p, vec2( ${f(cx)}, ${f(cy)} ), vec2( ${f(rx)}, ${f(ry)} ) );`,
    ).join("\n");
    const fn = `float rb( vec2 p, vec2 c, vec2 r ) { vec2 d = ( p - c ) / r; float q = 1.0 - min( 1.0, dot( d, d ) ); return q * q; }
float faceRelief( vec2 p ) { float r = 0.0; ${terms} return r; }
float reliefShade( vec2 uv ) {
  float th = ( 1.0 - uv.y ) * PI, ph = uv.x * PI2;
  float st = sin( th );
  vec2 p = vec2( -cos( ph ) * st, cos( th ) );
  float front = max( 0.0, sin( ph ) * st );
  const float e = 0.004;
  float fy = ( faceRelief( p + vec2( 0.0, e ) ) - faceRelief( p - vec2( 0.0, e ) ) ) / ( 2.0 * e );
  float s = 1.0 - ${f(RELIEF_SLOPE)} * clamp( fy, -0.6, 0.8 ) + ${f(RELIEF_CAVITY)} * min( 0.0, faceRelief( p ) );
  return mix( 1.0, clamp( s, 0.78, 1.15 ), front );
}`;
    faceMat.onBeforeCompile = (sh, r) => {
      rim(sh, r);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\n${fn}`)
        .replace(
          "#include <opaque_fragment>",
          "{ float rs = reliefShade( vMapUv ); outgoingLight *= rs * vec3( 1.0, 1.0 - 0.14 * max( 0.0, 1.0 - rs ), 1.0 - 0.26 * max( 0.0, 1.0 - rs ) ); }\n#include <opaque_fragment>",
        );
    };
    const key = faceMat.customProgramCacheKey.bind(faceMat);
    faceMat.customProgramCacheKey = () => `${key()}-relief`;
  }
  mats.push(faceMat);
  addS(skull, faceMat, headPivot);
  // Hair: a glossy shell over the crown, swept back from a centre parting, full at the sides over the tops of the
  // ears, gathered at the nape into a low twisted knot (CATHODE's work look).
  // Plan item 9: the cap's rows are laid out between the crown and a hairline that depends on the azimuth (high at the
  // forehead with a soft peak at the centre parting, sweeping down past the temples, low over the ears and the nape),
  // so its front edge is one smooth curve instead of a deformed sphere's saw-tooth.
  const cap = new THREE.SphereGeometry(1, seg(96), seg(22), 0, Math.PI * 2, 0, 1);
  {
    const p = cap.attributes.position as THREE.BufferAttribute;
    // az 0 = her front (+z), the hairline's polar reach (`capReach`, shared with the locks and the painted hairline).
    const reach = capReach;
    for (let i = 0; i < p.count; i++) {
      const x0 = p.getX(i);
      const y0 = p.getY(i);
      const z0 = p.getZ(i);
      const v = Math.acos(THREE.MathUtils.clamp(y0, -1, 1)); // 0..1 rad: the row's share of the way down
      const az = Math.atan2(x0, z0);
      const polar = v * reach(az);
      let x = Math.sin(polar) * Math.sin(az);
      let y = Math.cos(polar);
      let z = Math.sin(polar) * Math.cos(az);
      // The parting: a shallow groove down the middle at the front; volume at the crown; soft waves at the sides.
      const part = Math.max(0, 1 - Math.abs(x) / 0.1) * Math.max(0, z) * Math.max(0, y) * 0.05;
      const crown = 1 + Math.max(0, y) * Math.max(0, -z) * 0.08 + 0.05 * (1 - Math.max(0, y)) * (1 - Math.max(0, z));
      // Combed strands from the parting: ridges that run down and back, catching the back light.
      const ridge = 1 + 0.006 * Math.sin(az * 34 + polar * 3) * (0.4 + 0.6 * Math.max(0, y));
      x *= crown * ridge;
      z *= crown * ridge;
      y = y * crown - part;
      void x0;
      p.setXYZ(i, x, y, z);
    }
  }
  cap.scale(0.081, 0.104, 0.1);
  cap.rotateX(-0.2);
  cap.translate(0, 0.012, -0.004);
  cap.computeVertexNormals();
  addS(cap, hairMat, headPivot);
  // Plan item 147: the long hair's rest positions, so the update can sway its lower lengths in the wind.
  let hairRest: Float32Array | null = null;
  let hairGeo: THREE.BufferGeometry | null = null;
  let hairCols = 0;
  let hairRows = 0;
  let lockGeo: THREE.BufferGeometry | null = null;
  // Plan item 319: the index count of the sheet's locks alone, before the face-framing wisps and curtains: under the
  // Ghost's hood the draw range stops there, so the hood holds her hair back off her face.
  let lockSheetIdx = Infinity;
  let lockRest: Float32Array | null = null;
  // Per lock vertex: its place on the sheet's grid (column, row), so it sways with the sheet under it.
  let lockAt: Float32Array | null = null;
  // Plan item 319: under the Ghost's hood the long hair is tucked in: the rest positions pulled inside the hood and
  // the cowl and gathered at its hem, so no sheet of hair hangs out over the coat behind her shoulder. `kit` swaps
  // the rest arrays (the sway still runs on whichever is current).
  let hairRestOpen: Float32Array | null = null;
  let hairRestTuck: Float32Array | null = null;
  let lockRestOpen: Float32Array | null = null;
  let lockRestTuck: Float32Array | null = null;
  const tuckHair = (src: Float32Array): Float32Array => {
    // The cowl's inner wall (its lathe profile less its deepest fold and the sway), about the sheet's own axis.
    const wall: Array<[number, number]> = [[0.09, -0.04], [0.082, -0.07], [0.086, -0.105], [0.098, -0.145], [0.114, -0.185], [0.13, -0.215]];
    const R = (y: number): number => {
      if (y >= wall[0]![1]) return Infinity;
      for (let i = 1; i < wall.length; i++) {
        const [r1, y1] = wall[i]!;
        const [r0, y0] = wall[i - 1]!;
        if (y >= y1) return r0 + ((r1 - r0) * (y0 - y)) / (y0 - y1);
      }
      return wall[wall.length - 1]![0];
    };
    const out = new Float32Array(src);
    for (let i = 0; i < out.length; i += 3) {
      let y = out[i + 1]!;
      if (y >= -0.04) continue;
      // Gathered at the hem: the lengths below the cowl's foot fold up inside it.
      if (y < -0.2) y = -0.2 + (y + 0.2) * 0.06;
      const x = out[i]!;
      const z = out[i + 2]! + 0.02;
      const r = Math.hypot(x, z);
      const lim = R(y);
      const k = r > lim ? lim / r : 1;
      out[i] = x * k;
      out[i + 1] = y;
      out[i + 2] = z * k - 0.02;
    }
    return out;
  };
  // The long hair (VISION's character bible: very long, glossy, centre-parted, falling in soft waves): one draped
  // sheet from under the cap, out over the collar and down her back to the shoulder blades, waved, with uneven ends.
  {
    const cols = seg(40);
    const rows = seg(24);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    // Down the sheet: [radius out from the head's axis (m), height (m), how far round the front it reaches (rad)].
    const prof: Array<[number, number, number]> = [
      [0.084, -0.0, 1.45],
      [0.098, -0.06, 1.35],
      [0.135, -0.13, 1.25],
      [0.172, -0.19, 1.18],
      [0.19, -0.3, 1.1],
      [0.188, -0.44, 1.02],
      [0.18, -0.56, 0.95],
    ];
    const at = (t: number) => {
      const k = Math.min(prof.length - 2, Math.floor(t * (prof.length - 1)));
      const f = t * (prof.length - 1) - k;
      const a = prof[k]!;
      const b = prof[k + 1]!;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] as const;
    };
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const [rad, y, open] = at(t);
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        // From her right side round the back to her left: az from π - (π - open) .. π + (π - open).
        const az = Math.PI + (u * 2 - 1) * (Math.PI - open);
        const wave = 1 + (0.03 + 0.05 * t) * Math.sin(u * 22 + t * 9) + 0.02 * Math.sin(u * 61);
        const ends = r === rows ? 0.035 * Math.sin(u * 37) + 0.02 * Math.sin(u * 13) : 0;
        pos.push(Math.sin(az) * rad * wave, y + ends, Math.cos(az) * rad * wave * 0.86 - 0.02);
        uv.push(u * 3, 1 - t);
      }
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const sheet = new THREE.BufferGeometry();
    sheet.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    hairRest = hairRestOpen = new Float32Array(pos);
    hairRestTuck = tuckHair(hairRestOpen);
    hairGeo = sheet;
    hairCols = cols;
    hairRows = rows;
    sheet.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    sheet.setIndex(idx);
    sheet.computeVertexNormals();
    const hairSheetMat = hairMat.clone();
    hairSheetMat.side = THREE.DoubleSide;
    // Plan item 289: no shine ring on the long hair: its locks lie over her chest facing up to the lens, so the ring lit
    // a whole lock as a pale ribbon; the street lights' own gloss (the sheen) carries it there.
    // Plan item 319 slice 61: the sheet's inside (the curtain's side toward her neck and cheek) sits in its own shade,
    // as the hood's lining does: lit like the outside it drew grey, jagged strands beside her far cheek.
    rimify(hairSheetMat, 1.2, 0, 0, 0, true, 0, "flat", 0.4);
    mats.push(hairSheetMat);
    add(sheet, hairSheetMat, headPivot);

    // Plan item 175: locks laid over the sheet, so the hair reads as layered strands rather than one shell: each
    // a rounded ribbon a few centimetres wide that follows the sheet's waves just outside it, emerging under the
    // cap and tapering to a point past the sheet's ends, its shine band shifted a little so the band breaks from
    // lock to lock. One merged mesh on the sheet's material; it sways with the sheet's own formula (`lockAt`).
    const lp: number[] = [];
    const luv: number[] = [];
    const lidx: number[] = [];
    const lockAtArr: number[] = [];
    let sd = 11;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const LOCKS = 18;
    const ALONG = 12;
    for (let i = 0; i < LOCKS; i++) {
      const uc = i === 0 ? 0.025 : i === LOCKS - 1 ? 0.975 : (i + 0.5) / LOCKS + (rnd() - 0.5) * 0.025;
      const du = 0.03 + rnd() * 0.02;
      const t0 = 0.04 + rnd() * 0.12;
      const t1 = 0.8 + rnd() * 0.26;
      const lift = 0.004 + rnd() * 0.005;
      const dv = (rnd() - 0.5) * 0.08;
      const curl = (rnd() - 0.5) * 0.03;
      const base = lp.length / 3;
      for (let a = 0; a <= ALONG; a++) {
        const s = a / ALONG;
        const t = t0 + (t1 - t0) * s;
        const tc = Math.min(1, t);
        const [rad0, y0, open] = at(tc);
        const yExtra = t > 1 ? -(t - 1) * 0.6 : 0;
        // Narrow where it emerges, full through the length, then to a point.
        const w = du * (0.55 + 0.45 * Math.min(1, s / 0.2)) * (1 - 0.92 * Math.pow(s, 3));
        const uMid = uc + curl * Math.sin(s * Math.PI);
        for (let j = 0; j < 3; j++) {
          const u = THREE.MathUtils.clamp(uMid + (j - 1) * w * 0.5, 0, 1);
          const az = Math.PI + (u * 2 - 1) * (Math.PI - open);
          const wave = 1 + (0.03 + 0.05 * tc) * Math.sin(u * 22 + tc * 9) + 0.02 * Math.sin(u * 61);
          // Rounded across: the middle stands proud of the edges.
          const rad = rad0 * wave + lift + (j === 1 ? 0.0045 : 0) * (1 - s * 0.6);
          lp.push(Math.sin(az) * rad, y0 + yExtra, Math.cos(az) * rad * 0.86 - 0.02);
          luv.push(uMid * 3 + (j - 1) * 0.16, 1 - t + dv);
          lockAtArr.push(u * cols, Math.min(1, t) * rows);
        }
      }
      for (let a = 0; a < ALONG; a++)
        for (let j = 0; j < 2; j++) {
          const p0 = base + a * 3 + j;
          const p1 = p0 + 3;
          lidx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
        }
    }
    // Locks over the cap, combed back from the centre parting and down past the temples to the hairline, each a
    // little proud of the shell (they don't sway: the cap holds them).
    const CAP_LOCKS = 26;
    for (let i = 0; i < CAP_LOCKS; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const n = Math.floor(i / 2) / (CAP_LOCKS / 2 - 1);
      const az0 = side * (0.06 + rnd() * 0.05);
      const az1 = side * (0.55 + n * 2.3 + (rnd() - 0.5) * 0.15);
      const v0 = 0.04 + rnd() * 0.05;
      const v1 = 0.9 + rnd() * 0.12;
      // Plan item 319: laid close and wide (was 0.025-0.045 proud, 0.09-0.14 wide, a 1.8% ridge), so the locks
      // overlap into combed hair instead of standing off the cap as stepped cards.
      const w0 = 0.13 + rnd() * 0.05;
      const out = 0.008 + rnd() * 0.008;
      const dv = (rnd() - 0.5) * 0.06;
      const base = lp.length / 3;
      for (let a = 0; a <= ALONG; a++) {
        const s = a / ALONG;
        const v = v0 + (v1 - v0) * s;
        // Swept: it leaves the parting heading back, then turns down over the side of the head.
        const az = az0 + (az1 - az0) * Math.pow(s, 0.7);
        const w = w0 * (0.5 + 0.5 * Math.min(1, s / 0.25)) * (1 - 0.85 * Math.pow(s, 4));
        for (let j = 0; j < 3; j++) {
          const pt = capShape(Math.min(1.02, v), az + (j - 1) * w * 0.5, out + (j === 1 ? 0.007 : 0)).applyMatrix4(capPlace);
          lp.push(pt.x, pt.y, pt.z);
          luv.push(0.4 + i * 0.37 + (j - 1) * 0.16, 1 - (0.08 + v * 0.42) + dv);
          lockAtArr.push(0, 0);
        }
      }
      for (let a = 0; a < ALONG; a++)
        for (let j = 0; j < 2; j++) {
          const p0 = base + a * 3 + j;
          const p1 = p0 + 3;
          lidx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
        }
    }
    // Plan item 260: two curtains framing her face from the centre parting, over the temples, down past the cheeks
    // and the jaw to the front of her shoulders, waved, so the hair reads as long soft waves round the face (the
    // bible's look) rather than a cap behind it. Kept just off the skull (`skullZ`); the lower lengths sway.
    const skullZ = (x: number, y: number): number => {
      // The skull's jaw (plan item 275: 0.42 k^1.6, the chin at 0.95).
      const k = y < 0 ? Math.min(1, -y / 0.098 / 0.86) : 0;
      const xn = x / 0.072 / (1 - 0.48 * Math.pow(k, 1.6));
      const yn = y / (y < 0 ? 0.098 * 0.86 : 0.098);
      const r = 1 - xn * xn - yn * yn;
      return r > 0 ? 0.01 + 0.088 * Math.sqrt(r) : -1;
    };
    // Plan item 275: one waved strand of the given width (wk) and wave (wa) along `keys`; the curtains, and the loose
    // wisps at the temples, all in the one lock mesh (no draw call).
    const STRAND_COLS = 5;
    const strand = (keys: THREE.Vector3[], sx: number, wk: number, wa: number, sway: boolean, phase = 0): void => {
      const curve = new THREE.CatmullRomCurve3(keys, false, "centripetal");
      const N = 40;
      const base = lp.length / 3;
      const tan = new THREE.Vector3();
      const nrm = new THREE.Vector3();
      const side = new THREE.Vector3();
      for (let a = 0; a <= N; a++) {
        const s = a / N;
        const c = curve.getPoint(s);
        curve.getTangent(s, tan);
        nrm.set(c.x, c.y > 0 ? c.y * 0.6 : 0, c.z - 0.0).normalize();
        side.crossVectors(tan, nrm).normalize();
        // Narrow at the parting, full past the cheek, then to a point; a soft wave across the lower length.
        // Plan item 319: the ends blunt (to 45%, not 10%) and the wave long and shallow (1.4 cycles, 6 mm; was 2.5
        // cycles of 8 mm to a point), so a lock over the coat reads as a soft wave of hair, not a flame.
        const w = wk * (0.008 + 0.02 * Math.min(1, s / 0.35)) * (1 - 0.55 * Math.pow(Math.max(0, (s - 0.7) / 0.3), 1.5));
        const wave = s > 0.4 ? Math.sin((s - 0.4) * 15 + phase * THREE.MathUtils.smoothstep(s, 0.62, 0.85)) * 0.006 * wa * Math.min(1, (s - 0.4) / 0.15) : 0;
        // Plan item 319 slice 41: five columns in a rounded arch whose edges sink back (was three in a shallow tent
        // with the edges level with the base), so a lock over the coat turns round its width like a bundle of hair,
        // with soft edges, not a flat card with a crease down it.
        for (let j = 0; j < STRAND_COLS; j++) {
          const t = (j - (STRAND_COLS - 1) / 2) / ((STRAND_COLS - 1) / 2);
          const arch = 1 - t * t;
          const q = c.clone().addScaledVector(side, t * w * 0.5);
          q.x += wave * sx;
          q.addScaledVector(nrm, 0.0045 * wk * arch - 0.0015 * wk * t * t);
          if (q.y < 0.04 && q.y > -0.11) q.z = Math.max(q.z, skullZ(q.x, q.y) + 0.005 + 0.003 * arch);
          lp.push(q.x, q.y, q.z);
          luv.push(0.2 + (sx + 1) * 0.6 + t * 0.16 * wk, 1 - (0.06 + s * 0.7));
          const r = sway ? Math.max(0, (s - 0.45) / 0.55) * hairRows * 0.8 : 0;
          lockAtArr.push(sway ? (sx > 0 ? cols : 0) : 0, r);
        }
      }
      for (let a = 0; a < N; a++)
        for (let j = 0; j < STRAND_COLS - 1; j++) {
          const p0 = base + a * STRAND_COLS + j;
          const p1 = p0 + STRAND_COLS;
          // Plan item 319: wound to face out (they faced the skull, so the lens saw their insides, with a quarter rim).
          lidx.push(p0, p0 + 1, p1, p1, p0 + 1, p1 + 1);
        }
    };
    lockSheetIdx = lidx.length;
    for (const sx of [-1, 1]) {
      // Plan item 275: two loose wisps per side, out of the hairline at the temple, down past the outer eye to the
      // jaw, so the face is framed by strands, not the shell's edge.
      for (const [dz, dx, len] of [[0, 0, 1], [0.004, 0.008, 0.8]] as const)
        strand([
          capShape(0.78, (0.42 + dx * 4) * sx, 0.05).applyMatrix4(capPlace),
          // Plan item 319: outside the cheekbone (was 0.066, 0.068, 0.06, 0.064), so the far wisp edges her face.
          V((0.072 + dx) * sx, 0.012, 0.046 + dz),
          V((0.076 + dx) * sx, -0.03 * len, 0.04 + dz),
          V((0.072 + dx) * sx, -0.07 * len, 0.036 + dz),
          V((0.074 + dx) * sx, -0.1 * len, 0.034 + dz),
        ], sx, 0.28, 0.5, false);
      const keys = [
        capShape(0.1, 0.1 * sx, 0.04).applyMatrix4(capPlace),
        capShape(0.55, 0.36 * sx, 0.05).applyMatrix4(capPlace),
        capShape(0.97, 0.62 * sx, 0.045).applyMatrix4(capPlace),
        // Plan item 319: past the cheekbone (was 0.07, 0.064, 0.074 at z 0.036-0.03), so in three-quarter view the
        // far curtain frames her cheek instead of lying across it as a dark slab.
        V(0.079 * sx, -0.012, 0.03),
        V(0.077 * sx, -0.07, 0.022),
        V(0.086 * sx, -0.122, 0.046),
        // Plan item 319 slice 26: below the jaw the curtain falls onto the front of the shoulder, outside the collar
        // and the lapel (it ran down the chest at x 0.104-0.11, through the lapel's roll, to the belt).
        V(0.11 * sx, -0.17, 0.09),
        V(0.134 * sx, -0.23, 0.104),
        V(0.143 * sx, -0.3, 0.096),
        V(0.147 * sx, -0.37, 0.09),
      ];
      // Plan item 319 slice 18: the curtain splits below the jaw into three thinner locks that fan apart and end at
      // different lengths (one 3.5 cm ribbon hung straight down the lapel and read as a plank on the coat front).
      // They share the face-framing top, so round the face it still reads as one curtain.
      // Plan item 319 slice 70: the three lie closer (spread 0.016/-0.012 -> 0.008/-0.006) and fuller (x1.2), so over
      // the coat they read as one waved curtain parting at its ends, not three thin strings ('stringy ribbons').
      for (const [k, spread, cut, wk, ph] of [[0, 0, 0, 0.74, 0], [1, 0.008, 1, 0.6, 1.7], [2, -0.006, 2, 0.55, 3.1]] as const) {
        // Same key count for each (dropping keys re-timed each lock's wave, braiding them at the cheek); a shorter
        // lock pulls its last key up toward the one before.
        const ks = keys.map((q, n) => {
          if (n === keys.length - 1 && cut > 0) q = q.clone().lerp(keys[n - 1]!, 0.45 * cut);
          const f = Math.max(0, (n - 5) / 4);
          return V(q.x + spread * f * sx, q.y + (k === 0 ? 0 : 0.01 * f), q.z + Math.abs(spread) * f * 0.6 + k * 0.002);
        });
        strand(ks, sx, 1.25 * wk, 1, true, ph);
      }
    }
    // Plan item 319 slice 74: a soft side-swept fringe from the parting across the top of her forehead to her right
    // temple (the side toward the lens), where it tucks into the curtain: the cap's edge met bare skin in one hard curve (the 11-13 critique's
    // 'skull-cap hairline'). Kept above the brows (y 0.03+ until the temple) and just off the skull (`skullZ`).
    {
      const sk = (x: number, y: number, lift: number) => V(x, y, Math.max(skullZ(x, Math.min(y, 0.05)), 0.04) + lift);
      strand([
        capShape(0.84, 0.05, 0.02).applyMatrix4(capPlace),
        sk(-0.008, 0.062, 0.005),
        sk(-0.036, 0.053, 0.005),
        sk(-0.058, 0.036, 0.005),
        V(-0.073, 0.006, 0.05),
      ], -1, 1.15, 0.25, false);
    }
    const locks = new THREE.BufferGeometry();
    locks.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
    locks.setAttribute("uv", new THREE.Float32BufferAttribute(luv, 2));
    locks.setIndex(lidx);
    locks.computeVertexNormals();
    lockGeo = locks;
    lockRest = lockRestOpen = new Float32Array(lp);
    lockRestTuck = tuckHair(lockRestOpen);
    lockAt = new Float32Array(lockAtArr);
    add(locks, hairSheetMat, headPivot).name = "cath-hair-locks";
  }
  // Ears: small shells under the hair's side sweep, a pearl stud in each lobe.
  for (const side of [1, -1]) {
    const ear = new THREE.SphereGeometry(1, seg(10), seg(8));
    ear.scale(0.008, 0.02, 0.013);
    ear.rotateY(side * 0.35);
    ear.translate(0.07 * side, -0.012, -0.004);
    ear.setAttribute("color", new THREE.BufferAttribute(new Float32Array(ear.attributes.position!.count * 3).fill(1), 3));
    addS(ear, skinMat, headPivot);
  }
  // Pearl studs catch the back light.
  // Plan item 319 slice 51: a stud's size (8 mm across, was 15) and a warmer, dimmer pearl: since slice 40's jaw rose
  // toward the ear, the big white bead stood alone between her cheek and the locks, a pale lump at D.
  const pearlMat = new THREE.MeshStandardMaterial({ color: 0xd8cec2, roughness: 0.3, metalness: 0.1, emissive: 0x161210 });
  mats.push(pearlMat);
  for (const side of [1, -1]) {
    const p = new THREE.SphereGeometry(0.004, 8, 6);
    p.translate(0.074 * side, -0.03, 0.0);
    addS(p, pearlMat, headPivot);
  }
  const head = new THREE.Object3D();
  headPivot.add(head);

  // ---- arms: her right holds the umbrella up, her left hangs with the cigarette ----
  // Set-in sleeves: full at the shoulder seam (inside the coat's shoulder line, so no ball shows), easing to the
  // elbow, flaring a touch at the cuff with a strap; black leather gloves with a thumb.
  const sleeve = (sh: THREE.Vector3, el: THREE.Vector3, wr: THREE.Vector3, parent: THREE.Object3D, fore: THREE.Object3D = parent) => {
    // Plan item 147: the upper sleeve tapers into the elbow ball (its flat end showed as a rim with the forearm
    // starting inside it), and the forearm starts just outside both, so the join reads as a soft fold.
    // A straight arm (her left at rest) showed the forearm's wider start as a step, so the radii now meet at the
    // elbow (0.039) and only the bend's fold shows.
    // Plan item 175: the upper sleeve runs 1.2 cm past the elbow (its corner stays inside the ball at a full bend) and gathers there (a fold over the forearm), and
    // the forearm's closed start sits inside the elbow ball at a smaller radius, so a bent arm never swings the
    // forearm's rim out of the sleeve (at D it caught the light as a capsule top at the elbow).
    const ud = el.clone().sub(sh).normalize();
    const upLen = sh.distanceTo(el);
    const past = 0.012;
    const k = upLen / (upLen + past);
    // Plan item 227: the sleeve map's v runs 0 to 0.5 down the upper sleeve and 0.5 to 1 down the forearm.
    // Plan item 319 slice 71: the sleeve head domes over the shoulder point (it started as a 3 cm flat cap that
    // swelled to 5.2 cm in 1.5 cm, a square corner where the shoulder met the sleeve: 'a boxy shoulder').
    addS(vSpan(turned(sh, el.clone().addScaledVector(ud, past), [[0, 0.014], [0.025 * k, 0.036], [0.06 * k, 0.047], [0.12 * k, 0.052], [0.3 * k, 0.05], [0.8 * k, 0.0425], [0.93 * k, 0.0405], [k, 0.0395], [k + (1 - k) * 0.5, 0.038], [1, 0.0365]], seg(24), 0.9), 0, 0.5), sleeveMat, parent);
    // The elbow: a ball inside the sleeve so the bend never opens a gap between upper arm and forearm.
    // Plan item 319 slice 63: 0.041 -> 0.0375, inside the sleeve's gathered end (0.037) and the forearm's (0.0375 at
    // 0.2): wider than both, it stood out below the sleeve's end as a ring round the elbow (critique, D pick). The
    // upper sleeve's last 6 cm taper to it as well (0.042 -> 0.0395 at the elbow, 0.0365 at its end), so the outline
    // runs on into the forearm instead of stepping in under a wider tube's end.
    const elb = new THREE.SphereGeometry(0.0375, seg(24), seg(12));
    elb.scale(1, 1, 0.92);
    elb.translate(el.x, el.y, el.z);
    addS(vSpan(elb, 0.5, 0.5), sleeveMat, fore);
    const foreA = el.clone().addScaledVector(ud, -0.006);
    // Plan item 319 slice 58: the forearm stays inside the upper sleeve's gathered end (0.037) for its first 3 cm
    // and only then eases out, so a straight arm's outline runs on from the upper sleeve: at 0.0405 just below the
    // elbow it stood wider than the sleeve's end, two stacked tubes with a ring between them (critique, D pick).
    const foreProf: Array<[number, number]> = [[0, 0.026], [0.06, 0.034], [0.12, 0.0362], [0.2, 0.0375], [0.5, 0.0385], [0.86, 0.042], [0.96, 0.044], [1, 0.03]];
    addS(vSpan(turned(foreA, wr, foreProf, seg(24), 0.9), 0.5, 1), sleeveMat, fore);
    parent = fore;
    // The cuff strap. Plan item 319: a flat leather band laid on the sleeve, following its oval, not a round ring
    // (a torus round the oval sleeve stood off it at the sides and read as a floating bracelet).
    const d = wr.clone().sub(foreA).normalize();
    const tAt = 1 - 0.04 / foreA.distanceTo(wr);
    addS(cuffBand(wr.clone().addScaledVector(d, -0.04), d, profR(foreProf, tAt), 0.9, seg(24)), gloveMat, parent);
  };
  // Plan item 319 slice 73: the shoulder joints 7 mm in, with the coat's narrower shoulder line.
  const shoulderR = V(-0.143, 0.25, -0.005);
  const elbowR = V(-0.192, 0.0, 0.07);
  const handR = V(-0.085, 0.12, 0.185);
  const wristR = handR.clone().add(V(-0.012, -0.045, -0.03));
  // Plan item 227: her umbrella arm never moves against her chest, so it is one sleeve: a single tube along a curve
  // through shoulder, elbow and wrist (the elbow a soft bend, not a ball between two cylinders), full at the
  // shoulder, easing to the elbow, then a turned-back cuff over the glove.
  {
    const curve = new THREE.CatmullRomCurve3([shoulderR, shoulderR.clone().lerp(elbowR, 0.55), elbowR, elbowR.clone().lerp(wristR, 0.5), wristR], false, "centripetal");
    const T = seg(28);
    // Plan item 319 slice 14: 24 sides round (was 12), so the cuff's open end and its ink line are round, not an
    // octagon beside the umbrella fist at D; the sleeves, elbow ball and cuff straps likewise.
    const R = seg(24);
    const tube = new THREE.TubeGeometry(curve, T, 1, R, false);
    const upLen = shoulderR.distanceTo(elbowR);
    const sE = upLen / (upLen + elbowR.distanceTo(wristR));
    const prof = (x: number, pts: Array<[number, number]>) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [t0, r0] = pts[i]!;
        const [t1, r1] = pts[i + 1]!;
        if (x <= t1) return r0 + ((r1 - r0) * (x - t0)) / (t1 - t0 || 1);
      }
      return pts[pts.length - 1]![1];
    };
    const radius = (s: number) =>
      s < sE
        ? prof(s / sE, [[0, 0.052], [0.3, 0.05], [0.8, 0.043], [1, 0.0415]])
        : prof((s - sE) / (1 - sE), [[0, 0.0415], [0.2, 0.0405], [0.5, 0.0385], [0.78, 0.041], [0.84, 0.0455], [0.93, 0.0465], [0.96, 0.042], [1, 0.03]]);
    const pos = tube.attributes.position as THREE.BufferAttribute;
    const uv = tube.attributes.uv as THREE.BufferAttribute;
    const c = new THREE.Vector3();
    for (let i = 0; i <= T; i++) {
      const s = i / T;
      curve.getPointAt(s, c);
      const r = radius(s);
      const v = s < sE ? (0.5 * s) / sE : 0.5 + (0.5 * (s - sE)) / (1 - sE);
      for (let j = 0; j <= R; j++) {
        const o = i * (R + 1) + j;
        pos.setXYZ(o, c.x + (pos.getX(o) - c.x) * r, c.y + (pos.getY(o) - c.y) * r, c.z + (pos.getZ(o) - c.z) * r);
        uv.setXY(o, j / R, v);
      }
    }
    tube.computeVertexNormals();
    add(tube, sleeveMat, chest).name = "cath-sleeve-r";
    // The cuff strap, on the turn-back.
    // Plan item 319: a flat band on the sleeve (see the left arm's).
    addS(cuffBand(curve.getPointAt(0.9), curve.getTangentAt(0.9), radius(0.9), 1, seg(24)), gloveMat, chest);
  }
  // Plan item 147: her right hand is a gloved fist round the umbrella's shaft, not a mitt: the back of the hand
  // outside the shaft, four fingers curling round its front (index highest, the little finger smallest), the
  // thumb over the index. Built round the shaft's rest axis in the chest frame (the umbrella twirls in its own
  // group; her grip stays).
  {
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0, 0.06));
    const at = (v: THREE.Vector3) => v.applyQuaternion(rest).add(handR);
    // Toward the wrist, across the shaft: where the back of her hand sits.
    const back = wristR.clone().sub(handR).setY(0).normalize();
    const tb = Math.atan2(back.z, back.x);
    const parts: THREE.BufferGeometry[] = [];
    // The back of the hand: a flattened pad outside the shaft, knuckles up.
    const pad = new THREE.SphereGeometry(1, seg(10), seg(8));
    pad.scale(0.016, 0.044, 0.03);
    pad.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), back));
    const padAt = at(back.clone().multiplyScalar(0.02).add(V(0, -0.002, 0)));
    pad.translate(padAt.x, padAt.y, padAt.z);
    parts.push(pad);
    // Four fingers: each a tube from the knuckle round the shaft's front, ending curled in toward the palm.
    // Plan item 319 slice 11: the fingers press together (a fifth fuller, set 13.5 mm apart, was 14-15) and each runs
    // down the shaft as it wraps, so the fist reads as one gloved grip, not ribs with dark gaps between them.
    const fingers: Array<[number, number, number]> = [
      [0.02, 0.0096, 1.45],
      [0.0065, 0.0099, 1.5],
      [-0.007, 0.0094, 1.45],
      [-0.0198, 0.0082, 1.3],
    ];
    // Plan item 319 slice 2: each finger three tapering bones with knuckles between them, not one smooth tube (four
    // equal rings round the shaft read as a stack of washers close up). The joints stand out from the shaft so the
    // straight bones clear it, the knuckles of the fist proud; the index wraps furthest and each finger sits a little
    // further round than the one below, so the grip reads as a hand.
    for (const [fi, [y, r, wrap]] of fingers.entries()) {
      const R = 0.0075 + r + 0.0008;
      const a0 = -0.55 + fi * 0.06;
      const a1 = Math.PI * wrap - 0.55;
      const joint = (u: number, out: number) => {
        const a = tb + a0 + (a1 - a0) * u;
        return at(V(Math.cos(a) * R * out, y - u * 0.011, Math.sin(a) * R * out));
      };
      // Plan item 319 slice 38: the knuckles stand only a little proud (1.3 -> 1.14) and each bone is fuller, so
      // neighbouring fingers overlap into one gloved grip; proud joints caught the leather gloss as a string of beads.
      const pts = [joint(0, 1.06), joint(0.37, 1.14), joint(0.7, 1.12), joint(1, 1.02)];
      const rad = [r * 1.18, r * 1.12, r * 1.04, r * 0.9];
      parts.push(taperTube(pts, rad, seg(8)));
    }
    // Plan item 319: the grip's mass under the fingers (the palm and the fingers' inner flesh), so the fist reads
    // as one gloved hand with knuckle ridges, not four rings stacked on the shaft with dark gaps between them.
    const grip = new THREE.SphereGeometry(1, seg(14), seg(10));
    grip.scale(0.0285, 0.031, 0.0285);
    grip.applyQuaternion(rest);
    const gripAt = at(V(0, -0.005, 0));
    grip.translate(gripAt.x, gripAt.y, gripAt.z);
    parts.push(grip);
    // The thumb: from the base of the palm, across over the index finger's middle joint.
    const thumbA = at(V(Math.cos(tb - 1.2) * 0.022, -0.006, Math.sin(tb - 1.2) * 0.022));
    const thumbB = at(V(Math.cos(tb - 2.1) * 0.02, 0.026, Math.sin(tb - 2.1) * 0.02));
    parts.push(limb(thumbA, thumbB, 0.0105, 0.0085, seg(8)));
    const thumbTip = new THREE.SphereGeometry(0.0086, seg(6), seg(5));
    thumbTip.translate(thumbB.x, thumbB.y, thumbB.z);
    parts.push(thumbTip);
    // The wrist, from the cuff into the hand.
    parts.push(turned(wristR.clone(), padAt.clone().lerp(handR, 0.3), [[0, 0.024], [1, 0.022]], seg(8), 0.8));
    const fist = mergeGeos(parts);
    for (const g of parts) g.dispose();
    const fistMesh = add(fist, gloveMat, chest);
    fistMesh.name = "cath-fist-r";
    statics.push(fistMesh); // merged with its strap; the merged mesh keeps the name
  }

  const shoulderL = V(0.143, 0.25, -0.005);
  // Plan item 319 slice 55: a relaxed hang, not a straight drop: the elbow eases back and out, the forearm turns in
  // and forward so the gloved hand rests by the front of her thigh (the front view showed one stiff line to the hip).
  const elbowL = V(0.208, -0.012, -0.05);
  const handL = V(0.158, -0.25, 0.078);
  const wristL = handL.clone().add(V(0, 0.04, -0.012));
  // C14: her left arm is two bones (the class idles reach with it: a draw on the cigarette, the collar, the hip).
  // Each bone is a group whose matrix moves its rest geometry; armIK() solves them toward a wrist target.
  const upperL = new THREE.Group();
  const foreL = new THREE.Group();
  upperL.matrixAutoUpdate = false;
  foreL.matrixAutoUpdate = false;
  chest.add(upperL, foreL);
  sleeve(shoulderL, elbowL, wristL, upperL, foreL);
  // Plan item 147: her left hand hangs relaxed with the cigarette between two fingers, not a mitt: the back of the
  // hand outward, the index above the cigarette's end and the middle finger under it, the ring and little fingers
  // curled in toward the palm, the thumb along the index. Built in the chest frame on the forearm bone, so the
  // class idles' IK carries it.
  {
    const dir = V(0, -1, 0.15).normalize();
    const parts: THREE.BufferGeometry[] = [];
    const pad = new THREE.SphereGeometry(1, seg(10), seg(8));
    pad.scale(0.015, 0.042, 0.03);
    pad.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    const padAt = wristL.clone().addScaledVector(dir, 0.045);
    pad.translate(padAt.x, padAt.y, padAt.z);
    parts.push(pad);
    parts.push(turned(wristL.clone().addScaledVector(dir, -0.01), wristL.clone().addScaledVector(dir, 0.03), [[0, 0.024], [1, 0.026]], seg(8), 0.8));
    // Plan item 319 slice 2: jointed like the umbrella fist: a tapering bone between each pair of joints, rounded
    // knuckles between, the tip narrowest (one even tube read as a rubber finger close up).
    const finger = (pts: THREE.Vector3[], r: number) => {
      const n = pts.length - 1;
      for (let k = 0; k < n; k++) parts.push(limb(pts[k]!, pts[k + 1]!, r * (1.06 - (0.26 * k) / n), r * (1.06 - (0.26 * (k + 1)) / n), seg(8)));
    };
    finger([V(0.175, -0.292, 0.062), V(0.178, -0.304, 0.068), V(0.181, -0.311, 0.078), V(0.183, -0.318, 0.09)], 0.0078);
    finger([V(0.175, -0.294, 0.05), V(0.179, -0.314, 0.058), V(0.182, -0.327, 0.068), V(0.184, -0.334, 0.08)], 0.008);
    finger([V(0.175, -0.292, 0.039), V(0.171, -0.314, 0.042), V(0.164, -0.32, 0.051), V(0.159, -0.309, 0.055)], 0.0076);
    finger([V(0.174, -0.286, 0.028), V(0.17, -0.304, 0.03), V(0.164, -0.309, 0.038), V(0.16, -0.3, 0.041)], 0.0066);
    finger([V(0.166, -0.258, 0.06), V(0.167, -0.276, 0.072), V(0.171, -0.293, 0.079)], 0.0088);
    const hand = mergeGeos(parts);
    for (const g of parts) g.dispose();
    const handMesh = add(hand, gloveMat, foreL);
    handMesh.name = "cath-hand-l";
    statics.push(handMesh); // merged with its strap; the merged mesh keeps the name
  }
  // The cigarette between two fingers, the ember at its tip.
  const cig = new THREE.CylinderGeometry(0.0035, 0.0035, 0.075, 6);
  cig.rotateX(Math.PI / 2 - 0.3);
  cig.translate(handL.x + 0.008, handL.y - 0.05, handL.z + 0.05);
  const cigMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.8 });
  mats.push(cigMat);
  const cigMesh = add(cig, cigMat, foreL);
  const emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.1, 0.25), toneMapped: false });
  mats.push(emberMat);
  const emberMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), emberMat);
  emberMesh.position.set(handL.x + 0.008, handL.y - 0.039, handL.z + 0.087);
  foreL.add(emberMesh);
  const ember = emberMesh;
  const L1 = shoulderL.distanceTo(elbowL);
  const L2 = elbowL.distanceTo(wristL);
  const restU = elbowL.clone().sub(shoulderL).normalize();
  const restF = wristL.clone().sub(elbowL).normalize();
  const ikT = new THREE.Vector3();
  const ikE = new THREE.Vector3();
  const ikAx = new THREE.Vector3();
  const ikPerp = new THREE.Vector3();
  const ikQ = new THREE.Quaternion();
  const ikQ2 = new THREE.Quaternion();
  const ikM = new THREE.Matrix4();
  const ikM2 = new THREE.Matrix4();
  /**
   * Two-bone IK for her left arm, in the chest frame: the wrist toward `target`, the elbow bent toward `pole`, the
   * hand turned `roll` radians about the forearm. A target at the rest wrist leaves the arm exactly as modelled.
   */
  function armIK(target: THREE.Vector3, pole: THREE.Vector3, roll: number): void {
    ikAx.copy(target).sub(shoulderL);
    const d = THREE.MathUtils.clamp(ikAx.length(), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    ikAx.normalize();
    ikT.copy(shoulderL).addScaledVector(ikAx, d);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    ikPerp.copy(pole).addScaledVector(ikAx, -pole.dot(ikAx)).normalize();
    ikE.copy(shoulderL).addScaledVector(ikAx, a).addScaledVector(ikPerp, h);
    // The upper arm: rest direction onto shoulder -> elbow, about the shoulder.
    ikQ.setFromUnitVectors(restU, ikE.clone().sub(shoulderL).normalize());
    upperL.matrix.makeTranslation(shoulderL.x, shoulderL.y, shoulderL.z).multiply(ikM.makeRotationFromQuaternion(ikQ)).multiply(ikM2.makeTranslation(-shoulderL.x, -shoulderL.y, -shoulderL.z));
    // The forearm: carried by the upper arm's turn, then onto elbow -> wrist, then the roll.
    const carried = restF.clone().applyQuaternion(ikQ);
    const want = ikT.clone().sub(ikE).normalize();
    ikQ2.setFromUnitVectors(carried, want).multiply(ikQ);
    ikQ2.premultiply(new THREE.Quaternion().setFromAxisAngle(want, roll));
    foreL.matrix.makeTranslation(ikE.x, ikE.y, ikE.z).multiply(ikM.makeRotationFromQuaternion(ikQ2)).multiply(ikM2.makeTranslation(-elbowL.x, -elbowL.y, -elbowL.z));
    upperL.matrixWorldNeedsUpdate = true;
    foreL.matrixWorldNeedsUpdate = true;
  }

  // ---- the umbrella: shaft from her right fist up and a little back, the canopy on 8 ribs ----
  const umb = new THREE.Group();
  umb.position.set(handR.x, handR.y, handR.z);
  umb.rotation.set(-0.05, 0, 0.06);
  chest.add(umb);
  const shaft = new THREE.CylinderGeometry(0.0075, 0.0075, 0.82, 8);
  shaft.translate(0, 0.41, 0);
  addS(shaft, blackMat, umb);
  const crook = new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI);
  crook.rotateZ(Math.PI);
  crook.translate(0.035, -0.04, 0);
  addS(crook, blackMat, umb);
  // The canopy: a lathe whose rim scallops between the 8 ribs (the cloth sags up between them).
  const R = 0.5;
  const canopyProfile: Array<[number, number]> = [];
  const rows = 9;
  for (let i = 0; i <= rows; i++) {
    const u = i / rows;
    canopyProfile.push([0.006 + R * Math.sin(u * Math.PI * 0.46) / Math.sin(Math.PI * 0.46), 0.86 - 0.31 * (1 - Math.cos(u * Math.PI * 0.46)) / (1 - Math.cos(Math.PI * 0.46))]);
  }
  const canopySegs = 8 * Math.max(4, Math.round(6 * S));
  canopyProfile.reverse();
  const canopy = new THREE.LatheGeometry(
    canopyProfile.map(([r, y]) => new THREE.Vector2(r, y)),
    canopySegs,
  );
  {
    const p = canopy.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(z, x);
      const between = Math.abs(Math.sin(a * 4)); // 0 on a rib, 1 between two
      const k = Math.pow(r / R, 2.2);
      const rr = r * (1 - 0.06 * between * k);
      p.setXYZ(i, (x / r) * rr, p.getY(i) + 0.05 * between * k, (z / r) * rr);
    }
    canopy.computeVertexNormals();
  }
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.22, metalness: 0.0, side: THREE.DoubleSide });
  mats.push(canopyMat);
  addS(canopy, canopyMat, umb);
  // Ribs and their tips.
  const tips: THREE.Vector3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tip = V(Math.cos(a) * R * 1.005, 0.55 - 0.004, Math.sin(a) * R * 1.005);
    tips.push(tip);
    const mid = V(Math.cos(a) * R * 0.6, 0.78, Math.sin(a) * R * 0.6);
    addS(limb(mid, tip, 0.0035, 0.004, 5), blackMat, umb);
    const ferrule = new THREE.SphereGeometry(0.008, 6, 4);
    ferrule.translate(tip.x, tip.y - 0.004, tip.z);
    addS(ferrule, blackMat, umb);
  }
  const finial = new THREE.CylinderGeometry(0.004, 0.009, 0.07, 8);
  finial.translate(0, 0.89, 0);
  addS(finial, blackMat, umb);
  const umbrellaTop = new THREE.Object3D();
  umbrellaTop.position.set(0, 0.88, 0);
  umb.add(umbrellaTop);

  // ---- plan item 16: the umbrella furled, for indoors: crook in her fist, the wrapped canopy hanging tip down ----
  const furled = new THREE.Group();
  furled.position.set(handR.x, handR.y, handR.z);
  furled.rotation.set(0.1, 0, -0.1);
  furled.visible = false;
  chest.add(furled);
  {
    const fShaft = new THREE.CylinderGeometry(0.0075, 0.0075, 0.86, 8);
    fShaft.translate(0, -0.4, 0);
    addS(fShaft, blackMat, furled);
    const fCrook = new THREE.TorusGeometry(0.035, 0.009, 6, 12, Math.PI);
    fCrook.translate(0.035, 0.035, 0);
    addS(fCrook, blackMat, furled);
    // The wrapped cloth: full under the runner, tapering to the ferrule, with a few soft folds.
    const prof: Array<[number, number]> = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      prof.push([0.008 + 0.024 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (1 - u * 0.75), -0.84 + 0.62 * (1 - u)]);
    }
    const cloth = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 16);
    const cp = cloth.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      const z = cp.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.12 * Math.sin(a * 4 + cp.getY(i) * 9);
      cp.setXYZ(i, x * k, cp.getY(i), z * k);
    }
    cloth.computeVertexNormals();
    addS(cloth, canopyMat, furled);
    const strapF = new THREE.TorusGeometry(0.027, 0.004, 4, 14);
    strapF.rotateX(Math.PI / 2);
    strapF.translate(0, -0.5, 0);
    addS(strapF, blackMat, furled);
    const tipF = new THREE.CylinderGeometry(0.009, 0.004, 0.06, 8);
    tipF.translate(0, -0.87, 0);
    addS(tipF, blackMat, furled);
  }

  // ---- rain running off the rib tips: short falling streaks (Points would be square; thin quads read as water) ----
  const DROPS = phone ? 16 : 32;
  const dropGeo = new THREE.BufferGeometry();
  const dropPos = new Float32Array(DROPS * 2 * 3);
  dropGeo.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  const dropMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.62, 0.75), transparent: true, opacity: 0.55, depthWrite: false });
  mats.push(dropMat);
  const dropLines = new THREE.LineSegments(dropGeo, dropMat);
  dropLines.frustumCulled = false;
  group.add(dropLines);
  const drops = Array.from({ length: DROPS }, (_, i) => ({ tip: i % 8, y: 0, vy: 0, wait: (i * 0.137) % 1.1, x: 0, z: 0 }));
  const tipW = new THREE.Vector3();

  // ---- smoke: a soft billboard that rises from the ember every 14 s ----
  const smokeTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grd.addColorStop(0, "rgba(220,220,230,0.55)");
      grd.addColorStop(1, "rgba(220,220,230,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const smokeMat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xb8bcc8 });
  mats.push(smokeMat);
  const smoke = new THREE.Sprite(smokeMat);
  smoke.scale.setScalar(0.12);
  group.add(smoke);
  const emberW = new THREE.Vector3();

  // ---- the hem: 12 particles round the hem, each pulled back to its rest by a spring, pushed by wind ----
  const HEM = 12;
  const hem = Array.from({ length: HEM }, () => ({ x: 0, z: 0, px: 0, pz: 0 }));

  // Weight shift: 7 to 11 s apart, deterministic.
  let shiftAt = 7;
  let hemHipX = 0;
  let hemT = -1;
  let shiftFrom = 0;
  let shiftTo = 1;
  let shiftT0 = 0;
  let n = 0;
  const legRest = legs.map((l) => l.rotation.z);
  const CLIP_S = 1.2;
  let clip: { kind: string; t0: number | null; held?: number; dur: number; u: number } | null = null;
  // Plan item 180: the held stance (the kind she holds now, the one wanted, and its weight).
  let stanceNow: string | null = null;
  let stanceWant: string | null = null;
  let stanceW = 0;
  // How long the running blend has taken (loop seconds), and how long the last one took to settle.
  let blendClock = 0;
  let blendS = 0;
  // Plan item 136: the Wirewitch's rig flares through her audition (its base colour, scaled up and back).
  let rigMat: THREE.MeshBasicMaterial | null = null;
  const rigBase = new THREE.Color(0.55, 0.16, 1.25);
  let clipDraw = 0;
  const tgt = new THREE.Vector3();
  // Plan item 180: where her posing hand is now (her own frame, metres): the pose's signature for the checks.
  const handNow = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const restPole = elbowL.clone().sub(shoulderL).normalize();

  const BLINK_S = 0.13;
  let blinkAt = 2.2;
  let blinkT0 = -1;
  let blinks = 0;
  const idleNow = { breath: 0, weight: 0, sway: 0, blinks: 0, blinking: false };
  // Plan item 187: the menu gaze (null: none, the head's idle drift alone), eased at a 60 ms time constant.
  let gazeWant: number | null = null;
  let gazeNow = 0;
  let gazeW = 0;
  function update(dt: number, t: number, wind: { x: number; z: number }): void {
    const step = Math.min(dt, 1 / 20);
    const gk = 1 - Math.exp(-dt / 0.06);
    gazeNow += ((gazeWant ?? 0) - gazeNow) * gk;
    gazeW += ((gazeWant === null ? 0 : 1) - gazeW) * gk;
    // Breathing at 0.25 Hz.
    const br = Math.sin(t * Math.PI * 2 * 0.25);
    chest.scale.set(1 + br * 0.008, 1 + br * 0.004, 1 + br * 0.014);
    chest.position.y = 0.24 + br * 0.003;
    headPivot.rotation.x = -0.05 + br * 0.012;
    // The weight shift: the hips slide over the standing leg and the body counters.
    if (t >= shiftAt) {
      n++;
      shiftFrom = shiftTo;
      shiftTo = shiftTo > 0 ? -1 : 1;
      shiftT0 = t;
      shiftAt = t + 7 + ((n * 2.618) % 4);
    }
    const u = Math.min(1, (t - shiftT0) / 1.4);
    const e = u * u * (3 - 2 * u);
    const w = shiftFrom + (shiftTo - shiftFrom) * e;
    // Plan item 271: her weight sits on one hip: the hips held over the standing leg (her right, -x), its side
    // raised and the free knee's side dropped, the chest countering; the idle's shift sways a quarter either way.
    const hipW = -0.75 + 0.25 * w;
    // The tilt carries the stance. The hips don't slide out over the standing leg: tilted, the hem's low corner
    // already swings 2 cm out that way, and the phone title's menu sits just beside it; they move 6 mm in the idle.
    pelvis.position.x = 0.004 + w * 0.006;
    pelvis.rotation.z = hipW * 0.055;
    chest.rotation.z = -hipW * 0.07;
    // Her head stays level over the countered chest (pelvis and chest rolls cancel to hipW * -0.015 at the neck).
    headPivot.rotation.z = -w * 0.03 + Math.sin(t * 0.31) * 0.015 + hipW * 0.015;
    headPivot.rotation.y = Math.sin(t * 0.17) * 0.12 * (1 - 0.6 * gazeW);
    // Plan item 187: toward the menu (her right, +y turns her head that way as she faces the lens) and down its rows.
    headPivot.rotation.y += gazeW * 0.22;
    headPivot.rotation.x += gazeW * (0.04 + gazeNow * 0.09);
    legs.forEach((l, i) => (l.rotation.z = legRest[i]! + w * 0.01));
    // The umbrella sways a touch in the wind.
    umb.rotation.z = 0.06 + Math.sin(t * 0.9) * 0.015 + wind.x * 0.004;
    // Plan item 175: a blink every 3 to 5 s, the lids shut for 130 ms (the shut face swapped in as the map).
    if (t < blinkAt - 6) {
      // Time ran backwards (a screenshot's held clock): start over.
      blinkAt = t + 1.5;
      blinkT0 = -1;
    }
    if (t >= blinkAt) {
      blinks++;
      blinkT0 = t;
      blinkAt = t + 3 + ((blinks * 1.618) % 2);
    }
    // Plan item 205: a frame that outlasts the blink (a slow renderer, 90 ms+) keeps her eyes open: held for a whole
    // slow frame, a blink reads as eyes closed, not a blink.
    const shutNow = blinkT0 >= 0 && t >= blinkT0 && t - blinkT0 < BLINK_S && dt < 0.09;
    if ((faceMat.map === blinkTex) !== shutNow) faceMat.map = shutNow ? blinkTex : faceTex;
    idleNow.breath = br;
    idleNow.weight = w;
    idleNow.sway = umb.rotation.z;
    idleNow.blinks = blinks;
    idleNow.blinking = shutNow;
    chest.rotation.x = 0;
    chest.rotation.y = 0;
    umb.rotation.y = 0;
    pelvis.rotation.y = 0;
    // C14 (S9.5): the class idle on top, a posed 1.2 s clip: in over the first quarter, held, out over the last
    // fifth, so it starts and ends on the breathing idle (and a held screenshot at 0.5 shows the pose itself).
    // Her left arm reaches by two-bone IK; the head turns to the lens (the wardrobe sees her from the front).
    clipDraw = 0;
    let armOn = false;
    let carryNow = false;
    let gunInHand: "rifle" | "shotgun" | null = null;
    let glint = 0;
    let rack = 0;
    let shellU = -1;
    // Plan item 180: the stance lets go of the old class and takes up the new; plan item 278: 150 ms each, a 300 ms
    // cut between operatives rather than a drift.
    if (stanceNow !== stanceWant || (stanceNow && stanceW < 1)) blendClock += step;
    if (stanceNow !== stanceWant) {
      stanceW = Math.max(0, stanceW - step / 0.15);
      if (stanceW === 0) stanceNow = stanceWant;
    } else if (stanceNow && stanceW < 1) {
      stanceW = Math.min(1, stanceW + step / 0.15);
      if (stanceW === 1) blendS = blendClock;
    }
    let cu = 0;
    if (clip) {
      if (clip.t0 === null) clip.t0 = t;
      cu = clip.held ?? (t - clip.t0) / clip.dur;
      clip.u = Math.max(0, cu);
      if (cu >= 1 || cu < 0) clip = null;
    }
    // The pose to draw: the audition while one plays (held at its middle once it gets there when it is the stance's
    // own class, so it settles into the stance rather than back to rest), else the stance at its weight.
    const posing = clip ? { kind: clip.kind, held: clip.held } : stanceNow && stanceW > 0 ? { kind: stanceNow, held: 0.5 } : null;
    // The rack's snap and the flying shell run on the audition's own clock (none while she only holds the stance).
    const cuR = clip ? cu : -1;
    // Settled into the stance (its own audition past the middle, or none playing): a held pose, so the Ghost's glint
    // catches the light every few seconds instead of staying lit.
    let settled = !clip;
    if (clip && clip.kind === stanceNow && cu > 0.5) {
      cu = 0.5;
      settled = true;
    }
    if (!clip) cu = 0.5;
    if (posing) {
      {
        const clipE = clip ? THREE.MathUtils.smootherstep(cu, 0, 0.26) * (1 - THREE.MathUtils.smootherstep(cu, 0.8, 1)) : 0;
        const ease = stanceW * stanceW * (3 - 2 * stanceW);
        const e = clip && clip.kind !== stanceNow ? clipE : Math.max(clipE, ease);
        const clip_ = { kind: posing.kind, held: settled ? 0.5 : posing.held, dur: clip?.dur ?? CLIP_S };
        const reach = (x: number, y: number, z: number, px: number, py: number, pz: number, roll: number) => {
          tgt.copy(wristL).lerp(tmpV.set(x, y, z), e);
          pole.copy(restPole).lerp(tmpV.set(px, py, pz).normalize(), e);
          armIK(tgt, pole, roll * e);
          armOn = true;
        };
        switch (clip_.kind) {
          case "ghost": {
            // Plan item 136: she unslings the rifle from over her left shoulder and stands it beside her face, the
            // scope at her eye and a glint off its lens, then slings it again: rest -> shoulder -> hold, and back.
            const sh = (cu < 0.5 ? THREE.MathUtils.smoothstep(cu, 0, 0.13) - THREE.MathUtils.smoothstep(cu, 0.13, 0.28) : THREE.MathUtils.smoothstep(cu, 0.78, 0.89) - THREE.MathUtils.smoothstep(cu, 0.89, 1));
            tgt.copy(wristL).lerp(GHOST_HOLD, e).lerp(GHOST_GRAB, sh);
            pole.copy(restPole).lerp(tmpV.set(1, -0.8, -0.3).normalize(), Math.max(e, sh));
            armIK(tgt, pole, -0.4 * e);
            armOn = true;
            gunInHand = cu > 0.13 && cu < 0.89 && e > 0.3 ? "rifle" : null;
            headPivot.rotation.y += 0.1 * e;
            headPivot.rotation.z -= 0.08 * e;
            chest.rotation.y -= 0.06 * e;
            // Plan item 235: turned side-on, the rifle's shoulder to the lens and her face back to it.
            pelvis.rotation.y -= 0.42 * e;
            headPivot.rotation.y += 0.3 * e;
            // One glint mid-audition; held (the pick's first frame), it catches the light every few seconds.
            glint = clip_.held !== undefined ? Math.max(0, Math.sin(t * 1.4)) ** 12 : THREE.MathUtils.smoothstep(cu, 0.4, 0.47) * (1 - THREE.MathUtils.smoothstep(cu, 0.5, 0.62));
            break;
          }
          case "butcher": {
            // The neck roll: chin down, over to the side, up; shoulders drop. Plan item 136: her free hand draws the
            // shotgun off her hip, muzzle up past her shoulder, and racks it one-handed with a snap; a shell flies.
            const ph = Math.PI * 2 * cu + Math.PI / 2;
            headPivot.rotation.z += 0.34 * Math.sin(ph) * e;
            headPivot.rotation.x += (0.12 + 0.16 * Math.cos(ph)) * e;
            headPivot.rotation.y += 0.18 * e;
            // Plan item 235: squared and low, hunched over the gun, shoulders square to the lens.
            chest.rotation.x += 0.16 * e;
            chest.position.y -= 0.03 * e;
            headPivot.rotation.x += 0.08 * e;
            const snap = THREE.MathUtils.smoothstep(cuR, 0.42, 0.46) * (1 - THREE.MathUtils.smoothstep(cuR, 0.47, 0.54));
            tgt.copy(wristL).lerp(BUTCHER_HOLD, e);
            tgt.y -= 0.07 * snap;
            pole.copy(restPole).lerp(tmpV.set(1, 0.2, -0.8).normalize(), e);
            armIK(tgt, pole, 0.5 * e);
            armOn = true;
            gunInHand = cu > 0.1 && cu < 0.92 && e > 0.3 ? "shotgun" : null;
            rack = snap;
            shellU = cuR >= 0.46 && cuR < 0.8 ? (cuR - 0.46) * clip_.dur : -1;
            break;
          }
          case "gunslinger":
            // Squares up to the lens, the umbrella back on her shoulder, a hand on her hip.
            chest.rotation.y += 0.26 * e;
            headPivot.rotation.y += 0.12 * e;
            headPivot.rotation.x -= 0.06 * e;
            umb.rotation.x -= 0.32 * e;
            umb.rotation.z += 0.3 * e;
            reach(0.155, -0.2, 0.05, 1, 0.4, -0.7, 0.9);
            // Plan item 235: hip-shot, her weight thrown onto the holster side.
            pelvis.rotation.z -= 0.06 * e;
            pelvis.position.x += 0.025 * e;
            chest.rotation.z += 0.09 * e;
            break;
          case "wirewitch": {
            const sp = cu * cu * (3 - 2 * cu);
            umb.rotation.y += Math.PI * 2 * sp;
            headPivot.rotation.z += 0.18 * e;
            headPivot.rotation.y += 0.28 * e;
            // Plan item 235: her free hand raised high into the rig's light, palm up, the halo's glow on it.
            reach(0.3, 0.5, 0.2, 1, -0.5, -0.2, 1.2);
            headPivot.rotation.x -= 0.12 * e;
            chest.rotation.z -= 0.05 * e;
            // The umbrella tipped back off her raised arm, so the halo and the hand stand clear of the canopy.
            umb.rotation.z += 0.16 * e;
            break;
          }
          default:
            {
              // The fixer straightens her collar, eyes down to it; plan item 235: then, holding her stance, she
              // carries her briefcase at her side, arm straight, chin up (the audition's tail lowers the arm to it).
              // A held audition (the pick's first frame, screenshots) shows the stance it settles into.
              const own = clip?.kind === "fixer" && stanceWant === "fixer";
              const k = !clip ? 1 : !own ? 0 : clip.held !== undefined ? 1 : THREE.MathUtils.smoothstep(clip.u, 0.78, 1);
              const c = 1 - k;
              reach(0.02 * c + 0.27 * k, 0.31 * c - 0.25 * k, 0.15 * c + 0.12 * k, 1, -0.7 * c + 0.1 * k, -0.1 * c - 0.4 * k, -1.2 * c);
              headPivot.rotation.x += (0.2 * c - 0.05 * k) * e;
              headPivot.rotation.y += (0.22 * c + 0.1 * k) * e;
              chest.rotation.z += (0.04 * c + 0.03 * k) * e;
              carryNow = k > 0.5 && e > 0.5;
            }
        }
      }
    }
    // Only the Ghost's draw and the Fixer's collar keep the cigarette in hand: in a fist (the Butcher), on the hip or
    // flung out with the umbrella it read as a loose stick by her hip (C14 review), so it is palmed away.
    handNow.copy(armOn ? tgt : wristL);
    carrying = carryNow;
    if (caseUp && caseDown && wearing === "fixer") {
      caseUp.position.copy(handNow).add(tmpV.set(0.01, -0.3, 0.01));
      caseUp.visible = carrying;
      caseDown.visible = !carrying;
    }
    const palmed = armOn && !!posing && posing.kind !== "fixer";
    poseProps(gunInHand, glint, rack, shellU);
    cigMesh.visible = !palmed;
    if (rigMat) {
      const held = stanceNow === "wirewitch" ? stanceW * 0.6 : 0;
      const on = Math.max(held, clip?.kind === "wirewitch" ? THREE.MathUtils.smoothstep(clip.u, 0.15, 0.35) * (1 - THREE.MathUtils.smoothstep(clip.u, 0.75, 0.95)) : 0);
      // Two pulses down the cables as the rig powers up, then a steady glow that settles.
      const pulse = on * (1.4 + 0.6 * Math.sin(clip ? clip.u * Math.PI * 8 : 0));
      rigMat.color.copy(rigBase).multiplyScalar(1 + pulse);
    }
    ember.visible = !palmed;
    if (!armOn) {
      upperL.matrix.identity();
      foreL.matrix.identity();
      upperL.matrixWorldNeedsUpdate = true;
      foreL.matrixWorldNeedsUpdate = true;
    }

    // The hem: Verlet with a spring home, wind and a gust that comes and goes.
    const gust = 0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
    const wx = (wind.x * 0.004 + 0.012) * gust;
    const wz = (wind.z * 0.004 + 0.006) * gust;
    const k = 1 - Math.exp(-step * 9);
    // Plan item 271: the hem lags the hips (it hangs from them), so a weight shift swings it and it settles back.
    // A held screenshot clock (a jump of more than a frame) only re-seats it.
    const hipDx = Math.abs(t - hemT) < 0.25 ? pelvis.position.x - hemHipX : 0;
    hemHipX = pelvis.position.x;
    hemT = t;
    for (let i = 0; i < HEM; i++) {
      const p = hem[i]!;
      p.x -= hipDx * 0.9;
      p.px -= hipDx * 0.9;
      const vx = (p.x - p.px) * 0.94;
      const vz = (p.z - p.pz) * 0.94;
      p.px = p.x;
      p.pz = p.z;
      const flutter = Math.sin(t * 3.1 + i * 1.7) * 0.004 * gust;
      p.x += vx + (wx + flutter - p.x * 6) * k;
      p.z += vz + (wz - p.z * 6) * k;
    }
    // Neighbours hold each other (a soft ring).
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < HEM; i++) {
        const a = hem[i]!;
        const b = hem[(i + 1) % HEM]!;
        const mx = (a.x + b.x) * 0.5;
        const mz = (a.z + b.z) * 0.5;
        a.x += (mx - a.x) * 0.15;
        a.z += (mz - a.z) * 0.15;
        b.x += (mx - b.x) * 0.15;
        b.z += (mz - b.z) * 0.15;
      }
    }
    // Write the coat's lower rows from the ring (weighted down the skirt).
    const pos = coatGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const nRows = coatProfile.length;
    for (let s = 0; s <= coatSegs; s++) {
      const ang = (s / coatSegs) * HEM;
      const i0 = Math.floor(ang) % HEM;
      const i1 = (i0 + 1) % HEM;
      const f = ang - Math.floor(ang);
      const ox = hem[i0]!.x * (1 - f) + hem[i1]!.x * f;
      const oz = hem[i0]!.z * (1 - f) + hem[i1]!.z * f;
      for (let r = 0; r < HEM_ROWS; r++) {
        const wgt = Math.pow((HEM_ROWS - r) / HEM_ROWS, 1.6);
        const vi = (s * nRows + r) * 3;
        arr[vi] = coatRest[vi]! + ox * wgt;
        arr[vi + 2] = coatRest[vi + 2]! + oz * wgt;
      }
    }
    pos.needsUpdate = true;

    // Plan item 147: the long hair lifts and sways a little in the wind, more toward its ends (still under
    // reduced motion, where the frame loop holds t).
    if (hairGeo && hairRest) {
      const hp = hairGeo.attributes.position as THREE.BufferAttribute;
      const ha = hp.array as Float32Array;
      const gust = 0.6 + 0.4 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.1);
      for (let r = 1; r <= hairRows; r++) {
        const k = Math.pow(r / hairRows, 2);
        for (let c = 0; c <= hairCols; c++) {
          const vi = (r * (hairCols + 1) + c) * 3;
          const ph = t * 1.4 + c * 0.35 + r * 0.22;
          ha[vi] = hairRest[vi]! + k * (0.012 * Math.sin(ph) * gust + wind.x * 0.004);
          ha[vi + 1] = hairRest[vi + 1]! + k * 0.004 * Math.sin(ph * 0.8 + 0.5);
          ha[vi + 2] = hairRest[vi + 2]! + k * (0.008 * Math.cos(ph * 0.9) * gust - 0.006 * gust + wind.z * 0.004);
        }
      }
      hp.needsUpdate = true;
      if (lockGeo && lockRest && lockAt) {
        const lpos = lockGeo.attributes.position as THREE.BufferAttribute;
        const la = lpos.array as Float32Array;
        for (let i = 0; i < lpos.count; i++) {
          const c = lockAt[i * 2]!;
          const r = lockAt[i * 2 + 1]!;
          const k = Math.pow(r / hairRows, 2);
          const ph = t * 1.4 + c * 0.35 + r * 0.22;
          const vi = i * 3;
          la[vi] = lockRest[vi]! + k * (0.012 * Math.sin(ph) * gust + wind.x * 0.004);
          la[vi + 1] = lockRest[vi + 1]! + k * 0.004 * Math.sin(ph * 0.8 + 0.5);
          la[vi + 2] = lockRest[vi + 2]! + k * (0.008 * Math.cos(ph * 0.9) * gust - 0.006 * gust + wind.z * 0.004);
        }
        lpos.needsUpdate = true;
      }
    }

    // The ember breathes; every 14 s she draws on it (brighter) and a curl of smoke rises.
    const cyc = t % 14;
    const draw = cyc > 1 && cyc < 2.2 ? Math.sin(((cyc - 1) / 1.2) * Math.PI) : 0;
    const glow = 0.75 + 0.25 * Math.sin(t * 2.3) + Math.max(draw, clipDraw) * 1.8;
    emberMat.color.setRGB(4 * glow, 1.1 * glow, 0.25 * glow);
    ember.getWorldPosition(emberW);
    const st = cyc - 2.2;
    if (st > 0 && st < 4) {
      const v = st / 4;
      smoke.position.set(emberW.x + wx * 20 * v, emberW.y + 0.05 + v * 0.55, emberW.z + wz * 20 * v);
      smoke.position.sub(group.position);
      smoke.position.applyQuaternion(group.quaternion.clone().invert());
      smoke.scale.setScalar(0.08 + v * 0.34);
      smokeMat.opacity = Math.sin(v * Math.PI) * 0.32;
      smokeMat.rotation = v * 1.2;
    } else smokeMat.opacity = 0;

    // Rain off the rib tips: each drop waits, then falls from a tip.
    umb.updateWorldMatrix(true, false);
    group.updateWorldMatrix(true, false);
    const inv = group.matrixWorld.clone().invert();
    for (let i = 0; i < DROPS; i++) {
      const d = drops[i]!;
      if (d.wait > 0) {
        d.wait -= step;
        if (d.wait <= 0) {
          tipW.copy(tips[d.tip]!).applyMatrix4(umb.matrixWorld).applyMatrix4(inv);
          d.x = tipW.x;
          d.y = tipW.y;
          d.z = tipW.z;
          d.vy = 0;
        }
        dropPos.fill(0, i * 6, i * 6 + 6);
        continue;
      }
      d.vy -= 9.8 * step;
      d.y += d.vy * step;
      d.x += wx * 2 * step * 10;
      if (d.y < 0.02) {
        d.wait = 0.25 + ((i * 0.37 + t) % 0.9);
        d.tip = (d.tip + 3) % 8;
      }
      const len = Math.min(0.12, 0.02 - d.vy * 0.025);
      dropPos[i * 6] = d.x;
      dropPos[i * 6 + 1] = d.y;
      dropPos[i * 6 + 2] = d.z;
      dropPos[i * 6 + 3] = d.x;
      dropPos[i * 6 + 4] = d.y + len;
      dropPos[i * 6 + 5] = d.z;
    }
    (dropGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  // ---- plan item 112: the class kits, in the pelvis frame (the coat's front surface sits at about 0.7 x its
  // profile radius). Each kit is one or two merged meshes; only the worn one is visible, so it costs at most two
  // draw calls (and their shadows). ----
  const tube = (pts: Array<[number, number, number]>, r: number, segs = 24) =>
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z))), segs, r, 6, false);
  // Plan item 319 slice 53: a flat strap laid on the coat's lathe surface. `path` is (angle from the front, toward
  // her left; height in the pelvis frame) points, smoothed; the strap stands just proud of what lies under it (the
  // lapels on her chest, the belt at the waist) and is `w` wide and 4 mm thick, its faces along the coat's normal.
  const coatStrap = (path: Array<[number, number]>, w: number, samples = 64): THREE.BufferGeometry => {
    const curve = new THREE.CatmullRomCurve3(path.map(([a, y]) => V(a, y, 0)), false, "centripetal");
    const onSurf = (a: number, y: number, lift: number) => {
      const r = rAtCoat(y);
      // The outward normal of the squashed lathe at (a, y): across the ellipse, tipped by the profile's slope.
      const dr = (rAtCoat(y + 0.005) - rAtCoat(y - 0.005)) / 0.01;
      const n = V(Math.sin(a) * 0.7, -dr * 0.7, Math.cos(a)).normalize();
      return { p: V(r * Math.sin(a), y, 0.7 * r * Math.cos(a)).addScaledVector(n, lift), n };
    };
    const liftAt = (a: number, y: number) => {
      const front = Math.max(0, Math.cos(a));
      // The belt (1.5 cm tube) and the lapels' roll over the chest stand off the coat; the strap rides over them.
      const belt = 0.018 * Math.exp(-((y - 0.12) ** 2) / 0.03 ** 2);
      const lapel = 0.015 * front * Math.max(0, Math.min(1, (y - 0.16) / 0.06));
      return 0.004 + Math.max(belt, lapel);
    };
    const pos: number[] = [];
    const nrm: number[] = [];
    const idx: number[] = [];
    const t = 0.004;
    const pts = Array.from({ length: samples + 1 }, (_, i) => {
      const c = curve.getPoint(i / samples);
      return onSurf(c.x, c.y, liftAt(c.x, c.y));
    });
    for (let i = 0; i <= samples; i++) {
      const { p, n } = pts[i]!;
      const tan = pts[Math.min(samples, i + 1)]!.p.clone().sub(pts[Math.max(0, i - 1)]!.p).normalize();
      const side = tan.clone().cross(n).normalize();
      const nn = side.clone().cross(tan).normalize();
      // Eight vertices a ring: the outer face, the inner face and the two edges, each pair with its own normal.
      const o = p.clone().addScaledVector(nn, t);
      const corners: Array<[THREE.Vector3, THREE.Vector3]> = [
        [o.clone().addScaledVector(side, -w / 2), nn],
        [o.clone().addScaledVector(side, w / 2), nn],
        [p.clone().addScaledVector(side, w / 2), nn.clone().negate()],
        [p.clone().addScaledVector(side, -w / 2), nn.clone().negate()],
        [o.clone().addScaledVector(side, w / 2), side],
        [p.clone().addScaledVector(side, w / 2), side],
        [p.clone().addScaledVector(side, -w / 2), side.clone().negate()],
        [o.clone().addScaledVector(side, -w / 2), side.clone().negate()],
      ];
      for (const [v, nv] of corners) {
        pos.push(v.x, v.y, v.z);
        nrm.push(nv.x, nv.y, nv.z);
      }
      if (i === samples) break;
      const b = i * 8;
      for (const [a0, a1] of [[0, 1], [2, 3], [4, 5], [6, 7]] as const) {
        idx.push(b + a0, b + 8 + a0, b + a1, b + a1, b + 8 + a0, b + 8 + a1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    return g;
  };
  const kits = new Map<string, THREE.Group>();
  const kitExtras = new Map<string, THREE.Group>();
  let caseDown: THREE.Group | null = null;
  let caseUp: THREE.Group | null = null;
  let carrying = false;
  const kitMats: THREE.Material[] = [];
  const kitMat = (m: THREE.Material) => (kitMats.push(m), m);
  const kitGroup = (cls: string, parts: Array<[THREE.BufferGeometry[], THREE.Material]>) => {
    const g = new THREE.Group();
    g.name = `kit-${cls}`;
    g.visible = false;
    for (const [geos, mat] of parts) add(mergeGeos(geos), mat, g);
    pelvis.add(g);
    kits.set(cls, g);
  };
  {
    const gunMetal = kitMat(new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.3, metalness: 0.75 }));
    // Ghost: the rifle's sling across her chest, the scoped barrel standing over her left shoulder.
    // Plan item 319 slice 53: the sling is flat webbing laid on the coat (`coatStrap`), not a round tube: the tube's
    // spline stood 3-5 cm off the coat and bowed out past her arm, so at the pick it read as a hose looping in front.
    kitGroup("ghost", [
      [
        [
          coatStrap(
            [
              [2.2, 0.5], // behind her left shoulder
              [1.62, 0.522], // over its top, beside the collar
              [0.95, 0.47],
              [0.42, 0.32], // across the chest
              [-0.25, 0.17],
              [-0.95, 0.04], // her right hip
              [-1.6, -0.02],
              [-2.4, 0.03], // round to the rifle's butt at her back
            ],
            0.034,
          ),
        ],
        kitMat(new THREE.MeshStandardMaterial({ color: 0x5f4632, roughness: 0.68, metalness: 0.02 })),
      ],
      [
        [
          // The barrel along her back, its muzzle and scope standing clear of her hair over the left shoulder.
          limb(V(0.02, 0.05, -0.19), V(0.31, 1.02, -0.12), 0.018, 0.011, 10),
          limb(V(0.2, 0.66, -0.17), V(0.245, 0.83, -0.155), 0.026, 0.026, 12),
          limb(V(0.3, 0.99, -0.122), V(0.318, 1.06, -0.118), 0.017, 0.017, 8),
        ],
        gunMetal,
      ],
    ]);
    // Butcher: a heavy leather apron from the chest to below the knee, on a neck strap.
    kitGroup("butcher", [
      [
        [
          tube([[-0.065, 0.36, 0.12], [-0.06, 0.47, 0.11], [0, 0.545, 0.06], [0.06, 0.47, 0.11], [0.065, 0.36, 0.12]], 0.007, 16),
        ],
        kitMat(new THREE.MeshStandardMaterial({ color: 0x4a2418, roughness: 0.36, metalness: 0.08, side: THREE.DoubleSide })),
      ],
    ]);
    // Gunslinger: a gunbelt slung low on her hips and the holstered revolver on her right.
    const gunbelt = new THREE.TorusGeometry(0.19, 0.016, 6, seg(28));
    gunbelt.rotateX(Math.PI / 2);
    gunbelt.scale(1, 1, 0.74);
    gunbelt.rotateZ(0.12);
    gunbelt.translate(0, -0.08, 0);
    const holster = new THREE.BoxGeometry(0.06, 0.17, 0.045);
    holster.rotateZ(-0.12);
    holster.translate(-0.215, -0.19, 0.03);
    const grip = new THREE.BoxGeometry(0.03, 0.075, 0.03);
    grip.rotateZ(0.5);
    grip.translate(-0.23, -0.07, 0.04);
    kitGroup("gunslinger", [
      [[gunbelt, holster], kitMat(new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.48, metalness: 0.04 }))],
      [[grip, limb(V(-0.215, -0.1, 0.035), V(-0.2, -0.05, 0.035), 0.016, 0.016, 8)], gunMetal],
    ]);
    // Wirewitch: lit cables from her spine over both shoulders, down the coat's front to a deck on her belt.
    const deck = new THREE.BoxGeometry(0.07, 0.045, 0.022);
    deck.translate(0.06, 0.1, 0.098);
    kitGroup("wirewitch", [
      [
        [
          tube([[-0.04, 0.5, -0.11], [-0.15, 0.53, -0.01], [-0.155, 0.42, 0.105], [-0.11, 0.24, 0.105], [0.03, 0.11, 0.1]], 0.0042),
          tube([[0.04, 0.5, -0.11], [0.15, 0.53, -0.01], [0.15, 0.4, 0.11], [0.09, 0.18, 0.1], [0.07, 0.12, 0.1]], 0.0042),
          deck,
        ],
        kitMat((rigMat = new THREE.MeshBasicMaterial({ color: rigBase.clone(), toneMapped: false }))),
      ],
    ]);
    // Fixer: a claret tie down the open collar and a white pocket square.
    // Plan item 319 slice 54: a flat silk tie, its knot under the collar and the blade widening to a point, laid on
    // her chest's curve: a 2.4 cm round tube read as a sausage down her front at the pick.
    const tieOn = (g: THREE.BufferGeometry, lift: number) => {
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const r = rAtCoat(y);
        p.setZ(i, p.getZ(i) + 0.7 * Math.sqrt(Math.max(0, r * r - p.getX(i) ** 2)) + lift);
      }
      g.computeVertexNormals();
      return g;
    };
    const tieShape = new THREE.Shape();
    tieShape.moveTo(-0.009, 0.503);
    tieShape.bezierCurveTo(-0.014, 0.44, -0.022, 0.36, -0.023, 0.318);
    tieShape.lineTo(0, 0.294);
    tieShape.lineTo(0.023, 0.318);
    tieShape.bezierCurveTo(0.022, 0.36, 0.014, 0.44, 0.009, 0.503);
    tieShape.closePath();
    const knotShape = new THREE.Shape();
    knotShape.moveTo(-0.014, 0.532);
    knotShape.lineTo(0.014, 0.532);
    knotShape.lineTo(0.009, 0.5);
    knotShape.lineTo(-0.009, 0.5);
    knotShape.closePath();
    const extrude = (sh: THREE.Shape, depth: number, curve = 6) =>
      new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: 0.0015, bevelSegments: 2, curveSegments: curve, steps: 1 });
    // The blade in rows down its length, so it bends with the chest instead of lying as one flat card.
    const blade = extrude(tieShape, 0.0025, 12);
    const knot = extrude(knotShape, 0.007, 4);
    // Slice 54: the pocket square folded into three peaks over the breast pocket, on the coat (a box stood 2 cm off it).
    const sqShape = new THREE.Shape();
    sqShape.moveTo(-0.022, 0);
    sqShape.lineTo(-0.019, 0.016);
    sqShape.lineTo(-0.011, 0.024);
    sqShape.lineTo(-0.004, 0.015);
    sqShape.lineTo(0.004, 0.029);
    sqShape.lineTo(0.012, 0.016);
    sqShape.lineTo(0.019, 0.022);
    sqShape.lineTo(0.022, 0);
    sqShape.closePath();
    const square = extrude(sqShape, 0.004, 2);
    square.rotateZ(0.12);
    square.translate(0.1, 0.36, 0);
    kitGroup("fixer", [
      [[tieOn(blade, 0.004), tieOn(knot, 0.003)], kitMat(new THREE.MeshStandardMaterial({ color: 0x6e1f33, roughness: 0.35, metalness: 0.1 }))],
      [[tieOn(square, 0.013)], kitMat(new THREE.MeshStandardMaterial({ color: 0xf2ece2, roughness: 0.6, metalness: 0 }))],
    ]);
  }
  // ---- plan item 136: the auditions' guns in her left hand, in the chest frame. Each is a group built along +y from
  // the grip (muzzle up), its top (the scope, the rib) along +z; poseProps() stands it in her palm each frame. ----
  const gunMetalH = kitMat(new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.3, metalness: 0.75 }));
  const woodMat = kitMat(new THREE.MeshStandardMaterial({ color: 0x5a3220, roughness: 0.45, metalness: 0.05 }));
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
  };
  const rod = (r: number, y0: number, y1: number, z = 0, n = 10) => {
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, n);
    g.translate(0, (y0 + y1) / 2, z);
    return g;
  };
  const RIFLE_HOLD = 0.15;
  const rifle = new THREE.Group();
  rifle.name = "prop-rifle";
  addS(
    mergeGeos([
      box(0.03, 0.2, 0.05, 0, 0.06, 0), // the receiver
      rod(0.009, 0.16, 0.68), // the barrel
      rod(0.014, 0.6, 0.72, 0, 10), // the suppressor
      rod(0.017, 0.16, 0.34, 0.045, 12), // the scope tube
      rod(0.022, 0.32, 0.36, 0.045, 12), // its objective bell
      box(0.012, 0.03, 0.035, 0, 0.21, 0.025), // the mounts
      box(0.012, 0.03, 0.035, 0, 0.3, 0.025),
      box(0.022, 0.06, 0.04, 0, -0.02, -0.035), // the pistol grip
    ]),
    gunMetalH,
    rifle,
  );
  // Plan item 247: a profiled stock (it stands beside her face on the pick, where a box read as a plank): a slim
  // wrist off the receiver, the comb rising to a cheek riser, a straight heel, the belly sweeping down to the toe,
  // rounded edges; and a round fore-end tapering to the muzzle. +z is the scope's side, -z the grip's.
  const stockShape = new THREE.Shape();
  stockShape.moveTo(0.017, -0.04);
  stockShape.lineTo(0.019, -0.11);
  stockShape.quadraticCurveTo(0.02, -0.14, 0.026, -0.15);
  stockShape.lineTo(0.025, -0.262);
  stockShape.quadraticCurveTo(0.024, -0.282, 0.016, -0.284);
  stockShape.lineTo(-0.046, -0.284);
  stockShape.quadraticCurveTo(-0.054, -0.28, -0.052, -0.266);
  stockShape.quadraticCurveTo(-0.03, -0.17, -0.017, -0.09);
  stockShape.lineTo(-0.016, -0.04);
  stockShape.closePath();
  const stock = new THREE.ExtrudeGeometry(stockShape, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6 });
  stock.translate(0, 0, -0.012);
  stock.rotateY(-Math.PI / 2);
  const foreEnd = limb(V(0, 0.145, -0.02), V(0, 0.3, -0.018), 0.019, 0.015, 12);
  addS(mergeGeos([stock, foreEnd]), woodMat, rifle);
  // The glint: a four-point star off the scope's lens, always to the lens of the camera.
  const glintTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,240,220,0.8)");
    g.addColorStop(1, "rgba(255,240,220,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = "rgba(255,255,255,0.9)";
    x.fillRect(31, 0, 2, 64);
    x.fillRect(0, 31, 64, 2);
    return new THREE.CanvasTexture(c);
  })();
  const glintMat = new THREE.SpriteMaterial({ map: glintTex, color: new THREE.Color(3, 2.6, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true });
  mats.push(glintMat);
  const glintSprite = new THREE.Sprite(glintMat);
  glintSprite.position.set(0, 0.36, 0.045);
  glintSprite.scale.setScalar(0.001);
  rifle.add(glintSprite);
  // Plan item 300: she carries it by the fore-end, not the pistol grip, so the muzzle stands 0.15 m lower and clears
  // the sign and the frame's top on the pick.
  for (const c of rifle.children) c.position.y -= RIFLE_HOLD;
  rifle.visible = false;
  chest.add(rifle);

  const shotgunGeo = (parent: THREE.Object3D) => {
    addS(
      mergeGeos([
        box(0.034, 0.14, 0.05, 0, 0.04, 0), // the receiver
        rod(0.011, 0.1, 0.46, 0.008), // the barrel
        rod(0.008, 0.1, 0.4, -0.016), // the magazine tube
        box(0.024, 0.06, 0.036, 0, -0.03, -0.034), // the pistol grip
      ]),
      gunMetalH,
      parent,
    );
    addS(box(0.03, 0.17, 0.05, 0, -0.13, -0.015), woodMat, parent);
    const fore = add(box(0.03, 0.11, 0.032, 0, 0.21, -0.016), woodMat, parent);
    return fore;
  };
  const shotgun = new THREE.Group();
  shotgun.name = "prop-shotgun";
  const forend = shotgunGeo(shotgun);
  shotgun.visible = false;
  chest.add(shotgun);
  // The shell: a red hull on a brass head, flung from the port.
  const shell = new THREE.Group();
  addS(rod(0.0075, 0, 0.05, 0, 8), kitMat(new THREE.MeshStandardMaterial({ color: 0x9a1c1c, roughness: 0.5 })), shell);
  addS(rod(0.008, -0.008, 0.002, 0, 8), kitMat(new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.3, metalness: 0.8 })), shell);
  shell.visible = false;
  chest.add(shell);
  // The Butcher's shotgun on her left hip (the pelvis frame), muzzle down, until she draws it.
  const hipGun = new THREE.Group();
  hipGun.name = "kit-butcher-gun";
  shotgunGeo(hipGun);
  hipGun.position.set(0.245, -0.04, 0.05);
  hipGun.quaternion.setFromUnitVectors(V(0, 1, 0), V(0.05, -1, 0.06).normalize());
  kits.get("butcher")!.add(hipGun);
  const backRifle = kits.get("ghost")!.children[1]!;

  // ---- plan item 235: one large silhouette piece per class, so the five read apart at a glance on the class pick
  // (a critique read them as one figure with a different gun). Head pieces ride the head, the Fixer's case stands on
  // the street; each shows and hides with its kit. ----
  const extra = (cls: string, parent: THREE.Object3D, parts: Array<[THREE.BufferGeometry[], THREE.Material]>) => {
    const g = new THREE.Group();
    g.name = `kit-${cls}-extra`;
    for (const [geos, mat] of parts) add(mergeGeos(geos), mat, g);
    parent.add(g);
    kitExtras.set(cls, g);
    g.visible = false;
    return g;
  };
  {
    // Ghost: the hood up, a deep cowl round the back and top of her head, open at the face, falling to the collar.
    const hood = new THREE.SphereGeometry(1, seg(28), seg(18), Math.PI - 0.62, Math.PI + 1.24, 0, 2.5);
    // Plan item 260: cloth, not a shell (it read as a space helmet): folds fall from the crown and deepen toward the
    // collar, the back rises to a soft point, and the front edge sags a little off the brow.
    {
      const p = hood.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const polar = Math.acos(THREE.MathUtils.clamp(y, -1, 1)); // 0 at the crown
        const az = Math.atan2(x, z); // 0 at her front (the opening), ±π at the back
        const down = polar / 2.5;
        const fold = 1 + (0.045 * Math.sin(az * 5 + polar * 1.6) + 0.025 * Math.sin(az * 9 + 1.3)) * down * down;
        const back = Math.max(0, -Math.cos(az));
        const point = Math.exp(-Math.pow((polar - 0.75) / 0.35, 2)) * back * 0.14;
        const front = Math.max(0, Math.cos(az));
        const sag = front * Math.exp(-Math.pow((polar - 0.5) / 0.4, 2)) * 0.05;
        p.setXYZ(i, x * fold, y * fold + point * 0.5 - sag, z * fold - point * 0.7 + sag * 0.6);
      }
      hood.computeVertexNormals();
    }
    hood.scale(0.112, 0.13, 0.118);
    // Plan item 319 slice 27: the crown lies closer over her head (2.6 cm of air over the hair cap read as a helmet
    // shell); the lower edge stays put (lifting it bared the back hair at her nape). The brim follows the same map.
    const hoodCrown = (v: THREE.Vector3): THREE.Vector3 => {
      const u = Math.max(0, (v.y - 0.012) / 0.13);
      return v.set(v.x * (1 - 0.05 * u), 0.012 + (v.y - 0.012) * (1 - 0.075 * u), (v.z + 0.01) * (1 - 0.05 * u) - 0.01);
    };
    hood.translate(0, 0.012, -0.01);
    {
      const p = hood.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        hoodCrown(v.fromBufferAttribute(p, i));
        p.setXYZ(i, v.x, v.y, v.z);
      }
      hood.computeVertexNormals();
    }
    // Plan item 247: the cowl was an open cylinder whose gap faced her left side, so a closed tube stood in front of
    // her chin (the "bucket"). Now a draped lathe: snug under the jaw, rounding out over the collar, open at the
    // front (+z) in a V that widens toward the chin, with soft folds that deepen as the cloth falls.
    const GAP = 0.62; // half the front opening at the top, radians
    const cowlProfile: Array<[number, number]> = [[0.098, -0.07], [0.104, -0.105], [0.118, -0.145], [0.14, -0.185], [0.16, -0.22], [0.17, -0.245]];
    const cowl = new THREE.LatheGeometry(cowlProfile.map(([r, y]) => new THREE.Vector2(r, y)), seg(28), GAP, Math.PI * 2 - GAP * 2);
    {
      const p = cowl.attributes.position as THREE.BufferAttribute;
      const top = cowlProfile[0]![1];
      const span = top - cowlProfile[cowlProfile.length - 1]![1];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const t = (top - y) / span; // 0 at the jaw, 1 at the hem
        const phi = Math.atan2(x, z);
        // Folds: two beating frequencies so they read as cloth, deeper toward the hem.
        const fold = 1 + (0.06 * Math.sin(phi * 7 + 0.8) + 0.035 * Math.sin(phi * 11 + 2.1)) * (0.25 + t);
        // The front edges hang lower than the back (the cowl drapes forward over the chest).
        const front = Math.max(0, Math.cos(phi));
        p.setXYZ(i, x * fold, y - 0.03 * front * t, z * fold);
      }
      cowl.computeVertexNormals();
    }
    cowl.translate(0, 0, -0.025);
    const hoodMat = kitMat(new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
    rimify(hoodMat as THREE.MeshStandardMaterial, 0.9, 0, 0, 0, false, 0, "wool", 0.35);
    // Plan item 247: a rolled brim round the face opening (the hood's cut edge read as a paper shell): a soft tube
    // down one edge of the opening, over the brow and down the other, a little proud of the cloth.
    const rimPts: THREE.Vector3[] = [];
    const onHood = (phi: number, theta: number) =>
      hoodCrown(new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * 0.112, Math.cos(theta) * 0.13 + 0.012, Math.sin(phi) * Math.sin(theta) * 0.118 - 0.01).multiplyScalar(1.03));
    for (let i = 0; i <= 8; i++) rimPts.push(onHood(Math.PI - 0.62, 2.45 - (i / 8) * 2.2));
    for (let i = 0; i <= 8; i++) rimPts.push(onHood(0.62, 0.25 + (i / 8) * 2.2));
    const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts), seg(40), 0.009, 6, false);
    extra("ghost", headPivot, [[[hood, cowl, rim], hoodMat]]);
    // Gunslinger: a wide-brimmed hat, the brim curled up at the sides and the crown pinched, tipped forward.
    const brim = new THREE.LatheGeometry([0.07, 0.11, 0.15, 0.175, 0.19].map((r, i) => new THREE.Vector2(r, [0, 0.002, 0.004, 0.012, 0.03][i]!)), seg(32));
    {
      // The sides curl up more than the front and back.
      const p = brim.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const r = Math.hypot(x, z);
        const side = (x / Math.max(r, 1e-6)) ** 2;
        p.setY(i, p.getY(i) * (0.2 + 1.6 * side) + Math.max(0, r - 0.12) * 0.25 * side);
        p.setZ(i, z * 0.92);
      }
      brim.computeVertexNormals();
    }
    const crown = new THREE.CylinderGeometry(0.068, 0.088, 0.1, seg(24), 2);
    {
      const p = crown.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.04) p.setY(i, p.getY(i) - 0.018 * Math.max(0, 1 - Math.abs(p.getX(i)) / 0.03));
      crown.computeVertexNormals();
    }
    crown.scale(1, 1, 0.9);
    crown.translate(0, 0.05, 0);
    const band = new THREE.CylinderGeometry(0.087, 0.089, 0.018, seg(24), 1, true);
    band.scale(1, 1, 0.9);
    band.translate(0, 0.012, 0);
    // A low rim on the hat: at full gain the brim's underside, edge-on to the lens, took the sign's Fresnel as a pale blue plate.
    const hatMat = kitMat(new THREE.MeshStandardMaterial({ color: 0x6a4c34, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }));
    rimify(hatMat as THREE.MeshStandardMaterial, 0.3);
    const hat = extra("gunslinger", headPivot, [
      [[brim, crown], hatMat],
      [[band], kitMat(new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.35, metalness: 0.6 }))],
    ]);
    hat.position.set(0, 0.075, -0.004);
    hat.rotation.set(0.14, 0, -0.06);
    // Wirewitch: a halo of lit cable behind her head, two rings with the rig's nodes on them.
    const halo: THREE.BufferGeometry[] = [];
    for (const [r, t] of [[0.2, 0.004], [0.17, 0.009], [0.135, 0.005]] as const) halo.push(new THREE.TorusGeometry(r, t, 6, seg(48)));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const n = new THREE.BoxGeometry(0.024, 0.024, 0.012);
      n.rotateZ(a);
      n.translate(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0);
      halo.push(n);
      const spoke = new THREE.BoxGeometry(0.035, 0.003, 0.003);
      spoke.rotateZ(a);
      spoke.translate(Math.cos(a) * 0.1525, Math.sin(a) * 0.1525, 0);
      halo.push(spoke);
    }
    const haloG = extra("wirewitch", headPivot, [[halo, rigMat!]]);
    haloG.position.set(0, 0.04, -0.1);
    haloG.scale.setScalar(1.3);
    // Plan item 278: a lit cable coiled round her free forearm above the cuff, its lead running up the sleeve, so the
    // raised hand of her stance carries its own spiral of light (her silhouette's one coiled shape). It rides the
    // forearm, so the arm's IK carries it.
    {
      const d = wristL.clone().sub(elbowL).normalize();
      const side = new THREE.Vector3().crossVectors(d, V(0, 0, 1)).normalize();
      const up = new THREE.Vector3().crossVectors(side, d).normalize();
      const pts: THREE.Vector3[] = [];
      const turns = 4.5;
      const n = 72;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const a = u * turns * Math.PI * 2;
        const at = elbowL.clone().lerp(wristL, 0.5 + 0.34 * u);
        const r = 0.0475 + 0.003 * Math.sin(u * Math.PI);
        pts.push(at.addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.92));
      }
      const coil = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg(160), 0.0052, 5, false);
      const s0 = pts[0]!;
      const lead = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([s0, s0.clone().lerp(elbowL, 0.45).addScaledVector(side, 0.012), elbowL.clone().addScaledVector(side, 0.046).addScaledVector(up, 0.01)]),
        12,
        0.0038,
        5,
        false,
      );
      const coilG = extra("wirewitch-coil", foreL, [[[coil, lead], rigMat!]]);
      coilG.name = "kit-wirewitch-coil";
    }
    // Butcher: a broad cleaver on her right hip, blade out, under the leather apron's edge.
    const blade = new THREE.BoxGeometry(0.11, 0.17, 0.006);
    blade.translate(0.015, -0.085, 0);
    const handle = limb(V(0, 0, 0), V(0, 0.1, 0), 0.013, 0.014, 8);
    const steel = kitMat(new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.28, metalness: 0.9 }));
    const cleaver = extra("butcher", pelvis, [
      [[blade], steel],
      [[handle], kitMat(new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.55 }))],
    ]);
    cleaver.position.set(-0.27, -0.1, 0.06);
    cleaver.rotation.set(0, 0.25, 0.3);
    // Fixer: her briefcase, brass clasps and a handle. She carries it in her free hand while she holds her stance,
    // and stands it on the street against her left boot while she straightens her collar (the audition).
    const caseMats = [
      kitMat(new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.38, metalness: 0.05 })),
      kitMat(new THREE.MeshStandardMaterial({ color: 0xc9a050, roughness: 0.3, metalness: 0.85 })),
    ] as const;
    const briefcase = (parent: THREE.Object3D, name: string) => {
      const body = new THREE.BoxGeometry(0.4, 0.29, 0.09);
      body.translate(0, 0.145, 0);
      const grip = new THREE.TorusGeometry(0.04, 0.008, 6, 14, Math.PI);
      grip.translate(0, 0.29, 0);
      const g = new THREE.Group();
      g.name = name;
      addS(mergeGeos([body, grip]), caseMats[0], g);
      addS(mergeGeos([-0.11, 0.11].map((x) => box(0.026, 0.02, 0.012, x, 0.255, 0.048))), caseMats[1], g);
      g.visible = false;
      parent.add(g);
      return g;
    };
    caseDown = briefcase(group, "kit-fixer-case");
    caseDown.position.set(0.3, 0, 0.16);
    caseDown.rotation.set(0, -0.55, -0.08);
    caseUp = briefcase(chest, "kit-fixer-case-carried");
    caseUp.rotation.set(0, -0.35, 0.04);
  }
  // The butcher's apron. It was a claret like her coat and vanished into it, then a blue-and-cream stripe that read
  // as a barcode under the red key on the pick (plan item 247). Now heavy saddle leather that stands off her olive
  // coat: a grain, darker worn edges, a stitched hem, a front pocket and old dark stains, hanging in soft folds.
  {
    const W = 128;
    const H = 256;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#80502f");
    g.addColorStop(1, "#6a3e24");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // The grain: small lighter and darker flecks (seeded, so every build paints the same leather).
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = rnd() < 0.5 ? "rgba(40,18,8,0.18)" : "rgba(170,120,80,0.12)";
      x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1);
    }
    // Worn darker edges, then the stitched hem just inside them.
    const edge = x.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, "rgba(30,12,4,0.55)");
    edge.addColorStop(0.1, "rgba(30,12,4,0)");
    edge.addColorStop(0.9, "rgba(30,12,4,0)");
    edge.addColorStop(1, "rgba(30,12,4,0.55)");
    x.fillStyle = edge;
    x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(30,12,4,0.5)";
    x.fillRect(0, H - 8, W, 8);
    x.strokeStyle = "rgba(214,178,120,0.85)";
    x.lineWidth = 1.5;
    x.setLineDash([4, 3]);
    x.beginPath();
    x.moveTo(6, 0);
    x.lineTo(6, H - 7);
    x.lineTo(W - 6, H - 7);
    x.lineTo(W - 6, 0);
    x.stroke();
    // The pocket across her middle, with its own stitching.
    x.fillStyle = "rgba(30,12,4,0.25)";
    x.fillRect(36, 120, 56, 44);
    x.strokeRect(38, 122, 52, 40);
    x.setLineDash([]);
    // Old stains: dark, soaked in, heavier toward the hem.
    for (let i = 0; i < 9; i++) {
      const sx = 16 + rnd() * (W - 32);
      const sy = 90 + rnd() * (H - 110);
      const r = 4 + rnd() * 10;
      const st = x.createRadialGradient(sx, sy, 0, sx, sy, r);
      st.addColorStop(0, "rgba(48,8,6,0.55)");
      st.addColorStop(1, "rgba(48,8,6,0)");
      x.fillStyle = st;
      x.beginPath();
      x.ellipse(sx, sy, r, r * (1 + rnd()), 0, 0, Math.PI * 2);
      x.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Plan item 112's apron, now its own mesh: mergeGeos drops UVs, and the leather needs them.
    const apron = new THREE.CylinderGeometry(0.19, 0.252, 0.8, seg(20), 8, true, -0.62, 1.24);
    {
      // Soft folds that deepen toward the hem (the leather is stiff at the bib, swings below the belt).
      const p = apron.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i);
        const py = p.getY(i);
        const pz = p.getZ(i);
        const t = Math.max(0, (0.1 - py) / 0.5);
        const phi = Math.atan2(px, pz);
        const f = 1 + 0.035 * t * Math.sin(phi * 9 + 0.6);
        p.setXYZ(i, px * f, py, pz * f);
      }
      apron.computeVertexNormals();
    }
    apron.scale(1, 1, 0.74);
    apron.translate(0, -0.03, 0);
    const am = kitMat(new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.52, metalness: 0.02, side: THREE.DoubleSide }));
    addS(apron, am, kits.get("butcher")!);
  }

  const GHOST_GRAB = V(0.22, 0.36, -0.1);
  // Plan item 300: a low carry, her hand at the hip on the fore-end, so the rifle hangs muzzle-down by her leg (stood
  // upright at her shoulder it crossed the HOLLOWELL sign and the frame's top on the pick).
  const GHOST_HOLD = V(0.4, -0.2, 0.14);
  const BUTCHER_HOLD = V(0.26, 0.04, 0.19);
  const palmRest = wristL.clone().addScaledVector(V(0, -1, 0.15).normalize(), 0.04);
  const pBasis = new THREE.Matrix4();
  const pX = new THREE.Vector3();
  const pY = new THREE.Vector3();
  const pZ = new THREE.Vector3();
  const shellFrom = new THREE.Vector3();
  const shellV = new THREE.Vector3();
  let shellLive = false;
  const stand = (o: THREE.Object3D, dir: THREE.Vector3, top: THREE.Vector3) => {
    o.position.copy(palmRest).applyMatrix4(foreL.matrix);
    pY.copy(dir).normalize();
    pZ.copy(top).addScaledVector(pY, -top.dot(pY)).normalize();
    pX.crossVectors(pY, pZ);
    o.quaternion.setFromRotationMatrix(pBasis.makeBasis(pX, pY, pZ));
  };
  // Plan item 247: leaned a little further out (0.12 -> 0.2) so the scope clears her face box, not only her cheek.
  const RIFLE_DIR = V(-0.14, -1, 0.14);
  const RIFLE_TOP = V(-1, 0, 0.35);
  const SHOT_DIR = V(0.38, 0.88, 0.28);
  const SHOT_TOP = V(0.2, 0.1, -1);
  let propNow: "rifle" | "shotgun" | null = null;
  function poseProps(inHand: "rifle" | "shotgun" | null, glintK: number, rackK: number, shellT: number): void {
    propNow = inHand;
    rifle.visible = inHand === "rifle";
    backRifle.visible = inHand !== "rifle";
    shotgun.visible = inHand === "shotgun";
    hipGun.visible = inHand !== "shotgun";
    if (inHand === "rifle") {
      stand(rifle, RIFLE_DIR, RIFLE_TOP);
      glintSprite.scale.setScalar(0.001 + 0.07 * glintK);
      glintSprite.visible = glintK > 0.01;
    }
    if (inHand === "shotgun") {
      stand(shotgun, SHOT_DIR, SHOT_TOP);
      forend.position.y = -0.075 * rackK;
      if (shellT >= 0) {
        // Thrown from the port out past her left side, under gravity, tumbling; gone below her knees.
        if (!shellLive) {
          shellLive = true;
          shellFrom.set(0.02, 0.05, 0).applyQuaternion(shotgun.quaternion).add(shotgun.position);
          shellV.set(0.9, 1.3, 0.5);
        }
        shell.position.copy(shellFrom).addScaledVector(shellV, shellT);
        shell.position.y -= 4.9 * shellT * shellT;
        shell.rotation.set(shellT * 19, 0, shellT * 13);
        shell.visible = shell.position.y > -0.8;
      } else {
        shell.visible = false;
        shellLive = false;
      }
    } else {
      shell.visible = false;
      shellLive = false;
    }
  }

  let wearing: string | null = null;
  // Plan item 278: the Ghost walks in with the umbrella furled (her rifle stands where the canopy was, and the
  // hood keeps the rain off), so her silhouette loses the canopy the other four keep. Indoors furls it for all.
  let inside = false;
  const furl = () => {
    const f = inside || wearing === "ghost";
    umb.visible = !f;
    furled.visible = f;
    dropLines.visible = !f;
  };

  // Plan item 247: merge the static parts per bone and material (see addS).
  {
    const groups = new Map<string, THREE.Mesh[]>();
    for (const m of statics) {
      const k = `${m.parent!.uuid}|${(m.material as THREE.Material).uuid}`;
      const list = groups.get(k);
      if (list) list.push(m);
      else groups.set(k, [m]);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const mat = list[0]!.material as THREE.MeshStandardMaterial;
      const names = list.map((m) => Object.keys(m.geometry.attributes));
      const common = names[0]!.filter((a) => names.every((n) => n.includes(a)));
      if (!common.includes("normal") || (mat.map && !common.includes("uv"))) continue;
      const indexed = list.every((m) => m.geometry.index);
      const geos = list.map((m) => {
        const g = indexed ? m.geometry.clone() : m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const a of Object.keys(g.attributes)) if (!common.includes(a)) g.deleteAttribute(a);
        g.morphAttributes = {};
        return g;
      });
      const merged = mergeGeometries(geos);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const parent = list[0]!.parent!;
      // (Their geometries are left to the collector: a part's geometry may be shared with a mesh outside the merge.)
      for (const m of list) m.removeFromParent();
      const one = new THREE.Mesh(merged, mat);
      one.name = list.find((m) => m.name)?.name ?? "";
      one.castShadow = true;
      one.receiveShadow = true;
      parent.add(one);
    }
  }

  // Plan item 254: the ink line on her biggest body parts (coat, sleeves, hair, head, legs, boots and gloves), not
  // her kit or the umbrella's open canopy (a hull of an open shell blacks its underside). One shared material; the
  // hulls are on the no-reflect layer (the mirror's street doesn't need them) and cast no shadow.
  const inkU = { uInk: { value: new THREE.Vector2(0.002, 0.003) }, uInkColor: { value: new THREE.Color(0x07050a) } };
  const inkMat = new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: INK_VERT, fragmentShader: INK_FRAG, side: THREE.BackSide });
  mats.push(inkMat);
  const bodyMats = new Set<THREE.Material>([coatMat, skirtMat, sleeveMat, blackMat, gloveMat, hairMat, skinMat, tightsMat, faceMat]);
  const inked: THREE.Mesh[] = [];
  {
    const cands: Array<{ m: THREE.Mesh; n: number }> = [];
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !bodyMats.has(m.material as THREE.Material)) return;
      for (let p: THREE.Object3D | null = m.parent; p && p !== group; p = p.parent) if (p.name.startsWith("kit-")) return;
      if (!m.geometry.attributes.normal) return;
      cands.push({ m, n: m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count });
    });
    cands.sort((a, b) => b.n - a.n);
    const setInk = (r: THREE.WebGLRenderer) => {
      const el = r.domElement;
      const w = el.clientWidth || el.width;
      const h = el.clientHeight || el.height;
      const px = INK_PX * THREE.MathUtils.clamp(h / 900, 0.7, 1.6);
      inkU.uInk.value.set((2 * px) / w, (2 * px) / h);
    };
    for (const { m } of cands.slice(0, INK_MAX)) {
      inkNormals(m.geometry);
      const hull = new THREE.Mesh(m.geometry, inkMat);
      hull.name = "ink";
      hull.castShadow = false;
      hull.receiveShadow = false;
      hull.layers.set(LAYER_NO_REFLECT);
      hull.renderOrder = -1;
      hull.onBeforeRender = setInk;
      m.add(hull);
      inked.push(m);
    }
  }

  return {
    inkParts: inked.length,
    group,
    head,
    ember,
    umbrellaTop,
    get wearing() {
      return wearing;
    },
    get expressionNow() {
      return faceExpr;
    },
    blinkMap: blinkTex,
    get idle() {
      return { ...idleNow };
    },
    get gaze() {
      return gazeWant ?? 0;
    },
    look(v, instant) {
      gazeWant = v === null ? null : THREE.MathUtils.clamp(v, -1, 1);
      if (instant) {
        gazeNow = gazeWant ?? 0;
        gazeW = gazeWant === null ? 0 : 1;
      }
    },
    expression(e, keepBlink) {
      if (e === faceExpr) return;
      faceExpr = e;
      const shut = faceMat.map === blinkTex;
      faceTex = faceMap(e);
      if (!shut) faceMat.map = faceTex;
      // The blink's frame shows only shut lids; the title's turn keeps it (a brow off for 130 ms doesn't show).
      if (!keepBlink) {
        paintFace(e, true);
        blinkTex.needsUpdate = true;
      }
    },
    faceMaps() {
      return [...(["smirk", "determined"] as const).map(faceMap), blinkTex];
    },
    kit(cls) {
      wearing = cls && kits.has(cls) ? cls : null;
      for (const [k, g] of kits) g.visible = k === wearing;
      for (const [k, g] of kitExtras) g.visible = k.split("-")[0] === wearing;
      // Plan item 319: the hood up holds the face-framing locks in; on the far side of her three-quarter face a
      // curtain lay over her outer eye as a dark glossy blob, the rim light catching it.
      lockGeo?.setDrawRange(0, wearing === "ghost" ? lockSheetIdx : Infinity);
      const tuck = wearing === "ghost";
      hairRimU.uHairRim.value = tuck ? 0 : 1;
      hairRimU.uHairHood.value = tuck ? 1 : 0;
      if (hairGeo && hairRestOpen && hairRestTuck) {
        hairRest = tuck ? hairRestTuck : hairRestOpen;
        (hairGeo.attributes.position!.array as Float32Array).set(hairRest);
        hairGeo.attributes.position!.needsUpdate = true;
        hairGeo.computeVertexNormals();
      }
      if (lockGeo && lockRestOpen && lockRestTuck) {
        lockRest = tuck ? lockRestTuck : lockRestOpen;
        (lockGeo.attributes.position!.array as Float32Array).set(lockRest);
        lockGeo.attributes.position!.needsUpdate = true;
        lockGeo.computeVertexNormals();
      }
      if (caseDown && caseUp) {
        caseDown.visible = wearing === "fixer" && !carrying;
        caseUp.visible = wearing === "fixer" && carrying;
      }
      furl();
    },
    showAllKits(on) {
      for (const [k, g] of kits) g.visible = on || k === wearing;
      for (const [k, g] of kitExtras) g.visible = on || k.split("-")[0] === wearing;
      if (caseDown && caseUp) {
        caseDown.visible = on || (wearing === "fixer" && !carrying);
        caseUp.visible = on || (wearing === "fixer" && carrying);
      }
      rifle.visible = shotgun.visible = shell.visible = glintSprite.visible = on;
    },
    update,
    triangles: Math.round(tris),
    setRim(viewDir) {
      rimU.uRimDir.value.copy(viewDir).normalize();
    },
    stance(kind, instant) {
      if (kind !== stanceWant) blendClock = 0;
      stanceWant = kind;
      if (instant) {
        stanceNow = kind;
        stanceW = kind ? 1 : 0;
        blendS = 0;
      }
    },
    get poseState() {
      const r = (v: number) => Math.round(v * 1000) / 1000;
      return { kind: stanceNow, w: stanceW, blendS, hand: [r(handNow.x), r(handNow.y), r(handNow.z)] as [number, number, number] };
    },
    play(kind, u, seconds) {
      clip = { kind, t0: null, held: u, dur: seconds ?? CLIP_S, u: u ?? 0 };
    },
    get clipState() {
      return clip ? { kind: clip.kind, u: clip.u, prop: propNow } : null;
    },
    tint(c, w) {
      rimU.uRimA.value.copy(rimA0).lerp(tmpC.copy(c).multiplyScalar(0.75), w);
      // The class's own key lights her face in the wardrobe: the face key steps back so it keeps its modelling.
      rimU.uKey.value.copy(key0).multiplyScalar(1 - 0.55 * w);
    },
    coat(c) {
      for (const m of coatMats) m.color.copy(c ?? coat0);
    },
    indoors(on) {
      inside = on;
      furl();
    },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of mats) m.dispose();
      for (const m of kitMats) m.dispose();
      smokeTex.dispose();
      glintTex.dispose();
      strands.dispose();
      for (const t of faceTexes.values()) t.dispose();
      blinkTex.dispose();
      group.removeFromParent();
    },
  };
}
