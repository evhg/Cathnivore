// Endless fields: one per act, unlocked by clearing the act's boss. The field is the act's ninth level; the
// waves are generated from the enemies that level uses, seeded by act and week so everyone gets the same run
// for a week. Enemy health compounds each wave (engine.ts spawnHp), the act boss returns every tenth wave and
// wave pay is lean. Goodwill running out ends the run and the best wave is kept per act (store.ts
// recordEndless). No stars, no rosettes, no bot tuning.

import { isBig, pathLength, type EnemyKind, type Level, type SetPiece, type WaveGroup } from "./engine";
import { LEVELS } from "./levels";

export const ENDLESS_WAVES = 200;

/** Endless wave 1 is this share of the story level's tuned enemy health. */
export const ENDLESS_START = 0.5;

/** The act's Endless field is open once its boss level (act x 10) has a star. */
export function endlessUnlocked(stars: Record<string, number>, act: number): boolean {
  return (stars[String(act * 10)] ?? 0) > 0;
}

/** Whole weeks since 2026-01-05 (a Monday), UTC: the seed's weekly part. */
export function weekOf(now: number): number {
  return Math.floor((now - Date.UTC(2026, 0, 5)) / (7 * 86400000));
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Act 1's story levels play the Fleet (Hedgerow 2 M2), but its Endless stays the classic field it was until M8
 * turns Endless into Freeplay: level 9's old enemies (vans, bubble-wrapped vans, drones, lorries), purse and
 * health, not Fleet rungs given made-up classic numbers nothing has tuned.
 */
const CLASSIC_POOL: Partial<Record<number, { pool: EnemyKind[]; startMarks: number; hpScale: number }>> = {
  1: { pool: ["van", "wrapped", "drone", "truck"], startMarks: 640, hpScale: 1.4 },
};

export function endlessLevel(act: number, week: number): Level {
  const base = LEVELS.find((l) => l.id === act * 10 - 1)!;
  const classic = base.rules === "fleet" ? CLASSIC_POOL[act] : undefined;
  const pool: EnemyKind[] = classic ? [...classic.pool] : [];
  if (!classic) for (const wave of base.waves) for (const g of wave) if (!pool.includes(g.enemy) && g.enemy !== "boss") pool.push(g.enemy);
  const bossLevel = LEVELS.find((l) => l.id === act * 10);
  const boss = bossLevel?.waves.flat().find((g) => isBig(g.enemy))?.enemy;
  const rand = rng(act * 1000 + week);
  const waves: WaveGroup[][] = [];
  for (let n = 0; n < ENDLESS_WAVES; n++) {
    const groups: WaveGroup[] = [];
    // Later waves open up more of the pool and send more groups.
    const open = Math.min(pool.length, 2 + Math.floor(n / 4));
    const count = Math.min(3, 1 + Math.floor(n / 6));
    for (let i = 0; i < count; i++) {
      const enemy = pool[Math.floor(rand() * open)]!;
      groups.push({
        enemy,
        count: Math.round((5 + n * 0.8) * (0.7 + rand() * 0.6) / count),
        gap: Math.max(0.35, 1.2 - n * 0.015) * (0.8 + rand() * 0.4),
        delay: i * 2.5,
        ...(base.path2 && rand() < 0.5 ? { lane: 1 as const } : {}),
      });
    }
    // From wave 20 the act's boss comes back every tenth wave, and from wave 30 it brings company.
    if (boss && n % 10 === 9 && n >= 19) groups.push({ enemy: boss, count: 1 + Math.floor(n / 30), gap: 4, delay: count * 2.5 });
    waves.push(groups);
  }
  // A swing bridge, placed and timed by the week's seed, unless the story level already has one.
  const setPieces: SetPiece[] = [...(base.setPieces ?? [])];
  if (!setPieces.some((p) => p.kind === "bridge")) {
    setPieces.push({ kind: "bridge", dist: Math.round(pathLength(base.path) * (0.35 + rand() * 0.3)), period: 12 + Math.floor(rand() * 5), open: 3 + Math.floor(rand() * 2) });
  }
  // It opens gentler than the story level (ENDLESS_START of its tuned health), then compounds past it fast.
  // A fleet act's Endless runs on classic rules (CLASSIC_POOL above).
  return {
    ...base,
    ...(classic ? { rules: "classic" as const, book: undefined, startMarks: classic.startMarks } : {}),
    name: `Endless: ${base.place}`,
    waves,
    endless: true,
    setPieces,
    hpScale: ((classic ? classic.hpScale : base.hpScale) ?? 1) * ENDLESS_START,
    goodwill: classic ? 15 : Math.max(base.goodwill, 15),
    before: [],
    after: [],
  };
}
