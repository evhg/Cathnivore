// Layered gunshot audio (S2.5). At load an OfflineAudioContext pre-renders 8 variants per weapon class from
// layered recipes (transient, body, LFE; the mechanics on their own dry buffer); each shot picks a variant that
// differs from the last two. Live on top: a convolver tail (1.4 s outdoors, 0.8 s indoors), up to five
// reflections from the walls the caller's rays found, and the beds (music, rain) ducking 4 dB while she fires.
// Also here: the dry fire, the reload's foley, the slide and the whiz of a round passing her head.
//
// The recipe tables and the variant picker are pure (tests/cathode-gunsound.test.ts); everything that touches
// WebAudio is behind the GunSound class, built only in a browser.

import { db, tuning } from "./feel/tuning";

const G = tuning.gunsound;

/** One class's layers (S2.5 table): levels in dB, times in seconds, frequencies in Hz. */
export interface GunRecipe {
  transient: { dur: number; hp: number; db: number };
  body: { dur: number; lp: number; sweep: [number, number]; db: number };
  mech: { at: number[]; bp: number; q: number; db: number };
  lfe: { hz: number; dur: number; db: number };
  /** Tail send level (dB). */
  tail: number;
}

export const RECIPES: Record<string, GunRecipe> = {
  pistol: {
    transient: { dur: 0.012, hp: 1500, db: -9 },
    body: { dur: 0.09, lp: 2200, sweep: [160, 70], db: -10 },
    mech: { at: [0.022, 0.062], bp: 3500, q: 6, db: -14 },
    lfe: { hz: 55, dur: 0.1, db: -16 },
    tail: -12,
  },
  revolver: {
    transient: { dur: 0.016, hp: 1200, db: -6 },
    body: { dur: 0.22, lp: 3800, sweep: [120, 45], db: -6 },
    mech: { at: [0.3], bp: 2200, q: 5, db: -16 },
    lfe: { hz: 45, dur: 0.16, db: -6 },
    tail: -8,
  },
  smg: {
    transient: { dur: 0.008, hp: 2600, db: -8 },
    body: { dur: 0.08, lp: 3200, sweep: [190, 80], db: -9 },
    mech: { at: [0.018], bp: 3000, q: 5, db: -18 },
    lfe: { hz: 45, dur: 0.1, db: -10 },
    tail: -14,
  },
  rifle: {
    transient: { dur: 0.01, hp: 2400, db: -6 },
    body: { dur: 0.16, lp: 2600, sweep: [140, 55], db: -6 },
    mech: { at: [0.02], bp: 2800, q: 5, db: -18 },
    lfe: { hz: 45, dur: 0.16, db: -6 },
    tail: -8,
  },
  shotgun: {
    transient: { dur: 0.014, hp: 1800, db: -5 },
    body: { dur: 0.32, lp: 4200, sweep: [130, 38], db: -4 },
    mech: { at: [0.42, 0.58], bp: 1500, q: 4, db: -12 },
    lfe: { hz: 45, dur: 0.16, db: -6 },
    tail: -6,
  },
  sniper: {
    transient: { dur: 0.01, hp: 2500, db: -4 },
    body: { dur: 0.5, lp: 2200, sweep: [90, 30], db: -5 },
    mech: { at: [0.62, 0.84], bp: 1800, q: 5, db: -14 },
    lfe: { hz: 45, dur: 0.16, db: -6 },
    tail: -5,
  },
  launcher: {
    transient: { dur: 0.012, hp: 900, db: -8 },
    body: { dur: 0.45, lp: 1800, sweep: [70, 28], db: -5 },
    mech: { at: [0.5], bp: 900, q: 4, db: -14 },
    lfe: { hz: 45, dur: 0.16, db: -6 },
    tail: -5,
  },
};
RECIPES.smart = RECIPES.smg!;

/** A small seeded PRNG (mulberry32), so a variant set is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A variant's jitter: pitch, body length and level, each within ±(6 to 9)%, so the 8 are distinct but the
 * same gun. Returned as numbers so tests can check the set is distinct.
 */
export interface Variation {
  pitch: number;
  len: number;
  level: number;
  seed: number;
}

export function variations(n = G.variants, seed = 9): Variation[] {
  const r = rng(seed);
  const out: Variation[] = [];
  for (let i = 0; i < n; i++) {
    // Spread the pitch evenly across the range (shuffled by the jitter) so no two land on the same note.
    const base = -0.06 + (0.12 * (i + 0.5)) / n;
    out.push({ pitch: 1 + base + (r() - 0.5) * (0.1 / n), len: 1 + (r() - 0.5) * 0.18, level: 1 + (r() - 0.5) * 0.12, seed: Math.floor(r() * 1e9) });
  }
  return out;
}

/** Picks a variant that isn't any of the last `noRepeat` picks (S2.5: never one of the last two). */
export class VariantPicker {
  private recent: number[] = [];
  constructor(
    readonly n = G.variants,
    readonly noRepeat = G.noRepeat,
    private readonly rand: () => number = Math.random,
  ) {}

  pick(): number {
    const free: number[] = [];
    for (let i = 0; i < this.n; i++) if (!this.recent.includes(i)) free.push(i);
    const i = free[Math.min(free.length - 1, Math.floor(this.rand() * free.length))]!;
    this.recent.push(i);
    if (this.recent.length > this.noRepeat) this.recent.shift();
    return i;
  }
}

/** The delay and level of one reflection off a wall `d` metres away (S2.5: 2d/343 s, -14 dB - 0.3 dB/m). */
export function reflection(d: number): { delay: number; gain: number } {
  return { delay: (2 * d) / 343, gain: db(G.reflDb - G.reflDbPerM * d) };
}

/** Where the five reflection rays go, in the camera's yaw frame: left, right, front, back, up. */
export const REFL_DIRS: [number, number, number, number][] = [
  // [x, y, z, pan] with -Z ahead.
  [-1, 0, 0, -0.85],
  [1, 0, 0, 0.85],
  [0, 0, -1, 0],
  [0, 0, 1, 0],
  [0, 1, 0, 0],
];

// ---------------------------------------------------------------- WebAudio (browser only)

function noiseInto(d: Float32Array, r: () => number): void {
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
}

/** Renders one variant: [world buffer (transient + body + LFE), dry buffer (mechanics)]. */
async function renderVariant(rate: number, rec: GunRecipe, v: Variation): Promise<[AudioBuffer, AudioBuffer]> {
  const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const len = Math.max(rec.body.dur * v.len, rec.lfe.dur) + 0.06;
  const r = rng(v.seed);
  const world = new OAC(1, Math.ceil(rate * len), rate);
  const noise = world.createBuffer(1, Math.ceil(rate * len), rate);
  noiseInto(noise.getChannelData(0), r);
  const play = (ctx: BaseAudioContext, chain: AudioNode[], buf: AudioBuffer, t0: number) => {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = v.pitch;
    let n: AudioNode = s;
    for (const c of chain) n = n.connect(c);
    n.connect(ctx.destination);
    s.start(t0);
  };
  // Transient: white noise, high-passed, a 1 ms attack.
  {
    const hp = world.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = rec.transient.hp * v.pitch;
    const g = world.createGain();
    const T = rec.transient.dur;
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(db(rec.transient.db) * v.level, 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, T);
    play(world, [hp, g], noise, 0);
  }
  // Body: noise low-passed, plus a sine swept down.
  {
    const lp = world.createBiquadFilter();
    lp.type = "lowpass";
    const B = rec.body.dur * v.len;
    lp.frequency.setValueAtTime(rec.body.lp * v.pitch, 0);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, rec.body.lp * 0.25), B);
    const g = world.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(db(rec.body.db) * v.level, 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, B);
    play(world, [lp, g], noise, 0);
    const o = world.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(rec.body.sweep[0] * v.pitch, 0);
    o.frequency.exponentialRampToValueAtTime(rec.body.sweep[1] * v.pitch, B);
    const og = world.createGain();
    og.gain.setValueAtTime(db(rec.body.db) * 0.8 * v.level, 0);
    og.gain.exponentialRampToValueAtTime(0.0001, B);
    o.connect(og).connect(world.destination);
    o.start(0);
    o.stop(B + 0.01);
  }
  // LFE: a short low sine.
  {
    const o = world.createOscillator();
    o.type = "sine";
    o.frequency.value = rec.lfe.hz * (0.97 + (v.pitch - 1) * 0.5);
    const g = world.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(db(rec.lfe.db) * v.level, 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, rec.lfe.dur);
    o.connect(g).connect(world.destination);
    o.start(0);
    o.stop(rec.lfe.dur + 0.01);
  }
  const dlen = Math.max(...rec.mech.at) + 0.05;
  const dry = new OAC(1, Math.ceil(rate * dlen), rate);
  for (const at of rec.mech.at) {
    const bp = dry.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = rec.mech.bp * (0.96 + r() * 0.08);
    bp.Q.value = rec.mech.q;
    const g = dry.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(db(rec.mech.db) * 4 * v.level, at + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.022);
    const nb = dry.createBuffer(1, Math.ceil(rate * 0.03), rate);
    noiseInto(nb.getChannelData(0), r);
    const s = dry.createBufferSource();
    s.buffer = nb;
    s.connect(bp).connect(g).connect(dry.destination);
    s.start(at);
  }
  return Promise.all([world.startRendering(), dry.startRendering()]);
}

/** A procedural tail IR: decaying noise, low-passed (darker outdoors, shorter indoors). */
function tailIR(ctx: BaseAudioContext, seconds: number, lpHz: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  const r = rng(seconds * 1000);
  // A one-pole low-pass in the generator stands in for the filter.
  const a = Math.exp((-2 * Math.PI * lpHz) / rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      y = (1 - a) * (r() * 2 - 1) + a * y;
      // Early density, then an exponential decay to -60 dB at the end.
      d[i] = y * 3 * Math.exp((-6.9 * i) / len);
    }
  }
  return buf;
}

export interface GunBuses {
  /** The world bus (ducked with kills, muffled in slow motion). */
  world: AudioNode;
  /** The dry bus (never muffled). */
  dry: AudioNode;
  /** The beds (music and ambience) duck while she fires. */
  beds: GainNode;
}

export class GunSound {
  private readonly sets = new Map<string, [AudioBuffer, AudioBuffer][]>();
  private readonly pickers = new Map<string, VariantPicker>();
  private readonly pending = new Set<string>();
  private readonly tailOut: ConvolverNode;
  private readonly tailIn: ConvolverNode;
  private readonly tailOutSend: GainNode;
  private readonly tailInSend: GainNode;
  private readonly lp: BiquadFilterNode;
  indoor = false;
  /** C17: the kill-cam plays every gun an octave down (0.5). */
  rate = 1;

  constructor(
    private readonly ctx: AudioContext,
    private readonly bus: GunBuses,
  ) {
    const c = ctx;
    this.tailOut = c.createConvolver();
    this.tailOut.buffer = tailIR(c, 1.4, 3000);
    this.tailIn = c.createConvolver();
    this.tailIn.buffer = tailIR(c, 0.8, 5000);
    this.tailOutSend = c.createGain();
    this.tailInSend = c.createGain();
    this.tailOutSend.connect(this.tailOut).connect(bus.world);
    this.tailInSend.connect(this.tailIn).connect(bus.world);
    // Reflections share one 1.8 kHz low-pass.
    this.lp = c.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = 1800;
    this.lp.connect(bus.world);
  }

  /** Pre-renders a class's variants (in the background, at most once). */
  prepare(cls: string): void {
    const rec = RECIPES[cls];
    if (!rec || this.sets.has(cls) || this.pending.has(cls)) return;
    this.pending.add(cls);
    const vs = variations(G.variants, cls.length * 131 + 7);
    void Promise.all(vs.map((v) => renderVariant(this.ctx.sampleRate, rec, v)))
      .then((set) => {
        this.sets.set(cls, set);
        this.pickers.set(cls, new VariantPicker());
      })
      .catch(() => undefined)
      .finally(() => this.pending.delete(cls));
  }

  ready(cls: string): boolean {
    return this.sets.has(cls);
  }

  /**
   * A shot of class `cls`. `walls` are the reflection rays' hits: distance (m) and pan. Returns false when the
   * class has no pre-rendered set yet (the caller plays its live fallback).
   */
  fire(cls: string, walls: { d: number; pan: number }[] = []): boolean {
    const set = this.sets.get(cls);
    const rec = RECIPES[cls];
    if (!set || !rec) {
      this.prepare(cls);
      return false;
    }
    const [buf, mech] = set[this.pickers.get(cls)!.pick()]!;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.playbackRate.value = this.rate;
    src.buffer = buf;
    src.connect(this.bus.world);
    const send = this.indoor ? this.tailInSend : this.tailOutSend;
    send.gain.value = db(rec.tail);
    src.connect(send);
    src.start(t);
    const m = c.createBufferSource();
    m.playbackRate.value = this.rate;
    m.buffer = mech;
    m.connect(this.bus.dry);
    m.start(t);
    for (const w of walls.slice(0, 6)) {
      if (w.d > G.reflMaxM) continue;
      const r = reflection(w.d);
      const s = c.createBufferSource();
      s.playbackRate.value = this.rate;
      s.buffer = buf;
      const g = c.createGain();
      g.gain.value = r.gain;
      const p = c.createStereoPanner();
      p.pan.value = w.pan;
      s.connect(g).connect(p).connect(this.lp);
      s.start(t + r.delay);
    }
    this.duckBeds();
    return true;
  }

  /** The beds duck 4 dB with a 20 ms attack and a 400 ms release. */
  duckBeds(): void {
    const t = this.ctx.currentTime;
    const g = this.bus.beds.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(db(G.duckDb), t, G.duckAttackMs / 1000 / 3);
    g.setTargetAtTime(1, t + 0.06, G.duckReleaseMs / 1000 / 3);
  }

  // ---- foley (live: short and cheap) ----

  private click(when: number, hz: number, q: number, peak: number, dur = 0.018, out: AudioNode = this.bus.dry): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const n = c.createBuffer(1, Math.ceil(c.sampleRate * (dur + 0.01)), c.sampleRate);
    noiseInto(n.getChannelData(0), Math.random);
    const s = c.createBufferSource();
    s.playbackRate.value = this.rate;
    s.buffer = n;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.0008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(out);
    s.start(t);
  }

  private knock(when: number, from: number, to: number, dur: number, peak: number): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus.world);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private rub(when: number, hz: number, dur: number, peak: number, sweepTo = hz): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const n = c.createBuffer(1, Math.ceil(c.sampleRate * (dur + 0.02)), c.sampleRate);
    noiseInto(n.getChannelData(0), Math.random);
    const s = c.createBufferSource();
    s.playbackRate.value = this.rate;
    s.buffer = n;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(hz, t);
    bp.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(this.bus.world);
    s.start(t);
  }

  /** The dry fire on an empty gun: two 4 kHz clicks, no shot. */
  dryFire(): void {
    const L = tuning.kestrel.lock;
    this.click(0, L.dryClickHz, 6, 0.22, 0.012);
    this.click(L.dryGapMs / 1000, L.dryClickHz * 0.92, 6, 0.16, 0.012);
  }

  /** A clip cue from the viewmodel (reload, draw, rack, press-check, inspect). */
  cue(name: string): void {
    switch (name) {
      case "magRelease":
        this.click(0, 2600, 5, 0.18);
        this.rub(0.01, 1800, 0.07, 0.05, 900);
        break;
      case "magDrop":
        break; // The dropped mag rings when it lands (`magLand`).
      case "magPouch":
        this.rub(0, 700, 0.14, 0.04, 400);
        break;
      case "magIn":
        this.rub(0, 1500, 0.05, 0.06, 2600);
        break;
      case "seat":
        this.click(0, 3200, 6, 0.3, 0.014);
        this.knock(0.004, 420, 180, 0.06, 0.18);
        break;
      case "slideStop":
        this.click(0, 3600, 7, 0.12, 0.01);
        break;
      case "slam":
      case "rackHome":
        this.click(0, 2400, 4, 0.34, 0.02);
        this.click(0.012, 1100, 3, 0.2, 0.03);
        this.knock(0, 300, 120, 0.07, 0.16);
        break;
      case "rackBack":
      case "pressBack":
        this.rub(0, 2200, 0.06, name === "rackBack" ? 0.09 : 0.04, 3200);
        this.click(0.05, 3000, 6, name === "rackBack" ? 0.14 : 0.06, 0.01);
        break;
      case "pressHome":
        this.click(0, 2800, 5, 0.12, 0.014);
        break;
      case "draw":
      case "cloth":
      case "reloadStart":
        this.rub(0, 600, 0.18, 0.035, 300);
        break;
      case "settle":
        this.rub(0, 900, 0.1, 0.02, 500);
        break;
      default:
        break;
    }
  }

  /** The dropped mag hits the street: a hollow polymer clack and a skitter. */
  magLand(strength: number): void {
    const k = Math.min(1, strength);
    this.knock(0, 900, 380, 0.05, 0.12 * k);
    this.click(0.01, 1800, 3, 0.12 * k, 0.03, this.bus.world);
  }

  /** An enemy round passing within 2 m: band-passed noise sweeping 4 kHz to 1.5 kHz over 120 ms, to its side. */
  whiz(pan: number, closeness = 1): void {
    const c = this.ctx;
    const t = c.currentTime;
    const n = c.createBuffer(1, Math.ceil(c.sampleRate * 0.16), c.sampleRate);
    noiseInto(n.getChannelData(0), Math.random);
    const s = c.createBufferSource();
    s.playbackRate.value = this.rate;
    s.buffer = n;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(4000, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * Math.max(0.2, closeness), t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    s.connect(bp).connect(g).connect(p).connect(this.bus.dry);
    s.start(t);
  }
}
