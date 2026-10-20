// C13 (docs/design/cathode-combat.md S9.2, S9.4, S10 "Front door: ui and music"): the front door's sound, all
// synthesised. The ambience bed is rain, a 60 Hz city rumble, the pier sign's 120 Hz hum (with its 2nd and 3rd
// harmonics) and a minor pad of two detuned saws low-passed at 900 Hz that changes chord every 8 s (Am, Fmaj7,
// Dm9, E7sus). The UI sounds are the focus tick (1.2 kHz sine plus noise, 25 ms, -22 dB) and the confirm (two
// sines a fifth apart for 70 ms and a sub thump); the push into the street is a saw swell (200 Hz to 2 kHz).
//
// Browsers start audio only after a gesture: `wake()` runs on the first key, click or tap, and the bed fades in
// from there. Everything is one small graph on its own context, closed when the game takes over.

const db = (d: number) => Math.pow(10, d / 20);
const CHORDS: ReadonlyArray<readonly number[]> = [
  [45, 57, 60, 64], // Am
  [41, 53, 57, 60, 64], // Fmaj7
  [38, 50, 57, 60, 64], // Dm9 (D, A, C, E: the 9th on top)
  [40, 52, 57, 59, 62], // E7sus (E, A, B, D)
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class FrontAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ui: GainNode | null = null;
  private music: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private chordTimer = 0;
  private chord = 0;
  private padVoices: Array<{ osc: OscillatorNode[]; gain: GainNode }> = [];
  private padFilter: BiquadFilterNode | null = null;
  bedOn = false;
  constructor(private volume = 1) {}

  /** True once a gesture has started the context. */
  get awake(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  /** Call from a user gesture: makes (or resumes) the context. */
  wake(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(c.destination);
        this.ui = c.createGain();
        this.ui.connect(this.master);
        this.music = c.createGain();
        this.music.connect(this.master);
        const len = c.sampleRate * 2;
        this.noise = c.createBuffer(1, len, c.sampleRate);
        const d = this.noise.getChannelData(0);
        let s = 0x2f6e2b1;
        for (let i = 0; i < len; i++) {
          s = (s * 1664525 + 1013904223) | 0;
          d[i] = ((s >>> 8) / 16777216) * 2 - 1;
        }
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (this.bedOn && !this.bedGain) this.startBed();
    } catch {
      this.ctx = null;
    }
  }

  private noiseSrc(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    return n;
  }

  /** The ambience bed: on now if the context is awake, else as soon as it wakes. */
  bed(on: boolean): void {
    this.bedOn = on;
    if (on && this.awake && !this.bedGain) this.startBed();
    if (!on) this.stopBed(0.6);
  }

  private startBed(): void {
    const c = this.ctx;
    if (!c || !this.music) return;
    const now = c.currentTime;
    const bed = c.createGain();
    bed.gain.setValueAtTime(0, now);
    bed.gain.linearRampToValueAtTime(1, now + 2.5);
    bed.connect(this.music);
    this.bedGain = bed;
    // Rain: noise through a soft band, at about -20 dB.
    const rain = this.noiseSrc();
    if (rain) {
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 7000;
      const g = c.createGain();
      g.gain.value = db(-20);
      rain.connect(hp).connect(lp).connect(g).connect(bed);
      rain.start();
    }
    // The city's rumble at 60 Hz.
    const rum = this.noiseSrc();
    if (rum) {
      rum.playbackRate.value = 0.5;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 70;
      lp.Q.value = 2;
      const g = c.createGain();
      g.gain.value = db(-14);
      rum.connect(lp).connect(g).connect(bed);
      rum.start();
    }
    // The sign hum: 120 Hz and its 2nd and 3rd harmonics, with a slow wobble.
    const hum = c.createGain();
    hum.gain.value = db(-40);
    hum.connect(bed);
    [120, 240, 360].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = [1, 0.5, 0.28][i]!;
      o.connect(g).connect(hum);
      o.start();
    });
    // The pad.
    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.7;
    const padOut = c.createGain();
    padOut.gain.value = db(-26);
    this.padFilter.connect(padOut).connect(bed);
    this.chord = 0;
    this.playChord();
    this.chordTimer = window.setInterval(() => this.playChord(), 8000);
  }

  private playChord(): void {
    const c = this.ctx;
    if (!c || !this.padFilter) return;
    const now = c.currentTime;
    for (const v of this.padVoices) {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + 2.2);
      for (const o of v.osc) o.stop(now + 2.4);
    }
    const notes = CHORDS[this.chord % CHORDS.length]!;
    this.chord++;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1 / notes.length, now + 2.2);
    gain.connect(this.padFilter);
    const osc: OscillatorNode[] = [];
    for (const n of notes) {
      for (const det of [-7, 6]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(gain);
        o.start(now);
        osc.push(o);
      }
    }
    this.padVoices = [{ osc, gain }];
  }

  private stopBed(s: number): void {
    window.clearInterval(this.chordTimer);
    const c = this.ctx;
    const b = this.bedGain;
    this.bedGain = null;
    if (!c || !b) return;
    const now = c.currentTime;
    b.gain.cancelScheduledValues(now);
    b.gain.setValueAtTime(b.gain.value, now);
    b.gain.linearRampToValueAtTime(0, now + s);
    window.setTimeout(() => b.disconnect(), s * 1000 + 200);
  }

  /** The focus tick: a 1.2 kHz sine and a breath of noise, 25 ms, at -22 dB. */
  tick(): void {
    const c = this.ctx;
    if (!c || !this.ui || !this.awake) return;
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(db(-22), now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    g.connect(this.ui);
    const o = c.createOscillator();
    o.frequency.value = 1200;
    o.connect(g);
    o.start(now);
    o.stop(now + 0.03);
    const n = this.noiseSrc();
    if (n) {
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 4000;
      const ng = c.createGain();
      ng.gain.value = 0.35;
      n.connect(hp).connect(ng).connect(g);
      n.start(now);
      n.stop(now + 0.03);
    }
  }

  /** The confirm: A and E a fifth apart for 70 ms, and a sub thump. */
  confirm(): void {
    const c = this.ctx;
    if (!c || !this.ui || !this.awake) return;
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(db(-18), now + 0.004);
    g.gain.setValueAtTime(db(-18), now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    g.connect(this.ui);
    for (const f of [880, 1320]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      o.connect(g);
      o.start(now);
      o.stop(now + 0.13);
    }
    const sub = c.createOscillator();
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.18);
    const sg = c.createGain();
    sg.gain.setValueAtTime(db(-10), now);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    sub.connect(sg).connect(this.ui);
    sub.start(now);
    sub.stop(now + 0.26);
  }

  /** The push into the street: a saw pad swelling as its low-pass sweeps 200 Hz to 2 kHz over `s` seconds. */
  swell(s = 1.6): void {
    const c = this.ctx;
    if (!c || !this.music || !this.awake) return;
    const now = c.currentTime;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(200, now);
    lp.frequency.exponentialRampToValueAtTime(2000, now + s);
    const g = c.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(db(-14), now + s * 0.8);
    g.gain.linearRampToValueAtTime(0, now + s + 0.5);
    lp.connect(g).connect(this.music);
    for (const n of [33, 45, 52, 57]) {
      for (const det of [-9, 8]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midi(n);
        o.detune.value = det;
        o.connect(lp);
        o.start(now);
        o.stop(now + s + 0.6);
      }
    }
    this.stopBed(s + 0.4);
  }

  /** Everything off, then the context closed (the game makes its own). */
  close(fade = 0.4): void {
    this.stopBed(fade);
    const c = this.ctx;
    this.ctx = null;
    if (c) window.setTimeout(() => void c.close().catch(() => {}), fade * 1000 + 300);
  }
}
