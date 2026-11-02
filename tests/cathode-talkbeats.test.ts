import { describe, expect, it } from "vitest";
import { TALK_BEATS, TALKS } from "../games/cathode/src/sim/talk";

// Plan item 42: each approach plays its own clip for Cath and its own answer from him.
describe("talk beats", () => {
  it("gives every approach a distinct clip and reaction", () => {
    const beats = Object.values(TALK_BEATS);
    expect(new Set(beats.map((b) => b.cath)).size).toBe(beats.length);
    expect(new Set(beats.map((b) => b.him)).size).toBe(beats.length);
  });
  it("covers every approach a talk offers", () => {
    for (const t of TALKS) for (const o of t.options) expect(TALK_BEATS[o.approach]).toBeDefined();
  });
});
