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
