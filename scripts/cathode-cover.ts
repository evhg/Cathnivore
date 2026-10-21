// S11 (docs/design/cathode-combat.md C16): generates every district's cover points into
// games/cathode/src/render/levels/<district>.cover.json. Run after changing a level's colliders:
//   npx tsx scripts/cathode-cover.ts          (writes the files)
//   npx tsx scripts/cathode-cover.ts --check  (fails when a file is stale; tests/cathode-cover.test.ts does the same)
import { readFileSync, writeFileSync } from "node:fs";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import { RayWorld } from "../games/cathode/src/game/ray";
import { COVER_DISTRICTS, MARKET_BOUNDS, generateCover, packCover } from "../games/cathode/src/game/ai/cover";

const check = process.argv.includes("--check");
let stale = 0;
for (const id of COVER_DISTRICTS) {
  const level = buildDistrict(id, "high");
  const b = level.builder;
  const rays = new RayWorld(b.colliders, { mats: b.mats, obbs: b.obbs, thin: b.shotOnly });
  const bounds = level.theme?.bounds ?? MARKET_BOUNDS;
  const t0 = performance.now();
  const pts = generateCover(id, b.colliders, rays, (x, z) => level.groundHeight(x, z), bounds);
  const json = JSON.stringify(packCover(id, pts));
  const path = `games/cathode/src/render/levels/${id}.cover.json`;
  const full = pts.filter((p) => p.kind === "full").length;
  console.log(`${id}: ${pts.length} points (${pts.length - full} crouch, ${full} full) from ${b.colliders.length} colliders, ${(json.length / 1024).toFixed(1)} KB, ${(performance.now() - t0).toFixed(0)} ms`);
  if (check) {
    let old = "";
    try {
      old = readFileSync(path, "utf8").trim();
    } catch {
      old = "";
    }
    if (old !== json) {
      console.log(`  STALE: ${path}`);
      stale++;
    }
  } else writeFileSync(path, json + "\n");
}
if (stale) process.exit(1);
