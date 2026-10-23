// C10 (S3.1, S3.4): the enemy review turntable, `?shot&arch=<id>[&lod=0|1|2][&pose=idle|aim|run][&phone=1][&sil=1]
// [&view=lineup|close|back]`. The archetype (or `all` of them) in a neutral studio (a dark cyclorama, a soft room
// reflection, a warm key and a cool rim), turned 0, 45, 90 and 180 degrees, or side by side for `all`. `sil=1` is
// S3.1's silhouette test: flat black on mid grey. Built for review and for the critique: it loads in a second, where
// the street takes a minute under SwiftShader.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ENFORCER, ENFORCER_SNIPER, NURSE, ORDERLY, Enemy, RIOT_SHIELD, type EnemyKit } from "./enemy";
import { bodyView } from "./body";
import { LAYER_NO_REFLECT } from "../render/reflection";

const KITS: Record<string, EnemyKit> = {
  enforcer: ENFORCER,
  leader: { ...ENFORCER, name: "Enforcer Sergeant", leader: true },
  riot: RIOT_SHIELD,
  sniper: ENFORCER_SNIPER,
  orderly: ORDERLY,
  nurse: NURSE,
};

export function openTurntable(canvas: HTMLCanvasElement): void {
  const q = new URLSearchParams(location.search);
  const phone = q.get("phone") === "1" || q.get("quality") === "phone";
  bodyView.phone = phone;
  const lod = q.get("lod");
  bodyView.forceLod = lod === "1" ? 1 : lod === "2" ? 2 : 0;
  const sil = q.get("sil") === "1";
  const view = q.get("view") ?? "lineup";
  const pose = q.get("pose") ?? "idle";
  const archParam = q.get("arch") ?? "enforcer";
  const archs = archParam === "all" ? ["enforcer", "leader", "riot", "sniper", "orderly", "nurse"] : [archParam];
  // C14 (S9.6): view=portrait is the loading screen's plate of the next name: head and shoulders, 1:1.25, under one
  // hard top light (a surveillance still), turned by `yaw` (degrees). scripts/cathode-portraits.mjs renders them.
  const portrait = view === "portrait";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = !sil;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sil ? 0x808080 : portrait ? 0x07080a : 0x161a22);
  if (portrait) {
    renderer.toneMappingExposure = 0.9;
    // The top light: straight down, a touch in front, a tight cone (the brow and the visor rim take it, the face
    // falls into shadow under them), and a faint cold edge from behind so the shoulders hold the frame.
    const top = new THREE.SpotLight(0xfff1de, 34, 12, 0.3, 0.7, 1.2);
    top.position.set(0.1, 4.6, 0.35);
    top.target.position.set(0, 1.45, 0);
    scene.add(top, top.target);
    const edge = new THREE.SpotLight(0x9fc4ff, 14, 12, 0.5, 0.6, 1.4);
    edge.position.set(-1.8, 2.4, -2.6);
    edge.target.position.set(0, 1.5, 0);
    scene.add(edge, edge.target);
  } else if (!sil) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pm.dispose();
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.38, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.HemisphereLight(0x8090b0, 0x101012, 0.45));
    // A warm key high to the left (a sodium street lamp), a cool neon rim behind to the right.
    const key = new THREE.SpotLight(0xffc690, 60, 20, 0.6, 0.6, 1.4);
    key.position.set(-3.2, 4.6, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key, key.target);
    const rim = new THREE.SpotLight(0x58d8ff, 70, 20, 0.7, 0.5, 1.4);
    rim.position.set(3.4, 3.2, -3.6);
    scene.add(rim, rim.target);
  }
  const yawDeg = Number(q.get("yaw") ?? "18") || 0;
  const turns = portrait ? [THREE.MathUtils.degToRad(yawDeg)] : archs.length === 1 ? (view === "back" ? [Math.PI] : [0, Math.PI / 4, Math.PI / 2, Math.PI]) : archs.map(() => 0.35);
  const kits = archs.length === 1 ? turns.map(() => archs[0]!) : archs;
  const gap = view === "close" || portrait ? 0 : 1.05;
  const shown = view === "close" || portrait ? 1 : kits.length;
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const enemies: Enemy[] = [];
  for (let i = 0; i < shown; i++) {
    const kit = KITS[kits[i]!] ?? ENFORCER;
    // The portrait is the person, not their shield.
    const e = new Enemy({ ...kit, ...(portrait && kit.role === "shield" ? { role: "rifle" as const } : {}) }, [new THREE.Vector3()], 1);
    e.motion.pos.set((i - (shown - 1) / 2) * gap, 0, 0);
    e.motion.yaw = turns[i]!;
    e.motion.aim = pose === "aim" ? 1 : 0;
    e.motion.speed = pose === "run" ? 4.2 : 0;
    e.passive = true;
    scene.add(e.body.root);
    enemies.push(e);
  }
  bodyView.eye.set(0, 1.6, 4);
  // Settle the cloth and the springs on the pose.
  for (let k = 0; k < 120; k++)
    for (const e of enemies) {
      if (pose === "run") e.motion.phase += (4.2 / 60) * 3;
      e.feel(1 / 60, [], () => 0);
    }
  if (sil) scene.overrideMaterial = black;
  const cam = new THREE.PerspectiveCamera(portrait ? 22 : view === "close" ? 26 : 30, window.innerWidth / window.innerHeight, 0.05, 60);
  // The bodies draw on the main view's layer (the street's mirror sees a LOD2 stand-in instead).
  cam.layers.enable(LAYER_NO_REFLECT);
  const frame = () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    const w = portrait ? 0.5 : Math.max(1.2, shown * gap + 0.6);
    const h = portrait ? 0.82 : view === "close" ? 1.1 : 2.15;
    const fy = THREE.MathUtils.degToRad(cam.fov);
    const dist = Math.max(h / 2 / Math.tan(fy / 2), w / 2 / (Math.tan(fy / 2) * cam.aspect)) * 1.08;
    const ty = portrait ? 1.62 : view === "close" ? 1.42 : 0.98;
    cam.position.set(0, ty + (portrait ? 0.02 : 0.15), dist);
    cam.lookAt(0, ty, 0);
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bodyView.eye.copy(cam.position);
    for (const e of enemies) e.body.pose();
    renderer.render(scene, cam);
  };
  frame();
  window.addEventListener("resize", frame);
  (window as unknown as { cathodeTurntable: unknown }).cathodeTurntable = { ready: true, render: frame, enemies };
}
