import { describe, expect, it } from "vitest";
import { loadingTitle } from "../games/cathode/src/game/zones";

describe("loading card title", () => {
  it("names the district and act", () => {
    expect(loadingTitle(undefined)).toContain("Drowned Market");
    expect(loadingTitle("clinic")).toBe("Act 2 · The Candor Clinic");
  });
});

describe("loading flavour", () => {
  it("has a distinct line per district", async () => {
    const { loadingFlavour } = await import("../games/cathode/src/game/zones");
    const lines = [undefined, "clinic", "plaza", "tower", "vault"].map((d) => loadingFlavour(d));
    expect(new Set(lines).size).toBe(5);
  });
});
