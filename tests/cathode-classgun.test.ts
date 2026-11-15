// Plan item 423: each class's signature weapon on the class pick is the gun the first job hands over (game/progress's
// CLASS_WEAPON), and the five read as five different kinds of gun.
import { describe, expect, it } from "vitest";
import { CLASS_SIGNATURE } from "../games/cathode/src/sim/character";
import { WEAPON_BASES } from "../games/cathode/src/sim/weapons";
import { CLASS_WEAPON } from "../games/cathode/src/game/progress";
import { SLICE_WEAPONS } from "../games/cathode/src/game/weapons";
import { weaponArtSvg } from "../games/cathode/src/ui/weaponart";
import { gunModelFor } from "../games/cathode/src/render/gunportrait";
import { CLASS_IDS } from "../games/cathode/src/sim/types";

describe("class signature weapons (item 423)", () => {
  it("each is a sim weapon of the same kind as the gun the first job hands over", () => {
    for (const cls of CLASS_IDS) {
      const base = WEAPON_BASES[CLASS_SIGNATURE[cls]];
      expect(base, cls).toBeDefined();
      const handed = SLICE_WEAPONS.find((w) => w.id === CLASS_WEAPON[cls]);
      expect(handed, cls).toBeDefined();
      expect(base!.cls, cls).toBe(handed!.weaponClass);
      // Where the sim and the game share the gun, they share its name too.
      if (handed!.id === base!.id) expect(base!.name, cls).toBe(handed!.name);
    }
  });

  it("no two classes show the same kind of gun, and each has a lit mesh", () => {
    const kinds = CLASS_IDS.map((c) => WEAPON_BASES[CLASS_SIGNATURE[c]]!.cls);
    expect(new Set(kinds).size).toBe(CLASS_IDS.length);
    for (const k of kinds) expect(gunModelFor(k), k).not.toBeNull();
  });

  it("each kind has its own drawn profile", () => {
    const svgs = CLASS_IDS.map((c) => weaponArtSvg(WEAPON_BASES[CLASS_SIGNATURE[c]]!.cls));
    expect(new Set(svgs).size).toBe(CLASS_IDS.length);
  });
});
