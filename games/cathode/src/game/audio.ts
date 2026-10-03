// CATHODE's sound, all synthesised with WebAudio (no files, nothing to license): gunshots with a street
// reverb and slapback echo off the buildings, wet footsteps, flesh and metal impacts, rain, distant
// sirens and thunder, a heartbeat in bullet-time, and a noir synth score that tightens as the street
// notices Cath. Everything goes through a lowpass the slow-motion closes, so time itself sounds heavy.

type Noise = "white" | "pink" | "brown";

export class Audio {
  readonly ctx: AudioContext;
  private master: GainNode;
  private slowFilter: BiquadFilterNode;
  private sfx: GainNode;
  private verb: ConvolverNode;
  private verbSend: GainNode;
  private noise: Record<Noise, AudioBuffer>;
  private music: GainNode;
  private musicFilter: BiquadFilterNode;
  private padOsc: OscillatorNode[] = [];
  private nextBeat = 0;
  private beat = 0;
  private tension = 0;
  private heartT = 0;
  private sirenT = 8;
  private thunderT = 14;
  private stepDist = 0;
  enabled = true;

  constructor() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.slowFilter = c.createBiquadFilter();
    this.slowFilter.type = "lowpass";
    this.slowFilter.frequency.value = 20000;
    this.master.connect(this.slowFilter).connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.noise = { white: this.makeNoise("white"), pink: this.makeNoise("pink"), brown: this.makeNoise("brown") };
    // The street: a long, dark stereo tail.
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.6, 2.4);
    this.verbSend = c.createGain();
    this.verbSend.gain.value = 0.35;
    this.verbSend.connect(this.verb).connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = 0.22;
    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 500;
    this.musicFilter.Q.value = 6;
    this.music.connect(this.musicFilter).connect(this.master);
    this.ambience();
    this.pads();
  }

  resume(): void {
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  private makeNoise(kind: Noise): AudioBuffer {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** A noise burst through a filter with an envelope. */
  private burst(o: {
    noise?: Noise;
    type?: BiquadFilterType;
    freq: number;
    q?: number;
    sweepTo?: number;
    attack?: number;
    decay: number;
    gain: number;
    verb?: number;
    when?: number;
    pan?: number;
  }): void {
    const c = this.ctx;
    const t = (o.when ?? 0) + c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise[o.noise ?? "white"];
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = o.type ?? "bandpass";
    f.frequency.setValueAtTime(o.freq, t);
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + o.decay);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack ?? 0.002) + o.decay);
    const p = c.createStereoPanner();
    p.pan.value = o.pan ?? 0;
    src.connect(f).connect(g).connect(p).connect(this.sfx);
    if (o.verb) {
      const v = c.createGain();
      v.gain.value = o.verb;
      p.connect(v).connect(this.verbSend);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + (o.attack ?? 0.002) + o.decay + 0.05);
  }

  /** A pitched thump (a sine sweeping down). */
  private thump(from: number, to: number, decay: number, gain: number, when = 0, type: OscillatorType = "sine", verb = 0): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.sfx);
    if (verb) {
      const v = c.createGain();
      v.gain.value = verb;
      g.connect(v).connect(this.verbSend);
    }
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  private clack(when: number, gain = 0.25, freq = 2400): void {
    this.burst({ freq, q: 6, decay: 0.03, gain, when });
    this.burst({ freq: freq * 0.45, q: 4, decay: 0.05, gain: gain * 0.6, when: when + 0.012 });
  }

  // ---- weapons ----
  shot(weapon: "pistol" | "shotgun" | "sniper" | "melee"): void {
    if (!this.enabled) return;
    if (weapon === "pistol") {
      // Suppressed: a hard "pfft", the slide's clack, a whisper of room.
      this.burst({ freq: 1800, q: 0.8, decay: 0.07, gain: 0.5, verb: 0.15 });
      this.thump(220, 80, 0.06, 0.3);
      this.clack(0.03, 0.18, 3200);
    } else if (weapon === "shotgun") {
      this.thump(130, 38, 0.32, 1.0, 0, "sine", 0.6);
      this.burst({ type: "lowpass", freq: 4200, sweepTo: 600, decay: 0.4, gain: 1.1, verb: 1 });
      this.burst({ type: "highpass", freq: 3000, decay: 0.08, gain: 0.5 });
      // The street answers: slapback off the buildings.
      this.burst({ type: "lowpass", freq: 1400, decay: 0.3, gain: 0.25, when: 0.19, verb: 0.6 });
      // The pump: back, forward.
      this.clack(0.42, 0.3, 1500);
      this.clack(0.58, 0.32, 1100);
    } else if (weapon === "sniper") {
      this.burst({ type: "highpass", freq: 2500, decay: 0.05, gain: 0.9 });
      this.thump(90, 30, 0.5, 0.9, 0, "sine", 0.8);
      this.burst({ type: "lowpass", freq: 2200, sweepTo: 300, decay: 0.8, gain: 0.6, verb: 1.2 });
      this.burst({ type: "lowpass", freq: 900, decay: 0.6, gain: 0.25, when: 0.32, verb: 1 });
      this.burst({ type: "lowpass", freq: 700, decay: 0.7, gain: 0.15, when: 0.71, verb: 1 });
      // The bolt.
      this.clack(0.62, 0.22, 1800);
      this.clack(0.84, 0.26, 1300);
    } else {
      this.burst({ freq: 900, sweepTo: 300, q: 1.5, decay: 0.18, gain: 0.35 });
    }
  }

  /** An enemy rifle, quieter and duller with distance, panned to where it is. */
  enemyShot(distance: number, pan: number): void {
    if (!this.enabled) return;
    const g = Math.min(0.9, 6 / Math.max(3, distance));
    this.burst({ type: "lowpass", freq: Math.max(700, 6000 - distance * 120), decay: 0.12, gain: g, verb: 0.8, pan });
    this.thump(160, 60, 0.1, g * 0.6);
  }

  hitFlesh(heavy: boolean): void {
    this.burst({ type: "lowpass", freq: 700, decay: 0.09, gain: heavy ? 0.6 : 0.35, noise: "brown" });
    this.thump(110, 50, 0.08, heavy ? 0.5 : 0.25);
    if (heavy) this.burst({ freq: 2600, q: 3, decay: 0.05, gain: 0.25, when: 0.01 }); // the crunch
  }

  hitMetal(): void {
    this.thump(2400 + Math.random() * 800, 1800, 0.12, 0.12, 0, "triangle");
    this.burst({ type: "highpass", freq: 4000, decay: 0.04, gain: 0.2 });
  }

  sever(): void {
    this.burst({ type: "lowpass", freq: 900, sweepTo: 200, decay: 0.25, gain: 0.7, noise: "brown" });
    this.burst({ freq: 1800, q: 2, decay: 0.12, gain: 0.35, when: 0.02 });
  }

  pin(hit: boolean): void {
    this.burst({ freq: 700, sweepTo: 2200, q: 2, decay: 0.15, gain: 0.25 });
    if (hit) {
      this.thump(120, 45, 0.12, 0.7, 0.1);
      this.burst({ type: "lowpass", freq: 1200, decay: 0.08, gain: 0.4, when: 0.1, noise: "brown" });
    }
  }

  reload(): void {
    this.clack(0, 0.16, 1700);
    this.clack(0.35, 0.2, 1200);
  }

  levelUp(): void {
    // A minor seventh on a soft bell: noir, not arcade.
    const notes = [220, 261.63, 329.63, 392];
    notes.forEach((f, i) => {
      const c = this.ctx;
      const t = c.currentTime + i * 0.09;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f * 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g).connect(this.sfx);
      g.connect(this.verbSend);
      o.start(t);
      o.stop(t + 2.3);
    });
  }

  killcamWhoosh(): void {
    this.burst({ type: "bandpass", freq: 300, sweepTo: 3200, q: 1.2, decay: 1.4, attack: 0.3, gain: 0.35, noise: "pink", verb: 0.5 });
  }

  /** Footsteps on wet concrete, from distance walked. */
  steps(dist: number, speed: number, crouch: number): void {
    this.stepDist += dist;
    const stride = speed > 5 ? 1.5 : 1.15;
    if (this.stepDist < stride) return;
    this.stepDist = 0;
    const g = (0.12 + Math.min(0.2, speed * 0.03)) * (1 - crouch * 0.7);
    this.burst({ type: "lowpass", freq: 900 + Math.random() * 500, decay: 0.07, gain: g, noise: "pink" });
    this.burst({ type: "highpass", freq: 3500, decay: 0.05, gain: g * 0.5, when: 0.01 }); // the splash
  }

  // ---- the bed: rain, the city, the score ----
  private ambience(): void {
    const c = this.ctx;
    const rain = c.createBufferSource();
    rain.buffer = this.noise.pink;
    rain.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.value = 0.16;
    rain.connect(hp).connect(lp).connect(g).connect(this.master);
    rain.start();
    const city = c.createBufferSource();
    city.buffer = this.noise.brown;
    city.loop = true;
    const cl = c.createBiquadFilter();
    cl.type = "lowpass";
    cl.frequency.value = 180;
    const cg = c.createGain();
    cg.gain.value = 0.12;
    city.connect(cl).connect(cg).connect(this.master);
    city.start();
  }

  private pads(): void {
    const c = this.ctx;
    // A dark minor drone: detuned saws on D and A, and a high F that comes and goes.
    for (const [f, det] of [
      [73.42, -6],
      [73.42, 7],
      [110, -4],
      [110, 5],
      [174.61, 0],
    ] as const) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      const g = c.createGain();
      g.gain.value = f > 150 ? 0.05 : 0.1;
      o.connect(g).connect(this.music);
      o.start();
      this.padOsc.push(o);
    }
  }

  private siren(): void {
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(600, t);
    for (let i = 0; i < 6; i++) {
      o.frequency.linearRampToValueAtTime(900, t + i * 1.2 + 0.6);
      o.frequency.linearRampToValueAtTime(600, t + i * 1.2 + 1.2);
    }
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 7.2);
    const p = c.createStereoPanner();
    p.pan.value = Math.random() * 2 - 1;
    o.connect(lp).connect(g).connect(p).connect(this.master);
    g.connect(this.verbSend);
    o.start(t);
    o.stop(t + 7.3);
  }

  thunder(): void {
    this.burst({ type: "lowpass", freq: 260, sweepTo: 60, decay: 4.5, attack: 0.25, gain: 0.55, noise: "brown", verb: 0.8 });
    this.burst({ type: "lowpass", freq: 1200, decay: 0.4, gain: 0.25, noise: "brown" });
  }

  /**
   * Per frame: `tension` 0 calm .. 1 hunted drives the score; `slow` 0..1 closes the world's lowpass and
   * brings in the heartbeat.
   */
  update(dt: number, tension: number, slow: number): void {
    const c = this.ctx;
    const t = c.currentTime;
    this.tension += (tension - this.tension) * Math.min(1, dt * 1.5);
    this.musicFilter.frequency.setTargetAtTime(380 + this.tension * 2600, t, 0.3);
    this.music.gain.setTargetAtTime(0.16 + this.tension * 0.14, t, 0.5);
    this.slowFilter.frequency.setTargetAtTime(slow > 0 ? 700 + (1 - slow) * 6000 : 20000, t, 0.08);
    // The pulse: a bass note on the beat once they're searching, a kick once they're shooting.
    if (this.nextBeat < t) this.nextBeat = t + 0.05;
    while (this.nextBeat < t + 0.1) {
      const when = this.nextBeat - t;
      if (this.tension > 0.35) {
        const notes = [73.42, 73.42, 87.31, 65.41];
        this.thump(notes[(this.beat >> 1) % 4]! * 2, notes[(this.beat >> 1) % 4]! * 1.98, 0.22, 0.12 * this.tension, when, "sawtooth");
      }
      if (this.tension > 0.75 && this.beat % 2 === 0) this.thump(140, 45, 0.18, 0.5, when);
      if (this.tension > 0.75 && this.beat % 4 === 2) this.burst({ type: "highpass", freq: 5000, decay: 0.04, gain: 0.08, when });
      this.beat++;
      this.nextBeat += 60 / 104 / 2;
    }
    if (slow > 0.2) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.85;
        this.thump(60, 40, 0.12, 0.6);
        this.thump(55, 38, 0.12, 0.45, 0.22);
      }
    }
    this.sirenT -= dt;
    if (this.sirenT <= 0) {
      this.sirenT = 25 + Math.random() * 30;
      this.siren();
    }
    this.thunderT -= dt;
    if (this.thunderT <= 0) {
      this.thunderT = 30 + Math.random() * 40;
      this.thunder();
    }
  }
}
