import { describe, expect, it } from "vitest";
import { ALL_SKILLS } from "../games/cathode/src/sim/classes";
import { skillSigil } from "../games/cathode/src/ui/skillsigil";

describe("skill sigils", () => {
  it("are deterministic and at least 95% unique across all skills", () => {
    expect(skillSigil("ghost.steadyHands")).toBe(skillSigil("ghost.steadyHands"));
    const marks = new Set(ALL_SKILLS.map((s) => skillSigil(s.id)));
    expect(marks.size / ALL_SKILLS.length).toBeGreaterThanOrEqual(0.95);
  });
  it("is a labelled-free decorative svg", () => {
    expect(skillSigil("x")).toMatch(/^<svg [^>]*aria-hidden="true"/);
  });
});
