// Blood and wounds (docs/design/cathode-combat.md S4.5). Every flesh hit gets five things on the same frame:
// an entry puff that faces the player and lifts itself out of the dark grade, a spurt flung back toward the
// camera, an exit spray of stretched, glinting droplets along the round, a splat on the wall behind (with a
// short "wet in"), and a wound that stays on the body and runs. The first 80 ms ride the hit segment so the
// spray moves with the flinch. Its own instanced pools, capped; decals go through the fx atlas.

import * as THREE from "three";
import { DECAL, decalCell } from "./textures";
import { LAYER_NO_REFLECT } from "./reflection";
import { BloodPools, type PoolMirror } from "./pools";

/** One flesh hit, as combat reports it. */
export interface FleshHit {
  point: THREE.Vector3;
  /** The round's travel (unit). */
  dir: THREE.Vector3;
  damage: number;
  maxHp: number;
  weaponCls: string;
  /** Metres from the shooter. */
  distance: number;
  /** The hit segment: effects ride it for their first 80 ms, and the wound stays on it. */
  anchor?: THREE.Object3D;
  /** A head hit: the mist is bigger (a headshot is the hit that has to read most, S4.4's "mist x2"). */
  head?: boolean;
  /** The killing round: the mist is bigger and the plume thicker (S4.4: a headshot kill is "blood mist x2"). */
  lethal?: boolean;
  /** Whose body (the per-enemy wound cap). */
  owner?: object;
  /** The body's root: when it leaves the scene its wounds go too. */
  root?: THREE.Object3D;
}

export interface GoreDeps {
  scene: THREE.Scene;
  quality: "phone" | "high" | "ultra";
  /** Reduced violence: an ink puff and nothing else (S4.5). */
  reduced: boolean;
  noise: { value: THREE.Texture | null };
  /** The fx decal atlas (shared, not drawn twice). */
  atlas: THREE.Texture;
  raycast(from: THREE.Vector3, dir: THREE.Vector3, max: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null;
  ground(x: number, z: number): number;
  /** A decal on the world; `wetInMs` grows it from 0.7 to 1.0. */
  decal(pos: THREE.Vector3, normal: THREE.Vector3, size: number, cell: number, tint: THREE.Color, wetInMs?: number, along?: THREE.Vector3): void;
  /** The baked light at a point, for tinting matter (0..1 per channel, roughly). */
  light(pos: THREE.Vector3, out: THREE.Color): THREE.Color;
  /** The wet street's planar mirror (C9 pools reflect the neon in it); absent in tests. */
  mirror?: PoolMirror;
}

/** S4.5 numbers. */
export const GORE = {
  puff: { count: [1, 3] as const, size: [0.25, 0.45] as const, farMul: 1.4, farM: 15, phoneMul: 1.5, headMul: 1.35, killMul: 1.4, headKillMul: 2, color: "#8A0E0E", alpha: 0.85, growMs: 200, fadeMs: 350, lift: 0.18 },
  // Overstated past S4.5's 4 to 8 at 1 to 2.5 m/s: at that speed the spurt is still inside the hit marker 40 ms
  // on, so the frame that confirms the hit showed no droplets at all (C2 review). These fly clear of the X as
  // stretched streaks, then fall.
  // Fanned across the view (a spurt straight at the camera barely moves on screen), with a pull back toward her.
  spurt: { count: [7, 11] as const, speed: [5, 9] as const, coneDeg: 70, lift: 1.9, back: 0.6 },
  /** The wound keeps bleeding where it was hit: slow, heavy drops that hang at the hole and fall (the fast spurt has gone by 160 ms). */
  ooze: { count: [5, 7] as const, speed: [0.3, 1] as const, size: [0.03, 0.05] as const, headMul: 1.6 },
  /** Air drag on droplets (1/s): a fast spurt bursts out, then slows and falls, instead of flying on as long laser-straight streaks. */
  dropDrag: 5,
  exit: { pistol: 15, rifle: 22, smg: 18, shotgun: 6, sniper: 40, melee: 8, launcher: 30, coneDeg: 35, wallRays: 24, speed: [2, 6] as const, size: [0.015, 0.04] as const, color: "#5C0707" },
  /** A plume of mist thrown out across the view: the cloud blooms past the hit marker's gap (pillar 4). */
  plume: { count: [4, 6] as const, speed: [1.6, 3.2] as const, size: [0.16, 0.3] as const, grow: 1.9, lifeMs: 520, alpha: 0.7 },
  /** Droplets are overstated with range so a spray still reads as droplets at 10 m and beyond (x, capped). */
  dropRange: { perM: 1 / 7, max: 2.4 },
  /** The share of the street fog blood takes (1 = like everything else). */
  fog: 0.45,
  anchorMs: 80,
  /** How hard the emissive lift pushes (see tinted()). 7 lifted the core to bloom-pink (C2 review): 4 keeps it crimson. */
  liftGain: 4,
  /** A head hit's main mist sits this far behind the hit, along the round, so the head's silhouette stays in front. */
  headBackM: 0.1,
  splat: { rayM: 3, size: [0.3, 0.8] as const, wetInMs: 120, farFromM: 7, farMulMax: 1.6, phoneMul: 1.4 },
  wound: { size: 0.11, runLen: 0.16, runMs: 2000, perBody: 8 },
  caps: { phone: { mist: 48, drops: 260, wounds: 48 }, desktop: { mist: 128, drops: 900, wounds: 160 } },
};

/** Exit droplets for one round (or pellet) of a weapon class. */
export function exitCount(weaponCls: string): number {
  const E = GORE.exit as unknown as Record<string, number>;
  return E[weaponCls] ?? (weaponCls === "revolver" ? GORE.exit.pistol : GORE.exit.rifle);
}

/** The puff's final size: by damage within the spec range, x1.4 beyond 15 m so it still reads far off. */
export function puffSize(damage: number, maxHp: number, distance: number, r = 0.5): number {
  const P = GORE.puff;
  const k = Math.min(1, Math.max(0, (damage / Math.max(1, maxHp)) * 3 * 0.6 + r * 0.4));
  const s = P.size[0] + (P.size[1] - P.size[0]) * k;
  return distance > P.farM ? s * P.farMul : s;
}

export interface Gore {
  hit(h: FleshHit): void;
  update(dt: number, camera: THREE.Camera): void;
  clear(): void;
  /** Live counts, for the soak test and the budget sidecar. */
  readonly counts: { mist: number; drops: number; wounds: number; puffM: number; anchors: number };
  readonly caps: { mist: number; drops: number; wounds: number };
  /** The last hit's wall splats: where each landed and its size (m). */
  readonly splats: readonly { point: THREE.Vector3; size: number }[];
  /** C9: a pool under a body at rest (none under reduced violence), growing to `R` m. */
  pool(at: THREE.Vector3, R: number, seed: number, owner?: object): void;
  hasPool(owner: object): boolean;
  /** C9: the wall-slump smear: a 0.4 x 1.2 m vertical run down the wall from `top` (the wall point at his back). */
  smear(top: THREE.Vector3, normal: THREE.Vector3): void;
  /** C9: a drip on the street under a badly hurt enemy (every 1.2 m he walks). */
  trail(at: THREE.Vector3): void;
  readonly pools: BloodPools;
  dispose(): void;
}

// ------------------------------------------------------------------ particle pools (struct of arrays)

class Pool {
  readonly mesh: THREE.Mesh;
  n = 0;
  /** The largest quad drawn last frame (m): the puff's on-screen size for the C2 check. */
  largest = 0;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly col: Float32Array; // r g b a0
  readonly size: Float32Array; // size0 size1 seed
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly grav: Float32Array;
  /** Anchor offset: the segment's position at spawn (x y z), and the anchor index (-1 none). */
  readonly anchorAt: Float32Array;
  readonly anchorIx: Int32Array;
  readonly land: Uint8Array;
  /** Exit droplets: seconds until they strike the wall behind (0 = none), and where (point, normal). */
  readonly wallT: Float32Array;
  readonly wallHit: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  private aPos: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;

  constructor(
    readonly cap: number,
    drop: boolean,
    noise: { value: THREE.Texture | null },
  ) {
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap * 3);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.anchorAt = new Float32Array(cap * 3);
    this.anchorIx = new Int32Array(cap).fill(-1);
    this.land = new Uint8Array(cap);
    this.wallT = new Float32Array(cap);
    this.wallHit = new Float32Array(cap * 6);
    const base = new THREE.PlaneGeometry(1, 1);
    if (drop) base.translate(0, -0.5, 0); // a streak trails behind its head
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    const mk = (k: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * k), k);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aPos = mk(3);
    this.aVel = mk(3);
    this.aCol = mk(4);
    this.aSize = mk(3);
    geo.setAttribute("aPos", this.aPos);
    geo.setAttribute("aVel", this.aVel);
    geo.setAttribute("aCol", this.aCol);
    geo.setAttribute("aSize", this.aSize);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uNoise: noise },
      vertexShader: GVERT,
      fragmentShader: GFRAG,
      defines: drop ? { DROP: "", GORE_FOG: GORE.fog.toFixed(2) } : { GORE_FOG: GORE.fog.toFixed(2) },
      fog: true,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.name = drop ? "gore:drops" : "gore:mist";
    // Out of the wet street's mirror (a blurred reflection can't show a droplet; it would cost a draw call), and
    // not drawn at all while empty.
    this.mesh.layers.set(LAYER_NO_REFLECT);
    this.mesh.visible = false;
  }

  /** Takes a slot (the oldest goes when full: a new hit always shows). */
  take(): number {
    if (this.n < this.cap) return this.n++;
    let oldest = 0;
    let best = -1;
    for (let i = 0; i < this.n; i++) {
      const k = this.age[i]! / this.life[i]!;
      if (k > best) {
        best = k;
        oldest = i;
      }
    }
    return oldest;
  }

  kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    const mv = (a: Float32Array | Int32Array | Uint8Array, k: number) => {
      for (let c = 0; c < k; c++) a[i * k + c] = a[j * k + c]!;
    };
    mv(this.pos, 3);
    mv(this.vel, 3);
    mv(this.col, 4);
    mv(this.size, 3);
    mv(this.age, 1);
    mv(this.life, 1);
    mv(this.grav, 1);
    mv(this.anchorAt, 3);
    mv(this.anchorIx, 1);
    mv(this.land, 1);
    mv(this.wallT, 1);
    mv(this.wallHit, 6);
    this.anchorIx[j] = -1;
  }

  write(mist: boolean): void {
    this.largest = 0;
    const P = this.aPos.array as Float32Array;
    const V = this.aVel.array as Float32Array;
    const C = this.aCol.array as Float32Array;
    const S = this.aSize.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const t = Math.min(1, this.age[i]! / this.life[i]!);
      for (let c = 0; c < 3; c++) {
        P[i * 3 + c] = this.pos[i * 3 + c]!;
        V[i * 3 + c] = this.vel[i * 3 + c]!;
        C[i * 4 + c] = this.col[i * 4 + c]!;
      }
      let a = this.col[i * 4 + 3]!;
      let s = this.size[i * 3]!;
      if (mist) {
        // Expands over 200 ms (ease out), fades over the rest.
        const age = this.age[i]!;
        const g = Math.min(1, age / (GORE.puff.growMs / 1000));
        s = this.size[i * 3]! + (this.size[i * 3 + 1]! - this.size[i * 3]!) * (1 - (1 - g) * (1 - g));
        a *= 1 - t * t;
      } else a *= t > 0.8 ? (1 - t) / 0.2 : 1;
      C[i * 4 + 3] = a;
      S[i * 3] = s;
      if (a > 0.3) this.largest = Math.max(this.largest, s);
      S[i * 3 + 1] = mist ? 0 : 0.035;
      S[i * 3 + 2] = this.size[i * 3 + 2]!;
    }
    this.geo.instanceCount = this.n;
    this.mesh.visible = this.n > 0;
    for (const at of [this.aPos, this.aVel, this.aCol, this.aSize]) {
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.n * at.itemSize);
      at.needsUpdate = true;
    }
  }
}

const GVERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aVel;
attribute vec4 aCol;
attribute vec3 aSize;
varying vec2 vUv;
varying vec4 vCol;
varying float vSeed;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vCol = aCol;
  vSeed = aSize.z;
  vec3 toCam = normalize( cameraPosition - aPos );
  vec3 wp;
  #ifdef DROP
    // A droplet is a streak along its velocity, longer the faster it flies.
    float sp = length( aVel );
    vec3 axis = sp > 0.05 ? aVel / sp : vec3( 0.0, -1.0, 0.0 );
    vec3 side = cross( axis, toCam );
    if ( dot( side, side ) < 1e-4 ) side = cross( vec3( 0.0, 1.0, 0.0 ), toCam );
    side = normalize( side );
    float len = aSize.x * ( 1.0 + sp * aSize.y * 40.0 );
    wp = aPos + side * position.x * aSize.x + axis * position.y * len;
  #else
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    vec3 up = cross( toCam, right );
    float a = aSize.z * 6.2832;
    vec2 q = vec2( cos( a ) * position.x - sin( a ) * position.y, sin( a ) * position.x + cos( a ) * position.y );
    wp = aPos + ( right * q.x + up * q.y ) * aSize.x;
  #endif
  vec4 mvPosition = viewMatrix * vec4( wp, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const GFRAG = /* glsl */ `
uniform sampler2D uNoise;
varying vec2 vUv;
varying vec4 vCol;
varying float vSeed;
#include <fog_pars_fragment>
void main() {
  vec2 p = vUv - 0.5;
  vec3 col = vCol.rgb;
  float a;
  #ifdef DROP
    // A capsule with a hard, wet edge and a glint near its head (a fake pow(N.H, 40) highlight).
    float r = length( vec2( p.x * 2.0, max( 0.0, abs( p.y ) - 0.25 ) * 2.0 ) );
    a = smoothstep( 0.55, 0.35, r );
    vec2 hp = vec2( p.x + 0.12, p.y - 0.28 );
    float glint = pow( max( 0.0, 1.0 - length( hp * vec2( 3.0, 5.0 ) ) ), 4.0 );
    // A wet crimson highlight, not a peach one: a pale glint read as beige specks at 10 m (C2 review).
    col = col * ( 1.0 - 0.35 * smoothstep( 0.2, 0.5, r ) ) + vec3( 0.75, 0.1, 0.08 ) * glint * 0.7;
  #else
    // Mist: a soft blob torn by noise, denser at the core.
    float r = length( p );
    float n = texture2D( uNoise, p * 0.6 + vSeed * 3.1 ).g;
    float n2 = texture2D( uNoise, p * 1.7 - vSeed * 1.3 ).b;
    float body = smoothstep( 0.5, 0.08, r );
    a = body * clamp( 0.45 + ( n - 0.45 ) * 1.1 + ( n2 - 0.5 ) * 0.5 + ( 0.5 - r ) * 0.8, 0.0, 1.0 );
    col *= 0.7 + 0.35 * smoothstep( 0.45, 0.0, r );
  #endif
  // Blood is the readout that matters most (pillar 4): push its red past the grade's midtone drain, and let the
  // street fog take only part of it, so a hit at 10 m in rain still reads crimson rather than haze.
  float l = dot( col, vec3( 0.299, 0.587, 0.114 ) );
  col = max( vec3( 0.0 ), mix( vec3( l ), col, 1.6 ) );
  gl_FragColor = vec4( col, a * vCol.a );
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * GORE_FOG );
  #endif
}
`;

// ------------------------------------------------------------------ the system

export function createGore(o: GoreDeps): Gore {
  const C = o.quality === "phone" ? GORE.caps.phone : GORE.caps.desktop;
  const mist = new Pool(C.mist, false, o.noise);
  const drops = new Pool(C.drops, true, o.noise);
  o.scene.add(mist.mesh, drops.mesh);
  const rand = Math.random;
  // Segments effects ride for their first 80 ms, refcounted by the particles on them (no per-frame pool scan).
  const anchors: (THREE.Object3D | null)[] = [];
  const refs: number[] = [];
  const anchorOf = (a?: THREE.Object3D): number => {
    if (!a) return -1;
    let i = anchors.indexOf(a);
    if (i < 0) {
      i = anchors.indexOf(null);
      if (i < 0) i = anchors.push(a) - 1;
      else anchors[i] = a;
      refs[i] = 0;
    }
    return i;
  };
  /** Ties slot `i` of `pool` to anchor `ix` (or none), releasing whatever it rode before. */
  const ride = (pool: Pool, i: number, ix: number) => {
    const was = pool.anchorIx[i]!;
    if (was >= 0 && --refs[was]! <= 0) anchors[was] = null;
    pool.anchorIx[i] = ix;
    if (ix < 0) return;
    refs[ix]!++;
    const a = anchors[ix]!.position;
    pool.anchorAt[i * 3] = a.x;
    pool.anchorAt[i * 3 + 1] = a.y;
    pool.anchorAt[i * 3 + 2] = a.z;
  };
  /** Kills a slot, letting go of its anchor first. */
  const kill = (pool: Pool, i: number) => {
    ride(pool, i, -1);
    pool.kill(i);
  };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const backV = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const lit = new THREE.Color();
  const PUFF = new THREE.Color(GORE.puff.color);
  const EXIT = new THREE.Color(GORE.exit.color);
  const INK = new THREE.Color(0.012, 0.012, 0.016);
  // Fresh blood on a night wall: a deep #5C0707-ish red with a small emissive lift (the decal shader glows by
  // tint.r - 1), so it reads wet and red in the grade. The old 2.3 lift blew out to salmon pink past the tone map.
  const SPLAT_TINT = new THREE.Color(1.55, 0.55, 0.5);
  // Phone: G and B held low so the heavy phone fog lifts it toward crimson, not coral (C2 review).
  const SPLAT_TINT_PHONE = new THREE.Color(2.3, 0.34, 0.3);
  /** The last hit's wall splats (world point, size in m), for the C2 probe. */
  const splats: { point: THREE.Vector3; size: number }[] = [];

  /** A colour lit by the street, plus a lift that ignores local light so it reads in the noir grade. */
  // The grade drains saturation from dark midtones (render/post.ts), so blood has to be bright enough (luma
  // above about 0.15) to keep its red: the lift is applied as emissive, x GORE.liftGain over the base.
  const tinted = (p: THREE.Vector3, base: THREE.Color, lift: number, out: THREE.Color) => {
    o.light(p, lit);
    const k = GORE.liftGain * lift;
    return out.setRGB(base.r * (0.3 + lit.r * 0.6 + k), base.g * (0.3 + lit.g * 0.6 + k), base.b * (0.3 + lit.b * 0.6 + k));
  };

  const cone = (dir: THREE.Vector3, deg: number, out: THREE.Vector3) => {
    const s = Math.tan((deg * Math.PI) / 360);
    out.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    out.addScaledVector(dir, -out.dot(dir)).multiplyScalar(s * Math.sqrt(rand()));
    return out.add(dir).normalize();
  };

  /** `dir` turned `deg` about the vertical (sideways off the round), with a little lift. */
  const offAxis = (dir: THREE.Vector3, deg: number, out: THREE.Vector3) => {
    const a = (deg * Math.PI) / 180;
    out.set(dir.x * Math.cos(a) + dir.z * Math.sin(a), dir.y + (rand() - 0.3) * 0.25, -dir.x * Math.sin(a) + dir.z * Math.cos(a));
    return out.normalize();
  };

  const puff = (at: THREE.Vector3, size: number, color: THREE.Color, alpha: number, life: number, ix: number, vel?: THREE.Vector3, grow = 1 / 0.7) => {
    const i = mist.take();
    mist.pos.set([at.x, at.y, at.z], i * 3);
    if (vel) mist.vel.set([vel.x, vel.y, vel.z], i * 3);
    else mist.vel.fill(0, i * 3, i * 3 + 3);
    mist.col.set([color.r, color.g, color.b, alpha], i * 4);
    mist.size.set([size / grow, size, rand()], i * 3);
    mist.age[i] = 0;
    mist.life[i] = life;
    mist.grav[i] = 0;
    mist.land[i] = 0;
    ride(mist, i, ix);
  };

  const drop = (at: THREE.Vector3, vel: THREE.Vector3, size: number, color: THREE.Color, ix: number, land: number): number => {
    const i = drops.take();
    drops.pos.set([at.x, at.y, at.z], i * 3);
    drops.vel.set([vel.x, vel.y, vel.z], i * 3);
    drops.col.set([color.r, color.g, color.b, 0.95], i * 4);
    drops.size.set([size, size, rand()], i * 3);
    drops.age[i] = 0;
    drops.life[i] = 1.4 + rand() * 0.6;
    drops.grav[i] = 1;
    drops.land[i] = land;
    drops.wallT[i] = 0;
    ride(drops, i, ix);
    return i;
  };

  // ---- wounds: quads that live on a segment, in its local frame
  const woundMat = new THREE.MeshStandardMaterial({
    map: o.atlas,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    roughness: 0.15,
    metalness: 0,
    emissive: new THREE.Color(0.09, 0.004, 0.004),
  });
  woundMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aCell;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * 0.25 + aCell;\n#endif");
  };
  woundMat.customProgramCacheKey = () => "cathode-wound";
  const woundGeo = new THREE.PlaneGeometry(1, 1);
  const woundCell = new THREE.InstancedBufferAttribute(new Float32Array(C.wounds * 2), 2);
  woundGeo.setAttribute("aCell", woundCell);
  const woundMesh = new THREE.InstancedMesh(woundGeo, woundMat, C.wounds);
  woundMesh.count = 0;
  woundMesh.frustumCulled = false;
  woundMesh.renderOrder = 2;
  woundMesh.name = "gore:wounds";
  woundMesh.layers.set(LAYER_NO_REFLECT);
  woundMesh.visible = false;
  o.scene.add(woundMesh);
  interface Wound {
    seg: THREE.Object3D;
    root: THREE.Object3D | undefined;
    owner: object | undefined;
    /** In the segment's frame: where, which way out, which way is down the surface. */
    local: THREE.Matrix4;
    run: boolean;
    age: number;
    born: number;
  }
  const wounds: Wound[] = [];
  let born = 0;
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const m4 = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  const nrm = new THREE.Vector3();
  const downL = new THREE.Vector3();
  const xAx = new THREE.Vector3();
  const yAx = new THREE.Vector3();

  const addWound = (h: FleshHit) => {
    const seg = h.anchor;
    if (!seg) return;
    seg.updateMatrixWorld(true);
    // The round's line through the segment's real surface (its hit capsule is a little fatter than the armour).
    raycaster.set(tmp.copy(h.point).addScaledVector(h.dir, -0.35), h.dir);
    raycaster.far = 0.8;
    hits.length = 0;
    const meshes = seg.children.filter((c) => (c as THREE.Mesh).isMesh && c.visible && !c.name.startsWith("cap"));
    raycaster.intersectObjects(meshes, false, hits);
    const hit = hits[0];
    if (!hit || !hit.face) return;
    inv.copy(seg.matrixWorld).invert();
    const pL = hit.point.clone().applyMatrix4(inv);
    nrm.copy(hit.face.normal); // already in the mesh's frame, which is the segment's (merged at identity)
    // Two quads: the hole, square to the surface, and the run, hanging below it along the surface.
    for (const run of [false, true]) {
      if (run && rand() < 0.25) continue;
      // Per-body cap: the oldest wound on this body goes.
      if (h.owner) {
        let mine = 0;
        let first = -1;
        for (let w = 0; w < wounds.length; w++)
          if (wounds[w]!.owner === h.owner) {
            if (first < 0) first = w;
            mine++;
          }
        if (mine >= GORE.wound.perBody) wounds.splice(first, 1);
      }
      if (wounds.length >= C.wounds) wounds.shift();
      // "Down" on the surface: world down into the segment frame, flattened onto the face.
      downL.set(0, -1, 0).transformDirection(inv);
      downL.addScaledVector(nrm, -downL.dot(nrm));
      if (downL.lengthSq() < 1e-4) downL.set(0, -1, 0).addScaledVector(nrm, -nrm.y);
      downL.normalize();
      yAx.copy(downL).negate(); // the quad's +Y points up the surface (canvas top)
      xAx.crossVectors(yAx, nrm).normalize();
      m4.makeBasis(xAx, yAx, nrm);
      q.setFromRotationMatrix(m4);
      if (!run) q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, rand() * Math.PI * 2));
      const W = GORE.wound;
      const size = run ? W.runLen : W.size * (0.8 + rand() * 0.4);
      const at = pL.clone().addScaledVector(nrm, 0.002);
      if (run) at.addScaledVector(downL, W.runLen * 0.5 - 0.01);
      const local = new THREE.Matrix4().compose(at, q, new THREE.Vector3(run ? size * 0.6 : size, size, 1));
      wounds.push({ seg, root: h.root, owner: h.owner, local, run, age: 0, born: born++ });
    }
  };

  const hit = (h: FleshHit) => {
    const d = h.dir;
    // Its own scratch: tmp is reused for jitter below (sharing it bent every puff after the first off at random).
    const back = backV.copy(d).negate();
    const ix = anchorOf(h.anchor);
    // A phone shows a guard at 10 m about 20 points tall: the puff is overstated there so it still reads (pillar 4).
    const sz = puffSize(h.damage, h.maxHp, h.distance, rand()) * (o.quality === "phone" ? GORE.puff.phoneMul : 1) * (h.head ? GORE.puff.headMul : 1) * (h.lethal ? (h.head ? GORE.puff.headKillMul : GORE.puff.killMul) : 1);
    if (o.reduced) {
      // Reduced violence: the puff is dark ink; no spray, splats or wounds.
      puff(h.point.clone().addScaledVector(back, 0.05), sz * 0.8, INK, 0.8, 0.45, ix);
      return;
    }
    const P = GORE.puff;
    // 1. The entry puff, facing the player, lifted out of the dark.
    const nPuff = P.count[0] + Math.floor(rand() * (P.count[1] - P.count[0] + 1));
    for (let k = 0; k < nPuff; k++) {
      // On a head hit the big cloud blows out behind the head (the depth test lets the head's outline cut it),
      // and only a small, thin entry puff sits in front: the flinch stays visible inside the burst (C2 review).
      const behind = h.head && k === 0;
      const at = h.point
        .clone()
        .addScaledVector(back, behind ? -GORE.headBackM : 0.06 + k * 0.04)
        .add(tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.08));
      const c = tinted(at, PUFF, P.lift, new THREE.Color());
      const size = sz * (k === 0 ? 1 : 0.6 + rand() * 0.3) * (h.head && !behind ? 0.6 : 1);
      // The cloud behind a head hangs on longer (x1.6): it is the headshot's read once the flinch has passed.
      puff(at, size, c, h.head && !behind ? P.alpha * 0.6 : P.alpha, ((P.growMs + P.fadeMs) / 1000) * (behind ? 1.6 : 1), ix);
    }
    // 1b. The plume: mist thrown out across the view (up and to the sides, a little along the round), so the
    // cloud blooms well past the marker's gap and reads as a burst, not a smudge behind the crosshair.
    const PL = GORE.plume;
    const nPl = PL.count[0] + Math.floor(rand() * (PL.count[1] - PL.count[0] + 1)) + (h.lethal ? 3 : 0);
    const side = tmp2.crossVectors(d, UP);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const range = sz / puffSize(h.damage, h.maxHp, h.distance, 0.5);
    for (let k = 0; k < nPl; k++) {
      const ang = ((k + rand() * 0.6) / nPl) * Math.PI * 2;
      // Screen-plane directions, biased upward (a hit throws matter up and out), plus a push along the round.
      const pv = new THREE.Vector3()
        .addScaledVector(side, Math.cos(ang))
        .addScaledVector(UP, Math.sin(ang) * 0.8 + 0.35)
        .addScaledVector(d, 0.5)
        .normalize()
        .multiplyScalar(PL.speed[0] + rand() * (PL.speed[1] - PL.speed[0]));
      const at = h.point.clone().addScaledVector(back, 0.03);
      // Darker than the puff's lifted core: a crimson mass around a bright centre, not a pink glow.
      const c = tinted(at, PUFF, P.lift, new THREE.Color()).multiplyScalar(0.45 + rand() * 0.2);
      const s0 = (PL.size[0] + rand() * (PL.size[1] - PL.size[0])) * range * (h.distance > P.farM ? P.farMul : 1);
      puff(at, s0 * PL.grow, c, PL.alpha, (PL.lifeMs * (0.8 + rand() * 0.4)) / 1000, ix, pv, PL.grow);
    }
    // Droplets are overstated with range, so a spray still reads as droplets rather than noise at 10 m.
    const dScale = Math.min(GORE.dropRange.max, 1 + h.distance * GORE.dropRange.perM);
    // 2. The entry spurt, back toward the camera: what she sees from the front.
    const S = GORE.spurt;
    const nSp = S.count[0] + Math.floor(rand() * (S.count[1] - S.count[0] + 1));
    const red = tinted(h.point, EXIT, P.lift, new THREE.Color());
    // The spurt flies at the camera through the dark: arterial red at the puff's lifted level (the exit spray's
    // #5C0707 vanished against the dark suit and street at 40 ms), so the streaks read past the marker.
    const spurtRed = tinted(h.point, PUFF, P.lift, new THREE.Color()).multiplyScalar(S.lift);
    const v = new THREE.Vector3();
    const backDir = d.clone().negate();
    for (let k = 0; k < nSp; k++) {
      const ang = ((k + rand() * 0.7) / nSp) * Math.PI * 2;
      v.set(0, 0, 0)
        .addScaledVector(side, Math.cos(ang))
        .addScaledVector(UP, Math.sin(ang) * 0.8 + 0.3)
        .add(cone(backDir, S.coneDeg, tmp3).multiplyScalar(S.back))
        .normalize()
        .multiplyScalar(S.speed[0] + rand() * (S.speed[1] - S.speed[0]));
      drop(h.point, v, (0.012 + rand() * 0.014) * dScale, spurtRed, ix, 1);
    }
    // 2b. The ooze: heavy drops that leave the hole slowly, so the wound still reads red after the spurt has gone.
    const O = GORE.ooze;
    // A head hit's cloud sits behind the head (its outline cuts it), so at 160 ms the read is the wound itself:
    // more, heavier drops (x1.6) keep the hole red after the spurt has gone (1440x900 measured 9.8% red at x1).
    const oMul = h.head ? O.headMul : 1;
    const nOo = Math.round((O.count[0] + Math.floor(rand() * (O.count[1] - O.count[0] + 1))) * oMul);
    for (let k = 0; k < nOo; k++) {
      cone(backDir, 80, v).multiplyScalar(O.speed[0] + rand() * (O.speed[1] - O.speed[0]));
      drop(h.point, v, (O.size[0] + rand() * (O.size[1] - O.size[0])) * dScale * (h.head ? 1.2 : 1), spurtRed, ix, 2);
    }
    // 3. The exit spray along the round, with gravity; a decal where each lands.
    const E = GORE.exit;
    const exitAt = h.point.clone().addScaledVector(d, 0.22);
    const nEx = Math.round(exitCount(h.weaponCls) * (h.lethal ? 1.5 : 1));
    let k2 = 0;
    for (let k = 0; k < nEx; k++) {
      const speed = E.speed[0] + rand() * (E.speed[1] - E.speed[0]);
      cone(d, E.coneDeg, v);
      // Where it will strike the wall behind, if there is one close: it leaves a fleck there (most of the
      // spray's pattern on the wall comes from these).
      const wall = k2 < E.wallRays ? o.raycast(exitAt, v, GORE.splat.rayM) : null;
      const i = drop(exitAt, v.multiplyScalar(speed), (E.size[0] + rand() * (E.size[1] - E.size[0])) * dScale, red, ix, rand() < 0.4 ? 2 : 1);
      k2++;
      if (wall) {
        drops.wallT[i] = wall.point.distanceTo(exitAt) / speed;
        drops.wallHit.set([wall.point.x, wall.point.y, wall.point.z, wall.normal.x, wall.normal.y, wall.normal.z], i * 6);
      }
    }
    // 4. The wall behind: a splat, sized by damage, that spreads wet over 120 ms.
    const W = GORE.splat;
    // The main splat lands square behind him, where his body hides most of it, so two smaller ones go out
    // along the spray's cone and show past his silhouette.
    const k = Math.min(1, (h.damage / Math.max(1, h.maxHp)) * 2.5);
    splats.length = 0;
    for (let j = 0; j < 4; j++) {
      // The satellites go out 22 to 38 degrees off the round, either side (the fourth on a random side, higher),
      // clear of his silhouette.
      const sideSign = j === 1 ? 1 : j === 2 ? -1 : rand() < 0.5 ? 1 : -1;
      const ray = j === 0 ? d : offAxis(d, (22 + rand() * 16) * sideSign, new THREE.Vector3());
      if (j === 3) ray.y += 0.25;
      ray.normalize();
      const wall = o.raycast(exitAt, ray, W.rayM);
      if (!wall) continue;
      // Sized by damage, then held to a floor in view: past about 7 m a splat grows with the distance so its
      // streaks stay a readable size on screen (pillar 4), up to 1.6x.
      const view = Math.min(W.farMulMax, Math.max(1, (h.distance + W.rayM * 0.5) / W.farFromM));
      const size = (W.size[0] + (W.size[1] - W.size[0]) * k) * (j === 0 ? 1 : 0.8 + rand() * 0.25) * view;
      // A phone's fog and smaller screen wash a dark splat out: bigger and brighter there.
      const sz = o.quality === "phone" ? size * W.phoneMul : size;
      o.decal(wall.point, wall.normal, sz, DECAL.blood[3 + Math.floor(rand() * 3)]!, o.quality === "phone" ? SPLAT_TINT_PHONE : SPLAT_TINT, W.wetInMs, ray);
      splats.push({ point: wall.point.clone(), size: sz });
    }
    // 5. The wound, on the body.
    addWound(h);
  };

  const tq = new THREE.Quaternion();
  const upW = new THREE.Vector3();
  const WHITE = new THREE.Color(1, 1, 1);
  const POOLS = [mist, drops];
  const tp = new THREE.Vector3();
  const ts = new THREE.Vector3();
  const update = (dt: number) => {
    // Anchored effects ride their segment for the first 80 ms.
    const anchorS = GORE.anchorMs / 1000;
    for (const pool of POOLS) {
      for (let i = pool.n - 1; i >= 0; i--) {
        const age = (pool.age[i]! += dt);
        if (age >= pool.life[i]!) {
          kill(pool, i);
          continue;
        }
        const ax = pool.anchorIx[i]!;
        if (ax >= 0) {
          const a = anchors[ax];
          if (a && age < anchorS) {
            const p = a.position;
            pool.pos[i * 3]! += p.x - pool.anchorAt[i * 3]!;
            pool.pos[i * 3 + 1]! += p.y - pool.anchorAt[i * 3 + 1]!;
            pool.pos[i * 3 + 2]! += p.z - pool.anchorAt[i * 3 + 2]!;
            pool.anchorAt[i * 3] = p.x;
            pool.anchorAt[i * 3 + 1] = p.y;
            pool.anchorAt[i * 3 + 2] = p.z;
          } else ride(pool, i, -1);
        }
        if (pool === drops && pool.wallT[i]! > 0 && age >= pool.wallT[i]!) {
          // Struck the wall: a fleck, sized by the drop, then gone.
          const w = pool.wallHit;
          o.decal(tp.set(w[i * 6]!, w[i * 6 + 1]!, w[i * 6 + 2]!), ts.set(w[i * 6 + 3]!, w[i * 6 + 4]!, w[i * 6 + 5]!), 0.05 + pool.size[i * 3]! * 3 + rand() * 0.06, DECAL.blood[3 + Math.floor(rand() * 3)]!, SPLAT_TINT);
          kill(pool, i);
          continue;
        }
        if (pool.grav[i]) {
          const dk = Math.max(0, 1 - GORE.dropDrag * dt);
          pool.vel[i * 3]! *= dk;
          pool.vel[i * 3 + 1]! = pool.vel[i * 3 + 1]! * dk - 9.8 * dt;
          pool.vel[i * 3 + 2]! *= dk;
          const x = (pool.pos[i * 3]! += pool.vel[i * 3]! * dt);
          const y = (pool.pos[i * 3 + 1]! += pool.vel[i * 3 + 1]! * dt);
          const z = (pool.pos[i * 3 + 2]! += pool.vel[i * 3 + 2]! * dt);
          const gy = Math.max(o.ground(x, z), -0.2);
          if (y < gy) {
            // Landed: a drop decal (the bigger ones), then it's gone.
            if (pool.land[i] === 2) o.decal(tp.set(x, gy, z), ts.set(0, 1, 0), 0.06 + rand() * 0.1, DECAL.blood[Math.floor(rand() * 3)]!, WHITE);
            kill(pool, i);
            continue;
          }
        } else {
          // Mist drifts and slows (a plume is thrown hard, then hangs).
          const k = Math.max(0, 1 - dt * 5);
          for (let c = 0; c < 3; c++) {
            pool.pos[i * 3 + c]! += pool.vel[i * 3 + c]! * dt;
            pool.vel[i * 3 + c]! *= k;
          }
        }
      }
    }
    mist.write(true);
    drops.write(false);
    // Wounds follow their segment; a body that left the scene takes its wounds with it.
    for (let i = wounds.length - 1; i >= 0; i--) if (wounds[i]!.root && !wounds[i]!.root!.parent) wounds.splice(i, 1);
    let n = 0;
    for (const w of wounds) {
      w.age += dt;
      w.seg.updateMatrixWorld();
      m4.multiplyMatrices(w.seg.matrixWorld, w.local);
      if (w.run) {
        // The run grows down from the wound over 2 s.
        const g = Math.min(1, 0.25 + (0.75 * w.age * 1000) / GORE.wound.runMs);
        m4.decompose(tp, tq, ts);
        const full = ts.y;
        ts.y = full * g;
        // Keep its top pinned at the wound.
        tp.addScaledVector(upW.set(0, 1, 0).applyQuaternion(tq), (full - ts.y) * 0.5);
        m4.compose(tp, tq, ts);
      }
      woundMesh.setMatrixAt(n, m4);
      const [u, vv] = decalCell(w.run ? DECAL.run[0] : DECAL.wound[0]);
      woundCell.setXY(n, u, vv);
      n++;
    }
    woundMesh.count = n;
    woundMesh.visible = n > 0;
    woundMesh.instanceMatrix.needsUpdate = true;
    woundCell.needsUpdate = true;
  };

  // ---- C9: pools, smears and trails (none under reduced violence: S4.5 drops pools and splats)
  const pools = new BloodPools(o.scene, o.quality, o.noise, o.mirror);
  const down = new THREE.Vector3(0, -1, 0);
  return {
    hit,
    update(dt) {
      update(dt);
      pools.update(dt);
    },
    pool(at, R, seed, owner) {
      if (o.reduced) return;
      pools.add(tp.set(at.x, o.ground(at.x, at.z) + 0.014, at.z), R, seed, owner ?? null);
    },
    hasPool(owner) {
      return pools.has(owner);
    },
    smear(top, normal) {
      if (o.reduced) return;
      // Three overlapping runs from his shoulders to the floor, streaked along the wall's down.
      const gy = o.ground(top.x, top.z);
      const h = Math.max(0.5, Math.min(1.3, top.y - gy));
      for (let i = 0; i < 4; i++) {
        const y = top.y - (h * i) / 3.2;
        const at = tp.set(top.x, Math.max(gy + 0.18, y), top.z).addScaledVector(normal, 0.005);
        o.decal(at, normal, 0.36 + rand() * 0.1, DECAL.blood[3 + (i % 3)]!, SPLAT_TINT, GORE.splat.wetInMs + i * 140, down);
      }
      o.decal(tp.set(top.x, top.y + 0.04, top.z).addScaledVector(normal, 0.006), normal, 0.5, DECAL.blood[3]!, SPLAT_TINT, GORE.splat.wetInMs, down);
    },
    trail(at) {
      if (o.reduced) return;
      o.decal(tp.set(at.x + (rand() - 0.5) * 0.2, o.ground(at.x, at.z), at.z + (rand() - 0.5) * 0.2), ts.set(0, 1, 0), 0.08 + rand() * 0.1, DECAL.blood[Math.floor(rand() * 3)]!, WHITE);
    },
    pools,
    clear() {
      pools.clear();
      splats.length = 0;
      mist.n = drops.n = 0;
      mist.anchorIx.fill(-1);
      drops.anchorIx.fill(-1);
      refs.length = 0;
      mist.write(true);
      drops.write(false);
      wounds.length = 0;
      woundMesh.count = 0;
      woundMesh.visible = false;
      anchors.length = 0;
    },
    get counts() {
      return { mist: mist.n, drops: drops.n, wounds: wounds.length, puffM: mist.largest, anchors: anchors.filter(Boolean).length };
    },
    get splats() {
      return splats;
    },
    caps: { mist: C.mist, drops: C.drops, wounds: C.wounds },
    dispose() {
      pools.dispose();
      woundMat.dispose();
      for (const p of [mist, drops]) (p.mesh.material as THREE.Material).dispose();
    },
  };
}
