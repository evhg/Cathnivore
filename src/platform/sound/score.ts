// Plan item 213: the market score. A generative tune from the same synth kit as the cues (VISION "Sound": organic
// market sound against sterile corporate synth): a plucked-string arpeggio, an accordion-like reed holding the chord
// and a soft hand drum. It warms up through the day (the tempo follows the round, and the evening rounds turn to the
// Dorian mode); on Hollowell's turn it ducks under a thin corporate muzak loop until the turn ends.
//
// This file is pure (no WebAudio): it says which notes a bar holds and when bars are due, so it is unit-tested.
// `index.ts` renders the notes.

export type ScoreMode = 'market' | 'muzak'
export type ScoreVoice = 'pluck' | 'reed' | 'drum' | 'slap' | 'muzak'

export interface ScoreNote {
  /** Beats after the bar's start. */
  at: number
  /** Beats. */
  dur: number
  voice: ScoreVoice
  /** MIDI note number (drums use it as a pitch hint). */
  midi: number
  /** Linear gain before the music level. */
  gain: number
}

export const BEATS_PER_BAR = 4
/** How far the market ducks under the muzak. */
export const MUZAK_DUCK = 0.3

/** The tempo warms from a morning stroll to a busy afternoon, and eases off in the evening. */
export function tempoFor(round: number): number {
  const r = Math.max(1, Math.min(10, Math.round(round)))
  return r <= 6 ? 84 + (r - 1) * 3 : 99 - (r - 6) * 2
}

/** Morning and afternoon in D major; the evening rounds (7 on, as the ambience turns to crickets) in D Dorian. */
export function modeFor(round: number): 'major' | 'dorian' {
  return round >= 7 ? 'dorian' : 'major'
}

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10] } as const
const ROOT = 62 // D4
// The chord's degree (0-based in the scale) for each bar of the eight-bar phrase: I IV I V / vi IV I V (i IV i VII in Dorian).
const PHRASE = [0, 3, 0, 4, 5, 3, 0, 4] as const

function degree(scale: readonly number[], d: number): number {
  const oct = Math.floor(d / 7)
  return ROOT + scale[((d % 7) + 7) % 7]! + 12 * oct
}

/** A small deterministic hash, so a bar always holds the same notes (and tests can rely on it). */
function hash(n: number): number {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 13
  x = Math.imul(x, 1274126177) >>> 0
  return (x ^ (x >>> 16)) / 4294967296
}

export function marketBar(bar: number, round: number): ScoreNote[] {
  const scale = SCALES[modeFor(round)]
  const d = PHRASE[((bar % PHRASE.length) + PHRASE.length) % PHRASE.length]!
  const notes: ScoreNote[] = []
  // The reed: the chord's root and fifth held across the bar, an octave down, swelling in.
  notes.push({ at: 0, dur: 3.8, voice: 'reed', midi: degree(scale, d) - 12, gain: 0.05 })
  notes.push({ at: 0, dur: 3.8, voice: 'reed', midi: degree(scale, d + 4) - 12, gain: 0.035 })
  // The pluck: an eighth-note arpeggio over the chord, with rests the hash picks so no two bars match exactly.
  const shape = [0, 2, 4, 7, 4, 2, 4, 2]
  for (let i = 0; i < 8; i++) {
    if (i > 0 && hash(bar * 31 + i) < 0.22) continue
    const up = hash(bar * 17 + i) < 0.12 ? 2 : 0
    notes.push({ at: i * 0.5, dur: 0.9, voice: 'pluck', midi: degree(scale, d + shape[i]! + up), gain: i === 0 ? 0.09 : 0.065 })
  }
  // The hand drum: a low thump on 1 and 3, a slap on 2-and and 4 (dropped now and then).
  notes.push({ at: 0, dur: 0.4, voice: 'drum', midi: 45, gain: 0.16 })
  notes.push({ at: 2, dur: 0.4, voice: 'drum', midi: 45, gain: 0.12 })
  if (hash(bar * 7 + 1) > 0.25) notes.push({ at: 1.5, dur: 0.12, voice: 'slap', midi: 0, gain: 0.05 })
  notes.push({ at: 3, dur: 0.12, voice: 'slap', midi: 0, gain: 0.06 })
  return notes
}

/** Hollowell's hold music: a sterile major-seventh pad on 1 and 3 and a sine bleep, the same every bar. */
export function muzakBar(bar: number): ScoreNote[] {
  const chord = bar % 2 === 0 ? [65, 69, 72, 76] : [62, 65, 69, 72] // Fmaj7, Dm7
  const notes: ScoreNote[] = []
  for (const at of [0, 2]) for (const m of chord) notes.push({ at, dur: 1.6, voice: 'muzak', midi: m, gain: 0.03 })
  notes.push({ at: 3.5, dur: 0.3, voice: 'muzak', midi: chord[3]! + 12, gain: 0.025 })
  return notes
}

/** A bar as heard: the market, or on Hollowell's turn the market ducked under the muzak. */
export function barNotes(bar: number, mode: ScoreMode, round: number): ScoreNote[] {
  const market = marketBar(bar, round)
  if (mode === 'market') return market
  return [...market.map((n) => ({ ...n, gain: n.gain * MUZAK_DUCK })), ...muzakBar(bar)]
}

export interface DueBar {
  bar: number
  /** Context time of the bar's first beat, in seconds. */
  t0: number
  /** Seconds per beat for this bar. */
  beat: number
  notes: ScoreNote[]
}

/**
 * The look-ahead clock: each tick asks for the bars that start before `now + lookahead`, so notes are scheduled on
 * the audio clock, not timers. The tempo, mode and round can change at any time and take hold from the next bar.
 * After `stop()` it returns nothing, so no note is scheduled after the music stops.
 */
export class ScoreClock {
  private bar = 0
  private next: number
  private stopped = false
  mode: ScoreMode = 'market'
  round = 1

  constructor(start: number) {
    this.next = start
  }

  get isStopped(): boolean {
    return this.stopped
  }

  due(now: number, lookahead: number): DueBar[] {
    if (this.stopped) return []
    // After a long stall (a background tab), skip ahead rather than playing a burst of late bars.
    if (this.next < now - 0.05) this.next = now + 0.05
    const out: DueBar[] = []
    while (this.next < now + lookahead) {
      const beat = 60 / tempoFor(this.round)
      out.push({ bar: this.bar, t0: this.next, beat, notes: barNotes(this.bar, this.mode, this.round) })
      this.next += beat * BEATS_PER_BAR
      this.bar += 1
    }
    return out
  }

  stop(): void {
    this.stopped = true
  }
}

export function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12)
}
