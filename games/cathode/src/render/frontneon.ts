// Plan item 148: the title's noir key. A neon sign (plan item 258: "LUNA" with a crescent, in a pink tube border;
// it was a wordless blade that caged her head) hangs from the overhead wires in the street behind her, placed on
// screen clear of her figure by render/frontscene.ts, and its light is her key and rim: the pink lights in
// render/frontscene.ts follow `level`, so when the tube stutters, she does too. Unlit HDR tubes (they bloom and
// show in the wet street's mirror), one merged mesh for the tubes and one for the iron (both unlit), so it costs two draw calls.
// The rain round it is a third: a curtain of streaks falling through the sign's light, glinting pink where a drop
// lies between the lens and the tubes (forward scatter), so the rain reads lit from behind.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LAYER_NO_REFLECT } from "./reflection";

export interface FrontNeon {
  readonly group: THREE.Group;
  /** The tube's brightness now, 0..1 (1 lit, about 0.12 in a stutter's dark beats). */
  level(t: number, still: boolean): number;
  /** Writes `level` into the tubes' colour and the backlit rain (`dim` 0..1 scales the rain's glint). */
  update(t: number, still: boolean, camera: THREE.Camera, dim?: number): void;
  /** The backlit rain curtain round the sign. */
  readonly rain: THREE.Mesh;
  dispose(): void;
}

/** The tube colour (linear, HDR): hot pink, bright enough for the bloom to halo it. */
const TUBE = new THREE.Color(3.2, 0.2, 1.05);

/**
 * The stutter: lit, then once every 7.3 s a 0.62 s fault of dark and lit beats (a failing ballast), then lit again.
 * Deterministic in loop time so screenshots at t = 8 or 26 always hold it lit. Reduced motion never stutters.
 */
export function neonLevel(t: number, still: boolean): number {
  if (still) return 1;
  const u = (((t % 7.3) + 7.3) % 7.3) - 5.1;
  if (u < 0 || u > 0.62) return 1;
  const beat = Math.floor(u * 21);
  return [1, 0.12, 0.12, 1, 0.12, 0.6, 1, 0.12, 0.12, 0.12, 1, 0.3, 1, 1][beat % 14]!;
}

/** Plan item 258: the sign's face, metres (the border's outer box). */
export const NEON_W = 1.32;
export const NEON_H = 0.52;

export function buildFrontNeon(phone: boolean): FrontNeon {
  const group = new THREE.Group();
  group.name = "front-neon";
  const seg = phone ? 5 : 8;
  const r = 0.017;
  const tubes: THREE.BufferGeometry[] = [];
  const tube = (pts: Array<[number, number]>, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0.03)), closed, "catmullrom", 0.2);
    tubes.push(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 6), r, seg, closed));
  };
  // Plan item 258: the sign says something. "LUNA" in slanted capitals (a bar's name, read in one glance at any
  // size), a crescent before it, in a rounded border: 1.3 x 0.5 m, centred on the group's origin.
  const CAP = 0.26;
  const SLANT = 0.2;
  const line = (pts: Array<[number, number]>, ox: number, oy: number) => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const v = pts.map(([x, y]) => new THREE.Vector3(ox + (x + y * SLANT) * CAP, oy + y * CAP, 0.03));
    for (let i = 1; i < v.length; i++) path.add(new THREE.LineCurve3(v[i - 1]!, v[i]!));
    tubes.push(new THREE.TubeGeometry(path, (v.length - 1) * 4, r, seg, false));
  };
  // The letters in a cap-height box (x 0..0.62, y 0..1); U's bowl in short chords.
  const bowl = Array.from({ length: 9 }, (_, i): [number, number] => {
    const a = Math.PI + (Math.PI * i) / 8;
    return [0.31 + Math.cos(a) * 0.31, 0.31 + Math.sin(a) * 0.31];
  });
  const glyphs: Array<Array<Array<[number, number]>>> = [
    [[[0, 1], [0, 0], [0.58, 0]]],
    [[[0, 1], ...bowl, [0.62, 1]]],
    [[[0, 0], [0, 1], [0.62, 0], [0.62, 1]]],
    [[[0, 0], [0.31, 1], [0.62, 0]], [[0.13, 0.36], [0.49, 0.36]]],
  ];
  const adv = 0.86;
  const x0 = -0.31;
  glyphs.forEach((g, i) => g.forEach((stroke) => line(stroke, x0 + i * adv * CAP, -CAP / 2)));
  // The crescent, left of the word: two arcs meeting at the horns.
  const arc = (cx: number, cy: number, rad: number, a0: number, a1: number, n = 14): Array<[number, number]> =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    });
  tube([...arc(-0.48, 0, 0.13, Math.PI * 0.3, Math.PI * 1.7), ...arc(-0.42, 0, 0.1, Math.PI * 1.5, Math.PI * 0.5, 12)]);
  // The border: a rounded rectangle.
  const rr: Array<[number, number]> = [];
  const W2 = 0.65, H2 = 0.25, R = 0.08;
  for (const [cx, cy, a0] of [[W2 - R, H2 - R, 0], [-W2 + R, H2 - R, 0.5], [-W2 + R, -H2 + R, 1], [W2 - R, -H2 + R, 1.5]] as const)
    for (let i = 0; i <= 3; i++) {
      const a = Math.PI * (a0 + (0.5 * i) / 3);
      rr.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
  tube(rr, true);
  const tubeGeo = mergeGeometries(tubes)!;
  for (const g of tubes) g.dispose();
  const tubeMat = new THREE.MeshBasicMaterial({ color: TUBE.clone(), fog: false });
  const tubesMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubesMesh.name = "front-neon-tubes";
  group.add(tubesMesh);
  // The iron: a channel along the top and a stub at the foot, unlit near-black.
  const iron: THREE.BufferGeometry[] = [
    // A slim channel frame behind the border tube, not a plate (a lit plate read as a pink shield).
    new THREE.BoxGeometry(1.3, 0.025, 0.03).translate(0, 0.27, -0.01),
    new THREE.BoxGeometry(1.3, 0.025, 0.03).translate(0, -0.27, -0.01),
    // It hangs over the street from the overhead wires on two long rods.
    new THREE.CylinderGeometry(0.008, 0.008, 3, 5).translate(-0.5, 1.78, 0),
    new THREE.CylinderGeometry(0.008, 0.008, 3, 5).translate(0.5, 1.78, 0),
  ];
  const ironGeo = mergeGeometries(iron)!;
  for (const g of iron) g.dispose();
  const ironMat = new THREE.MeshBasicMaterial({ color: 0x0a090c });
  const ironMesh = new THREE.Mesh(ironGeo, ironMat);
  ironMesh.name = "front-neon-iron";
  group.add(ironMesh);
  const rain = buildBacklitRain(phone ? 380 : 640);
  group.add(rain.mesh);
  const now = new THREE.Color();
  return {
    group,
    rain: rain.mesh,
    level: neonLevel,
    update(t, still, camera, dim = 1) {
      const k = neonLevel(t, still);
      tubeMat.color.copy(now.copy(TUBE).multiplyScalar(k));
      group.updateMatrixWorld();
      rain.update(still ? 0 : t, camera, group, k * dim);
    },
    dispose() {
      group.removeFromParent();
      tubeGeo.dispose();
      ironGeo.dispose();
      tubeMat.dispose();
      ironMat.dispose();
      rain.dispose();
    },
  };
}

/** The rain's light: the tubes' pink, a little cooler, so a glinting streak reads as water, not another tube. */
const RAIN_LIT = new THREE.Color(1.0, 0.16, 0.5);

/**
 * Streaks falling through a 3.4 x 4 x 3 m box round the sign (its own frame: x across the blade, y up, z toward the
 * street it faces), each brightest near the tubes and where it lies between the lens and them. Additive, no depth
 * write, out of the street's mirror (as the street's own rain is).
 */
function buildBacklitRain(count: number) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  // A fixed seed so every screenshot holds the same streaks.
  let s = 148;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  base.dispose();
  const uniforms = {
    uTime: { value: 0 },
    uCamL: { value: new THREE.Vector3() },
    uCol: { value: new THREE.Color() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform vec3 uCamL;
      uniform vec3 uCol;
      varying vec2 vUv;
      varying vec3 vCol;
      const vec3 BOX = vec3( 3.4, 4.0, 3.0 );
      void main() {
        float speed = 8.5 * ( 0.85 + aSeed.w * 0.3 );
        vec3 p = ( aSeed.xyz - 0.5 ) * BOX;
        p.y = mod( aSeed.y * BOX.y - speed * uTime, BOX.y ) - BOX.y * 0.55;
        p.z += 0.4;
        vec3 axis = normalize( vec3( 0.05, -1.0, 0.02 ) );
        vec3 toCam = uCamL - p;
        float dist = length( toCam );
        vec3 side = normalize( cross( axis, toCam / dist ) );
        float len = 0.36 + aSeed.w * 0.26;
        float width = 0.0035 + dist * 0.0007;
        vec3 wp = p + axis * position.y * len + side * position.x * width;
        // Near the tubes (the sign sits at the frame's origin), and glinting toward the lens behind them.
        float d = length( p ) + 0.001;
        float reach = 1.0 / ( 1.0 + d * d * 1.6 );
        float fwd = max( dot( -toCam / dist, -p / d ), 0.0 );
        vec3 q = abs( p / ( BOX * 0.5 ) );
        float edge = ( 1.0 - smoothstep( 0.7, 1.0, q.x ) ) * ( 1.0 - smoothstep( 0.7, 1.0, q.y ) ) * ( 1.0 - smoothstep( 0.6, 1.0, q.z ) );
        vCol = uCol * edge * reach * ( 0.8 + 3.4 * pow( fwd, 5.0 ) ) * smoothstep( 0.4, 1.2, dist );
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4( wp, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float across = 1.0 - abs( vUv.x - 0.5 ) * 2.0;
        float along = smoothstep( 0.0, 0.5, vUv.y ) * smoothstep( 1.0, 0.45, vUv.y );
        gl_FragColor = vec4( vCol * across * along, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "front-neon-rain";
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.layers.set(LAYER_NO_REFLECT);
  const camW = new THREE.Vector3();
  return {
    mesh,
    update(t: number, camera: THREE.Camera, frame: THREE.Object3D, k: number) {
      uniforms.uTime.value = t;
      camera.getWorldPosition(camW);
      uniforms.uCamL.value.copy(frame.worldToLocal(camW));
      uniforms.uCol.value.copy(RAIN_LIT).multiplyScalar(k);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
