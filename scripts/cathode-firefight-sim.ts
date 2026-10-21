// C16 acceptance sim (docs/design/cathode-combat.md C16): 50 seeded encounters in the Drowned Market with the real
// Enemy, squad, tactics and cover code, headless. A squad of four riflemen and a sergeant meets a scripted Cath who
// strafes along the street, ducks behind cover now and then and shoots back. Measured per encounter:
//   - time from the squad's first sight of her to her first damage (>= 1.0 s: the reaction, the windup, the warning rounds)
//   - flanks started (>= 1), "Reloading!" barks (>= 1)
//   - the longest any man was stuck trying to move (< 5 s)
// Logged in BALANCE.md.  npx tsx scripts/cathode-firefight-sim.ts [runs=50]
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { buildDistrict } from "../games/cathode/src/render/levels/index";
import { RayWorld } from "../games/cathode/src/game/ray";
import { ENFORCER, Enemy, type Sight } from "../games/cathode/src/game/enemy";
import { Director } from "../games/cathode/src/game/ai/director";
import { unpackCover, type CoverFile } from "../games/cathode/src/game/ai/cover";
import { createRng } from "../games/cathode/src/sim/rng";

const RUNS = Number(process.argv[2] ?? 50);
const DT = 1 / 30;
const SECONDS = 60;

const level = buildDistrict("market", "high");
const b = level.builder;
const rays = new RayWorld(b.colliders, { mats: b.mats, obbs: b.obbs, thin: b.shotOnly });
const ground = (x: number, z: number) => level.groundHeight(x, z);
const cover = unpackCover(JSON.parse(readFileSync("games/cathode/src/render/levels/market.cover.json", "utf8")) as CoverFile);
const colliders = b.colliders;

interface Result {
  firstLos: number;
  firstDamage: number;
  flanks: number;
  reloads: number;
  barks: Record<string, number>;
  stuck: number;
  kills: number;
  cathHits: number;
  peeks: number;
  leans: number;
  blinds: number;
  surrenders: number;
  minMorale: number;
}

function freeSpot(rng: ReturnType<typeof createRng>, x0: number, x1: number, z0: number, z1: number): THREE.Vector3 {
  for (let i = 0; i < 400; i++) {
    const x = rng.float(x0, x1);
    const z = rng.float(z0, z1);
    const y = ground(x, z);
    if (y < -0.2) continue;
    if (colliders.some((c) => c.max.y > y + 0.4 && c.min.y < y + 1.7 && x > c.min.x - 0.5 && x < c.max.x + 0.5 && z > c.min.z - 0.5 && z < c.max.z + 0.5)) continue;
    return new THREE.Vector3(x, y, z);
  }
  return new THREE.Vector3(x0, ground(x0, z0), z0);
}

function run(seed: number): Result {
  const rng = createRng(seed * 7919 + 13);
  const rand = () => rng.next();
  const orig = Math.random;
  Math.random = rand;
  try {
    const zc = rng.float(-5, 40);
    const cath = freeSpot(rng, -8, 2, zc - 2, zc + 2);
    const dir = rng.chance(0.5) ? 1 : -1;
    const enemies: Enemy[] = [];
    const director = new Director("hardboiled");
    director.cover = cover;
    for (let i = 0; i < 5; i++) {
      const p = freeSpot(rng, -9, 5, zc + dir * 18 - 4, zc + dir * 24 + 4);
      const e = new Enemy({ ...ENFORCER, role: "rifle", leader: i === 0 }, [p], 1);
      e.motion.yaw = Math.atan2(cath.x - p.x, cath.z - p.z);
      enemies.push(e);
    }
    director.form(enemies);
    const res: Result = { firstLos: -1, firstDamage: -1, flanks: 0, reloads: 0, barks: {}, stuck: 0, kills: 0, cathHits: 0, peeks: 0, leans: 0, blinds: 0, surrenders: 0, minMorale: 1 };
    const pos = cath.clone();
    let strafe = 1;
    let strafeT = 0;
    let shootCd = 1.5;
    let duckT = 0;
    let t = 0;
    const flanking = new Set<number>();
    const acts = new Map<number, string>();
    for (let f = 0; f < SECONDS / DT; f++) {
      t += f ? DT : 0;
      // Cath: strafes across the street, ducks for a second now and then, shoots the nearest man she can see.
      strafeT -= DT;
      if (strafeT <= 0) {
        strafe = -strafe;
        strafeT = rng.float(1.5, 3.5);
      }
      const step = new THREE.Vector3(strafe * 2.2 * DT, 0, 0);
      const next = pos.clone().add(step);
      if (next.x > -9 && next.x < 3 && !colliders.some((c) => c.max.y > next.y + 0.4 && c.min.y < next.y + 1.7 && next.x > c.min.x - 0.35 && next.x < c.max.x + 0.35 && next.z > c.min.z - 0.35 && next.z < c.max.z + 0.35))
        pos.copy(next);
      else strafe = -strafe;
      duckT -= DT;
      if (duckT < -4 && rng.chance(0.01)) duckT = 1.2;
      const low = duckT > 0 ? 1 : 0;
      const sight: Sight = {
        eye: pos.clone().add(new THREE.Vector3(0, low ? 1.0 : 1.6, 0)),
        chest: pos.clone().add(new THREE.Vector3(0, low ? 0.8 : 1.25, 0)),
        light: 0.7,
        low,
        speed: 2.2,
        stealth: 1,
      };
      director.update(DT, sight.chest);
      for (const e of enemies) e.update(DT, sight, rays, colliders, ground);
      director.drain(enemies, (e, ev) => {
        if (ev.kind === "magOut") e.dropMag();
      });
      for (const bk of director.barks) {
        res.barks[bk.kind] = (res.barks[bk.kind] ?? 0) + 1;
        if (bk.kind === "reload") res.reloads++;
      }
      director.barks.length = 0;
      if (res.firstLos < 0 && enemies.some((e) => e.seesHer)) res.firstLos = t;
      for (const e of enemies) {
        const m = director.memberOf(e);
        if (m?.role === "flank" && !flanking.has(e.id)) {
          flanking.add(e.id);
          res.flanks++;
        } else if (m?.role !== "flank") flanking.delete(e.id);
        res.stuck = Math.max(res.stuck, e.tac?.stuckFor ?? 0);
        if (e.alive) res.minMorale = Math.min(res.minMorale, e.morale.value);
        const a = e.tac?.act ?? "";
        if (a !== acts.get(e.id)) {
          if (a === "peek") res.peeks++;
          if (a === "lean") res.leans++;
          if (a === "blind") res.blinds++;
          if (a === "surrender") res.surrenders++;
          acts.set(e.id, a);
        }
        // Her shots land on him.
        for (const sh of e.shots) {
          const toChest = sight.chest.clone().sub(sh.from);
          const along = toChest.dot(sh.dir);
          const miss = toChest.clone().addScaledVector(sh.dir, -along).length();
          const wall = rays.cast(sh.from, sh.dir, 120);
          if (along > 0 && miss < 0.3 && (!wall || wall.dist > along)) {
            res.cathHits++;
            if (res.firstDamage < 0) res.firstDamage = t;
          }
          // Near misses on her side are the warning rounds; nothing to do here.
        }
      }
      // Cath shoots back: every ~0.9 s at the nearest man whose head she can see, 40% hits of 34.
      shootCd -= DT;
      if (shootCd <= 0 && !low) {
        shootCd = rng.float(0.7, 1.2);
        const vis = enemies.filter((e) => e.alive && rays.clear(sight.eye, e.head)).sort((a, b) => a.position.distanceTo(pos) - b.position.distanceTo(pos));
        const tgt = vis[0];
        if (tgt) {
          if (rng.chance(Number(process.env.CATH_HIT ?? 0.4))) {
            if (tgt.damage(34)) {
              tgt.die(new THREE.Vector3(0, 0, 1), tgt.head.clone());
              res.kills++;
            }
          } else tgt.nearMiss(new THREE.Vector3(1, 0, 0));
        }
      }
      if (enemies.every((e) => !e.alive || e.tac?.surrendered || e.fleeing)) break;
    }
    return res;
  } finally {
    Math.random = orig;
  }
}

const out: Result[] = [];
const t0 = performance.now();
for (let i = 1; i <= RUNS; i++) out.push(run(i));
const ttd = out.filter((r) => r.firstDamage >= 0 && r.firstLos >= 0).map((r) => r.firstDamage - r.firstLos);
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] ?? NaN;
const minTtd = Math.min(...ttd);
const noFlank = out.filter((r) => r.flanks < 1).length;
const noReload = out.filter((r) => r.reloads < 1).length;
const stuck = Math.max(...out.map((r) => r.stuck));
const sum = (k: keyof Result) => out.reduce((s, r) => s + (r[k] as number), 0);
const barks: Record<string, number> = {};
for (const r of out) for (const [k, v] of Object.entries(r.barks)) barks[k] = (barks[k] ?? 0) + v;
console.log(`firefight sim: ${RUNS} encounters, ${((performance.now() - t0) / 1000).toFixed(1)} s`);
console.log(`  time to first damage after first LOS: min ${minTtd.toFixed(2)} s, median ${pct(ttd, 0.5).toFixed(2)} s, p90 ${pct(ttd, 0.9).toFixed(2)} s (${ttd.length} encounters drew blood)`);
console.log(`  flanks: ${sum("flanks")} total, ${noFlank} encounters without one; "Reloading!": ${sum("reloads")} total, ${noReload} encounters without one`);
console.log(`  longest stuck: ${stuck.toFixed(2)} s; kills ${sum("kills")}, rounds on Cath ${sum("cathHits")}, surrenders ${sum("surrenders")}`);
console.log(`  acts: peek ${sum("peeks")}, lean ${sum("leans")}, blind ${sum("blinds")}; barks ${JSON.stringify(barks)}`);
const pass = minTtd >= 1.0 && noFlank === 0 && noReload === 0 && stuck <= 5;
console.log(`  lowest morale per encounter: median ${pct(out.map((r) => r.minMorale), 0.5).toFixed(2)}, min ${Math.min(...out.map((r) => r.minMorale)).toFixed(2)}`);
console.log(pass ? "PASS" : "FAIL");
if (!pass) process.exit(1);
