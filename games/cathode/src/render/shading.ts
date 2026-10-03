// Shader plumbing shared by every material in the Drowned Market.
//
// 1. Height fog for EVERY material (ours and the game layer's): three's fog chunks are replaced once so
//    fog thickens toward the street and thins with height, using FogExp2's density and colour.
// 2. Our own materials additionally read the baked light volume (lighting.ts): a 3D texture of neon
//    irradiance. It lights static surfaces (indirect diffuse) and tints the fog (in-scatter), so the air
//    around every sign glows without a real light per sign.
// 3. Wet surfaces: walls darken and gloss with rain streaks; the ground and water read the planar
//    reflection (reflection.ts) through a puddle mask, animated rain ripples and three's own Fresnel.

import * as THREE from "three";

/** Flood geometry, shared by the level (groundHeight) and the water shader. Units are metres. */
export const FLOOD = {
  /** The street dips between these z values, with ramps of `ramp` metres at each end. */
  zNear: -10,
  zFar: -34,
  ramp: 4,
  depth: 0.5,
  /** Water surface height everywhere (flooded street and the brimming canal). */
  water: -0.2,
  /** The road's west kerb, the quay edge and the canal's far wall. */
  roadWest: -6.5,
  quayEdge: 9,
  canalEast: 16,
} as const;

/** 0 outside the flooded stretch, 1 on its floor, linear on the ramps. */
export function floodT(z: number): number {
  const a = THREE.MathUtils.clamp((FLOOD.zNear - z) / FLOOD.ramp, 0, 1);
  const b = THREE.MathUtils.clamp((z - FLOOD.zFar) / FLOOD.ramp, 0, 1);
  return Math.min(a, b);
}

/** Uniforms shared by reference across every patched material (one update per frame reaches all). */
export interface SharedUniforms {
  uTime: { value: number };
  uNoise: { value: THREE.Texture | null };
  uVolume: { value: THREE.Data3DTexture | null };
  uVolMin: { value: THREE.Vector3 };
  uVolInvSize: { value: THREE.Vector3 };
  uVolGain: { value: number };
  uRefl: { value: THREE.Texture | null };
  uReflMatrix: { value: THREE.Matrix4 };
  uReflOn: { value: number };
  uRain: { value: number };
  uLightning: { value: number };
  uWind: { value: THREE.Vector2 };
}

export function createShared(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uNoise: { value: null },
    uVolume: { value: null },
    uVolMin: { value: new THREE.Vector3() },
    uVolInvSize: { value: new THREE.Vector3(1, 1, 1) },
    uVolGain: { value: 1 },
    uRefl: { value: null },
    uReflMatrix: { value: new THREE.Matrix4() },
    uReflOn: { value: 1 },
    uRain: { value: 1 },
    uLightning: { value: 0 },
    uWind: { value: new THREE.Vector2(1.5, 0.3) },
  };
}

/** Height fog: thins with height (falloff per metre) above the street. */
export const FOG_FALLOFF = 0.075;

let fogInstalled = false;

/** Replaces three's fog chunks with height fog (plus, for our materials, volume in-scatter). Idempotent. */
export function installFog(): void {
  if (fogInstalled) return;
  fogInstalled = true;
  const C = THREE.ShaderChunk as unknown as Record<string, string>;
  C.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;
  C.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );
#endif`;
  C.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  float cathodeFogAmount( vec3 cam, vec3 p, float density ) {
    vec3 ray = p - cam;
    float dist = length( ray );
    float dy = ray.y;
    float k = ${FOG_FALLOFF.toFixed(4)};
    float base = density * exp( - k * max( cam.y, -2.0 ) );
    float f = abs( dy ) > 0.01 ? ( 1.0 - exp( - k * dy ) ) / ( k * dy ) : 1.0;
    return 1.0 - exp( - base * dist * f );
  }
#endif`;
  C.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = cathodeFogAmount( cameraPosition, vFogWorld, fogDensity );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  vec3 fogTint = fogColor;
  #ifdef CATHODE_VOLUME
    // In-scatter: the air glows with the neon around it. Two taps along the view ray.
    vec3 fogRay = vFogWorld - cameraPosition;
    float fogLen = min( length( fogRay ), 40.0 );
    vec3 fogDir = fogRay / max( length( fogRay ), 0.001 );
    vec3 fogIn = cathodeVolume( cameraPosition + fogDir * fogLen * 0.35 ) + cathodeVolume( cameraPosition + fogDir * fogLen * 0.8 );
    fogTint += fogIn * 0.035 * uVolGain;
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, fogFactor );
#endif`;
}

/** GLSL shared by our materials: the light volume, noise and rain ripples. Declares the shared uniforms. */
export const COMMON_GLSL = /* glsl */ `
uniform sampler3D uVolume;
uniform vec3 uVolMin;
uniform vec3 uVolInvSize;
uniform float uVolGain;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uRain;
uniform float uLightning;
vec3 cathodeVolume( vec3 p ) {
  vec3 uvw = ( p - uVolMin ) * uVolInvSize;
  return texture( uVolume, uvw ).rgb;
}
float cathodeHash( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
// Rain ripples: each 0.42 m cell holds one ring that spawns at a random time and spot. Two offset layers.
vec2 cathodeRippleLayer( vec2 p, float t, float seed ) {
  vec2 cell = floor( p );
  vec2 f = fract( p ) - 0.5;
  float h = cathodeHash( cell + seed );
  vec2 c = vec2( cathodeHash( cell + seed + 3.1 ), cathodeHash( cell + seed + 7.7 ) ) - 0.5;
  c *= 0.5;
  float phase = fract( t * ( 0.9 + h * 0.6 ) + h * 13.0 );
  vec2 d = f - c;
  float r = length( d );
  float ring = phase * 0.55;
  float x = ( r - ring ) * 28.0;
  float w = exp( - x * x ) * ( 1.0 - phase ) * ( 1.0 - phase );
  float wave = sin( x * 3.14159 ) * w;
  return r > 0.0001 ? ( d / r ) * wave : vec2( 0.0 );
}
vec2 cathodeRipples( vec2 xz, float t ) {
  vec2 p = xz / 0.42;
  return cathodeRippleLayer( p, t, 0.0 ) + cathodeRippleLayer( p * 1.37 + 17.3, t * 1.13, 5.0 ) * 0.7;
}
`;

/** Common uniform objects for a patched material. */
function bindShared(shader: THREE.WebGLProgramParametersWithUniforms, s: SharedUniforms): void {
  Object.assign(shader.uniforms, {
    uTime: s.uTime,
    uNoise: s.uNoise,
    uVolume: s.uVolume,
    uVolMin: s.uVolMin,
    uVolInvSize: s.uVolInvSize,
    uVolGain: s.uVolGain,
    uRain: s.uRain,
    uLightning: s.uLightning,
  });
}

/** Indirect diffuse from the light volume, sampled half a metre off the surface along its normal. */
const VOLUME_LIGHT = /* glsl */ `
#include <lights_fragment_maps>
{
  vec3 cWorldN = inverseTransformDirection( normal, viewMatrix );
  vec3 vol = cathodeVolume( vFogWorld + cWorldN * 0.55 ) * uVolGain;
  irradiance += vol * CATHODE_VOL_SCALE;
}
`;

export type SurfaceKind = "wall" | "ground" | "water" | "prop";

export interface PatchOptions {
  kind: SurfaceKind;
  /** How strongly the volume lights this surface (default 1). */
  volume?: number;
  /** 0..1: how wet the surface reads (walls default 0.8). */
  wet?: number;
  /** Ground: shifts the puddle threshold (positive = more standing water). */
  puddleBias?: number;
  /** Ground: paint road markings. */
  roadLines?: boolean;
}

/**
 * Patches a MeshStandardMaterial with our lighting and weather. Each kind compiles once (cache key) and all
 * share uniforms by reference.
 */
export function patchMaterial(mat: THREE.MeshStandardMaterial, s: SharedUniforms, o: PatchOptions): THREE.MeshStandardMaterial {
  const volScale = (o.volume ?? 1).toFixed(3);
  const wet = (o.wet ?? (o.kind === "wall" ? 0.8 : o.kind === "prop" ? 0.6 : 1)).toFixed(3);
  const bias = (o.puddleBias ?? 0).toFixed(3);
  mat.defines = { ...(mat.defines ?? {}), CATHODE_VOLUME: "", CATHODE_VOL_SCALE: volScale, CATHODE_WET: wet, CATHODE_PUDDLE_BIAS: bias };
  if (o.roadLines) mat.defines.CATHODE_ROAD_LINES = "";
  mat.customProgramCacheKey = () => `cathode-${o.kind}-${volScale}-${wet}-${bias}-${o.roadLines ? 1 : 0}`;
  mat.onBeforeCompile = (shader) => {
    bindShared(shader, s);
    let fs = shader.fragmentShader;
    const mirror = o.kind === "ground" || o.kind === "water";
    fs = fs.replace("#include <common>", `#include <common>\n${COMMON_GLSL}\n${mirror ? MIRROR_DECL : ""}\n${o.kind === "ground" ? ROAD_LINES : ""}`);
    fs = fs.replace("#include <lights_fragment_maps>", VOLUME_LIGHT);
    if (o.kind === "wall" || o.kind === "prop") fs = wetWall(fs);
    if (o.kind === "ground") {
      Object.assign(shader.uniforms, { uRefl: s.uRefl, uReflMatrix: s.uReflMatrix, uReflOn: s.uReflOn });
      fs = mirrorGround(fs, false);
    }
    if (o.kind === "water") {
      Object.assign(shader.uniforms, { uRefl: s.uRefl, uReflMatrix: s.uReflMatrix, uReflOn: s.uReflOn });
      fs = mirrorGround(fs, true);
    }
    shader.fragmentShader = fs;
  };
  return mat;
}

/** Walls: darker and glossier with rain, in vertical streaks; tops of ledges hold water. */
function wetWall(fs: string): string {
  return fs
    .replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
      // World-space face normal from derivatives: color_fragment runs before normal_fragment_begin.
      vec3 cWN = normalize( cross( dFdx( vFogWorld ), dFdy( vFogWorld ) ) );
      cWN *= sign( dot( cWN, cameraPosition - vFogWorld ) );
      float cUp = clamp( cWN.y, 0.0, 1.0 );
      vec2 cStreakUv = vec2( ( vFogWorld.x + vFogWorld.z ) * 0.31, vFogWorld.y * 0.018 + uTime * 0.004 );
      float cStreak = smoothstep( 0.42, 0.75, texture2D( uNoise, cStreakUv ).g + texture2D( uNoise, cStreakUv * vec2( 3.1, 0.6 ) ).b * 0.35 );
      float cSplash = 1.0 - smoothstep( 0.15, 0.9, vFogWorld.y );
      float cWet = clamp( ( 0.35 + cStreak * 0.65 + cSplash + cUp ) * CATHODE_WET, 0.0, 1.0 );
      diffuseColor.rgb *= mix( 1.0, 0.5, cWet );`,
    )
    .replace(
      "#include <roughnessmap_fragment>",
      /* glsl */ `#include <roughnessmap_fragment>
      roughnessFactor = mix( roughnessFactor, mix( 0.32, 0.12, cUp ), cWet * 0.85 );`,
    );
}

/** Ground and water: puddles, ripples and the planar reflection weighted by three's own BRDF/Fresnel. */
function mirrorGround(fs: string, water: boolean): string {
  const puddle = water
    ? /* glsl */ `float cPuddle = 1.0;`
    : /* glsl */ `
      vec2 cXZ = vFogWorld.xz;
      float cN = texture2D( uNoise, cXZ * 0.035 ).r * 0.65 + texture2D( uNoise, cXZ * 0.11 ).g * 0.35;
      // Gutters hold water along both kerbs of the road; the crown of the road is drier.
      float cGutter = max( 1.0 - smoothstep( 0.0, 0.9, abs( cXZ.x - ${FLOOD.roadWest.toFixed(1)} ) ), 1.0 - smoothstep( 0.0, 0.9, abs( cXZ.x - 3.5 ) ) );
      float cPuddle = smoothstep( 0.47, 0.56, cN + cGutter * 0.25 + CATHODE_PUDDLE_BIAS );`;
  return fs
    .replace(
      "#include <color_fragment>",
      /* glsl */ `#include <color_fragment>
      ${puddle}
      ${water ? "" : "#ifdef CATHODE_ROAD_LINES\n      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.62, 0.55, 0.32 ), cathodeRoadLines( vFogWorld.xz ) );\n      #endif"}
      // Wet asphalt is dark; standing water darker still.
      diffuseColor.rgb *= mix( 0.42, 0.16, cPuddle );`,
    )
    .replace(
      "#include <roughnessmap_fragment>",
      /* glsl */ `#include <roughnessmap_fragment>
      roughnessFactor = mix( roughnessFactor * 0.42, ${water ? "0.015" : "0.035"}, cPuddle );`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `#include <normal_fragment_maps>
      {
        vec3 cUpV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
        normal = normalize( mix( normal, cUpV, cPuddle * 0.92 ) );
        vec2 cRip = cathodeRipples( vFogWorld.xz, uTime ) * uRain;
        ${
          water
            ? `vec2 cSwell = ( texture2D( uNoise, vFogWorld.xz * 0.05 + uTime * vec2( 0.01, 0.006 ) ).rg - 0.5 ) * 0.25;
        cRip += cSwell;`
            : ""
        }
        vec3 cRipW = normalize( vec3( - cRip.x * ${water ? "0.6" : "0.45"}, 1.0, - cRip.y * ${water ? "0.6" : "0.45"} ) );
        vec3 cRipV = normalize( ( viewMatrix * vec4( cRipW, 0.0 ) ).xyz );
        normal = normalize( mix( normal, cRipV, mix( 0.25, 1.0, cPuddle ) ) );
      }`,
    )
    .replace(
      "#include <lights_fragment_maps>",
      /* glsl */ `#include <lights_fragment_maps>
      {
        vec4 cRC = uReflMatrix * vec4( vFogWorld, 1.0 );
        vec2 cUv = cRC.xy / cRC.w;
        vec3 cNW = inverseTransformDirection( normal, viewMatrix );
        cUv += cNW.xz * 0.06;
        float cLod = clamp( material.roughness * 5.5 - 0.2, 0.0, 5.0 );
        vec2 cTap = vec2( 0.004 + material.roughness * 0.02, 0.0 );
        vec3 cRefl = textureLod( uRefl, cUv, cLod ).rgb * 0.4
          + textureLod( uRefl, cUv + cTap.xy, cLod ).rgb * 0.15
          + textureLod( uRefl, cUv - cTap.xy, cLod ).rgb * 0.15
          + textureLod( uRefl, cUv + cTap.yx * 2.0, cLod ).rgb * 0.15
          + textureLod( uRefl, cUv - cTap.yx * 2.0, cLod ).rgb * 0.15;
        radiance = mix( radiance, cRefl, uReflOn );
      }`,
    );
}

const MIRROR_DECL = /* glsl */ `
uniform sampler2D uRefl;
uniform mat4 uReflMatrix;
uniform float uReflOn;
`;

/** Worn road paint: a broken centre line, solid edge lines and a pedestrian crossing near the flyover. */
const ROAD_LINES = /* glsl */ `
float cathodeRoadLines( vec2 p ) {
  float m = 0.0;
  // Dashed centre line at x = -1.5.
  float dash = step( 0.45, fract( p.y / 6.0 ) );
  m = max( m, ( 1.0 - smoothstep( 0.06, 0.08, abs( p.x + 1.5 ) ) ) * dash );
  // Edge lines.
  m = max( m, 1.0 - smoothstep( 0.05, 0.07, abs( p.x + 6.05 ) ) );
  m = max( m, 1.0 - smoothstep( 0.05, 0.07, abs( p.x - 3.05 ) ) );
  // Zebra crossing at z 18..21.
  float zebra = step( 0.5, fract( p.x / 1.1 ) ) * ( 1.0 - smoothstep( 1.4, 1.5, abs( p.y - 19.5 ) ) ) * step( p.x, 3.0 ) * step( -6.0, p.x );
  m = max( m, zebra );
  // Wear: paint survives in patches.
  float wear = smoothstep( 0.35, 0.65, texture2D( uNoise, p * 0.21 ).g );
  return m * wear * 0.85;
}
`;
