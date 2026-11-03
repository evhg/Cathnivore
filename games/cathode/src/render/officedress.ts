// Plan item 51: Cath's office, lived in. What the save puts in the room (game/office.ts officeDressing): Bea's crayon
// drawings pinned by the stair door, one more for each case closed, and the trophy shelf on the west wall, where
// each closed case's keepsake stands on a little plinth with a brass plate. Built once when the office loads.

import * as THREE from "three";
import { BOARD_LIST, type Drawing, type OfficeDressing } from "../game/office";
import { bustSvg } from "../ui/busts";
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

/**
 * Plan item 58: the List as polaroids on the cork wall, each printed with the bust art (item 9's portraits, the
 * same faces as the case board screen), a name in marker under it, and a red cross once the case is closed. The
 * Vault has no face yet: a question mark. Readable from the doorway (about 120 px wide at 3 m on a desktop).
 */
export function buildBoardPolaroids(closed: readonly string[]): THREE.Group {
  const { zN } = OFFICE;
  const root = new THREE.Group();
  root.name = "board-polaroids";
  const at: Array<[number, number, number]> = [[-1.2, 1.98, -0.05], [-0.4, 1.9, 0.04], [0.5, 2.02, -0.03], [1.2, 1.8, 0.05], [-0.9, 1.25, 0.03]];
  BOARD_LIST.forEach((who, i) => {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 290;
    const g = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const struck = closed.includes(who.job);
    const paint = (face: HTMLImageElement | null) => {
      g.fillStyle = "#f3efe6";
      g.fillRect(0, 0, 240, 290);
      g.fillStyle = "#1c1f26";
      g.fillRect(14, 14, 212, 212);
      if (face) g.drawImage(face, 14 + (212 - 177) / 2, 14, 177, 212);
      else {
        g.fillStyle = "#e8e2d4";
        g.font = "bold 150px Georgia, serif";
        g.textAlign = "center";
        g.fillText("?", 120, 175);
      }
      g.fillStyle = "#1a1a1a";
      g.font = "bold 26px 'Marker Felt', 'Comic Sans MS', cursive";
      g.textAlign = "center";
      g.fillText(who.name, 120, 268, 220);
      if (struck) {
        g.strokeStyle = "rgba(200,20,30,0.9)";
        g.lineWidth = 12;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(30, 30);
        g.lineTo(210, 210);
        g.moveTo(210, 30);
        g.lineTo(30, 210);
        g.stroke();
      }
      tex.needsUpdate = true;
    };
    paint(null);
    if (who.bust) {
      const img = new Image();
      img.onload = () => paint(img);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bustSvg(who.bust))}`;
    }
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.46), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
    const [x, y, rot] = at[i]!;
    card.position.set(x, y, zN + 0.145);
    card.rotation.z = rot;
    card.userData.caption = struck ? `${who.name}: closed` : who.name;
    root.add(card);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc81e2a, roughness: 0.35 }));
    pin.position.set(x, y + 0.2, zN + 0.16);
    root.add(pin);
  });
  root.userData.faces = BOARD_LIST.filter((w) => w.bust).length;
  return root;
}

/** A repeating canvas texture (sRGB, mipmapped), drawn once. */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

/**
 * Plan item 58: the room built like a noir set. Bottle-green damask wallpaper above a walnut wainscot on the three
 * solid walls, a worn Persian rug over the bare red slab, and the desk dressed from the first case: a leather
 * blotter, the case file, a mug of coffee gone cold, and Bea's photo in a frame. Textures are canvas-drawn once.
 */
export function buildOfficeSet(): THREE.Group {
  const { xW, xE, zN, zS } = OFFICE;
  const root = new THREE.Group();
  root.name = "office-set";
  const paper = canvasTex(128, 128, (g) => {
    g.fillStyle = "#22302a";
    g.fillRect(0, 0, 128, 128);
    // A diamond trellis with a small leaf at each crossing: old bottle-green paper, faded.
    g.strokeStyle = "rgba(170,190,150,0.13)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(64, 0);
    g.lineTo(128, 64);
    g.lineTo(64, 128);
    g.closePath();
    g.stroke();
    g.fillStyle = "rgba(180,200,160,0.14)";
    for (const [cx, cy] of [[64, 0], [0, 64], [128, 64], [64, 128], [64, 64]] as const) {
      g.beginPath();
      g.ellipse(cx, cy, 4, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, [6, 2.5]);
  const panels = canvasTex(256, 128, (g) => {
    g.fillStyle = "#3a2418";
    g.fillRect(0, 0, 256, 128);
    for (let x = 8; x < 256; x += 128) {
      g.fillStyle = "#4a2e1e";
      g.fillRect(x, 14, 112, 100);
      g.strokeStyle = "rgba(0,0,0,0.45)";
      g.lineWidth = 4;
      g.strokeRect(x, 14, 112, 100);
      g.strokeStyle = "rgba(255,210,160,0.12)";
      g.lineWidth = 2;
      g.strokeRect(x + 4, 18, 104, 92);
    }
    g.fillStyle = "#2a1810";
    g.fillRect(0, 0, 256, 8);
  }, [5, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.85 });
  const wainMat = new THREE.MeshStandardMaterial({ map: panels, roughness: 0.6 });
  const wall = (w: number, x: number, z: number, ry: number) => {
    const up = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.85), wallMat);
    up.position.set(x, 1.0 + 1.85 / 2, z);
    up.rotation.y = ry;
    const low = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.0), wainMat);
    low.position.set(x, 0.5, z);
    low.rotation.y = ry;
    root.add(up, low);
  };
  wall(xE - xW, 0, zN + 0.006, 0); // north (the cork wall)
  wall(zS - zN, xW + 0.006, 0, Math.PI / 2); // west
  wall(xE - xW, 0, zS - 0.006, Math.PI); // south (the door wall)
  // A dado rail where the paper meets the panels.
  const rail = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.5 });
  for (const [w, x, z, ry] of [[xE - xW, 0, zN + 0.02, 0], [zS - zN, xW + 0.02, 0, Math.PI / 2], [xE - xW, 0, zS - 0.02, Math.PI]] as const) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.03), rail);
    r.position.set(x, 1.0, z);
    r.rotation.y = ry;
    root.add(r);
  }
  // The rug: a worn Persian in oxblood and navy with a border, laid over the slab.
  const rug = canvasTex(256, 192, (g) => {
    g.fillStyle = "#5a1a1e";
    g.fillRect(0, 0, 256, 192);
    g.strokeStyle = "#1f2a44";
    g.lineWidth = 14;
    g.strokeRect(10, 10, 236, 172);
    g.strokeStyle = "#c9a25a";
    g.lineWidth = 3;
    g.strokeRect(22, 22, 212, 148);
    g.fillStyle = "#1f2a44";
    g.beginPath();
    g.moveTo(128, 46);
    g.lineTo(188, 96);
    g.lineTo(128, 146);
    g.lineTo(68, 96);
    g.closePath();
    g.fill();
    g.fillStyle = "#c9a25a";
    g.beginPath();
    g.arc(128, 96, 14, 0, Math.PI * 2);
    g.fill();
    // Wear in the middle where she paces.
    const wear = g.createRadialGradient(128, 110, 10, 128, 110, 110);
    wear.addColorStop(0, "rgba(200,170,140,0.22)");
    wear.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = wear;
    g.fillRect(0, 0, 256, 192);
  }, [1, 1]);
  const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.2), new THREE.MeshStandardMaterial({ map: rug, roughness: 0.95 }));
  rugMesh.rotation.x = -Math.PI / 2;
  rugMesh.position.set(-0.4, 0.024, 0.4);
  root.add(rugMesh);
  // The desk, dressed: a green leather blotter, the case file, a cold coffee, Bea's photo.
  const top = 0.781;
  const blotter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.006, 0.86), new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.5 }));
  blotter.position.set(xW + 0.8, top + 0.003, 1.95);
  const folder = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.32), new THREE.MeshStandardMaterial({ color: 0xc9a96a, roughness: 0.8 }));
  folder.position.set(xW + 0.78, top + 0.016, 1.8);
  folder.rotation.y = 0.18;
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.021, 0.05), new THREE.MeshStandardMaterial({ color: 0xb8403a, roughness: 0.7 }));
  tab.position.set(xW + 0.9, top + 0.017, 1.66);
  tab.rotation.y = 0.18;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 16), new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.4 }));
  mug.position.set(xW + 1.08, top + 0.045, 1.2);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16), new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.15 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(xW + 1.08, top + 0.085, 1.2);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.16), new THREE.MeshStandardMaterial({ color: 0xb08a48, roughness: 0.35, metalness: 0.8 }));
  frame.position.set(xW + 0.42, top + 0.1, 2.55);
  frame.rotation.z = -0.15;
  const photo = canvasTex(96, 120, (g) => {
    g.fillStyle = "#e9dcc4";
    g.fillRect(0, 0, 96, 120);
    g.fillStyle = "#7fb0d8";
    g.fillRect(6, 6, 84, 70);
    g.fillStyle = "#e8b48c";
    g.beginPath();
    g.arc(48, 52, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#6a3a1a";
    g.fillRect(34, 34, 28, 10);
    g.fillStyle = "#d85a7a";
    g.fillRect(32, 66, 32, 30);
    g.fillStyle = "#3a2a20";
    g.font = "bold 14px cursive";
    g.fillText("Bea, 7", 24, 112);
  }, [1, 1]);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17), new THREE.MeshStandardMaterial({ map: photo, roughness: 0.6 }));
  pic.position.set(xW + 0.435, top + 0.1, 2.55);
  pic.rotation.set(0, Math.PI / 2, -0.15);
  pic.userData.caption = "Bea, at seven";
  root.add(blotter, folder, tab, mug, coffee, frame, pic);
  return root;
}
