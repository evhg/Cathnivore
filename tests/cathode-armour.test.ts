import { describe, expect, it } from "vitest";
import { ARMOUR, PLATE_SPEC, armourHit, disarmChance, disarmRoll, makeArmour, plateFor, resetArmour, shotgunSplit } from "../games/cathode/src/sim/armour";

const HP = 110;

describe("cathode-armour: absorb maths", () => {
  it("a standing chest plate keeps 65% of a round from him and takes the full round", () => {
    const a = makeArmour(HP);
    const r = armourHit(a, "torso", "chestF", 10, "rifle");
    expect(r.layer).toBe("plate");
    expect(r.plate).toBeCloseTo(10);
    expect(r.body).toBeCloseTo(3.5);
    expect(a.plates.chestF.hp).toBeCloseTo(PLATE_SPEC.chestF.share * HP - 10);
  });
  it("plate HP is its share of max HP (40/30/15/15/20%)", () => {
    const a = makeArmour(HP);
    expect(a.plates.chestF.maxHp).toBeCloseTo(44);
    expect(a.plates.chestB.maxHp).toBeCloseTo(33);
    expect(a.plates.pauldronL.maxHp).toBeCloseTo(16.5);
    expect(a.plates.pauldronR.maxHp).toBeCloseTo(16.5);
    expect(a.plates.helmet.maxHp).toBeCloseTo(22);
  });
  it("a breaking round sends the overflow through as flesh", () => {
    const a = makeArmour(HP);
    armourHit(a, "torso", "chestF", 40, "rifle");
    const r = armourHit(a, "torso", "chestF", 10, "rifle");
    // 4 HP left on the plate: it keeps 65% of 4, the other 6 goes through whole.
    expect(r.broke).toBe(true);
    expect(r.body).toBeCloseTo(4 * 0.35 + 6);
    const after = armourHit(a, "torso", "chestF", 10, "rifle");
    expect(after.layer).toBe("flesh");
    expect(after.body).toBeCloseTo(10);
  });
  it("limbs take 0.75", () => {
    const a = makeArmour(HP);
    expect(armourHit(a, "legL", null, 20, "rifle").body).toBeCloseTo(15);
  });
});

describe("cathode-armour: crack and break thresholds", () => {
  it("cracks at 50% of its HP and breaks at 0", () => {
    const a = makeArmour(HP);
    const r1 = armourHit(a, "torso", "chestF", 21, "rifle");
    expect(r1.cracked).toBeUndefined();
    expect(a.plates.chestF.state).toBe("intact");
    const r2 = armourHit(a, "torso", "chestF", 2, "rifle");
    expect(r2.cracked).toBe(true);
    expect(a.plates.chestF.state).toBe("cracked");
    const r3 = armourHit(a, "torso", "chestF", 30, "rifle");
    expect(r3.broke).toBe(true);
    expect(a.plates.chestF.state).toBe("broken");
  });
  it("six rifle rounds to the chest break the front plate (the e2e's plateBreak)", () => {
    const a = makeArmour(HP);
    let broke = 0;
    for (let i = 0; i < 6; i++) if (armourHit(a, "torso", "chestF", 24, "rifle").broke) broke++;
    expect(broke).toBe(1);
  });
  it("crack fires once, break fires once", () => {
    const a = makeArmour(HP);
    const flags = Array.from({ length: 8 }, () => armourHit(a, "torso", "chestB", 5, "rifle"));
    expect(flags.filter((f) => f.cracked).length).toBe(1);
    expect(flags.filter((f) => f.broke).length).toBe(1);
  });
  it("reset puts every plate back", () => {
    const a = makeArmour(HP);
    armourHit(a, "torso", "chestF", 100, "rifle");
    armourHit(a, "head", "visor", 10, "pistol");
    resetArmour(a);
    expect(a.plates.chestF.state).toBe("intact");
    expect(a.plates.chestF.hp).toBeCloseTo(44);
    expect(a.visor).toBe(0);
  });
});

describe("cathode-armour: the Kestrel against a fresh plate", () => {
  // The Kestrel's 34 at level 1 (aim adds up to about 10%), and its crit at x1.5.
  for (const raw of [34, 37.4, 56.1, 80]) {
    it(`one ${raw} Kestrel round on a fresh chest plate leaves it intact or cracked, never broken`, () => {
      const a = makeArmour(HP);
      const r = armourHit(a, "torso", "chestF", raw, "pistol");
      expect(r.broke).toBeUndefined();
      expect(a.plates.chestF.state).not.toBe("broken");
      expect(r.body).toBeCloseTo(raw * 0.35);
    });
  }
  it("non-crit Kestrel rounds crack the chest plate, then break it on the third", () => {
    const a = makeArmour(HP);
    const states: string[] = [];
    for (let i = 0; i < 3; i++) {
      armourHit(a, "torso", "chestF", 37.4, "pistol");
      states.push(a.plates.chestF.state);
    }
    expect(states).toEqual(["intact", "cracked", "broken"]);
  });
  it("the back plate also survives one round and cracks before it breaks", () => {
    const a = makeArmour(HP);
    armourHit(a, "torso", "chestB", 56, "pistol");
    expect(a.plates.chestB.state).toBe("cracked");
    expect(armourHit(a, "torso", "chestB", 34, "pistol").broke).toBe(true);
  });
});

describe("cathode-armour: where a round lands", () => {
  it("the pauldron covers only the outer 120 degrees of the upper arm", () => {
    // Straight out from the left arm (body +x): on the plate.
    expect(plateFor("armL", "upperArmL", { x: 1, z: 0 }, 0.3, true)).toBe("pauldronL");
    // 55 degrees off the outward axis: still inside the 60-degree half arc.
    const a55 = (55 * Math.PI) / 180;
    expect(plateFor("armL", "upperArmL", { x: Math.cos(a55), z: Math.sin(a55) }, 0.3, true)).toBe("pauldronL");
    // 65 degrees off: outside.
    const a65 = (65 * Math.PI) / 180;
    expect(plateFor("armL", "upperArmL", { x: Math.cos(a65), z: Math.sin(a65) }, 0.3, true)).toBeNull();
    // The inner face (toward the chest) is bare.
    expect(plateFor("armL", "upperArmL", { x: -1, z: 0 }, 0.3, true)).toBeNull();
    // The right arm's outside is body -x.
    expect(plateFor("armR", "upperArmR", { x: -1, z: 0 }, 0.3, true)).toBe("pauldronR");
    // Low on the arm (past 60%) is the sleeve.
    expect(plateFor("armL", "upperArmL", { x: 1, z: 0 }, 0.8, true)).toBeNull();
  });
  it("front plate, back plate, coolant, and the visor from the front", () => {
    expect(plateFor("torso", "chest", { x: 0, z: 1 }, 0.5, true)).toBe("chestF");
    expect(plateFor("torso", "upperChest", { x: 0.2, z: -0.98 }, 0.5, false)).toBe("chestB");
    expect(plateFor("torso", "chest", { x: 0, z: -1 }, 0.4, false)).toBe("coolant");
    expect(plateFor("torso", "abdomen", { x: 0, z: 1 }, 0.5, true)).toBeNull();
    expect(plateFor("head", "head", { x: 0, z: 1 }, 0.5, true)).toBe("visor");
    expect(plateFor("head", "head", { x: 0, z: -1 }, 0.5, false)).toBe("helmet");
  });
  it("close shotgun pellets spread over the struck plate and its neighbours", () => {
    expect(shotgunSplit("chestF")).toEqual(["chestF", "pauldronL", "pauldronR"]);
    expect(shotgunSplit("helmet")).toEqual(["helmet"]);
  });
});

describe("cathode-armour: visor stages", () => {
  it("the first head hit cracks the visor, the second shatters it; the head multiplier goes 2.0 to 2.5", () => {
    const a = makeArmour(HP);
    const r1 = armourHit(a, "head", "visor", 10, "pistol");
    expect(r1.layer).toBe("visor");
    expect(r1.visorStage).toBe(1);
    expect(r1.zoneMul).toBe(ARMOUR.headVisor);
    expect(r1.body).toBeCloseTo(20);
    const r2 = armourHit(a, "head", "visor", 10, "pistol");
    expect(r2.visorStage).toBe(2);
    expect(r2.broke).toBe(true);
    const r3 = armourHit(a, "head", "visor", 10, "pistol");
    expect(r3.layer).toBe("flesh");
    expect(r3.zoneMul).toBe(2.5);
    expect(r3.body).toBeCloseTo(25);
  });
  it("the sniper keeps its 4.0", () => {
    const a = makeArmour(HP);
    expect(armourHit(a, "head", "visor", 10, "sniper").zoneMul).toBe(4);
  });
});

describe("cathode-armour: the vent", () => {
  it("the coolant can takes double, vents at 0 and stops him sprinting", () => {
    const a = makeArmour(HP);
    const cap = PLATE_SPEC.coolant.share * HP;
    const r1 = armourHit(a, "torso", "coolant", cap / 4, "rifle");
    expect(r1.layer).toBe("weakpoint");
    expect(r1.body).toBeCloseTo(cap / 2);
    expect(a.vented).toBe(false);
    const r2 = armourHit(a, "torso", "coolant", cap / 4, "rifle");
    expect(r2.vented).toBe(true);
    expect(a.vented).toBe(true);
    // Vented once: the next round on it is flesh.
    expect(armourHit(a, "torso", "coolant", 4, "rifle").layer).toBe("flesh");
  });
});

describe("cathode-armour: disarm", () => {
  it("rolls 0.25 + 0.5 x damage/maxHp on the weapon forearm or hand, pistol-class or heavier", () => {
    expect(disarmChance(0, HP)).toBeCloseTo(0.25);
    expect(disarmChance(55, HP)).toBeCloseTo(0.5);
    const a = makeArmour(HP);
    expect(disarmRoll(a, "forearmL", "pistol", 30, HP, 0)).toBe(false);
    expect(disarmRoll(a, "forearmR", "smg", 30, HP, 0)).toBe(false);
    expect(disarmRoll(a, "upperArmR", "pistol", 30, HP, 0)).toBe(false);
    expect(disarmRoll(a, "handR", "pistol", 30, HP, 0.99)).toBe(false);
  });
  it("happens at most once", () => {
    const a = makeArmour(HP);
    expect(disarmRoll(a, "forearmR", "pistol", 30, HP, 0)).toBe(true);
    expect(disarmRoll(a, "forearmR", "pistol", 30, HP, 0)).toBe(false);
    expect(disarmRoll(a, "handR", "rifle", 80, HP, 0)).toBe(false);
  });
});
