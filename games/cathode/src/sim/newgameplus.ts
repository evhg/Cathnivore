// New Game+: after act 5 (`vaultBoss`) the story restarts with her kit and tougher elites. The save keeps the
// character and the difficulty unlocks; story jobs, secrets and landmarks reset. Each lap adds an `ngPlus<n>` flag.

/** Flags that survive a restart. */
const KEEP = new Set(["hardboiledOpen", "hellWeekOpen"]);

const LAP = /^ngPlus(\d+)$/;

/** How many New Game+ laps this save has started. */
export function ngPlusLap(jobsDone: readonly string[]): number {
  let n = 0;
  for (const id of jobsDone) {
    const m = LAP.exec(id);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return n;
}

/** Whether the story is finished, so New Game+ can start. */
export function canStartNewGamePlus(jobsDone: readonly string[]): boolean {
  return jobsDone.includes("vaultBoss");
}

/** The jobs list for the next lap: unlock flags kept, lap counter up by one, everything else cleared. */
export function startNewGamePlus(jobsDone: readonly string[]): string[] {
  const lap = ngPlusLap(jobsDone) + 1;
  return [...jobsDone.filter((id) => KEEP.has(id)), `ngPlus${lap}`];
}

/** Extra elite chance per lap (added to the difficulty's chance), capped so a lap never makes everyone elite. */
export function ngPlusEliteBonus(lap: number): number {
  return Math.min(0.2, lap * 0.08);
}

// ---- Second Broadcast: the modifier deck (ROADMAP 230). Picked 1-3 when a lap starts, stored as `mod:<id>` flags. ----

export type ModId = "glass" | "noregen" | "elites" | "fog";

export const MODS: readonly { id: ModId; name: string; line: string; score: number }[] = [
  { id: "glass", name: "Glass cannon", line: "Everything that hits you hits 60% harder.", score: 0.4 },
  { id: "noregen", name: "No second wind", line: "Guard never comes back on its own.", score: 0.5 },
  { id: "elites", name: "Elite patrols", line: "Twice as many named enemies on the street, and tougher ones.", score: 0.35 },
  { id: "fog", name: "Fog of the broadcast", line: "The street disappears into the static.", score: 0.15 },
];

/** The mods on this save. */
export function activeMods(jobsDone: readonly string[]): ModId[] {
  return MODS.filter((m) => jobsDone.includes(`mod:${m.id}`)).map((m) => m.id);
}

/** Starts the next lap with a deck of at most three mods (unknown ids are ignored). */
export function startSecondBroadcast(jobsDone: readonly string[], picks: readonly string[]): string[] {
  const ok = MODS.filter((m) => picks.includes(m.id)).slice(0, 3);
  return [...startNewGamePlus(jobsDone), ...ok.map((m) => `mod:${m.id}`)];
}

/** Score multiplier for the deck: 1 with no mods, plus each mod's bonus, and 10% per lap. */
export function scoreMultiplier(jobsDone: readonly string[]): number {
  const lap = ngPlusLap(jobsDone);
  if (lap === 0) return 1;
  const bonus = MODS.filter((m) => jobsDone.includes(`mod:${m.id}`)).reduce((a, m) => a + m.score, 0);
  return Math.round((1 + bonus + 0.1 * (lap - 1)) * 100) / 100;
}

export const MOD_EFFECTS = {
  damageTaken: (mods: readonly ModId[]): number => (mods.includes("glass") ? 1.6 : 1),
  eliteChance: (mods: readonly ModId[]): number => (mods.includes("elites") ? 0.25 : 0),
  fogDensity: (mods: readonly ModId[]): number => (mods.includes("fog") ? 2.2 : 1),
};
