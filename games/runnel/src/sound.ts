// ROADMAP 22: Runnel's synthesised sound set (no audio files). The context is only created on a tap, so
// the page stays silent until the player acts. The mute choice lives in localStorage, best-effort.
const KEY = 'runnel:sound'
let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem(KEY) === 'off'
} catch {
  /* storage blocked: default to sound on */
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(KEY, value ? 'off' : 'on')
  } catch {
    /* ignore */
  }
  if (value) stopMusic()
  else if (wanted) startMusic()
}

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, peak: number, slideTo?: number): void {
  const c = ctx
  if (!c) return
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function ready(): boolean {
  if (muted) return false
  const c = context()
  if (!c) return false
  if (c.state === 'suspended') void c.resume()
  return c.state === 'running' || c.state === 'suspended'
}

/** A soft wooden click for turning a tile. */
export function playTurn(): void {
  if (!ready()) return
  tone(420, 0, 0.06, 'triangle', 0.05, 300)
}

/** Water reaching new fields: a rising drip, higher the more of the farm is wet (0..1). */
export function playWater(newFields: number, fraction: number): void {
  if (!ready() || newFields <= 0) return
  const base = 500 + fraction * 500
  for (let i = 0; i < Math.min(newFields, 3); i++) tone(base * (1 + i * 0.25), 0.05 + i * 0.07, 0.16, 'sine', 0.04, base * 1.5)
}

/** A short pentatonic chime when the puzzle is solved. */
export function playWin(): void {
  if (!ready()) return
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.32, 'triangle', 0.06))
}

// N8: a quiet layered score. A warm pad is always there; a plucked pentatonic line joins as the farm gets
// wetter and a high shimmer joins near the end. Every note is scheduled a bar ahead from a short timer.
const SCALE = [0, 2, 4, 7, 9]
const ROOTS = [196, 174.6, 220, 164.8]
const BAR = 3.2
let wanted = false
let wetness = 0
let timer: number | undefined
let bar = 0
let nextBar = 0
let musicGain: GainNode | null = null

function note(freq: number, at: number, dur: number, type: OscillatorType, peak: number): void {
  const c = ctx
  if (!c || !musicGain) return
  const t0 = at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.4, dur / 3))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(musicGain)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

function scheduleBar(): void {
  const c = ctx
  if (!c || !musicGain) return
  const root = ROOTS[bar % ROOTS.length]
  const t = nextBar
  note(root / 2, t, BAR * 1.1, 'sine', 0.05)
  note(root, t, BAR * 1.1, 'triangle', 0.018)
  note(root * 1.5, t + 0.05, BAR, 'sine', 0.014)
  if (wetness > 0.25) {
    for (let i = 0; i < 4; i++) {
      const deg = SCALE[(bar * 2 + i * 3) % SCALE.length]
      note(root * 2 * 2 ** (deg / 12), t + i * (BAR / 4), 0.9, 'triangle', 0.02 * Math.min(1, wetness * 1.5))
    }
  }
  if (wetness > 0.7) note(root * 4 * 2 ** (SCALE[bar % SCALE.length] / 12), t + BAR / 2, 1.6, 'sine', 0.012)
  nextBar += BAR
  bar++
}

function startMusic(): void {
  if (timer !== undefined || muted || !ready() || !ctx) return
  musicGain = ctx.createGain()
  musicGain.gain.setValueAtTime(0.0001, ctx.currentTime)
  musicGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2.5)
  musicGain.connect(ctx.destination)
  nextBar = ctx.currentTime + 0.1
  scheduleBar()
  timer = window.setInterval(() => {
    if (ctx && nextBar - ctx.currentTime < BAR) scheduleBar()
  }, 500)
}

function stopMusic(): void {
  if (timer !== undefined) window.clearInterval(timer)
  timer = undefined
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime)
    musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15)
  }
  musicGain = null
}

/** Start the score (call from a player tap). */
export function playMusic(): void {
  wanted = true
  startMusic()
}

/** How wet the farm is, 0..1: more of the score plays as the water spreads. */
export function setMusicLevel(fraction: number): void {
  wetness = Math.max(0, Math.min(1, fraction))
}
