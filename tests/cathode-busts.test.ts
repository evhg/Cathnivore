import { describe, expect, it } from "vitest";
import { BUSTS, BUST_FOR_CASE, bustForBanner, bustSvg, mugshotSvg } from "../games/cathode/src/ui/busts";
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

  // Plan item 371: the named targets are sculpted (face planes, real eyes, nose, mouth, hair), not flat primitives:
  // before the item the richest bust drew 670 path numbers (Pell), the Chair 326.
  it("sculpts every named target to the same depth", () => {
    const detail = (s: string) => (s.replace(/<!--set-->[\s\S]*?<!--\/set-->/g, "").match(/-?\d+(\.\d+)?/g) ?? []).length;
    for (const who of ["crisp", "vane", "pell", "chair", "reed"] as const) expect(detail(bustSvg(who)), who).toBeGreaterThan(900);
  });

  it("keeps the Chair's face in shadow, even in his booking photo, with the sculpt under it", () => {
    const booking = mugshotSvg("chair", "CASE 05");
    expect(booking).toContain('fill="#06070a" opacity=".8"');
    expect(booking).toMatch(/url\(#hk/);
    // His window and chair stay out of the booking room.
    expect(booking).not.toContain('fill="#1a1c23"');
  });
});
