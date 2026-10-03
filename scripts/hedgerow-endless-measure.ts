// How far the bots get in each act's Endless field (week 39): `npx tsx scripts/hedgerow-endless-measure.ts`.
// Aim: the best bot runs out of Goodwill around wave 20-40 (docs/design/hedgerow-v2.md 8). Log runs in BALANCE.md.
import { playLevel } from "../games/hedgerow/src/bot";
import { endlessLevel } from "../games/hedgerow/src/endless";
for (let act = 1; act <= 10; act++) {
  let lv;
  try { lv = endlessLevel(act, 39); } catch { break; }
  const row: string[] = [];
  for (const skill of ["competent", "balanced"] as const) {
    const g = playLevel(lv, skill);
    row.push(`${skill} wave ${g.wave} (${g.phase}) marks ${Math.round(g.marks)} towers ${g.towers.length}`);
  }
  console.log(`act ${act}: ${row.join(" | ")}`);
}
