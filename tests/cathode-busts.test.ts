import { describe, expect, it } from "vitest";
import { BUSTS, BUST_FOR_CASE, bustForBanner, bustSvg } from "../games/cathode/src/ui/busts";
import { caseBoard } from "../games/cathode/src/sim/casefile";

describe("NIGHT SHIFT villain busts (plan item 9)", () => {
  it("draws each name on the List as its own SVG with unique ids", () => {
    const a = bustSvg("crisp");
    const b = bustSvg("crisp");
    const id = (s: string) => /id="g(\w+)"/.exec(s)?.[1];
    expect(id(a)).not.toBe(id(b));
    for (const who of BUSTS) {
      const s = bustSvg(who);
      expect(s.startsWith("<svg")).toBe(true);
      expect(s).toContain('viewBox="0 0 200 240"');
      // One accent: the only saturated colour is the Night Shift red.
      expect(s).toContain("#c8102e");
      expect(s).not.toMatch(/style=/);
    }
  });

  it("matches every boss intro banner to its bust", () => {
    expect(bustForBanner("Julian Crisp")).toBe("crisp");
    expect(bustForBanner("Dr Octavia Vane")).toBe("vane");
    expect(bustForBanner("Councillor Pell")).toBe("pell");
    expect(bustForBanner("The Chair of the Board")).toBe("chair");
    expect(bustForBanner("Ambush")).toBeNull();
  });

  it("pins busts only to cases that exist on the board", () => {
    const ids = caseBoard([]).map((c) => c.id);
    for (const id of Object.keys(BUST_FOR_CASE)) expect(ids).toContain(id);
  });
});
