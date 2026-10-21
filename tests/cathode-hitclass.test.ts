import { describe, expect, it } from "vitest";
import { hitClass, hitStopMs, showsMarker, confirmSound, hardHit } from "../games/cathode/src/sim/hitevent";
import { tuning } from "../games/cathode/src/game/feel/tuning";

const base = { zone: "torso" as const, lethal: false, layer: "flesh" as const, penetrated: false, crit: false };

describe("CATHODE hit classes (S1.2)", () => {
  it("picks the marker from zone, kill, plate and penetration, never from damage", () => {
    expect(hitClass(base)).toBe("body");
    expect(hitClass({ ...base, zone: "head" })).toBe("head");
    expect(hitClass({ ...base, crit: true })).toBe("head");
    expect(hitClass({ ...base, layer: "plate" })).toBe("armour");
    expect(hitClass({ ...base, layer: "plate", plateBroke: true })).toBe("armourBreak");
    expect(hitClass({ ...base, penetrated: true })).toBe("pen");
    expect(hitClass({ ...base, lethal: true })).toBe("kill");
    expect(hitClass({ ...base, lethal: true, zone: "head" })).toBe("headKill");
    expect(hitClass({ ...base, lethal: true, layer: "plate" })).toBe("kill");
  });

  it("never shows a marker for a round that cover stopped", () => {
    expect(showsMarker({ kind: "blocked" })).toBe(false);
    expect(showsMarker({ kind: "nearMiss" })).toBe(false);
    expect(showsMarker({ kind: "hit" })).toBe(true);
  });

  it("kill markers are bigger than body markers; the 5K tick is at least 26 x 6 physical px", () => {
    const M = tuning.marker;
    expect(M.kill.len).toBeGreaterThan(M.body.len);
    // At 2560x1440 @2, 1u = 1440/1080 CSS px = 2.67 physical px (S8).
    const u = (1440 / 1080) * 2;
    expect(M.body.len * u).toBeGreaterThanOrEqual(26);
    expect(M.body.thick * u).toBeGreaterThanOrEqual(6);
    expect(tuning.killRing.toU * u).toBeGreaterThanOrEqual(100);
    // Never smaller than the spec table (10u x 2.25u body, 15u x 3u kill).
    expect(M.body.len).toBeGreaterThanOrEqual(10);
    expect(M.body.thick).toBeGreaterThanOrEqual(2.25);
    expect(M.kill.len).toBeGreaterThanOrEqual(15);
  });

  it("follows the hit-stop table, with no stop for automatic body hits", () => {
    expect(hitStopMs({ zone: "torso", lethal: false, crit: false, weaponCls: "pistol" })).toBe(12);
    expect(hitStopMs({ zone: "torso", lethal: false, crit: false, weaponCls: "smg" })).toBe(0);
    expect(hitStopMs({ zone: "head", lethal: false, crit: false, weaponCls: "revolver" })).toBe(20);
    expect(hitStopMs({ zone: "torso", lethal: true, crit: false, weaponCls: "pistol" })).toBe(60);
    expect(hitStopMs({ zone: "torso", lethal: true, crit: false, weaponCls: "rifle" })).toBe(40);
    expect(hitStopMs({ zone: "head", lethal: true, crit: false, weaponCls: "sniper" })).toBe(110);
    expect(hitStopMs({ zone: "torso", lethal: false, crit: false, weaponCls: "melee" })).toBe(40);
  });

  it("maps classes to confirm sounds", () => {
    expect(confirmSound("armourBreak")).toBe("plateBreak");
    expect(confirmSound("headKill")).toBe("headKill");
  });

  it("a visor shatter reads as a break: the break marker, its own glassy confirm and the plate-break hit-stop", () => {
    const shatter = { ...base, zone: "head" as const, layer: "visor" as const, visorStage: 2 as const };
    const crack = { ...shatter, visorStage: 1 as const };
    expect(hitClass(shatter)).toBe("armourBreak");
    expect(confirmSound(hitClass(shatter), shatter)).toBe("visor");
    expect(hitStopMs({ ...shatter, weaponCls: "pistol" })).toBe(tuning.hitStop.plateBreak);
    // The first hit only cracks it: the armour marker and ping, the head's stop.
    expect(hitClass(crack)).toBe("armour");
    expect(confirmSound(hitClass(crack), crack)).toBe("armour");
    expect(hitStopMs({ ...crack, weaponCls: "pistol" })).toBe(tuning.hitStop.crit);
    // The world impact: metal on a plate or a visor that holds, meat only once the face is open.
    expect(hardHit({ layer: "plate" })).toBe(true);
    expect(hardHit(crack)).toBe(true);
    expect(hardHit(shatter)).toBe(false);
    expect(hardHit({ layer: "flesh" })).toBe(false);
    // A plate break keeps its own sound.
    expect(confirmSound("armourBreak", { layer: "plate" })).toBe("plateBreak");
  });
});
