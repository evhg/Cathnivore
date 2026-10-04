import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Pickups, PICKUP_LIFE, bestRarity } from "../games/cathode/src/game/pickups";

const item = (rarity: string) => ({ rarity, name: "x", kind: "weapon" }) as never;

describe("loot pickups", () => {
  it("collects a bundle when she walks over it, once", () => {
    const p = new Pickups();
    p.drop(new THREE.Vector3(5, 0, 5), { items: [], scrip: 12 });
    expect(p.update(0.1, new THREE.Vector3(0, 0, 0))).toHaveLength(0);
    expect(p.update(0.1, new THREE.Vector3(5.5, 0, 5))).toEqual([{ items: [], scrip: 12 }]);
    expect(p.update(0.1, new THREE.Vector3(5.5, 0, 5))).toHaveLength(0);
  });
  it("ignores empty drops and expires old ones", () => {
    const p = new Pickups();
    expect(p.drop(new THREE.Vector3(), { items: [], scrip: 0 })).toBeNull();
    p.drop(new THREE.Vector3(9, 0, 9), { items: [], scrip: 3 });
    p.update(PICKUP_LIFE + 1, new THREE.Vector3());
    expect(p.list).toHaveLength(0);
  });
  it("does not pick up across floors", () => {
    const p = new Pickups();
    p.drop(new THREE.Vector3(1, 0, 1), { items: [], scrip: 3 });
    expect(p.update(0.1, new THREE.Vector3(1, 6, 1))).toHaveLength(0);
  });
  it("tints by the best rarity", () => {
    expect(bestRarity({ items: [item("standard"), item("rare")], scrip: 0 })).toBe("rare");
  });
});
