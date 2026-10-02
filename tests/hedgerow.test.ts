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
  PIE_COOLDOWN,
  PIE_DAMAGE,
  PIE_RADIUS,
  HERO,
  NO_PERKS,
  SPECIALISATIONS,
  canCallEarly,
  earlyBonus,
  moveHero,
  pieCooldown,
  setTarget,
  towerStats,
  upgrade,
  type Game,
  type GameEvent,
  type Level,
} from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";
import {
  PERKS,
  buyPerk,
  emptySave,
  freeStars,
  isUnlocked,
  nextCost,
  parseSave,
  perksOf,
  recordStars,
  refundAll,
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
            if (
              weakest &&
              (upgrade(game, weakest.id).ok ||
                upgrade(game, weakest.id, (weakest.id % 2) as 0 | 1).ok)
            )
              bought = true;
          }
        }
      }
      sendWave(game);
    }
    // Like a player, it saves the pie for bosses.
    if (build && game.phase === "wave" && game.pieCd === 0) {
      const boss = game.enemies.find((e) => e.hp >= 1500);
      if (boss) throwPie(game, pointAt(level.path, boss.dist).x, pointAt(level.path, boss.dist).y);
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

  it("Cath's pie freezes and dents what it lands on, then cools down", () => {
    const game = newGame(LEVELS[2]!);
    expect(throwPie(game).ok).toBe(false);
    sendWave(game);
    for (let i = 0; i < 90; i++) stepGame(game);
    const lead = game.enemies.reduce((a, b) => (b.dist > a.dist ? b : a));
    const far = game.enemies.find((e) => lead.dist - e.dist > PIE_RADIUS + 0.5);
    const p = pointAt(game.level.path, lead.dist);
    const hpBefore = lead.hp;
    const leadDist = lead.dist;
    const farDist = far?.dist;
    expect(throwPie(game, p.x, p.y).ok).toBe(true);
    expect(throwPie(game).ok).toBe(false);
    expect(lead.hp).toBe(hpBefore - PIE_DAMAGE);
    for (let i = 0; i < 30; i++) stepGame(game);
    expect(lead.dist).toBe(leadDist);
    if (far) expect(far.dist).toBeGreaterThan(farDist!);
    expect(game.pieCd).toBeGreaterThan(PIE_COOLDOWN - 2);
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

  it("a Courthouse freezes a boss in range with an Injunction", () => {
    const lv = LEVELS[64]!;
    const g = newGame(lv);
    place(g, "court", 4, 0);
    sendWave(g);
    g.spawnQueue = [];
    g.enemies.push({
      id: 90,
      kind: "swarm",
      dist: 4.5,
      hp: 6000,
      slowed: false,
      stun: 0,
    });
    stepGame(g);
    expect(g.enemies.find((e) => e.id === 90)!.stun).toBeGreaterThan(1);
  });

  it("lawyers jam nearby towers to half rate", () => {
    const lv = LEVELS[62]!;
    const shots = (jam: boolean) => {
      const g = newGame(lv);
      place(g, "scarecrow", 5, 0);
      sendWave(g);
      g.spawnQueue = [];
      g.enemies.push({
        id: 91,
        kind: "van",
        dist: 4.6,
        hp: 1e9,
        slowed: false,
        stun: 0,
      });
      if (jam)
        g.enemies.push({
          id: 90,
          kind: "lawyer",
          dist: 4.5,
          hp: 1e9,
          slowed: false,
          stun: 0,
        });
      for (let i = 0; i < 200; i++) stepGame(g);
      return 1e9 - g.enemies.find((e) => e.id === 91)!.hp;
    };
    expect(shots(true)).toBeLessThan(shots(false));
  });

  it("a Union Hall lifts every tower's damage from anywhere on the map", () => {
    const lv = LEVELS[74]!;
    const dealt = (hall: boolean) => {
      const g = newGame(lv);
      place(g, "scarecrow", 5, 0);
      if (hall) place(g, "hall", 0, 7);
      sendWave(g);
      g.spawnQueue = [];
      g.enemies.push({
        id: 91,
        kind: "van",
        dist: 4.6,
        hp: 1e9,
        slowed: false,
        stun: 0,
      });
      for (let i = 0; i < 200; i++) stepGame(g);
      return 1e9 - g.enemies.find((e) => e.id === 91)!.hp;
    };
    expect(dealt(true)).toBeGreaterThan(dealt(false));
  });

  it("the Board of Directors splits into five directors", () => {
    const g = newGame(LEVELS[89]!);
    g.enemies.push({
      id: 92,
      kind: "board",
      dist: 3,
      hp: 1,
      slowed: false,
      stun: 0,
    });
    place(g, "scarecrow", 3, 1);
    sendWave(g);
    g.spawnQueue = [];
    for (let i = 0; i < 300; i++) stepGame(g);
    expect(g.enemies.filter((e) => e.kind === "director").length).toBe(5);
  });

  it("HollowCandor breaks into two Candors, each into remnants", () => {
    const g = newGame(LEVELS[99]!);
    g.enemies.push({
      id: 93,
      kind: "hollowcandor",
      dist: 3,
      hp: 1,
      slowed: false,
      stun: 0,
    });
    place(g, "scarecrow", 3, 1);
    sendWave(g);
    g.spawnQueue = [];
    for (let i = 0; i < 4; i++) stepGame(g);
    expect(g.enemies.filter((e) => e.kind === "candor").length).toBe(2);
    g.enemies.filter((e) => e.kind === "candor").forEach((e) => (e.hp = 0));
    stepGame(g);
    expect(g.enemies.filter((e) => e.kind === "remnant").length).toBe(6);
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

/** A bare level for mechanics tests: a straight lane along row 1 of a 12x3 field. */
function strip(overrides: Partial<Level> = {}): Level {
  return {
    ...LEVELS[40]!,
    id: 50,
    cols: 12,
    rows: 3,
    path: [
      [0, 1],
      [11, 1],
    ],
    startMarks: 5000,
    goodwill: 20,
    waves: [[{ enemy: "van", count: 1, gap: 1, delay: 0 }], [{ enemy: "van", count: 1, gap: 1, delay: 0 }]],
    ...overrides,
  } as Level;
}

function spawn(game: Game, kind: Game["enemies"][number]["kind"], dist: number, hp?: number) {
  const e: Game["enemies"][number] = { id: game.nextId++, kind, dist, hp: hp ?? 1000, slowed: false, stun: 0, wave: 1 };
  game.enemies.push(e);
  return e;
}

describe("hedgerow: Cath on the battlefield", () => {
  it("holds a van in place, whacks it and takes hits back", () => {
    const game = newGame(strip());
    moveHero(game, 6.5, 1.5);
    for (let i = 0; i < 120; i++) stepGame(game); // build phase: nothing moves
    sendWave(game);
    game.spawnQueue = [];
    game.hero.x = 6.5;
    game.hero.y = 1.5;
    const van = spawn(game, "van", 6, 500);
    for (let i = 0; i < 30; i++) stepGame(game);
    expect(van.held).toBe(true);
    expect(van.dist).toBe(6);
    expect(van.hp).toBeLessThan(500);
    expect(game.hero.hp).toBeLessThan(game.hero.maxHp);
  });

  it("can't hold drones or bosses", () => {
    const game = newGame(strip());
    sendWave(game);
    game.spawnQueue = [];
    game.hero.x = game.hero.tx = 6.5;
    game.hero.y = game.hero.ty = 1.5;
    const drone = spawn(game, "drone", 6);
    const boss = spawn(game, "boss", 6.2, 5000);
    stepGame(game);
    expect(drone.held).toBe(false);
    expect(boss.held).toBe(false);
  });

  it("goes down when overwhelmed and gets back up", () => {
    const game = newGame(strip());
    sendWave(game);
    game.spawnQueue = [];
    game.hero.x = game.hero.tx = 6.5;
    game.hero.y = game.hero.ty = 1.5;
    spawn(game, "tender", 6, 100000);
    spawn(game, "tender", 6.1, 100000);
    let downs = 0;
    for (let i = 0; i < 30 * 40 && game.phase === "wave"; i++) {
      stepGame(game);
      if (game.hero.down > 0) downs++;
    }
    expect(downs).toBeGreaterThan(0);
    expect(moveHero({ ...game, hero: { ...game.hero, down: 3 } }, 1, 1).ok).toBe(false);
  });

  it("walks where she is sent, and lets go while walking", () => {
    const game = newGame(strip());
    expect(moveHero(game, 2.5, 0.5).ok).toBe(true);
    sendWave(game);
    for (let i = 0; i < 90; i++) stepGame(game);
    expect(game.hero.x).toBeCloseTo(2.5, 1);
    expect(game.hero.y).toBeCloseTo(0.5, 1);
    expect(HERO.holds).toBe(2);
  });
});

describe("hedgerow: towers go deeper", () => {
  it("tier 4 needs a choice of specialisation, priced on its own, from level 6", () => {
    const game = newGame(strip());
    place(game, "scarecrow", 3, 0);
    const t = game.towers[0]!;
    upgrade(game, t.id);
    upgrade(game, t.id);
    expect(t.tier).toBe(3);
    expect(upgrade(game, t.id).ok).toBe(false);
    const before = game.marks;
    expect(upgrade(game, t.id, 1).ok).toBe(true);
    expect(t.tier).toBe(4);
    expect(game.marks).toBe(before - SPECIALISATIONS.scarecrow[1].cost);
    expect(towerStats(t).range).toBe(SPECIALISATIONS.scarecrow[1].range);
    expect(upgrade(game, t.id, 0).ok).toBe(false);
    const early = newGame(LEVELS[2]!);
    early.marks = 5000;
    place(early, "scarecrow", 0, 0);
    const e = early.towers[0]!;
    upgrade(early, e.id);
    upgrade(early, e.id);
    expect(upgrade(early, e.id, 0).ok).toBe(false);
  });

  it("targeting picks the first, last, strongest or closest enemy", () => {
    const shotAt = (mode: "first" | "last" | "strong" | "close") => {
      const game = newGame(strip());
      game.hero.x = game.hero.tx = 0.5;
      game.hero.y = game.hero.ty = 0.5;
      place(game, "scarecrow", 3, 0);
      setTarget(game, game.towers[0]!.id, mode);
      sendWave(game);
      game.spawnQueue = [];
      spawn(game, "van", 1.5, 300);
      spawn(game, "van", 3.2, 900);
      spawn(game, "van", 5, 300);
      game.events = [];
      stepGame(game);
      const shot = game.events.find((e) => e.type === "shot");
      return shot && shot.type === "shot" ? Math.round(shot.toX * 10) / 10 : null;
    };
    expect(shotAt("first")).toBe(5.5);
    expect(shotAt("last")).toBe(2);
    expect(shotAt("strong")).toBe(3.7);
    expect(shotAt("close")).toBe(3.7);
  });

  it("Blackthorn scratches, Killer Queen poisons, Goose Patrol shoves, Crow Caller crits", () => {
    const game = newGame(strip());
    game.hero.x = game.hero.tx = 11.5;
    game.hero.y = game.hero.ty = 0.5;
    const build = (kind: Parameters<typeof place>[1], col: number, row: number, spec: 0 | 1) => {
      place(game, kind, col, row);
      const t = game.towers[game.towers.length - 1]!;
      upgrade(game, t.id);
      upgrade(game, t.id);
      upgrade(game, t.id, spec);
      return t;
    };
    build("hedgerow", 1, 0, 0);
    sendWave(game);
    game.spawnQueue = [];
    const scratched = spawn(game, "van", 1, 1000);
    stepGame(game);
    expect(scratched.hp).toBeLessThan(1000);
    expect(scratched.hp).toBeGreaterThan(998);

    const g2 = newGame(strip());
    g2.hero.x = g2.hero.tx = 11.5;
    place(g2, "beehive", 5, 0);
    const hive = g2.towers[0]!;
    upgrade(g2, hive.id);
    upgrade(g2, hive.id);
    upgrade(g2, hive.id, 0);
    sendWave(g2);
    g2.spawnQueue = [];
    const stung = spawn(g2, "van", 5, 1000);
    stepGame(g2);
    expect(stung.poisonLeft).toBeGreaterThan(0);
    const afterSting = stung.hp;
    hive.cd = 99;
    stepGame(g2);
    expect(stung.hp).toBeLessThan(afterSting);

    const g3 = newGame(strip());
    g3.hero.x = g3.hero.tx = 11.5;
    place(g3, "pond", 5, 0);
    const pond = g3.towers[0]!;
    upgrade(g3, pond.id);
    upgrade(g3, pond.id);
    upgrade(g3, pond.id, 0);
    sendWave(g3);
    g3.spawnQueue = [];
    const shoved = spawn(g3, "van", 5, 1000);
    stepGame(g3);
    expect(shoved.dist).toBeLessThan(5);

    const g4 = newGame(strip());
    g4.hero.x = g4.hero.tx = 11.5;
    place(g4, "scarecrow", 5, 0);
    const crow = g4.towers[0]!;
    upgrade(g4, crow.id);
    upgrade(g4, crow.id);
    upgrade(g4, crow.id, 1);
    sendWave(g4);
    g4.spawnQueue = [];
    const big = spawn(g4, "van", 4, 100000);
    const hits: number[] = [];
    let last = big.hp;
    for (let i = 0; i < 60; i++) {
      big.dist = 4;
      stepGame(g4);
      if (big.hp < last) hits.push(Math.round(last - big.hp));
      last = big.hp;
    }
    expect(hits[2]).toBe(hits[0]! * 3);
  });
});

describe("hedgerow: boss moves", () => {
  const run = (kind: Parameters<typeof spawn>[1], secs: number, setup?: (g: Game) => void) => {
    const game = newGame(strip());
    game.hero.x = game.hero.tx = 0.5;
    game.hero.y = game.hero.ty = 0.5;
    setup?.(game);
    sendWave(game);
    game.spawnQueue = [];
    const boss = spawn(game, kind, 4, 1e6);
    const events: GameEvent[] = [];
    for (let i = 0; i < secs * 30; i++) {
      boss.dist = 4;
      stepGame(game);
      events.push(...game.events.splice(0));
    }
    return { game, boss, moves: events.filter((e) => e.type === "bossMove") };
  };

  it("the Acquisition Van calls in vans", () => {
    const { game, moves } = run("boss", 6);
    expect(moves.length).toBe(1);
    expect(game.enemies.filter((e) => e.kind === "van").length).toBe(2);
  });

  it("the Mega-Dozer flattens the nearest tower, which then neither fires nor slows until it recovers", () => {
    const { game, moves } = run("megadozer", 6, (g) => {
      place(g, "scarecrow", 4, 0);
      place(g, "hedgerow", 9, 0);
    });
    expect(moves.length).toBe(1);
    const flat = game.towers.find((t) => t.kind === "scarecrow")!;
    expect(flat.out).toBeGreaterThan(0);
    expect(game.towers.find((t) => t.kind === "hedgerow")!.out ?? 0).toBe(0);
    const shots = () => game.events.filter((e) => e.type === "shot" && e.tower === flat.id).length;
    stepGame(game);
    expect(shots()).toBe(0);
  });

  it("the Board takes over the best tower in reach", () => {
    const { game } = run("board", 7, (g) => {
      place(g, "scarecrow", 3, 0);
      place(g, "scarecrow", 5, 2);
      upgrade(g, g.towers[1]!.id);
    });
    expect(game.towers[1]!.out).toBeGreaterThan(0);
    expect(game.towers[0]!.out ?? 0).toBe(0);
  });

  it("HollowCandor cycles through every trick", () => {
    const { moves } = run("hollowcandor", 30);
    expect(new Set(moves.map((m) => m.type === "bossMove" && m.move))).toEqual(
      new Set(["spawn", "stomp", "pulse", "charge", "takeover"]),
    );
  });

  it("a stunned boss saves its move for later", () => {
    const { moves } = run("boss", 6, () => undefined);
    expect(moves.length).toBe(1);
    const game = newGame(strip());
    sendWave(game);
    game.spawnQueue = [];
    const boss = spawn(game, "boss", 4, 1e6);
    boss.stun = 999;
    for (let i = 0; i < 300; i++) stepGame(game);
    expect(game.events.some((e) => e.type === "bossMove")).toBe(false);
  });
});

describe("hedgerow: calling waves early", () => {
  it("pays a bonus, overlaps the waves and still pays each wave once it clears", () => {
    const game = newGame(strip({ waves: [[{ enemy: "van", count: 1, gap: 1, delay: 0 }], [{ enemy: "van", count: 1, gap: 1, delay: 0 }], [{ enemy: "van", count: 1, gap: 1, delay: 0 }]] }));
    game.hero.x = game.hero.tx = 0.5;
    game.hero.y = game.hero.ty = 0.5;
    expect(canCallEarly(game)).toBe(false);
    sendWave(game);
    stepGame(game);
    expect(canCallEarly(game)).toBe(true);
    const bonus = earlyBonus(game);
    const before = game.marks;
    expect(sendWave(game).ok).toBe(true);
    expect(game.marks).toBe(before + bonus);
    expect(game.wave).toBe(2);
    stepGame(game);
    expect(game.enemies.length).toBe(2);
    for (const e of game.enemies) e.hp = 0;
    const m = game.marks;
    stepGame(game);
    expect(game.paid).toBe(2);
    expect(game.marks).toBe(m + 2 * ENEMIES_VAN_BOUNTY + (20 + 5) + (20 + 10));
    expect(game.phase).toBe("build");
  });
});

describe("hedgerow: perks", () => {
  it("add Marks, Goodwill and a faster pie; discounts lower prices", () => {
    const perks = { ...NO_PERKS, marks: 50, goodwill: 3, pieCooldown: 0.5, discount: 0.1 };
    const game = newGame(LEVELS[4]!, perks);
    expect(game.marks).toBe(LEVELS[4]!.startMarks + 50);
    expect(game.goodwill).toBe(LEVELS[4]!.goodwill + 3);
    expect(pieCooldown(game)).toBe(PIE_COOLDOWN * 0.5);
    const m = game.marks;
    place(game, "scarecrow", 0, 0);
    expect(game.marks).toBe(m - Math.round(TOWERS.scarecrow.cost * 0.9));
  });
});

const ENEMIES_VAN_BOUNTY = 9;

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
      version: 2,
      stars: { "2": 2 },
      seenBefore: { "1": true },
      seen: {},
      tips: {},
      bank: {},
    });
    const data = emptySave();
    recordStars(data, 1, 3);
    recordStars(data, 1, 1);
    expect(data.stars["1"]).toBe(3);
  });

  it("migrates a v1 save to v2, keeping stars and stories", () => {
    const v1 = JSON.stringify({ version: 1, stars: { "1": 3, "2": 1 }, seenBefore: { "1": true } });
    const v2 = parseSave(v1);
    expect(v2.version).toBe(2);
    expect(v2.stars).toEqual({ "1": 3, "2": 1 });
    expect(v2.seenBefore).toEqual({ "1": true });
    expect(v2.bank).toEqual({});
  });

  it("the Seed Bank spends stars on perks, refunds, and never overspends", () => {
    const data = emptySave();
    data.stars = { "1": 3, "2": 3 };
    expect(freeStars(data)).toBe(6);
    expect(buyPerk(data, "pockets")).toBe(true);
    expect(buyPerk(data, "pockets")).toBe(true);
    expect(freeStars(data)).toBe(3);
    expect(perksOf(data).marks).toBe(60);
    expect(buyPerk(data, "neighbours")).toBe(true);
    expect(freeStars(data)).toBe(0);
    expect(buyPerk(data, "apron")).toBe(false);
    expect(perksOf(data).goodwill).toBe(2);
    refundAll(data);
    expect(freeStars(data)).toBe(6);
    // A tampered save that spends more stars than it has gets its bank refunded.
    const bad = parseSave(JSON.stringify({ stars: { "1": 1 }, bank: { pin: 3 } }));
    expect(bad.bank).toEqual({});
    expect(nextCost(bad, "pin")).toBe(PERKS.find((p) => p.id === "pin")!.costs[0]);
  });

  it("unlocks level n only after level n-1 is cleared", () => {
    const data = emptySave();
    expect(isUnlocked(data, 1)).toBe(true);
    expect(isUnlocked(data, 2)).toBe(false);
    data.stars["1"] = 1;
    expect(isUnlocked(data, 2)).toBe(true);
  });
});
