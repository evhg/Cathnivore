import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { NO_PERKS, towerAt } from "../games/hedgerow/src/engine";
import { Player, Recorder, decodeReplay, encodeReplay, rewindToWave, startGame, type Setup } from "../games/hedgerow/src/replay";

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
        // Hedgerow 2 M4: a fleet Scarecrow's upgrade names its path (Flock, then Scythe).
        if (first) rec.act(game, { t: "upgrade", id: first.id, path: (first.path?.[0] ?? 0) < 2 ? 0 : 2 });
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
    expect(replay.v).toBe(5);
    expect(replay.log.some(([, a]) => a.t === "upgrade" && a.path !== undefined)).toBe(true);
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
    expect(towerAt(back, t.col, t.row)?.path).toEqual(t.path);
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
    // A v3 link (Hedgerow 2 M2, before acts 2-3 moved to the Fleet) is old too.
    const m2 = await encodeReplay({ ...replay, v: 3 } as unknown as typeof replay);
    expect(await decodeReplay(m2)).toBe("old");
    // M3's v4 links (tiers and specs on fleet levels) are old once towers grow along paths.
    const m3 = await encodeReplay({ ...replay, v: 4 } as unknown as typeof replay);
    expect(await decodeReplay(m3)).toBe("old");
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

  it("Retry from round N: a lost run rewinds to just before the round it lost, exactly as it stood", () => {
    // Level 15 without a Radio Mast, with a deep Goodwill purse so the field of Scarecrows lasts a few rounds
    // before it loses (at the latest to round 22's stealth lorries).
    const lv = { ...LEVELS[14]!, goodwill: 3000 };
    const s: Setup = { mode: "level", id: lv.id, heroic: false, perks: NO_PERKS };
    const rec = new Recorder(s);
    const game = startGame(lv, s);
    // Plots by how close they are to the lane's points, nearest first.
    const lane = lv.path;
    const near = (c: number, r: number) => Math.min(...lane.map(([x, y]) => Math.hypot(c + 0.5 - x, r + 0.5 - y)));
    const plots: Array<[number, number]> = [];
    for (let r = 0; r < lv.rows; r++) for (let c = 0; c < lv.cols; c++) plots.push([c, r]);
    plots.sort((a, b) => near(a[0], a[1]) - near(b[0], b[1]));
    let guard = 0;
    while (game.phase !== "won" && game.phase !== "lost" && guard++ < 400_000) {
      if (game.phase === "build") {
        for (const t of game.towers) rec.act(game, { t: "upgrade", id: t.id });
        for (const [c, r] of plots) if (game.marks >= 200) rec.act(game, { t: "place", kind: "scarecrow", col: c, row: r });
        rec.act(game, { t: "wave" });
      }
      rec.step(game);
    }
    expect(game.phase).toBe("lost");
    const lostWave = game.wave;
    expect(lostWave).toBeGreaterThan(1);
    const replay = rec.replay();
    const back = rewindToWave(lv, replay, lostWave)!;
    expect(back).not.toBeNull();
    expect(back.game.wave).toBe(lostWave - 1);
    expect(back.game.phase).not.toBe("lost");
    expect(back.game.goodwill).toBeGreaterThan(0);
    // The rewound run's own log plays back to exactly the same field (so its replay link still works).
    const again = new Player(lv, back.recorder.replay());
    while (!again.done) again.step();
    const sig = (g: typeof game) => JSON.stringify([g.tick, g.wave, g.marks, g.goodwill, g.towers.map((t) => [t.kind, t.col, t.row, t.tier]), g.enemies.length]);
    again.step();
    expect(sig(again.game)).toBe(sig(back.game));
    // And play carries on from there: the player sends the round again.
    expect(back.recorder.act(back.game, { t: "wave" }).ok).toBe(true);
    expect(back.game.wave).toBe(lostWave);
    // Round 1 rewinds to the field as first built, before anything was sent.
    const first = rewindToWave(lv, replay, 1)!;
    expect(first).not.toBeNull();
    expect(first.game.wave).toBe(0);
    expect(first.game.towers.length).toBeGreaterThan(0);
    expect(rewindToWave(lv, replay, 0)).toBeNull();
  }, 60_000);
});
