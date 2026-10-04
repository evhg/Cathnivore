import { describe, expect, it } from "vitest";
import { Voice } from "../games/cathode/src/game/voice";

describe("voice", () => {
  it("says each cue once and plays Bea's call in order", () => {
    const out: string[] = [];
    const v = new Voice((t) => out.push(t));
    v.say("beaCall1");
    v.say("beaCall1");
    v.say("beaCall2");
    for (let i = 0; i < 40; i++) v.update(1);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^Bea: /);
    expect(out[1]).toMatch(/^Cath: /);
  });
});
