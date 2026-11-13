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
  const fading: Array<{
    mat: THREE.Material & { opacity: number };
    base: number;
    decal?: boolean;
  }> = [];
  const fade = <M extends THREE.Material & { opacity: number }>(mat: M, decal = false): M => {
    mat.transparent = true;
    fading.push({ mat, base: mat.opacity, decal });
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
  /** The class prop's offset across, on the far side of her from the bulb. */
  const PX = 1.3;

  // The stone surround: two jambs and a lintel, lit warm from the bulb above.
  const stone = fade(
    new THREE.MeshStandardMaterial({
      color: 0x5b5048,
      roughness: 0.85,
      emissive: BULB,
      emissiveIntensity: 0.05,
    }),
  );
  for (const sx of [-1, 1]) {
    const jamb = add(new THREE.Mesh(geo(new THREE.BoxGeometry(0.2, DH + 0.1, 0.24)), stone));
    jamb.position.set(side + sx * (DW / 2 + 0.1), (DH + 0.1) / 2, z0 + 0.1);
  }
  const lintel = add(new THREE.Mesh(geo(new THREE.BoxGeometry(DW + 0.6, 0.24, 0.3)), stone));
  lintel.position.set(side, DH + 0.22, z0 + 0.12);
  // The step she'd come down: a worn slab, wet.
  const slab = fade(
    new THREE.MeshStandardMaterial({
      color: 0x3a3532,
      roughness: 0.35,
      metalness: 0.1,
    }),
  );
  const step = add(new THREE.Mesh(geo(new THREE.BoxGeometry(DW + 0.7, 0.16, 0.5)), slab));
  step.position.set(side, 0.08, z0 + 0.3);

  // The door, set back in the frame.
  const doorMat = fade(
    new THREE.MeshStandardMaterial({
      map: doorTexture(),
      roughness: 0.6,
      emissive: 0xffffff,
      emissiveMap: null,
    }),
  );
  disposables.push(doorMat.map!);
  // The fanlight glows on its own: an emissive copy of the texture.
  doorMat.emissiveMap = doorMat.map;
  doorMat.emissiveIntensity = 0.16;
  const door = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(DW, DH)), doorMat));
  door.position.set(side, DH / 2, z0 + 0.02);

  // The bare bulb on a bracket over the lintel, HDR so the bloom haloes it.
  const iron = fade(
    new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.5,
      metalness: 0.6,
    }),
  );
  const flexLen = DH + 0.1 - (BY + 0.12);
  const bracket = add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.006, 0.006, flexLen, 5)), iron));
  bracket.position.set(BX, BY + 0.12 + flexLen / 2, z0 + 0.32);
  const cap = add(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 10)), iron));
  cap.position.set(BX, BY + 0.09, z0 + 0.32);
  const bulbMat = fade(
    new THREE.MeshBasicMaterial({
      color: BULB.clone().multiplyScalar(9),
      fog: false,
    }),
  );
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
    fade(
      new THREE.MeshBasicMaterial({
        map,
        color,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
  const halo = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(0.9, 0.9)), additive(glowTex, BULB.clone().multiplyScalar(1.6), 0.85)));
  halo.position.set(BX, BY, z0 + 0.36);
  const wash = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(3.6, 3.4)), additive(washTex, BULB, 1.0)));
  wash.position.set(BX - 0.3, BY - 0.2, z0 + 0.25);
  const pool = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(3.0, 2.4)), additive(washTex, BULB, 0.85)));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(BX - 0.4, 0.02, z0 + 1.1);
  const stepLit = add(new THREE.Mesh(geo(new THREE.PlaneGeometry(DW + 0.7, 0.5)), additive(washTex, BULB, 0.85)));
  stepLit.rotation.x = -Math.PI / 2;
  stepLit.position.set(side, 0.165, z0 + 0.3);
  // A broad, soft warm fill on the cobbles toward the lens, so the near floor she stands on isn't black. Kept dim
  // and set back from her feet, so her contact shadow lands on floor the fill doesn't wash out.
  const nearPool = add(
    new THREE.Mesh(geo(new THREE.PlaneGeometry(5.0, 3.0)), additive(washTex, BULB.clone().lerp(new THREE.Color(1, 1, 1), 0.2), 0.22)),
  );
  nearPool.rotation.x = -Math.PI / 2;
  nearPool.position.set(-0.4, 0.015, z0 + 2.4);
  for (const m of [halo, wash, pool, stepLit, nearPool]) m.renderOrder = 2;

  // Her contact shadow: an ambient-occlusion blot right under her boots, darker than the lit floor round it, so she
  // meets the ground instead of floating. Multiplied onto the floor (a dark normal-blend decal drawn last).
  const aoTex = radial([
    [0, 0.7],
    [0.3, 0.42],
    [0.55, 0.16],
    [0.8, 0.03],
    [1, 0],
  ]);
  disposables.push(aoTex);
  const ao = add(
    new THREE.Mesh(
      geo(new THREE.PlaneGeometry(0.72, 0.42)),
      fade(
        new THREE.MeshBasicMaterial({
          map: aoTex,
          color: 0x000000,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          fog: false,
        }),
        true,
      ),
    ),
  );
  ao.rotation.x = -Math.PI / 2;
  // Tucked right under her boots (slightly back), so her coat and boots hide its body and only the forward contact
  // fringe reads — a soft shadow at her feet, not a mat laid in front of her.
  ao.position.set(0, 0.02, -0.08);
  ao.renderOrder = 3;

  // Each class leaves one prop at the door, so switching class changes the set as well as her (plan item 338): the
  // Ghost's spotting scope on its tripod, the Butcher's hook and a side of meat on a chain from the lintel, the
  // Gunslinger's wanted bill pasted on the brick, the Wirewitch's junction box spilling lit cable, the Fixer's case
  // of cash on the step. Built once, one shown at a time; plain meshes lit by the street's existing lights.
  const props = new Map<string, THREE.Group>();
  const prop = (cls: string) => {
    const g = new THREE.Group();
    g.visible = false;
    group.add(g);
    props.set(cls, g);
    return g;
  };
  const put = (g: THREE.Group, m: THREE.Mesh, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    m.layers.enable(LAYER_NO_REFLECT);
    g.add(m);
    return m;
  };
  const steel = fade(
    new THREE.MeshStandardMaterial({
      color: 0x8a8d92,
      roughness: 0.3,
      metalness: 0.9,
    }),
  );
  {
    // Ghost: a spotting scope on a tripod, left of her on the cobbles.
    const g = prop("ghost");
    // Three legs from a head at 1.25 m to feet splayed 0.32 m out, then the scope on top, tilted up the street.
    const head = new THREE.Vector3(-PX, 1.2, z0 + 0.55);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const foot = new THREE.Vector3(-PX + Math.cos(a) * 0.32, 0, z0 + 0.55 + Math.sin(a) * 0.32);
      const d = head.clone().sub(foot);
      const m = put(g, new THREE.Mesh(geo(new THREE.CylinderGeometry(0.016, 0.012, d.length(), 6)), iron), 0, 0, 0);
      m.position.copy(foot).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(up, d.normalize());
    }
    const scope = put(g, new THREE.Mesh(geo(new THREE.CylinderGeometry(0.05, 0.036, 0.46, 14)), iron), -PX, 1.27, z0 + 0.55);
    scope.rotation.set(0, 0, Math.PI / 2 + 0.2);
    put(
      g,
      new THREE.Mesh(
        geo(new THREE.TorusGeometry(0.058, 0.01, 6, 16)),
        fade(
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.3, 0.9, 1.1),
            fog: false,
          }),
        ),
      ),
      -PX - 0.23,
      1.22,
      z0 + 0.55,
    );
  }
  props.get("ghost")!.children.at(-1)!.rotation.y = Math.PI / 2;
  {
    // Butcher: a meat hook on a chain from the lintel, a side of meat on it.
    const g = prop("butcher");
    put(g, new THREE.Mesh(geo(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 5)), steel), -PX, DH - 0.05, z0 + 0.45);
    const hook = put(g, new THREE.Mesh(geo(new THREE.TorusGeometry(0.07, 0.012, 6, 14, Math.PI * 1.4)), steel), -PX, DH - 0.46, z0 + 0.45);
    hook.rotation.z = Math.PI * 0.8;
    const meatMat = fade(
      new THREE.MeshStandardMaterial({
        color: 0x7a1f1c,
        roughness: 0.45,
        emissive: 0x3a0806,
        emissiveIntensity: 0.4,
      }),
    );
    // A hung leg of meat: a lathed haunch, wide at the foot, narrowing to a bone knuckle under the hook.
    const prof = [
      [0.0, -0.42],
      [0.14, -0.38],
      [0.2, -0.22],
      [0.19, 0.0],
      [0.14, 0.18],
      [0.08, 0.3],
      [0.05, 0.36],
      [0.0, 0.37],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const meat = put(g, new THREE.Mesh(geo(new THREE.LatheGeometry(prof, 14)), meatMat), -PX, DH - 0.98, z0 + 0.45);
    meat.scale.set(1, 1, 0.6);
    const boneMat = fade(new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.6 }));
    put(g, new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8)), boneMat), -PX, DH - 0.55, z0 + 0.45);
    put(g, new THREE.Mesh(geo(new THREE.SphereGeometry(0.045, 10, 8)), boneMat), -PX, DH - 0.5, z0 + 0.45);
    // The fat cap down the lit side.
    const fat = put(g, new THREE.Mesh(geo(new THREE.SphereGeometry(0.16, 12, 8)), boneMat), -PX + 0.1, DH - 1.05, z0 + 0.5);
    fat.scale.set(0.35, 1.6, 0.4);
  }
  {
    // Gunslinger: a wanted bill pasted on the brick, her own price on it.
    const g = prop("gunslinger");
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 180;
    const x = c.getContext("2d");
    if (x) {
      x.fillStyle = "#d9c8a0";
      x.fillRect(0, 0, 128, 180);
      x.fillStyle = "#2a1a12";
      x.font = "bold 26px serif";
      x.textAlign = "center";
      x.fillText("WANTED", 64, 34);
      x.fillRect(24, 46, 80, 84);
      x.fillStyle = "#d9c8a0";
      x.beginPath();
      x.arc(64, 78, 18, 0, Math.PI * 2);
      x.fill();
      x.fillRect(38, 100, 52, 30);
      x.fillStyle = "#7a1a14";
      x.font = "bold 20px serif";
      x.fillText("$10,000", 64, 160);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    disposables.push(tex);
    const bill = put(
      g,
      new THREE.Mesh(
        geo(new THREE.PlaneGeometry(0.62, 0.87)),
        fade(
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.9,
            emissive: 0xffffff,
            emissiveMap: tex,
            emissiveIntensity: 0.22,
          }),
        ),
      ),
      -PX,
      1.3,
      z0 + 0.05,
    );
    bill.rotation.z = 0.06;
  }
  {
    // Wirewitch: a junction box with its door open, lit cable spilling to the step.
    const g = prop("wirewitch");
    put(
      g,
      new THREE.Mesh(
        geo(new THREE.BoxGeometry(0.5, 0.66, 0.16)),
        fade(
          new THREE.MeshStandardMaterial({
            color: 0x3c4a44,
            roughness: 0.5,
            metalness: 0.6,
          }),
        ),
      ),
      -PX,
      1.25,
      z0 + 0.1,
    );
    // Its open guts: a dark board of terminals, a few lit cyan and magenta.
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 86;
    const x = c.getContext("2d");
    if (x) {
      x.fillStyle = "#0e1412";
      x.fillRect(0, 0, 64, 86);
      for (let r = 0; r < 7; r++)
        for (let k = 0; k < 4; k++) {
          const lit = (r * 4 + k) % 5;
          x.fillStyle = lit === 0 ? "#5ff6e8" : lit === 2 ? "#e05cff" : "#26302c";
          x.fillRect(8 + k * 13, 8 + r * 11, 8, 5);
        }
    }
    const board = new THREE.CanvasTexture(c);
    board.colorSpace = THREE.SRGBColorSpace;
    disposables.push(board);
    const glow = fade(
      new THREE.MeshBasicMaterial({
        map: board,
        color: new THREE.Color(1.6, 1.6, 1.6),
        fog: false,
      }),
    );
    put(g, new THREE.Mesh(geo(new THREE.PlaneGeometry(0.4, 0.54)), glow), -PX, 1.25, z0 + 0.19);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-PX - 0.1, 0.95, z0 + 0.2),
      new THREE.Vector3(-PX - 0.2, 0.5, z0 + 0.3),
      new THREE.Vector3(-PX + 0.05, 0.05, z0 + 0.7),
      new THREE.Vector3(-PX + 0.35, 0.03, z0 + 1.0),
    ]);
    put(
      g,
      new THREE.Mesh(
        geo(new THREE.TubeGeometry(curve, 24, 0.02, 6)),
        fade(
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.9, 0.2, 1.4),
            fog: false,
          }),
        ),
      ),
      0,
      0,
      0,
    );
  }
  {
    // Fixer: an open case of banded cash on a crate by the step.
    const g = prop("fixer");
    const H = 0.5;
    put(
      g,
      new THREE.Mesh(geo(new THREE.BoxGeometry(0.7, H, 0.5)), fade(new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.85, emissive: 0x2a1a0c, emissiveIntensity: 0.5 }))),
      -PX,
      H / 2,
      z0 + 0.5,
    );
    const caseMat = fade(
      new THREE.MeshStandardMaterial({
        color: 0x2a1c14,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    put(g, new THREE.Mesh(geo(new THREE.BoxGeometry(0.62, 0.1, 0.42)), caseMat), -PX, H + 0.05, z0 + 0.5);
    const lid = put(g, new THREE.Mesh(geo(new THREE.BoxGeometry(0.62, 0.42, 0.04)), caseMat), -PX, H + 0.3, z0 + 0.27);
    lid.rotation.x = -0.25;
    const cash = fade(
      new THREE.MeshStandardMaterial({
        color: 0x9fd08a,
        roughness: 0.8,
        emissive: 0x2e5a26,
        emissiveIntensity: 0.9,
      }),
    );
    for (let i = 0; i < 4; i++)
      put(g, new THREE.Mesh(geo(new THREE.BoxGeometry(0.13, 0.05, 0.3)), cash), -PX - 0.22 + i * 0.147, H + 0.12, z0 + 0.52);
  }

  let shown = -1;
  return {
    group,
    update(w, cls) {
      for (const [c, g] of props) g.visible = c === cls;
      const k = Math.max(0, Math.min(1, (w - 0.05) / 0.9));
      group.visible = k > 0.001;
      if (Math.abs(k - shown) < 1e-4) return;
      shown = k;
      for (const f of fading) {
        f.mat.opacity = f.base * k;
        // Settled, the solid parts draw opaque (sorted and depth-written like the street); the additive glows and
        // the normal-blend decals (the contact shadow) must always stay transparent, or they draw as solid panels.
        if (!f.decal && f.mat.blending !== THREE.AdditiveBlending && f.mat.transparent !== k < 0.999) {
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
