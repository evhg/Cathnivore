import { describe, expect, it } from "vitest";
import { frontPageFor, PAPER_CASES, parseLastCase } from "../games/cathode/src/sim/frontpage";

// Plan item 494: the title's morning paper reports the last closed case in Hollowell's slant.
describe("NIGHT SHIFT morning paper", () => {
  it("a fresh save reads the teaser on Tomas Reed", () => {
    const p = frontPageFor([], null);
    expect(p.caseId).toBe("reed");
    expect(p.headline).toMatch(/Water-Taxi/);
    expect(p.edition).toBe("reed:-");
  });
  it("reports the newest closed case in List order, whatever order the jobs closed in", () => {
    expect(frontPageFor(["fishMarket"], null).caseId).toBe("fishMarket");
    expect(frontPageFor(["vaneBoss", "fishMarket", "crispLead", "crispBoss"], null).caseId).toBe("vaneBoss");
    expect(frontPageFor([...PAPER_CASES], null).caseId).toBe("vaultBoss");
  });
  it("every case has its own headline, dek, classified and caption", () => {
    const pages = PAPER_CASES.map((_, i) => frontPageFor(PAPER_CASES.slice(0, i + 1), null));
    for (const k of ["headline", "dek", "classified", "caption"] as const) expect(new Set(pages.map((p) => p[k])).size).toBe(pages.length);
    for (const p of pages) expect(p.weather).toMatch(/rain/i);
  });
  it("the debrief's grade colours the dek and the edition, only for its own case", () => {
    const clean = frontPageFor(["fishMarket", "crispBoss"], { caseId: "crispBoss", grade: "S", spotted: false, kills: 4 });
    const loud = frontPageFor(["fishMarket", "crispBoss"], { caseId: "crispBoss", grade: "D", spotted: true, kills: 20 });
    expect(clean.dek).toMatch(/no witnesses/);
    expect(loud.dek).toMatch(/fireworks/);
    expect(clean.edition).not.toBe(loud.edition);
    // A record for an older case leaves the newer one ungraded.
    const stale = frontPageFor(["fishMarket", "crispBoss", "vaneBoss"], { caseId: "crispBoss", grade: "S", spotted: false, kills: 4 });
    expect(stale.caseId).toBe("vaneBoss");
    expect(stale.edition).toBe("vaneBoss:-");
  });
  it("reads the stored case defensively", () => {
    expect(parseLastCase(null)).toBeNull();
    expect(parseLastCase("{bad")).toBeNull();
    expect(parseLastCase(JSON.stringify({ caseId: "crispBoss", grade: "Z" }))).toBeNull();
    expect(parseLastCase(JSON.stringify({ caseId: "crispBoss", grade: "A", spotted: true, kills: 3, still: "javascript:x" }))).toEqual({ caseId: "crispBoss", grade: "A", spotted: true, kills: 3, still: undefined });
  });
});
