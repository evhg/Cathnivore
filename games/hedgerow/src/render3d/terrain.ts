// The 3D battlefield's ground: a vertex-coloured heightfield that extends well past the playable grid into
// rolling country, with the lanes carved in as rutted dirt tracks, raised high ground, water, building plots
// (with protected land marked), scenery, the corporate gate at each spawn and the farmhouse. Seeded by the
// level id, so a level always looks the same.

import * as THREE from "three";
import { hasTwist, isProtected, laneCellsOf, plotKind, type Level } from "../engine";
import { rng } from "../theme";
import { actLight } from "./palette";
import {
  buildBoat,
  buildCrane,
  buildFarmhouse,
  buildGate,
  buildHouse,
  buildLighthouse,
  buildOffice,
  buildRock,
  buildTowerKeep,
  buildTree,
  buildWall,
  buildWindmill,
} from "./models";
import { actMood, matte } from "./palette";

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

let plotTex: THREE.Texture | null = null;
/** A tilled plot: soft-edged soil with furrows, so every building plot reads as worked land. */
function plotTexture(): THREE.Texture {
  if (plotTex) return plotTex;
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5;
      const v = (y + 0.5) / S - 0.5;
      const edge = Math.max(Math.abs(u), Math.abs(v));
      const a = Math.max(0, Math.min(1, (0.5 - edge) / 0.09));
      const furrow = 0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 5);
      const i = (y * S + x) * 4;
      const shade = 255 - furrow * 70;
      img.data[i] = shade;
      img.data[i + 1] = shade;
      img.data[i + 2] = shade;
      img.data[i + 3] = Math.round(a * (150 + furrow * 105));
    }
  ctx.putImageData(img, 0, 0);
  plotTex = new THREE.CanvasTexture(c);
  plotTex.colorSpace = THREE.SRGBColorSpace;
  return plotTex;
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

/** Distance from (x, y) (cell units) to the nearest lane centreline. */
function laneDistance(level: Level, x: number, y: number): number {
  let best = Infinity;
  for (const path of [level.path, level.path2].filter(Boolean) as Array<Level["path"]>) {
    const pts = path.map(([c, r]) => [c + 0.5, r + 0.5] as const);
    // Extend the first segment off the field, where the convoys come from.
    const [a, b] = [pts[0]!, pts[1]!];
    const dx = Math.sign(a[0] - b[0]);
    const dy = Math.sign(a[1] - b[1]);
    const all = [[a[0] + dx * 30, a[1] + dy * 30] as const, ...pts];
    for (let i = 1; i < all.length; i++) {
      const [ax, ay] = all[i - 1]!;
      const [bx, by] = all[i]!;
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)));
    }
  }
  return best;
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

export function buildGround(level: Level): Ground {
  const light = actLight(level.id);
  const rand = rng(level.id * 7919 + 17);
  const group = new THREE.Group();
  const cols = level.cols;
  const rows = level.rows;
  const lane = laneCellsOf(level);
  const high = new Set((level.terrain?.high ?? []).map(([c, r]) => `${c},${r}`));
  const wet = new Set((level.terrain?.water ?? []).map(([c, r]) => `${c},${r}`));
  const act = Math.floor((level.id - 1) / 10);
  const mood = actMood(level.id);
  // Decoration has its own seed, so adding it never moves the scenery the level already had.
  const deco = rng(level.id * 104729 + 3);

  // Hills out beyond the field: low noise that rises with distance from the grid.
  const noise = (x: number, y: number) =>
    Math.sin(x * 0.7 + level.id) * Math.cos(y * 0.6 - level.id * 0.3) * 0.5 + Math.sin(x * 0.23 + y * 0.31) * 0.8;
  const heightAt = (x: number, y: number): number => {
    const ox = Math.max(0, -x, x - cols);
    const oy = Math.max(0, -y, y - rows);
    const out = Math.hypot(ox, oy);
    let h = out > 0 ? smooth(Math.min(1, out / 6)) * (1.2 + noise(x, y) * 0.9) : 0;
    const c = Math.floor(x);
    const r = Math.floor(y);
    if (high.has(`${c},${r}`)) {
      const fx = Math.min(x - c, c + 1 - x);
      const fy = Math.min(y - r, r + 1 - y);
      h += 0.32 * smooth(Math.min(1, Math.min(fx, fy) / 0.25));
    }
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
    const d = laneDistance(level, x, y);
    if (d < 0.42) {
      // Dirt track with two darker wheel ruts.
      const rut = Math.abs(Math.abs(d) - 0.17) < 0.05 ? 1 : 0;
      tmp.copy(d0).lerp(d1, rut * 0.7 + (Math.sin(x * 9 + y * 7) + 1) * 0.08);
    } else if (d < 0.5) tmp.lerp(d1, 0.7 * (1 - (d - 0.42) / 0.08));
    // A soft, darker verge where the track meets the grass (trodden earth and shade).
    if (d >= 0.42 && d < 0.8) tmp.multiplyScalar(1 - 0.16 * smooth(1 - (d - 0.42) / 0.38));
    if (wet.has(`${Math.floor(x)},${Math.floor(y)}`)) tmp.lerp(sand, 0.6);
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
    const coast = act === 2 ? x < -2.5 : act === 3 ? x > cols + 2.5 : act === 5 ? y > rows + 2.5 : false;
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
  }

  // Building plots: a subtle tilled square on every plot; protected land gets a stone marker instead.
  // All of them are instanced (one draw call each), as are the grass, flowers and stones below.
  const plotMat = new THREE.MeshStandardMaterial({ color: "#6a5534", roughness: 1, transparent: true, opacity: 0.34, map: plotTexture(), depthWrite: false });
  const plotGeo = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);
  const plots: Inst[] = [];
  const markers: Inst[] = [];
  const tufts: Inst[] = [];
  const flowers: Inst[] = [];
  const pads: Inst[] = [];
  const stones: Inst[] = [];
  const white = new THREE.Color("#ffffff");
  const markerCol = new THREE.Color("#bdb6a6");
  const tuftCols = [light.grass[2], light.grass[0], "#9cc46a", light.grass[1]].map((c) => new THREE.Color(c).multiplyScalar(1.05));
  const flowerCols = mood.flowers.map((c) => new THREE.Color(c));
  const stoneCols = ["#b9b0a0", "#9a9183", "#c8bfae", "#857a6a"].map((c) => new THREE.Color(c));
  const tuft = (x: number, z: number, scale = 1, tall = 1, colour?: THREE.Color) =>
    tufts.push({ x, y: heightAt(x, z) - 0.005, z, ry: deco() * Math.PI * 2, s: scale * (0.75 + deco() * 0.6), sy: tall, color: colour ?? tuftCols[Math.floor(deco() * tuftCols.length)]! });
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (lane.has(`${c},${r}`)) continue;
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
      plots.push({ x: c + 0.5, y: h + 0.012, z: r + 0.5, ry: 0, s: 1, sy: 1, color: white });
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
  // Stones and gravel along the lane's verges, a few kicked into the ruts.
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
        stones.push({ x, y: heightAt(x, z) + sz * 0.2, z, ry: deco() * 6.3, s: sz, sy: 0.55, color: stoneCols[Math.floor(deco() * stoneCols.length)]! });
        if (!inLane && deco() < 0.35) tuft(x - nx * side * 0.06, z - ny * side * 0.06, 0.9);
      }
    }
  }
  const tuftMat = withSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0.012, "hedgerow-tuft");
  const flowerGeo = new THREE.IcosahedronGeometry(0.024, 0).scale(1, 0.55, 1).translate(0, 0.075, 0);
  const flowerMat = withSway(new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true, emissive: "#201810" }), 0.01, "hedgerow-flower");
  const stoneMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const padGeo = new THREE.CircleGeometry(0.07, 9, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2);
  for (const m of [
    instanced(plotGeo, plotMat, plots),
    instanced(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), matte("#ffffff", 0.9), markers, true),
    instanced(tuftGeometry(), tuftMat, tufts),
    instanced(flowerGeo, flowerMat, flowers),
    instanced(new THREE.IcosahedronGeometry(1, 0), stoneMat, stones),
    instanced(padGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), pads),
  ])
    if (m) group.add(m);

  // Scenery out beyond the field.
  const leaves = [light.grass[1], "#4f7f37", "#5e8f41", act >= 6 ? "#7a7a42" : "#6ea04c"];
  const treeKind = act === 6 ? "dead" : act === 1 || act === 4 ? "pine" : "oak";
  const nDecor = 70;
  for (let i = 0; i < nDecor; i++) {
    const x = -MARGIN + rand() * W;
    const y = -MARGIN + rand() * H;
    if (x > -0.6 && x < cols + 0.6 && y > -0.6 && y < rows + 0.6) continue;
    if (laneDistance(level, x, y) < 1.1) continue;
    const h = heightAt(x, y);
    if (h < -0.05 || nearWater(x, y, 0.4)) continue;
    const o = rand() < 0.7 ? buildTree(rand() < 0.25 ? "pine" : treeKind, rand, leaves) : buildRock(rand);
    o.position.set(x, h, y);
    group.add(o);
  }
  // Hedgerows along the field's edge (the game's namesake), broken where the lanes run out.
  // (Instanced: hundreds of bushes in two draw calls instead of one each.)
  const hedgeCols = ["#3f6e33", "#4a7a3a", "#355e2c"].map((c) => new THREE.Color(c));
  const bushes: Inst[] = [];
  const blooms: Inst[] = [];
  const bloomCol = new THREE.Color(mood.blossom);
  const hedgeAt = (x: number, y: number) => {
    if (laneDistance(level, x, y) < 0.85) return;
    const r = 0.13 + rand() * 0.05;
    const color = hedgeCols[Math.floor(rand() * 3)]!;
    bushes.push({ x, y: heightAt(x, y) + r * 0.8, z: y, ry: deco() * 6.3, s: r, sy: 0.85 + rand() * 0.3, color });
    if (rand() < 0.15) blooms.push({ x: x + (rand() - 0.5) * 0.1, y: heightAt(x, y) + r * 1.6, z: y + (rand() - 0.5) * 0.1, ry: 0, s: 0.03, sy: 1, color: bloomCol });
  };
  for (let c = -0.9; c <= cols + 0.9; c += 0.22)
    for (const r of [-0.62, -0.42, rows + 0.42, rows + 0.62]) hedgeAt(c + (rand() - 0.5) * 0.08, r);
  for (let r = -0.4; r <= rows + 0.4; r += 0.22)
    for (const c of [-0.62, -0.42, cols + 0.42, cols + 0.62]) hedgeAt(c, r + (rand() - 0.5) * 0.08);
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
  const across = (n: number, z0: number, z1: number, make: (i: number) => THREE.Object3D) => {
    for (let i = 0; i < n; i++) {
      const x = -3 + ((i + 0.5) / n) * (cols + 6) + (rand() - 0.5) * 1.2;
      const z = z0 + rand() * (z1 - z0);
      if (laneDistance(level, x, z) < 1.5) continue;
      back(x, z, make(i), (rand() - 0.5) * 0.6);
    }
  };
  switch (act) {
    case 0:
    case 1: {
      const w = buildWindmill();
      back(cols + 1.8, -2.4, w, -0.4);
      spin.push(w.userData.spin as THREE.Object3D);
      across(3, -3.2, -2.2, () => buildHouse(rand));
      break;
    }
    case 2:
    case 5: {
      back(act === 5 ? cols + 2 : -2.2, -2.6, buildLighthouse());
      across(4, -3.8, -2.4, () => buildBoat(rand));
      across(3, -3, -2.2, () => buildHouse(rand));
      break;
    }
    case 3:
    case 4:
      across(5, -3.2, -2.2, () => buildHouse(rand, night));
      break;
    case 6:
      across(3, -3.6, -2.4, () => buildCrane());
      break;
    case 7:
      across(7, -3.2, -2.2, () => buildHouse(rand, night));
      break;
    case 8:
      across(6, -4.2, -2.6, () => buildOffice(rand, true));
      break;
    case 9:
      back(cols / 2, -2.2, buildWall(cols + 6));
      across(3, -2.9, -2.6, () => buildTowerKeep());
      across(5, -4, -3.2, () => buildHouse(rand, true));
      break;
  }
  group.userData.spin = spin;

  // The corporate gate at each spawn.
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
  if (night) {
    const lampGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const postGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5);
    for (let i = 0; i < 12; i++) {
      const x = rand() * cols;
      const y = rand() * rows;
      const d = laneDistance(level, x, y);
      if (d < 0.55 || d > 0.95) continue;
      const lamp = new THREE.Mesh(lampGeo, flame);
      lamp.position.set(x, heightAt(x, y) + 0.35, y);
      const post = new THREE.Mesh(postGeo, matte("#2b2320"));
      post.position.set(x, heightAt(x, y) + 0.17, y);
      group.add(lamp, post);
      lamps.push(lamp.position.clone());
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
