// Plan item 51: the office's standing mirror shows Cath. A Reflector on the mirror's glass, whose camera alone
// sees a hero model (item 9) that stands where the player stands, turned the way she faces, in the coat the
// wardrobe saved. It renders only while she is near the mirror and facing it. The phone tier has no reflector:
// a framed photo of her stands on the wardrobe's shelf instead (cheaper, and it still says whose room this is).

import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { buildFrontCath, type FrontCath } from "./frontcath";
import { OFFICE } from "./levels/office";
import { LAYER_NO_REFLECT } from "./reflection";

/** The layer only the mirror's camera draws: her reflection. */
export const LAYER_REFLECTION = 3;

export interface OfficeMirror {
  readonly group: THREE.Group;
  /** Each frame: where she stands (feet) and which way she faces (the player's yaw). */
  update(feet: THREE.Vector3, yaw: number, t: number): void;
  dispose(): void;
  /** True while the reflector rendered last frame (tests). */
  readonly live: boolean;
}

export function buildOfficeMirror(coat: THREE.Color | null, phone: boolean): OfficeMirror {
  const group = new THREE.Group();
  group.name = "office-mirror";
  const glassAt = new THREE.Vector3(OFFICE.xW + 0.27, 1.0, -1.7);
  if (phone) {
    // A framed photo of her: a small card with her silhouette under the umbrella, on the wardrobe's top.
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 160;
    const g = c.getContext("2d")!;
    g.fillStyle = "#2a2230";
    g.fillRect(0, 0, 128, 160);
    g.fillStyle = "#e9d7c2";
    g.beginPath();
    g.arc(64, 62, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4a6a3a";
    g.fillRect(44, 80, 40, 62);
    g.fillStyle = "#151515";
    g.fillRect(46, 44, 36, 14);
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.6 }));
    photo.position.set(OFFICE.xW + 0.75, 2.32, -3.0);
    photo.rotation.set(-0.12, Math.PI / 2, 0);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.4, metalness: 0.6 }));
    frame.position.set(OFFICE.xW + 0.74, 2.32, -3.0);
    frame.rotation.set(0, 0, 0.12);
    group.add(frame, photo);
    return { group, update() {}, dispose() {}, live: false };
  }
  const mirror = new Reflector(new THREE.PlaneGeometry(0.6, 1.72), { textureWidth: 360, textureHeight: 1024, color: 0xc4c8d0, clipBias: 0.003 });
  mirror.position.copy(glassAt);
  mirror.rotation.y = Math.PI / 2;
  // Not in the wet-floor mirror's pass (a mirror inside a mirror), and her reflection only in this one.
  mirror.layers.set(LAYER_NO_REFLECT);
  mirror.camera.layers.enable(LAYER_REFLECTION);
  group.add(mirror);
  const cath: FrontCath = buildFrontCath(false);
  cath.indoors(true);
  if (coat) cath.coat(coat);
  cath.group.traverse((o) => o.layers.set(LAYER_REFLECTION));
  group.add(cath.group);
  const normal = new THREE.Vector3(1, 0, 0);
  const toHer = new THREE.Vector3();
  const state = { live: false };
  return {
    group,
    get live() {
      return state.live;
    },
    update(feet, yaw, t) {
      toHer.set(feet.x - glassAt.x, 0, feet.z - glassAt.z);
      const dist = toHer.length();
      // Facing the glass: her forward (yaw 0 looks down -z) points back at it.
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const facing = fwd.dot(normal) < -0.2;
      state.live = dist < 4.5 && facing && toHer.dot(normal) > 0;
      mirror.visible = state.live;
      cath.group.visible = state.live;
      if (!state.live) return;
      cath.group.position.set(feet.x, feet.y, feet.z);
      // The model faces +z at rotation 0; she faces along fwd.
      cath.group.rotation.y = Math.atan2(fwd.x, fwd.z);
      cath.update(1 / 60, t, { x: 0, z: 0 });
    },
    dispose() {
      mirror.dispose();
      cath.dispose();
    },
  };
}
