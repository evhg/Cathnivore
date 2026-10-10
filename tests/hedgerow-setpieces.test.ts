import { describe, expect, it } from "vitest";
import {
  NO_PERKS,
  STEP,
  bridgeOpen,
  isRevealed,
  makeEnemy,
  newGame,
  place,
  sendWave,
  stepGame,
  type Level,
  type SetPiece,
} from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";

const MANUAL = {};

function strip(setPieces: SetPiece[], waves = 3): Level {
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
    waves: Array.from({ length: waves }, () => [{ enemy: "van" as const, count: 1, gap: 1, delay: 0 }]),
    setPieces,
  } as Level;
}

describe("hedgerow set pieces", () => {
  it("a flood washes out towers on its plots when its wave is called, and then takes only ponds", () => {
    const game = newGame(strip([{ kind: "flood", wave: 2, cells: [[3, 0], [4, 0]], from: 3, to: 5 }]), NO_PERKS, MANUAL);
    expect(place(game, "scarecrow", 3, 0).ok).toBe(true);
    sendWave(game);
    expect(game.events.some((e) => e.type === "flood" && e.warn)).toBe(true);
    game.spawnQueue = [];
    game.enemies = [];
    stepGame(game);
    expect(game.phase).toBe("build");
    sendWave(game);
    expect(game.towers[0]!.out).toBeGreaterThan(10);
    expect(place(game, "hedgerow", 4, 0).ok).toBe(false);
    expect(place(game, "pond", 4, 0).ok).toBe(true);
    // Vehicles wade through the flooded stretch.
    game.spawnQueue = [];
    const e = makeEnemy(game, "van", 3.5, undefined, 2);
    game.enemies = [e];
    stepGame(game);
    expect(e.dist - 3.5).toBeLessThan(0.9 * STEP * 0.7);
  });

  it("a swing bridge stops traffic while it's open, then lets it through", () => {
    const level = strip([{ kind: "bridge", dist: 5, period: 10, open: 4 }]);
    const game = newGame(level, NO_PERKS, MANUAL);
    sendWave(game);
    game.spawnQueue = [];
    const e = makeEnemy(game, "van", 4.6, undefined, 1);
    e.hp = e.maxHp = 1e6;
    game.enemies = [e];
    while (!bridgeOpen(game)) stepGame(game);
    e.dist = 4.6;
    for (let i = 0; i < 3 / STEP; i++) stepGame(game);
    expect(e.dist).toBeLessThanOrEqual(5);
    expect(e.dist).toBeGreaterThan(4.8);
    while (bridgeOpen(game)) stepGame(game);
    for (let i = 0; i < 2 / STEP; i++) stepGame(game);
    expect(e.dist).toBeGreaterThan(5.5);
    expect(game.events.some((ev) => ev.type === "bridge")).toBe(true);
  });

  it("in a blackout only what the towers and Cath light up can be targeted", () => {
    const game = newGame(strip([{ kind: "blackout", light: 2 }]), NO_PERKS, MANUAL);
    place(game, "scarecrow", 2, 0);
    sendWave(game);
    game.hero.x = 10;
    game.hero.y = 1.5;
    const near = makeEnemy(game, "van", 2, undefined, 1);
    const far = makeEnemy(game, "van", 6, undefined, 1);
    const byCath = makeEnemy(game, "van", 9.5, undefined, 1);
    expect(isRevealed(game, near)).toBe(true);
    expect(isRevealed(game, far)).toBe(false);
    expect(isRevealed(game, byCath)).toBe(true);
  });

  it("are placed on their levels", () => {
    const kinds = (id: number) => LEVELS[id - 1]!.setPieces?.map((p) => p.kind);
    expect(kinds(34)).toEqual(["flood"]);
    expect(kinds(27)).toEqual(["bridge"]);
    expect(kinds(67)).toEqual(["blackout"]);
    const flood = LEVELS[33]!.setPieces![0]!;
    expect(flood.kind === "flood" && flood.cells.length).toBeGreaterThan(3);
  });
});
