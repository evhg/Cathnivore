import { describe, expect, it } from "vitest";
import { crackStage } from "../games/hedgerow/src/fleet";

describe("crack stages", () => {
  it("step with the shell left on a Heavy Plant", () => {
    expect(crackStage("plantdozer", 120, 120)).toBe(0);
    expect(crackStage("plantdozer", 80, 120)).toBe(1);
    expect(crackStage("plantdozer", 50, 120)).toBe(2);
    expect(crackStage("plantdozer", 20, 120)).toBe(3);
  });
  it("short shells never crack", () => {
    expect(crackStage("lorry", 1, 1)).toBe(0);
    expect(crackStage("van", 0, 1)).toBe(0);
  });
});
