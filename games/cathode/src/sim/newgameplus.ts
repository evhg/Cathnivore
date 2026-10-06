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
