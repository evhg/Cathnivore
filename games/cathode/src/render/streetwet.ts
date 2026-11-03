// Plan item 57: the rain on the street's people. Drips run off each umbrella's rim and land as a small crown, and
// every footstep throws a splash. One instanced, additive draw on high and ultra (the phone keeps its budget for the
// firefight); the layout is a pure function of the people's poses and the clock, so it's tested without a GPU.
import * as THREE from "three";
import { LAYER_NO_REFLECT } from "./reflection";

/** Drip points round each umbrella (the canopy in crowd.ts umbrellaParts: radius 0.55, rim at 1.95, centred on x 0.08). */
export const RIM_DRIPS = 5;
const RIM_R = 0.53;
const RIM_Y = 1.95;
const RIM_X = 0.08;
/** A drip's landing crown and a footstep splash last this long (s). */
export const CROWN_S = 0.24;
const G = 4.9;

export interface WetPerson {
  x: number;
  z: number;
  /** Ground height under them. */
  y: number;
  yaw: number;
  /** World matrix of the body (the umbrella rides on it); null when hidden. */
  body: THREE.Matrix4 | null;
  umbrella: boolean;
  /** Gait phase (radians, a footfall every PI) when walking or running; null when standing or riding. */
  gait: number | null;
  seed: number;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const v = new THREE.Vector3();

/**
 * Fills `out` (x, y, z, w per particle) and returns how many were written. w < 1 is a falling streak (w is its fall
 * time, which stretches it); w >= 1 is a crown (w - 1 its age 0..1).
 */
export function wetLayout(people: readonly WetPerson[], t: number, out: Float32Array): number {
  let n = 0;
  const cap = out.length / 4;
  const put = (x: number, y: number, z: number, w: number) => {
    if (n >= cap) return;
    out[n * 4] = x;
    out[n * 4 + 1] = y;
    out[n * 4 + 2] = z;
    out[n * 4 + 3] = w;
    n++;
  };
  people.forEach((p, pi) => {
    if (!p.body) return;
    if (p.umbrella) {
      for (let k = 0; k < RIM_DRIPS; k++) {
        const h = hash(p.seed * 31 + k * 7.7 + pi);
        const a = (k / RIM_DRIPS) * Math.PI * 2 + h;
        v.set(RIM_X + Math.cos(a) * RIM_R, RIM_Y, Math.sin(a) * RIM_R).applyMatrix4(p.body);
        const drop = Math.max(0.2, v.y - p.y);
        const fall = Math.sqrt(drop / G);
        const period = fall + CROWN_S + 0.15 + h * 0.7;
        const tt = (((t + h * 13) % period) + period) % period;
        if (tt < fall) put(v.x, v.y - G * tt * tt, v.z, Math.min(0.99, tt));
        else if (tt < fall + CROWN_S) put(v.x, p.y, v.z, 1 + (tt - fall) / CROWN_S);
      }
    }
    if (p.gait !== null) {
      // A footfall at each half turn of the gait, left and right in turn, a hand's width either side of the line.
      const step = Math.floor(p.gait / Math.PI);
      const age = (p.gait / Math.PI - step) * 2.2;
      if (age < 1) {
        const side = step % 2 === 0 ? 0.1 : -0.1;
        // yaw 0 faces +x (crowd.ts): the right hand side is -z rotated by yaw.
        put(p.x + Math.sin(p.yaw) * side, p.y, p.z + Math.cos(p.yaw) * side, 1 + age);
      }
    }
  });
  return n;
}

export function addStreetWet(scene: THREE.Scene, max: number) {
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  const data = new Float32Array(Math.max(1, max) * 4);
  const attr = new THREE.InstancedBufferAttribute(data, 4);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aWet", attr);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aWet;
      varying vec2 vUv;
      varying float vKind;
      varying float vAge;
      varying float vA;
      void main() {
        vec3 p = aWet.xyz;
        vec3 eye = cameraPosition;
        vec3 toCam = eye - p;
        float dist = length( toCam );
        vec3 side = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
        vKind = step( 1.0, aWet.w );
        vAge = aWet.w - vKind;
        vec3 wp;
        if ( vKind < 0.5 ) {
          // A streak, stretched by its speed.
          float len = 0.05 + 9.8 * aWet.w * 0.03;
          wp = p + vec3( 0.0, ( position.y - 0.5 ) * len, 0.0 ) + side * position.x * ( 0.007 + dist * 0.0006 );
        } else {
          float s = 0.11;
          wp = p + side * position.x * s * 1.7 + vec3( 0.0, position.y * s, 0.0 );
        }
        vUv = uv;
        vA = 1.0 - smoothstep( 16.0, 24.0, dist );
        gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vKind;
      varying float vAge;
      varying float vA;
      void main() {
        vec3 col = vec3( 0.3, 0.33, 0.38 );
        float a;
        if ( vKind < 0.5 ) {
          a = ( 1.0 - abs( vUv.x - 0.5 ) * 2.0 ) * 0.8;
        } else {
          float k = vAge;
          vec2 p = vUv - vec2( 0.5, 0.0 );
          float ring = 1.0 - smoothstep( 0.0, 0.04, abs( length( p * vec2( 1.0, 3.5 ) ) - k * 0.42 ) );
          float drops = 0.0;
          for ( int i = 0; i < 4; i++ ) {
            float ang = ( float( i ) - 1.5 ) * 0.4;
            vec2 c = vec2( sin( ang ) * k * 0.42, ( 1.0 - ( 2.0 * k - 1.0 ) * ( 2.0 * k - 1.0 ) ) * 0.5 + 0.04 );
            drops += 1.0 - smoothstep( 0.01, 0.03, length( p - c ) );
          }
          a = ( ring * 0.7 + drops ) * ( 1.0 - k ) * 0.6;
        }
        gl_FragColor = vec4( col * a * vA, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_NO_REFLECT);
  mesh.renderOrder = 4;
  mesh.name = "streetwet";
  scene.add(mesh);
  return {
    mesh,
    update(people: readonly WetPerson[], t: number) {
      geo.instanceCount = wetLayout(people, t, data);
      attr.needsUpdate = true;
    },
  };
}
