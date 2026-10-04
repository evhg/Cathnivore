import { describe, expect, it } from "vitest";
import { Progress } from "../games/cathode/src/game/progress";
import { upgradeWeaponTier } from "../games/cathode/src/sim/character";

describe("equipped weapon scale", () => {
  it("is 1 fresh and rises with a gunsmith tier", () => {
    const p = new Progress("gunslinger");
    const id = p.character.equipment.weapon1!.base;
    expect(p.weaponScale(id)).toBeCloseTo(1, 5);
    const r = upgradeWeaponTier({ ...p.character, scrip: 99999 }, p.character.equipment.weapon1!.uid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      p.set(r.value);
      expect(p.weaponScale(id)).toBeGreaterThan(1);
    }
    expect(p.weaponScale("nonexistent")).toBe(1);
  });
});
