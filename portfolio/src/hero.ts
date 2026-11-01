// The living field behind the hero: one WebGL2 fragment shader. Domain-warped noise is folded into
// silk-like ribbons of the studio's accents, a lattice of points drifts through it like seeds, and the
// pointer bends the flow. It renders at a reduced resolution (the look is soft anyway), caps the pixel
// ratio, stops when the hero is off screen or the tab is hidden, and draws one still frame with reduced
// motion. Without WebGL2 the page keeps its CSS glow.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;   // 0..1, y up
uniform float uPress;  // eased 0..1 while the pointer is near
uniform float uScroll; // 0 at top, 1 when the hero has scrolled away
out vec4 o;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);
  float t = uTime * 0.045;

  // The pointer is a gentle well the flow bends around.
  vec2 d = p - m;
  float well = exp(-dot(d, d) * 3.2) * (0.35 + 0.65 * uPress);
  p += normalize(d + 1e-4) * well * 0.18;

  // Two levels of domain warp.
  vec2 q = vec2(fbm(p * 1.4 + vec2(0.0, t)), fbm(p * 1.4 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 1.7 + 3.6 * q + vec2(1.7, 9.2) + t * 0.6), fbm(p * 1.7 + 3.6 * q + vec2(8.3, 2.8) - t * 0.5));
  float f = fbm(p * 1.2 + 3.0 * r);

  // Ribbons: thin bright folds where the warped field crosses evenly spaced levels.
  float bands = abs(fract(f * 5.0 + r.x * 1.5) - 0.5);
  float ribbon = smoothstep(0.09, 0.0, bands) * smoothstep(0.25, 0.75, f + 0.15);

  vec3 ink = vec3(0.027, 0.024, 0.043);
  vec3 violet = vec3(0.72, 0.64, 1.0);
  vec3 gold = vec3(0.96, 0.78, 0.45);
  vec3 teal = vec3(0.50, 0.85, 0.81);
  vec3 rose = vec3(1.0, 0.56, 0.64);

  vec3 hue = mix(violet, teal, smoothstep(0.2, 0.8, q.x));
  hue = mix(hue, gold, smoothstep(0.4, 0.8, r.y) * 0.9);
  hue = mix(hue, rose, smoothstep(0.75, 1.0, q.y) * 0.45);

  // Light falls off towards the left, where the headline sits, and towards the bottom.
  float stage = smoothstep(-0.25, 0.9, uv.x * 0.85 + uv.y * 0.3) * (0.6 + 0.4 * uv.y);
  vec3 col = ink;
  col += hue * pow(f, 2.0) * 0.62 * stage;
  col += hue * ribbon * 0.8 * stage;
  col += mix(violet, gold, uPress) * well * 0.16;

  // Seeds: a drifting lattice of points, brightest where the field is.
  vec2 g = (p + vec2(t * 0.6, -t * 0.25) + r * 0.08) * 28.0;
  vec2 cell = floor(g);
  vec2 jitter = vec2(hash(cell), hash(cell + 7.1)) - 0.5;
  float dist = length(fract(g) - 0.5 - jitter * 0.6);
  float seed = smoothstep(0.075, 0.0, dist) * step(0.62, hash(cell + 3.3));
  float twinkle = 0.5 + 0.5 * sin(uTime * 1.6 + hash(cell) * 40.0);
  col += mix(gold, teal, hash(cell + 1.9)) * seed * (0.25 + f * 0.9) * twinkle * stage;

  // Vignette, scroll fade, and dither so the gradients never band.
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.62, 0.55)) * vec2(aspect * 0.8, 1.0)));
  col = mix(ink, col, vig * (1.0 - uScroll * 0.85));
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`

export function startField(canvas: HTMLCanvasElement, reduced: boolean): boolean {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', depth: false })
  if (!gl) return false

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  let prog: WebGLProgram
  try {
    prog = gl.createProgram()!
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
  } catch {
    return false
  }
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const u = (n: string) => gl.getUniformLocation(prog, n)
  const uRes = u('uRes'), uTime = u('uTime'), uMouse = u('uMouse'), uPress = u('uPress'), uScroll = u('uScroll')

  // Pointer state, eased towards its target every frame.
  const mouse = { x: 0.72, y: 0.55, tx: 0.72, ty: 0.55, press: 0, tp: 0 }
  addEventListener(
    'pointermove',
    (e) => {
      mouse.tx = e.clientX / innerWidth
      mouse.ty = 1 - e.clientY / canvas.clientHeight
      mouse.tp = 1
    },
    { passive: true },
  )
  document.addEventListener('pointerleave', () => (mouse.tp = 0))

  const resize = () => {
    // The shader is soft: render it at about 60% of the screen's resolution and let the browser scale.
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * 0.6
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
  }

  const start = performance.now()
  let running = false
  let raf = 0
  const frame = (now: number) => {
    resize()
    mouse.x += (mouse.tx - mouse.x) * 0.06
    mouse.y += (mouse.ty - mouse.y) * 0.06
    mouse.press += (mouse.tp - mouse.press) * 0.04
    mouse.tp *= 0.985
    const scroll = Math.min(1, scrollY / Math.max(1, canvas.clientHeight))
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform1f(uTime, reduced ? 42 : (now - start) / 1000 + 42)
    gl.uniform2f(uMouse, mouse.x, mouse.y)
    gl.uniform1f(uPress, mouse.press)
    gl.uniform1f(uScroll, scroll)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (running && !reduced) raf = requestAnimationFrame(frame)
  }
  const play = () => {
    if (running) return
    running = true
    raf = requestAnimationFrame(frame)
  }
  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }

  let visible = true
  new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting
    if (visible && !document.hidden) play()
    else stop()
  }).observe(canvas.ownerDocument.querySelector('.hero') ?? canvas)
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : play()))
  addEventListener('resize', () => reduced && requestAnimationFrame(frame), { passive: true })
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    stop()
    canvas.classList.add('lost')
  })

  if (reduced) requestAnimationFrame(frame)
  else play()
  canvas.classList.add('on')
  return true
}
