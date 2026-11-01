// The daily challenge: one tuned level a day (the same for everyone, no server), chosen from levels 11 to 99
// that aren't bosses, played with the Seed Bank switched off so scores compare. The result is a share card
// of plain text. The best score per day is kept in SaveData.daily.

import type { Level } from "./engine";
import { LEVELS } from "./levels";
import type { DailyRule } from "./dailyrule";

export { dayOf, dailyRule, type DailyRule } from "./dailyrule";

export function dailyLevel(day: number): Level {
  const pool = LEVELS.filter((l) => l.id >= 11 && l.id % 10 !== 0 && l.id !== 94);
  const h = Math.imul(day + 1, 2654435761) >>> 0;
  return pool[h % pool.length]!;
}

/** Score out of 100: Goodwill kept, plus a bonus for each wave called early (up to 10). Lost runs score 0. */
export function dailyScore(won: boolean, kept: number, earlyCalls: number): number {
  return won ? Math.round(kept * 90 + Math.min(10, earlyCalls * 2)) : 0;
}

export function shareCard(day: number, level: Level, won: boolean, score: number, rule?: DailyRule): string {
  const bar = won ? "🟩".repeat(Math.round(score / 10)) + "⬜".repeat(10 - Math.round(score / 10)) : "🟥".repeat(10);
  const twist = rule && rule.name !== "Plain day" && level.rules === "fleet" ? ` (${rule.name})` : "";
  return `Hedgerow daily #${day + 1}: ${level.name}${twist}\n${bar} ${score}/100\ncathnivore.com/hedgerow/`;
}

