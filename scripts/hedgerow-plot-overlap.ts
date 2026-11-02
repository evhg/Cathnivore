// Plan item 43: how alike are a Hedgerow act's fields? For each act (ten levels), the plot set of every level
// (cells that aren't lane), compared pairwise by Jaccard on the cells both fields have. The plan's acceptance is
// no pair within an act above 0.70. Usage: npx tsx scripts/hedgerow-plot-overlap.ts
import { LEVELS } from "../games/hedgerow/src/levels";
import { laneCellsOf } from "../games/hedgerow/src/engine";

const plots = (lv: (typeof LEVELS)[number]) => {
  const lane = laneCellsOf(lv);
  const s = new Set<string>();
  for (let c = 0; c < lv.cols; c++) for (let r = 0; r < lv.rows; r++) if (!lane.has(`${c},${r}`)) s.add(`${c},${r}`);
  return s;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};
let worst = 0;
let over = 0;
for (let act = 1; act <= Math.ceil(LEVELS.length / 10); act++) {
  const ls = LEVELS.filter((l) => Math.floor((l.id - 1) / 10) + 1 === act);
  const sets = ls.map(plots);
  const pairs: string[] = [];
  let max = 0;
  for (let i = 0; i < ls.length; i++)
    for (let j = i + 1; j < ls.length; j++) {
      const v = jaccard(sets[i]!, sets[j]!);
      max = Math.max(max, v);
      if (v > 0.7) pairs.push(`${ls[i]!.id}~${ls[j]!.id} ${v.toFixed(2)}`);
    }
  worst = Math.max(worst, max);
  over += pairs.length;
  console.log(`act ${act}: max ${max.toFixed(2)}, ${pairs.length} pairs over 0.70${pairs.length ? ": " + pairs.slice(0, 6).join(", ") : ""}`);
}
console.log(`worst ${worst.toFixed(2)}, ${over} pairs over 0.70; levels with no landmark: ${LEVELS.filter((l) => !l.setPieces?.length).length}/${LEVELS.length}`);
