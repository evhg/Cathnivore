// Hedgerow 2 M9: difficulties, Hollow's rules and medals (docs/design/hedgerow-2.md section 9).
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { hitEnemy, makeEnemy, isFleet, isPlot, newGame, place, sell, towerCost } from "../games/hedgerow/src/engine";
import { Recorder, restoreRun, startGame } from "../games/hedgerow/src/replay";
import { stepGame } from "../games/hedgerow/src/engine";
import { emptySave, medalsOf, recordMedal } from "../games/hedgerow/src/store";

const fleet = LEVELS.find((l) => isFleet(l) && !l.endless)!;
const classic = LEVELS.find((l) => !isFleet(l) && !l.endless)!;

describe("difficulty rules", () => {
  it("Easy, Normal and Hard set Goodwill and tower prices on Fleet levels", () => {
    const e = newGame(fleet, undefined, {}, false, "easy");
    const n = newGame(fleet);
    const h = newGame(fleet, undefined, {}, false, "hard");
    expect([e.goodwill, n.goodwill, h.goodwill]).toEqual([200, 120, 80]);
    expect(towerCost(e, "scarecrow")).toBeLessThan(towerCost(n, "scarecrow"));
    expect(towerCost(h, "scarecrow")).toBeGreaterThan(towerCost(n, "scarecrow"));
  });
  it("classic levels ignore the difficulty", () => {
    const g = newGame(classic, undefined, {}, false, "hard");
    expect(g.difficulty).toBe("normal");
    expect(g.goodwill).toBe(newGame(classic).goodwill);
  });
  it("Hollow has one Goodwill and bars selling", () => {
    const g = newGame(fleet, undefined, {}, true);
    expect(g.goodwill).toBe(1);
    g.marks = 9999;
    let spot: [number, number] | null = null;
    for (let r = 0; r < fleet.rows && !spot; r++) for (let c = 0; c < fleet.cols && !spot; c++) if (isPlot(fleet, c, r)) spot = [c, r];
    expect(place(g, "scarecrow", spot![0], spot![1]).ok).toBe(true);
    expect(sell(g, g.towers[0]!.id).ok).toBe(false);
    expect(g.towers).toHaveLength(1);
  });
});

describe("medals", () => {
  it("record once, and old stars and Heroic migrate", () => {
    const d = emptySave();
    expect(recordMedal(d, 3, "hard")).toBe(true);
    expect(recordMedal(d, 3, "hard")).toBe(false);
    expect(medalsOf(d, 3)).toEqual(["hard"]);
    d.stars["4"] = 3;
    d.heroic = { "4": true };
    expect(medalsOf(d, 4)).toEqual(["easy", "normal", "hollow"]);
    d.stars["5"] = 2;
    expect(medalsOf(d, 5)).toEqual(["easy"]);
  });
});

describe("close calls", () => {
  it("a pop within 1.5 cells of the farmhouse counts once per beat", () => {
    const g = newGame(fleet);
    const far = makeEnemy(g, "van", 3, undefined, 1);
    hitEnemy(g, far, 1);
    expect(g.closeCalls).toBe(0);
    const near = makeEnemy(g, "van", g.pathLength - 1, undefined, 1);
    hitEnemy(g, near, 1);
    expect(g.closeCalls).toBe(1);
    expect(g.events.some((e) => e.type === "closeCall")).toBe(true);
    const again = makeEnemy(g, "van", g.pathLength - 1, undefined, 1);
    hitEnemy(g, again, 1);
    expect(g.closeCalls).toBe(1);
  });
});

describe("remixes", () => {
  it("Hand Tools bars the other towers and Lean Year halves the purse", () => {
    const hand = newGame(fleet, undefined, {}, false, "normal", "hand");
    hand.marks = 99999;
    let spot: [number, number] | null = null;
    for (let r = 0; r < fleet.rows && !spot; r++) for (let c = 0; c < fleet.cols && !spot; c++) if (isPlot(fleet, c, r)) spot = [c, r];
    expect(place(hand, "stall", spot![0], spot![1]).ok).toBe(false);
    expect(place(hand, "scarecrow", spot![0], spot![1]).ok).toBe(true);
    const lean = newGame(fleet, undefined, {}, false, "normal", "lean");
    expect(lean.marks).toBe(Math.round(newGame(fleet).marks / 2));
    expect(newGame(classic, undefined, {}, false, "normal", "lean").remix).toBeNull();
  });
});

describe("continue", () => {
  it("restoreRun rebuilds the exact game a recorder had", () => {
    const setup = { mode: "level" as const, id: fleet.id, heroic: false, perks: newGame(fleet).perks, difficulty: "hard" as const };
    const g = startGame(fleet, setup);
    const rec = new Recorder(setup);
    rec.act(g, { t: "wave" } as never);
    for (let i = 0; i < 400; i++) rec.step(g);
    const back = restoreRun(fleet, JSON.parse(JSON.stringify(rec.replay())));
    stepGame(g);
    stepGame(back.game);
    expect(back.recorder.steps).toBe(rec.steps);
    expect(back.game.tick).toBe(g.tick);
    expect(back.game.marks).toBe(g.marks);
    expect(back.game.goodwill).toBe(g.goodwill);
    expect(back.game.enemies.length).toBe(g.enemies.length);
    expect(back.game.difficulty).toBe("hard");
  });
});

describe("Long Haul and Hollow's window", () => {
  const base = { heroic: false, perks: undefined as never };
  it("Long Haul runs the window on to round 80", () => {
    const g = startGame(fleet, { mode: "level", id: fleet.id, ...base, perks: newGame(fleet).perks ?? ({} as never), remix: "long" } as never);
    expect(g.level.book!.to).toBe(80);
    expect(g.level.waves).toHaveLength(80 - g.level.book!.from + 1);
  });
  it("Hollow starts five rounds further into the Book with a bigger purse", () => {
    const g = startGame(fleet, { mode: "level", id: fleet.id, heroic: true, shift: 5 } as never);
    expect(g.level.book!.from).toBe(fleet.book!.from + 5);
    expect(g.level.waves).toHaveLength(fleet.waves.length);
    expect(g.level.startMarks).toBeGreaterThan(fleet.startMarks);
    const old = startGame(fleet, { mode: "level", id: fleet.id, heroic: true } as never);
    expect(old.level.book).toEqual(fleet.book);
  });
});

describe("remix medals", () => {
  it("keeps remix medals apart from the four mode medals", async () => {
    const { remixMedalsOf } = await import("../games/hedgerow/src/store");
    const d = emptySave();
    expect(recordMedal(d, 9, "lean")).toBe(true);
    expect(recordMedal(d, 9, "lean")).toBe(false);
    expect(remixMedalsOf(d, 9)).toEqual(["lean"]);
    expect(medalsOf(d, 9)).toEqual([]);
  });
});
