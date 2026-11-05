// Plan item 145: posters that play. Each game's poster is its key-art still (`/work/games-<id>*.webp`); while it
// plays, a canvas over the still animates what the game is about: Runnel's water running from the spring, a
// Hedgerow convoy on the lane, Cathnivore's contested regions turning green, NIGHT SHIFT's rain and neon. One
// poster plays at a time (the hovered or focused one, else each poster in view in turn), none plays off-screen
// or in a hidden tab, they rest after 20 s with no input, and reduced motion keeps the stills. The canvas is made on a poster's first play and the
// loop starts after the page has loaded, so it never touches the first paint (LCP).
//
// Every loop draws in the key art's own pixel space (960 x 600, the 16:10 frame `scripts/keyart.mjs` shoots),
// mapped onto the poster the way its <img> is (object-fit: cover, centred).

export type PosterGame = 'cathnivore' | 'runnel' | 'hedgerow' | 'nightshift'
type Pt = readonly [number, number]
type Loop = (g: CanvasRenderingContext2D, t: number) => void

const ART_W = 960
const ART_H = 600

/** Points along a polyline: the position and heading `d` px from its start (wrapping round its length). */
function along(path: readonly Pt[], d: number): { x: number; y: number; a: number; len: number } {
  const segs = path.slice(1).map((b, i) => {
    const a = path[i] ?? b
    return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }
  })
  const len = segs.reduce((n, s) => n + s.len, 0)
  let rest = ((d % len) + len) % len
  for (const s of segs) {
    if (rest <= s.len) {
      const k = rest / s.len
      return { x: s.a[0] + (s.b[0] - s.a[0]) * k, y: s.a[1] + (s.b[1] - s.a[1]) * k, a: Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]), len }
    }
    rest -= s.len
  }
  const [x, y] = path[path.length - 1] ?? [0, 0]
  return { x, y, a: 0, len }
}

function polyline(g: CanvasRenderingContext2D, path: readonly Pt[]): void {
  g.beginPath()
  path.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
}

// Runnel: the river runs down from the spring house, and water pulses out of the spring along its channels.
const RIVER: Pt[] = [[132, 84], [140, 112], [118, 160], [76, 228], [52, 320], [60, 420], [104, 494], [190, 532], [330, 540], [430, 540]]
const CHANNELS: Pt[][] = [
  [[480, 295], [563, 295], [645, 295], [728, 295]],
  [[480, 295], [440, 368], [355, 368], [272, 368]],
  [[480, 295], [520, 368], [480, 440], [520, 510]],
  [[480, 295], [440, 223], [480, 150], [520, 80]],
]
const SPRING: Pt = [480, 295]
const runnel: Loop = (g, t) => {
  g.lineCap = 'round'
  polyline(g, RIVER)
  g.strokeStyle = 'rgba(214, 244, 255, 0.85)'
  g.lineWidth = 3
  g.setLineDash([10, 26])
  g.lineDashOffset = -t * 46
  g.stroke()
  g.setLineDash([])
  for (let i = 0; i < 2; i++) {
    const k = (t / 1.8 + i / 2) % 1
    g.beginPath()
    g.arc(SPRING[0], SPRING[1], 14 + 34 * k, 0, Math.PI * 2)
    g.strokeStyle = `rgba(222, 246, 255, ${0.8 * (1 - k)})`
    g.lineWidth = 3
    g.stroke()
  }
  CHANNELS.forEach((path, i) => {
    const run = along(path, 0)
    const k = (t / 2.6 + i * 0.25) % 1
    for (let j = 0; j < 6; j++) {
      const p = along(path, Math.max(0, k * run.len - j * 7))
      g.beginPath()
      g.arc(p.x, p.y, 5 - j * 0.7, 0, Math.PI * 2)
      g.fillStyle = `rgba(236, 250, 255, ${(0.95 - j * 0.15) * Math.min(1, (1 - k) * 4)})`
      g.fill()
    }
  })
}

// Hedgerow: a convoy of the corporation's vans winds up the lane from the Hollowell gate toward the farmhouse,
// and the scarecrows' Marks rise as they pass.
const LANE: Pt[] = [[582, 610], [582, 462], [480, 462], [480, 365], [378, 365], [378, 570], [272, 570], [272, 148], [582, 148], [582, 362], [688, 362], [688, 48], [600, 48]]
function van(g: CanvasRenderingContext2D, x: number, y: number, a: number, body: string): void {
  g.save()
  g.translate(x, y)
  g.rotate(a)
  g.fillStyle = 'rgba(20, 28, 40, 0.28)'
  g.beginPath()
  g.roundRect(-17, -8, 36, 22, 5)
  g.fill()
  g.fillStyle = body
  g.beginPath()
  g.roundRect(-18, -11, 36, 22, 5)
  g.fill()
  g.fillStyle = '#f4f1e8'
  g.fillRect(-12, -6, 18, 12)
  g.fillStyle = '#9fd3f0'
  g.fillRect(10, -8, 5, 16)
  g.fillStyle = '#7a5cc8'
  g.beginPath()
  g.arc(-3, 0, 3, 0, Math.PI * 2)
  g.fill()
  g.restore()
}
const hedgerow: Loop = (g, t) => {
  const bodies = ['#2d3d7c', '#33468c', '#2d3d7c', '#f2efe6']
  // The convoy enters at the gate and runs the lane in about 14 s, then the next one comes.
  const run = (t * 150) % (along(LANE, 0).len + 4 * 46)
  for (let i = 0; i < 4; i++) {
    const d = run - i * 46
    if (d < 0 || d > along(LANE, 0).len - 20) continue
    const p = along(LANE, d)
    van(g, p.x, p.y, p.a, bodies[i] ?? '#2d3d7c')
  }
  for (const [x, y, phase] of [[480, 262, 0], [632, 262, 0.5], [428, 362, 0.25]] as const) {
    const k = (t / 2.2 + phase) % 1
    g.font = '700 22px system-ui, sans-serif'
    g.textAlign = 'center'
    g.lineWidth = 4
    g.strokeStyle = `rgba(60, 42, 10, ${0.8 * (1 - k)})`
    g.strokeText('+2', x, y - 30 * k)
    g.fillStyle = `rgba(255, 214, 90, ${1 - k})`
    g.fillText('+2', x, y - 30 * k)
  }
}

// Cathnivore: the four contested regions turn from the corporation's red to the co-op's green, one after
// another, the way a good round plays.
const REGIONS: Pt[] = [[362, 130], [580, 130], [680, 302], [580, 472]]
function hex(g: CanvasRenderingContext2D, [cx, cy]: Pt, r: number): void {
  g.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
}
const cathnivore: Loop = (g, t) => {
  const beat = 2.4
  const turn = Math.floor(t / beat) % (REGIONS.length + 1)
  const k = (t % beat) / beat
  REGIONS.forEach((c, i) => {
    let amount = i < turn ? 1 : i === turn ? Math.min(1, k * 2.2) : 0
    if (turn === REGIONS.length) amount = 1 - k // all green, then the board resets
    if (amount <= 0) return
    hex(g, c, 104)
    g.fillStyle = `rgba(118, 176, 86, ${0.32 * amount})`
    g.fill()
    g.strokeStyle = `rgba(74, 140, 60, ${amount})`
    g.lineWidth = 9
    g.stroke()
    if (i === turn && k < 0.6) {
      // The flip's ring of sparks.
      for (let s = 0; s < 10; s++) {
        const a = (s / 10) * Math.PI * 2 + i
        const r = 40 + k * 120
        g.beginPath()
        g.arc(c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.9, 4 * (1 - k), 0, Math.PI * 2)
        g.fillStyle = `rgba(255, 236, 150, ${1 - k / 0.6})`
        g.fill()
      }
    }
  })
}

// NIGHT SHIFT: rain sheets down through the street and the neon flickers.
const SIGNS: { at: Pt; r: number; hue: string; seed: number }[] = [
  { at: [256, 100], r: 46, hue: '120, 255, 170', seed: 1 },
  { at: [346, 168], r: 40, hue: '255, 190, 90', seed: 2 },
  { at: [638, 166], r: 44, hue: '200, 140, 255', seed: 3 },
  { at: [520, 96], r: 70, hue: '120, 230, 255', seed: 4 },
  { at: [668, 168], r: 34, hue: '230, 240, 255', seed: 5 },
]
const DROPS = Array.from({ length: 130 }, (_, i) => ({ x: (i * 397) % 1060 - 50, y: (i * 211) % 600, v: 780 + ((i * 53) % 260), l: 14 + ((i * 7) % 16) }))
function flicker(t: number, seed: number): number {
  const n = Math.sin(t * 13.1 * seed) * Math.sin(t * 7.3 + seed * 2.1)
  const out = Math.sin(t * 0.9 + seed * 1.7) > 0.93 ? 0.15 : 1 // a tube that drops out now and then
  return (0.55 + 0.45 * n) * out
}
const nightshift: Loop = (g, t) => {
  g.globalCompositeOperation = 'lighter'
  for (const s of SIGNS) {
    const f = flicker(t, s.seed)
    const glow = g.createRadialGradient(s.at[0], s.at[1], 0, s.at[0], s.at[1], s.r * 1.6)
    glow.addColorStop(0, `rgba(${s.hue}, ${0.42 * f})`)
    glow.addColorStop(1, `rgba(${s.hue}, 0)`)
    g.fillStyle = glow
    g.fillRect(s.at[0] - s.r * 1.6, s.at[1] - s.r * 1.6, s.r * 3.2, s.r * 3.2)
  }
  // The wet road's reflection shimmers under the big screen.
  const sh = 0.5 + 0.5 * Math.sin(t * 5)
  const pool = g.createRadialGradient(518, 395, 0, 518, 395, 70)
  pool.addColorStop(0, `rgba(120, 230, 255, ${0.12 + 0.12 * sh})`)
  pool.addColorStop(1, 'rgba(120, 230, 255, 0)')
  g.fillStyle = pool
  g.fillRect(440, 320, 160, 150)
  g.globalCompositeOperation = 'source-over'
  g.strokeStyle = 'rgba(200, 220, 255, 0.42)'
  g.lineWidth = 1.6
  g.beginPath()
  for (const d of DROPS) {
    const y = (d.y + t * d.v) % (ART_H + 40) - 20
    const x = d.x + y * 0.12
    g.moveTo(x, y)
    g.lineTo(x + d.l * 0.12, y + d.l)
  }
  g.stroke()
}

export const POSTER_LOOPS: Record<PosterGame, Loop> = { cathnivore, runnel, hedgerow, nightshift }

export type PosterEntry = {
  /** The element that gets `data-playing` and takes hover and focus (the poster's link or card). */
  poster: HTMLElement
  /** The box the still fills (object-fit: cover); the canvas goes in here, right over the <img>. */
  art: HTMLElement
  game: PosterGame
}

/** Starts the poster loops. Returns a stop function (used by tests and page teardown). */
export function startPosterPlay(entries: PosterEntry[], opts: { turn?: number; delay?: number; idle?: number } = {}): () => void {
  if (!entries.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const turnMs = opts.turn ?? 5200
  // Like the portfolio's field (critique 2026-11-03), the loops rest when nobody is there, so the page goes idle.
  const idleMs = opts.idle ?? 20000
  let lastInput = performance.now()
  const visible = new Set<PosterEntry>()
  const canvases = new Map<PosterEntry, CanvasRenderingContext2D>()
  let pointed: PosterEntry | null = null
  let playing: PosterEntry | null = null
  let started = 0
  let rotation = 0
  let lastTurn = 0
  let frame = 0
  let lastDraw = 0
  let lastPick = 0
  let live = false
  let stopped = false

  const ctxFor = (e: PosterEntry): CanvasRenderingContext2D | null => {
    let g = canvases.get(e)
    if (g) return g
    const canvas = document.createElement('canvas')
    canvas.className = 'poster-loop'
    canvas.setAttribute('aria-hidden', 'true')
    const img = e.art.querySelector('img')
    if (img) img.after(canvas)
    else e.art.prepend(canvas)
    g = canvas.getContext('2d') ?? undefined
    if (!g) return null
    canvases.set(e, g)
    return g
  }

  const setPlaying = (next: PosterEntry | null) => {
    if (next === playing) return
    if (playing) {
      delete playing.poster.dataset.playing
      canvases.get(playing)?.canvas.classList.remove('on')
    }
    playing = next
    if (next) {
      const g = ctxFor(next)
      if (!g) return setPlaying(null)
      next.poster.dataset.playing = next.game
      started = performance.now()
      requestAnimationFrame(() => g.canvas.classList.add('on'))
      if (!frame) frame = requestAnimationFrame(draw)
    }
  }

  const choose = (now: number) => {
    if (!live || document.hidden || now - lastInput > idleMs) return setPlaying(null)
    if (pointed && visible.has(pointed)) return setPlaying(pointed)
    if (now - lastPick < 250 && playing) return
    lastPick = now
    // A card faded out (the portfolio's phone stack cycles its prints) counts as out of view.
    const shown = (e: PosterEntry) => visible.has(e) && Number(getComputedStyle(e.poster).opacity) > 0.5
    const inView = entries.filter(shown)
    if (!inView.length) return setPlaying(null)
    if (!playing || !shown(playing) || now - lastTurn > turnMs) {
      if (playing && shown(playing)) rotation++
      lastTurn = now
      setPlaying(inView[rotation % inView.length] ?? null)
    }
  }

  function draw(now: number): void {
    frame = 0
    if (stopped) return
    choose(now)
    if (!playing) return
    frame = requestAnimationFrame(draw)
    if (now - lastDraw < 33) return // 30 fps is plenty for a poster
    lastDraw = now
    const g = canvases.get(playing)
    if (!g) return
    const box = { width: playing.art.clientWidth, height: playing.art.clientHeight }
    const dpr = Math.min(2, devicePixelRatio || 1)
    const w = Math.max(1, Math.round(box.width * dpr))
    const h = Math.max(1, Math.round(box.height * dpr))
    if (g.canvas.width !== w || g.canvas.height !== h) {
      g.canvas.width = w
      g.canvas.height = h
    }
    // object-fit: cover, centred: the art's scale and offset inside the box.
    const s = Math.max(w / ART_W, h / ART_H)
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, w, h)
    g.setTransform(s, 0, 0, s, (w - ART_W * s) / 2, (h - ART_H * s) / 2)
    POSTER_LOOPS[playing.game](g, (now - started) / 1000)
  }

  const wake = () => {
    if (!frame && !stopped) frame = requestAnimationFrame(draw)
  }
  const io = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        const e = entries.find((x) => x.poster === r.target)
        if (!e) continue
        if (r.isIntersecting && r.intersectionRatio >= 0.6) visible.add(e)
        else visible.delete(e)
      }
      if (playing && !visible.has(playing)) setPlaying(null)
      wake()
    },
    { threshold: [0, 0.6, 1] },
  )
  const off: (() => void)[] = []
  for (const e of entries) {
    io.observe(e.poster)
    const on = () => {
      pointed = e
      wake()
    }
    const leave = () => {
      if (pointed === e) pointed = null
      wake()
    }
    e.poster.addEventListener('pointerenter', on)
    e.poster.addEventListener('focusin', on)
    e.poster.addEventListener('pointerleave', leave)
    e.poster.addEventListener('focusout', leave)
    off.push(() => {
      e.poster.removeEventListener('pointerenter', on)
      e.poster.removeEventListener('focusin', on)
      e.poster.removeEventListener('pointerleave', leave)
      e.poster.removeEventListener('focusout', leave)
    })
  }
  const onVis = () => {
    if (document.hidden) setPlaying(null)
    wake()
  }
  document.addEventListener('visibilitychange', onVis)
  const onInput = () => {
    lastInput = performance.now()
    wake()
  }
  const inputs = ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart'] as const
  for (const ev of inputs) window.addEventListener(ev, onInput, { passive: true })
  const begin = () => window.setTimeout(() => {
    live = true
    lastTurn = lastInput = performance.now()
    wake()
  }, opts.delay ?? 1500)
  if (document.readyState === 'complete') begin()
  else window.addEventListener('load', begin, { once: true })

  return () => {
    stopped = true
    setPlaying(null)
    io.disconnect()
    off.forEach((f) => f())
    document.removeEventListener('visibilitychange', onVis)
    for (const ev of inputs) window.removeEventListener(ev, onInput)
  }
}
