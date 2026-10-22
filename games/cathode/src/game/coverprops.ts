// C16 review: the cover a firefight is staged at, built like the street's art rather than a greybox. A Hollowell
// cargo crate (corrugated side panels, painted corner posts with bevelled edges, cast corner blocks, top and bottom
// rails, a stencil, wet runs down the panels) and a cast concrete pillar (chamfered, a plinth, rust weeping from its
// rebar, a puddle round its foot). Each is a handful of merged meshes (one per material), so it costs a few draws.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LAYER_NO_REFLECT } from "../render/reflection";

/** The small details stay out of the street's mirror pass (a phone's reflection budget is 120 draws). */
function noReflect(...objs: THREE.Object3D[]): void {
  for (const o of objs) o.layers.set(LAYER_NO_REFLECT);
}

type Mat = (key: string) => THREE.Material | undefined;

const fallback = (color: number, rough: number, metal: number) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

function box(w: number, h: number, d: number, x: number, y: number, z: number, r = 0): THREE.BufferGeometry {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  // Merging needs one attribute set: RoundedBox and Box both carry position, normal and uv; drop any index.
  return g.index ? g.toNonIndexed() : g;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return g;
}

/** A canvas decal (stencils, stains): drawn once per kind and shared. */
const decals = new Map<string, THREE.CanvasTexture>();
function decal(kind: "stencil" | "streaks" | "rebar" | "pillarFace" | "poster", draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 256): THREE.CanvasTexture | null {
  const hit = decals.get(kind);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return null;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  decals.set(kind, t);
  return t;
}

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** The Hollowell stencil: worn white letters, a hazard band, and wet runs streaking down from the top rail. */
function stencilTex(): THREE.CanvasTexture | null {
  return decal("stencil", (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rand(7);
    // Hazard band along the bottom.
    g.save();
    g.beginPath();
    g.rect(0, h * 0.8, w, h * 0.12);
    g.clip();
    for (let x = -h; x < w + h; x += 44) {
      g.fillStyle = "rgba(214,160,22,0.85)";
      g.beginPath();
      g.moveTo(x, h * 0.92);
      g.lineTo(x + 22, h * 0.92);
      g.lineTo(x + 22 + 26, h * 0.8);
      g.lineTo(x + 26, h * 0.8);
      g.fill();
    }
    g.restore();
    // The stencil (letters with the bridges a stencil leaves).
    g.fillStyle = "rgba(226,222,210,0.82)";
    g.font = "800 92px sans-serif";
    g.textBaseline = "alphabetic";
    g.fillText("HLW", 34, 118);
    g.font = "700 40px sans-serif";
    g.fillText("07-14 · 2.4T", 36, 170);
    g.fillStyle = "rgba(0,0,0,1)";
    g.globalCompositeOperation = "destination-out";
    for (let x = 34; x < 260; x += 52) g.fillRect(x + 22, 40, 4, 84);
    // Wear: chips and scuffs taken out of the paint.
    for (let i = 0; i < 260; i++) {
      g.globalAlpha = 0.3 + r() * 0.7;
      g.beginPath();
      g.arc(r() * w, r() * h, 0.6 + r() * 3.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    // Wet runs down from the top.
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const len = h * (0.25 + r() * 0.7);
      const grd = g.createLinearGradient(0, 0, 0, len);
      grd.addColorStop(0, "rgba(10,8,6,0.5)");
      grd.addColorStop(1, "rgba(10,8,6,0)");
      g.fillStyle = grd;
      g.fillRect(x, 0, 2 + r() * 5, len);
    }
  });
}

/** Rust weeping from the pillar's rebar and grime washed down its faces. */
function rebarTex(): THREE.CanvasTexture | null {
  return decal(
    "rebar",
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = rand(23);
      for (let i = 0; i < 40; i++) {
        const x = r() * w;
        const y0 = r() * h * 0.5;
        const len = h * (0.2 + r() * 0.6);
        const grd = g.createLinearGradient(0, y0, 0, y0 + len);
        const rust = r() < 0.55;
        grd.addColorStop(0, rust ? "rgba(120,52,18,0.75)" : "rgba(14,12,10,0.55)");
        grd.addColorStop(1, "rgba(14,12,10,0)");
        g.fillStyle = grd;
        g.fillRect(x, y0, 2 + r() * (rust ? 6 : 14), len);
        if (rust) {
          g.fillStyle = "rgba(70,30,12,0.9)";
          g.beginPath();
          g.arc(x + 3, y0, 3 + r() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      // A wet line at the foot where the flood has stood.
      const grd = g.createLinearGradient(0, h * 0.82, 0, h);
      grd.addColorStop(0, "rgba(8,8,8,0)");
      grd.addColorStop(1, "rgba(8,8,8,0.7)");
      g.fillStyle = grd;
      g.fillRect(0, h * 0.82, w, h * 0.18);
    },
    256,
    512,
  );
}

/** A soft square-ish contact shadow (alpha in the texture, black multiplied over the street). */
let aoT: THREE.CanvasTexture | null = null;
function aoTex(): THREE.CanvasTexture | null {
  if (aoT || typeof document === "undefined") return aoT;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) return null;
  const grd = g.createRadialGradient(64, 64, 24, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,0.75)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  aoT = new THREE.CanvasTexture(c);
  return aoT;
}

function decalMat(t: THREE.Texture | null, rough: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: rough, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

/**
 * A cargo crate `w` wide (local x), `h` tall, `d` deep (local z; its +z face is the side toward her), its base at
 * y = 0. Ribs stand out from the panels on both long faces; posts and castings at the corners.
 */
export function cargoCrate(w: number, h: number, d: number, mat: Mat): THREE.Group {
  const g = new THREE.Group();
  g.name = "cargoCrate";
  const post = 0.09;
  const rail = 0.08;
  // The panels: a core box inset from the frame, then corrugation ribs (trapezoid-ish: a wide low rib and a narrow
  // proud one) across both long faces and the two ends.
  const panel: THREE.BufferGeometry[] = [box(w - post * 1.2, h - rail * 1.6, d - 0.05, 0, h / 2, 0)];
  const ribW = 0.055;
  const pitch = 0.13;
  const inner = h - rail * 2;
  for (let x = -w / 2 + post + pitch / 2; x < w / 2 - post; x += pitch) {
    for (const s of [1, -1]) panel.push(box(ribW, inner, 0.035, x, h / 2, s * (d / 2 - 0.01), 0.008));
  }
  for (let z = -d / 2 + post + pitch / 2; z < d / 2 - post; z += pitch) {
    for (const s of [1, -1]) panel.push(box(0.035, inner, ribW, s * (w / 2 - 0.01), h / 2, z, 0.008));
  }
  const panels = new THREE.Mesh(merged(panel), mat("rust") ?? fallback(0x6a4a38, 0.6, 0.6));
  // The frame: four posts and the top and bottom rails, bevelled, in Hollowell's painted steel.
  const frame: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.push(box(post, h, post, sx * (w / 2 - post / 2 + 0.01), h / 2, sz * (d / 2 - post / 2 + 0.01), 0.015));
  for (const y of [rail / 2, h - rail / 2]) {
    for (const sz of [-1, 1]) frame.push(box(w, rail, rail * 0.8, 0, y, sz * (d / 2 - rail * 0.4 + 0.015), 0.012));
    for (const sx of [-1, 1]) frame.push(box(rail * 0.8, rail, d, sx * (w / 2 - rail * 0.4 + 0.015), y, 0, 0.012));
  }
  const frameMesh = new THREE.Mesh(merged(frame), mat("paintMetal") ?? fallback(0x2a3438, 0.38, 0.6));
  // Cast corner blocks with their twist-lock holes reading as dark notches.
  const cast: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.06, h - 0.06]) cast.push(box(0.14, 0.12, 0.14, sx * (w / 2 - 0.06), y, sz * (d / 2 - 0.06), 0.01));
  const castMesh = new THREE.Mesh(merged(cast), mat("darkMetal") ?? fallback(0x1a1c20, 0.42, 0.85));
  // The stencil on the face toward her, and a second one on the back.
  const tex = stencilTex();
  const dm = decalMat(tex, 0.55);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.1, w - 0.3), Math.min(0.55, h - 0.3)), dm);
  front.position.set(-w * 0.08, h * 0.52, d / 2 + 0.03);
  const back = front.clone();
  back.position.z = -d / 2 - 0.03;
  back.rotation.y = Math.PI;
  for (const m of [panels, frameMesh, castMesh]) m.castShadow = m.receiveShadow = true;
  g.add(panels, frameMesh, castMesh, front, back);
  noReflect(castMesh, front, back);
  return g;
}

/**
 * The pillar's faces: cast in lifts (a pour joint every 0.6 m with a pale lip under it), formwork tie holes on a grid,
 * grime washed down from each joint, scuffs at boot height, and the contact shadow where it meets the wet street.
 */
function pillarFaceTex(): THREE.CanvasTexture | null {
  return decal(
    "pillarFace",
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = rand(41);
      const lifts = 4;
      for (let i = 1; i < lifts; i++) {
        const y = (h * i) / lifts;
        g.fillStyle = "rgba(10,10,12,0.75)";
        g.fillRect(0, y - 2, w, 3);
        g.fillStyle = "rgba(200,196,188,0.22)";
        g.fillRect(0, y + 1, w, 2);
        // The grime that runs down from each joint.
        for (let k = 0; k < 18; k++) {
          const x = r() * w;
          const len = (h / lifts) * (0.2 + r() * 0.75);
          const grd = g.createLinearGradient(0, y, 0, y + len);
          grd.addColorStop(0, "rgba(12,12,10,0.5)");
          grd.addColorStop(1, "rgba(12,12,10,0)");
          g.fillStyle = grd;
          g.fillRect(x, y, 1 + r() * 6, len);
        }
      }
      // Tie holes: two columns per lift, a dark core with a pale ring of broken render.
      for (let i = 0; i < lifts; i++) {
        for (const fx of [0.22, 0.78]) {
          const x = w * fx;
          const y = (h * (i + 0.5)) / lifts;
          g.fillStyle = "rgba(190,186,178,0.25)";
          g.beginPath();
          g.arc(x, y, 9, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(6,6,8,0.9)";
          g.beginPath();
          g.arc(x, y, 5, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Chips and scuffs at boot and shoulder height.
      for (let i = 0; i < 160; i++) {
        const y = r() < 0.6 ? h * (0.78 + r() * 0.2) : r() * h;
        g.fillStyle = r() < 0.5 ? `rgba(200,196,186,${0.15 + r() * 0.25})` : `rgba(8,8,8,${0.2 + r() * 0.4})`;
        g.fillRect(r() * w, y, 1 + r() * 5, 1 + r() * 3);
      }
      // Contact darkening at the foot: the flood line and the street's grime soaking up the concrete.
      const grd = g.createLinearGradient(0, h * 0.8, 0, h);
      grd.addColorStop(0, "rgba(6,6,6,0)");
      grd.addColorStop(0.6, "rgba(6,6,6,0.55)");
      grd.addColorStop(1, "rgba(4,4,4,0.85)");
      g.fillStyle = grd;
      g.fillRect(0, h * 0.8, w, h * 0.2);
    },
    256,
    768,
  );
}

/** A fly-posted bill on the face toward her: Hollowell's credit offer, rain-soaked, torn, a corner peeled down. */
function posterTex(): THREE.CanvasTexture | null {
  return decal(
    "poster",
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = rand(77);
      // The torn outline: a ragged polygon.
      g.beginPath();
      const pts: [number, number][] = [];
      const n = 14;
      for (let i = 0; i < n; i++) pts.push([12 + r() * 10 + (i / n) * (w - 40), 6 + r() * 10]);
      for (let i = 0; i < n; i++) pts.push([w - 8 - r() * 12, 10 + (i / n) * (h - 30)]);
      for (let i = 0; i < n; i++) pts.push([w - 20 - (i / n) * (w - 40) - r() * 8, h - 8 - r() * (i > n * 0.6 ? 60 : 14)]);
      for (let i = 0; i < n; i++) pts.push([6 + r() * 12, h - 20 - (i / n) * (h - 40)]);
      g.moveTo(pts[0]![0], pts[0]![1]);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.closePath();
      g.save();
      g.clip();
      g.fillStyle = "#c9c2b0";
      g.fillRect(0, 0, w, h);
      // The print: a red band, the slogan, a big 0%, the small print.
      g.fillStyle = "#a3221c";
      g.fillRect(0, 0, w, h * 0.2);
      g.fillStyle = "#efe8d6";
      g.font = "800 34px sans-serif";
      g.fillText("HOLLOWELL", 22, h * 0.14);
      g.fillStyle = "#1b1b1e";
      g.font = "900 120px sans-serif";
      g.fillText("0%", 26, h * 0.5);
      g.font = "700 28px sans-serif";
      g.fillText("CREDIT FOR", 28, h * 0.6);
      g.fillText("EVERY FAMILY", 28, h * 0.67);
      g.fillStyle = "rgba(27,27,30,0.6)";
      for (let i = 0; i < 9; i++) g.fillRect(28, h * 0.74 + i * 9, w * (0.5 + r() * 0.3), 3);
      // Rain: the paper gone grey and blotched, the ink run, paste stains.
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(40,38,32,${0.05 + r() * 0.18})`;
        g.beginPath();
        g.ellipse(r() * w, r() * h, 6 + r() * 30, 4 + r() * 20, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 24; i++) {
        const x = r() * w;
        const y = r() * h * 0.6;
        const grd = g.createLinearGradient(0, y, 0, y + 120);
        grd.addColorStop(0, "rgba(30,26,22,0.35)");
        grd.addColorStop(1, "rgba(30,26,22,0)");
        g.fillStyle = grd;
        g.fillRect(x, y, 2 + r() * 4, 120);
      }
      g.restore();
      // A strip torn off across it, the concrete showing through.
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      g.moveTo(0, h * 0.78);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.78 - x * 0.12 + (r() - 0.5) * 10);
      for (let x = w; x >= 0; x -= 16) g.lineTo(x, h * 0.86 - x * 0.1 + (r() - 0.5) * 10);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "source-over";
    },
    256,
    384,
  );
}

/**
 * A cast concrete pillar `w` square and `h` tall, its base at y = 0 (its +z face toward her): poured in lifts on a
 * plinth, a galvanised cap flashing over the top with a drip lip, steel angle guards on the two front corners with
 * hazard paint at bumper height, a soaked fly-poster, rust weeping from its rebar, and the wet street's contact
 * shadow and puddle round its foot.
 */
export function concretePillar(w: number, h: number, mat: Mat): THREE.Group {
  const g = new THREE.Group();
  g.name = "concretePillar";
  const conc = mat("concreteA") ?? fallback(0x8f8b86, 0.9, 0);
  const capH = 0.1;
  const shaft = new THREE.Mesh(merged([box(w, h - 0.25 - capH, w, 0, 0.25 + (h - 0.25 - capH) / 2, 0, 0.03), box(w + 0.12, 0.26, w + 0.12, 0, 0.13, 0, 0.03)]), conc);
  shaft.castShadow = shaft.receiveShadow = true;
  g.add(shaft);
  // The cap: a galvanised flashing over the top, its drip lip standing proud of the faces.
  const steel = mat("darkMetal") ?? fallback(0x1a1c20, 0.42, 0.85);
  const cap = new THREE.Mesh(merged([box(w + 0.08, capH * 0.5, w + 0.08, 0, h - capH * 0.25, 0, 0.008), box(w + 0.1, 0.035, w + 0.1, 0, h - capH * 0.5 - 0.0175, 0, 0.006)]), steel);
  cap.castShadow = true;
  g.add(cap);
  // Steel angle guards up the two corners toward her (a car park's), bolted at three heights.
  const guard: THREE.BufferGeometry[] = [];
  const gh = 1.5;
  for (const sx of [-1, 1]) {
    guard.push(box(0.012, gh, 0.09, sx * (w / 2 + 0.006), 0.26 + gh / 2, w / 2 - 0.045 + 0.006));
    guard.push(box(0.09, gh, 0.012, sx * (w / 2 - 0.045 + 0.006), 0.26 + gh / 2, w / 2 + 0.006));
    for (const y of [0.4, 0.95, 1.55]) guard.push(box(0.03, 0.03, 0.02, sx * (w / 2 - 0.06), y, w / 2 + 0.016, 0.006));
  }
  const guardMesh = new THREE.Mesh(merged(guard), mat("paintMetal") ?? fallback(0x2a3438, 0.38, 0.6));
  g.add(guardMesh);
  // Hazard paint on the guards at bumper height.
  const hazard = new THREE.MeshStandardMaterial({ color: 0xc89a1c, roughness: 0.5, metalness: 0.2 });
  const stripes: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y = 0.34 + i * 0.16;
    stripes.push(box(0.014, 0.07, 0.092, sx * (w / 2 + 0.008), y, w / 2 - 0.045 + 0.006));
    stripes.push(box(0.092, 0.07, 0.014, sx * (w / 2 - 0.045 + 0.006), y, w / 2 + 0.008));
  }
  g.add(new THREE.Mesh(merged(stripes), hazard));
  // The faces: lifts, ties and grime, then the rust weeping from the rebar ties over them.
  const face = decalMat(pillarFaceTex(), 0.7);
  const dm = decalMat(rebarTex(), 0.4);
  const fh = h - 0.26 - capH;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    for (const [m, off] of [[face, 0.004], [dm, 0.007]] as const) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, m === face ? fh : h * 0.9), m);
      p.position.set(Math.sin(a) * (w / 2 + off), m === face ? 0.26 + fh / 2 : h * 0.47, Math.cos(a) * (w / 2 + off));
      p.rotation.y = a;
      g.add(p);
    }
  }
  // The fly-poster on the face toward her, a little off centre and skewed.
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, w * 0.9), decalMat(posterTex(), 0.85));
  poster.position.set(-w * 0.08, 1.25, w / 2 + 0.011);
  poster.rotation.z = 0.035;
  g.add(poster);
  // Exposed rebar stubs through the cap, bent and rusted.
  const bar: THREE.BufferGeometry[] = [];
  for (const [x, z, t] of [[-0.28, -0.25, 0.2], [0.22, -0.3, -0.35], [0.3, 0.22, 0.5], [-0.2, 0.28, -0.1]] as const) {
    const c = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6);
    c.rotateZ(t);
    c.translate(x * w, h + 0.12, z * w);
    bar.push(c.toNonIndexed());
  }
  g.add(new THREE.Mesh(merged(bar), mat("rust") ?? fallback(0x6a4a38, 0.6, 0.6)));
  // The contact shadow round its foot: the street darkened and soaked where the plinth sits in it.
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.9, w + 0.9), new THREE.MeshBasicMaterial({ map: aoTex(), transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  ao.rotation.x = -Math.PI / 2;
  ao.position.y = 0.006;
  g.add(ao);
  // The puddle round its foot: still water, which picks up the street's neon.
  // A thin glossy film over the asphalt (not an opaque disc): the road shows through it, darkened and mirror-smooth.
  const water = new THREE.MeshStandardMaterial({ color: 0x06080a, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 28), water);
  pud.rotation.x = -Math.PI / 2;
  pud.scale.set(w * 1.05, w * 0.8, 1);
  pud.position.set(0.1, 0.01, 0.2);
  pud.receiveShadow = true;
  g.add(pud);
  // Only the shaft and its cap go into the mirror.
  for (const c of g.children) if (c !== shaft && c !== cap) noReflect(c);
  return g;
}
