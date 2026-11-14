// Plan item 283: the title street as a lit diorama, not a void. Behind the menus the left of the desktop title was
// flat black (the street's far side and its sky), so Cath stood in nothing. Three depth layers fill it, all drawn
// by the scene's own pass:
// - near: the wet cobbles take a sodium pool under a street lamp, broken by rain rings;
// - middle: the lamp itself, an iron post with a cobra head, its HDR lamp blooming, and the cone of light it cuts
//   through the rain (a shader cone whose streaks fall; held still under reduced motion and in shots);
// - far: steam rising from a grate, lit amber by the lamp.
// The lamp is also a real pooled light (render/lighting.ts), so the street and the walls round it catch it.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { streakTexture } from "./frontwet";
import { LAYER_NO_REFLECT } from "./reflection";

export interface FrontDiorama {
  readonly group: THREE.Group;
  /** Seconds of scene time; `still` holds the rain in the cone and the steam (reduced motion, shots). `cam` lays
   * the lamp's reflection on the wet street toward the lens. */
  update(t: number, still: boolean, cam: THREE.Vector3): void;
  /** The lamp head (world), for the pooled light. */
  readonly lampAt: THREE.Vector3;
  dispose(): void;
}

/** Low-pressure sodium: a deep amber, a little hotter than the market's own tubes so it reads as one lamp. */
export const SODIUM = new THREE.Color(1.0, 0.52, 0.16);

function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,0.95)");
    r.addColorStop(0.3, "rgba(255,255,255,0.6)");
    r.addColorStop(0.65, "rgba(255,255,255,0.2)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    // Wet cobbles: the pool broken into stones by dark joints, and a few rain rings.
    g.globalCompositeOperation = "destination-out";
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 1.5;
    for (let y = 6; y < 128; y += 11) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(128, y);
      g.stroke();
      const off = (y / 11) % 2 ? 0 : 7;
      for (let x = off; x < 128; x += 14) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 11);
        g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
    let s = 5;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * 50;
      g.beginPath();
      g.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + rnd() * 4, 1.2 + rnd() * 2, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plan item 369: a ragged billow, not a disc: one round gradient grown to 2.5 m read as a grey balloon behind her
 *  on the D title. Overlapping soft blobs (seeded, so every load and shot match), thinning towards the edge. */
function steamTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * 30;
      const x = 64 + Math.cos(a) * d;
      const y = 64 + Math.sin(a) * d * 1.25;
      const rad = 14 + rnd() * 18;
      const r = g.createRadialGradient(x, y, 0, x, y, rad);
      r.addColorStop(0, `rgba(255,255,255,${(0.16 + rnd() * 0.12).toFixed(2)})`);
      r.addColorStop(0.6, "rgba(255,255,255,0.06)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    }
  }
  return new THREE.CanvasTexture(c);
}

/**
 * The far side's tenement front, painted: dark wet brick, a shuttered shop with light under its shutter, a lit
 * first floor (a warm kitchen, a blue TV behind blinds), the floor above nearly dark (it sits behind the wordmark,
 * which must keep its contrast), and a fire escape. Seeded, so every load and shot is the same.
 */
function facadeTexture(w: number, h: number): THREE.CanvasTexture {
  const PX = 40;
  const c = document.createElement("canvas");
  c.width = Math.round(w * PX);
  c.height = Math.round(h * PX);
  const g = c.getContext("2d");
  if (g) {
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const Y = (m: number) => c.height - m * PX;
    // Brick, darker up high where no street light reaches.
    const sky = g.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, "#07080b");
    sky.addColorStop(0.6, "#141217");
    sky.addColorStop(1, "#211a1a");
    g.fillStyle = sky;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let y = c.height; y > 0; y -= 6) g.fillRect(0, y, c.width, 1);
    // Bays every 3.2 m.
    const bays = Math.floor(w / 3.2);
    for (let b = 0; b < bays; b++) {
      const x0 = (b + 0.5) * 3.2 * PX - 0.7 * PX;
      // Ground floor: a shop shutter with a line of light under it, or a door.
      if (b % 3 !== 1) {
        g.fillStyle = "#1c1d21";
        g.fillRect(x0 - 0.4 * PX, Y(2.3), 2.2 * PX, 2.3 * PX);
        g.fillStyle = "rgba(0,0,0,0.5)";
        for (let y = Y(2.3); y < Y(0.1); y += 4) g.fillRect(x0 - 0.4 * PX, y, 2.2 * PX, 1);
        const glow = g.createLinearGradient(0, Y(0.35), 0, Y(0));
        glow.addColorStop(0, "rgba(255,170,90,0)");
        glow.addColorStop(1, "rgba(255,170,90,0.9)");
        g.fillStyle = glow;
        g.fillRect(x0 - 0.4 * PX, Y(0.35), 2.2 * PX, 0.35 * PX);
      }
      // First floor: most windows lit, warm or TV blue, a few dark.
      const win = (fy: number, lit: number, tone: string) => {
        g.fillStyle = "#050507";
        g.fillRect(x0, Y(fy + 1.5), 1.4 * PX, 1.5 * PX);
        if (lit > 0) {
          g.globalAlpha = lit;
          g.fillStyle = tone;
          g.fillRect(x0 + 3, Y(fy + 1.5) + 3, 1.4 * PX - 6, 1.5 * PX - 6);
          // Blinds.
          g.fillStyle = "rgba(0,0,0,0.35)";
          for (let y = Y(fy + 1.5) + 6; y < Y(fy); y += 5) g.fillRect(x0 + 3, y, 1.4 * PX - 6, 2);
          g.globalAlpha = 1;
        }
        g.fillStyle = "#2a2626";
        g.fillRect(x0 - 3, Y(fy) , 1.4 * PX + 6, 4);
      };
      const r = rnd();
      win(2.9, r < 0.2 ? 0 : 0.85, r < 0.45 ? "#5f8fb8" : "#e9a35b");
      const r2 = rnd();
      win(6.0, r2 < 0.75 ? 0 : 0.35, "#c98a4e");
      win(9.1, rnd() < 0.6 ? 0 : 0.5, "#e9a35b");
    }
    // A fire escape down two bays: landings and a zigzag stair, black against the brick.
    g.strokeStyle = "#020203";
    g.lineWidth = 3;
    for (const fx of [1.6, 4.8 + 3.2 * 2]) {
      const x = fx * PX;
      for (const fy of [4.6, 7.7, 10.8]) {
        g.fillStyle = "#020203";
        g.fillRect(x - 0.2 * PX, Y(fy), 2.6 * PX, 5);
        g.beginPath();
        g.moveTo(x, Y(fy));
        g.lineTo(x + 2.2 * PX, Y(fy - 3.1 + 0.2));
        g.stroke();
        for (let k = 0; k < 2.6 * PX; k += 8) g.fillRect(x - 0.2 * PX + k, Y(fy + 0.9), 2, 0.9 * PX);
        g.fillRect(x - 0.2 * PX, Y(fy + 0.9), 2.6 * PX, 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const CONE_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// The cone of lamp light: brightest under the head, fading to the ground and to its edges (a soft volume, not a
// solid), with falling rain streaks caught in it.
const CONE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  float edge = abs(dot(normalize(vN), vView));
  float soft = pow(edge, 1.6);
  float fall = pow(vUv.y, 1.4);
  float col = floor(vUv.x * 90.0);
  float speed = 0.9 + h(col) * 0.6;
  float y = fract(vUv.y * 3.0 + uTime * speed + h(col + 3.0));
  float streak = smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.05, 0.22, y)) * step(0.55, h(col + 7.0));
  float a = soft * fall * (0.24 + 0.6 * streak);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

/**
 * Builds the set at world positions: `lamp` is the post's foot, `toward` the point its arm reaches over (the street),
 * `grate` the steaming grate, `spill` where an open door off the near side lays its light on the cobbles.
 */
export interface FacadeAt {
  /** The middle of its foot (world). */
  readonly at: THREE.Vector3;
  /** Turn about y; 0 faces +z. */
  readonly yaw: number;
  readonly w: number;
  readonly h: number;
}

export function buildFrontDiorama(lamp: THREE.Vector3, toward: THREE.Vector3, grate: THREE.Vector3, spill: THREE.Vector3, facade: FacadeAt, phone: boolean): FrontDiorama {
  const group = new THREE.Group();
  group.name = "front-diorama";
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.7 });

  // ---- far: the tenement across the way (the frame looked past the market's edge into nothing) ----
  const facadeMat = new THREE.MeshBasicMaterial({ map: facadeTexture(facade.w, facade.h), color: new THREE.Color(0.8, 0.78, 0.82), fog: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(facade.w, facade.h).translate(0, facade.h / 2, 0), facadeMat);
  front.name = "front-facade";
  front.position.copy(facade.at);
  front.rotation.y = facade.yaw;
  group.add(front);

  // ---- the lamp: post, arm and cobra head ----
  const H = 3.9;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, H, 10).translate(0, H / 2, 0), iron);
  post.position.copy(lamp);
  const dir = new THREE.Vector3(toward.x - lamp.x, 0, toward.z - lamp.z).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const ARM = 1.3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, ARM).translate(0, 0, ARM / 2), iron);
  arm.position.set(lamp.x, lamp.y + H - 0.05, lamp.z);
  arm.rotation.y = yaw;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.55), iron);
  const lampAt = new THREE.Vector3(lamp.x + dir.x * ARM, lamp.y + H - 0.12, lamp.z + dir.z * ARM);
  head.position.copy(lampAt).add(new THREE.Vector3(0, 0.04, 0));
  head.rotation.y = yaw;
  // The lamp's glass, HDR so the post chain's bloom haloes it.
  const glassMat = new THREE.MeshBasicMaterial({ color: SODIUM.clone().multiplyScalar(6), fog: false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.46).rotateX(Math.PI / 2), glassMat);
  glass.position.copy(lampAt).add(new THREE.Vector3(0, -0.025, 0));
  glass.rotation.y = yaw;
  // One draw call for the iron: the post, arm and head baked into one geometry in world space.
  const parts = [post, arm, head].map((m) => {
    m.updateMatrix();
    return m.geometry.applyMatrix4(m.matrix);
  });
  const ironMesh = new THREE.Mesh(mergeGeometries(parts, false)!, iron);
  for (const g of parts) g.dispose();
  group.add(ironMesh, glass);

  // ---- the cone through the rain ----
  const ground = lamp.y;
  const coneH = lampAt.y - ground;
  const coneMat = new THREE.ShaderMaterial({
    vertexShader: CONE_VERT,
    fragmentShader: CONE_FRAG,
    uniforms: { uColor: { value: SODIUM.clone().multiplyScalar(phone ? 0.75 : 0.9) }, uTime: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  // UV v runs 0 at the foot to 1 at the head (ConeGeometry's open cylinder uv: v=1 at the top).
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.9, coneH, 28, 1, true).translate(0, coneH / 2, 0), coneMat);
  cone.position.set(lampAt.x, ground, lampAt.z);
  cone.renderOrder = 4;
  group.add(cone);

  // ---- the pool on the wet street ----
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: SODIUM.clone().multiplyScalar(0.9),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat);
  pool.position.set(lampAt.x, ground + 0.014, lampAt.z);
  pool.scale.set(4.2, 1, 4.2);
  pool.renderOrder = 1;
  group.add(pool);

  // ---- the lamp in the wet street: a broken amber streak from its pool toward the lens (as LUNA's is) ----
  const streakMat = new THREE.MeshBasicMaterial({
    map: streakTexture(),
    color: SODIUM.clone().multiplyScalar(1.1),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), streakMat);
  streak.renderOrder = 2;
  group.add(streak);
  const sdir = new THREE.Vector3();
  const layStreak = (cam: THREE.Vector3) => {
    sdir.set(cam.x - lampAt.x, 0, cam.z - lampAt.z);
    const d = sdir.length();
    streak.visible = d > 0.5;
    if (!streak.visible) return;
    sdir.divideScalar(d);
    const len = Math.min(7, 0.8 * d);
    streak.position.set(lampAt.x + sdir.x * len / 2, ground + 0.016, lampAt.z + sdir.z * len / 2);
    streak.rotation.set(0, Math.atan2(sdir.x, sdir.z), 0);
    streak.scale.set(1.5, 1, len);
  };

  // ---- near: an open door off frame lays a warm wedge of light across the cobbles, the joints dark in it ----
  const spillMat = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(0.55),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const spillMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), spillMat);
  spillMesh.position.set(spill.x, ground + 0.015, spill.z);
  spillMesh.rotation.y = yaw;
  spillMesh.scale.set(3.4, 1, 2.2);
  spillMesh.renderOrder = 1;
  group.add(spillMesh);

  // ---- steam from a grate: a few soft puffs rising and widening, warm where the lamp catches them ----
  const steamTex = steamTexture();
  const PUFFS = phone ? 4 : 6;
  const puffs: Array<{ s: THREE.Sprite; m: THREE.SpriteMaterial; o: number }> = [];
  for (let i = 0; i < PUFFS; i++) {
    const m = new THREE.SpriteMaterial({ map: steamTex, color: new THREE.Color(0.8, 0.6, 0.45), transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m);
    s.renderOrder = 5;
    group.add(s);
    // Each puff turned its own way, so no two read as the same shape.
    m.rotation = i * 2.39;
    puffs.push({ s, m, o: i / PUFFS });
  }
  const grateMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.6, metalness: 0.6 });
  const grateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5).rotateX(-Math.PI / 2), grateMat);
  grateMesh.position.set(grate.x, ground + 0.012, grate.z);
  group.add(grateMesh);

  const placePuffs = (t: number) => {
    for (const p of puffs) {
      const u = (p.o + t * 0.09) % 1;
      const sway = Math.sin((u + p.o) * 6.3) * 0.25;
      p.s.position.set(grate.x + sway, ground + 0.2 + u * 2.6, grate.z + sway * 0.4);
      const w = 0.7 + u * 1.8;
      p.s.scale.set(w, w, 1);
      p.m.opacity = Math.sin(u * Math.PI) * 0.5;
    }
  };
  placePuffs(0);
  // Out of the wet street's mirror (the ground decals lie on it and the lamp, cone and steam are lit volumes): the
  // set costs one pass, not two.
  for (const o of [cone, pool, streak, spillMesh, grateMesh, ...puffs.map((p) => p.s)]) o.layers.set(LAYER_NO_REFLECT);

  return {
    group,
    lampAt,
    update(t, still, cam) {
      const tt = still ? 0 : t;
      layStreak(cam);
      coneMat.uniforms.uTime!.value = tt;
      placePuffs(tt);
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      facadeMat.map?.dispose();
      streakMat.map?.dispose();
      spillMat.map?.dispose();
      for (const m of [spillMat, streakMat, facadeMat, iron, glassMat, coneMat, poolMat, grateMat, ...puffs.map((p) => p.m)]) m.dispose();
      poolMat.map?.dispose();
      steamTex.dispose();
    },
  };
}
