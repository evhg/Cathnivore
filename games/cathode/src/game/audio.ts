// CATHODE's sound, all synthesised with WebAudio (no files, nothing to license): gunshots with a street
// reverb and slapback echo off the buildings, wet footsteps, flesh and metal impacts, rain, distant
// sirens and thunder, a heartbeat in bullet-time, and a noir synth score that tightens as the street
// notices Cath. Everything goes through a lowpass the slow-motion closes, so time itself sounds heavy.

import { Score, type ScoreVariant } from "./score";
import { db, tuning } from "./feel/tuning";
import { GunSound } from "./gunsound";

/** The hit-confirm sounds (S1.3). */
export type ConfirmKind = "body" | "head" | "armour" | "plateBreak" | "visor" | "kill" | "headKill" | "pen" | "soft";

type Noise = "white" | "pink" | "brown";

export class Audio {
  readonly ctx: AudioContext;
  private master: GainNode;
  private slowFilter: BiquadFilterNode;
  private sfx: GainNode;
  /** Hit confirms and Cath's own body: no reverb, never muffled by slow motion, +3 dB over the guns (S0). */
  private dry: GainNode;
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
  private bellT = 6;
  private readonly variant: ScoreVariant;
  private stepDist = 0;
  enabled = true;

  constructor(variant: ScoreVariant = "market") {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.variant = variant;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const A = tuning.audio;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = A.compThreshold;
    comp.ratio.value = A.compRatio;
    comp.knee.value = A.compKnee;
    comp.attack.value = A.compAttack;
    comp.release.value = A.compRelease;
    this.slowFilter = c.createBiquadFilter();
    this.slowFilter.type = "lowpass";
    this.slowFilter.frequency.value = 20000;
    this.master.connect(this.slowFilter).connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    // The world and the score pass through one duck stage, so a kill can push them back 3 dB.
    this.duckBus = c.createGain();
    // C6 (S6.2): a blast nearby muffles the world (never the dry bus: her own body and the confirms stay clear).
    this.muffle = c.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 22000;
    // C7 (S6.3): wounded, the world closes in (22 kHz fine to 1.5 kHz bleeding out), on its own stage so a
    // blast's muffle and the wound's never fight over one parameter.
    this.woundMuffle = c.createBiquadFilter();
    this.woundMuffle.type = "lowpass";
    this.woundMuffle.frequency.value = 22000;
    this.duckBus.connect(this.muffle).connect(this.woundMuffle).connect(this.master);
    this.sfx.connect(this.duckBus);
    // The dry bus joins after the slow-motion lowpass: a confirm is never muffled or reverberant.
    this.dry = c.createGain();
    this.dry.gain.value = db(A.dryGainDb);
    this.dryOut = c.createGain();
    this.dry.connect(this.dryOut).connect(comp);
    this.noise = { white: this.makeNoise("white"), pink: this.makeNoise("pink"), brown: this.makeNoise("brown") };
    // The street: a long, dark stereo tail.
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.6, 2.4);
    this.verbSend = c.createGain();
    this.verbSend.gain.value = 0.35;
    this.verbSend.connect(this.verb).connect(this.duckBus);
    this.music = c.createGain();
    this.music.gain.value = 0.22;
    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 2400;
    this.musicFilter.Q.value = 0.5;
    // The beds (music and ambience) duck 4 dB while she fires (S2.5); the gunshot itself stays on the world bus.
    this.beds = c.createGain();
    this.beds.connect(this.duckBus);
    this.music.connect(this.musicFilter).connect(this.beds);
    this.gun = new GunSound(c, { world: this.sfx, dry: this.dry, beds: this.beds });
    // Pre-render every class's 8 variants in the background, the pistol first.
    setTimeout(() => {
      for (const cls of ["pistol", "smg", "rifle", "shotgun", "revolver", "sniper", "launcher"]) this.gun.prepare(cls);
    }, 0);
    this.ambience();
    if (variant === "plaza") this.crowdBed();
    this.score = new Score(c, this.music, this.verbSend, variant);
  }

  private dryOut: GainNode;
  private muffle: BiquadFilterNode;
  private woundMuffle: BiquadFilterNode;
  /** C7: the breath loop (lazy: built the first time she's hurt). */
  private breathNode: { f: BiquadFilterNode; g: GainNode } | null = null;
  private breathPh = 0;
  /** The wounded heart is beating: the slow-motion heartbeat stands down so there's only ever one heart. */
  private woundHeart = false;
  private lastGrunt = -1;
  private gruntN = 0;
  private duckBus: GainNode;
  private beds: GainNode;
  /** Layered gunshots, the reload's foley, dry fire and whiz-bys (S2.5). */
  readonly gun: GunSound;
  private unlocked = false;
  /** Master volume, 0..1 (the pause menu's slider). */
  set volume(v: number) {
    const g = 0.8 * Math.max(0, Math.min(1, v));
    this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.05);
    this.dryOut.gain.setTargetAtTime(g / 0.8, this.ctx.currentTime, 0.05);
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
  private thump(from: number, to: number, decay: number, gain: number, when = 0, type: OscillatorType = "sine", verb = 0, pan = 0): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      o.connect(g).connect(p).connect(this.sfx);
    } else o.connect(g).connect(this.sfx);
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
  /** A shot. `walls` are the reflection rays' hits (S2.5); the pre-rendered set plays once it's ready. */
  shot(weapon: string, walls: { d: number; pan: number }[] = []): void {
    if (!this.enabled) return;
    if (weapon !== "melee" && this.gun.fire(weapon, walls)) return;
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

  hitFlesh(heavy: boolean, pan = 0, dist = 0): void {
    // On the world bus, placed where the round landed: panned to its side and quieter with distance.
    const near = 1 / (1 + Math.max(0, dist) / 18);
    const pp = Math.max(-1, Math.min(1, pan));
    this.burst({ type: "lowpass", freq: 700, decay: 0.09, gain: (heavy ? 0.6 : 0.35) * near, noise: "brown", pan: pp });
    this.thump(110, 50, 0.08, (heavy ? 0.5 : 0.25) * near, 0, "sine", 0, pp);
    if (heavy) this.burst({ freq: 2600, q: 3, decay: 0.05, gain: 0.25 * near, when: 0.01, pan: pp }); // the crunch
  }

  /** Old name for the confirm (kept for callers that pass the four old kinds). */
  hitTick(kind: "body" | "head" | "kill" | "soft"): void {
    this.confirm(kind === "soft" ? "armour" : kind);
  }

  // ---- the dry bus: hit confirms (S1.3) ----
  /** A pitched voice on the dry bus: an oscillator sweeping from `f0` to `f1`, with a fast attack. */
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, when = 0, decay = dur): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + decay);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  /** Filtered noise on the dry bus. */
  private hiss(type: BiquadFilterType, freq: number, dur: number, peak: number, when = 0, noise: Noise = "white"): void {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise[noise];
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.002 + dur);
    src.connect(f).connect(g).connect(this.dry);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /**
   * The hit confirm (S1.3), on the dry bus so it cuts through gunfire and slow motion: a bright tick and a
   * low "thock" on the body, a ringing ding on the head, a glassy inharmonic ping on armour, a two-stage
   * stamp with a sub drop on a kill. Every play varies pitch ±4% and gain ±1.5 dB, so a burst never machine-guns.
   */
  confirm(kind: ConfirmKind): void {
    if (!this.enabled) return;
    const P = 1 + (Math.random() * 2 - 1) * 0.04;
    const G = db((Math.random() * 2 - 1) * 1.5);
    const D = tuning.confirmDb;
    const body = (peak: number) => {
      this.tone("square", 2600 * P, 2200 * P, 0.045, peak * 0.55);
      this.hiss("highpass", 5000, 0.03, peak * 0.4);
      this.tone("sine", 140 * P, 90 * P, 0.06, peak * 0.9);
    };
    const head = (peak: number, ring = 0.25) => {
      this.tone("square", 3600 * P, 3500 * P, 0.03, peak * 0.45);
      this.tone("sine", 1800 * P, 1800 * P, ring, peak * 0.6, 0, ring);
      this.tone("sine", 2700 * P, 2700 * P, ring, peak * 0.4, 0.004, ring * 0.8);
      this.tone("sine", 160 * P, 100 * P, 0.05, peak * 0.6);
    };
    const armour = (peak: number) => {
      for (const [f, k] of [[1100, 1], [2900, 0.6], [4300, 0.4]] as const) this.tone("sine", f * P, f * P * 0.98, 0.18, peak * 0.5 * k, 0, 0.18);
      this.hiss("bandpass", 3200, 0.01, peak * 0.7);
    };
    switch (kind) {
      case "body":
        body(db(D.body) * G);
        break;
      case "pen":
        body(db(D.pen) * G);
        break;
      case "head":
        head(db(D.head) * G);
        break;
      case "armour":
      case "soft":
        armour(db(D.armour) * G);
        break;
      case "plateBreak": {
        const pk = db(D.plateBreak) * G;
        armour(pk);
        this.hiss("highpass", 3000, 0.08, pk * 0.8);
        for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) this.tone("triangle", (2400 + Math.random() * 2000) * P, 1800, 0.02, pk * 0.3, 0.06 + Math.random() * 0.08, 0.02);
        break;
      }
      case "visor": {
        const pk = db(D.visor) * G;
        for (let i = 0; i < 6; i++) {
          const f = 3000 + Math.random() * 5000;
          this.tone("sine", f, f * 0.97, 0.04 + Math.random() * 0.08, pk * 0.3, Math.random() * 0.15, 0.04 + Math.random() * 0.08);
        }
        this.hiss("highpass", 6000, 0.15, pk * 0.4);
        break;
      }
      case "kill":
      case "headKill": {
        const pk = db(D.kill) * G;
        if (kind === "headKill") head(pk * 0.8);
        else body(pk * 0.8);
        // The stamp, 50 ms later: a falling square, a sub drop and a low whump.
        this.tone("square", 1500 * P, 1100 * P, 0.09, pk * 0.4, 0.05);
        this.tone("sine", 70, 40, 0.18, pk * 1.0, 0.05);
        this.hiss("lowpass", 400, 0.3, pk * 0.8, 0.05, "brown");
        if (kind === "headKill") this.tone("sine", 2200 * P, 2200 * P, 0.4, pk * 0.45, 0.05, 0.4);
        // Music and ambience step back 3 dB for 400 ms, so the kill owns the moment.
        this.duck(tuning.kill.duckDb, tuning.kill.duckMs);
        break;
      }
    }
  }

  /** Ducks the world and the music by `dB` for `ms`, then lets them back (S1.3). */
  duck(dB: number, ms: number): void {
    const t = this.ctx.currentTime;
    const g = this.duckBus.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(db(dB), t, tuning.audio.attackTau / 4);
    g.setTargetAtTime(1, t + ms / 1000, tuning.audio.releaseTau / 4);
  }

  /**
   * Cover swallowed a round (S1.1): a dull, flat crack and, three times in ten, a ricochet whine. On the dry
   * bus at the confirm's level so it reads as feedback, but nothing like a hit.
   */
  blocked(): void {
    if (!this.enabled) return;
    const P = 1 + (Math.random() * 2 - 1) * 0.04;
    this.tone("triangle", 260 * P, 120 * P, 0.07, 0.2);
    this.hiss("bandpass", 1400, 0.05, 0.18, 0, "pink");
    if (Math.random() < tuning.blocked.ricochetChance) {
      const c = this.ctx;
      const t = c.currentTime + 0.02;
      const o = c.createOscillator();
      o.type = "sine";
      const f = 2600 + Math.random() * 1600;
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.35);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      const p = c.createStereoPanner();
      p.pan.value = Math.random() * 1.2 - 0.6;
      o.connect(g).connect(p).connect(this.sfx);
      o.start(t);
      o.stop(t + 0.42);
    }
  }

  /**
   * Cath is hit (S6.2; never the enemies' meat impact, S1.3). On her own dry bus: a body blow (pink noise at
   * 900 Hz and a sub falling 90 to 55 Hz), a clap on a melee hit, a glass tick when Guard took it, and her voice
   * (a formant grunt, three variants, at most one per 700 ms). A Flesh hit ducks the music 4 dB for 300 ms.
   */
  hurt(melee = false, o: { guard?: boolean; flesh?: boolean; k?: number } = { flesh: true }): void {
    if (!this.enabled) return;
    const k = Math.max(0.4, Math.min(1.6, o.k ?? 1));
    const pk = 0.32 + 0.18 * k;
    const flesh = o.flesh !== false;
    // The body blow lands on every hit; through Guard it's a step quieter.
    const bp = flesh ? pk : pk * 0.6;
    this.hiss("bandpass", 900, 0.07, bp * 1.1, 0, "pink");
    this.tone("sine", 90, 55, 0.11, bp * 1.6);
    if (melee) this.hiss("lowpass", 400, 0.04, bp * 1.4, 0.004, "brown");
    if (flesh || melee) this.grunt(melee ? "strain" : k > 1.2 ? "gasp" : "hurt", pk);
    if (flesh) this.duckBeds(-4, 300);
    if (o.guard) {
      this.tone("sine", 2600, 2580, 0.05, 0.16, 0, 0.05);
      this.tone("sine", 3900, 3860, 0.05, 0.11, 0.003, 0.05);
      this.hiss("highpass", 6000, 0.04, 0.12);
    }
  }

  /** Her voice: a glottal saw and breath noise through three formants (F1 650, F2 1100, F3 2800 Hz). */
  private grunt(kind: "hurt" | "strain" | "gasp", peak: number): void {
    const c = this.ctx;
    if (c.currentTime - this.lastGrunt < 0.7) return;
    this.lastGrunt = c.currentTime;
    this.gruntN++;
    const t = c.currentTime + 0.012;
    const P = 1 + (Math.random() * 2 - 1) * 0.06;
    const F = kind === "strain" ? 0.9 : kind === "gasp" ? 1.15 : 1;
    const dur = kind === "strain" ? 0.22 : 0.14;
    const sum = c.createGain();
    for (const [f, q, g] of [[650, 6, 1], [1100, 8, 0.6], [2800, 10, 0.3]] as const) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f * F * P;
      bp.Q.value = q;
      const gg = c.createGain();
      gg.gain.value = g;
      sum.connect(bp);
      bp.connect(gg).connect(this.dry);
    }
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    if (kind === "gasp") {
      // An in-breath: it swells, then cuts.
      env.gain.exponentialRampToValueAtTime(peak * 1.6, t + dur * 0.8);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      env.gain.exponentialRampToValueAtTime(peak * 2.2, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    env.connect(sum);
    if (kind !== "gasp") {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(230 * P, t);
      o.frequency.exponentialRampToValueAtTime(170 * P, t + dur);
      const og = c.createGain();
      og.gain.value = 0.5;
      o.connect(og).connect(env);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const n = c.createBufferSource();
    n.buffer = this.noise.pink;
    const ng = c.createGain();
    ng.gain.value = kind === "gasp" ? 1.4 : 0.6;
    n.connect(ng).connect(env);
    n.start(t, Math.random() * 1.5);
    n.stop(t + dur + 0.05);
  }

  /** The music and ambience step back `dB` for `ms` (a Flesh hit owns the moment). */
  private duckBeds(dB: number, ms: number): void {
    const t = this.ctx.currentTime;
    const g = this.beds.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(db(dB), t, 0.01);
    g.setTargetAtTime(1, t + ms / 1000, 0.12);
  }

  /** Guard breaks (S6.2): a descending FM sweep (1.8 kHz to 300 Hz over 260 ms) and six granular glass ticks. */
  guardBreak(): void {
    if (!this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const car = c.createOscillator();
    car.type = "sine";
    car.frequency.setValueAtTime(1800, t);
    car.frequency.exponentialRampToValueAtTime(300, t + 0.26);
    const mod = c.createOscillator();
    mod.frequency.setValueAtTime(1800 * 1.41, t);
    mod.frequency.exponentialRampToValueAtTime(300 * 1.41, t + 0.26);
    const md = c.createGain();
    md.gain.setValueAtTime(900, t);
    md.gain.exponentialRampToValueAtTime(60, t + 0.26);
    mod.connect(md).connect(car.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    car.connect(g).connect(this.dry);
    car.start(t);
    mod.start(t);
    car.stop(t + 0.35);
    mod.stop(t + 0.35);
    for (let i = 0; i < 6; i++) {
      const f = 2600 + Math.random() * 3400;
      this.tone("triangle", f, f * 0.96, 0.02, 0.07, 0.02 + i * 0.03 + Math.random() * 0.02, 0.03);
    }
    this.hiss("highpass", 4500, 0.09, 0.1);
  }

  /** Guard starts to come back (S6.3): a sharp in-breath and a sine rising 220 to 880 Hz over 1.8 s at -14 dB. */
  regenStart(): void {
    if (!this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = c.createBufferSource();
    n.buffer = this.noise.white;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1600;
    f.Q.value = 1.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    n.connect(f).connect(g).connect(this.dry);
    n.start(t, Math.random());
    n.stop(t + 0.25);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 1.8);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(db(-14) * 0.5, t + 0.3);
    og.gain.setValueAtTime(db(-14) * 0.5, t + 1.6);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.85);
    o.connect(og).connect(this.dry);
    o.start(t);
    o.stop(t + 1.9);
  }

  /** The audio clock (s): the heartbeat is scheduled on it, and the vignette's pulse is mapped back from it. */
  get now(): number {
    return this.ctx.currentTime;
  }

  /**
   * One heartbeat at audio time `at` (S6.3): a lub (55 Hz, 90 ms) and a dub (48 Hz, 70 ms, 110 ms later), each with
   * a 4 ms attack, on the dry bus so slow motion and the world's muffle never touch it. A quiet octave and a
   * lowpassed thud give it a body on laptop and phone speakers, which can't play 55 Hz.
   */
  heartbeat(at: number, gain: number): void {
    if (!this.enabled) return;
    const c = this.ctx;
    // One buffer source and one gain a beat (the lub-dub is rendered once): 2 nodes, not 12, so a 120 bpm heart
    // never crowds the voice cap.
    this.heartBuf ??= renderHeartbeat(c.sampleRate);
    const t = Math.max(at, c.currentTime);
    const src = c.createBufferSource();
    src.buffer = this.heartBuf;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.dry);
    src.start(t);
    src.onended = () => g.disconnect();
  }
  private heartBuf: AudioBuffer | null = null;

  /**
   * The wounded loop, once a frame (S6.3): the world's muffle for `w`, and the breath (noise band-passed at 500 Hz
   * on the exhale and 1.4 kHz on the inhale, `hz` breaths a second at `0.25 * level`, ducked while she fires).
   * `heart` says the wounded heart is beating (the slow-motion heartbeat stands down).
   */
  wounded(dt: number, o: { muffleHz: number; breathHz: number; breathLevel: number; firing: boolean; heart: boolean }): void {
    if (!this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    this.woundHeart = o.heart;
    this.woundMuffle.frequency.setTargetAtTime(Math.max(300, o.muffleHz), t, 0.25);
    if (o.breathLevel <= 0.001 && !this.breathNode) return;
    if (!this.breathNode) {
      const n = c.createBufferSource();
      n.buffer = this.noise.pink;
      n.loop = true;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 500;
      f.Q.value = 1.4;
      const g = c.createGain();
      g.gain.value = 0;
      n.connect(f).connect(g).connect(this.dry);
      n.start();
      this.breathNode = { f, g };
    }
    this.breathPh += dt * o.breathHz;
    const s = Math.sin(this.breathPh * Math.PI * 2);
    // In (s > 0) is brighter and shorter-sounding; out is lower and longer. Both swell and fall with the breath.
    const env = Math.pow(Math.abs(s), 1.6);
    const duck = o.firing ? 0.3 : 1;
    this.breathNode.f.frequency.setTargetAtTime(s > 0 ? 1400 : 500, t, 0.05);
    this.breathNode.g.gain.setTargetAtTime(0.25 * o.breathLevel * env * duck * (s > 0 ? 0.8 : 1), t, 0.04);
  }

  /** A stim (S6.3): a cold hiss in through the teeth and a bright lift. */
  stim(): void {
    if (!this.enabled) return;
    this.hiss("bandpass", 2400, 0.35, 0.08);
    this.tone("sine", 520, 1040, 0.5, 0.05, 0.05, 0.5);
  }

  /** Guard is whole again (S6.3): 660 Hz then 990 Hz, 90 ms each. */
  guardFull(): void {
    if (!this.enabled) return;
    this.tone("sine", 660, 660, 0.09, 0.09, 0, 0.09);
    this.tone("sine", 990, 990, 0.09, 0.09, 0.09, 0.12);
  }

  /**
   * A blast `d` metres away, within 6 m (S6.2): tinnitus (4.8 kHz at -20 dBFS, decaying over 2 + 3(1 - d/6) s)
   * and the world muffled to 500 Hz, recovering with tau 0.9 s.
   */
  blastNear(d: number): void {
    if (!this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime;
    const decay = 2 + 3 * (1 - Math.max(0, Math.min(6, d)) / 6);
    const o = c.createOscillator();
    o.frequency.value = 4800;
    const g = c.createGain();
    g.gain.setValueAtTime(db(-20), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.dryOut);
    o.start(t);
    o.stop(t + decay + 0.05);
    const m = this.muffle.frequency;
    m.cancelScheduledValues(t);
    m.setValueAtTime(500, t);
    m.setTargetAtTime(22000, t + 0.05, 0.9);
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

  /** A shell rings on the street (S2.3): a brass tink panned to where it landed, quieter with distance. */
  casing(pan = 0, dist = 1): void {
    const k = 1 / (1 + Math.max(0, dist - 1) / 4);
    this.thump(3200 + Math.random() * 900, 2600, 0.06, 0.05 * k, 0, "triangle", 0, pan);
    this.thump(2800 + Math.random() * 600, 2200, 0.05, 0.035 * k, 0.09, "triangle", 0, pan);
  }

  reload(): void {
    this.clack(0, 0.16, 1700);
    this.clack(0.35, 0.2, 1200);
  }

  levelUp(): void {
    // Beat 1 is a low hit under the rule's slam; beat 2 a glassy shard sweep; then the bell below.
    this.thump(90, 40, 0.5, 0.4, 0, "sine");
    this.burst({ type: "highpass", freq: 3000, sweepTo: 7000, q: 0.8, decay: 0.5, attack: 0.02, gain: 0.12, noise: "white", verb: 0.4 });
    // A minor seventh on a soft bell: noir, not arcade.
    const notes = [220, 261.63, 329.63, 392];
    notes.forEach((f, i) => {
      const c = this.ctx;
      const t = c.currentTime + 0.45 + i * 0.09;
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

  /** A new weapon (S7.1): the case snaps shut, then a 1.2 s minor-seventh sting on a low string pad and a bell. */
  newWeapon(): void {
    this.clack(0, 0.3, 1800);
    this.clack(0.05, 0.22, 3200);
    this.thump(70, 45, 0.6, 0.35, 0.12, "sine", 0.3);
    const c = this.ctx;
    // C minor seventh, spread: the root and fifth on a filtered saw, the third and seventh on a bell above.
    [[130.81, "sawtooth", 0.05], [196, "sawtooth", 0.04], [311.13, "sine", 0.12], [466.16, "sine", 0.1]].forEach(([f, type, peak], i) => {
      const t = c.currentTime + 0.14 + i * 0.07;
      const o = c.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = f as number;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak as number, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(lp).connect(g).connect(this.sfx);
      g.connect(this.verbSend);
      o.start(t);
      o.stop(t + 1.25);
    });
  }

  /** A soft UI tick when a world prompt comes up. */
  promptUp(): void {
    this.tone("sine", 1400, 1700, 0.05, 0.05);
  }

  killcamWhoosh(): void {
    this.burst({ type: "bandpass", freq: 300, sweepTo: 3200, q: 1.2, decay: 1.4, attack: 0.3, gain: 0.35, noise: "pink", verb: 0.5 });
  }

  /** Footsteps on wet concrete, from distance walked. */
  steps(dist: number, speed: number, crouch: number, wet = false): void {
    this.stepDist += dist;
    const stride = speed > 5 ? 1.5 : 1.15;
    if (this.stepDist < stride) return;
    this.stepDist = 0;
    const g = (0.12 + Math.min(0.2, speed * 0.03)) * (1 - crouch * 0.7);
    this.burst({ type: "lowpass", freq: 900 + Math.random() * 500, decay: 0.07, gain: g, noise: "pink" });
    this.burst({ type: "highpass", freq: 3500, decay: 0.05, gain: g * 0.5, when: 0.01 }); // the splash
    // Ankle-deep water: a longer, lower slosh and a bright spray on top.
    if (wet) {
      this.burst({ type: "bandpass", freq: 500 + Math.random() * 300, q: 0.8, decay: 0.28, gain: g * 1.3, noise: "pink", when: 0.02, verb: 0.3 });
      this.burst({ type: "highpass", freq: 5200, decay: 0.16, gain: g * 0.7, when: 0.05 });
    }
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
    rain.connect(hp).connect(lp).connect(g).connect(this.beds);
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
    sheet.connect(sbp).connect(sg).connect(this.beds);
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
    city.connect(cl).connect(cg).connect(this.beds);
    city.start();
  }

  /** Hollowell Plaza: a rally's worth of murmur, swelling and fading, under the rain. */
  private crowdBed(): void {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise.pink;
    src.loop = true;
    src.playbackRate.value = 0.7;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 420;
    bp.Q.value = 0.9;
    const g = c.createGain();
    g.gain.value = 0.03;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = c.createGain();
    lg.gain.value = 0.018;
    lfo.connect(lg).connect(g.gain);
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    lfo.start();
  }

  /** A tram bell somewhere down the line: two bright strikes, panned, with the street's tail. */
  private tramBell(): void {
    const c = this.ctx;
    const t = c.currentTime;
    const p = c.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    p.connect(this.master);
    for (let i = 0; i < 2; i++) {
      for (const f of [1180, 1770]) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = c.createGain();
        const at = t + i * 0.32;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(f < 1500 ? 0.025 : 0.012, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
        o.connect(g).connect(p);
        g.connect(this.verbSend);
        o.start(at);
        o.stop(at + 1.2);
      }
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
    this.musicFilter.frequency.setTargetAtTime(1600 + this.tension * 5000, t, 0.3);
    this.music.gain.setTargetAtTime(0.5 + this.tension * 0.2, t, 0.5);
    this.slowFilter.frequency.setTargetAtTime(slow > 0 ? 700 + (1 - slow) * 6000 : 20000, t, 0.08);
    this.score.update(this.tension);
    if (slow > 0.2 && !this.woundHeart) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.85;
        this.thump(60, 40, 0.12, 0.6);
        this.thump(55, 38, 0.12, 0.45, 0.22);
      }
    }
    if (this.variant === "plaza") {
      this.bellT -= dt;
      if (this.bellT <= 0) {
        this.bellT = 18 + Math.random() * 20;
        this.tramBell();
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

/**
 * The heartbeat's lub-dub, rendered once into a buffer (S6.3): a lub (55 Hz, 90 ms) and a dub (48 Hz, 70 ms, 110 ms
 * later), each a pitch-dropping sine (from 1.25x over 30 ms) with its octave, and a thump of brown noise under
 * 160 Hz, all with a 4 ms attack and an exponential fall.
 */
function renderHeartbeat(rate: number): AudioBuffer {
  const len = Math.ceil(rate * 0.21);
  const buf = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: rate });
  const d = buf.getChannelData(0);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  // Exponential ramps the way WebAudio draws them: 0.0001 to peak in `att`, then back to 0.0001 by `dur`.
  const env = (t: number, peak: number, att: number, dur: number) => {
    if (t < 0 || t > dur) return 0;
    if (t < att) return 0.0001 * Math.pow(peak / 0.0001, t / att);
    return peak * Math.pow(0.0001 / peak, (t - att) / (dur - att));
  };
  const beat = (start: number, f: number, dur: number, peak: number) => {
    let ph = 0;
    let ph2 = 0;
    let brown = 0;
    let lp = 0;
    const a = 1 - Math.exp((-2 * Math.PI * 160) / rate);
    const n0 = Math.floor(start * rate);
    for (let i = 0; i < Math.ceil((dur + 0.02) * rate) && n0 + i < len; i++) {
      const t = i / rate;
      const fi = t < 0.03 ? f * 1.25 * Math.pow(1 / 1.25, t / 0.03) : f;
      ph += (2 * Math.PI * fi) / rate;
      ph2 += (2 * Math.PI * f * 2) / rate;
      brown = Math.max(-1, Math.min(1, brown + rnd() * 0.04)) * 0.998;
      lp += a * (brown * 3 - lp);
      d[n0 + i]! += Math.sin(ph) * env(t, peak, 0.004, dur) + Math.sin(ph2) * env(t, peak * 0.28, 0.004, dur * 0.7) + lp * env(t, peak * 0.5, 0.006, dur * 0.8);
    }
  };
  beat(0, 55, 0.09, 0.55);
  beat(0.11, 48, 0.07, 0.4);
  return buf;
}
