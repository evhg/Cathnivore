// Hedgerow 2 M10 (docs/design/hedgerow-2.md section 9): tower XP and Acorns. Each kind earns XP equal to its
// knockouts in every mode; a win pays Acorns by mode. Both are earned only in real runs (the sandbox and the
// Daily never call this), and nothing here gates a tier yet.
import type { Difficulty, Game, TowerKind } from "./engine";
import type { SaveData } from "./store";

/** Acorns for a win: 20 to 120 by mode, with a remix paying the same as its base mode. */
export function acornsFor(difficulty: Difficulty, heroic: boolean): number {
  if (heroic) return 120;
  return difficulty === "easy" ? 20 : difficulty === "hard" ? 70 : 40;
}

export interface RunReward {
  xp: Partial<Record<TowerKind, number>>;
  acorns: number;
}

/** What a finished run earns, and the save updated with it. A loss still earns the XP its knockouts made. */
export function awardRun(data: SaveData, g: Game, won: boolean): RunReward {
  const xp: Partial<Record<TowerKind, number>> = {};
  for (const t of g.towers) if ((t.kills ?? 0) > 0) xp[t.kind] = (xp[t.kind] ?? 0) + (t.kills ?? 0);
  const store = (data.xp ??= {});
  for (const [k, n] of Object.entries(xp)) store[k as TowerKind] = (store[k as TowerKind] ?? 0) + (n ?? 0);
  const acorns = won ? acornsFor(g.difficulty, g.heroic) : 0;
  if (acorns) data.acorns = (data.acorns ?? 0) + acorns;
  return { xp, acorns };
}
