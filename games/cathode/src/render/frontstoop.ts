// Plan item 338: the class pick staged in a real place. She stood before a bare wall on an empty floor; now she
// waits on a back-alley stoop: a stone door frame round a dark panelled door with a lit fanlight, a bare bulb
// over it, the bulb's warm wash on the brick and a warm pool on the wet step and cobbles. No live light (one more
// pooled light cost ~500 ms on the pick's class change under SwiftShader, DECISIONS 2026-11-13): the bulb is an
// HDR mesh the bloom haloes, and its light is baked into additive gradients. The set only shows on the pick (its
// weight follows the wardrobe's), so the title's camera loop never meets it.

import * as THREE from "three";
import { LAYER_NO_REFLECT } from "./reflection";

export interface FrontStoop {
  readonly group: THREE.Group;
  /** `w` the pick's weight (0 on the title, 1 settled on the pick). */
  update(w: number, cls: string | null): void;
  dispose(): void;
}

/** A tungsten bulb's warm white (linear). */
const BULB = new THREE.Color(1.0, 0.62, 0.3);

function radial(stops: Array<[number, number]>, size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, a] of stops) r.addColorStop(at, `rgba(255,255,255,${a})`);
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(c);
}

/** The door: dark painted panels, a brass knob and letter plate, a fanlight glowing amber behind its glazing bars. */
function doorTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#1a1416";
    g.fillRect(0, 0, 128, 256);
    // The fanlight over the door (the top 18%): amber glass behind three bars.
    const fan = g.createLinearGradient(0, 0, 0, 44);
    fan.addColorStop(0, "#f2b366");
    fan.addColorStop(1, "#b0662c");
    g.fillStyle = fan;
    g.fillRect(8, 6, 112, 34);
    g.fillStyle = "#0c0a0b";
    for (const x of [40, 64, 88]) g.fillRect(x - 2, 6, 4, 34);
    g.fillRect(0, 40, 128, 6);
    // Four raised panels, lit from above.
    for (const [x, y, w, h] of [
      [14, 56, 44, 82],
      [70, 56, 44, 82],
      [14, 150, 44, 92],
      [70, 150, 44, 92],
    ] as const) {
      g.fillStyle = "#231b1d";
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,200,150,0.14)";
      g.fillRect(x, y, w, 2);
      g.fillStyle = "rgba(0,0,0,0.55)";
      g.fillRect(x, y + h - 2, w, 2);
      g.fillRect(x + w - 2, y, 2, h);
    }
    // Brass: the knob and the letter plate.
    g.fillStyle = "#b08a4a";
    g.beginPath();
    g.arc(106, 148, 4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(48, 143, 32, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Builds the stoop in her local frame (x across, y up, z toward the pick's lens): `feet` her standing point,
 * `yaw` her facing. The door stands `back` metres behind her, `side` metres across.
 */
export function buildFrontStoop(feet: THREE.Vector3, yaw: number, groundY: number, back = 2.1, side = 0.1): FrontStoop {
  const group = new THREE.Group();
  group.name = "front-stoop";
  group.position.set(feet.x, groundY, feet.z);
  group.rotation.y = yaw;
  group.visible = false;
  const disposables: Array<{ dispose(): void }> = [];
  const fading: Array<{ mat: THREE.Material & { opacity: number }; base: number }> = [];
  const fade = <M extends THREE.Material & { opacity: number }>(mat: M): M => {
    mat.transparent = true;
    fading.push({ mat, base: mat.opacity });
    disposables.push(mat);
    return mat;
  };
  const geo = <G extends THREE.BufferGeometry>(g: G): G => {
    disposables.push(g);
    return g;
  };
  const add = (m: THREE.Object3D) => {
    m.layers.enable(LAYER_NO_REFLECT);
    group.add(m);
    return m;
  };
  const z0 = -back;
  // The bulb hangs on a short flex from the lintel, in front of the fanlight and right of her, so it shows between
  // her and the sheet on the pick's close framing (over the lintel it fell out of the top of the frame).
  const DW = 1.0;
  const DH = 2.15;
  const BX = side + 0.26;
  const BY = 1.8;

  // The stone surround: two jambs and a lintel, lit warm from the bulb above.
  const stone = fade(new THREE.MeshStandardMaterial({ color: 0x5b5048, roughness: 0.85, emissive: BULB, emissiveIntensity: 0.05 }));
  for (const sx of [-1, 1]) {
    const jamb = add(new THREE.Mesh(geo(new THREE.BoxGeometry(0.2, DH + 0.1, 0.24)), stone));
    jamb.position.set(side + sx * (DW / 2 + 0.1), (DH + 0.1) / 2, z0 + 0.1);
  }
  const lintel = add(new THREE.Mesh(geo(new THREE.BoxGeometry(DW + 0.6, 0.24, 0.3)), stone));
  lintel.position.set(side, DH + 0.22, z0 + 0.12);
  // The step she'd come down: a worn slab, wet.
  const slab = fade(new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.35, metalness: 0.1 }));
  const step = add(new THREE.Mesh(geo(new THREE.BoxGeometry(DW + 0.7, 0.16, 0.5)), slab));
  step.position.set(side, 0.08, z0 + 0.3);

  // The door, set back in the frame.
  const doorMat = fade(new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.6, emissive: 0xffffff, emissiveMap: null }));
  disposables.push(doorMat.map!);
  // The fanlight glows on its own: an emissive copy of the texture.
  doorMat.emissiveMap = doorMat.map;
  doorMat.emissiveIntensity = 0.16;
  const door = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(DW, DH)), doorMat));
  door.position.set(side, DH / 2, z0 + 0.02);

  // The bare bulb on a bracket over the lintel, HDR so the bloom haloes it.
  const iron = fade(new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5, metalness: 0.6 }));
  const flexLen = DH + 0.1 - (BY + 0.12);
  const bracket = add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.006, 0.006, flexLen, 5)), iron));
  bracket.position.set(BX, BY + 0.12 + flexLen / 2, z0 + 0.32);
  const cap = add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 10)), iron));
  cap.position.set(BX, BY + 0.09, z0 + 0.32);
  const bulbMat = fade(new THREE.MeshBasicMaterial({ color: BULB.clone().multiplyScalar(9), fog: false }));
  const bulb = add(new THREE.Mesh(geo(new THREE.SphereGeometry(0.045, 14, 10)), bulbMat));
  bulb.position.set(BX, BY, z0 + 0.32);

  // Its light, baked: a halo round the bulb, a wash on the wall and frame, a pool on the step and cobbles.
  const glowTex = radial([
    [0, 0.9],
    [0.15, 0.45],
    [0.5, 0.12],
    [1, 0],
  ]);
  const washTex = radial([
    [0, 0.55],
    [0.35, 0.28],
    [0.7, 0.08],
    [1, 0],
  ]);
  disposables.push(glowTex, washTex);
  const additive = (map: THREE.Texture, color: THREE.Color, opacity: number) =>
    fade(new THREE.MeshBasicMaterial({ map, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  const halo = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(0.9, 0.9)), additive(glowTex, BULB.clone().multiplyScalar(1.6), 0.85)));
  halo.position.set(BX, BY, z0 + 0.36);
  const wash = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(3.6, 3.4)), additive(washTex, BULB, 0.8)));
  wash.position.set(BX - 0.3, BY - 0.2, z0 + 0.25);
  const pool = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(3.0, 2.4)), additive(washTex, BULB, 0.6)));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(BX - 0.4, 0.02, z0 + 1.1);
  const stepLit = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(DW + 0.7, 0.5)), additive(washTex, BULB, 0.5)));
  stepLit.rotation.x = -Math.PI / 2;
  stepLit.position.set(side, 0.165, z0 + 0.3);
  for (const m of [halo, wash, pool, stepLit]) m.renderOrder = 2;

  let shown = -1;
  return {
    group,
    update(w) {
      const k = Math.max(0, Math.min(1, (w - 0.05) / 0.9));
      group.visible = k > 0.001;
      if (Math.abs(k - shown) < 1e-4) return;
      shown = k;
      for (const f of fading) {
        f.mat.opacity = f.base * k;
        // Settled, the solid parts draw opaque (sorted and depth-written like the street).
        if (f.mat.blending !== THREE.AdditiveBlending && f.mat.transparent !== k < 0.999) {
          f.mat.transparent = k < 0.999;
          f.mat.depthWrite = k >= 0.999;
          f.mat.needsUpdate = true;
        }
      }
    },
    dispose() {
      group.removeFromParent();
      for (const d of disposables) d.dispose();
    },
  };
}
