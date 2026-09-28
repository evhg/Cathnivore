// The landing page's full-screen animation: a patchwork of hexagonal fields at dusk, seen from a camera
// gliding low over it. Everything is drawn by one fragment shader, so it stays sharp at any resolution:
//
//  - the ground is a tilted plane cut into pointy-top hexes; each hex takes a crop colour from slow noise,
//  - rivers run along hex edges where a second noise field crosses a threshold,
//  - "wind" is a brighter band of noise sweeping across the fields,
//  - the pointer lifts and lights the tiles under it, and a tap sends out a ripple,
//  - on load the fields light up outwards from the middle of the view.
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

const float SQ3 = 1.7320508;

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

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}

// Pointy-top hex tiling with unit width. Returns local offset (xy) and cell centre (zw).
vec4 hexTile(vec2 p) {
  // Two rectangular lattices, the second offset by half a tile; the nearer centre wins.
  const vec2 s = vec2(1.0, SQ3);
  const vec2 off = vec2(0.5, SQ3 * 0.5);
  vec2 c1 = (floor(p / s) + 0.5) * s;
  vec2 c2 = (floor((p - off) / s) + 0.5) * s + off;
  vec2 h1 = p - c1;
  vec2 h2 = p - c2;
  return dot(h1, h1) < dot(h2, h2) ? vec4(h1, c1) : vec4(h2, c2);
}

float hexEdgeDist(vec2 l) {
  l = abs(l);
  return 0.5 - max(dot(l, vec2(0.5, SQ3 * 0.5)), l.x);
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
  vec2 drift = vec2(sin(uTime * 0.021) * 10.0, uTime * 0.9);
  vec2 g = vec2(dir.x * t, dir.z * t) + drift;
  return vec3(g, t);
}

float fieldBand(vec2 c) { return fbm(c * 0.11 + vec2(3.0, 7.0)); }
float riverField(vec2 c) { return fbm(c * 0.045 + vec2(uTime * 0.004, 40.0)); }

vec3 cropColourAt(float f, float k, float jitter) {
  vec3 deep = vec3(0.19, 0.30, 0.12);
  vec3 pasture = vec3(0.30, 0.44, 0.17);
  vec3 young = vec3(0.50, 0.60, 0.26);
  vec3 wheat = vec3(0.80, 0.62, 0.26);
  vec3 clay = vec3(0.64, 0.30, 0.18);
  vec3 soil = vec3(0.38, 0.25, 0.14);
  vec3 col;
  if (f < 0.4) col = mix(deep, pasture, k * 0.7);
  else if (f < 0.47) col = mix(pasture, young, k);
  else if (f < 0.53) col = mix(young, vec3(0.62, 0.66, 0.3), k);
  else if (f < 0.6) col = mix(wheat, vec3(0.88, 0.72, 0.34), k);
  else if (f < 0.66) col = mix(soil, clay, k * 0.7);
  else col = mix(pasture, deep, k);
  return col * jitter;
}

vec3 cropColour(vec2 c) {
  return cropColourAt(fieldBand(c), hash12(c * 1.37), 0.9 + 0.2 * hash12(c + 3.1));
}

// The average look of the fields around a point, without per-tile variation (for distant ground).
vec3 cropColourSmooth(vec2 p) {
  return cropColourAt(fieldBand(p), 0.5, 1.0);
}

vec3 sky(vec2 frag, float rayY) {
  float y = frag.y / uRes.y;
  float h = clamp((y - uHorizon) / (1.0 - uHorizon), 0.0, 1.0);
  vec3 top = vec3(0.10, 0.07, 0.13);
  vec3 mid = vec3(0.36, 0.17, 0.20);
  vec3 low = vec3(0.98, 0.62, 0.34);
  vec3 col = mix(low, mid, smoothstep(0.0, 0.45, h));
  col = mix(col, top, smoothstep(0.35, 1.0, h));
  // The sun, low and a little right of centre.
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

void main() {
  vec2 frag = gl_FragCoord.xy;
  float rayY;
  vec3 gp = groundAt(frag, rayY);
  vec3 skyCol = sky(frag, rayY);
  vec3 fogCol = vec3(0.93, 0.58, 0.36);

  if (gp.z < 0.0) {
    outColor = vec4(skyCol, 1.0);
    return;
  }

  vec2 p = gp.xy;
  float dist = gp.z;
  vec4 hx = hexTile(p);
  vec2 local = hx.xy;
  vec2 cell = hx.zw;
  float edge = hexEdgeDist(local);
  float px = fwidth(p.x) + fwidth(p.y);

  // Nearest edge and the neighbour across it.
  float ang = atan(local.y, local.x);
  float k = floor(ang / 1.0471976 + 0.5);
  vec2 n = vec2(cos(k * 1.0471976), sin(k * 1.0471976));
  vec2 nb = cell + n;

  vec3 col = cropColour(cell);
  // Far away, where tiles are only a few pixels wide, per-tile colours alias into stair-steps; fade to
  // the same colours sampled smoothly across the ground instead.
  float far = smoothstep(0.07, 0.3, px);
  if (far > 0.0) col = mix(col, cropColourSmooth(p), far);

  // Opening reveal: fields light up outwards from the view's centre line.
  vec2 viewCentre = vec2(sin(uTime * 0.021) * 10.0, uTime * 0.9) + vec2(0.0, 12.0);
  float rd = length(cell - viewCentre);
  float reveal = smoothstep(uReveal * 110.0 - 10.0, uReveal * 110.0, rd);
  float lit = 1.0 - reveal;

  // Wind: bright bands sweeping across the fields.
  float wind = vnoise(cell * 0.11 + vec2(uTime * 0.18, uTime * 0.05));
  wind = smoothstep(0.55, 0.9, wind);
  col *= 0.82 + 0.45 * wind;

  // Pointer: tiles near it rise into the light.
  float pr;
  vec3 pg = groundAt(uPointer, pr);
  float near = 0.0;
  if (pg.z > 0.0) near = exp(-length(cell - pg.xy) * 0.55) * uPointerOn;
  float tr;
  vec3 tg = groundAt(uTap, tr);
  float ring = 0.0;
  if (tg.z > 0.0 && uTapAge < 3.0) {
    float r = uTapAge * 7.0;
    ring = exp(-abs(length(cell - tg.xy) - r) * 1.3) * (1.0 - uTapAge / 3.0);
  }
  float lift = near + ring;
  col = mix(col, col * 1.5 + vec3(0.14, 0.1, 0.03), clamp(lift, 0.0, 1.0));

  // Tile bevel: the rim facing the sun catches light, the far rim drops into shadow.
  vec2 sunDir = normalize(vec2(0.35, 1.0));
  float rim = 1.0 - smoothstep(0.0, 0.085, edge);
  float facing = dot(n, sunDir);
  col *= 1.0 + rim * facing * 0.28;
  col *= 0.94 + 0.12 * smoothstep(0.0, 0.5, edge);

  // Grout lines between tiles, anti-aliased and fading out with distance.
  float grout = 1.0 - smoothstep(0.0, max(px * 1.2, 0.018), edge - 0.012);
  float detail = 1.0 - smoothstep(0.06, 0.2, px);
  col = mix(col, col * 0.45, grout * detail);

  // Rivers along hex edges where the river field crosses its threshold between two tiles.
  // Rivers only matter near a tile's edge, so most pixels skip the two noise lookups.
  float a = edge < 0.16 ? riverField(cell) - 0.5 : 0.0;
  float b = edge < 0.16 ? riverField(nb) - 0.5 : 0.0;
  if (a * b < 0.0) {
    float w = 0.07 + 0.03 * sin(uTime * 0.7 + cell.x);
    float river = 1.0 - smoothstep(w, w + max(px, 0.01), edge);
    // A shimmer running along the river.
    vec2 along = vec2(-n.y, n.x);
    float sh = 0.5 + 0.5 * sin(dot(p, along) * 9.0 - uTime * 3.0 + hash12(cell) * 6.0);
    vec3 water = mix(vec3(0.16, 0.43, 0.58), vec3(0.72, 0.9, 0.98), sh * 0.55);
    water = mix(water, vec3(1.0, 0.82, 0.6), 0.25); // reflected sunset
    col = mix(col, water, river * lit * (0.35 + 0.65 * detail));
    col += vec3(0.25, 0.45, 0.5) * exp(-edge * 18.0) * 0.35 * lit;
  }

  // Warm evening light and fog towards the horizon.
  col *= vec3(1.04, 0.98, 0.9);
  col = mix(col * 0.12, col, lit);
  // Fog by viewing angle: thick near the horizon, where tiles shrink below a pixel and would shimmer.
  float fog = exp(rayY * 7.5);
  col = mix(col, fogCol, clamp(fog, 0.0, 1.0));
  // Blend the horizon line softly into the sky.
  col = mix(col, skyCol, smoothstep(-0.03, -0.002, rayY));

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
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer.target = 0
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  window.addEventListener('pointerup', onUp)

  const start = performance.now()
  // Reduced motion shows one still, well-lit frame: fully revealed, mid-afternoon of the drift.
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
    gl!.uniform2f(uRes, width, height)
    gl!.uniform1f(uTime, t)
    gl!.uniform1f(uReveal, reducedMotion ? 1 : Math.min(1, easeOut(t / 2.8)))
    gl!.uniform2f(uPointer, pointer.x, pointer.y)
    gl!.uniform1f(uPointerOn, pointer.on)
    gl!.uniform2f(uTap, tap.x, tap.y)
    gl!.uniform1f(uTapAge, clock() - tap.at)
    gl!.uniform1f(uHorizon, horizon())
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    if (!reducedMotion) raf = requestAnimationFrame(frame)
  }

  function horizon(): number {
    // Portrait screens put the horizon higher so the title has sky and the cards have fields.
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    return aspect < 0.8 ? 0.6 : aspect < 1.2 ? 0.58 : 0.55
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
