// Hedgerow 2 M10: tower XP and Acorns come from real runs only and survive a save round trip.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { isFleet, newGame, place, isPlot } from "../games/hedgerow/src/engine";
import { acornsFor, awardRun } from "../games/hedgerow/src/meta";
import { emptySave, parseSave } from "../games/hedgerow/src/store";

const fleet = LEVELS.find((l) => isFleet(l) && !l.endless)!;

describe("meta", () => {
  it("pays XP by knockouts per kind and Acorns by mode on a win", () => {
    const g = newGame(fleet);
    g.marks = 9999;
    let spot: [number, number] | null = null;
    for (let r = 0; r < fleet.rows && !spot; r++) for (let c = 0; c < fleet.cols && !spot; c++) if (isPlot(fleet, c, r)) spot = [c, r];
    place(g, "scarecrow", spot![0], spot![1]);
    g.towers[0]!.kills = 12;
    const d = emptySave();
    const r = awardRun(d, g, true);
    expect(r.xp).toEqual({ scarecrow: 12 });
    expect(d.xp).toEqual({ scarecrow: 12 });
    expect(d.acorns).toBe(acornsFor("normal", false));
    const lost = awardRun(d, g, false);
    expect(lost.acorns).toBe(0);
    expect(d.xp?.scarecrow).toBe(24);
    expect([acornsFor("easy", false), acornsFor("hard", false), acornsFor("normal", true)]).toEqual([20, 70, 120]);
  });
  it("survives a save round trip and drops junk", () => {
    const d = emptySave();
    d.xp = { scarecrow: 5 };
    d.acorns = 40;
    const back = parseSave(JSON.stringify({ ...d, xp: { ...d.xp, bogus: 9, hedgerow: -3 } }));
    expect(back.xp).toEqual({ scarecrow: 5 });
    expect(back.acorns).toBe(40);
  });
});
