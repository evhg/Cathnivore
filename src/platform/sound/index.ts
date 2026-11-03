import type { Action, GameEvent, GameState } from '../../engine/types'
import { loadSettings } from '../settings'
import { cueFor, type Cue } from './cues'
import { CUE_LENGTH, renderCue } from './synth'

// ROADMAP 19: a small synthesised WebAudio sound set, no audio files. Silent until the first tap: browsers
// only let an AudioContext run after a user gesture, so the context is created lazily on the first
// gesture-driven call and never before.
type Ctx = AudioContext

let ctx: Ctx | null = null

function getContext(): Ctx | null {
  if (typeof window === 'undefined') return null
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

// Any pointer press unlocks (creates and resumes) the context, so later game-driven sounds can play.
export function unlockAudioOnFirstTap(): void {
  if (typeof window === 'undefined') return
  // Plan item 53: with sound off no AudioContext is made at all; the first tap after it is turned on makes it.
  const unlock = (): void => {
    if (!loadSettings().sound) return
    window.removeEventListener('pointerdown', unlock)
    const c = getContext()
    if (c && c.state === 'suspended') void c.resume().then(syncAmbient)
    else syncAmbient()
  }
  window.addEventListener('pointerdown', unlock)
  // A soft tick on every button press, so menus feel tactile too (ROADMAP 19's UI-tap cue).
  window.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button, [role="button"], a')) play(SOUNDS.tap)
  })
}

interface Note {
  freq: number
  at: number // seconds after now
  dur: number
  type?: OscillatorType
  gain?: number
  slideTo?: number
}

function play(notes: Note[]): void {
  const st = loadSettings()
  if (!st.sound || !st.effects) return
  const c = ctx // never create a context outside a tap: stay silent until unlocked
  if (!c || c.state !== 'running') return
  const t0 = c.currentTime
  for (const n of notes) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.setValueAtTime(n.freq, t0 + n.at)
    if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur)
    const peak = Math.max(0.0002, (n.gain ?? 0.08) * st.volume)
    g.gain.setValueAtTime(0.0001, t0 + n.at)
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
    osc.connect(g).connect(c.destination)
    osc.start(t0 + n.at)
    osc.stop(t0 + n.at + n.dur + 0.02)
  }
}

const SOUNDS = {
  tap: [{ freq: 880, at: 0, dur: 0.04, type: 'sine' as const, gain: 0.03 }],
}

// Plan item 53: the table's sounds go through one cue bus (later: the Effects volume).
let bus: GainNode | null = null
function cueBus(c: AudioContext): GainNode {
  if (!bus || bus.context !== c) {
    bus = c.createGain()
    bus.gain.value = 0.9
    bus.connect(c.destination)
  }
  return bus
}

/** Plays a step's cues a beat apart (action first, then what it caused). Silent until the first tap. */
export function playCues(cues: readonly Cue[]): void {
  const st = loadSettings()
  if (!cues.length || !st.sound || !st.effects) return
  cueLog?.push(...cues)
  const c = ctx
  if (!c || c.state !== 'running') return
  const out = cueBus(c)
  out.gain.setValueAtTime(0.9 * st.volume, c.currentTime)
  duckAmbient(c)
  let at = c.currentTime + 0.01
  for (const cue of cues) {
    renderCue(c, out, cue, at)
    at += Math.min(0.22, CUE_LENGTH[cue] * 0.6)
  }
}

/** Plan item 53: the evening of the market (afternoon on, round 7+): crickets take over from the birds. */
let evening = false

/** A new round: the market bell, and the ambience follows the day on the table (tableLight's phases). */
export function soundRound(round: number, prevRound: number): void {
  evening = round >= 7
  if (round > prevRound && round > 1) playCues(['bell'])
}

export function playSoundsFor(action: Action | null, newEvents: GameEvent[], result: GameState['result']): void {
  playCues(cueFor(action, newEvents, result))
}

// Plan item 53: the market ambience (it replaced ROADMAP 19's pad): soft chatter in two voice bands that drift,
// and a bird calling now and then. Off by default; Sound must be on too, and like every cue it waits for the
// first tap. Cues duck it for a moment.
let ambient: { stop: () => void; master: GainNode; level: number } | null = null

function duckAmbient(c: AudioContext): void {
  if (!ambient) return
  const g = ambient.master.gain
  const t = c.currentTime
  g.cancelScheduledValues(t)
  g.setValueAtTime(Math.max(0.0001, g.value), t)
  g.linearRampToValueAtTime(ambient.level * 0.4, t + 0.05)
  g.linearRampToValueAtTime(ambient.level, t + 0.9)
}

export function syncAmbient(): void {
  const s = loadSettings()
  const c = ctx
  const want = s.sound && s.ambient && s.volume > 0 && !!c && c.state === 'running'
  if (!want) {
    ambient?.stop()
    ambient = null
    return
  }
  if (!c) return
  const level = 0.5 * s.volume
  if (ambient) {
    ambient.level = level
    ambient.master.gain.setTargetAtTime(level, c.currentTime, 0.2)
    return
  }
  const master = c.createGain()
  master.gain.setValueAtTime(0.0001, c.currentTime)
  master.gain.linearRampToValueAtTime(level, c.currentTime + 2)
  master.connect(c.destination)
  // Chatter: looping noise through two voice-band filters, each breathing on its own slow LFO.
  const src = c.createBufferSource()
  const len = c.sampleRate * 2
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  src.buffer = buf
  src.loop = true
  const stops: Array<AudioScheduledSourceNode> = [src]
  for (const [freq, q, gain, rate] of [[480, 1.1, 0.05, 0.23], [1150, 1.5, 0.03, 0.37]] as const) {
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = c.createGain()
    g.gain.value = gain
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = rate
    lg.gain.value = gain * 0.6
    lfo.connect(lg).connect(g.gain)
    lfo.start()
    stops.push(lfo)
    src.connect(f).connect(g).connect(master)
  }
  src.start()
  // A bird now and then: a quick rising-falling chirp pair.
  const bird = window.setInterval(() => {
    if (evening) {
      // Crickets by the last rounds: a short train of high pulses, quieter than the birds.
      const t = c.currentTime
      for (let i = 0; i < 5; i++) {
        const o = c.createOscillator()
        const g = c.createGain()
        const at = t + i * 0.06 + Math.random() * 0.3
        o.frequency.value = 4400 + Math.random() * 300
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(0.012, at + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)
        o.connect(g).connect(master)
        o.start(at)
        o.stop(at + 0.05)
      }
      return
    }
    if (Math.random() < 0.5) return
    const t = c.currentTime
    const base = 2600 + Math.random() * 1400
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const o = c.createOscillator()
      const g = c.createGain()
      const at = t + i * 0.13
      o.frequency.setValueAtTime(base, at)
      o.frequency.exponentialRampToValueAtTime(base * 1.35, at + 0.05)
      o.frequency.exponentialRampToValueAtTime(base * 0.9, at + 0.1)
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.025, at + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
      o.connect(g).connect(master)
      o.start(at)
      o.stop(at + 0.12)
    }
  }, 2400)
  ambient = {
    master,
    level,
    stop: () => {
      window.clearInterval(bird)
      const t = c.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t)
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      for (const o of stops) o.stop(t + 0.6)
    },
  }
}

// Plan item 53, tests only (webdriver): render a cue offline and measure it, and log the cues played, so e2e can
// check every cue is audible, short and below clipping, and that play schedules them.
let cueLog: Cue[] | null = null
if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.webdriver) {
  cueLog = []
  ;(window as unknown as { __cathnivoreSound: object }).__cathnivoreSound = {
    log: cueLog,
    hasContext: () => ctx !== null,
    cues: Object.keys(CUE_LENGTH),
    async measure(cue: Cue): Promise<{ peak: number; rms: number; lastSound: number }> {
      const rate = 22050
      const off = new OfflineAudioContext(1, Math.ceil(rate * 1.4), rate)
      renderCue(off, off.destination, cue, 0)
      const d = (await off.startRendering()).getChannelData(0)
      let peak = 0
      let sum = 0
      let last = 0
      for (let i = 0; i < d.length; i++) {
        const v = Math.abs(d[i]!)
        peak = Math.max(peak, v)
        sum += v * v
        if (v > 0.001) last = i / rate
      }
      return { peak, rms: Math.sqrt(sum / d.length), lastSound: last }
    },
  }
}
