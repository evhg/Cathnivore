// Hedgerow's synthesised sound (no audio files): effects for every tower, hit and ability, plus a
// French-electro score (think French 79, Diamond Veins), one track per act. The context is only
// created on a tap, so the page stays silent until the player acts. The mute choice lives in
// localStorage, best-effort.
//
// Music design. Everything is built from oscillators and one buffer of white noise:
//   - Each act has a track (TRACKS): a key, a tempo (100 to 122 BPM, rising with the story), a
//     chord loop, a bass style, an arpeggio, and a two-motif lead tune. Pad chords are voice-led
//     (each voice moves as little as possible to the next chord), and the lead's 32-bar score
//     states, varies, sequences and answers its motifs, nudging strong-beat notes onto chord tones.
//   - Voices: pads (two detuned saws a note, split left and right, through one lowpass that a slow
//     LFO breathes, plus a chorus), a mono bass (saw + sine, filter envelope), a filtered-square
//     arpeggio, a mono lead (two detuned saws, an octave square for boss fights, glide, delayed
//     vibrato, optional 16th-note gate), and drums: a pitch-dropping kick, clap or snare, closed
//     and open hats, toms, crashes and noise risers.
//   - Mix: layer buses -> a side-chain "duck" gain (pads, bass, arp, reverb pump on every beat) ->
//     a glue compressor -> musicBus. A ping-pong delay and a convolver with a procedurally made
//     noise impulse response give space. Mix peaks sit around -12 dBFS before the compressor;
//     musicBus keeps the whole score under the effects.
//   - Intensity (0 building, 1 a wave, 2 a boss) crossfades layer gains: calm pads, bass, soft
//     arp and hats; then full drums and the lead; then a tenser filter, the lead's octave, a
//     16th-note ostinato and risers. The step clock never resets on an intensity change.
//   - A 50 ms timer schedules 16th-note steps 0.2 s ahead. Notes for silent layers are never
//     built, per-note nodes disconnect when they end, and the whole graph is torn down shortly
//     after stopMusic, so nothing grows without bound.

const KEY = "hedgerow:sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let muted = false;
let unlocked = false;
let silence: HTMLAudioElement | null = null;
try {
  muted = localStorage.getItem(KEY) === "off";
} catch {
  /* storage blocked: default to sound on */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? "off" : "on");
  } catch {
    /* ignore */
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.05);
  if (silence) {
    if (value) silence.pause();
    else void silence.play().catch(() => undefined);
  }
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  fxBus = ctx.createGain();
  fxBus.gain.value = 1;
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.5;
  fxBus.connect(master);
  musicBus.connect(master);
  master.connect(comp).connect(ctx.destination);
  return ctx;
}


/**
 * Call from any tap: creates or resumes the audio context. iPhones need three things here, all inside the
 * tap itself: the context resumed (it can also be "interrupted" after a call or a trip to the background),
 * a sound actually started (a one-sample silent buffer), and the page's audio session switched to
 * "playback" so the ring/silent switch doesn't mute the game (navigator.audioSession on iOS 17+; on older
 * iOS, playing a silent HTML audio file does the same).
 */
export function unlock(): void {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession && nav.audioSession.type !== "playback") nav.audioSession.type = "playback";
  } catch {
    /* not supported */
  }
  const c = context();
  if (!c) return;
  if (c.state !== "running") void c.resume();
  if (unlocked) return;
  unlocked = true;
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
  if (!nav.audioSession) {
    try {
      silence ??= new Audio(`${import.meta.env.BASE_URL}silence.wav`);
      silence.loop = true;
      silence.volume = 0;
      silence.setAttribute("playsinline", "");
      void silence.play().catch(() => undefined);
    } catch {
      /* ignore */
    }
  }
}

// Any first tap or key anywhere unlocks the sound (not only the buttons that remember to ask), and coming
// back to the tab wakes the context again.
if (typeof document !== "undefined") {
  for (const ev of ["pointerdown", "touchend", "click", "keydown"] as const)
    document.addEventListener(ev, () => unlock(), { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && ctx && ctx.state !== "running") void ctx.resume();
  });
}

function ready(): boolean {
  if (muted) return false;
  const c = context();
  if (!c) return false;
  if (c.state !== "running") void c.resume();
  return true;
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  slideTo?: number,
  bus: AudioNode | null = fxBus,
): void {
  const c = ctx;
  if (!c || !bus) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(at: number, dur: number, peak: number, filter?: { type: BiquadFilterType; freq: number; q?: number }, bus: AudioNode | null = fxBus, absolute = false): void {
  const c = ctx;
  if (!c || !bus) return;
  const t0 = absolute ? at : c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = src;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    f.Q.value = filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(bus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

export function playBuild(): void {
  if (!ready()) return;
  noise(0, 0.08, 0.12, { type: "lowpass", freq: 900 });
  tone(220, 0.02, 0.09, "triangle", 0.07, 330);
  tone(330, 0.09, 0.14, "triangle", 0.06);
}
export function playUpgrade(): void {
  if (!ready()) return;
  [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.05, 0.16, "triangle", 0.05));
}
export function playSell(): void {
  if (!ready()) return;
  tone(500, 0, 0.1, "square", 0.03, 250);
  tone(988, 0.08, 0.12, "sine", 0.03);
}
export function playMove(): void {
  if (!ready()) return;
  tone(520, 0, 0.06, "sine", 0.04, 640);
}
export function playShot(kind: string, crit = false): void {
  if (!ready()) return;
  switch (kind) {
    case "beehive":
      tone(180, 0, 0.16, "sawtooth", 0.012, 240);
      break;
    case "pond":
      tone(400, 0, 0.08, "sine", 0.04, 900);
      break;
    case "barn":
      noise(0, 0.07, 0.08, { type: "lowpass", freq: 500 });
      break;
    case "silo":
      tone(90, 0, 0.22, "sine", 0.12, 45);
      noise(0, 0.12, 0.06, { type: "lowpass", freq: 700 });
      break;
    default:
      noise(0, 0.05, 0.05, { type: "bandpass", freq: 1800, q: 2 });
      tone(700, 0, 0.05, "triangle", 0.02, 380);
  }
  if (crit) {
    // A crow's caw.
    tone(900, 0.02, 0.12, "sawtooth", 0.025, 600);
    tone(850, 0.14, 0.1, "sawtooth", 0.02, 560);
  }
}
export function playKill(big = false): void {
  if (!ready()) return;
  noise(0, big ? 0.6 : 0.12, big ? 0.2 : 0.07, { type: "lowpass", freq: big ? 600 : 1400 });
  tone(1175, 0.04, 0.1, "sine", 0.025);
  tone(1568, 0.09, 0.12, "sine", 0.02);
  if (big) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2 + i * 0.08, 0.3, "triangle", 0.05));
}
export function playLeak(): void {
  if (!ready()) return;
  tone(150, 0, 0.25, "sawtooth", 0.05, 70);
  noise(0, 0.15, 0.05, { type: "lowpass", freq: 400 });
}
export function playWave(): void {
  if (!ready()) return;
  // A hunting horn.
  tone(262, 0, 0.2, "sawtooth", 0.03);
  tone(392, 0.18, 0.32, "sawtooth", 0.035);
  tone(262, 0, 0.2, "triangle", 0.05);
  tone(392, 0.18, 0.32, "triangle", 0.05);
}
export function playBoss(): void {
  if (!ready()) return;
  [110, 104, 98].forEach((f, i) => tone(f, i * 0.35, 0.5, "sawtooth", 0.06));
  noise(0, 1.2, 0.05, { type: "lowpass", freq: 200 });
}
export function playBossMove(move: string): void {
  if (!ready()) return;
  if (move === "stomp" || move === "takeover") {
    tone(70, 0, 0.4, "sawtooth", 0.08, 35);
    noise(0, 0.35, 0.18, { type: "lowpass", freq: 500 });
  } else if (move === "pulse") {
    [880, 660, 880, 660].forEach((f, i) => tone(f, i * 0.08, 0.1, "square", 0.02));
  } else if (move === "charge") {
    tone(120, 0, 0.6, "sawtooth", 0.05, 240);
  } else if (move === "mend") {
    [523, 784, 1047].forEach((f, i) => tone(f, i * 0.06, 0.25, "sine", 0.03));
  } else {
    tone(196, 0, 0.2, "triangle", 0.05);
    tone(147, 0.18, 0.3, "triangle", 0.05);
  }
}
export function playCleared(): void {
  if (!ready()) return;
  [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.16, "sine", 0.035));
}
export function playPie(): void {
  if (!ready()) return;
  tone(300, 0, 0.3, "sine", 0.05, 900);
  noise(0.32, 0.25, 0.14, { type: "lowpass", freq: 900 });
}
export function playNeighbours(): void {
  if (!ready()) return;
  [330, 392, 494].forEach((f, i) => tone(f, i * 0.06, 0.14, "triangle", 0.05));
}
export function playRally(): void {
  if (!ready()) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.18, "square", 0.025));
}
export function playSwing(): void {
  if (!ready()) return;
  noise(0, 0.06, 0.04, { type: "highpass", freq: 2000 });
  tone(180, 0.04, 0.08, "triangle", 0.06, 120);
}
export function playHeroDown(): void {
  if (!ready()) return;
  tone(440, 0, 0.18, "triangle", 0.05, 260);
  tone(330, 0.16, 0.3, "triangle", 0.05, 200);
}
export function playInjunction(): void {
  if (!ready()) return;
  noise(0, 0.05, 0.15, { type: "bandpass", freq: 700, q: 3 });
  noise(0.14, 0.05, 0.15, { type: "bandpass", freq: 700, q: 3 });
}
export function playWin(): void {
  if (!ready()) return;
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.4, "triangle", 0.06));
}
export function playLose(): void {
  if (!ready()) return;
  [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.16, 0.34, "triangle", 0.05));
}

// ---- music: harmony and score (pure, unit-tested) ----

export const midiHz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

type Quality = "M" | "m" | "7" | "maj7" | "m7" | "maj9" | "m9" | "add9" | "madd9" | "sus2" | "sus4";
const QUALITY: Record<Quality, number[]> = {
  M: [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

/** A chord: root in semitones above the key's tonic, its quality, and an optional slash bass. */
export interface MusicChord {
  root: number;
  q: Quality;
  bass?: number;
}
const ch = (root: number, q: Quality, bass?: number): MusicChord => ({ root, q, bass });

/** [16th-note step within two bars (0-31), scale degree (0 = tonic, may be negative or > 6), length in 16ths]. */
type MotifNote = [number, number, number];
type BassStyle = "offbeat" | "pulse" | "gallop" | "roll";

export interface MusicTrack {
  name: string;
  mood: string;
  tonic: number; // pitch class, 0 = C
  scale: number[];
  bpm: number;
  chords: MusicChord[]; // one a bar, looped
  bass: BassStyle;
  arp: number[]; // 16 steps; index into the arp tones (0-3 the pad voicing, 4-7 an octave up), -1 rests
  arpWave: OscillatorType;
  padCutoff: number; // Hz, the pad filter's centre
  padAttack: number; // seconds
  gate: boolean; // chop long lead notes into 16ths
  snare: boolean; // a snare instead of a clap on 2 and 4
  hats16: boolean;
  a: MotifNote[];
  b: MotifNote[];
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

const ARP_EIGHTHS = [0, -1, 2, -1, 4, -1, 3, -1, 1, -1, 2, -1, 5, -1, 3, -1];
const ARP_UPDOWN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];
const ARP_ROLL = [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 2, 1, 3, 6, 3];
const ARP_SPARKLE = [4, 2, 5, 3, 6, 4, 7, 5, 4, 2, 5, 3, 6, 4, 5, 3];
const ARP_OCTAVES = [0, 4, 0, 4, 1, 5, 1, 5, 2, 6, 2, 6, 3, 7, 3, 6];
const ARP_CASCADE = [7, 6, 5, 4, 3, 2, 1, 0, 6, 5, 4, 3, 2, 1, 0, 2];

/** One track per act, darker and more driving as the corporations close in; Kingsmarket is the finale. */
export const TRACKS: MusicTrack[] = [
  {
    name: "Brindle Hills",
    mood: "hopeful, sunlit, nostalgic",
    tonic: 2,
    scale: MAJOR,
    bpm: 100,
    chords: [ch(0, "maj7"), ch(9, "m7"), ch(5, "maj9"), ch(7, "sus4"), ch(0, "maj7", 4), ch(5, "maj7"), ch(2, "m7"), ch(7, "M")],
    bass: "offbeat",
    arp: ARP_EIGHTHS,
    arpWave: "square",
    padCutoff: 1500,
    padAttack: 0.5,
    gate: false,
    snare: false,
    hats16: false,
    a: [[0, 4, 6], [6, 2, 2], [8, 3, 4], [12, 4, 4], [16, 7, 6], [22, 6, 2], [24, 4, 8]],
    b: [[0, 5, 4], [4, 4, 4], [8, 2, 4], [12, 1, 4], [16, 2, 6], [22, 1, 2], [24, 0, 8]],
  },
  {
    name: "Highmoor",
    mood: "wistful, wide open, gently driving",
    tonic: 9,
    scale: MINOR,
    bpm: 104,
    chords: [ch(0, "m9"), ch(8, "maj7"), ch(3, "add9"), ch(10, "M"), ch(0, "m9"), ch(8, "maj7"), ch(5, "m7"), ch(7, "sus4")],
    bass: "pulse",
    arp: ARP_UPDOWN,
    arpWave: "sawtooth",
    padCutoff: 1300,
    padAttack: 0.4,
    gate: false,
    snare: false,
    hats16: false,
    a: [[0, 4, 3], [3, 2, 3], [6, 4, 2], [8, 7, 6], [14, 6, 2], [16, 4, 6], [22, 3, 2], [24, 2, 8]],
    b: [[0, 2, 3], [3, 3, 3], [6, 4, 2], [8, 5, 6], [14, 4, 2], [16, 3, 4], [20, 1, 4], [24, 0, 8]],
  },
  {
    name: "Saltmarsh",
    mood: "glossy, sea air, a gated lead",
    tonic: 5,
    scale: MINOR,
    bpm: 106,
    chords: [ch(0, "m9"), ch(8, "maj7"), ch(10, "sus2"), ch(7, "m7")],
    bass: "offbeat",
    arp: ARP_SPARKLE,
    arpWave: "square",
    padCutoff: 1600,
    padAttack: 0.3,
    gate: true,
    snare: false,
    hats16: false,
    a: [[0, 7, 8], [8, 6, 4], [12, 4, 4], [16, 5, 12], [28, 4, 4]],
    b: [[0, 2, 8], [8, 3, 4], [12, 4, 4], [16, 1, 8], [24, 0, 8]],
  },
  {
    name: "Rivermead",
    mood: "rolling, rain-soaked, rising water",
    tonic: 7,
    scale: MINOR,
    bpm: 108,
    chords: [ch(0, "m9"), ch(0, "m", 10), ch(8, "maj7"), ch(7, "7")],
    bass: "gallop",
    arp: ARP_ROLL,
    arpWave: "sawtooth",
    padCutoff: 1200,
    padAttack: 0.35,
    gate: false,
    snare: false,
    hats16: true,
    a: [[0, 0, 2], [2, 2, 2], [4, 4, 4], [8, 3, 2], [10, 2, 2], [12, 4, 4], [16, 6, 6], [22, 4, 2], [24, 3, 8]],
    b: [[0, 4, 2], [2, 3, 2], [4, 2, 4], [8, 1, 2], [10, 0, 2], [12, 1, 4], [16, -1, 8], [24, -3, 8]],
  },
  {
    name: "Oakvale",
    mood: "cold, ominous, Candor arrives",
    tonic: 1,
    scale: MINOR,
    bpm: 110,
    chords: [ch(0, "madd9"), ch(5, "m7"), ch(8, "maj7"), ch(7, "m7"), ch(0, "madd9"), ch(8, "maj7"), ch(3, "maj7"), ch(10, "sus2")],
    bass: "pulse",
    arp: ARP_OCTAVES,
    arpWave: "square",
    padCutoff: 1000,
    padAttack: 0.6,
    gate: false,
    snare: true,
    hats16: false,
    a: [[0, 4, 10], [10, 3, 2], [12, 2, 4], [16, 0, 12], [28, -1, 4]],
    b: [[0, 2, 6], [6, 3, 2], [8, 4, 8], [16, 6, 6], [22, 5, 2], [24, 4, 8]],
  },
  {
    name: "Shingle Bay",
    mood: "wide, nautical, euphoric drive",
    tonic: 11,
    scale: MINOR,
    bpm: 112,
    chords: [ch(0, "m7"), ch(5, "m9"), ch(8, "maj7"), ch(7, "sus4"), ch(0, "m7"), ch(8, "maj7"), ch(3, "add9"), ch(10, "M")],
    bass: "offbeat",
    arp: ARP_UPDOWN,
    arpWave: "sawtooth",
    padCutoff: 1500,
    padAttack: 0.25,
    gate: true,
    snare: false,
    hats16: true,
    a: [[0, 0, 4], [4, 4, 4], [8, 7, 8], [16, 6, 4], [20, 4, 4], [24, 5, 8]],
    b: [[0, 4, 4], [4, 2, 4], [8, 4, 8], [16, 3, 4], [20, 1, 4], [24, 0, 8]],
  },
  {
    name: "The Rift",
    mood: "tense, Phrygian, companies at war",
    tonic: 4,
    scale: PHRYGIAN,
    bpm: 114,
    chords: [ch(0, "m"), ch(1, "maj7"), ch(10, "sus2"), ch(0, "madd9")],
    bass: "gallop",
    arp: ARP_CASCADE,
    arpWave: "square",
    padCutoff: 1100,
    padAttack: 0.3,
    gate: false,
    snare: true,
    hats16: true,
    a: [[0, 0, 3], [3, 1, 3], [6, 0, 2], [8, 4, 6], [14, 5, 2], [16, 4, 4], [20, 2, 4], [24, 1, 8]],
    b: [[0, 7, 3], [3, 6, 3], [6, 5, 2], [8, 4, 8], [16, 1, 4], [20, 2, 4], [24, 0, 8]],
  },
  {
    name: "The Ballot",
    mood: "urgent, campaign pulse",
    tonic: 0,
    scale: MINOR,
    bpm: 116,
    chords: [ch(0, "m9"), ch(8, "maj7"), ch(5, "m7"), ch(7, "7"), ch(0, "m9"), ch(3, "maj7"), ch(10, "M"), ch(7, "sus4")],
    bass: "roll",
    arp: ARP_ROLL,
    arpWave: "sawtooth",
    padCutoff: 1200,
    padAttack: 0.2,
    gate: false,
    snare: false,
    hats16: true,
    a: [[0, 4, 2], [2, 4, 2], [4, 6, 4], [8, 7, 4], [12, 6, 2], [14, 4, 2], [16, 2, 8], [24, 3, 4], [28, 4, 4]],
    b: [[0, 7, 2], [2, 7, 2], [4, 9, 4], [8, 8, 4], [12, 7, 4], [16, 6, 8], [24, 4, 4], [28, 3, 4]],
  },
  {
    name: "The Merger",
    mood: "dark, mechanical, harmonic minor",
    tonic: 10,
    scale: HARMONIC,
    bpm: 118,
    chords: [ch(0, "m"), ch(1, "maj7"), ch(8, "maj7"), ch(7, "7"), ch(0, "m"), ch(5, "m7"), ch(8, "maj7"), ch(7, "sus4")],
    bass: "roll",
    arp: ARP_OCTAVES,
    arpWave: "square",
    padCutoff: 950,
    padAttack: 0.25,
    gate: true,
    snare: true,
    hats16: true,
    a: [[0, 0, 2], [2, 0, 2], [4, 2, 2], [6, 1, 2], [8, 0, 4], [12, -1, 4], [16, 4, 6], [22, 5, 2], [24, 4, 8]],
    b: [[0, 5, 4], [4, 4, 4], [8, 2, 4], [12, 3, 4], [16, 1, 6], [22, 0, 2], [24, -1, 8]],
  },
  {
    name: "Kingsmarket",
    mood: "epic, defiant, the finale",
    tonic: 2,
    scale: MINOR,
    bpm: 122,
    chords: [ch(0, "m9"), ch(8, "maj7"), ch(3, "add9"), ch(10, "M"), ch(5, "m7"), ch(8, "maj7"), ch(10, "sus4"), ch(7, "M")],
    bass: "roll",
    arp: ARP_SPARKLE,
    arpWave: "sawtooth",
    padCutoff: 1400,
    padAttack: 0.2,
    gate: false,
    snare: false,
    hats16: true,
    a: [[0, 0, 4], [4, 4, 4], [8, 7, 6], [14, 6, 2], [16, 5, 4], [20, 4, 4], [24, 2, 8]],
    b: [[0, 4, 4], [4, 5, 4], [8, 6, 6], [14, 7, 2], [16, 8, 8], [24, 7, 4], [28, 4, 4]],
  },
];

/** The chord's pitch classes (0-11), root first. */
export function chordPcs(tonic: number, c: MusicChord): number[] {
  return QUALITY[c.q].map((x) => (tonic + c.root + x) % 12);
}

/** The lowest MIDI note at or above `lo` with pitch class `pc`. */
const placeAbove = (pc: number, lo: number): number => lo + ((((pc - lo) % 12) + 12) % 12);

/**
 * A four-voice pad voicing of `pcs` within [lo, hi], led from `prev` with the least total movement.
 * Five-note chords drop the root (the bass has it); triads double it.
 */
export function voiceLead(prev: number[] | null, pcs: number[], lo = 52, hi = 77): number[] {
  const voices = pcs.length >= 5 ? pcs.slice(1, 5) : pcs.length === 3 ? [...pcs, pcs[0]!] : pcs.slice(0, 4);
  const options = voices.map((pc) => {
    const out: number[] = [];
    for (let n = placeAbove(pc, lo); n <= hi; n += 12) out.push(n);
    return out;
  });
  let best: number[] = [];
  let bestCost = Infinity;
  const pick = (i: number, acc: number[]): void => {
    if (i === options.length) {
      const v = [...acc].sort((x, y) => x - y);
      if (new Set(v).size < v.length || v[v.length - 1]! - v[0]! > 19) return;
      // Least movement, then: stay compact, keep the register centred, avoid low semitone clusters.
      const spread = v[v.length - 1]! - v[0]!;
      const mean = v.reduce((s, n) => s + n, 0) / v.length;
      let cost = prev ? v.reduce((s, n, k) => s + Math.abs(n - (prev[k] ?? n)), 0) : 0;
      cost += Math.max(0, spread - 12) * 0.6 + Math.abs(mean - 63) * 0.4;
      for (let k = 1; k < v.length; k++) if (v[k]! - v[k - 1]! === 1 && v[k - 1]! < 60) cost += 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
      return;
    }
    for (const n of options[i]!) pick(i + 1, [...acc, n]);
  };
  pick(0, []);
  return best;
}

/** Voice-led pad voicings for a track's chord loop. */
export function padVoicings(tr: MusicTrack): number[][] {
  const out: number[][] = [];
  let prev: number[] | null = null;
  // Go round the loop until it settles, so the first chord is voiced as it follows the last.
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    tr.chords.forEach((c, i) => {
      prev = voiceLead(prev, chordPcs(tr.tonic, c));
      if (out[i]?.join() !== prev.join()) changed = true;
      out[i] = prev;
    });
    if (!changed) break;
  }
  return out;
}

/** The MIDI note of a scale degree above `base` (the tonic's MIDI note); degrees wrap by octaves. */
export function degreeMidi(base: number, scale: number[], degree: number): number {
  const len = scale.length;
  const oct = Math.floor(degree / len);
  return base + oct * 12 + scale[((degree % len) + len) % len]!;
}

/** Moves a note a semitone off a chord tone onto it (downwards first); leaves other notes alone. */
export function fitToChord(note: number, pcs: number[]): number {
  const has = (n: number) => pcs.includes(((n % 12) + 12) % 12);
  if (has(note)) return note;
  if (has(note - 1)) return note - 1;
  if (has(note + 1)) return note + 1;
  return note;
}

export interface ScoreNote {
  step: number; // 0-511 within the 32-bar cycle
  midi: number;
  len: number; // 16ths
}

/** The lead's 32-bar score: motifs stated, varied, sequenced, answered, rested and ornamented. */
export function buildLeadScore(tr: MusicTrack): ScoreNote[] {
  const A = tr.a;
  const B = tr.b;
  const seq = (m: MotifNote[], k: number): MotifNote[] => m.map(([s, d, l]) => [s, d + k, l]);
  const vary = (m: MotifNote[]): MotifNote[] =>
    m.map((n, i) => (i === m.length - 1 ? [n[0], n[1] >= 4 ? n[1] + 1 : n[1] - 1, n[2]] : n));
  const cadence = (m: MotifNote[]): MotifNote[] => m.map((n, i) => (i === m.length - 1 ? [n[0], 0, n[2]] : n));
  const split = (m: MotifNote[]): MotifNote[] =>
    m.flatMap(([s, d, l]): MotifNote[] =>
      l >= 4 ? Array.from({ length: Math.floor(l / 2) }, (_, j): MotifNote => [s + j * 2, d + (j % 2 === 1 ? 7 : 0), 2]) : [[s, d, l]],
    );
  // Two-bar phrases. Bars 16-17 and 28-31 rest (the breakdown and build).
  const plan: Array<MotifNote[] | null> = [
    A, vary(A), seq(A, 2), B,
    A, vary(A), seq(A, 2), cadence(B),
    null, B, split(A), vary(B),
    A, vary(A), null, null,
  ];
  const base = placeAbove(tr.tonic, 60);
  const out: ScoreNote[] = [];
  plan.forEach((m, p) => {
    if (!m) return;
    for (const [s, d, l] of m) {
      const step = p * 32 + s;
      const bar = Math.floor(step / 16);
      const pcs = chordPcs(tr.tonic, tr.chords[bar % tr.chords.length]!);
      let midi = degreeMidi(base, tr.scale, d);
      if (s % 4 === 0) midi = fitToChord(midi, pcs);
      while (midi > 86) midi -= 12;
      while (midi < 57) midi += 12;
      out.push({ step, midi, len: l });
    }
  });
  return out;
}

const BASS_LADDER: BassStyle[] = ["offbeat", "pulse", "gallop", "roll"];
/** [16th position, octave offset, length in 16ths] per bass style. */
const BASS_PATTERNS: Record<BassStyle, Array<[number, number, number]>> = {
  offbeat: [[2, 0, 2], [6, 0, 2], [10, 0, 2], [14, 12, 2]],
  pulse: [[0, 0, 2], [2, 12, 2], [4, 0, 2], [6, 12, 2], [8, 0, 2], [10, 12, 2], [12, 0, 2], [14, 12, 2]],
  gallop: [[0, 0, 1], [2, 0, 1], [3, 0, 1], [4, 12, 1], [6, 0, 1], [7, 0, 1], [8, 0, 1], [10, 0, 1], [11, 0, 1], [12, 12, 1], [14, 0, 1], [15, 0, 1]],
  roll: Array.from({ length: 16 }, (_, p): [number, number, number] => [p, p % 4 === 2 ? 12 : 0, 1]),
};

// ---- music: the synth graph ----

type Layer = "pad" | "bass" | "arp" | "hats" | "drums" | "lead" | "boss";
const LAYERS: Layer[] = ["pad", "bass", "arp", "hats", "drums", "lead", "boss"];
/** Each layer's gain at intensity 0, 1 and 2. */
const LAYER_LEVELS: Record<Layer, [number, number, number]> = {
  pad: [1, 0.85, 0.8],
  bass: [0.8, 1, 1],
  arp: [0.5, 1, 0.9],
  hats: [0.55, 1, 1],
  drums: [0, 1, 1],
  lead: [0, 1, 1],
  boss: [0, 0, 1],
};

interface MonoSynth {
  oscs: OscillatorNode[];
  filter: BiquadFilterNode;
  vca: GainNode;
}

interface MusicGraph {
  out: GainNode;
  mix: GainNode;
  duck: GainNode;
  layers: Record<Layer, GainNode>;
  reverbSend: GainNode;
  delaySend: GainNode;
  delayA: DelayNode;
  delayB: DelayNode;
  padL: AudioNode;
  padR: AudioNode;
  padFilter: BiquadFilterNode;
  padLfoDepth: GainNode;
  hatPan: AudioNode;
  bossL: AudioNode;
  bossR: AudioNode;
  bass: MonoSynth;
  lead: MonoSynth;
  leadOctave: GainNode;
  vibrato: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

let impulse: AudioBuffer | null = null;
/** A stereo reverb tail from decaying noise that darkens as it fades. */
function reverbImpulse(c: BaseAudioContext): AudioBuffer {
  if (impulse && impulse.sampleRate === c.sampleRate) return impulse;
  const len = Math.floor(c.sampleRate * 2.2);
  const fadeIn = Math.floor(c.sampleRate * 0.006);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let chn = 0; chn < 2; chn++) {
    const d = buf.getChannelData(chn);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      lp += (0.7 - 0.55 * x) * (Math.random() * 2 - 1 - lp);
      d[i] = lp * Math.exp(-x * 6) * Math.min(1, i / fadeIn);
    }
  }
  impulse = buf;
  return buf;
}

function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function panner(c: AudioContext, pan: number): AudioNode {
  if (typeof c.createStereoPanner !== "function") return c.createGain();
  const p = c.createStereoPanner();
  p.pan.value = pan;
  return p;
}

/** Disconnects a note's nodes once its source has stopped, so finished notes don't pile up. */
function cleanup(src: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
  src.onended = () => {
    src.disconnect();
    for (const n of nodes) n.disconnect();
  };
}

function buildGraph(c: AudioContext, bus: AudioNode): MusicGraph {
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const gain = (v: number): GainNode => {
    const g = c.createGain();
    g.gain.value = v;
    nodes.push(g);
    return g;
  };
  const filter = (type: BiquadFilterType, freq: number, q: number): BiquadFilterNode => {
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    nodes.push(f);
    return f;
  };
  const osc = (type: OscillatorType, freq: number): OscillatorNode => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    sources.push(o);
    nodes.push(o);
    return o;
  };
  const pan = (p: number): AudioNode => {
    const n = panner(c, p);
    nodes.push(n);
    return n;
  };

  // Output: mix -> glue compressor -> fade -> musicBus. The compressor adds about +7 dB of automatic
  // make-up gain, which MUSIC_LEVEL takes back off.
  const out = gain(0);
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 8;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  nodes.push(comp);
  const mix = gain(1);
  mix.connect(comp).connect(out).connect(bus);
  const duck = gain(1);
  duck.connect(mix);

  const layers = {} as Record<Layer, GainNode>;
  for (const l of LAYERS) layers[l] = gain(LAYER_LEVELS[l][intensity]!);
  for (const l of ["pad", "bass", "arp", "boss"] as Layer[]) layers[l].connect(duck);
  for (const l of ["hats", "drums", "lead"] as Layer[]) layers[l].connect(mix);

  // Reverb: high-passed so the low end stays dry, pumped by the side-chain.
  const reverbSend = gain(1);
  const verb = c.createConvolver();
  verb.buffer = reverbImpulse(c);
  nodes.push(verb);
  reverbSend.connect(filter("highpass", 280, 0.7)).connect(verb).connect(gain(0.4)).connect(duck);

  // Ping-pong delay with a darkening feedback loop.
  const delaySend = gain(1);
  const delayA = c.createDelay(1.5);
  const delayB = c.createDelay(1.5);
  nodes.push(delayA, delayB);
  const fbFilter = filter("lowpass", 2600, 0.5);
  delaySend.connect(delayA);
  delayA.connect(pan(-0.75)).connect(gain(0.32)).connect(mix);
  delayA.connect(fbFilter).connect(delayB);
  delayB.connect(pan(0.75)).connect(gain(0.32)).connect(mix);
  delayB.connect(gain(0.42)).connect(delayA);

  // Pads: left and right saws -> one breathing lowpass -> dry + chorus.
  const padL = pan(-0.6);
  const padR = pan(0.6);
  const padFilter = filter("lowpass", 1200, 1.5);
  padL.connect(padFilter);
  padR.connect(padFilter);
  padFilter.connect(layers.pad);
  const padLfo = osc("sine", 0.07);
  const padLfoDepth = gain(400);
  padLfo.connect(padLfoDepth).connect(padFilter.frequency);
  const chorusLfo = osc("sine", 0.33);
  for (const [base, depth, p] of [[0.013, 0.0022, -0.85], [0.019, -0.0022, 0.85]] as const) {
    const d = c.createDelay(0.05);
    d.delayTime.value = base;
    nodes.push(d);
    chorusLfo.connect(gain(depth)).connect(d.delayTime);
    padFilter.connect(d).connect(pan(p)).connect(gain(0.45)).connect(layers.pad);
  }
  const padVerb = gain(0.35);
  layers.pad.connect(padVerb).connect(reverbSend);

  // Mono bass: saw + sine through a resonant lowpass.
  const bassSaw = osc("sawtooth", 55);
  const bassSub = osc("sine", 55);
  const bassFilter = filter("lowpass", 300, 4);
  const bassVca = gain(0);
  bassSaw.connect(bassFilter);
  bassSub.connect(gain(0.6)).connect(bassVca);
  bassFilter.connect(bassVca).connect(layers.bass);

  // Mono lead: two detuned saws and an octave square (boss only), glide and delayed vibrato.
  const leadA = osc("sawtooth", 440);
  const leadB = osc("sawtooth", 440);
  const leadC = osc("square", 880);
  leadA.detune.value = -7;
  leadB.detune.value = 7;
  const leadFilter = filter("lowpass", 1800, 2);
  const leadVca = gain(0);
  const leadOctave = gain(0);
  leadA.connect(gain(0.5)).connect(leadFilter);
  leadB.connect(gain(0.5)).connect(leadFilter);
  leadC.connect(leadOctave).connect(leadFilter);
  leadFilter.connect(leadVca).connect(layers.lead);
  const vibLfo = osc("sine", 5.2);
  const vibrato = gain(0);
  vibLfo.connect(vibrato);
  for (const o of [leadA, leadB, leadC]) vibrato.connect(o.detune);
  layers.lead.connect(gain(0.3)).connect(delaySend);
  layers.lead.connect(gain(0.3)).connect(reverbSend);

  layers.arp.connect(gain(0.35)).connect(delaySend);
  layers.arp.connect(gain(0.2)).connect(reverbSend);
  layers.drums.connect(gain(0.1)).connect(reverbSend);
  layers.boss.connect(gain(0.25)).connect(delaySend);

  const hatPan = pan(0.25);
  hatPan.connect(layers.hats);
  const bossL = pan(-0.5);
  const bossR = pan(0.5);
  bossL.connect(layers.boss);
  bossR.connect(layers.boss);

  const t = c.currentTime;
  for (const s of sources) s.start(t);
  out.gain.setTargetAtTime(MUSIC_LEVEL, t, 0.08);
  return {
    out,
    mix,
    duck,
    layers,
    reverbSend,
    delaySend,
    delayA,
    delayB,
    padL,
    padR,
    padFilter,
    padLfoDepth,
    hatPan,
    bossL,
    bossR,
    bass: { oscs: [bassSaw, bassSub], filter: bassFilter, vca: bassVca },
    lead: { oscs: [leadA, leadB, leadC], filter: leadFilter, vca: leadVca },
    leadOctave,
    vibrato,
    sources,
    nodes,
  };
}

function destroyGraph(g: MusicGraph): void {
  for (const s of g.sources) {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  for (const n of g.nodes) n.disconnect();
}

// ---- music: voices (t is an absolute context time) ----

function padChord(c: AudioContext, g: MusicGraph, notes: number[], t: number, dur: number, attack: number): void {
  const peak = 0.016;
  const rel = 0.9;
  const end = t + dur + rel * 2;
  for (const [side, cents] of [[g.padL, -9], [g.padR, 9]] as const) {
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + attack);
    env.gain.setValueAtTime(peak, t + dur);
    env.gain.setTargetAtTime(0, t + dur, rel / 3);
    env.connect(side);
    notes.forEach((n, i) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midiHz(n);
      o.detune.value = cents + (i - 1.5) * 2;
      o.connect(env);
      o.start(t);
      o.stop(end);
      if (i === 0) cleanup(o, env);
      else o.onended = () => o.disconnect();
    });
  }
}

function bassNote(g: MusicGraph, midi: number, t: number, dur: number, cutoff: number): void {
  const f = midiHz(midi);
  for (const o of g.bass.oscs) o.frequency.setTargetAtTime(f, t, 0.002);
  g.bass.vca.gain.setTargetAtTime(0.075, t, 0.003);
  g.bass.vca.gain.setTargetAtTime(0, t + dur, 0.025);
  g.bass.filter.frequency.setTargetAtTime(cutoff * 4, t, 0.002);
  g.bass.filter.frequency.setTargetAtTime(cutoff, t + 0.012, 0.07);
}

function arpNote(c: AudioContext, g: MusicGraph, wave: OscillatorType, midi: number, t: number, dur: number, bright: number): void {
  const o = c.createOscillator();
  const f = c.createBiquadFilter();
  const env = c.createGain();
  o.type = wave;
  o.frequency.value = midiHz(midi);
  f.type = "lowpass";
  f.Q.value = 6;
  f.frequency.setValueAtTime(bright, t);
  f.frequency.setTargetAtTime(Math.max(350, bright * 0.2), t + 0.004, dur * 0.4);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.045, t + 0.004);
  env.gain.setTargetAtTime(0, t + 0.006, dur * 0.5);
  o.connect(f).connect(env).connect(g.layers.arp);
  o.start(t);
  o.stop(t + dur * 3.5);
  cleanup(o, f, env);
}

let leadEnd = 0;
function leadNote(g: MusicGraph, midi: number, t: number, dur: number, sd: number, gate: boolean): void {
  const f = midiHz(midi);
  const glide = Math.abs(t - leadEnd) < 0.01 ? 0.035 : 0.004;
  g.lead.oscs.forEach((o, i) => o.frequency.setTargetAtTime(i === 2 ? f * 2 : f, t, glide));
  const peak = 0.075;
  const vca = g.lead.vca.gain;
  vca.setTargetAtTime(peak, t, 0.008);
  if (gate && dur > sd * 3.5) {
    // A 16th-note trance gate across the held note.
    for (let k = 0; k * sd < dur - sd * 0.5; k++) {
      const s = t + k * sd;
      vca.setTargetAtTime(peak, s, 0.004);
      vca.setTargetAtTime(peak * 0.12, s + sd * 0.55, 0.012);
    }
  }
  vca.setTargetAtTime(0, t + dur * 0.92, 0.06);
  g.lead.filter.frequency.setTargetAtTime(intensity === 2 ? 5200 : 3800, t, 0.01);
  g.lead.filter.frequency.setTargetAtTime(intensity === 2 ? 2400 : 1700, t + 0.05, 0.25);
  g.vibrato.gain.setTargetAtTime(0, t, 0.02);
  if (dur > 0.35) g.vibrato.gain.setTargetAtTime(10, t + 0.22, 0.15);
  leadEnd = t + dur;
}

function noiseHit(
  c: AudioContext,
  dest: AudioNode,
  t: number,
  type: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
  decay: number,
): GainNode {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.002);
  env.gain.setTargetAtTime(0, t + 0.003, decay);
  src.connect(f).connect(env).connect(dest);
  src.start(t, Math.random() * 0.4);
  src.stop(t + 0.003 + decay * 7);
  cleanup(src, f, env);
  return env;
}

function kick(c: AudioContext, g: MusicGraph, t: number, peak = 0.18): void {
  const o = c.createOscillator();
  const env = c.createGain();
  o.frequency.setValueAtTime(155, t);
  o.frequency.exponentialRampToValueAtTime(47, t + 0.09);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.003);
  env.gain.setTargetAtTime(0, t + 0.05, 0.09);
  o.connect(env).connect(g.layers.drums);
  o.start(t);
  o.stop(t + 0.7);
  cleanup(o, env);
}

function clap(c: AudioContext, g: MusicGraph, t: number, vel = 1): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1300;
  f.Q.value = 0.9;
  const env = c.createGain();
  const peak = 0.26 * vel;
  env.gain.setValueAtTime(0, t);
  // Three quick bursts, then the tail: the "hands" of a clap.
  for (let i = 0; i < 3; i++) {
    env.gain.linearRampToValueAtTime(peak, t + i * 0.011 + 0.001);
    env.gain.linearRampToValueAtTime(peak * 0.2, t + i * 0.011 + 0.009);
  }
  env.gain.linearRampToValueAtTime(peak, t + 0.034);
  env.gain.setTargetAtTime(0, t + 0.036, 0.05);
  src.connect(f).connect(env).connect(g.layers.drums);
  src.start(t, Math.random() * 0.4);
  src.stop(t + 0.45);
  cleanup(src, f, env);
}

function snare(c: AudioContext, g: MusicGraph, t: number, vel = 1): void {
  noiseHit(c, g.layers.drums, t, "bandpass", 1900, 0.7, 0.24 * vel, 0.045);
  tom(c, g.layers.drums, t, 190, 0.08 * vel, 0.03);
}

function tom(c: AudioContext, dest: AudioNode, t: number, freq: number, peak = 0.14, decay = 0.08): void {
  const o = c.createOscillator();
  const env = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.2);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.003);
  env.gain.setTargetAtTime(0, t + 0.005, decay);
  o.connect(env).connect(dest);
  o.start(t);
  o.stop(t + decay * 7);
  cleanup(o, env);
}

function riser(c: AudioContext, dest: AudioNode, t: number, dur: number, peak: number): void {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 3;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + dur);
  env.gain.linearRampToValueAtTime(0, t + dur + 0.03);
  src.connect(f).connect(env).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.05);
  cleanup(src, f, env);
}

/** The side-chain: pads, bass, arp and reverb dip on every kick and swell back. */
function duckAt(g: MusicGraph, t: number, depth: number, beat: number): void {
  const p = g.duck.gain;
  p.setValueAtTime(1, t);
  p.linearRampToValueAtTime(1 - depth, t + 0.008);
  p.setTargetAtTime(1, t + 0.03, beat * 0.2);
}

// ---- music: the sequencer ----

const LOOKAHEAD = 0.2;
const MUSIC_LEVEL = 0.45;
const TICK_MS = 50;
let graph: MusicGraph | null = null;
let track: MusicTrack = TRACKS[0]!;
let voicings: number[][] = [];
let score = new Map<number, ScoreNote>();
let act = -1;
let step = 0;
let nextTime = 0;
let musicTimer = 0;
let teardownTimer = 0;
let intensity = 0;
let crashDue = false;
const fadeUntil: Partial<Record<Layer, number>> = {};

/** True while a layer can be heard (or is still fading out), so silent layers cost nothing. */
function live(l: Layer): boolean {
  return LAYER_LEVELS[l][intensity]! > 0 || (ctx !== null && ctx.currentTime < (fadeUntil[l] ?? 0));
}

const sweep = (bar: number, period: number): number => 0.5 - 0.5 * Math.cos((2 * Math.PI * (bar % period)) / period);

function playStep(c: AudioContext, g: MusicGraph, s: number, t: number, sd: number): void {
  const tr = track;
  const pos = s % 16;
  const bar = Math.floor(s / 16);
  const cyc = bar % 32;
  const n = tr.chords.length;
  const chord = tr.chords[bar % n]!;
  const voicing = voicings[bar % n]!;
  const breakdown = cyc === 28 || cyc === 29;
  const build = cyc === 30 || cyc === 31;
  const lvl = intensity;
  const beat = sd * 4;

  // Harmony: a voice-led pad chord each bar, and the slow filter sweeps.
  if (pos === 0) {
    padChord(c, g, voicing, t, beat * 4, tr.padAttack);
    const open = (0.75 + 0.5 * sweep(bar, 32)) * (lvl === 0 ? 0.85 : lvl === 2 ? 1.3 : 1) * (breakdown ? 1.6 : 1);
    g.padFilter.frequency.setTargetAtTime(tr.padCutoff * open, t, beat * 2);
  }

  // Bass, side-chained: a style one step calmer while building and one step busier for a boss.
  if (live("bass")) {
    const base = BASS_LADDER.indexOf(tr.bass);
    const idx = Math.max(0, Math.min(3, base + (lvl === 2 ? 1 : 0) - (lvl === 0 && base > 1 ? 1 : 0)));
    const hit = BASS_PATTERNS[BASS_LADDER[idx]!].find((p) => p[0] === pos);
    if (hit) {
      const next = tr.chords[(bar + 1) % n]!;
      const c0 = pos === 15 ? next : chord;
      const pc = (tr.tonic + (c0.bass ?? c0.root)) % 12;
      const cutoff = (lvl === 0 ? 260 : lvl === 2 ? 650 : 420) * (breakdown ? 0.7 : 1);
      bassNote(g, placeAbove(pc, 33) + hit[1], t, hit[2] * sd * 0.8, cutoff);
    }
  }

  // Arpeggio: 8ths while building, 16ths after; the pattern shifts every 8 bars; a 16-bar filter sweep.
  if (live("arp") && (lvl > 0 || pos % 2 === 0)) {
    const shift = Math.floor(cyc / 8) % 2 === 1 ? 2 : 0;
    const k = tr.arp[(pos + shift) % 16]!;
    if (k >= 0) {
      const tones = [...voicing, ...voicing.map((v) => v + 12)];
      const bright = (900 + 3000 * sweep(bar, 16)) * (lvl === 0 ? 0.6 : lvl === 2 ? 1.3 : 1) * (build ? 1.4 : 1);
      arpNote(c, g, tr.arpWave, tones[k]!, t, sd, bright);
    }
  }

  // Lead.
  if (live("lead")) {
    const note = score.get(s % 512);
    if (note) leadNote(g, note.midi, t, note.len * sd, sd, tr.gate || lvl === 2);
  }

  // The side-chain pump on every beat (none in the breakdown, so the pads bloom).
  if (pos % 4 === 0 && !breakdown) duckAt(g, t, lvl === 0 ? 0.3 : lvl === 2 ? 0.7 : 0.6, beat);

  // Drums.
  if (live("drums")) {
    const D = g.layers.drums;
    if (pos === 0 && (crashDue || cyc % (act === 9 ? 8 : 16) === 0)) {
      noiseHit(c, D, t, "highpass", 4500, 0.5, 0.07, 0.4);
      crashDue = false;
    }
    if (!breakdown) {
      if (pos % 4 === 0) kick(c, g, t);
      if (pos === 14 && bar % 4 === 3 && act >= 5) kick(c, g, t, 0.12);
      if (pos === 4 || pos === 12) (tr.snare ? snare : clap)(c, g, t);
      if (pos % 4 === 2) noiseHit(c, D, t, "highpass", 6500, 0.7, 0.045, 0.06);
    }
    // Fills: a clap roll at the end of every 8 bars, toms at the end of 16, a build into the top.
    if (cyc % 8 === 7 && cyc !== 31 && pos >= 12) (tr.snare ? snare : clap)(c, g, t, 0.35 + (pos - 12) * 0.15);
    if (cyc % 16 === 15 && pos >= 8 && pos % 2 === 0) tom(c, D, t, [220, 180, 150, 120][(pos - 8) / 2]!);
    if (cyc === 31 && (pos % 2 === 0 || pos >= 8)) (tr.snare ? snare : clap)(c, g, t, 0.25 + pos * 0.045);
    if (cyc === 30 && pos === 0) riser(c, D, t, beat * 8, 0.12);
  }

  // Hats: light 8ths (or 16ths) always, accented on the off-beat.
  if (live("hats") && (pos % 2 === 0 || tr.hats16)) {
    const accent = pos % 4 === 2 ? 1 : pos % 2 === 0 ? 0.7 : 0.45;
    noiseHit(c, g.hatPan, t, "highpass", 7500, 0.7, 0.05 * accent, 0.012);
  }

  // Boss layer: a 16th-note ostinato on root and fifth, extra hats, and a riser every 4 bars.
  if (live("boss")) {
    const root = placeAbove((tr.tonic + chord.root) % 12, 72);
    const o = [root, root + 7, root + 12, root + 7][pos % 4]!;
    arpNoteTo(c, pos % 2 === 0 ? g.bossL : g.bossR, o, t, sd);
    if (!tr.hats16 && pos % 2 === 1) noiseHit(c, g.bossR, t, "highpass", 8000, 0.7, 0.025, 0.01);
    if (bar % 4 === 3 && pos === 0) riser(c, g.layers.boss, t, beat * 4, 0.1);
  }
}

/** A short, bright pluck for the boss ostinato. */
function arpNoteTo(c: AudioContext, dest: AudioNode, midi: number, t: number, sd: number): void {
  const o = c.createOscillator();
  const f = c.createBiquadFilter();
  const env = c.createGain();
  o.type = "sawtooth";
  o.frequency.value = midiHz(midi);
  f.type = "lowpass";
  f.Q.value = 8;
  f.frequency.setValueAtTime(4200, t);
  f.frequency.setTargetAtTime(700, t + 0.003, sd * 0.35);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.022, t + 0.003);
  env.gain.setTargetAtTime(0, t + 0.005, sd * 0.4);
  o.connect(f).connect(env).connect(dest);
  o.start(t);
  o.stop(t + sd * 3);
  cleanup(o, f, env);
}

function tick(): void {
  const c = ctx;
  const g = graph;
  if (!c || !g) return;
  const sd = 60 / track.bpm / 4;
  const now = c.currentTime;
  // Fell behind (a background tab, a suspended context): skip ahead in time, keeping the bar position.
  if (nextTime < now - 0.05) {
    const skip = Math.ceil((now - nextTime) / sd);
    step += skip;
    nextTime += skip * sd;
  }
  while (nextTime < now + LOOKAHEAD) {
    if (!muted) playStep(c, g, step, nextTime, sd);
    step += 1;
    nextTime += sd;
  }
}

function applyLevels(tau: number): void {
  const c = ctx;
  const g = graph;
  if (!c || !g) return;
  const now = c.currentTime;
  for (const l of LAYERS) {
    const target = LAYER_LEVELS[l][intensity]!;
    const p = g.layers[l].gain;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(target, now, tau);
    if (target === 0) fadeUntil[l] = now + tau * 6;
  }
  g.leadOctave.gain.cancelScheduledValues(now);
  // The finale doubles its lead an octave up through every wave.
  g.leadOctave.gain.setTargetAtTime(intensity === 2 ? 0.3 : intensity === 1 && act === 9 ? 0.18 : 0, now, tau);
  g.padFilter.Q.cancelScheduledValues(now);
  g.padFilter.Q.setTargetAtTime(intensity === 2 ? 6 : 1.5, now, tau * 2);
}

/** Starts (or switches) the act's music. */
export function startMusic(actIndex: number): void {
  const c = context();
  if (!c || !musicBus) return;
  const idx = ((Math.floor(actIndex) % TRACKS.length) + TRACKS.length) % TRACKS.length;
  window.clearTimeout(teardownTimer);
  teardownTimer = 0;
  const fresh = !graph;
  if (!graph) graph = buildGraph(c, musicBus);
  const g = graph;
  const now = c.currentTime;
  if (fresh || idx !== act) {
    act = idx;
    track = TRACKS[idx]!;
    voicings = padVoicings(track);
    score = new Map(buildLeadScore(track).map((n) => [n.step, n]));
    step = 0;
    nextTime = fresh ? now + 0.1 : Math.max(nextTime, now + 0.05);
    const beat = 60 / track.bpm;
    g.delayA.delayTime.setTargetAtTime(beat * 0.75, now, 0.05);
    g.delayB.delayTime.setTargetAtTime(beat * 0.75, now, 0.05);
    g.padLfoDepth.gain.setTargetAtTime(track.padCutoff * 0.3, now, 0.05);
    g.padFilter.frequency.setTargetAtTime(track.padCutoff, now, 0.05);
    applyLevels(0.05);
  }
  g.out.gain.cancelScheduledValues(now);
  g.out.gain.setTargetAtTime(MUSIC_LEVEL, now, 0.08);
  if (!musicTimer) musicTimer = window.setInterval(tick, TICK_MS);
  tick();
}

export function stopMusic(): void {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  const c = ctx;
  const g = graph;
  if (!c || !g) return;
  g.out.gain.cancelScheduledValues(c.currentTime);
  g.out.gain.setTargetAtTime(0, c.currentTime, 0.12);
  window.clearTimeout(teardownTimer);
  teardownTimer = window.setTimeout(() => {
    teardownTimer = 0;
    if (graph === g && !musicTimer) {
      destroyGraph(g);
      graph = null;
    }
  }, 1000);
}

/** 0 = building, 1 = a wave, 2 = a boss on the lane. Cheap to call every frame. */
export function setIntensity(level: number): void {
  const lv = Math.max(0, Math.min(2, Math.round(level)));
  if (lv === intensity) return;
  if (intensity === 0 && lv > 0) crashDue = true;
  intensity = lv;
  applyLevels(0.45);
}
