import { describe, expect, it } from "vitest";
import { LANDMARKS, lookKey, nearLandmark } from "../games/cathode/src/game/landmarks";

describe("hub street landmarks", () => {
  it("has unique ids", () => {
    expect(new Set(LANDMARKS.map((l) => l.id)).size).toBe(LANDMARKS.length);
  });
  it("fires once when walked past and records it", () => {
    const done: string[] = [];
    const l = LANDMARKS[0]!;
    expect(nearLandmark(done, l.x + 100, l.z)).toBeUndefined();
    expect(nearLandmark(done, l.x, l.z)?.id).toBe(l.id);
    expect(done).toContain(lookKey(l.id));
    expect(nearLandmark(done, l.x, l.z)?.id).not.toBe(l.id);
  });
});
