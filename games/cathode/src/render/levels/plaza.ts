// Hollowell Plaza (act 3, Councillor Pell): an open civic square in heavy rain. The player arrives at the
// south tram stop (+z) and looks north across a dry fountain to the council steps (-z), where Pell holds his
// rally under a giant holo-billboard of himself. Market awnings line the west side, a stalled tram sits on the
// east, statues of founders stand either side of the steps and marksmen watch from the rooftops.

import * as THREE from "three";
import { Builder } from "../builder";
import { prng, WIN_COLS, WIN_ROWS } from "../textures";
import type { Level, SignDef, VLight, WindowDef } from "../level";
import { standingParts, type CrowdGroup } from "../crowd";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const C = (hex: string) => new THREE.Color(hex);

export const PLAZA = { xW: -30, xE: 30, zS: 52, zN: -56, stepZ0: -28, stepRun: 1.6, stepRise: 0.3, stepCount: 8 } as const;

/** Height of the council steps under (x, z): eight 30 cm risers up to a 2.4 m landing, 20 m wide. */
export function plazaGround(x: number, z: number): number {
  const { stepZ0, stepRun, stepRise, stepCount } = PLAZA;
  if (Math.abs(x) > 10 || z > stepZ0) return 0;
  const n = Math.floor((stepZ0 - z) / stepRun) + 1;
  return Math.min(stepCount, n) * stepRise;
}

export function buildPlaza(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const rand = prng(4407);
  const lights: VLight[] = [];
  const signs: SignDef[] = [];
  const windows: WindowDef[] = [];
  const interiors: Level["interiors"] = [];
  const cones: Level["cones"] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = false) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: seed++, real });
  const { xW, xE, zS, zN, stepZ0, stepRun, stepRise, stepCount } = PLAZA;
  const top = stepCount * stepRise;
  // Plan item 4: bronze founders, sculpted from the crowd's figure (crowd.ts standingParts) at heroic scale, one
  // arm raised towards the hall. Shot-only cover, as the old box statues were.
  const founder = (at: THREE.Vector3, yaw: number, k: number) => {
    const p = standingParts();
    const arm = new THREE.CylinderGeometry(0.05, 0.065, 0.62, 7);
    arm.rotateZ(-0.9);
    arm.translate(0.25, 1.62, -0.22);
    const g = mergeGeometries([...p.coat, ...p.skin, ...p.dark, arm, new THREE.SphereGeometry(0.05, 6, 5).translate(0.5, 1.8, -0.22)].map((x) => (x.index ? x.toNonIndexed() : x)), false)!;
    b.shape("darkMetal", g, at, yaw, V(k, k, k));
    b.tagLast("thin", "metal");
  };

  // Ground: wet stone square, a tram road along the east side.
  b.boxMinMax("pavement", xW, -0.5, zN, xE, 0, zS, { uv: 3, skip: ["bottom"] });
  b.boxMinMax("asphalt", 17, -0.49, zN + 4, 27, 0.005, zS, { uv: 4, skip: ["bottom"] });
  for (const x of [21.2, 22.8]) b.boxMinMax("rust", x - 0.04, 0.005, zN + 4, x + 0.04, 0.03, zS);

  // Perimeter buildings: tall facades with lit and dark windows, and flat roofs the marksmen use.
  const facade = (x0: number, x1: number, z0: number, z1: number, h: number, key: string, face: THREE.Vector3) => {
    b.boxMinMax(key, x0, -0.5, z0, x1, h, z1, { uv: 2, collide: "concrete" });
    const alongZ = face.x !== 0;
    const span = alongZ ? z1 - z0 : x1 - x0;
    const n = Math.floor(span / 3.2);
    for (let row = alongZ ? 1 : 0; row < Math.floor(h / 3.3); row++) {
      for (let i = 0; i < n; i++) {
        const lit = rand() < 0.3;
        const t = z0 + (i + 0.5) * (span / n);
        const px = alongZ ? (face.x > 0 ? x1 + 0.03 : x0 - 0.03) : x0 + (i + 0.5) * (span / n);
        const pz = alongZ ? t : face.z > 0 ? z1 + 0.03 : z0 - 0.03;
        windows.push({ pos: V(px, 2.4 + row * 3.3, pz), normal: face, w: 1.25, h: 1.75, tile: Math.floor(rand() * WIN_COLS * WIN_ROWS), lit: lit ? 0.8 + rand() * 1.6 : 0 });
      }
    }
  };
  // Plan item 4: ground-floor shopfronts on the side blocks, so the square's edges read as a city and not as
  // walls: a lit interior behind glass, mullions, a fascia sign, a canopy and a step. `sx` is the face's x and
  // `dir` the way it faces (+1 east, -1 west).
  const shopfront = (sx: number, dir: number, z: number, w: number, name: string, sub: string, tint: string, col: string, seedK: number) => {
    const fx = sx + dir * 0.02;
    interiors.push({ pos: V(sx + dir * 0.03, 1.55, z), normal: V(dir, 0, 0), w: w - 0.5, h: 2.5, tint, seed: seedK });
    b.box("clearGlass", sx + dir * 0.12, 1.55, z, 0.04, 2.5, w - 0.5, { cover: "thin", mat: "glass" });
    for (let k = 0; k <= 3; k++) b.box("darkMetal", sx + dir * 0.16, 1.55, z - (w - 0.5) / 2 + (k * (w - 0.5)) / 3, 0.08, 2.6, 0.08, { cover: "none" });
    b.box("darkMetal", sx + dir * 0.16, 0.25, z, 0.1, 0.5, w - 0.3, { cover: "none" }); // stall riser
    b.box("blackPaint", fx + dir * 0.1, 3.25, z, 0.2, 0.8, w, { cover: "none" }); // fascia
    signs.push({ text: name, sub, style: "box", color: col, w: w * 0.7, h: 0.6, center: V(fx + dir * 0.22, 3.25, z), normal: V(dir, 0, 0), flicker: seedK % 5 === 0 ? 2 : 0, intensity: 2 });
    b.shape("darkMetal", new THREE.BoxGeometry(1.4, 0.06, w), V(sx + dir * 0.75, 3.85, z), 0, undefined, 1, 0, dir * 0.18); // canopy
    light(V(sx + dir * 1.4, 2.4, z), tint, 10, 6, 0);
  };
  const ledge = (x: number, dir: number, z0: number, z1: number, h: number) => {
    for (let y = 4.4; y < h - 1; y += 3.3) b.boxMinMax("concreteA", Math.min(x, x + dir * 0.25), y - 0.1, z0, Math.max(x, x + dir * 0.25), y + 0.06, z1, { cover: "none" });
    b.boxMinMax("concreteA", Math.min(x, x + dir * 0.6), h - 0.2, z0, Math.max(x, x + dir * 0.6), h + 0.3, z1, { cover: "none" }); // cornice
  };
  shopfront(xE, -1, -40, 6, "CHEMIST", "OPEN 24 HOURS", "#3a8a6a", "#7fffc0", 51);
  shopfront(xE, -1, -26, 5, "PAWN", "GOLD · PHONES · GUNS", "#8a5a20", "#ffc060", 52);
  shopfront(xE, -1, 12, 6, "CAFÉ LUMEN", "LAST ORDERS 2AM", "#9a6a3a", "#ffd2a0", 53);
  shopfront(xE, -1, 26, 5, "NOODLE BAR", "HOT · CHEAP · NOW", "#9a3a2a", "#ff8a60", 54);
  shopfront(xW, 1, -30, 6, "HOLLOWELL MUTUAL", "LOANS IN MINUTES", "#2a4a8a", "#8ab8ff", 55);
  shopfront(xW, 1, -12, 5, "BARBER", "WALK-INS", "#5a2a4a", "#ff7fb0", 56);
  ledge(xE, -1, zN, -14, 8);
  ledge(xE, -1, -10, zS, 14);
  ledge(xW, 1, zN, 10, 9);
  ledge(xW, 1, 14, zS, 12);
  facade(xW - 8, xW, zN, 10, 9, "brickDark", V(1, 0, 0)); // west block, north half
  facade(xW - 8, xW, 14, zS + 6, 12, "brickRed", V(1, 0, 0)); // west block, market side
  facade(xE, xE + 8, zN, -14, 8, "concreteB", V(-1, 0, 0)); // east block, north
  facade(xE, xE + 8, -10, zS + 6, 14, "brickDark", V(-1, 0, 0)); // east block, tram side
  facade(xW - 8, xE + 8, zS, zS + 6, 10, "concreteB", V(0, 0, -1)); // the tram-stop hoarding
  // The council hall closes the north end: a portico on columns over the landing.
  b.boxMinMax("concreteA", xW - 8, -0.5, zN - 8, xE + 8, 20, zN, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteB", -12, top - 0.3, zN, 12, top, -41, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", -12, top + 6.2, zN, 12, top + 7, -46, { uv: 2, collide: "concrete" });
  for (const x of [-10, -5, 0, 5, 10]) b.box("concreteA", x, top + 3.1, -47, 0.9, 6.2, 0.9, { collide: "concrete" });
  b.box("wood", 0, top + 0.55, -50, 1.2, 1.1, 0.7, { collide: "metal" }); // Pell's lectern

  // The steps: eight risers, each a full-width block so the player climbs by stepping.
  for (let i = 0; i < stepCount; i++) {
    const z0 = stepZ0 - i * stepRun;
    b.boxMinMax("concreteA", -10, 0, -41, 10, (i + 1) * stepRise, z0, { uv: 2, collide: "concrete" });
  }
  // Flank walls with brazier bins and the police line.
  for (const s of [-1, 1]) {
    b.boxMinMax("concreteB", s * 10, 0, -41, s * 10.5, 1.2, stepZ0, { collide: "concrete" });
    b.box("jersey", s * 7, 0.4, stepZ0 + 3, 2.4, 0.8, 0.5, { collide: "concrete" });
    b.box("jersey", s * 3, 0.4, stepZ0 + 3, 2.4, 0.8, 0.5, { collide: "concrete" });
  }

  // The dry fountain: a shallow basin, a stained column and a founder on top.
  b.cylinder("concreteB", V(0, 0, 8), V(0, 0.8, 8), 4.6, 20, "concrete");
  b.cylinder("darkMetal", V(0, 0.2, 8), V(0, 0.82, 8), 4.0, 20);
  b.cylinder("concreteA", V(0, 0, 8), V(0, 3.2, 8), 0.7, 10, "concrete");
  founder(V(0, 3.2, 8), -Math.PI / 2, 1.15);

  // Plan item 4: the fountain is the square's heart. Uplights in the dry basin wash the column and the founder,
  // a protest vigil of candles, flowers and taped photos rings its rim, and brass inlay lines radiate from it
  // across the stone to the steps, catching every lamp in the wet.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const p = V(Math.cos(a) * 1.4, 0.86, 8 + Math.sin(a) * 1.4);
    b.box("darkMetal", p.x, p.y, p.z, 0.3, 0.12, 0.3, { cover: "none" });
    b.box("glowWarm", p.x, p.y + 0.065, p.z, 0.2, 0.01, 0.2, { cover: "none" });
    cones.push({ top: V(p.x, 0.92, p.z), dir: V(-p.x * 0.12, 1, (8 - p.z) * 0.12).normalize(), length: 5.2, radius: 0.9, color: C("#ffd9a8"), strength: 0.35 });
  }
  light(V(0, 1.6, 9.6), "#ffd2a0", 22, 7, 0, true);
  light(V(0, 1.6, 6.4), "#ffd2a0", 14, 6, 0);
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2 + 0.4;
    if (Math.sin(a) < -0.2 && k % 3) continue; // thinner on the hall side
    const r = 4.45 + ((k * 7) % 3) * 0.04;
    const x = Math.cos(a) * r;
    const z = 8 + Math.sin(a) * r;
    if (k % 2 === 0) {
      b.cylinder("plasticWhite", V(x, 0.8, z), V(x, 0.86 + (k % 3) * 0.03, z), 0.03, 6);
      b.box("glowAmber", x, 0.9 + (k % 3) * 0.03, z, 0.02, 0.03, 0.02, { cover: "none" });
    } else {
      b.box(k % 4 === 1 ? "paintRed" : "yellowPaint", x, 0.82, z, 0.26, 0.04, 0.12, { rotY: a, cover: "none" }); // flowers
    }
    if (k % 5 === 0) b.box("plasticWhite", Math.cos(a) * 4.62, 0.55, 8 + Math.sin(a) * 4.62, 0.2, 0.26, 0.01, { rotY: -a + Math.PI / 2, cover: "none" }); // taped photos
  }
  light(V(0, 1.0, 12.6), "#ffb060", 6, 4, 1);
  light(V(-3.5, 1.0, 10.8), "#ffb060", 5, 4, 1);
  light(V(3.5, 1.0, 10.8), "#ffb060", 5, 4, 1);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    // A line from the basin out to the edge of the square (stopped at the steps and the tram road).
    const r0 = 5.4;
    let r1 = 34;
    if (dz < 0) r1 = Math.min(r1, (8 - stepZ0 - 1) / -dz);
    if (dx > 0) r1 = Math.min(r1, (16.5 - 0) / dx);
    if (dx < 0) r1 = Math.min(r1, 29 / -dx);
    if (dz > 0) r1 = Math.min(r1, (zS - 9) / dz);
    const len = r1 - r0;
    const cx = dx * (r0 + len / 2);
    const cz = 8 + dz * (r0 + len / 2);
    b.box("brass", cx, 0.004, cz, 0.07, 0.008, len, { rotY: Math.atan2(dx, dz), cover: "none" });
  }
  for (const r of [6.2, 14]) {
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const ch = (2 * Math.PI * r) / 48;
      const x = Math.cos(a) * r;
      const z = 8 + Math.sin(a) * r;
      if (z < stepZ0 + 0.5) continue;
      b.box("brass", x, 0.004, z, 0.06, 0.008, ch, { rotY: -a, cover: "none" });
    }
  }

  // Statues of founders either side of the approach, pigeon-streaked.
  for (const x of [-14, 14]) {
    b.box("concreteA", x, 0.8, -12, 2.2, 1.6, 2.2, { collide: "concrete" });
    b.box("concreteB", x, 1.68, -12, 2.5, 0.16, 2.5, { cover: "none" }); // cornice
    b.box("brass", x, 1.0, -10.88, 1.1, 0.4, 0.03, { cover: "none" }); // the founder's plaque
    // Each founder faces the square, turned a little towards the fountain.
    founder(V(x, 1.76, -12), -Math.PI / 2 + (x < 0 ? -0.35 : 0.35), 1.6);
  }

  // Market awnings (west): four stalls under tarp, counters, crates and warm bulbs.
  const shelters: THREE.Box3[] = [new THREE.Box3(V(-12, 6, -52), V(12, 30, -40))];
  for (let i = 0; i < 4; i++) {
    const z = 22 + i * 7;
    // Plan item 4: a pitched awning, high at the back and dipping to the shoppers, on a ridge pole.
    b.shape("tarp", new THREE.BoxGeometry(5.5, 0.05, 4.3), V(-22, 2.78, z), 0, undefined, 1, 0, -0.12);
    b.cylinder("pipe", V(-24.75, 3.12, z - 2.1), V(-24.75, 3.12, z + 2.1), 0.04, 5);
    for (const dz of [-1.8, 1.8])
      for (const dx of [-2.4, 2.4]) {
        b.cylinder("pipe", V(-22 + dx, 0, z + dz), V(-22 + dx, 2.65, z + dz), 0.05);
        b.tagLast("thin", "metal");
      }
    b.box("wood", -22, 0.5, z, 3.6, 1, 0.8, { collide: "metal" });
    b.box("styro", -23.2, 0.2, z + 1.4, 0.8, 0.4, 0.5, { collide: "metal" });
    b.box("glowWarm", -22, 2.5, z, 0.3, 0.08, 0.3);
    light(V(-22, 2.3, z), "#ffb86a", 12, 7, 1);
    shelters.push(new THREE.Box3(V(-25, 0, z - 2), V(-19, 3, z + 2)));
  }

  // The tram line (east): a stalled tram, its windows lit, overhead cable on poles.
  b.box("vanWhite", 22, 1.7, -2, 3.0, 3.2, 14, { collide: "metal" });
  b.box("glowWarm", 22, 2.2, -2, 3.04, 0.7, 12);
  b.box("darkMetal", 22, 0.35, -2, 2.6, 0.5, 13);
  // Plan item 4: the tram reads as a tram: window pillars break the lit strip, a teal livery band, a roof pod,
  // a pantograph up to the wire, lit route boards at both ends, headlamps north and tail lamps south.
  for (const sx of [20.47, 23.53]) {
    for (let z = -8.4; z <= 4.4; z += 1.6) b.box("darkMetal", sx, 2.2, z, 0.05, 0.78, 0.16, { cover: "none" });
    b.box("paintTeal", sx, 1.2, -2, 0.04, 0.32, 13.6, { cover: "none" });
    b.box("chrome", sx, 2.62, -2, 0.03, 0.04, 13.4, { cover: "none" });
  }
  b.box("darkMetal", 22, 3.45, -2, 2.4, 0.3, 6, { cover: "none" });
  b.cylinder("chrome", V(22, 3.6, -2), V(22, 4.9, -3.2), 0.025, 5);
  b.tagLast("thin", "metal");
  b.cylinder("chrome", V(22, 4.9, -3.2), V(22, 6.15, -2), 0.025, 5);
  b.tagLast("thin", "metal");
  b.box("darkMetal", 22, 6.17, -2, 1.4, 0.04, 0.12, { cover: "none" });
  for (const [z, n] of [[-9.03, V(0, 0, -1)], [5.03, V(0, 0, 1)]] as const) {
    signs.push({ text: "9  CIVIC SQ", sub: "NOT IN SERVICE", style: "box", color: "#ffb347", w: 2.2, h: 0.42, center: V(22, 2.95, z + n.z * 0.02), normal: n, flicker: 1, intensity: 2.4 });
    for (const dx of [-0.95, 0.95]) b.box(z < 0 ? "glowWhite" : "glowRed", 22 + dx, 0.8, z, 0.3, 0.18, 0.04, { cover: "none" });
  }
  for (const dx of [-0.95, 0.95]) cones.push({ top: V(22 + dx, 0.8, -9.1), dir: V(0, -0.12, -1).normalize(), length: 12, radius: 2.2, color: C("#e8f0ff"), strength: 0.35 });
  light(V(22, 1.2, -10.5), "#e8f0ff", 14, 9, 0);
  light(V(22, 1.0, 6.2), "#ff2a2a", 6, 5, 0);
  for (let z = 44; z >= -40; z -= 14) {
    b.cylinder("pipe", V(26.2, 0, z), V(26.2, 6.4, z), 0.09, 8, "metal");
    b.cylinder("pipe", V(26.2, 6.2, z), V(22, 6.2, z), 0.05);
    if (z > -36) b.cable("cable", V(22, 6.2, z), V(22, 6.2, z - 14), 0.35);
  }
  b.box("paintTeal", 24.6, 1.2, 46, 0.1, 2.4, 3, { uv: 1, cover: "thin", mat: "metalSheet" }); // tram shelter panel
  b.box("glowCool", 24.55, 1.6, 46, 0.04, 1.4, 2.6, { cover: "none" }); // the ad lightbox face on that panel
  signs.push({ text: "LINE 9", sub: "SUSPENDED · COUNCIL DIRECTIVE", style: "box", color: "#2ee6ff", w: 2.4, h: 0.5, center: V(24.5, 2.8, 46), normal: V(-1, 0, 0), flicker: 1, intensity: 3 });
  light(V(24, 2, 46), "#7fe9ff", 10, 8, 1);

  // Street lamps along both sides of the square, sodium and wet.
  for (let z = 44; z > zN + 8; z -= 12) {
    for (const x of [-16, 16]) {
      b.cylinder("pipe", V(x, 0, z), V(x, 5.2, z), 0.07, 8, "metal");
      b.box("glowSodium", x, 5.25, z, 0.5, 0.1, 0.5);
      light(V(x, 5, z), "#ff9a3a", 20, 12, z % 24 === 0 ? 1 : 0, Math.abs(z) < 30);
      cones.push({ top: V(x, 5.2, z), length: 5.2, radius: 2.4, color: C("#ff9a3a"), strength: 0.5 });
    }
  }

  // Pell's holo-billboard on the hall's face, and flanking campaign screens.
  // Plan item 4: his face, not a beige box. A posterised campaign portrait (render/pellboard.ts) fills the giant
  // board and the two screens either side, with a chrome frame and a lit gantry under it.
  const boards: NonNullable<Level["boards"]> = [{ center: V(0, 13.6, zN + 0.24), normal: V(0, 0, 1), w: 21, h: 8.64, intensity: 1.5 }];
  b.boxMinMax("blackPaint", -10.9, 9.1, zN - 0.02, 10.9, 18.1, zN + 0.2, { uv: 1 });
  for (const y of [9.22, 17.98]) b.box("chrome", 0, y, zN + 0.3, 21.4, 0.12, 0.16, { cover: "none" });
  for (const x of [-10.64, 10.64]) b.box("chrome", x, 13.6, zN + 0.3, 0.12, 8.9, 0.16, { cover: "none" });
  // The hall's own face around it: tall lit windows in two tiers, a lit cornice and uplit pilasters.
  for (let x = -34; x <= 34; x += 4) {
    if (Math.abs(x) < 13) continue;
    for (const y of [4.2, 11.6]) windows.push({ pos: V(x, y, zN + 0.03), normal: V(0, 0, 1), w: 1.6, h: 3.6, tile: Math.floor(rand() * WIN_COLS * WIN_ROWS), lit: rand() < 0.6 ? 1.2 + rand() * 1.4 : 0.15 });
    b.box("concreteB", x + 2, 9.5, zN + 0.25, 0.6, 19, 0.5, { cover: "none" });
    if (Math.abs(x) > 14) cones.push({ top: V(x + 2, 0.3, zN + 0.8), dir: V(0, 1, 0.04).normalize(), length: 12, radius: 1.1, color: C("#ffd2a0"), strength: 0.28 });
  }
  b.box("concreteA", 0, 19.4, zN + 0.6, xE - xW + 16, 0.8, 1.2, { cover: "none" });
  for (let x = -36; x <= 36; x += 1.5) b.box("glowWarm", x, 18.92, zN + 1.15, 0.5, 0.06, 0.06, { cover: "none" });
  b.box("darkMetal", 0, 8.5, zN + 0.8, 18, 0.12, 1.2, { cover: "none" }); // the maintenance gantry
  for (let x = -8; x <= 8; x += 2) b.box("glowWarm", x, 8.42, zN + 1.2, 0.3, 0.04, 0.12, { cover: "none" });
  light(V(0, 11, zN + 6), "#ffcf9a", 90, 28, 1);
  for (const x of [-18, 18]) {
    b.box("blackPaint", x, 6, zN + 0.12, 5.4, 2.6, 0.2, { cover: "none" });
    boards.push({ center: V(x, 6, zN + 0.24), normal: V(0, 0, 1), w: 5.1, h: 2.1, intensity: 1.8 });
    light(V(x, 5, zN + 3), "#ffb98a", 16, 10, 2);
  }
  // Police cruiser lights at the foot of the steps.
  for (const x of [-9, 9]) {
    b.box("carBlack", x, 0.7, stepZ0 + 7, 2.0, 1.2, 4.6, { collide: "metal" });
    b.box("glowRed", x - 0.5, 1.4, stepZ0 + 7, 0.5, 0.12, 0.2);
    b.box("glowCyan", x + 0.5, 1.4, stepZ0 + 7, 0.5, 0.12, 0.2);
    light(V(x - 0.5, 1.6, stepZ0 + 7), "#ff2a2a", 14, 9, 3);
    light(V(x + 0.5, 1.6, stepZ0 + 7), "#2e8bff", 14, 9, 3);
  }
  // Police searchlights from the hall roof rake the square through the rain.
  for (const [x, tx] of [[-12, -4], [12, 6]] as const) {
    const top = V(x, 21, zN + 2);
    const dir = V(tx - x, -21, 14 - (zN + 2)).normalize();
    cones.push({ top, dir, length: 46, radius: 5, color: C("#cfe6ff"), strength: 0.7 });
  }
  // Rain puddles pooled on the stone, catching the lamps and the billboard.
  for (const [x, z, w, d] of [[-4, 30, 5, 3], [7, 40, 4, 2.4], [-10, 6, 3.4, 5], [11, 0, 4.6, 2.6], [2, -8, 6, 2.4], [-5, -20, 3, 2], [14, 20, 3, 4.2], [-16, 44, 5, 2.4]] as const) {
    b.box("water", x, 0.012, z, w, 0.02, d);
  }
  // A red carpet up the middle of the council steps for the rally, with campaign banners on the portico.
  for (let i = 0; i < stepCount; i++) b.boxMinMax("paintRed", -2, (i + 1) * stepRise, stepZ0 - i * stepRun - stepRun, 2, (i + 1) * stepRise + 0.02, stepZ0 - i * stepRun);
  b.boxMinMax("paintRed", -2, 0.01, stepZ0, 2, 0.03, stepZ0 + 12);
  for (const x of [-10, -5, 0, 5, 10]) {
    b.box("paintRed", x + 1.6, top + 3.4, -46.4, 1.2, 3.6, 0.06, { uv: 1, cover: "thin", mat: "cloth" });
    b.box("glowAmber", x + 1.6, top + 1.5, -46.36, 0.7, 0.12, 0.04);
  }
  // Flagpoles on the hall roof with limp wet flags.
  for (const x of [-16, -8, 8, 16]) {
    b.cylinder("pipe", V(x, 20, zN + 3), V(x, 27, zN + 3), 0.08, 8, "metal");
    b.box("paintTeal", x + 0.9, 26, zN + 3, 1.6, 1.0, 0.04, { uv: 1, cover: "none" }); // flags on the roof, above the fight
  }
  // Rally stage lights either side of the lectern.
  for (const x of [-7, 7]) {
    b.box("darkMetal", x, top + 0.6, -49, 0.6, 1.2, 0.6, { cover: "thin", mat: "metal" });
    light(V(x, top + 1.4, -48), "#ffd9a0", 14, 10, 0);
  }

  // ---- Plan item 4: the rally, dressed. A truss rig frames the lectern, speaker stacks either side, a red
  // backdrop with his name, the city seal on the lectern, and press risers at the foot of the steps.
  for (const x of [-8.5, 8.5]) {
    for (const dx of [-0.25, 0.25])
      for (const dz of [-0.25, 0.25]) {
        b.cylinder("pipe", V(x + dx, top, -49 + dz), V(x + dx, top + 6.6, -49 + dz), 0.035, 6);
        b.tagLast("thin", "metal");
      }
    for (let y = top + 0.6; y < top + 6.6; y += 0.8) b.box("chrome", x, y, -49, 0.55, 0.03, 0.55, { cover: "none" });
    // Speaker stacks: two cabinets each, grilles facing the crowd.
    for (const [k, y] of [[0, 0.55], [1, 1.6]] as const) {
      b.box("blackPaint", x + (x < 0 ? 1.4 : -1.4), top + y, -47.6, 1.1, 1.0 - k * 0.05, 0.8, { collide: "metal" });
      b.box("grate", x + (x < 0 ? 1.4 : -1.4), top + y, -47.19, 0.9, 0.8, 0.02, { cover: "none" });
    }
  }
  for (const dz of [-0.25, 0.25]) for (const dy of [0, 0.5]) b.box("chrome", 0, top + 6.6 + dy, -49 + dz, 17.5, 0.05, 0.05, { cover: "none" });
  // Par cans hanging off the truss, aimed at the lectern.
  for (const x of [-6, -3, 3, 6]) {
    b.box("darkMetal", x, top + 6.25, -48.8, 0.3, 0.42, 0.3, { cover: "none" });
    b.box("glowWarm", x, top + 6.03, -48.7, 0.22, 0.03, 0.22, { cover: "none" });
    cones.push({ top: V(x, top + 6.0, -48.7), dir: V(-x * 0.06, -1, -0.12).normalize(), length: 6.4, radius: 1.3, color: C("#ffe2b0"), strength: 0.45 });
  }
  b.box("paintRed", 0, top + 3.5, -51.2, 9, 5.6, 0.06, { uv: 1, cover: "none" });
  signs.push({ text: "PELL", sub: "ORDER · SAFETY · HOLLOWELL", style: "box", color: "#ffe6c0", w: 6.5, h: 1.8, center: V(0, top + 4.6, -51.12), normal: V(0, 0, 1), flicker: 0, intensity: 1.6 });
  b.box("glowAmber", 0, top + 0.82, -49.62, 0.5, 0.5, 0.02, { cover: "none" }); // the city seal on the lectern
  for (const dx of [-0.18, 0.18]) b.cylinder("pipe", V(dx, top + 1.1, -50.1), V(dx * 0.6, top + 1.5, -49.85), 0.008, 5);
  // Press risers and camera tripods at the foot of the steps.
  for (const x of [-5.5, 5.5]) {
    b.boxMinMax("blackPaint", x - 1.2, 0, stepZ0 + 5.2, x + 1.2, 0.5, stepZ0 + 6.6, { collide: "metal" });
    for (const dx of [-0.6, 0.6]) {
      const c = V(x + dx, 0.5, stepZ0 + 5.9);
      for (const a of [0, 2.1, 4.2]) b.cylinder("pipe", V(c.x + Math.cos(a) * 0.3, 0.5, c.z + Math.sin(a) * 0.3), V(c.x, 1.9, c.z), 0.012, 4);
      b.box("blackPaint", c.x, 2.05, c.z, 0.22, 0.26, 0.5, { cover: "none" });
      b.box("glowRed", c.x + 0.08, 2.14, c.z + 0.26, 0.03, 0.03, 0.01, { cover: "none" });
    }
  }
  // Placards bobbing over the rally crowd: rally boards on poles, his and the protesters'.
  const placards: Array<[number, number, string]> = [[-6, -18, "paintRed"], [-2, -14, "plasticWhite"], [3, -19, "paintRed"], [7, -15, "plasticWhite"], [-8, -12, "yellowPaint"], [1, -11, "paintRed"], [5, -21, "plasticWhite"], [-4, -21, "yellowPaint"]];
  for (const [x, z, k] of placards) {
    b.cylinder("wood", V(x, 1.2, z), V(x, 2.5, z), 0.018, 4);
    b.box(k, x, 2.75, z, 0.9, 0.6, 0.03, { rotY: (x * 0.37) % 0.5, cover: "none" });
  }

  // ---- The market under the awnings: goods on the counters, a lit sign on each stall, string lights between.
  const stallNames: Array<[string, string, string]> = [["NOODLES", "OPEN LATE", "#ffb070"], ["UMBRELLAS", "CASH ONLY", "#7fe9ff"], ["PHONE FIX", "NO QUESTIONS", "#ff7fb0"], ["FISH", "FRESH TODAY", "#ffd27a"]];
  for (let i = 0; i < 4; i++) {
    const z = 22 + i * 7;
    const [name, sub, col] = stallNames[i]!;
    signs.push({ text: name, sub, style: "box", color: col, w: 2.6, h: 0.55, center: V(-19.2, 2.86, z), normal: V(1, 0, 0), flicker: i === 2 ? 2 : 0, intensity: 2.2 });
    b.box("blackPaint", -19.24, 2.86, z, 0.04, 0.62, 2.7, { cover: "none" });
    // Goods: crates of produce or stock on the counter and stacked beside it.
    const goods = i === 0 ? ["plasticWhite", "plasticRed"] : i === 1 ? ["blackPaint", "paintRed"] : i === 2 ? ["plasticWhite", "glowCyan"] : ["ice", "fish"];
    for (let k = 0; k < 5; k++) {
      const gz = z - 1.4 + k * 0.7;
      b.box("wood", -22, 1.06, gz, 0.6, 0.12, 0.5, { cover: "none" });
      b.box(goods[k % 2]!, -22, 1.17, gz, 0.5, 0.1, 0.4, { cover: "none" });
    }
    b.box("styro", -24.2, 0.3, z - 1.2, 0.7, 0.6, 0.5, { collide: "metal" });
    b.box("wood", -24.2, 0.9, z - 1.1, 0.6, 0.6, 0.6, { rotY: 0.3, cover: "none" });
    // A scalloped valance off the awning's front edge, the stripes running down it.
    for (let s = 0; s < 8; s++) {
      const vz = z - 1.75 + s * 0.5;
      b.box(s % 2 ? "paintRed" : "plasticWhite", -19.3, 2.37, vz, 0.03, 0.26, 0.5, { cover: "none" });
      b.shape(s % 2 ? "paintRed" : "plasticWhite", new THREE.CylinderGeometry(0.25, 0.25, 0.03, 10, 1, false, 0, Math.PI), V(-19.3, 2.24, vz), 0, undefined, 1, 0, -Math.PI / 2);
    }
    // The stall's back wall: lit shelves of stock seen past the counter, and a bare bulb on a flex.
    b.box("wood", -24.85, 1.4, z, 0.1, 2.8, 4.1, { collide: "metal" });
    interiors.push({ pos: V(-24.78, 1.45, z), normal: V(1, 0, 0), w: 3.6, h: 1.9, tint: col, seed: 40 + i });
    b.cylinder("cable", V(-21.2, 2.95, z + 0.9), V(-21.2, 2.2, z + 0.9), 0.006, 3);
    b.shape("glowWarm", new THREE.SphereGeometry(0.06, 6, 4), V(-21.2, 2.16, z + 0.9));
    // Hung stock along the awning's front: umbrellas at the umbrella stall, paper lanterns elsewhere.
    for (let k = 0; k < 4; k++) {
      const hz = z - 1.5 + k;
      if (i === 1) {
        b.shape(k % 2 ? "paintRed" : "blackPaint", new THREE.ConeGeometry(0.1, 0.8, 6), V(-19.8, 1.85, hz), 0, undefined, 1, Math.PI, 0);
        b.cylinder("chrome", V(-19.8, 2.25, hz), V(-19.8, 2.5, hz), 0.008, 3);
      } else {
        b.shape(k % 2 ? "glowRed" : "glowAmber", new THREE.CylinderGeometry(0.13, 0.13, 0.26, 8), V(-19.8, 2.0, hz));
      }
    }
  }
  for (const [za, zb] of [[20, 27], [27, 34], [34, 41], [41, 46]] as const) {
    const a = V(-19.4, 2.75, za);
    const c = V(-14.5, 4.2, zb);
    b.cable("cable", a, c, 0.5, 0.008);
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const p = new THREE.Vector3().lerpVectors(a, c, t);
      p.y -= 0.5 * 4 * t * (1 - t) + 0.05;
      b.shape(k % 4 ? "glowWarm" : "glowPink", new THREE.SphereGeometry(0.05, 6, 4), p);
      if (k === 4) light(p.clone(), "#ffc27a", 2.4, 5, 0, false);
    }
  }

  // Barriers and cover across the square.
  for (const [x, z] of [[-8, 30], [8, 24], [-6, -2], [6, 16], [0, -18], [-12, 14], [12, -22]] as const) {
    b.box("jersey", x, 0.45, z, 2.6, 0.9, 0.6, { collide: "concrete" });
  }
  // Plan item 4: the arrival. Her first view used to be a black mirror of wet stone; now the walk in from the tram
  // stop passes a lit news kiosk, a flower cart, bollard lamps pooling light on the setts and people heading up
  // to the rally.
  b.box("paintTeal", -8.5, 1.3, 42, 2.6, 2.6, 1.8, { collide: "metal" });
  b.box("paintTeal", -8.5, 2.75, 42.25, 3.2, 0.12, 2.6, { cover: "none" }); // roof overhang
  interiors.push({ pos: V(-8.5, 1.35, 42.92), normal: V(0, 0, 1), w: 2.2, h: 1.2, tint: "#c89a50", seed: 61 });
  signs.push({ text: "NEWS", sub: "PELL LEADS POLLS", style: "box", color: "#ffe0a0", w: 2.2, h: 0.5, center: V(-8.5, 2.35, 42.93), normal: V(0, 0, 1), flicker: 0, intensity: 2.2 });
  for (let k = 0; k < 3; k++) b.box(k % 2 ? "plasticWhite" : "paintRed", -10.45, 0.5 + k * 0.4, 42.6, 0.5, 0.32, 0.04, { rotY: 0.2, cover: "none" }); // headline boards
  light(V(-8.5, 1.6, 44.2), "#ffcf8a", 12, 6, 0, true);
  // The flower cart: a wooden barrow under a little parasol, buckets of red and yellow, a warm bulb.
  b.box("wood", 9, 0.75, 40, 2.0, 0.5, 1.0, { collide: "metal" });
  for (const dx of [-0.8, 0.8]) b.cylinder("rubber", V(9 + dx, 0.3, 39.45), V(9 + dx, 0.3, 40.55), 0.3, 10);
  for (let k = 0; k < 6; k++) {
    const x = 8.3 + (k % 3) * 0.7;
    const z = 39.75 + Math.floor(k / 3) * 0.5;
    b.cylinder("darkMetal", V(x, 1.0, z), V(x, 1.28, z), 0.16, 8);
    b.shape(k % 2 ? "paintRed" : "yellowPaint", new THREE.SphereGeometry(0.22, 7, 5), V(x, 1.38, z), 0, V(1, 0.6, 1));
  }
  b.cylinder("pipe", V(9, 1.0, 40), V(9, 2.5, 40), 0.025, 5);
  b.shape("paintRed", new THREE.ConeGeometry(1.3, 0.45, 10, 1, true), V(9, 2.6, 40));
  b.shape("glowWarm", new THREE.SphereGeometry(0.06, 6, 4), V(9, 2.3, 40));
  light(V(9, 2.2, 40.6), "#ffb870", 9, 6, 0, true);
  // Bollard lamps along the walk up from the tram stop.
  for (const z of [44, 34, 24]) {
    for (const x of [-3.2, 3.2]) {
      b.cylinder("darkMetal", V(x, 0, z), V(x, 0.95, z), 0.11, 8, "metal");
      b.box("glowWarm", x, 0.82, z, 0.17, 0.1, 0.17, { cover: "none" });
      cones.push({ top: V(x, 0.82, z), dir: V(0, -1, 0), length: 0.9, radius: 1.6, color: C("#ffcf9a"), strength: 0.3 });
    }
    light(V(0, 0.9, z), "#ffc88a", 9, 6, 0, z === 44);
  }
  // The tram stop at the south end is the way out.
  b.box("glowRed", 0, 3.2, zS - 0.05, 1.2, 0.3, 0.05);
  light(V(0, 2.8, zS - 1.5), "#ff2a2a", 8, 6, 0);

  const markers: Level["markers"] = {
    player: [V(0, 0, zS - 4)],
    // Rooftop marksmen: the west market block and the north-east block.
    perch: [V(-34, 12, 28), V(34, 8, -24)],
    extract: [V(0, 0, zS - 1.5)],
    // Pell's permit strongbox sits at the back of the market awnings, guards around it.
    "lead:register": [V(-24.2, 0, 31)],
    "lead:guard": [V(-20, 0, 26), V(-20, 0, 34), V(-26, 0, 36), V(-16, 0, 30)],
    "lead:sniper": [V(-34, 12, 20)],
    // Pell on the landing behind his shield line; the ambush comes from both flanks and the square.
    "boss:pell": [V(0, top, -52), V(2, top, -52)],
    "boss:guard": [V(-5, top, -44), V(5, top, -44), V(-8, top, -46), V(8, top, -46)],
    "boss:reinforce": [V(-26, 0, -6), V(-24, 0, -10), V(24, 0, -30), V(26, 0, -26), V(0, 0, -14), V(-2, 0, -16)],
    "patrol:plaza-a": [V(-6, 0, 36), V(6, 0, 36), V(6, 0, 18), V(-6, 0, 18)],
    "patrol:plaza-b": [V(10, 0, 4), V(-10, 0, 4), V(-10, 0, -8), V(10, 0, -8)],
    "patrol:shield-steps": [V(-6, 0, -22), V(6, 0, -22)],
    "patrol:market": [V(-14, 0, 24), V(-14, 0, 38), V(-8, 0, 38), V(-8, 0, 24)],
    // The rally crowd: bystanders drifting round the fountain, the stalls, the tram stop and the steps.
    "patrol:civ-fountain-a": [V(5, 0, 8), V(0, 0, 13), V(-5, 0, 8), V(0, 0, 3)],
    "patrol:civ-fountain-b": [V(-6, 0, 12), V(6, 0, 12), V(6, 0, 4), V(-6, 0, 4)],
    "patrol:civ-market-a": [V(-17, 0, 22), V(-17, 0, 34)],
    "patrol:civ-market-b": [V(-19, 0, 40), V(-12, 0, 40)],
    "patrol:civ-tram-a": [V(24, 0, 40), V(24, 0, 48)],
    "patrol:civ-tram-b": [V(18, 0, 30), V(18, 0, 38)],
    "patrol:civ-rally-a": [V(-6, 0, -20), V(-3, 0, -17), V(-6, 0, -14)],
    "patrol:civ-rally-b": [V(4, 0, -20), V(7, 0, -16), V(3, 0, -14)],
    "patrol:civ-rally-c": [V(-1, 0, -24), V(2, 0, -21)],
    "patrol:police-a": [V(-12, 0, 14), V(12, 0, 14), V(12, 0, -2), V(-12, 0, -2)],
    "patrol:police-b": [V(20, 0, 44), V(20, 0, 24), V(-4, 0, 30)],
    "patrol:sniper-roof": [V(34, 8, -4)],
    // C20: the ED mech guards the approach to the steps and lobs missile volleys once it sees her.
    "patrol:mech-steps": [V(-12, 0, -34), V(12, 0, -34)],
  };

  // The rally crowd packs the square below the steps facing Pell; shoppers under the awnings, a queue at the
  // tram stop and stragglers round the fountain (counts are scaled down on phones in world.ts).
  const crowds: CrowdGroup[] = [
    { x: 0, z: -16, count: 70, radius: 0, rect: [20, 11], face: [0, -50], seed: 11 },
    { x: -8, z: -6, count: 14, radius: 3.5, face: [0, -50], seed: 12 },
    { x: 8, z: -8, count: 12, radius: 3.5, face: [0, -50], seed: 13 },
    { x: 0, z: 8, count: 12, radius: 7.2, seed: 14 },
    { x: -18.5, z: 32, count: 16, radius: 0, rect: [3, 22], face: [-22, 32], seed: 15 },
    { x: 20.5, z: 41, count: 10, radius: 0, rect: [3, 8], face: [24.6, 46], seed: 16 },
    { x: 0, z: 28, count: 6, radius: 4.5, face: [0, -50], seed: 17 },
    { x: -6, z: 46, count: 3, radius: 1.4, face: [-8.5, 42], seed: 18 },
  ];

  const key = { pos: V(-14, 17, 46), target: V(0, 0, -6), color: C("#ffe9c8") };
  return {
    builder: b,
    markers,
    crowds,
    boards,
    lights,
    signs,
    windows,
    cones,
    posters: [],
    vending: [],
    interiors,
    vents: [V(-22, 3, 28), V(26, 8, -6)],
    drips: [V(-22, 2.6, 22), V(-22, 2.6, 36), V(24, 6.2, 20)],
    bulbs: [],
    shelters,
    key,
    groundHeight: plazaGround,
    theme: {
      name: "Hollowell Plaza",
      loading: "Rain on stone, a rally waiting…",
      fog: [0.006, 0.008, 0.012],
      fogDensity: 0.011,
      volMin: V(xW - 8, -1, zN - 8),
      volMax: V(xE + 8, 22, zS + 6),
      probe: V(0, 2, 10),
      outdoor: true,
      water: false,
      bounds: { xMin: xW + 0.5, xMax: xE - 0.5, zMin: zN + 0.6, zMax: zS - 0.6 },
      len: zS - zN,
    },
  };
}
