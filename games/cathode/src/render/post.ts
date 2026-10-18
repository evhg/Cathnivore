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
    // Each live slot's screen box (uv min xy, max zw; off screen when empty): the grade reads the Vitals map only
    // inside one, so the street around the blood costs nothing.
    uLensRect: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(2, 2, 2, 2)) },
    uLensWipe: { value: -1 },
    // Reduced violence (S6.4): the same slots render as grey rain on the lens, never blood.
    uLensWater: { value: 0 },
    uBloodTex: { value: null as THREE.Texture | null },
    // uBlur: the wound's radial smear is on (desktop high and ultra). uFxCa: the Damage effects setting's CA and
    // smear (1 Full and Reduced, 0 Minimal; S9.8).
    uBlur: { value: 0 },
    uFxCa: { value: 1 },
    uPulseMove: { value: 1 },
    // C8 (S6.6): death. uDeath drains the colour, bleeds it to red and closes the edges; uInk floods blood ink in
    // from the edges (uInkGrey: reduced violence's grey-black); uGlitch is the re-sync's slices, RGB split and
    // scanlines; uDeathCa widens the edge CA as she falls (x3).
    uDeath: { value: 0 },
    uInk: { value: 0 },
    uInkGrey: { value: 0 },
    uGlitch: { value: 0 },
    uDeathCa: { value: 1 },
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
    uniform vec4 uLens[ 4 ];
    uniform vec4 uLensB[ 4 ];
    uniform vec4 uLensRect[ 4 ];
    uniform float uLensWipe;
    uniform float uLensWater;
    uniform sampler2D uBloodTex;
    uniform float uBlur;
    uniform float uFxCa;
    uniform float uPulseMove;
    uniform float uDeath;
    uniform float uInk;
    uniform float uInkGrey;
    uniform float uGlitch;
    uniform float uDeathCa;
    uniform float uTime;
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

    // C8: value noise and a 4-octave fBm for the ink's edge (only evaluated while the ink is in).
    float vh( vec2 p ) {
      vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
      p3 += dot( p3, p3.yzx + 33.33 );
      return fract( ( p3.x + p3.y ) * p3.z );
    }
    float vnoise( vec2 p ) {
      vec2 i = floor( p );
      vec2 f = fract( p );
      f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( vh( i ), vh( i + vec2( 1.0, 0.0 ) ), f.x ), mix( vh( i + vec2( 0.0, 1.0 ) ), vh( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
    }
    float fbm( vec2 p ) {
      float a = 0.5;
      float v = 0.0;
      for ( int i = 0; i < 4; i++ ) {
        v += a * vnoise( p );
        p = p * 2.03 + vec2( 17.1, 3.7 );
        a *= 0.5;
      }
      return v;
    }

    // One lens slot (see main): nothing at all outside its box.
    void lensSlot( vec4 L, vec4 B, vec4 R, inout float film, inout vec2 fg, inout float glint ) {
      if ( vUv.x < R.x || vUv.y < R.y || vUv.x > R.z || vUv.y > R.w ) return;
      vec2 s = ( vUv - L.xy ) * vec2( uRes.x / uRes.y, 1.0 );
      s.y += B.z * 0.34;
      float cr = cos( B.w );
      float sr = sin( B.w );
      vec2 q = mat2( cr, -sr, sr, cr ) * s / ( 0.34 * L.w ) + 0.5;
      vec4 t = texture2D( uBloodTex, ( B.xy + clamp( q, 0.0, 1.0 ) ) * 0.5 );
      float wm = uLensWipe < 0.0 ? 1.0 : smoothstep( uLensWipe * 1.2 - 0.16, uLensWipe * 1.2 - 0.04, vUv.x );
      film = max( film, t.r * L.z * wm );
      glint = max( glint, t.a * L.z * wm );
      // The slope back into screen space (the inverse turn).
      fg += mat2( cr, sr, -sr, cr ) * ( t.gb - 0.5 ) * L.z * wm;
    }

    void main() {
      vec2 uv = vUv;
      // C8 re-sync glitch: 8 horizontal slices, each shoved up to 2% of the width (re-picked every 33 ms).
      float gsplit = 0.0;
      if ( uGlitch > 0.001 ) {
        float slice = floor( vUv.y * 8.0 );
        float tick = floor( uTime * 30.0 );
        float sh = vh( vec2( slice * 7.13, tick ) );
        uv.x += ( sh - 0.5 ) * 0.04 * uGlitch * step( 0.35, vh( vec2( tick, slice ) ) );
        gsplit = 6.0 * uGlitch / uRes.x;
      }
      vec2 c = uv - 0.5;
      float r2 = dot( c, c );
      // C7 (S6.4): blood on the glass. Only inside a live slot's box (uLensRect, from the CPU) does a pixel read the
      // splat atlas: one fetch per slot it sits in (almost always one), giving the film and its slope. Each slot
      // is placed, turned and sized per hit and runs down the glass as it ages. The slope bends the view through
      // the film (refraction) before anything else samples the frame. Everywhere else the wound is arithmetic:
      // no extra fetch and no extra pass (S6.4: no new full-screen pass on phone).
      float film = 0.0;
      float glint = 0.0;
      vec2 fg = vec2( 0.0 );
      if ( uLensOn > 0.5 ) {
        lensSlot( uLens[ 0 ], uLensB[ 0 ], uLensRect[ 0 ], film, fg, glint );
        lensSlot( uLens[ 1 ], uLensB[ 1 ], uLensRect[ 1 ], film, fg, glint );
        lensSlot( uLens[ 2 ], uLensB[ 2 ], uLensRect[ 2 ], film, fg, glint );
        lensSlot( uLens[ 3 ], uLensB[ 3 ], uLensRect[ 3 ], film, fg, glint );
        uv += fg * 0.022 * vec2( uRes.y / uRes.x, 1.0 );
        c = uv - 0.5;
      }
      // Chromatic aberration: only toward the edges. Three taps along the radius, one per channel.
      float ca = ( 0.005 * smoothstep( 0.06, 0.5, r2 ) + uDrama * 0.006 ) * ( 1.0 + uFxCa * ( 2.0 * uWound + 3.0 * uHurt ) ) * uDeathCa;
      // Under blood on the glass the taps also spread with its thickness and slope: the street behind it goes soft.
      vec2 d = c * ca + ( fg * 0.012 + vec2( 0.004, 0.006 ) * film ) * vec2( uRes.y / uRes.x, 1.0 );
      vec3 t0 = texture2D( tDiffuse, uv + d + vec2( gsplit, 0.0 ) ).rgb;
      vec3 t1 = texture2D( tDiffuse, uv ).rgb;
      vec3 t2 = texture2D( tDiffuse, uv - d - vec2( gsplit, 0.0 ) ).rgb;
      vec3 col = hdrSafe( vec3( t0.r, t1.g, t2.b ) );
      // Wounded, the edges smear along the radius (S6.4, desktop high and ultra): the same three taps, spread by
      // the wound, averaged. No extra fetch, so the wound costs the grade almost nothing.
      float smear = max( uBlur * uFxCa * smoothstep( 0.03, 0.22, r2 ) * min( 1.0, uWound * 0.84 + uDeath ), min( 1.0, film * 5.0 ) );
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
      if ( uWound + uHurt + uLensOn + uRegen + uStim > 0.001 ) {
        // The colour drains from the edges in: the centre, where she aims, keeps most of it.
        float ra = length( c * vec2( uRes.x / uRes.y, 1.0 ) );
        float ml = dot( mapped, vec3( 0.2126, 0.7152, 0.0722 ) );
        mapped = mix( mapped, vec3( ml ), uWound * ( 0.1 + 0.65 * smoothstep( 0.12, 0.48, ra ) ) );
        // The blood vignette: a ring that closes in with the wound, flares on a hit and closes on each heartbeat
        // (uPulse, from the same clock the ear hears). Worked out here, not fetched: a few ALU ops a pixel.
        float inner = mix( 0.75, 0.42, uWound ) - uPulse * 0.035 * uWound * uPulseMove;
        float bl = min( 1.0, smoothstep( inner, inner + 0.45, ra ) * ( 0.55 * uWound + 0.35 * uHurt + 0.22 * uPulse * uWound ) );
        // Blood, not paint: the edge darkens and goes deep red through the scene's own light (multiplied), so the
        // street still shows through it.
        vec3 blood = mapped * vec3( 0.95, 0.1, 0.12 ) + vec3( 0.06, 0.0, 0.004 );
        mapped = mix( mapped, blood, min( 1.0, bl * 1.6 ) ) * ( 1.0 - bl * 0.45 );
        // A hit: a red lobe on the side it came from.
        if ( uHurt > 0.001 ) {
          float lobe = max( 0.0, dot( c, uHurtDir ) * inversesqrt( r2 + 1e-6 ) ) * uHurt;
          mapped = mix( mapped, mapped * vec3( 1.1, 0.14, 0.14 ) + vec3( 0.16, 0.004, 0.012 ), min( 1.0, lobe * lobe * smoothstep( 0.25, 0.7, ra ) * 0.9 ) );
        }
        // Regen (S6.3): cold light pushing the red back. The critical red stays (she is still hurt: the frame must
        // agree with the HUD); only its inner reach gives ground. The cold is a narrow, broken, additive rim of low
        // luminance riding just inside the red, its radius wandering with angle and time so no circle ever reads
        // (three reviews saw a full-band wash as a scope ring), and it drifts outward as it fades, the red pushed
        // back toward the corners. A stim: a green-white wash in from the edges.
        if ( uRegen + uStim > 0.001 ) {
          float r = ra;
          float ang = atan( c.y, c.x * uRes.x / uRes.y );
          float wander = 0.04 * sin( ang * 3.0 + 1.7 + uTime * 0.9 ) + 0.025 * sin( ang * 7.0 - 0.4 - uTime * 1.4 );
          float d = r - ( inner + 0.05 + 0.1 * ( 1.0 - uRegen ) + wander );
          float rim = exp( -d * d * 1100.0 );
          // Broken along the ring: short runs of cold with long dark gaps (most of the circle carries none), so it
          // reads as frost creeping in at the red's edge, never as a lit circle.
          float brk = smoothstep( 0.5, 0.9, 0.5 + 0.5 * sin( ang * 4.0 + 0.9 + uTime * 0.5 ) * sin( ang * 7.0 - 1.1 + uTime * 0.7 ) );
          float s = uRegen * rim * brk;
          // Lift the red's inner edge (only where the rim runs), then add the cold on top: never a desaturating band.
          mapped.r *= 1.0 - 0.3 * s;
          mapped += vec3( 0.015, 0.16, 0.21 ) * s;
          mapped = mix( mapped, vec3( 0.78, 1.0, 0.86 ), uStim * smoothstep( 0.3, 0.95, r ) * 0.55 );
        }
        // The lens film itself: thin blood is a translucent red over the street, thick blood is near black, and
        // its wet rim catches the light from above.
        if ( film > 0.003 ) {
          // Light through blood (Beer-Lambert): green and blue fall off first, red slowly, so the street shows
          // through stained and refracted. Thin film only tints (C7 review: no saturated sticker red), the core
          // goes near black, and what lies behind is capped first so a lit window never paints it bright.
          float th = smoothstep( 0.0, 0.1, film );
          if ( uLensWater > 0.5 ) {
            // Rain on the lens (reduced violence): clear water, untinted. The refraction above already bends the
            // street through it; it dulls a touch, its rim catches a cool edge light, and the dome glints.
            float glw = length( fg );
            mapped = mix( mapped, mapped * 0.75 + vec3( 0.004, 0.005, 0.007 ), th * 0.5 );
            mapped += vec3( 0.012, 0.015, 0.02 ) * smoothstep( 0.06, 0.2, glw ) * ( 1.0 - smoothstep( 0.1, 0.3, film ) ) * th;
            mapped += vec3( 0.5, 0.52, 0.55 ) * glint * th * 0.4;
          } else {
          vec3 T = exp( -film * vec3( 3.2, 15.0, 14.0 ) );
          vec3 tint = min( mapped, vec3( 0.4 ) ) * T + vec3( 0.022, 0.002, 0.003 ) * th;
          tint *= 1.0 - 0.65 * smoothstep( 0.12, 0.4, film );
          tint.r = min( tint.r, 0.15 );
          mapped = mix( mapped, tint, th );
          // Wet glass: the thin rim of the film catches a little light (a pale, desaturated meniscus), so the splat
          // keeps its outline against the red vignette; a few tiny glints sit on the wet dome (atlas A), never arcs.
          float gl = length( fg );
          float rimL = smoothstep( 0.06, 0.2, gl ) * ( 1.0 - smoothstep( 0.06, 0.2, film ) );
          mapped += vec3( 0.018, 0.01, 0.01 ) * rimL * th;
          mapped += vec3( 0.55, 0.5, 0.48 ) * glint * th * 0.4;
          }
        }
      }
      // C8 (S6.6): death. The colour goes (all but 5%), what is left bleeds toward red, and the edges close to black
      // as uDeath grows; then the ink floods in from the edges on an fBm front, the centre always left visible.
      if ( uDeath + uInk + uGlitch > 0.001 ) {
        float ra = length( c * vec2( uRes.x / uRes.y, 1.0 ) );
        float ml = dot( mapped, vec3( 0.2126, 0.7152, 0.0722 ) );
        mapped = mix( mapped, vec3( ml ), min( 1.0, uDeath * 0.95 ) );
        mapped = mix( mapped, mapped * vec3( 1.0, 0.25, 0.22 ), uDeath * 0.6 * ( 1.0 - uInkGrey ) );
        mapped *= 1.0 - uDeath * smoothstep( 0.2, 0.9, ra + uDeath * 0.6 ) * 0.92;
        if ( uInk > 0.001 ) {
          vec2 q = c * vec2( uRes.x / uRes.y, 1.0 );
          float n = fbm( q * 3.2 + vec2( 0.0, uTime * 0.05 ) );
          // Distance in from the frame's edge (0 at the edge, 0.5 at the centre), roughened by the noise.
          float edge = min( min( vUv.x, 1.0 - vUv.x ) * uRes.x / uRes.y, min( vUv.y, 1.0 - vUv.y ) );
          float front = uInk * 0.62;
          float k = edge + ( n - 0.5 ) * 0.26 + ( fbm( q * 14.0 + 7.0 ) - 0.5 ) * 0.05;
          float inkA = ( 1.0 - smoothstep( front - 0.018, front + 0.008, k ) ) * smoothstep( 0.0, 0.3, uInk );
          // The centre stays visible: the ink never reaches inside 18% of the height.
          inkA *= smoothstep( 0.16, 0.3, ra );
          // Blood ink (S6.6 --blood at 0.85), dark and uneven: thick where the noise pools, near black at the frame's
          // edge, a thin brighter film at the front where it is still running. Reduced violence: --night-3.
          float n2 = fbm( q * 9.0 - vec2( 3.1, uTime * 0.03 ) );
          float depth = smoothstep( 0.0, front, front - k );
          vec3 inkC = mix( vec3( 0.075, 0.0015, 0.006 ), vec3( 0.006, 0.0003, 0.001 ), clamp( depth * 0.8 + ( n2 - 0.5 ) * 1.1, 0.0, 1.0 ) );
          inkC = mix( inkC, vec3( 0.0085, 0.009, 0.014 ), uInkGrey );
          float rim = smoothstep( front - 0.05, front, k ) * ( 1.0 - smoothstep( front, front + 0.02, k ) );
          mapped = mix( mapped, inkC, inkA * 0.85 );
          mapped += vec3( 0.03, 0.0, 0.002 ) * rim * ( 1.0 - uInkGrey ) * smoothstep( 0.0, 0.3, uInk );
        }
        // The glitch's scanlines.
        if ( uGlitch > 0.001 ) mapped *= 1.0 - 0.18 * uGlitch * step( 0.5, fract( gl_FragCoord.y * 0.5 ) );
      }
      // Encode to sRGB here so FXAA (phone) works on perceptual values.
      mapped = mix( mapped * 12.92, 1.055 * pow( max( mapped, 0.0 ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, mapped ) );
      gl_FragColor = vec4( mapped, 1.0 );
    }`,
};

/**
 * Each slot's screen box for the grade (uv; min in xy, max in zw), from its place, size and drip: the splat's
 * cell turned any way fits in a circle of 0.34·size·0.71 of the height, and the drip moves it down 0.34·drip.
 * An empty slot's box is off screen.
 */
export function lensRects(lens: THREE.Vector4[], lensB: THREE.Vector4[], rects: THREE.Vector4[], aspect: number): void {
  for (let i = 0; i < 4; i++) {
    const L = lens[i]!;
    const r = rects[i]!;
    if (L.z <= 0.002) {
      r.set(2, 2, 2, 2);
      continue;
    }
    const h = 0.34 * L.w * 0.72;
    const dy = lensB[i]!.z * 0.34;
    r.set(L.x - h / aspect, L.y - dy - h, L.x + h / aspect, L.y - dy + h);
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
  // The wound's radial smear: desktop high and ultra only (S6.4; quality is "phone" | "high" | "ultra"). It
  // reuses the CA's three taps instead of six more fetches (DECISIONS 2026-10-18).
  grade.uniforms.uBlur!.value = quality === "phone" ? 0 : 1;
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
        const res = u.uRes!.value as THREE.Vector2;
        lensRects(L, u.uLensB!.value as THREE.Vector4[], u.uLensRect!.value as THREE.Vector4[], res.x / Math.max(1, res.y));
      };
      if (typeof on === "object") set(on.wound, on.hurt, on.pulse, on.lens);
      else set(on ? 1 : 0, on ? 0.6 : 0, on ? 0.8 : 0, on ? 1 : 0);
      const read = composer.readBuffer;
      const tmp = new THREE.WebGLRenderTarget(read.width, read.height);
      const px = new Uint8Array(4);
      grade.render(renderer, tmp, read, 0, false);
      renderer.readRenderTargetPixels(tmp, 0, 0, 1, 1, px);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        grade.render(renderer, tmp, read, 0, false);
        renderer.readRenderTargetPixels(tmp, 0, 0, 1, 1, px);
      }
      const ms = (performance.now() - t0) / Math.max(1, n);
      tmp.dispose();
      keys.forEach((k, i) => (u[k]!.value = saved[i]));
      (u.uLens!.value as THREE.Vector4[]).forEach((v, i) => v.copy(lens[i]!));
      const res = u.uRes!.value as THREE.Vector2;
      lensRects(u.uLens!.value as THREE.Vector4[], u.uLensB!.value as THREE.Vector4[], u.uLensRect!.value as THREE.Vector4[], res.x / Math.max(1, res.y));
      return ms;
    },
  };
}

