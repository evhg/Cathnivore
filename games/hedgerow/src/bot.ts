// Hedgerow's level bots, shared by the tests and the difficulty tuner (scripts/hedgerow-tune.ts).
// - "competent" reads the next two waves and the level's twists and buys counters: something that hits air
//   when drones come, Silos for armour, a Radio Mast for stealth, a Clinic Tent for charm, Beehives for
//   crowds, hedges to slow, a Market Stall for income, the Courthouse for bosses; it places each where it
//   covers the most lane, upgrades, and picks specialisations to match. Cath holds her post; every bot but
//   "idle" casts her abilities itself, as a player pressing the buttons would (castAbilities in engine.ts).
// - "naive" plants Scarecrows on the best plots and upgrades them, never specialising.
// - "balanced" follows the same simple plan with a weighted mix of damage dealers (splash included).
// - "best" is the better of competent and balanced: what the tuner and the level tests use.
// A level is tuned so the competent bot wins keeping 40-85% of its Goodwill (docs/design/hedgerow-v2.md 2).

import {
  castAbilities,
  ENEMIES,
  enemyPoint,
  hasTwist,
  isBig,
  isFleet,
  isHeavy,
  isPlot,
  isProtected,
  megaFor,
  megasUnlocked,
  merge,
  mergeOptions,
  newGame,
  crownBlock,
  pathUpgradeCost,
  place,
  previewPath,
  previewStats,
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
import { P, RUNGS, fvOf } from "./fleet";
import { BUILD_PREFIX, PATHS, hasPaths, parseBuild, stepToward, type Path, type PathKind } from "./paths";

export type Skill = "competent" | "naive" | "balanced" | "best" | "idle";

interface Threat {
  total: number;
  flying: number;
  heavy: number;
  armoured: number;
  stealth: number;
  charm: number;
  jam: number;
  heal: number;
  split: number;
  shield: number;
  /** Fleet properties (Hedgerow 2 M3): Fleet Value carrying each lock. */
  plated: number;
  sealed: number;
  reefer: number;
  boss: boolean;
}

function threatOf(level: Level, from: number, n: number): Threat {
  const t: Threat = { total: 0, flying: 0, heavy: 0, armoured: 0, stealth: 0, charm: 0, jam: 0, heal: 0, split: 0, shield: 0, plated: 0, sealed: 0, reefer: 0, boss: false };
  const fleet = isFleet(level);
  for (const groups of level.waves.slice(from, from + n)) {
    for (const g of groups) {
      const e = ENEMIES[g.enemy];
      const pm = (g.pm ?? 0) | (fleet ? propsOfRung(g.enemy) : 0);
      // Fleet levels weigh a group by its Fleet Value (a van's 3 layers ~ a classic van's 98 health).
      const w = g.count * (fleet ? fvOf(g.enemy, pm) / 3 : e.hp / 100);
      t.total += w;
      if (e.flying) t.flying += w;
      else if (isHeavy(g.enemy)) t.heavy += w;
      if (fleet) {
        // The Fleet's locks: the Plated twist plates a third of the road traffic.
        if (pm & P.plated) t.plated += w;
        else if (hasTwist(level, "armoured") && !e.flying) t.plated += w / 3;
        if (pm & P.sealed) t.sealed += w;
        if (pm & P.reefer) t.reefer += w;
        if (pm & P.wrapped) t.shield += w;
        if (pm & P.stealth) t.stealth += w;
      } else if (e.armor || hasTwist(level, "armoured")) t.armoured += w;
      if (e.stealth) t.stealth += w;
      if (e.charm) t.charm += w;
      if (e.jam) t.jam += w;
      if (e.heal) t.heal += w;
      if (e.splits || RUNGS[g.enemy]?.children.length) t.split += w;
      if (e.shield) t.shield += w;
      if (isBig(g.enemy)) t.boss = true;
    }
  }
  if (hasTwist(level, "air")) t.flying += t.total * 0.25;
  return t;
}

/** A rung's own properties (an Artic is always Wrapped and Reefer; a Plated Lorry is Plated). */
function propsOfRung(kind: TowerKind | Level["waves"][number][number]["enemy"]): number {
  let pm = 0;
  for (const p of RUNGS[kind as keyof typeof RUNGS]?.props ?? []) pm |= P[p];
  return pm;
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
  const heavy = th.total ? th.heavy / th.total : 0;
  const fleetLv = isFleet(lv);
  // Economy early, unless it's a rush. On the Fleet a stall costs a field's worth of Marks: only once there is one.
  if (!hasTwist(lv, "rush") && game.wave < lv.waves.length - 3) set("stall", fleetLv ? (n >= 8 && game.wave < lv.waves.length - 6 ? 1 : 0) : n >= 3 ? (n >= 10 ? 2 : 1) : 0);
  // Fleet levels: a hedge does no popping, so it waits until there's a field for it to slow things into.
  set("hedgerow", fleetLv ? (n >= 4 ? 1 + n / 8 : 0) : 1 + n / 6);
  if (ok("pond")) set("pond", n / 10);
  if (ok("barn")) set("barn", n / 8);
  // Fleet: masts pop nothing, so they come when stealth is two rounds off, enough to cover the lane.
  if (fleetLv) {
    if (threatOf(lv, game.wave, 3).stealth) set("mast", Math.min(4, 1 + Math.floor(n / 6)));
  } else if (th.stealth || all.stealth) set("mast", Math.min(4, 2 + Math.floor(n / 6)));
  else if (n > 7) set("mast", 1);
  if (th.charm) set("tent", 1 + n / 10);
  // Heavy plant shrugs off turnips and stings: grain-shot and seed sacks are what move it.
  if (armour > 0.2 || heavy > 0.15) set("silo", 1 + dmgTowers * Math.max(armour * 0.6, heavy * 0.7));
  if (all.boss) set("court", game.wave >= lv.waves.length - 2 ? 1 : 0);
  if (n > 9) set("hall", 1);
  const fleet = isFleet(lv);
  // Fleet: wrap only stops blasts, so it no longer calls for splash; steel calls for anything but beaks.
  const wrapped = th.total && !fleet ? th.shield / th.total : 0;
  const plated = th.total ? th.plated / th.total : 0;
  const sealed = th.total ? th.sealed / th.total : 0;
  if (th.split || th.total > 30 || hasTwist(lv, "crowd") || wrapped > 0.1 || plated > 0.1)
    set("beehive", (1 + dmgTowers * (0.35 + wrapped * 0.5 + plated * 0.4)) * (1 - sealed * 0.7));
  if (ok("windmill")) set("windmill", 1 + n / 8 + dmgTowers * plated * 0.3);
  if (ok("cannon")) set("cannon", 1 + dmgTowers * (0.2 + wrapped * 0.4 + heavy * 0.3 + plated * 0.3 + (th.total > 30 ? 0.15 : 0)));
  // Anti-air and the backbone: scarecrows (or bees when scarecrows are banned).
  const airKind: TowerKind = ok("scarecrow") ? "scarecrow" : "beehive";
  // Bubble wrap makes single-target shots weak: lean on splash when it's about.
  set(airKind, 2 + dmgTowers * Math.max(0.4 * (1 - wrapped) * (1 - heavy) * (1 - plated * 0.6), air));
  const order = Object.entries(want)
    .map(([k, v]) => [k as TowerKind, (v ?? 0) - count(game, k as TowerKind)] as const)
    .filter(([, d]) => d > 0)
    .sort((a, b) => b[1] - a[1]);
  const out = order.map(([k]) => k);
  if (!out.includes(airKind) && ok(airKind)) out.push(airKind);
  // Fleet: with stealth on its way, nothing else pops what it can't see, so the masts come first.
  if (fleetLv && out.includes("mast")) return ["mast", ...out.filter((k) => k !== "mast")];
  return out;
}

function specFor(game: Game, t: Tower): 0 | 1 {
  const th = threatOf(game.level, game.wave, 3);
  const air = th.total ? th.flying / th.total : 0;
  switch (t.kind) {
    case "scarecrow":
      // Fleet: Pumpkin Lobber lobs pumpkins (Blast), the Scarecrow's answer to steel; Crow Caller pecks (Sharp).
      if (isFleet(game.level)) return th.plated > th.total * 0.15 || hasTwist(game.level, "armoured") ? 0 : air > 0.25 ? 1 : 0;
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

/**
 * Named builds (Hedgerow 2 M4): what a bot grows a path tower into, read from the next few rounds like
 * specFor. `crow-3-0-2` is a Scarecrow with Flock to 3 and Scythe to 2.
 */
export function buildFor(game: Game, t: Tower, smart = true): string {
  // The naive and balanced bots grow every tower the same plain way, with no detection on the way (a field
  // without a Mast still learns what stealth is).
  if (!smart) return SIMPLE_BUILDS[t.kind as PathKind];
  const th = threatOf(game.level, game.wave, 3);
  const air = th.total ? th.flying / th.total : 0;
  const plated = th.total ? th.plated / th.total : 0;
  const wrapped = th.total ? th.shield / th.total : 0;
  const stealth = th.stealth > 0;
  const mast = game.towers.some((o) => o.kind === "mast");
  const armour = plated > 0.15 || hasTwist(game.level, "armoured");
  switch (t.kind as PathKind) {
    case "scarecrow":
      // Steel: Hawk Post's Crush talons. Stealth with no mast: Lantern Eyes beside the crows.
      // (Flock first, so it pops in the meantime: BUILD_FIRST.)
      if (armour) return "crow-2-3-0";
      if (stealth && !mast) return "crow-3-2-0";
      return "crow-3-0-2";
    case "beehive":
      return th.split || th.total > 30 ? "bees-3-0-2" : "bees-2-0-3";
    case "cannon":
      // Bubble wrap cushions blasts: Scatter Shot's Sharp seeds. Air: Air Burst on the way.
      if (wrapped > 0.15) return "cannon-2-3-0";
      if (th.boss) return "cannon-0-2-3";
      return air > 0.15 ? "cannon-3-2-0" : "cannon-3-0-2";
    case "hedgerow":
      // The Maze slows; Blackthorn's piles add pops. In a drought slows are weak, so the piles lead.
      return hasTwist(game.level, "drought") ? "hedge-3-2-0" : "hedge-2-3-0";
    case "mast":
      return "mast-2-0-3";
    case "pond":
      return "pond-3-0-2";
    case "silo":
      return stealth && !mast ? "silo-3-2-0" : armour || th.boss ? "silo-3-0-2" : "silo-2-0-3";
  }
}

export const SIMPLE_BUILDS: Record<PathKind, string> = {
  scarecrow: "crow-3-0-2",
  hedgerow: "hedge-2-3-0",
  beehive: "bees-3-2-0",
  cannon: "cannon-3-2-0",
  mast: "mast-2-0-3",
  pond: "pond-3-0-2",
  silo: "silo-3-0-2",
};

/** Builds whose tier 2 path comes first (the bots' order is otherwise the main path to tier 2 first). */
const BUILD_FIRST: Record<string, 0 | 1 | 2> = { "crow-2-3-0": 0 };

/** The goal build for a path tower: its named build if the tower can still get there, else more of what it has. */
function goalPath(game: Game, t: Tower, t3: boolean, smart: boolean): Path {
  const cur = t.path!;
  const name = buildFor(game, t, smart);
  const named = parseBuild(name)!.path;
  // A build that wants its tier 2 path first: until that's done, that's the goal.
  const first = BUILD_FIRST[name];
  if (first !== undefined && cur[first] < named[first] && cur.every((n, i) => n <= named[i]!)) {
    const g: Path = [...cur] as Path;
    g[first] = named[first];
    return g;
  }
  let goal: Path = cur.every((n, i) => n <= named[i]!) ? named : ([0, 1, 2].map((i) => (cur[i]! > 0 ? Math.max(cur[i]!, named[i]!) : 0)) as Path);
  if (!t3) goal = goal.map((n) => Math.min(2, n)) as Path;
  return goal;
}

/** A path tower's next step towards its goal, and what it costs (null if none or not allowed here). */
function pathStep(game: Game, t: Tower, t3: boolean, smart: boolean): { i: 0 | 1 | 2; cost: number } | null {
  const i = stepToward(t.path!, goalPath(game, t, t3, smart));
  if (i === null) return null;
  const cost = pathUpgradeCost(game, t, i);
  return cost === null ? null : { i, cost };
}

/** The bots' build names, so logs and tests can say what a bot made ("crow-3-0-2"). */
export function buildOf(t: Tower): string | null {
  return t.path && hasPaths(t.kind) ? `${BUILD_PREFIX[t.kind]}-${t.path.join("-")}` : null;
}

function upgradeSomething(game: Game, samples: ReturnType<typeof laneSamples>, specs: boolean, smart = true): boolean {
  const ranked = [...game.towers]
    .filter((t) => (t.path ? pathStep(game, t, specs, smart) !== null : t.tier < (specs ? 4 : 3)))
    .map((t) => {
      const fleet = isFleet(game.level);
      // Fleet: a hit is layers times pierce; a tower that pops nothing (mast, hedge, stall) upgrades last.
      const worth = (st: ReturnType<typeof towerStats>) =>
        (st.damage ? ((st.damage * st.fan) / st.cooldown) * (fleet ? Math.sqrt(st.pierce) : 1) : fleet ? 0.3 : 8) * (1 + coverage(samples, t.col, t.row, st.range) / 20);
      const st = towerStats(t);
      let value = worth(st);
      // The competent bot on paths (M4): what the next step adds per Mark, so a cheap tier that doubles a
      // Scarecrow beats a dear one that adds a little to a Seed Cannon.
      if (smart && fleet && t.path) {
        const step = pathStep(game, t, specs, smart);
        const next = step ? previewPath(t, step.i) : null;
        if (step && next) value = (Math.max(0, worth(next) - value) + 0.05) / step.cost;
      } else if (smart && fleet) {
        const cost = t.tier < 3 ? upgradeCost(t) : specCost(t, specFor(game, t));
        const next = t.tier < 3 ? previewStats(t, { tier: (t.tier + 1) as 2 | 3, spec: null }) : previewStats(t, { tier: 4, spec: specFor(game, t) });
        value = cost ? (Math.max(0, worth(next) - value) + 0.05) / cost : 0;
      }
      return { t, value };
    })
    .sort((a, b) => b.value - a.value);
  for (const { t } of ranked) {
    if (t.path) {
      const st = pathStep(game, t, specs, smart);
      if (st && game.marks >= st.cost && upgrade(game, t.id, st.i).ok) return true;
    } else if (t.tier < 3) {
      const c = upgradeCost(t)!;
      if (game.marks >= c && upgrade(game, t.id).ok) return true;
    } else if (specs) {
      const sp = specFor(game, t);
      if (game.marks >= specCost(t, sp)! && upgrade(game, t.id, sp).ok) return true;
    }
  }
  // A finished tier 3 path takes its Crown (the competent and balanced bots, once tier 3 is allowed).
  if (specs && isFleet(game.level)) {
    for (const t of game.towers) {
      if (!t.path || t.crown !== undefined || !hasPaths(t.kind)) continue;
      for (const i of [0, 1, 2] as const) {
        if (t.path[i]! < 3 || crownBlock(game, t, i) !== null) continue;
        const cost = PATHS[t.kind].paths[i].crown!.cost;
        if (game.marks >= cost && upgrade(game, t.id, i).ok) return true;
      }
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
        ["silo", 0.6],
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
      // Fleet levels: three poppers before anything fancier (a field of one of everything pops nothing).
      const opening = isFleet(game.level) && game.towers.length < 3 && towerAllowed(game.level, "scarecrow");
      const kind: TowerKind =
        skill === "balanced" && !opening ? pickBalanced() : towerAllowed(game.level, "scarecrow") ? "scarecrow" : "hedgerow";
      const spot = bestPlot(game, kind, samples);
      if (spot && game.marks >= towerCost(game, kind) && game.towers.length < 3 + game.wave) {
        if (place(game, kind, spot[0], spot[1]).ok) continue;
      }
      if (upgradeSomething(game, samples, false, false)) continue;
      if (spot && place(game, kind, spot[0], spot[1]).ok) continue;
      return;
    }
    // Competent: keep a balance between new towers and upgrades.
    const dmg = game.towers.filter((t) => towerStats(t).damage > 0);
    const avgTier = dmg.length ? dmg.reduce((a, t) => a + t.tier, 0) / dmg.length : 0;
    // Fleet: a specialisation costs five towers' worth, so the field comes first and specs wait for eight poppers.
    const fleet = isFleet(game.level);
    const preferUpgrade = dmg.length >= (fleet ? 5 + game.wave * 0.5 : 4 + game.wave * 0.6) && avgTier < 3.6;
    const specsOk = !fleet || dmg.length >= 8;
    if (mergeSomething(game)) continue;
    if (preferUpgrade && !(fleet && wanted(game)[0] === "mast") && upgradeSomething(game, samples, specsOk)) continue;
    let built = false;
    const want = wanted(game);
    // Saving for a mast before stealth arrives: don't fritter the Marks on anything else.
    if (isFleet(game.level) && want[0] === "mast" && game.marks < towerCost(game, "mast")) return;
    for (const kind of want) {
      if (game.marks < towerCost(game, kind)) continue;
      const spot = bestPlot(game, kind, samples);
      if (spot && place(game, kind, spot[0], spot[1]).ok) {
        built = true;
        break;
      }
    }
    if (built) continue;
    if (upgradeSomething(game, samples, specsOk)) continue;
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
export function playLevel(level: Level, skill: Skill, watch?: (game: Game) => void): Game {
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
      watch?.(game);
      if (skill !== "idle") spend(game, skill, samples);
      sendWave(game);
    } else {
      // Abilities are manual (Hedgerow 2 M1): the bots press the buttons, twice a second.
      if (skill !== "idle" && game.tick % 15 === 0) castAbilities(game);
      // Between spawns the competent bot keeps spending what the lane pays.
      if ((skill === "competent" || skill === "balanced") && game.tick % 90 === 0) spend(game, skill, samples);
    }
    stepGame(game);
  }
  return game;
}

/** Fraction of Goodwill kept (0 when lost). */
export function kept(game: Game): number {
  return game.phase === "won" ? game.goodwill / game.maxGoodwill : 0;
}
