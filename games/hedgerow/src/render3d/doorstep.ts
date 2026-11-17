// Plan item 480: the farmhouse doorstep in 3D, as the 2D field draws it (`doorstepart.ts`): Hollowell's glossy
// parcels piled beside the door (the newest arcs in from the lane in 400 ms), the 'Sorry we missed you' card on the
// door (with '+N' when more parcels wait than the pile shows) and, under a quarter of the Goodwill, Hollowell's
// 'ACQUIRED' board by the gate. Three draw calls at most: one instanced mesh for the parcels, the card, the board.

import * as THREE from "three";
import { DOORSTEP_SHOWN } from "../doorstep";
import type { DoorstepView } from "../doorstepart";

const INK = "#2b2320";
/** A parcel in the farmhouse's own units (the house is 0.74 wide before its scale). */
const PW = 0.15;
const PH = 0.105;
const PD = 0.12;
/** How long a parcel's arc from the lane takes (s). */
const ARC_S = 0.4;

/** The pile's slots in the farmhouse's frame: four on the ground, three on them, one on top, right of the door
 *  (`side` -1 piles them left, for a house at the field's right edge). The door is at x 0, z 0.285. */
export function parcelSlot3d(k: number, side: 1 | -1 = 1): THREE.Vector3 {
  const row = k < 4 ? 0 : k < 7 ? 1 : 2;
  const col = row === 0 ? k : row === 1 ? k - 4 : 0;
  const x = side * (0.13 + col * (PW + 0.01) + row * PW * 0.5);
  return new THREE.Vector3(x, row * PH + PH / 2, 0.37 + (k % 2) * 0.015);
}

function canvasTexture(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d")!;
  paint(c);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Hollowell's plastic wrap: glossy off-white with the red tape round it and a grey H seal. */
function parcelTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (c) => {
    c.fillStyle = "#f1efe9";
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#c8352b";
    c.fillRect(26, 0, 12, 64);
    c.fillStyle = "#8d8a84";
    c.beginPath();
    c.arc(48, 46, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f1efe9";
    c.font = "bold 11px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("H", 48, 47);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.strokeRect(1.5, 1.5, 61, 61);
  });
}

function paintCard(c: CanvasRenderingContext2D, extra: number): void {
  c.clearRect(0, 0, 128, 96);
  c.fillStyle = "#fbf6ea";
  c.fillRect(2, 2, 124, 92);
  c.fillStyle = "#c8352b";
  c.fillRect(2, 2, 124, 16);
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.strokeRect(2, 2, 124, 92);
  c.fillStyle = INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "bold 17px sans-serif";
  c.fillText("Sorry we", 64, 36);
  c.fillText("missed you", 64, 56);
  if (extra > 0) {
    c.fillStyle = "#c8352b";
    c.font = "bold 18px sans-serif";
    c.fillText(`+${extra}`, 64, 80);
  }
}

/** The board's face: 'ACQUIRED' on Hollowell's teal, in a timber frame (the post takes the frame's colour). */
function boardTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 160, (c) => {
    c.fillStyle = "#7a5634";
    c.fillRect(0, 0, 256, 160);
    c.fillStyle = "#f4f1ea";
    c.fillRect(16, 16, 224, 128);
    c.fillStyle = "#1f8a86";
    c.fillRect(16, 16, 224, 40);
    c.fillStyle = "#f4f1ea";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "bold 26px sans-serif";
    c.fillText("HOLLOWELL", 128, 37);
    c.fillStyle = "#c8352b";
    c.font = "bold 40px sans-serif";
    c.fillText("ACQUIRED", 128, 100);
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.strokeRect(3, 3, 250, 154);
  });
}

/** A board on a post, one geometry: the post's UVs sit in the frame's timber corner. */
function boardGeometry(): THREE.BufferGeometry {
  const board = new THREE.BoxGeometry(0.62, 0.38, 0.03);
  board.translate(0, 0.62, 0);
  const post = new THREE.BoxGeometry(0.05, 0.62, 0.05);
  post.translate(0, 0.31, -0.03);
  const uv = post.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.02, 0.03);
  const parts = [board, post].map((g) => g.toNonIndexed());
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const arrs = parts.map((g) => g.getAttribute(name) as THREE.BufferAttribute);
    const size = arrs[0]!.itemSize;
    const data = new Float32Array(arrs.reduce((n, a) => n + a.count * size, 0));
    let o = 0;
    for (const a of arrs) {
      data.set(a.array as Float32Array, o);
      o += a.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  for (const g of [board, post, ...parts]) g.dispose();
  return out;
}

export class Doorstep3D {
  readonly parcels: THREE.InstancedMesh;
  readonly card: THREE.Mesh;
  readonly board: THREE.Mesh;
  private cardCtx: CanvasRenderingContext2D;
  private cardTex: THREE.CanvasTexture;
  private cardExtra = -1;
  private shown = 0;
  /** The newest parcel's arc: seconds since it was thrown (ARC_S or more: landed). */
  private arc = ARC_S;
  private side: 1 | -1 = 1;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly p = new THREE.Vector3();

  constructor(private readonly reducedMotion: boolean) {
    const mat = new THREE.MeshStandardMaterial({ map: parcelTexture(), roughness: 0.22, metalness: 0 });
    this.parcels = new THREE.InstancedMesh(new THREE.BoxGeometry(PW, PH, PD), mat, DOORSTEP_SHOWN);
    this.parcels.count = 0;
    this.parcels.castShadow = true;
    this.parcels.frustumCulled = false;
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 96;
    this.cardCtx = cv.getContext("2d")!;
    this.cardTex = new THREE.CanvasTexture(cv);
    this.cardTex.colorSpace = THREE.SRGBColorSpace;
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.075), new THREE.MeshBasicMaterial({ map: this.cardTex, toneMapped: false }));
    this.card.position.set(0, 0.17, 0.292);
    this.card.rotation.z = -0.08;
    this.card.visible = false;
    this.board = new THREE.Mesh(boardGeometry(), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.6 }));
    this.board.castShadow = true;
    this.board.visible = false;
  }

  /** Hang the pile and the card on the farmhouse (in its frame, so they keep its scale, turn and lean) and stand the
   *  board beside the gate at (x, z) on the ground at y, facing `yaw`. `side` -1 piles the parcels left of the door. */
  attach(farmhouse: THREE.Object3D, side: 1 | -1, board: { x: number; y: number; z: number; yaw: number }, scene: THREE.Object3D): void {
    this.side = side;
    farmhouse.add(this.parcels, this.card);
    this.board.position.set(board.x, board.y, board.z);
    this.board.rotation.y = board.yaw;
    this.board.scale.setScalar(1.6);
    scene.add(this.board);
    this.shown = -1;
  }

  /** `lean`: how far the board leans back toward a steep lens (an upright phone), as the farmhouse does. */
  update(view: DoorstepView | null, dt: number, lean = 0): void {
    const shown = view?.shown ?? 0;
    if (shown !== this.shown) {
      // A new parcel arcs in; a cart-back or a sweep just takes them away.
      this.arc = shown > this.shown && this.shown >= 0 && !this.reducedMotion ? 0 : ARC_S;
      this.shown = shown;
      this.layOut(1);
    } else if (this.arc < ARC_S) {
      this.arc = Math.min(ARC_S, this.arc + dt);
      this.layOut(this.arc / ARC_S);
    }
    const card = !!view?.card;
    this.card.visible = card;
    const extra = view?.extra ?? 0;
    if (card && extra !== this.cardExtra) {
      this.cardExtra = extra;
      paintCard(this.cardCtx, extra);
      this.cardTex.needsUpdate = true;
    }
    this.board.visible = !!view?.sale;
    this.board.rotation.x = -lean;
  }

  /** Places the pile; the newest parcel is `p` (0-1) along its arc from the lane in front of the door. */
  private layOut(p: number): void {
    this.parcels.count = this.shown;
    for (let k = 0; k < this.shown; k++) {
      const to = parcelSlot3d(k, this.side);
      let tilt = ((k * 37) % 7) * 0.05 - 0.15;
      if (k === this.shown - 1 && p < 1) {
        // From the lane, about a cell out in front of the door, over a 0.35-high arc.
        const e = 1 - (1 - p) * (1 - p);
        this.p.set(to.x * e, to.y + (1 - e) * 0.25 + Math.sin(p * Math.PI) * 0.35, to.z + (1 - e) * 0.6);
        tilt += (1 - p) * 2.4;
      } else this.p.copy(to);
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, tilt);
      this.m.compose(this.p, this.q, this.s);
      this.parcels.setMatrixAt(k, this.m);
    }
    this.parcels.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const o of [this.parcels, this.card, this.board]) {
      o.removeFromParent();
      o.geometry.dispose();
      const mat = o.material as THREE.MeshStandardMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
  }
}
