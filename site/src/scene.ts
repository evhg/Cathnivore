// The landing page's full-screen animation: Marrow's market square at dusk, seen across the cobbles (plan item
// 299). Everything is drawn by one fragment shader, so it stays sharp at any resolution:
//
//  - a sunset sky with a few stars, the sun low on the right,
//  - two rows of houses on the horizon as parallax layers: far rooftops in the haze with lit windows, and nearer
//    gabled shopfronts with striped awnings (Cathnivore's stall colours), lit shop windows and upper windows,
//  - strings of bunting and paper lanterns across the square, in front of the shopfronts,
//  - wet cobbles below, with the lanterns, shopfronts and sky mirrored in the puddles,
//  - the pointer shifts the two rows apart (parallax) and warms the lanterns under it, a tap sends a flare along
//    them, and on load the windows and lanterns light up outwards from the middle of the view.
//
// Resolution adapts to the device: the canvas is capped at about 2.4 million pixels and steps down if
// frames run slow, so an iPhone at 3x and a 5K desktop both hold a smooth frame rate.

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uReveal;     // 0 -> 1 during the opening
uniform vec2 uPointer;     // pointer in pixels (y up), or far away when absent
uniform float uPointerOn;  // 0..1, eases in and out
uniform vec2 uTap;         // last tap position in pixels (y up)
uniform float uTapAge;     // seconds since the last tap
uniform float uHorizon;    // horizon height as a share of the screen from the bottom
uniform float uLook;       // -1..1, the pointer's eased sideways position (parallax)

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Camera: returns the ground point under a screen pixel, and the ray length (for fog). t < 0 means sky.
vec3 groundAt(vec2 frag, out float rayY) {
  vec2 uv = (frag - vec2(0.5 * uRes.x, uHorizon * uRes.y)) / uRes.y;
  float camH = 3.2;
  float focal = 1.15;
  vec3 dir = normalize(vec3(uv.x, uv.y - 0.03, focal));
  rayY = dir.y;
  if (dir.y > -0.002) return vec3(0.0, 0.0, -1.0);
  float t = camH / -dir.y;
  vec2 drift = vec2(uLook * 0.6, 0.0);
  vec2 g = vec2(dir.x * t, dir.z * t) + drift;
  return vec3(g, t);
}

vec3 sky(vec2 frag, float rayY) {
  float y = frag.y / uRes.y;
  float h = clamp((y - uHorizon) / (1.0 - uHorizon), 0.0, 1.0);
  vec3 top = vec3(0.10, 0.07, 0.13);
  vec3 mid = vec3(0.36, 0.17, 0.20);
  vec3 low = vec3(0.98, 0.62, 0.34);
  vec3 col = mix(low, mid, smoothstep(0.0, 0.45, h));
  col = mix(col, top, smoothstep(0.35, 1.0, h));
  // The sun, half set, off to the right so it never sits behind the text.
  vec2 sp = vec2(0.5 * uRes.x + min(0.55 * uRes.y, 0.3 * uRes.x), (uHorizon + 0.004) * uRes.y);
  float d = length(frag - sp) / uRes.y;
  col += vec3(1.0, 0.66, 0.36) * (0.6 * exp(-d * 10.0) + 0.25 * exp(-d * 2.8));
  float disc = smoothstep(0.036, 0.031, d);
  col = mix(col, vec3(1.25, 1.12, 0.9), disc);
  // A few stars in the dark upper sky.
  vec2 sg = floor(frag / 3.0);
  float star = step(0.9975, hash12(sg)) * smoothstep(0.45, 0.95, h);
  star *= 0.5 + 0.5 * sin(uTime * (1.0 + hash12(sg + 1.0) * 2.0) + hash12(sg) * 20.0);
  col += star * 0.8;
  return col;
}

const vec3 LAMP = vec3(1.0, 0.72, 0.38);
const vec3 CREAM = vec3(0.95, 0.87, 0.72);

// Screen point in height units, x from the screen's centre, y from the bottom.
float sq(float v) { return v * v; }

vec2 toS(vec2 frag) { return vec2((frag.x - 0.5 * uRes.x) / uRes.y, frag.y / uRes.y); }

// Lights come on outwards from the middle of the view as the opening plays; h staggers them.
float lightOn(float h, float x) {
  float th = 0.12 + 0.55 * h + 0.3 * min(abs(x), 1.0);
  return smoothstep(th, th + 0.08, uReveal * 1.05);
}

vec3 paint(float h) {
  if (h < 0.34) return vec3(0.78, 0.25, 0.18); // tomato red
  if (h < 0.67) return vec3(0.33, 0.50, 0.26); // leaf green
  return vec3(0.87, 0.62, 0.22);               // mustard
}

// The far row: low rooftops in the haze, a few chimneys, small lit windows. rgb, coverage.
vec4 farRow(vec2 s, float aa) {
  float x = s.x + uLook * 0.012 + uTime * 0.0015;
  float w = 0.06;
  float ci = floor(x / w);
  float fx = fract(x / w);
  float h1 = hash12(vec2(ci, 3.0));
  float top = uHorizon + 0.04 + 0.08 * h1;
  float roof = top;
  if (h1 > 0.4) roof += 0.03 * (1.0 - abs(2.0 * fx - 1.0));
  if (hash12(vec2(ci, 7.0)) > 0.55 && fx > 0.62 && fx < 0.74) roof = max(roof, top + 0.026);
  float cov = smoothstep(roof + aa, roof, s.y);
  vec3 col = vec3(0.30, 0.16, 0.19);
  float ry = (s.y - uHorizon - 0.008) / 0.021;
  float row = floor(ry);
  float fy = fract(ry);
  float side = step(0.5, fx);
  float wx = fract(fx * 2.0);
  float win = step(0.32, wx) * step(wx, 0.68) * step(0.3, fy) * step(fy, 0.72) * step(0.0, row) * step(s.y, top - 0.008);
  float hw = hash12(vec2(ci * 3.0 + side, row + 11.0));
  float lit = step(0.5, hw) * lightOn(hw, s.x);
  col = mix(col, vec3(0.98, 0.66, 0.34), win * lit * 0.8);
  return vec4(col, cov);
}

// The near row: gabled shopfronts with an awning, a lit shop window and upper windows. rgb, coverage.
vec4 nearRow(vec2 s, float aa) {
  float hz = uHorizon;
  float x = s.x + uLook * 0.035 + uTime * 0.003;
  float w = 0.15;
  float ci = floor(x / w);
  float fx = fract(x / w);
  float h1 = hash12(vec2(ci, 21.0));
  float h2 = hash12(vec2(ci, 22.0));
  float cx = abs(2.0 * fx - 1.0);
  float top = hz + 0.13 + 0.1 * h1;
  float roof;
  if (h2 < 0.45) roof = top + 0.065 * (1.0 - cx);                         // a gable facing the square
  else if (h2 < 0.8) roof = top + 0.065 * floor((1.0 - cx) * 4.0) / 4.0;  // a stepped gable
  else roof = top + 0.012 * step(cx, 0.94);                               // flat, with a parapet
  float house = step(0.025, fx) * step(fx, 0.975);
  float cov = house * smoothstep(roof + aa, roof, s.y);
  vec3 body = mix(vec3(0.16, 0.085, 0.10), vec3(0.22, 0.12, 0.12), h1);
  vec3 col = body;
  // The setting sun on the right catches each house's right edge and its roofline.
  col += vec3(0.42, 0.2, 0.09) * smoothstep(0.9, 0.972, fx);
  col += vec3(0.5, 0.25, 0.1) * smoothstep(roof - 0.006, roof, s.y) * 0.6;

  // Shop window on the ground floor.
  float y = s.y - hz;
  float shop = step(0.12, fx) * step(fx, 0.88) * step(0.004, y) * step(y, 0.04);
  float hs = hash12(vec2(ci, 31.0));
  float shopLit = lightOn(hs * 0.6, s.x);
  vec3 inside = mix(vec3(0.12, 0.07, 0.08), vec3(1.0, 0.64, 0.32), shopLit);
  float bars = step(0.06, abs(fract(fx * 5.0) - 0.5) * 2.0 - 0.9 + 0.06); // mullions
  inside *= 1.0 - 0.6 * bars * step(fx, 0.86) * step(0.14, fx);
  col = mix(col, inside, shop);

  // The awning above it: stripes in the house's paint and cream, a sloped band and a scalloped hem.
  float af = fx * 14.0;
  float stripe = mod(floor(af), 2.0);
  float scal = 0.007 * sqrt(max(0.0, 1.0 - sq(2.0 * fract(af) - 1.0)));
  float aw = step(0.05, fx) * step(fx, 0.95) * step(0.042 - scal, y) * step(y, 0.066);
  vec3 awc = mix(paint(hash12(vec2(ci, 41.0))), CREAM, stripe);
  awc *= 0.72 + 0.35 * smoothstep(0.066, 0.044, y); // the slope darkens toward the wall
  col = mix(col, awc * 0.92, aw);

  // Upper windows: two or three across, a cross of glazing bars, lit or showing the sky.
  float cols = h2 < 0.5 ? 2.0 : 3.0;
  float ux = fract(fx * cols);
  float uc = floor(fx * cols);
  float ry = (y - 0.085) / 0.048;
  float row = floor(ry);
  float fy = fract(ry);
  float upper = step(0.3, ux) * step(ux, 0.7) * step(0.15, fy) * step(fy, 0.75) * step(0.0, row) * step(s.y, top - 0.012);
  float hw = hash12(vec2(ci * 5.0 + uc, row + 51.0));
  float uLit = step(0.45, hw) * lightOn(hw, s.x);
  vec3 glass = mix(vec3(0.27, 0.15, 0.19), vec3(1.0, 0.7, 0.38), uLit);
  float crs = step(abs(ux - 0.5), 0.012) + step(abs(fy - 0.45), 0.03);
  glass *= 1.0 - 0.55 * clamp(crs, 0.0, 1.0);
  col = mix(col, glass, upper);
  return vec4(col, cov);
}

// The string of bunting and the string of lanterns, hung from house to house. rgb, coverage; glow is the lanterns'
// light at s (also used for their reflections in the cobbles).
vec4 strings(vec2 s, float aa, out float glow) {
  float hz = uHorizon;
  float x = s.x + uLook * 0.035 + uTime * 0.003;
  float w = 0.15;
  vec2 ps = toS(uPointer);
  vec2 ts = toS(uTap);
  vec4 o = vec4(0.0);

  // Bunting: a sagging line from one house's middle to the next, flags hanging off it.
  float f = fract(x / w + 0.5);
  float ys = hz + 0.112 - 0.032 * (1.0 - sq(2.0 * f - 1.0));
  float line = smoothstep(aa * 1.2, 0.0, abs(s.y - ys));
  float fw = w / 9.0;
  float fi = floor(x / fw);
  float fl = fract(x / fw);
  float flagLen = 0.017 * (1.0 - abs(2.0 * fl - 1.0) / 0.8);
  float flutter = 0.0012 * sin(uTime * 2.3 + fi * 1.7);
  float flag = step(0.1, fl) * step(fl, 0.9) * step(ys - flagLen + flutter, s.y) * step(s.y, ys);
  vec3 fc = mod(fi, 2.0) < 1.0 ? CREAM : paint(hash12(vec2(fi, 61.0)));
  o = mix(o, vec4(fc * 0.9, 1.0), flag);
  o = mix(o, vec4(0.12, 0.08, 0.08, 1.0), line * 0.85);

  // Lanterns: a deeper line, a paper lantern every quarter house; the nearest three light this pixel.
  float f2 = fract(x / w);
  float y2 = hz + 0.15 - 0.04 * (1.0 - sq(2.0 * f2 - 1.0));
  o = mix(o, vec4(0.12, 0.08, 0.08, 1.0), smoothstep(aa * 1.2, 0.0, abs(s.y - y2)) * 0.85);
  float lw = w / 4.0;
  float li = floor(x / lw);
  glow = 0.0;
  for (int k = -1; k <= 1; k++) {
    float idx = li + float(k);
    float lx = (idx + 0.5) * lw;
    float lf = fract(lx / w);
    float ly = hz + 0.15 - 0.04 * (1.0 - sq(2.0 * lf - 1.0)) - 0.011;
    float hl = hash12(vec2(idx, 71.0));
    float on = lightOn(hl * 0.8, lx);
    // where this lantern is on screen (undo the layer's offset) for the pointer and the tap
    vec2 screenL = vec2(lx - uLook * 0.035 - uTime * 0.003, ly);
    float warm = 1.0 + 1.4 * exp(-length(screenL - ps) * 9.0) * uPointerOn;
    if (uTapAge < 3.0) warm += 2.5 * exp(-abs(length(screenL - ts) - uTapAge * 0.7) * 22.0) * (1.0 - uTapAge / 3.0);
    float flick = 0.92 + 0.08 * sin(uTime * (3.0 + hl * 3.0) + hl * 30.0);
    vec2 d = vec2(x - lx, (s.y - ly) * 0.85);
    float r = length(d);
    float bodyR = 0.0062;
    float lamp = smoothstep(bodyR + aa, bodyR, r);
    vec3 paper = mix(vec3(0.85, 0.24, 0.14), vec3(0.95, 0.6, 0.2), step(0.5, hl));
    vec3 lit = mix(paper * 0.35, mix(paper, vec3(1.0, 0.9, 0.7), 0.55) * 1.35, on);
    lit *= 0.85 + 0.25 * smoothstep(bodyR, 0.0, abs(d.x) * 1.4); // rounder in the middle
    o = mix(o, vec4(lit * min(warm, 1.6), 1.0), lamp);
    glow += on * flick * warm * (0.55 * exp(-r * 70.0) + 0.18 * exp(-r * 16.0));
  }
  return o;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float rayY;
  vec3 gp = groundAt(frag, rayY);
  vec3 skyCol = sky(frag, rayY);
  vec2 s = toS(frag);
  float aa = 1.2 / uRes.y;
  vec3 haze = vec3(0.86, 0.5, 0.33);
  float glow;

  if (gp.z < 0.0) {
    vec3 col = skyCol;
    vec4 far = farRow(s, aa);
    col = mix(col, mix(far.rgb, haze, 0.38), far.a);
    vec4 near = nearRow(s, aa);
    col = mix(col, near.rgb, near.a);
    vec4 st = strings(s, aa, glow);
    col = mix(col, st.rgb, st.a);
    col += LAMP * glow;
    // A warm haze where the square meets the houses.
    col = mix(col, haze, 0.18 * exp(-(s.y - uHorizon) * 60.0));
    outColor = vec4(col, 1.0);
    return;
  }

  // The cobbles: offset rows of rounded stones on the ground plane.
  vec2 g = gp.xy;
  float dist = gp.z;
  float px = fwidth(g.x) + fwidth(g.y);
  vec2 size = vec2(0.42, 0.3);
  float r = floor(g.y / size.y);
  float u = g.x / size.x + 0.5 * mod(r, 2.0);
  vec2 cell = vec2(floor(u), r);
  vec2 l = vec2(fract(u), fract(g.y / size.y));
  float e = min(min(l.x, 1.0 - l.x) * size.x, min(l.y, 1.0 - l.y) * size.y);
  float hc = hash12(cell * 1.31);
  vec3 stone = mix(vec3(0.27, 0.21, 0.2), vec3(0.4, 0.31, 0.26), hc);
  float detail = 1.0 - smoothstep(0.05, 0.18, px);
  stone *= mix(1.0, 0.82 + 0.3 * smoothstep(0.0, 0.12, e), detail);
  float mortar = 1.0 - smoothstep(0.0, max(px * 1.2, 0.025), e - 0.02);
  vec3 col = mix(stone, stone * 0.4, mortar * detail);

  // Puddles: wet stones go dark and mirror the lanterns, the shop windows and the sky.
  float wet = smoothstep(0.56, 0.72, vnoise(g * 0.2 + vec2(5.0, 1.0)));
  wet = max(wet, 0.3 * (1.0 - detail));
  // a reflection is strongest near the houses and fades toward the viewer
  float depth = uHorizon - s.y;
  wet *= 0.3 + 0.7 * exp(-depth * 5.0);
  vec2 m = vec2(s.x, 2.0 * uHorizon - s.y);
  // a reflection is smeared down the wet ground, more the closer it is
  float smear = 1.0 + 3.0 * depth;
  vec2 mr = vec2(m.x, uHorizon + (m.y - uHorizon) / smear);
  float rg;
  vec4 rs = strings(mr, aa * 4.0, rg);
  vec4 rn = nearRow(mr, aa * 4.0);
  vec3 refl = mix(sky(vec2(frag.x, (2.0 * uHorizon - s.y) * uRes.y), -rayY), rn.rgb, rn.a);
  refl = mix(refl, rs.rgb, rs.a) + LAMP * rg;
  col = mix(col * 0.95, mix(col * 0.45, refl * 0.75, 0.7), wet);
  // Even the dry stones catch a little of the lanterns' light.
  col += LAMP * rg * 0.25 * (1.0 - wet);

  // The square darkens toward the viewer, and meets the houses in a warm haze.
  float near = smoothstep(0.0, uHorizon, s.y);
  col *= 0.55 + 0.5 * near;
  float fog = exp(rayY * 9.0);
  col = mix(col, haze * 0.85, clamp(fog, 0.0, 1.0) * 0.6);
  outColor = vec4(col, 1.0);
}
`

export interface SceneHandle {
  stop(): void
}

export function startScene(canvas: HTMLCanvasElement, reducedMotion: boolean): SceneHandle | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) return null

  let program = link(gl, VERT, FRAG)
  if (!program) return null
  let buf: WebGLBuffer | null = null
  let uRes: WebGLUniformLocation | null = null
  let uTime: WebGLUniformLocation | null = null
  let uReveal: WebGLUniformLocation | null = null
  let uPointer: WebGLUniformLocation | null = null
  let uPointerOn: WebGLUniformLocation | null = null
  let uTap: WebGLUniformLocation | null = null
  let uTapAge: WebGLUniformLocation | null = null
  let uHorizon: WebGLUniformLocation | null = null
  let uLook: WebGLUniformLocation | null = null

  // Binds every GL resource against the *current* context: called once up front, and again after
  // `webglcontextrestored` since a context loss invalidates the program, buffer and uniform locations
  // (but not the WebGL2RenderingContext object itself, which `gl` keeps pointing at).
  function setup(p: WebGLProgram): void {
    gl!.useProgram(p)
    buf = gl!.createBuffer()
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW)
    const loc = gl!.getAttribLocation(p, 'aPos')
    gl!.enableVertexAttribArray(loc)
    gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0)

    const u = (name: string) => gl!.getUniformLocation(p, name)
    uRes = u('uRes')
    uTime = u('uTime')
    uReveal = u('uReveal')
    uPointer = u('uPointer')
    uPointerOn = u('uPointerOn')
    uTap = u('uTap')
    uTapAge = u('uTapAge')
    uHorizon = u('uHorizon')
    uLook = u('uLook')
  }
  setup(program)

  const MAX_PIXELS = 2_400_000
  let quality = 1
  let width = 0
  let height = 0
  let scale = 1

  function resize(): void {
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    scale = Math.min(dpr, Math.sqrt(MAX_PIXELS / Math.max(1, cssW * cssH))) * quality
    width = Math.max(1, Math.round(cssW * scale))
    height = Math.max(1, Math.round(cssH * scale))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    gl!.viewport(0, 0, width, height)
  }

  const pointer = { x: -1e5, y: -1e5, on: 0, target: 0 }
  // The houses' parallax follows a mouse's sideways position, eased; touch leaves it still.
  const look = { x: 0, target: 0 }
  const tap = { x: -1e5, y: -1e5, at: -100 }
  const toCanvas = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: (e.clientX - r.left) * scale, y: (r.bottom - e.clientY) * scale }
  }
  const onMove = (e: PointerEvent) => {
    const p = toCanvas(e)
    pointer.x = p.x
    pointer.y = p.y
    pointer.target = e.pointerType === 'mouse' ? 1 : 0.7
    if (e.pointerType === 'mouse') look.target = Math.max(-1, Math.min(1, (p.x / Math.max(1, width) - 0.5) * 2))
  }
  const onDown = (e: PointerEvent) => {
    onMove(e)
    const p = toCanvas(e)
    tap.x = p.x
    tap.y = p.y
    tap.at = clock()
  }
  const onLeave = () => {
    pointer.target = 0
    look.target = 0
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer.target = 0
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  window.addEventListener('pointerup', onUp)

  const start = performance.now()
  // Reduced motion shows one still frame, fully revealed.
  const clock = () => (reducedMotion ? 40 : (performance.now() - start) / 1000)

  let raf = 0
  let frames = 0
  let slowFrames = 0
  let last = performance.now()
  let running = true

  function frame(now: number): void {
    if (!running) return
    const dt = now - last
    last = now
    // Adaptive quality: after warm-up, step resolution down while frames are slower than ~45 fps.
    if (!reducedMotion && ++frames > 30) {
      if (dt > 22) slowFrames++
      else slowFrames = Math.max(0, slowFrames - 1)
      if (slowFrames > 20 && quality > 0.45) {
        quality *= 0.82
        slowFrames = 0
        resize()
      }
    }
    const t = clock()
    pointer.on += (pointer.target - pointer.on) * 0.08
    look.x += (look.target - look.x) * 0.04
    gl!.uniform2f(uRes, width, height)
    gl!.uniform1f(uTime, t)
    gl!.uniform1f(uReveal, reducedMotion ? 1 : Math.min(1, easeOut(t / 2.8)))
    gl!.uniform2f(uPointer, pointer.x, pointer.y)
    gl!.uniform1f(uPointerOn, pointer.on)
    gl!.uniform2f(uTap, tap.x, tap.y)
    gl!.uniform1f(uTapAge, clock() - tap.at)
    gl!.uniform1f(uHorizon, horizon())
    gl!.uniform1f(uLook, look.x)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    if (!reducedMotion) raf = requestAnimationFrame(frame)
  }

  function horizon(): number {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    // Portrait screens put it lower, so the houses stand under the title and its quote, behind the stall.
    return aspect < 0.8 ? 0.5 : aspect < 1.2 ? 0.53 : 0.55
  }

  const ro = new ResizeObserver(() => {
    resize()
    if (reducedMotion) frame(performance.now())
  })
  ro.observe(canvas)
  resize()

  const onVisibility = () => {
    if (document.hidden) {
      running = false
      cancelAnimationFrame(raf)
    } else if (!running) {
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const onContextLost = (e: Event) => {
    // Without preventDefault() the browser never attempts to restore the context, so
    // 'webglcontextrestored' below would never fire (MDN).
    e.preventDefault()
    running = false
    cancelAnimationFrame(raf)
    document.documentElement.classList.add('no-webgl')
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const onContextRestored = () => {
    const restored = link(gl!, VERT, FRAG)
    if (!restored) return
    program = restored
    setup(program)
    resize()
    document.documentElement.classList.remove('no-webgl')
    if (!running && !document.hidden) {
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  raf = requestAnimationFrame(frame)

  return {
    stop() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      gl!.deleteBuffer(buf)
      gl!.deleteProgram(program)
    },
  }
}

function easeOut(x: number): number {
  const c = Math.max(0, Math.min(1, x))
  return 1 - Math.pow(1 - c, 3)
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(sh))
      gl.deleteShader(sh)
      return null
    }
    return sh
  }
  const v = compile(gl.VERTEX_SHADER, vs)
  const f = compile(gl.FRAGMENT_SHADER, fs)
  if (!v || !f) {
    if (v) gl.deleteShader(v)
    if (f) gl.deleteShader(f)
    return null
  }
  const p = gl.createProgram()!
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  // Shaders are copied into the program at link time (success or failure), so the standalone
  // objects can be freed either way instead of leaking one pair per `startScene` call.
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(p))
    gl.deleteProgram(p)
    return null
  }
  return p
}
