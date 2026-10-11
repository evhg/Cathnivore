// Hedgerow 2 M4: three upgrade paths, tiers 1-3, for the Scarecrow, Hedgerow, Beehive, Seed Cannon and Radio
// Mast (docs/design/hedgerow-2.md section 3). The crosspath rule, prices and refunds, what each tier 3 does,
// the legacy adapter for the other towers, named bot builds, and the save v3 migration from a v2 save.
import { describe, expect, it } from "vitest";
import {
  enemyPoint,
  isPlot,
  laneCellsOf,
  makeEnemy,
  newGame,
  pathUpgradeCost,
  place,
  previewPath,
  sell,
  sellValue,
  sendWave,
  stepGame,
  towerCost,
  towerStats,
  upgrade,
  upgradeToward,
  crownBlock,
  fireCrown,
  type Game,
  type Level,
  type Tower,
} from "../games/hedgerow/src/engine";
import { P } from "../games/hedgerow/src/fleet";
import { LEVELS } from "../games/hedgerow/src/levels";
import {
  PATHS,
  PATH_KINDS,
  T3_FIRST_LEVEL,
  buildName,
  legacyPath,
  nextPath,
  parseBuild,
  pathBlock,
  pathLegal,
  pathSpent,
  pathTier,
  specToPath,
  stepToward,
  type Path,
} from "../games/hedgerow/src/paths";
import { SIMPLE_BUILDS, buildFor, playLevel } from "../games/hedgerow/src/bot";
import { emptySave, parseSave, recordBuild } from "../games/hedgerow/src/store";

/** Level 30: fleet rules, tier 3 open, all five path towers unlocked, no twists. */
const L8 = LEVELS[29]!;

function plots(level: Level): Array<[number, number]> {
  const lane = laneCellsOf(level);
  const out: Array<[number, number]> = [];
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++)
      if (isPlot(level, c, r) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => lane.has(`${c + dx!},${r + dy!}`))) out.push([c, r]);
  return out;
}

/** The lane distance nearest a plot's centre. */
function nearestDist(g: Game, c: number, r: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let d = 0; d < g.pathLength; d += 0.05) {
    const q = enemyPoint(g.level, { dist: d });
    const dd = Math.hypot(q.x - (c + 0.5), q.y - (r + 0.5));
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

/** A rich fleet game on level 8 (tier 3 open) with a round in progress and nothing queued. */
function field(level: Level = L8): Game {
  const g = newGame(level);
  g.marks = 1e7;
  return g;
}

function live(g: Game): void {
  sendWave(g);
  g.spawnQueue = [];
}

/** A small deterministic random source. */
function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

describe("hedgerow paths: the crosspath rule", () => {
  it("exactly the builds with at most two paths, one past tier 2, are legal (all 64 checked)", () => {
    let legal = 0;
    for (let a = 0; a <= 3; a++)
      for (let b = 0; b <= 3; b++)
        for (let c = 0; c <= 3; c++) {
          const p = [a, b, c];
          const used = p.filter((n) => n > 0).length;
          const deep = p.filter((n) => n > 2).length;
          expect(pathLegal(p), buildName(p)).toBe(used <= 2 && deep <= 1);
          if (pathLegal(p)) legal++;
        }
    // 1 empty, 9 one-path, 3 x (9 - 1 both-deep) two-path = 34.
    expect(legal).toBe(1 + 9 + 3 * 8);
    expect(pathLegal([4, 0, 0])).toBe(false);
    expect(pathLegal([1, 1])).toBe(false);
  });

  it("random upgrade attempts never leave a tower on an illegal build, and succeed exactly when the rule allows (property)", () => {
    const rand = rng(7);
    const ps = plots(L8);
    for (let run = 0; run < 60; run++) {
      const g = field();
      const kind = PATH_KINDS[run % PATH_KINDS.length]!;
      // The next plot round the field this tower can stand on (a water plot takes only a Duck Pond).
      for (let k = 0; !g.towers.length && k < ps.length; k++) place(g, kind, ps[(run + k) % ps.length]![0], ps[(run + k) % ps.length]![1]);
      expect(g.towers).toHaveLength(1);
      const t = g.towers[0]!;
      for (let k = 0; k < 20; k++) {
        const i = Math.floor(rand() * 3) as 0 | 1 | 2;
        const before: Path = [...t.path!] as Path;
        const allowed = pathBlock(before, i, L8.id) === null;
        // A path at tier 3 buys its Crown instead (tested below): the build itself doesn't change.
        if (before[i]! >= 3) {
          upgrade(g, t.id, i);
          expect(t.path).toEqual(before);
          continue;
        }
        const ok = upgrade(g, t.id, i).ok;
        expect(ok, `${kind} ${buildName(before)} + ${i}`).toBe(allowed);
        expect(t.path).toEqual(ok ? nextPath(before, i) : before);
        expect(pathLegal(t.path!)).toBe(true);
        expect(t.tier).toBe(pathTier(t.path!));
      }
    }
  });

  it("names why a path is shut: two paths taken, one already past tier 2, the top, or tier 3 before level 6", () => {
    expect(pathBlock([1, 1, 0], 2, 8)).toMatch(/two paths/);
    expect(pathBlock([3, 2, 0], 1, 8)).toMatch(/one path goes past tier 2/);
    expect(pathBlock([3, 1, 0], 1, 8)).toBeNull();
    expect(pathBlock([3, 0, 0], 0, 8)).toMatch(/Top tier/);
    expect(pathBlock([2, 0, 0], 0, T3_FIRST_LEVEL - 1)).toMatch(/level 6/);
    expect(pathBlock([2, 0, 0], 0, T3_FIRST_LEVEL)).toBeNull();
    // On level 3 a tower buys tiers 1 and 2 but not 3.
    const g = newGame(LEVELS[2]!);
    g.marks = 1e6;
    const [c, r] = plots(LEVELS[2]!)[0]!;
    place(g, "scarecrow", c, r);
    const t = g.towers[0]!;
    expect(upgrade(g, t.id, 1).ok).toBe(true);
    expect(upgrade(g, t.id, 1).ok).toBe(true);
    expect(upgrade(g, t.id, 1).ok).toBe(false);
    expect(upgrade(g, t.id).ok).toBe(false);
  });
});

describe("hedgerow paths: prices and refunds", () => {
  it("each tier costs what the sheet says, the tower's spend adds up, and selling refunds 70% of it", () => {
    const ps = plots(L8);
    const rand = rng(3);
    for (const kind of PATH_KINDS) {
      const g = field();
      const [c, r] = ps[PATH_KINDS.indexOf(kind)]!;
      place(g, kind, c, r);
      const t = g.towers[0]!;
      const base = towerCost(g, kind);
      expect(t.spent).toBe(base);
      for (let k = 0; k < 12; k++) {
        const i = Math.floor(rand() * 3) as 0 | 1 | 2;
        if (t.path![i]! >= 3) continue; // a Crown is priced on its own (Crowns, below)
        const price = pathUpgradeCost(g, t, i);
        const m0 = g.marks;
        const ok = upgrade(g, t.id, i).ok;
        expect(ok).toBe(price !== null);
        if (ok) expect(m0 - g.marks).toBe(price);
      }
      expect(t.spent).toBe(base + pathSpent(kind, t.path!));
      // Tier 1 about half the base, tier 2 about the base, tier 3 a big save (3x to 6x).
      for (const path of PATHS[kind].paths) {
        expect(path.tiers[0].cost).toBeLessThan(path.tiers[1].cost);
        expect(path.tiers[2].cost).toBeGreaterThanOrEqual(3 * path.tiers[1].cost);
      }
      const m0 = g.marks;
      expect(sell(g, t.id).ok).toBe(true);
      expect(g.marks - m0).toBe(Math.floor(t.spent * 0.7));
      expect(sellValue(t)).toBe(Math.floor(t.spent * 0.7));
    }
  });

  it("a preview is exactly what the upgrade then gives, for every path of every path tower", () => {
    const ps = plots(L8);
    for (const kind of PATH_KINDS)
      for (const i of [0, 1, 2] as const) {
        const g = field();
        const [c, r] = ps[0]!;
        place(g, kind, c, r);
        const t = g.towers[0]!;
        for (let k = 0; k < 3; k++) {
          const want = previewPath(t, i)!;
          expect(upgrade(g, t.id, i).ok).toBe(true);
          expect(towerStats(t)).toEqual(want);
        }
        expect(previewPath(t, i)).toBeNull();
      }
  });
});

describe("hedgerow paths: tier 3s play differently", () => {
  /** Two Scarecrows side by side, different builds: how many layers each knocks off one dense round. */
  function duel(a: Path, b: Path): [number, number] {
    const g = field();
    const ps = plots(L8);
    const [[c1, r1], [c2, r2]] = [ps[4]!, ps[5]!];
    place(g, "scarecrow", c1, r1);
    place(g, "scarecrow", c2, r2);
    const [t1, t2] = g.towers as [Game["towers"][0], Game["towers"][0]];
    for (const [t, goal] of [[t1, a], [t2, b]] as const) while (upgradeToward(g, t.id, goal).ok);
    expect([t1.path, t2.path]).toEqual([a, b]);
    live(g);
    const d = nearestDist(g, c1, r1);
    for (let k = 0; k < 120; k++) g.enemies.push(makeEnemy(g, "van", Math.max(0, d - 2.5 + k * 0.04), undefined, 1));
    for (let s = 0; s < 30 * 8; s++) stepGame(g);
    return [t1.ko ?? 0, t2.ko ?? 0];
  }

  it("Crow Caller sends three crows to three targets; a Whirling Scythe sweeps all round it; their knockouts differ", () => {
    const g = field();
    const [c, r] = plots(L8)[4]!;
    place(g, "scarecrow", c, r);
    const t = g.towers[0]!;
    while (upgradeToward(g, t.id, [3, 0, 2]).ok);
    expect(towerStats(t).fan).toBe(3);
    live(g);
    const d = nearestDist(g, c, r);
    for (let k = 0; k < 9; k++) g.enemies.push(makeEnemy(g, "lorry", d - 1 + k * 0.25, undefined, 1));
    t.cd = 0;
    stepGame(g);
    const shots = g.events.filter((e) => e.type === "shot" && e.tower === t.id);
    expect(shots).toHaveLength(3);
    expect(new Set(shots.map((e) => (e.type === "shot" ? e.enemy : 0))).size).toBe(3);
    expect(shots.every((e) => e.type === "shot" && e.look === "crow")).toBe(true);
    // The Scythe: no aimed shots, a sweep event instead.
    const s = field();
    place(s, "scarecrow", c, r);
    const sc = s.towers[0]!;
    while (upgradeToward(s, sc.id, [2, 0, 3]).ok);
    expect(towerStats(sc).sweep).toBe(true);
    live(s);
    for (let k = 0; k < 9; k++) s.enemies.push(makeEnemy(s, "lorry", d - 1 + k * 0.25, undefined, 1));
    for (let k = 0; k < 20; k++) stepGame(s);
    expect(s.events.some((e) => e.type === "gust" && e.sweep)).toBe(true);
    expect(s.events.some((e) => e.type === "shot" && e.tower === sc.id)).toBe(false);
    const [flock, scythe] = duel([3, 0, 2], [2, 0, 3]);
    expect(flock).toBeGreaterThan(0);
    expect(scythe).toBeGreaterThan(0);
    expect(flock).not.toBe(scythe);
  });

  it("the Whirling Scythe answers rate and marking like a throw: its tiers, a Siren, Rally and Pirate Radio (M4 review)", () => {
    const ps = plots(L8);
    const [c, r] = ps[4]!;
    /** Sweeps and layers knocked off in 3 s by a 2-0-3 Scythe at (c, r) with parked Box Lorries in reach. */
    const spin = (extra?: { mast: Path; at: [number, number] }, rally = false): [number, number] => {
      const g = field();
      place(g, "scarecrow", c, r);
      const sc = g.towers[0]!;
      while (upgradeToward(g, sc.id, [2, 0, 3]).ok);
      if (extra) {
        expect(place(g, "mast", extra.at[0], extra.at[1]).ok).toBe(true);
        while (upgradeToward(g, g.towers[1]!.id, extra.mast).ok);
      }
      live(g);
      const d = nearestDist(g, c, r);
      for (let k = 0; k < 40; k++) {
        const e = makeEnemy(g, "lorry", d - 0.5 + (k % 8) * 0.12, undefined, 1);
        e.stun = 1e9;
        g.enemies.push(e);
      }
      if (rally) g.rallyLeft = 1e9;
      let sweeps = 0;
      const ko0 = sc.ko ?? 0;
      for (let k = 0; k < 90; k++) {
        stepGame(g);
        sweeps += g.events.filter((e) => e.type === "gust" && e.tower === sc.id).length;
        g.events.length = 0;
      }
      return [sweeps, (sc.ko ?? 0) - ko0];
    };
    // Quick Arms and Two Hands still count once the Scythe is bought: 0.6 s / (1.3 x 1.15), the 0.4 s it says;
    // a crosspath's Quick Crows (x1.3) spins it faster again.
    const every = (goal: Path) => {
      const g = field();
      place(g, "scarecrow", c, r);
      while (upgradeToward(g, g.towers[0]!.id, goal).ok);
      return towerStats(g.towers[0]!).gustEvery;
    };
    expect(every([0, 2, 3])).toBeCloseTo(0.4, 2);
    expect(every([2, 0, 3])).toBeCloseTo(0.4 / 1.3, 2);
    const [base, baseKo] = spin();
    expect(base).toBeGreaterThanOrEqual(7);
    // A Siren (towers in range fire 15% faster) and Rally spin it faster.
    const [siren] = spin({ mast: [0, 0, 2], at: ps[5]! });
    expect(siren).toBeGreaterThan(base);
    const [rallied] = spin(undefined, true);
    expect(rallied).toBeGreaterThan(base);
    // Pirate Radio's marking adds layers to every blade.
    const [, radioKo] = spin({ mast: [2, 0, 0], at: ps[5]! });
    expect(radioKo).toBeGreaterThan(baseKo);
  });

  it("Lantern Eyes and Scent see Stealth for themselves; the same tower without them doesn't", () => {
    for (const [kind, goal] of [
      ["scarecrow", [0, 2, 0]],
      ["beehive", [0, 0, 2]],
    ] as const) {
      const pops = (path: Path) => {
        const g = field();
        const [c, r] = plots(L8)[4]!;
        place(g, kind, c, r);
        const t = g.towers[0]!;
        while (upgradeToward(g, t.id, path).ok);
        live(g);
        const d = nearestDist(g, c, r);
        g.hero.hp = 0;
        g.hero.down = 999;
        for (let k = 0; k < 6; k++) g.enemies.push(makeEnemy(g, "van", d - 0.5 + k * 0.1, undefined, 1, P.stealth));
        for (let s = 0; s < 60; s++) stepGame(g);
        return t.ko ?? 0;
      };
      expect(pops(goal as unknown as Path), kind).toBeGreaterThan(0);
      expect(pops([2, 0, 0]), kind).toBe(0);
    }
  });

  it("Hawk Post reaches anywhere and its Crush talons crack Plated; Scatter Shot's Sharp seeds beat Wrapped", () => {
    const g = field();
    const [c, r] = plots(L8)[0]!;
    place(g, "scarecrow", c, r);
    const hawk = g.towers[0]!;
    while (upgradeToward(g, hawk.id, [0, 3, 2]).ok);
    const st = towerStats(hawk);
    expect(st.type).toBe("crush");
    expect(st.global).toBe(true);
    live(g);
    // A plated van at the far end of the lane, well out of any ordinary range.
    const far = makeEnemy(g, "van", g.pathLength - 0.5, undefined, 1, P.plated);
    g.enemies.push(far);
    hawk.cd = 0;
    stepGame(g);
    expect(hawk.ko ?? 0).toBeGreaterThan(0);
    const cannon = (goal: Path) => {
      const h = field();
      const [cc, rr] = plots(L8)[4]!;
      place(h, "cannon", cc, rr);
      const t = h.towers[0]!;
      while (upgradeToward(h, t.id, goal).ok);
      live(h);
      const d = nearestDist(h, cc, rr);
      for (let k = 0; k < 6; k++) h.enemies.push(makeEnemy(h, "van", d + k * 0.1, undefined, 1, P.wrapped));
      for (let s = 0; s < 120; s++) stepGame(h);
      return t.ko ?? 0;
    };
    expect(cannon([2, 3, 0])).toBeGreaterThan(0);
    expect(cannon([3, 2, 0])).toBe(0);
  });

  it("Blackthorn lays thorn piles that pop what crosses them; a Haybale holds vehicles still; Pirate Radio adds layers", () => {
    const g = field();
    const ps = plots(L8);
    const [c, r] = ps[4]!;
    place(g, "hedgerow", c, r);
    const hedge = g.towers[0]!;
    while (upgradeToward(g, hedge.id, [3, 0, 0]).ok);
    live(g);
    // A courier held at the start keeps the round open while the piles go down.
    const keeper = makeEnemy(g, "courier", 0, undefined, 1);
    keeper.stun = 1e9;
    g.enemies.push(keeper);
    for (let s = 0; s < 30 * 6; s++) stepGame(g);
    expect(g.piles.length).toBeGreaterThan(0);
    expect(g.piles.every((p) => p.hits === 20)).toBe(true);
    for (let k = 0; k < 10; k++) g.enemies.push(makeEnemy(g, "van", Math.max(0, g.piles[0]!.dist - 3 - k * 0.2), undefined, 1));
    for (let s = 0; s < 30 * 6; s++) stepGame(g);
    expect(hedge.ko ?? 0).toBeGreaterThan(5);

    const h = field();
    place(h, "hedgerow", c, r);
    const bale = h.towers[0]!;
    while (upgradeToward(h, bale.id, [0, 0, 2]).ok);
    live(h);
    const d = nearestDist(h, c, r);
    h.hero.hp = 0;
    h.hero.down = 999;
    for (let k = 0; k < 4; k++) h.enemies.push(makeEnemy(h, "courier", d + k * 0.1, undefined, 1));
    let held = false;
    for (let s = 0; s < 30 * 4; s++) {
      stepGame(h);
      if (h.events.some((e) => e.type === "bale")) held = true;
    }
    expect(held).toBe(true);

    // The same Scarecrow field knocks more layers off inside a Pirate Radio mast's range.
    const marked = (radio: boolean) => {
      const m = field();
      const [mc, mr] = ps[5]!;
      place(m, "scarecrow", c, r);
      place(m, "mast", mc, mr);
      const mast = m.towers[1]!;
      if (radio) while (upgradeToward(m, mast.id, [2, 0, 0]).ok);
      live(m);
      const dd = nearestDist(m, c, r);
      for (let k = 0; k < 40; k++) m.enemies.push(makeEnemy(m, "lorry", Math.max(0, dd - 2 + k * 0.05), undefined, 1));
      for (let s = 0; s < 30 * 6; s++) stepGame(m);
      return m.popped;
    };
    expect(marked(true)).toBeGreaterThan(marked(false));
  });

  it("the same build gives the same game, step for step", () => {
    const hash = (g: Game) => [g.tick, g.marks, g.goodwill, Math.round(g.popped * 1000), g.towers.map((t) => buildName(t.path ?? [t.tier, 0, 0])).join(",")].join(":");
    expect(hash(playLevel(LEVELS[11]!, "competent"))).toBe(hash(playLevel(LEVELS[11]!, "competent")));
  }, 60_000);
});

describe("hedgerow paths: the legacy adapter, named builds and save v3", () => {
  it("towers without paths show their tiers as path A, and old specs map to their nearest path", () => {
    expect(legacyPath(1, null)).toEqual([0, 0, 0]);
    expect(legacyPath(3, null)).toEqual([2, 0, 0]);
    expect(legacyPath(4, 1)).toEqual([3, 0, 0]);
    expect(specToPath("scarecrow", 4, 1)).toEqual([3, 0, 0]); // Crow Caller → Flock
    expect(specToPath("scarecrow", 4, 0)).toEqual([0, 0, 3]); // Pumpkin Lobber → Scythe
    expect(specToPath("mast", 4, 1)).toEqual([0, 0, 3]); // Emergency Siren → Siren
    expect(specToPath("beehive", 3, null)).toEqual([2, 0, 0]);
    // On a fleet level, a Windmill still grows by tiers and specialisations.
    const g = field();
    const [c, r] = plots(L8)[0]!;
    if (L8.towers.includes("windmill")) {
      place(g, "windmill", c, r);
      expect(g.towers[0]!.path).toBeUndefined();
      expect(upgrade(g, g.towers[0]!.id).ok).toBe(true);
      expect(g.towers[0]!.tier).toBe(2);
    }
    // Classic levels keep tiers for every tower.
    const classic = newGame(LEVELS[40]!);
    classic.marks = 1e6;
    const [cc, rr] = plots(LEVELS[40]!)[0]!;
    place(classic, "scarecrow", cc, rr);
    expect(classic.towers[0]!.path).toBeUndefined();
  });

  it("bots grow towers into named builds, and every named build is legal", () => {
    for (const name of Object.values(SIMPLE_BUILDS)) expect(parseBuild(name), name).not.toBeNull();
    expect(parseBuild("crow-3-3-0")).toBeNull();
    expect(parseBuild("crow-3-0-2")).toEqual({ kind: "scarecrow", path: [3, 0, 2] });
    expect(stepToward([0, 0, 0], [3, 0, 2])).toBe(0);
    expect(stepToward([2, 0, 0], [3, 0, 2])).toBe(2);
    expect(stepToward([2, 0, 2], [3, 0, 2])).toBe(0);
    expect(stepToward([3, 0, 2], [3, 0, 2])).toBeNull();
    const g = playLevel(LEVELS[11]!, "competent");
    const grown = g.towers.filter((t) => t.path && t.path.some((n) => n > 0));
    expect(grown.length).toBeGreaterThan(3);
    for (const t of grown) {
      expect(pathLegal(t.path!)).toBe(true);
      expect(parseBuild(buildFor(g, t))).not.toBeNull();
    }
  }, 60_000);

  it("a v2 save loads as v3 with everything kept; builds round-trip, an illegal one is dropped, an old spec maps to a path", () => {
    // A save written by the M3 build (version 2): stars, stories, tips, the Seed Bank, settings, casts.
    const v2 = {
      version: 2,
      stars: { "1": 3, "2": 2, "12": 1 },
      seenBefore: { "1": true, "2": true },
      seen: { van: true, lorry: true },
      tips: { spec: true, upgrade: true },
      bank: { pockets: 1 },
      rosettes: { first: true },
      settings: { keepGoing: false },
      casts: { pie: 4 },
      autoCast: { pie: true },
      outfit: "apron",
    };
    const d = parseSave(JSON.stringify(v2));
    expect(d.version).toBe(3);
    expect(d.stars).toEqual(v2.stars);
    expect(d.seenBefore).toEqual(v2.seenBefore);
    expect(d.seen).toEqual(v2.seen);
    expect(d.tips).toEqual(v2.tips);
    expect(d.bank).toEqual(v2.bank);
    expect(d.rosettes).toEqual(v2.rosettes);
    expect(d.settings).toEqual(v2.settings);
    expect(d.casts).toEqual(v2.casts);
    expect(d.autoCast).toEqual(v2.autoCast);
    expect(d.outfit).toBe("apron");
    expect(d.builds).toBeUndefined();
    // v3: builds kept; illegal ones and junk dropped; a { tier, spec } entry maps to its nearest path.
    const v3 = parseSave(
      JSON.stringify({ ...v2, version: 3, builds: { scarecrow: [3, 0, 2], beehive: [3, 3, 0], cannon: "x", mast: { tier: 4, spec: 1 }, hedgerow: [0, 0, 0] } }),
    );
    expect(v3.builds).toEqual({ scarecrow: [3, 0, 2], mast: [0, 0, 3] });
    const e = emptySave();
    recordBuild(e, "cannon", [2, 3, 0]);
    recordBuild(e, "beehive", [3, 3, 0]);
    expect(parseSave(JSON.stringify(e)).builds).toEqual({ cannon: [2, 3, 0] });
  });
});

describe("hedgerow paths: Crowns (M5)", () => {
  it("a Crown is bought on a path at tier 3, once per field, and changes the stats", () => {
    const g = field();
    const ps = plots(L8);
    expect(place(g, "scarecrow", ps[0]![0], ps[0]![1]).ok).toBe(true);
    expect(place(g, "scarecrow", ps[1]![0], ps[1]![1]).ok).toBe(true);
    const [a, b] = g.towers as [Tower, Tower];
    expect(upgrade(g, a.id, 0).ok).toBe(true);
    // Not yet at tier 3: no Crown.
    expect(crownBlock(g, a, 0)).toMatch(/tier 3/);
    for (let k = 0; k < 2; k++) expect(upgrade(g, a.id, 0).ok).toBe(true);
    expect(a.path).toEqual([3, 0, 0]);
    expect(crownBlock(g, a, 0)).toBeNull();
    const before = towerStats(a).fan;
    expect(upgrade(g, a.id, 0).ok).toBe(true);
    expect(a.crown).toBe(0);
    expect(a.path).toEqual([3, 0, 0]);
    expect(towerStats(a).fan).toBe(12);
    expect(before).toBe(3);
    expect(g.events.some((ev) => ev.type === "crown")).toBe(true);
    // The same Crown can't be worn twice.
    for (let k = 0; k < 3; k++) upgrade(g, b.id, 0);
    expect(b.path).toEqual([3, 0, 0]);
    expect(crownBlock(g, b, 0)).toMatch(/Only one Murder of Crows/);
    expect(upgrade(g, b.id, 0).ok).toBe(false);
    // A tower with a Crown doesn't take a second.
    expect(upgrade(g, a.id, 0).ok).toBe(false);
  });
  it("Crowns cost 100 times a base tier 2-ish and the Falconer hits Plants three times as hard", () => {
    for (const p of PATHS.scarecrow.paths) expect(p.crown!.cost).toBeGreaterThanOrEqual(20000);
    expect(PATHS.scarecrow.paths[1].crown!.mod.shellMul).toBe(3);
  });
  it("Crown abilities: Blackout Sky triples fire rate and cools down, Stoop breaks a Plant's shell, Stand Up reaches neighbours", () => {
    const g = field();
    const ps = plots(L8);
    for (let k = 0; k < 3; k++) place(g, "scarecrow", ps[k]![0], ps[k]![1]);
    const [a, b, c] = g.towers as [Tower, Tower, Tower];
    // Crown all three on different paths (Crowns are unique per path).
    for (const [t, i] of [[a, 0], [b, 1], [c, 2]] as const) for (let k = 0; k < 4; k++) expect(upgrade(g, t.id, i).ok).toBe(true);
    expect([a.crown, b.crown, c.crown]).toEqual([0, 1, 2]);
    expect(fireCrown(g, a.id).ok).toBe(false); // not in a round
    live(g);
    expect(fireCrown(g, a.id).ok).toBe(true);
    expect(a.surge).toBe(8);
    expect(a.crownCd).toBe(45);
    expect(fireCrown(g, a.id).ok).toBe(false);
    // Stoop needs a Plant.
    expect(fireCrown(g, b.id).ok).toBe(false);
    const dozer = makeEnemy(g, "plantdozer", 3, undefined, 1);
    g.enemies.push(dozer);
    expect(fireCrown(g, b.id).ok).toBe(true);
    expect(dozer.kind).toBe("steel");
    // Stand Up lights up Scarecrows within 3 cells, once; and the surge runs out.
    expect(fireCrown(g, c.id).ok).toBe(true);
    expect(c.surge).toBe(8);
    for (let k = 0; k < 8 * 30 + 2; k++) stepGame(g);
    expect(a.surge).toBeLessThan(8);
    expect(a.crownCd).toBeGreaterThan(0);
  });
});
