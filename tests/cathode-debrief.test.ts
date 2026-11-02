import { describe, expect, it } from "vitest";
import { UNIQUE_BY_ID, SET_PIECE_BY_ID } from "../games/cathode/src/sim/loot";
import {
  beaText,
  bestStills,
  CLOSING_CASES,
  clock,
  debriefGrade,
  debriefScore,
  emptyLedger,
  GRADE_BARS,
  stillScore,
} from "../games/cathode/src/sim/debrief";

describe("plan item 17: the debrief grade", () => {
  it("grades at its bars, and one below each bar is the next grade down", () => {
    expect(debriefGrade(100)).toBe("S");
    expect(debriefGrade(90)).toBe("S");
    expect(debriefGrade(89)).toBe("A");
    expect(debriefGrade(75)).toBe("A");
    expect(debriefGrade(74)).toBe("B");
    expect(debriefGrade(60)).toBe("B");
    expect(debriefGrade(59)).toBe("C");
    expect(debriefGrade(45)).toBe("C");
    expect(debriefGrade(44)).toBe("D");
    expect(debriefGrade(0)).toBe("D");
    expect(GRADE_BARS.map(([g]) => g)).toEqual(["S", "A", "B", "C", "D"]);
  });

  it("scores a quiet, untouched visit with no kills at 70 (B)", () => {
    const l = emptyLedger(100);
    expect(debriefScore(l)).toBe(70);
    expect(debriefGrade(debriefScore(l))).toBe("B");
  });

  it("reaches S on a clean run of all headshots, and drops to B when spotted once", () => {
    const l = { ...emptyLedger(100), kills: 6, headshots: 6 };
    expect(debriefScore(l)).toBe(90);
    expect(debriefGrade(debriefScore(l))).toBe("S");
    expect(debriefGrade(debriefScore({ ...l, spotted: true }))).toBe("B");
  });

  it("caps takedowns at 15, damage at 25 and restarts at 30, and clamps to 0..100", () => {
    const base = { ...emptyLedger(100), spotted: true };
    expect(debriefScore({ ...base, takedowns: 5 })).toBe(65);
    expect(debriefScore({ ...base, takedowns: 50 })).toBe(65);
    expect(debriefScore({ ...base, damageTaken: 100 })).toBe(45);
    expect(debriefScore({ ...base, damageTaken: 100000 })).toBe(25);
    expect(debriefScore({ ...base, restarts: 1 })).toBe(40);
    expect(debriefScore({ ...base, restarts: 9 })).toBe(20);
    expect(debriefScore({ ...base, damageTaken: 1e6, restarts: 9 })).toBe(0);
    expect(debriefScore({ ...emptyLedger(100), kills: 3, headshots: 3, takedowns: 9 })).toBe(100);
  });

  it("reads damage as a share of her health pool", () => {
    const l = { ...emptyLedger(200), spotted: true, damageTaken: 200 };
    expect(debriefScore(l)).toBe(45);
  });

  it("Bea only texts on a clean run", () => {
    expect(beaText(emptyLedger())).toMatch(/^Bea:/);
    expect(beaText({ ...emptyLedger(), spotted: true })).toBeNull();
  });
});

describe("plan item 17: stills, keepsakes and the clock", () => {
  it("ranks headshots and takedowns over long body shots, and keeps the earlier kill on a tie", () => {
    const k = (score: number, id: number) => ({ score, id });
    expect(bestStills([k(5, 1), k(40, 2), k(40, 3), k(60, 4), k(1, 5)]).map((x) => x.id)).toEqual([4, 2, 3]);
    expect(stillScore({ headshot: true, takedown: false, distance: 10, severed: false })).toBeGreaterThan(stillScore({ headshot: false, takedown: false, distance: 30, severed: false }));
    expect(stillScore({ headshot: false, takedown: true, distance: 1, severed: false })).toBeGreaterThan(stillScore({ headshot: false, takedown: false, distance: 20, severed: false }));
  });

  it("every keepsake is a real unique or set piece", () => {
    for (const [id, c] of Object.entries(CLOSING_CASES)) {
      if (!c.keepsake) continue;
      expect(UNIQUE_BY_ID[c.keepsake] ?? SET_PIECE_BY_ID[c.keepsake], id).toBeTruthy();
    }
  });

  it("formats minutes and seconds", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(65.4)).toBe("1:05");
    expect(clock(600)).toBe("10:00");
  });
});
