// CATHODE's sound, all synthesised with WebAudio (no files, nothing to license): gunshots with a street
// reverb and slapback echo off the buildings, wet footsteps, flesh and metal impacts, rain, distant
// sirens and thunder, a heartbeat in bullet-time, and a noir synth score that tightens as the street
// notices Cath. Everything goes through a lowpass the slow-motion closes, so time itself sounds heavy.

import { Score } from "./score";

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
  private score: Score;
  private tension = 0;
  private heartT = 0;
  private sirenT = 8;
  /** The world's lightning drives thunder when it has any; otherwise thunder comes on its own. */
  externalThunder = false;
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
    this.musicFilter.frequency.value = 2400;
    this.musicFilter.Q.value = 0.5;
    this.music.connect(this.musicFilter).connect(this.master);
    this.ambience();
    this.score = new Score(c, this.music, this.verbSend);
  }

  private unlocked = false;
  /** Master volume, 0..1 (the pause menu's slider). */
  set volume(v: number) {
    this.master.gain.setTargetAtTime(0.8 * Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
  }

  /**
   * Call from inside a tap or key press. iOS only starts WebAudio in a user gesture, and mutes it under the
   * ringer's silent switch unless the page's audio session is "playback": set that where Safari has it
   * (17+), and otherwise play a silent <audio> once, which moves the session to playback (owner, iPhone,
   * 2026-10-04: "still no sound").
   */
  resume(): void {
    if (this.ctx.state !== "running") void this.ctx.resume();
    if (this.unlocked) return;
    this.unlocked = true;
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      // Not settable here: the <audio> below does the same job.
    }
    try {
      const el = new window.Audio(`${import.meta.env.BASE_URL}silence.wav`);
      el.setAttribute("playsinline", "");
      el.loop = true;
      el.volume = 0.01;
      void el.play().catch(() => (this.unlocked = false));
      this.keepAlive = el;
    } catch {
      // No media element: WebAudio alone.
    }
    // A one-sample buffer played inside the gesture is what finally wakes older iOS.
    const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.connect(this.ctx.destination);
    src.start();
  }
  private keepAlive: HTMLAudioElement | null = null;

  /** The tab was hidden or shown: stop the silent loop too, so iOS doesn't keep a media session open. */
  suspend(hidden: boolean): void {
    if (hidden) {
      void this.ctx.suspend();
      this.keepAlive?.pause();
    } else {
      void this.ctx.resume();
      void this.keepAlive?.play().catch(() => undefined);
    }
  }

  private makeNoise(kind: Noise): AudioBuffer {
    const len = this.ctx.sampleRate * 5; // long enough that the rain doesn't audibly loop
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
  shot(weapon: string): void {
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
    } else if (weapon === "revolver") {
      this.thump(110, 40, 0.22, 0.9, 0, "sine", 0.5);
      this.burst({ type: "lowpass", freq: 3800, sweepTo: 500, decay: 0.3, gain: 0.9, verb: 0.9 });
      this.clack(0.3, 0.16, 2200);
    } else if (weapon === "launcher") {
      this.thump(70, 28, 0.45, 1.0, 0, "sine", 0.7);
      this.burst({ type: "lowpass", freq: 1800, sweepTo: 250, decay: 0.7, gain: 0.8, verb: 1.2 });
      this.clack(0.5, 0.2, 900);
    } else if (weapon === "smg" || weapon === "smart" || weapon === "rifle") {
      const big = weapon === "rifle";
      this.thump(big ? 140 : 190, 70, 0.07, big ? 0.7 : 0.45);
      this.burst({ type: "highpass", freq: 2600, decay: 0.045, gain: big ? 0.7 : 0.5 });
      this.burst({ type: "lowpass", freq: big ? 2600 : 3200, sweepTo: 500, decay: big ? 0.22 : 0.12, gain: big ? 0.6 : 0.4, verb: 0.5 });
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

  pin(hit: boolean, model = "pin"): void {
    if (!this.enabled) return;
    if (model === "blade") {
      // A steel "shing" and, on contact, a bright ring.
      this.burst({ type: "highpass", freq: 3000, sweepTo: 7000, decay: 0.2, gain: 0.35 });
      if (hit) {
        this.burst({ freq: 4200, q: 12, decay: 0.35, gain: 0.3, when: 0.08, verb: 0.5 });
        this.thump(150, 60, 0.08, 0.5, 0.08);
      }
      return;
    }
    if (model === "sledge") {
      this.burst({ type: "lowpass", freq: 500, sweepTo: 150, decay: 0.3, gain: 0.45, noise: "brown" });
      if (hit) {
        this.thump(85, 30, 0.4, 1.0, 0.18, "sine", 0.6);
        this.burst({ type: "lowpass", freq: 1800, sweepTo: 300, decay: 0.35, gain: 0.5, when: 0.18, verb: 0.8 });
      }
      return;
    }
    if (model === "wire") {
      this.burst({ freq: 2600, sweepTo: 5200, q: 8, decay: 0.12, gain: 0.2 });
      if (hit) this.burst({ type: "highpass", freq: 3500, decay: 0.12, gain: 0.3, when: 0.06 });
      return;
    }
    this.burst({ freq: 700, sweepTo: 2200, q: 2, decay: 0.15, gain: 0.25 });
    if (hit) {
      this.thump(120, 45, 0.12, 0.7, 0.1);
      this.burst({ type: "lowpass", freq: 1200, decay: 0.08, gain: 0.4, when: 0.1, noise: "brown" });
    }
  }

  casing(): void {
    this.thump(3200 + Math.random() * 900, 2600, 0.06, 0.05, 0, "triangle");
    this.thump(2800 + Math.random() * 600, 2200, 0.05, 0.035, 0.09, "triangle");
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
    hp.frequency.value = 1400;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    const g = c.createGain();
    g.gain.value = 0.055;
    rain.connect(hp).connect(lp).connect(g).connect(this.master);
    rain.start();
    // Gusts: a slow swell on a second, lower sheet of rain, and a tin-roof patter that drifts in and out.
    const sheet = c.createBufferSource();
    sheet.buffer = this.noise.pink;
    sheet.loop = true;
    sheet.playbackRate.value = 0.8;
    const sbp = c.createBiquadFilter();
    sbp.type = "bandpass";
    sbp.frequency.value = 700;
    sbp.Q.value = 0.6;
    const sg = c.createGain();
    sg.gain.value = 0.03;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(sg.gain);
    sheet.connect(sbp).connect(sg).connect(this.master);
    sheet.start();
    lfo.start();
    const city = c.createBufferSource();
    city.buffer = this.noise.brown;
    city.loop = true;
    const cl = c.createBiquadFilter();
    cl.type = "lowpass";
    cl.frequency.value = 140;
    const cg = c.createGain();
    cg.gain.value = 0.05;
    city.connect(cl).connect(cg).connect(this.master);
    city.start();
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
    this.musicFilter.frequency.setTargetAtTime(1600 + this.tension * 5000, t, 0.3);
    this.music.gain.setTargetAtTime(0.5 + this.tension * 0.2, t, 0.5);
    this.slowFilter.frequency.setTargetAtTime(slow > 0 ? 700 + (1 - slow) * 6000 : 20000, t, 0.08);
    this.score.update(this.tension);
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
    if (!this.externalThunder && this.thunderT <= 0) {
      this.thunderT = 30 + Math.random() * 40;
      this.thunder();
    }
  }
}
