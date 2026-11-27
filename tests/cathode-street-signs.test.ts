// Plan item 724: shops that read by name from the spawn. The fascias face across the road and fold away when seen
// up the street, so each blade carries a plate in plain words facing up and down it.
import { describe, expect, it } from "vitest";
import { L, buildLevel } from "../games/cathode/src/render/level";

describe("NIGHT SHIFT street signs (plan item 724)", () => {
  const level = buildLevel("high");
  const spawn = level.markers.player![0]!;
  const plates = level.signs.filter((s) => s.key?.endsWith("|plate"));

  it("hangs a lettered plate under the blades, facing up and down the street", () => {
    const words = new Set(plates.map((s) => s.text));
    for (const w of ["NOODLE BAR", "PAWN SHOP", "HOTEL", "LUNA"]) expect(words.has(w)).toBe(true);
    for (const s of plates) expect(Math.abs(s.normal.z)).toBe(1);
  });

  it("puts 8+ signs that face up the street within 40 m of the spawn", () => {
    const near = level.signs.filter((s) => Math.abs(s.normal.z) > 0.9 && Math.hypot(s.center.x - spawn.x, s.center.z - spawn.z) < 40);
    expect(new Set(near.map((s) => s.text)).size).toBeGreaterThanOrEqual(8);
  });

  it("keeps every plate out of the walls it hangs from (its whole width over the pavement)", () => {
    expect(plates.length).toBeGreaterThan(0);
    for (const s of plates) {
      const west = s.center.x < (L.westFacade + L.canalE) / 2;
      if (west) expect(s.center.x - s.w / 2).toBeGreaterThanOrEqual(L.westFacade + 0.25);
      else expect(s.center.x + s.w / 2).toBeLessThanOrEqual(L.canalE - 0.25);
    }
  });
});
