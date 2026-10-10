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
  isFleet,
  laneCellsOf,
  isPlot,
  makeEnemy,
  newGame,
  place,
  remainingFV,
  sendWave,
  stepGame,
  towerCost,
  towerStats,
  upgrade,
  upgradeCost,
  type Game,
  type Level,
} from "../games/hedgerow/src/engine";
import { CHILD_GAP, FLEET_GOODWILL, LIVE_CAP, RUNGS, fvOf, roundBonus } from "../games/hedgerow/src/fleet";
import { BOOK, BOOK_ROUNDS, budget, incomeBefore, roundFV, windowFor } from "../games/hedgerow/src/rounds";
import { LEVELS } from "../games/hedgerow/src/levels";
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

describe("hedgerow fleet: rounds and levels", () => {
  it("the Book has 30 rounds, each within 10% of its budget, none spawning for more than 25 s", () => {
    expect(BOOK_ROUNDS).toBe(30);
    for (let r = 1; r <= BOOK_ROUNDS; r++) {
      expect(Math.abs(roundFV(r) / budget(r) - 1)).toBeLessThan(0.1);
      const spawn = Math.max(...BOOK[r - 1]!.groups.map((x) => (x.delay ?? 0) + x.count * x.gap));
      expect(spawn).toBeLessThanOrEqual(25);
      expect(BOOK[r - 1]!.card.length).toBeGreaterThan(10);
    }
    expect(budget(1)).toBeCloseTo(18, 0);
    expect(Math.round(budget(10))).toBe(569);
  });

  it("levels 1-10 play windows of the Book on fleet rules; level 11 stays classic", () => {
    expect(windowFor(1)).toEqual({ from: 1, to: 12 });
    expect(windowFor(10)).toEqual({ from: 5, to: 18 });
    expect(windowFor(50)).toEqual({ from: 24, to: 45 });
    expect(windowFor(100)).toEqual({ from: 51, to: 80 });
    for (const lv of LEVELS.slice(0, 10)) {
      expect(isFleet(lv)).toBe(true);
      expect(lv.goodwill).toBe(FLEET_GOODWILL);
      expect(lv.hpScale).toBeUndefined();
      const w = windowFor(lv.id);
      expect(lv.book).toEqual(w);
      expect(lv.waves).toHaveLength(w.to - w.from + 1);
      expect(lv.startMarks).toBeGreaterThanOrEqual(500 + Math.round(0.7 * incomeBefore(w.from)));
      expect(lv.startMarks).toBeLessThanOrEqual(500 + Math.round(1.0 * incomeBefore(w.from)));
    }
    expect(LEVELS[9]!.waves.at(-1)!.some((g) => g.enemy === "boss")).toBe(true);
    expect(isFleet(LEVELS[10]!)).toBe(false);
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
    const u1 = upgradeCost(t)!;
    g.marks = 1e5;
    upgrade(g, t.id);
    expect(upgradeCost(t)!).toBeGreaterThan(u1);
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

  it(
    "the sim steps in 2 ms or less with 350 vehicles and 40 towers",
    () => {
      // A big field (level 41's) on fleet rules, so 40 towers fit beside the lane.
      const lv: Level = { ...LEVELS[40]!, rules: "fleet", book: { from: 1, to: 12 }, twists: undefined, setPieces: undefined, hpScale: undefined };
      const g = newGame(lv);
      g.marks = 1e7;
      const ps = plots(lv);
      for (let r = 0; r < lv.rows && g.towers.length < 40; r++)
        for (let c = 0; c < lv.cols && g.towers.length < 40; c++) {
          const kind = (["scarecrow", "beehive", "scarecrow", "hedgerow", "windmill", "cannon"] as const)[g.towers.length % 6]!;
          place(g, kind, c, r);
        }
      for (const [c, r] of ps) if (g.towers.length < 40) place(g, "scarecrow", c, r);
      expect(g.towers.length).toBe(40);
      for (const t of g.towers) {
        upgrade(g, t.id);
        upgrade(g, t.id);
      }
      sendWave(g);
      g.spawnQueue = [];
      const kinds = ["lorry", "sprinter", "pickup", "van", "quad", "courier"] as const;
      const fill = () => {
        while (g.enemies.length < LIVE_CAP) {
          const e = makeEnemy(g, kinds[g.enemies.length % kinds.length]!, ((g.enemies.length * 7) % 97) / 97 * g.pathLength * 0.9, undefined, 1);
          e.hp = 1e9;
          g.enemies.push(e);
        }
      };
      fill();
      for (let i = 0; i < 60; i++) {
        stepGame(g);
        fill();
      }
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        stepGame(g);
        if (i % 10 === 0) fill();
      }
      const ms = (performance.now() - t0) / 1000;
      expect(g.enemies.length).toBeGreaterThan(300);
      expect(ms).toBeLessThanOrEqual(2);
      void STEP;
    },
    60_000,
  );
});

describe("hedgerow fleet: level 1 (M1 review)", () => {
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
    const ps = plots(L1);
    const play = (stackFrom: number, stackTo: number) => {
      const g = newGame(L1);
      while (g.phase !== "won" && g.phase !== "lost" && g.tick < 30 * 2000) {
        if (g.phase === "build") {
          for (const [c, r] of ps) place(g, "scarecrow", c, r);
          for (const t of [...g.towers].sort((a, b) => a.tier - b.tier)) upgrade(g, t.id);
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
