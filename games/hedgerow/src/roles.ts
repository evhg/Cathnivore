// What each tower is for (plan item 31's role glyphs, item 119's packet bands): shared by the tray and the Almanac.
import { TOWERS, type TowerKind } from "./engine";

export type TowerRole = "slow" | "splash" | "boost" | "income" | "shot";

/** What a tower is for, from its tier-1 numbers. */
export function towerRole(kind: TowerKind): TowerRole {
  const t = TOWERS[kind];
  if (t.income?.[0]) return "income";
  if (t.buff?.[0]) return "boost";
  if (t.damage[0] === 0 && t.slow[0] < 1) return "slow";
  if (t.splash) return "splash";
  return "shot";
}
