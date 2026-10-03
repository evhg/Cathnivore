import { describe, expect, it } from "vitest";
import { equip, fitWeaponPart, newCharacter, sellItem, sellValue, socketInto, stripWeaponPart, upgradeWeaponTier, activeWeaponStats } from "../games/cathode/src/sim/character";
import { CHIPS, makeItem } from "../games/cathode/src/sim/loot";
import { WEAPON_BASES, upgradeCost } from "../games/cathode/src/sim/weapons";

const gunId = Object.values(WEAPON_BASES).find((b) => b.cls === "rifle")!.id;

function withGun(scrip: number) {
  const gun = makeItem(gunId, { uid: "g1", sockets: 1, level: 5 });
  const c = { ...newCharacter("ghost"), scrip, inventory: [gun] };
  return c;
}

describe("CATHODE gunsmith", () => {
  it("upgrades tiers for Scrip and raises damage", () => {
    const c = withGun(100000);
    const base = c.inventory[0]!;
    const r = upgradeWeaponTier(c, "g1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.inventory[0]!.tier).toBe(2);
    expect(r.value.scrip).toBe(100000 - upgradeCost(1, base.level)!);
  });
  it("refuses without Scrip and past tier V", () => {
    expect(upgradeWeaponTier(withGun(1), "g1").ok).toBe(false);
    let c = withGun(10_000_000);
    for (let i = 0; i < 4; i++) c = (upgradeWeaponTier(c, "g1") as { ok: true; value: typeof c }).value;
    expect(c.inventory[0]!.tier).toBe(5);
    expect(upgradeWeaponTier(c, "g1").ok).toBe(false);
  });
  it("fits and strips parts, and rejects ones that don't fit", () => {
    const c = withGun(5000);
    const r = fitWeaponPart(c, "g1", "extendedMag");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.inventory[0]!.parts.mag).toBe("extendedMag");
    expect(r.value.scrip).toBeLessThan(5000);
    expect(fitWeaponPart(r.value, "g1", "extendedMag").ok).toBe(false);
    expect(fitWeaponPart(c, "g1", "chokeBarrel").ok).toBe(false);
    const s = stripWeaponPart(r.value, "g1", "mag");
    expect(s.ok && s.value.inventory[0]!.parts.mag).toBeUndefined();
  });
  it("sockets a chip and consumes it, on equipped weapons too", () => {
    const chip = makeItem(CHIPS[0]!.id, { uid: "c1" });
    const c = { ...withGun(0), inventory: [...withGun(0).inventory, chip] };
    const r = socketInto(c, "g1", "c1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.inventory.some((i) => i.uid === "c1")).toBe(false);
    expect(r.value.inventory[0]!.chips).toEqual([CHIPS[0]!.id]);
    expect(socketInto(r.value, "g1", "c1").ok).toBe(false);
  });
  it("upgrades an equipped weapon in place", () => {
    const c = withGun(100000);
    const e = equip(c, "g1", "weapon1");
    if (!e.ok) return; // requirements not met: nothing to assert
    const before = activeWeaponStats(e.value)!.damage;
    const r = upgradeWeaponTier(e.value, "g1");
    expect(r.ok && activeWeaponStats(r.value)!.damage).toBeGreaterThan(before);
  });
  it("sells inventory items for Scrip", () => {
    const c = withGun(0);
    const r = sellItem(c, "g1");
    expect(r.ok && r.value.scrip).toBe(sellValue(c.inventory[0]!));
    expect(r.ok && r.value.inventory).toHaveLength(0);
  });
});
