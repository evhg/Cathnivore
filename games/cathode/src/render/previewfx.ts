// Plan item 481, slice 3: the stage pieces a skill preview leaves standing for its length, so a look reads in a
// still frame and not only as a few sparks: Cold Read's weak-spot reticle on the bottle, the Wirewitch's wire cage
// over the crate (cyan for a backdoor, white-hot for an overload), the Moth drone flying from her palm to the
// target, and the Fixer's sentry set down beside the crate. Driven by the scene's clock (a frozen shot at t shows
// the pose at t). Everything is hidden outside a preview, so the pick's draw calls are unchanged.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PreviewLook } from "../game/skillpreview";

export interface PreviewFx {
  group: THREE.Group;
  /** Start a look at scene time `now` (seconds) for `ms`, from her hand toward the target. */
  play(look: PreviewLook, now: number, ms: number, hand: THREE.Vector3, aim: THREE.Vector3, crate: THREE.Vector3, sentryAt?: THREE.Vector3): void;
  stop(): void;
  update(now: number, cam: THREE.Camera): void;
  /** The sentry's muzzle in world space (for its flashes). */
  sentryMuzzle(out: THREE.Vector3): THREE.Vector3;
  /** What stands now (for the tests): "" when nothing does. */
  showing(): string;
  dispose(): void;
}

function reticleTexture(): THREE.Texture {
  // (no DOM in the unit tests: a blank texture there)
  if (typeof document === "undefined") return new THREE.Texture();
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.translate(64, 64);
  g.strokeStyle = "#ffffff";
  g.lineCap = "round";
  // the ring, broken at four points
  g.lineWidth = 7;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(0, 0, 44, i * (Math.PI / 2) + 0.22, (i + 1) * (Math.PI / 2) - 0.22);
    g.stroke();
  }
  // the ticks in toward the centre, and the centre's diamond
  g.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2);
    g.beginPath();
    g.moveTo(Math.cos(a) * 56, Math.sin(a) * 56);
    g.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
    g.stroke();
  }
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(9, 0);
  g.lineTo(0, 9);
  g.lineTo(-9, 0);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildPreviewFx(): PreviewFx {
  const group = new THREE.Group();
  group.name = "skillPreviewFx";
  const hdr = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const;

  // Cold Read: an amber reticle on the bottle, closing in and pulsing.
  const tex = reticleTexture();
  // (a camera-facing plane, not a Sprite: the pick's pipeline didn't draw a Sprite)
  const reticleMat = new THREE.MeshBasicMaterial({ map: tex, color: hdr(1.0, 0.5, 0.1), ...additive, depthTest: false, side: THREE.DoubleSide });
  const reticle = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), reticleMat);
  reticle.renderOrder = 10;

  // The Wirewitch: a cage of light over the crate.
  const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.46, 0.4, 0.4, 2, 2, 2));
  const cageMat = new THREE.LineBasicMaterial({ color: hdr(0.3, 2.2, 2.6), ...additive });
  const cage = new THREE.LineSegments(cageGeo, cageMat);
  // ...filled with a faint glow, so it reads on a phone's frame, where its one-pixel lines alone were lost (slice 5)
  const cageGlowGeo = new THREE.BoxGeometry(0.46, 0.4, 0.4);
  const cageGlowMat = new THREE.MeshBasicMaterial({ color: hdr(0.05, 0.42, 0.5), ...additive });
  cage.add(new THREE.Mesh(cageGlowGeo, cageGlowMat));

  // Daemon: the Moth, a small drone with a lit eye and two rotor discs (one mesh).
  const moth = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.35, metalness: 0.7, emissive: 0x2ad8ff, emissiveIntensity: 1.4 }));
    body.scale.set(1.4, 0.6, 1);
    const rotors = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.085, 18),
      new THREE.MeshBasicMaterial({ color: hdr(0.6, 2.2, 2.8), ...additive, opacity: 0.7, side: THREE.DoubleSide }),
    );
    rotors.rotation.x = -Math.PI / 2;
    rotors.position.y = 0.04;
    rotors.scale.set(2.2, 1, 1);
    moth.add(body, rotors);
  }

  // Workshop: a squat sentry on three legs with its barrel to the street.
  const sentry = new THREE.Group();
  {
    // gunmetal head with an ammo drum, a long barrel, three splayed legs and a red sensor strip
    const steel = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.5, metalness: 0.55, });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.085, 0.12), steel);
    head.position.y = 0.3;
    head.name = "sentryHead";
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.24, 8), steel);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.17, 0.305, 0);
    const legGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.008, 0.01, 0.3, 5);
      g.translate(0, -0.15, 0);
      g.rotateZ(0.42);
      g.rotateY((i * Math.PI * 2) / 3 + 0.3);
      g.translate(0, 0.27, 0);
      legGeos.push(g);
    }
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), steel);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(-0.03, 0.29, -0.085);
    const legs = new THREE.Mesh(mergeGeometries(legGeos), steel);
    for (const g of legGeos) g.dispose();
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.08), new THREE.MeshBasicMaterial({ color: hdr(3, 0.35, 0.1), toneMapped: false }));
    eye.position.set(0.086, 0.318, 0);
    sentry.add(head, barrel, legs, drum, eye);
  }

  group.add(reticle, cage, moth, sentry);
  for (const o of group.children) o.visible = false;

  let look: PreviewLook | null = null;
  let t0 = 0;
  let dur = 0;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const crateAt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const sentrySpot = new THREE.Vector3();

  const stop = () => {
    look = null;
    for (const o of group.children) o.visible = false;
  };

  return {
    group,
    play(l, now, ms, hand, aim, crate, sentryAt) {
      stop();
      look = l;
      t0 = now;
      dur = ms / 1000;
      from.copy(hand);
      to.copy(aim);
      crateAt.copy(crate);
      sentrySpot.copy(sentryAt ?? crate);
    },
    stop,
    update(now, cam) {
      if (!look) return;
      const u = (now - t0) / dur;
      if (u >= 1 || u < 0) {
        stop();
        return;
      }
      // in over the first 15%, out over the last 20%
      const env = Math.min(1, u / 0.15) * Math.min(1, (1 - u) / 0.2);
      switch (look) {
        case "mark": {
          reticle.visible = true;
          reticle.position.copy(to);
          // closes from wide onto the bottle, then breathes
          const close = 1 - Math.pow(1 - Math.min(1, u / 0.3), 3);
          const s = 0.42 - 0.24 * close + 0.015 * Math.sin(now * 14);
          reticle.scale.set(s, s, 1);
          reticle.quaternion.copy(cam.quaternion);
          reticle.rotateZ((1 - close) * 1.2);
          // (LDR: an HDR reticle bloomed into a white veil over the whole stage)
          reticleMat.opacity = env * (0.8 + 0.2 * Math.sin(now * 9));
          break;
        }
        case "hack":
        case "overload": {
          cage.visible = true;
          cage.position.copy(crateAt).setY(crateAt.y + 0.2);
          const hot = look === "overload";
          // the backdoor's cage draws up out of the ground; the overload's flickers white-hot
          const grow = hot ? 1 : Math.min(1, u / 0.35);
          cage.scale.set(1, Math.max(0.02, grow), 1);
          cage.position.y = crateAt.y + 0.2 * grow;
          const flick = hot ? 0.55 + 0.45 * Math.abs(Math.sin(now * 37) * Math.sin(now * 13)) : 0.8 + 0.2 * Math.sin(now * 6);
          cageMat.color.copy(hot ? hdr(2.6, 2.6, 3.2) : hdr(0.3, 2.2, 2.6)).multiplyScalar(flick);
          cageMat.opacity = env;
          cageGlowMat.color.copy(cageMat.color).multiplyScalar(0.4);
          cageGlowMat.opacity = env;
          break;
        }
        case "moth": {
          moth.visible = true;
          // lifts off her palm, rises, then crosses to hover over the target
          const k = Math.min(1, u / 0.6);
          const e = k * k * (3 - 2 * k);
          tmp.lerpVectors(from, to, e);
          tmp.y += 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.1)) + 0.12 * e;
          moth.position.copy(tmp);
          moth.position.y += 0.02 * Math.sin(now * 11);
          moth.lookAt(cam.position.x, moth.position.y, cam.position.z);
          moth.children[1]!.rotation.z = now * 40;
          break;
        }
        case "sentry": {
          sentry.visible = true;
          // set down beside the crate, toward the lens; it drops in over the first 20%
          const drop = Math.min(1, u / 0.2);
          sentry.position.copy(sentrySpot);
          sentry.position.y += 0.25 * (1 - drop * drop);
          // its barrel (+x) points past the lens's side, out to the street
          sentry.lookAt(cam.position.x, sentry.position.y, cam.position.z);
          sentry.rotateY(Math.PI / 2 + 0.6);
          break;
        }
        default:
          stop();
      }
    },
    sentryMuzzle(out) {
      sentry.updateMatrixWorld(true);
      return out.set(0.3, 0.305, 0).applyMatrix4(sentry.matrixWorld);
    },
    showing: () => (look && group.children.some((o) => o.visible) ? look : ""),
    dispose() {
      tex.dispose();
      reticleMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
      cageGlowGeo.dispose();
      cageGlowMat.dispose();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
      group.removeFromParent();
    },
  };
}
