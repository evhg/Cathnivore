// Hedgerow's difficulty tuner (docs/design/hedgerow-v2.md section 2). For every level it finds the largest
// enemy-health multiplier at which the best bot (games/hedgerow/src/bot.ts: the better of competent and balanced) still wins keeping at least
// the target share of its Goodwill, and writes the table to games/hedgerow/src/tuning.ts. Run it after
// changing levels, enemies, towers or twists: `npx tsx scripts/hedgerow-tune.ts [fromLevel] [toLevel]`, then
// `npx tsx scripts/hedgerow-tune.ts --verify` to check every level at the value that ships, then
// `--antispam` to push levels the Scarecrows-only bot still wins as far as the best bot allows.
// Levels run in parallel worker processes. Log the run in BALANCE.md.
//
// Fleet levels (Hedgerow 2, Level.rules "fleet": act 1 from M2) never scale health. For them the tuner fits k,
// the share of 500 plus the Round Book's income before the level's first round that it starts with (levels.ts
// fleetStart), in [0.4, 1.2]: the smallest k at which the best bot keeps its target, then made non-increasing
// within the act (each level gets at least what any later level of the act needed). Written to START_K.

import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = new URL("../games/hedgerow/src/tuning.ts", import.meta.url);

/** The share of Goodwill the competent bot must keep: gentle in the tutorial, a real fight from level 8. */
export function target(id: number): number {
  return id <= 3 ? 0.9 : id <= 7 ? 0.7 : 0.5;
}

/** What ships is the tuned value times this (levels.ts humanMargin): the verify pass checks that. */
export function humanMargin(id: number): number {
  return id === 1 ? 0.65 : id <= 7 ? 0.9 : id <= 10 ? 0.97 : 1;
}

/**
 * Verify mode: the shipped value must give the competent bot a clean win (at least 50% Goodwill). Outcomes
 * aren't perfectly monotonic in enemy health, so back off in 8% steps until they are.
 */
async function verify(id: number): Promise<number> {
  if (await isFleetLevel(id)) {
    // Fleet: the shipped k must give the best bot a clean win (at least 50% Goodwill); raise it if not.
    const { LEVELS, fleetStart } = await import("../games/hedgerow/src/levels");
    const { playLevel, kept } = await import("../games/hedgerow/src/bot");
    const { START_K } = await import("../games/hedgerow/src/tuning");
    let k = START_K[id] ?? 0.85;
    while (k < K_MAX && kept(playLevel({ ...LEVELS[id - 1]!, startMarks: fleetStart(id, k) }, "best")) < 0.5) k = Math.round((k + 0.05) * 100) / 100;
    return Math.min(K_MAX, k);
  }
  const { LEVELS } = await import("../games/hedgerow/src/levels");
  const { playLevel, kept } = await import("../games/hedgerow/src/bot");
  const { HP_SCALE } = await import("../games/hedgerow/src/tuning");
  const base = LEVELS[id - 1]!;
  let tuned = HP_SCALE[id] ?? 1;
  for (let i = 0; i < 20; i++) {
    const shipped = Math.round(tuned * humanMargin(id) * 100) / 100;
    const g = playLevel({ ...base, hpScale: shipped }, "best");
    if (kept(g) >= 0.5 && kept(playLevel({ ...base, hpScale: shipped * 1.04 }, "best")) > 0) break;
    tuned *= 0.92;
  }
  return Math.round(tuned * 100) / 100;
}

const K_MIN = 0.4;
const K_MAX = 1.2;
/**
 * Levels whose k may not go below a floor whatever the bot manages. Level 1 is the tutorial: a first build of a
 * few Scarecrows on whichever plots look right must still win most of the time (M1 review, tests/hedgerow.test.ts),
 * which the best bot's target can't see, so it opens on the most the range allows.
 */
const K_FLOOR: Record<number, number> = { 1: K_MAX };

/** Fleet levels: the smallest start-Marks share k in [K_MIN, K_MAX] at which the best bot keeps its target. */
async function fitK(id: number, need = target(id)): Promise<number> {
  const { LEVELS, fleetStart } = await import("../games/hedgerow/src/levels");
  const { playLevel, kept } = await import("../games/hedgerow/src/bot");
  const base = LEVELS[id - 1]!;
  const ok = (k: number) => kept(playLevel({ ...base, startMarks: fleetStart(id, k) }, "best")) >= need;
  const lowest = K_FLOOR[id] ?? K_MIN;
  if (ok(lowest)) return lowest;
  if (!ok(K_MAX)) {
    console.error(`level ${id}: the best bot misses its target even at k = ${K_MAX}`);
    return K_MAX;
  }
  let lo = lowest;
  let hi = K_MAX;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 100) / 100;
}

async function isFleetLevel(id: number): Promise<boolean> {
  const { LEVELS } = await import("../games/hedgerow/src/levels");
  return LEVELS[id - 1]?.rules === "fleet";
}

async function worker(id: number): Promise<number> {
  if (await isFleetLevel(id)) return fitK(id);
  const { LEVELS } = await import("../games/hedgerow/src/levels");
  const { playLevel, kept } = await import("../games/hedgerow/src/bot");
  const base = LEVELS[id - 1]!;
  const ok = (scale: number) => kept(playLevel({ ...base, hpScale: scale }, "best")) >= target(id);
  let lo = 0.3;
  let hi = 16;
  if (!ok(lo)) return lo;
  if (ok(hi)) return hi;
  for (let i = 0; i < 11; i++) {
    const mid = Math.sqrt(lo * hi);
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 100) / 100;
}

/**
 * Anti-spam mode (`--antispam`, owner 2026-10-02: "Scarecrow spam shouldn't win"): from level 8, while the
 * naive Scarecrows-only bot still wins at the shipped value, raise enemy health 6% at a time as long as the
 * best bot still passes the verify rule. Stops at whichever comes first. Run it after `--verify`.
 */
async function antispam(id: number): Promise<number> {
  if (await isFleetLevel(id)) {
    const { START_K } = await import("../games/hedgerow/src/tuning");
    return START_K[id] ?? 0.85;
  }
  const { LEVELS } = await import("../games/hedgerow/src/levels");
  const { playLevel, kept } = await import("../games/hedgerow/src/bot");
  const { HP_SCALE } = await import("../games/hedgerow/src/tuning");
  const base = LEVELS[id - 1]!;
  let tuned = HP_SCALE[id] ?? 1;
  if (id < 8) return tuned;
  const shipped = (v: number) => Math.round(v * humanMargin(id) * 100) / 100;
  const fair = (v: number) =>
    kept(playLevel({ ...base, hpScale: shipped(v) }, "best")) >= 0.5 &&
    kept(playLevel({ ...base, hpScale: shipped(v) * 1.04 }, "best")) > 0;
  for (let i = 0; i < 12; i++) {
    if (kept(playLevel({ ...base, hpScale: shipped(tuned) }, "naive")) === 0) break;
    const up = Math.round(tuned * 1.06 * 100) / 100;
    if (!fair(up)) break;
    tuned = up;
  }
  return tuned;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg === "--one") {
    process.stdout.write(String(await worker(Number(process.argv[3]))));
    return;
  }
  if (arg === "--antispam-one") {
    process.stdout.write(String(await antispam(Number(process.argv[3]))));
    return;
  }
  if (arg === "--verify-one") {
    process.stdout.write(String(await verify(Number(process.argv[3]))));
    return;
  }
  const verifying = arg === "--verify";
  const anti = arg === "--antispam";
  const from = verifying || anti ? Number(process.argv[3] ?? 1) : Number(arg ?? 1);
  const to = verifying || anti ? Number(process.argv[4] ?? 100) : Number(process.argv[3] ?? 100);
  const existing: Record<number, number> = {};
  const existingK: Record<number, number> = {};
  try {
    const src = readFileSync(OUT, "utf8");
    const [hp, k = ""] = src.split("START_K");
    for (const m of hp!.matchAll(/(\d+): ([\d.]+),/g)) existing[Number(m[1])] = Number(m[2]);
    for (const m of k.matchAll(/(\d+): ([\d.]+),/g)) existingK[Number(m[1])] = Number(m[2]);
  } catch {
    /* first run */
  }
  const { LEVELS } = await import("../games/hedgerow/src/levels");
  const fleet = new Set(LEVELS.filter((l) => l.rules === "fleet").map((l) => l.id));
  for (const id of fleet) delete existing[id];
  const ids = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const self = fileURLToPath(import.meta.url);
  const results: Record<number, number> = { ...existing, ...existingK };
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < ids.length) {
      const id = ids[next++]!;
      const out = await new Promise<string>((resolve, reject) => {
        const p = spawn(process.execPath, ["--import", "tsx", self, anti ? "--antispam-one" : verifying ? "--verify-one" : "--one", String(id)], {
          stdio: ["ignore", "pipe", "inherit"],
        });
        let buf = "";
        p.stdout.on("data", (d) => (buf += d));
        p.on("close", (code) => (code === 0 ? resolve(buf) : reject(new Error(`level ${id} exited ${code}`))));
      });
      results[id] = Number(out.trim());
      console.log(`level ${id}: ${fleet.has(id) ? "k" : "hpScale"} ${results[id]}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, cpus().length - 1) }, run));
  // Fleet k: non-increasing within each act, each level keeping at least what any later one needed.
  if (!anti) {
    const ks = [...fleet].sort((a, b) => b - a);
    for (const id of ks) {
      const later = ks.filter((o) => o > id && Math.ceil(o / 10) === Math.ceil(id / 10)).map((o) => results[o] ?? 0);
      results[id] = Math.max(results[id] ?? K_MIN, ...later);
    }
  }
  const ids2 = Object.keys(results)
    .map(Number)
    .sort((a, b) => a - b);
  const lines = ids2.filter((id) => !fleet.has(id)).map((id) => `  ${id}: ${results[id]},`);
  const kLines = ids2.filter((id) => fleet.has(id)).map((id) => `  ${id}: ${results[id]},`);
  writeFileSync(
    OUT,
    `// Generated by scripts/hedgerow-tune.ts: enemy health per level, so the competent bot only just keeps\n// its target Goodwill (docs/design/hedgerow-v2.md section 2). Don't edit by hand; re-run the tuner.\n\nexport const HP_SCALE: Record<number, number> = {\n${lines.join("\n")}\n};\n\n// Fleet levels (Hedgerow 2): start Marks = k * (500 + the Round Book's income before the level's first round).\n// The tuner fits k in [0.4, 1.2]; it never touches health on fleet levels.\nexport const START_K: Record<number, number> = {\n${kLines.join("\n")}\n};\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
