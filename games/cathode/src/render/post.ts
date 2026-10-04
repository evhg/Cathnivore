// The HDR post chain. Linear half-float throughout until the last pass:
//   ScenePass   world (MSAA on high/ultra), then Cath's first-person layer after a depth clear, both into
//               the same HDR buffer so the muzzle flash blooms with everything else;
//   GTAO        ultra only;
//   Bloom       UnrealBloom with an HDR threshold (only neon, lamps and flashes bloom);
//   Grade       AgX-style tone map + noir grading: desaturated midtones while saturated neon keeps its
//               colour, lifted cool blacks, vignette, edge chromatic aberration, and the kill-cam drama
//               (heavier desaturation, vignette and a radial depth-of-field blur);
//   FXAA        phone only (high and ultra have 4x MSAA);
//   Final       film grain + dither, to the screen.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

/**
 * NaN and Inf to 0 and a ceiling, per channel. On a real GPU the HDR buffer is half float: a wet-street
 * specular glint on a low-roughness surface can pass 65504 and store Inf (or NaN, e.g. 0 * Inf), and the
 * bloom's blur chain then smears it across most of the screen as black (owner's desktop playtest,
 * 2026-10-04: "the middle of the screen is just black, only the edges are rendering"). SwiftShader keeps
 * full precision, so headless tests never saw it. Comparisons are false for NaN, so the ternaries catch it.
 */
const SANITIZE = /* glsl */ `
    float hdrSafe( float x ) { return x < 256.0 ? max( x, 0.0 ) : ( x >= 256.0 ? 256.0 : 0.0 ); }
    vec3 hdrSafe( vec3 c ) { return vec3( hdrSafe( c.r ), hdrSafe( c.g ), hdrSafe( c.b ) ); }
`;

/** Renders the world, then the first-person layer on top after clearing depth, into one HDR buffer. */
class ScenePass extends Pass {
  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly viewScene: THREE.Scene,
    private readonly viewCamera: THREE.Camera,
  ) {
    super();
    this.needsSwap = false;
  }

  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(read);
    renderer.clear(true, true, true);
    renderer.render(this.scene, this.camera);
    if (this.viewScene.children.length) {
      renderer.clearDepth();
      renderer.render(this.viewScene, this.viewCamera);
    }
    renderer.autoClear = auto;
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uDrama: { value: 0 },
    uExposure: { value: 1 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uDrama;
    uniform float uExposure;
    uniform float uFlash;
    varying vec2 vUv;
    ${SANITIZE}
    // AgX (Troy Sobotka's, as fitted in three.js): filmic, graceful with saturated neon.
    mat3 AgXIn = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
    mat3 AgXOut = mat3( vec3( 1.1271005818144368, -0.1413297634984383, -0.14132976349843826 ), vec3( -0.11060664309660323, 1.157823702216272, -0.11060664309660294 ), vec3( -0.016493938717834573, -0.016493938717834257, 1.2519364065950405 ) );
    vec3 agxContrast( vec3 x ) {
      vec3 x2 = x * x;
      vec3 x4 = x2 * x2;
      return + 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
    }
    vec3 agx( vec3 c ) {
      const mat3 toRec2020 = mat3( 0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956 );
      const mat3 fromRec2020 = mat3( 1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187 );
      c = toRec2020 * c;
      c = AgXIn * c;
      c = max( c, 1e-10 );
      c = log2( c );
      c = ( c - -12.47393 ) / ( 4.026069 - -12.47393 );
      c = clamp( c, 0.0, 1.0 );
      c = agxContrast( c );
      c = AgXOut * c;
      c = pow( max( vec3( 0.0 ), c ), vec3( 2.2 ) );
      c = fromRec2020 * c;
      return clamp( c, 0.0, 1.0 );
    }

    vec3 sampleCA( vec2 uv, float amt ) {
      vec2 d = ( uv - 0.5 ) * amt;
      return hdrSafe( vec3( texture2D( tDiffuse, uv + d ).r, texture2D( tDiffuse, uv ).g, texture2D( tDiffuse, uv - d ).b ) );
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot( c, c );
      // Chromatic aberration: only toward the edges.
      float ca = 0.006 * r2 * 4.0 + uDrama * 0.006;
      vec3 col = sampleCA( uv, ca );
      // Kill-cam depth of field: a radial blur that grows away from the centre.
      if ( uDrama > 0.01 ) {
        vec3 acc = col;
        float wsum = 1.0;
        float rad = uDrama * smoothstep( 0.02, 0.2, r2 ) * 0.012;
        for ( int i = 0; i < 12; i++ ) {
          float a = float( i ) * 2.39996;
          float rr = sqrt( float( i ) + 0.5 ) / sqrt( 12.0 );
          vec2 o = vec2( cos( a ), sin( a ) ) * rr * rad * vec2( uRes.y / uRes.x, 1.0 ) * 1.6;
          acc += hdrSafe( texture2D( tDiffuse, uv + o ).rgb );
          wsum += 1.0;
        }
        col = mix( col, acc / wsum, smoothstep( 0.0, 0.3, uDrama ) );
      }
      col *= uExposure * ( 1.0 + uFlash );
      // Noir grading in linear light, before the tone map.
      float lum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      float maxc = max( col.r, max( col.g, col.b ) );
      float minc = min( col.r, min( col.g, col.b ) );
      float sat = ( maxc - minc ) / max( maxc, 1e-4 );
      // Keep saturation where it's strong AND bright (neon); drain it from midtones.
      float keep = smoothstep( 0.35, 0.85, sat ) * smoothstep( 0.02, 0.4, lum );
      float desat = mix( 0.55, 1.0, keep ) * ( 1.0 - uDrama * 0.85 );
      col = mix( vec3( lum ), col, desat );
      // A cool cast in the shadows, a warmer one in the highlights (sodium stays sodium).
      col += vec3( -0.0006, 0.0003, 0.0016 ) * ( 1.0 - smoothstep( 0.0, 0.05, lum ) );
      // Vignette.
      float vig = 1.0 - smoothstep( 0.2, 0.95, r2 * ( 1.6 + uDrama * 1.4 ) ) * ( 0.55 + uDrama * 0.35 );
      col *= vig;
      vec3 mapped = agx( col );
      // Lifted, cool blacks and a gentle S.
      mapped = mapped * 0.99 + vec3( 0.0012, 0.0022, 0.0042 );
      mapped = mix( mapped, mapped * mapped * ( 3.0 - 2.0 * mapped ), 0.25 );
      // Encode to sRGB here so FXAA (phone) works on perceptual values.
      mapped = mix( mapped * 12.92, 1.055 * pow( max( mapped, 0.0 ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, mapped ) );
      gl_FragColor = vec4( mapped, 1.0 );
    }`,
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
  },
  vertexShader: GradeShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime;
    uniform float uGrain;
    varying vec2 vUv;
    // Dave Hoskins' hash: no sin(), so no moire at odd render scales.
    float h( vec2 p ) {
      vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
      p3 += dot( p3, p3.yzx + 33.33 );
      return fract( ( p3.x + p3.y ) * p3.z );
    }
    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      // Film grain in display space (even in the blacks), then dither against banding in the fog.
      vec2 px = floor( vUv * uRes );
      float l = dot( c, vec3( 0.333 ) );
      float g = h( px + floor( fract( uTime * 7.31 ) * 997.0 ) ) - 0.5;
      c += g * uGrain * ( 1.0 - l * 0.6 );
      c += ( h( px * 1.37 + 11.0 ) - 0.5 ) / 255.0;
      gl_FragColor = vec4( c, 1.0 );
    }`,
};

export interface Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  final: ShaderPass;
  gtao: GTAOPass | null;
  setSize(w: number, h: number, dpr: number): void;
  render(time: number): void;
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  viewScene: THREE.Scene,
  viewCamera: THREE.PerspectiveCamera,
  quality: "phone" | "high" | "ultra",
): Post {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    type: THREE.HalfFloatType,
    samples: quality === "phone" ? 0 : 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new ScenePass(scene, camera, viewScene, viewCamera));
  let gtao: GTAOPass | null = null;
  if (quality === "ultra") {
    gtao = new GTAOPass(scene, camera, 4, 4);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.5, 0.42, 1.6);
  // Everything the bloom blurs goes through its high pass first: clean it there.
  const hp = bloom.materialHighPassFilter;
  hp.fragmentShader = hp.fragmentShader
    .replace("void main() {", `${SANITIZE}\nvoid main() {`)
    .replace("vec4 texel = texture2D( tDiffuse, vUv );", "vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb = hdrSafe( texel.rgb );");
  hp.needsUpdate = true;
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  // Phone has no MSAA: FXAA on the graded (sRGB) image.
  const fxaa = quality === "phone" ? new ShaderPass(FXAAShader) : null;
  if (fxaa) composer.addPass(fxaa);
  const final = new ShaderPass(FinalShader);
  composer.addPass(final);
  return {
    composer,
    bloom,
    grade,
    final,
    gtao,
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      grade.uniforms.uRes!.value.set(pw, ph);
      final.uniforms.uRes!.value.set(pw, ph);
      fxaa?.uniforms.resolution!.value.set(1 / pw, 1 / ph);
      // Bloom at half resolution on phone.
      if (quality === "phone") bloom.setSize(Math.round(pw / 2), Math.round(ph / 2));
    },
    render(time) {
      final.uniforms.uTime!.value = time;
      grade.uniforms.uTime!.value = time;
      composer.render();
    },
  };
}

