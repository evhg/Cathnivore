// Councillor Pell's campaign billboard (plan item 4): a posterised portrait of the man, painted on canvas at
// load. Navy shadows, warm sand light, one red accent, the way real campaign art flattens a face into three
// tones; his name huge beside it, the slogan under a red rule, and the screen's scanlines and one torn band
// of glitch. One texture serves the giant board on the hall and the smaller screens either side.

import * as THREE from "three";
import { canvas } from "./textures";

const NAVY = "#14213a";
const MID = "#4a5a78";
const SAND = "#e9cfa6";
const LIGHT = "#fff1d8";
const RED = "#c8202c";
const SANS = "'Archivo', 'Helvetica Neue', Arial, sans-serif";

/** Pell's head and shoulders in three flat tones, facing three-quarters to his right, chin up. */
function portrait(g: CanvasRenderingContext2D, cx: number, base: number, s: number): void {
  const P = (x: number, y: number): [number, number] => [cx + x * s, base - y * s];
  const shape = (fill: string, pts: Array<[number, number]>, curve = true) => {
    g.fillStyle = fill;
    g.beginPath();
    const p0 = P(...pts[0]!);
    g.moveTo(...p0);
    for (let i = 1; i < pts.length; i++) {
      const p = P(...pts[i]!);
      if (curve && i < pts.length - 1) {
        const q = P(...pts[i + 1]!);
        g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      } else g.lineTo(...p);
    }
    g.closePath();
    g.fill();
  };
  // Shoulders and suit (navy), the lit lapel (mid), shirt and tie.
  shape(NAVY, [[-1.25, 0], [-1.2, 0.55], [-0.9, 0.85], [-0.35, 1.0], [0.35, 1.02], [0.95, 0.88], [1.25, 0.6], [1.3, 0]], false);
  shape(MID, [[0.35, 1.02], [0.95, 0.88], [1.25, 0.6], [1.3, 0], [0.55, 0], [0.3, 0.6]]);
  shape(LIGHT, [[-0.22, 1.0], [0.2, 1.02], [0.08, 0.55], [-0.05, 0.55]], false);
  shape(RED, [[-0.08, 0.95], [0.08, 0.95], [0.12, 0.3], [0.02, 0.18], [-0.1, 0.3]], false);
  shape(NAVY, [[-0.45, 0.98], [-0.2, 0.98], [-0.04, 0.45], [-0.3, 0.15]], false);
  shape(MID, [[0.22, 1.0], [0.45, 0.98], [0.3, 0.15], [0.06, 0.45]], false);
  // The lapel pin: a small gold city seal.
  g.fillStyle = "#e0b04a";
  g.beginPath();
  g.arc(...P(0.55, 0.72), s * 0.045, 0, Math.PI * 2);
  g.fill();
  // Neck, in shadow on his left.
  shape(MID, [[-0.24, 0.98], [-0.26, 1.28], [0.22, 1.3], [0.24, 0.98]], false);
  shape(SAND, [[0.0, 0.99], [0.02, 1.28], [0.22, 1.3], [0.24, 0.99]], false);
  // The head: a strong jaw, a cheekbone catching the light from the right.
  shape(MID, [[-0.32, 1.45], [-0.36, 1.85], [-0.28, 2.15], [0.0, 2.3], [0.3, 2.2], [0.4, 1.9], [0.36, 1.5], [0.2, 1.24], [0.0, 1.18], [-0.2, 1.24]]);
  shape(SAND, [[-0.05, 1.2], [0.2, 1.24], [0.36, 1.5], [0.4, 1.9], [0.32, 2.12], [0.05, 2.18], [0.0, 1.9], [-0.08, 1.6]]);
  shape(LIGHT, [[0.18, 1.62], [0.34, 1.7], [0.36, 1.92], [0.24, 1.98], [0.16, 1.8]]);
  // The ear on the shadow side.
  shape(NAVY, [[-0.33, 1.62], [-0.42, 1.68], [-0.42, 1.86], [-0.34, 1.9]]);
  // Swept silver hair: a high side part, combed back.
  shape(LIGHT, [[-0.36, 1.92], [-0.38, 2.18], [-0.2, 2.38], [0.1, 2.42], [0.36, 2.3], [0.42, 2.06], [0.3, 2.1], [0.06, 2.2], [-0.2, 2.1], [-0.3, 1.9]]);
  shape(MID, [[-0.36, 1.92], [-0.38, 2.14], [-0.22, 2.3], [-0.05, 2.32], [-0.2, 2.12], [-0.3, 1.9]]);
  // Brows, eyes (narrowed, looking out over the crowd), the nose's shadow and a closed-mouth smile.
  g.strokeStyle = NAVY;
  g.lineCap = "round";
  const line = (w: number, pts: Array<[number, number]>) => {
    g.lineWidth = w * s;
    g.beginPath();
    g.moveTo(...P(...pts[0]!));
    for (const p of pts.slice(1)) g.lineTo(...P(...p));
    g.stroke();
  };
  line(0.05, [[-0.2, 1.93], [-0.06, 1.96]]);
  line(0.05, [[0.08, 1.96], [0.28, 1.95]]);
  line(0.035, [[-0.18, 1.86], [-0.08, 1.87]]);
  line(0.035, [[0.11, 1.87], [0.24, 1.86]]);
  shape(MID, [[0.02, 1.86], [-0.02, 1.62], [0.04, 1.56], [0.12, 1.6], [0.06, 1.64]], false);
  line(0.03, [[-0.08, 1.44], [0.04, 1.42], [0.18, 1.45]]);
  line(0.02, [[0.2, 1.48], [0.24, 1.53]]);
  // A cleft in the chin.
  line(0.015, [[0.06, 1.24], [0.06, 1.3]]);
}

/** Paints the board: portrait left, PELL right, slogan, date, scanlines and a glitch band. 2.4:1. */
export function pellBoardTexture(quality: "phone" | "high" | "ultra"): THREE.CanvasTexture {
  const W = quality === "phone" ? 1024 : 2048;
  const H = Math.round(W / 2.43);
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  // A navy field washed with warm light from the right, and a halo behind his head.
  const bg = g.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, "#0c1424");
  bg.addColorStop(0.45, "#1a2a48");
  bg.addColorStop(1, "#0e1628");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(W * 0.27, H * 0.38, 0, W * 0.27, H * 0.38, H * 0.6);
  halo.addColorStop(0, "rgba(255,210,150,0.55)");
  halo.addColorStop(1, "rgba(255,210,150,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  // Sunburst rays behind him: the campaign's "new dawn".
  g.save();
  g.translate(W * 0.27, H * 0.45);
  for (let k = 0; k < 18; k++) {
    g.rotate((Math.PI * 2) / 18);
    g.fillStyle = k % 2 ? "rgba(255,220,170,0.06)" : "rgba(0,0,0,0)";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W, -W * 0.09);
    g.lineTo(W, W * 0.09);
    g.fill();
  }
  g.restore();
  portrait(g, W * 0.27, H * 1.02, H * 0.39);
  // The name, cream on navy, with a red rule and the slogan.
  const tx = W * 0.5;
  const tw = W * 0.45;
  let fs = H * 0.42;
  g.font = `900 ${fs}px ${SANS}`;
  const m = g.measureText("PELL").width;
  if (m > tw) fs *= tw / m;
  g.font = `900 ${fs}px ${SANS}`;
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
  g.fillStyle = LIGHT;
  g.shadowColor = "rgba(255,200,140,0.6)";
  g.shadowBlur = fs * 0.12;
  g.fillText("PELL", tx, H * 0.5);
  g.shadowBlur = 0;
  g.fillStyle = RED;
  g.fillRect(tx, H * 0.56, tw, H * 0.035);
  const line2 = (t: string, y: number, size: number, color: string, weight = 700) => {
    let f = size;
    g.font = `${weight} ${f}px ${SANS}`;
    const mm = g.measureText(t).width;
    if (mm > tw) f *= tw / mm;
    g.font = `${weight} ${f}px ${SANS}`;
    g.fillStyle = color;
    g.fillText(t, tx, y);
  };
  line2("A SAFER HOLLOWELL", H * 0.72, H * 0.11, SAND);
  line2("ORDER  ·  SAFETY  ·  PROSPERITY", H * 0.84, H * 0.055, "#9fb0d0", 600);
  // The council seal and the paid-for line, small, bottom right.
  g.fillStyle = "rgba(160,176,208,0.7)";
  line2("PAID FOR BY CANDOR HOLDINGS FOR A SAFER HOLLOWELL", H * 0.95, H * 0.026, "rgba(160,176,208,0.7)", 500);
  // Scanlines, a soft vignette and one torn band of glitch where the feed stutters.
  g.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  const vig = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  const gy = Math.round(H * 0.31);
  const gh = Math.round(H * 0.035);
  const band = g.getImageData(0, gy, W, gh);
  g.putImageData(band, Math.round(W * 0.018), gy);
  g.fillStyle = "rgba(80,220,255,0.14)";
  g.fillRect(0, gy, W, gh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
