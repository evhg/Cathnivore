import { describe, expect, it } from "vitest";
import {
  STEP,
  TOWERS,
  isPlot,
  newGame,
  place,
  pointAt,
  sell,
  sellValue,
  sendWave,
  stars,
  stepGame,
  throwPie,
  towerAt,
  upgrade,
  type Game,
  type Level,
} from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";
import {
  emptySave,
  isUnlocked,
  parseSave,
  recordStars,
} from "../games/hedgerow/src/store";

/** A simple greedy player: spend everything, scarecrows on the plots that see the most lane. */
function plotsByCoverage(level: Level): Array<[number, number]> {
  const cells: Array<{ c: number; r: number; score: number }> = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!isPlot(level, c, r)) continue;
      let score = 0;
      for (let d = 0; d < 40; d += 0.5) {
        const p = pointAt(level.path, d);
        if (Math.hypot(c + 0.5 - p.x, r + 0.5 - p.y) <= 2.4) score++;
      }
      cells.push({ c, r, score });
    }
  }
  return cells.sort((a, b) => b.score - a.score).map((x) => [x.c, x.r]);
}

function play(level: Level, build: boolean): Game {
  const game = newGame(level);
  const plots = plotsByCoverage(level);
  let guard = 0;
  while (game.phase !== "won" && game.phase !== "lost" && guard++ < 200_000) {
    if (game.phase === "build") {
      if (build) {
        let bought = true;
        while (bought) {
          bought = false;
          const scarecrows = game.towers.filter(
            (t) => t.kind === "scarecrow",
          ).length;
          const hedges = game.towers.filter(
            (t) => t.kind === "hedgerow",
          ).length;
          const hives = game.towers.filter((t) => t.kind === "beehive").length;
          const ponds = game.towers.filter((t) => t.kind === "pond").length;
          const silos = game.towers.filter((t) => t.kind === "silo").length;
          const barns = game.towers.filter((t) => t.kind === "barn").length;
          const masts = game.towers.filter((t) => t.kind === "mast").length;
          const kind =
            level.towers.includes("mast") &&
            masts < Math.floor(scarecrows / 3) + 1 &&
            scarecrows >= 2
              ? "mast"
              : level.towers.includes("silo") &&
                  silos < Math.floor(scarecrows / 2) + 1
                ? "silo"
                : level.towers.includes("barn") &&
                    barns < Math.floor(scarecrows / 3)
                  ? "barn"
                  : level.towers.includes("pond") &&
                      ponds < Math.floor(scarecrows / 2)
                    ? "pond"
                    : hedges < Math.floor(scarecrows / 2)
                      ? "hedgerow"
                      : level.towers.includes("beehive") && hives < scarecrows
                        ? "beehive"
                        : "scarecrow";
          const spot = plots.find(([c, r]) => !towerAt(game, c, r));
          if (spot && place(game, kind, spot[0], spot[1]).ok) bought = true;
          else {
            const weakest = [...game.towers].sort((a, b) => a.tier - b.tier)[0];
            if (weakest && upgrade(game, weakest.id).ok) bought = true;
          }
        }
      }
      sendWave(game);
    }
    stepGame(game);
  }
  return game;
}

describe("hedgerow engine", () => {
  const level = LEVELS[0]!;

  it("places, upgrades and sells towers with the right costs", () => {
    const game = newGame(level);
    expect(place(game, "scarecrow", 0, 0).ok).toBe(true);
    expect(game.marks).toBe(level.startMarks - TOWERS.scarecrow.cost);
    expect(place(game, "scarecrow", 0, 0).ok).toBe(false);
    const id = game.towers[0]!.id;
    expect(upgrade(game, id).ok).toBe(true);
    expect(game.towers[0]!.tier).toBe(2);
    const before = game.marks;
    expect(sell(game, id).ok).toBe(true);
    expect(game.marks).toBe(
      before +
        Math.floor(
          (TOWERS.scarecrow.cost + TOWERS.scarecrow.upgrades[0]) * 0.7,
        ),
    );
    expect(sellValue({ ...game.towers[0]!, spent: 100 } as never)).toBe(70);
  });

  it("refuses builds on the lane, off the map and beyond the budget", () => {
    const game = newGame(level);
    expect(place(game, "scarecrow", 2, 1).ok).toBe(false);
    expect(place(game, "scarecrow", -1, 0).ok).toBe(false);
    game.marks = 10;
    expect(place(game, "hedgerow", 0, 0).ok).toBe(false);
  });

  it("is deterministic: the same build order gives the same result", () => {
    const a = play(level, true);
    const b = play(level, true);
    expect([a.tick, a.goodwill, a.marks]).toEqual([
      b.tick,
      b.goodwill,
      b.marks,
    ]);
  });

  it("a beehive stings every enemy near its target", () => {
    const lv = LEVELS[3]!;
    const game = newGame(lv);
    place(game, "beehive", 2, 1);
    sendWave(game);
    game.enemies.push(
      { id: 90, kind: "van", dist: 5, hp: 100, slowed: false, stun: 0 },
      { id: 91, kind: "van", dist: 5.5, hp: 100, slowed: false, stun: 0 },
      { id: 92, kind: "van", dist: 20, hp: 100, slowed: false, stun: 0 },
    );
    game.spawnQueue = [];
    stepGame(game);
    const hp = (id: number) => game.enemies.find((e) => e.id === id)!.hp;
    expect(hp(90)).toBeLessThan(100);
    expect(hp(91)).toBeLessThan(100);
    expect(hp(92)).toBe(100);
  });

  it("Cath's pie freezes the lane, then cools down", () => {
    const game = newGame(LEVELS[2]!);
    expect(throwPie(game).ok).toBe(false);
    sendWave(game);
    for (let i = 0; i < 90; i++) stepGame(game);
    const before = game.enemies.map((e) => e.dist);
    expect(throwPie(game).ok).toBe(true);
    expect(throwPie(game).ok).toBe(false);
    for (let i = 0; i < 30; i++) stepGame(game);
    expect(game.enemies.slice(0, before.length).map((e) => e.dist)).toEqual(
      before,
    );
    expect(game.pieCd).toBeGreaterThan(30);
    expect(throwPie(newGame(LEVELS[0]!)).ok).toBe(false);
  });

  it("a Market Stall earns Marks each wave and boosts neighbours", () => {
    const lv = LEVELS[12]!;
    const game = newGame(lv);
    place(game, "stall", 0, 1);
    place(game, "scarecrow", 1, 1);
    place(game, "scarecrow", 5, 7);
    sendWave(game);
    game.enemies.push({
      id: 90,
      kind: "van",
      dist: 1,
      hp: 1000,
      slowed: false,
      stun: 0,
    });
    stepGame(game);
    const hp = game.enemies.find((e) => e.id === 90)!.hp;
    expect(1000 - hp).toBeCloseTo(
      TOWERS.scarecrow.damage[0] * TOWERS.stall.buff![0],
      5,
    );
    const g2 = newGame(lv);
    place(g2, "stall", 0, 1);
    const before = g2.marks;
    sendWave(g2);
    g2.spawnQueue = [];
    stepGame(g2);
    expect(g2.marks).toBe(before + 20 + 5 + TOWERS.stall.income![0]);
  });

  it("a price-war truck breaks into drones", () => {
    const game = newGame(LEVELS[13]!);
    sendWave(game);
    game.spawnQueue = [];
    game.enemies.push({
      id: 90,
      kind: "truck",
      dist: 4,
      hp: 0,
      slowed: false,
      stun: 0,
    });
    stepGame(game);
    expect(game.enemies.filter((e) => e.kind === "drone")).toHaveLength(2);
  });

  it("an influencer charms towers in range, and the Duck Pond slows and splashes", () => {
    const lv = LEVELS[20]!;
    const game = newGame(lv);
    place(game, "scarecrow", 0, 0);
    sendWave(game);
    game.spawnQueue = [];
    game.enemies.push({
      id: 90,
      kind: "influencer",
      dist: 0.5,
      hp: 1000,
      slowed: false,
      stun: 0,
    });
    game.enemies.push({
      id: 91,
      kind: "van",
      dist: 0.6,
      hp: 1000,
      slowed: false,
      stun: 0,
    });
    stepGame(game);
    expect(game.enemies.find((e) => e.id === 91)!.hp).toBe(1000);
    const g2 = newGame(lv);
    place(g2, "pond", 0, 0);
    sendWave(g2);
    g2.spawnQueue = [];
    g2.enemies.push({
      id: 90,
      kind: "van",
      dist: 0.5,
      hp: 1000,
      slowed: false,
      stun: 0,
    });
    stepGame(g2);
    const e = g2.enemies[0]!;
    expect(e.slowed).toBe(true);
    expect(e.hp).toBeLessThan(1000);
  });

  it("armour halves ordinary shots but not the Grain Silo", () => {
    const lv = LEVELS[37]!;
    const hpAfter = (kind: "scarecrow" | "silo") => {
      const g = newGame(lv);
      place(g, kind, 5, 0);
      sendWave(g);
      g.spawnQueue = [];
      g.enemies.push({
        id: 90,
        kind: "bulldozer",
        dist: 0.5,
        hp: 1000,
        slowed: false,
        stun: 0,
      });
      stepGame(g);
      return g.enemies[0]!.hp;
    };
    expect(hpAfter("scarecrow")).toBe(996);
    expect(hpAfter("silo")).toBe(960);
  });

  it("stealth units are untouchable until a Radio Mast reveals them, and the mast marks targets", () => {
    const lv = LEVELS[44]!;
    const fire = (mast: boolean) => {
      const g = newGame(lv);
      place(g, "scarecrow", 5, 0);
      if (mast) place(g, "mast", 4, 0);
      sendWave(g);
      g.spawnQueue = [];
      g.enemies.push({
        id: 90,
        kind: "phantom",
        dist: 1.5,
        hp: 1000,
        slowed: false,
        stun: 0,
      });
      stepGame(g);
      return 1000 - g.enemies[0]!.hp;
    };
    expect(fire(false)).toBe(0);
    expect(fire(true)).toBeCloseTo(TOWERS.scarecrow.damage[0] * 1.2, 5);
  });

  it("the Clinic-in-a-Box heals its neighbours", () => {
    const g = newGame(LEVELS[49]!);
    sendWave(g);
    g.spawnQueue = [];
    g.enemies.push(
      { id: 90, kind: "clinic", dist: 3, hp: 4800, slowed: false, stun: 0 },
      { id: 91, kind: "van", dist: 3.5, hp: 50, slowed: false, stun: 0 },
    );
    stepGame(g);
    expect(g.enemies.find((e) => e.id === 91)!.hp).toBeGreaterThan(50);
  });

  it("a Clinic Tent lets towers shrug off influencer charm", () => {
    const lv = LEVELS[54]!;
    const fire = (tent: boolean) => {
      const g = newGame(lv);
      place(g, "scarecrow", 5, 0);
      if (tent) place(g, "tent", 4, 0);
      sendWave(g);
      g.spawnQueue = [];
      g.enemies.push(
        {
          id: 90,
          kind: "influencer",
          dist: 4.5,
          hp: 1000,
          slowed: false,
          stun: 0,
        },
        { id: 91, kind: "van", dist: 4.6, hp: 1000, slowed: false, stun: 0 },
      );
      stepGame(g);
      return 1000 - g.enemies.find((e) => e.id === 91)!.hp;
    };
    expect(fire(false)).toBe(0);
    expect(fire(true)).toBeGreaterThan(0);
  });

  it("a slowed enemy covers less ground", () => {
    const g1 = newGame(level);
    const g2 = newGame(level);
    place(g2, "hedgerow", 0, 0);
    for (const g of [g1, g2]) {
      sendWave(g);
      for (let i = 0; i < 60; i++) stepGame(g);
    }
    expect(g2.enemies[0]!.dist).toBeLessThan(g1.enemies[0]!.dist);
    expect(STEP).toBeCloseTo(1 / 30);
  });

  for (const lv of LEVELS) {
    it(`level ${lv.id} (${lv.name}): lanes are connected and it is winnable, but not for free`, () => {
      for (let i = 1; i < lv.path.length; i++) {
        const [ax, ay] = lv.path[i - 1]!;
        const [bx, by] = lv.path[i]!;
        expect(ax === bx || ay === by).toBe(true);
        for (const [x, y] of lv.path) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(lv.cols);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(lv.rows);
        }
      }
      expect(play(lv, false).phase).toBe("lost");
      const won = play(lv, true);
      expect(won.phase).toBe("won");
      expect(stars(won)).toBeGreaterThanOrEqual(1);
    });
  }
});

describe("hedgerow saves", () => {
  it("starts empty, repairs junk and keeps the best stars", () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave("{not json")).toEqual(emptySave());
    expect(
      parseSave(
        JSON.stringify({
          stars: { "1": 9, "2": 2, "3": "x" },
          seenBefore: { "1": true, "2": 1 },
        }),
      ),
    ).toEqual({
      version: 1,
      stars: { "2": 2 },
      seenBefore: { "1": true },
    });
    const data = emptySave();
    recordStars(data, 1, 3);
    recordStars(data, 1, 1);
    expect(data.stars["1"]).toBe(3);
  });

  it("unlocks level n only after level n-1 is cleared", () => {
    const data = emptySave();
    expect(isUnlocked(data, 1)).toBe(true);
    expect(isUnlocked(data, 2)).toBe(false);
    data.stars["1"] = 1;
    expect(isUnlocked(data, 2)).toBe(true);
  });
});
