// C10 "Enforcer v2" (S3.2): the Hollowell Enforcer and its variants, assembled from the parts library on the
// weapon kit's surfaces, as two skinned geometries per archetype and LOD (the PBR layer and the self-lit layer),
// shared by every body of that archetype. Each piece is rigidly skinned to one bone: a segment, the helmet or a
// finger set (rig.ts's bone order), so a whole body draws in two calls and the ragdoll, severing and the helmet pop
// still move each piece on its own.
//
// A corporate riot cop, square and heavy up top, 1.86 m to the crest: a flared full-face helmet with a heavy brow
// and a horizontal amber slit (the crit target), a 2 cm light strip at the back of the helmet so the head reads
// from behind, a chest plate with a centre ridge over a chest rig of three mag pouches, a back plate carrying the
// coolant pack (the weak point, its window pulsing) and a unit number, stacked pauldrons standing well proud of the
// shoulder with the "H in a tower" on the left one, a radio whip with a blinking red tip, thigh plates, knee cops,
// shin guards, a holstered sidearm on the right thigh, gauntlets, and boots with a proper sole. The split tabard is
// cloth (game/cloth.ts) at LOD0 and a static panel at LOD1.

import * as THREE from "three";
import { bake, placeMatrix, type Finish, type Emit, type Surface, type P2, type Place } from "../gunkit";
import { BANDS } from "../../render/guntex";
import { REST, SEGMENTS, boneIndex, HELM_Y, KNUCKLE_Y } from "../rig";
import { box, chamfer, cyl, limb, plate, shell, body as lathe, tris, type PlateOpts } from "./parts";

export type Arch = "enforcer" | "leader" | "riot" | "sniper";
export type Lod = 0 | 1 | 2;

/** S3.1's materials as kit finishes (sRGB base colours; the kit's shader adds edge wear and the trim atlas). */
export const FINISH = {
  plate: { color: 0x2e333c, metal: 0.2, rough: 0.36, coat: 0.7, band: "peel", wear: 1 },
  plateDark: { color: 0x1d2026, metal: 0.25, rough: 0.5, coat: 0.3, band: "peel", wear: 0.8 },
  suit: { color: 0x121418, metal: 0, rough: 0.86, sheen: 0.12, band: "nylon", wear: 0 },
  web: { color: 0x23262c, metal: 0, rough: 0.8, sheen: 0.3, band: "nylon", wear: 0.35 },
  knit: { color: 0x111214, metal: 0, rough: 0.95, sheen: 0.2, band: "nylon", wear: 0 },
  leather: { color: 0x101012, metal: 0, rough: 0.5, sheen: 0.3, coat: 0.2, band: "leather", scale: 2, wear: 0.4 },
  rubber: { color: 0x0b0b0c, metal: 0, rough: 0.82, band: "stipple", wear: 0.2 },
  metal: { color: 0x3a3d43, metal: 1, rough: 0.36, coat: 0.2, band: "brushed", wear: 0.8 },
  paint: { color: 0xb9b5aa, metal: 0, rough: 0.55, band: "flat", wear: 0 },
  glass: { color: 0x05080a, metal: 0.2, rough: 0.07, coat: 1, band: "flat", wear: 0 },
  coat: { color: 0x1c1f26, metal: 0, rough: 0.7, sheen: 0.6, band: "nylon", wear: 0 },
  under: { color: 0x3b3530, metal: 0, rough: 0.9, band: "nylon", wear: 0 },
} satisfies Record<string, Finish>;

/** Self-lit parts: `visor` takes the body's visor tint and level; `blink` the antenna's 1 Hz blink; `pulse` the coolant window. */
interface Glow {
  surf: Emit;
  visor?: boolean;
  blink?: boolean;
  pulse?: boolean;
}
const GLOWS = {
  slit: { surf: { emit: 0xffffff, intensity: 4.2 }, visor: true },
  strip: { surf: { emit: 0xffffff, intensity: 3.2 }, visor: true },
  status: { surf: { emit: 0xffffff, intensity: 2.4 }, visor: true },
  tip: { surf: { emit: 0xff2018, intensity: 7 }, blink: true },
  coolant: { surf: { emit: 0xffa040, intensity: 5 }, pulse: true },
  stripe: { surf: { emit: 0xff2420, intensity: 5 } },
  /** Retro-reflective tape (pillar 4: overstate what matters): pale bands that make him read from behind in the rain. */
  tape: { surf: { emit: 0xe9e1cf, intensity: 4 } },
  /** The unit number, backlit in the visor's colour on the back plate. */
  unit: { surf: { emit: 0xffffff, intensity: 3.6 }, visor: true },
  lens: { surf: { emit: 0xffffff, intensity: 5 }, visor: true },
} satisfies Record<string, Glow>;

const segLen = (name: string): number => {
  const s = SEGMENTS.find((d) => d.name === name)!;
  return REST[s.from].distanceTo(REST[s.to]);
};
/** Where on the segment the flash lights a piece: its segment's slot (the helmet and the fingers flash with their segment). */
const SLOT_OF: Record<string, number> = (() => {
  const o: Record<string, number> = {};
  SEGMENTS.forEach((s, i) => (o[s.name] = i + 1));
  o.helmet = o.head!;
  o.fingersL = o.handL!;
  o.fingersR = o.handR!;
  return o;
})();

interface Opts {
  lod: Lod;
  phone: boolean;
}

/** Collects pieces per layer with their bone, slot and LOD, then merges each layer into one geometry. */
class Builder {
  readonly opaque: THREE.BufferGeometry[] = [];
  readonly glow: THREE.BufferGeometry[] = [];
  constructor(readonly o: Opts) {}
  /** Detail: 0 desktop LOD0, 1 phone LOD0, 2 desktop LOD1, 3 phone LOD1, 4 LOD2. */
  get det(): number {
    return this.o.lod === 2 ? 4 : this.o.lod * 2 + (this.o.phone ? 1 : 0);
  }
  /** Lathe and shell segments round for this profile and LOD. */
  seg(n: number): number {
    const k = [1, 0.52, 0.5, 0.3, 0.3][this.det]!;
    return Math.max(4, Math.round(n * k));
  }
  /** A plate at this detail: bevels go to one segment on the phone and away at a distance. */
  plate(pts: P2[], o: PlateOpts): THREE.BufferGeometry {
    const d = this.det;
    return plate(pts, { ...o, bevel: d >= 2 ? 0 : o.bevel, bevelSeg: d === 1 ? 1 : 2 });
  }
  /** A chamfered box up close on desktop; a plain box on the phone and at a distance. */
  box(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
    return box(w, h, d, this.det >= 1 ? 0 : r, this.det >= 1 ? 0 : seg);
  }
  add(bone: string, geo: THREE.BufferGeometry, surf: Surface | Glow, pl?: Place | THREE.Matrix4): void {
    if (TRI_LOG) TRI_LOG.push([bone, tris(geo), new Error().stack?.split("\n")[2]?.trim() ?? ""]);
    const m = pl instanceof THREE.Matrix4 ? pl : placeMatrix(pl);
    const glow = typeof surf === "object" && "surf" in surf ? (surf as Glow) : null;
    const g = bake(geo, glow ? glow.surf : (surf as Surface), m);
    const n = g.getAttribute("position").count;
    const bi = boneIndex(bone);
    if (bi < 0) throw new Error(`no bone ${bone}`);
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
    }
    g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    g.setAttribute("aSeg", new THREE.BufferAttribute(new Float32Array(n).fill(SLOT_OF[bone] ?? 0), 1));
    g.setAttribute("aLod", new THREE.BufferAttribute(new Float32Array(n).fill(this.o.lod), 1));
    g.setAttribute("aRimN", new THREE.BufferAttribute(rimNormals(g, bone), 3));
    if (glow) {
      const mr = g.getAttribute("aMR") as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) mr.setXYZW(i, 0, glow.visor ? 1 : 0, glow.blink ? 1 : 0, glow.pulse ? 1 : 0);
      this.glow.push(g);
    } else this.opaque.push(g);
  }
  finish(): { opaque: THREE.BufferGeometry; glow: THREE.BufferGeometry } {
    const m = (list: THREE.BufferGeometry[]) => {
      if (!list.length) {
        const e = new THREE.BufferGeometry();
        for (const [k, s] of [["position", 3], ["normal", 3], ["color", 3], ["aMR", 4], ["aEdge", 1], ["aBand", 2], ["aUvT", 2], ["skinIndex", 4], ["skinWeight", 4], ["aSeg", 1], ["aLod", 1], ["aRimN", 3]] as const)
          e.setAttribute(k, new THREE.BufferAttribute(k === "skinIndex" ? new Uint16Array(0) : new Float32Array(0), s));
        return e;
      }
      return mergeAll(list);
    };
    return { opaque: m(this.opaque), glow: m(this.glow) };
  }
}

/** Tests and tuning: when set, every piece added logs its bone, triangles and call site. */
export let TRI_LOG: Array<[string, number, string]> | null = null;
export function logTris(on: boolean): void {
  TRI_LOG = on ? [] : null;
}

const TORSO_SEGS = new Set(["abdomen", "chest", "upperChest"]);
/**
 * The rim light's normal per vertex (S3.1): the body's smooth shape, not the piece's. Round the bone for a limb, the
 * torso's ellipse (wider than deep) for the trunk, from the helmet's centre for the helmet.
 */
function rimNormals(g: THREE.BufferGeometry, bone: string): Float32Array {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const out = new Float32Array(pos.count * 3);
  const len = bone === "helmet" || bone.startsWith("fingers") ? 0 : segLen(bone);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (bone === "helmet") v.set(x, y * 0.7, z / 1.12);
    else if (TORSO_SEGS.has(bone)) v.set(x / 0.04, 0, z / 0.018);
    else v.set(x, y - Math.max(0, Math.min(len, y)), z);
    if (v.lengthSq() < 1e-10) v.set(0, 0, 1);
    v.normalize();
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

/** Merges baked pieces (all non-indexed, same attributes). */
function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const names = Object.keys(list[0]!.attributes);
  for (const name of names) {
    const a0 = list[0]!.getAttribute(name) as THREE.BufferAttribute;
    const total = list.reduce((s, g) => s + g.getAttribute(name).count, 0);
    const Arr = a0.array.constructor as Float32ArrayConstructor | Uint16ArrayConstructor;
    const arr = new Arr(total * a0.itemSize);
    let o = 0;
    for (const g of list) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      arr.set(a.array as ArrayLike<number>, o);
      o += a.array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized));
  }
  out.computeBoundingSphere();
  return out;
}

const rect = (w: number, y0: number, y1: number, topW = w): P2[] => [
  [-w / 2, y0],
  [w / 2, y0],
  [topW / 2, y1],
  [-topW / 2, y1],
];
const D = Math.PI / 180;

/** Thin pale-paint strips on a plate face (the emblem, the unit number), in the face's XY plane, proud along +Z. */
function strips(b: Builder, bone: string, list: Array<[number, number, number, number, number]>, m: THREE.Matrix4, surf: Surface | Glow = FINISH.paint): void {
  for (const [x, y, len, th, rot] of list) {
    const pm = new THREE.Matrix4().compose(new THREE.Vector3(x, y, 0.0015), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rot)), new THREE.Vector3(1, 1, 1));
    b.add(bone, b.box(th, len, 0.003, 0, 0), surf, new THREE.Matrix4().multiplyMatrices(m, pm));
  }
}

/** The Hollowell mark: a tower (two walls, a pitched roof, a sill) with an H inside it, `s` metres tall. */
function emblem(s: number): Array<[number, number, number, number, number]> {
  const t = s * 0.085;
  const w = s * 0.62;
  return [
    [-w / 2, -s * 0.12, s * 0.72, t, 0],
    [w / 2, -s * 0.12, s * 0.72, t, 0],
    [0, -s * 0.48, w + t, t, Math.PI / 2],
    [-w / 4, s * 0.32, w * 0.62, t, -Math.atan2(w / 2, s * 0.26) + Math.PI / 2],
    [w / 4, s * 0.32, w * 0.62, t, Math.atan2(w / 2, s * 0.26) - Math.PI / 2],
    [-w * 0.2, -s * 0.12, s * 0.42, t, 0],
    [w * 0.2, -s * 0.12, s * 0.42, t, 0],
    [0, -s * 0.12, w * 0.4, t, Math.PI / 2],
  ];
}

/** Seven-segment digits for the unit number (`h` metres tall), centred on the origin. */
function digits(text: string, h: number): Array<[number, number, number, number, number]> {
  const SEGS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" };
  const w = h * 0.55;
  const t = h * 0.12;
  const out: Array<[number, number, number, number, number]> = [];
  const adv = w + h * 0.3;
  text.split("").forEach((ch, i) => {
    const x0 = (i - (text.length - 1) / 2) * adv;
    for (const sg of SEGS[ch] ?? "") {
      const [x, y, len, rot] =
        sg === "a" ? [0, h / 2, w, Math.PI / 2] : sg === "g" ? [0, 0, w, Math.PI / 2] : sg === "d" ? [0, -h / 2, w, Math.PI / 2] : sg === "b" ? [w / 2, h / 4, h / 2, 0] : sg === "c" ? [w / 2, -h / 4, h / 2, 0] : sg === "e" ? [-w / 2, -h / 4, h / 2, 0] : [-w / 2, h / 4, h / 2, 0];
      out.push([x0 + x, y, len + t * 0.6, t, rot]);
    }
  });
  return out;
}

/** A matrix that puts a piece built facing +Z onto the surface point at `phi` round Y (radius `r`, height `y`). */
function onRing(r: number, y: number, phi: number, sx = 1, extra?: THREE.Quaternion): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), phi);
  if (extra) q.multiply(extra);
  return new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(phi) * r * sx, y, Math.cos(phi) * r), q, new THREE.Vector3(1, 1, 1));
}

function torso(b: Builder, arch: Arch): void {
  const { lod } = b.o;
  const S = FINISH;
  const aL = segLen("abdomen");
  const cL = segLen("chest");
  const uL = segLen("upperChest");
  const sniper = arch === "sniper";
  // ---- abdomen: the soft core, the belt with its buckle and pouches, two stacked ab lames, the codpiece.
  b.add("abdomen", lathe([[0.0, -0.1], [0.12, -0.095], [0.152, -0.04], [0.15, 0.06], [0.156, 0.16], [0.172, aL + 0.02]], 1.05, 0.72, b.seg(18)), S.suit);
  if (lod < 2) {
    b.add("abdomen", shell([[0.166, -0.005], [0.18, -0.005], [0.18, 0.05], [0.166, 0.05]], 0, Math.PI * 2, b.seg(22)), S.web, { s: [1.03, 1, 0.75] });
    b.add("abdomen", b.box(0.064, 0.046, 0.02, 0.006), S.metal, { p: [0, 0.022, 0.138] });
  }
  if (!sniper) {
    for (const [y, w] of [[0.07, 0.22], [0.13, 0.24]] as const)
      b.add("abdomen", b.plate(chamfer(rect(w, -0.028, 0.028), 0.012), { depth: 0.008, bevel: 0.004, bend: 0.16 }), S.plate, { p: [0, y, 0.106] });
    b.add("abdomen", b.plate(chamfer(rect(0.12, -0.11, -0.005, 0.17), 0.02), { depth: 0.01, bevel: 0.004, bend: 0.14 }), S.plateDark, { p: [0, 0, 0.112] });
  }
  if (lod === 0) {
    for (const s of [1, -1]) b.add("abdomen", b.box(0.06, 0.07, 0.045, 0.01), S.web, { p: [0.145 * s, 0.01, 0.075], r: [0, 0.55 * s, 0] });
    b.add("abdomen", b.box(0.12, 0.07, 0.05, 0.012), S.web, { p: [0, 0.02, -0.13] });
  }
  // ---- chest (lower): core, the lower front plate with its ridge, the chest rig, the lower back plate and the
  // coolant pack.
  b.add("chest", lathe([[0.168, -0.02], [0.188, 0.07], [0.2, cL + 0.01]], 1.06, 0.66, b.seg(18)), S.suit);
  if (!sniper) {
    b.add("chest", b.plate(chamfer(rect(0.37, -0.005, 0.17, 0.4), 0.022), { depth: 0.012, bevel: 0.006, bend: 0.24 }), S.plate, { p: [0, 0, 0.124] });
    if (lod < 2) b.add("chest", b.plate(chamfer(rect(0.024, 0.005, 0.17), 0.007), { depth: 0.006, bevel: 0.004 }), S.plate, { p: [0, 0, 0.146] });
    b.add("chest", b.plate(chamfer(rect(0.34, 0.0, 0.17, 0.37), 0.02), { depth: 0.012, bevel: 0.006, bend: 0.24 }), S.plate, { p: [0, 0, -0.124], r: [0, Math.PI, 0] });
  } else {
    // The sniper's long coat closes over a lighter vest: a plain carrier, no ridge.
    b.add("chest", b.plate(chamfer(rect(0.33, 0.0, 0.16, 0.35), 0.03), { depth: 0.01, bevel: 0.004, bend: 0.22 }), S.plateDark, { p: [0, 0, 0.122] });
  }
  if (lod === 0 && !sniper) {
    for (const x of [-0.088, 0, 0.088]) {
      b.add("chest", b.box(0.074, 0.11, 0.042, 0.01), S.web, { p: [x, 0.055, 0.178] });
      b.add("chest", b.box(0.079, 0.03, 0.05, 0.008), S.web, { p: [x, 0.112, 0.18] });
      b.add("chest", b.box(0.06, 0.02, 0.026, 0.004), S.metal, { p: [x, 0.13, 0.178] });
    }
  }
  if (!sniper) {
    // The coolant pack (S3.2's weak point): a can on a cradle over the lower back, its window lit.
    b.add("chest", b.box(0.13, 0.2, 0.035, 0.01), S.plateDark, { p: [0, 0.07, -0.155] });
    b.add("chest", cyl(0.048, 0.048, 0.18, b.seg(16)), S.metal, { p: [0, 0.07, -0.205] });
    if (lod < 2) for (const y of [-0.015, 0.155]) b.add("chest", cyl(0.054, 0.054, 0.018, b.seg(16)), S.plateDark, { p: [0, y, -0.205] });
    b.add("chest", b.box(0.032, 0.13, 0.01, 0.003), GLOWS.coolant, { p: [0, 0.07, -0.251] });
  }
  // ---- upper chest: core, the upper front plate curving over the top, the gorget, the upper back plate with the
  // unit number, the radio and its whip.
  b.add("upperChest", lathe([[0.2, -0.01], [0.205, 0.05], [0.185, 0.11], [0.125, uL + 0.015], [0.07, uL + 0.03]], 1.08, 0.64, b.seg(18)), S.suit);
  const neckCut: P2[] = [[-0.2, -0.012], [0.2, -0.012], [0.214, 0.085], [0.14, 0.15], [0.058, 0.15], [0.042, 0.122], [-0.042, 0.122], [-0.058, 0.15], [-0.14, 0.15], [-0.214, 0.085]];
  if (!sniper) {
    b.add("upperChest", b.plate(chamfer(neckCut, 0.012), { depth: 0.012, bevel: 0.006, bend: 0.25, bendY: 0.4 }), S.plate, { p: [0, 0, 0.126] });
    if (lod < 2) b.add("upperChest", b.plate(chamfer(rect(0.024, -0.012, 0.11), 0.007), { depth: 0.006, bevel: 0.004, bendY: 0.4 }), S.plate, { p: [0, 0, 0.148] });
    b.add("upperChest", b.plate(chamfer(rect(0.38, -0.012, 0.15, 0.3), 0.02), { depth: 0.012, bevel: 0.006, bend: 0.25, bendY: 0.4 }), S.plate, { p: [0, 0, -0.126], r: [0, Math.PI, 0] });
    // Retro-reflective tape across the shoulders and in a chevron over the coolant pack: it reads from behind.
    b.add("upperChest", b.plate(rect(0.3, -0.011, 0.011), { depth: 0.003, bevel: 0, bend: 0.2716 }), GLOWS.tape, { p: [0, 0.012, -0.1458], r: [0, Math.PI, 0] });
    if (lod < 2)
      for (const sg of [1, -1]) {
        const a = Math.asin(0.095 / 0.2616);
        b.add("chest", b.plate(rect(0.12, -0.009, 0.009), { depth: 0.003, bevel: 0 }), GLOWS.tape, { p: [0.095 * sg, 0.115, 0.116 - Math.cos(a) * 0.2616 - 0.001], r: [0, Math.PI - a * sg, 0.5 * sg] });
      }
    // The unit number, backlit (it reads from behind, at range, in the rain).
    if (b.det !== 3) strips(b, "upperChest", digits("07", 0.06), new THREE.Matrix4().compose(new THREE.Vector3(0.0, 0.07, -0.149), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new THREE.Vector3(1, 1, 1)), GLOWS.unit);
  }
  if (lod < 2) b.add("upperChest", shell([[0.1, 0.125], [0.136, 0.13], [0.13, 0.2], [0.098, 0.195]], 0, Math.PI * 2, b.seg(20)), arch === "sniper" ? S.web : S.plateDark, { s: [1.05, 1, 0.92] });
  if (lod === 0) {
    b.add("upperChest", b.box(0.046, 0.075, 0.03, 0.008), S.web, { p: [0.125, 0.06, 0.158], r: [0, 0.3, 0] });
    b.add("upperChest", b.box(0.012, 0.012, 0.006, 0.002), GLOWS.status, { p: [0.13, 0.085, 0.175], r: [0, 0.3, 0] });
  }
  if (lod < 2) {
    // The radio pack high on the back, its whip rising past the left shoulder with the red tip.
    b.add("upperChest", b.box(0.12, 0.13, 0.05, 0.012), S.web, { p: [0.07, 0.06, -0.175] });
    b.add("upperChest", cyl(0.0045, 0.003, 0.36, 6), S.metal, { p: [0.11, 0.3, -0.19], r: [-0.12, 0, 0.04] });
    b.add("upperChest", b.box(0.014, 0.022, 0.014, 0.003), GLOWS.tip, { p: [0.117, 0.48, -0.212] });
  }
}

/** Arms: the soft sleeve, the stacked pauldron with the mark on the left, the bicep guard, the vambrace and elbow cop, the gauntlet. */
function arm(b: Builder, side: "L" | "R", arch: Arch): void {
  const { lod } = b.o;
  const S = FINISH;
  const out = side === "L" ? -1 : 1;
  const phiOut = out > 0 ? Math.PI / 2 : -Math.PI / 2;
  const ua = `upperArm${side}`;
  const fa = `forearm${side}`;
  const uL = segLen(ua);
  const fL = segLen(fa);
  b.add(ua, limb(uL + 0.02, (t) => 0.068 - 0.012 * t + 0.009 * Math.sin(Math.PI * t), b.seg(14), lod ? 3 : 6), arch === "sniper" ? S.coat : S.suit, { p: [0, -0.02, 0] });
  if (arch !== "sniper") {
    // Three lames stacked down the shoulder, the top one standing 0.12 m proud of it (S3.2). They ride the upper
    // chest (like a real pauldron on its harness, they don't tip with every swing of the arm), built round the
    // shoulder's axis hanging down from the joint.
    const shoulder = REST[`shoulder${side}`].clone().sub(REST.spine2);
    const outC = side === "L" ? 1 : -1;
    const phiC = outC > 0 ? Math.PI / 2 : -Math.PI / 2;
    const frameC = new THREE.Matrix4().compose(
      new THREE.Vector3(shoulder.x + 0.02 * outC, shoulder.y, shoulder.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
      new THREE.Vector3(1, 1, 1),
    );
    const lames: Array<[P2[], number]> = [
      [[[0.05, -0.088], [0.112, -0.083], [0.142, -0.06], [0.152, -0.02], [0.155, 0.03], [0.143, 0.03], [0.14, -0.016], [0.13, -0.05], [0.104, -0.07], [0.05, -0.074]], 170],
      [[[0.146, 0.022], [0.16, 0.03], [0.162, 0.072], [0.15, 0.072], [0.148, 0.034], [0.136, 0.028]], 150],
      [[[0.14, 0.064], [0.153, 0.072], [0.153, 0.108], [0.142, 0.108], [0.14, 0.076], [0.13, 0.07]], 130],
    ];
    lames.forEach(([pr, deg], i) => {
      if (lod === 2 && i > 0) return;
      if ((lod === 1 && i > 1) || (b.det === 3 && i > 0)) return;
      const span = deg * D;
      b.add("upperChest", shell(pr, phiC - span / 2, span, b.seg(Math.round(deg / (b.o.phone ? 13 : 8))), 0.5), S.plate, frameC);
    });
    if (side === "L" && lod === 0) {
      // The "H in a tower" on the outer face of the top lame.
      const m = new THREE.Matrix4().multiplyMatrices(frameC, onRing(0.1555, -0.012, phiC, 1, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI))));
      strips(b, "upperChest", emblem(0.05), m);
    }
    if (lod < 2) b.add(ua, b.plate(chamfer(rect(0.075, -0.045, 0.045), 0.014), { depth: 0.008, bevel: 0.004, bend: 0.072 }), S.plate, new THREE.Matrix4().multiplyMatrices(onRing(0.07, uL * 0.62, phiOut), new THREE.Matrix4()));
  }
  b.add(fa, limb(fL + 0.02, (t) => 0.06 - 0.014 * t + 0.006 * Math.sin(Math.PI * t), b.seg(14), lod ? 3 : 5), arch === "sniper" ? S.coat : S.suit, { p: [0, -0.01, 0] });
  if (b.det <= 2) {
    // The vambrace over the back of the forearm, the elbow cop behind the elbow.
    const dorsal = phiOut + out * -0.5;
    b.add(fa, b.plate(chamfer(rect(0.09, 0.02, fL - 0.005, 0.08), 0.016), { depth: 0.009, bevel: 0.004, bend: 0.062 }), S.plate, onRing(0.06, 0, dorsal));
    const back = Math.PI + out * 0.5;
    b.add(fa, shell([[0.05, -0.03], [0.068, -0.012], [0.072, 0.02], [0.06, 0.04], [0.052, 0.036], [0.06, 0.016], [0.058, -0.008], [0.046, -0.02]], back - 1.1, 2.2, b.seg(12)), S.plate);
  }
  // ---- the gauntlet: a leather cuff, the palm, an armoured back of the hand, the thumb; the fingers on their bone.
  const h = `hand${side}`;
  const f = `fingers${side}`;
  b.add(h, limb(0.06, (t) => 0.05 - 0.008 * t, b.seg(12), 2), S.leather, { p: [0, -0.035, 0] });
  b.add(h, b.box(0.034, 0.095, 0.078, 0.012, 1), S.leather, { p: [0, 0.05, 0.004] });
  if (lod < 2) b.add(h, b.box(0.012, 0.06, 0.07, 0.005, 1), S.plate, { p: [0.022 * out, 0.06, 0.004] });
  if (lod === 0) b.add(h, limb(0.06, (t) => 0.014 - 0.003 * t, 8, 2), S.leather, { p: [-0.014 * out, 0.035, 0.04], r: [0.9, 0, 0.5 * out] });
  // The fingers: built straight along the bone from the knuckles, curled round the grip by the bone's own rotation.
  b.add(f, b.box(0.024, 0.05, 0.074, 0.008, 1), S.leather, { p: [0, 0.024, 0.004] });
  if (lod < 2) b.add(f, b.box(0.021, 0.045, 0.07, 0.008, 1), S.leather, { p: [-0.012 * out, 0.058, 0.004], r: [0, 0, -0.9 * out] });
}

function leg(b: Builder, side: "L" | "R", arch: Arch): void {
  const { lod } = b.o;
  const S = FINISH;
  const out = side === "L" ? -1 : 1;
  const phiOut = out > 0 ? Math.PI / 2 : -Math.PI / 2;
  const th = `thigh${side}`;
  const sh = `shin${side}`;
  const tL = segLen(th);
  const sL = segLen(sh);
  b.add(th, limb(tL + 0.04, (t) => 0.1 - 0.022 * t + 0.008 * Math.sin(Math.PI * t), b.seg(16), lod ? 3 : 6), S.suit, { p: [0, -0.04, 0] });
  if (arch !== "sniper" || lod === 0) b.add(th, b.plate(chamfer(rect(0.15, 0.04, 0.3, 0.12), 0.018), { depth: 0.01, bevel: 0.005, bend: 0.1 }), S.plate, { p: [0, 0, 0.094] });
  if (lod === 0) {
    if (side === "R") {
      // The holstered sidearm (S3.2: the fallback after a disarm): holster, strap, the grip standing out of it.
      b.add(th, b.box(0.04, 0.17, 0.085, 0.01), S.web, { p: [0.106, 0.2, -0.005] });
      b.add(th, b.box(0.03, 0.075, 0.034, 0.006), S.metal, { p: [0.11, 0.09, -0.02], r: [0.35, 0, 0] });
      b.add(th, limb(0.02, () => 0.103, b.seg(16), 1, false), S.web, { p: [0, 0.27, 0] });
    } else b.add(th, b.box(0.045, 0.1, 0.085, 0.012), S.web, { p: [-0.11, 0.2, 0.0] });
  }
  b.add(sh, limb(sL - 0.08, (t) => 0.074 + 0.014 * Math.sin(Math.PI * Math.min(1, t * 1.3)) - 0.012 * t, b.seg(16), lod ? 3 : 6), S.suit);
  if (b.det <= 2)
    b.add(sh, shell([[0.07, -0.065], [0.094, -0.045], [0.1, 0.02], [0.09, 0.07], [0.076, 0.07], [0.084, 0.02], [0.082, -0.03], [0.064, -0.05]], -1.25, 2.5, b.seg(16)), S.plate);
  b.add(sh, b.plate(chamfer(rect(0.1, 0.09, sL - 0.12, 0.085), 0.016), { depth: 0.01, bevel: 0.005, bend: 0.08 }), S.plate, { p: [0, 0, 0.076] });
  if (arch !== "sniper") b.add(sh, b.box(0.022, 0.16, 0.004, 0), GLOWS.tape, onRing(0.086, sL * 0.42, Math.PI));
  // The boot: a shaft, the foot with a toe cap, a sole with a heel step.
  b.add(sh, limb(0.14, (t) => 0.072 + 0.006 * t, b.seg(16), 2, false), S.leather, { p: [0, sL - 0.13, 0] });
  b.add(sh, b.box(0.104, 0.075, 0.24, 0.022, 1), S.leather, { p: [0, sL + 0.012, 0.045] });
  if (lod < 2) b.add(sh, b.box(0.098, 0.045, 0.06, 0.014, 1), S.plateDark, { p: [0, sL + 0.022, 0.15] });
  b.add(sh, b.box(0.112, 0.024, 0.26, 0.006, 1), S.rubber, { p: [0, sL + 0.05, 0.048] });
  void phiOut;
}

function head(b: Builder, arch: Arch): void {
  const { lod } = b.o;
  const S = FINISH;
  // The neck and the balaclava'd head under the helmet (seen when a headshot knocks it off).
  b.add("head", limb(0.1, (t) => 0.054 + 0.004 * t, b.seg(12), 1), S.knit, { p: [0, -0.01, 0] });
  b.add("head", lathe([[0, 0.03], [0.06, 0.04], [0.1, 0.09], [0.112, 0.15], [0.1, 0.22], [0.06, 0.255], [0, 0.262]], 0.92, 1.0, b.seg(14)), S.knit);
  const H = "helmet";
  const sz = 1.12;
  const hs = (n: number) => b.seg(n);
  // The shell: a flared full-face helmet, longer front to back, its rim flaring at the neck.
  const outer: P2[] = [[0.0, 0.158], [0.072, 0.146], [0.114, 0.118], [0.14, 0.078], [0.152, 0.036], [0.157, 0.022], [0.151, 0.0], [0.149, -0.05], [0.153, -0.09], [0.166, -0.12], [0.16, -0.128]];
  const inner: P2[] = [[0.142, -0.118], [0.135, -0.06], [0.0, 0.135]];
  const sniper = arch === "sniper";
  b.add(H, shell([...outer, ...inner], 0, Math.PI * 2, hs(26), 0.5), sniper ? S.plateDark : S.plate, { p: [0, 0, -0.008], s: [1, 1, sz] });
  const ring = (pr: P2[], c: number, half: number, surf: Surface | Glow, n: number) => b.add(H, shell(pr, c - half, half * 2, hs(n)), surf, { p: [0, 0, -0.008], s: [1, 1, sz] });
  if (!sniper) {
    // The visor: a band of black glass, the amber slit lit inside it (the crit target), a heavy brow over it.
    ring([[0.149, -0.016], [0.1585, -0.014], [0.1585, 0.03], [0.149, 0.032]], 0, 52 * D, S.glass, 14);
    ring([[0.157, 0.0], [0.1612, 0.002], [0.1612, 0.016], [0.157, 0.018]], 0, 36 * D, GLOWS.slit, 10);
    if (lod < 2) ring([[0.152, 0.03], [0.166, 0.034], [0.165, 0.048], [0.153, 0.056]], 0, 40 * D, S.plate, 12);
  } else {
    // The sniper: one round lens where the slit would be (his laser's origin), a hood over the shell.
    b.add(H, cyl(0.03, 0.03, 0.02, hs(16)), S.plateDark, { p: [0.0, 0.012, 0.165 * sz - 0.004], r: [Math.PI / 2, 0, 0] });
    b.add(H, cyl(0.021, 0.021, 0.012, hs(14)), GLOWS.lens, { p: [0.0, 0.012, 0.165 * sz + 0.006], r: [Math.PI / 2, 0, 0] });
    if (lod < 2) b.add(H, shell([[0.162, -0.13], [0.178, -0.1], [0.178, 0.04], [0.15, 0.13], [0.07, 0.178], [0.0, 0.185], [0.0, 0.17], [0.065, 0.163], [0.14, 0.12], [0.164, 0.035], [0.164, -0.1]], Math.PI - 2.2, 4.4, hs(20)), S.coat, { p: [0, 0, -0.008], s: [1, 1, sz] });
  }
  // The light strip across the back (S3.2: 2 cm, so the head reads from behind).
  ring([[0.1505, -0.044], [0.1545, -0.043], [0.1545, -0.023], [0.1505, -0.022]], Math.PI, 30 * D, GLOWS.strip, 8);
  if (b.det <= 2 && !sniper) {
    // The respirator jaw and its two filters, the comms cups at the ears.
    ring([[0.149, -0.124], [0.163, -0.118], [0.166, -0.066], [0.158, -0.036], [0.149, -0.04]], 0, 48 * D, S.plateDark, 14);
    if (b.det === 0)
      // The respirator's vent: four slats across the chin (not two round filters: they read as a cartoon face).
      for (let i = 0; i < 4; i++) b.add(H, b.box(0.07 - i * 0.008, 0.006, 0.012, 0.002, 1), S.metal, { p: [0, -0.06 - i * 0.012, 0.166 * sz + 0.004 - i * 0.002], r: [0.25, 0, 0] });
    for (const s of [1, -1]) b.add(H, cyl(0.042, 0.04, 0.026, hs(14)), S.plateDark, { p: [0.155 * s, -0.03, 0.0], r: [0, 0, (Math.PI / 2) * s] });
  }
  if (arch === "leader") {
    // The squad leader: a tall crest fin and a red stripe under the visor.
    const crest: P2[] = [[-0.14, 0.08], [0.06, 0.135], [0.11, 0.12], [0.08, 0.2], [-0.03, 0.25], [-0.17, 0.19]];
    b.add(H, b.plate(chamfer(crest, 0.01), { depth: 0.01, bevel: 0.004 }), S.plate, { p: [-0.009, 0, -0.008], r: [0, Math.PI / 2, 0] });
    ring([[0.1586, -0.013], [0.1606, -0.012], [0.1606, -0.005], [0.1586, -0.004]], 0, 40 * D, GLOWS.stripe, 10);
  } else if (!sniper && lod < 2) {
    // Everyone else: a low ridge over the crown.
    b.add(H, b.plate(chamfer([[-0.13, 0.09], [0.05, 0.14], [0.085, 0.125], [0.05, 0.165], [-0.06, 0.168], [-0.15, 0.12]], 0.01), { depth: 0.012, bevel: 0.004 }), S.plateDark, { p: [-0.01, 0, -0.008], r: [0, Math.PI / 2, 0] });
  }
}

/** The sniper's tripod pack on his back: three legs bundled on a frame. */
function sniperPack(b: Builder): void {
  const { lod } = b.o;
  if (lod === 2) return;
  b.add("upperChest", b.box(0.16, 0.22, 0.06, 0.012), FINISH.web, { p: [0, 0.02, -0.16] });
  for (const [x, z] of [[-0.03, -0.205], [0.0, -0.215], [0.03, -0.205]] as const) b.add("upperChest", cyl(0.011, 0.009, 0.55, 6), FINISH.metal, { p: [x, 0.08, z], r: [0, 0, 0.12] });
  b.add("upperChest", cyl(0.028, 0.028, 0.03, b.seg(12)), FINISH.plateDark, { p: [0.03, 0.36, -0.21], r: [0, 0, 0.12] });
}

/** The tabard's static panel (LOD1 and the reduced cloth): front and back flaps hanging from the belt. */
function tabardStatic(b: Builder): void {
  for (const [z, ry] of [[0.125, 0], [-0.125, Math.PI]] as const)
    b.add("abdomen", b.plate(chamfer(rect(0.26, -0.5, 0.0, 0.28), 0.03), { depth: 0.006, bevel: 0, bend: 0.3 }), FINISH.web, { p: [0, 0, z], r: [0, ry, 0] });
}

/**
 * LOD2 (S3.1): capsules, the visor, and the shapes that make the silhouette (the pauldrons, the crest, the helmet's
 * flare); the sniper's hood. A few hundred triangles, read at 40 m by its outline and its lights alone.
 */
function silhouette(b: Builder, arch: Arch): void {
  const S = FINISH;
  const n = b.o.phone ? 5 : 6;
  const cap = (bone: string, r0: number, r1: number, surf: Surface = S.suit, y0 = 0, extra = 0) => b.add(bone, limb(segLen(bone) + extra, (t) => r0 + (r1 - r0) * t, n, 1), surf, { p: [0, y0, 0] });
  b.add("abdomen", lathe([[0.0, -0.1], [0.15, -0.06], [0.155, 0.12], [0.17, segLen("abdomen") + 0.02]], 1.05, 0.72, n), S.suit);
  b.add("chest", lathe([[0.17, -0.02], [0.205, segLen("chest") + 0.01]], 1.06, 0.7, n), arch === "sniper" ? S.coat : S.plate);
  b.add("upperChest", lathe([[0.205, -0.01], [0.2, 0.1], [0.12, segLen("upperChest") + 0.02]], 1.08, 0.7, n), arch === "sniper" ? S.coat : S.plate);
  for (const sd of ["L", "R"] as const) {
    const out = sd === "L" ? -1 : 1;
    cap(`upperArm${sd}`, 0.072, 0.062, S.suit, -0.02, 0.02);
    cap(`forearm${sd}`, 0.062, 0.05, S.suit, -0.01, 0.02);
    b.add(`hand${sd}`, box(0.034, 0.1, 0.075, 0, 0), S.leather, { p: [0, 0.05, 0] });
    cap(`thigh${sd}`, 0.1, 0.08, S.suit, -0.04, 0.04);
    cap(`shin${sd}`, 0.082, 0.07, S.suit, 0, -0.08);
    b.add(`shin${sd}`, box(0.104, 0.09, 0.26, 0, 0), S.leather, { p: [0, segLen(`shin${sd}`) + 0.02, 0.045] });
    if (arch !== "sniper") {
      const sh = REST[`shoulder${sd}`].clone().sub(REST.spine2);
      const phiC = -out > 0 ? Math.PI / 2 : -Math.PI / 2;
      const frameC = new THREE.Matrix4().compose(new THREE.Vector3(sh.x - 0.02 * out, sh.y, sh.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), new THREE.Vector3(1, 1, 1));
      b.add("upperChest", shell([[0.05, -0.09], [0.14, -0.07], [0.158, 0.07], [0.146, 0.07], [0.13, -0.058], [0.05, -0.076]], phiC - 1.4, 2.8, b.o.phone ? 3 : 4, 0.3), S.plate, frameC);
    }
  }
  b.add("head", limb(0.1, () => 0.056, n, 1), S.knit, { p: [0, -0.01, 0] });
  const H = "helmet";
  const outer: P2[] = [[0.0, 0.158], [0.12, 0.11], [0.157, 0.022], [0.15, -0.06], [0.166, -0.12]];
  b.add(H, shell([...outer, [0.13, -0.11], [0.0, 0.13]], 0, Math.PI * 2, b.o.phone ? 5 : 8, 0.5), arch === "sniper" ? S.coat : S.plate, { p: [0, 0, -0.008], s: [1, 1, 1.12] });
  if (arch === "sniper") b.add(H, cyl(0.022, 0.022, 0.012, 6), GLOWS.lens, { p: [0.0, 0.012, 0.18], r: [Math.PI / 2, 0, 0] });
  else b.add(H, shell([[0.157, 0.0], [0.163, 0.002], [0.163, 0.016], [0.157, 0.018]], -36 * D, 72 * D, 3), GLOWS.slit, { p: [0, 0, -0.008], s: [1, 1, 1.12] });
  b.add(H, shell([[0.15, -0.044], [0.156, -0.043], [0.156, -0.023], [0.15, -0.022]], Math.PI - 30 * D, 60 * D, 2), GLOWS.strip, { p: [0, 0, -0.008], s: [1, 1, 1.12] });
  if (arch === "leader") b.add(H, plate([[-0.13, 0.085], [0.06, 0.135], [0.07, 0.175], [-0.04, 0.21], [-0.15, 0.17]], { depth: 0.01, bevel: 0 }), S.plate, { p: [-0.005, 0, -0.008], r: [0, Math.PI / 2, 0] });
}

export interface ArchGeometry {
  opaque: THREE.BufferGeometry;
  glow: THREE.BufferGeometry;
  /** Triangles in both layers together. */
  tris: number;
}

const ARCH_CACHE = new Map<string, ArchGeometry>();

/** The two layers of an archetype at a LOD for a profile (built once, shared by every body). */
export function archGeometry(arch: Arch, lod: Lod, phone: boolean): ArchGeometry {
  const key = `${arch}:${lod}:${phone ? "p" : "d"}`;
  const have = ARCH_CACHE.get(key);
  if (have) return have;
  const b = new Builder({ lod, phone });
  if (lod === 2) silhouette(b, arch);
  else {
    torso(b, arch);
    head(b, arch);
    for (const s of ["L", "R"] as const) {
      arm(b, s, arch);
      leg(b, s, arch);
    }
    if (arch === "sniper") sniperPack(b);
  }
  if (lod === 1 && arch !== "sniper") tabardStatic(b);
  const g = b.finish();
  const out: ArchGeometry = { ...g, tris: Math.round(tris(g.opaque) + tris(g.glow)) };
  ARCH_CACHE.set(key, out);
  return out;
}

/** Which archetype a kit role wears. */
export function archFor(role: string | undefined, leader = false): Arch {
  if (role === "shield") return "riot";
  if (role === "sniper") return "sniper";
  return leader ? "leader" : "enforcer";
}

/** The helmet's place on the head bone (the helmet bone follows it until a headshot knocks it off). */
export const HELMET_AT = HELM_Y;
/** Knuckles on the hand bone. */
export const KNUCKLES_AT = KNUCKLE_Y;
void BANDS;
