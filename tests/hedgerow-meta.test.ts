// Hedgerow 2 M10: tower XP and Acorns come from real runs only and survive a save round trip.
import { describe, expect, it } from "vitest";
import { LEVELS } from "../games/hedgerow/src/levels";
import { isFleet, newGame, place, placePacket, isPlot } from "../games/hedgerow/src/engine";
import { acornsFor, awardRun, feedCompost, COMPOST_FEED, buyPacket, spendPacket } from "../games/hedgerow/src/meta";
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

describe("XP gates", () => {
  it("a locked tier 3 and Crown name the XP, and ungated games are unaffected", async () => {
    const { xpBlock, XP_T3, XP_CROWN } = await import("../games/hedgerow/src/engine");
    expect(xpBlock({}, "scarecrow", 3)).toBeNull();
    expect(xpBlock({ xpGate: { scarecrow: 100 } }, "scarecrow", 3)).toContain("100 of 1,500");
    expect(xpBlock({ xpGate: { scarecrow: XP_T3 } }, "scarecrow", 3)).toBeNull();
    expect(xpBlock({ xpGate: { scarecrow: XP_T3 } }, "scarecrow", 4)).toContain("10,000");
    expect(xpBlock({ xpGate: { scarecrow: XP_CROWN } }, "scarecrow", 4)).toBeNull();
  });
});

describe("Acorn perks", () => {
  it("cost Acorns, not stars, and apply to the run", async () => {
    const { buyPerk, freeAcorns, freeStars, perksOf } = await import("../games/hedgerow/src/store");
    const d = emptySave();
    d.stars["1"] = 3;
    expect(buyPerk(d, "pocketchange")).toBe(false);
    d.acorns = 100;
    expect(buyPerk(d, "pocketchange")).toBe(true);
    expect(freeAcorns(d)).toBe(20);
    expect(freeStars(d)).toBe(3);
    expect(perksOf(d).marks).toBe(60);
  });
  it("collects XP past the Crown gate in the Compost Heap and feeds it at 2:1", () => {
    const g = newGame(fleet);
    g.marks = 9999;
    let spot: [number, number] | null = null;
    for (let r = 0; r < fleet.rows && !spot; r++) for (let c = 0; c < fleet.cols && !spot; c++) if (isPlot(fleet, c, r)) spot = [c, r];
    place(g, "scarecrow", spot![0], spot![1]);
    g.towers[0]!.kills = 300;
    const d = emptySave();
    d.xp = { scarecrow: 10000, cannon: 100 };
    awardRun(d, g, true);
    expect(d.xp.scarecrow).toBe(10000);
    expect(d.compost).toBe(300);
    expect(feedCompost(d, "cannon")).toBe(false);
    d.compost = 5000;
    expect(feedCompost(d, "cannon")).toBe(true);
    expect(d.xp.cannon).toBe(100 + COMPOST_FEED);
    expect(d.compost).toBe(5000 - COMPOST_FEED * 2);
    expect(feedCompost(d, "scarecrow")).toBe(false);
    expect(parseSave(JSON.stringify(d)).compost).toBe(d.compost);
  });
});

describe("Seed Packets", () => {
  it("plants a pre-grown tower free, sells for nothing, and stays out of Hollow", () => {
    const lv = LEVELS.find((l) => isFleet(l) && !l.endless && l.towers.includes("silo") && l.id >= 24)!;
    const spots: [number, number][] = [];
    for (let r = 0; r < lv.rows; r++) for (let c = 0; c < lv.cols; c++) if (isPlot(lv, c, r)) spots.push([c, r]);
    const g = newGame(lv);
    g.marks = 50;
    const res = placePacket(g, "silo", [2, 0, 3], spots[0]![0], spots[0]![1]);
    expect(res.ok).toBe(true);
    expect(g.towers[0]!.path).toEqual([2, 0, 3]);
    expect(g.marks).toBe(50);
    expect(g.towers[0]!.spent).toBe(0);
    const h = newGame(lv, undefined, {}, true);
    expect(placePacket(h, "silo", [2, 0, 3], spots[0]![0], spots[0]![1]).ok).toBe(false);
  });
  it("buys with Acorns and uses one at a time", () => {
    const d = emptySave();
    d.acorns = 150;
    expect(buyPacket(d, "silo-203")).toBe(true);
    expect(buyPacket(d, "silo-203")).toBe(false);
    expect(d.packets!["silo-203"]).toBe(1);
    expect(spendPacket(d, "silo-203")).toBe(true);
    expect(spendPacket(d, "silo-203")).toBe(false);
    expect(parseSave(JSON.stringify(d)).packetSpend).toBe(120);
  });
});
