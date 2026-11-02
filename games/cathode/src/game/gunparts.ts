// Plan item 16: the gunsmith's parts on the 3D gun. `dressGun` takes a display gun (`buildGunDisplay`) and the
// item's fitted parts (barrel, scope, suppressor, mag, stock; `WEAPON_PARTS`) and bolts each one on in the kit's
// own finishes, measured off the gun itself: the can threads onto the muzzle (past any barrel extension), optics
// sit on the top line over the receiver (on a 45-degree offset mount for the rifle and the sniper, whose own
// optics are part of the gun), mags extend the well downward, stocks finish the back end. Each part is one
// group named `part:<slot>` so the bench can show and test them. Display only: the viewmodel never reads them.

import * as THREE from "three";
import { FIN, GLOW, GunKit, lathe, rounded, tube, type P2 } from "./gunkit";
import type { GunModel } from "./viewmodel";
import type { PartSlot } from "../sim/weapons";
import type { WeaponClass } from "../sim/types";

/** The model a weapon class is drawn with (the Candor Seeker is the SMG's frame). */
export function modelForClass(cls: WeaponClass | undefined): GunModel {
  switch (cls) {
    case "pistol":
    case "revolver":
    case "shotgun":
    case "rifle":
    case "sniper":
    case "launcher":
    case "smg":
      return cls;
    case "smart":
      return "smg";
    default:
      return "pin";
  }
}

/** Guns whose own optic is part of the frame: a fitted optic goes on an offset mount beside it. */
const OWN_OPTIC: ReadonlySet<GunModel> = new Set(["rifle", "sniper"]);
/** Guns with a can built in (the Kestrel 9): a fitted suppressor is already there. */
const OWN_CAN: ReadonlySet<GunModel> = new Set(["pistol"]);

interface Measure {
  box: THREE.Box3;
  /** The bore line (y) and where the muzzle ends (z, forward is -z). */
  boreY: number;
  muzzleZ: number;
  /** The highest point of the gun between two z values (root space). */
  topAt(z0: number, z1: number): number;
  /** The lowest point of the gun between two z values. */
  bottomAt(z0: number, z1: number): number;
  mag: THREE.Box3 | null;
}

function measure(root: THREE.Object3D): Measure {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const pos = m.geometry.getAttribute("position");
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    const mw = inv.clone().multiply(m.matrixWorld);
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(mw).clone());
  });
  const box = new THREE.Box3().setFromPoints(pts);
  const muzzle = root.getObjectByName("muzzle");
  const mz = muzzle ? muzzle.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv) : new THREE.Vector3(0, 0.03, box.min.z);
  const span = (z0: number, z1: number, f: (a: number, b: number) => number, init: number) => {
    let r = init;
    for (const p of pts) if (p.z >= Math.min(z0, z1) && p.z <= Math.max(z0, z1) && Math.abs(p.x) < 0.03) r = f(r, p.y);
    return r === init ? (init < 0 ? box.max.y : box.min.y) : r;
  };
  const magNode = root.getObjectByName("mag");
  let mag: THREE.Box3 | null = null;
  if (magNode) {
    const b = new THREE.Box3().setFromObject(magNode);
    if (!b.isEmpty()) mag = b.applyMatrix4(inv);
  }
  return {
    box,
    boreY: mz.y,
    muzzleZ: mz.z,
    topAt: (z0, z1) => span(z0, z1, Math.max, -1e9),
    bottomAt: (z0, z1) => span(z0, z1, Math.min, 1e9),
    mag,
  };
}

/** Where the optic sits along the gun (z of its centre), by model. */
const OPTIC_Z: Partial<Record<GunModel, number>> = { pistol: -0.05, revolver: -0.08, smg: -0.02, rifle: -0.05, shotgun: -0.12, sniper: -0.12, launcher: 0.05 };

/**
 * Bolts the fitted parts onto a display gun. `parts` is the item's slot -> part id map. Returns the root (the
 * same group), with one `part:<slot>` child per part drawn.
 */
export function dressGun(root: THREE.Group, model: GunModel, parts: Partial<Record<PartSlot, string>>, phone = false): THREE.Group {
  for (const c of [...root.children]) if (c.name.startsWith("part:")) c.removeFromParent();
  if (model === "pin" || model === "sledge" || model === "blade" || model === "wire") return root;
  const M = measure(root);
  const { box, boreY } = M;
  let front = M.muzzleZ;
  const group = (slot: PartSlot) => {
    const g = new THREE.Group();
    g.name = `part:${slot}`;
    root.add(g);
    return { g, kit: new GunKit(g, phone) };
  };
  // A turned profile along the bore from z0 forward by `len`: [radius, distance-from-z0] pairs.
  const turned = (kit: GunKit, z0: number, prof: P2[], surf: Parameters<GunKit["add"]>[1]) =>
    kit.add(lathe(prof.map(([r, d]) => [r, z0 - d] as P2), { phone }), surf, { p: [0, boreY, 0] });

  // ---- Barrel: what screws on past the muzzle.
  const barrel = parts.barrel;
  if (barrel) {
    const { g, kit } = group("barrel");
    if (barrel === "longBarrel") {
      turned(kit, front, [[0.0105, 0], [0.0105, 0.11], [0.0125, 0.112], [0.0125, 0.13], [0.006, 0.131]], FIN.receiver);
      turned(kit, front - 0.112, [[0.0128, 0], [0.0128, 0.016]], FIN.bronze);
      front -= 0.13;
    } else if (barrel === "snubBarrel") {
      turned(kit, front, [[0.0115, 0], [0.0115, 0.022], [0.007, 0.024]], FIN.knurl);
      front -= 0.024;
    } else if (barrel === "flutedBarrel") {
      // A ported compensator in TiN bronze: three slots each side.
      kit.add(rounded(0.026, 0.026, 0.05, 0.004, phone), FIN.bronze, { p: [0, boreY, front - 0.025] });
      for (let i = 0; i < 3; i++) kit.add(rounded(0.028, 0.005, 0.007, 0.001, phone), FIN.bore, { p: [0, boreY + 0.006, front - 0.01 - i * 0.014] });
      front -= 0.05;
    } else if (barrel === "chokeBarrel") {
      turned(kit, front, [[0.0125, 0], [0.0125, 0.02], [0.0135, 0.022], [0.0135, 0.04], [0.008, 0.041]], FIN.knurl);
      turned(kit, front - 0.02, [[0.0137, 0], [0.0137, 0.004]], FIN.bronze);
      front -= 0.041;
    }
    kit.finish();
    g.userData.front = front;
  }

  // ---- Suppressor: a can past everything else on the muzzle.
  const can = parts.suppressor;
  if (can && !OWN_CAN.has(model)) {
    const { kit } = group("suppressor");
    const big = can === "subsonicBaffle";
    const r = big ? 0.022 : 0.018;
    const len = big ? 0.21 : 0.15;
    // Thread collar, knurled grip ring, body, a stepped end cap and the bore.
    turned(kit, front, [[0.008, 0], [0.011, 0.004], [0.011, 0.012]], FIN.receiver);
    turned(kit, front - 0.012, [[r * 0.98, 0], [r * 0.98, 0.026]], FIN.knurl);
    turned(kit, front - 0.038, [[r, 0], [r, len - 0.05], [r - 0.002, len - 0.044], [r - 0.002, len - 0.012], [r * 0.6, len - 0.004], [0.005, len - 0.003]], FIN.can);
    turned(kit, front - len + 0.002, [[0.0045, 0], [0.0045, 0.004]], FIN.bore);
    if (big) for (let i = 0; i < 3; i++) turned(kit, front - 0.07 - i * 0.04, [[r + 0.0008, 0], [r + 0.0008, 0.003]], FIN.bronze);
    kit.finish();
  }

  // ---- Scope: on the top line over the receiver, or on a 45-degree offset mount beside the gun's own optic.
  const scope = parts.scope;
  if (scope) {
    const { g, kit } = group("scope");
    const zc = OPTIC_Z[model] ?? -0.05;
    const offset = OWN_OPTIC.has(model);
    const halfLen = scope === "redDot" ? 0.03 : scope === "thermal" ? 0.1 : scope === "nightGlass" ? 0.13 : 0.09;
    const base = M.topAt(zc - halfLen, zc + halfLen);
    // The mount: a low rail clamp (two for a tube), then the optic on top of it.
    const mountH = 0.012;
    const clamps = scope === "redDot" ? [zc] : [zc - halfLen * 0.55, zc + halfLen * 0.55];
    for (const z of clamps) kit.add(rounded(0.024, mountH, 0.016, 0.002, phone), FIN.receiver, { p: [0, mountH / 2, z] });
    const y = mountH;
    if (scope === "redDot") {
      // An open reflex sight: a housing, the hood and its window, the red dot seen only from behind.
      kit.add(rounded(0.03, 0.01, 0.05, 0.003, phone), FIN.receiver, { p: [0, y + 0.005, zc] });
      kit.add(rounded(0.03, 0.024, 0.006, 0.002, phone), FIN.receiver, { p: [0, y + 0.02, zc - 0.022] });
      kit.add(rounded(0.004, 0.024, 0.03, 0.001, phone), FIN.receiver, { p: [0.013, y + 0.02, zc - 0.006] });
      kit.add(rounded(0.004, 0.024, 0.03, 0.001, phone), FIN.receiver, { p: [-0.013, y + 0.02, zc - 0.006] });
      kit.add(new THREE.PlaneGeometry(0.022, 0.018), "glass", { p: [0, y + 0.02, zc - 0.018] });
      kit.add(new THREE.SphereGeometry(0.0012, 6, 4), GLOW.dot, { p: [0, y + 0.021, zc - 0.017] });
    } else if (scope === "thermal") {
      // A boxy thermal unit: the body, a big germanium objective, a lit eyecup screen, a dial.
      kit.add(rounded(0.05, 0.052, halfLen * 2, 0.008, phone), FIN.housing, { p: [0, y + 0.03, zc] });
      kit.add(lathe([[0.024, zc - halfLen], [0.024, zc - halfLen - 0.02], [0.02, zc - halfLen - 0.022]], { phone }), FIN.rubber, { p: [0, y + 0.03, 0] });
      kit.add(new THREE.CircleGeometry(0.019, phone ? 12 : 24).rotateY(Math.PI), GLOW.lens, { p: [0, y + 0.03, zc - halfLen - 0.0225] });
      kit.add(lathe([[0.016, zc + halfLen], [0.016, zc + halfLen + 0.025]], { phone }), FIN.rubber, { p: [0, y + 0.03, 0] });
      kit.add(new THREE.CircleGeometry(0.01, 12), GLOW.trim, { p: [0, y + 0.03, zc + halfLen + 0.0255] });
      kit.add(tube(0.012, 0.009, 0.009, { phone, caps: false }), FIN.knurl, { p: [0.025, y + 0.035, zc + 0.02], r: [0, 0, -Math.PI / 2] });
    } else {
      // A glass on a tube: eyepiece bell, the tube with its turrets, the objective bell and a coated lens.
      const r = scope === "nightGlass" ? 0.016 : 0.013;
      const bell = scope === "nightGlass" ? 0.026 : 0.02;
      const z0 = zc + halfLen, z1 = zc - halfLen;
      const cy = y + 0.006 + bell;
      kit.add(lathe([[0.014, z0], [0.017, z0 - 0.004], [0.017, z0 - 0.03], [r, z0 - 0.045], [r, z1 + 0.05], [bell, z1 + 0.012], [bell, z1], [bell - 0.003, z1 - 0.002]], { phone }), FIN.housing, { p: [0, cy, 0] });
      for (const z of clamps) kit.add(lathe([[r + 0.003, z - 0.006], [r + 0.003, z + 0.006]], { phone }), FIN.receiver, { p: [0, cy, 0] });
      kit.add(tube(0.012, 0.009, 0.009, { phone, caps: false }), FIN.knurl, { p: [0, cy + r - 0.002, zc] });
      kit.add(tube(0.01, 0.008, 0.008, { phone, caps: false }), FIN.knurl, { p: [r - 0.002, cy, zc], r: [0, 0, -Math.PI / 2] });
      kit.add(new THREE.CircleGeometry(bell - 0.004, phone ? 12 : 24).rotateY(Math.PI), GLOW.lens, { p: [0, cy, z1 - 0.0005] });
      kit.add(new THREE.CircleGeometry(0.012, 12), "glass", { p: [0, cy, z0 + 0.0005] });
      if (scope === "nightGlass") kit.add(rounded(0.014, 0.02, 0.03, 0.003, phone), FIN.rubber, { p: [-r - 0.005, cy, zc + halfLen * 0.4] });
    }
    kit.finish();
    if (offset) {
      // Canted 45 degrees to the right off the rail's side, at the receiver's shoulder.
      g.position.set(0.022, base - 0.025, 0);
      g.rotation.z = -Math.PI / 4;
    } else g.position.set(0, base, 0);
  }

  // ---- Mag: longer box, a drum, or a pull tab, below the gun's own mag.
  const mag = parts.mag;
  if (mag) {
    const { kit } = group("mag");
    const mb = M.mag ?? new THREE.Box3(new THREE.Vector3(-0.012, box.min.y + 0.02, -0.08), new THREE.Vector3(0.012, boreY - 0.02, -0.03));
    const w = Math.max(0.02, mb.max.x - mb.min.x) * 0.92;
    const d = Math.max(0.03, mb.max.z - mb.min.z);
    const zc = (mb.min.z + mb.max.z) / 2;
    const floor = M.mag ? mb.min.y : M.bottomAt(zc - d / 2, zc + d / 2);
    if (!M.mag && (model === "shotgun" || model === "launcher")) {
      // No box mag: a side saddle of rounds on the left flank (shells, or 40 mm for the launcher).
      const n = mag === "drumMag" ? 6 : 4;
      const rr = model === "launcher" ? 0.02 : 0.0095;
      const sz = model === "launcher" ? 0.11 : 0.12;
      kit.add(rounded(0.006, rr * 2.6, n * rr * 2.3 + 0.01, 0.002, phone), FIN.receiver, { p: [-0.045, boreY - 0.02, sz - n * rr * 1.15] });
      for (let i = 0; i < n; i++) {
        const z = sz - 0.005 - rr - i * rr * 2.3;
        kit.add(tube(0.05, rr, rr, { phone, caps: false }), FIN.hull, { p: [-0.052, boreY - 0.045, z] });
        kit.add(tube(0.008, rr * 1.05, rr * 1.05, { phone, caps: false }), FIN.brass, { p: [-0.052, boreY - 0.047, z] });
      }
    } else if (mag === "drumMag") {
      const r = 0.055;
      kit.add(lathe([[0, -0.03], [r, -0.03], [r + 0.004, -0.026], [r + 0.004, 0.026], [r, 0.03], [0, 0.03]], { phone }), FIN.magBody, { p: [0, floor - r + 0.01, zc], r: [0, Math.PI / 2, 0] });
      kit.add(lathe([[0, -0.034], [0.014, -0.034], [0.014, 0.034], [0, 0.034]], { phone }), FIN.knurl, { p: [0, floor - r + 0.01, zc], r: [0, Math.PI / 2, 0] });
      kit.add(rounded(w, 0.03, d, 0.003, phone), FIN.magBody, { p: [0, floor + 0.005, zc] });
    } else if (mag === "extendedMag") {
      const ext = 0.055;
      kit.add(rounded(w, ext, d * 0.97, 0.003, phone), FIN.magBody, { p: [0, floor - ext / 2 + 0.004, zc + 0.004] });
      kit.add(rounded(w * 1.25, 0.008, d * 1.08, 0.002, phone), FIN.rubber, { p: [0, floor - ext, zc + 0.004] });
    } else {
      // Quick-pull: a bronze floorplate and a fabric pull loop.
      kit.add(rounded(w * 1.2, 0.007, d * 1.05, 0.002, phone), FIN.bronze, { p: [0, floor - 0.003, zc] });
      kit.add(new THREE.TorusGeometry(0.012, 0.0025, 6, 12, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI), FIN.webbing, { p: [0, floor - 0.007, zc] });
    }
    kit.finish();
  }

  // ---- Stock: the back end.
  const stock = parts.stock;
  if (stock) {
    const { kit } = group("stock");
    const rear = box.max.z;
    const handgun = model === "pistol" || model === "revolver";
    const midY = handgun ? boreY - 0.07 : (M.topAt(rear - 0.08, rear) + M.bottomAt(rear - 0.08, rear)) / 2;
    const h = handgun ? 0.11 : Math.max(0.06, M.topAt(rear - 0.05, rear) - M.bottomAt(rear - 0.05, rear));
    let back = rear;
    if (handgun || stock === "skeletonStock") {
      // A brace: two rods back from the frame to a butt plate (a skeleton on a long gun, a brace on a handgun).
      const len = handgun ? 0.2 : 0.12;
      const z0 = handgun ? rear - 0.01 : rear;
      for (const dy of [h * 0.32, -h * 0.32]) kit.add(tube(len, 0.006, 0.006, { phone }), FIN.receiver, { p: [0, midY + dy, z0], r: [Math.PI / 2, 0, 0] });
      kit.add(rounded(0.03, h * 0.9, 0.012, 0.004, phone), FIN.receiver, { p: [0, midY, z0 + len] });
      back = z0 + len + 0.006;
    }
    if (stock === "paddedStock" || stock === "marksmanStock" || handgun) {
      kit.add(rounded(0.036, h * 0.95, 0.02, 0.008, phone), FIN.rubber, { p: [0, midY, back + 0.009] });
    }
    if (stock === "marksmanStock") {
      // A cheek riser in padded nylon and a monopod tab under the toe.
      kit.add(rounded(0.034, 0.018, 0.1, 0.006, phone), FIN.webbing, { p: [0, M.topAt(rear - 0.15, rear) + 0.006, rear - 0.07] });
      kit.add(rounded(0.012, 0.035, 0.012, 0.002, phone), FIN.receiver, { p: [0, M.bottomAt(rear - 0.1, rear - 0.04) - 0.016, rear - 0.07] });
    }
    kit.finish();
  }
  return root;
}

/** The part slots a gun shows as drawn parts, in order (tests and the bench's legend). */
export function drawnSlots(root: THREE.Object3D): PartSlot[] {
  return root.children.filter((c) => c.name.startsWith("part:")).map((c) => c.name.slice(5) as PartSlot);
}
