import { describe, expect, it } from "vitest";
import {
  STEP,
  TOWERS,
  TOWER_VS,
  isPlot,
  plotKind,
  HIGH_GROUND_RANGE,
  newGame,
  place,
  pointAt,
  enemyPoint,
  lobbied,
  laneCellsOf,
  sell,
  sellValue,
  sendWave,
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
  MANUAL as MANUAL_CAST,
  POST_RADIUS,
  pieCooldown,
  setTarget,
  towerStats,
  upgrade,
  type Game,
  type GameEvent,
  type Level,
} from "../games/hedgerow/src/engine";
import { LEVELS, ORIGINAL_PATHS } from "../games/hedgerow/src/levels";
import { playLevel } from "../games/hedgerow/src/bot";
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
  keepGoingFor,
  setKeepGoing,
  recordCast,
  autoEarned,
  autoOn,
  setAuto,
  fastestSpeed,
} from "../games/hedgerow/src/store";


/** Cath and her abilities left to the test, not the auto-battler. */
const MANUAL = {};

describe("hedgerow engine", () => {
  const level = classic(1);

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

  it("is deterministic: the same build order gives the same result", { timeout: 20_000 }, () => {
    const a = playLevel(LEVELS[11]!, "competent");
    const b = playLevel(LEVELS[11]!, "competent");
    expect([a.tick, a.goodwill, a.marks]).toEqual([
      b.tick,
      b.goodwill,
      b.marks,
    ]);
  });

  it("a beehive stings every enemy near its target", () => {
    const lv = classic(4);
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
    const game = newGame(classic(3));
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
    const lv = classic(13);
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
    expect(g2.marks).toBe(before + 14 + 3 + TOWERS.stall.income![0]);
  });

  it("a price-war truck breaks into drones", () => {
    const game = newGame(classic(14));
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
    const lv = classic(21);
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
    const lv = classic(38);
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
    // A bulldozer is heavy plant too: turnips barely dent it, grain-shot hits it extra hard.
    expect(hpAfter("scarecrow")).toBeCloseTo(1000 - TOWERS.scarecrow.damage[0] * TOWER_VS.scarecrow!.heavy! * 0.5);
    expect(hpAfter("silo")).toBeCloseTo(1000 - TOWERS.silo.damage[0] * TOWER_VS.silo!.heavy!);
  });

  it("stealth units are untouchable until a Radio Mast reveals them, and the mast marks targets", () => {
    const lv = classic(45);
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
    const g = newGame(classic(50), NO_PERKS, MANUAL);
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
    const lv = classic(55);
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
    const lv = classic(65);
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
    const lv = classic(63);
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

  it("a lobbyist strips a specialised tower back to tier 3 while in range", () => {
    const g = newGame(classic(63));
    place(g, "scarecrow", 5, 0);
    const tw = g.towers[0]!;
    tw.tier = 4;
    tw.spec = 0;
    expect(lobbied(g, tw)).toBe(false);
    const p = enemyPoint(g.level, { dist: 4.5 });
    expect(Math.hypot(tw.col + 0.5 - p.x, tw.row + 0.5 - p.y)).toBeLessThan(1.6);
    g.enemies.push({ id: 1, kind: "lobbyist", dist: 4.5, hp: 10, slowed: false, stun: 0 });
    expect(lobbied(g, tw)).toBe(true);
    tw.mega = "harvester";
    expect(lobbied(g, tw)).toBe(false);
  });

  it("Pell's quad bike rams Cath when she is beside it and not holding it", () => {
    const g = newGame(classic(63));
    g.phase = "wave";
    const p = enemyPoint(g.level, { dist: 3 });
    g.hero.x = g.hero.tx = p.x;
    g.hero.y = g.hero.ty = p.y;
    g.enemies.push({ id: 901, kind: "rival", dist: 3, hp: 1e6, slowed: false, stun: 0 });
    const before = g.hero.hp;
    for (let i = 0; i < 30; i++) stepGame(g);
    expect(g.hero.hp).toBeLessThan(before);
  });

  it("a drone carrier launches drones on a timer", () => {
    const g = newGame(classic(63));
    g.enemies.push({ id: 900, kind: "carrier", dist: 3, hp: 1e6, slowed: false, stun: 0 });
    g.phase = "wave";
    for (let i = 0; i < 30 * 6; i++) stepGame(g);
    expect(g.enemies.filter((e) => e.kind === "drone").length).toBeGreaterThanOrEqual(2);
  });

  it("a Union Hall lifts every tower's damage from anywhere on the map", () => {
    const lv = classic(75);
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
    const g = newGame(classic(90));
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
    const g = newGame(classic(100));
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

  it("forked levels send enemies down a second lane that joins the first and still leaks Goodwill", () => {
    const forked = LEVELS.filter((l) => l.path2);
    expect(forked.length).toBeGreaterThanOrEqual(10);
    const lv = forked[0]!;
    const cells = laneCellsOf(lv);
    for (const [c, r] of lv.path2!) expect(cells.has(`${c},${r}`)).toBe(true);
    const g = newGame(lv);
    expect(g.pathLength2).toBeGreaterThan(0);
    sendWave(g);
    for (let i = 0; i < 20 * 30; i++) stepGame(g);
    const second = g.enemies.filter((e) => e.lane === 1);
    expect(second.length).toBeGreaterThan(0);
    const p = enemyPoint(lv, second[0]!);
    expect(Math.abs(p.y - (lv.path2![0]![1] + 0.5)) < 99).toBe(true);
    for (let i = 0; i < 120 * 30 && g.goodwill === g.maxGoodwill; i++)
      stepGame(g);
    expect(g.goodwill).toBeLessThan(g.maxGoodwill);
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

});

/** A level as first designed: its original serpentine lane, no fork, no terrain, no twist, no tuning. */
function classic(id: number): Level {
  const lv = LEVELS[id - 1]!;
  // Levels 1-10 play the Fleet now (Hedgerow 2 M2); the mechanics tests run them on classic rules.
  return { ...lv, path: ORIGINAL_PATHS.get(id)!, path2: undefined, terrain: undefined, twists: undefined, hpScale: undefined, rules: "classic", book: undefined };
}

/** A bare level for mechanics tests: a straight lane along row 1 of a 12x3 field. */
function strip(overrides: Partial<Level> = {}): Level {
  return {
    ...LEVELS[40]!,
    twists: undefined,
    hpScale: undefined,
    path2: undefined,
    terrain: undefined,
    id: 50,
    cols: 12,
    rows: 3,
    path: [
      [0, 1],
      [11, 1],
    ],
    startMarks: 5000,
    goodwill: 20,
    waves: [
      [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
      [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
    ],
    ...overrides,
  } as Level;
}

function spawn(
  game: Game,
  kind: Game["enemies"][number]["kind"],
  dist: number,
  hp?: number,
) {
  const e: Game["enemies"][number] = {
    id: game.nextId++,
    kind,
    dist,
    hp: hp ?? 1000,
    slowed: false,
    stun: 0,
    wave: 1,
  };
  game.enemies.push(e);
  return e;
}

describe("hedgerow 2 M1: hands-on pacing", () => {
  it("Cath stays within her post radius all level long, whatever comes", () => {
    for (const lv of [LEVELS[0]!, LEVELS[4]!, LEVELS[11]!]) {
      const game = newGame(lv);
      const post = { x: game.hero.x, y: game.hero.y };
      sendWave(game);
      let far = 0;
      for (let i = 0; i < 30 * 400 && game.phase !== "won" && game.phase !== "lost"; i++) {
        if (game.phase === "build") sendWave(game);
        stepGame(game);
        far = Math.max(far, Math.hypot(game.hero.x - post.x, game.hero.y - post.y));
      }
      expect(far).toBeLessThanOrEqual(POST_RADIUS);
    }
  });

  it("Cath changes post only between rounds", () => {
    const game = newGame(strip());
    expect(moveHero(game, 2.5, 0.5).ok).toBe(true);
    sendWave(game);
    expect(moveHero(game, 8.5, 0.5).ok).toBe(false);
    expect(game.hero.tx).toBe(2.5);
  });

  it("abilities never fire without Auto, and fire with it", () => {
    const crowd = (auto: Parameters<typeof newGame>[2]) => {
      const game = newGame(strip({ id: 50 }), NO_PERKS, auto);
      place(game, "hedgerow", 0, 0);
      sendWave(game);
      game.spawnQueue = [];
      for (let i = 0; i < 12; i++) spawn(game, "van", 8 + i * 0.2, 1e6);
      for (let i = 0; i < 30 * 20; i++) stepGame(game);
      return game;
    };
    const off = crowd({});
    expect(off.pieCd).toBe(0);
    expect(off.neighboursCd).toBe(0);
    expect(off.rallyCd).toBe(0);
    expect(off.events.some((e) => e.type === "pie" || e.type === "neighbours" || e.type === "rally")).toBe(false);
    const pieOnly = crowd({ pie: true });
    expect(pieOnly.events.some((e) => e.type === "pie")).toBe(true);
    expect(pieOnly.events.some((e) => e.type === "neighbours" || e.type === "rally")).toBe(false);
    const all = crowd({ pie: true, neighbours: true, rally: true });
    expect(all.events.some((e) => e.type === "rally")).toBe(true);
    // Every ability starts manual.
    expect(newGame(LEVELS[60]!).auto).toEqual(MANUAL_CAST);
  });

  it("stacking rounds is deterministic and pays the early bonus", () => {
    const run = () => {
      const game = newGame(classic(8));
      game.marks = 5000;
      place(game, "scarecrow", 1, 0);
      sendWave(game);
      const bonuses: number[] = [];
      for (let i = 0; i < 30 * 300 && game.phase !== "won" && game.phase !== "lost"; i++) {
        if (game.phase === "build" || (canCallEarly(game) && game.waveClock > 2)) {
          const before = game.marks;
          const early = game.phase === "wave" ? earlyBonus(game) : 0;
          if (sendWave(game).ok && early) bonuses.push(game.marks - before);
        }
        stepGame(game);
      }
      return { bonuses, tick: game.tick, marks: game.marks, goodwill: game.goodwill, wave: game.wave, phase: game.phase };
    };
    const a = run();
    expect(a.bonuses.length).toBeGreaterThan(2);
    expect(a.bonuses[0]).toBe(10 + 1);
    expect(run()).toEqual(a);
  });

  it("Keep Going is off on levels 1-5, then on by default and remembered", () => {
    const d = emptySave();
    for (let id = 1; id <= 5; id++) expect(keepGoingFor(d, id)).toBe(false);
    expect(keepGoingFor(d, 6)).toBe(true);
    setKeepGoing(d, false);
    const back = parseSave(JSON.stringify(d));
    expect(keepGoingFor(back, 40)).toBe(false);
    expect(keepGoingFor(back, 3)).toBe(false);
    setKeepGoing(back, true);
    expect(keepGoingFor(parseSave(JSON.stringify(back)), 40)).toBe(true);
  });

  it("an ability earns Auto after three hand casts, and x5 opens after a win", () => {
    const d = emptySave();
    setAuto(d, "pie", true);
    expect(autoOn(d, "pie")).toBe(false);
    recordCast(d, "pie");
    recordCast(d, "pie");
    expect(autoEarned(d, "pie")).toBe(false);
    expect(recordCast(d, "pie")).toBe(3);
    const back = parseSave(JSON.stringify(d));
    expect(autoEarned(back, "pie")).toBe(true);
    expect(autoOn(back, "pie")).toBe(true);
    expect(autoEarned(back, "rally")).toBe(false);
    expect(fastestSpeed(back, 4)).toBe(3);
    recordStars(back, 4, 1);
    expect(fastestSpeed(back, 4)).toBe(5);
  });

  // Hedgerow 2 M2: on the Fleet a kill is a final pop; Cath knocks two layers a swing and holds the rest for
  // the towers, so her share is real but small (2-20%). Her kits (M6) bring it up to the 10-15% the design wants.
  it("on level 1 the best bot wins with Cath taking a real but small share of the kills (2-20%)", () => {
    const g = playLevel(LEVELS[0]!, "best");
    expect(g.phase).toBe("won");
    const kills = g.events.filter((e) => e.type === "kill").length;
    expect(g.hero.kills / kills).toBeLessThan(0.2);
    expect(g.hero.kills / kills).toBeGreaterThanOrEqual(0.02);
    expect(g.events.some((e) => e.type === "pie" || e.type === "neighbours" || e.type === "rally")).toBe(false);
  }, 60_000);
});

describe("hedgerow 2 M1 review: level 1 forgives plot choice", () => {
  // Hedgerow 2 M2: level 1 plays the Fleet. A simple build (four Scarecrows on random lane-side plots, upgraded
  // as the Marks come in) wins most of the time losing some Goodwill; the lazy build loses (hedgerow-fleet).
  it("four Scarecrows on random lane-side plots, upgraded as Marks allow, win level 1 most of the time, losing some Goodwill", () => {
    const lv = LEVELS[0]!;
    const lane = laneCellsOf(lv);
    const plots: [number, number][] = [];
    for (let r = 0; r < lv.rows; r++)
      for (let c = 0; c < lv.cols; c++)
        if (isPlot(lv, c, r) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => lane.has(`${c + dx!},${r + dy!}`))) plots.push([c, r]);
    let seed = 11;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const N = 40;
    let won = 0;
    let lostGoodwill = 0;
    for (let i = 0; i < N; i++) {
      const order = plots
        .map((p) => ({ p, k: rnd() }))
        .sort((a, b) => a.k - b.k)
        .slice(0, 4)
        .map((x) => x.p);
      const g = newGame(lv);
      let k = 0;
      while (g.phase !== "won" && g.phase !== "lost" && g.tick < 30 * 1000) {
        if (g.phase === "build") {
          while (k < order.length && place(g, "scarecrow", order[k]![0], order[k]![1]).ok) k++;
          for (let u = 0; u < 8; u++) {
            const t = [...g.towers].sort((a, b) => a.tier - b.tier)[0];
            if (!t || t.tier >= 3 || !upgrade(g, t.id).ok) break;
          }
          sendWave(g);
        }
        stepGame(g);
      }
      if (g.phase === "won") won++;
      lostGoodwill += g.maxGoodwill - g.goodwill;
    }
    expect(won / N).toBeGreaterThanOrEqual(0.75);
    expect(lostGoodwill).toBeGreaterThan(0);
  }, 180_000);

  it("on levels 1-5 Cath works on what she holds when nothing else is in reach; later she only holds it", () => {
    for (const [id, hurts] of [
      [3, true],
      [50, false],
    ] as const) {
      const game = newGame(strip({ id }), NO_PERKS, MANUAL);
      sendWave(game);
      game.spawnQueue = [];
      game.hero.x = game.hero.tx = 6.5;
      game.hero.y = game.hero.ty = 1.5;
      const van = spawn(game, "van", 6, 500);
      for (let i = 0; i < 60; i++) stepGame(game);
      expect(van.held).toBe(true);
      expect(van.hp < 500).toBe(hurts);
    }
  });
});

describe("hedgerow: Cath on the battlefield", () => {
  it("holds two vans in place, takes hits back and whacks only a third (the towers finish what she holds)", () => {
    const game = newGame(strip(), NO_PERKS, MANUAL);
    moveHero(game, 6.5, 1.5);
    for (let i = 0; i < 120; i++) stepGame(game); // build phase: nothing moves
    sendWave(game);
    game.spawnQueue = [];
    game.hero.x = 6.5;
    game.hero.y = 1.5;
    const van = spawn(game, "van", 6, 500);
    const van2 = spawn(game, "van", 6.05, 500);
    for (let i = 0; i < 30; i++) stepGame(game);
    expect(van.held).toBe(true);
    expect(van2.held).toBe(true);
    expect(van.dist).toBe(6);
    expect(van.hp).toBe(500);
    expect(game.hero.hp).toBeLessThan(game.hero.maxHp);
    const third = spawn(game, "van", 6.1, 500);
    for (let i = 0; i < 30; i++) stepGame(game);
    expect(third.held).toBe(false);
    expect(third.hp).toBeLessThan(500);
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
    expect(
      moveHero({ ...game, hero: { ...game.hero, down: 3 } }, 1, 1).ok,
    ).toBe(false);
  });

  it("marks what she was holding when she goes down, so its leak names her", () => {
    const game = newGame(strip());
    sendWave(game);
    game.spawnQueue = [];
    game.hero.x = game.hero.tx = 6.5;
    game.hero.y = game.hero.ty = 1.5;
    const a = spawn(game, "tender", 6, 100000);
    const b = spawn(game, "tender", 6.1, 100000);
    const leaks: GameEvent[] = [];
    for (let i = 0; i < 30 * 120 && game.phase === "wave"; i++) {
      game.events = [];
      stepGame(game);
      leaks.push(...game.events.filter((e) => e.type === "leak"));
    }
    expect(a.dropped && b.dropped).toBe(true);
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.every((e) => e.type === "leak" && e.dropped)).toBe(true);
  });

  it("walks where she is sent, and lets go while walking", () => {
    const game = newGame(strip(), NO_PERKS, MANUAL);
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
      return shot && shot.type === "shot"
        ? Math.round(shot.toX * 10) / 10
        : null;
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
    const build = (
      kind: Parameters<typeof place>[1],
      col: number,
      row: number,
      spec: 0 | 1,
    ) => {
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
  const run = (
    kind: Parameters<typeof spawn>[1],
    secs: number,
    setup?: (g: Game) => void,
  ) => {
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
    const shots = () =>
      game.events.filter((e) => e.type === "shot" && e.tower === flat.id)
        .length;
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
    const game = newGame(
      strip({
        waves: [
          [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
          [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
          [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
        ],
      }),
    );
    game.hero.x = game.hero.tx = 0.5;
    game.hero.y = game.hero.ty = 0.5;
    expect(canCallEarly(game)).toBe(false);
    sendWave(game);
    stepGame(game);
    expect(canCallEarly(game)).toBe(false); // a moment's grace against double taps
    for (let i = 0; i < 30; i++) stepGame(game);
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
    expect(game.marks).toBe(m + 2 * ENEMIES_VAN_BOUNTY + (14 + 3) + (14 + 6));
    expect(game.phase).toBe("build");
  });
});

describe("hedgerow: perks", () => {
  it("add Marks, Goodwill and a faster pie; discounts lower prices", () => {
    const perks = {
      ...NO_PERKS,
      marks: 50,
      goodwill: 3,
      pieCooldown: 0.5,
      discount: 0.1,
    };
    const lv = classic(5);
    const game = newGame(lv, perks);
    expect(game.marks).toBe(lv.startMarks + 50);
    expect(game.goodwill).toBe(lv.goodwill + 3);
    expect(pieCooldown(game)).toBe(PIE_COOLDOWN * 0.5);
    const m = game.marks;
    place(game, "scarecrow", 0, 0);
    expect(game.marks).toBe(m - Math.round(TOWERS.scarecrow.cost * 0.9));
  });
});

const ENEMIES_VAN_BOUNTY = 7;


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
    const v1 = JSON.stringify({
      version: 1,
      stars: { "1": 3, "2": 1 },
      seenBefore: { "1": true },
    });
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
    const bad = parseSave(
      JSON.stringify({ stars: { "1": 1 }, bank: { pin: 3 } }),
    );
    expect(bad.bank).toEqual({});
    expect(nextCost(bad, "pin")).toBe(
      PERKS.find((p) => p.id === "pin")!.costs[0],
    );
  });

  it("unlocks level n only after level n-1 is cleared", () => {
    const data = emptySave();
    expect(isUnlocked(data, 1)).toBe(true);
    expect(isUnlocked(data, 2)).toBe(false);
    data.stars["1"] = 1;
    expect(isUnlocked(data, 2)).toBe(true);
  });
});

describe("Cath's calls", () => {
  it("the neighbours stop foot traffic and Rally speeds towers", async () => {
    const eng = await import("../games/hedgerow/src/engine");
    const levels = await import("../games/hedgerow/src/levels");
    const lv = levels.LEVELS.find((l) => l.id === 25)!;
    const g = eng.newGame(lv);
    expect(eng.callNeighbours(g).ok).toBe(false);
    eng.sendWave(g);
    for (let i = 0; i < 400 && g.enemies.length === 0; i++) eng.stepGame(g);
    expect(eng.callRally(g).ok).toBe(false); // no towers yet
    expect(eng.callNeighbours(g).ok).toBe(true);
    const bar = g.barricade!.dist;
    for (let i = 0; i < 30 * 5; i++) eng.stepGame(g);
    for (const e of g.enemies)
      if (!eng.isBig(e.kind)) expect(e.dist).toBeLessThanOrEqual(bar + 1e-6);
    expect(eng.callNeighbours(g).ok).toBe(false); // cooling down
  });

  it("terrain: high ground adds range, water takes ponds only, and every level keeps plain plots", () => {
    let withHigh = 0;
    for (const lv of LEVELS) {
      const t = lv.terrain;
      if (lv.id < 4) {
        expect(t).toBeUndefined();
        continue;
      }
      expect(t!.high.length).toBeGreaterThan(0);
      withHigh++;
      for (const [c, r] of [...t!.high, ...t!.water])
        expect(isPlot(lv, c, r)).toBe(true);
      expect(t!.high.length + t!.water.length).toBeLessThan(
        (lv.cols * lv.rows) / 6,
      );
    }
    expect(withHigh).toBe(97);
    const lv = LEVELS.find((l) => l.terrain?.water.length)!;
    const [wc, wr] = lv.terrain!.water[0]!;
    const [hc, hr] = lv.terrain!.high[0]!;
    const game = newGame({
      ...lv,
      startMarks: 5000,
      towers: ["scarecrow", "pond"],
    });
    expect(place(game, "scarecrow", wc, wr).ok).toBe(false);
    expect(place(game, "pond", wc, wr).ok).toBe(true);
    expect(plotKind(lv, hc, hr)).toBe("high");
    expect(place(game, "scarecrow", hc, hr).ok).toBe(true);
    const tw = towerAt(game, hc, hr)!;
    expect(towerStats(tw).range).toBeCloseTo(
      TOWERS.scarecrow.range[0] * HIGH_GROUND_RANGE,
    );
  });
});
