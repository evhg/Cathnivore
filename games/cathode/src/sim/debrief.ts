// Plan item 17: the morning-after debrief. When a district's case closes (its boss is down), the case board shows
// what the visit came to: a stamped grade, the Scrip and XP it earned, her best three kills as stills, the List
// polaroid struck through, a keepsake when the case gives one, and a line from Cath (plus a text from Bea on a clean
// run). This file is the pure part: the ledger's shape, the score and grade, which kills make the stills, the lines.

export type DebriefGrade = "S" | "A" | "B" | "C" | "D";

/** What one visit to a district came to, counted by the session from the district's load to the case closing. */
export interface DebriefLedger {
  /** Enemies down (civilians never count). */
  kills: number;
  headshots: number;
  takedowns: number;
  /** Any enemy ever went to combat on her (an alarm, a firefight). */
  spotted: boolean;
  /** Health lost over the visit (before armour is not counted: what reached her). */
  damageTaken: number;
  /** Her health pool, to read the damage as a share. */
  maxHp: number;
  /** Times she went down and started again from a checkpoint. */
  restarts: number;
  /** Seconds in the district. */
  seconds: number;
  scrip: number;
  xp: number;
}

export const emptyLedger = (maxHp = 100): DebriefLedger => ({
  kills: 0,
  headshots: 0,
  takedowns: 0,
  spotted: false,
  damageTaken: 0,
  maxHp,
  restarts: 0,
  seconds: 0,
  scrip: 0,
  xp: 0,
});

/**
 * The visit's score, 0..100. Starts at 50; a clean (unseen) run is worth 20, headshots up to 20 by their share of
 * the kills, takedowns 3 each up to 15; health lost costs up to 25 (5 per full health bar), each restart 10 up to 30.
 */
export function debriefScore(l: DebriefLedger): number {
  let s = 50;
  if (!l.spotted) s += 20;
  if (l.kills > 0) s += 20 * Math.min(1, l.headshots / l.kills);
  s += Math.min(15, 3 * l.takedowns);
  s -= Math.min(25, (5 * l.damageTaken) / Math.max(1, l.maxHp));
  s -= Math.min(30, 10 * l.restarts);
  return Math.max(0, Math.min(100, Math.round(s)));
}

/** The grade bars: S at 90, A at 75, B at 60, C at 45, D below. */
export const GRADE_BARS: ReadonlyArray<readonly [DebriefGrade, number]> = [
  ["S", 90],
  ["A", 75],
  ["B", 60],
  ["C", 45],
  ["D", 0],
];

export function debriefGrade(score: number): DebriefGrade {
  for (const [g, bar] of GRADE_BARS) if (score >= bar) return g;
  return "D";
}

/** The word stamped under the letter. */
export const GRADE_WORD: Record<DebriefGrade, string> = {
  S: "Spotless",
  A: "Clean work",
  B: "Done",
  C: "Messy",
  D: "Loud",
};

/** A kill worth a still: how good it looked. Headshots and takedowns first, then distance. */
export interface StillKill {
  headshot: boolean;
  takedown: boolean;
  distance: number;
  severed: boolean;
}

export function stillScore(k: StillKill): number {
  return (k.headshot ? 30 : 0) + (k.takedown ? 25 : 0) + (k.severed ? 10 : 0) + Math.min(30, k.distance);
}

/** Keeps the best `n` of a running list (stable for ties: the earlier kill stays). */
export function bestStills<T extends { score: number }>(list: readonly T[], n = 3): T[] {
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => b.x.score - a.x.score || a.i - b.i)
    .slice(0, n)
    .map((e) => e.x);
}

/** The case ids that close a district (a boss down), with the List polaroid they strike and the keepsake. */
export const CLOSING_CASES: Record<string, { district: string; keepsake: string | null; title: string }> = {
  crispBoss: { district: "The Drowned Market", keepsake: "gumshoes", title: "Julian Crisp" },
  vaneBoss: { district: "The Candor clinic", keepsake: "velvetKnuckles", title: "Dr Octavia Vane" },
  pellBoss: { district: "Hollowell Plaza", keepsake: "widowsVeil", title: "Councillor Marcus Pell" },
  boardBoss: { district: "The Board Tower", keepsake: "longGoodbye", title: "The Chair of the Board" },
  vaultBoss: { district: "The Hollow Vault", keepsake: "candorsConscience", title: "HollowCandor" },
};

/** Cath's line for the grade. */
export function cathLine(g: DebriefGrade): string {
  switch (g) {
    case "S":
      return "Cath: Nobody heard a thing. Home before the school run.";
    case "A":
      return "Cath: Tidy enough. I'll still need a hot bath.";
    case "B":
      return "Cath: It's done. That's what matters.";
    case "C":
      return "Cath: That got loud. Bea will have the radio on.";
    default:
      return "Cath: I'll be picking glass out of this coat for a week.";
  }
}

/** Bea's text on a clean run (nobody ever went to combat on her), else null. */
export function beaText(l: DebriefLedger): string | null {
  return l.spotted ? null : "Bea: Police scanner was silent all night. Show-off. x";
}

/** mm:ss for the time on the debrief. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
