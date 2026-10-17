// The pickup beacon (docs/design/cathode-combat.md S7.1): what makes a weapon in the world impossible to miss.
//   1. Beam: an additive HDR shaft that blooms, soft at its silhouette, fading up its height and with distance.
//   2. Glint: a 4-point star that sweeps the gun every 2.5 s, with a screen-size floor so it reads at 5K and on a phone.
//   3. Rim pulse: a fresnel emissive on the gun itself, 1 Hz, in rarity colour.
//   4. Floor ring: an additive ring on the wet ground, pulsing with the rim.
// The world prompt, the off-screen arrow and Cath's nudge are the HUD's and the session's (S7.1 layers 5 to 7).

import * as THREE from "three";

/** S7.1 colours: the first gun is amber, the reward colour. */
export const BEACON_AMBER = 0xe8b04a;

/**
 * How strong the beam is at `dist` metres from Cath (0..1): full from 12 m out to 60 m, so it finds her from down
 * the street (and from the first takedown, 8.5 m off, at 78%); it eases to 55% by 5 m so it doesn't blow out the case up close; gone within 1.5 m (she is on it)
 * and past 80 m (another district's business).
 */
export function beamFade(dist: number): number {
  if (dist <= 1.5) return 0;
  if (dist < 5) return 0.55 * ((dist - 1.5) / 3.5);
  if (dist < 12) return 0.55 + 0.45 * ((dist - 5) / 7);
  if (dist <= 60) return 1;
  if (dist < 80) return 1 - (dist - 60) / 20;
  return 0;
}

/** The glint's flash (0..1): a 350 ms spike every 2.5 s, eased in and out. */
export function glintFlash(t: number): number {
  const p = (t % 2.5) / 0.35;
  return p >= 1 ? 0 : Math.sin(p * Math.PI) ** 2;
}

/** The rim and ring pulse (0..1), at 1 Hz. */
export function pulse(t: number): number {
  return 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
}

/**
 * The render profile beacons are built for. A phone renders at a low scale with a half-size bloom, so a thin HDR
 * shaft that blooms into a column on desktop comes out as a dim line: there the beam is wider, hotter and has an
 * unlit core that reads without bloom (C3 review: the first gun's beam did not show at 844x390).
 */
let profile: "phone" | "desktop" = "desktop";
export function setBeaconProfile(p: "phone" | "desktop"): void {
  profile = p;
}
/** Beam radius (m), HDR gain and core floor for a profile. */
export function beamLook(p: "phone" | "desktop"): { radius: number; hdr: number; core: number } {
  return p === "phone" ? { radius: 0.2, hdr: 4.5, core: 0.55 } : { radius: 0.12, hdr: 2.5, core: 0 };
}

/** 1u in CSS px for a viewport (S8's --u, without the HUD-size setting). */
export function hudUnit(w: number, h: number, scale = 1): number {
  return Math.min(2.4, Math.max(0.62, Math.min(h / 1080, w / 1920))) * scale;
}

const BEAM_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vH;
varying float vU;
void main() {
  vU = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vH = uv.y;
  gl_Position = projectionMatrix * mv;
}`;
const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uPulse;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  // A thin bright band (0.9 m across on its 1.1 m quad) that breathes outward with the pulse, a fainter echo inside, and a warm pool.
  float R = 0.82 + 0.08 * uPulse;
  float band = exp(-pow((r - R) / 0.025, 2.0));
  float echo = 0.35 * exp(-pow((r - R * 0.72) / 0.02, 2.0)) * (1.0 - uPulse);
  float pool = 0.1 * exp(-pow(r / 0.55, 2.0));
  gl_FragColor = vec4(uColor * (band * (0.55 + 0.45 * uPulse) + echo + pool) * uAlpha, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
uniform float uCore;
uniform vec3 uRimColor;
uniform float uHeight;
varying vec3 vN;
varying vec3 vV;
varying float vH;
varying float vU;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // Soft at the silhouette: a white-hot core (no lamp in the street burns this white) inside a saturated amber rim.
  float f = abs(dot(vN, vV));
  float core = pow(f, 7.0) + uCore * smoothstep(0.55, 0.95, f);
  float rim = 0.3 * pow(f, 1.2) * (1.0 - pow(f, 6.0));
  // Fades in over the first few cm (no hard foot), holds full strength to 70% of its height, then tapers out.
  float up = smoothstep(0.0, 0.03, vH) * (1.0 - smoothstep(0.7, 1.0, vH));
  // A marker, not a light fixture: a bright band climbs the shaft every 1.6 s, and motes rise through it.
  float m = vH * uHeight;
  float climb = fract(uTime * 0.62);
  float band = exp(-pow((vH - climb * 1.15 + 0.05) / 0.06, 2.0));
  vec2 cell = vec2(floor(vU * 10.0), floor(m * 3.0 - uTime * 1.4));
  float seed = hash(cell);
  vec2 local = vec2(fract(vU * 10.0), fract(m * 3.0 - uTime * 1.4));
  float mote = step(0.72, seed) * exp(-(pow((local.x - 0.5) / 0.12, 2.0) + pow((local.y - seed) / 0.06, 2.0)));
  vec3 col = uColor * core * (1.0 + 1.4 * band) + uRimColor * (rim * (1.0 + 0.8 * band) + mote * 1.6);
  gl_FragColor = vec4(col * up * uAlpha, 1.0);
}`;

let starTex: THREE.Texture | null = null;
/** A 4-point star with a hot core, drawn once. */
function star(): THREE.Texture {
  if (starTex) return starTex;
  const S = 128;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S - 0.5;
      const v = (y + 0.5) / S - 0.5;
      const r = Math.hypot(u, v);
      // Two thin crossed spikes plus a soft core.
      const spike = Math.max(Math.exp(-Math.abs(u) * 90) * Math.max(0, 1 - Math.abs(v) * 2), Math.exp(-Math.abs(v) * 90) * Math.max(0, 1 - Math.abs(u) * 2));
      const core = Math.exp(-r * r * 260);
      const a = Math.min(1, spike + core);
      const i = (y * S + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.needsUpdate = true;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  starTex = t;
  return t;
}

/** Puts a fresnel rim on every standard material under `root` (cloned, so shared kit materials stay clean). */
function rimOn(root: THREE.Object3D, colour: THREE.Color, strength: { value: number }): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !(m.material instanceof THREE.MeshStandardMaterial)) return;
    // A kit material (gunkit.ts) keeps its own patch underneath the rim.
    const base = m.material.onBeforeCompile;
    const kit = !!m.material.userData.kit;
    const mat = m.material.clone();
    mat.emissive = colour.clone();
    mat.emissiveIntensity = 1;
    mat.onBeforeCompile = (sh, r) => {
      if (kit) base.call(mat, sh, r);
      sh.uniforms.uRim = strength;
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uRim;")
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= uRim * pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0) * 3.0;",
        );
    };
    mat.customProgramCacheKey = () => (kit ? "beacon-rim-kit" : "beacon-rim");
    m.material = mat;
  });
}

export interface BeaconOpts {
  colour?: number;
  /** Beam height (m): 3.5 for a scripted key item, 1.6 for a loot drop. */
  beam?: number;
  glint?: boolean;
  /** The gun to rim-light (S7.1 layer 3), if any. */
  gun?: THREE.Object3D;
  /** Height of the ground under the beacon, relative to its group (the ring sits there). */
  floorY?: number;
  /** Where the glint sweeps (the gun's centre), relative to the group. */
  glintAt?: THREE.Vector3;
}

const SCRATCH_A = new THREE.Vector3();
const SCRATCH_B = new THREE.Vector3();

export class Beacon {
  readonly group = new THREE.Group();
  readonly beam: THREE.Mesh;
  readonly ring: THREE.Mesh;
  readonly glint: THREE.Sprite | null = null;
  private t = 0;
  private readonly rim = { value: 0 };
  private readonly uni: { uColor: { value: THREE.Color }; uRimColor: { value: THREE.Color }; uAlpha: { value: number }; uTime: { value: number }; uCore: { value: number }; uHeight: { value: number } };
  private readonly glintAt: THREE.Vector3;
  private readonly ringUni = { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 }, uPulse: { value: 0 } };
  /** The beam's current strength (tests read it). */
  strength = 1;

  constructor(opts: BeaconOpts = {}) {
    const colour = new THREE.Color(opts.colour ?? BEACON_AMBER).convertSRGBToLinear();
    // The light itself is a richer amber than the swatch: a beam through rain reads warm, not peach.
    const hot = colour.clone().multiply(new THREE.Color(1, 0.8, 0.5));
    // The shaft's core burns near white (the street's sodium cones are orange all through), its rim a saturated gold.
    const white = colour.clone().lerp(new THREE.Color(1, 0.93, 0.76), 0.55);
    const rimC = colour.clone().multiply(new THREE.Color(1, 0.62, 0.16));
    const h = opts.beam ?? 3.5;
    const floor = opts.floorY ?? 0;
    // HDR 2.5: past the bloom threshold, so the shaft glows through the rain (hotter and wider on a phone).
    const look = beamLook(profile);
    this.uni = {
      uColor: { value: white.multiplyScalar(look.hdr) },
      uRimColor: { value: rimC.multiplyScalar(look.hdr * 1.4) },
      uAlpha: { value: 1 },
      uTime: { value: 0 },
      uCore: { value: look.core },
      uHeight: { value: h },
    };
    const g = new THREE.CylinderGeometry(look.radius, look.radius, h, 20, 1, true);
    g.translate(0, h / 2, 0);
    this.beam = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    );
    this.beam.position.y = floor;
    this.beam.renderOrder = 2;
    this.group.add(this.beam);
    // The ring on the wet ground under the case: 0.9 m across, so it marks the spot without reading as a spawn pad.
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.1),
      new THREE.ShaderMaterial({ uniforms: this.ringUni, vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }),
    );
    this.ringUni.uColor.value.copy(hot).multiplyScalar(1.8);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = floor + 0.03;
    this.ring.renderOrder = 2;
    this.group.add(this.ring);
    this.glintAt = opts.glintAt?.clone() ?? new THREE.Vector3(0, floor + 0.9, 0);
    if (opts.glint) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: star(), color: colour.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
      sp.scale.setScalar(0.18);
      sp.position.copy(this.glintAt);
      sp.renderOrder = 3;
      this.group.add(sp);
      this.glint = sp;
    }
    if (opts.gun) rimOn(opts.gun, colour, this.rim);
  }

  /**
   * Per frame: `dist` is Cath's distance (m); `cam` and the viewport (CSS px) keep the glint at least 14u on screen.
   */
  update(dt: number, dist: number, cam?: THREE.Camera, viewH = 900, viewW = 1440, hudScale = 1): void {
    this.t += dt;
    this.strength = beamFade(dist);
    this.uni.uAlpha.value = this.strength;
    this.uni.uTime.value = this.t;
    this.beam.visible = this.strength > 0.001;
    const p = pulse(this.t);
    this.rim.value = 0.8 * p;
    this.ringUni.uPulse.value = p;
    this.ringUni.uAlpha.value = Math.min(1, dist / 2);
    if (this.glint) {
      const f = glintFlash(this.t);
      // The glint travels along the gun as it flashes.
      const sweep = ((this.t % 2.5) / 0.35) * 0.3 - 0.15;
      this.glint.position.copy(this.glintAt);
      this.glint.position.x += sweep;
      this.glint.position.y += 0.02;
      (this.glint.material as THREE.SpriteMaterial).opacity = f;
      this.glint.visible = f > 0.01;
      let size = 0.18;
      if (cam instanceof THREE.PerspectiveCamera) {
        // Metres that 14u covers at this distance: the star never shrinks below that on screen.
        const wp = this.glint.getWorldPosition(SCRATCH_A);
        const d = Math.max(0.1, wp.distanceTo(cam.getWorldPosition(SCRATCH_B)));
        const mPerPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / viewH;
        size = Math.max(size, 14 * hudUnit(viewW, viewH, hudScale) * mPerPx);
      }
      this.glint.scale.setScalar(size * (0.7 + 0.6 * f));
    }
  }

  private disposed = false;
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.beam.geometry.dispose();
    (this.beam.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}
