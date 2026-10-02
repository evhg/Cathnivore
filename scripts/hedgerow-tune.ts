// Hedgerow's difficulty tuner (docs/design/hedgerow-v2.md section 2). For every level it finds the largest
// enemy-health multiplier at which the best bot (games/hedgerow/src/bot.ts: the better of competent and balanced) still wins keeping at least
// the target share of its Goodwill, and writes the table to games/hedgerow/src/tuning.ts. Run it after
// changing levels, enemies, towers or twists: `npx tsx scripts/hedgerow-tune.ts [fromLevel] [toLevel]`, then
// `npx tsx scripts/hedgerow-tune.ts --verify` to check every level at the value that ships, then
// `--antispam` to push levels the Scarecrows-only bot still wins as far as the best bot allows.
// Levels run in parallel worker processes. Log the run in BALANCE.md.

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
  return id <= 7 ? 0.9 : id <= 10 ? 0.97 : 1;
}

/**
 * Verify mode: the shipped value must give the competent bot a clean win (at least 50% Goodwill). Outcomes
 * aren't perfectly monotonic in enemy health, so back off in 8% steps until they are.
 */
async function verify(id: number): Promise<number> {
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

async function worker(id: number): Promise<number> {
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
  try {
    const src = readFileSync(OUT, "utf8");
    for (const m of src.matchAll(/(\d+): ([\d.]+),/g)) existing[Number(m[1])] = Number(m[2]);
  } catch {
    /* first run */
  }
  const ids = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const self = fileURLToPath(import.meta.url);
  const results: Record<number, number> = { ...existing };
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
      console.log(`level ${id}: hpScale ${results[id]}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, cpus().length - 1) }, run));
  const lines = Object.keys(results)
    .map(Number)
    .sort((a, b) => a - b)
    .map((id) => `  ${id}: ${results[id]},`);
  writeFileSync(
    OUT,
    `// Generated by scripts/hedgerow-tune.ts: enemy health per level, so the competent bot only just keeps\n// its target Goodwill (docs/design/hedgerow-v2.md section 2). Don't edit by hand; re-run the tuner.\n\nexport const HP_SCALE: Record<number, number> = {\n${lines.join("\n")}\n};\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
