// The viewmodel lab (vm-lab.html, dev only): the held gun and Cath's arms alone, lit exactly as in play, from
// the eye or from an orbit, so hand and gun shapes can be iterated in seconds instead of a full-game render.
import * as THREE from "three";
import { Arsenal } from "./weapons";
import { POSES } from "./hands";

const q = new URLSearchParams(location.search);
const phone = q.get("phone") === "1";
// Pose overrides for tuning: tR/tL = thumb euler, tcR/tcL = thumb curls, cR/cL = finger curls, wR/wL = wrap.
const nums = (k: string) => q.get(k)?.split(",").map(Number);
for (const [side, name] of [["R", "pistolR"], ["L", "pistolL"]] as const) {
  const p = POSES[name]!;
  const t = nums(`t${side}`);
  if (t) p.thumb = t as [number, number, number];
  const tc = nums(`tc${side}`);
  if (tc) p.thumbCurl = tc as [number, number];
  const c = nums(`c${side}`);
  if (c) p.curl = c as [number, number, number, number];
  const w = nums(`w${side}`);
  if (w) p.wrap = w[0];
}
const canvas = document.getElementById("vm") as HTMLCanvasElement;
document.body.style.setProperty("margin", "0");
document.body.style.setProperty("overflow", "hidden");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = phone ? 1.7 : 1.35;
const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get("bg") ?? "#0b0d12");
const cam = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.01, 10);
scene.add(cam);
// The world adds a faint sky to the view scene (render/world.ts); match it.
scene.add(new THREE.HemisphereLight(0x8899bb, 0x111111, 0.35));
const arsenal = new Arsenal(scene, phone);
arsenal.lightRoom(renderer);
arsenal.equipId(q.get("gun") ?? "kestrel");
arsenal.settle();
const aim = Number(q.get("aim") ?? 0);
arsenal.holdAim = aim > 0.5;
arsenal.aiming = aim > 0.5;
arsenal.anim.aim = aim;
const insp = Number(q.get("inspect") ?? -1);
arsenal.inspectHold = insp;
for (let i = 0; i < 90; i++) arsenal.pose(1 / 60, { yaw: 0, pitch: 0 }, 0, 0, false, 0, cam, 75);
// dbg=1 paints the right arm red and the left arm green, to tell the hands apart from odd angles.
if (q.has("dbg")) {
  arsenal.arms.right.mesh.material = new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.6 });
  arsenal.arms.left.mesh.material = new THREE.MeshStandardMaterial({ color: 0x30a040, roughness: 0.6 });
}
const view = q.get("view") ?? "vm";
const root = arsenal.rig.root;
root.updateMatrixWorld(true);
const target = new THREE.Vector3();
const focus = q.get("focus") ?? "gun";
if (focus === "handR") arsenal.arms.right.bones.hand.getWorldPosition(target);
else if (focus === "handL") arsenal.arms.left.bones.hand.getWorldPosition(target);
else root.getWorldPosition(target);
const dist = Number(q.get("dist") ?? 0.45);
const VIEWS: Record<string, [number, number, number]> = { side: [1, 0.1, 0], left: [-1, 0.1, 0], front: [0, 0.15, -1], below: [0.2, -1, 0.1], top: [0.05, 1, 0.2], back: [0.3, 0.4, 1] };
if (view !== "vm") {
  const v = new THREE.Vector3(...(VIEWS[view] ?? VIEWS.side!)).normalize().multiplyScalar(dist);
  // The orbit camera sits in the view scene's space; the lights stay where play has them.
  const oc = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.005, 10);
  oc.position.copy(target).add(v);
  oc.lookAt(target);
  scene.add(oc);
  renderer.render(scene, oc);
} else renderer.render(scene, cam);
(window as unknown as { vmlabReady: boolean }).vmlabReady = true;
