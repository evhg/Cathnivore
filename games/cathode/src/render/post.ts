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
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { lensBloodTexture } from "./lensblood";

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

/**
 * Renders the world, then the first-person layer on top after clearing depth, into one HDR buffer.
 *
 * Dynamic resolution scales the WORLD only: below a scale of 1 it renders into its own smaller buffer, which is
 * upscaled (with a light sharpen) into the full-size one, and Cath's hands and gun then draw on top at the
 * screen's own resolution. The viewmodel is the most-looked-at thing on screen and covers a small share of it,
 * so on a phone at half scale it stays crisp instead of a half-resolution smear (C4 review).
 */
class ScenePass extends Pass {
  worldScale = 1;
  private readonly low: THREE.WebGLRenderTarget;
  private readonly quad: FullScreenQuad;
  private readonly blit: THREE.ShaderMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly viewScene: THREE.Scene,
    private readonly viewCamera: THREE.Camera,
    samples: number,
  ) {
    super();
    this.needsSwap = false;
    this.low = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples });
    this.blit = new THREE.ShaderMaterial({
      uniforms: { tLow: { value: this.low.texture }, uTexel: { value: new THREE.Vector2(0.25, 0.25) }, uSharp: { value: 0.0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tLow;
        uniform vec2 uTexel;
        uniform float uSharp;
        varying vec2 vUv;
        ${SANITIZE}
        void main() {
          vec3 c = hdrSafe( texture2D( tLow, vUv ).rgb );
          vec3 n = hdrSafe( texture2D( tLow, vUv + vec2( 0.0, uTexel.y ) ).rgb ) + hdrSafe( texture2D( tLow, vUv - vec2( 0.0, uTexel.y ) ).rgb )
                 + hdrSafe( texture2D( tLow, vUv + vec2( uTexel.x, 0.0 ) ).rgb ) + hdrSafe( texture2D( tLow, vUv - vec2( uTexel.x, 0.0 ) ).rgb );
          // An unsharp mask scaled by luminance so a lamp's halo can't ring dark around it.
          vec3 s = c + uSharp * ( c * 4.0 - n ) / ( 1.0 + dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) );
          gl_FragColor = vec4( max( s, 0.0 ), 1.0 );
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.blit);
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width * this.worldScale));
    const h = Math.max(1, Math.round(height * this.worldScale));
    this.low.setSize(w, h);
    this.blit.uniforms.uTexel!.value.set(1 / w, 1 / h);
    // The less the world is scaled, the more the upscale needs crispening (none at full scale).
    this.blit.uniforms.uSharp!.value = THREE.MathUtils.clamp((1 - this.worldScale) * 0.35, 0, 0.18);
  }

  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    if (this.worldScale < 0.999) {
      renderer.setRenderTarget(this.low);
      renderer.clear(true, true, true);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(read);
      renderer.clear(true, true, true);
      this.quad.render(renderer);
    } else {
      renderer.setRenderTarget(read);
      renderer.clear(true, true, true);
      renderer.render(this.scene, this.camera);
    }
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
    // C6/C7 (S6.4): the Vitals uniforms. uHurt 0..1 on a hit, uHurtDir the hit side on screen (unit, +x right,
    // +y up), uWound the wound tier's w.
    uHurt: { value: 0 },
    uHurtDir: { value: new THREE.Vector2(0, 0) },
    uWound: { value: 0 },
    // C7 (S6.3, S6.4): the heartbeat (0..1, from the audio clock), the regen wash, the stim wash, and the four
    // lens-blood slots: uLens = (x, y, alpha, size), uLensB = (cell x, cell y, drip, 0), uLensWipe the stim
    // wipe's front (< 0 when none), uBloodTex the 2x2 splat atlas (render/lensblood.ts).
    uPulse: { value: 0 },
    uRegen: { value: 0 },
    uStim: { value: 0 },
    uLensOn: { value: 0 },
    uLens: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0.5, 0.5, 0, 1)) },
    uLensB: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
    uLensWipe: { value: -1 },
    uBloodTex: { value: null as THREE.Texture | null },
    // The quarter-resolution Vitals map (VitalsPrePass): r the lens film, g the blood vignette, ba the film's
    // slope (biased to 0.5). uVitalsOn says this frame drew it. uBlur: the wound's radial smear is on
    // (desktop high and ultra).
    tVitals: { value: null as THREE.Texture | null },
    uVitalsOn: { value: 0 },
    uBlur: { value: 0 },
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
    uniform float uHurt;
    uniform vec2 uHurtDir;
    uniform float uWound;
    uniform float uPulse;
    uniform float uRegen;
    uniform float uStim;
    uniform float uLensOn;
    uniform sampler2D tVitals;
    uniform float uVitalsOn;
    uniform float uBlur;
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

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot( c, c );
      // C7 (S6.4): one fetch of the quarter-resolution Vitals map gives the lens film, its slope and the blood
      // vignette. The slope bends the view through the film (refraction) before anything else samples the frame.
      vec4 V = vec4( 0.0, 0.0, 0.5, 0.5 );
      vec2 fg = vec2( 0.0 );
      if ( uVitalsOn > 0.5 ) {
        V = texture2D( tVitals, vUv );
        fg = V.ba - 0.5;
        uv += fg * 0.018 * vec2( uRes.y / uRes.x, 1.0 );
        c = uv - 0.5;
      }
      float film = V.r;
      // Chromatic aberration: only toward the edges. Three taps along the radius, one per channel.
      float ca = ( 0.005 * smoothstep( 0.06, 0.5, r2 ) + uDrama * 0.006 ) * ( 1.0 + 2.0 * uWound + 3.0 * uHurt );
      // Under blood on the glass the taps also spread with its thickness and slope: the street behind it goes soft.
      vec2 d = c * ca + ( fg * 0.012 + vec2( 0.004, 0.006 ) * film ) * vec2( uRes.y / uRes.x, 1.0 );
      vec3 t0 = texture2D( tDiffuse, uv + d ).rgb;
      vec3 t1 = texture2D( tDiffuse, uv ).rgb;
      vec3 t2 = texture2D( tDiffuse, uv - d ).rgb;
      vec3 col = hdrSafe( vec3( t0.r, t1.g, t2.b ) );
      // Wounded, the edges smear along the radius (S6.4, desktop high and ultra): the same three taps, spread by
      // the wound, averaged. No extra fetch, so the wound costs the grade almost nothing.
      float smear = max( uBlur * smoothstep( 0.03, 0.22, r2 ) * min( 1.0, uWound * 0.84 ), min( 1.0, film * 5.0 ) );
      if ( smear > 0.001 ) col = mix( col, hdrSafe( ( t0 + t1 + t2 ) * 0.3333 ), smear );
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
      // The Vitals pass (S6.4), after the tone map: a blood vignette that closes in with the wound and flares on
      // a hit, a red lobe on the side the hit came from, and the colour draining from the edges as she weakens.
      if ( uVitalsOn + uRegen + uStim > 0.001 ) {
        // The colour drains from the edges in: the centre, where she aims, keeps most of it. The blood vignette
        // (with the heartbeat) comes from the quarter-resolution pre-pass.
        float ra = length( c * vec2( uRes.x / uRes.y, 1.0 ) );
        float ml = dot( mapped, vec3( 0.2126, 0.7152, 0.0722 ) );
        mapped = mix( mapped, vec3( ml ), uWound * ( 0.1 + 0.65 * smoothstep( 0.12, 0.48, ra ) ) );
        // Blood, not paint: the edge darkens and goes deep red through the scene's own light (multiplied), so the
        // street still shows through it.
        vec3 blood = mapped * vec3( 0.95, 0.1, 0.12 ) + vec3( 0.06, 0.0, 0.004 );
        mapped = mix( mapped, blood, min( 1.0, V.g * 1.6 ) ) * ( 1.0 - V.g * 0.45 );
        // A hit: a red lobe on the side it came from.
        if ( uHurt > 0.001 ) {
          float lobe = max( 0.0, dot( c, uHurtDir ) * inversesqrt( r2 + 1e-6 ) ) * uHurt;
          mapped = mix( mapped, mapped * vec3( 1.1, 0.14, 0.14 ) + vec3( 0.16, 0.004, 0.012 ), min( 1.0, lobe * lobe * smoothstep( 0.25, 0.7, ra ) * 0.9 ) );
        }
        // Regen (S6.3): a cold cyan band riding the vignette's inner edge (the red pushed back by a cold line), so
        // recovery is as loud as the hurt. A stim: a green-white wash in from the edges. Both rare: worked here.
        if ( uRegen + uStim > 0.001 ) {
          float r = ra;
          float inner = mix( 0.75, 0.42, uWound ) - uPulse * 0.035 * uWound;
          // A thin line, not a porthole: the band is narrow and peaks well below opaque (5K review).
          float band = smoothstep( inner - 0.07, inner, r ) * ( 1.0 - smoothstep( inner + 0.02, inner + 0.15, r ) );
          mapped = mix( mapped, mapped * vec3( 0.55, 1.1, 1.2 ) + vec3( 0.01, 0.1, 0.125 ), min( 1.0, uRegen * band * 0.5 ) );
          mapped = mix( mapped, vec3( 0.78, 1.0, 0.86 ), uStim * smoothstep( 0.3, 0.95, r ) * 0.55 );
        }
        // The lens film itself: thin blood is a translucent red over the street, thick blood is near black, and
        // its wet rim catches the light from above.
        if ( film > 0.003 ) {
          // Thin film: the street shows through, stained red and refracted. Thick: a dark, glossy clot. Never opaque.
          // Blood absorbs green and blue almost entirely: a lit window behind it goes deep red, never pink.
          float th = smoothstep( 0.0, 0.24, film );
          vec3 tint = mapped * vec3( 0.72, 0.05, 0.05 ) + vec3( 0.04, 0.0, 0.003 );
          tint *= mix( 1.0, 0.45, smoothstep( 0.3, 0.75, film ) );
          mapped = mix( mapped, tint, th * 0.93 );
          // The wet surface catches a soft light from above, along the film's upper rim.
          float gl = length( fg );
          float sp = max( 0.0, dot( fg / max( gl, 1e-4 ), vec2( -0.45, 0.89 ) ) );
          mapped += vec3( 0.32, 0.12, 0.11 ) * ( sp * sp * sp * smoothstep( 0.01, 0.12, gl ) * th * 0.22 );
        }
      }
      // Encode to sRGB here so FXAA (phone) works on perceptual values.
      mapped = mix( mapped * 12.92, 1.055 * pow( max( mapped, 0.0 ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, mapped ) );
      gl_FragColor = vec4( mapped, 1.0 );
    }`,
};

/**
 * C7 (S6.4): the Vitals pre-pass, at a quarter of the screen's resolution and only on frames with a wound, a
 * hit or blood on the lens. One 8-bit map, everything in it smooth: r the lens film from the four slots over the
 * splat atlas, g the blood vignette (with the heartbeat), ba the film's slope from the atlas (biased to 0.5), so
 * the refraction is smooth instead of stepping in quarter-resolution blocks. The grade reads it in one fetch, so at full resolution the wound is a texture read and a handful of mixes (C7: at most 15% of
 * the grade pass; SwiftShader's cost is the fetches, so the grade takes no other).
 */
class VitalsPrePass extends Pass {
  readonly rt: THREE.WebGLRenderTarget;
  private readonly quad: FullScreenQuad;
  private readonly mat: THREE.ShaderMaterial;
  constructor(
    private readonly grade: ShaderPass,
    private readonly blur: boolean,
  ) {
    super();
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false });
    const g = grade.uniforms;
    this.mat = new THREE.ShaderMaterial({
      // Shared with the grade: setWounded writes them once.
      uniforms: { uRes: g.uRes!, uWound: g.uWound!, uHurt: g.uHurt!, uPulse: g.uPulse!, uLensOn: g.uLensOn!, uLens: g.uLens!, uLensB: g.uLensB!, uLensWipe: g.uLensWipe!, uBloodTex: g.uBloodTex! },
      vertexShader: GradeShader.vertexShader,
      fragmentShader: /* glsl */ `
        uniform vec2 uRes;
        uniform float uWound;
        uniform float uHurt;
        uniform float uPulse;
        uniform float uLensOn;
        uniform vec4 uLens[ 4 ];
        uniform vec4 uLensB[ 4 ];
        uniform float uLensWipe;
        uniform sampler2D uBloodTex;
        varying vec2 vUv;
        void main() {
          vec2 c = vUv - 0.5;
          float asp = uRes.x / uRes.y;
          float film = 0.0;
          vec2 fg = vec2( 0.0 );
          if ( uLensOn > 0.5 ) {
            for ( int i = 0; i < 4; i++ ) {
              vec4 L = uLens[ i ];
              if ( L.z <= 0.002 ) continue;
              vec2 lc = ( vUv - L.xy ) * vec2( asp, 1.0 ) / ( 0.34 * L.w ) + 0.5;
              // It runs: the splat slides down the glass as it ages.
              lc.y += uLensB[ i ].z / L.w;
              if ( lc.x < 0.0 || lc.y < 0.0 || lc.x > 1.0 || lc.y > 1.0 ) continue;
              vec4 t = texture2D( uBloodTex, ( uLensB[ i ].xy + lc ) * 0.5 );
              float wm = uLensWipe < 0.0 ? 1.0 : smoothstep( uLensWipe * 1.2 - 0.16, uLensWipe * 1.2 - 0.04, vUv.x );
              film = max( film, t.r * L.z * wm );
              fg += ( t.gb - 0.5 ) * L.z * wm;
            }
          }
          // The ring closes on each heartbeat (uPulse, from the same clock the ear hears).
          float r = length( c * vec2( asp, 1.0 ) );
          float inner = mix( 0.75, 0.42, uWound ) - uPulse * 0.035 * uWound;
          float bl = smoothstep( inner, inner + 0.45, r ) * ( 0.55 * uWound + 0.35 * uHurt + 0.22 * uPulse * uWound );
          gl_FragColor = vec4( film, min( 1.0, bl ), clamp( fg + 0.5, 0.0, 1.0 ) );
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(width: number, height: number): void {
    this.rt.setSize(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
  }
  render(renderer: THREE.WebGLRenderer): void {
    const g = this.grade.uniforms;
    const wound = g.uWound!.value as number;
    g.uBlur!.value = this.blur && wound > 0.01 ? 1 : 0;
    const on = (g.uLensOn!.value as number) > 0.5 || wound + (g.uHurt!.value as number) > 0.001;
    g.uVitalsOn!.value = on ? 1 : 0;
    if (!on) return;
    renderer.setRenderTarget(this.rt);
    this.quad.render(renderer);
    g.tVitals!.value = this.rt.texture;
  }
}

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
      c += ( h( px * 1.37 + 11.0 ) - 0.5 ) * ( 0.6 + l * 0.6 ) / 255.0;
      gl_FragColor = vec4( c, 1.0 );
    }`,
};

export interface Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  final: ShaderPass;
  gtao: GTAOPass | null;
  /** `dpr` is the screen's (the viewmodel and post render at it); `worldScale` scales the world's render only. */
  setSize(w: number, h: number, dpr: number, worldScale?: number): void;
  render(time: number): void;
  /**
   * C7 acceptance: the grade pass's mean time over `n` draws (ms, synced with a 1-pixel read each), with the
   * Vitals pass idle (`on` false) or at its busiest (bleeding, a hit, the pulse, two lens splats). Restores the
   * uniforms after.
   */
  benchGrade(n: number, on: boolean | { wound: number; hurt: number; pulse: number; lens: number }): number;
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
  const scenePass = new ScenePass(scene, camera, viewScene, viewCamera, quality === "phone" ? 0 : 4);
  composer.addPass(scenePass);
  let gtao: GTAOPass | null = null;
  if (quality === "ultra") {
    gtao = new GTAOPass(scene, camera, 4, 4);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.4, 0.4, 1.8);
  // Everything the bloom blurs goes through its high pass first: clean it there.
  const hp = bloom.materialHighPassFilter;
  hp.fragmentShader = hp.fragmentShader
    .replace("void main() {", `${SANITIZE}\nvoid main() {`)
    .replace("vec4 texel = texture2D( tDiffuse, vUv );", "vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb = hdrSafe( texel.rgb );");
  hp.needsUpdate = true;
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uBloodTex!.value = lensBloodTexture();
  // The wound's radial blur costs 6 taps: desktop high and ultra only (S6.4).
  const vitalsPre = new VitalsPrePass(grade, quality !== "phone");
  composer.addPass(vitalsPre);
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
    setSize(w, h, dpr, worldScale = 1) {
      scenePass.worldScale = THREE.MathUtils.clamp(worldScale, 0.25, 1);
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
    benchGrade(n, on) {
      const u = grade.uniforms;
      const keys = ["uWound", "uHurt", "uPulse", "uRegen", "uStim", "uLensOn", "uLensWipe"] as const;
      const saved = keys.map((k) => u[k]!.value as number);
      const lens = (u.uLens!.value as THREE.Vector4[]).map((v) => v.clone());
      const set = (w: number, h: number, p: number, l: number) => {
        u.uWound!.value = w;
        u.uHurt!.value = h;
        u.uPulse!.value = p;
        u.uRegen!.value = 0;
        u.uStim!.value = 0;
        u.uLensOn!.value = l;
        u.uLensWipe!.value = -1;
        const L = u.uLens!.value as THREE.Vector4[];
        L[0]!.set(0.84, 0.56, l ? 0.9 : 0, 1.1);
        L[1]!.set(0.15, 0.47, l ? 0.7 : 0, 0.9);
      };
      if (typeof on === "object") set(on.wound, on.hurt, on.pulse, on.lens);
      else set(on ? 1 : 0, on ? 0.6 : 0, on ? 0.8 : 0, on ? 1 : 0);
      const read = composer.readBuffer;
      const tmp = new THREE.WebGLRenderTarget(read.width, read.height);
      const px = new Uint8Array(4);
      vitalsPre.render(renderer);
      grade.render(renderer, tmp, read, 0, false);
      renderer.readRenderTargetPixels(tmp, 0, 0, 1, 1, px);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        vitalsPre.render(renderer);
        grade.render(renderer, tmp, read, 0, false);
        renderer.readRenderTargetPixels(tmp, 0, 0, 1, 1, px);
      }
      const ms = (performance.now() - t0) / Math.max(1, n);
      tmp.dispose();
      keys.forEach((k, i) => (u[k]!.value = saved[i]));
      (u.uLens!.value as THREE.Vector4[]).forEach((v, i) => v.copy(lens[i]!));
      return ms;
    },
  };
}

