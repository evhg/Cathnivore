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

import * as THREE from "three";
import { patchKitMaterial } from "../gunkit";
import { mirrorPass } from "../../render/reflection";

/** How many fx bones follow the segment and accessory bones in every body skeleton. */
export const FX_BONES = 5;

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

/** Vertex code reading this body's fx bones (the first fx bone's index is `fx0`). */
function vertFx(fx0: number): string {
  return `
#ifdef USE_SKINNING
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
vBodyFlash = vec3(0.0); vBodyRim = vec4(0.0, 0.0, 0.0, 3.0); vBodyVisor = vec4(1.0); vBodyFac = vec4(0.0, 0.0, 0.0, 3.0);
vBodyLodA = 1.0; vBodyLodT = 1.0; vBodyBlink = 1.0;
#endif`;
}

const VARYINGS = "varying vec3 vBodyRimN; varying vec3 vBodyFlash; varying vec4 vBodyRim; varying vec4 vBodyVisor; varying vec4 vBodyFac; varying float vBodyLodA; varying float vBodyLodT; varying float vBodyBlink;";

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
      .replace("#include <common>", `#include <common>\nattribute float aSeg; attribute float aLod; attribute vec3 aRimN;\n${VARYINGS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertFx(fx0)}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${VARYINGS}\nuniform float uBodyMirror;\n${BAYER}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${DITHER}`)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
float bFlashRim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float bRim = 1.0 - clamp(abs(dot(normalize(vBodyRimN), normalize(vViewPosition))), 0.0, 1.0);
totalEmissiveRadiance += vBodyFlash * (0.3 + 0.7 * bFlashRim * bFlashRim);
totalEmissiveRadiance += vBodyRim.rgb * pow(bRim, vBodyRim.w);
totalEmissiveRadiance += vBodyFac.rgb * pow(bRim, vBodyFac.w) * (1.0 - uBodyMirror);`,
      )
      .replace(
        "#include <fog_fragment>",
        `vec3 bPre = gl_FragColor.rgb;
#include <fog_fragment>
#ifdef USE_FOG
gl_FragColor.rgb = mix(gl_FragColor.rgb, bPre, fogFactor * clamp(vBodyFlash.r * 3.0 + max(vBodyRim.r, vBodyRim.b) * pow(bRim, vBodyRim.w) * 2.0 + max(vBodyFac.r, max(vBodyFac.g, vBodyFac.b)) * pow(bRim, vBodyFac.w) * (1.0 - uBodyMirror) * 0.8, 0.0, 0.9));
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
      .replace("#include <common>", `#include <common>\nattribute float aSeg; attribute float aLod; attribute vec4 aMR; attribute vec3 aRimN;\n${VARYINGS}\nvarying vec3 vBodyGlow;`)
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
