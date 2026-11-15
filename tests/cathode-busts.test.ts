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

  it("lights each withheld print by its own district, with its own giveaway prop (plan item 412)", () => {
    const prints = [0, 1, 2, 3, 4].map((i) => mugshotSvg(null, "", true, i));
    const ground = (s: string) => /<radialGradient id="r\w+"[^>]*><stop offset="0" stop-color="(#\w+)"/.exec(s)?.[1];
    expect(new Set(prints.map(ground)).size).toBe(5);
    expect(new Set(prints.map((s) => /data-silhouette="(\d)"/.exec(s)?.[1])).size).toBe(5);
    for (const s of prints) {
      // torn redaction tape, never a plain bar, and a torn corner off the photo
      expect(s).not.toContain('<rect x="62" y="86" width="76" height="18"');
      expect(s).toMatch(/<path d="M60 87 L64 85.6/);
      expect(s).toContain('fill="#e9e2d3"');
    }
  });

  it("prints a named target under a hard key with a cold rim, not a flat pale face (plan item 412)", () => {
    for (const who of ["crisp", "vane", "pell", "chair", "reed"] as const) {
      const s = mugshotSvg(who, "NO. 1", true);
      expect(s).toMatch(/<filter id="e\w+"[^>]*><feOffset in="SourceAlpha"/);
      expect(s).not.toContain('slope="1.28"');
    }
  });
});

