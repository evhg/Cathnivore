import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { armDress, gloveFor, sleeveFor, CATH_HERO } from "../games/cathode/src/game/armdress";
import { Arms } from "../games/cathode/src/game/hands";
import { IDLE_SWAY, INSPECTS, idleSway, inspectClip, inspectPeak } from "../games/cathode/src/game/feel/inspect";
import { newCharacter } from "../games/cathode/src/sim/character";
import { makeItem } from "../games/cathode/src/sim/loot";
import { WEAPON_CLASSES } from "../games/cathode/src/sim/types";

/** Every vertex colour of a mesh, as linear RGB rounded to 3 places. */
function colours(m: THREE.Mesh): Set<string> {
  const c = m.geometry.getAttribute("color") as THREE.BufferAttribute;
  const out = new Set<string>();
  for (let i = 0; i < c.count; i++) out.add([c.getX(i), c.getY(i), c.getZ(i)].map((v) => v.toFixed(3)).join(","));
  return out;
}
const lin = (hex: number) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b].map((v) => v.toFixed(3)).join(",");
};

describe("plan item 26: Cath's arms dress from the wardrobe save", () => {
  it("a fresh Cath wears the charcoal trench and black leather gloves", () => {
    const ch = newCharacter("gunslinger");
    const d = armDress(ch.equipment);
    expect(d.sleeve).toBe("trench");
    expect(d.glove).toBe("leather");
    expect(d.sleeveFin.color).toBe(CATH_HERO.trench);
    expect(d.nails).toBeNull();
  });

  it("each coat picks its own sleeve, each glove its own hand", () => {
    expect(sleeveFor("duster")).toBe("duster");
    expect(sleeveFor("armouredMac")).toBe("armouredMac");
    expect(sleeveFor("silkLinedCoat")).toBe("silkLinedCoat");
    expect(sleeveFor(undefined)).toBe("blouse");
    expect(sleeveFor("someFutureCoat")).toBe("trench");
    expect(gloveFor("knuckleGloves")).toBe("knuckle");
    expect(gloveFor("wiredGloves")).toBe("wired");
    expect(gloveFor(undefined)).toBe("bare");
    const sleeves = new Set(["trench", "duster", "armouredMac", "silkLinedCoat"].map((b) => armDress({ coat: { base: b } }).sleeveFin.color));
    expect(sleeves.size).toBe(4);
    const bare = armDress({ coat: { base: "trench" } });
    expect(bare.handFin.color).toBe(CATH_HERO.skin);
    expect(bare.nails).not.toBeNull();
    expect(armDress({ gloves: { base: "knuckleGloves" } }).bareFrom).toBeGreaterThan(0);
  });

  it("the viewmodel's arms take the sleeve material from the save", () => {
    const ch = newCharacter("gunslinger");
    const arms = new Arms(true, armDress(ch.equipment));
    expect(colours(arms.right.mesh).has(lin(CATH_HERO.trench))).toBe(true);
    const parent = new THREE.Group();
    arms.attach(parent);
    // She changes into the duster and takes her gloves off at the wardrobe.
    ch.equipment.coat = makeItem("duster");
    delete ch.equipment.gloves;
    const d = armDress(ch.equipment);
    expect(arms.redress(d)).toBe(true);
    expect(arms.right.mesh.parent).toBe(parent);
    expect(parent.children.length).toBe(2);
    const cs = colours(arms.right.mesh);
    expect(cs.has(lin(d.sleeveFin.color))).toBe(true);
    expect(cs.has(lin(CATH_HERO.trench))).toBe(false);
    expect(cs.has(lin(CATH_HERO.skin))).toBe(true);
    expect(cs.has(lin(d.nails!.color))).toBe(true);
    // The same dress again rebuilds nothing.
    expect(arms.redress(armDress(ch.equipment))).toBe(false);
  });

  it("the fine gold bracelet is on the firing wrist, the pearls on the support wrist", () => {
    const arms = new Arms(true);
    const gold = lin(0xc9a25a);
    const pearl = lin(0xf4efe6);
    expect(colours(arms.right.mesh).has(gold)).toBe(true);
    expect(colours(arms.right.mesh).has(pearl)).toBe(false);
    expect(colours(arms.left.mesh).has(pearl)).toBe(true);
  });
});

describe("plan item 26: the inspect and the idle sway per class", () => {
  it("every class has an inspect that starts and ends at rest and turns the gun", () => {
    for (const c of WEAPON_CLASSES) {
      const clip = inspectClip(c);
      const keys = clip.tracks.root!;
      expect(keys[0]![2]).toEqual([0, 0, 0]);
      expect(keys[keys.length - 1]![1]).toEqual([0, 0, 0]);
      expect(keys[keys.length - 1]![0]).toBe(clip.dur);
      expect(inspectPeak(clip)).toBeGreaterThan(0.3);
    }
    // The long guns take longer than the pistol, and they aren't all one clip.
    expect(INSPECTS.sniper.dur).toBeGreaterThan(INSPECTS.pistol.dur);
    expect(new Set(Object.values(INSPECTS)).size).toBeGreaterThanOrEqual(7);
  });

  it("the sway is heavier and slower for heavy guns, and still under reduced motion", () => {
    expect(IDLE_SWAY.sniper.hz).toBeLessThan(IDLE_SWAY.pistol.hz);
    expect(IDLE_SWAY.launcher.amp).toBeGreaterThan(IDLE_SWAY.pistol.amp);
    const moving = [0.4, 1.1, 2.3].map((t) => idleSway(IDLE_SWAY.rifle, t, 1, false));
    expect(moving.some((s) => Math.abs(s.x) > 1e-4)).toBe(true);
    for (const t of [0.4, 1.1, 2.3]) expect(idleSway(IDLE_SWAY.rifle, t, 1, true)).toEqual({ x: 0, y: 0, roll: 0, pitch: 0 });
    // Aimed, it goes.
    expect(idleSway(IDLE_SWAY.rifle, 1.1, 0, false).x).toBe(0);
  });
});
