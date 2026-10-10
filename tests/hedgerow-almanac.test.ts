import { describe, expect, it } from "vitest";
import { MEGAS, TOWERS } from "../games/hedgerow/src/engine";
import { MEGA_LORE, TOWER_LORE, enemyRows, towerRows } from "../games/hedgerow/src/almanac";

describe("hedgerow almanac", () => {
  it("has a lore line for every megastructure", () => {
    for (const id of Object.keys(MEGAS)) expect(MEGA_LORE[id as keyof typeof MEGA_LORE]?.length).toBeGreaterThan(10);
  });
  it("has lore only for towers that exist", () => {
    for (const k of Object.keys(TOWER_LORE)) expect(TOWERS).toHaveProperty(k);
  });
  it("shows act 1's Fleet numbers: rungs in layers and children, towers at their fleet price (M2 review)", () => {
    const courier = new Map(enemyRows("courier"));
    expect(courier.get("Fleet Value")).toBe("1");
    expect(courier.has("Health")).toBe(false);
    expect(courier.has("Bounty")).toBe(false);
    const lorry = new Map(enemyRows("lorry"));
    expect(lorry.get("Fleet Value")).toBe("11");
    expect(lorry.get("Pops into")).toMatch(/^2 × /);
    const crow = new Map(towerRows("scarecrow"));
    expect(crow.get("Cost")).toMatch(/^200 in acts 1-3/);
    expect(crow.get("Acts 1-3 layers a hit")).toBe("1 / 1 / 2");
    expect(crow.get("Acts 1-3 pierce")).toBe("2 / 4 / 4");
  });
  it("names each tower's damage type and what it can't touch, and each rung's own properties (M3)", () => {
    const crow = new Map(towerRows("scarecrow"));
    expect(crow.get("Damage")).toBe("Sharp");
    expect(crow.get("Can't touch")).toBe("Plated");
    expect(new Map(towerRows("beehive")).get("Can't touch")).toBe("Sealed");
    expect(new Map(enemyRows("artic")).get("Always")).toBe("Wrapped, Reefer");
    expect(new Map(enemyRows("steel")).get("Always")).toBe("Plated");
  });
});
