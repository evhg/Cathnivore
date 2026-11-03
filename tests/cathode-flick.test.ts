import { describe, expect, it } from "vitest";
import { flickOf } from "../games/cathode/src/game/input";

// Plan item 44: Jump and Crouch are flicks of the move thumb, never a walk.
describe("touch flicks", () => {
  it("a quick stroke up jumps, down crouches", () => {
    expect(flickOf(100, 300, 104, 240, 150)).toBe("jump");
    expect(flickOf(100, 300, 96, 350, 180)).toBe("crouch");
  });
  it("a held push, a short nudge or a sideways stroke is a walk", () => {
    expect(flickOf(100, 300, 100, 220, 600)).toBeNull();
    expect(flickOf(100, 300, 100, 280, 120)).toBeNull();
    expect(flickOf(100, 300, 170, 250, 150)).toBeNull();
  });
});
