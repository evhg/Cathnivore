// Plan item 510: the title's street, alive behind her. The far wall to her right was dark brick with one sign on it,
// and nothing on the title moved but the rain and LUNA. Now:
// - a glossy Hollowell shop across the street (its window lit cool white, shelves of boxed goods, a mannequin, the
//   brand's fascia), its light laid on the wet pavement in front of it and caught in the street's mirror;
// - its OPEN sign, a small cyan tube on its own failing ballast (out of step with LUNA's);
// - a passer-by under an umbrella who walks past the window about every 12 s, a silhouette against its light;
// - a car's headlights, off frame at the street's mouth, sweeping across the cobbles and up the far wall every 11 s.
// - the flats over the shop (slice 2, for the upright phone frame, where the wall over the lamp was black): two storeys
//   of windows left of the lamp, a reading lamp behind a curtain, a television's blue flicker, a neighbour who crosses
//   her lit window about every 14 s;
// All of it unlit or vertex-coloured, no new real lights (the pool's lights stay hers and the lamp's): nine draw calls.
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

/** The neighbour upstairs: crosses her window in 3.2 s, once every 14 s. */
export const NEIGHBOUR_S = 14;
const NEIGHBOUR_CROSS_S = 3.2;

/** The neighbour's place across her window at t: 0..1 while crossing, else -1. */
export function neighbourAt(t: number): number {
  const u = (((t + 4.5) % NEIGHBOUR_S) + NEIGHBOUR_S) % NEIGHBOUR_S;
  return u < NEIGHBOUR_CROSS_S ? u / NEIGHBOUR_CROSS_S : -1;
}

/** The television's light: a restless cool flicker, cut and colour changes, never dark. */
export function tvLevel(t: number, still: boolean): number {
  if (still) return 0.8;
  const cut = Math.floor(t / 1.7);
  const base = 0.55 + 0.45 * Math.abs(Math.sin(cut * 12.9898) * 43758.5453 % 1);
  return base * (0.86 + 0.14 * Math.sin(t * 23.0) * Math.sin(t * 7.3));
}

/**
 * The flats' windows on the wall over the shop, as one painted sheet (transparent between them). Windows in metres
 * from the sheet's bottom-left: `x0`, `x1`, `y0`, `y1`, and what's lit behind each.
 */
export const FLAT_W = 5.0;
export const FLAT_H = 3.0;
export const FLAT_WINDOWS = [
  // First floor (left to right as you face the wall: the far end first; the last one stands over the lamp's arm).
  { x0: 0.25, x1: 1.05, y0: 0.15, y1: 1.15, kind: "tv" },
  { x0: 2.0, x1: 2.8, y0: 0.15, y1: 1.15, kind: "warm" },
  { x0: 3.9, x1: 4.85, y0: -0.2, y1: 1.25, kind: "neighbour" },
  // Second floor.
  { x0: 0.25, x1: 1.05, y0: 1.85, y1: 2.8, kind: "warm" },
  { x0: 2.0, x1: 2.8, y0: 1.85, y1: 2.8, kind: "dark" },
  { x0: 3.9, x1: 4.7, y0: 1.85, y1: 2.8, kind: "warm" },
] as const;

function flatsTexture(): THREE.CanvasTexture {
  const PX = 80;
  const c = document.createElement("canvas");
  c.width = Math.round(FLAT_W * PX);
  c.height = Math.round(FLAT_H * PX);
  const g = c.getContext("2d");
  if (g) {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const X = (m: number) => m * PX;
    const Y = (m: number) => c.height - m * PX;
    for (const w of FLAT_WINDOWS) {
      const x = X(w.x0), y = Y(w.y1), ww = X(w.x1 - w.x0), hh = X(w.y1 - w.y0);
      // A stone sill and lintel, catching a little of the street's light.
      g.fillStyle = "#3a3634";
      g.fillRect(x - 6, Y(w.y0) - 2, ww + 12, 8);
      g.fillStyle = "#24211f";
      g.fillRect(x - 4, y - 7, ww + 8, 7);
      if (w.kind === "dark") {
        // An unlit room: the glass holds a faint cool reflection of the street.
        const gl = g.createLinearGradient(x, y, x + ww, y + hh);
        gl.addColorStop(0, "#14181e");
        gl.addColorStop(0.5, "#252b34");
        gl.addColorStop(1, "#101216");
        g.fillStyle = gl;
        g.fillRect(x, y, ww, hh);
      } else if (w.kind === "tv") {
        // A dim room, its back wall blue-grey (the set's flicker is its own layer), half-drawn blind.
        g.fillStyle = "#1c2430";
        g.fillRect(x, y, ww, hh);
        g.fillStyle = "#56606a";
        for (let k = 0; k < 7; k++) g.fillRect(x, y + k * 6, ww, 4);
      } else {
        // A lit room seen through sheer curtains: a warm lamp's glow low on the left, the curtains gathered at the sides.
        const r = g.createRadialGradient(x + ww * 0.35, y + hh * 0.7, 2, x + ww * 0.35, y + hh * 0.7, hh * 0.9);
        r.addColorStop(0, "#ffd9a0");
        r.addColorStop(0.5, "#d89a5c");
        r.addColorStop(1, "#6a4228");
        g.fillStyle = r;
        g.fillRect(x, y, ww, hh);
        g.fillStyle = "rgba(255,236,210,0.28)";
        g.fillRect(x, y, ww * 0.22, hh);
        g.fillRect(x + ww * 0.8, y, ww * 0.2, hh);
        g.fillStyle = "rgba(90,50,30,0.35)";
        for (let k = 0; k < 4; k++) g.fillRect(x + ww * (0.04 + k * 0.05), y, 2, hh);
        for (let k = 0; k < 4; k++) g.fillRect(x + ww * (0.82 + k * 0.045), y, 2, hh);
        if (w.kind === "warm" && w.y0 > 1) {
          // A pot plant on the sill.
          g.fillStyle = "#1e1a16";
          g.fillRect(x + ww * 0.62, Y(w.y0) - 16, 14, 14);
          g.beginPath();
          g.ellipse(x + ww * 0.62 + 7, Y(w.y0) - 24, 13, 10, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      // The frame: a cross of glazing bars.
      g.fillStyle = "#14110f";
      g.fillRect(x, y, ww, 3);
      g.fillRect(x, y + hh - 3, ww, 3);
      g.fillRect(x, y, 3, hh);
      g.fillRect(x + ww - 3, y, 3, hh);
      g.fillRect(x + ww / 2 - 2, y, 4, hh);
      g.fillRect(x, y + hh * 0.42, ww, 3);
      // Rain on the glass.
      g.fillStyle = "rgba(10,14,20,0.2)";
      for (let k = 0; k < 10; k++) g.fillRect(x + rnd() * ww, y + rnd() * hh, 2, 4 + rnd() * 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The neighbour's head and shoulders, dark against her curtain; the plane slides it across the window. */
function neighbourTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 152;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "rgba(34,20,16,0.82)";
    g.beginPath();
    g.ellipse(64, 54, 17, 21, 0, 0, Math.PI * 2);
    g.fill();
    // Hair up in a knot.
    g.beginPath();
    g.ellipse(70, 30, 10, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(30, 152);
    g.quadraticCurveTo(32, 92, 64, 86);
    g.quadraticCurveTo(96, 92, 98, 152);
    g.closePath();
    g.fill();
    // A mug held up.
    g.fillRect(84, 100, 14, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

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

  // ---- the flats over the shop, left of the lamp (slice 2) ----
  // The sheet's left edge (as you face the wall) at `along` -8.6, its foot 3 m up: the first floor over the dock.
  const FLAT_A = -8.6 + FLAT_W / 2, FLAT_Y = 3.0;
  const flatsTex = flatsTexture();
  const flatsMat = new THREE.MeshBasicMaterial({ map: flatsTex, color: new THREE.Color(0.62, 0.6, 0.58), transparent: true, alphaTest: 0.02, fog: false });
  const flats = new THREE.Mesh(new THREE.PlaneGeometry(FLAT_W, FLAT_H), flatsMat);
  flats.name = "front-flats";
  flats.position.copy(at(FLAT_A, FLAT_Y + FLAT_H / 2, 0.02));
  flats.rotation.y = shop.yaw;
  group.add(flats);
  const winAt = (w: (typeof FLAT_WINDOWS)[number], o: number) =>
    at(FLAT_A - FLAT_W / 2 + (w.x0 + w.x1) / 2, FLAT_Y + (w.y0 + w.y1) / 2, o);
  // The television's light on the room's back wall and blind.
  const tvWin = FLAT_WINDOWS.find((w) => w.kind === "tv")!;
  const tvColor = new THREE.Color(0.22, 0.42, 0.85);
  const tvMat = new THREE.MeshBasicMaterial({ color: tvColor.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(tvWin.x1 - tvWin.x0 - 0.06, tvWin.y1 - tvWin.y0 - 0.06), tvMat);
  tv.position.copy(winAt(tvWin, 0.03));
  tv.rotation.y = shop.yaw;
  tv.renderOrder = 3;
  group.add(tv);
  // The neighbour: her silhouette slides across the window (the texture's offset, clamped, so the frame clips her).
  const nWin = FLAT_WINDOWS.find((w) => w.kind === "neighbour")!;
  const nTex = neighbourTexture();
  const nMat = new THREE.MeshBasicMaterial({ map: nTex, transparent: true, depthWrite: false, fog: false });
  const neighbour = new THREE.Mesh(new THREE.PlaneGeometry(nWin.x1 - nWin.x0 - 0.06, nWin.y1 - nWin.y0 - 0.06), nMat);
  neighbour.name = "front-neighbour";
  neighbour.position.copy(winAt(nWin, 0.03));
  neighbour.rotation.y = shop.yaw;
  neighbour.renderOrder = 3;
  neighbour.visible = false;
  group.add(neighbour);
  // The lit windows' light on the wet brick round them (the street's mirror leaves these out).
  const glowMat = new THREE.MeshBasicMaterial({ map: null, color: new THREE.Color(0.15, 0.085, 0.04), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const glows: THREE.Mesh[] = [];
  for (const w of FLAT_WINDOWS) {
    if (w.kind !== "warm" && w.kind !== "neighbour") continue;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry((w.x1 - w.x0) * 2.4, (w.y1 - w.y0) * 2.0), glowMat);
    gl.position.copy(winAt(w, 0.015));
    gl.rotation.y = shop.yaw;
    gl.renderOrder = 2;
    glows.push(gl);
  }
  if (glows.length) {
    const merged = mergeGeometries(glows.map((m) => { m.updateMatrix(); return m.geometry.applyMatrix4(m.matrix); }), false)!;
    for (const m of glows) m.geometry.dispose();
    const glow = new THREE.Mesh(merged, glowMat);
    glow.name = "front-flat-glow";
    glow.renderOrder = 2;
    glow.layers.set(LAYER_NO_REFLECT);
    group.add(glow);
  }

  // The window's light on the wet pavement in front of it.
  const soft = softTexture();
  glowMat.map = soft;
  glowMat.needsUpdate = true;
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

  for (const o of [open, spill, floorBeam, wallBeam, tv, neighbour]) o.layers.set(LAYER_NO_REFLECT);
  // On a phone the walker keeps out of the mirror too (the street's own people do there).
  if (phone) walker.layers.set(LAYER_NO_REFLECT);

  return {
    group,
    movers(still) {
      return still ? [] : ["passer", "headlights", "neon", "neighbour"];
    },
    update(t, still) {
      const lv = openLevel(t, still);
      openMat.color.copy(tubeColor).multiplyScalar(lv);
      tvMat.color.copy(tvColor).multiplyScalar(tvLevel(t, still));
      // The neighbour upstairs, left to right across her window as the street sees it.
      const nu = still ? -1 : neighbourAt(t);
      neighbour.visible = nu >= 0;
      if (nu >= 0) nTex.offset.x = 1 - 2 * (nu * nu * (3 - 2 * nu));
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
      flatsTex.dispose();
      nTex.dispose();
      for (const m of [shopMat, openMat, spillMat, walkerMat, floorBeamMat, wallBeamMat, flatsMat, tvMat, nMat, glowMat]) m.dispose();
    },
  };
}
