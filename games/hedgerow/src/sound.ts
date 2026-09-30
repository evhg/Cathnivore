// Hedgerow's synthesised sound set (no audio files). The context is only created on a tap, so
// the page stays silent until the player acts. The mute choice lives in localStorage, best-effort.
const KEY = "hedgerow:sound";
let ctx: AudioContext | null = null;
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
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

function tone(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  slideTo?: number,
): void {
  const c = ctx;
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function ready(): boolean {
  if (muted) return false;
  const c = context();
  if (!c) return false;
  if (c.state === "suspended") void c.resume();
  return c.state === "running" || c.state === "suspended";
}

/** Noise burst for thuds and leaks. */
function noise(at: number, dur: number, peak: number): void {
  const c = ctx;
  if (!c) return;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  const g = c.createGain();
  src.buffer = buf;
  g.gain.value = peak;
  src.connect(g).connect(c.destination);
  src.start(c.currentTime + at);
}

export function playBuild(): void {
  if (!ready()) return;
  tone(220, 0, 0.09, "triangle", 0.07, 330);
  tone(330, 0.07, 0.12, "triangle", 0.06);
}
export function playUpgrade(): void {
  if (!ready()) return;
  [392, 523, 659].forEach((f, i) => tone(f, i * 0.06, 0.14, "triangle", 0.05));
}
export function playSell(): void {
  if (!ready()) return;
  tone(500, 0, 0.1, "square", 0.03, 250);
}
export function playShot(kind: string): void {
  if (!ready()) return;
  if (kind === "beehive") tone(180, 0, 0.12, "sawtooth", 0.015, 260);
  else tone(700, 0, 0.05, "triangle", 0.025, 380);
}
export function playKill(): void {
  if (!ready()) return;
  tone(880, 0, 0.08, "sine", 0.03, 1320);
}
export function playLeak(): void {
  if (!ready()) return;
  tone(150, 0, 0.25, "sawtooth", 0.06, 70);
  noise(0, 0.15, 0.04);
}
export function playWave(): void {
  if (!ready()) return;
  tone(262, 0, 0.18, "triangle", 0.06);
  tone(392, 0.16, 0.24, "triangle", 0.06);
}
export function playPie(): void {
  if (!ready()) return;
  tone(300, 0, 0.3, "sine", 0.06, 900);
  noise(0.28, 0.12, 0.05);
}
export function playWin(): void {
  if (!ready()) return;
  [523, 659, 784, 1047].forEach((f, i) =>
    tone(f, i * 0.11, 0.32, "triangle", 0.06),
  );
}
export function playLose(): void {
  if (!ready()) return;
  [392, 330, 262, 196].forEach((f, i) =>
    tone(f, i * 0.16, 0.34, "triangle", 0.05),
  );
}
