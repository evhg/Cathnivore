// Plan item 51: Cath's office, lived in. What the save puts in the room (game/office.ts officeDressing): Bea's crayon
// drawings pinned by the stair door, one more for each case closed, and the trophy shelf on the west wall, where
// each closed case's keepsake stands on a little plinth with a brass plate. Built once when the office loads.

import * as THREE from "three";
import type { Drawing, OfficeDressing } from "../game/office";
import { OFFICE } from "./levels/office";

/** A child's crayon drawing on cream paper (256 x 320), one of six designs. */
function drawingTexture(kind: Drawing, seed: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4ecd8";
  g.fillRect(0, 0, 256, 320);
  // Paper grain and a fold.
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(120,100,70,${0.03 + ((i * 37 + seed) % 7) / 200})`;
    g.fillRect((i * 97 + seed * 13) % 256, (i * 53 + seed * 7) % 320, 2, 2);
  }
  g.lineCap = "round";
  g.lineJoin = "round";
  const crayon = (color: string, w: number, pts: Array<[number, number]>, close = false) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = Math.sin(i * 2.3 + pass * 1.7 + seed) * 2.2;
        const jy = Math.cos(i * 1.9 + pass * 2.1 + seed) * 2.2;
        if (i === 0) g.moveTo(x + jx, y + jy);
        else g.lineTo(x + jx, y + jy);
      });
      if (close) g.closePath();
      g.stroke();
    }
  };
  const circle = (color: string, w: number, x: number, y: number, r: number) =>
    crayon(color, w, Array.from({ length: 19 }, (_, i) => [x + Math.cos((i / 18) * Math.PI * 2) * r, y + Math.sin((i / 18) * Math.PI * 2) * r] as [number, number]));
  // Cath as Bea sees her: a tall figure in a long coat under a black umbrella.
  const mum = (x: number, y: number, s = 1) => {
    crayon("#222", 5, [[x - 34 * s, y - 70 * s], [x, y - 92 * s], [x + 34 * s, y - 70 * s]], true);
    crayon("#222", 4, [[x, y - 92 * s], [x, y - 20 * s]]);
    circle("#e8b48c", 5, x, y - 52 * s, 11 * s);
    crayon("#2b2b2b", 7, [[x - 14 * s, y - 60 * s], [x - 18 * s, y - 30 * s]]);
    crayon("#4a6a3a", 6, [[x - 14 * s, y - 38 * s], [x - 22 * s, y + 30 * s], [x + 22 * s, y + 30 * s], [x + 14 * s, y - 38 * s]], true);
    crayon("#222", 5, [[x - 8 * s, y + 30 * s], [x - 8 * s, y + 52 * s]]);
    crayon("#222", 5, [[x + 8 * s, y + 30 * s], [x + 8 * s, y + 52 * s]]);
  };
  switch (kind) {
    case "sun":
      circle("#f2b400", 7, 200, 60, 26);
      for (let k = 0; k < 8; k++) crayon("#f2b400", 4, [[200 + Math.cos(k) * 36, 60 + Math.sin(k) * 36], [200 + Math.cos(k) * 52, 60 + Math.sin(k) * 52]]);
      crayon("#3a8a3a", 8, [[10, 280], [80, 270], [160, 285], [246, 272]]);
      mum(100, 220);
      break;
    case "mum":
      mum(128, 200, 1.3);
      crayon("#d12f4a", 6, [[60, 60], [70, 45], [82, 60], [70, 78], [60, 60]]);
      crayon("#d12f4a", 6, [[176, 60], [186, 45], [198, 60], [186, 78], [176, 60]]);
      g.fillStyle = "#3355aa";
      g.font = "bold 34px Comic Sans MS, cursive";
      g.fillText("MUM", 92, 300);
      break;
    case "taxi":
      crayon("#2a6fb0", 10, [[0, 230], [40, 222], [90, 236], [140, 224], [200, 238], [256, 226]]);
      crayon("#e0c020", 6, [[50, 200], [200, 200], [180, 228], [70, 228]], true);
      crayon("#222", 4, [[110, 200], [110, 160], [150, 160], [150, 200]]);
      mum(130, 150, 0.55);
      break;
    case "fish":
      crayon("#ff8f2e", 7, [[60, 160], [130, 120], [190, 160], [130, 200]], true);
      crayon("#ff8f2e", 7, [[190, 160], [230, 130], [230, 190]], true);
      circle("#222", 4, 92, 154, 5);
      g.fillStyle = "#c0392b";
      g.font = "bold 28px Comic Sans MS, cursive";
      g.fillText("EGGS", 80, 280);
      break;
    case "stars":
      g.fillStyle = "#1d2547";
      g.fillRect(14, 14, 228, 200);
      crayon("#f2e07a", 6, [[180, 60], [196, 76], [180, 100], [208, 84]]);
      for (let k = 0; k < 9; k++) crayon("#fff6c0", 3, [[30 + ((k * 61) % 200), 30 + ((k * 43) % 150)], [34 + ((k * 61) % 200), 34 + ((k * 43) % 150)]]);
      mum(80, 250, 0.7);
      break;
    default:
      crayon("#b8403a", 6, [[60, 180], [128, 110], [196, 180]], true);
      crayon("#8a5a3a", 6, [[70, 180], [70, 270], [186, 270], [186, 180]], true);
      crayon("#3355aa", 5, [[110, 270], [110, 220], [146, 220], [146, 270]]);
      mum(40, 250, 0.5);
      mum(220, 262, 0.35);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A keepsake as a small object on its plinth: the boots, the gloves, the cloche, the folded coat, the jack. */
function keepsakeMesh(id: string): THREE.Object3D {
  const g = new THREE.Group();
  const m = (color: number, rough = 0.5, metal = 0, emissive = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: emissive ? 1.6 : 0 });
  const box = (mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y + h / 2, z);
    g.add(b);
    return b;
  };
  switch (id) {
    case "gumshoes": {
      const patent = m(0x0d0d10, 0.15, 0.2);
      for (const z of [-0.04, 0.04]) {
        box(patent, 0.13, 0.04, 0.05, 0.01, 0, z);
        box(patent, 0.05, 0.1, 0.05, -0.04, 0.03, z);
        box(m(0x3a3a3a, 0.9), 0.02, 0.04, 0.02, 0.05, 0, z);
      }
      break;
    }
    case "velvetKnuckles": {
      const velvet = m(0x4a1a4f, 0.95);
      box(velvet, 0.09, 0.025, 0.12, -0.03, 0, 0).rotation.y = 0.3;
      box(velvet, 0.09, 0.025, 0.12, 0.04, 0.025, 0.01).rotation.y = -0.2;
      box(m(0xb89a5a, 0.3, 1), 0.07, 0.012, 0.02, 0.04, 0.05, -0.04);
      break;
    }
    case "widowsVeil": {
      const felt = m(0x0c0c0e, 0.8);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.07, 18), felt);
      crown.position.y = 0.045;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 22), felt);
      brim.position.y = 0.012;
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.06, 22, 1, true), new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 1 }));
      net.position.y = -0.015;
      g.add(crown, brim, net);
      break;
    }
    case "longGoodbye": {
      const wool = m(0x33343a, 0.95);
      box(wool, 0.2, 0.05, 0.13);
      box(wool, 0.2, 0.012, 0.06, 0, 0.05, -0.02).rotation.x = -0.25;
      for (const x of [-0.05, 0.02]) box(m(0x16171a, 0.35, 0.2), 0.016, 0.006, 0.016, x, 0.05, 0.05);
      break;
    }
    case "candorsConscience": {
      box(m(0x22262c, 0.35, 0.8), 0.08, 0.02, 0.05);
      box(m(0x0a2a30, 0.3, 0, 0x2ee6ff), 0.05, 0.006, 0.03, 0, 0.02, 0);
      for (let k = 0; k < 4; k++) box(m(0xc9a25a, 0.3, 1), 0.008, 0.012, 0.004, -0.03 + k * 0.02, 0.0, 0.027);
      break;
    }
    default:
      box(m(0x777777), 0.08, 0.08, 0.08);
  }
  return g;
}

/** The room's dressing for this save, positioned in the office's own coordinates (render/levels/office.ts). */
export function buildOfficeDressing(d: OfficeDressing): THREE.Group {
  const root = new THREE.Group();
  root.name = "office-dressing";
  const { xW, zS } = OFFICE;
  // Bea's drawings: pinned in a loose row on the south wall, west of the stair door, each a little crooked.
  d.drawings.forEach((kind, i) => {
    const mat = new THREE.MeshStandardMaterial({ map: drawingTexture(kind, i * 7 + 3), roughness: 0.95 });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.375), mat);
    const col = i % 3;
    const row = Math.floor(i / 3);
    sheet.position.set(0.85 + col * 0.42, 1.75 - row * 0.46, zS - 0.012);
    sheet.rotation.set(0, Math.PI, (((i * 37) % 9) - 4) * 0.02);
    sheet.userData.caption = "A drawing from Bea";
    root.add(sheet);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: [0xd12f4a, 0x2e7dd1, 0xf2b400][i % 3], roughness: 0.4 }));
    pin.position.set(sheet.position.x, sheet.position.y + 0.17, zS - 0.02);
    root.add(pin);
  });
  // The trophy shelf: a walnut plank on brackets on the west wall between the wardrobe and the desk.
  const walnut = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 1 });
  const shelfX = xW + 0.18;
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 1.7), walnut);
  plank.position.set(shelfX, 1.42, -0.35);
  root.add(plank);
  for (const z of [-1.05, 0.35]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.03), walnut);
    br.position.set(xW + 0.1, 1.33, z);
    root.add(br);
  }
  d.keepsakes.forEach((k, i) => {
    const z = -1.0 + i * 0.32;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.22), walnut);
    plinth.position.set(shelfX, 1.465, z);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.09), brass);
    plate.position.set(shelfX + 0.082, 1.465, z);
    const obj = keepsakeMesh(k.id);
    obj.position.set(shelfX, 1.49, z);
    obj.rotation.y = -Math.PI / 2 + (i % 2 ? 0.25 : -0.2);
    // Read from the middle of the room: each keepsake a touch larger than life.
    obj.scale.setScalar(1.6);
    obj.userData.caption = k.caption;
    root.add(plinth, plate, obj);
  });
  root.userData.dressing = { drawings: d.drawings.length, keepsakes: d.keepsakes.length };
  return root;
}

/**
 * Plan item 51: rain on the street window. A sheet just inside the glass whose shader draws drops that run down
 * in wavering trails, catching the neon behind (additive, so only the streaks show). `still` (the phone tier and
 * reduced motion) freezes them where they are.
 */
export function buildWindowRain(still: boolean): THREE.Mesh {
  const { xE } = OFFICE;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 7.3 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec2 uv = vUv * vec2(42.0, 1.0);
        float col = floor(uv.x);
        float fx = fract(uv.x);
        float speed = 0.06 + 0.12 * hash(col);
        float phase = hash(col * 1.7);
        float head = fract(phase - uTime * speed);
        float wob = 0.5 + 0.06 * sin(vUv.y * 17.0 + col * 3.1) + 0.03 * sin(vUv.y * 53.0 + col);
        float d = abs(fx - wob);
        float trail = smoothstep(0.0, 0.35, head - (1.0 - vUv.y)) * (1.0 - smoothstep(0.35, 0.5, head - (1.0 - vUv.y)));
        float bead = 1.0 - smoothstep(0.0, 0.012, abs((1.0 - vUv.y) - head));
        float line = (1.0 - smoothstep(0.03, 0.09, d)) * (trail * 0.35 + bead * 1.2) * step(0.35, hash(col * 3.3));
        // Static beads all over the pane.
        vec2 g = vUv * vec2(60.0, 40.0);
        float dot = 1.0 - smoothstep(0.08, 0.16, length(fract(g) - 0.5));
        dot *= step(0.86, hash(floor(g.x) * 13.1 + floor(g.y) * 7.7));
        vec3 tint = mix(vec3(1.0, 0.45, 0.75), vec3(0.45, 0.9, 1.0), vUv.x);
        gl_FragColor = vec4(tint * (line + dot * 0.5) * 0.22, 1.0);
      }`,
  });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), mat);
  pane.position.set(xE + 0.06, 1.65, -0.9);
  pane.rotation.y = -Math.PI / 2;
  pane.renderOrder = 5;
  pane.name = "window-rain";
  if (!still) pane.onBeforeRender = () => (mat.uniforms.uTime!.value = performance.now() / 1000);
  return pane;
}

/**
 * Plan item 58: the window's neon falling through venetian blinds: soft stripes laid on the floorboards inside the
 * window, fading away from it (one additive decal, baked: the same on every tier, no extra lights or shadows).
 */
export function buildBlindLight(): THREE.Mesh {
  const { xE } = OFFICE;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 9; i++) {
    const y = 14 + i * 27;
    const grad = g.createLinearGradient(0, 0, 256, 0);
    // Brightest by the window (u 1), gone by the far edge.
    grad.addColorStop(0, "rgba(255,90,170,0)");
    grad.addColorStop(0.55, "rgba(255,95,168,0.35)");
    grad.addColorStop(1, "rgba(255,120,190,0.9)");
    g.fillStyle = grad;
    g.fillRect(0, y, 256, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.4), mat);
  floor.rotation.x = -Math.PI / 2;
  // Skewed a little, as light through a high window falls at a slant.
  floor.rotation.z = -0.12;
  floor.position.set(xE - 1.65, 0.006, -0.9);
  floor.renderOrder = 4;
  floor.name = "blind-light";
  return floor;
}
