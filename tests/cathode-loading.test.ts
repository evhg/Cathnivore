import { describe, expect, it } from "vitest";
import { loadingTitle } from "../games/cathode/src/game/zones";

describe("loading card title", () => {
  it("names the district and act", () => {
    expect(loadingTitle(undefined)).toContain("Drowned Market");
    expect(loadingTitle("clinic")).toBe("Act 2 · The Candor Clinic");
  });
});
