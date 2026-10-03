// PLACEHOLDER world: a dark wet slab with a few neon boxes, so the game layer and the e2e boot test have
// something to stand in while the real Drowned Market (ROADMAP 65) is built. It implements the full
// contract in types.ts; replace it wholesale.

import * as THREE from "three";
import type { CreateWorld, Effects, World } from "./types";

export const createWorld: CreateWorld = async (canvas, options, onProgress) => {
  onProgress?.(0.2, "Rain over the Drowned Market…");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.FogExp2(0x0a0c14, 0.035);
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 400);
  camera.position.set(0, 1.7, 8);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.15, metalness: 0.2 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x223355, 0x050505, 0.4));

  const colliders: THREE.Box3[] = [];
  const neon = [0xff2e88, 0x2ee6ff, 0xffb347];
  for (let i = 0; i < 12; i++) {
    const w = 3 + (i % 3);
    const h = 6 + ((i * 7) % 10);
    const x = (i % 2 ? 1 : -1) * (7 + (i % 3));
    const z = -i * 6 + 10;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), new THREE.MeshStandardMaterial({ color: 0x1c1f27, roughness: 0.8 }));
    b.position.set(x, h / 2, z);
    scene.add(b);
    colliders.push(new THREE.Box3().setFromObject(b));
    const c = neon[i % 3]!;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 2.4), new THREE.MeshBasicMaterial({ color: c }));
    sign.position.set(x - Math.sign(x) * (w / 2 + 0.15), 3.5, z);
    scene.add(sign);
    const l = new THREE.PointLight(c, 6, 10, 2);
    l.position.copy(sign.position).add(new THREE.Vector3(-Math.sign(x), 0, 0));
    scene.add(l);
  }
  onProgress?.(1, "Ready");

  const noop = () => {};
  const fx: Effects = { muzzle: noop, impact: noop, blood: noop, sparks: noop, casing: noop, tracer: noop, explosion: noop };

  const viewScene = new THREE.Scene();
  viewScene.add(new THREE.HemisphereLight(0x8899bb, 0x111111, 1.2));
  const viewCamera = new THREE.PerspectiveCamera(55, 16 / 9, 0.01, 10);
  const world: World = {
    renderer,
    viewScene,
    viewCamera,
    scene,
    camera,
    colliders,
    markers: { player: [new THREE.Vector3(0, 0, 8)], extract: [new THREE.Vector3(0, 0, -60)] },
    fx,
    wind: { x: 1.5, z: 0 },
    groundHeight: () => 0,
    lightAt: () => 0.3,
    surfaceAt: () => "concrete",
    update: noop,
    render: () => {
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
    },
    resize(w, h, dpr) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = viewCamera.aspect = w / h;
      camera.updateProjectionMatrix();
      viewCamera.updateProjectionMatrix();
    },
    setDrama: noop,
    dispose: () => renderer.dispose(),
  };
  void options;
  return world;
};
