// C19 "Gore and dismemberment" (docs/design/cathode-combat.md S4.5): the sever rules.
import { describe, expect, it } from "vitest";
import { blastSevers, CLOSE_SEVER_RANGE, SEVER, severPart, severs, type SeverQuery } from "../games/cathode/src/sim/damage";

const HP = 110;
const q = (o: Partial<SeverQuery>): SeverQuery => ({ part: "forearm", weaponCls: "rifle", damage: 0, maxHp: HP, lethal: true, distance: 5, headOpen: true, ...o });
const PARTS = ["head", "upperArm", "forearm", "hand", "thigh", "shin", "torso"] as const;

describe("cathode-sever: the pistol", () => {
  it("never severs, whatever the damage, zone or range", () => {
    for (const cls of ["pistol", "revolver", "smart"])
      for (const part of PARTS)
        for (const lethal of [true, false])
          for (const damage of [10, 60, 200, 1000])
            for (const distance of [0.5, 3, 20]) {
              const fore = part === "forearm" || part === "hand";
              if (fore && lethal) continue; // the one exception, below
              expect(severs(q({ weaponCls: cls, part, lethal, damage, distance, crit: true }))).toBe(false);
            }
  });
  it("except a lethal forearm crit of at least 0.4 x max HP", () => {
    const at = SEVER.pistolCritShare * HP;
    expect(severs(q({ weaponCls: "pistol", part: "forearm", damage: at, crit: true }))).toBe(true);
    expect(severs(q({ weaponCls: "pistol", part: "forearm", damage: at - 0.01, crit: true }))).toBe(false);
    expect(severs(q({ weaponCls: "pistol", part: "forearm", damage: at * 2, crit: false }))).toBe(false);
    expect(severs(q({ weaponCls: "pistol", part: "forearm", damage: at * 2, crit: true, lethal: false }))).toBe(false);
    expect(severs(q({ weaponCls: "pistol", part: "upperArm", damage: at * 2, crit: true }))).toBe(false);
  });
});

describe("cathode-sever: the shotgun", () => {
  it("severs a killing blow on any limb or the head at close range, even light damage", () => {
    for (const part of ["head", "upperArm", "forearm", "thigh", "shin"] as const) {
      expect(severs(q({ weaponCls: "shotgun", part, damage: 5, distance: 2, headOpen: false }))).toBe(true);
      expect(severs(q({ weaponCls: "shotgun", part, damage: 5, distance: CLOSE_SEVER_RANGE }))).toBe(true);
    }
  });
  it("needs the damage beyond close range", () => {
    expect(severs(q({ weaponCls: "shotgun", part: "thigh", damage: 20, distance: CLOSE_SEVER_RANGE + 1 }))).toBe(false);
    expect(severs(q({ weaponCls: "shotgun", part: "thigh", damage: SEVER.limbShare * HP * SEVER.killMul, distance: 12 }))).toBe(true);
  });
  it("takes a forearm without killing, close in, and nothing else", () => {
    const d = SEVER.nonLethalShare * HP;
    expect(severs(q({ weaponCls: "shotgun", part: "forearm", lethal: false, damage: d, distance: 3 }))).toBe(true);
    expect(severs(q({ weaponCls: "shotgun", part: "forearm", lethal: false, damage: d - 1, distance: 3 }))).toBe(false);
    expect(severs(q({ weaponCls: "shotgun", part: "forearm", lethal: false, damage: d, distance: 9 }))).toBe(false);
    for (const part of ["head", "upperArm", "thigh", "shin"] as const) expect(severs(q({ weaponCls: "shotgun", part, lethal: false, damage: 500, distance: 1 }))).toBe(false);
  });
  it("never severs the trunk", () => {
    expect(severs(q({ weaponCls: "shotgun", part: "torso", damage: 500, distance: 1 }))).toBe(false);
  });
});

describe("cathode-sever: the other rules", () => {
  it("a killing limb hit severs at share x maxHp x 1.5", () => {
    const t = SEVER.limbShare * HP * SEVER.killMul;
    expect(severs(q({ weaponCls: "rifle", part: "thigh", damage: t }))).toBe(true);
    expect(severs(q({ weaponCls: "rifle", part: "thigh", damage: t - 0.1 }))).toBe(false);
  });
  it("the sniper takes an open head; a helmeted one only to the heavy rule", () => {
    expect(severs(q({ weaponCls: "sniper", part: "head", damage: 30, headOpen: true }))).toBe(true);
    expect(severs(q({ weaponCls: "sniper", part: "head", damage: 30, headOpen: false }))).toBe(false);
    // S4.5's general rule holds under a helmet: share x maxHp x 1.5 takes the head, helmet and all.
    const t = SEVER.headShare * HP * SEVER.killMul;
    expect(severs(q({ weaponCls: "sniper", part: "head", damage: t, headOpen: false }))).toBe(true);
    expect(severs(q({ weaponCls: "rifle", part: "head", damage: t, headOpen: false }))).toBe(true);
    expect(severs(q({ weaponCls: "rifle", part: "head", damage: t - 0.1, headOpen: false }))).toBe(false);
    // And a non-lethal sniper round only ever takes a forearm.
    expect(severs(q({ weaponCls: "sniper", part: "head", lethal: false, damage: 900 }))).toBe(false);
    expect(severs(q({ weaponCls: "sniper", part: "forearm", lethal: false, damage: 98 }))).toBe(true);
  });
  it("non-lethal severs never come from the rifle, SMG or a blade", () => {
    for (const cls of ["rifle", "smg", "melee", "launcher"]) expect(severs(q({ weaponCls: cls, part: "forearm", lethal: false, damage: 500, distance: 1, edged: true }))).toBe(false);
  });
  it("blunt melee never severs; a blade does at half the threshold", () => {
    const t = SEVER.limbShare * HP * SEVER.killMul;
    expect(severs(q({ weaponCls: "melee", part: "forearm", damage: 900, distance: 1 }))).toBe(false);
    expect(severs(q({ weaponCls: "melee", part: "forearm", damage: t * 0.5, distance: 1, edged: true }))).toBe(true);
  });
  it("an explosive within 3 m severs a killing blow; legs first", () => {
    expect(severs(q({ weaponCls: "launcher", part: "shin", damage: 1, distance: 2.9 }))).toBe(true);
    expect(severs(q({ weaponCls: "launcher", part: "shin", damage: 1, distance: 3.5 }))).toBe(false);
    let i = 0;
    const rolls = [0.99, 0.99, 0.99, 0.99];
    expect(blastSevers(1, true, false, () => rolls[i++ % 4]!)).toEqual(["shinL"]);
    expect(blastSevers(4, true, false, Math.random)).toEqual([]);
    const legs = blastSevers(0.5, true, false, () => 0);
    expect(legs.slice(0, 2)).toEqual(["shinL", "shinR"]);
  });
  it("reduced violence never severs, whatever the hit", () => {
    for (const cls of ["pistol", "shotgun", "sniper", "launcher", "rifle", "melee"])
      for (const part of PARTS)
        for (const lethal of [true, false]) expect(severs(q({ weaponCls: cls, part, lethal, damage: 5000, distance: 0.5, crit: true, edged: true, explosive: true, reduced: true }))).toBe(false);
    expect(blastSevers(0.2, true, true, () => 0)).toEqual([]);
  });
  it("names segments as parts", () => {
    expect(severPart("forearmL")).toBe("forearm");
    expect(severPart("handR")).toBe("hand");
    expect(severPart("shinR")).toBe("shin");
    expect(severPart("upperChest")).toBe("torso");
    expect(severPart("head")).toBe("head");
  });
});
