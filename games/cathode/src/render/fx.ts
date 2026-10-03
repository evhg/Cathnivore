// Combat effects: pooled and cheap. Two instanced particle meshes (additive light: flashes, sparks, fire,
// tracers; blended matter: dust, smoke, blood, water, debris) simulated on the CPU, a ring buffer of
// decals (bullet holes, blood, scorch) that stay for the session, physical brass casings, and a pair of
// short-lived lights for muzzle flashes and explosions. "Reduced" intensity swaps blood for a dark puff
// and draws no decals.

import * as THREE from "three";
import type { Effects, Surface, WorldEvent } from "./types";
import { DECAL, decalAtlas, decalCell } from "./textures";
import { patchMaterial, type SharedUniforms } from "./shading";
import type { Volume } from "./lighting";

/** Particle kinds (the shader draws each differently). */
const K = { soft: 0, streak: 1, smoke: 2, drop: 3, flash: 4 } as const;

interface P {
  alive: boolean;
  additive: boolean;
  kind: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  grav: number;
  drag: number;
  age: number;
  life: number;
  size0: number;
  size1: number;
  len: number;
  color: THREE.Color;
  color1: THREE.Color | null;
  alpha: number;
  /** On hitting the ground: 0 nothing, 1 stop, 2 bounce, 3 blood decal and stop. */
  ground: number;
}

class ParticleLayer {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly aPos: THREE.InstancedBufferAttribute;
  private readonly aVel: THREE.InstancedBufferAttribute;
  private readonly aCol: THREE.InstancedBufferAttribute;
  private readonly aSize: THREE.InstancedBufferAttribute;

  constructor(
    readonly capacity: number,
    additive: boolean,
    shared: SharedUniforms,
  ) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    const mk = (n: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aPos = mk(4); // xyz + kind
    this.aVel = mk(3);
    this.aCol = mk(4);
    this.aSize = mk(3); // width, length, rotation/seed
    geo.setAttribute("aPos", this.aPos);
    geo.setAttribute("aVel", this.aVel);
    geo.setAttribute("aCol", this.aCol);
    geo.setAttribute("aSize", this.aSize);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uNoise: shared.uNoise, uTime: shared.uTime },
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      defines: additive ? { ADDITIVE: "" } : {},
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 8 : 7;
    this.mesh.name = additive ? "fx:light" : "fx:matter";
  }

  write(list: P[]): void {
    let n = 0;
    const pa = this.aPos.array as Float32Array;
    const va = this.aVel.array as Float32Array;
    const ca = this.aCol.array as Float32Array;
    const sa = this.aSize.array as Float32Array;
    for (const p of list) {
      if (n >= this.capacity) break;
      const t = p.age / p.life;
      pa[n * 4] = p.pos.x;
      pa[n * 4 + 1] = p.pos.y;
      pa[n * 4 + 2] = p.pos.z;
      pa[n * 4 + 3] = p.kind;
      va[n * 3] = p.vel.x;
      va[n * 3 + 1] = p.vel.y;
      va[n * 3 + 2] = p.vel.z;
      const c = p.color1 ? tmpC.copy(p.color).lerp(p.color1, t) : p.color;
      const fade = p.kind === K.flash ? 1 - t : p.kind === K.smoke ? Math.sin(Math.PI * Math.min(1, t * 1.2)) : 1 - t * t;
      ca[n * 4] = c.r;
      ca[n * 4 + 1] = c.g;
      ca[n * 4 + 2] = c.b;
      ca[n * 4 + 3] = p.alpha * fade;
      sa[n * 3] = p.size0 + (p.size1 - p.size0) * t;
      sa[n * 3 + 1] = p.len;
      sa[n * 3 + 2] = (p.pos.x * 7.3 + p.life * 13.1) % 6.283;
      n++;
    }
    this.geo.instanceCount = n;
    for (const a of [this.aPos, this.aVel, this.aCol, this.aSize]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

const tmpC = new THREE.Color();

const PVERT = /* glsl */ `
attribute vec4 aPos;
attribute vec3 aVel;
attribute vec4 aCol;
attribute vec3 aSize;
varying vec2 vUv;
varying vec4 vCol;
varying float vKind;
varying float vRot;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vCol = aCol;
  vKind = aPos.w;
  vRot = aSize.z;
  vec3 p = aPos.xyz;
  vec3 toCam = normalize( cameraPosition - p );
  vec3 wp;
  if ( vKind > 0.5 && vKind < 1.5 || vKind > 2.5 && vKind < 3.5 && length( aVel ) > 2.0 ) {
    // Streaks stretch along their velocity.
    vec3 axis = length( aVel ) > 0.001 ? normalize( aVel ) : vec3( 0.0, 1.0, 0.0 );
    vec3 side = normalize( cross( axis, toCam ) );
    float len = vKind < 1.5 ? aSize.y : aSize.x * ( 1.0 + length( aVel ) * 0.04 );
    wp = p + side * position.x * aSize.x + axis * ( position.y - 0.5 ) * len;
  } else {
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    vec3 up = cross( toCam, right );
    float c = cos( vRot ), s = sin( vRot );
    vec2 q = vec2( c * position.x - s * position.y, s * position.x + c * position.y );
    wp = p + ( right * q.x + up * q.y ) * aSize.x;
  }
  vec4 mvPosition = viewMatrix * vec4( wp, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const PFRAG = /* glsl */ `
uniform sampler2D uNoise;
varying vec2 vUv;
varying vec4 vCol;
varying float vKind;
varying float vRot;
#include <fog_pars_fragment>
void main() {
  vec2 p = vUv - 0.5;
  float r = length( p );
  float a;
  if ( vKind < 0.5 ) a = smoothstep( 0.5, 0.0, r );
  else if ( vKind < 1.5 ) a = ( 1.0 - abs( p.x ) * 2.0 ) * smoothstep( 0.5, 0.2, abs( p.y ) );
  else if ( vKind < 2.5 ) {
    float n = texture2D( uNoise, p * 0.7 + vRot * 0.31 ).g;
    a = smoothstep( 0.5, 0.05, r ) * smoothstep( 0.2, 0.7, n + 0.25 );
  }
  else if ( vKind < 3.5 ) a = smoothstep( 0.5, 0.3, r );
  else {
    // Muzzle flash: a hot core and four ragged petals.
    float ang = atan( p.y, p.x );
    float petals = pow( abs( cos( ang * 2.0 + vRot ) ), 6.0 );
    a = smoothstep( 0.5, 0.0, r / ( 0.35 + petals * 0.65 ) ) + smoothstep( 0.18, 0.0, r ) * 2.0;
  }
  #ifdef ADDITIVE
    gl_FragColor = vec4( vCol.rgb * a * vCol.a, 1.0 );
    gl_FragColor.rgb *= 1.0 - cathodeFogAmount( cameraPosition, vFogWorld, fogDensity ) * 0.85;
  #else
    gl_FragColor = vec4( vCol.rgb, a * vCol.a );
    #include <fog_fragment>
  #endif
}
`;

export interface FxSystem {
  fx: Effects;
  update(dt: number, camera: THREE.Camera): void;
  /** For lightAt: the dynamic lights currently burning. */
  lights: THREE.PointLight[];
  dispose(): void;
}

export function createFx(o: {
  scene: THREE.Scene;
  shared: SharedUniforms;
  intensity: "full" | "reduced";
  quality: "phone" | "high" | "ultra";
  colliders: THREE.Box3[];
  surfaces: Surface[];
  groundHeight: (x: number, z: number) => number;
  volume: Volume;
  emit: (e: WorldEvent) => void;
}): FxSystem {
  const cap = o.quality === "phone" ? 700 : o.quality === "high" ? 2200 : 3200;
  const lightLayer = new ParticleLayer(cap, true, o.shared);
  const matterLayer = new ParticleLayer(cap, false, o.shared);
  o.scene.add(lightLayer.mesh, matterLayer.mesh);
  const pool: P[] = [];
  const live: P[] = [];
  const reduced = o.intensity === "reduced";
  const rand = Math.random;
  const tmpV = new THREE.Vector3();
  const lit = new THREE.Color();

  const spawn = (init: Partial<P> & { pos: THREE.Vector3 }): P | null => {
    if (live.length >= cap * 2 - 2) return null;
    const p: P =
      pool.pop() ??
      ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), color: new THREE.Color(), color1: null } as unknown as P);
    p.alive = true;
    p.additive = init.additive ?? false;
    p.kind = init.kind ?? K.soft;
    p.pos.copy(init.pos);
    p.vel.copy(init.vel ?? tmpV.set(0, 0, 0));
    p.grav = init.grav ?? 0;
    p.drag = init.drag ?? 0;
    p.age = 0;
    p.life = init.life ?? 0.5;
    p.size0 = init.size0 ?? 0.1;
    p.size1 = init.size1 ?? p.size0;
    p.len = init.len ?? 0.2;
    p.color.copy(init.color ?? lit.set(1, 1, 1));
    p.color1 = init.color1 ? (p.color1 ?? new THREE.Color()).copy(init.color1) : null;
    p.alpha = init.alpha ?? 1;
    p.ground = init.ground ?? 0;
    live.push(p);
    return p;
  };
  /** A colour lit by the baked volume at `p` (for smoke, dust and blood). */
  const ambient = (p: THREE.Vector3, base: THREE.Color, k = 0.25) => {
    o.volume.sample(p, lit);
    return new THREE.Color(base.r * (0.06 + lit.r * k), base.g * (0.06 + lit.g * k), base.b * (0.06 + lit.b * k));
  };
  const randDir = (out: THREE.Vector3) => out.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
  const cone = (dir: THREE.Vector3, spread: number, out: THREE.Vector3) => {
    randDir(out).multiplyScalar(spread).add(dir).normalize();
    return out;
  };

  // ---------------------------------------------------------------- dynamic lights
  const lights: THREE.PointLight[] = [];
  const lightLife: number[] = [];
  const lightMax: number[] = [];
  for (let i = 0; i < 2; i++) {
    const l = new THREE.PointLight(0xffaa55, 0, 14, 2);
    o.scene.add(l);
    lights.push(l);
    lightLife.push(0);
    lightMax.push(0);
  }
  let nextLight = 0;
  const flashLight = (pos: THREE.Vector3, color: string, intensity: number, life: number, range: number) => {
    const i = nextLight++ % lights.length;
    const l = lights[i]!;
    l.position.copy(pos);
    l.color.set(color);
    l.distance = range;
    l.intensity = intensity;
    lightLife[i] = life;
    lightMax[i] = life;
    l.userData.peak = intensity;
  };

  // ---------------------------------------------------------------- decals
  const decalCap = o.quality === "phone" ? 160 : 480;
  const decalMat = new THREE.MeshStandardMaterial({
    map: decalAtlas(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.25,
    metalness: 0,
  });
  patchMaterial(decalMat, o.shared, { kind: "prop", wet: 0.3 });
  const basePatch = decalMat.onBeforeCompile;
  decalMat.onBeforeCompile = (shader, r) => {
    basePatch.call(decalMat, shader, r);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aCell;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * 0.25 + aCell;\n#endif");
  };
  decalMat.customProgramCacheKey = () => "cathode-decal";
  const decalGeo = new THREE.PlaneGeometry(1, 1);
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(decalCap * 2), 2);
  decalGeo.setAttribute("aCell", cellAttr);
  const decals = new THREE.InstancedMesh(decalGeo, decalMat, decalCap);
  decals.count = 0;
  decals.frustumCulled = false;
  decals.renderOrder = 1;
  decals.name = "fx:decals";
  o.scene.add(decals);
  let decalNext = 0;
  const dm = new THREE.Matrix4();
  const dq = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const addDecal = (pos: THREE.Vector3, normal: THREE.Vector3, size: number, cell: number, tint: THREE.Color) => {
    if (reduced) return;
    const i = decalNext++ % decalCap;
    dq.setFromUnitVectors(zAxis, normal);
    dq.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, rand() * Math.PI * 2));
    dm.compose(tmpV.copy(pos).addScaledVector(normal, 0.012), dq, new THREE.Vector3(size, size, size));
    decals.setMatrixAt(i, dm);
    decals.setColorAt(i, tint);
    const [u, v] = decalCell(cell);
    cellAttr.setXY(i, u, v);
    decals.count = Math.min(decalCap, Math.max(decals.count, i + 1));
    decals.instanceMatrix.needsUpdate = true;
    if (decals.instanceColor) decals.instanceColor.needsUpdate = true;
    cellAttr.needsUpdate = true;
  };

  /** Ray against the static colliders: the nearest hit within `max` metres, with its face normal. */
  const ray = new THREE.Ray();
  const hitP = new THREE.Vector3();
  const raycast = (from: THREE.Vector3, dir: THREE.Vector3, max: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null => {
    ray.set(from, dir);
    let best = max;
    let bestBox: THREE.Box3 | null = null;
    for (const b of o.colliders) {
      if (b.containsPoint(from)) continue;
      const h = ray.intersectBox(b, hitP);
      if (!h) continue;
      const d = h.distanceTo(from);
      if (d < best) {
        best = d;
        bestBox = b;
      }
    }
    // The ground too.
    if (dir.y < -0.01) {
      const gy = o.groundHeight(from.x, from.z);
      const t = (gy - from.y) / dir.y;
      if (t > 0 && t < best) return { point: from.clone().addScaledVector(dir, t), normal: new THREE.Vector3(0, 1, 0) };
    }
    if (!bestBox) return null;
    const point = from.clone().addScaledVector(dir, best);
    return { point, normal: boxNormal(bestBox, point) };
  };

  // ---------------------------------------------------------------- casings
  const casingCap = o.quality === "phone" ? 40 : 96;
  const brass = new THREE.MeshStandardMaterial({ color: "#c49a48", metalness: 1, roughness: 0.28 });
  const casingGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.022, 8);
  const casingMesh = new THREE.InstancedMesh(casingGeo, brass, casingCap);
  casingMesh.count = 0;
  casingMesh.frustumCulled = false;
  casingMesh.name = "fx:casings";
  o.scene.add(casingMesh);
  interface Casing {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    rot: THREE.Euler;
    spin: THREE.Vector3;
    rest: number;
    bounces: number;
  }
  const casings: Casing[] = [];
  let casingNext = 0;

  // ---------------------------------------------------------------- the API
  const WHITE_HOT = new THREE.Color(9, 6.5, 3.2);
  const ORANGE = new THREE.Color(6, 2.2, 0.5);
  const fx: Effects = {
    muzzle(pos, dir, size = 1) {
      const d = dir.clone().normalize();
      spawn({ pos: pos.clone().addScaledVector(d, 0.05 * size), kind: K.flash, additive: true, life: 0.055, size0: 0.28 * size, size1: 0.36 * size, color: WHITE_HOT });
      spawn({ pos: pos.clone().addScaledVector(d, 0.18 * size), vel: d.clone().multiplyScalar(2), kind: K.streak, additive: true, life: 0.05, size0: 0.09 * size, len: 0.5 * size, color: ORANGE });
      for (let i = 0; i < 5; i++)
        spawn({ pos: pos.clone(), vel: cone(d, 0.35, new THREE.Vector3()).multiplyScalar(14 + rand() * 10), kind: K.streak, additive: true, life: 0.06 + rand() * 0.06, size0: 0.008, len: 0.12, color: ORANGE, drag: 3 });
      spawn({ pos: pos.clone().addScaledVector(d, 0.2), vel: d.clone().multiplyScalar(0.8).add(tmpV.set(0, 0.25, 0)), kind: K.smoke, life: 0.9, size0: 0.12 * size, size1: 0.6 * size, color: ambient(pos, new THREE.Color(0.7, 0.7, 0.72), 0.3), alpha: 0.35, drag: 1.5 });
      flashLight(pos.clone().addScaledVector(d, 0.3), "#ffb066", 60 * size, 0.06, 9);
    },
    impact(pos, normal, surface) {
      const n = normal.clone().normalize();
      if (surface === "flesh") {
        fx.blood(pos, n, 0.5);
        return;
      }
      if (surface === "water") {
        for (let i = 0; i < 14; i++)
          spawn({ pos: pos.clone(), vel: cone(new THREE.Vector3(0, 1, 0), 0.35, new THREE.Vector3()).multiplyScalar(2 + rand() * 3.5), kind: K.drop, life: 0.6, size0: 0.025, color: ambient(pos, new THREE.Color(0.8, 0.85, 0.9), 0.5), grav: 1, alpha: 0.8, ground: 1 });
        spawn({ pos: pos.clone().add(tmpV.set(0, 0.2, 0)), vel: new THREE.Vector3(0, 1.4, 0), kind: K.smoke, life: 0.5, size0: 0.1, size1: 0.45, color: ambient(pos, new THREE.Color(0.8, 0.85, 0.9), 0.5), alpha: 0.4 });
        return;
      }
      const metal = surface === "metal" || surface === "chrome";
      const glass = surface === "glass";
      // Sparks (metal) or a few hot chips (concrete).
      const sparks = metal ? 14 : glass ? 4 : 3;
      for (let i = 0; i < sparks; i++)
        spawn({ pos: pos.clone(), vel: cone(n, 0.8, new THREE.Vector3()).multiplyScalar(3 + rand() * 6), kind: K.streak, additive: true, life: 0.15 + rand() * 0.35, size0: 0.01, len: 0.08, color: metal ? WHITE_HOT : ORANGE, grav: 1, drag: 1, ground: 2 });
      if (metal) spawn({ pos: pos.clone().addScaledVector(n, 0.02), kind: K.flash, additive: true, life: 0.05, size0: 0.12, color: WHITE_HOT });
      if (glass)
        for (let i = 0; i < 12; i++)
          spawn({ pos: pos.clone(), vel: cone(n, 0.9, new THREE.Vector3()).multiplyScalar(1 + rand() * 3), kind: K.drop, additive: true, life: 0.8, size0: 0.012, color: new THREE.Color(1.5, 1.8, 2.2), grav: 1, ground: 1 });
      if (!metal && !glass) {
        // Dust and chips.
        const tint = surface === "wood" ? new THREE.Color(0.55, 0.42, 0.3) : new THREE.Color(0.62, 0.6, 0.57);
        spawn({ pos: pos.clone().addScaledVector(n, 0.05), vel: n.clone().multiplyScalar(0.9), kind: K.smoke, life: 1.1, size0: 0.08, size1: 0.55, color: ambient(pos, tint, 0.35), alpha: 0.55, drag: 2.5 });
        for (let i = 0; i < 8; i++)
          spawn({ pos: pos.clone(), vel: cone(n, 0.7, new THREE.Vector3()).multiplyScalar(2 + rand() * 4), kind: K.drop, life: 0.7, size0: 0.012 + rand() * 0.012, color: ambient(pos, tint.clone().multiplyScalar(0.5), 0.2), grav: 1, ground: 2 });
      }
      addDecal(pos, n, metal ? 0.07 : 0.11, glass ? DECAL.crack[0] : metal ? DECAL.holeMetal[0] : DECAL.hole[Math.floor(rand() * 2)]!, new THREE.Color(1, 1, 1));
    },
    blood(pos, dir, amount) {
      const a = THREE.MathUtils.clamp(amount, 0, 1);
      const d = dir.clone().normalize();
      if (reduced) {
        spawn({ pos: pos.clone(), vel: d.clone().multiplyScalar(0.6), kind: K.smoke, life: 0.45, size0: 0.08, size1: 0.3, color: new THREE.Color(0.03, 0.03, 0.035), alpha: 0.7, drag: 3 });
        return;
      }
      const red = ambient(pos, new THREE.Color(0.32, 0.01, 0.015), 0.35);
      const n = Math.round(10 + a * 40);
      for (let i = 0; i < n; i++)
        spawn({ pos: pos.clone(), vel: cone(d, 0.45, new THREE.Vector3()).multiplyScalar(1.5 + rand() * 5 * (0.5 + a)), kind: K.drop, life: 1.2, size0: 0.012 + rand() * 0.02, color: red, grav: 1, alpha: 0.95, ground: rand() < 0.25 ? 3 : 1 });
      spawn({ pos: pos.clone(), vel: d.clone().multiplyScalar(1.2), kind: K.smoke, life: 0.35, size0: 0.06, size1: 0.35 + a * 0.3, color: red.clone().multiplyScalar(0.8), alpha: 0.75, drag: 4 });
      // Splatter on whatever is behind the wound, and a pool on the floor below.
      const hit = raycast(pos, d, 2.5 + a * 2);
      if (hit) addDecal(hit.point, hit.normal, 0.5 + a * 0.6 + rand() * 0.3, DECAL.blood[3 + Math.floor(rand() * 3)]!, new THREE.Color(0.9, 0.9, 0.9));
      const gy = o.groundHeight(pos.x, pos.z);
      if (pos.y - gy < 2.2) addDecal(new THREE.Vector3(pos.x + d.x * 0.6, gy, pos.z + d.z * 0.6), new THREE.Vector3(0, 1, 0), 0.4 + a * 0.7, DECAL.blood[Math.floor(rand() * 3)]!, new THREE.Color(1, 1, 1));
    },
    sparks(pos, dir, amount) {
      const d = dir.clone().normalize();
      const n = Math.round(8 + amount * 30);
      for (let i = 0; i < n; i++)
        spawn({ pos: pos.clone(), vel: cone(d, 0.7, new THREE.Vector3()).multiplyScalar(2 + rand() * 7), kind: K.streak, additive: true, life: 0.2 + rand() * 0.5, size0: 0.01, len: 0.1, color: rand() < 0.3 ? new THREE.Color(1.5, 3.5, 6) : WHITE_HOT, grav: 1, drag: 0.8, ground: 2 });
      // Coolant: milky blue droplets.
      for (let i = 0; i < n / 2; i++)
        spawn({ pos: pos.clone(), vel: cone(d, 0.5, new THREE.Vector3()).multiplyScalar(1 + rand() * 3), kind: K.drop, life: 1, size0: 0.015, color: ambient(pos, new THREE.Color(0.5, 0.85, 1), 0.5), grav: 1, ground: 1 });
      spawn({ pos: pos.clone(), kind: K.flash, additive: true, life: 0.06, size0: 0.2, color: new THREE.Color(3, 5, 9) });
      flashLight(pos, "#9fd8ff", 12 * (0.5 + amount), 0.08, 5);
    },
    casing(pos, vel) {
      const i = casingNext++ % casingCap;
      const c: Casing = casings[i] ?? { pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), rest: 0, bounces: 0 };
      c.pos.copy(pos);
      c.vel.copy(vel);
      c.rot.set(rand() * 6, rand() * 6, rand() * 6);
      c.spin.set(rand() * 30 - 15, rand() * 30 - 15, rand() * 30 - 15);
      c.rest = 0;
      c.bounces = 0;
      casings[i] = c;
      casingMesh.count = Math.min(casingCap, Math.max(casingMesh.count, i + 1));
    },
    tracer(a, b) {
      const d = b.clone().sub(a);
      const dist = d.length();
      if (dist < 0.1) return;
      d.divideScalar(dist);
      const speed = 320;
      const len = Math.min(dist, 9);
      spawn({ pos: a.clone().addScaledVector(d, len / 2), vel: d.clone().multiplyScalar(speed), kind: K.streak, additive: true, life: Math.max(0.03, (dist - len / 2) / speed), size0: 0.018, len, color: new THREE.Color(5, 3.6, 1.8) });
    },
    explosion(pos, radius) {
      const r = Math.max(0.5, radius);
      flashLight(pos.clone().add(tmpV.set(0, 0.8, 0)), "#ff9a3c", 900 * r, 0.6, 14 + r * 5);
      spawn({ pos: pos.clone().add(tmpV.set(0, 0.4, 0)), kind: K.flash, additive: true, life: 0.12, size0: r * 1.5, size1: r * 2.6, color: new THREE.Color(12, 8, 4) });
      for (let i = 0; i < 26; i++)
        spawn({ pos: pos.clone().add(randDir(new THREE.Vector3()).multiplyScalar(r * 0.3)), vel: randDir(new THREE.Vector3()).multiplyScalar(r * (1.5 + rand() * 2.5)).add(tmpV.set(0, r * 1.5, 0)), kind: K.smoke, additive: true, life: 0.35 + rand() * 0.4, size0: r * 0.4, size1: r * 1.3, color: new THREE.Color(8, 3.5, 1.0), color1: new THREE.Color(1.2, 0.2, 0.05), drag: 3 });
      const smokeC = ambient(pos, new THREE.Color(0.25, 0.24, 0.23), 0.25);
      for (let i = 0; i < 22; i++)
        spawn({ pos: pos.clone().add(randDir(new THREE.Vector3()).multiplyScalar(r * 0.5)), vel: randDir(new THREE.Vector3()).multiplyScalar(r).add(tmpV.set(0, 1.5 + rand() * 2, 0)), kind: K.smoke, life: 2.5 + rand() * 2.5, size0: r * 0.6, size1: r * 3, color: smokeC, alpha: 0.55, drag: 1.2 });
      for (let i = 0; i < 30; i++)
        spawn({ pos: pos.clone(), vel: randDir(new THREE.Vector3()).multiplyScalar(4 + rand() * 9 * r).add(tmpV.set(0, 4, 0)), kind: K.drop, life: 1.6, size0: 0.03 + rand() * 0.05, color: new THREE.Color(0.02, 0.02, 0.02), grav: 1, ground: 2 });
      for (let i = 0; i < 40; i++)
        spawn({ pos: pos.clone(), vel: randDir(new THREE.Vector3()).multiplyScalar(5 + rand() * 12).add(tmpV.set(0, 3, 0)), kind: K.streak, additive: true, life: 0.4 + rand() * 0.9, size0: 0.012, len: 0.14, color: WHITE_HOT, grav: 1, drag: 0.6, ground: 2 });
      const gy = o.groundHeight(pos.x, pos.z);
      if (pos.y - gy < r) addDecal(new THREE.Vector3(pos.x, gy, pos.z), new THREE.Vector3(0, 1, 0), r * 2.6, DECAL.scorch[0], new THREE.Color(1, 1, 1));
    },
  };

  const lightList: P[] = [];
  const matterList: P[] = [];
  const cm = new THREE.Matrix4();
  const cq = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  return {
    fx,
    lights,
    update(dt) {
      // Lights fade fast.
      for (let i = 0; i < lights.length; i++) {
        if (lightLife[i]! <= 0) {
          lights[i]!.intensity = 0;
          continue;
        }
        lightLife[i] = lightLife[i]! - dt;
        const t = Math.max(0, lightLife[i]! / lightMax[i]!);
        lights[i]!.intensity = (lights[i]!.userData.peak as number) * t * t;
      }
      // Particles.
      lightList.length = 0;
      matterList.length = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i]!;
        p.age += dt;
        if (p.age >= p.life) {
          live[i] = live[live.length - 1]!;
          live.pop();
          pool.push(p);
          continue;
        }
        if (p.grav) p.vel.y -= 9.8 * p.grav * dt;
        if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        if (p.ground) {
          const gy = Math.max(o.groundHeight(p.pos.x, p.pos.z), -0.2);
          if (p.pos.y < gy) {
            p.pos.y = gy + 0.005;
            if (p.ground === 2 && Math.abs(p.vel.y) > 0.8) {
              p.vel.y *= -0.35;
              p.vel.x *= 0.5;
              p.vel.z *= 0.5;
            } else {
              if (p.ground === 3 && !reduced) addDecal(p.pos, new THREE.Vector3(0, 1, 0), 0.08 + Math.random() * 0.12, DECAL.blood[Math.floor(Math.random() * 3)]!, new THREE.Color(1, 1, 1));
              p.vel.set(0, 0, 0);
              p.grav = 0;
              p.ground = 0;
              p.life = Math.min(p.life, p.age + 0.3);
            }
          }
        }
        (p.additive ? lightList : matterList).push(p);
      }
      lightLayer.write(lightList);
      matterLayer.write(matterList);
      // Casings.
      for (let i = 0; i < casings.length; i++) {
        const c = casings[i];
        if (!c) continue;
        if (c.rest < 30) {
          c.vel.y -= 9.8 * dt;
          c.pos.addScaledVector(c.vel, dt);
          c.rot.x += c.spin.x * dt;
          c.rot.y += c.spin.y * dt;
          c.rot.z += c.spin.z * dt;
          const gy = Math.max(o.groundHeight(c.pos.x, c.pos.z), -0.2) + 0.006;
          if (c.pos.y < gy) {
            c.pos.y = gy;
            if (Math.abs(c.vel.y) > 0.6 && c.bounces < 4) {
              c.bounces++;
              o.emit({ type: "casing", pos: c.pos.clone(), surface: gy < -0.1 ? "water" : "concrete" });
              c.vel.set(c.vel.x * 0.5, -c.vel.y * 0.35, c.vel.z * 0.5);
              c.spin.multiplyScalar(0.5);
            } else {
              c.vel.set(0, 0, 0);
              c.spin.set(0, 0, 0);
              c.rot.x = Math.PI / 2;
              c.rest += dt;
            }
          }
        }
        cq.setFromEuler(c.rot);
        cm.compose(c.pos, cq, one);
        casingMesh.setMatrixAt(i, cm);
      }
      casingMesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      decalMat.map?.dispose();
      decalMat.dispose();
      brass.dispose();
    },
  };
}

/** The outward face normal of a box at a point on its surface. */
export function boxNormal(b: THREE.Box3, p: THREE.Vector3): THREE.Vector3 {
  const d = [
    [Math.abs(p.x - b.min.x), -1, 0, 0],
    [Math.abs(p.x - b.max.x), 1, 0, 0],
    [Math.abs(p.y - b.min.y), 0, -1, 0],
    [Math.abs(p.y - b.max.y), 0, 1, 0],
    [Math.abs(p.z - b.min.z), 0, 0, -1],
    [Math.abs(p.z - b.max.z), 0, 0, 1],
  ].sort((a, c) => a[0]! - c[0]!)[0]!;
  return new THREE.Vector3(d[1], d[2], d[3]);
}
