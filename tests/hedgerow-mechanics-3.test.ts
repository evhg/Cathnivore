import { describe, expect, it } from "vitest";
import {
  DUEL_AUTO,
  DUEL_BITE,
  WRAP_LEAK,
  DUEL_ROUNDS,
  MEGAS,
  RANKS,
  NO_PERKS,
  STEP,
  TOWERS,
  duelStrike,
  makeEnemy,
  merge,
  mergeOptions,
  newGame,
  place,
  rankOf,
  sendWave,
  stepGame,
  throwPie,
  towerAt,
  towerStats,
  upgrade,
  type Game,
  type Level,
  type TowerKind,
} from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";

const MANUAL = { hero: false, abilities: false };
const ALL: TowerKind[] = Object.keys(TOWERS) as TowerKind[];

/** A straight lane along row 1 of a 12x3 field, every tower unlocked. */
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
    towers: ALL,
    startMarks: 9000,
    goodwill: 20,
    waves: [
      [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
      [{ enemy: "van", count: 1, gap: 1, delay: 0 }],
    ],
    ...overrides,
  } as Level;
}

function started(level = strip(), perks = NO_PERKS): Game {
  const game = newGame(level, perks, MANUAL);
  sendWave(game);
  game.spawnQueue = [];
  return game;
}

function grow(game: Game, kind: TowerKind, col: number, row: number, tier = 3) {
  expect(place(game, kind, col, row).ok).toBe(true);
  const t = towerAt(game, col, row)!;
  while (t.tier < tier) expect(upgrade(game, t.id, 0).ok).toBe(true);
  return t;
}

describe("hedgerow round 3: bubble-wrapped vans", () => {
  it("single-target shots do a quarter damage until splash pops the wrap", () => {
    const game = started();
    grow(game, "scarecrow", 3, 0, 1);
    const e = makeEnemy(game, "wrapped", 3, undefined, 1);
    e.hp = e.maxHp = 1000;
    e.stun = 100;
    game.enemies.push(e);
    stepGame(game);
    expect(1000 - e.hp).toBeCloseTo(TOWERS.scarecrow.damage[0] * WRAP_LEAK);
    expect(e.shield).toBe(1);

    const g2 = started();
    grow(g2, "beehive", 3, 0, 1);
    const w = makeEnemy(g2, "wrapped", 3, undefined, 1);
    w.hp = w.maxHp = 1000;
    w.stun = 100;
    g2.enemies.push(w);
    stepGame(g2);
    expect(1000 - w.hp).toBeCloseTo(TOWERS.beehive.damage[0]);
    expect(w.shield).toBe(0);
    expect(g2.events.some((ev) => ev.type === "pop")).toBe(true);
  });

  it("Cath's pie goes through the wrap and pops it", () => {
    const game = started(strip({ id: 50 }));
    const e = makeEnemy(game, "wrapped", 4, undefined, 1);
    game.enemies.push(e);
    const before = e.hp;
    expect(throwPie(game).ok).toBe(true);
    expect(e.hp).toBeLessThan(before);
    expect(e.shield).toBe(0);
  });
});

describe("hedgerow round 3: windmills and seed cannons", () => {
  it("a windmill gust blows vans back up the lane, but not the same van twice in quick succession", () => {
    const game = started();
    grow(game, "windmill", 5, 0, 1);
    const a = makeEnemy(game, "van", 5, undefined, 1);
    a.hp = a.maxHp = 5000;
    a.stun = 100;
    game.enemies.push(a);
    let gusts = 0;
    let minDist = Infinity;
    for (let i = 0; i < 30 * 2.5; i++) {
      const before = a.dist;
      stepGame(game);
      if (a.dist < before) gusts++;
      minDist = Math.min(minDist, a.dist);
    }
    expect(gusts).toBe(1);
    expect(minDist).toBeLessThan(5);
    expect(a.hp).toBeLessThan(5000);
    expect(game.events.some((ev) => ev.type === "gust")).toBe(true);
  });

  it("a seed cannon reaches far and bursts over a group, but can't hit drones", () => {
    const s = towerStats({ kind: "cannon", tier: 1 });
    expect(s.range).toBeGreaterThan(3);
    expect(s.splash).toBeGreaterThan(1);
    expect(s.air).toBe(false);
    const game = started();
    grow(game, "cannon", 2, 0, 1);
    const a = makeEnemy(game, "van", 5, undefined, 1);
    const b = makeEnemy(game, "van", 5.6, undefined, 1);
    a.hp = b.hp = 5000;
    game.enemies.push(a, b);
    stepGame(game);
    expect(a.hp).toBeLessThan(5000);
    expect(b.hp).toBeLessThan(5000);
  });
});

describe("hedgerow round 3: megastructures", () => {
  it("two grown neighbours from a recipe merge into one building covering both plots", () => {
    const game = newGame(strip(), NO_PERKS, MANUAL);
    const a = grow(game, "scarecrow", 3, 0);
    const b = grow(game, "silo", 4, 0);
    grow(game, "beehive", 3, 2);
    const opts = mergeOptions(game, a.id);
    expect(opts).toEqual([{ tower: a.id, partner: b.id, mega: "harvester", cost: MEGAS.harvester.cost }]);
    const marks = game.marks;
    const spent = a.spent + b.spent;
    expect(merge(game, a.id, b.id).ok).toBe(true);
    expect(game.marks).toBe(marks - MEGAS.harvester.cost);
    expect(game.towers.find((t) => t.id === b.id)).toBeUndefined();
    expect(towerAt(game, 4, 0)?.id).toBe(a.id);
    expect(a.spent).toBe(spent + MEGAS.harvester.cost);
    const st = towerStats(a);
    expect(st.damage).toBe(MEGAS.harvester.damage);
    expect(st.pierce).toBe(true);
    expect(place(game, "hedgerow", 4, 0).ok).toBe(false);
  });

  it("refuses tier-2 towers, strangers, non-neighbours and early levels", () => {
    const game = newGame(strip(), NO_PERKS, MANUAL);
    const a = grow(game, "scarecrow", 3, 0, 2);
    const b = grow(game, "silo", 4, 0);
    expect(mergeOptions(game, a.id)).toEqual([]);
    expect(merge(game, a.id, b.id).ok).toBe(false);
    const c = grow(game, "hedgerow", 6, 0);
    const d = grow(game, "silo", 7, 0);
    expect(mergeOptions(game, c.id)).toEqual([]);
    const e = grow(game, "scarecrow", 9, 0);
    expect(mergeOptions(game, e.id)).toEqual([]);
    expect(mergeOptions(game, d.id).length).toBe(0);
    const early = newGame(strip({ id: 5 }), NO_PERKS, MANUAL);
    const x = grow(early, "scarecrow", 3, 0);
    grow(early, "silo", 4, 0);
    expect(mergeOptions(early, x.id)).toEqual([]);
  });

  it("every recipe names two real towers and no pair makes two megas", () => {
    const seen = new Set<string>();
    for (const m of Object.values(MEGAS)) {
      expect(TOWERS[m.from[0]]).toBeDefined();
      expect(TOWERS[m.from[1]]).toBeDefined();
      const k = [...m.from].sort().join("+");
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe("hedgerow round 3: veterans", () => {
  it("towers rank up with kills and hit harder and further", () => {
    expect(rankOf(RANKS[0]! - 1)).toBe(0);
    expect(rankOf(RANKS[0]!)).toBe(1);
    expect(rankOf(999)).toBe(3);
    const base = towerStats({ kind: "scarecrow", tier: 2 });
    const vet = towerStats({ kind: "scarecrow", tier: 2, kills: RANKS[1]! });
    expect(vet.damage).toBeCloseTo(base.damage * 1.2);
    expect(vet.range).toBeCloseTo(base.range * 1.08);
  });

  it("the tower that lands the killing blow gets the kill", () => {
    const game = started();
    const t = grow(game, "scarecrow", 3, 0, 1);
    t.kills = RANKS[0]! - 1;
    const e = makeEnemy(game, "van", 3, undefined, 1);
    e.hp = 1;
    game.enemies.push(e);
    for (let i = 0; i < 5; i++) stepGame(game);
    expect(t.kills).toBe(RANKS[0]);
    const ev = game.events.find((x) => x.type === "rankUp");
    expect(ev).toMatchObject({ type: "rankUp", tower: t.id, rank: 1 });
  });
});

describe("hedgerow round 3: ambushes", () => {
  it("an ambush group bursts out partway down the lane, with a warning when the wave starts", () => {
    const game = newGame(
      strip({ waves: [[{ enemy: "van", count: 2, gap: 1, delay: 2, ambush: 0.5 }]] }),
      NO_PERKS,
      MANUAL,
    );
    sendWave(game);
    const warn = game.events.find((e) => e.type === "ambush");
    expect(warn).toMatchObject({ type: "ambush", x: 6, y: 1.5, in: 2 });
    for (let i = 0; i < 30 * 2 + 2; i++) stepGame(game);
    expect(game.enemies[0]!.dist).toBeGreaterThanOrEqual(5.5);
  });
});

describe("hedgerow round 3: boss duels", () => {
  const level = strip({ waves: [[{ enemy: "boss", count: 1, gap: 1, delay: 0 }]] });

  it("are off unless the browser turns them on (sims and the tuner never see them)", () => {
    const game = newGame(level, NO_PERKS, MANUAL);
    sendWave(game);
    stepGame(game);
    expect(game.duel).toBeNull();
  });

  it("freeze the field, take three strikes, and good timing takes a bite out of the boss", () => {
    const game = newGame(level, NO_PERKS, MANUAL);
    game.duels = true;
    sendWave(game);
    stepGame(game);
    expect(game.duel).not.toBeNull();
    const boss = game.enemies[0]!;
    const dist = boss.dist;
    const hp = boss.hp;
    for (let i = 0; i < 30; i++) stepGame(game);
    expect(boss.dist).toBe(dist);
    for (let r = 0; r < DUEL_ROUNDS; r++) expect(duelStrike(game, 1).ok).toBe(true);
    expect(game.duel).toBeNull();
    expect(boss.hp).toBeCloseTo(hp - boss.maxHp! * DUEL_BITE * DUEL_ROUNDS);
    expect(boss.stun).toBeGreaterThan(1);
    expect(game.hero.down).toBe(0);
    // Only once per boss kind.
    expect(game.dueled).toEqual(["boss"]);
  });

  it("swing on their own at half quality if nobody taps, and a bad duel knocks Cath down", () => {
    const game = newGame(level, NO_PERKS, MANUAL);
    game.duels = true;
    sendWave(game);
    stepGame(game);
    for (let i = 0; i < (DUEL_AUTO / STEP) * DUEL_ROUNDS + 5; i++) stepGame(game);
    expect(game.duel).toBeNull();
    expect(game.events.some((e) => e.type === "duelEnd" && e.won)).toBe(true);

    const bad = newGame(level, NO_PERKS, MANUAL);
    bad.duels = true;
    sendWave(bad);
    stepGame(bad);
    for (let r = 0; r < DUEL_ROUNDS; r++) duelStrike(bad, 0.1);
    expect(bad.hero.down).toBeGreaterThan(0);
  });
});
