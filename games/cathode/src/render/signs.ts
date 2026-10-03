// Neon. Every sign in the district is painted into one 2048² canvas atlas at load (tube letters with a
// hot white core and a coloured halo, backlit lightboxes, vertical kanji/hangul blades) and drawn as two
// merged meshes: additive tubes and opaque lightboxes. A shader flickers them per sign (steady buzz,
// failing fluorescents, broken letters) in step with the real lights that stream to them.

import * as THREE from "three";
import type { SignDef } from "./level";
import { canvas, canvasTexture, prng } from "./textures";

const SANS = "'Avenir Next Condensed', 'Futura', 'Helvetica Neue', 'Arial Narrow', Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";
const CJK = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'PingFang SC', 'Apple SD Gothic Neo', 'Noto Sans CJK JP', 'WenQuanYi Zen Hei', sans-serif";
const isCjk = (s: string) => /[぀-ヿ㐀-鿿가-힯]/.test(s);

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SignMeshes {
  tubes: THREE.Mesh;
  boxes: THREE.Mesh;
  texture: THREE.CanvasTexture;
  uniforms: { uTime: { value: number } };
}

export function buildSigns(defs: SignDef[], maxAtlas = 2048): SignMeshes {
  const size = maxAtlas;
  const atlas = canvas(size, size);
  const g = atlas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  // Shelf-pack unique signs; shrink the pixel density until they all fit.
  const unique = new Map<string, SignDef>();
  for (const d of defs) unique.set(d.key ?? `${d.text}|${d.style}|${d.color}|${d.w}|${d.h}`, d);
  let ppm = 110;
  let cells = new Map<string, Cell>();
  for (let attempt = 0; attempt < 8; attempt++) {
    cells = new Map();
    let x = 0;
    let y = 0;
    let row = 0;
    let ok = true;
    const sorted = [...unique.entries()].sort((a, b) => b[1].h - a[1].h);
    for (const [k, d] of sorted) {
      const w = Math.min(size, Math.ceil(d.w * ppm) + 8);
      const h = Math.min(size / 2, Math.ceil(d.h * ppm) + 8);
      if (x + w > size) {
        x = 0;
        y += row;
        row = 0;
      }
      if (y + h > size) {
        ok = false;
        break;
      }
      cells.set(k, { x, y, w, h });
      x += w;
      row = Math.max(row, h);
    }
    if (ok) break;
    ppm *= 0.82;
  }
  for (const [k, d] of unique) {
    const c = cells.get(k);
    if (c) paint(g, d, c);
  }
  const texture = canvasTexture(atlas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const tubes = geometryFor(defs.filter((d) => d.style === "tube" || d.style === "bladeTube"), cells, size);
  const boxes = geometryFor(defs.filter((d) => !(d.style === "tube" || d.style === "bladeTube")), cells, size);
  const uniforms = { uTime: { value: 0 } };
  const mat = (additive: boolean) =>
    new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: texture } }]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      transparent: additive,
      depthWrite: !additive,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.FrontSide,
      defines: additive ? { ADDITIVE: "" } : {},
    });
  const tubeMat = mat(true);
  const boxMat = mat(false);
  for (const m of [tubeMat, boxMat]) {
    m.uniforms.uTime = uniforms.uTime;
    m.uniforms.uMap!.value = texture;
  }
  const tubesMesh = new THREE.Mesh(tubes, tubeMat);
  const boxesMesh = new THREE.Mesh(boxes, boxMat);
  tubesMesh.renderOrder = 2;
  for (const m of [tubesMesh, boxesMesh]) {
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
  }
  tubesMesh.name = "signs:tubes";
  boxesMesh.name = "signs:boxes";
  return { tubes: tubesMesh, boxes: boxesMesh, texture, uniforms };
}

function geometryFor(defs: SignDef[], cells: Map<string, Cell>, size: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const info: number[] = [];
  const local: number[] = [];
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  let seed = 0;
  for (const d of defs) {
    const c = cells.get(d.key ?? `${d.text}|${d.style}|${d.color}|${d.w}|${d.h}`);
    if (!c) continue;
    seed++;
    const n = d.normal;
    up.set(0, 1, 0);
    if (Math.abs(n.y) > 0.9) up.set(0, 0, -1);
    right.crossVectors(up, n).normalize();
    up.crossVectors(n, right).normalize();
    const hw = d.w / 2;
    const hh = d.h / 2;
    const corners = [
      [-hw, -hh, 0, 1],
      [hw, -hh, 1, 1],
      [hw, hh, 1, 0],
      [-hw, hh, 0, 0],
    ] as const;
    const u0 = (c.x + 4) / size;
    const u1 = (c.x + c.w - 4) / size;
    const v0 = 1 - (c.y + 4) / size;
    const v1 = 1 - (c.y + c.h - 4) / size;
    const verts = corners.map(([x, y, lu, lv]) => ({
      p: d.center.clone().addScaledVector(right, x).addScaledVector(up, y),
      uv: [u0 + (u1 - u0) * lu, v0 + (v1 - v0) * lv],
      lu,
    }));
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = verts[i]!;
      pos.push(v.p.x, v.p.y, v.p.z);
      uv.push(v.uv[0]!, v.uv[1]!);
      info.push(d.intensity, d.flicker, seed * 1.37 + d.text.length, 0);
      local.push(v.lu, d.broken?.[0] ?? 2, d.broken?.[1] ?? 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aInfo", new THREE.Float32BufferAttribute(info, 4));
  g.setAttribute("aLocal", new THREE.Float32BufferAttribute(local, 3));
  g.computeBoundingSphere();
  return g;
}

function paint(g: CanvasRenderingContext2D, d: SignDef, c: Cell): void {
  const x0 = c.x + 4;
  const y0 = c.y + 4;
  const w = c.w - 8;
  const h = c.h - 8;
  g.save();
  g.beginPath();
  g.rect(c.x, c.y, c.w, c.h);
  g.clip();
  const vertical = d.style === "blade" || d.style === "bladeTube";
  const cjk = d.cjk || isCjk(d.text);
  const col = new THREE.Color(d.color);
  const css = d.color;
  const core = `#${col.clone().lerp(new THREE.Color("#ffffff"), 0.72).getHexString()}`;
  const dark = `#${col.clone().multiplyScalar(0.12).getHexString()}`;
  if (d.style === "tube" || d.style === "bladeTube") {
    g.fillStyle = "#000";
    g.fillRect(c.x, c.y, c.w, c.h);
    const draw = (fill: (lw: number, color: string, blur: number) => void) => {
      fill(0.16, css, 0.55);
      fill(0.085, css, 0.22);
      fill(0.035, core, 0.05);
    };
    if (vertical) {
      const chars = [...d.text];
      const fs = Math.min(w * 0.82, (h / chars.length) * 0.86);
      g.font = `bold ${fs}px ${CJK}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      draw((lw, color, blur) => {
        g.strokeStyle = color;
        g.lineWidth = Math.max(1.5, fs * lw * 0.5);
        g.shadowColor = color;
        g.shadowBlur = fs * blur;
        chars.forEach((ch, i) => g.strokeText(ch, x0 + w / 2, y0 + (h / chars.length) * (i + 0.5)));
      });
    } else {
      let fs = h * 0.66;
      g.font = `bold ${fs}px ${cjk ? CJK : SANS}`;
      const m = g.measureText(d.text).width;
      if (m > w * 0.9) fs *= (w * 0.9) / m;
      g.font = `bold ${fs}px ${cjk ? CJK : SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      draw((lw, color, blur) => {
        g.strokeStyle = color;
        g.lineWidth = Math.max(1.5, fs * lw * 0.5);
        g.shadowColor = color;
        g.shadowBlur = fs * blur;
        g.lineJoin = "round";
        g.strokeText(d.text, x0 + w / 2, y0 + h / 2 + fs * 0.04);
      });
      // A thin tube border on longer signs.
      if (d.text.length > 6 && h > 40) {
        g.shadowBlur = 8;
        g.strokeStyle = css;
        g.lineWidth = 2;
        roundRect(g, x0 + 3, y0 + 3, w - 6, h - 6, h * 0.2);
        g.stroke();
      }
    }
  } else if (d.style === "screen") {
    g.fillStyle = css;
    g.fillRect(c.x, c.y, c.w, c.h);
  } else {
    // Lightboxes: a lit panel with dark lettering (horizontal) or a dark panel with lit glyphs (blades).
    if (vertical) {
      g.fillStyle = dark;
      g.fillRect(c.x, c.y, c.w, c.h);
      g.strokeStyle = css;
      g.lineWidth = Math.max(2, w * 0.05);
      g.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
      const chars = [...d.text];
      const fs = Math.min(w * 0.72, (h / chars.length) * 0.8);
      g.font = `bold ${fs}px ${CJK}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = core;
      g.shadowColor = css;
      g.shadowBlur = fs * 0.15;
      chars.forEach((ch, i) => g.fillText(ch, x0 + w / 2, y0 + (h / chars.length) * (i + 0.5)));
    } else {
      const grad = g.createLinearGradient(0, y0, 0, y0 + h);
      grad.addColorStop(0, `#${col.clone().lerp(new THREE.Color("#ffffff"), 0.35).getHexString()}`);
      grad.addColorStop(0.5, css);
      grad.addColorStop(1, `#${col.clone().multiplyScalar(0.55).getHexString()}`);
      g.fillStyle = "#050505";
      g.fillRect(c.x, c.y, c.w, c.h);
      g.fillStyle = grad;
      roundRect(g, x0 + 2, y0 + 2, w - 4, h - 4, Math.min(12, h * 0.12));
      g.fill();
      let fs = h * 0.62;
      g.font = `bold ${fs}px ${cjk ? CJK : SANS}`;
      const m = g.measureText(d.text).width;
      if (m > w * 0.9) fs *= (w * 0.9) / m;
      g.font = `bold ${fs}px ${cjk ? CJK : SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#0a0a0c";
      g.fillText(d.text, x0 + w / 2, y0 + h / 2 + fs * 0.05);
      // Grime on the plastic.
      const rand = prng(c.x * 7 + c.y);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
        g.fillRect(x0 + rand() * w, y0 + rand() * h, 2 + rand() * 8, 2 + rand() * 10);
      }
    }
  }
  g.restore();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const VERT = /* glsl */ `
attribute vec4 aInfo;
attribute vec3 aLocal;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vLocal;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vInfo = aInfo;
  vLocal = aLocal;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const FLICKER_GLSL = /* glsl */ `
float cHash1( float x ) { return fract( sin( x * 127.1 + 311.7 ) * 43758.5453 ); }
float cFlicker( float mode, float seed, float t ) {
  if ( mode < 0.5 ) return 1.0;
  if ( mode < 1.5 ) return 0.94 + 0.06 * sin( t * 113.0 + seed * 7.1 ) * sin( t * 3.1 + seed );
  if ( mode > 2.5 ) return sin( t * 5.2 + seed ) > 0.0 ? 1.0 : 0.03;
  float slot = floor( t * 9.0 + seed * 3.7 );
  float h = cHash1( slot * 0.137 + seed * 1.71 );
  bool burst = sin( t * 0.7 + seed * 2.3 ) > 0.55;
  if ( burst && h > 0.45 ) return 0.08;
  return h > 0.97 ? 0.15 : 1.0;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vLocal;
#include <fog_pars_fragment>
${FLICKER_GLSL}
void main() {
  vec3 c = texture2D( uMap, vUv ).rgb;
  float f = cFlicker( vInfo.y, vInfo.z, uTime );
  if ( vLocal.x >= vLocal.y && vLocal.x <= vLocal.z ) f = min( f, cFlicker( 2.0, vInfo.z + 9.0, uTime * 1.3 ) * 0.9 + 0.02 );
  gl_FragColor = vec4( c * vInfo.x * f, 1.0 );
  #ifdef ADDITIVE
    gl_FragColor.rgb *= 1.0 - cathodeFogAmount( cameraPosition, vFogWorld, fogDensity ) * 0.9;
  #else
    #include <fog_fragment>
  #endif
}
`;
