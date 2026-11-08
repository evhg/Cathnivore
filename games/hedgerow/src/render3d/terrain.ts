// The 3D battlefield's ground: a vertex-coloured heightfield that extends well past the playable grid into
// rolling country, with the lanes carved in as rutted dirt tracks, raised high ground, water, building plots
// (with protected land marked), scenery, the corporate gate at each spawn and the farmhouse. Seeded by the
// level id, so a level always looks the same.

import * as THREE from "three";
import { hasTwist, isProtected, laneCellsOf, landmarks, plotKind, sceneryCells, type Level } from "../engine";
import { twistDressing } from "../landmarks";
import { plotLooks, type PlotLook } from "../plotlook";
import { cropOf, type Crop } from "../growth";
import { crayonNextBillboard, drawDecor, isWonLevel, rng } from "../theme";
import { actLight } from "./palette";
import {
  buildBoat,
  buildCrane,
  buildDepot,
  buildFarmhouse,
  buildGate,
  buildHouse,
  buildLighthouse,
  buildOffice,
  buildRock,
  buildScarecrowProp,
  buildTowerKeep,
  buildTree,
  buildWall,
  buildWindmill,
} from "./models";
import { actMood, matte, shoreFade } from "./palette";
import { buildLanes, laneStyle } from "./lanes";
import { laneDistance, vergeScatter } from "./verge";

const MARGIN = 9;

let grain: THREE.Texture | null = null;
/** A soft speckle multiplied over the vertex colours, so the ground has grain up close. */
function grainTexture(): THREE.Texture {
  if (grain) return grain;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 128 * 128; i++) {
    const v = 215 + r() * 40;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grain = new THREE.CanvasTexture(c);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(24, 24);
  grain.colorSpace = THREE.SRGBColorSpace;
  return grain;
}
const RES = 6; // vertices per cell

/** Shared by every swaying plant and the cloud shadows: the renderer advances them in Ground.update. */
const timeU = { value: 0 };
const cloudOff = { value: new THREE.Vector2() };
const cloudAmt = { value: 0.3 };
let cloudTex: THREE.Texture | null = null;

/** Soft, tileable cloud blobs (white = shadow) that drift over the ground. */
function cloudTexture(): THREE.Texture {
  if (cloudTex) return cloudTex;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 5; k++) {
    const cx = r() * S;
    const cy = r() * S;
    for (let j = 0; j < 7; j++) {
      const x = cx + (r() - 0.5) * 70;
      const y = cy + (r() - 0.5) * 40;
      const rad = 18 + r() * 30;
      // Draw each puff at every wrap so the texture tiles.
      for (const ox of [-S, 0, S])
        for (const oy of [-S, 0, S]) {
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
          g.addColorStop(0, "rgba(255,255,255,0.55)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
        }
    }
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  cloudTex.colorSpace = THREE.NoColorSpace;
  return cloudTex;
}

/** The ground's material, darkened in drifting patches where clouds pass over the sun. */
function withCloudShadows(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCloudTex = { value: cloudTexture() };
    sh.uniforms.uCloudOff = cloudOff;
    sh.uniforms.uCloudAmt = cloudAmt;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vCloud;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvCloud = (modelMatrix * vec4(transformed, 1.0)).xz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uCloudTex; uniform vec2 uCloudOff; uniform float uCloudAmt; varying vec2 vCloud;")
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\nfloat cl = texture2D(uCloudTex, vCloud * 0.045 + uCloudOff).r;\ndiffuseColor.rgb *= 1.0 - uCloudAmt * smoothstep(0.05, 0.6, cl);",
      );
  };
  mat.customProgramCacheKey = () => "hedgerow-ground-clouds";
  return mat;
}

/** Plants bend in the breeze: the higher a vertex, the further it sways, each plant out of step. */
function withSway(mat: THREE.Material, amount: number, key: string): THREE.Material {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime * 1.9 + ip.x * 1.3 + ip.z * 0.9) + 0.5 * sin(uTime * 3.7 + ip.x * 2.9);
      transformed.x += sw * ${amount.toFixed(3)} * max(0.0, position.y) * 10.0;
      transformed.z += cos(uTime * 1.6 + ip.z * 1.7) * ${(amount * 0.5).toFixed(3)} * max(0.0, position.y) * 10.0;`,
    );
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

let tuftGeo: THREE.BufferGeometry | null = null;
/** A grass tuft: five blades fanned out, darker at the root and light at the tip, lit from above. Each blade
 * is built both ways round with an upward normal, so neither side renders dark. */
function tuftGeometry(): THREE.BufferGeometry {
  if (tuftGeo) return tuftGeo;
  const pos: number[] = [];
  const col: number[] = [];
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.7;
    const lean = 0.35 + (i % 3) * 0.15;
    const h = 0.05 + (i % 2) * 0.03;
    const w = 0.02;
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const tip = [cx * h * lean, h, cz * h * lean];
    // base left, base right, tip; then the same blade wound the other way.
    pos.push(-cz * w, 0, cx * w, cz * w, 0, -cx * w, ...tip);
    pos.push(cz * w, 0, -cx * w, -cz * w, 0, cx * w, ...tip);
    col.push(0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1.1, 1.1, 1.1, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 1.1, 1.1, 1.1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill([0, 1, 0]).flat(), 3));
  tuftGeo = g;
  return g;
}

let tickTex: THREE.Texture | null = null;
/** ROADMAP 136: glowing corner ticks that mark a plot as buildable. */
function tickTexture(): THREE.Texture {
  if (tickTex) return tickTex;
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "#ffe08a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.shadowColor = "#ffcf5a";
  ctx.shadowBlur = 4;
  const a = 5;
  const l = 14;
  for (const [x, y, dx, dy] of [[a, a, 1, 1], [S - a, a, -1, 1], [a, S - a, 1, -1], [S - a, S - a, -1, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + dx * l, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * l);
    ctx.stroke();
  }
  tickTex = new THREE.CanvasTexture(c);
  tickTex.colorSpace = THREE.SRGBColorSpace;
  return tickTex;
}

const bedTex = new Map<string, THREE.Texture>();
/**
 * Plan item 52: the top of a soil bed, by what lies under it. Greyscale (the instance colour tints it): furrows for
 * bare earth, rows of cut stalks for stubble, leaf clumps with white heads for clover.
 */
/** Plan item 236: the earth bed's furrows as a normal map (its colour map shades them; this makes them catch the
 *  sun): five ridges across the bed's grain, matching bedTexture's five dark troughs. */
let furrowTex: THREE.Texture | null = null;
function furrowNormals(): THREE.Texture {
  if (furrowTex) return furrowTex;
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    const v = (y + 0.5) / S - 0.5;
    // the slope of the furrow's height (the trough where bedTexture is darkest), turned to a tangent-space normal
    const slope = -Math.sin(v * Math.PI * 2 * 5) * 0.9;
    const len = Math.hypot(slope, 1);
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      img.data[i] = 128;
      img.data[i + 1] = Math.round(((slope / len) * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  furrowTex = new THREE.CanvasTexture(c);
  return furrowTex;
}

/** Plan item 236: the stubble bed's standing strip, as the act's crop (growth.ts `cropOf`). */
const STANDING: Record<Crop, { colour: string; s: number; sy: number }> = {
  wheat: { colour: "#e8c25a", s: 1, sy: 1.6 },
  cabbage: { colour: "#6f9a7a", s: 1.35, sy: 0.8 },
  sunflower: { colour: "#f2c230", s: 0.9, sy: 2.3 },
  pumpkin: { colour: "#e08a2e", s: 1.4, sy: 0.7 },
  lavender: { colour: "#9a7fc8", s: 1, sy: 1.4 },
};

function bedTexture(look: "earth" | "stubble" | "clover"): THREE.Texture {
  const hit = bedTex.get(look);
  if (hit) return hit;
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const r01 = rng(look.length * 977);
  if (look === "earth") {
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = (y + 0.5) / S - 0.5;
        const furrow = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 5);
        const i = (y * S + x) * 4;
        const shade = 255 - furrow * 90 - r01() * 18;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = shade;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  } else if (look === "stubble") {
    ctx.fillStyle = "#d8d8d8";
    ctx.fillRect(0, 0, S, S);
    for (let row = 0; row < 6; row++)
      for (let k = 0; k < 9; k++) {
        const x = (k + 0.3 + r01() * 0.4) * (S / 9);
        const y = (row + 0.5) * (S / 6);
        ctx.fillStyle = "#7a7a7a";
        ctx.fillRect(x + 1, y - 1, 2, 4);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y - 3, 2, 4);
      }
  } else {
    ctx.fillStyle = "#b8b8b8";
    ctx.fillRect(0, 0, S, S);
    for (let k = 0; k < 22; k++) {
      const x = r01() * S;
      const y = r01() * S;
      for (let a = 0; a < 3; a++) {
        const ang = (a / 3) * Math.PI * 2;
        ctx.fillStyle = k % 2 ? "#ffffff" : "#e2e2e2";
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * 2.4, y + Math.sin(ang) * 2.4, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bedTex.set(look, t);
  return t;
}

let waterNormal: THREE.Texture | null = null;
/** A tileable ripple normal map (sums of whole-period sines), scrolled to make the water move. */
function waterNormalTexture(): THREE.Texture {
  if (waterNormal) return waterNormal;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const waves = [
    [1, 2, 0.0, 1.0],
    [3, -1, 1.3, 0.6],
    [-2, 3, 2.1, 0.5],
    [5, 4, 0.7, 0.25],
    [-6, 5, 3.3, 0.2],
  ] as const;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, ph, a] of waves) {
        const arg = ((kx * x + ky * y) / S) * Math.PI * 2 + ph;
        const d = Math.cos(arg) * a;
        dx += d * kx;
        dy += d * ky;
      }
      const nx = -dx * 0.08;
      const ny = -dy * 0.08;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * S + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  waterNormal = new THREE.CanvasTexture(c);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.colorSpace = THREE.NoColorSpace;
  return waterNormal;
}

/** Cheap per-cell value noise in [0, 1] (stable across sessions). */
function hash2(c: number, r: number, seed: number): number {
  const s = Math.sin(c * 127.1 + r * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

interface Inst {
  x: number;
  y: number;
  z: number;
  ry: number;
  s: number;
  sy: number;
  color: THREE.Color;
}

/** One instanced mesh for many copies of a small thing (tufts, flowers, stones, hedges): one draw call. */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Inst[], shadows = false): THREE.InstancedMesh | null {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const mx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  items.forEach((it, i) => {
    mx.compose(p.set(it.x, it.y, it.z), q.setFromAxisAngle(up, it.ry), sc.set(it.s, it.s * it.sy, it.s));
    m.setMatrixAt(i, mx);
    m.setColorAt(i, it.color);
  });
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface Ground {
  group: THREE.Group;
  /** Height of the ground at (x, y) in cell units. */
  heightAt: (x: number, y: number) => number;
  farmhouse: THREE.Group;
  water: THREE.Mesh | null;
  /** Lantern positions at night (the renderer hangs a glow on each). */
  lamps: THREE.Vector3[];
  /** Advances the living bits of the ground: swaying grass, drifting cloud shadows, rippling water. */
  update: (t: number, dt: number) => void;
}


/** What fences each act's field in: hedgerows in the hills, dry-stone on the moor, driftwood by the sea, reeds
 * on the river, orchard rows at Oakvale, rubble at the Rift, kerbs and railings in town, planters at the Merger. */
type BorderStyle = "hedge" | "dark-hedge" | "wall" | "rubble" | "fence" | "reeds" | "orchard" | "rail" | "planters";
/** Scenery beyond the field per act: leaf colours, how many objects, and the share that are trees (the rest rocks). */
const SCENERY_LEAVES: string[][] = [
  ["#4f8a3a", "#5e9a43", "#6ea04c", "#7bb050"],
  ["#3f6a3a", "#467548", "#557f4a", "#6b8c52"],
  ["#6d8a4f", "#7f9a58", "#8aa461", "#6a8a62"],
  ["#5a7a48", "#6a8a50", "#7a9a58", "#889a60"],
  ["#c9742f", "#d6902f", "#b85a2a", "#e0a53a"],
  ["#5f8a5a", "#6f9a68", "#7aa070", "#88a878"],
  ["#7a7a42", "#6d6b3c", "#85803f", "#5f5a38"],
  ["#4c5f45", "#56694c", "#5d6f50", "#46563f"],
  ["#5e7a58", "#6a8864", "#547050", "#75906c"],
  ["#2f3d2c", "#38482f", "#2b3628", "#40503a"],
];
const SCENERY_COUNT = [70, 90, 55, 60, 95, 50, 55, 40, 30, 60];
const SCENERY_TREES = [0.7, 0.75, 0.45, 0.6, 0.9, 0.4, 0.3, 0.5, 0.35, 0.55];
const BORDER_OF_ACT: BorderStyle[] = ["hedge", "wall", "fence", "reeds", "orchard", "fence", "rubble", "rail", "planters", "dark-hedge"];

/** The ring of the field's edge as (x, z, along-x?) segment centres every `step` cells, `off` outside the grid. */
function ringPoints(cols: number, rows: number, off: number, step: number): Array<[number, number, boolean]> {
  const pts: Array<[number, number, boolean]> = [];
  for (let c = -off + step / 2; c < cols + off; c += step) pts.push([c, -off, true], [c, rows + off, true]);
  for (let r = -off + step / 2; r < rows + off; r += step) pts.push([-off, r, false], [cols + off, r, false]);
  return pts;
}

function buildBorder(
  style: BorderStyle,
  level: Level,
  cols: number,
  rows: number,
  heightAt: (x: number, y: number) => number,
  rand: () => number,
  tuftCols: THREE.Color[],
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const open = (x: number, z: number) => laneDistance(level, x, z) < 0.85;
  const c = (hex: string) => new THREE.Color(hex);
  const shade = (hex: string, k: number) => c(hex).multiplyScalar(k);
  const items: Inst[] = [];
  const push = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Inst[], shadows = true) => {
    const m = instanced(geo, mat, list, shadows);
    if (m) out.push(m);
  };
  if (style === "wall" || style === "rubble") {
    const tones = style === "wall" ? ["#a8a396", "#8f8a7c", "#b9b4a5", "#7d786b"] : ["#8a7a68", "#6e6254", "#9a8a76", "#5a5046"];
    for (const [x, z, alongX] of ringPoints(cols, rows, 0.55, 0.2)) {
      if (open(x, z)) continue;
      if (style === "rubble" && rand() < 0.22) continue;
      for (let course = 0; course < (style === "wall" ? 2 : 1 + Math.floor(rand() * 2)); course++) {
        const jitter = (rand() - 0.5) * 0.04;
        items.push({
          x: x + (alongX ? course * 0.1 : jitter),
          y: heightAt(x, z) + 0.05 + course * 0.1 + (style === "rubble" ? rand() * 0.04 : 0),
          z: z + (alongX ? jitter : course * 0.1),
          ry: (alongX ? 0 : Math.PI / 2) + (style === "rubble" ? (rand() - 0.5) * 0.8 : 0),
          s: 1,
          sy: style === "rubble" ? 0.7 + rand() * 0.9 : 1,
          color: shade(tones[Math.floor(rand() * tones.length)]!, 0.92 + rand() * 0.16),
        });
      }
    }
    push(new THREE.BoxGeometry(0.22, 0.1, 0.15), matte("#ffffff", 0.95), items);
  } else if (style === "fence" || style === "rail") {
    const posts: Inst[] = [];
    const rails: Inst[] = [];
    const wood = style === "fence" ? ["#b9a888", "#a39373", "#c7b898"] : ["#2d3036"];
    for (const [x, z, alongX] of ringPoints(cols, rows, 0.55, 0.5)) {
      if (open(x, z)) continue;
      const h = heightAt(x, z);
      for (const d of [-0.25, 0.25]) {
        const px = alongX ? x + d : x;
        const pz = alongX ? z : z + d;
        posts.push({ x: px, y: h + 0.14, z: pz, ry: 0, s: 1, sy: 1 + (style === "fence" ? (rand() - 0.5) * 0.3 : 0), color: shade(wood[Math.floor(rand() * wood.length)]!, 0.9 + rand() * 0.2) });
      }
      for (const y of style === "fence" ? [0.1, 0.21] : [0.27]) rails.push({ x, y: h + y, z, ry: alongX ? 0 : Math.PI / 2, s: 1, sy: 1, color: shade(wood[0]!, 1) });
      if (style === "rail") items.push({ x, y: h + 0.02, z, ry: alongX ? 0 : Math.PI / 2, s: 1, sy: 1, color: c("#b8b4aa") });
    }
    push(new THREE.CylinderGeometry(0.018, 0.022, 0.3, 5), matte("#ffffff", 0.85), posts);
    push(new THREE.BoxGeometry(0.52, style === "fence" ? 0.035 : 0.02, 0.02), matte("#ffffff", style === "fence" ? 0.9 : 0.4), rails, false);
    push(new THREE.BoxGeometry(0.52, 0.04, 0.1), matte("#ffffff", 0.9), items, false);
  } else if (style === "planters") {
    const plants: Inst[] = [];
    for (const [x, z, alongX] of ringPoints(cols, rows, 0.6, 0.62)) {
      if (open(x, z)) continue;
      const h = heightAt(x, z);
      items.push({ x, y: h + 0.07, z, ry: alongX ? 0 : Math.PI / 2, s: 1, sy: 1, color: shade("#c9ccd0", 0.92 + rand() * 0.12) });
      plants.push({ x, y: h + 0.17, z, ry: rand() * 6, s: 0.1 + rand() * 0.04, sy: 0.8, color: shade("#5f8a52", 0.9 + rand() * 0.25) });
    }
    push(new THREE.BoxGeometry(0.58, 0.14, 0.2), matte("#ffffff", 0.35), items);
    push(new THREE.IcosahedronGeometry(1, 1), matte("#ffffff"), plants);
  } else if (style === "reeds") {
    const reeds: Inst[] = [];
    const cols2 = ["#a7a867", "#8f9a58", "#b9b075"].map((h) => c(h));
    for (let row = 0; row < 3; row++)
      for (const [x, z] of ringPoints(cols, rows, 0.5 + row * 0.16, 0.07)) {
        if (open(x, z) || rand() < 0.25) continue;
        reeds.push({ x: x + (rand() - 0.5) * 0.05, y: heightAt(x, z) - 0.005, z: z + (rand() - 0.5) * 0.05, ry: rand() * 6.3, s: 1.5 + rand() * 0.8, sy: 2.4 + rand() * 1.8, color: cols2[Math.floor(rand() * 3)]!.clone().lerp(tuftCols[0]!, 0.15) });
      }
    push(tuftGeometry(), withSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0.02, "hedgerow-reed"), reeds, false);
  } else if (style === "orchard") {
    const trunks: Inst[] = [];
    const crowns: Inst[] = [];
    const fruit: Inst[] = [];
    const leafCols = ["#5f8a3a", "#6c9a40", "#527d34"].map((h) => c(h));
    for (const [x, z] of ringPoints(cols, rows, 0.85, 0.85)) {
      if (laneDistance(level, x, z) < 1.05) continue;
      const h = heightAt(x, z);
      const k = 0.85 + rand() * 0.35;
      trunks.push({ x, y: h + 0.12 * k, z, ry: 0, s: k, sy: 1, color: c("#5a4028") });
      crowns.push({ x, y: h + 0.34 * k, z, ry: rand() * 6, s: 0.22 * k, sy: 0.9, color: leafCols[Math.floor(rand() * 3)]! });
      for (let i = 0; i < 4; i++) {
        const a = rand() * 6.3;
        fruit.push({ x: x + Math.cos(a) * 0.19 * k, y: h + (0.28 + rand() * 0.14) * k, z: z + Math.sin(a) * 0.19 * k, ry: 0, s: 0.028, sy: 1, color: c(rand() < 0.6 ? "#c94a3a" : "#e8c24a") });
      }
    }
    push(new THREE.CylinderGeometry(0.025, 0.04, 0.24, 6), matte("#ffffff", 0.95), trunks);
    push(new THREE.IcosahedronGeometry(1, 1), matte("#ffffff"), crowns);
    push(new THREE.IcosahedronGeometry(1, 0), matte("#ffffff", 0.5), fruit, false);
  }
  return out;
}

/** Tints a field point (x, y in cells) with the act's own ground: mown stripes, heather, dunes, silt, blossom, scorch, rubble, paving. */
/** The small set piece scattered through an act's field: hay, standing stones, buoys, logs, crates... */
function actProp(act: number): { geo: () => THREE.BufferGeometry; colors: string[]; rate: number; size: number } {
  const bale = () => new THREE.CylinderGeometry(0.07, 0.07, 0.11, 10).rotateZ(Math.PI / 2).translate(0, 0.07, 0);
  const stone = () => new THREE.CylinderGeometry(0.025, 0.05, 0.22, 5).translate(0, 0.11, 0);
  const buoy = () => new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.06, 0);
  const log = () => new THREE.CylinderGeometry(0.03, 0.03, 0.2, 7).rotateZ(Math.PI / 2).translate(0, 0.03, 0);
  const crate = () => new THREE.BoxGeometry(0.11, 0.1, 0.11).translate(0, 0.05, 0);
  const barrel = () => new THREE.CylinderGeometry(0.05, 0.055, 0.12, 8).translate(0, 0.06, 0);
  const slab = () => new THREE.BoxGeometry(0.17, 0.05, 0.1).rotateZ(0.25).translate(0, 0.05, 0);
  const bollard = () => new THREE.CylinderGeometry(0.03, 0.035, 0.12, 8).translate(0, 0.06, 0);
  const topiary = () => new THREE.IcosahedronGeometry(0.07, 1).translate(0, 0.1, 0);
  const ember = () => new THREE.ConeGeometry(0.06, 0.1, 5).translate(0, 0.05, 0);
  switch (act) {
    case 0: return { geo: bale, colors: ["#d9b85a", "#cfa94a", "#e0c070"], rate: 0.16, size: 1.7 };
    case 1: return { geo: stone, colors: ["#8d8a82", "#79766f", "#9a968c"], rate: 0.14, size: 1.7 };
    case 2: return { geo: buoy, colors: ["#d8503c", "#f0e6d0", "#3f78b0"], rate: 0.1, size: 1.7 };
    case 3: return { geo: log, colors: ["#7a5a3a", "#6a4c30", "#8a6a44"], rate: 0.16, size: 1.7 };
    case 4: return { geo: crate, colors: ["#b8864e", "#a8763e", "#c89a5c"], rate: 0.14, size: 1.7 };
    case 5: return { geo: barrel, colors: ["#8c5a34", "#7a4c2a", "#9a6a3e"], rate: 0.12, size: 1.7 };
    case 6: return { geo: slab, colors: ["#8d8b86", "#77756f", "#a09d96"], rate: 0.2, size: 1.7 };
    case 7: return { geo: bollard, colors: ["#d9c24a", "#555b60", "#d9c24a"], rate: 0.14, size: 1.7 };
    case 8: return { geo: topiary, colors: ["#3f7a45", "#4a8a50", "#366a3c"], rate: 0.14, size: 1.7 };
    default: return { geo: ember, colors: ["#3a3230", "#4a3d38", "#5a3a2a"], rate: 0.18, size: 1.7 };
  }
}

function fieldGround(act: number, c: THREE.Color, x: number, y: number, seed: number): void {
  const n = hash2(Math.floor(x * 2), Math.floor(y * 2), seed + 31);
  const wob = Math.sin(x * 1.9 + y * 0.8) * Math.sin(y * 2.3 - x * 0.5);
  const mix = (hex: string, k: number) => c.lerp(new THREE.Color(hex), Math.max(0, Math.min(1, k)));
  switch (act) {
    case 0: // mown stripes
      c.multiplyScalar(Math.floor(y * 1.0) % 2 === 0 ? 1.07 : 0.94);
      break;
    case 1: // heather and bracken on the moor
      mix(wob > 0.15 ? "#8a6a9a" : "#a07a4a", Math.abs(wob) * 0.55 * (0.4 + n));
      break;
    case 2: // pale dune streaks by the sea
      mix("#e2d3a6", Math.max(0, wob + 0.1) * 0.7);
      break;
    case 3: // river silt
      mix("#8a7a52", Math.max(0, -wob + 0.05) * 0.6);
      break;
    case 4: // orchard rows with fallen blossom
      c.multiplyScalar(Math.floor(x * 1.0) % 2 === 0 ? 1.05 : 0.95);
      if (n > 0.9) mix("#f0c8d2", 0.7);
      break;
    case 5: // sun-scorched grass
      mix("#b08a4a", Math.max(0, wob) * 0.55);
      break;
    case 6: // rubble scatter
      mix("#8b8780", n > 0.78 ? 0.7 : Math.max(0, wob) * 0.25);
      break;
    case 7: // town paving slabs
      mix("#aeb0aa", 0.62);
      if (Math.abs((x % 1) - 0.5) > 0.47 || Math.abs((y % 1) - 0.5) > 0.47) c.multiplyScalar(0.82);
      break;
    case 8: // clipped corporate lawn, checkered
      c.multiplyScalar((Math.floor(x) + Math.floor(y)) % 2 === 0 ? 1.06 : 0.93);
      break;
    case 9: // ash and cinders
      mix("#2c2826", Math.max(0, wob) * 0.5 + (n > 0.85 ? 0.3 : 0));
      break;
  }
}

export function buildGround(level: Level): Ground {
  const light = actLight(level.id);
  const rand = rng(level.id * 7919 + 17);
  const group = new THREE.Group();
  const cols = level.cols;
  const rows = level.rows;
  const lane = laneCellsOf(level);
  const high = new Set(
    [...(level.terrain?.high ?? []), ...landmarks(level).flatMap((m) => (m.type === "bank" ? m.cells : []))].map(([c, r]) => `${c},${r}`),
  );
  const bank = new Set(landmarks(level).flatMap((m) => (m.type === "bank" ? m.cells : [])).map(([c, r]) => `${c},${r}`));
  const scenery = sceneryCells(level);
  const wet = new Set((level.terrain?.water ?? []).map(([c, r]) => `${c},${r}`));
  const act = Math.floor((level.id - 1) / 10);
  const mood = actMood(level.id);
  // Decoration has its own seed, so adding it never moves the scenery the level already had.
  const deco = rng(level.id * 104729 + 3);

  // Hills out beyond the field: low noise that rises with distance from the grid.
  const noise = (x: number, y: number) =>
    Math.sin(x * 0.7 + level.id) * Math.cos(y * 0.6 - level.id * 0.3) * 0.5 + Math.sin(x * 0.23 + y * 0.31) * 0.8;
  /** 0 to 1: how far up a raised plot's plinth (x, y) is. */
  const plinth = (x: number, y: number): number => {
    const c = Math.floor(x);
    const r = Math.floor(y);
    if (!high.has(`${c},${r}`)) return 0;
    // A raised bank is one ridge: no dip where two of its cells meet.
    const joined = (dc: number, dr: number) => bank.has(`${c},${r}`) && bank.has(`${c + dc},${r + dr}`);
    const fx = Math.min(joined(-1, 0) ? 1 : x - c, joined(1, 0) ? 1 : c + 1 - x);
    const fy = Math.min(joined(0, -1) ? 1 : y - r, joined(0, 1) ? 1 : r + 1 - y);
    return smooth(Math.min(1, Math.min(fx, fy) / 0.25));
  };
  const heightAt = (x: number, y: number): number => {
    const ox = Math.max(0, -x, x - cols);
    const oy = Math.max(0, -y, y - rows);
    const out = Math.hypot(ox, oy);
    let h = out > 0 ? smooth(Math.min(1, out / 6)) * (1.2 + noise(x, y) * 0.9) : 0;
    // Plan item 66: behind the far edge the country stays low, so the painted backdrop's hills and sky show.
    if (y < 0) h *= 1 - 0.65 * smooth(Math.min(1, -y / 4));
    h += 0.32 * plinth(x, y);
    const d = laneDistance(level, x, y);
    if (d < 0.5) h -= 0.035 * smooth(1 - d / 0.5);
    return h;
  };

  const W = cols + MARGIN * 2;
  const H = rows + MARGIN * 2;
  const geo = new THREE.PlaneGeometry(W, H, W * RES, H * RES);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const g0 = new THREE.Color(light.grass[0]);
  const g1 = new THREE.Color(light.grass[1]);
  const g2 = new THREE.Color(light.grass[2]);
  const d0 = new THREE.Color(light.dirt[0]);
  const d1 = new THREE.Color(light.dirt[1]);
  const sand = new THREE.Color("#c9b88a");
  const bankTop = new THREE.Color("#d6c77a");
  const plinthWall = new THREE.Color(light.dirt[0]).lerp(new THREE.Color("#cfc5af"), 0.45);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cols / 2;
    const y = pos.getZ(i) + rows / 2;
    const h = heightAt(x, y);
    pos.setY(i, h);
    const n = (Math.sin(x * 3.1 + y * 1.7) + Math.sin(x * 1.3 - y * 2.9) + 2) / 4;
    tmp.copy(g0).lerp(n > 0.5 ? g2 : g1, Math.abs(n - 0.5) * 1.6);
    // Each field cell is a slightly different patch of grass: value noise between the cell centres.
    {
      const fx = x - 0.5;
      const fy = y - 0.5;
      const c0 = Math.floor(fx);
      const r0 = Math.floor(fy);
      const u = smooth(fx - c0);
      const v = smooth(fy - r0);
      const a = hash2(c0, r0, level.id);
      const b = hash2(c0 + 1, r0, level.id);
      const cc = hash2(c0, r0 + 1, level.id);
      const dd = hash2(c0 + 1, r0 + 1, level.id);
      const vn = a + (b - a) * u + (cc - a) * v + (a - b - cc + dd) * u * v;
      tmp.multiplyScalar(0.93 + vn * 0.12);
      tmp.r *= 1 + (vn - 0.5) * 0.06;
    }
    // Each act's field has its own ground in the plots between the lanes.
    if (x > 0 && x < cols && y > 0 && y < rows) fieldGround(act, tmp, x, y, level.id);
    const d = laneDistance(level, x, y);
    if (d < 0.42) {
      // Dirt track with two darker wheel ruts.
      const rut = Math.abs(Math.abs(d) - 0.17) < 0.05 ? 1 : 0;
      tmp.copy(d0).lerp(d1, rut * 0.7 + (Math.sin(x * 9 + y * 7) + 1) * 0.08);
    } else if (d < 0.5) tmp.lerp(d1, 0.7 * (1 - (d - 0.42) / 0.08));
    // A soft, darker verge where the track meets the grass (trodden earth and shade).
    if (d >= 0.42 && d < 0.8) tmp.multiplyScalar(1 - 0.16 * smooth(1 - (d - 0.42) / 0.38));
    if (wet.has(`${Math.floor(x)},${Math.floor(y)}`)) tmp.lerp(sand, 0.6);
    // Raised plots read as a built plinth: pale earthen walls with a lit, mown top.
    const up = plinth(x, y);
    if (up > 0) {
      if (up < 0.97) tmp.lerp(plinthWall, 0.85 * Math.min(1, (1 - up) * 3)).multiplyScalar(1.15);
      else tmp.multiplyScalar(1.1);
      // A raised bank's top is old pasture: paler, sun-dried grass with the odd tussock, so it reads as one rise.
      if (bank.has(`${Math.floor(x)},${Math.floor(y)}`) && up >= 0.97) tmp.lerp(bankTop, 0.4 + (Math.sin(x * 11 + y * 5) + 1) * 0.06);
    }
    // Darken the far hills a touch so the field reads.
    const out = Math.max(0, -x, x - cols, -y, y - rows);
    if (out > 0) tmp.multiplyScalar(1 - Math.min(0.18, out * 0.03));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, withCloudShadows(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: grainTexture() })));
  ground.position.set(cols / 2, 0, rows / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Water on wet plots, and a sea or river along one side in the coastal acts.
  let water: THREE.Mesh | null = null;
  const hasWater = wet.size > 0 || act === 2 || act === 3 || act === 5;
  /** Is (x, y) under water (a wet plot, or the sea beside a coastal field)? */
  const sunk = (x: number, y: number): boolean => {
    if (!hasWater) return false;
    const c = Math.floor(x);
    const r = Math.floor(y);
    // Plan item 198: Saltmarsh's sea comes in close, behind a band of tidal flats (it sat 2.5 cells out, a thin strip).
    const coast = act === 2 ? x < -1.7 : act === 3 ? x > cols + 1.6 : act === 5 ? x < -1.8 : false;
    return wet.has(`${c},${r}`) || (coast && !lane.has(`${c},${r}`) && laneDistance(level, x, y) > 1.2);
  };
  /** Near enough the water's edge that the sloping bank would leave a plant floating. */
  const nearWater = (x: number, y: number, m = 0.22): boolean =>
    hasWater && (sunk(x, y) || sunk(x - m, y) || sunk(x + m, y) || sunk(x, y - m) || sunk(x, y + m));
  if (hasWater) {
    // Two ripple layers scroll across each other (the base normal and the clear coat's), so the light on
    // the water never sits still.
    const ripples = waterNormalTexture().clone();
    ripples.repeat.set(W / 2.5, H / 2.5);
    const ripples2 = waterNormalTexture().clone();
    ripples2.repeat.set(W / 4, H / 4);
    ripples2.rotation = 0.6;
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshPhysicalMaterial({
        color: "#3d7fa6",
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.82,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        normalMap: ripples,
        normalScale: new THREE.Vector2(0.45, 0.45),
        clearcoatNormalMap: ripples2,
        clearcoatNormalScale: new THREE.Vector2(0.6, 0.6),
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cols / 2, -0.09, rows / 2);
    water.receiveShadow = true;
    group.add(water);
    // Lower the ground under water areas so the plane shows through.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cols / 2;
      const y = pos.getZ(i) + rows / 2;
      if (sunk(x, y)) pos.setY(i, Math.min(pos.getY(i), wet.has(`${Math.floor(x)},${Math.floor(y)}`) ? -0.2 : -0.4));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // Plan item 269: a shore round each pond, on the water: a band of pale shallows that fades out from each edge where
    // a wet cell meets dry land, so the water/land edge reads soft, not as a hard blue rectangle. One instanced mesh.
    const shallows: THREE.Matrix4[] = [];
    const SW = 0.34;
    const up = new THREE.Vector3(0, 1, 0);
    for (const key of wet) {
      const [c, r] = key.split(",").map(Number) as [number, number];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (wet.has(`${c + dc},${r + dr}`)) continue;
        // The strip's opaque side faces -z; turn it to face the dry neighbour.
        const turn = dr === -1 ? 0 : dr === 1 ? Math.PI : dc === -1 ? Math.PI / 2 : -Math.PI / 2;
        const x = c + 0.5 + dc * (0.5 - SW / 2);
        const z = r + 0.5 + dr * (0.5 - SW / 2);
        shallows.push(new THREE.Matrix4().compose(new THREE.Vector3(x, -0.08, z), new THREE.Quaternion().setFromAxisAngle(up, turn), new THREE.Vector3(1, 1, 1)));
      }
    }
    if (shallows.length) {
      const band = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1, SW).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: "#dcebdf", alphaMap: shoreFade(), transparent: true, roughness: 0.55, depthWrite: false }),
        shallows.length,
      );
      shallows.forEach((m, i) => band.setMatrixAt(i, m));
      band.name = "shallows";
      band.renderOrder = 2;
      group.add(band);
    }
  }

  // Building plots: a subtle tilled square on every plot; protected land gets a stone marker instead.
  // All of them are instanced (one draw call each), as are the grass, flowers and stones below.
  // Plan item 19: the bed itself carries the plot (stronger soil); the corner ticks are only a quiet hint now.
  // Plan item 52: each plot a soil bed with a timber edge, by what lies under it, so neighbours differ.
  const looks = plotLooks(level);
  const bedLooks = ["earth", "stubble", "clover"] as const;
  const bedTint: Record<(typeof bedLooks)[number], string> = { earth: "#7a5c38", stubble: "#d2b06a", clover: "#6f9a4e" };
  const beds: Record<(typeof bedLooks)[number], Inst[]> = { earth: [], stubble: [], clover: [] };
  const boards: Inst[] = [];
  const puddles: Inst[] = [];
  const cloverHeads: Inst[] = [];
  const bedGeo = new THREE.BoxGeometry(0.78, 0.05, 0.78).translate(0, 0.005, 0);
  const boardGeo = new THREE.BoxGeometry(0.86, 0.07, 0.05);
  const timberCols = ["#8a6a44", "#7a5c3a", "#94744c"].map((c) => new THREE.Color(c));
  const standing = STANDING[cropOf(level)];
  const lookOf = (c: number, r: number): PlotLook => looks.get(`${c},${r}`) ?? "earth";
  const tickMat = new THREE.MeshBasicMaterial({ map: tickTexture(), transparent: true, opacity: 0.22, depthWrite: false });
  const plotGeo = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);
  const plots: Inst[] = [];
  const markers: Inst[] = [];
  const tufts: Inst[] = [];
  const flowers: Inst[] = [];
  const pads: Inst[] = [];
  const stones: Inst[] = [];
  // Plan item 185: standing dressing per plot by its look (ridges in bare earth, hay stooks on stubble, clover
  // clumps), in the plot's corners and edges so a tower at its centre stands clear; and hedge strips along the lane.
  const ridges: Inst[] = [];
  const stooks: Inst[] = [];
  const clumps: Inst[] = [];
  const laneHedge: Inst[] = [];
  let plotCount = 0;
  let dressedCount = 0;
  const white = new THREE.Color("#ffffff");
  const markerCol = new THREE.Color("#bdb6a6");
  const tuftCols = [light.grass[2], light.grass[0], "#9cc46a", light.grass[1]].map((c) => new THREE.Color(c).multiplyScalar(1.05));
  const flowerCols = mood.flowers.map((c) => new THREE.Color(c));
  const stoneCols = ["#b9b0a0", "#9a9183", "#c8bfae", "#857a6a"].map((c) => new THREE.Color(c));
  const tuft = (x: number, z: number, scale = 1, tall = 1, colour?: THREE.Color) =>
    tufts.push({ x, y: heightAt(x, z) - 0.005, z, ry: deco() * Math.PI * 2, s: scale * (0.75 + deco() * 0.6), sy: tall, color: colour ?? tuftCols[Math.floor(deco() * tuftCols.length)]! });
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (lane.has(`${c},${r}`) || scenery.has(`${c},${r}`)) continue;
      const h = heightAt(c + 0.5, r + 0.5);
      const kind = plotKind(level, c, r);
      if (kind === "water") {
        // Lily pads on the pond, reeds at its edge.
        const n = 1 + Math.floor(deco() * 3);
        for (let i = 0; i < n; i++)
          pads.push({ x: c + 0.2 + deco() * 0.6, y: -0.083, z: r + 0.2 + deco() * 0.6, ry: deco() * 6.3, s: 0.6 + deco() * 0.6, sy: 1, color: tuftCols[i % 2]!.clone().multiplyScalar(0.8) });
        for (let i = 0; i < 4; i++) {
          const side = Math.floor(deco() * 4);
          const t = 0.1 + deco() * 0.8;
          const [x, z] = side === 0 ? [c + t, r + 0.06] : side === 1 ? [c + t, r + 0.94] : side === 2 ? [c + 0.06, r + t] : [c + 0.94, r + t];
          tufts.push({ x, y: -0.1, z, ry: deco() * 6.3, s: 1.1, sy: 2.6, color: tuftCols[3]!.clone().multiplyScalar(0.8) });
        }
        continue;
      }
      if (isProtected(level, c, r)) {
        markers.push({ x: c + 0.5, y: h + 0.11, z: r + 0.5, ry: 0, s: 1, sy: 1, color: markerCol });
        // Protected land grows wild.
        for (let i = 0; i < 6; i++) tuft(c + 0.15 + deco() * 0.7, r + 0.15 + deco() * 0.7, 1.15);
        continue;
      }
      plots.push({ x: c + 0.5, y: h + 0.04, z: r + 0.5, ry: 0, s: 1, sy: 1, color: white });
      {
        const look = lookOf(c, r);
        const base = look === "puddle" ? "earth" : look;
        const turn = (c * 31 + r * 17 + level.id) % 2 === 0 ? 0 : Math.PI / 2;
        beds[base].push({ x: c + 0.5, y: h, z: r + 0.5, ry: turn, s: 1, sy: 1, color: new THREE.Color(bedTint[base]).multiplyScalar(0.92 + deco() * 0.16) });
        for (let side = 0; side < 4; side++) {
          const along = side < 2;
          const off = (side % 2 ? 1 : -1) * 0.41;
          boards.push({ x: c + 0.5 + (along ? 0 : off), y: h + 0.015, z: r + 0.5 + (along ? off : 0), ry: along ? 0 : Math.PI / 2, s: 1, sy: 1, color: timberCols[Math.floor(deco() * timberCols.length)]! });
        }
        if (look === "puddle") puddles.push({ x: c + 0.3 + deco() * 0.4, y: h + 0.034, z: r + 0.3 + deco() * 0.4, ry: deco() * 6.3, s: 1, sy: 1, color: white });
        plotCount++;
        const corners: Array<[number, number]> = [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]];
        if (base === "earth") {
          // Two ridges either side of the middle, along the bed's grain.
          const soil = new THREE.Color(bedTint.earth).multiplyScalar(0.8);
          // Plan item 236: a planted bed, not a box: four ridges, seedlings coming up along two of them.
          const sprout = new THREE.Color("#7fb84e");
          for (const [k, o] of [-0.27, -0.09, 0.09, 0.27].entries()) {
            ridges.push({ x: c + 0.5 + (turn ? o : 0), y: h + 0.03, z: r + 0.5 + (turn ? 0 : o), ry: turn, s: 1, sy: 1, color: soil });
            // (the outer two, so a tower at the bed's middle stands clear)
            if (k === 0 || k === 3)
              for (const a of [-0.24, 0, 0.24])
                clumps.push({ x: c + 0.5 + (turn ? o : a), y: h + 0.055, z: r + 0.5 + (turn ? a : o), ry: deco() * 6.3, s: 0.55 + deco() * 0.2, sy: 1.2, color: sprout.clone().multiplyScalar(0.88 + deco() * 0.24) });
          }
        } else if (base === "stubble") {
          const hay = new THREE.Color("#d9b45a");
          for (const [dx, dz] of corners.filter(() => deco() < 0.6).slice(0, 3).concat([corners[(c + r) % 4]!]).slice(0, 3))
            stooks.push({ x: c + dx, y: h + 0.02, z: r + dz, ry: deco() * 6.3, s: 0.85 + deco() * 0.35, sy: 1, color: hay.clone().multiplyScalar(0.9 + deco() * 0.2) });
          // Plan item 236: a standing strip of the act's uncut crop along the bed's far edge (the middle kept for a
          // tower): wheat ears, kale, sunflowers, pumpkin vines or lavender, each its own colour and height.
          const ear = new THREE.Color(standing.colour);
          for (let k = 0; k < 5; k++) {
            const a = -0.28 + k * 0.14;
            tufts.push({ x: c + 0.5 + (turn ? 0.3 : a), y: h + 0.03, z: r + 0.5 + (turn ? a : -0.3), ry: deco() * 6.3, s: standing.s, sy: standing.sy, color: ear.clone().multiplyScalar(0.9 + deco() * 0.2) });
          }
        } else {
          const leaf = new THREE.Color("#5f9a3a");
          // Plan item 236: clover thick across the bed, not four lone clumps.
          for (const [dx, dz] of [...corners, [0.5, 0.17], [0.17, 0.5], [0.83, 0.5]] as Array<[number, number]>)
            clumps.push({ x: c + dx + (deco() - 0.5) * 0.06, y: h + 0.03, z: r + dz + (deco() - 0.5) * 0.06, ry: deco() * 6.3, s: 0.9 + deco() * 0.3, sy: 1, color: leaf.clone().multiplyScalar(0.85 + deco() * 0.3) });
        }
        dressedCount++;
        if (look === "clover")
          for (let k = 0; k < 4; k++) cloverHeads.push({ x: c + 0.18 + deco() * 0.64, y: h + 0.02, z: r + 0.18 + deco() * 0.64, ry: deco() * 6.3, s: 0.7, sy: 1, color: new THREE.Color(k % 3 ? "#fffaf0" : "#f0b8d0") });
      }
      // Grass and flowers grow around the plot's edges, clear of where a tower stands.
      const n = 5 + Math.floor(deco() * 5);
      for (let i = 0; i < n; i++) {
        const along = deco() * 0.94 + 0.03;
        const inset = 0.03 + deco() * 0.09;
        const side = Math.floor(deco() * 4);
        const [x, z] = side === 0 ? [c + along, r + inset] : side === 1 ? [c + along, r + 1 - inset] : side === 2 ? [c + inset, r + along] : [c + 1 - inset, r + along];
        if (laneDistance(level, x, z) < 0.5 || nearWater(x, z)) continue;
        if (deco() < mood.flowerRate) {
          flowers.push({ x, y: heightAt(x, z), z, ry: deco() * 6.3, s: 0.8 + deco() * 0.5, sy: 1, color: flowerCols[Math.floor(deco() * flowerCols.length)]! });
        } else tuft(x, z);
      }
    }
  // Wilder grass beyond the field's edge, thinning with distance.
  for (let i = 0; i < 520; i++) {
    const x = -4 + deco() * (cols + 8);
    const z = -4 + deco() * (rows + 8);
    if (x > -0.3 && x < cols + 0.3 && z > -0.3 && z < rows + 0.3) continue;
    if (laneDistance(level, x, z) < 0.55 || nearWater(x, z, 0.3)) continue;
    if (deco() < mood.flowerRate * 0.6) flowers.push({ x, y: heightAt(x, z), z, ry: deco() * 6.3, s: 0.9 + deco() * 0.5, sy: 1, color: flowerCols[Math.floor(deco() * flowerCols.length)]! });
    else tuft(x, z, 1.25, 1.2);
  }
  // Plan item 66: the verges dressed from the 2D field's set: a flock grazing, pines, wild-flower clumps, a scarecrow.
  const sheepBody: Inst[] = [];
  const sheepHead: Inst[] = [];
  const wool = new THREE.Color("#f4efe4");
  const face = new THREE.Color("#2e2724");
  for (const v of vergeScatter(level)) {
    const h = heightAt(v.x, v.y);
    if (v.kind === "flowers") {
      for (let k = 0; k < 7; k++) {
        const a = deco() * 6.3;
        const r = deco() * 0.16;
        const fx = v.x + Math.cos(a) * r;
        const fz = v.y + Math.sin(a) * r;
        flowers.push({ x: fx, y: heightAt(fx, fz), z: fz, ry: deco() * 6.3, s: (1.5 + deco() * 0.7) * v.s, sy: 1.2, color: flowerCols[Math.floor(deco() * flowerCols.length)]! });
      }
      tuft(v.x, v.y, 1.3, 1.2);
    } else if (v.kind === "sheep") {
      const s = 0.12 * v.s;
      sheepBody.push({ x: v.x, y: h + s * 0.95, z: v.y, ry: v.ry, s, sy: 0.78, color: wool });
      // The head leans down to graze, ahead of the body along its facing.
      sheepHead.push({ x: v.x + Math.cos(v.ry) * s * 1.05, y: h + s * 0.55, z: v.y - Math.sin(v.ry) * s * 1.05, ry: v.ry, s: s * 0.42, sy: 1.1, color: face });
    } else if (v.kind === "pine") {
      const t = buildTree("pine", deco, ["#3f6e33", "#355e2c", "#4a7a3a"]);
      t.position.set(v.x, h, v.y);
      t.scale.setScalar(v.s);
      group.add(t);
    } else {
      const sc = buildScarecrowProp();
      sc.position.set(v.x, h, v.y);
      sc.rotation.y = v.ry;
      group.add(sc);
    }
  }
  for (const m of [
    instanced(new THREE.IcosahedronGeometry(1, 1), matte("#ffffff", 0.95), sheepBody, true),
    instanced(new THREE.SphereGeometry(1, 8, 6), matte("#ffffff", 0.8), sheepHead, true),
  ])
    if (m) group.add(m);
  // The lane's own surface for the act (earth, boardwalk, tarmac, cobbles...).
  const laneAct = Math.max(0, Math.min(9, act));
  for (const m of buildLanes(level, laneAct, heightAt, withCloudShadows, rng(level.id * 6271 + 5)).meshes) group.add(m);
  const loose = laneStyle(laneAct).looseStones;
  // Stones and gravel along the lane's verges, a few kicked into the ruts (not on a paved or boarded lane).
  for (const path of [level.path, level.path2].filter(Boolean) as Array<Level["path"]>) {
    const pts = path.map(([c, r]) => [c + 0.5, r + 0.5] as const);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      for (let t = 0; t < len; t += 0.09) {
        const roll = deco();
        if (roll > 0.55) continue;
        const inLane = roll < 0.08;
        const side = deco() < 0.5 ? -1 : 1;
        const off = inLane ? (deco() - 0.5) * 0.6 : side * (0.42 + deco() * 0.1);
        const x = ax + (bx - ax) * (t / len) + nx * off + (deco() - 0.5) * 0.05;
        const z = ay + (by - ay) * (t / len) + ny * off + (deco() - 0.5) * 0.05;
        if (!inLane && (laneDistance(level, x, z) < 0.4 || nearWater(x, z, 0.12))) continue;
        const sz = inLane ? 0.012 + deco() * 0.01 : 0.018 + deco() * 0.03;
        if (inLane && !loose) continue;
        stones.push({ x, y: heightAt(x, z) + sz * 0.2, z, ry: deco() * 6.3, s: sz, sy: 0.55, color: stoneCols[Math.floor(deco() * stoneCols.length)]! });
        if (!inLane && deco() < 0.35) tuft(x - nx * side * 0.06, z - ny * side * 0.06, 0.9);
        // Plan item 66: wild flowers along the lane's verges.
        else if (!inLane && deco() < mood.flowerRate * 0.7) {
          const fx = x + nx * side * 0.05;
          const fz = z + ny * side * 0.05;
          if (laneDistance(level, fx, fz) > 0.42) flowers.push({ x: fx, y: heightAt(fx, fz), z: fz, ry: deco() * 6.3, s: 1 + deco() * 0.5, sy: 1, color: flowerCols[Math.floor(deco() * flowerCols.length)]! });
        }
      }
    }
  }
  // One kind of prop per act, tucked into plot corners (clear of where a tower stands), so each field has its own set pieces.
  {
    const prop = actProp(act);
    const props: Inst[] = [];
    const pr = rng(level.id * 15485863 + 11);
    const cols3 = prop.colors.map((c) => new THREE.Color(c));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (lane.has(`${c},${r}`) || scenery.has(`${c},${r}`) || isProtected(level, c, r) || plotKind(level, c, r) === "water") continue;
        if (pr() > prop.rate) continue;
        const cx = c + (pr() < 0.5 ? 0.14 : 0.86);
        const cz = r + (pr() < 0.5 ? 0.14 : 0.86);
        if (laneDistance(level, cx, cz) < 0.55 || nearWater(cx, cz)) continue;
        props.push({ x: cx, y: heightAt(cx, cz), z: cz, ry: pr() * 6.3, s: prop.size * (0.8 + pr() * 0.4), sy: 1, color: cols3[Math.floor(pr() * cols3.length)]! });
      }
    const m = instanced(prop.geo(), matte("#ffffff", 0.85), props, true);
    if (m) group.add(m);
  }
  const tuftMat = withSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0.012, "hedgerow-tuft");
  const flowerGeo = new THREE.IcosahedronGeometry(0.024, 0).scale(1, 0.55, 1).translate(0, 0.075, 0);
  const flowerMat = withSway(new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true, emissive: "#201810" }), 0.01, "hedgerow-flower");
  const stoneMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const padGeo = new THREE.CircleGeometry(0.07, 9, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2);
  for (const m of [
    ...bedLooks.map((l) => instanced(bedGeo, new THREE.MeshStandardMaterial({ roughness: 1, map: bedTexture(l), ...(l === "earth" ? { normalMap: furrowNormals() } : {}) }), beds[l], false)),
    instanced(boardGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), boards),
    instanced(new THREE.CircleGeometry(0.15, 14).scale(1, 0.62, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#8fb8d4", roughness: 0.08, metalness: 0.3 }), puddles),
    instanced(flowerGeo, flowerMat, cloverHeads),
    instanced(plotGeo, tickMat, plots.map((p) => ({ ...p, y: p.y + 0.006 }))),
    instanced(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), matte("#ffffff", 0.9), markers, true),
    instanced(tuftGeometry(), tuftMat, tufts),
    instanced(flowerGeo, flowerMat, flowers),
    instanced(new THREE.IcosahedronGeometry(1, 0), stoneMat, stones),
    instanced(padGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), pads),
  ])
    if (m) group.add(m);

  // Plan item 185: a low hedge along every lane edge that borders a plot (on the plot's side of the edge, clear of
  // its centre), so the lane runs between hedgerows as it does in 2D.
  let laneEdges = 0;
  let hedgedEdges = 0;
  const laneHedgeCols = ["#3f6e33", "#4a7a3a", "#355e2c", "#527f3d"].map((c) => new THREE.Color(c));
  for (const k of lane) {
    const [lc, lr] = k.split(",").map(Number) as [number, number];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = lc + dc;
      const r = lr + dr;
      if (c < 0 || r < 0 || c >= cols || r >= rows || lane.has(`${c},${r}`)) continue;
      laneEdges++;
      if (scenery.has(`${c},${r}`) || plotKind(level, c, r) === "water") continue;
      hedgedEdges++;
      // The edge's midpoint, nudged 0.07 into the plot; bushes every 0.16 along it.
      const ex = lc + 0.5 + dc * 0.5 + dc * 0.07;
      const ez = lr + 0.5 + dr * 0.5 + dr * 0.07;
      for (let t = -0.42; t <= 0.42; t += 0.14) {
        const x = ex + (dr ? t : 0);
        const z = ez + (dc ? t : 0);
        const rad = 0.065 + deco() * 0.025;
        laneHedge.push({ x, y: heightAt(x, z) + rad * 0.85, z, ry: deco() * 6.3, s: rad, sy: 1.15 + deco() * 0.3, color: laneHedgeCols[Math.floor(deco() * laneHedgeCols.length)]! });
      }
    }
  }
  for (const m of [
    instanced(new THREE.BoxGeometry(0.66, 0.05, 0.07).translate(0, 0.0, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), ridges),
    instanced(new THREE.ConeGeometry(0.075, 0.2, 7).translate(0, 0.1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), stooks, true),
    instanced(new THREE.IcosahedronGeometry(0.06, 0).scale(1, 0.7, 1).translate(0, 0.03, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), clumps),
    instanced(new THREE.IcosahedronGeometry(1, 1), matte("#ffffff"), laneHedge, true),
  ])
    if (m) {
      m.userData.dressing = true;
      group.add(m);
    }
  group.userData.dressing = { plots: plotCount, dressed: dressedCount, laneEdges, hedgedEdges, meshes: 4 };

  // Plan item 198: each act's biome in 3D, from the 2D field's set. Saltmarsh first: tidal flats between the field
  // and the sea, reed beds on them, egrets wading, and boats moored out on the water. Four instanced meshes (the
  // boats are the existing models). Other acts keep their scenery for now.
  let biome = "farm";
  if (act === 2) {
    biome = "saltmarsh";
    const flats: Inst[] = [];
    const reeds: Inst[] = [];
    const egretBody: Inst[] = [];
    const egretNeck: Inst[] = [];
    // Plan item 228: wet silt, grey-sand and silvered, with samphire greens and tide pools among it (the old browns,
    // stacked as pebbles, read as a band of mud at the phone's left edge).
    // Plan item 262: three colours in broad patches (silt, samphire, tide pool), not six speckled cell by cell.
    const [silt, samphire, pool] = ["#a39d80", "#8a9866", "#b7c3c4"].map((c) => new THREE.Color(c)) as [THREE.Color, THREE.Color, THREE.Color];
    const patchOf = (x: number, z: number): THREE.Color => {
      const v = 0.55 * Math.sin(z * 1.1 + x * 1.7) + 0.45 * Math.sin(z * 0.43 - x * 0.9 + 1.3);
      return v > 0.3 ? samphire : v < -0.5 ? pool : silt;
    };
    const reedCols = ["#aaa65c", "#c4b26a", "#8f9a4c"].map((c) => new THREE.Color(c));
    const white = new THREE.Color("#f6f4ee");
    for (let z = -2.5; z <= rows + 2.5; z += 0.34)
      for (let x = -1.65; x <= -0.45; x += 0.34) {
        const jx = x + (deco() - 0.5) * 0.2;
        const jz = z + (deco() - 0.5) * 0.2;
        if (laneDistance(level, jx, jz) < 0.9) continue;
        flats.push({ x: jx, y: heightAt(jx, jz) - 0.02, z: jz, ry: deco() * 6.3, s: 0.36 + deco() * 0.08, sy: 0.03, color: patchOf(jx, jz) });
        // Reeds stand in tight clumps (item 262: loose ones read as scattered black sticks from above).
        if (deco() < 0.4)
          for (let k = 0; k < 9; k++)
            reeds.push({ x: jx + (deco() - 0.5) * 0.12, y: heightAt(jx, jz), z: jz + (deco() - 0.5) * 0.12, ry: deco() * 6.3, s: 0.9 + deco() * 0.5, sy: 1, color: reedCols[Math.floor(deco() * reedCols.length)]! });
      }
    for (let i = 0; i < 5; i++) {
      const x = -1.4 + deco() * 0.8;
      const z = deco() * rows;
      if (laneDistance(level, x, z) < 1.1) continue;
      const ry = deco() * 6.3;
      egretBody.push({ x, y: heightAt(x, z) + 0.12, z, ry, s: 0.07, sy: 0.75, color: white });
      egretNeck.push({ x: x + Math.cos(ry) * 0.05, y: heightAt(x, z) + 0.16, z: z - Math.sin(ry) * 0.05, ry, s: 1, sy: 1, color: white });
    }
    for (const m of [
      instanced(new THREE.SphereGeometry(1, 10, 5), new THREE.MeshStandardMaterial({ roughness: 0.18, metalness: 0.08 }), flats),
      instanced(new THREE.ConeGeometry(0.016, 0.36, 4).translate(0, 0.18, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), reeds),
      instanced(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), egretBody, true),
      instanced(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 5).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), egretNeck),
    ])
      if (m) group.add(m);
    // Boats moored off the flats, along the shore. Plan item 228: the renderer settles each wholly into the frame's
    // side or out of it (a wide frame's left edge sliced two into red slabs).
    const moored: THREE.Object3D[] = [];
    group.userData.moored = moored;
    for (let i = 0; i < 4; i++) {
      const b = buildBoat(rand);
      const z = -0.5 + ((i + 0.5) / 4) * (rows + 1);
      b.position.set(-2.6 - rand() * 1.2, -0.06, z);
      b.rotation.y = Math.PI / 2 + (rand() - 0.5) * 0.6;
      b.userData.home = b.position.x;
      group.add(b);
      moored.push(b);
    }
  }
  if (act === 3) {
    // Rivermead: the river comes in close on the east, its bank lined with weeping willows and reed beds.
    biome = "rivermead";
    const trunks: Inst[] = [];
    const crowns: Inst[] = [];
    const reeds: Inst[] = [];
    const bark = new THREE.Color("#6b5640");
    const leafCols = ["#8fae55", "#a3bb62", "#7f9f4c"].map((c) => new THREE.Color(c));
    const reedCols = ["#8f9a4c", "#a8a45a", "#768540"].map((c) => new THREE.Color(c));
    for (let z = -1.5; z <= rows + 1.5; z += 1.9 + deco() * 0.8) {
      const x = cols + 0.75 + deco() * 0.5;
      if (laneDistance(level, x, z) < 1.2) continue;
      const h = heightAt(x, z);
      const ry = deco() * 6.3;
      trunks.push({ x, y: h, z, ry, s: 1, sy: 1, color: bark });
      crowns.push({ x, y: h + 0.62, z, ry, s: 0.42 + deco() * 0.1, sy: 1, color: leafCols[Math.floor(deco() * leafCols.length)]! });
    }
    for (let z = -2; z <= rows + 2; z += 0.3) {
      if (deco() > 0.55) continue;
      const x = cols + 1.25 + deco() * 0.3;
      if (laneDistance(level, x, z) < 1) continue;
      for (let k = 0; k < 6; k++)
        reeds.push({ x: x + (deco() - 0.5) * 0.2, y: heightAt(x, z), z: z + (deco() - 0.5) * 0.2, ry: deco() * 6.3, s: 0.9 + deco() * 0.5, sy: 1, color: reedCols[Math.floor(deco() * reedCols.length)]! });
    }
    // A willow's crown: a dome whose skirt hangs to the ground (a cone opening downward under a cap).
    const crownGeo = new THREE.LatheGeometry(
      [[0, 0.32], [0.45, 0.24], [0.78, 0.02], [0.92, -0.35], [0.98, -0.75], [0.9, -1.0]].map(([x, y]) => new THREE.Vector2(x!, y!)),
      12,
    );
    for (const m of [
      instanced(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6).translate(0, 0.35, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), trunks, true),
      instanced(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), crowns, true),
      instanced(new THREE.ConeGeometry(0.016, 0.36, 4).translate(0, 0.18, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), reeds),
    ])
      if (m) group.add(m);
  }
  // Outside the field and its hedge, clear of the lane and the water: where a biome's set dressing may stand.
  const outside = (x: number, z: number, m = 0.7) =>
    !(x > -m && x < cols + m && z > -m && z < rows + m) && laneDistance(level, x, z) > 1.1 && !nearWater(x, z, 0.35);
  if (act === 1) {
    // Highmoor: open moor round the field, heather and gorse in clumps and granite tors on the skyline.
    biome = "highmoor";
    const heather: Inst[] = [];
    const gorse: Inst[] = [];
    const tors: Inst[] = [];
    const heathCols = ["#8a5a9a", "#9b6fb8", "#7a4f88"].map((c) => new THREE.Color(c));
    const gorseCol = new THREE.Color("#d9b02e");
    const granite = ["#8e8a82", "#a09a90", "#7c786f"].map((c) => new THREE.Color(c));
    for (let i = 0; i < 420; i++) {
      const x = -4 + deco() * (cols + 8);
      const z = -4 + deco() * (rows + 8);
      if (!outside(x, z)) continue;
      const y = heightAt(x, z);
      if (deco() < 0.78) heather.push({ x, y: y + 0.02, z, ry: deco() * 6.3, s: 0.11 + deco() * 0.08, sy: 0.55, color: heathCols[Math.floor(deco() * 3)]! });
      else gorse.push({ x, y: y + 0.05, z, ry: deco() * 6.3, s: 0.12 + deco() * 0.06, sy: 0.8, color: gorseCol });
    }
    // A few tors: stacked slabs of granite out beyond the hedge.
    for (let t = 0; t < 4; t++) {
      const side = t % 4;
      const x = side === 0 ? -2.8 - deco() : side === 1 ? cols + 2.4 + deco() : deco() * cols;
      const z = side === 2 ? -2.6 - deco() : side === 3 ? rows + 2.4 + deco() : deco() * rows;
      if (!outside(x, z, 1.5)) continue;
      const y = heightAt(x, z);
      for (let k = 0; k < 3; k++)
        tors.push({ x: x + (deco() - 0.5) * 0.3, y: y + 0.12 + k * 0.2, z: z + (deco() - 0.5) * 0.3, ry: deco() * 6.3, s: 0.32 - k * 0.07, sy: 0.55, color: granite[Math.floor(deco() * 3)]! });
    }
    for (const m of [
      instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), heather),
      instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), gorse),
      instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), tors, true),
    ])
      if (m) group.add(m);
  }
  if (act === 5) {
    // Shingle Bay: the sea in close to the west, behind a shingle beach with wooden groynes running into it.
    biome = "shingle";
    const pebbles: Inst[] = [];
    const posts: Inst[] = [];
    const shingle = ["#c9bfae", "#b2a794", "#d8d0c0", "#9f9584"].map((c) => new THREE.Color(c));
    const timber = new THREE.Color("#6e5a44");
    // (on the west, where the camera looks: the field's south edge sits under the HUD)
    for (let z = -3; z <= rows + 3; z += 0.16)
      for (let x = -1.8; x <= -0.75; x += 0.16) {
        const jx = x + (deco() - 0.5) * 0.12;
        const jz = z + (deco() - 0.5) * 0.12;
        if (laneDistance(level, jx, jz) < 0.9) continue;
        pebbles.push({ x: jx, y: heightAt(jx, jz) + 0.005, z: jz, ry: deco() * 6.3, s: 0.04 + deco() * 0.035, sy: 0.55, color: shingle[Math.floor(deco() * 4)]! });
      }
    for (let z = -1.5; z <= rows + 1.5; z += 2.6) {
      if (laneDistance(level, -1.2, z) < 1.2) continue;
      for (let k = 0; k < 7; k++) {
        const x = -0.95 - k * 0.28;
        posts.push({ x, y: Math.max(-0.1, heightAt(x, z)), z, ry: 0, s: 1, sy: 1, color: timber });
      }
    }
    for (const m of [
      instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), pebbles),
      instanced(new THREE.CylinderGeometry(0.035, 0.04, 0.32, 6).translate(0, 0.12, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), posts, true),
    ])
      if (m) group.add(m);
  }
  if (act === 4) {
    // Oakvale: the field in a clearing, old oaks round it with bluebells carpeting the ground beneath them.
    biome = "oakvale";
    const trunks: Inst[] = [];
    const crowns: Inst[] = [];
    const bells: Inst[] = [];
    const bark = new THREE.Color("#5e4a36");
    const leaf = ["#4f7f37", "#5e8f41", "#3f6e33", "#6a9a48"].map((c) => new THREE.Color(c));
    const blue = ["#7f8cf0", "#9aa4ff", "#6c78d8"].map((c) => new THREE.Color(c));
    for (let i = 0; i < 60; i++) {
      const x = -4 + deco() * (cols + 8);
      const z = -4 + deco() * (rows + 8);
      if (!outside(x, z, 1.4)) continue;
      const y = heightAt(x, z);
      const k = 0.85 + deco() * 0.5;
      trunks.push({ x, y, z, ry: deco() * 6.3, s: k, sy: 1, color: bark });
      for (let c = 0; c < 3; c++)
        crowns.push({ x: x + (deco() - 0.5) * 0.5 * k, y: y + 0.95 * k + deco() * 0.25, z: z + (deco() - 0.5) * 0.5 * k, ry: deco() * 6.3, s: (0.38 + deco() * 0.16) * k, sy: 0.85, color: leaf[Math.floor(deco() * 4)]! });
      for (let b = 0; b < 14; b++) {
        const bx = x + (deco() - 0.5) * 1.6;
        const bz = z + (deco() - 0.5) * 1.6;
        if (!outside(bx, bz)) continue;
        bells.push({ x: bx, y: heightAt(bx, bz) + 0.02, z: bz, ry: 0, s: 0.03 + deco() * 0.015, sy: 1, color: blue[Math.floor(deco() * 3)]! });
      }
    }
    for (const m of [
      instanced(new THREE.CylinderGeometry(0.07, 0.11, 0.95, 7).translate(0, 0.47, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), trunks, true),
      instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), crowns, true),
      instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), bells),
    ])
      if (m) group.add(m);
  }
  if (act === 6) {
    // The Rift: the land split by the falling-out. A dark fissure zig-zags across the country beyond the hedge, the
    // ground beside it cracked into dry plates, and a few stumps of felled trees.
    biome = "rift";
    const plates: Inst[] = [];
    const crack: Inst[] = [];
    const stumps: Inst[] = [];
    const dry = ["#8a6f4e", "#9a7d58", "#7a6146"].map((c) => new THREE.Color(c));
    const dark = new THREE.Color("#0c0806");
    const wood = new THREE.Color("#6a543c");
    // The fissure: a zig-zag along the field's far (north) side and down its east side.
    const pts: Array<[number, number]> = [];
    for (let x = -3.5; x <= cols + 2.2; x += 0.5) pts.push([x, -1.6 - Math.abs(Math.sin(x * 1.3)) * 0.8]);
    for (let z = -1.2; z <= rows + 3; z += 0.5) pts.push([cols + 1.9 + Math.abs(Math.sin(z * 1.1)) * 0.7, z]);
    for (const [x, z] of pts) {
      if (laneDistance(level, x, z) < 1.1) continue;
      crack.push({ x, y: heightAt(x, z) + 0.012, z, ry: deco() * 6.3, s: 0.36 + deco() * 0.12, sy: 0.04, color: dark });
      for (let k = 0; k < 4; k++) {
        const px = x + (deco() - 0.5) * 1.4;
        const pz = z + (deco() - 0.5) * 1.4;
        if (!outside(px, pz)) continue;
        plates.push({ x: px, y: heightAt(px, pz) + 0.01, z: pz, ry: deco() * 6.3, s: 0.16 + deco() * 0.08, sy: 0.08, color: dry[Math.floor(deco() * 3)]! });
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = -3.5 + deco() * (cols + 7);
      const z = -3.5 + deco() * (rows + 7);
      if (!outside(x, z, 1.2)) continue;
      stumps.push({ x, y: heightAt(x, z), z, ry: deco() * 6.3, s: 1, sy: 0.7 + deco() * 0.6, color: wood });
    }
    for (const m of [
      instanced(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), plates),
      instanced(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshBasicMaterial({ color: "#ffffff" }), crack),
      instanced(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 7).translate(0, 0.08, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), stumps, true),
    ])
      if (m) group.add(m);
  }
  if (act === 7) {
    // The Ballot: polling day. Bunting strung on poles round the field's edge, a poppy-and-cornflower verge.
    biome = "ballot";
    const poles: Inst[] = [];
    const flags: Inst[] = [];
    const blooms: Inst[] = [];
    const pole = new THREE.Color("#6e5a44");
    const flagCols = ["#e8433a", "#f4ede1", "#3f6fb5", "#f2c94c"].map((c) => new THREE.Color(c));
    const bloomCols = ["#e8433a", "#6f8ff0"].map((c) => new THREE.Color(c));
    const ring: Array<[number, number]> = [];
    for (let x = -1; x <= cols + 1; x += 1.6) ring.push([x, -1.1]);
    for (let z = -1; z <= rows + 1; z += 1.6) ring.push([cols + 1.1, z], [-1.1, z]);
    for (const [x, z] of ring) {
      if (laneDistance(level, x, z) < 1) continue;
      poles.push({ x, y: heightAt(x, z), z, ry: 0, s: 1, sy: 1, color: pole });
      for (let k = 0; k < 4; k++) {
        const along = z === -1.1 ? [x + 0.32 * (k + 0.5), z] : [x, z + 0.32 * (k + 0.5)];
        flags.push({ x: along[0]!, y: heightAt(x, z) + 0.5 - Math.sin(((k + 0.5) / 4) * Math.PI) * 0.06, z: along[1]!, ry: z === -1.1 ? 0 : Math.PI / 2, s: 1, sy: 1, color: flagCols[k % 4]! });
      }
    }
    for (let i = 0; i < 300; i++) {
      const x = -4 + deco() * (cols + 8);
      const z = -4 + deco() * (rows + 8);
      if (!outside(x, z)) continue;
      blooms.push({ x, y: heightAt(x, z) + 0.05, z, ry: 0, s: 0.03, sy: 1, color: bloomCols[Math.floor(deco() * 2)]! });
    }
    for (const m of [
      instanced(new THREE.CylinderGeometry(0.018, 0.022, 0.56, 5).translate(0, 0.28, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), poles, true),
      instanced(new THREE.ConeGeometry(0.06, 0.12, 3).rotateX(Math.PI).translate(0, -0.06, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), flags),
      instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), blooms),
    ])
      if (m) group.add(m);
  }
  if (act === 7 || act === 8) addAdverts(group, level, cols, rows, heightAt);
  if (act === 8) {
    // The Merger: the corporations moving in. Grey glass office blocks on the skyline, and a chain-link fence of
    // grey posts where the hedge used to run thin.
    biome = "merger";
    const blocks: Inst[] = [];
    const posts: Inst[] = [];
    const glass = ["#8a96a2", "#9fabb6", "#76828e"].map((c) => new THREE.Color(c));
    const steel = new THREE.Color("#9a9a96");
    for (let i = 0; i < 9; i++) {
      const x = -2.5 + (i / 8) * (cols + 5) + (deco() - 0.5) * 0.6;
      const z = -3.2 - deco() * 0.9;
      if (laneDistance(level, x, z) < 1.4) continue;
      blocks.push({ x, y: heightAt(x, z), z, ry: (deco() - 0.5) * 0.2, s: 0.55 + deco() * 0.25, sy: 1.4 + deco() * 1.8, color: glass[Math.floor(deco() * 3)]! });
    }
    for (let x = -1; x <= cols + 1; x += 0.5) {
      const z = -1.05;
      if (laneDistance(level, x, z) < 0.9) continue;
      posts.push({ x, y: heightAt(x, z), z, ry: 0, s: 1, sy: 1, color: steel });
    }
    for (const m of [
      instanced(new THREE.BoxGeometry(1, 1, 0.7).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.5 }), blocks, true),
      instanced(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4).translate(0, 0.17, 0), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.6 }), posts),
    ])
      if (m) group.add(m);
  }
  if (act === 9) {
    // Kingsmarket: market night. Striped stalls ring the field with their lanterns lit.
    biome = "kingsmarket";
    const stalls: Inst[] = [];
    const roofs: Inst[] = [];
    const lamps: Inst[] = [];
    const wood = new THREE.Color("#6a543c");
    const roofCols = ["#c4433a", "#3f6fb5", "#d9a23a", "#5f8a5a"].map((c) => new THREE.Color(c));
    const lamp = new THREE.Color("#ffd27a");
    for (let i = 0; i < 26; i++) {
      const side = i % 3;
      const x = side === 0 ? -1.7 - deco() * 0.6 : side === 1 ? cols + 1.7 + deco() * 0.6 : -1 + deco() * (cols + 2);
      const z = side === 2 ? -1.8 - deco() * 0.6 : -1 + deco() * (rows + 2);
      if (!outside(x, z, 1.2)) continue;
      const y = heightAt(x, z);
      const ry = deco() * 6.3;
      stalls.push({ x, y, z, ry, s: 1, sy: 1, color: wood });
      roofs.push({ x, y: y + 0.36, z, ry, s: 1, sy: 1, color: roofCols[Math.floor(deco() * 4)]! });
      lamps.push({ x, y: y + 0.3, z, ry: 0, s: 0.035, sy: 1, color: lamp });
    }
    for (const m of [
      instanced(new THREE.BoxGeometry(0.4, 0.3, 0.26).translate(0, 0.15, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), stalls, true),
      instanced(new THREE.ConeGeometry(0.33, 0.14, 4).rotateY(Math.PI / 4).translate(0, 0.07, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), roofs, true),
      instanced(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial(), lamps),
    ])
      if (m) group.add(m);
  }
  group.userData.biome = biome;

  // Scenery out beyond the field.
  const leaves = (SCENERY_LEAVES[act] ?? [light.grass[1], "#4f7f37", "#5e8f41", "#6ea04c"]).slice();
  const treeKind = act === 6 ? "dead" : act === 1 || act === 4 ? "pine" : "oak";
  const nDecor = SCENERY_COUNT[act] ?? 70;
  const treeShare = SCENERY_TREES[act] ?? 0.7;
  for (let i = 0; i < nDecor; i++) {
    const x = -MARGIN + rand() * W;
    const y = -MARGIN + rand() * H;
    if (x > -0.6 && x < cols + 0.6 && y > -0.6 && y < rows + 0.6) continue;
    if (laneDistance(level, x, y) < 1.1) continue;
    const h = heightAt(x, y);
    if (h < -0.05 || nearWater(x, y, 0.4)) continue;
    const o = rand() < treeShare ? buildTree(rand() < 0.25 ? "pine" : treeKind, rand, leaves) : buildRock(rand);
    o.position.set(x, h, y);
    group.add(o);
  }
  // Hedgerows along the field's edge (the game's namesake), broken where the lanes run out.
  // (Instanced: hundreds of bushes in two draw calls instead of one each.)
  const hedgeCols = ["#3f6e33", "#4a7a3a", "#355e2c"].map((c) => new THREE.Color(c));
  const bushes: Inst[] = [];
  const blooms: Inst[] = [];
  const bloomCol = new THREE.Color(mood.blossom);
  // Slow wobble along the ring so hedges swell, thin out and open into gaps (differs per field).
  const ph1 = rand() * 6.3;
  const ph2 = rand() * 6.3;
  const hedgeAt = (x: number, y: number) => {
    if (laneDistance(level, x, y) < 0.85) return;
    const wob = Math.sin((x + y) * 1.7 + ph1) * 0.6 + Math.sin((x - y) * 0.9 + ph2) * 0.4;
    if (wob < -0.72) return; // a gap in the hedge
    const r = (0.13 + rand() * 0.05) * (0.8 + 0.3 * (wob + 1) * 0.5 + (wob > 0.7 ? 0.25 : 0));
    const color = hedgeCols[Math.floor(rand() * 3)]!;
    bushes.push({ x, y: heightAt(x, y) + r * 0.8, z: y, ry: deco() * 6.3, s: r, sy: 0.85 + rand() * 0.3, color });
    if (rand() < 0.15) blooms.push({ x: x + (rand() - 0.5) * 0.1, y: heightAt(x, y) + r * 1.6, z: y + (rand() - 0.5) * 0.1, ry: 0, s: 0.03, sy: 1, color: bloomCol });
  };
  const border = BORDER_OF_ACT[Math.max(0, Math.min(9, act))]!;
  if (border === "hedge" || border === "dark-hedge") {
    if (border === "dark-hedge") hedgeCols.forEach((c) => c.multiplyScalar(0.7));
    for (let c = -0.9; c <= cols + 0.9; c += 0.22)
      for (const r of [-0.62, -0.42, rows + 0.42, rows + 0.62]) hedgeAt(c + (rand() - 0.5) * 0.08, r);
    for (let r = -0.4; r <= rows + 0.4; r += 0.22)
      for (const c of [-0.62, -0.42, cols + 0.42, cols + 0.62]) hedgeAt(c, r + (rand() - 0.5) * 0.08);
  } else {
    for (const m of buildBorder(border, level, cols, rows, heightAt, rand, tuftCols)) group.add(m);
  }
  for (const m of [
    instanced(new THREE.IcosahedronGeometry(1, 1), matte("#ffffff"), bushes, true),
    instanced(new THREE.IcosahedronGeometry(1, 0), matte("#ffffff", 0.6), blooms),
  ])
    if (m) group.add(m);

  // Each act's landmarks along the far horizon (behind the field, where the camera looks).
  const night = act === 9 || hasTwist(level, "night");
  const spin: THREE.Object3D[] = [];
  const back = (x: number, z: number, o: THREE.Object3D, face = 0) => {
    const h = Math.max(0, heightAt(x, z));
    o.position.set(x, h, z);
    o.rotation.y = face;
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    group.add(o);
  };
  // Plan item 201: the far row's houses, which the renderer settles wholly into the frame or out of it (a wide frame's
  // top edge sliced them through the roofs).
  const far: THREE.Object3D[] = [];
  group.userData.far = far;
  const across = (n: number, z0: number, z1: number, make: (i: number) => THREE.Object3D, settle = false) => {
    for (let i = 0; i < n; i++) {
      const x = -3 + ((i + 0.5) / n) * (cols + 6) + (rand() - 0.5) * 1.2;
      const z = z0 + rand() * (z1 - z0);
      if (laneDistance(level, x, z) < 1.5) continue;
      const o = make(i);
      back(x, z, o, (rand() - 0.5) * 0.6);
      if (settle) {
        o.userData.home = z;
        // How near the field it may come: the far side's reserved band (verge.ts), or behind act 9's wall.
        o.userData.near = act === 9 ? -3 : -1.8;
        far.push(o);
      }
    }
  };
  switch (act) {
    case 0:
    case 1: {
      const w = buildWindmill();
      back(cols + 1.8, -2.4, w, -0.4);
      spin.push(w.userData.spin as THREE.Object3D);
      across(3, -3.2, -2.2, () => buildHouse(rand), true);
      break;
    }
    case 2:
    case 5: {
      back(act === 5 ? cols + 2 : -2.2, -2.6, buildLighthouse());
      across(4, -3.8, -2.4, () => buildBoat(rand));
      across(3, -3, -2.2, () => buildHouse(rand), true);
      break;
    }
    case 3:
    case 4:
      across(5, -3.2, -2.2, () => buildHouse(rand, night), true);
      break;
    case 6:
      across(3, -3.6, -2.4, () => buildCrane());
      break;
    case 7:
      across(7, -3.2, -2.2, () => buildHouse(rand, night), true);
      break;
    case 8:
      across(6, -4.2, -2.6, () => buildOffice(rand, true), true);
      break;
    case 9:
      back(cols / 2, -2.2, buildWall(cols + 6));
      across(3, -2.9, -2.6, () => buildTowerKeep());
      across(5, -4, -3.2, () => buildHouse(rand, true), true);
      break;
  }
  group.userData.spin = spin;

  // The corporate gate at each spawn (its sign board is turned to the camera by the renderer).
  const gateSigns: THREE.Object3D[] = [];
  group.userData.gateSigns = gateSigns;
  const depots: THREE.Object3D[] = [];
  group.userData.depots = depots;
  const gateAt = (path: Level["path"]) => {
    const [c, r] = path[0]!;
    const [c2, r2] = path[1]!;
    return { x: c + 0.5 + Math.sign(c - c2) * 1.1, z: r + 0.5 + Math.sign(r - r2) * 1.1 };
  };
  const label = level.id >= 81 ? "HOLLOWCANDOR" : level.id >= 41 && level.id <= 60 ? "CANDOR" : "HOLLOWELL";
  for (const path of [level.path, level.path2].filter(Boolean) as Array<Level["path"]>) {
    const [c, r] = path[0]!;
    const [c2, r2] = path[1]!;
    const dx = Math.sign(c - c2);
    const dy = Math.sign(r - r2);
    const gate = buildGate(label);
    gate.position.set(c + 0.5 + dx * 1.1, heightAt(c + 0.5 + dx * 1.1, r + 0.5 + dy * 1.1), r + 0.5 + dy * 1.1);
    gate.rotation.y = dx !== 0 ? 0 : Math.PI / 2;
    group.add(gate);
    const sign = gate.userData.sign as THREE.Object3D;
    // Plan item 103: a lane that starts on the field's own edge column stands its gate on the plots; the renderer
    // keeps such a board off a phone's small field (it grew over the next column) and names the town on the plate.
    sign.userData.inField = gate.position.x > 0 && gate.position.x < level.cols && gate.position.z > 0 && gate.position.z < level.rows;
    sign.userData.town = label;
    gateSigns.push(sign);
    // Plan item 157: Hollowell's depot beside the gate, set back off the field's edge.
    // Plan item 179: its door turned to the camera (the camera looks north, so the fascia, shutter and bay read) and
    // its spot left to the renderer, which knows the framing: these are the spots it may take, nearest the gate first,
    // on the verge just outside the field's west, east and north edges (the south verge stands over the plots on
    // screen), none on a gate.
    const depot = buildDepot();
    // Plan item 179: big enough that the shed itself (not only its bay) reads, about 90 px wide at D.
    depot.scale.setScalar(0.8);
    depot.rotation.y = -Math.PI / 2;
    const gx = gate.position.x, gz = gate.position.z;
    const spots: Array<{ x: number; z: number }> = [];
    for (let z = 0.5; z < level.rows; z += 1) spots.push({ x: -1.1, z }, { x: level.cols + 1.1, z });
    for (let x = -0.5; x <= level.cols + 0.5; x += 1) spots.push({ x, z: -1.9 });
    // Beside the gate or the lane's first six cells, where the round queues (further off, it reads as another
    // lane's), and off every gate.
    const queue: Array<{ x: number; z: number }> = [{ x: gx, z: gz }];
    for (let i = 1, n = 0; i < path.length && n < 6; i++) {
      const [ac, ar] = path[i - 1]!;
      const [bc, br] = path[i]!;
      const steps = Math.max(Math.abs(bc - ac), Math.abs(br - ar));
      for (let k = 0; k < steps && n < 6; k++, n++) queue.push({ x: ac + 0.5 + ((bc - ac) * k) / steps, z: ar + 0.5 + ((br - ar) * k) / steps });
    }
    // The gate itself counts first: a spot by the queue's far end costs a cell more than one by the gate.
    const dist = (sp: { x: number; z: number }) => Math.min(...queue.map((q, i) => Math.hypot(sp.x - q.x, sp.z - q.z) + (i ? 1 : 0)));
    const near = spots
      .filter((sp) => dist(sp) <= 4.6)
      .filter((sp) => [level.path, level.path2].every((p) => !p || Math.hypot(sp.x - gateAt(p).x, sp.z - gateAt(p).z) > 1.3))
      .sort((a, b) => dist(a) - dist(b));
    depot.userData.spots = near.map((sp) => ({ ...sp, y: heightAt(sp.x, sp.z), d: dist(sp) }));
    const first = near[0] ?? { x: -1.1, z: 0.5 };
    depot.position.set(first.x, heightAt(first.x, first.z), first.z);
    depot.userData.lane = depots.length;
    group.add(depot);
    depots.push(depot);
  }

  // The farmhouse at the end of the lane.
  const [ec, er] = level.path[level.path.length - 1]!;
  const farmhouse = buildFarmhouse();
  farmhouse.position.set(ec + 0.5, heightAt(ec + 0.5, er + 0.5), er + 0.5);
  const [pc, pr] = level.path[level.path.length - 2]!;
  farmhouse.rotation.y = Math.atan2(pc - ec, pr - er);
  group.add(farmhouse);

  // Lanterns along the lane at night (Kingsmarket, and any night twist).
  // Each lantern's flame flickers (its own material, so no other glow in the scene flickers with it).
  const lamps: THREE.Vector3[] = [];
  const flame = new THREE.MeshStandardMaterial({ color: "#ffb85a", emissive: "#ffb85a", emissiveIntensity: 4, roughness: 0.5 });
  const dress = twistDressing(level, night);
  if (dress.lanterns.length) {
    // A crook post on the verge with the lantern hung over the lane's edge.
    const postGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.42, 6);
    const armGeo = new THREE.BoxGeometry(0.11, 0.014, 0.014);
    const capGeo = new THREE.ConeGeometry(0.04, 0.035, 4);
    const paneGeo = new THREE.BoxGeometry(0.045, 0.06, 0.045);
    const ironMat = matte("#2b2320");
    for (const l of dress.lanterns) {
      const h = heightAt(l.x, l.y);
      const g = new THREE.Group();
      const post = new THREE.Mesh(postGeo, ironMat);
      post.position.set(0, 0.21, 0);
      post.castShadow = true;
      const arm = new THREE.Mesh(armGeo, ironMat);
      arm.position.set(0.045, 0.41, 0);
      const pane = new THREE.Mesh(paneGeo, flame);
      pane.position.set(0.085, 0.36, 0);
      const cap = new THREE.Mesh(capGeo, ironMat);
      cap.position.set(0.085, 0.405, 0);
      cap.rotation.y = Math.PI / 4;
      g.add(post, arm, pane, cap);
      // The arm reaches back over the lane: towards the centre line from the verge.
      // Local +x points from the verge to the lane's centre line, -normal = (-side sin a, side cos a).
      const tx = -l.side * Math.sin(l.angle);
      const tz = l.side * Math.cos(l.angle);
      g.rotation.y = -Math.atan2(tz, tx);
      g.position.set(l.x, h, l.y);
      group.add(g);
      lamps.push(new THREE.Vector3(l.x + tx * 0.085, h + 0.36, l.y + tz * 0.085));
    }
  }
  // Crowd: the crowd's vans parked on the verge by the gate, knots of people with placards down the lane.
  if (dress.vans.length || dress.people.length) {
    const vanCols = ["#e8742c", "#f2efe6", "#c9512b"];
    const bodyGeo = new THREE.BoxGeometry(0.42, 0.2, 0.22);
    const cabGeo = new THREE.BoxGeometry(0.13, 0.15, 0.21);
    const glassGeo = new THREE.BoxGeometry(0.02, 0.07, 0.18);
    const wheelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.23, 8).rotateX(Math.PI / 2);
    const glassMat = matte("#2f3d4a", 0.3);
    const tyreMat = matte("#1d1b1a");
    for (const [i, v] of dress.vans.entries()) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, matte(vanCols[i % vanCols.length]!));
      body.position.set(-0.04, 0.15, 0);
      body.castShadow = true;
      const cab = new THREE.Mesh(cabGeo, matte(vanCols[i % vanCols.length]!));
      cab.position.set(0.23, 0.12, 0);
      cab.castShadow = true;
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(0.3, 0.15, 0);
      g.add(body, cab, glass);
      for (const wx of [-0.16, 0.2]) {
        const w = new THREE.Mesh(wheelGeo, tyreMat);
        w.position.set(wx, 0.04, 0);
        g.add(w);
      }
      g.rotation.y = -v.angle;
      g.position.set(v.x, heightAt(v.x, v.y), v.y);
      group.add(g);
    }
    const coatCols = ["#4a5a7a", "#7a4a3a", "#3e5a44", "#6a5a8a", "#8a6a3a"];
    const bodyP = new THREE.CapsuleGeometry(0.035, 0.08, 3, 6);
    const headP = new THREE.SphereGeometry(0.028, 8, 6);
    const signGeo = new THREE.BoxGeometry(0.1, 0.06, 0.008);
    const stickGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4);
    const skin = matte("#e0b48c");
    const board = matte("#f4ecd8");
    for (const [k, p] of dress.people.entries()) {
      for (let j = 0; j < 4; j++) {
        // Spread along the verge, a step back from the lane's edge.
        const along = (j - 1.5) * 0.2;
        const back = 0.1 + (j % 2) * 0.1;
        // Outward normal (away from the lane) is (side sin a, -side cos a).
        const nx = p.side * Math.sin(p.angle);
        const ny = -p.side * Math.cos(p.angle);
        const x = p.x + Math.cos(p.angle) * along + nx * back;
        const z = p.y + Math.sin(p.angle) * along + ny * back;
        const h = heightAt(x, z);
        const g = new THREE.Group();
        const b = new THREE.Mesh(bodyP, matte(coatCols[(k * 4 + j) % coatCols.length]!));
        b.position.y = 0.075;
        b.castShadow = true;
        const head = new THREE.Mesh(headP, skin);
        head.position.y = 0.17;
        g.add(b, head);
        if (j % 2 === 0) {
          const stick = new THREE.Mesh(stickGeo, matte("#6b4a2c"));
          stick.position.set(0.045, 0.2, 0);
          const sign = new THREE.Mesh(signGeo, board);
          sign.position.set(0.045, 0.27, 0);
          g.add(stick, sign);
        }
        // Facing the lane.
        g.rotation.y = -Math.atan2(-ny, -nx);
        g.scale.setScalar(1.4);
        g.position.set(x, h, z);
        group.add(g);
      }
    }
  }

  // Cloud shadows: heavy on bright days, faint under overcast, none at night.
  cloudAmt.value = night ? 0 : hasTwist(level, "rain") || hasTwist(level, "fog") ? 0.1 : mood.cloud;
  const windy = hasTwist(level, "wind") ? 3 : 1;
  const waterMat = water ? (water.material as THREE.MeshPhysicalMaterial) : null;
  const waterBase = new THREE.Color("#3d7fa6");
  const waterLight = new THREE.Color("#5aa3c4");
  const update = (t: number, dt: number) => {
    timeU.value = t * windy;
    cloudOff.value.x -= dt * 0.006 * windy;
    cloudOff.value.y -= dt * 0.0025 * windy;
    if (night) flame.emissiveIntensity = 3.4 + Math.sin(t * 9) * 0.4 + Math.sin(t * 23) * 0.25;
    if (water && waterMat) {
      waterMat.opacity = 0.8 + Math.sin(t * 1.5) * 0.03;
      waterMat.color.copy(waterBase).lerp(waterLight, 0.25 + Math.sin(t * 0.7) * 0.15);
      waterMat.normalMap!.offset.set(t * 0.03, t * 0.017);
      waterMat.clearcoatNormalMap!.offset.set(-t * 0.021, t * 0.026);
      water.position.y = -0.09 + Math.sin(t * 0.8) * 0.006;
    }
  };
  return { group, heightAt, farmhouse, water, lamps, update };
}

/**
 * Plan item 224: Hollowell's adverts on the far verge of its own acts (the Ballot, the Merger): three boards facing
 * the camera, each a different face, their textures drawn by the 2D field's billboard painter (theme.ts).
 */
function addAdverts(group: THREE.Group, level: Level, cols: number, rows: number, heightAt: (x: number, z: number) => number): void {
  if (typeof document === "undefined") return;
  const W = 300;
  const H = 150;
  let k = 0;
  // On the side verges (the far verge sits past the camera's top edge), turned a little towards the camera.
  const spots: Array<[number, number, number]> = [
    [-1.8, rows * 0.45, 0.5],
    [cols + 1.8, rows * 0.3, -0.5],
    [-1.8, rows * 0.8, 0.5],
    [cols + 1.8, rows * 0.65, -0.5],
  ];
  for (const [x, z, ry] of spots) {
    if (k >= 3) break;
    if (laneDistance(level, x, z) < 1.3) continue;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const pick = (k++ + 0.5) / 4;
    // Bea's crayon on the first board of a level you've won.
    crayonNextBillboard(k === 1 && isWonLevel(level.id));
    drawDecor(ctx, "billboard", W / 2, H - 2, 120, () => pick);
    crayonNextBillboard(false);
    // the drawn panel's extent on the texture (the plane is wider and taller than what's painted on it)
    let [ix0, iy0, ix1, iy1] = [W, H, 0, 0];
    const px = ctx.getImageData(0, 0, W, H).data;
    for (let yy = 0; yy < H; yy += 2)
      for (let xx = 0; xx < W; xx += 2)
        if (px[(yy * W + xx) * 4 + 3]! > 100) [ix0, iy0, ix1, iy1] = [Math.min(ix0, xx), Math.min(iy0, yy), Math.max(ix1, xx), Math.max(iy1, yy)];
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 1.0).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.55, side: THREE.DoubleSide }),
    );
    board.position.set(x, heightAt(x, z), z);
    board.rotation.y = ry;
    board.name = "advert";
    board.userData.advert = pick;
    // the renderer settles it wholly into the fitted view (index.ts settleFar): in toward the field, no nearer than
    // `inner`, or hidden
    board.userData.home = x;
    // the panel's corners in the plane's own units (2 wide, 1 tall, its foot at y 0)
    board.userData.panel = ix1 > ix0 ? [-1 + (2 * ix0) / W, 1 - iy1 / H, -1 + (2 * ix1) / W, 1 - iy0 / H] : [-1, 0, 1, 1];
    board.userData.inner = x < 0 ? -1.25 : cols + 1.25;
    ((group.userData.adverts ??= []) as THREE.Object3D[]).push(board);
    group.add(board);
  }
}
