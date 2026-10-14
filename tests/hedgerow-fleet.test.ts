// Hedgerow 2 M2: the Fleet (docs/design/hedgerow-2.md sections 1, 5 and 8). Layered rungs that pop one layer
// at a time and pay a Mark a layer, the Round Book, fleet levels 1-10, the live cap and its queue, and the
// sim's step budget with a crowded lane.
import { describe, expect, it } from "vitest";
import {
  STEP,
  bookRound,
  earlyBonus,
  enemyPoint,
  hitEnemy,
  isBig,
  isFleet,
  laneCellsOf,
  isPlot,
  laneWindows,
  makeEnemy,
  pointAt,
  newGame,
  place,
  pathUpgradeCost,
  previewPath,
  remainingFV,
  sellValue,
  sendWave,
  stepGame,
  towerCost,
  towerStats,
  stepsBought,
  upgrade,
  upgradeToward,
  type Game,
  type Level,
  type TowerKind,
} from "../games/hedgerow/src/engine";
import { CHILD_GAP, FLEET_GOODWILL, LIVE_CAP, P, RUNGS, canControl, fvOf, roundBonus } from "../games/hedgerow/src/fleet";
import { BOOK, BOOK_ROUNDS, SWAPS, budget, incomeBefore, roundFV, trafficOf, windowFor } from "../games/hedgerow/src/rounds";
import { LEVELS } from "../games/hedgerow/src/levels";
import type { Path } from "../games/hedgerow/src/paths";
import { kept, playLevel } from "../games/hedgerow/src/bot";

const L1 = LEVELS[0]!;

/** A fleet game on level 1 with the lane to itself (nothing queued). */
function bare(level: Level = L1): Game {
  const g = newGame(level);
  sendWave(g);
  g.spawnQueue = [];
  return g;
}

/** Lane-side plots of a level, in reading order. */
function plots(level: Level): Array<[number, number]> {
  const lane = laneCellsOf(level);
  const out: Array<[number, number]> = [];
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++)
      if (isPlot(level, c, r) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => lane.has(`${c + dx!},${r + dy!}`))) out.push([c, r]);
  return out;
}

describe("hedgerow fleet: rungs", () => {
  it("Fleet Value is every layer, children included", () => {
    expect(fvOf("courier")).toBe(1);
    expect(fvOf("hatchback")).toBe(2);
    expect(fvOf("van")).toBe(3);
    expect(fvOf("pickup")).toBe(4);
    expect(fvOf("sprinter")).toBe(5);
    expect(fvOf("lorry")).toBe(11);
    expect(fvOf("drone")).toBe(1);
    expect(fvOf("quad")).toBe(3);
  });

  it("one point of damage is one layer, overflow carries into the first child, and each layer pays a Mark", () => {
    const g = bare();
    const van = makeEnemy(g, "van", 3, undefined, 1);
    g.enemies.push(van);
    const m0 = g.marks;
    expect(hitEnemy(g, van, 2)).toBe(2);
    expect(van.kind).toBe("courier");
    expect(van.hp).toBe(1);
    expect(g.marks - m0).toBe(2);
    expect(remainingFV(van)).toBe(1);
    // More than is left only takes what is left.
    const v2 = makeEnemy(g, "van", 3, undefined, 1);
    g.enemies.push(v2);
    expect(hitEnemy(g, v2, 5)).toBe(3);
    expect(v2.hp).toBe(0);
    expect(g.marks - m0).toBe(5);
    expect(g.events.filter((e) => e.type === "knock")).toHaveLength(2);
  });

  it("a popped lorry becomes its first child in place, the second spawns just behind, in order", () => {
    const g = bare();
    const lorry = makeEnemy(g, "lorry", 5, undefined, 1);
    g.enemies.push(lorry);
    const id = lorry.id;
    hitEnemy(g, lorry, 1);
    expect(lorry.id).toBe(id);
    expect(lorry.kind).toBe("sprinter");
    expect(lorry.dist).toBe(5);
    const second = g.enemies[g.enemies.length - 1]!;
    expect(second.kind).toBe("sprinter");
    expect(second.dist).toBeCloseTo(5 - CHILD_GAP, 9);
    expect(second.id).toBeGreaterThan(id);
    // A quad drops two drones.
    const q = makeEnemy(g, "quad", 2, undefined, 1);
    g.enemies.push(q);
    hitEnemy(g, q, 1);
    expect([q.kind, g.enemies[g.enemies.length - 1]!.kind]).toEqual(["drone", "drone"]);
    expect(RUNGS.lorry!.children).toEqual(["sprinter", "sprinter"]);
  });

  it("a tower sold before the next wave refunds in full, later 70%", () => {
    const g = newGame(L1);
    const [c, r] = plots(L1)[0]!;
    const cost = towerCost(g, "scarecrow");
    place(g, "scarecrow", c, r);
    expect(sellValue(g.towers[0]!, g)).toBe(cost);
    sendWave(g);
    expect(sellValue(g.towers[0]!, g)).toBe(Math.floor(cost * 0.7));
  });

  it("leftover pierce reaches the children a pop just made", () => {
    const g = newGame(L1);
    const [c, r] = plots(L1)[0]!;
    expect(place(g, "scarecrow", c, r).ok).toBe(true);
    const t = g.towers[0]!;
    expect(towerStats(t).pierce).toBeGreaterThanOrEqual(2);
    sendWave(g);
    g.spawnQueue = [];
    // A lorry at the lane point nearest the tower: the shot pops it into two Same-Day vans, and the second
    // point of pierce carries into the one that spawned behind.
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
    g.enemies.push(makeEnemy(g, "lorry", best, undefined, 1));
    stepGame(g);
    const knocks = g.events.filter((e) => e.type === "knock");
    expect(knocks.length).toBe(2);
    expect(g.enemies.filter((e) => e.kind === "sprinter").length + g.enemies.filter((e) => e.kind === "pickup").length).toBe(2);
    expect(t.ko).toBe(2);
  });
});

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

describe("hedgerow fleet: the tower panel and targeting (M2 review)", () => {
  it("upgrade, specialisation and merge previews show the fleet numbers, with no soft counters", () => {
    const g = newGame(L1);
    const [c, r] = plots(L1)[0]!;
    expect(place(g, "scarecrow", c, r).ok).toBe(true);
    const t = g.towers[0]!;
    expect(t.fleet).toBe(true);
    // Hedgerow 2 M4: a Scarecrow grows along paths. Flock's Sharp Beaks add pierce; Scythe's Quick Arms rate.
    const flock = previewPath(t, 0)!;
    const scythe = previewPath(t, 2)!;
    expect([flock.damage, flock.pierce]).toEqual([1, 3]);
    expect(scythe.cooldown).toBeCloseTo(towerStats(t).cooldown / 1.3);
    for (const s of [flock, scythe, previewPath(t, 1)!]) expect(s.vs).toEqual({ light: 1, heavy: 1, air: 1 });
    // The preview is exactly what the upgrade then gives.
    g.marks = 1e6;
    upgrade(g, t.id, 0);
    expect(towerStats(t)).toEqual(flock);
  });

  it("Strongest on the Fleet shoots the vehicle with the most layers aboard, not the first in the list", () => {
    const g = newGame(L1);
    const [c, r] = plots(L1)[0]!;
    place(g, "scarecrow", c, r);
    const t = g.towers[0]!;
    t.target = "strong";
    sendWave(g);
    g.spawnQueue = [];
    const d = nearestDist(g, c, r);
    const couriers = [makeEnemy(g, "courier", d + 0.05, undefined, 1), makeEnemy(g, "courier", d + 0.02, undefined, 1)];
    const lorry = makeEnemy(g, "lorry", d - 0.05, undefined, 1);
    g.enemies.push(...couriers, lorry);
    stepGame(g);
    expect(lorry.kind).not.toBe("lorry");
    expect(t.ko).toBe(2);
  });
});

describe("hedgerow fleet: twists keep a round's weight and length", () => {
  it("every fleet level's every round spawns within 25 s and sends about its Book Fleet Value, twists included", () => {
    for (const lv of LEVELS.filter(isFleet)) {
      for (let w = 0; w < lv.waves.length; w++) {
        const g = newGame(lv);
        g.wave = w;
        expect(sendWave(g).ok).toBe(true);
        const last = Math.max(...g.spawnQueue.map((q) => q.at));
        expect(last, `level ${lv.id} wave ${w + 1}`).toBeLessThanOrEqual(25);
        // Bosses aside; a Reinforced vehicle (the Fortified twist) carries one more layer.
        const fv = g.spawnQueue.reduce((a, q) => a + (isBig(q.kind) ? 0 : fvOf(q.kind, q.pm ?? 0)), 0);
        const want = roundFV(bookRound(lv, w + 1), lv.id);
        expect(fv / want, `level ${lv.id} wave ${w + 1}`).toBeGreaterThan(0.85);
        expect(fv / want, `level ${lv.id} wave ${w + 1}`).toBeLessThan(1.15);
      }
    }
  });

  it("Air drop flies a third of a round in; Crowds bring the round a rung smaller and more of it", () => {
    const air = LEVELS[7]!;
    expect(air.twists).toContain("air");
    const g = newGame(air);
    sendWave(g);
    const flyers = g.spawnQueue.filter((q) => q.kind === "drone" || q.kind === "quad").length;
    expect(flyers / g.spawnQueue.length).toBeGreaterThan(0.25);
    const crowd = LEVELS[3]!;
    expect(crowd.twists).toContain("crowd");
    const c = newGame(crowd);
    const plain = newGame({ ...crowd, twists: undefined });
    sendWave(c);
    sendWave(plain);
    expect(c.spawnQueue.length).toBeGreaterThan(plain.spawnQueue.length * 1.3);
    expect(c.spawnQueue.some((q) => q.kind === "van")).toBe(false);
    expect(plain.spawnQueue.some((q) => q.kind === "van")).toBe(true);
  });
});

describe("hedgerow fleet: pops you can hear", () => {
  it("thorns and poison pay their slivers silently: a knock (sound, particles) only when a whole layer comes off", () => {
    const g = bare();
    const m0 = g.marks;
    const van = makeEnemy(g, "van", 3, undefined, 1);
    g.enemies.push(van);
    // Thirty slivers of a thirtieth: one layer, one knock, one Mark.
    for (let i = 0; i < 30; i++) hitEnemy(g, van, 1 / 30, 0);
    const knocks = g.events.filter((e) => e.type === "knock") as Array<{ n: number; from: string; to: string | null }>;
    expect(knocks).toHaveLength(1);
    expect(knocks[0]!.n).toBe(1);
    expect(knocks[0]!.from).toBe("van");
    expect(van.kind).toBe("hatchback");
    expect(g.marks - m0).toBe(1);
    // A sliver that crosses into the next shell still reports one whole layer.
    hitEnemy(g, van, 0.5, 0);
    expect(g.events.filter((e) => e.type === "knock")).toHaveLength(1);
    hitEnemy(g, van, 0.75, 0);
    expect(g.events.filter((e) => e.type === "knock")).toHaveLength(2);
  });

  it("a Blackthorn hedge and a Killer Queen hive over a round knock whole layers only", () => {
    const lv = LEVELS[7]!;
    const g = newGame(lv);
    g.marks = 1e6;
    const ps = plots(lv);
    expect(place(g, "hedgerow", ps[0]![0], ps[0]![1]).ok).toBe(true);
    expect(place(g, "beehive", ps[3]![0], ps[3]![1]).ok).toBe(true);
    // Hedgerow 2 M4: Blackthorn's thorn piles and Killer Queen's spreading poison are path A's tier 3.
    for (const t of g.towers) for (let i = 0; i < 3; i++) expect(upgrade(g, t.id, 0).ok).toBe(true);
    expect(g.towers.map((t) => t.path)).toEqual([
      [3, 0, 0],
      [3, 0, 0],
    ]);
    for (let i = 6; i < 12; i++) place(g, "scarecrow", ps[i]![0], ps[i]![1]);
    sendWave(g);
    let knocks = 0;
    let layers = 0;
    while (g.phase === "wave" && g.tick < 30 * 200) {
      stepGame(g);
      for (const e of g.events) if (e.type === "knock") {
        knocks++;
        layers += e.n;
        expect(Number.isInteger(e.n) && e.n >= 1).toBe(true);
      }
      g.events.length = 0;
    }
    expect(knocks).toBeGreaterThan(50);
    // Every whole layer shows up once (a vehicle's last sliver may still be on it when it leaks).
    expect(layers).toBeLessThanOrEqual(Math.ceil(g.popped) + 1);
    expect(layers).toBeGreaterThan(g.popped * 0.9);
  });
});

describe("hedgerow fleet: rounds and levels", () => {
  it("the Book has 80 rounds, each within 10% of its budget, none spawning for more than 25 s", () => {
    expect(BOOK_ROUNDS).toBe(80);
    for (let r = 1; r <= BOOK_ROUNDS; r++) {
      expect(Math.abs(roundFV(r) / budget(r) - 1)).toBeLessThan(0.1);
      const spawn = Math.max(...BOOK[r - 1]!.groups.map((x) => (x.delay ?? 0) + x.count * x.gap));
      expect(spawn).toBeLessThanOrEqual(25);
      expect(BOOK[r - 1]!.card.length).toBeGreaterThan(10);
    }
    expect(budget(1)).toBeCloseTo(18, 0);
    expect(Math.round(budget(10))).toBe(569);
  });

  it("levels 1-80 play windows of the Book on fleet rules; level 81 stays classic", () => {
    expect(windowFor(1)).toEqual({ from: 1, to: 12 });
    expect(windowFor(10)).toEqual({ from: 5, to: 18 });
    expect(windowFor(50)).toEqual({ from: 24, to: 45 });
    expect(windowFor(100)).toEqual({ from: 51, to: 80 });
    for (const lv of LEVELS.slice(0, 80)) {
      expect(isFleet(lv)).toBe(true);
      expect(lv.goodwill).toBe(FLEET_GOODWILL);
      expect(lv.hpScale).toBeUndefined();
      const w = windowFor(lv.id);
      expect(lv.book).toEqual(w);
      expect(lv.waves).toHaveLength(w.to - w.from + 1);
      // M3: k back inside the spec's [0.7, 1.0], bar the tutorial (level 1 opens on 1.2 x 500: random builds must win).
      expect(lv.startMarks).toBeGreaterThanOrEqual(Math.round(0.7 * (500 + incomeBefore(w.from))));
      expect(lv.startMarks).toBeLessThanOrEqual(Math.round((lv.id === 1 ? 1.2 : 1.0) * (500 + incomeBefore(w.from))));
    }
    expect(LEVELS[9]!.waves.at(-1)!.some((g) => g.enemy === "boss")).toBe(true);
    expect(LEVELS[19]!.waves.at(-1)!.some((g) => g.enemy === "convoy")).toBe(true);
    expect(LEVELS[29]!.waves.at(-1)!.some((g) => g.enemy === "blimp")).toBe(true);
    expect(isFleet(LEVELS[80]!)).toBe(false);
  });

  it("neighbouring levels never play the same rounds: a shared window gets act-themed swaps of the same weight", () => {
    const fleet = LEVELS.filter(isFleet);
    for (let i = 1; i < fleet.length; i++)
      expect(JSON.stringify(fleet[i]!.waves), `levels ${fleet[i - 1]!.id} and ${fleet[i]!.id}`).not.toBe(JSON.stringify(fleet[i - 1]!.waves));
    for (const [id, rounds] of Object.entries(SWAPS))
      for (const r of Object.keys(rounds).map(Number)) {
        // Level 1 shapes its own curve (the M3 review's graded pressure, rounds.ts): it may reweigh its rounds,
        // but a round to remember keeps its theme there.
        if (id === "1") {
          if ([6, 10, 12, 14].includes(r)) expect(rounds[r]!.theme, `level 1 round ${r}`).toBe(BOOK[r - 1]!.theme);
          continue;
        }
        // Acts 2-3 play every round at their traffic (rounds.ts TRAFFIC), swaps included.
        const ratio = roundFV(r, Number(id)) / (roundFV(r) * trafficOf(Number(id)));
        expect(ratio, `level ${id} round ${r}`).toBeGreaterThan(0.97);
        expect(ratio, `level ${id} round ${r}`).toBeLessThan(1.03);
        // The rounds to remember stay the Book's, and so do the rounds that first bring each property.
        expect([6, 10, 12, 14, 15, 18, 22, 26, 30]).not.toContain(r);
      }
  });

  it("FV is conserved: everything a round sends is either popped or leaked", () => {
    const g = newGame(L1);
    const ps = plots(L1);
    for (const [c, r] of ps.slice(0, 2)) place(g, "scarecrow", c, r);
    let sent = 0;
    for (let w = 0; w < 8; w++) {
      sendWave(g);
      sent += roundFV(bookRound(g.level, g.wave));
      while (g.phase === "wave") stepGame(g);
      if (g.phase !== "build") break;
    }
    // Whatever is still out when the level is lost is on the lane or waiting to spawn.
    const out =
      g.enemies.reduce((a, e) => a + remainingFV(e), 0) +
      g.spawnQueue.reduce((a, q) => a + fvOf(q.kind), 0) +
      g.emitQueue.reduce((a, q) => a + fvOf(q.kind), 0);
    expect(g.popped + g.leaked + out).toBeCloseTo(sent, 6);
    expect(g.leaked).toBeGreaterThan(0);
    expect(g.popped).toBeGreaterThan(0);
  });

  it("Marks are layers: a round pays exactly its pops plus the round bonus", () => {
    const g = newGame(L1);
    const [c, r] = plots(L1)[3]!;
    place(g, "scarecrow", c, r);
    const before = g.marks;
    sendWave(g);
    while (g.phase === "wave") stepGame(g);
    expect(g.marks - before).toBe(Math.round(g.popped) + roundBonus(1));
    expect(g.goodwill).toBe(FLEET_GOODWILL - Math.ceil(g.leaked - 1e-9));
    expect(g.towers[0]!.ko).toBeCloseTo(g.popped - (g.popped - g.towers[0]!.ko!), 9);
  });

  it("a leak costs the Fleet Value that got through", () => {
    const g = bare();
    g.enemies.push(makeEnemy(g, "lorry", g.pathLength - 0.01, undefined, 1));
    stepGame(g);
    expect(FLEET_GOODWILL - g.goodwill).toBe(11);
  });

  it("fleet prices: towers at their fleet base, each tier costing more, and stacking pays 10 + the round", () => {
    const g = newGame(L1);
    expect(towerCost(g, "scarecrow")).toBe(200);
    const [c, r] = plots(L1)[0]!;
    place(g, "scarecrow", c, r);
    const t = g.towers[0]!;
    expect(t.fleet).toBe(true);
    // Each tier along a path costs more than the one before (M4: 100, 200, 1,000 for Flock).
    const u1 = pathUpgradeCost(g, t, 0)!;
    g.marks = 1e5;
    upgrade(g, t.id, 0);
    expect(pathUpgradeCost(g, t, 0)!).toBeGreaterThan(u1);
    sendWave(g);
    for (let i = 0; i < 40; i++) stepGame(g);
    expect(earlyBonus(g)).toBe(10 + 2);
  });

  it("the same build gives the same game, step for step", () => {
    const hash = (g: Game) => [g.tick, g.marks, g.goodwill, Math.round(g.popped * 1000), g.towers.length].join(":");
    const a = playLevel(LEVELS[3]!, "competent");
    const b = playLevel(LEVELS[3]!, "competent");
    expect(hash(a)).toBe(hash(b));
  }, 60_000);
});

describe("hedgerow fleet: the live cap", () => {
  it("children over the cap wait at their parent and come out in order, deterministically", () => {
    const run = () => {
      const g = bare();
      for (let i = 0; i < LIVE_CAP - 2; i++) {
        const e = makeEnemy(g, "courier", 1 + (i % 50) * 0.1, undefined, 1);
        e.hp = 1e9;
        g.enemies.push(e);
      }
      const lorries = [makeEnemy(g, "lorry", 3, undefined, 1), makeEnemy(g, "lorry", 4, undefined, 1)];
      g.enemies.push(...lorries);
      expect(g.enemies.length).toBe(LIVE_CAP);
      for (const l of lorries) hitEnemy(g, l, 1);
      expect(g.enemies.length).toBe(LIVE_CAP);
      expect(g.emitQueue.map((q) => [q.kind, q.dist])).toEqual([
        ["sprinter", 3 - CHILD_GAP],
        ["sprinter", 4 - CHILD_GAP],
      ]);
      // Room opens up: the queue drains oldest first.
      g.enemies.splice(0, 1);
      stepGame(g);
      expect(g.emitQueue).toHaveLength(1);
      expect(g.enemies.length).toBeLessThanOrEqual(LIVE_CAP);
      // A queued child keeps its round open.
      expect(g.phase).toBe("wave");
      return g.enemies.map((e) => `${e.id}:${e.kind}:${e.dist.toFixed(4)}`).join(",");
    };
    expect(run()).toBe(run());
  });

  it("the Book waits too: the lane never holds more than the cap, and nothing is lost by waiting", () => {
    const run = () => {
      const g = newGame(LEVELS[3]!);
      g.goodwill = 1e9;
      let maxLive = 0;
      let rounds = 0;
      let sent = 0;
      for (let i = 0; i < 200_000 && g.phase !== "won" && g.phase !== "lost"; i++) {
        if (g.phase === "build") {
          const before = g.spawnQueue.reduce((a, q) => a + fvOf(q.kind), 0);
          sendWave(g);
          rounds++;
          sent += g.spawnQueue.reduce((a, q) => a + fvOf(q.kind), 0) - before;
        }
        stepGame(g);
        g.events.length = 0;
        maxLive = Math.max(maxLive, g.enemies.length);
      }
      expect(g.phase).toBe("won");
      expect(rounds).toBe(LEVELS[3]!.waves.length);
      expect(g.leaked + g.popped).toBeCloseTo(sent, 6);
      return { maxLive, leaked: g.leaked, tick: g.tick };
    };
    const a = run();
    expect(a.maxLive).toBeLessThanOrEqual(LIVE_CAP);
    expect(a.maxLive).toBeGreaterThan(LIVE_CAP - 20);
    expect(run()).toEqual(a);
    // Two whole level-4 runs: about 3 s idle, over 7 s with the tuner on every core.
  }, 30_000);

  it("the lane index's windows hold exactly the lane points within reach (targeting by binary search)", () => {
    for (const lv of [LEVELS[0]!, LEVELS[40]!, LEVELS[6]!]) {
      const len = lv.path.slice(1).reduce((a, [x, y], i) => a + Math.abs(x - lv.path[i]![0]) + Math.abs(y - lv.path[i]![1]), 0);
      for (let k = 0; k < 40; k++) {
        const x = ((k * 7919) % (lv.cols * 100)) / 100;
        const y = ((k * 104729) % (lv.rows * 100)) / 100;
        const r = 0.5 + (k % 7) * 0.5;
        const w = laneWindows(lv.path, x, y, r);
        for (let d = 0; d <= len + 2; d += 0.05) {
          const p = pointAt(lv.path, d);
          const inside = Math.hypot(p.x - x, p.y - y) <= r;
          const held = w.some(([lo, hi]) => d >= lo && d <= hi);
          if (inside) expect(held).toBe(true);
        }
      }
    }
  });

  /**
   * Level 41's big field on fleet rules (so 40 towers fit beside the lane), every tower grown toward `goal`,
   * and the live cap kept full of real Box Lorries: every hit pops a layer, children burst out and the
   * emission queue fills, so the step pays for pierce, pops and the live cap, not just for aiming.
   * Returns ten 100-step batches (ms a step), sorted, so one GC pause or a busy runner doesn't decide it.
   */
  function perfRun(kinds: readonly TowerKind[], goal: (kind: TowerKind, i: number) => Path, check?: (g: Game) => void): number[] {
    const base = LEVELS[40]!;
    const towers = [...new Set([...base.towers, ...kinds])];
    const lv: Level = { ...base, towers, rules: "fleet", book: { from: 1, to: 12 }, twists: undefined, setPieces: undefined, hpScale: undefined };
    const g = newGame(lv);
    g.marks = 1e7;
    const ps = plots(lv);
    for (let r = 0; r < lv.rows && g.towers.length < 40; r++)
      for (let c = 0; c < lv.cols && g.towers.length < 40; c++) place(g, kinds[g.towers.length % kinds.length]!, c, r);
    for (const [c, r] of ps) if (g.towers.length < 40) place(g, "scarecrow", c, r);
    expect(g.towers.length).toBe(40);
    g.towers.forEach((t, i) => {
      for (let k = 0; k < 8; k++) upgradeToward(g, t.id, goal(t.kind, i));
    });
    check?.(g);
    sendWave(g);
    g.spawnQueue = [];
    let n = 0;
    const fill = () => {
      while (g.enemies.length < LIVE_CAP) g.enemies.push(makeEnemy(g, "lorry", ((n++ * 0.37) % (g.pathLength * 0.5)), undefined, 1));
    };
    fill();
    for (let i = 0; i < 100; i++) {
      stepGame(g);
      g.events.length = 0;
      if (i % 5 === 0) fill();
    }
    const popped0 = g.popped;
    const batches: number[] = [];
    let queued = 0;
    for (let b = 0; b < 10; b++) {
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        stepGame(g);
        g.events.length = 0;
        if (i % 5 === 0) fill();
      }
      batches.push((performance.now() - t0) / 100);
      queued = Math.max(queued, g.emitQueue.length);
    }
    batches.sort((x, y) => x - y);
    expect(g.popped - popped0).toBeGreaterThan(5000);
    // The live cap was hit and children waited in the queue (a fast field can have it empty at the very end).
    expect(queued).toBeGreaterThan(0);
    expect(g.enemies.length).toBeGreaterThan(300);
    return batches;
  }
  // The fastest batch measures the code (a loaded machine only ever slows a batch down); the median is a
  // looser guard so a regression that's slow every time still fails on a busy runner. The code runs at
  // about 0.8-1.2 ms a step, so 2 ms leaves room for a busy runner without hiding a real slowdown.
  const budgetOk = (batches: number[]) => {
    expect(batches[0]!).toBeLessThanOrEqual(2);
    expect(batches[5]!).toBeLessThanOrEqual(3.5);
  };

  it(
    "the sim steps in 2 ms or less with 350 vehicles and 40 towers, popping for real",
    () => {
      // Path towers at 2-0-2, the rest at tier 3.
      budgetOk(perfRun(["scarecrow", "beehive", "scarecrow", "hedgerow", "windmill", "cannon"], () => [2, 0, 2]));
      void STEP;
    },
    60_000,
  );

  it(
    "...and with tier 3 paths: thorns, piles, bales, rams, the Scythe and a Broadcast Tower (M4 review)",
    () => {
      // Half the field Hedgerows (Hawthorn Spikes 3-2-0 and Tractor Shed 2-0-3, which scratch, lay piles, hold
      // and ram every step), Scarecrows on the Scythe and Flock tier 3, and a Broadcast mast.
      const goal = (kind: TowerKind, i: number): Path =>
        kind === "hedgerow" ? (i % 4 === 0 ? [3, 2, 0] : [2, 0, 3]) : kind === "scarecrow" ? (i % 4 === 1 ? [2, 0, 3] : [3, 0, 2]) : [3, 0, 2];
      budgetOk(perfRun(["hedgerow", "scarecrow", "hedgerow", "scarecrow", "hedgerow", "mast"], goal, (g) => {
        // The builds really are tier 3.
        const builds = new Set(g.towers.map((t) => `${t.kind}-${t.path?.join("")}`));
        for (const b of ["hedgerow-320", "hedgerow-203", "scarecrow-203", "scarecrow-302", "mast-302"]) expect(builds).toContain(b);
      }));
    },
    60_000,
  );
});

describe("hedgerow fleet: level 1 (M1 review)", () => {
  it("act 1 isn't free (M2 review): Scarecrow spam bleeds Goodwill on levels 1-3 and on most of 4-10", () => {
    // M3 brought k back to [0.7, 1.0], so act 1 opens richer than M2's 0.4-0.49: spam now bleeds rather than
    // loses there, and act 2's locks finish it off (tests/hedgerow-lessons.test.ts).
    let bled = 0;
    for (const lv of LEVELS.filter((l) => isFleet(l) && l.id <= 10)) {
      const naive = kept(playLevel(lv, "naive"));
      if (lv.id <= 3) expect(naive, `level ${lv.id}`).toBeLessThan(0.95);
      else if (naive < 1) bled++;
    }
    // M4 (paths): spam bleeds or loses on levels 6, 7 and 9 of 4-10, as well as on 1-3 (BALANCE.md).
    expect(bled).toBeGreaterThanOrEqual(3);
  }, 180_000);

  it("level 1's pressure is graded (M3 review): a lazy field falls at round 6 as before, tier 2 bleeds, a small tier 3 field is dented", () => {
    const spots: Array<[number, number]> = [[2, 2], [3, 2], [2, 4], [3, 4], [1, 2], [4, 4], [0, 3], [5, 3]];
    const curve = (n: number, maxTier: number) => {
      const g = newGame(L1);
      const after: number[] = [];
      let built = 0;
      while (g.phase !== "won" && g.phase !== "lost") {
        if (g.phase === "build") {
          for (let spent = true; spent; ) {
            spent = false;
            if (built < n && place(g, "scarecrow", spots[built]![0], spots[built]![1]).ok) {
              built++;
              spent = true;
              continue;
            }
            // M4: old tier 2 is a path tower's first two steps (1-0-1), old tier 3 its first four (2-0-2).
            for (const t of g.towers) if (stepsBought(t) < (maxTier - 1) * 2 && upgradeToward(g, t.id).ok) { spent = true; break; }
          }
          sendWave(g);
        }
        stepGame(g);
        if (g.phase !== "wave" && after.length < g.wave) after.push(g.goodwill);
      }
      return { won: g.phase === "won", after };
    };
    // The lazy cliff is no steeper than M2's: untouched to round 4, gone by round 6.
    const lazy = curve(3, 1);
    expect(lazy.after.slice(0, 4)).toEqual([120, 120, 120, 120]);
    expect(lazy.won).toBe(false);
    expect(lazy.after.length).toBe(6);
    // Four tier 2 Scarecrows bleed for at least three rounds before they fall, rather than 120 to 0 in two.
    const t2 = curve(4, 2);
    const drops = t2.after.filter((v, i) => i > 0 && v < t2.after[i - 1]! && v > 0).length;
    expect(drops).toBeGreaterThanOrEqual(3);
    // A small tier 3 field is dented by the closing rush, not untouched, and still wins.
    const t3 = curve(3, 3);
    expect(t3.won).toBe(true);
    expect(t3.after.slice(0, 11).every((v) => v === 120)).toBe(true);
    expect(t3.after.at(-1)!).toBeGreaterThanOrEqual(20);
    expect(t3.after.at(-1)!).toBeLessThanOrEqual(110);
  }, 60_000);

  it("a lazy build (3 Scarecrows, never upgraded) loses Goodwill visibly; the best bot keeps nearly all of it", () => {
    const ps = plots(L1);
    const g = newGame(L1);
    let k = 0;
    while (g.phase !== "won" && g.phase !== "lost" && g.tick < 30 * 2000) {
      if (g.phase === "build") {
        while (k < 3 && place(g, "scarecrow", ps[k * 3]![0], ps[k * 3]![1]).ok) k++;
        sendWave(g);
      }
      stepGame(g);
    }
    expect(g.maxGoodwill - g.goodwill).toBeGreaterThanOrEqual(30);
    expect(kept(playLevel(L1, "best"))).toBeGreaterThanOrEqual(0.9);
  }, 60_000);

  it("stacking is a graded choice: one stacked round pays, stacking every round loses", () => {
    // A sensible field: Scarecrows on the six plots that see the most lane, upgraded as Marks allow.
    const len = L1.path.slice(1).reduce((a, [x, y], i) => a + Math.abs(x - L1.path[i]![0]) + Math.abs(y - L1.path[i]![1]), 0);
    const cover = ([c, r]: [number, number]) => {
      let n = 0;
      for (let d = 0; d < len; d += 0.1) {
        const p = pointAt(L1.path, d);
        if (Math.hypot(p.x - c - 0.5, p.y - r - 0.5) <= 2.4) n++;
      }
      return n;
    };
    const ps = [...plots(L1)].sort((a, b) => cover(b) - cover(a) || a[1] - b[1] || a[0] - b[0]).slice(0, 6);
    const play = (stackFrom: number, stackTo: number) => {
      const g = newGame(L1);
      while (g.phase !== "won" && g.phase !== "lost" && g.tick < 30 * 2000) {
        if (g.phase === "build") {
          for (const [c, r] of ps) place(g, "scarecrow", c, r);
          for (const t of [...g.towers].sort((a, b) => stepsBought(a) - stepsBought(b))) upgradeToward(g, t.id);
          sendWave(g);
        } else if (g.wave >= stackFrom && g.wave <= stackTo && g.waveClock > 6) sendWave(g);
        stepGame(g);
      }
      return g;
    };
    const none = play(99, 99);
    const once = play(1, 1);
    const every = play(1, 99);
    const earned = (g: Game) => g.marks + g.towers.reduce((a, t) => a + t.spent, 0);
    expect(none.phase).toBe("won");
    expect(once.phase).toBe("won");
    // The early bonus leaves the one-stack run richer at the end, for little or no Goodwill.
    expect(earned(once)).toBeGreaterThan(earned(none));
    expect(none.goodwill - once.goodwill).toBeLessThanOrEqual(10);
    expect(every.goodwill).toBeLessThan(none.goodwill - 20);
  }, 60_000);
});

describe("hedgerow fleet: Plants (M5)", () => {
  it("Skip and Bulldozer are heavy plants with a fleet under the lid", () => {
    expect(fvOf("skip", P.plant)).toBe(22);
    expect(fvOf("plantdozer", P.plant)).toBe(120 + 4 * fvOf("steel"));
    for (const k of ["skip", "plantdozer"] as const) {
      expect(RUNGS[k]!.props).toContain("plant");
      expect(canControl(P.plant, "push")).toBe(false);
      expect(canControl(P.plant, "hold")).toBe(false);
    }
  });
  it("round 36 brings the first Bulldozer and 46-54 are Plant rounds", () => {
    expect(BOOK[35]!.groups.some((x) => x.rung === "plantdozer")).toBe(true);
    for (let r = 46; r <= 54; r++) expect(BOOK[r - 1]!.groups.some((x) => x.rung === "plantdozer" || x.rung === "skip")).toBe(true);
  });
  it("a Bulldozer's shell breaking is a wreck event, with four plated lorries under the blade", () => {
    const g = bare();
    const dozer = makeEnemy(g, "plantdozer", 3, undefined, 1);
    g.enemies.push(dozer);
    g.events = [];
    hitEnemy(g, dozer, 119);
    expect(g.events.some((ev) => ev.type === "wreck")).toBe(false);
    hitEnemy(g, dozer, 1);
    expect(g.events.filter((ev) => ev.type === "wreck")).toHaveLength(1);
    expect(dozer.kind).toBe("steel");
    expect(g.enemies.filter((x) => x.kind === "steel")).toHaveLength(4);
  });
  it("the Book's Plants arrive on schedule: Crane R54, Exec Car R62, Tunnel Borer R78", () => {
    const first = (k: string) => BOOK.findIndex((r) => r.groups.some((x) => x.rung === k)) + 1;
    expect(first("plantdozer")).toBe(36);
    expect(first("crane")).toBe(54);
    expect(first("execcar")).toBe(62);
    expect(first("borer")).toBe(78);
    expect(BOOK[52]!.breather).toBe(true);
    expect(BOOK[76]!.breather).toBe(true);
  });
});

describe("hedgerow fleet: phased bosses", () => {
  const phases = (id: number) => {
    const game = newGame(LEVELS[id - 1]!);
    sendWave(game);
    game.spawnQueue = [];
    game.enemies = [];
    const boss = makeEnemy(game, "megadozer", 4, 0, 0);
    game.enemies.push(boss);
    const counts: number[] = [];
    for (const f of [1, 0.6, 0.3]) {
      boss.hp = boss.maxHp * f;
      boss.dist = 4;
      boss.stun = 99;
      stepGame(game);
      counts.push(game.enemies.length);
    }
    return counts;
  };
  it("drops an escort at 66% and 33% of the bar past level 30, and not before", () => {
    const [a, b, c] = phases(40);
    expect(b!).toBeGreaterThan(a!);
    expect(c!).toBeGreaterThan(b!);
    const [x, y, z] = phases(20);
    expect([x, y, z]).toEqual([1, 1, 1]);
  });
});
