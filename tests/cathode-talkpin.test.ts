import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { wallPin } from "../games/cathode/src/game/talkpin";

const wall = (x0: number, x1: number, z0: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 4, z1));

// Plan item 42: the lieutenant is pinned to the nearest wall in reach, his back to it, Cath a step in front.
describe("wallPin", () => {
  it("puts him against the nearest wall and her in front of him", () => {
    const p = wallPin(new THREE.Vector3(0, 0, 0), [wall(-10, 10, 2, 2.5), wall(-10, 10, -6, -5.5)])!;
    expect(p).not.toBeNull();
    expect(p.toWall.z).toBeCloseTo(1, 5);
    expect(p.him.z).toBeCloseTo(1.7, 2);
    expect(p.her.z).toBeLessThan(p.him.z);
    expect(p.him.z - p.her.z).toBeCloseTo(1.05, 2);
  });
  it("skips a wall too close for the two of them and anything low", () => {
    const p = wallPin(new THREE.Vector3(0, 0, 0), [wall(-10, 10, 0.6, 1), wall(-10, 10, -3, -2.5), new THREE.Box3(new THREE.Vector3(2, 0, -1), new THREE.Vector3(3, 0.5, 1))])!;
    expect(p.toWall.z).toBeCloseTo(-1, 5);
  });
  it("is null in the open, and ignores the slab she stands in", () => {
    expect(wallPin(new THREE.Vector3(0, 0, 0), [new THREE.Box3(new THREE.Vector3(-50, -1, -50), new THREE.Vector3(50, 5, 50))])).toBeNull();
    expect(wallPin(new THREE.Vector3(0, 0, 0), [])).toBeNull();
  });
});
