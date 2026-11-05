// Plan item 168: the coming rounds' chips. Each round's mix sums to 100%, biggest first; the flood round and boss
// rounds carry their banners; every vehicle on any field has a colour.
import { describe, expect, it } from "vitest";
import { ENEMIES, setPiece, type EnemyKind } from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";
import { livery, roundBanner, roundLead, roundMix } from "../games/hedgerow/src/roundchips";

describe("round chips", () => {
  it("each round's mix sums to 100%, biggest first, one segment per vehicle", () => {
    for (const lv of LEVELS)
      for (const groups of lv.waves) {
        if (!groups.length) continue;
        const mix = roundMix(groups);
        expect(Math.abs(mix.reduce((a, m) => a + m.pct, 0) - 100)).toBeLessThan(1e-6);
        expect(new Set(mix.map((m) => m.kind)).size).toBe(mix.length);
        for (let i = 1; i < mix.length; i++) expect(mix[i]!.count).toBeLessThanOrEqual(mix[i - 1]!.count);
        expect(groups.some((g) => g.enemy === roundLead(groups))).toBe(true)
      }
  });
  it("the flood round is bannered Flood", () => {
    const lv = LEVELS.find((l) => setPiece(l, "flood"))!;
    const f = setPiece(lv, "flood")!;
    expect(roundBanner(lv, f.wave)).toEqual({ twist: "flood", label: "Flood" });
    expect(roundBanner(lv, f.wave - 1)?.twist).not.toBe("flood");
  });
  it("every vehicle has a colour", () => {
    for (const k of Object.keys(ENEMIES) as EnemyKind[]) expect(livery(k)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
