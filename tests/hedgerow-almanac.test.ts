import { describe, expect, it } from "vitest";
import { MEGAS, TOWERS } from "../games/hedgerow/src/engine";
import { MEGA_LORE, TOWER_LORE } from "../games/hedgerow/src/almanac";

describe("hedgerow almanac", () => {
  it("has a lore line for every megastructure", () => {
    for (const id of Object.keys(MEGAS)) expect(MEGA_LORE[id as keyof typeof MEGA_LORE]?.length).toBeGreaterThan(10);
  });
  it("has lore only for towers that exist", () => {
    for (const k of Object.keys(TOWER_LORE)) expect(TOWERS).toHaveProperty(k);
  });
});
