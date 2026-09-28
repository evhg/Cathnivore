import type { Action, GameEvent, GameState } from '../engine/types'
import { loadSettings } from './settings'

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
  const unlock = (): void => {
    const c = getContext()
    if (c && c.state === 'suspended') void c.resume()
  }
  window.addEventListener('pointerdown', unlock, { once: true })
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
  place: [{ freq: 520, at: 0, dur: 0.09, type: 'triangle' as const }],
  liberate: [523, 659, 784, 1047].map((freq, i) => ({ freq, at: i * 0.09, dur: 0.22, type: 'triangle' as const })),
  squeeze: [{ freq: 300, at: 0, dur: 0.25, type: 'sawtooth' as const, slideTo: 140, gain: 0.05 }],
  lostLand: [
    { freq: 220, at: 0, dur: 0.3, type: 'square' as const, gain: 0.04 },
    { freq: 165, at: 0.2, dur: 0.45, type: 'square' as const, gain: 0.04 },
  ],
  win: [523, 659, 784, 659, 1047].map((freq, i) => ({ freq, at: i * 0.12, dur: 0.3, type: 'triangle' as const })),
  lose: [392, 330, 262, 196].map((freq, i) => ({ freq, at: i * 0.16, dur: 0.35, type: 'sine' as const })),
}

export function playSoundsFor(action: Action | null, newEvents: GameEvent[], result: GameState['result']): void {
  if (result) return play(result.won ? SOUNDS.win : SOUNDS.lose)
  if (newEvents.some((e) => e.type === 'liberated')) return play(SOUNDS.liberate)
  if (newEvents.some((e) => e.type === 'squeeze' && e.lostLand)) return play(SOUNDS.lostLand)
  if (newEvents.some((e) => e.type === 'squeeze')) return play(SOUNDS.squeeze)
  if (action?.kind === 'openStall' || newEvents.some((e) => e.type === 'expand')) play(SOUNDS.place)
}
