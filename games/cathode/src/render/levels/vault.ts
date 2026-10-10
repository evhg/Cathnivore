// The Hollow Vault (act 5, HollowCandor): industrial and cold. A gate hall and clerk's cage at the south, then a
// 60 m chasm of data stacks breathing coolant fog, crossed by a central bridge and two flank gantries, and at the
// north end the vault core: a ring of pylons round the glowing machine that is HollowCandor, under red alarm lamps.

import * as THREE from "three";
import { Builder } from "../builder";
import type { Level, SignDef, VLight } from "../level";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const C = (hex: string) => new THREE.Color(hex);

export const VAULT = { xW: -16, xE: 16, zS: 56, zN: -66, chasmN: -30, chasmS: 30, drop: -12, bridgeHalf: 2.5, gantryIn: 12 } as const;

/** Floor height under (x, z): solid at 0 on the gate hall, bridge, gantries, cross-bridges and core; the chasm floor elsewhere. */
export function vaultGround(x: number, z: number): number {
  const { chasmN, chasmS, drop, bridgeHalf, gantryIn } = VAULT;
  if (z >= chasmS || z <= chasmN) return 0;
  const ax = Math.abs(x);
  if (ax <= bridgeHalf || ax >= gantryIn) return 0;
  if (Math.abs(z - 12) <= 1.5 || Math.abs(z + 12) <= 1.5) return 0;
  return drop;
}

export function buildVault(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const lights: VLight[] = [];
  const signs: SignDef[] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = true) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: seed++, real });
  const { xW, xE, zS, zN, chasmN, chasmS, drop, bridgeHalf, gantryIn } = VAULT;
  const ceil = 18;

  // Shell: gate hall and core floors, the chasm floor, walls, ceiling.
  b.boxMinMax("concreteB", xW, -0.5, chasmS, xE, 0, zS, { uv: 3, skip: ["bottom"], collide: "concrete" });
  b.boxMinMax("concreteB", xW, -0.5, zN, xE, 0, chasmN, { uv: 3, skip: ["bottom"], collide: "concrete" });
  b.boxMinMax("darkMetal", xW, drop - 0.5, chasmN, xE, drop, chasmS, { uv: 3, collide: "metal" });
  b.boxMinMax("concreteA", xW - 0.5, drop - 0.5, zN, xW, ceil + 0.5, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xE, drop - 0.5, zN, xE + 0.5, ceil + 0.5, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW, drop - 0.5, zS, xE, ceil + 0.5, zS + 0.5, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW, drop - 0.5, zN - 0.5, xE, ceil + 0.5, zN, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteB", xW, ceil, zN, xE, ceil + 0.5, zS, { uv: 2, collide: "concrete" });

  // The chasm: the bridge, flank gantries and two cross-bridges, all grated steel with rails.
  const deck = (x0: number, z0: number, x1: number, z1: number) => b.boxMinMax("grate", x0, -0.3, z0, x1, 0, z1, { uv: 2, collide: "metal" });
  deck(-bridgeHalf, chasmN, bridgeHalf, chasmS);
  deck(xW, chasmN, -gantryIn, chasmS);
  deck(gantryIn, chasmN, xE, chasmS);
  for (const z of [12, -12]) {
    deck(-gantryIn, z - 1.5, -bridgeHalf, z + 1.5);
    deck(bridgeHalf, z - 1.5, gantryIn, z + 1.5);
  }
  for (const s of [-1, 1]) {
    // Rails along the bridge, the gantry inner edges and the cross-bridge sides.
    b.boxMinMax("pipe", s * bridgeHalf - 0.04, 0, chasmN, s * bridgeHalf + 0.04, 1.1, 10.5, { collide: "metal" });
    b.boxMinMax("pipe", s * bridgeHalf - 0.04, 0, 13.5, s * bridgeHalf + 0.04, 1.1, chasmS, { collide: "metal" });
    b.boxMinMax("pipe", s * bridgeHalf - 0.04, 0, -10.5, s * bridgeHalf + 0.04, 1.1, 10.5, { collide: "metal" });
    b.boxMinMax("pipe", s * bridgeHalf - 0.04, 0, chasmN, s * bridgeHalf + 0.04, 1.1, -13.5, { collide: "metal" });
    b.boxMinMax("pipe", s * gantryIn - 0.04, 0, chasmN, s * gantryIn + 0.04, 1.1, 10.5, { collide: "metal" });
    b.boxMinMax("pipe", s * gantryIn - 0.04, 0, -10.5, s * gantryIn + 0.04, 1.1, 10.5, { collide: "metal" });
  }

  // Data stacks lining both chasm walls from the floor to the ceiling, glowing in the coolant fog.
  for (let z = chasmS - 3; z > chasmN + 2; z -= 3.2) {
    for (const s of [-1, 1]) {
      const x = s * (xE - 0.7);
      b.box("darkMetal", x, (ceil + drop) / 2, z, 1.0, ceil - drop, 2.6);
      for (let y = drop + 2; y < ceil - 2; y += 4.2) b.box("glowCyan", x - s * 0.52, y, z, 0.04, 0.5, 2.0);
    }
  }
  light(V(-14, -4, 0), "#2ee6ff", 30, 18, 1, false);
  light(V(14, -4, 0), "#2ee6ff", 30, 18, 1, false);
  light(V(0, drop + 1, 0), "#2e8bff", 40, 20, 0, false); // coolant glow from the bottom

  // Gate hall (south): a clerk's cage with a ledger, bars, a counter; the vault lift at the very south.
  b.boxMinMax("pipe", -12, 0, 36, -6, 3, 36.1, { collide: "metal" });
  b.boxMinMax("pipe", -12, 0, 44, -6, 3, 44.1, { collide: "metal" });
  b.boxMinMax("pipe", -12, 0, 36, -11.9, 3, 44, { collide: "metal" });
  b.box("paintMetal", -9, 0.5, 40, 3, 1.0, 1.0, { collide: "metal" });
  b.box("glowAmber", -9, 1.1, 40, 0.6, 0.1, 0.4);
  for (const x of [-8, 8]) for (const z of [48, 36]) b.box("concreteA", x, ceil / 2, z, 1.4, ceil, 1.4, { collide: "concrete" });
  b.boxMinMax("blackPaint", -3, 0, zS - 0.2, 3, 4.5, zS, { uv: 1 });
  b.box("glowCool", 0, 2.2, zS - 0.25, 4.6, 3.4, 0.04);
  signs.push({ text: "VAULT LIFT", sub: "AUTHORISED DEBTORS ONLY", style: "box", color: "#2ee6ff", w: 3, h: 0.5, center: V(0, 4.9, zS - 0.3), normal: V(0, 0, -1), flicker: 1, intensity: 3 });
  b.box("glowRed", 0, 5.8, zS - 0.1, 1.4, 0.3, 0.05);
  signs.push({ text: "HOLLOW VAULT", sub: "WHERE CANDOR KEEPS ITS DEBTS", style: "screen", color: "#ff5a4a", w: 9, h: 2, center: V(0, 9, chasmS + 0.5), normal: V(0, 0, 1), flicker: 2, intensity: 2.4 });

  // Vault core (north): the great door behind the machine, pylons, the glowing core and red alarm lamps.
  b.box("darkMetal", 0, 6, zN + 1, 14, 12, 1.2);
  b.cylinder("rust", V(0, 6, zN + 1.7), V(0, 6, zN + 2.0), 5.5, 24);
  for (const [x, z] of [[-7, -44], [7, -44], [-7, -58], [7, -58]] as const) {
    b.box("concreteA", x, 3, z, 1.2, 6, 1.2, { collide: "concrete" });
    b.box("glowRed", x, 5, z + 0.62, 0.3, 2.4, 0.04);
  }
  b.cylinder("darkMetal", V(0, 0, -51), V(0, 8, -51), 1.4, 12, "metal");
  b.cylinder("glowCyan", V(0, 1, -51), V(0, 7, -51), 1.5, 12);
  light(V(0, 5, -49), "#2ee6ff", 80, 22, 1);
  for (const [x, z] of [[-10, -38], [10, -38], [-10, -62], [10, -62], [0, -34]] as const) {
    b.box("glowRed", x, ceil - 1, z, 0.6, 0.3, 0.6);
    light(V(x, ceil - 1.5, z), "#ff2a2a", 40, 18, 3);
  }
  for (const z of [50, 40, 30]) light(V(0, ceil - 2, z), "#a8d8ff", 40, 16, z === 40 ? 2 : 0);
  for (const z of [10, -10, -20]) light(V(0, 4, z), "#8fb8ff", 20, 14, 0, false);

  const markers: Level["markers"] = {
    player: [V(0, 0, zS - 4)],
    perch: [V(-14, 0, 10), V(14, 0, -10)],
    extract: [V(0, 0, zS - 1.5)],
    "lead:register": [V(-9, 0, 40)],
    "lead:guard": [V(-7, 0, 34), V(-7, 0, 46), V(-3, 0, 40), V(-3, 0, 32)],
    "lead:sniper": [V(14, 0, 24)],
    "boss:core": [V(0, 0, -53), V(2, 0, -53)],
    "boss:guard": [V(-4, 0, -46), V(4, 0, -46), V(-8, 0, -50), V(8, 0, -50)],
    "boss:sniper": [V(-14, 0, -34), V(14, 0, -34)],
    "boss:reinforce": [V(-12, 0, -40), V(-10, 0, -42), V(12, 0, -40), V(10, 0, -42), V(-6, 0, -36), V(6, 0, -36)],
    "patrol:gate": [V(-4, 0, 50), V(4, 0, 50), V(4, 0, 36), V(-4, 0, 36)],
    "patrol:shield-bridge": [V(0, 0, 22), V(0, 0, -22)],
    "patrol:walk-west": [V(-14, 0, 26), V(-14, 0, -26)],
    "patrol:walk-east": [V(14, 0, -26), V(14, 0, 26)],
    "patrol:core": [V(-5, 0, -40), V(5, 0, -40)],
    "patrol:turret-bridge-w": [V(-13, 0, 22)],
    "patrol:turret-bridge-e": [V(13, 0, -22)],
    "patrol:turret-core-w": [V(-9, 0, -40)],
    "patrol:turret-core-e": [V(9, 0, -40)],
    "patrol:hunter-chasm-a": [V(-14, 0, 6), V(-14, 0, -6), V(-6, 0, 12), V(-6, 0, -12)],
    "patrol:hunter-chasm-b": [V(14, 0, -6), V(14, 0, 6), V(6, 0, -12), V(6, 0, 12)],
    "patrol:sniper-gantry": [V(-14, 0, -18)],
  };

  return {
    builder: b,
    markers,
    lights,
    signs,
    windows: [],
    cones: [],
    posters: [],
    vending: [],
    interiors: [],
    vents: [V(-14, drop + 1, 0), V(14, drop + 1, 0), V(0, drop + 1, -10)],
    drips: [V(-10, ceil, 40), V(10, ceil, -40)],
    bulbs: [],
    shelters: [new THREE.Box3(V(xW - 20, -20, zN - 20), V(xE + 20, 40, zS + 20))],
    key: { pos: V(0, ceil - 1, 48), target: V(0, 0, 10), color: C("#cfe6ff") },
    groundHeight: vaultGround,
    theme: {
      name: "The Hollow Vault",
      signature: "alarm",
      loading: "Coolant fog, red alarms…",
      fog: [0.006, 0.01, 0.016],
      fogDensity: 0.016,
      volMin: V(xW - 2, drop - 1, zN - 4),
      volMax: V(xE + 2, ceil + 2, zS + 4),
      probe: V(0, 3, 20),
      outdoor: false,
      bounds: { xMin: xW + 0.4, xMax: xE - 0.4, zMin: zN + 0.6, zMax: zS - 0.6 },
      len: zS - zN,
    },
  };
}
