// The score: a slow noir loop in D minor, synthesised and sequenced live (owner's playtest, 2026-10-04: "the
// background music is just noise"). Eight bars, two per chord, Dm9 · B♭maj9 · Gm9 · A7♭9, at 76 bpm:
// a warm pad, an electric piano picking out the chord with a lazy swing, a bass, and a lonely lead line every
// other pass. Tension (0 calm .. 1 hunted) adds brushes, then a kick and a busier bass, and opens the filter.

const BPM = 76;
const STEP = 60 / BPM / 4; // a sixteenth
const LOOP = 128; // 8 bars of 16ths
const SWING = STEP * 0.3;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Chord {
  root: number;
  pad: number[];
  /** Notes the piano picks from, low to high. */
  arp: number[];
}

const CHORDS: Chord[] = [
  { root: 38, pad: [50, 53, 57, 60, 64], arp: [62, 65, 69, 72, 76] }, // Dm9
  { root: 34, pad: [46, 50, 53, 57, 60], arp: [62, 65, 69, 70, 74] }, // B♭maj9
  { root: 31, pad: [46, 50, 53, 57], arp: [62, 65, 67, 70, 74] }, // Gm9
  { root: 33, pad: [49, 55, 58, 64], arp: [61, 64, 67, 70, 73] }, // A7♭9
];

/** The lead: [step in the loop, note, length in steps]. */
const MELODY: [number, number, number][] = [
  [4, 69, 6],
  [10, 72, 2],
  [12, 74, 16],
  [36, 72, 4],
  [40, 70, 4],
  [44, 69, 18],
  [68, 70, 6],
  [74, 69, 2],
  [76, 67, 16],
  [98, 64, 4],
  [102, 65, 4],
  [106, 67, 4],
  [110, 61, 18],
];

/** Where the piano plays in a bar, and how likely each note is when calm. */
const ARP_STEPS: [number, number][] = [
  [0, 0.9],
  [3, 0.55],
  [6, 0.75],
  [10, 0.6],
  [12, 0.45],
  [14, 0.35],
];

export class Score {
  private next = 0;
  private n = 0;
  private pass = 0;
  private tension = 0;
  private readonly delay: DelayNode;
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly verb: AudioNode,
  ) {
    // A dotted-eighth echo for the piano and the lead, into the street's reverb.
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2200;
    this.delay.connect(tone).connect(fb).connect(this.delay);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    tone.connect(wet).connect(out);
    const len = Math.floor(ctx.sampleRate * 0.5);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Schedules the next quarter-second of music. Call every frame. */
  update(tension: number): void {
    this.tension = tension;
    const now = this.ctx.currentTime;
    if (this.next < now) this.next = now + 0.1; // first call, or after a stall: never cram the backlog in
    while (this.next < now + 0.25) {
      this.step(this.n, this.next);
      this.n++;
      if (this.n % LOOP === 0) this.pass++;
      this.next += STEP;
    }
  }

  private step(n: number, t: number): void {
    const s = n % LOOP;
    const bar = s % 16;
    const chord = CHORDS[Math.floor(s / 32)]!;
    const T = this.tension;
    const swung = bar % 4 === 2 ? t + SWING : t;

    if (s % 32 === 0) for (const p of chord.pad) this.pad(midi(p), t, STEP * 32);

    // Bass: the root on one, a pickup to the fifth; walking eighths once the street is hunting her.
    const busy = T > 0.55;
    if (bar === 0) this.bass(midi(chord.root), t, STEP * (busy ? 2 : 7), 1);
    else if (bar === 10) this.bass(midi(chord.root + 7), swung, STEP * 3, 0.7);
    else if (bar === 14 && s % 32 === 30) this.bass(midi(chord.root + (s < 96 ? -2 : 1)), swung, STEP * 2, 0.6);
    else if (busy && bar % 2 === 0) this.bass(midi(chord.root + [0, 12, 7, 10][(bar >> 1) % 4]!), swung, STEP * 1.5, 0.55);

    // Piano.
    for (const [at, chance] of ARP_STEPS) {
      if (at !== bar) continue;
      if (Math.random() > chance + T * 0.2) break;
      const note = chord.arp[Math.floor(Math.random() * chord.arp.length)]!;
      this.piano(midi(note), at % 4 === 2 ? swung : t, 0.5 + Math.random() * 0.35);
    }

    // The lead, every other pass, and not in a fight.
    if (this.pass % 2 === 1 && T < 0.7) for (const [at, note, len] of MELODY) if (at === s) this.lead(midi(note), t, STEP * len);

    // Brushes, then a kick.
    if (T > 0.25 && bar % 2 === 0) this.brush(swung, (bar % 4 === 0 ? 0.5 : 1) * Math.min(1, (T - 0.25) * 2.5));
    if (T > 0.6 && (bar === 0 || bar === 7 || bar === 10)) this.kick(t, Math.min(1, (T - 0.6) * 3));
    if (T > 0.6 && (bar === 4 || bar === 12)) this.snare(swung, Math.min(1, (T - 0.6) * 3));
  }

  private env(t: number, attack: number, peak: number, hold: number, release: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, hold) + release);
    return g;
  }

  private pad(f: number, t: number, len: number): void {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 0.5;
    const g = this.env(t, 1.8, 0.035, len - 0.6, 2.2);
    lp.connect(g);
    g.connect(this.out);
    g.connect(this.verb);
    for (const det of [-7, 6]) {
      const o = c.createOscillator();
      o.type = det < 0 ? "triangle" : "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      const v = c.createGain();
      v.gain.value = det < 0 ? 1 : 0.35;
      o.connect(v).connect(lp);
      o.start(t);
      o.stop(t + len + 2.4);
    }
  }

  private bass(f: number, t: number, len: number, vel: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const sub = c.createOscillator();
    sub.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const g = this.env(t, 0.012, 0.22 * vel, 0.05, len);
    o.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(this.out);
    for (const x of [o, sub]) {
      x.start(t);
      x.stop(t + len + 0.2);
    }
  }

  /** A Rhodes-ish electric piano: a sine carrier with a decaying FM bark. */
  private piano(f: number, t: number, vel: number): void {
    const c = this.ctx;
    const car = c.createOscillator();
    car.frequency.value = f;
    const mod = c.createOscillator();
    mod.frequency.value = f;
    const idx = c.createGain();
    idx.gain.setValueAtTime(f * 1.6, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.5);
    mod.connect(idx).connect(car.frequency);
    const g = this.env(t, 0.006, 0.09 * vel, 0.01, 2.2);
    const pan = c.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.6;
    car.connect(g).connect(pan);
    pan.connect(this.out);
    pan.connect(this.verb);
    const send = c.createGain();
    send.gain.value = 0.35;
    pan.connect(send).connect(this.delay);
    for (const x of [car, mod]) {
      x.start(t);
      x.stop(t + 2.4);
    }
  }

  /** A soft, breathy lead with a late vibrato, like a muted horn down the street. */
  private lead(f: number, t: number, len: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const o2 = c.createOscillator();
    o2.frequency.value = f * 2;
    const o2g = c.createGain();
    o2g.gain.value = 0.18;
    const vib = c.createOscillator();
    vib.frequency.value = 4.8;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(len, 0.6));
    vib.connect(vg);
    vg.connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(1900, t + 0.15);
    const g = this.env(t, 0.09, 0.075, len * 0.85, 0.7);
    o.connect(lp);
    o2.connect(o2g).connect(lp);
    lp.connect(g);
    g.connect(this.out);
    g.connect(this.verb);
    const send = c.createGain();
    send.gain.value = 0.5;
    g.connect(send).connect(this.delay);
    for (const x of [o, o2, vib]) {
      x.start(t);
      x.stop(t + len + 0.9);
    }
  }

  private hit(t: number, type: BiquadFilterType, freq: number, decay: number, gain: number): void {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = this.env(t, 0.004, gain, 0.005, decay);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  private brush(t: number, vel: number): void {
    this.hit(t, "bandpass", 6000, 0.12, 0.05 * vel);
  }

  private snare(t: number, vel: number): void {
    this.hit(t, "bandpass", 1800, 0.18, 0.09 * vel);
  }

  private kick(t: number, vel: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this.env(t, 0.003, 0.35 * vel, 0.01, 0.28);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.35);
  }
}
