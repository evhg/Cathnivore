// Which difficulties Cath may pick (Diablo II's Normal, Nightmare and Hell). Finishing act 5 opens
// Hardboiled (`hardboiledOpen`); finishing it again on Hardboiled opens Hell Week (`hellWeekOpen`).
import { DIFFICULTIES, type Difficulty } from "./types";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { noir: "Noir", hardboiled: "Hardboiled", hellWeek: "Hell Week" };

const UNLOCK_FLAG: Record<Difficulty, string | null> = { noir: null, hardboiled: "hardboiledOpen", hellWeek: "hellWeekOpen" };

/** The difficulties she can pick, easiest first. */
export function unlockedDifficulties(jobsDone: readonly string[]): Difficulty[] {
  return DIFFICULTIES.filter((d) => {
    const flag = UNLOCK_FLAG[d];
    return flag === null || jobsDone.includes(flag);
  });
}

/** The unlock flag a finished act 5 earns on a difficulty (Hell Week has nothing further to open). */
export function actFiveUnlock(difficulty: Difficulty): string | null {
  return difficulty === "noir" ? "hardboiledOpen" : difficulty === "hardboiled" ? "hellWeekOpen" : null;
}
