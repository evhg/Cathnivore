import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildGunDisplay } from "../games/cathode/src/game/viewmodel";
import { dressGun, drawnSlots, modelForClass } from "../games/cathode/src/game/gunparts";
import { meshStats } from "../games/cathode/src/game/gunkit";
import { WEAPON_PARTS, partFits } from "../games/cathode/src/sim/weapons";
import { benchStats, benchWeapons, partLine } from "../games/cathode/src/ui/bench";
import { newCharacter } from "../games/cathode/src/sim/character";
import type { WeaponClass } from "../games/cathode/src/sim/types";

// Plan item 16: the gunsmith's parts drawn on the gun lying on the office bench.

const GUNS: WeaponClass[] = ["pistol", "revolver", "smg", "rifle", "shotgun", "sniper", "launcher", "smart"];

describe("gun parts on the 3D gun", () => {
  it("draws every part that fits every gun, as its own part:<slot> group", () => {
    for (const cls of GUNS) {
      const model = modelForClass(cls);
      for (const p of Object.values(WEAPON_PARTS)) {
        if (!partFits(p, cls)) continue;
        const g = dressGun(buildGunDisplay(model, true), model, { [p.slot]: p.id }, true);
        // The Kestrel's can is part of the gun: a fitted suppressor is already drawn.
        const want = model === "pistol" && p.slot === "suppressor" ? [] : [p.slot];
        expect(drawnSlots(g), `${cls} + ${p.id}`).toEqual(want);
      }
    }
  });

  it("re-dressing replaces the parts instead of stacking them", () => {
    const g = buildGunDisplay("rifle", true);
    dressGun(g, "rifle", { mag: "drumMag", scope: "redDot" }, true);
    dressGun(g, "rifle", { mag: "extendedMag" }, true);
    expect(drawnSlots(g)).toEqual(["mag"]);
  });

  it("a can threads on past a barrel extension, and a fully built gun stays a handful of draw calls", () => {
    const bare = buildGunDisplay("rifle", false);
    const len = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).z;
    const l0 = len(bare);
    const built = dressGun(buildGunDisplay("rifle", false), "rifle", { barrel: "longBarrel", suppressor: "can", scope: "fourGlass", mag: "drumMag", stock: "marksmanStock" });
    expect(len(built)).toBeGreaterThan(l0 + 0.25);
    const st = meshStats(built);
    expect(st.calls).toBeLessThanOrEqual(20);
    expect(st.tris).toBeLessThan(40000);
  });

  it("melee has nothing to dress", () => {
    expect(modelForClass("melee")).toBe("pin");
    const g = new THREE.Group();
    expect(drawnSlots(dressGun(g, "pin", { barrel: "longBarrel" }))).toEqual([]);
  });
});

describe("the bench screen's numbers", () => {
  it("lists her guns (not the Pin) and previews a part with the same sums the gun fires with", () => {
    const c = newCharacter("ghost");
    const guns = benchWeapons(c);
    expect(guns.length).toBeGreaterThan(0);
    const gun = guns[0]!;
    const now = benchStats(gun)!;
    const withMag = benchStats(gun, { ...gun.parts, mag: "extendedMag" })!;
    expect(withMag.magazine).toBeGreaterThan(now.magazine);
    expect(withMag.reload).toBeGreaterThan(now.reload);
  });

  it("says what a part does in words", () => {
    expect(partLine(WEAPON_PARTS.longBarrel!)).toBe("+25% range, +10% velocity, +5% damage, −5% aim speed");
    expect(partLine(WEAPON_PARTS.subsonicBaffle!)).toMatch(/subsonic$/);
    expect(partLine(WEAPON_PARTS.redDot!)).toContain("+0.5× zoom");
  });
});

describe("the wardrobe", () => {
  it("lists the bag's pieces for a slot and says what a piece gives", async () => {
    const { makeItem } = await import("../games/cathode/src/sim/loot");
    const { piecesFor, pieceLine } = await import("../games/cathode/src/ui/wardrobe");
    const c0 = newCharacter("ghost");
    const spare = makeItem("trench", { uid: "spare-coat" });
    const c = { ...c0, inventory: [spare, makeItem("fedora", { uid: "spare-hat" })] };
    expect(piecesFor(c, "coat").map((i) => i.uid)).toEqual(["spare-coat"]);
    expect(piecesFor(c, "gloves")).toEqual([]);
    expect(pieceLine(c.equipment.coat!)).toMatch(/armour/i);
  });
});
