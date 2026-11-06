import type { Cue } from './cues'

// Plan item 53: every cue synthesised in WebAudio from noise bursts through filters and short envelopes, and a
// few tones; no samples. Each recipe takes any BaseAudioContext, so a test can render it offline.

type Ctx = BaseAudioContext

let noiseBuf: { ctx: Ctx; buf: AudioBuffer } | null = null
/** One second of white noise per context, shared by every burst. */
function noise(c: Ctx): AudioBuffer {
  if (noiseBuf?.ctx === c) return noiseBuf.buf
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
  const d = buf.getChannelData(0)
  let s = 12345
  for (let i = 0; i < d.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0
    d[i] = (s / 4294967296) * 2 - 1
  }
  noiseBuf = { ctx: c, buf }
  return buf
}

/** A gain envelope: a fast attack to `peak`, then an exponential fall to silence by `dur`. */
function env(c: Ctx, out: AudioNode, at: number, dur: number, peak: number, attack = 0.004): GainNode {
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  g.connect(out)
  return g
}

interface Burst {
  at: number
  dur: number
  peak: number
  type: BiquadFilterType
  freq: number
  q?: number
  sweepTo?: number
  attack?: number
}

function burst(c: Ctx, out: AudioNode, t0: number, b: Burst): void {
  const src = c.createBufferSource()
  src.buffer = noise(c)
  const f = c.createBiquadFilter()
  f.type = b.type
  f.frequency.setValueAtTime(b.freq, t0 + b.at)
  if (b.sweepTo) f.frequency.exponentialRampToValueAtTime(b.sweepTo, t0 + b.at + b.dur)
  f.Q.value = b.q ?? 1
  src.connect(f).connect(env(c, out, t0 + b.at, b.dur, b.peak, b.attack))
  // Start each burst at a different place in the noise so repeats don't sound identical.
  src.start(t0 + b.at, (b.freq * 0.0007) % 0.8)
  src.stop(t0 + b.at + b.dur + 0.02)
}

interface Tone {
  at: number
  dur: number
  peak: number
  freq: number
  type?: OscillatorType
  slideTo?: number
  attack?: number
  lowpass?: number
}

function tone(c: Ctx, out: AudioNode, t0: number, n: Tone): void {
  const o = c.createOscillator()
  o.type = n.type ?? 'sine'
  o.frequency.setValueAtTime(n.freq, t0 + n.at)
  if (n.slideTo) o.frequency.exponentialRampToValueAtTime(n.slideTo, t0 + n.at + n.dur)
  let node: AudioNode = o
  if (n.lowpass) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = n.lowpass
    node = o.connect(f)
  }
  node.connect(env(c, out, t0 + n.at, n.dur, n.peak, n.attack))
  o.start(t0 + n.at)
  o.stop(t0 + n.at + n.dur + 0.02)
}

/** How long each cue rings, in seconds (all under 1.2 s). */
export const CUE_LENGTH: Record<Cue, number> = {
  woodClack: 0.12,
  paperSlide: 0.24,
  paperFlip: 0.14,
  paperTear: 0.34,
  coin: 0.36,
  coinOne: 0.14,
  awning: 0.42,
  crowd: 1.15,
  bell: 1.1,
  synthChime: 0.5,
  synthSweep: 0.62,
  synthSweepLow: 0.92,
  synthBlip: 0.08,
  synthGlitch: 0.26,
  win: 1.15,
  lose: 1.0,
}

/** Schedules one cue on `out`, starting at context time `t0`. */
export function renderCue(c: Ctx, out: AudioNode, cue: Cue, t0: number): void {
  switch (cue) {
    case 'woodClack':
      // A token set down on the trestle: a hollow knock and the click of its edge.
      tone(c, out, t0, { at: 0, dur: 0.1, peak: 0.28, freq: 420, slideTo: 300, type: 'triangle' })
      burst(c, out, t0, { at: 0, dur: 0.03, peak: 0.25, type: 'bandpass', freq: 1900, q: 6 })
      burst(c, out, t0, { at: 0.012, dur: 0.05, peak: 0.16, type: 'bandpass', freq: 850, q: 5 })
      return
    case 'paperSlide':
      // A card drawn across the cloth.
      burst(c, out, t0, { at: 0, dur: 0.22, peak: 0.16, type: 'bandpass', freq: 1400, sweepTo: 4200, q: 0.9, attack: 0.06 })
      return
    case 'paperFlip':
      // A card turned face up: two quick flicks.
      burst(c, out, t0, { at: 0, dur: 0.05, peak: 0.2, type: 'highpass', freq: 2600 })
      burst(c, out, t0, { at: 0.06, dur: 0.07, peak: 0.16, type: 'bandpass', freq: 3200, q: 1.4 })
      return
    case 'paperTear':
      for (let i = 0; i < 6; i++) burst(c, out, t0, { at: i * 0.045, dur: 0.06, peak: 0.12 + (i % 2) * 0.06, type: 'bandpass', freq: 1700 + i * 260, q: 2 })
      return
    case 'coin':
      // Two coins chinking: bright inharmonic partials, the second a touch later and higher.
      for (const [at, f] of [[0, 2093], [0.075, 2349]] as const) {
        tone(c, out, t0, { at, dur: 0.26, peak: 0.08, freq: f, attack: 0.002 })
        tone(c, out, t0, { at, dur: 0.18, peak: 0.05, freq: f * 2.76, attack: 0.002 })
        tone(c, out, t0, { at, dur: 0.12, peak: 0.03, freq: f * 5.4, attack: 0.002 })
      }
      return
    case 'coinOne':
      tone(c, out, t0, { at: 0, dur: 0.13, peak: 0.07, freq: 2637, attack: 0.002 })
      tone(c, out, t0, { at: 0, dur: 0.09, peak: 0.035, freq: 2637 * 2.76, attack: 0.002 })
      return
    case 'awning':
      // The stall's canvas shaken out: three soft low flaps.
      for (let i = 0; i < 3; i++) burst(c, out, t0, { at: i * 0.11, dur: 0.14, peak: 0.3 - i * 0.06, type: 'lowpass', freq: 520 - i * 60, q: 0.7, attack: 0.015 })
      tone(c, out, t0, { at: 0, dur: 0.1, peak: 0.12, freq: 160, slideTo: 110 })
      return
    case 'crowd':
      // A market crowd cheering up: two voice bands swelling, with a few calls on top.
      burst(c, out, t0, { at: 0, dur: 1.1, peak: 0.16, type: 'bandpass', freq: 520, q: 1.2, attack: 0.35 })
      burst(c, out, t0, { at: 0.05, dur: 1.05, peak: 0.11, type: 'bandpass', freq: 1250, q: 1.6, attack: 0.3 })
      for (const [at, f] of [[0.25, 620], [0.42, 760], [0.6, 540]] as const) tone(c, out, t0, { at, dur: 0.22, peak: 0.035, freq: f, slideTo: f * 1.3, type: 'triangle', attack: 0.03 })
      return
    case 'bell':
      // The market bell at the end of a round.
      tone(c, out, t0, { at: 0, dur: 1.05, peak: 0.14, freq: 880, attack: 0.003 })
      tone(c, out, t0, { at: 0, dur: 0.7, peak: 0.06, freq: 880 * 2.76, attack: 0.003 })
      tone(c, out, t0, { at: 0, dur: 0.4, peak: 0.03, freq: 880 * 5.4, attack: 0.003 })
      return
    case 'synthChime':
      // Hollowell opens an Outlet: a glossy, too-clean two-tone chime.
      tone(c, out, t0, { at: 0, dur: 0.24, peak: 0.12, freq: 1318.5, type: 'triangle' })
      tone(c, out, t0, { at: 0.12, dur: 0.36, peak: 0.12, freq: 1760, type: 'triangle' })
      tone(c, out, t0, { at: 0.12, dur: 0.3, peak: 0.03, freq: 3520 })
      return
    case 'synthSweep':
      // A Squeeze: a cold descending sweep, over the box's thump as it lands (plan item 63).
      tone(c, out, t0, { at: 0, dur: 0.18, peak: 0.13, freq: 104, slideTo: 48, type: 'sine', attack: 0.003 })
      tone(c, out, t0, { at: 0, dur: 0.6, peak: 0.1, freq: 640, slideTo: 130, type: 'sawtooth', lowpass: 1800, attack: 0.01 })
      return
    case 'synthSweepLow':
      // Plan item 63: the box slamming down on the tile, a low synthesised thump under the sweep.
      tone(c, out, t0, { at: 0, dur: 0.2, peak: 0.16, freq: 96, slideTo: 42, type: 'sine', attack: 0.003 })
      tone(c, out, t0, { at: 0, dur: 0.9, peak: 0.11, freq: 320, slideTo: 55, type: 'sawtooth', lowpass: 900, attack: 0.01 })
      tone(c, out, t0, { at: 0.05, dur: 0.85, peak: 0.07, freq: 160, slideTo: 41, type: 'square', lowpass: 500 })
      return
    case 'synthBlip':
      tone(c, out, t0, { at: 0, dur: 0.07, peak: 0.08, freq: 1240, type: 'square', lowpass: 3000, attack: 0.002 })
      return
    case 'synthGlitch':
      for (let i = 0; i < 6; i++) tone(c, out, t0, { at: i * 0.04, dur: 0.035, peak: 0.06, freq: [880, 1320, 660, 1760, 990, 440][i]!, type: 'square', lowpass: 2600, attack: 0.002 })
      return
    case 'win':
      renderCue(c, out, 'crowd', t0)
      renderCue(c, out, 'bell', t0 + 0.05)
      return
    case 'lose':
      renderCue(c, out, 'synthSweepLow', t0)
      return
  }
}

// Plan item 213: the score's voices, from the same kit. `beat` is seconds per beat; the note's times are in beats.
export function renderScoreNote(c: Ctx, out: AudioNode, n: import('./score').ScoreNote, t0: number, beat: number): void {
  const at = t0 + n.at * beat
  const dur = Math.max(0.05, n.dur * beat)
  const hz = 440 * 2 ** ((n.midi - 69) / 12)
  if (n.voice === 'slap') {
    burst(c, out, at, { at: 0, dur: 0.07, peak: n.gain, type: 'bandpass', freq: 2200, q: 1.4, attack: 0.002 })
    return
  }
  if (n.voice === 'drum') {
    // A soft hand drum: a sine that drops in pitch, with a muffled skin noise on top.
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(hz * 1.6, at)
    o.frequency.exponentialRampToValueAtTime(hz, at + 0.08)
    o.connect(env(c, out, at, Math.min(dur, 0.35), n.gain, 0.003))
    o.start(at)
    o.stop(at + 0.4)
    burst(c, out, at, { at: 0, dur: 0.05, peak: n.gain * 0.25, type: 'lowpass', freq: 900, attack: 0.002 })
    return
  }
  if (n.voice === 'pluck') {
    // A plucked string: a triangle and its octave through a lowpass that closes fast, a quick decay.
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(hz * 8, at)
    f.frequency.exponentialRampToValueAtTime(hz * 1.5, at + 0.25)
    f.connect(env(c, out, at, dur, n.gain, 0.003))
    for (const [mult, type] of [[1, 'triangle'], [2, 'sine']] as const) {
      const o = c.createOscillator()
      o.type = type
      o.frequency.value = hz * mult
      o.connect(f)
      o.start(at)
      o.stop(at + dur + 0.02)
    }
    return
  }
  // The reed (two detuned saws, a slow swell, a warm lowpass) and the muzak (sterile sines, a hard flat envelope).
  const reed = n.voice === 'reed'
  const g = c.createGain()
  const attack = reed ? Math.min(0.25, dur / 3) : 0.01
  g.gain.setValueAtTime(0.0001, at)
  g.gain.linearRampToValueAtTime(n.gain, at + attack)
  g.gain.setValueAtTime(n.gain, at + dur * 0.8)
  g.gain.linearRampToValueAtTime(0.0001, at + dur)
  g.connect(out)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = reed ? 1400 : 5000
  f.connect(g)
  for (const detune of reed ? [-7, 7] : [0]) {
    const o = c.createOscillator()
    o.type = reed ? 'sawtooth' : 'sine'
    o.frequency.value = hz
    o.detune.value = detune
    o.connect(f)
    o.start(at)
    o.stop(at + dur + 0.02)
  }
}
