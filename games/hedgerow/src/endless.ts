// Endless fields: one per act, unlocked by clearing the act's boss. The field is the act's ninth level; the
// waves are generated from the enemies that level uses, seeded by act and week so everyone gets the same run
// for a week. Enemy health also climbs each wave (engine.ts spawnHp). Goodwill running out ends the run and
// the best wave is kept per act (store.ts recordEndless). No stars, no rosettes, no bot tuning.

import type { EnemyKind, Level, WaveGroup } from "./engine";
import { LEVELS } from "./levels";

export const ENDLESS_WAVES = 200;

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

export function endlessLevel(act: number, week: number): Level {
  const base = LEVELS.find((l) => l.id === act * 10 - 1)!;
  const pool: EnemyKind[] = [];
  for (const wave of base.waves) for (const g of wave) if (!pool.includes(g.enemy) && g.enemy !== "boss") pool.push(g.enemy);
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
    waves.push(groups);
  }
  return { ...base, name: `Endless: ${base.place}`, waves, endless: true, goodwill: Math.max(base.goodwill, 15), before: [], after: [] };
}
