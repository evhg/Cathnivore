import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { NO_PERKS, towerAt } from "../games/hedgerow/src/engine";
import { Player, Recorder, decodeReplay, encodeReplay, startGame, type Setup } from "../games/hedgerow/src/replay";

describe("hedgerow replays", () => {
  const level = LEVELS[11]!;
  const setup: Setup = { mode: "level", id: level.id, heroic: false, perks: NO_PERKS };

  /** A short scripted run: towers between waves, a pie mid-wave, an upgrade, to the end. */
  function record() {
    const rec = new Recorder(setup);
    const game = startGame(level, setup);
    const plots: Array<[number, number]> = [];
    for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) plots.push([c, r]);
    let p = 0;
    const build = () => {
      for (let i = 0; i < 3 && p < plots.length; p++) {
        const [c, r] = plots[p]!;
        if (rec.act(game, { t: "place", kind: i % 2 ? "beehive" : "scarecrow", col: c, row: r }).ok) i++;
      }
    };
    // Hedgerow 2 M1: Cath takes a post and the pie goes on Auto; both are inputs the replay keeps.
    rec.act(game, { t: "hero", x: 2.5, y: 3.5 });
    rec.act(game, { t: "auto", ability: "pie", on: true });
    let guard = 0;
    while (game.phase !== "won" && game.phase !== "lost" && guard++ < 200_000) {
      if (game.phase === "build") {
        build();
        const first = game.towers[0];
        if (first) rec.act(game, { t: "upgrade", id: first.id });
        rec.act(game, { t: "wave" });
      }
      if (game.tick === 400) rec.act(game, { t: "pie", x: 3.25, y: 4.5 });
      rec.step(game);
    }
    return { game, replay: rec.replay() };
  }

  it("plays a recorded run back to exactly the same result", () => {
    const { game, replay } = record();
    expect(replay.log.length).toBeGreaterThan(3);
    expect(replay.v).toBe(3);
    expect(replay.log.some(([, a]) => a.t === "auto")).toBe(true);
    const back = new Player(level, replay).finish();
    expect([back.phase, back.goodwill, back.marks, back.tick, back.towers.length]).toEqual([
      game.phase,
      game.goodwill,
      game.marks,
      game.tick,
      game.towers.length,
    ]);
    expect([back.hero.x, back.hero.y, back.auto.pie]).toEqual([game.hero.x, game.hero.y, true]);
    const t = game.towers[0]!;
    expect(towerAt(back, t.col, t.row)?.tier).toBe(t.tier);
  });

  it("packs into a short URL-safe string and back", async () => {
    const { replay } = record();
    const text = await encodeReplay(replay);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(text.length).toBeLessThan(6000);
    expect(await decodeReplay(text)).toEqual(replay);
    expect(await decodeReplay("not-a-replay")).toBeNull();
    // A link from before Hedgerow 2 (v1) is recognised as old, not called damaged.
    const old = await encodeReplay({ ...replay, v: 1 } as unknown as typeof replay);
    expect(await decodeReplay(old)).toBe("old");
    // So is one from before the Fleet (v2, Hedgerow 2 M1).
    const m1 = await encodeReplay({ ...replay, v: 2 } as unknown as typeof replay);
    expect(await decodeReplay(m1)).toBe("old");
  });

  it("a fleet level (level 1) plays back to exactly the same pops, Marks and Goodwill", () => {
    const lv = LEVELS[0]!;
    const s: Setup = { mode: "level", id: 1, heroic: false, perks: NO_PERKS };
    const rec = new Recorder(s);
    const game = startGame(lv, s);
    const spots: Array<[number, number]> = [[2, 2], [3, 4], [2, 4], [3, 2], [4, 4], [1, 2]];
    let guard = 0;
    while (game.phase !== "won" && game.phase !== "lost" && guard++ < 200_000) {
      if (game.phase === "build") {
        for (const [c, r] of spots) rec.act(game, { t: "place", kind: "scarecrow", col: c, row: r });
        for (const t of game.towers) rec.act(game, { t: "upgrade", id: t.id });
        rec.act(game, { t: "wave" });
      } else if (game.wave === 3 && game.waveClock > 6 && game.waveClock < 6.05) rec.act(game, { t: "wave" });
      rec.step(game);
    }
    const back = new Player(lv, rec.replay()).finish();
    expect(game.popped).toBeGreaterThan(1000);
    expect([back.phase, back.goodwill, back.marks, back.tick, back.popped]).toEqual([game.phase, game.goodwill, game.marks, game.tick, game.popped]);
  });
});
