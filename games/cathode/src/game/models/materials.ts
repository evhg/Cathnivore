// C10 (S3.1): the enemy materials. Two shared materials serve every armoured body in the game, whatever its
// archetype, visor colour or state: the weapon kit's per-vertex PBR surface (plates, suit, webbing, boots: colour,
// metal, roughness, clearcoat and sheen per vertex, edge wear on the bevels and the trim atlas's paint and nylon)
// and a self-lit layer (visor slits, the rear light strip, the antenna's tip, status lights).
//
// Everything that differs per body rides that body's own skeleton: after the segment bones come five "fx bones"
// whose matrices are data, not transforms. The bone texture is uploaded per object (three binds each skeleton's
// own), so one material shows one body's hit flash, kill rim, faction rim, visor colour and level, antenna blink and
// LOD dither without a per-enemy clone or a per-mesh uniform:
//
//   fx0..fx3: 16 vec4 slots, slot = segment index + 1 (0 never flashes): the hit flash's radiance (rgb).
//   fx4 col0: the edge rim (killer, kill pulse, cold rim on the dead): rgb, falloff power.
//   fx4 col1: the visor's tint (rgb) and level (a).
//   fx4 col2: the faction rim (rgb), falloff power.
//   fx4 col3: LOD crossfade: from, to, t (0..1), blink (0..1).
//   fx5: C15's plates, two floats per slot (sim/armour.ts PLATE_SLOT 1..7): state (0 intact, 1 cracked, 2 broken) and
//        seconds since it changed; slot 8 holds the face's skin tone (0..3) and the crack seed (0..1).

import * as THREE from "three";
import { patchKitMaterial } from "../gunkit";
import { mirrorPass } from "../../render/reflection";

/** How many fx bones follow the segment and accessory bones in every body skeleton. */
export const FX_BONES = 6;

export interface EnemyMaterials {
  opaque: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
}

const MATS: Partial<Record<string, EnemyMaterials>> = {};

/** The ordered 4x4 Bayer matrix as a GLSL expression on gl_FragCoord (0..1). */
const BAYER = `
float bodyBayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(b[i]) + 0.5) / 16.0;
}`;

/** The four skin tones a shattered visor can show (linear), picked per body by its seed. */
const TONES = [0xd2a98c, 0xa97c5d, 0x7c5339, 0x51341f].map((h) => new THREE.Color(h));
const toneGlsl = TONES.map((c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`).join(", ");

/**
 * C15: a piece's plate state, from fx5 (skinned bodies only). A broken plate's pieces collapse to their bone's origin
 * (no triangles left); the layer under it (a negative tag) does the opposite, shown only once the plate is gone, and
 * its strap tabs flap about their hinge, settling over a second. A cracked plate sinks 4 mm into the suit.
 * Out: vPlate = (cracked 0/1, seconds since it changed, tag, skin 0/1), vPlateSeed.
 */
function vertPlate(fx0: number, sink: boolean): string {
  return `
{
  float pid = aPlate.x;
  int slot = int(abs(pid) + 0.5);
  vPlate = vec4(0.0, 10.0, pid, 0.0);
  mat4 bpl = getBoneMatrix(float(${fx0 + 5}));
  vPlateSeed = bpl[3].w;
  vPlateTone = vec3(0.0);
  if (slot > 0) {
    int c = (slot - 1) / 2;
    vec4 col = c == 0 ? bpl[0] : c == 1 ? bpl[1] : c == 2 ? bpl[2] : bpl[3];
    bool lo = (slot - 1) - c * 2 == 0;
    float st = lo ? col.x : col.z;
    float age = lo ? col.y : col.w;
    bool broken = st > 1.5;
    bool under = pid < 0.0;
    if (under != broken) transformed = vec3(0.0);
    else if (!under) {
      vPlate.x = st > 0.5 ? 1.0 : 0.0;
      vPlate.y = age;
      ${sink ? "if (st > 0.5) transformed -= objectNormal * 0.004;" : ""}
    } else {
      vPlate.y = age;
      if (aPlate.y > 0.0) {
        // A torn strap tab: it swings out about its top edge and settles, hanging a little off the panel.
        float below = max(0.0, aPlate.y - transformed.y);
        float sw = 0.45 + sin(age * 15.0) * exp(-age * 2.4) * 1.3;
        transformed.z += sign(transformed.z) * below * sw;
        transformed.y += below * (1.0 - cos(sw)) * 0.5;
      }
      if (aPlate.y < -0.5) {
        vPlate.w = 1.0;
        int ti = int(clamp(bpl[3].z + 0.5, 0.0, 3.0));
        vec3 tones[4] = vec3[4](${toneGlsl});
        vPlateTone = tones[ti];
      }
    }
  }
}`;
}

/** Vertex code reading this body's fx bones (the first fx bone's index is `fx0`). */
function vertFx(fx0: number, sink = false): string {
  return `
#ifdef USE_SKINNING
${vertPlate(fx0, sink)}
{
  int bs = int(aSeg + 0.5);
  mat4 bf = getBoneMatrix(float(${fx0} + bs / 4));
  int bc = bs - (bs / 4) * 4;
  vBodyFlash = bc == 0 ? bf[0].rgb : bc == 1 ? bf[1].rgb : bc == 2 ? bf[2].rgb : bf[3].rgb;
  mat4 bp = getBoneMatrix(float(${fx0 + 4}));
  vBodyRim = bp[0];
  vBodyVisor = bp[1];
  vBodyFac = bp[2];
  vec4 lod = bp[3];
  vBodyLodA = abs(aLod - lod.y) < 0.5 ? 1.0 : abs(aLod - lod.x) < 0.5 ? -1.0 : 0.0;
  vBodyLodT = lod.z;
  vBodyBlink = lod.w;
  // The rim's normal: the body's own smooth shape (round the bone, or the torso's ellipse), not the plates' bevels,
  // so the faction edge outlines the man and never draws every panel line.
  vec3 brn = length(aRimN) > 0.0 ? aRimN : objectNormal;
  vBodyRimN = normalize(normalMatrix * (skinMatrix * vec4(brn, 0.0)).xyz);
}
#else
vBodyRimN = vec3(0.0, 0.0, 1.0);
// Unskinned (a plate knocked off, the cloth): a plate piece keeps its cracks.
vPlate = vec4(aPlate.x > 0.5 ? 1.0 : 0.0, 10.0, aPlate.x, 0.0); vPlateSeed = 0.37; vPlateTone = vec3(0.0);
vBodyFlash = vec3(0.0); vBodyRim = vec4(0.0, 0.0, 0.0, 3.0); vBodyVisor = vec4(1.0); vBodyFac = vec4(0.0, 0.0, 0.0, 3.0);
vBodyLodA = 1.0; vBodyLodT = 1.0; vBodyBlink = 1.0;
#endif`;
}

/**
 * C15's fracture network (fragment): 3D Voronoi cells on the plate's own surface, seeded per plate and per body,
 * the cell borders jittered by noise. Returns (groove 0..1, chipped edge 0..1), anti-aliased by its own derivatives.
 * The visor (tag 6) cracks finer.
 */
const CRACK = `
vec3 pcHash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
vec2 plateCrack(vec3 lp, float tag, float seed) {
  float dens = tag > 5.5 ? 60.0 : 20.0;
  vec3 p = lp * dens + vec3(seed * 17.0 + tag * 3.1, tag * 5.7, seed * 11.0);
  p += vec3(gkNoise(lp * 90.0), gkNoise(lp * 90.0 + 7.0), gkNoise(lp * 90.0 + 13.0)) * 0.55;
  vec3 i = floor(p); vec3 f = fract(p);
  float d1 = 8.0; float d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = pcHash3(i + g);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  float e = d2 - d1;
  float w = max(fwidth(e), 1e-4);
  // Not every border cracks: about half the cells' walls fracture, so it reads as a crack and not a grid.
  float keep = step(0.55, pcHash3(i + vec3(seed)).x + gkNoise(lp * 14.0) * 0.5);
  float groove = (1.0 - smoothstep(0.018, 0.018 + w * 1.2, e)) * keep;
  float chip = (1.0 - smoothstep(0.05, 0.05 + w * 1.2, e)) * keep - groove;
  return vec2(groove, max(0.0, chip));
}`;

/** The faction rim's peak radiance (linear): under the AgX shoulder, where amber would wash out to white. */
const RIM_CAP = 1.5;

const VARYINGS = "varying vec4 vPlate; varying float vPlateSeed; varying vec3 vPlateTone; varying vec3 vBodyRimN; varying vec3 vBodyFlash; varying vec4 vBodyRim; varying vec4 vBodyVisor; varying vec4 vBodyFac; varying float vBodyLodA; varying float vBodyLodT; varying float vBodyBlink;";

const DITHER = `
{
  float bb = bodyBayer(gl_FragCoord.xy);
  if (vBodyLodA > 0.5 ? bb >= vBodyLodT : vBodyLodA < -0.5 ? bb < vBodyLodT : true) discard;
}`;

/**
 * The opaque layer: the kit's surface plus the hit flash (hottest at the silhouette), the edge rim, the faction rim
 * (off in the mirror pass) and the LOD dither, and the fog taken back off a glowing body.
 */
function patchOpaque(mat: THREE.MeshStandardMaterial, fx0: number): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uBodyMirror = mirrorPass;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\nattribute float aSeg; attribute float aLod; attribute vec3 aRimN; attribute vec2 aPlate;\n${VARYINGS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertFx(fx0, true)}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${VARYINGS}\nuniform float uBodyMirror;\n${BAYER}`)
      // After the kit's own declarations (its noise and vLocal): the fracture network.
      .replace("void main() {", `${CRACK}\nvoid main() {`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
// C15: the face behind a shattered visor takes this body's skin tone; a cracked plate shows its fracture lines
// (a dark groove with the paint chipped back to bright metal along each side).
if (vPlate.w > 0.5) diffuseColor.rgb = vPlateTone;
float pCrack = 0.0;
float pChip = 0.0;
if (vPlate.x > 0.5) {
  vec2 cr = plateCrack(vLocal, vPlate.z, vPlateSeed);
  pCrack = cr.x;
  pChip = cr.y;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 2.4 + vec3(0.09), pChip * 0.9);
  diffuseColor.rgb *= 1.0 - 0.9 * pCrack;
}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
if (vPlate.x > 0.5) {
  // The groove as a height field (S4.3: x1.6 normal strength), bumped through the screen-space surface gradient.
  float ph = -(pCrack + pChip * 0.35) * 0.0016 * 1.6;
  vec3 sx = dFdx(-vViewPosition); vec3 sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal); vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(ph) * r1 + dFdy(ph) * r2);
  normal = normalize(abs(det) * normal - grad);
}`,
      )
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${DITHER}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float bFlashRim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float bRim = 1.0 - clamp(abs(dot(normalize(vBodyRimN), normalize(vViewPosition))), 0.0, 1.0);
totalEmissiveRadiance += vBodyFlash * (0.3 + 0.7 * bFlashRim * bFlashRim);
totalEmissiveRadiance += vBodyRim.rgb * pow(bRim, vBodyRim.w);
// The faction rim (S3.1) lights the man's outline only: the smooth body normal finds the silhouette, the plate's own
// normal keeps it off any face turned to the camera (so the dark #2E333C paint shows). Where the edge falls under a
// couple of pixels (far off, or rs 0.5 on the phone) a hard fresnel steps into a beaded sticker outline, so there
// it softens into a wide, even amber sheen over the figure instead (same light, no stair-steps): far off he still
// reads against the street. Capped below the tone map's shoulder, so the amber stays amber.
float bFar = smoothstep(0.12, 0.45, fwidth(bRim));
// The plate gate is a per-facet switch: at the phone's half resolution it turns every box side on or off whole and
// draws a one-pixel stroke round each figure. The phone's rim (a falloff power under 2.5) is a soft, wide sheen on
// the smooth body normal alone instead.
float bFace = vBodyFac.w < 2.5 ? 1.0 : mix(smoothstep(0.15, 0.85, bFlashRim), 1.0, bFar * 0.7);
vec3 bFac = vBodyFac.rgb * pow(bRim, mix(vBodyFac.w, 1.4, bFar)) * bFace;
float bFacMax = max(bFac.r, max(bFac.g, bFac.b));
bFac *= bFacMax > ${RIM_CAP.toFixed(2)} ? ${RIM_CAP.toFixed(2)} / bFacMax : 1.0;
totalEmissiveRadiance += bFac * (1.0 - uBodyMirror);
// C15: a fresh crack glows in the faction amber for 0.4 s (S4.3: 0.3, overstated x3 so it reads at 10 m in the
// grade), then keeps a faint ember in the groove.
if (vPlate.x > 0.5) totalEmissiveRadiance += vec3(1.0, 0.42, 0.08) * pCrack * (2.2 * max(0.0, 1.0 - vPlate.y / 0.4) + 0.12) * (1.0 - uBodyMirror);`,
      )
      .replace(
        "#include <fog_fragment>",
        `vec3 bPre = gl_FragColor.rgb;
#include <fog_fragment>
#ifdef USE_FOG
gl_FragColor.rgb = mix(gl_FragColor.rgb, bPre, fogFactor * clamp(vBodyFlash.r * 3.0 + max(vBodyRim.r, vBodyRim.b) * pow(bRim, vBodyRim.w) * 2.0 + max(bFac.r, max(bFac.g, bFac.b)) * (1.0 - uBodyMirror) * 0.8, 0.0, 0.9));
#endif`,
      );
  };
  const key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${key()}|body`;
}

/**
 * The self-lit layer: colour per vertex in HDR (aMR.y = 1 takes the body's visor tint and level, aMR.z = 1 blinks
 * with the antenna), the LOD dither, and fog only at half strength on a light.
 */
function patchGlow(mat: THREE.MeshBasicMaterial, fx0: number): void {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\nattribute float aSeg; attribute float aLod; attribute vec4 aMR; attribute vec3 aRimN; attribute vec2 aPlate;\n${VARYINGS}\nvarying vec3 vBodyGlow;`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${vertFx(fx0)}
vBodyGlow = aMR.y > 0.5 ? vBodyVisor.rgb * vBodyVisor.a : vec3(1.0);
vBodyGlow *= aMR.z > 0.5 ? vBodyBlink : 1.0;
// Tape and lights that die with him (aMR.x): they follow the visor's level (it goes out over 0.9 s), untinted.
vBodyGlow *= aMR.x > 0.5 ? min(vBodyVisor.a, 1.0) : 1.0;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${VARYINGS}\nvarying vec3 vBodyGlow;\n${BAYER}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${DITHER}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vBodyGlow;")
      .replace(
        "#include <fog_fragment>",
        `vec3 bPre = gl_FragColor.rgb;
#include <fog_fragment>
#ifdef USE_FOG
gl_FragColor.rgb = mix(gl_FragColor.rgb, bPre, fogFactor * 0.5);
#endif`,
      );
  };
  mat.customProgramCacheKey = () => "body-glow";
}

/**
 * The shared pair for a profile and a skeleton layout (`fx0` is the first fx bone's index), built once. Phone uses
 * a standard material (no clearcoat or sheen lobes), like the guns.
 */
export function enemyMaterials(phone: boolean, fx0: number): EnemyMaterials {
  const key = `${phone ? "p" : "d"}${fx0}`;
  const have = MATS[key];
  if (have) return have;
  const opaque = phone
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 })
    : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.3, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x9aa0b0) });
  patchKitMaterial(opaque, phone);
  patchOpaque(opaque, fx0);
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
  patchGlow(glow, fx0);
  const m: EnemyMaterials = { opaque, glow };
  MATS[key] = m;
  return m;
}

/** Writes a vec4 into fx bone column `col` of `bone` (matrix elements are column-major). */
export function setFx(bone: THREE.Bone, col: number, x: number, y: number, z: number, w: number): void {
  const e = bone.matrixWorld.elements;
  const o = col * 4;
  e[o] = x;
  e[o + 1] = y;
  e[o + 2] = z;
  e[o + 3] = w;
}

/** A data bone: never moved by the scene graph, its matrix written directly. */
export function fxBone(): THREE.Bone {
  const b = new THREE.Bone();
  b.matrixAutoUpdate = false;
  b.matrixWorldAutoUpdate = false;
  b.matrixWorld.elements.fill(0);
  return b;
}

/** The gore cap on a severed stump (one shared material). */
export const GORE_MAT = new THREE.MeshStandardMaterial({ color: 0x5a0008, roughness: 0.35, metalness: 0.1, emissive: 0x120000 });
