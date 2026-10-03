// The Almanac's turntable (ROADMAP 50): one model at a time, slowly turning under a warm studio light, in a
// small canvas at the top of the Almanac. Drag to spin it yourself. Uses the battlefield's own models.

import * as THREE from "three";
import type { EnemyKind, MegaId, TowerKind } from "../engine";
import { buildEnemy, buildMega, buildTower } from "./models";

export type Subject =
  | { tower: TowerKind; tier: 1 | 2 | 3 | 4; spec: 0 | 1 | null }
  | { mega: MegaId }
  | { enemy: EnemyKind };

export class Turntable {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private obj: THREE.Object3D | null = null;
  private raf = 0;
  private last = 0;
  private spin = 0;
  private drag: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight("#fff4e0", "#5c6b3a", 1.4));
    const key = new THREE.DirectionalLight("#fff1d0", 2.6);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight("#9fc4ff", 1.2);
    rim.position.set(-4, 3, -3);
    this.scene.add(key, rim);
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.35, 0.12, 40),
      new THREE.MeshStandardMaterial({ color: "#e9dcc2", roughness: 0.6 }),
    );
    plinth.position.y = -0.06;
    this.scene.add(plinth);
    canvas.addEventListener("pointerdown", (e) => {
      this.drag = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.drag === null) return;
      this.spin += (e.clientX - this.drag) * 0.012;
      this.drag = e.clientX;
    });
    for (const ev of ["pointerup", "pointercancel"] as const) canvas.addEventListener(ev, () => (this.drag = null));
  }

  static supported(): boolean {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
      return false;
    }
  }

  show(s: Subject): void {
    if (this.obj) this.scene.remove(this.obj);
    const obj =
      "tower" in s ? buildTower(s.tower, s.tier, s.spec) : "mega" in s ? buildMega(s.mega) : buildEnemy(s.enemy);
    // Fit it on the plinth, whatever its size.
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.7 / Math.max(size.x, size.y, size.z, 0.01);
    obj.scale.multiplyScalar(k);
    const fit = new THREE.Box3().setFromObject(obj);
    obj.position.y -= fit.min.y;
    this.obj = obj;
    this.spin = -0.6;
    this.scene.add(obj);
    const h = (fit.max.y - fit.min.y) / 2;
    this.camera.position.set(0, h + 1.6, 4.6);
    this.camera.lookAt(0, h * 0.8, 0);
    this.start();
  }

  private start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const w = this.canvas.clientWidth;
      const hgt = this.canvas.clientHeight;
      if (w && hgt && (this.canvas.width !== Math.round(w * devicePixelRatio) || this.canvas.height !== Math.round(hgt * devicePixelRatio))) {
        this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
        this.renderer.setSize(w, hgt, false);
        this.camera.aspect = w / hgt;
        this.camera.updateProjectionMatrix();
      }
      if (this.drag === null) this.spin += dt * 0.6;
      if (this.obj) this.obj.rotation.y = this.spin;
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
