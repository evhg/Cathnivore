// Hedgerow 2 M10 (docs/design/hedgerow-2.md section 9): tower XP and Acorns. Each kind earns XP equal to its
// knockouts in every mode; a win pays Acorns by mode. Both are earned only in real runs (the sandbox and the
// Daily never call this), and nothing here gates a tier yet.
import { XP_CROWN, type Difficulty, type Game, type TowerKind } from "./engine";
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
  // XP past a kind's Crown gate has nothing left to unlock: it collects in the Compost Heap.
  for (const k of Object.keys(store) as TowerKind[]) {
    const over = (store[k] ?? 0) - XP_CROWN;
    if (over > 0) {
      data.compost = (data.compost ?? 0) + over;
      store[k] = XP_CROWN;
    }
  }
  const acorns = won ? acornsFor(g.difficulty, g.heroic) : 0;
  if (acorns) data.acorns = (data.acorns ?? 0) + acorns;
  return { xp, acorns };
}

/** XP given per feed: the Heap pays 2 compost for each XP (design doc section 9). */
export const COMPOST_RATE = 2;
export const COMPOST_FEED = 500;

/** Feeds the Compost Heap to `kind`: `COMPOST_FEED` XP for 1,000 compost. False if the heap is short or the kind is full. */
export function feedCompost(data: SaveData, kind: TowerKind): boolean {
  const have = data.xp?.[kind] ?? 0;
  const give = Math.min(COMPOST_FEED, XP_CROWN - have);
  const cost = give * COMPOST_RATE;
  if (give <= 0 || (data.compost ?? 0) < cost) return false;
  (data.xp ??= {})[kind] = have + give;
  data.compost = (data.compost ?? 0) - cost;
  return true;
}
