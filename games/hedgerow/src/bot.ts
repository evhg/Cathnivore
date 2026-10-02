// Hedgerow's level bots, shared by the tests and the difficulty tuner (scripts/hedgerow-tune.ts).
// - "competent" reads the next two waves and the level's twists and buys counters: something that hits air
//   when drones come, Silos for armour, a Radio Mast for stealth, a Clinic Tent for charm, Beehives for
//   crowds, hedges to slow, a Market Stall for income, the Courthouse for bosses; it places each where it
//   covers the most lane, upgrades, and picks specialisations to match. Cath and her abilities run
//   themselves (the auto-battler).
// - "naive" plants Scarecrows on the best plots and upgrades them, never specialising.
// - "balanced" follows the same simple plan with a weighted mix of damage dealers (splash included).
// - "best" is the better of competent and balanced: what the tuner and the level tests use.
// A level is tuned so the competent bot wins keeping 40-85% of its Goodwill (docs/design/hedgerow-v2.md 2).

import {
  ENEMIES,
  enemyPoint,
  hasTwist,
  isBig,
  isPlot,
  isProtected,
  megaFor,
  megasUnlocked,
  merge,
  mergeOptions,
  newGame,
  place,
  plotKind,
  sendWave,
  specCost,
  stepGame,
  towerAllowed,
  towerAt,
  towerCost,
  towerStats,
  upgrade,
  upgradeCost,
  type Game,
  type Level,
  type Tower,
  type TowerKind,
} from "./engine";

export type Skill = "competent" | "naive" | "balanced" | "best" | "idle";

interface Threat {
  total: number;
  flying: number;
  armoured: number;
  stealth: number;
  charm: number;
  jam: number;
  heal: number;
  split: number;
  shield: number;
  boss: boolean;
}

function threatOf(level: Level, from: number, n: number): Threat {
  const t: Threat = { total: 0, flying: 0, armoured: 0, stealth: 0, charm: 0, jam: 0, heal: 0, split: 0, shield: 0, boss: false };
  for (const groups of level.waves.slice(from, from + n)) {
    for (const g of groups) {
      const e = ENEMIES[g.enemy];
      const w = g.count * (e.hp / 100);
      t.total += w;
      if (e.flying) t.flying += w;
      if (e.armor || hasTwist(level, "armoured")) t.armoured += w;
      if (e.stealth) t.stealth += w;
      if (e.charm) t.charm += w;
      if (e.jam) t.jam += w;
      if (e.heal) t.heal += w;
      if (e.splits) t.split += w;
      if (e.shield) t.shield += w;
      if (isBig(g.enemy)) t.boss = true;
    }
  }
  if (hasTwist(level, "air")) t.flying += t.total * 0.25;
  return t;
}

/** Lane sample points, each weighted towards the farmhouse end (that's where a miss costs Goodwill). */
function laneSamples(game: Game): Array<{ x: number; y: number; w: number }> {
  const out: Array<{ x: number; y: number; w: number }> = [];
  const lanes: Array<[number, 1 | undefined]> = [[game.pathLength, undefined]];
  if (game.level.path2) lanes.push([game.pathLength2, 1]);
  for (const [len, lane] of lanes)
    for (let d = 0; d <= len; d += 0.5) {
      const p = enemyPoint(game.level, { dist: d, lane });
      out.push({ x: p.x, y: p.y, w: 0.6 + d / len });
    }
  return out;
}

function coverage(samples: ReturnType<typeof laneSamples>, col: number, row: number, range: number): number {
  let c = 0;
  for (const s of samples) if (Math.hypot(col + 0.5 - s.x, row + 0.5 - s.y) <= range) c += s.w;
  return c;
}

function canBuildAt(game: Game, kind: TowerKind, col: number, row: number): boolean {
  if (!isPlot(game.level, col, row) || towerAt(game, col, row) || isProtected(game.level, col, row)) return false;
  const ground = plotKind(game.level, col, row);
  return ground !== "water" || kind === "pond";
}

function bestPlot(game: Game, kind: TowerKind, samples: ReturnType<typeof laneSamples>): [number, number] | null {
  const st = towerStats({ kind, tier: 1, spec: null });
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (let r = 0; r < game.level.rows; r++)
    for (let c = 0; c < game.level.cols; c++) {
      if (!canBuildAt(game, kind, c, r)) continue;
      const high = plotKind(game.level, c, r) === "high" ? 1.25 : 1;
      let score: number;
      if (kind === "hall") score = -coverage(samples, c, r, 2); // anywhere: keep the good plots
      else if (st.buff > 1) {
        // Next to as many damage towers as possible.
        score = 0;
        for (const t of game.towers)
          if (towerStats(t).damage > 0 && Math.hypot(t.col - c, t.row - r) <= st.range) score += 10 + t.tier * 3;
        score += coverage(samples, c, r, 1.5) * 0.1;
      } else if (kind === "mast") {
        // Masts: reveal lane the other masts don't already see.
        const masts = game.towers.filter((t) => t.kind === "mast");
        score = 0;
        for (const s of samples) {
          if (Math.hypot(c + 0.5 - s.x, r + 0.5 - s.y) > st.range * high) continue;
          if (masts.some((m) => Math.hypot(m.col + 0.5 - s.x, m.row + 0.5 - s.y) <= towerStats(m).range)) continue;
          score += s.w;
        }
      } else score = coverage(samples, c, r, st.range * high);
      // Plan a megastructure: a plot beside a tower this one could merge with is worth a good deal more.
      if (score > 0 && megasUnlocked(game.level) && game.towers.some((t) => !t.mega && Math.abs(t.col - c) + Math.abs(t.row - r) === 1 && megaFor(kind, t.kind)))
        score *= 1.3;
      if (score > bestScore) {
        bestScore = score;
        best = [c, r];
      }
    }
  return best;
}

function count(game: Game, kind: TowerKind): number {
  return game.towers.filter((t) => t.kind === kind).length;
}

/** What the competent bot wants next: the kind with the biggest shortfall against its plan. */
function wanted(game: Game): TowerKind[] {
  const lv = game.level;
  const th = threatOf(lv, game.wave, 2);
  const all = threatOf(lv, 0, lv.waves.length);
  const ok = (k: TowerKind) => towerAllowed(lv, k);
  const dmgTowers = game.towers.filter((t) => towerStats(t).damage > 0).length;
  const n = game.towers.length;
  const want: Partial<Record<TowerKind, number>> = {};
  const set = (k: TowerKind, v: number) => {
    if (ok(k)) want[k] = Math.max(want[k] ?? 0, Math.ceil(v));
  };
  const air = th.total ? th.flying / th.total : 0;
  const armour = th.total ? th.armoured / th.total : 0;
  // Economy early, unless it's a rush.
  if (!hasTwist(lv, "rush") && game.wave < lv.waves.length - 3) set("stall", n >= 3 ? (n >= 10 ? 2 : 1) : 0);
  set("hedgerow", 1 + n / 6);
  if (ok("pond")) set("pond", n / 10);
  if (ok("barn")) set("barn", n / 8);
  if (th.stealth || all.stealth) set("mast", Math.min(4, 2 + Math.floor(n / 6)));
  else if (n > 7) set("mast", 1);
  if (th.charm) set("tent", 1 + n / 10);
  if (armour > 0.2) set("silo", 1 + dmgTowers * armour * 0.6);
  if (all.boss) set("court", game.wave >= lv.waves.length - 2 ? 1 : 0);
  if (n > 9) set("hall", 1);
  const wrapped = th.total ? th.shield / th.total : 0;
  if (th.split || th.total > 30 || hasTwist(lv, "crowd") || wrapped > 0.1)
    set("beehive", 1 + dmgTowers * (0.35 + wrapped * 0.5));
  if (ok("windmill")) set("windmill", 1 + n / 8);
  if (ok("cannon")) set("cannon", 1 + dmgTowers * (0.2 + wrapped * 0.4 + (th.total > 30 ? 0.15 : 0)));
  // Anti-air and the backbone: scarecrows (or bees when scarecrows are banned).
  const airKind: TowerKind = ok("scarecrow") ? "scarecrow" : "beehive";
  // Bubble wrap makes single-target shots weak: lean on splash when it's about.
  set(airKind, 2 + dmgTowers * Math.max(0.4 * (1 - wrapped), air));
  const order = Object.entries(want)
    .map(([k, v]) => [k as TowerKind, (v ?? 0) - count(game, k as TowerKind)] as const)
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1]);
  const out = order.map(([k]) => k);
  if (!out.includes(airKind) && ok(airKind)) out.push(airKind);
  return out;
}

function specFor(game: Game, t: Tower): 0 | 1 {
  const th = threatOf(game.level, game.wave, 3);
  const air = th.total ? th.flying / th.total : 0;
  switch (t.kind) {
    case "scarecrow":
      return air > 0.25 ? 1 : 0;
    case "hedgerow":
      return hasTwist(game.level, "drought") || th.total > 40 ? 0 : 1;
    case "silo":
      return th.split || hasTwist(game.level, "crowd") ? 1 : 0;
    case "tent":
      return 1;
    case "cannon":
      return th.total > 40 || hasTwist(game.level, "crowd") ? 1 : 0;
    default:
      return 0;
  }
}

function upgradeSomething(game: Game, samples: ReturnType<typeof laneSamples>, specs: boolean): boolean {
  const ranked = [...game.towers]
    .filter((t) => t.tier < (specs ? 4 : 3))
    .map((t) => {
      const st = towerStats(t);
      const value = (st.damage ? st.damage / st.cooldown : 8) * (1 + coverage(samples, t.col, t.row, st.range) / 20);
      return { t, value };
    })
    .sort((a, b) => b.value - a.value);
  for (const { t } of ranked) {
    if (t.tier < 3) {
      const c = upgradeCost(t)!;
      if (game.marks >= c && upgrade(game, t.id).ok) return true;
    } else if (specs) {
      const sp = specFor(game, t);
      if (game.marks >= specCost(t, sp)! && upgrade(game, t.id, sp).ok) return true;
    }
  }
  return false;
}

function spend(game: Game, skill: Skill, samples: ReturnType<typeof laneSamples>): void {
  for (let guard = 0; guard < 60; guard++) {
    if (skill === "naive" || skill === "balanced") {
      // Naive: nothing but Scarecrows. Balanced: the same simple plan, but a mix of damage dealers, taking
      // whichever kind it has fewest of (weighted), with splash for the bubble wrap.
      const mix: Array<[TowerKind, number]> = [
        ["scarecrow", 1],
        ["beehive", 1],
        ["windmill", 0.5],
        ["cannon", 0.7],
        ["pond", 0.4],
        ["hedgerow", 0.3],
      ];
      const pickBalanced = (): TowerKind => {
        let best: TowerKind = "hedgerow";
        let bestScore = Infinity;
        for (const [k, w] of mix) {
          if (!towerAllowed(game.level, k)) continue;
          const sc = count(game, k) / w;
          if (sc < bestScore) {
            bestScore = sc;
            best = k;
          }
        }
        return best;
      };
      const kind: TowerKind =
        skill === "balanced" ? pickBalanced() : towerAllowed(game.level, "scarecrow") ? "scarecrow" : "hedgerow";
      const spot = bestPlot(game, kind, samples);
      if (spot && game.marks >= towerCost(game, kind) && game.towers.length < 3 + game.wave) {
        if (place(game, kind, spot[0], spot[1]).ok) continue;
      }
      if (upgradeSomething(game, samples, false)) continue;
      if (spot && place(game, kind, spot[0], spot[1]).ok) continue;
      return;
    }
    // Competent: keep a balance between new towers and upgrades.
    const dmg = game.towers.filter((t) => towerStats(t).damage > 0);
    const avgTier = dmg.length ? dmg.reduce((a, t) => a + t.tier, 0) / dmg.length : 0;
    const preferUpgrade = dmg.length >= 4 + game.wave * 0.6 && avgTier < 3.6;
    if (mergeSomething(game)) continue;
    if (preferUpgrade && upgradeSomething(game, samples, true)) continue;
    let built = false;
    for (const kind of wanted(game)) {
      if (game.marks < towerCost(game, kind)) continue;
      const spot = bestPlot(game, kind, samples);
      if (spot && place(game, kind, spot[0], spot[1]).ok) {
        built = true;
        break;
      }
    }
    if (built) continue;
    if (upgradeSomething(game, samples, true)) continue;
    return;
  }
}

/** Merges any two grown neighbours that make a megastructure. */
function mergeSomething(game: Game): boolean {
  for (const t of game.towers) {
    const opt = mergeOptions(game, t.id)[0];
    if (opt && game.marks >= opt.cost && merge(game, t.id, opt.partner).ok) return true;
  }
  return false;
}

/** Plays a whole level and returns the finished game. "best" plays it both the competent and the balanced
 * way and returns the better result: the benchmark the tuner uses, so no simple strategy beats the curve
 * just because the benchmark played badly. */
export function playLevel(level: Level, skill: Skill): Game {
  if (skill === "best") {
    const a = playLevel(level, "competent");
    const b = playLevel(level, "balanced");
    return kept(b) > kept(a) ? b : a;
  }
  const game = newGame(level);
  const samples = laneSamples(game);
  let guard = 0;
  while (game.phase !== "won" && game.phase !== "lost" && guard++ < 400_000) {
    if (game.phase === "build") {
      if (skill !== "idle") spend(game, skill, samples);
      sendWave(game);
    } else if ((skill === "competent" || skill === "balanced") && game.tick % 90 === 0) {
      // Between spawns the competent bot keeps spending what the lane pays.
      spend(game, skill, samples);
    }
    stepGame(game);
  }
  return game;
}

/** Fraction of Goodwill kept (0 when lost). */
export function kept(game: Game): number {
  return game.phase === "won" ? game.goodwill / game.maxGoodwill : 0;
}
