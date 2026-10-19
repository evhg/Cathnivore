// C9 "Deaths that land": blood that stays (docs/design/cathode-combat.md S4.5, "Pools"). A body that has come to
// rest bleeds out under its torso: a pool that spreads from 0.2 m to a metre over 8 s with an ease-out, its edge
// broken up by the shared noise, darkening from fresh #5C0707 to #2A0303 over 30 s. It is the wettest thing on the
// street: near-mirror roughness, and it samples the wet street's own planar reflection, so the neon over it shows
// in it. One instanced mesh for every pool (one draw call), capped per quality; past the cap the oldest is reused.

import * as THREE from "three";
import { LAYER_NO_REFLECT } from "./reflection";

export const POOLS = {
  caps: { phone: 6, desktop: 12 },
  /** Pools start this long after the body sleeps, or after this long as a ragdoll, whichever comes first (ms). */
  afterSleepMs: 600,
  afterRagdollMs: 1500,
  r0: 0.2,
  radius: { base: 1.0, headshot: 0.8, blownback: 1.2 } as Record<string, number>,
  growS: 8,
  darkS: 30,
  fresh: "#5C0707",
  old: "#2A0303",
  roughness: { desktop: 0.08, phone: 0.15 },
  /** Height over the street (m): over the decals, under a body lying in it. */
  lift: 0.014,
};

/** The pool's radius `ageS` seconds after it starts, for a full size of `R`: 0.2 m out to R over 8 s, easing out. */
export function poolRadius(ageS: number, R: number): number {
  const t = Math.min(1, Math.max(0, ageS / POOLS.growS));
  return POOLS.r0 + (R - POOLS.r0) * (1 - (1 - t) ** 3);
}

/** How far it has darkened toward old blood (0 fresh .. 1 old). */
export function poolDarken(ageS: number): number {
  return Math.min(1, Math.max(0, ageS / POOLS.darkS));
}

export interface PoolMirror {
  uRefl: { value: THREE.Texture | null };
  uReflMatrix: { value: THREE.Matrix4 };
  uReflOn: { value: number };
}

interface PoolRec {
  at: THREE.Vector3;
  R: number;
  age: number;
  yaw: number;
  seed: number;
  owner: object | null;
}

export class BloodPools {
  readonly mesh: THREE.InstancedMesh;
  readonly cap: number;
  private readonly list: PoolRec[] = [];
  private readonly aData: THREE.InstancedBufferAttribute;
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, quality: "phone" | "high" | "ultra", noise: { value: THREE.Texture | null }, mirror?: PoolMirror) {
    const phone = quality === "phone";
    this.cap = phone ? POOLS.caps.phone : POOLS.caps.desktop;
    const geo = new THREE.PlaneGeometry(2, 2, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.getAttribute("uv");
    geo.setAttribute("aPoolUv", new THREE.BufferAttribute(new Float32Array(uv.array), 2));
    // Per pool: darkening (0..1), seed, and the spread (0..1 of its full size, for the edge).
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    geo.setAttribute("aPool", this.aData);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: phone ? POOLS.roughness.phone : POOLS.roughness.desktop,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const fresh = new THREE.Color(POOLS.fresh).convertSRGBToLinear();
    const old = new THREE.Color(POOLS.old).convertSRGBToLinear();
    const mirrorOn = !!mirror;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPoolNoise = noise;
      shader.uniforms.uFresh = { value: fresh };
      shader.uniforms.uOld = { value: old };
      if (mirror)
        Object.assign(shader.uniforms, {
          uRefl: mirror.uRefl,
          uReflMatrix: mirror.uReflMatrix,
          uReflOn: mirror.uReflOn,
        });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 aPoolUv;\nattribute vec3 aPool;\nvarying vec2 vPoolUv;\nvarying vec3 vPool;\nvarying vec3 vPoolW;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvPoolUv = aPoolUv;\nvPool = aPool;\n#ifdef USE_INSTANCING\nvPoolW = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;\n#else\nvPoolW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n#endif",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
uniform sampler2D uPoolNoise;
uniform vec3 uFresh;
uniform vec3 uOld;
varying vec2 vPoolUv;
varying vec3 vPool;
varying vec3 vPoolW;
${mirrorOn ? "uniform sampler2D uRefl;\nuniform mat4 uReflMatrix;\nuniform float uReflOn;" : ""}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
  // An irregular spread: a disc whose edge is pushed in and out by two octaves of the shared noise (seeded per
  // pool), with lobes that reach further as it grows, and a thin dark meniscus at the rim.
  vec2 pc = vPoolUv * 2.0 - 1.0;
  float pr = length( pc );
  float pa = atan( pc.y, pc.x );
  vec2 nuv = vec2( cos( pa ), sin( pa ) ) * 0.22 + vPool.y * 3.7;
  float lobes = texture2D( uPoolNoise, nuv ).r * 0.65 + texture2D( uPoolNoise, nuv * 2.3 + 0.37 ).g * 0.35;
  float edge = 0.62 + 0.38 * lobes;
  float inner = 1.0 - smoothstep( edge - 0.06, edge, pr );
  if ( inner < 0.003 ) discard;
  float rim = smoothstep( edge - 0.16, edge - 0.03, pr ) * inner;
  // The lip: a hairline just inside the edge where the meniscus turns to the light (C9 review: without it the
  // pool read as a flat decal disc, not liquid standing on the street).
  float lip = smoothstep( edge - 0.075, edge - 0.035, pr ) * ( 1.0 - smoothstep( edge - 0.03, edge - 0.005, pr ) );
  // Broken along its length, as a real edge catches light only where it faces it.
  lip *= smoothstep( 0.35, 0.75, texture2D( uPoolNoise, nuv * 4.1 + 0.61 ).b );
  diffuseColor.rgb = mix( uFresh, uOld, vPool.x ) * ( 1.0 - 0.45 * rim );
  diffuseColor.a = inner * 0.96;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
  // Lifted out of the noir grade like the rest of the blood (S4.5's "emissive lift, ignoring local light"): a
  // pool on black asphalt has to read as blood, not as more wet street.
  totalEmissiveRadiance += diffuseColor.rgb * ( 1.6 + 2.2 * ( 1.0 - vPool.x ) ) * ( 1.0 - 0.5 * rim );
  totalEmissiveRadiance += vec3( 0.012, 0.01, 0.012 ) * lip;`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>
  // Flat as standing water in the middle; the rim curls a little (a meniscus), which catches a highlight.
  {
    vec3 pUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
    vec3 pOut = ( viewMatrix * vec4( pc.x, 0.0, -pc.y, 0.0 ) ).xyz;
    normal = normalize( pUp + pOut * rim * 0.6 );
  }`,
        );
      if (mirrorOn)
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          `{
    // The mirror, added straight to the pool's colour rather than as image-based specular: through the dielectric
    // BRDF a non-metal reflects 4% head on, so the neon over it all but vanished and the pool read as a flat maroon
    // decal (C9 review). Standing liquid at a low angle is mostly mirror: 40% head on, rising with Fresnel.
    vec4 pRC = uReflMatrix * vec4( vPoolW, 1.0 );
    vec2 pUv = pRC.xy / pRC.w;
    vec3 pRefl = textureLod( uRefl, pUv, 0.0 ).rgb * 0.5 + textureLod( uRefl, pUv + vec2( 0.003, 0.0 ), 0.0 ).rgb * 0.25 + textureLod( uRefl, pUv - vec2( 0.003, 0.0 ), 0.0 ).rgb * 0.25;
    float pFres = pow( 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 ), 5.0 );
    float pW = ( 0.45 + 0.5 * pFres ) * uReflOn;
    // Blood is thicker than rain water: a dark red mirror. The haze and the dim street fall away in it (they would
    // milk the whole pool grey) and only the lights come through, redder, but keeping their hue.
    float pL = dot( pRefl, vec3( 0.2126, 0.7152, 0.0722 ) );
    vec3 pHi = pRefl * smoothstep( 0.12, 0.45, pL );
    outgoingLight = outgoingLight * ( 1.0 - 0.25 * pW * smoothstep( 0.12, 0.45, pL ) ) + pHi * vec3( 1.0, 0.5, 0.46 ) * 1.4 * pW;
    // The lip catches the street's light whiter than the body of the pool (a thin film, less tinted).
    outgoingLight += ( pHi * 1.4 + vec3( 0.02, 0.022, 0.026 ) ) * lip * uReflOn;
  }
  #include <opaque_fragment>`,
        );
    };
    mat.customProgramCacheKey = () => `cathode-pool-${mirrorOn ? 1 : 0}`;
    this.mesh = new THREE.InstancedMesh(geo, mat, this.cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.name = "gore:pools";
    this.mesh.layers.set(LAYER_NO_REFLECT);
    this.mesh.visible = false;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  /** A pool starts at `at` (on the street), growing to `R` metres. Past the cap the oldest pool is reused. */
  add(at: THREE.Vector3, R: number, seed: number, owner: object | null = null): void {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({
      at: at.clone(),
      R,
      age: 0,
      yaw: (seed * 2.399) % (Math.PI * 2),
      seed: (seed * 0.618) % 1,
      owner,
    });
  }

  has(owner: object): boolean {
    return this.list.some((p) => p.owner === owner);
  }

  /** Screenshot stages: age every pool by `s` seconds at once. */
  age(s: number): void {
    for (const p of this.list) p.age += s;
  }

  update(dt: number): void {
    let n = 0;
    for (const p of this.list) {
      p.age += dt;
      const r = poolRadius(p.age, p.R);
      this.q.setFromAxisAngle(this.up, p.yaw);
      this.s.set(r, 1, r);
      this.m4.compose(p.at, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m4);
      this.aData.setXYZ(n, poolDarken(p.age), p.seed, r / p.R);
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aData.needsUpdate = true;
  }

  clear(): void {
    this.list.length = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /** Where each pool is and how big it is now (stage probes). */
  get pools(): readonly { at: THREE.Vector3; r: number; age: number }[] {
    return this.list.map((p) => ({
      at: p.at,
      r: poolRadius(p.age, p.R),
      age: p.age,
    }));
  }

  dispose(): void {
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.geometry.dispose();
  }
}
