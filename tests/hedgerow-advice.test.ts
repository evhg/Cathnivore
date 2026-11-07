import { describe, expect, it } from "vitest";
import { newGame, waveSpawns } from "../games/hedgerow/src/engine";
import { roundAdvice } from "../games/hedgerow/src/advice";
import { countersFor } from "../games/hedgerow/src/intro";
import { LEVELS } from "../games/hedgerow/src/levels";

// Plan item 72: Cath's notebook names the round's threat and what in the level's kit answers it.
describe("Hedgerow round advice", () => {
  it("names a threat from the round and a tower from the kit that answers it, on every round of every level", () => {
    for (const lv of LEVELS) {
      const game = newGame(lv);
      lv.waves.forEach((groups, w) => {
        const spawns = waveSpawns(game, groups, w + 1);
        const a = roundAdvice(spawns, lv.towers, [])!;
        const at = `level ${lv.id} round ${w + 1}`;
        expect(spawns.some((s) => s.kind === a.kind), at).toBe(true);
        expect(a.line.length, at).toBeGreaterThan(10);
        if (a.tower) {
          expect(lv.towers, at).toContain(a.tower);
          expect(countersFor(a.kind, lv.towers), at).toContain(a.tower);
        } else expect(countersFor(a.kind, lv.towers), at).toEqual([]);
      });
    }
  });

  it("puts a boss first and prefers a tower already on the field", () => {
    const a = roundAdvice([{ kind: "hatchback" }, { kind: "hatchback" }, { kind: "boss" }], ["hedgerow", "scarecrow", "beehive"], [])!;
    expect(a.kind).toBe("boss");
    expect(a.total).toBe(3);
    const counters = countersFor("hatchback", ["scarecrow", "beehive"]);
    expect(counters.length).toBeGreaterThan(1);
    const pick = counters[counters.length - 1]!;
    const b = roundAdvice([{ kind: "hatchback" }], ["scarecrow", "beehive"], [pick])!;
    expect(b.tower).toBe(pick);
    expect(b.line).toMatch(/^Your /);
    expect(roundAdvice([], ["scarecrow"], [])).toBeNull();
  });
});

// Plan item 228: a build line names the round's threat (it read as a generic tip on a Box Lorry round).
describe("roundAdvice names the threat", () => {
  it("says what a new tower is for, on every round of every level", () => {
    for (const lv of LEVELS) {
      const game = newGame(lv);
      lv.waves.forEach((groups, w) => {
        const a = roundAdvice(waveSpawns(game, groups, w + 1), lv.towers, [])!;
        if (a.tower) expect(a.line, `level ${lv.id} round ${w + 1}`).toMatch(/^Build a .* for the /);
      });
    }
    const l34 = LEVELS.find((l) => l.id === 34)!;
    const a = roundAdvice(waveSpawns(newGame(l34), l34.waves[16]!, 17), l34.towers, [])!;
    expect(a.line).not.toMatch(/^Build a [^:]*: it hits them hard/);
  });
});
