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
  if (!loadSettings().sound) return
  const c = ctx // never create a context outside a tap: stay silent until unlocked
  if (!c || c.state !== 'running') return
  const t0 = c.currentTime
  for (const n of notes) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.setValueAtTime(n.freq, t0 + n.at)
    if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur)
    const peak = n.gain ?? 0.08
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
  if (!cues.length || !loadSettings().sound) return
  cueLog?.push(...cues)
  const c = ctx
  if (!c || c.state !== 'running') return
  const out = cueBus(c)
  let at = c.currentTime + 0.01
  for (const cue of cues) {
    renderCue(c, out, cue, at)
    at += Math.min(0.22, CUE_LENGTH[cue] * 0.6)
  }
}

export function playSoundsFor(action: Action | null, newEvents: GameEvent[], result: GameState['result']): void {
  playCues(cueFor(action, newEvents, result))
}

// ROADMAP 19's optional ambient loop: a quiet, slowly breathing two-note pad (a fifth apart), off by default.
// Sound must be on as well, and like every cue it waits for the first tap.
let ambient: { stop: () => void } | null = null

export function syncAmbient(): void {
  const s = loadSettings()
  const c = ctx
  const want = s.sound && s.ambient && !!c && c.state === 'running'
  if (!want) {
    ambient?.stop()
    ambient = null
    return
  }
  if (ambient || !c) return
  const master = c.createGain()
  master.gain.setValueAtTime(0.0001, c.currentTime)
  master.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 2)
  master.connect(c.destination)
  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = 0.12
  lfoGain.gain.value = 0.015
  lfo.connect(lfoGain).connect(master.gain)
  const oscs = [130.81, 196, 261.63].map((freq) => {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    o.connect(master)
    o.start()
    return o
  })
  lfo.start()
  ambient = {
    stop: () => {
      const t = c.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t)
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      for (const o of [...oscs, lfo]) o.stop(t + 0.6)
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
