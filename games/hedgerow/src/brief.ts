// Plan item 624: Cath's face on a level's briefing follows how hard the level is: delighted on the first stops,
// her usual smirk on a plain lane, set and determined for a twist or a second lane, worried before a boss or a level
// that stacks them.
import type { CathExpression } from "../../../shared/cath/cath";
import type { Level } from "./engine";

export type BriefLevel = Pick<Level, "id" | "twists" | "path2">;

/** How hard a level reads on its card: 0 a first stop, 1 plain, 2 one complication, 3 a boss or stacked ones. */
export function briefDifficulty(lv: BriefLevel): 0 | 1 | 2 | 3 {
  const extras = (lv.twists?.length ?? 0) + (lv.path2 ? 1 : 0);
  if (lv.id % 10 === 0 || extras >= 2) return 3;
  if (extras === 1) return 2;
  return lv.id <= 3 ? 0 : 1;
}

export function briefExpression(lv: BriefLevel): CathExpression {
  return (["delighted", "smirk", "determined", "worried"] as const)[briefDifficulty(lv)];
}
