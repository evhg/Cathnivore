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
  startClinic: "The Candor Clinic. Clean floors, clean books, and a doctor who wrote half the debts in Marrow. Vane's theatre is at the far end.",
  startPlaza: "Hollowell Plaza. Pell wants a crowd tonight, and a crowd is cover. Permits first, then the steps.",
  startTower: "The Board Tower. Forty floors of glass, and not one of them let in the rain. The Chair is two flights up.",
  startVault: "The Hollow Vault. Every debt in Marrow lives down here, and something is keeping count. Index first, then the core.",
  seen: "Hollowell Enforcers. Company men, company guns.",
  spotted: "So much for quiet.",
  unseenKill: "One less witness.",
  headshot: "He never heard it.",
  laser: "Red dot on my coat. Move.",
  bodyFound: "They've found him. Now they'll come looking for me.",
  shield: "Riot shield. Go round it, not through it.",
  lowHealth: "Not here. Not tonight.",
  levelUp: "Older. Better at this.",
  clear: "Quiet again. The fish market's back door is down by the water.",
  done: "A water taxi, and a name left on the seat: Julian Crisp.",
  beaCall1: "Bea: Mum? Are you still at work? Nana made me do my spellings twice.",
  beaCall2: "Cath: Spellings are important, darling. I'll be home before the rain stops.",
  beaCall3: "Bea: It never stops raining. I drew you an umbrella. Don't be late.",
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
  bullet: ["Not tonight, love.", "Up. They don't get to keep me.", "Shot in the street like a dog. Get up.", "Count the rounds next time, Cath."],
  sniper: ["Mind the windows. Mind everything.", "Somebody up high. Stay low next time.", "Never saw him. Next time I will.", "One shot, from a long way off. Again."],
  melee: ["Too close. Never that close again.", "He got his hands on me. Once.", "Should have kept my distance. Up.", "Bruises heal. Get up."],
  blast: ["Mind the glass. Mind everything.", "Ears ringing. Up anyway.", "That one was loud. Next time, run.", "Smoke clears. So do I."],
  laser: ["Red light means stop, Cath.", "Wired for it, and I walked in.", "Clever little beam. Clever little me, next time.", "Burnt coat. Burnt pride. Up."],
  any: ["School run's at eight. Get up.", "Bea's waiting up. Get up.", "Marrow doesn't get me that cheap.", "Not the night to quit, love."],
};

/** One death line for `cause`, picked by `seed` (0..1), never the same as `last`. */
export function deathLine(cause: DeathCause, seed: number, last?: string): string {
  const pool = [...DEATH_LINES[cause], ...DEATH_LINES.any];
  let i = Math.floor(Math.max(0, Math.min(0.9999, seed)) * pool.length);
  if (pool[i] === last) i = (i + 1) % pool.length;
  return pool[i]!;
}
