// The weather and the city beyond the street: a cloud-lid sky lit orange from below, a skyline of towers
// dissolving into fog (procedural windows, holographic edges, blinking aviation lights), the Hollowell
// billboard tower, GPU rain that follows the wind and catches the light, splashes, ledge drips, steam,
// volumetric light shafts and distant lightning. All particles are stateless shaders: a few draw calls,
// no per-frame CPU work beyond uniforms.

import * as THREE from "three";
import { FLOOD } from "./shading";
import { L, type ConeDef } from "./level";
import { LAYER_NO_REFLECT } from "./reflection";
import { billboardTexture, prng } from "./textures";

/** The ground height in GLSL (mirrors level.groundHeight for the street, quay and canal). */
export const GROUND_GLSL = /* glsl */ `
float cFloodT( float z ) {
  float a = clamp( ( ${FLOOD.zNear.toFixed(2)} - z ) / ${FLOOD.ramp.toFixed(2)}, 0.0, 1.0 );
  float b = clamp( ( z - ${FLOOD.zFar.toFixed(2)} ) / ${FLOOD.ramp.toFixed(2)}, 0.0, 1.0 );
  return min( a, b );
}
float cGround( vec2 p ) {
  float t = cFloodT( p.y );
  if ( p.x >= ${L.roadW.toFixed(2)} && p.x <= ${L.roadE.toFixed(2)} ) return max( -${FLOOD.depth.toFixed(2)} * t, ${FLOOD.water.toFixed(2)} );
  if ( p.x > ${L.roadE.toFixed(2)} && p.x <= ${L.quayEdge.toFixed(2)} ) return max( ${L.kerb.toFixed(2)} - ${(L.kerb + FLOOD.depth).toFixed(2)} * t, ${FLOOD.water.toFixed(2)} );
  if ( p.x > ${L.quayEdge.toFixed(2)} && p.x < ${L.canalE.toFixed(2)} ) return ${FLOOD.water.toFixed(2)};
  return ${L.kerb.toFixed(2)};
}
// Inside a building footprint (west row behind the facade, except the alleys; east row): no splashes.
float cIndoors( vec2 p ) {
  if ( p.x > ${L.canalE.toFixed(2)} ) return 1.0;
  if ( p.x < ${L.westFacade.toFixed(2)} ) {
    bool alley = ( p.y > ${L.alleys[0].z0.toFixed(1)} && p.y < ${L.alleys[0].z1.toFixed(1)} ) || ( p.y > ${L.alleys[1].z0.toFixed(1)} && p.y < ${L.alleys[1].z1.toFixed(1)} );
    return alley && p.x > -22.0 ? 0.0 : 1.0;
  }
  return ( p.y > ${L.zNorth.toFixed(1)} || p.y < ${L.zSouth.toFixed(1)} ) ? 1.0 : 0.0;
}
`;

/** Uniforms every particle shader reads for lighting: the volume, the key spotlight and lightning. */
export interface AtmoUniforms {
  uTime: { value: number };
  uCam: { value: THREE.Vector3 };
  uWind: { value: THREE.Vector2 };
  uVolume: { value: THREE.Data3DTexture | null };
  uVolMin: { value: THREE.Vector3 };
  uVolInvSize: { value: THREE.Vector3 };
  uKeyPos: { value: THREE.Vector3 };
  uKeyDir: { value: THREE.Vector3 };
  uKeyCos: { value: number };
  uKeyColor: { value: THREE.Color };
  uLightning: { value: number };
  uNoise: { value: THREE.Texture | null };
  uShelterMin: { value: THREE.Vector3 };
  uShelterMax: { value: THREE.Vector3 };
}

const LIGHT_GLSL = /* glsl */ `
uniform sampler3D uVolume;
uniform vec3 uVolMin;
uniform vec3 uVolInvSize;
uniform vec3 uKeyPos;
uniform vec3 uKeyDir;
uniform float uKeyCos;
uniform vec3 uKeyColor;
uniform float uLightning;
vec3 cLightAt( vec3 p ) {
  vec3 c = texture( uVolume, ( p - uVolMin ) * uVolInvSize ).rgb;
  vec3 d = p - uKeyPos;
  float dist = length( d );
  float cosA = dot( d / dist, uKeyDir );
  float spot = smoothstep( uKeyCos, uKeyCos + 0.06, cosA ) * 2200.0 / ( dist * dist + 40.0 );
  return c + uKeyColor * spot + vec3( 0.55, 0.6, 0.8 ) * uLightning * 2.5;
}
`;

export interface Atmosphere {
  group: THREE.Group;
  uniforms: AtmoUniforms;
  sky: THREE.Mesh;
  billboard: THREE.ShaderMaterial;
  update(camera: THREE.Camera, time: number): void;
}

export interface AtmoOptions {
  rain: number;
  splashes: number;
  drips: THREE.Vector3[];
  dripCount: number;
  vents: THREE.Vector3[];
  steamPer: number;
  cones: ConeDef[];
  skyline: number;
  fogColor: THREE.Color;
}

export function buildAtmosphere(o: AtmoOptions, uniforms: AtmoUniforms): Atmosphere {
  const group = new THREE.Group();
  group.name = "atmosphere";
  const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  const shared = (extra: Record<string, THREE.IUniform>) => ({ ...fogU(), ...uniforms, ...extra });

  // ---------------------------------------------------------------- sky
  const skyMat = new THREE.ShaderMaterial({
    uniforms: shared({ uHorizon: { value: o.fogColor.clone() } }),
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise;
      uniform float uTime;
      uniform float uLightning;
      uniform vec3 uHorizon;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        float h = d.y;
        vec2 cuv = d.xz / max( h + 0.08, 0.05 ) * 0.07 + uTime * vec2( 0.0025, 0.0012 );
        float cl = texture2D( uNoise, cuv ).r * 0.55 + texture2D( uNoise, cuv * 2.3 + 0.3 ).g * 0.3 + texture2D( uNoise, cuv * 6.1 ).b * 0.15;
        cl = smoothstep( 0.3, 0.85, cl );
        // Light pollution: the cloud lid glows sodium-magenta near the horizon, black overhead.
        vec3 glow = vec3( 0.05, 0.022, 0.03 );
        vec3 top = vec3( 0.0035, 0.0045, 0.008 );
        float horizon = 1.0 - smoothstep( -0.02, 0.5, h );
        vec3 col = mix( top, glow, horizon * horizon ) * mix( 0.45, 1.6, cl );
        // Lightning lights the clouds from inside.
        col += vec3( 0.55, 0.62, 0.9 ) * uLightning * ( 0.15 + cl * 1.6 ) * smoothstep( -0.05, 0.3, h );
        col = mix( uHorizon, col, smoothstep( -0.04, 0.12, h ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.name = "sky";
  group.add(sky);

  // ---------------------------------------------------------------- skyline
  {
    const rand = prng(808);
    const count = o.skyline;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: shared({}),
      vertexShader: /* glsl */ `
        varying vec3 vLocal;
        varying vec3 vNormalL;
        varying vec3 vScale;
        varying float vSeed;
        #include <fog_pars_vertex>
        void main() {
          vLocal = position;
          vNormalL = normal;
          vScale = vec3( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ), length( instanceMatrix[2].xyz ) );
          vSeed = fract( instanceMatrix[3].x * 0.0137 + instanceMatrix[3].z * 0.0071 );
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vLocal;
        varying vec3 vNormalL;
        varying vec3 vScale;
        varying float vSeed;
        #include <fog_pars_fragment>
        float h21( vec2 p ) { return fract( sin( dot( p, vec2( 41.3, 289.1 ) ) ) * 43758.5 ); }
        void main() {
          // Facade coordinates in metres.
          vec2 f = abs( vNormalL.x ) > 0.5 ? vec2( vLocal.z * vScale.z, vLocal.y * vScale.y ) : vec2( vLocal.x * vScale.x, vLocal.y * vScale.y );
          vec3 col = vec3( 0.006, 0.007, 0.009 );
          if ( abs( vNormalL.y ) < 0.5 ) {
            vec2 cell = floor( f / vec2( 2.6, 3.4 ) );
            vec2 inC = fract( f / vec2( 2.6, 3.4 ) );
            float win = step( 0.18, inC.x ) * step( inC.x, 0.82 ) * step( 0.25, inC.y ) * step( inC.y, 0.8 );
            float on = step( 0.78 - vSeed * 0.12, h21( cell + vSeed * 91.0 ) );
            vec3 wc = mix( vec3( 1.0, 0.62, 0.32 ), vec3( 0.55, 0.8, 1.0 ), step( 0.6, h21( cell * 1.7 ) ) );
            col += wc * win * on * 0.9;
            // Holographic edges on some towers.
            float edge = max( 1.0 - smoothstep( 0.0, 0.012, min( abs( vLocal.x - 0.5 ), abs( vLocal.x + 0.5 ) ) ), 1.0 - smoothstep( 0.0, 0.012, min( abs( vLocal.z - 0.5 ), abs( vLocal.z + 0.5 ) ) ) );
            vec3 ec = mix( vec3( 1.0, 0.15, 0.55 ), vec3( 0.1, 0.9, 1.0 ), step( 0.5, fract( vSeed * 7.0 ) ) );
            col += ec * edge * step( 0.62, vSeed ) * 6.0;
            // A band of LED signage near the top.
            float band = step( 0.82, vLocal.y ) * step( vLocal.y, 0.86 ) * step( 0.7, fract( vSeed * 13.0 ) );
            col += ec * band * ( 1.5 + sin( uTime * 2.0 + vSeed * 30.0 + f.x * 0.2 ) );
          }
          gl_FragColor = vec4( col, 1.0 );
          #include <fog_fragment>
        }`,
      fog: true,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const tops: number[] = [];
    let n = 0;
    for (let tries = 0; n < count && tries < count * 10; tries++) {
      const x = (rand() - 0.5) * 900;
      const z = -650 + rand() * 950;
      // Keep clear of the district and the view straight down the street (the billboard tower owns it).
      if (Math.abs(x) < 60 && z > -110 && z < 110) continue;
      if (Math.abs(x - 14) < 30 && z < -140 && z > -220) continue;
      const dist = Math.hypot(x, z);
      const h = 30 + rand() * rand() * 220 + dist * 0.06;
      const w = 14 + rand() * 30;
      const d = 14 + rand() * 30;
      m.compose(new THREE.Vector3(x, -2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.3), new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(n++, m);
      if (h > 110) tops.push(x, h - 2 + 1.5, z, rand() * 6.28);
    }
    mesh.count = n;
    mesh.frustumCulled = false;
    mesh.name = "skyline";
    group.add(mesh);
    // Aviation lights: points that blink red on the tall ones.
    const ag = new THREE.BufferGeometry();
    ag.setAttribute("position", new THREE.Float32BufferAttribute(tops.filter((_, i) => i % 4 !== 3), 3));
    ag.setAttribute("aPhase", new THREE.Float32BufferAttribute(tops.filter((_, i) => i % 4 === 3), 1));
    const am = new THREE.ShaderMaterial({
      uniforms: shared({}),
      vertexShader: /* glsl */ `
        attribute float aPhase;
        uniform float uTime;
        varying float vOn;
        #include <fog_pars_vertex>
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          vOn = step( 0.55, fract( uTime * 0.5 + aPhase ) );
          gl_PointSize = clamp( 2600.0 / -mvPosition.z, 2.0, 10.0 );
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        varying float vOn;
        #include <fog_pars_fragment>
        void main() {
          float d = length( gl_PointCoord - 0.5 );
          float a = smoothstep( 0.5, 0.0, d );
          gl_FragColor = vec4( vec3( 1.0, 0.08, 0.05 ) * a * vOn * 30.0, 1.0 );
          gl_FragColor.rgb *= 1.0 - cathodeFogAmount( cameraPosition, vFogWorld, fogDensity ) * 0.75;
        }`,
      fog: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const av = new THREE.Points(ag, am);
    av.frustumCulled = false;
    group.add(av);
  }

  // ---------------------------------------------------------------- the Hollowell billboard tower
  const bbTex = billboardTexture();
  const billboard = new THREE.ShaderMaterial({
    uniforms: shared({ uMap: { value: bbTex } }),
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      void main() {
        float slide = mod( floor( uTime / 6.0 ), 3.0 );
        float t = fract( uTime / 6.0 );
        vec2 uv = vec2( vUv.x, ( vUv.y + 2.0 - slide ) / 3.0 );
        // A glitch on the cut.
        if ( t < 0.04 ) uv.x += sin( vUv.y * 80.0 + uTime * 50.0 ) * 0.02;
        vec3 c = texture2D( uMap, uv ).rgb;
        float scan = 0.85 + 0.15 * sin( vUv.y * 600.0 );
        gl_FragColor = vec4( c * 3.2 * scan, 1.0 );
        gl_FragColor.rgb *= 1.0 - cathodeFogAmount( cameraPosition, vFogWorld, fogDensity ) * 0.82;
      }`,
    fog: true,
  });
  {
    const tower = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: "#0b0c0f", roughness: 0.6, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(24, 150, 24), towerMat);
    body.position.set(0, 73, 0);
    tower.add(body);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(16, 20, 16), towerMat);
    crown.position.set(0, 158, 0);
    tower.add(crown);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(40, 22.5), billboard);
    screen.position.set(0, 96, 12.6);
    tower.add(screen);
    const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 22.5), billboard);
    screen2.position.set(-12.6, 60, 0);
    screen2.rotation.y = -Math.PI / 2;
    tower.add(screen2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 40, 6), towerMat);
    mast.position.set(0, 188, 0);
    tower.add(mast);
    tower.position.set(16, -2, -190);
    tower.name = "billboard-tower";
    group.add(tower);
  }

  // ---------------------------------------------------------------- rain
  const rainBox = new THREE.Vector3(34, 24, 34);
  if (o.rain > 0) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    const rand = prng(31);
    const seeds = new Float32Array(o.rain * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = o.rain;
    const mat = new THREE.ShaderMaterial({
      uniforms: shared({ uBox: { value: rainBox } }),
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform vec3 uCam;
        uniform vec3 uBox;
        uniform float uTime;
        uniform vec2 uWind;
        uniform vec3 uShelterMin;
        uniform vec3 uShelterMax;
        ${LIGHT_GLSL}
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        void main() {
          vec3 vel = vec3( uWind.x, -9.5 * ( 0.85 + aSeed.w * 0.3 ), uWind.y );
          vec3 origin = uCam - vec3( uBox.x * 0.5, uBox.y * 0.38, uBox.z * 0.5 );
          vec3 p = origin + mod( aSeed.xyz * uBox + vel * uTime - origin, uBox );
          float hide = 0.0;
          if ( all( greaterThan( p, uShelterMin ) ) && all( lessThan( p, uShelterMax ) ) ) hide = 1.0;
          if ( p.y < ${FLOOD.water.toFixed(2)} ) hide = 1.0;
          vec3 axis = normalize( vel );
          vec3 toCam = uCam - p;
          float dist = length( toCam );
          vec3 side = normalize( cross( axis, toCam / dist ) );
          float len = 0.42 + aSeed.w * 0.25;
          float width = 0.0045 + dist * 0.0009;
          vec3 wp = p + axis * position.y * len + side * position.x * width;
          vUv = uv;
          vCol = vec3( 0.16, 0.18, 0.22 ) + cLightAt( p ) * 0.35;
          vA = ( 1.0 - hide ) * smoothstep( 0.6, 2.5, dist ) * ( 1.0 - smoothstep( uBox.x * 0.32, uBox.x * 0.5, dist ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        void main() {
          float across = 1.0 - abs( vUv.x - 0.5 ) * 2.0;
          float along = smoothstep( 0.0, 0.4, vUv.y ) * smoothstep( 1.0, 0.7, vUv.y );
          gl_FragColor = vec4( vCol * across * along * vA * 0.5, 1.0 );
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const rain = new THREE.Mesh(geo, mat);
    rain.frustumCulled = false;
    rain.renderOrder = 5;
    rain.layers.set(LAYER_NO_REFLECT);
    rain.name = "rain";
    group.add(rain);
  }

  // ---------------------------------------------------------------- splashes (crowns on the ground)
  if (o.splashes > 0) {
    const base = new THREE.PlaneGeometry(1, 1);
    base.translate(0, 0.5, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    const rand = prng(32);
    const seeds = new Float32Array(o.splashes * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = o.splashes;
    const mat = new THREE.ShaderMaterial({
      uniforms: shared({}),
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform vec3 uCam;
        uniform float uTime;
        uniform vec3 uShelterMin;
        uniform vec3 uShelterMax;
        ${LIGHT_GLSL}
        ${GROUND_GLSL}
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vT;
        varying float vA;
        float h11( float n ) { return fract( sin( n * 91.3458 ) * 47453.5453 ); }
        void main() {
          float rate = 2.2 + aSeed.w * 1.6;
          float life = uTime * rate + aSeed.w * 17.0;
          float cycle = floor( life );
          vT = fract( life );
          vec2 off = vec2( h11( cycle + aSeed.x * 113.0 ), h11( cycle * 1.37 + aSeed.y * 71.0 ) ) - 0.5;
          vec2 xz = uCam.xz + ( aSeed.xy - 0.5 ) * 22.0 + off * 3.0;
          float y = cGround( xz );
          vec3 p = vec3( xz.x, y, xz.y );
          float hide = cIndoors( xz );
          if ( all( greaterThan( p + vec3( 0.0, 0.5, 0.0 ), uShelterMin ) ) && all( lessThan( p, uShelterMax ) ) ) hide = 1.0;
          vec3 toCam = uCam - p;
          float dist = length( toCam );
          vec3 side = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
          float s = 0.12 + aSeed.z * 0.1;
          vec3 wp = p + side * position.x * s * 1.6 + vec3( 0.0, position.y * s, 0.0 );
          vUv = uv;
          vCol = vec3( 0.2, 0.22, 0.26 ) + cLightAt( p + vec3( 0.0, 0.4, 0.0 ) ) * 0.4;
          vA = ( 1.0 - hide ) * ( 1.0 - smoothstep( 9.0, 12.0, dist ) ) * smoothstep( 0.6, 1.5, dist );
          gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vT;
        varying float vA;
        void main() {
          float t = vT;
          if ( t > 0.45 ) discard;
          float k = t / 0.45;
          vec2 p = vUv - vec2( 0.5, 0.0 );
          // A crown: a flattened ring at the base and droplets thrown up and out.
          float ring = 1.0 - smoothstep( 0.0, 0.035, abs( length( p * vec2( 1.0, 3.5 ) ) - k * 0.42 ) );
          float drops = 0.0;
          for ( int i = 0; i < 5; i++ ) {
            float a = ( float( i ) - 2.0 ) * 0.32;
            vec2 c = vec2( sin( a ) * k * 0.42, ( 1.0 - ( 2.0 * k - 1.0 ) * ( 2.0 * k - 1.0 ) ) * 0.55 + 0.04 );
            drops += 1.0 - smoothstep( 0.008, 0.025, length( p - c ) );
          }
          float a = ( ring * 0.7 + drops ) * ( 1.0 - k ) * vA;
          gl_FragColor = vec4( vCol * a * 0.45, 1.0 );
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER_NO_REFLECT);
    mesh.renderOrder = 4;
    mesh.name = "splashes";
    group.add(mesh);
  }

  // ---------------------------------------------------------------- drips from ledges
  if (o.dripCount > 0 && o.drips.length) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    const n = Math.min(o.dripCount, o.drips.length * 2);
    const rand = prng(33);
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const p = o.drips[i % o.drips.length]!;
      data[i * 4] = p.x + (rand() - 0.5) * 0.3;
      data[i * 4 + 1] = p.y;
      data[i * 4 + 2] = p.z + (rand() - 0.5) * 0.3;
      data[i * 4 + 3] = rand();
    }
    geo.setAttribute("aDrip", new THREE.InstancedBufferAttribute(data, 4));
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: shared({}),
      vertexShader: /* glsl */ `
        attribute vec4 aDrip;
        uniform vec3 uCam;
        uniform float uTime;
        ${LIGHT_GLSL}
        ${GROUND_GLSL}
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        void main() {
          float period = 0.7 + aDrip.w * 1.8;
          float t = fract( uTime / period + aDrip.w * 7.0 ) * period;
          float floorY = cGround( aDrip.xz );
          float y = aDrip.y - 4.9 * t * t;
          float hide = y < floorY ? 1.0 : 0.0;
          float v = 9.8 * t;
          vec3 p = vec3( aDrip.x, y, aDrip.z );
          vec3 toCam = uCam - p;
          float dist = length( toCam );
          vec3 side = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
          float len = 0.04 + v * 0.03;
          vec3 wp = p + vec3( 0.0, position.y * len, 0.0 ) + side * position.x * ( 0.006 + dist * 0.0007 );
          vUv = uv;
          vCol = vec3( 0.25, 0.27, 0.3 ) + cLightAt( p ) * 0.5;
          vA = ( 1.0 - hide ) * ( 1.0 - smoothstep( 18.0, 26.0, dist ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        void main() {
          float across = 1.0 - abs( vUv.x - 0.5 ) * 2.0;
          gl_FragColor = vec4( vCol * across * vA * 0.8, 1.0 );
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.layers.set(LAYER_NO_REFLECT);
    mesh.renderOrder = 4;
    mesh.name = "drips";
    group.add(mesh);
  }

  // ---------------------------------------------------------------- steam from vents
  if (o.vents.length && o.steamPer > 0) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute("position", base.getAttribute("position"));
    geo.setAttribute("uv", base.getAttribute("uv"));
    const n = o.vents.length * o.steamPer;
    const rand = prng(34);
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const p = o.vents[Math.floor(i / o.steamPer)]!;
      data[i * 4] = p.x;
      data[i * 4 + 1] = p.y;
      data[i * 4 + 2] = p.z;
      data[i * 4 + 3] = (i % o.steamPer) / o.steamPer + rand() * 0.05;
    }
    geo.setAttribute("aVent", new THREE.InstancedBufferAttribute(data, 4));
    geo.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: shared({}),
      vertexShader: /* glsl */ `
        attribute vec4 aVent;
        uniform vec3 uCam;
        uniform float uTime;
        uniform vec2 uWind;
        ${LIGHT_GLSL}
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        varying float vRot;
        #include <fog_pars_vertex>
        void main() {
          float life = 5.0;
          float t = fract( uTime / life + aVent.w );
          float age = t * life;
          vec3 p = aVent.xyz + vec3( uWind.x * 0.25 * age + sin( age * 1.3 + aVent.w * 20.0 ) * 0.15, age * 0.75 - age * age * 0.03, uWind.y * 0.25 * age );
          float size = 0.5 + age * 0.75;
          vec3 toCam = normalize( uCam - p );
          vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
          vec3 up = cross( toCam, right );
          vRot = aVent.w * 6.28 + age * 0.3;
          vec3 wp = p + ( right * position.x + up * position.y ) * size;
          vUv = uv;
          vCol = vec3( 0.06, 0.065, 0.075 ) + cLightAt( p ) * 0.22;
          vA = smoothstep( 0.0, 0.12, t ) * ( 1.0 - smoothstep( 0.45, 1.0, t ) );
          vec4 mvPosition = viewMatrix * vec4( wp, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        varying float vRot;
        #include <fog_pars_fragment>
        void main() {
          vec2 p = vUv - 0.5;
          float c = cos( vRot ), s = sin( vRot );
          vec2 q = vec2( c * p.x - s * p.y, s * p.x + c * p.y );
          float n = texture2D( uNoise, q * 0.6 + vRot * 0.1 ).g;
          float a = smoothstep( 0.5, 0.0, length( p ) ) * smoothstep( 0.25, 0.75, n ) * vA * 0.32;
          gl_FragColor = vec4( vCol, a );
          #include <fog_fragment>
        }`,
      fog: true,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    mesh.name = "steam";
    group.add(mesh);
  }

  // ---------------------------------------------------------------- volumetric light shafts
  if (o.cones.length) {
    const geos: THREE.BufferGeometry[] = [];
    for (const c of o.cones) {
      const g = new THREE.CylinderGeometry(0.12, c.radius, c.length, 24, 6, true);
      g.translate(0, -c.length / 2, 0);
      // Point the cone at its target: the key floodlight aims up the street, others straight down.
      const dir = c.dir ?? new THREE.Vector3(0, -1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      g.applyQuaternion(q);
      g.translate(c.top.x, c.top.y, c.top.z);
      const n = g.getAttribute("position").count;
      const col = new Float32Array(n * 4);
      const pos = g.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        const dist = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).distanceTo(c.top);
        col[i * 4] = c.color.r * c.strength;
        col[i * 4 + 1] = c.color.g * c.strength;
        col[i * 4 + 2] = c.color.b * c.strength;
        col[i * 4 + 3] = Math.min(1, dist / Math.hypot(c.length, c.radius));
      }
      g.setAttribute("aCone", new THREE.Float32BufferAttribute(col, 4));
      g.deleteAttribute("uv");
      geos.push(g.index ? g.toNonIndexed() : g);
    }
    const merged = mergeAll(geos);
    const mat = new THREE.ShaderMaterial({
      uniforms: shared({}),
      vertexShader: /* glsl */ `
        attribute vec4 aCone;
        varying vec4 vCone;
        varying vec3 vW;
        varying vec3 vN;
        #include <fog_pars_vertex>
        void main() {
          vCone = aCone;
          vW = position;
          vN = normal;
          vec4 mvPosition = viewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNoise;
        uniform float uTime;
        uniform float uLightning;
        varying vec4 vCone;
        varying vec3 vW;
        varying vec3 vN;
        #include <fog_pars_fragment>
        void main() {
          vec3 V = normalize( cameraPosition - vW );
          float edge = pow( abs( dot( normalize( vN ), V ) ), 2.0 );
          float h = vCone.w;
          float fall = pow( 1.0 - h, 1.4 ) * smoothstep( 0.0, 0.06, h );
          float dust = texture2D( uNoise, vec2( vW.x * 0.11 + vW.z * 0.07, vW.y * 0.06 - uTime * 0.02 ) ).r;
          float streak = texture2D( uNoise, vec2( ( vW.x + vW.z ) * 2.3, vW.y * 0.25 + uTime * 1.6 ) ).b;
          float camFade = smoothstep( 0.5, 4.0, length( cameraPosition - vW ) );
          vec3 c = vCone.rgb * edge * fall * ( 0.55 + dust * 0.7 + streak * 0.5 ) * camFade * 0.5;
          c *= 1.0 - cathodeFogAmount( cameraPosition, vFogWorld, fogDensity ) * 0.7;
          gl_FragColor = vec4( c, 1.0 );
        }`,
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.name = "shafts";
    group.add(mesh);
  }

  return {
    group,
    uniforms,
    sky,
    billboard,
    update(camera, time) {
      uniforms.uTime.value = time;
      camera.getWorldPosition(uniforms.uCam.value);
      sky.position.copy(uniforms.uCam.value);
      billboard.uniforms.uTime!.value = time;
    },
  };
}

function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const g of list) total += g.getAttribute("position").count;
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "aCone"]) {
    const size = list[0]!.getAttribute(name).itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of list) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      arr.set(a.array as Float32Array, o);
      o += a.count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
