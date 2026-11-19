// Plan item 510: the title's street, alive behind her. The far wall to her right was dark brick with one sign on it,
// and nothing on the title moved but the rain and LUNA. Now:
// - a glossy Hollowell shop across the street (its window lit cool white, shelves of boxed goods, a mannequin, the
//   brand's fascia), its light laid on the wet pavement in front of it and caught in the street's mirror;
// - its OPEN sign, a small cyan tube on its own failing ballast (out of step with LUNA's);
// - a passer-by under an umbrella who walks past the window about every 12 s, a silhouette against its light;
// - a car's headlights, off frame at the street's mouth, sweeping across the cobbles and up the far wall every 11 s.
// All of it unlit or vertex-coloured, no new real lights (the pool's lights stay hers and the lamp's): six draw calls.
// Under reduced motion nothing moves: the passer-by and the sweep are gone, the sign holds lit.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { standingParts, umbrellaParts } from "./crowd";
import { LAYER_NO_REFLECT } from "./reflection";

export interface FrontStreet {
  readonly group: THREE.Group;
  /** `still`: reduced motion (nothing moves). `t`: the scene clock (frozen in shots, so a shot at t is repeatable). */
  update(t: number, still: boolean): void;
  /** The ambient movers running now (empty under reduced motion), for `[data-ambient]` on the canvas. */
  movers(still: boolean): string[];
  dispose(): void;
}

/** The passer-by's loop: walks 9 m past the shop in 7.5 s, once every 12 s. */
export const PASSER_S = 12;
const PASSER_WALK_S = 7.5;
/** The headlight sweep: 1.8 s across, once every 11 s. */
export const SWEEP_S = 11;
const SWEEP_DUR = 1.8;

/** The OPEN tube: lit, with a short fault of dark beats once every 9.1 s (LUNA's comes every 7.3 s). */
export function openLevel(t: number, still: boolean): number {
  if (still) return 1;
  const u = (((t % 9.1) + 9.1) % 9.1) - 2.4;
  if (u < 0 || u > 0.9) return 1;
  return [1, 0.08, 1, 0.08, 0.08, 0.5, 1, 0.08, 1, 1, 0.08, 0.08, 0.08, 0.3, 1, 1, 0.08, 1][Math.floor(u * 20) % 18]!;
}

/** Where the passer-by is along the walk at t: 0..1, or -1 when off the street. */
export function passerAt(t: number): number {
  const u = (((t + 9.7) % PASSER_S) + PASSER_S) % PASSER_S;
  return u < PASSER_WALK_S ? u / PASSER_WALK_S : -1;
}

/** The sweep's progress at t: 0..1 while it crosses, else -1. Held off frame at t = 8 (the posters' time). */
export function sweepAt(t: number): number {
  const u = (((t + 1.5) % SWEEP_S) + SWEEP_S) % SWEEP_S;
  return u < SWEEP_DUR ? u / SWEEP_DUR : -1;
}

/** The shop's front, painted: a glossy black surround, the fascia, a lit window of boxed goods, a glass door. */
function shopTexture(w: number, h: number): THREE.CanvasTexture {
  const PX = 96;
  const c = document.createElement("canvas");
  c.width = Math.round(w * PX);
  c.height = Math.round(h * PX);
  const g = c.getContext("2d");
  if (g) {
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const X = (m: number) => m * PX;
    const Y = (m: number) => c.height - m * PX;
    // The surround: black lacquer with a faint vertical sheen.
    const sur = g.createLinearGradient(0, 0, c.width, 0);
    sur.addColorStop(0, "#0b0c10");
    sur.addColorStop(0.5, "#16181e");
    sur.addColorStop(1, "#0b0c10");
    g.fillStyle = sur;
    g.fillRect(0, 0, c.width, c.height);
    // The fascia: the brand in thin caps, white on black, a cyan rule under it.
    g.fillStyle = "#050608";
    g.fillRect(X(0.12), Y(h - 0.08), c.width - X(0.24), X(0.42));
    g.fillStyle = "#e6f4f8";
    g.font = `600 ${Math.round(X(0.22))}px "Helvetica Neue", Arial, sans-serif`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    const brand = "H O L L O W E L L";
    g.fillText(brand, X(0.4), Y(h - 0.29));
    g.font = `500 ${Math.round(X(0.1))}px "Helvetica Neue", Arial, sans-serif`;
    g.fillStyle = "#7fd6e6";
    g.textAlign = "right";
    g.fillText("SAME-DAY  ·  0% CREDIT", c.width - X(0.35), Y(h - 0.29));
    g.fillStyle = "#38b8cc";
    g.fillRect(X(0.12), Y(h - 0.5), c.width - X(0.24), 3);
    // The window: from the stall riser to under the fascia; the door at the right.
    const wx0 = 0.2, wx1 = w - 1.25, wy0 = 0.42, wy1 = h - 0.62;
    const inside = g.createLinearGradient(0, Y(wy1), 0, Y(wy0));
    inside.addColorStop(0, "#dff2f6");
    inside.addColorStop(0.55, "#9cc6d2");
    inside.addColorStop(1, "#4d7684");
    g.fillStyle = inside;
    g.fillRect(X(wx0), Y(wy1), X(wx1 - wx0), X(wy1 - wy0));
    // Shelves of boxed goods, the boxes in the brand's muted colours, each with a pale label.
    const tones = ["#2c4a58", "#c9d6da", "#335a66", "#8aa4ac", "#1f3540", "#d8e2e4", "#4e6e78"];
    for (const sy of [0.55, 1.05, 1.55]) {
      g.fillStyle = "rgba(20,32,38,0.85)";
      g.fillRect(X(wx0), Y(sy), X(wx1 - wx0), 4);
      for (let x = wx0 + 0.08; x < wx1 - 0.2; ) {
        const bw = 0.16 + rnd() * 0.2, bh = 0.18 + rnd() * 0.24;
        if (x > wx0 + 1.05 && x < wx0 + 1.75) {
          x = wx0 + 1.75; // the mannequin's bay
          continue;
        }
        g.fillStyle = tones[Math.floor(rnd() * tones.length)]!;
        g.fillRect(X(x), Y(sy + bh), X(bw), X(bh));
        g.fillStyle = "rgba(240,250,252,0.55)";
        g.fillRect(X(x + bw * 0.2), Y(sy + bh * 0.65), X(bw * 0.6), X(0.04));
        x += bw + 0.04 + rnd() * 0.05;
      }
    }
    // A mannequin in the brand's coat, a dark figure against the lit back wall.
    const mx = X(wx0 + 1.4);
    g.fillStyle = "#1a242a";
    g.beginPath();
    g.ellipse(mx, Y(1.9), X(0.09), X(0.11), 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(mx - X(0.22), Y(1.72));
    g.lineTo(mx + X(0.22), Y(1.72));
    g.lineTo(mx + X(0.3), Y(0.62));
    g.lineTo(mx - X(0.3), Y(0.62));
    g.closePath();
    g.fill();
    g.fillRect(mx - 2, Y(0.62), 4, X(0.2));
    // Glossy glass: two diagonal sheens across the window.
    g.save();
    g.beginPath();
    g.rect(X(wx0), Y(wy1), X(wx1 - wx0), X(wy1 - wy0));
    g.clip();
    for (const [x, ww, a] of [[0.5, 0.35, 0.22], [1.0, 0.12, 0.16], [2.4, 0.5, 0.14]] as const) {
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      g.moveTo(X(x), Y(wy1));
      g.lineTo(X(x + ww), Y(wy1));
      g.lineTo(X(x + ww - 0.7), Y(wy0));
      g.lineTo(X(x - 0.7), Y(wy0));
      g.closePath();
      g.fill();
    }
    g.restore();
    // Mullions.
    g.fillStyle = "#0b0c10";
    for (const x of [wx0 + (wx1 - wx0) / 2]) g.fillRect(X(x) - 3, Y(wy1), 6, X(wy1 - wy0));
    // The door: a glass panel lit from within, a steel push bar.
    const dx0 = w - 1.0, dx1 = w - 0.2;
    const door = g.createLinearGradient(0, Y(2.1), 0, Y(0.05));
    door.addColorStop(0, "#b7d6de");
    door.addColorStop(1, "#3f6270");
    g.fillStyle = door;
    g.fillRect(X(dx0 + 0.08), Y(h - 0.62), X(dx1 - dx0 - 0.16), X(h - 0.62 - 0.05));
    g.fillStyle = "#c8d4d8";
    g.fillRect(X(dx0 + 0.12), Y(1.05), X(dx1 - dx0 - 0.24), 5);
    // Rain on the glass: short runs, a little darker than the light behind.
    g.fillStyle = "rgba(10,30,40,0.18)";
    for (let i = 0; i < 70; i++) g.fillRect(X(wx0 + rnd() * (w - 0.4)), Y(0.5 + rnd() * (h - 1.2)), 2, 6 + rnd() * 18);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A soft elongated light: the window's spill and the headlights' beam. */
function softTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,0.9)");
    r.addColorStop(0.45, "rgba(255,255,255,0.4)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

function textTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d");
  if (g) {
    g.strokeStyle = "#fff";
    g.lineWidth = 7;
    g.lineJoin = "round";
    g.strokeRect(8, 8, 240, 80);
    g.font = '600 58px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 6;
    g.strokeText(text, 128, 52);
  }
  return new THREE.CanvasTexture(c);
}

/** One walker, coat, face, umbrella and all, as one vertex-coloured geometry heading +x. */
function walkerGeometry(): THREE.BufferGeometry {
  const { coat, skin, dark } = standingParts(true);
  const tint = (gs: THREE.BufferGeometry[], hex: string) =>
    gs.map((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0;
      g.deleteAttribute("uv");
      const col = new THREE.Color(hex);
      const n = g.getAttribute("position").count;
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(a, 3));
      return g;
    });
  const parts = [...tint(coat, "#3a3a40"), ...tint(skin, "#b07a58"), ...tint(dark, "#121214"), ...tint(umbrellaParts(), "#5a1a22")];
  const out = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return out;
}

export interface ShopAt {
  /** The middle of the shop's foot on the far wall (world). */
  readonly at: THREE.Vector3;
  /** Turn about y; 0 faces +z. */
  readonly yaw: number;
}

/**
 * `shop`: where the shop stands; the passer-by walks the pavement 0.6 m in front of it, and the sweep crosses the
 * street between it and her (`sweepZ` metres in front of the wall). `groundAt` lays the walker and the decals.
 */
export function buildFrontStreet(shop: ShopAt, groundAt: (x: number, z: number) => number, phone: boolean): FrontStreet {
  const group = new THREE.Group();
  group.name = "front-street";
  const W = 5.2, H = 2.45;
  // The shop's axes: `along` runs left to right as you face it, `out` toward the street.
  const out = new THREE.Vector3(Math.sin(shop.yaw), 0, Math.cos(shop.yaw));
  const along = new THREE.Vector3(out.z, 0, -out.x);
  const at = (a: number, y: number, o: number, v = new THREE.Vector3()) => v.copy(shop.at).addScaledVector(along, a).addScaledVector(out, o).setY(shop.at.y + y);

  // ---- the shop ----
  const shopMat = new THREE.MeshBasicMaterial({ map: shopTexture(W, H), color: new THREE.Color(0.44, 0.47, 0.5), fog: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0), shopMat);
  front.name = "front-shop";
  front.position.copy(at(0, 0, 0.03));
  front.rotation.y = shop.yaw;
  group.add(front);

  // Its OPEN tube in the window's top corner by the door.
  const tubeColor = new THREE.Color(0.35, 1.6, 2.0);
  const openTex = textTexture("OPEN");
  const openMat = new THREE.MeshBasicMaterial({ map: openTex, color: tubeColor.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const open = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), openMat);
  open.position.copy(at(W / 2 - 2.0, 1.55, 0.06));
  open.rotation.y = shop.yaw;
  open.renderOrder = 3;
  group.add(open);

  // The window's light on the wet pavement in front of it.
  const soft = softTexture();
  const decal = (color: THREE.Color) =>
    new THREE.MeshBasicMaterial({ map: soft, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const spillMat = decal(new THREE.Color(0.32, 0.46, 0.52));
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), spillMat);
  const sp = at(-0.4, 0, 1.4);
  spill.position.set(sp.x, groundAt(sp.x, sp.z) + 0.017, sp.z);
  spill.rotation.y = shop.yaw;
  spill.scale.set(W * 1.15, 1, 2.6);
  spill.renderOrder = 1;
  group.add(spill);

  // ---- the passer-by ----
  const walkerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const walker = new THREE.Mesh(walkerGeometry(), walkerMat);
  walker.name = "front-passer";
  walker.visible = false;
  group.add(walker);
  const WALK_FROM = W / 2 + 3.2, WALK_TO = -W / 2 - 3.2;
  const wp = new THREE.Vector3();
  // Facing along -along (it walks from the shop's right end to its left); the kit faces +x.
  const walkYaw = Math.atan2(-along.x, -along.z) - Math.PI / 2;

  // ---- the headlight sweep: a pale beam across the cobbles and up the far wall ----
  const beamColor = new THREE.Color(0.85, 0.82, 0.7);
  const floorBeamMat = decal(beamColor.clone().multiplyScalar(0.5));
  const floorBeam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), floorBeamMat);
  floorBeam.name = "front-sweep";
  floorBeam.rotation.y = shop.yaw;
  floorBeam.scale.set(3.2, 1, 1.6);
  floorBeam.renderOrder = 1;
  floorBeam.visible = false;
  const wallBeamMat = decal(beamColor.clone().multiplyScalar(0.32));
  const wallBeam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallBeamMat);
  wallBeam.rotation.y = shop.yaw;
  wallBeam.scale.set(3.4, 1.6, 1);
  wallBeam.renderOrder = 2;
  wallBeam.visible = false;
  group.add(floorBeam, wallBeam);
  const bp = new THREE.Vector3();

  for (const o of [open, spill, floorBeam, wallBeam]) o.layers.set(LAYER_NO_REFLECT);
  // On a phone the walker keeps out of the mirror too (the street's own people do there).
  if (phone) walker.layers.set(LAYER_NO_REFLECT);

  return {
    group,
    movers(still) {
      return still ? [] : ["passer", "headlights", "neon"];
    },
    update(t, still) {
      const lv = openLevel(t, still);
      openMat.color.copy(tubeColor).multiplyScalar(lv);
      // The passer-by.
      const u = still ? -1 : passerAt(t);
      walker.visible = u >= 0;
      if (walker.visible) {
        const a = WALK_FROM + (WALK_TO - WALK_FROM) * u;
        at(a, 0, 0.75, wp);
        const step = u * PASSER_WALK_S * 1.9;
        wp.y = groundAt(wp.x, wp.z) + Math.abs(Math.sin(step * Math.PI)) * 0.035;
        walker.position.copy(wp);
        walker.rotation.set(0, walkYaw, Math.sin(step * Math.PI) * 0.025);
      }
      // The sweep: eases in and out at the ends, crossing from the shop's left to its right.
      const k = still ? -1 : sweepAt(t);
      floorBeam.visible = wallBeam.visible = k >= 0;
      if (k >= 0) {
        const fade = Math.sin(k * Math.PI);
        const a = -W / 2 - 4 + (W + 8) * k;
        at(a, 0, 3.2, bp);
        floorBeam.position.set(bp.x, groundAt(bp.x, bp.z) + 0.018, bp.z);
        at(a + 0.8, 1.3, 0.08, bp);
        wallBeam.position.copy(bp);
        floorBeamMat.opacity = fade;
        wallBeamMat.opacity = fade;
      }
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      shopMat.map?.dispose();
      openTex.dispose();
      soft.dispose();
      for (const m of [shopMat, openMat, spillMat, walkerMat, floorBeamMat, wallBeamMat]) m.dispose();
    },
  };
}
