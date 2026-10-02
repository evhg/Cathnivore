// Materials and per-act lighting for Hedgerow's 3D battlefield. The farms are warm and hand-made (wood,
// straw, thatch, painted boards); the corporations are cold, glossy and over-lit (chrome, glass, emissive
// logos) — the same contrast as the 2D art (VISION "Art direction"), now with real light.

import * as THREE from "three";

const cache = new Map<string, THREE.Material>();

function key(o: object): string {
  return JSON.stringify(o);
}

/** A matte, hand-made surface (wood, straw, paint, leaves). Flat-shaded so the low-poly facets read. */
export function matte(color: string, rough = 0.85, flat = true): THREE.MeshStandardMaterial {
  const k = key({ m: "matte", color, rough, flat });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: flat });
    cache.set(k, m);
  }
  return m;
}

/** Corporate gloss: painted metal with a clear coat. */
export function gloss(color: string, metal = 0.35): THREE.MeshPhysicalMaterial {
  const k = key({ m: "gloss", color, metal });
  let m = cache.get(k) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: metal, clearcoat: 1, clearcoatRoughness: 0.15 });
    cache.set(k, m);
  }
  return m;
}

export function chrome(color = "#dfe6ee"): THREE.MeshStandardMaterial {
  const k = key({ m: "chrome", color });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.95 });
    cache.set(k, m);
  }
  return m;
}

export function metal(color = "#9aa0a6", rough = 0.4): THREE.MeshStandardMaterial {
  const k = key({ m: "metal", color, rough });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.75 });
    cache.set(k, m);
  }
  return m;
}

/** Light that glows (and blooms): lamps, logos, eyes, magic. */
export function glow(color: string, intensity = 2): THREE.MeshStandardMaterial {
  const k = key({ m: "glow", color, intensity });
  let m = cache.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
    cache.set(k, m);
  }
  return m;
}

export function glass(color = "#1c2a36"): THREE.MeshPhysicalMaterial {
  const k = key({ m: "glass", color });
  let m = cache.get(k) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, metalness: 0.2, clearcoat: 1 });
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
  { skyTop: "#7aa2cc", skyBottom: "#f2e2c4", fog: "#e4d8c0", fogNear: 15, fogFar: 42, sun: "#fff0d8", sunIntensity: 2.4, sunAz: 210, sunEl: 32, hemiSky: "#d8e4f2", hemiGround: "#4a5a36", hemiIntensity: 0.9, grass: ["#7fa85a", "#6c954a", "#8fb86a"], dirt: ["#b39d77", "#8d7051"], exposure: 1.0 },
  // 9 The Merger: overcast, cold glass light.
  { skyTop: "#5a6676", skyBottom: "#c4ccd4", fog: "#aab4be", fogNear: 12, fogFar: 34, sun: "#e8f0ff", sunIntensity: 1.8, sunAz: 190, sunEl: 50, hemiSky: "#c8d4e2", hemiGround: "#3a4440", hemiIntensity: 1.1, grass: ["#6f8a62", "#5e7854", "#7f9a72"], dirt: ["#978d7b", "#6f675c"], exposure: 0.95 },
  // 10 Kingsmarket: night, lanterns and fire.
  { skyTop: "#141a33", skyBottom: "#5a2e3a", fog: "#2a1e2e", fogNear: 10, fogFar: 30, sun: "#ffb070", sunIntensity: 1.6, sunAz: 300, sunEl: 22, hemiSky: "#3a3a6a", hemiGround: "#1e1414", hemiIntensity: 0.75, grass: ["#4f6a3a", "#425a32", "#5a7642"], dirt: ["#7a5a3a", "#5a4028"], exposure: 1.15 },
];

export function actLight(levelId: number): ActLight {
  return ACT_LIGHT[Math.min(ACT_LIGHT.length - 1, Math.floor((levelId - 1) / 10))]!;
}
