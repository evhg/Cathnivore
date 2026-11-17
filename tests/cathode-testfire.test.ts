import { describe, expect, it } from "vitest";
import { testFireLook } from "../games/cathode/src/game/testfire";
import { RECIPES } from "../games/cathode/src/game/gunsound";
import { CLASS_IDS } from "../games/cathode/src/sim/types";

// Plan item 464: the pick's test shot is the class's own gun: five distinct voices, each one GunSound can play
// (a class id such as "ghost" has no recipe, so every shot fell back to the rack's click), in five muzzle colours.
describe("class pick test fire", () => {
  const looks = CLASS_IDS.map((c) => testFireLook(c));
  it("gives each class a distinct, playable gun voice", () => {
    expect(new Set(looks.map((l) => l.voice)).size).toBe(CLASS_IDS.length);
    for (const l of looks) expect(RECIPES[l.voice], l.voice).toBeDefined();
  });
  it("gives each class a distinct muzzle colour", () => {
    expect(new Set(looks.map((l) => l.flash.join(","))).size).toBe(CLASS_IDS.length);
    for (const l of looks) expect(l.size).toBeGreaterThan(0);
  });
});
