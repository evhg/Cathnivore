// Plan item 457: each class in its own set. The pick's stoop (item 338: the door, the bulb, the class's prop) is the
// stage; behind it each class gets its own place, painted on one flat that fills the frame round her and lit in the
// class's key colour: the Ghost a rain rooftop with the skyline and a water tower, the Butcher a meat locker of
// hooks and cold fog, the Gunslinger a bar's back room with its bottles and card table, the Wirewitch a server alley
// of racks, cable and CRT glow, the Fixer a workbench under a pegboard and crates. Swapping class cross-fades the
// two flats in 400 ms. No live light (DECISIONS 2026-11-13: a pooled light cost ~500 ms on a class change under
// SwiftShader): the flats are unlit paintings and the key's pool on the floor is an additive gradient.

import * as THREE from "three";
import { LAYER_NO_REFLECT } from "./reflection";

export const SET_CLASSES = ["ghost", "butcher", "gunslinger", "wirewitch", "fixer"] as const;
/** The cross-fade between two sets (s). */
export const SET_FADE_S = 0.4;

export interface FrontSets {
  readonly group: THREE.Group;
  /** `w` the pick's weight (0 on the title, 1 settled on the pick); `dt` the frame's step (s; Infinity snaps). */
  update(w: number, cls: string | null, dt: number): void;
  /** Each set's weight now, for the pick's checks. */
  weights(): Record<string, number>;
  dispose(): void;
}

/** The flat's size in metres (x across her, y up from the floor). */
const FW = 11;
const FH = 5.5;
/** The flats' HDR gain over their painted colour. */
const FLAT_GAIN = 3.2;

type Paint = (g: CanvasRenderingContext2D, X: (m: number) => number, Y: (m: number) => number, s: number) => void;

/** A seeded random, so every load paints the same set. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [at, c] of stops) gr.addColorStop(at, c);
  return gr;
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a: number): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c.replace("A", String(a)));
  gr.addColorStop(0.4, c.replace("A", String(a * 0.4)));
  gr.addColorStop(1, c.replace("A", "0"));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
}

/** Ghost: a rooftop in the rain, the city's towers lit cyan behind a parapet, a water tower on its legs. */
const ghost: Paint = (g, X, Y, s) => {
  const r = rng(11);
  g.fillStyle = vgrad(g, Y(FH), Y(0.8), [
    [0, "#020a10"],
    [0.6, "#08303c"],
    [1, "#1a6878"],
  ]);
  g.fillRect(0, 0, X(FW / 2), Y(0));
  // Three ranks of towers, the far ones paler in the haze.
  for (const [shade, lo, hi, lit] of [
    ["#0b3440", 1.6, 4.2, 0.1],
    ["#062029", 1.2, 3.4, 0.16],
    ["#030f15", 0.9, 2.6, 0.22],
  ] as const) {
    let x = -FW / 2;
    while (x < FW / 2) {
      const w = 0.35 + r() * 0.7;
      const h = lo + r() * (hi - lo);
      g.fillStyle = shade;
      g.fillRect(X(x), Y(h), X(x + w) - X(x), Y(0) - Y(h));
      for (let wy = 1.0; wy < h - 0.12; wy += 0.16)
        for (let wx = x + 0.06; wx < x + w - 0.08; wx += 0.13)
          if (r() < lit) {
            g.fillStyle = r() < 0.75 ? "#7fe8ff" : "#e8fbff";
            g.fillRect(X(wx), Y(wy + 0.06), Math.max(1, 3 * s), Math.max(1, 4 * s));
          }
      x += w + r() * 0.08;
    }
  }
  // The water tower on the next roof, left of her: a staved tank and its cone on four splayed legs.
  const tx = -3.0;
  g.fillStyle = "#02070a";
  for (const dx of [-0.42, -0.14, 0.14, 0.42]) {
    g.beginPath();
    g.moveTo(X(tx + dx * 1.3), Y(0.9));
    g.lineTo(X(tx + dx * 1.3) + 5 * s, Y(0.9));
    g.lineTo(X(tx + dx * 0.9) + 5 * s, Y(2.6));
    g.lineTo(X(tx + dx * 0.9), Y(2.6));
    g.fill();
  }
  g.fillRect(X(tx - 0.62), Y(1.85), X(tx + 0.62) - X(tx - 0.62), 4 * s);
  g.fillRect(X(tx - 0.55), Y(3.55), X(tx + 0.55) - X(tx - 0.55), Y(2.6) - Y(3.55));
  g.beginPath();
  g.moveTo(X(tx - 0.62), Y(3.55));
  g.lineTo(X(tx), Y(4.05));
  g.lineTo(X(tx + 0.62), Y(3.55));
  g.fill();
  // Its rim, caught by the city's cyan.
  g.fillStyle = "#2aa8c4";
  g.fillRect(X(tx + 0.5), Y(3.55), 3 * s, Y(2.6) - Y(3.55));
  g.fillStyle = "#123f4a";
  for (let y = 2.75; y < 3.5; y += 0.22) g.fillRect(X(tx - 0.55), Y(y), X(tx + 0.55) - X(tx - 0.55), 2 * s);
  // An aircraft lamp on its cone.
  glow(g, X(tx), Y(4.08), 22 * s, "rgba(255,70,80,A)", 0.9);
  // The parapet she stands behind, its coping lit cyan, and the roof's bulkhead round the door.
  g.fillStyle = "#061116";
  g.fillRect(0, Y(0.95), X(FW / 2), Y(0) - Y(0.95));
  g.fillStyle = "#3fc4dc";
  g.fillRect(0, Y(0.95), X(FW / 2), 3 * s);
  g.fillStyle = "#081820";
  g.fillRect(X(-1.0), Y(2.9), X(1.25) - X(-1.0), Y(0) - Y(2.9));
  g.strokeStyle = "rgba(90,200,230,0.12)";
  g.lineWidth = Math.max(1, s);
  for (let y = 0.1; y < 2.9; y += 0.12) {
    g.beginPath();
    g.moveTo(X(-1.0), Y(y));
    g.lineTo(X(1.25), Y(y));
    g.stroke();
  }
  // Rain, slanting.
  g.strokeStyle = "rgba(170,235,255,0.22)";
  for (let i = 0; i < 420; i++) {
    const x = r() * X(FW / 2);
    const y = r() * Y(0);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 4 * s, y + 26 * s);
    g.stroke();
  }
};

/** Butcher: a meat locker, white tile gone red under the key, sides hung on a rail, cold fog at the floor. */
const butcher: Paint = (g, X, Y, s) => {
  const r = rng(23);
  g.fillStyle = vgrad(g, Y(FH), Y(0), [
    [0, "#1a0204"],
    [0.55, "#4a0a0e"],
    [1, "#2a0507"],
  ]);
  g.fillRect(0, 0, X(FW / 2), Y(0));
  // The tiles: a grout grid and a lit edge on each.
  const t = 0.3;
  for (let y = 0; y < FH; y += t)
    for (let x = -FW / 2; x < FW / 2; x += t) {
      g.fillStyle = `rgba(255,${60 + Math.round(r() * 30)},${60 + Math.round(r() * 30)},${0.05 + r() * 0.05})`;
      g.fillRect(X(x) + 2 * s, Y(y + t) + 2 * s, X(x + t) - X(x) - 4 * s, Y(y) - Y(y + t) - 4 * s);
    }
  g.fillStyle = "rgba(10,0,1,0.6)";
  for (let y = 0; y < FH; y += t) g.fillRect(0, Y(y), X(FW / 2), 2 * s);
  for (let x = -FW / 2; x < FW / 2; x += t) g.fillRect(X(x), 0, 2 * s, Y(0));
  // A red-lit band of the key across the middle.
  glow(g, X(0.2), Y(2.4), 260 * s, "rgba(255,40,40,A)", 0.35);
  // The rail and its hooks, the sides of meat on them.
  g.fillStyle = "#0c0102";
  g.fillRect(0, Y(3.45), X(FW / 2), 7 * s);
  for (const x of [-4.4, -3.5, -2.6, 2.6, 3.5, 4.4]) {
    g.fillRect(X(x) - s, Y(3.45), 3 * s, Y(3.1) - Y(3.45));
    const top = 3.1;
    const len = 1.5 + r() * 0.3;
    const w = 0.34 + r() * 0.08;
    g.fillStyle = "#200304";
    g.beginPath();
    g.moveTo(X(x), Y(top));
    g.quadraticCurveTo(X(x + w), Y(top - 0.3), X(x + w * 0.8), Y(top - len * 0.7));
    g.quadraticCurveTo(X(x + w * 0.4), Y(top - len), X(x), Y(top - len));
    g.quadraticCurveTo(X(x - w * 0.6), Y(top - len * 0.8), X(x - w * 0.7), Y(top - len * 0.45));
    g.quadraticCurveTo(X(x - w * 0.5), Y(top - 0.2), X(x), Y(top));
    g.fill();
    // The fat side, lit.
    g.strokeStyle = "#b8343a";
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(X(x + w * 0.2), Y(top - 0.15));
    g.quadraticCurveTo(X(x + w), Y(top - 0.35), X(x + w * 0.78), Y(top - len * 0.7));
    g.stroke();
    g.fillStyle = "#0c0102";
  }
  // The cold: fog pooled at the floor and the locker's steel door frame round the stoop.
  g.fillStyle = vgrad(g, Y(1.5), Y(0), [
    [0, "rgba(255,170,175,0)"],
    [1, "rgba(255,170,175,0.42)"],
  ]);
  g.fillRect(0, Y(1.5), X(FW / 2), Y(0) - Y(1.5));
  g.fillStyle = "#3a2a2c";
  g.fillRect(X(-0.95), Y(2.75), X(1.15) - X(-0.95), 10 * s);
};

/** Gunslinger: a bar's back room: panelling, a shelf of bottles lit gold, a lamp over the card table. */
const gunslinger: Paint = (g, X, Y, s) => {
  const r = rng(37);
  g.fillStyle = vgrad(g, Y(FH), Y(0), [
    [0, "#1a0c02"],
    [0.5, "#4a2a06"],
    [1, "#2a1604"],
  ]);
  g.fillRect(0, 0, X(FW / 2), Y(0));
  // Wallpaper stripes over a dado rail and boarded wainscot.
  for (let x = -FW / 2; x < FW / 2; x += 0.24) {
    g.fillStyle = "rgba(255,190,80,0.07)";
    g.fillRect(X(x), 0, X(x + 0.09) - X(x), Y(1.15));
  }
  g.fillStyle = "#1e0f03";
  g.fillRect(0, Y(1.15), X(FW / 2), Y(0) - Y(1.15));
  g.fillStyle = "#d89a32";
  g.fillRect(0, Y(1.15), X(FW / 2), 3 * s);
  g.fillStyle = "rgba(0,0,0,0.45)";
  for (let x = -FW / 2; x < FW / 2; x += 0.18) g.fillRect(X(x), Y(1.12), 2 * s, Y(0) - Y(1.12));
  // The back bar's shelves, two each side, a row of bottles backlit.
  for (const [x0, x1] of [
    [-5.2, -1.4],
    [1.6, 5.2],
  ] as const)
    for (const y of [1.75, 2.45]) {
      glow(g, X((x0 + x1) / 2), Y(y + 0.2), 200 * s, "rgba(255,190,70,A)", 0.3);
      g.fillStyle = "#120801";
      g.fillRect(X(x0), Y(y), X(x1) - X(x0), 6 * s);
      for (let x = x0 + 0.1; x < x1 - 0.1; x += 0.13 + r() * 0.08) {
        const h = 0.22 + r() * 0.16;
        const hue = r();
        g.fillStyle = hue < 0.6 ? "#c8801a" : hue < 0.85 ? "#7a3a08" : "#e8c070";
        g.globalAlpha = 0.85;
        g.fillRect(X(x), Y(y + h * 0.7), X(x + 0.09) - X(x), Y(y) - Y(y + h * 0.7));
        g.fillRect(X(x + 0.03), Y(y + h), X(x + 0.06) - X(x + 0.03), Y(y + h * 0.7) - Y(y + h));
        g.globalAlpha = 1;
        g.fillStyle = "rgba(255,240,190,0.7)";
        g.fillRect(X(x + 0.012), Y(y + h * 0.65), Math.max(1, 2 * s), Y(y + 0.05) - Y(y + h * 0.65));
      }
    }
  // The card table under its lamp, right of the door: a round top lit gold, the cards fanned on it, two chairs.
  const cx = 3.2;
  glow(g, X(cx), Y(1.6), 230 * s, "rgba(255,200,90,A)", 0.55);
  g.fillStyle = "#0e0601";
  g.fillRect(X(cx) - 2 * s, 0, 4 * s, Y(3.0));
  g.beginPath();
  g.moveTo(X(cx - 0.35), Y(2.9));
  g.lineTo(X(cx + 0.35), Y(2.9));
  g.lineTo(X(cx + 0.18), Y(3.1));
  g.lineTo(X(cx - 0.18), Y(3.1));
  g.fill();
  g.fillStyle = "#ffe2a0";
  g.fillRect(X(cx - 0.3), Y(2.9), X(cx + 0.3) - X(cx - 0.3), 3 * s);
  g.fillStyle = "#140801";
  g.beginPath();
  g.ellipse(X(cx), Y(0.78), X(cx + 0.75) - X(cx), 14 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(X(cx) - 5 * s, Y(0.78), 10 * s, Y(0) - Y(0.78));
  g.fillStyle = "#e0a040";
  g.fillRect(X(cx - 0.75), Y(0.78), X(cx + 0.75) - X(cx - 0.75), 2 * s);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i % 2 ? "#f4ead2" : "#e8dcc0";
    g.fillRect(X(cx - 0.25 + i * 0.1), Y(0.82), 8 * s, 4 * s);
  }
  for (const dx of [-0.95, 0.95]) {
    g.fillStyle = "#0a0400";
    g.fillRect(X(cx + dx) - 4 * s, Y(1.4), 8 * s, Y(0) - Y(1.4));
    g.fillRect(X(cx + dx * 0.8) - 14 * s, Y(0.55), 28 * s, 5 * s);
  }
};

/** Wirewitch: a server alley: racks blinking down both walls, cable slung overhead, a stack of CRTs glowing. */
const wirewitch: Paint = (g, X, Y, s) => {
  const r = rng(53);
  g.fillStyle = vgrad(g, Y(FH), Y(0), [
    [0, "#07020f"],
    [0.6, "#1e0a3a"],
    [1, "#0e0520"],
  ]);
  g.fillRect(0, 0, X(FW / 2), Y(0));
  // Racks: tall dark cabinets with rows of status lights.
  for (const x0 of [-5.2, -4.3, -3.4, -2.5, 1.9, 4.4]) {
    const w = 0.8;
    g.fillStyle = "#06030c";
    g.fillRect(X(x0), Y(3.3), X(x0 + w) - X(x0), Y(0) - Y(3.3));
    g.fillStyle = "#3a1e66";
    g.fillRect(X(x0), Y(3.3), X(x0 + w) - X(x0), 2 * s);
    for (let y = 0.25; y < 3.2; y += 0.09) {
      g.fillStyle = "#120a20";
      g.fillRect(X(x0 + 0.05), Y(y + 0.07), X(x0 + w - 0.05) - X(x0 + 0.05), Y(y) - Y(y + 0.07));
      for (let k = 0; k < 4; k++)
        if (r() < 0.55) {
          const c = r();
          g.fillStyle = c < 0.55 ? "#b67cff" : c < 0.85 ? "#ff5adc" : "#5ad8ff";
          g.fillRect(X(x0 + 0.1 + k * 0.05), Y(y + 0.045), Math.max(1, 2 * s), Math.max(1, 2 * s));
        }
    }
    glow(g, X(x0 + w / 2), Y(1.6), 90 * s, "rgba(160,90,255,A)", 0.25);
  }
  // A stack of CRTs right of the door, screens violet with scanlines.
  for (const [x, y, w] of [
    [2.75, 0.0, 0.7],
    [3.5, 0.0, 0.6],
    [2.85, 0.6, 0.55],
    [3.45, 0.55, 0.65],
    [3.1, 1.15, 0.6],
  ] as const) {
    g.fillStyle = "#14101a";
    g.fillRect(X(x), Y(y + 0.55), X(x + w) - X(x), Y(y) - Y(y + 0.55));
    const sx = X(x + 0.07), sy = Y(y + 0.47), sw = X(x + w - 0.07) - sx, sh = Y(y + 0.1) - sy;
    g.fillStyle = r() < 0.5 ? "#8a52ff" : "#c070ff";
    g.fillRect(sx, sy, sw, sh);
    g.fillStyle = "rgba(10,0,30,0.35)";
    for (let k = 0; k < sh; k += 3 * s) g.fillRect(sx, sy + k, sw, Math.max(1, s));
    glow(g, sx + sw / 2, sy + sh / 2, 120 * s, "rgba(170,100,255,A)", 0.35);
  }
  // Cable slung overhead in long sags.
  g.lineWidth = 4 * s;
  for (let i = 0; i < 7; i++) {
    const x0 = -FW / 2 + r() * 3;
    const x1 = FW / 2 - r() * 3;
    const y = 3.9 + r() * 1.2;
    g.strokeStyle = i % 3 ? "#05020a" : "#2a0f40";
    g.beginPath();
    g.moveTo(X(x0), Y(y));
    g.quadraticCurveTo(X((x0 + x1) / 2), Y(y - 1.0 - r() * 0.6), X(x1), Y(y + 0.2));
    g.stroke();
  }
  // Wet asphalt catching the screens.
  g.fillStyle = vgrad(g, Y(0.6), Y(0), [
    [0, "rgba(140,80,255,0)"],
    [1, "rgba(140,80,255,0.3)"],
  ]);
  g.fillRect(0, Y(0.6), X(FW / 2), Y(0) - Y(0.6));
};

/** Fixer: a workbench under a pegboard of tools, crates stacked, a green banker's lamp over the bench. */
const fixer: Paint = (g, X, Y, s) => {
  const r = rng(71);
  g.fillStyle = vgrad(g, Y(FH), Y(0), [
    [0, "#030a02"],
    [0.55, "#123008"],
    [1, "#081604"],
  ]);
  g.fillRect(0, 0, X(FW / 2), Y(0));
  // The pegboard over the bench, its holes and the tools on it.
  const px0 = 1.5, px1 = 5.0, py0 = 1.1, py1 = 2.9;
  g.fillStyle = "#1a3a0e";
  g.fillRect(X(px0), Y(py1), X(px1) - X(px0), Y(py0) - Y(py1));
  g.fillStyle = "#081404";
  for (let y = py0 + 0.08; y < py1; y += 0.1) for (let x = px0 + 0.08; x < px1; x += 0.1) g.fillRect(X(x), Y(y), Math.max(1, 2 * s), Math.max(1, 2 * s));
  g.fillStyle = "#030701";
  // A wrench, a hammer, a saw, pliers: plain silhouettes.
  g.fillRect(X(1.8), Y(2.7), 6 * s, Y(1.6) - Y(2.7));
  g.beginPath();
  g.arc(X(1.8) + 3 * s, Y(2.7), 12 * s, 0, Math.PI * 2);
  g.fill();
  g.fillRect(X(2.4), Y(2.75), 8 * s, Y(1.8) - Y(2.75));
  g.fillRect(X(2.4) - 14 * s, Y(2.75), 36 * s, 12 * s);
  g.beginPath();
  g.moveTo(X(3.0), Y(2.7));
  g.lineTo(X(4.0), Y(2.6));
  g.lineTo(X(4.0), Y(2.35));
  g.lineTo(X(3.0), Y(2.45));
  g.fill();
  g.fillRect(X(4.3), Y(2.7), 5 * s, Y(1.9) - Y(2.7));
  g.fillRect(X(4.45), Y(2.7), 5 * s, Y(1.9) - Y(2.7));
  // The bench, its top lit by the lamp.
  g.fillStyle = "#0a1405";
  g.fillRect(X(1.3), Y(1.0), X(5.3) - X(1.3), Y(0) - Y(1.0));
  g.fillStyle = "#6ab838";
  g.fillRect(X(1.3), Y(1.0), X(5.3) - X(1.3), 3 * s);
  // The banker's lamp: a green shade on a brass stem, its pool on the bench and board.
  glow(g, X(3.3), Y(1.35), 260 * s, "rgba(120,255,70,A)", 0.45);
  g.fillStyle = "#2a8a18";
  g.beginPath();
  g.moveTo(X(3.0), Y(1.42));
  g.lineTo(X(3.6), Y(1.42));
  g.lineTo(X(3.45), Y(1.6));
  g.lineTo(X(3.15), Y(1.6));
  g.fill();
  g.fillStyle = "#c8a040";
  g.fillRect(X(3.3) - 2 * s, Y(1.42), 4 * s, Y(1.0) - Y(1.42));
  // Crates stacked left of the door, slatted, stencilled.
  for (const [x, y, w, h] of [
    [-4.9, 0, 1.0, 0.8],
    [-3.8, 0, 1.0, 0.8],
    [-4.4, 0.8, 1.0, 0.8],
    [-2.7, 0, 0.9, 0.7],
    [-4.0, 1.6, 0.8, 0.6],
  ] as const) {
    g.fillStyle = "#13240a";
    g.fillRect(X(x), Y(y + h), X(x + w) - X(x), Y(y) - Y(y + h));
    g.fillStyle = "rgba(140,230,90,0.16)";
    for (let k = 0.12; k < h; k += 0.16) g.fillRect(X(x), Y(y + k), X(x + w) - X(x), 2 * s);
    g.fillStyle = "#060c03";
    g.fillRect(X(x), Y(y + h), 3 * s, Y(y) - Y(y + h));
    g.fillRect(X(x + w) - 3 * s, Y(y + h), 3 * s, Y(y) - Y(y + h));
    g.fillStyle = "rgba(200,255,160,0.25)";
    g.font = `bold ${Math.round(16 * s)}px sans-serif`;
    g.fillText(r() < 0.5 ? "FRAGILE" : "No. 7", X(x + 0.15), Y(y + h * 0.45));
  }
  glow(g, X(-3.9), Y(2.6), 160 * s, "rgba(100,220,60,A)", 0.18);
};

const PAINT: Record<string, Paint> = { ghost, butcher, gunslinger, wirewitch, fixer };
/** Each set's pool on the floor (sRGB), its key colour. */
export const SET_KEY: Record<string, number> = { ghost: 0x2ab8d8, butcher: 0xd01820, gunslinger: 0xe8a028, wirewitch: 0x8a40ff, fixer: 0x58d028 };

function paintFlat(cls: string, phone: boolean): THREE.CanvasTexture {
  const W = phone ? 512 : 1024;
  const H = Math.round((W * FH) / FW);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const s = W / 1024;
  if (g) {
    const X = (m: number) => ((m + FW / 2) / FW) * W;
    const Y = (m: number) => H - (m / FH) * H;
    PAINT[cls]?.(g, X, Y, s);
    // The edges fall away into the night, so the flat never shows a border.
    const v = g.createRadialGradient(W / 2, H * 0.62, H * 0.3, W / 2, H * 0.62, W * 0.62);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.85)");
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Builds the five sets in her local frame (the stoop's: x across, y up, z toward the pick's lens), the flats just
 * behind the stoop's door (`back` m behind her).
 */
export function buildFrontSets(feet: THREE.Vector3, yaw: number, groundY: number, phone: boolean, back = 2.1): FrontSets {
  const group = new THREE.Group();
  group.name = "front-sets";
  group.position.set(feet.x, groundY, feet.z);
  group.rotation.y = yaw;
  group.visible = false;
  const disposables: Array<{ dispose(): void }> = [];
  const poolTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    if (g) glow(g, 64, 64, 64, "rgba(255,255,255,A)", 1);
    return new THREE.CanvasTexture(c);
  })();
  disposables.push(poolTex);
  const flatGeo = new THREE.PlaneGeometry(FW, FH);
  const poolGeo = new THREE.PlaneGeometry(4.2, 3.2);
  disposables.push(flatGeo, poolGeo);
  const sets = new Map<string, { flat: THREE.MeshBasicMaterial; pool: THREE.MeshBasicMaterial; group: THREE.Group; k: number }>();
  for (const cls of SET_CLASSES) {
    const sg = new THREE.Group();
    sg.name = `front-set-${cls}`;
    sg.visible = false;
    const map = paintFlat(cls, phone);
    const flat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false });
    // Unlit, the painting sat at the grade's black floor (post.ts's AgX): pushed into HDR so its lights read.
    flat.color.setScalar(FLAT_GAIN);
    const fm = new THREE.Mesh(flatGeo, flat);
    fm.position.set(0, FH / 2, -back - 0.04);
    fm.renderOrder = -2;
    const pool = new THREE.MeshBasicMaterial({
      map: poolTex,
      color: new THREE.Color(SET_KEY[cls]!),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const pm = new THREE.Mesh(poolGeo, pool);
    pm.rotation.x = -Math.PI / 2;
    pm.position.set(0, 0.012, -back + 1.1);
    for (const m of [fm, pm]) {
      m.layers.enable(LAYER_NO_REFLECT);
      sg.add(m);
    }
    group.add(sg);
    disposables.push(map, flat, pool);
    sets.set(cls, { flat, pool, group: sg, k: 0 });
  }
  let first = true;
  return {
    group,
    update(w, cls, dt) {
      const pick = Math.max(0, Math.min(1, (w - 0.05) / 0.9));
      group.visible = pick > 0.001;
      // The first class shown on a pick doesn't fade in from none: it arrives with the pick's own weight.
      const snap = first || !Number.isFinite(dt);
      for (const [c, st] of sets) {
        const want = c === cls ? 1 : 0;
        st.k = snap ? want : want > st.k ? Math.min(want, st.k + dt / SET_FADE_S) : Math.max(want, st.k - dt / SET_FADE_S);
        const a = st.k * st.k * (3 - 2 * st.k) * pick;
        st.group.visible = a > 0.001;
        st.flat.opacity = a;
        st.pool.opacity = 0.32 * a;
      }
      if (cls) first = false;
      if (!cls || pick < 0.001) first = true;
    },
    weights() {
      const out: Record<string, number> = {};
      for (const [c, st] of sets) out[c] = Math.round(st.k * 100) / 100;
      return out;
    },
    dispose() {
      group.removeFromParent();
      for (const d of disposables) d.dispose();
    },
  };
}
