import * as THREE from "three";

/**
 * Plan item 78: the 3D camera fitted to the field, as a pure function of the field's size and the canvas's aspect
 * (no renderer), so it can be unit-tested. The elevation matches the field's projected shape to the frame's (steep
 * on an upright screen, low on a wide one); the camera comes as close as the field's width allows, aimed so the
 * near edge sits at the frame's foot and the far edge leaves a band of about 14% for the hills and item 66's sky.
 */
export interface CameraFit {
  el: number;
  dist: number;
  target: [number, number, number];
}

const FOV = 32;

export function fitCamera3d(cols: number, rows: number, aspect: number): CameraFit {
  // The elevation (2 degree steps, a low country view to a steep one) whose fit fills the most of the frame.
  const steepest = aspect < 0.8 ? 74 : 62;
  let best: CameraFit | null = null;
  let share = -1;
  for (let deg = 30; deg <= steepest; deg += 2) {
    const f = fitAt(cols, rows, aspect, (deg * Math.PI) / 180);
    const s = fieldCoverage(cols, rows, aspect, f).share;
    if (s > share + 0.004) {
      share = s;
      best = f;
    }
  }
  return best!;
}

function fitAt(cols: number, rows: number, aspect: number, el: number): CameraFit {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 120);
  const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
  const NEAR = -0.95; // the near edge sits at the frame's foot...
  const FAR = 0.8; // ...and the far edge leaves a band of about 10% for the hills and the sky card.
  const ys = (t: THREE.Vector3, d: number) => {
    place(camera, t, dir, d);
    const near = new THREE.Vector3(cols / 2, 0, rows + 0.25).project(camera).y;
    const far = new THREE.Vector3(cols / 2, 0.3, -0.25).project(camera).y;
    return { near, far };
  };
  // For a distance, slide the look point along the field so its near edge lands at NEAR.
  const aim = (d: number): THREE.Vector3 => {
    let lo = -rows;
    let hi = rows * 2;
    const t = new THREE.Vector3(cols / 2, 0, rows / 2);
    for (let i = 0; i < 28; i++) {
      t.z = (lo + hi) / 2;
      // Looking further towards the viewer lifts the near edge up the frame.
      if (ys(t, d).near < NEAR) lo = t.z;
      else hi = t.z;
    }
    return t;
  };
  const sides = [
    [-0.25, 0, rows + 0.25],
    [cols + 0.25, 0, rows + 0.25],
    [-0.25, 0.9, -0.25],
    [cols + 0.25, 0.9, -0.25],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  let lo = 3;
  let hi = 90;
  let best = aim(hi);
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const t = aim(mid);
    const { far } = ys(t, mid);
    // (Item 66's sky card: requiring even a sliver of sky on a wide frame cost the field a fifth of its share, so
    // the band above the field shows the hills and far houses; an upright screen still has sky above them.)
    const fits = far <= FAR && sides.every((c) => Math.abs(c.clone().project(camera).x) <= 0.97);
    if (fits) {
      hi = mid;
      best = t;
    } else lo = mid;
  }
  return { el, dist: hi, target: [best.x, best.y, best.z] };
}

export function place(camera: THREE.PerspectiveCamera, target: THREE.Vector3, dir: THREE.Vector3, dist: number): void {
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
}

/** The field's projected bounding box in the frame (0..1 each way, y down) for a fit, and the bands left off it. */
export function fieldCoverage(cols: number, rows: number, aspect: number, fit: CameraFit): { box: [number, number, number, number]; bands: { left: number; right: number; top: number; bottom: number }; share: number } {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 120);
  const target = new THREE.Vector3(...fit.target);
  place(camera, target, new THREE.Vector3(0, Math.sin(fit.el), Math.cos(fit.el)), fit.dist);
  const pts = [
    [0, 0, 0], [cols, 0, 0], [0, 0, rows], [cols, 0, rows],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).project(camera)).map((p) => [(p.x + 1) / 2, (1 - p.y) / 2] as const);
  const x0 = Math.max(0, Math.min(...pts.map((p) => p[0])));
  const x1 = Math.min(1, Math.max(...pts.map((p) => p[0])));
  const y0 = Math.max(0, Math.min(...pts.map((p) => p[1])));
  const y1 = Math.min(1, Math.max(...pts.map((p) => p[1])));
  return { box: [x0, y0, x1, y1], bands: { left: x0, right: 1 - x1, top: y0, bottom: 1 - y1 }, share: (x1 - x0) * (y1 - y0) };
}
