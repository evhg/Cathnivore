// Tomas's stall and the open gun case on it (docs/design/cathode-combat.md S7.1, C3): a dressed market trestle
// (a worn plank top with steel edge trim, a striped cloth, a price card, his clutter) and a hard case with a
// cut-foam insert the gun sits down in, an egg-crate lid liner and brass latches that catch the rim light.
//
// Everything that isn't metal or a lamp shares one atlas material (colour, roughness and glow painted per region),
// so the dressed stall costs fewer draw calls than the blockout it replaced: atlas, steel and the bulb for the stall;
// atlas and brass for the case; atlas and the lamp strip for the lid; then the gun.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/** Atlas regions in px of a 1024² canvas: x, y, w, h. */
const R = {
  wood: [0, 0, 512, 256],
  leather: [512, 0, 256, 256],
  cloth: [768, 0, 256, 256],
  foam: [0, 256, 512, 256],
  liner: [512, 256, 256, 256],
  card: [768, 256, 256, 128],
  ammo: [768, 384, 256, 128],
  crate: [0, 512, 256, 256],
  foamSide: [256, 512, 128, 128],
  mug: [384, 512, 128, 128],
  rag: [512, 512, 256, 256],
} as const;
type Region = keyof typeof R;
const S = 1024;

/** Remaps a geometry's 0..1 UVs into an atlas region (with a 2 px gutter so mips don't bleed). */
function inRegion<G extends THREE.BufferGeometry>(g: G, r: Region, repeat: [number, number] = [1, 1]): G {
  const [x, y, w, h] = R[r];
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = ((uv.getX(i) * repeat[0]) % 1.0001) * (w - 4) + x + 2;
    // Canvas y runs down; texture v runs up (flipY): the geometry's top (v = 1) is the region's top row.
    const cy = (1 - ((uv.getY(i) * repeat[1]) % 1.0001)) * (h - 4) + y + 2;
    uv.setXY(i, u / S, 1 - cy / S);
  }
  uv.needsUpdate = true;
  return g;
}

function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The gun's footprint on the insert, as triangles in the insert's top-face UV (0..1, canvas-down). */
export type Footprint = Array<[number, number, number, number, number, number]>;

/** Paints the atlas: colour, roughness (green channel) and glow. Null outside a browser (the unit tests). */
function paint(pocket: Footprint, card: string[]): { map: THREE.Texture; rough: THREE.Texture; glow: THREE.Texture } | null {
  if (typeof document === "undefined") return null;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    return [c, c.getContext("2d")!] as const;
  };
  const [cc, g] = mk();
  const [rc, r] = mk();
  const [ec, e] = mk();
  const rnd = rand(9);
  e.fillStyle = "#000";
  e.fillRect(0, 0, S, S);
  const fillR = (ctx: CanvasRenderingContext2D, k: Region, col: string) => {
    const [x, y, w, h] = R[k];
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };
  const clip = (ctx: CanvasRenderingContext2D, k: Region, fn: (x: number, y: number, w: number, h: number) => void) => {
    const [x, y, w, h] = R[k];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    fn(x, y, w, h);
    ctx.restore();
  };
  // ---- wood: five weathered planks, dark seams, scuffs and a ring stain where a mug stood ----
  clip(g, "wood", (x, y, w, h) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const py = y + (i * h) / n;
      const tone = 46 + rnd() * 18;
      g.fillStyle = `rgb(${tone + 22},${tone + 6},${tone - 10})`;
      g.fillRect(x, py, w, h / n);
      // grain
      for (let k = 0; k < 90; k++) {
        const gy = py + rnd() * (h / n);
        g.strokeStyle = `rgba(${rnd() < 0.5 ? "20,12,6" : "120,92,64"},${0.08 + rnd() * 0.18})`;
        g.lineWidth = 0.6 + rnd() * 1.4;
        g.beginPath();
        g.moveTo(x, gy);
        g.bezierCurveTo(x + w * 0.3, gy + (rnd() - 0.5) * 6, x + w * 0.7, gy + (rnd() - 0.5) * 6, x + w, gy + (rnd() - 0.5) * 4);
        g.stroke();
      }
      g.fillStyle = "rgba(8,5,3,.85)";
      g.fillRect(x, py, w, 2.5);
      // knots
      for (let k = 0; k < 2; k++) {
        const kx = x + rnd() * w;
        const ky = py + (0.3 + rnd() * 0.4) * (h / n);
        const gr = g.createRadialGradient(kx, ky, 0, kx, ky, 7 + rnd() * 5);
        gr.addColorStop(0, "rgba(20,10,4,.8)");
        gr.addColorStop(1, "rgba(20,10,4,0)");
        g.fillStyle = gr;
        g.fillRect(kx - 14, ky - 14, 28, 28);
      }
    }
    // pale scuffs where things are dragged, and a mug ring
    for (let k = 0; k < 160; k++) {
      g.strokeStyle = `rgba(190,160,120,${0.04 + rnd() * 0.1})`;
      g.lineWidth = 0.5 + rnd();
      const sx = x + rnd() * w;
      const sy = y + rnd() * h;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + (rnd() - 0.5) * 40, sy + (rnd() - 0.5) * 8);
      g.stroke();
    }
    g.strokeStyle = "rgba(15,8,3,.45)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x + w * 0.83, y + h * 0.3, 18, 0, Math.PI * 1.7);
    g.stroke();
    // edge wear: lighter, worn near the front edge
    const lg = g.createLinearGradient(0, y + h * 0.75, 0, y + h);
    lg.addColorStop(0, "rgba(160,120,80,0)");
    lg.addColorStop(1, "rgba(160,120,80,.22)");
    g.fillStyle = lg;
    g.fillRect(x, y + h * 0.75, w, h * 0.25);
  });
  clip(r, "wood", (x, y, w, h) => {
    r.fillStyle = "rgb(0,170,0)";
    r.fillRect(x, y, w, h);
    // the worn front edge is smoother (polished by forearms); a wet patch shines
    r.fillStyle = "rgba(0,90,0,.6)";
    r.fillRect(x, y + h * 0.85, w, h * 0.15);
    const wg = r.createRadialGradient(x + w * 0.2, y + h * 0.5, 0, x + w * 0.2, y + h * 0.5, 90);
    wg.addColorStop(0, "rgba(0,40,0,.8)");
    wg.addColorStop(1, "rgba(0,40,0,0)");
    r.fillStyle = wg;
    r.fillRect(x, y, w, h);
  });
  // ---- leather: oxblood-black pebble grain with a faint stitch line ----
  clip(g, "leather", (x, y, w, h) => {
    g.fillStyle = "#1c1210";
    g.fillRect(x, y, w, h);
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(60,36,30,${0.15 + rnd() * 0.25})` : `rgba(0,0,0,${0.2 + rnd() * 0.3})`;
      g.beginPath();
      g.arc(x + rnd() * w, y + rnd() * h, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
      g.fill();
    }
    g.setLineDash([5, 4]);
    g.strokeStyle = "rgba(170,130,90,.5)";
    g.lineWidth = 1.5;
    g.strokeRect(x + 12, y + 12, w - 24, h - 24);
    g.setLineDash([]);
  });
  fillR(r, "leather", "rgb(0,105,0)");
  // ---- cloth: a faded oxblood market cloth with a cream border stripe and wet dark patches ----
  clip(g, "cloth", (x, y, w, h) => {
    g.fillStyle = "#5a1c1f";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#cdbf9f";
    g.fillRect(x, y + h * 0.08, w, 10);
    g.fillRect(x, y + h * 0.08 + 16, w, 3);
    for (let k = 0; k < 900; k++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "140,70,60"},${rnd() * 0.12})`;
      g.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    for (let k = 0; k < 5; k++) {
      const cx = x + rnd() * w;
      const cy = y + rnd() * h;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 30 + rnd() * 30);
      gr.addColorStop(0, "rgba(10,0,0,.35)");
      gr.addColorStop(1, "rgba(10,0,0,0)");
      g.fillStyle = gr;
      g.fillRect(cx - 60, cy - 60, 120, 120);
    }
  });
  fillR(r, "cloth", "rgb(0,200,0)");
  // ---- foam insert: charcoal closed-cell foam with the gun's cut-out (a dark pocket, a lit bevel) and a mag slot ----
  clip(g, "foam", (x, y, w, h) => {
    g.fillStyle = "#6a6259";
    g.fillRect(x, y, w, h);
    for (let k = 0; k < 3000; k++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rnd() * 0.25})` : `rgba(120,110,100,${rnd() * 0.15})`;
      g.fillRect(x + rnd() * w, y + rnd() * h, 1.2, 1.2);
    }
    const tri = (ctx: CanvasRenderingContext2D, grow: number) => {
      ctx.lineJoin = "round";
      ctx.lineWidth = grow * 2;
      for (const t of pocket) {
        ctx.beginPath();
        ctx.moveTo(x + t[0] * w, y + t[1] * h);
        ctx.lineTo(x + t[2] * w, y + t[3] * h);
        ctx.lineTo(x + t[4] * w, y + t[5] * h);
        ctx.closePath();
        ctx.fill();
        if (grow > 0) ctx.stroke();
      }
    };
    // the lit bevel (the cut's top edge catching the lid light), then the shadowed pocket floor inside it
    g.fillStyle = g.strokeStyle = "#b3a796";
    tri(g, 8);
    g.fillStyle = g.strokeStyle = "#0b0a09";
    tri(g, 5);
    // a spare-magazine slot and a finger notch beside the gun
    g.fillStyle = "#8a8072";
    g.fillRect(x + w * 0.74 - 3, y + h * 0.12 - 3, w * 0.07 + 6, h * 0.32 + 6);
    g.fillStyle = "#0b0a09";
    g.fillRect(x + w * 0.74, y + h * 0.12, w * 0.07, h * 0.32);
    g.beginPath();
    g.ellipse(x + w * 0.5, y + h * 0.93, w * 0.06, h * 0.07, 0, Math.PI, 0);
    g.fill();
  });
  fillR(r, "foam", "rgb(0,245,0)");
  // The foam gets a little of the lid lamp's warmth as glow, so the black gun sits on it as a silhouette.
  clip(e, "foam", (x, y, w, h) => {
    e.fillStyle = "#3a2a1a";
    e.fillRect(x, y, w, h);
  });
  // ---- the lid's egg-crate liner, warm-lit from the lamp strip ----
  clip(g, "liner", (x, y, w, h) => {
    g.fillStyle = "#2d2925";
    g.fillRect(x, y, w, h);
    const n = 10;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const cx = x + ((i + 0.5) * w) / n;
        const cy = y + ((j + 0.5) * h) / n;
        const peak = (i + j) % 2 === 0;
        const gr = g.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, w / n / 1.3);
        gr.addColorStop(0, peak ? "rgba(150,135,118,.9)" : "rgba(0,0,0,.75)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(cx - w / n, cy - h / n, (2 * w) / n, (2 * h) / n);
      }
  });
  fillR(r, "liner", "rgb(0,250,0)");
  clip(e, "liner", (x, y, w, h) => {
    const gr = e.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, "#000");
    gr.addColorStop(1, "#3a2410");
    e.fillStyle = gr;
    e.fillRect(x, y, w, h);
  });
  // ---- the price card: a folded tent of cream card, marker on it ----
  clip(g, "card", (x, y, w, h) => {
    g.fillStyle = "#e4d9bf";
    g.fillRect(x, y, w, h);
    g.strokeStyle = "#a8232c";
    g.lineWidth = 3;
    g.strokeRect(x + 7, y + 7, w - 14, h - 14);
    g.fillStyle = "#15110d";
    g.textAlign = "center";
    g.font = '700 38px "Cathode UI", system-ui, sans-serif';
    g.save();
    g.translate(x + w / 2, y + h * 0.46);
    g.rotate(-0.04);
    g.fillText(card[0] ?? "", 0, 0);
    g.font = '600 24px "Cathode UI", system-ui, sans-serif';
    g.fillStyle = "#a8232c";
    g.fillText(card[1] ?? "", 0, 36);
    g.restore();
  });
  fillR(r, "card", "rgb(0,230,0)");
  // ---- the box of rounds: a yellow-and-black label ----
  clip(g, "ammo", (x, y, w, h) => {
    g.fillStyle = "#c99a2a";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#14110c";
    g.fillRect(x, y + h * 0.3, w, h * 0.4);
    g.fillStyle = "#c99a2a";
    g.textAlign = "center";
    g.font = '700 30px "Cathode UI", system-ui, sans-serif';
    g.fillText("9MM · 50", x + w / 2, y + h * 0.6);
  });
  fillR(r, "ammo", "rgb(0,190,0)");
  // ---- crate: grey slatted pine ----
  clip(g, "crate", (x, y, w, h) => {
    for (let i = 0; i < 4; i++) {
      const t = 70 + rnd() * 20;
      g.fillStyle = `rgb(${t},${t - 8},${t - 18})`;
      g.fillRect(x, y + (i * h) / 4, w, h / 4);
      g.fillStyle = "rgba(0,0,0,.7)";
      g.fillRect(x, y + (i * h) / 4, w, 4);
    }
    g.fillStyle = "rgba(20,20,20,.75)";
    g.font = '700 40px "Cathode UI", system-ui, sans-serif';
    g.textAlign = "center";
    g.fillText("TOMAS", x + w / 2, y + h * 0.58);
  });
  fillR(r, "crate", "rgb(0,215,0)");
  fillR(g, "foamSide", "#2a2724");
  fillR(r, "foamSide", "rgb(0,245,0)");
  // ---- mug: chipped white enamel with a blue rim ----
  clip(g, "mug", (x, y, w, h) => {
    g.fillStyle = "#d8d4cb";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#1f4d8a";
    g.fillRect(x, y, w, 10);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = "#15120f";
      g.fillRect(x + rnd() * w, y + 10 + rnd() * h * 0.6, 3 + rnd() * 5, 2 + rnd() * 3);
    }
  });
  fillR(r, "mug", "rgb(0,60,0)");
  // ---- rag: an oily grey cloth ----
  clip(g, "rag", (x, y, w, h) => {
    g.fillStyle = "#56524c";
    g.fillRect(x, y, w, h);
    for (let k = 0; k < 40; k++) {
      const cx = x + rnd() * w;
      const cy = y + rnd() * h;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 10 + rnd() * 30);
      gr.addColorStop(0, "rgba(15,12,8,.5)");
      gr.addColorStop(1, "rgba(15,12,8,0)");
      g.fillStyle = gr;
      g.fillRect(cx - 40, cy - 40, 80, 80);
    }
  });
  fillR(r, "rag", "rgb(0,220,0)");
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(cc, true), rough: tex(rc, false), glow: tex(ec, true) };
}

export interface Display {
  stall: THREE.Group;
  caseG: THREE.Group;
  lid: THREE.Group;
  /** The atlas material (the case's merge on close keys on it). */
  atlas: THREE.MeshStandardMaterial;
  /** The lid's glowing lamp strip (removed when the case shuts). */
  strip: THREE.Mesh;
  /** Case height, top of the stall. */
  H: number;
  top: number;
}

/**
 * Builds the stall and the open case around `gun` (already rotated as it should lie). `W` and `D` are the case's
 * outer size. `card` is the price card's two lines. The gun is parented into the case, sunk into its cut-out.
 */
export function buildDisplay(gun: THREE.Object3D, W: number, D: number, card: [string, string]): Display {
  const top = 0.92;
  const H = 0.09;
  const foamT = 0.034;
  const sink = 0.014;
  gun.updateMatrixWorld(true);
  const gb = new THREE.Box3().setFromObject(gun);
  const gc = gb.getCenter(new THREE.Vector3());
  gun.position.set(-gc.x, H - 0.004 - sink - gb.min.y, -gc.z);
  gun.updateMatrixWorld(true);
  // The pocket: every gun triangle flattened onto the insert's top face (UV 0..1, canvas-down).
  const iw = W - 0.03;
  const id = D - 0.03;
  const pocket: Footprint = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  gun.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const idx = m.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const ia = idx ? idx.getX(i) : i;
      const ib = idx ? idx.getX(i + 1) : i + 1;
      const ic = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
      const U = (v: THREE.Vector3) => (v.x + iw / 2) / iw;
      const V = (v: THREE.Vector3) => (v.z + id / 2) / id;
      pocket.push([U(a), V(a), U(b), V(b), U(c), V(c)]);
    }
  });
  const tex = paint(pocket, card);
  const atlas = new THREE.MeshStandardMaterial({
    color: tex ? 0xffffff : 0x3a2a1e,
    map: tex?.map ?? null,
    roughness: 1,
    roughnessMap: tex?.rough ?? null,
    metalness: 0,
    emissive: tex ? 0xffffff : 0x000000,
    emissiveMap: tex?.glow ?? null,
    emissiveIntensity: 1.6,
    side: THREE.DoubleSide,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.38, metalness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd2a85a, roughness: 0.22, metalness: 1 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.4, 1.4) });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb347).multiplyScalar(2.6) });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };

  // ---- the stall ----
  const stall = new THREE.Group();
  const TW = W + 0.62;
  const TD = D + 0.42;
  stall.add(mesh(inRegion(new RoundedBoxGeometry(TW, 0.045, TD, 2, 0.008), "wood"), atlas, 0, top - 0.0225, 0));
  // steel angle trim on the front and both ends
  stall.add(mesh(new THREE.BoxGeometry(TW + 0.012, 0.05, 0.012), steel, 0, top - 0.022, TD / 2 + 0.003));
  stall.add(mesh(new THREE.BoxGeometry(TW + 0.012, 0.05, 0.012), steel, 0, top - 0.022, -TD / 2 - 0.003));
  for (const sx of [-1, 1]) stall.add(mesh(new THREE.BoxGeometry(0.012, 0.05, TD), steel, sx * (TW / 2 + 0.003), top - 0.022, 0));
  // trestles: steel A-frames at each end, a stretcher between them
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = mesh(new THREE.BoxGeometry(0.035, top, 0.035), steel, sx * (TW / 2 - 0.1), top / 2 - 0.02, sz * (TD / 2 - 0.16));
      leg.rotation.x = sz * 0.12;
      stall.add(leg);
    }
    stall.add(mesh(new THREE.BoxGeometry(0.03, 0.03, TD - 0.3), steel, sx * (TW / 2 - 0.1), 0.3, 0));
  }
  stall.add(mesh(new THREE.BoxGeometry(TW - 0.2, 0.025, 0.025), steel, 0, 0.3, 0));
  // the cloth: across the left half of the top and hanging down the front in a drape
  const clothW = TW * 0.42;
  const cloth = mesh(inRegion(new THREE.BoxGeometry(clothW, 0.006, TD + 0.02), "cloth"), atlas, -TW / 2 + clothW / 2 - 0.02, top + 0.003, 0);
  stall.add(cloth);
  const drapeG = inRegion(new THREE.PlaneGeometry(clothW, 0.34, 6, 6), "cloth");
  // a few folds in the drape
  const dp = drapeG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i);
    const y = dp.getY(i);
    dp.setZ(i, Math.sin((x / clothW) * Math.PI * 5) * 0.012 * (0.5 - y / 0.34 + 0.5));
  }
  drapeG.computeVertexNormals();
  stall.add(mesh(drapeG, atlas, -TW / 2 + clothW / 2 - 0.02, top - 0.17, TD / 2 + 0.012));
  // the price card: a tented card leaning on the case's front-right corner
  const cardM = mesh(inRegion(new THREE.PlaneGeometry(0.16, 0.08), "card"), atlas, W / 2 + 0.13, top + 0.036, D / 2 + 0.04);
  cardM.rotation.set(-0.35, -0.35, 0);
  stall.add(cardM);
  const cardBack = mesh(inRegion(new THREE.PlaneGeometry(0.16, 0.08), "foamSide"), atlas, W / 2 + 0.135, top + 0.036, D / 2 + 0.01);
  cardBack.rotation.set(0.35, -0.35 + Math.PI, 0);
  stall.add(cardBack);
  // Tomas's clutter: a box of rounds, a chipped mug, an oily rag, a crate under the table
  const ammo = mesh(inRegion(new THREE.BoxGeometry(0.11, 0.045, 0.07), "ammo"), atlas, W / 2 + 0.17, top + 0.0225, -D / 2 + 0.02);
  ammo.rotation.y = 0.4;
  stall.add(ammo);
  const mug = mesh(inRegion(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 14, 1, false), "mug"), atlas, -TW / 2 + 0.16, top + 0.0525, -TD / 2 + 0.14);
  stall.add(mug);
  const handle = mesh(new THREE.TorusGeometry(0.024, 0.007, 6, 10, Math.PI), atlas, -TW / 2 + 0.2, top + 0.055, -TD / 2 + 0.14);
  inRegion(handle.geometry, "mug");
  handle.rotation.z = -Math.PI / 2;
  stall.add(handle);
  const ragG = inRegion(new THREE.PlaneGeometry(0.22, 0.16, 4, 4), "rag");
  const rp = ragG.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) rp.setZ(i, Math.sin(rp.getX(i) * 40 + rp.getY(i) * 25) * 0.008);
  ragG.computeVertexNormals();
  const rag = mesh(ragG, atlas, -TW / 2 + 0.25, top + 0.01, 0.04);
  rag.rotation.set(-Math.PI / 2, 0, 0.5);
  stall.add(rag);
  const crate = mesh(inRegion(new RoundedBoxGeometry(0.5, 0.36, 0.38, 1, 0.012), "crate"), atlas, -TW / 4, 0.18, 0.02);
  crate.rotation.y = 0.18;
  stall.add(crate);
  // the work lamp on a pole, leaning over the case
  const px = -(TW / 2 - 0.06);
  const pz = -(TD / 2 - 0.06);
  const pole = mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.9, 8), steel, px, 0.95, pz);
  stall.add(pole);
  const armL = Math.abs(px) + 0.02;
  const arm = mesh(new THREE.CylinderGeometry(0.011, 0.011, armL, 8), steel, px / 2 + 0.01, 1.88, pz);
  arm.rotation.z = Math.PI / 2;
  stall.add(arm);
  const shade = mesh(new THREE.ConeGeometry(0.11, 0.1, 16, 1, true), steel, 0.02, 1.83, pz);
  stall.add(shade);
  stall.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), bulbMat, 0.02, 1.79, pz));

  // ---- the case: a leather shell with brass corners and latches, a thick foam insert with the cut-out ----
  const caseG = new THREE.Group();
  caseG.position.y = top + 0.001;
  // A hollow shell: a base under the foam and four walls up to the rim, so the insert shows inside it.
  const base = 0.055;
  const wall = 0.015;
  caseG.add(mesh(inRegion(new RoundedBoxGeometry(W, base, D, 2, 0.012), "leather"), atlas, 0, base / 2, 0));
  for (const sz of [-1, 1]) caseG.add(mesh(inRegion(new THREE.BoxGeometry(W - 0.004, H - 0.01, wall), "leather"), atlas, 0, (H - 0.01) / 2 + 0.01, sz * (D / 2 - wall / 2)));
  for (const sx of [-1, 1]) caseG.add(mesh(inRegion(new THREE.BoxGeometry(wall, H - 0.01, D - 0.004), "leather"), atlas, sx * (W / 2 - wall / 2), (H - 0.01) / 2 + 0.01, 0));
  // the insert sits just inside the rim, its top a few mm under it; its sides are plain foam
  const insG = new THREE.BoxGeometry(iw, foamT, id);
  inRegion(insG, "foamSide");
  // re-map just the top face (+y, the 3rd group of 6 vertex blocks: indices 8..11) into the cut-out region
  {
    const uv = insG.attributes.uv as THREE.BufferAttribute;
    const [x, y, w, h] = R.foam;
    for (let i = 8; i < 12; i++) {
      const fu = i === 8 || i === 10 ? 0 : 1;
      const fv = i === 8 || i === 9 ? 1 : 0;
      uv.setXY(i, (x + fu * w) / S, 1 - (y + (1 - fv) * h) / S);
    }
  }
  caseG.add(mesh(insG, atlas, 0, H - 0.004 - foamT / 2, 0));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) caseG.add(mesh(new RoundedBoxGeometry(0.042, H + 0.008, 0.042, 1, 0.008), brass, sx * (W / 2 - 0.014), H / 2, sz * (D / 2 - 0.014)));
  for (const sx of [-1, 1]) {
    // latch body, its hasp flipped open, and a hinge knuckle at the back
    caseG.add(mesh(new RoundedBoxGeometry(0.056, 0.034, 0.014, 1, 0.004), brass, sx * W * 0.28, H * 0.62, D / 2 + 0.006));
    const hasp = mesh(new RoundedBoxGeometry(0.04, 0.03, 0.006, 1, 0.002), brass, sx * W * 0.28, H + 0.008, D / 2 + 0.012);
    hasp.rotation.x = 0.5;
    caseG.add(hasp);
    const knuckle = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 8), brass, sx * W * 0.3, H, -D / 2 - 0.004);
    knuckle.rotation.z = Math.PI / 2;
    caseG.add(knuckle);
  }
  // the handle on the front face
  const grip = mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 12, Math.PI), atlas, 0, H * 0.45, D / 2 + 0.012);
  inRegion(grip.geometry, "leather");
  grip.rotation.set(Math.PI / 2, 0, 0);
  caseG.add(grip);
  // a spare magazine in its slot
  const magX = -iw / 2 + iw * 0.775;
  const magZ = -id / 2 + id * 0.28;
  caseG.add(mesh(new RoundedBoxGeometry(iw * 0.06, 0.016, id * 0.3, 1, 0.003), steel, magX, H - 0.004 - 0.008, magZ));

  // ---- the lid: hinged on the back edge, open past upright; egg-crate liner and the lamp strip ----
  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  lid.add(mesh(inRegion(new RoundedBoxGeometry(W, 0.04, D, 2, 0.012), "leather"), atlas, 0, 0.02, D / 2));
  const liner = mesh(inRegion(new THREE.BoxGeometry(W - 0.04, 0.018, D - 0.04), "liner"), atlas, 0, -0.008, D / 2);
  lid.add(liner);
  const strip = mesh(new THREE.BoxGeometry(W - 0.08, 0.006, 0.012), glowMat, 0, -0.018, D - 0.03);
  lid.add(strip);

  // The stall and the case's static parts bake to one mesh per material.
  return { stall, caseG, lid, atlas, strip, H, top };
}
