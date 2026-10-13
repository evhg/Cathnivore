import { describe, expect, it } from "vitest";
import { SHOW_CORE, showFields, showKit, showPacket } from "../games/hedgerow/src/show";

describe("County Show", () => {
  it("is seeded by the week: the same for everyone, different next week", () => {
    expect(showKit(120)).toEqual(showKit(120));
    expect(showFields(120).map((l) => l.id)).toEqual(showFields(120).map((l) => l.id));
    const ids = new Set(Array.from({ length: 20 }, (_, w) => showFields(w).map((l) => l.id).join()));
    expect(ids.size).toBeGreaterThan(10);
  });
  it("has six towers, always the core four, and three rising Fleet fields", () => {
    for (let w = 0; w < 30; w++) {
      const kit = showKit(w);
      expect(new Set(kit).size).toBe(6);
      for (const k of SHOW_CORE) expect(kit).toContain(k);
      const f = showFields(w);
      expect(f).toHaveLength(3);
      expect(f[0]!.id).toBeLessThan(f[2]!.id);
      for (const l of f) {
        expect(l.rules).toBe("fleet");
        expect(l.id % 10).not.toBe(0);
      }
      expect(showPacket(w)).toBeTruthy();
    }
  });
});

import { playLevel } from "../games/hedgerow/src/bot";

describe("County Show bot", () => {
  it("clears every field of a few weeks' Shows on the Show kit", () => {
    for (const w of [120, 121, 122]) for (const l of showFields(w)) expect(playLevel(l, "best").phase, `week ${w} ${l.id}`).toBe("won");
  }, 120000);
});
