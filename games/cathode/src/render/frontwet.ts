// Plan item 261: the title's wet ground. Two flat decals on the street, drawn by the scene's own pass (2 draw calls):
// - the LUNA sign's reflection: a streak of broken pink light on the wet asphalt, running from the ground under the
//   sign toward the lens, as a lit sign reads on a rainy street (a mirror pass at her feet showed nothing at the
//   pick's lens: item 148's puddle). It follows the sign wherever plan item 258 hangs it, and stutters with its tubes.
// - a contact shadow: a soft dark oval under her shoes, so she stands on the street, not on black.

import * as THREE from "three";

export interface FrontWet {
  readonly group: THREE.Group;
  /** Place the streak under the sign (world position, its width in m), toward the lens; `lit` is the tube level 0..1. */
  update(sign: THREE.Vector3, signW: number, cam: THREE.Vector3, lit: number, groundAt: (x: number, z: number) => number): void;
  /** Her feet (world) and facing (yaw), for the contact shadow. */
  feet(p: THREE.Vector3, yaw: number): void;
  dispose(): void;
}

const PINK = new THREE.Color(1.0, 0.09, 0.42);

export function streakTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    // Seeded, so every load (and every screenshot) lays the same ripples.
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // Ripple glints: short horizontal dashes stacked in loose columns, dense and bright at the top (the sign's end),
    // thinning and dimming toward the lens, each one feathered at its ends so no quad edge shows.
    const dash = (x: number, y: number, w: number, h: number, a: number) => {
      const grad = g.createLinearGradient(x - w, 0, x + w, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${a.toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(x - w, y, w * 2, h);
    };
    for (let y = 0; y < 256; ) {
      const fall = Math.pow(1 - y / 256, 1.6);
      const n = 2 + Math.round(rnd() * 3);
      for (let i = 0; i < n; i++) {
        // Bunched toward the middle: the sign's word, not its frame, lights the most water.
        const u = (rnd() + rnd() + rnd()) / 3;
        const x = 10 + u * 108;
        const core = 1 - Math.abs(u - 0.5) * 1.6;
        dash(x, y, 6 + rnd() * 16, 1 + rnd() * 2.5, Math.max(0, 0.9 * core * fall * (0.5 + 0.5 * rnd())));
      }
      y += 2 + rnd() * 3 + (y / 256) * 6;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(0,0,0,0.85)");
    r.addColorStop(0.45, "rgba(0,0,0,0.6)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

function sheenTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,0.9)");
    r.addColorStop(0.35, "rgba(255,255,255,0.55)");
    r.addColorStop(0.7, "rgba(255,255,255,0.18)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    // Rain rings on the wet sheen: a few faint circles, seeded.
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = 10 + rnd() * 44;
      g.beginPath();
      g.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + rnd() * 5, 1.5 + rnd() * 3, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildFrontWet(): FrontWet {
  const group = new THREE.Group();
  group.name = "front-wet";
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const streakMat = new THREE.MeshBasicMaterial({
    map: streakTexture(),
    color: PINK.clone(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const streak = new THREE.Mesh(flat, streakMat);
  streak.name = "front-wet-streak";
  streak.renderOrder = 2;
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const shadow = new THREE.Mesh(flat, shadowMat);
  shadow.name = "front-wet-shadow";
  shadow.renderOrder = 3;
  // The wet street round her catches the sky and the shop light: a faint cool sheen she stands in, so the street
  // reads as a floor and the contact shadow has something to darken.
  const sheenMat = new THREE.MeshBasicMaterial({ map: sheenTexture(), color: new THREE.Color(0.16, 0.24, 0.32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const sheen = new THREE.Mesh(flat, sheenMat);
  sheen.name = "front-wet-sheen";
  sheen.renderOrder = 0;
  group.add(sheen, streak, shadow);
  const dir = new THREE.Vector3();
  return {
    group,
    update(sign, signW, cam, lit, groundAt) {
      const y = groundAt(sign.x, sign.z) + 0.012;
      dir.set(cam.x - sign.x, 0, cam.z - sign.z);
      const d = dir.length();
      if (d < 0.2) {
        streak.visible = false;
        return;
      }
      streak.visible = true;
      dir.divideScalar(d);
      // From just behind the sign's foot to most of the way to the lens.
      const len = Math.min(4.5, 0.85 * d);
      streak.position.set(sign.x + dir.x * (len / 2 - 0.15), y, sign.z + dir.z * (len / 2 - 0.15));
      streak.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
      streak.scale.set(Math.max(0.3, signW * 0.9), 1, len);
      // HDR above 1 so the bright core blooms a little, as the tubes do; it stutters with them.
      streakMat.color.copy(PINK).multiplyScalar(1.3 * (0.25 + 0.75 * lit));
    },
    feet(p, yaw) {
      shadow.position.set(p.x, p.y + 0.01, p.z);
      shadow.rotation.set(0, yaw, 0);
      shadow.scale.set(0.62, 1, 0.42);
      sheen.position.set(p.x, p.y + 0.008, p.z);
      sheen.rotation.set(0, yaw, 0);
      sheen.scale.set(3.2, 1, 2.6);
    },
    dispose() {
      group.removeFromParent();
      flat.dispose();
      streakMat.map?.dispose();
      streakMat.dispose();
      shadowMat.map?.dispose();
      shadowMat.dispose();
      sheenMat.map?.dispose();
      sheenMat.dispose();
    },
  };
}
