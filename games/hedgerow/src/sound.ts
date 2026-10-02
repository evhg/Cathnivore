// Hedgerow's synthesised sound (no audio files): effects for every tower, hit and ability, plus a small
// generative folk band per act (bass, plucked arpeggios, a whistled tune, and percussion that comes in
// during waves). The context is only created on a tap, so the page stays silent until the player acts.
// The mute choice lives in localStorage, best-effort.

const KEY = "hedgerow:sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let muted = false;
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
  musicBus.gain.value = 0.55;
  fxBus.connect(master);
  musicBus.connect(master);
  master.connect(comp).connect(ctx.destination);
  return ctx;
}

/** Call from any tap: creates or resumes the audio context. */
export function unlock(): void {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

function ready(): boolean {
  if (muted) return false;
  const c = context();
  if (!c) return false;
  if (c.state === "suspended") void c.resume();
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
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = absolute ? at : c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
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

// ---- music ----

/** Root note (MIDI) and mode per act: brighter early, darker as the corporations close in, home at the end. */
const ACT_KEYS: Array<{ root: number; minor: boolean; bpm: number }> = [
  { root: 62, minor: false, bpm: 100 },
  { root: 64, minor: false, bpm: 104 },
  { root: 57, minor: true, bpm: 96 },
  { root: 60, minor: false, bpm: 104 },
  { root: 62, minor: true, bpm: 100 },
  { root: 65, minor: false, bpm: 108 },
  { root: 59, minor: true, bpm: 110 },
  { root: 67, minor: false, bpm: 112 },
  { root: 57, minor: true, bpm: 116 },
  { root: 62, minor: true, bpm: 120 },
];

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

let musicTimer = 0;
let nextBeat = 0;
let beat = 0;
let act = 0;
let intensity = 0;
let seed = 1;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function pluck(freq: number, t0: number, dur: number, peak: number, type: OscillatorType = "triangle"): void {
  const c = ctx;
  if (!c || !musicBus) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(musicBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function schedule(): void {
  const c = ctx;
  if (!c || muted) return;
  const key = ACT_KEYS[act % ACT_KEYS.length]!;
  const spb = 60 / key.bpm / 2; // eighth notes
  const third = key.minor ? 3 : 4;
  // I - vi - IV - V (major) or i - VI - iv - v (minor), one chord a bar.
  const prog = key.minor ? [0, 8, 5, 7] : [0, 9, 5, 7];
  const scale = key.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  while (nextBeat < c.currentTime + 0.25) {
    const bar = Math.floor(beat / 8) % 4;
    const step = beat % 8;
    const chordRoot = key.root + prog[bar]!;
    const minorChord = key.minor ? bar !== 1 && bar !== 3 : bar === 1;
    const tones = [0, minorChord ? 3 : third === 3 ? 3 : 4, 7].map((x) => chordRoot + x);
    const t = nextBeat;
    if (step === 0 || step === 4) pluck(midi(chordRoot - 24), t, spb * 3.5, 0.09, "sine");
    // Plucked arpeggio.
    const arp = tones[[0, 1, 2, 1, 0, 2, 1, 2][step]!]!;
    pluck(midi(arp), t, spb * 1.6, 0.025);
    // A whistled tune, sparse.
    if ((step === 0 || step === 3 || step === 6) && rnd() < 0.55) {
      const deg = scale[Math.floor(rnd() * scale.length)]!;
      pluck(midi(key.root + 12 + deg), t, spb * (step === 6 ? 2.5 : 1.8), 0.02, "sine");
    }
    // Percussion when there's a wave on.
    if (intensity > 0) {
      if (step % 2 === 0) noise(t, 0.04, 0.025, { type: "highpass", freq: 6000 }, musicBus, true);
      if (step === 0 || step === 4) {
        const k = c.createOscillator();
        const g = c.createGain();
        k.frequency.setValueAtTime(110, t);
        k.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        k.connect(g).connect(musicBus!);
        k.start(t);
        k.stop(t + 0.2);
      }
      if (intensity > 1 && (step === 2 || step === 6)) noise(t, 0.09, 0.05, { type: "bandpass", freq: 1500 }, musicBus, true);
    }
    nextBeat += spb;
    beat += 1;
  }
}

/** Starts (or switches) the act's music. */
export function startMusic(actIndex: number): void {
  act = actIndex;
  seed = actIndex * 9973 + 7;
  const c = context();
  if (!c) return;
  if (!musicTimer) {
    nextBeat = c.currentTime + 0.1;
    beat = 0;
    musicTimer = window.setInterval(schedule, 90);
  }
}

export function stopMusic(): void {
  window.clearInterval(musicTimer);
  musicTimer = 0;
}

/** 0 = building, 1 = a wave, 2 = a boss on the lane. */
export function setIntensity(level: number): void {
  intensity = level;
}
