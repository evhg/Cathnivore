import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildFrontCath } from "../games/cathode/src/render/frontcath";

// The model paints a few canvas textures; this test only reads her meshes, so a do-nothing 2D context will do.
const anything: unknown = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : anything), apply: () => anything });
beforeAll(() => {
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => anything }) });
});
afterAll(() => vi.unstubAllGlobals());

// Plan item 278: on the class pick the five operatives read apart by silhouette alone. Each class's stance and kit,
// seen from the front and filled in black on a grid, overlaps every other class's by under 0.85 (intersection over
// union).
const CLASSES = ["ghost", "butcher", "gunslinger", "wirewitch", "fixer"];
const W = 80;
const H = 140;
const X0 = -0.9;
const X1 = 0.9;
const Y0 = -0.1;
const Y1 = 2.6;

function shown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function silhouette(cls: string): Uint8Array {
  const c = buildFrontCath(false);
  c.kit(cls);
  c.stance(cls, true);
  for (let i = 0; i < 3; i++) c.update(1 / 60, 10 + i / 60, { x: 0, z: 0 });
  c.group.updateMatrixWorld(true);
  const grid = new Uint8Array(W * H);
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const toCell = (p: THREE.Vector3) => [((p.x - X0) / (X1 - X0)) * W, ((Y1 - p.y) / (Y1 - Y0)) * H] as const;
  c.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (o as THREE.Sprite).isSprite || !shown(o)) return;
    const pos = m.geometry.getAttribute("position");
    if (!pos) return;
    const idx = m.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const pts = [0, 1, 2].map((k) => {
        const i = idx ? idx.getX(t + k) : t + k;
        return toCell(v[k]!.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
      });
      const [a, b, d] = pts as [readonly [number, number], readonly [number, number], readonly [number, number]];
      const area = (b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], d[0])));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], d[0])));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], d[1])));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], d[1])));
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((b[0] - px) * (d[1] - py) - (d[0] - px) * (b[1] - py)) / area;
          const w1 = ((d[0] - px) * (a[1] - py) - (a[0] - px) * (d[1] - py)) / area;
          if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) grid[y * W + x] = 1;
        }
    }
  });
  c.dispose();
  return grid;
}

describe("NIGHT SHIFT class-pick silhouettes (plan item 278)", () => {
  it("differ pairwise: intersection over union under 0.85", () => {
    const sil = CLASSES.map(silhouette);
    for (const s of sil) expect(s.reduce((n, x) => n + x, 0)).toBeGreaterThan(400);
    const ious: string[] = [];
    for (let i = 0; i < sil.length; i++)
      for (let j = i + 1; j < sil.length; j++) {
        let inter = 0;
        let union = 0;
        for (let k = 0; k < W * H; k++) {
          inter += sil[i]![k]! & sil[j]![k]!;
          union += sil[i]![k]! | sil[j]![k]!;
        }
        const iou = inter / union;
        ious.push(`${CLASSES[i]}/${CLASSES[j]} ${iou.toFixed(2)}`);
        expect(iou, `${CLASSES[i]} vs ${CLASSES[j]}`).toBeLessThan(0.85);
      }
    console.log(ious.join(", "));
  });
});
