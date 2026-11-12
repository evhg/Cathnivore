// Materials and per-act lighting for Hedgerow's 3D battlefield. The farms are warm and hand-made (wood,
// straw, thatch, painted boards); the corporations are cold, glossy and over-lit (chrome, glass, emissive
// logos) — the same contrast as the 2D art (VISION "Art direction"), now with real light.

import * as THREE from "three";

const cache = new Map<string, THREE.Material>();

function key(o: object): string {
  return JSON.stringify(o);
}

/** Cached materials are shared by many meshes: mark them so effects that dispose a dead model's materials skip them. */
function shared<T extends THREE.Material>(m: T): T {
  return Object.assign(m, { shared: true });
}

/** A matte, hand-made surface (wood, straw, paint, leaves). Flat-shaded so the low-poly facets read. */
export function matte(color: string, rough = 0.85, flat = true): THREE.MeshStandardMaterial {
  const k = key({ m: "matte", color, rough, flat });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = shared(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: flat }));
    cache.set(k, m);
  }
  return m;
}

/** Corporate gloss: painted metal with a clear coat. */
export function gloss(color: string, metal = 0.35): THREE.MeshPhysicalMaterial {
  const k = key({ m: "gloss", color, metal });
  let m = cache.get(k) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = shared(new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: metal, clearcoat: 1, clearcoatRoughness: 0.15 }));
    cache.set(k, m);
  }
  return m;
}

export function chrome(color = "#dfe6ee"): THREE.MeshStandardMaterial {
  const k = key({ m: "chrome", color });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = shared(new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.95 }));
    cache.set(k, m);
  }
  return m;
}

export function metal(color = "#9aa0a6", rough = 0.4): THREE.MeshStandardMaterial {
  const k = key({ m: "metal", color, rough });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = shared(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.75 }));
    cache.set(k, m);
  }
  return m;
}

/** Light that glows (and blooms): lamps, logos, eyes, magic. */
export function glow(color: string, intensity = 2): THREE.MeshStandardMaterial {
  const k = key({ m: "glow", color, intensity });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = shared(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 }));
    cache.set(k, m);
  }
  return m;
}

export function glass(color = "#1c2a36"): THREE.MeshPhysicalMaterial {
  const k = key({ m: "glass", color });
  let m = cache.get(k) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = shared(new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0.2, clearcoat: 1 }));
    cache.set(k, m);
  }
  return m;
}

/** Shiny translucent plastic (bubble wrap, shields): clear-coated, see-through, never writes depth. */
export function bubble(color = "#e8f6ff", opacity = 0.38): THREE.MeshPhysicalMaterial {
  const k = key({ m: "bubble", color, opacity });
  let m = cache.get(k) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = shared(
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity, depthWrite: false }),
    );
    cache.set(k, m);
  }
  return m;
}

export const C = {
  wood: "#8a5a35",
  woodDark: "#5e3d22",
  straw: "#e2c06a",
  strawDark: "#b8923e",
  cream: "#f4ede1",
  red: "#b5523b",
  leaf: "#4f7f37",
  leafLight: "#6ea04c",
  leafDark: "#3a6128",
  stone: "#cfc5af",
  stoneDark: "#9a9183",
  soil: "#6b4a2b",
  teal: "#1f8a8a",
  gold: "#d4ae58",
  ink: "#2b2320",
  water: "#4f93b8",
  olive: "#6E7C4B",
};

/** The light and air of each act: morning in Brindle Hills, dusk by the Rift, firelight at Kingsmarket. */
export interface ActLight {
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sun: string;
  sunIntensity: number;
  /** Sun direction: azimuth and elevation in degrees. */
  sunAz: number;
  sunEl: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  grass: [string, string, string];
  dirt: [string, string];
  exposure: number;
}

export const ACT_LIGHT: ActLight[] = [
  // 1 Brindle Hills: a bright spring morning.
  { skyTop: "#7fb2e0", skyBottom: "#f5e6c4", fog: "#e9e2cc", fogNear: 18, fogFar: 46, sun: "#fff1d0", sunIntensity: 2.6, sunAz: 140, sunEl: 42, hemiSky: "#cfe4ff", hemiGround: "#5c6b3a", hemiIntensity: 0.9, grass: ["#7fae4a", "#6b9a3c", "#8fbd57"], dirt: ["#b48a5a", "#8e6a43"], exposure: 1.0 },
  // 2 Highmoor: golden late morning on the moor.
  { skyTop: "#8fb6d8", skyBottom: "#f2dca0", fog: "#e7d8ae", fogNear: 16, fogFar: 42, sun: "#ffe2a8", sunIntensity: 2.5, sunAz: 120, sunEl: 36, hemiSky: "#d8e2f0", hemiGround: "#6a5b30", hemiIntensity: 0.85, grass: ["#a0a85a", "#8a9348", "#b3b86a"], dirt: ["#a9845a", "#866642"], exposure: 1.0 },
  // 3 Saltmarsh: cool sea light.
  { skyTop: "#6fa6c8", skyBottom: "#dcecee", fog: "#cfe0e2", fogNear: 14, fogFar: 40, sun: "#f4fbff", sunIntensity: 2.3, sunAz: 200, sunEl: 40, hemiSky: "#d9eef5", hemiGround: "#4f6e5a", hemiIntensity: 1.0, grass: ["#7fa678", "#6a9168", "#93b98a"], dirt: ["#b9a57e", "#95825f"], exposure: 1.0 },
  // 4 Rivermead: after the rain, wet and lush.
  { skyTop: "#7a98b4", skyBottom: "#d8e2d8", fog: "#c8d4c8", fogNear: 13, fogFar: 38, sun: "#f2f6ea", sunIntensity: 2.0, sunAz: 230, sunEl: 34, hemiSky: "#cbd9e6", hemiGround: "#3f5e36", hemiIntensity: 1.0, grass: ["#5f9a46", "#4f873a", "#71ad55"], dirt: ["#8d6a46", "#6e5236"], exposure: 0.98 },
  // 5 Oakvale: dappled afternoon in the woods.
  { skyTop: "#6f9c8a", skyBottom: "#efe0b0", fog: "#d6d0a8", fogNear: 12, fogFar: 36, sun: "#ffe7b0", sunIntensity: 2.4, sunAz: 250, sunEl: 30, hemiSky: "#d8e8c8", hemiGround: "#34502a", hemiIntensity: 0.85, grass: ["#5a8c3e", "#4a7a33", "#6a9c48"], dirt: ["#8a6740", "#6a4e30"], exposure: 1.0 },
  // 6 Shingle Bay: hard bright coast, storm clouds.
  { skyTop: "#5b7f9c", skyBottom: "#e2e6e0", fog: "#d0d6d4", fogNear: 14, fogFar: 40, sun: "#ffffff", sunIntensity: 2.6, sunAz: 170, sunEl: 48, hemiSky: "#e0ecf4", hemiGround: "#6a6650", hemiIntensity: 0.9, grass: ["#9aa86a", "#87955a", "#a9b878"], dirt: ["#c2ad86", "#9c8862"], exposure: 1.0 },
  // 7 The Rift: dusk, long orange shadows.
  { skyTop: "#3e3a5e", skyBottom: "#f09a6a", fog: "#a8786a", fogNear: 12, fogFar: 34, sun: "#ffad70", sunIntensity: 2.8, sunAz: 270, sunEl: 14, hemiSky: "#8a7aa8", hemiGround: "#3a2a24", hemiIntensity: 0.7, grass: ["#8a8a52", "#767644", "#9a9a5e"], dirt: ["#93734c", "#6e5038"], exposure: 1.05 },
  // 8 The Ballot: polling day afternoon.
  { skyTop: "#7aa2cc", skyBottom: "#f2e2c4", fog: "#e4d8c0", fogNear: 15, fogFar: 42, sun: "#fff0d8", sunIntensity: 2.4, sunAz: 210, sunEl: 32, hemiSky: "#d8e4f2", hemiGround: "#4a5a36", hemiIntensity: 0.9, grass: ["#8aa468", "#789458", "#98b278"], dirt: ["#b39d77", "#8d7051"], exposure: 1.0 },
  // 9 The Merger: overcast, cold glass light.
  { skyTop: "#5a6676", skyBottom: "#c4ccd4", fog: "#aab4be", fogNear: 12, fogFar: 34, sun: "#e8f0ff", sunIntensity: 1.8, sunAz: 190, sunEl: 50, hemiSky: "#c8d4e2", hemiGround: "#3a4440", hemiIntensity: 1.1, grass: ["#7a8c72", "#6a7c64", "#8a9c82"], dirt: ["#978d7b", "#6f675c"], exposure: 0.95 },
  // 10 Kingsmarket: night, lanterns and fire.
  { skyTop: "#141a33", skyBottom: "#5a2e3a", fog: "#2a1e2e", fogNear: 10, fogFar: 30, sun: "#ffb070", sunIntensity: 1.6, sunAz: 300, sunEl: 22, hemiSky: "#3a3a6a", hemiGround: "#1e1414", hemiIntensity: 0.75, grass: ["#4f6a3a", "#425a32", "#5a7642"], dirt: ["#7a5a3a", "#5a4028"], exposure: 1.15 },
];

/**
 * A Night twist's light (plan item 43, "Night lights lanterns"): the act's own ground under a blue dusk, a cool
 * low moon in place of the sun, so the lane's lanterns are what light the field. Kingsmarket is already night.
 */
export function nightLight(L: ActLight): ActLight {
  return {
    ...L,
    skyTop: "#18204a",
    skyBottom: "#6a5a80",
    fog: "#3c4064",
    fogNear: L.fogNear * 0.85,
    fogFar: L.fogFar * 0.85,
    sun: "#c4d0ff",
    sunIntensity: L.sunIntensity * 0.55,
    sunEl: Math.min(L.sunEl, 30),
    hemiSky: "#6a7ab8",
    hemiGround: "#2a2c24",
    hemiIntensity: L.hemiIntensity * 0.8,
    exposure: L.exposure * 1.05,
  };
}

export function actLight(levelId: number): ActLight {
  return ACT_LIGHT[Math.min(ACT_LIGHT.length - 1, Math.floor((levelId - 1) / 10))]!;
}

/** What grows and floats on each act's field: wildflower colours, how thick they are, the hedge blossom, the
 * motes in the air and how much cloud passes over. Night levels swap the motes for fireflies. */
export interface ActMood {
  flowers: string[];
  /** Share of each plot's edge plants that are flowers rather than grass. */
  flowerRate: number;
  blossom: string;
  /** Colour of the drifting pollen or seeds. */
  mote: string;
  /** How dark the passing cloud shadows are (0 to 1). */
  cloud: number;
  /** Birds wheeling overhead. */
  birds: number;
}

export const ACT_MOOD: ActMood[] = [
  // 1 Brindle Hills: daisies, buttercups and cowslips; dandelion clocks on the breeze.
  { flowers: ["#fff8ec", "#ffd84a", "#f6e27a", "#f2a7c3"], flowerRate: 0.32, blossom: "#f3e9f0", mote: "#fffbe8", cloud: 0.3, birds: 5 },
  // 2 Highmoor: heather and gorse.
  { flowers: ["#b98ad0", "#9b6fb8", "#ffcf3a", "#fff8ec"], flowerRate: 0.3, blossom: "#e8d0ee", mote: "#fff2cc", cloud: 0.32, birds: 4 },
  // 3 Saltmarsh: sea thrift and sea lavender.
  { flowers: ["#f2a7c3", "#c6a3e0", "#fff8ec"], flowerRate: 0.22, blossom: "#f6dce6", mote: "#f4fbff", cloud: 0.26, birds: 6 },
  // 4 Rivermead: meadowsweet, forget-me-nots, kingcups.
  { flowers: ["#fffbea", "#8fb8ff", "#ffd23f", "#fff8ec"], flowerRate: 0.3, blossom: "#fff6f0", mote: "#fffbe8", cloud: 0.24, birds: 4 },
  // 5 Oakvale: bluebells and wood anemones.
  { flowers: ["#7f8cf0", "#9aa4ff", "#fff8ec"], flowerRate: 0.3, blossom: "#f3e9f0", mote: "#ffeebb", cloud: 0.3, birds: 3 },
  // 6 Shingle Bay: sea campion and yellow horned poppy.
  { flowers: ["#fff8ec", "#ffe04a"], flowerRate: 0.16, blossom: "#f6f0e6", mote: "#f8fbff", cloud: 0.34, birds: 6 },
  // 7 The Rift: dusk; seed heads catch the low sun.
  { flowers: ["#ff9a4a", "#ffd07a", "#e0603a"], flowerRate: 0.14, blossom: "#f0c8a8", mote: "#ffc890", cloud: 0.22, birds: 4 },
  // 8 The Ballot: poppies and cornflowers on polling day.
  { flowers: ["#e8433a", "#6f8ff0", "#fff8ec"], flowerRate: 0.26, blossom: "#f3e9f0", mote: "#fff4dc", cloud: 0.28, birds: 5 },
  // 9 The Merger: a grey, thinning verge.
  { flowers: ["#d8d4c8", "#c8c070"], flowerRate: 0.08, blossom: "#d8d8d8", mote: "#dfe6ee", cloud: 0.14, birds: 2 },
  // 10 Kingsmarket: night (fireflies take over from the pollen).
  { flowers: ["#d8d0ff", "#fff0c8"], flowerRate: 0.12, blossom: "#cfc8e8", mote: "#d8ff8a", cloud: 0, birds: 0 },
];

export function actMood(levelId: number): ActMood {
  return ACT_MOOD[Math.min(ACT_MOOD.length - 1, Math.floor((levelId - 1) / 10))]!;
}

let shoreTex: THREE.Texture | null = null;
/** Plan item 269: an alpha ramp for the pond shallows, solid at the shore (the canvas top) and clear by the far side. */
export function shoreFade(): THREE.Texture {
  if (shoreTex) return shoreTex;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#c8c8c8");
  grad.addColorStop(0.18, "#9a9a9a");
  grad.addColorStop(0.5, "#3a3a3a");
  grad.addColorStop(1, "#000");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  shoreTex = new THREE.CanvasTexture(c);
  return shoreTex;
}

let foamTex: THREE.Texture | null = null;
/**
 * Plan item 330: the shallows' colour, with a broken foam line along the bank (the canvas top, as in `shoreFade`): white
 * scalloped froth over the first eighth, then the green-blue shallows. Paired with `shoreFade` as the alpha, it costs no
 * draw call over the plain shallows. The strip is one cell wide and tiles cell to cell, so the froth repeats seamlessly.
 */
export function shoreFoam(): THREE.Texture {
  if (foamTex) return foamTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#9fcbc0";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#cfe6dd";
  g.fillRect(0, 0, 128, 11);
  g.fillStyle = "#f4f8f2";
  g.fillRect(0, 0, 128, 3);
  // Scallops of froth, in whole periods across the width so the strip tiles.
  for (let x = 0; x < 128; x += 2) {
    const h = 4 + 2.5 * Math.sin((x / 128) * Math.PI * 2 * 5) + 1.5 * Math.sin((x / 128) * Math.PI * 2 * 11 + 1.3);
    g.fillRect(x, 0, 2, Math.max(2, h));
  }
  // A few loose bubbles just off the line.
  g.fillStyle = "rgba(244, 248, 242, 0.85)";
  for (const [x, y, r] of [[9, 9, 1.4], [30, 11, 1.1], [47, 8, 1.6], [70, 10, 1.2], [88, 9, 1.5], [109, 12, 1.1], [121, 8, 1.3]] as const) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  foamTex = new THREE.CanvasTexture(c);
  foamTex.colorSpace = THREE.SRGBColorSpace;
  return foamTex;
}

