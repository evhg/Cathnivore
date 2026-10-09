import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { laserState, laserTouches, lasersFrom, LASER_ON, LASER_PERIOD } from "../games/cathode/src/game/lasers";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("laser grids", () => {
  it("pulses on a fixed cycle with a warning before firing", () => {
    expect(laserState(0, 0).live).toBe(true);
    expect(laserState(LASER_ON + 0.1, 0).live).toBe(false);
    expect(laserState(LASER_PERIOD - 0.2, 0).warn).toBe(true);
    expect(laserState(LASER_PERIOD, 0).live).toBe(true);
  });
  it("touches only near the curtain and within its height", () => {
    const l = { a: V(-5, 3, 0), b: V(5, 3, 0), phase: 0 };
    expect(laserTouches(l, V(0, 3, 0.2))).toBe(true);
    expect(laserTouches(l, V(0, 3, 1.5))).toBe(false);
    expect(laserTouches(l, V(9, 3, 0))).toBe(false);
    expect(laserTouches(l, V(0, 0, 0))).toBe(false);
  });
  it("builds alternating grids from markers", () => {
    const g = lasersFrom({ "laser:a": [V(0, 0, 0), V(1, 0, 0)], "laser:b": [V(0, 0, 5), V(1, 0, 5)], other: [V(0, 0, 0)] });
    expect(g.length).toBe(2);
    expect(g[0]!.phase).not.toBe(g[1]!.phase);
  });
});
