// Every static material in the Drowned Market, keyed by the names level.ts builds with. PBR sets come
// from Poly Haven (CC0); paints and plastics are plain PBR; emissives are HDR (values above 1 bloom).

import * as THREE from "three";
import { patchMaterial, type SharedUniforms } from "./shading";
import type { PbrId, PbrSet } from "./textures";
import { tarpTexture } from "./textures";

export type Materials = Record<string, THREE.Material>;

export function createMaterials(pbr: Record<PbrId, PbrSet>, s: SharedUniforms, quality: "phone" | "high" | "ultra"): Materials {
  const m: Materials = {};
  const set = (id: PbrId, o: { color?: string; normal?: number; rough?: number; metal?: number } = {}) => {
    const p = pbr[id];
    return new THREE.MeshStandardMaterial({
      map: p.map,
      normalMap: p.normalMap,
      normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
      aoMap: p.arm,
      aoMapIntensity: 0.9,
      roughnessMap: p.arm,
      metalnessMap: o.metal !== undefined ? p.arm : null,
      roughness: o.rough ?? 1,
      metalness: o.metal ?? 0,
      color: new THREE.Color(o.color ?? "#ffffff"),
    });
  };
  const wall = (mat: THREE.MeshStandardMaterial, volume = 1, wet = 0.8) => patchMaterial(mat, s, { kind: "wall", volume, wet });
  const prop = (mat: THREE.MeshStandardMaterial, volume = 1, wet = 0.6) => patchMaterial(mat, s, { kind: "prop", volume, wet });

  // The ground: asphalt with road paint, pavements with fewer puddles.
  m.asphalt = patchMaterial(set("asphalt_02", { color: "#8a8a8a", normal: 0.9 }), s, { kind: "ground", roadLines: true, puddleBias: 0.02 });
  m.pavement = patchMaterial(set("concrete_pavement", { color: "#9a958e", normal: 0.8 }), s, { kind: "ground", puddleBias: -0.04 });
  const water = new THREE.MeshStandardMaterial({ color: "#0a1210", roughness: 0.02, metalness: 0, transparent: true, depthWrite: false });
  m.water = patchMaterial(water, s, { kind: "water", volume: 0.5 });

  // Walls.
  m.concreteA = wall(set("concrete_wall_006", { color: "#8f8b86" }));
  m.concreteB = wall(set("concrete_slab_wall", { color: "#7f7d7a" }));
  m.brickDark = wall(set("dark_brick_wall", { color: "#9a8f88" }));
  m.brickRed = wall(set("brick_wall_02", { color: "#8a7468" }));
  m.plasterGreen = wall(set("plastered_wall_04", { color: "#6f8a80" }));
  m.plasterPink = wall(set("plastered_wall_04", { color: "#9a7a80" }));
  m.tiles = wall(set("dirty_tiles", { color: "#a0a4a0" }));
  m.corrugatedWall = wall(set("corrugated_iron_02", { color: "#6a7070", metal: 1 }), 1, 0.9);
  m.jersey = wall(set("concrete_slab_wall", { color: "#a09c94" }), 1, 0.9);

  // Metals and props.
  m.rust = prop(set("rusty_metal_02", { color: "#9a8070", metal: 1 }));
  m.shutter = wall(set("rusty_metal_shutter", { color: "#8a8a88", metal: 1 }));
  m.grate = prop(set("metal_grate_rusty", { color: "#7a7a78", metal: 1 }));
  m.wood = prop(set("wood_planks_grey", { color: "#8a7a68" }));
  m.acUnit = prop(set("corrugated_iron_02", { color: "#b0b4b0", metal: 1 }));
  const plain = (color: string, rough: number, metal: number, wet = 0.6, volume = 1) =>
    prop(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), volume, wet);
  m.darkMetal = plain("#1a1c20", 0.42, 0.85);
  m.blackPaint = plain("#0c0d10", 0.5, 0.2);
  m.paintMetal = plain("#2a3438", 0.38, 0.6);
  m.paintRed = plain("#6a0f12", 0.35, 0.3);
  m.paintTeal = plain("#0f3a3a", 0.4, 0.2);
  m.pipe = plain("#2b2a28", 0.5, 0.8);
  m.chrome = plain("#c8ccd0", 0.12, 1.0, 0.2);
  m.rubber = plain("#0b0b0c", 0.7, 0, 0.4);
  m.cable = plain("#050506", 0.55, 0.1, 0.3, 0.6);
  m.bag = plain("#060708", 0.22, 0.1, 0.4);
  m.ice = plain("#b9d4dc", 0.25, 0, 0.2);
  m.fish = plain("#8e9aa0", 0.22, 0.75, 0.2);
  m.styro = plain("#c8c8c0", 0.85, 0, 0.5);
  m.yellowPaint = plain("#a07a08", 0.45, 0.1);
  m.plasticRed = plain("#7a0c0c", 0.35, 0);
  m.plasticWhite = plain("#b8b8b0", 0.35, 0);
  // Car paints: low roughness and some metal so the neon slides over them.
  m.carRed = plain("#4a0609", 0.22, 0.65, 0.3);
  m.carTeal = plain("#0b3236", 0.22, 0.65, 0.3);
  m.carWhite = plain("#a8a8a4", 0.25, 0.4, 0.3);
  m.carBlack = plain("#060607", 0.18, 0.7, 0.3);
  m.vanWhite = plain("#b4b4ae", 0.3, 0.3, 0.3);
  m.carGlass = plain("#030405", 0.04, 0.0, 0.1, 0.3);
  m.glass = plain("#06080b", 0.05, 0.0, 0.1, 0.4);
  const tarp = new THREE.MeshStandardMaterial({ map: tarpTexture(), roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  m.tarp = prop(tarp, 1.2, 0.8);

  // Emissives (HDR, unlit, fogged).
  const glow = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  m.glowWarm = glow("#ffc890", 7);
  m.glowSodium = glow("#ff9a40", 9);
  m.glowCool = glow("#d8f0ff", 7);
  m.glowCoolDim = glow("#cfe6ff", 1.6);
  m.glowRed = glow("#ff1a10", 5);
  m.glowAmber = glow("#ffa020", 6);
  m.glowPink = glow("#ff3a9a", 6);
  m.glowWhite = glow("#f0f6ff", 14);
  void quality;
  return m;
}
