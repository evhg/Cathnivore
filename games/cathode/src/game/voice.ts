// Cath's voiceover in the slice: short, plain lines on the moments that matter, each said once a job.
// Writing rules (docs/design/cathode.md 2): concrete, dry, one zinger at most; never cryptic.

export type Cue =
  | "start"
  | "seen"
  | "spotted"
  | "unseenKill"
  | "headshot"
  | "laser"
  | "bodyFound"
  | "shield"
  | "lowHealth"
  | "levelUp"
  | "startClinic"
  | "startPlaza"
  | "startTower"
  | "startVault"
  | "clear"
  | "done"
  | "beaCall1"
  | "beaCall2"
  | "beaCall3";

const LINES: Record<Cue, string> = {
  start: "The Drowned Market. Tomas sold eggs here for thirty years. Somebody on this street saw him go in the water.",
  startClinic: "The Candor Clinic. Clean floors, clean books, and a doctor who wrote half the debts in Marrow. Vane’s theatre is at the far end.",
  startPlaza: "Hollowell Plaza. Pell wants a crowd tonight, and a crowd is cover. Permits first, then the steps.",
  startTower: "The Board Tower. Forty floors of glass, and not one of them let in the rain. The Chair is two flights up.",
  startVault: "The Hollow Vault. Every debt in Marrow lives down here, and something is keeping count. Index first, then the core.",
  seen: "Hollowell Enforcers. Company men, company guns.",
  spotted: "So much for quiet.",
  unseenKill: "One less witness.",
  headshot: "He never heard it.",
  laser: "Red dot on my coat. Move.",
  bodyFound: "They’ve found him. Now they’ll come looking for me.",
  shield: "Riot shield. Go round it, not through it.",
  lowHealth: "Not here. Not tonight.",
  levelUp: "Older. Better at this.",
  clear: "Quiet again. The fish market’s back door is down by the water.",
  done: "A water taxi, and a name left on the seat: Julian Crisp.",
  beaCall1: "Bea: Mum? Are you still at work? Nana made me do my spellings twice.",
  beaCall2: "Cath: Spellings are important, darling. I’ll be home before the rain stops.",
  beaCall3: "Bea: It never stops raining. I drew you an umbrella. Don’t be late.",
};

export class Voice {
  private said = new Set<Cue>();
  private queue: Cue[] = [];
  private busy = 0;

  constructor(private readonly show: (text: string) => void) {}

  say(cue: Cue): void {
    if (this.said.has(cue)) return;
    this.said.add(cue);
    this.queue.push(cue);
  }

  update(dt: number): void {
    this.busy = Math.max(0, this.busy - dt);
    if (this.busy > 0 || !this.queue.length) return;
    const cue = this.queue.shift()!;
    const text = LINES[cue];
    this.show(text);
    this.busy = 1.2 + text.length * 0.045;
  }
}

/** What killed her, for the death card's line (S6.6). */
export type DeathCause = "bullet" | "sniper" | "melee" | "blast" | "laser" | "any";

/**
 * The death card's headline (S6.6): 24 of Cath's lines, picked by cause. Dry, plain, a mum's voice: never "Game
 * Over", never gloating, never cryptic (docs/design/cathode.md 2).
 */
export const DEATH_LINES: Readonly<Record<DeathCause, readonly string[]>> = {
  bullet: ["Not tonight, love.", "Up. They don’t get to keep me.", "Shot in the street like a dog. Get up.", "Count the rounds next time, Cath."],
  sniper: ["Mind the windows. Mind everything.", "Somebody up high. Stay low next time.", "Never saw him. Next time I will.", "One shot, from a long way off. Again."],
  melee: ["Too close. Never that close again.", "He got his hands on me. Once.", "Should have kept my distance. Up.", "Bruises heal. Get up."],
  blast: ["Mind the glass. Mind everything.", "Ears ringing. Up anyway.", "That one was loud. Next time, run.", "Smoke clears. So do I."],
  laser: ["Red light means stop, Cath.", "Wired for it, and I walked in.", "Clever little beam. Clever little me, next time.", "Burnt coat. Burnt pride. Up."],
  any: ["School run’s at eight. Get up.", "Bea’s waiting up. Get up.", "Marrow doesn’t get me that cheap.", "Not the night to quit, love."],
};

/** One death line for `cause`, picked by `seed` (0..1), never the same as `last`. */
export function deathLine(cause: DeathCause, seed: number, last?: string): string {
  const pool = [...DEATH_LINES[cause], ...DEATH_LINES.any];
  let i = Math.floor(Math.max(0, Math.min(0.9999, seed)) * pool.length);
  if (pool[i] === last) i = (i + 1) % pool.length;
  return pool[i]!;
}

/** The squad radio's chain at a man (`pan`, quieter with distance): band-pass 400 to 3,200 Hz and a 12% crush. */
function radioChain(ctx: BaseAudioContext, dest: AudioNode, distance: number, pan: number, gain = 0.55) {
  const near = Math.min(1, 7 / Math.max(4, distance));
  const out = ctx.createGain();
  out.gain.value = gain * near;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 400;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  const crush = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    // 12% crush: a soft clip blended with a quantised copy.
    curve[i] = 0.88 * Math.tanh(x * 2.2) + 0.12 * Math.round(x * 6) / 6;
  }
  crush.curve = curve;
  hp.connect(lp).connect(crush).connect(out).connect(p).connect(dest);
  const noise = (when: number, dur: number, g: number, f: number) => {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = 0.9;
    const gg = ctx.createGain();
    gg.gain.value = g;
    s.connect(bp).connect(gg).connect(hp);
    s.start(when);
  };
  return { input: hp as AudioNode, noise };
}

/**
 * S10 "Pain": a 120 ms two-vowel grunt keyed through his radio (an open mic as the round lands): a short squelch
 * click, then a pushed "uh" sliding into a choked "ah" on a falling buzz. Returns its length (s).
 */
export function painGrunt(ctx: BaseAudioContext, dest: AudioNode, distance: number, pan: number, seed = Math.random()): number {
  const t0 = ctx.currentTime + 0.005;
  const { input, noise } = radioChain(ctx, dest, distance, pan, 0.6);
  noise(t0, 0.018, 0.35, 2600);
  const f0 = (104 + seed * 30) * (0.94 + ((seed * 7.31) % 1) * 0.12);
  const src = ctx.createOscillator();
  src.type = "sawtooth";
  src.frequency.setValueAtTime(f0 * 1.12, t0);
  src.frequency.exponentialRampToValueAtTime(f0 * 0.82, t0 + 0.12);
  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.Q.value = 5;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.Q.value = 7;
  // Vowel one ("uh", 570/840) for 50 ms, gliding into vowel two ("ah", 730/1090).
  f1.frequency.setValueAtTime(570, t0);
  f2.frequency.setValueAtTime(840, t0);
  f1.frequency.linearRampToValueAtTime(730, t0 + 0.07);
  f2.frequency.linearRampToValueAtTime(1090, t0 + 0.07);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.95, t0 + 0.012);
  env.gain.setValueAtTime(0.8, t0 + 0.05);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  src.connect(f1).connect(env);
  src.connect(f2).connect(env);
  env.connect(input);
  // The breath pushed out with it.
  noise(t0 + 0.01, 0.1, 0.18, 1400);
  src.start(t0);
  src.stop(t0 + 0.13);
  return 0.13;
}

/**
 * S10's enemy radio voice for a bark, synthesised (no recorded VO): a squelch, then a clipped run of voiced
 * syllables (a buzzing glottal source through two moving formants, one per three letters of the line, stressed on
 * the last when it ends in "!"), through the radio chain: band-pass 400 to 3,200 Hz, a 12% crush and a squelch tail.
 * Placed at the man (`pan`, quieter with distance); `dest` is the world bus.
 */
export function radioBark(ctx: BaseAudioContext, dest: AudioNode, line: string, distance: number, pan: number, seed = Math.random()): number {
  const t0 = ctx.currentTime + 0.01;
  const { input: hp, noise } = radioChain(ctx, dest, distance, pan);
  // Squelch in.
  noise(t0, 0.05, 0.5, 2400);
  const letters = line.replace(/[^a-z]/gi, "").length;
  const syl = Math.max(2, Math.min(9, Math.round(letters / 3)));
  const shout = line.endsWith("!");
  let t = t0 + 0.06;
  const f0 = 118 + seed * 34;
  const src = ctx.createOscillator();
  src.type = "sawtooth";
  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.Q.value = 4;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.Q.value = 6;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  src.connect(f1).connect(env);
  src.connect(f2).connect(env);
  env.connect(hp);
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < syl; i++) {
    const last = i === syl - 1;
    const dur = (last && shout ? 0.17 : 0.085) + rnd() * 0.05;
    const pitch = f0 * (shout ? 1.25 : 1) * (last && shout ? 1.18 : 0.94 + rnd() * 0.14);
    src.frequency.setValueAtTime(pitch, t);
    src.frequency.linearRampToValueAtTime(pitch * (last ? 0.86 : 0.97), t + dur);
    const vowel = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [440, 1020], [660, 1720]][Math.floor(rnd() * 6)]!;
    f1.frequency.setValueAtTime(vowel[0]!, t);
    f2.frequency.setValueAtTime(vowel[1]!, t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(shout ? 0.9 : 0.6, t + 0.015);
    env.gain.setValueAtTime(shout ? 0.9 : 0.6, t + dur - 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // A consonant's hiss between some syllables.
    if (rnd() < 0.45) noise(t + dur, 0.03, 0.25, 3000 + rnd() * 2000);
    t += dur + 0.02 + rnd() * 0.03;
  }
  src.start(t0 + 0.05);
  src.stop(t + 0.05);
  // Squelch out, a little later than the words.
  noise(t + 0.04, 0.07, 0.45, 1900);
  return t + 0.12 - t0;
}
