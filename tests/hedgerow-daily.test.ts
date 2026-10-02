import { describe, expect, it } from "vitest";
import { dailyLevel, dailyScore, dayOf, shareCard } from "../games/hedgerow/src/daily";
import { emptySave, parseSave, recordDaily } from "../games/hedgerow/src/store";

describe("daily challenge", () => {
  it("picks the same non-boss level all day, and varies across days", () => {
    const ids = new Set<number>();
    for (let d = 0; d < 60; d++) {
      const lv = dailyLevel(d);
      expect(dailyLevel(d).id).toBe(lv.id);
      expect(lv.id % 10).not.toBe(0);
      expect(lv.id).toBeGreaterThanOrEqual(11);
      ids.add(lv.id);
    }
    expect(ids.size).toBeGreaterThan(25);
    expect(dayOf(Date.UTC(2026, 0, 2, 23))).toBe(1);
  });
  it("scores, shares and keeps the best", () => {
    expect(dailyScore(false, 0.9, 5)).toBe(0);
    expect(dailyScore(true, 1, 0)).toBe(90);
    expect(dailyScore(true, 1, 9)).toBe(100);
    expect(shareCard(4, dailyLevel(4), true, 90)).toContain("Hedgerow daily #5");
    const d = emptySave();
    expect(recordDaily(d, 7, 50)).toBe(true);
    expect(recordDaily(d, 7, 40)).toBe(false);
    expect(parseSave(JSON.stringify(d)).daily).toEqual({ "7": 50 });
  });
});
