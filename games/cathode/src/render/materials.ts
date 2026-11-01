// Every static material in the Drowned Market, keyed by the names level.ts builds with. PBR sets come
// from Poly Haven (CC0); paints and plastics are plain PBR; emissives are HDR (values above 1 bloom).

import * as THREE from "three";
import { patchMaterial, type SharedUniforms } from "./shading";
import type { PbrId, PbrSet } from "./textures";
import { tarpTexture } from "./textures";
import { clinicTextures } from "./clinictex";
import { plazaTextures } from "./plazatex";
import { towerTextures } from "./towertex";

export type Materials = Record<string, THREE.Material>;

export function createMaterials(pbr: Record<PbrId, PbrSet>, s: SharedUniforms, quality: "phone" | "high" | "ultra", district?: string): Materials {
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
  // Hollowell Plaza (plan item 4): granite setts painted at load (plazatex.ts) instead of poured concrete.
  if (district === "plaza") {
    const p = plazaTextures(quality).plazaSetts;
    const mat = new THREE.MeshStandardMaterial({ map: p.map, normalMap: p.normalMap, normalScale: new THREE.Vector2(0.75, 0.75), aoMap: p.arm, aoMapIntensity: 1, roughnessMap: p.arm, roughness: 1, metalness: 0, color: new THREE.Color("#c8c6c2") });
    m.pavement = patchMaterial(mat, s, { kind: "ground", puddleBias: 0.0 });
  }
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
  // The Candor Clinic (plan item 1): glazed white tile over a green dado band, speckled vinyl floor tiles and
  // a suspended acoustic ceiling, painted on canvas at load (clinictex.ts) and only for the clinic.
  if (district === "clinic") {
    const ct = clinicTextures(quality);
    const cset = (p: PbrSet, color: string, normal: number) =>
      new THREE.MeshStandardMaterial({ map: p.map, normalMap: p.normalMap, normalScale: new THREE.Vector2(normal, normal), aoMap: p.arm, aoMapIntensity: 1, roughnessMap: p.arm, roughness: 1, metalness: 0, color: new THREE.Color(color) });
    m.tileWhite = wall(cset(ct.clinicWall, "#e8f0ea", 0.8), 1, 0.4);
    m.tileGreen = wall(cset(ct.clinicDado, "#ffffff", 0.8), 1, 0.4);
    m.clinicFloor = patchMaterial(cset(ct.clinicFloor, "#ffffff", 0.6), s, { kind: "ground", puddleBias: -0.06 });
    m.ceilingPanel = wall(cset(ct.clinicCeiling, "#e6ece6", 0.7), 1, 0.1);
    const st = cset(ct.clinicSteel, "#d8dcdc", 0.3);
    st.metalness = 0.9;
    m.steel = prop(st, 0.5, 0);
    const sd = cset(ct.clinicSteel, "#5a6062", 0.3);
    sd.metalness = 0.85;
    m.steelDark = prop(sd, 0.6, 0);
  } else {
    m.tileWhite = wall(set("concrete_slab_wall", { color: "#e4f0ea", normal: 0.5 }), 1, 0.5);
    m.tileGreen = wall(set("dirty_tiles", { color: "#5f9a86", normal: 0.5 }), 1, 0.5);
    m.ceilingPanel = wall(set("concrete_slab_wall", { color: "#c4c8c4", normal: 0.3 }), 1, 0.2);
    m.clinicFloor = m.tileWhite;
  }
  // The Board Tower (plan item 4): polished marble floors, walls and columns, a slat ceiling and office carpet,
  // painted at load (towertex.ts) and only for the tower.
  if (district === "tower") {
    const tt = towerTextures(quality);
    const tset = (p: PbrSet, color: string, normal: number) =>
      new THREE.MeshStandardMaterial({ map: p.map, normalMap: p.normalMap, normalScale: new THREE.Vector2(normal, normal), aoMap: p.arm, aoMapIntensity: 1, roughnessMap: p.arm, roughness: 1, metalness: 0, color: new THREE.Color(color) });
    m.tiles = wall(tset(tt.towerMarble, "#ffffff", 0.4), 1, 0);
    m.concreteA = wall(tset(tt.towerMarbleWall, "#f4efe6", 0.4), 1, 0);
    const ceil = tset(tt.towerCeiling, "#ffffff", 0.8);
    ceil.metalness = 0.6;
    m.concreteB = wall(ceil, 1, 0);
    m.officeCarpet = prop(tset(tt.towerCarpet, "#ffffff", 0.6), 1, 0);
  }
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
  m.steel ??= m.chrome;
  m.steelDark ??= m.darkMetal!;
  m.brass = plain("#b08a3a", 0.25, 0.95, 0.2);
  m.carpetRed = plain("#8a1424", 0.9, 0, 0.3);
  // Indoors the tower's carpets stay dry: no rain sheen streaking down them.
  if (district === "tower") m.carpetRed = prop(new THREE.MeshStandardMaterial({ color: "#4a0a14", roughness: 0.95, metalness: 0 }), 1, 0);
  m.officeCarpet ??= m.carpetRed;
  m.leaf = plain("#1f4a2a", 0.7, 0, 0.4);
  m.rubber = plain("#0b0b0c", 0.7, 0, 0.4);
  m.cable = plain("#050506", 0.55, 0.1, 0.3, 0.6);
  m.bag = plain("#060708", 0.22, 0.1, 0.4);
  m.ice = plain("#6f8890", 0.25, 0, 0.2);
  m.fish = plain("#8e9aa0", 0.22, 0.75, 0.2);
  m.styro = plain("#7a7a74", 0.85, 0, 0.5);
  m.yellowPaint = plain("#a07a08", 0.45, 0.1);
  m.plasticRed = plain("#7a0c0c", 0.35, 0);
  m.plasticWhite = plain("#7a7a74", 0.35, 0);
  m.plasticSeat = plain("#1d6a6a", 0.3, 0);
  // Car paints: low roughness and some metal so the neon slides over them.
  m.carRed = plain("#4a0609", 0.22, 0.65, 0.3);
  m.carTeal = plain("#0b3236", 0.22, 0.65, 0.3);
  m.carWhite = plain("#70706c", 0.25, 0.4, 0.3);
  m.carBlack = plain("#060607", 0.18, 0.7, 0.3);
  m.vanWhite = plain("#6c6c68", 0.25, 0.3, 0.3);
  m.carGlass = plain("#030405", 0.04, 0.0, 0.1, 0.3);
  m.glass = plain("#06080b", 0.05, 0.0, 0.1, 0.4);
  // See-through wired glass for the clinic's partitions and theatre gallery (plan item 1): a pale green tint.
  const clear = new THREE.MeshStandardMaterial({ color: "#a8d8c8", roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
  m.clearGlass = prop(clear, 0.4, 0.1);
  const tarp = new THREE.MeshStandardMaterial({ map: tarpTexture(), roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  m.tarp = prop(tarp, 1.2, 0.8);

  // Emissives (HDR, unlit, fogged).
  const glow = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  m.glowWarm = glow("#ffc890", 5);
  m.glowSodium = glow("#ff9a40", 9);
  m.glowCool = glow("#d8f0ff", 4);
  m.glowCoolDim = glow("#cfe6ff", 1.6);
  // The clinic's failing tubes: the same tube, its own material so the world can stutter it with its light.
  m.glowFail = glow("#d8f0ff", 4);
  m.glowRed = glow("#ff1a10", 5);
  m.glowAmber = glow("#ffa020", 6);
  m.glowPink = glow("#ff3a9a", 6);
  m.glowCyan = glow("#3ae8ff", 5);
  m.glowViolet = glow("#a85cff", 5);
  m.glowWhite = glow("#f0f6ff", 6);
  void quality;
  return m;
}
