import { describe, expect, it } from "vitest";
import { ENEMIES, type EnemyKind } from "../games/hedgerow/src/engine";
import { driverFace, driverSlogan } from "../games/hedgerow/src/fleetfaces";

// Plan item 529: every vehicle in Hollowell's fleet has a driver (a face in the livery) and a slogan of its own.
describe("fleet faces", () => {
  const kinds = Object.keys(ENEMIES) as EnemyKind[];
  it("draws a driver for every vehicle", () => {
    for (const k of kinds) {
      const svg = driverFace(k);
      expect(svg.startsWith("<svg"), k).toBe(true);
      expect(svg).toContain(`data-kind="${k}"`);
      expect(svg).toMatch(/data-prop="[a-z]+"/);
    }
  });
  it("gives each vehicle its own slogan", () => {
    const lines = kinds.map((k) => driverSlogan(k));
    for (const l of lines) expect(l.length).toBeGreaterThan(8);
    expect(new Set(lines).size).toBe(kinds.length);
  });
  it("dresses the fleet in more than a few ways", () => {
    const props = new Set(kinds.map((k) => /data-prop="([a-z]+)"/.exec(driverFace(k))![1]));
    expect(props.size).toBeGreaterThanOrEqual(8);
  });
});
