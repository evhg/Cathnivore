import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Enemy, HUNTER, TURRET, type EnemyKit, type Sight } from "../games/cathode/src/game/enemy";
import { Progress } from "../games/cathode/src/game/progress";
import { buildVault } from "../games/cathode/src/render/levels/vault";

const sightAt = (x: number, z: number): Sight => ({
  eye: new THREE.Vector3(x, 1.6, z),
  chest: new THREE.Vector3(x, 1.2, z),
  light: 1,
  low: 0,
  speed: 0,
  stealth: 1,
});
const rays = { cast: () => null, clear: () => true } as never;
const run = (base: EnemyKit, role: "turret" | "hunter") => {
  const kit = { ...Progress.kit(base, "candorChrome", 5, 3), role };
  const e = new Enemy(kit, [new THREE.Vector3(0, 0, 0)], 5);
  e.state = "combat";
  e.detect = 1;
  let shots = 0;
  for (let i = 0; i < 400; i++) {
    e.update(0.05, sightAt(0, 20), rays, [], () => 0);
    shots += e.shots.length;
  }
  return { e, shots };
};

describe("vault enemies", () => {
  it("a turret holds its post and fires", () => {
    const { e, shots } = run(TURRET, "turret");
    expect(shots).toBeGreaterThan(0);
    expect(Math.hypot(e.motion.pos.x, e.motion.pos.z)).toBeLessThan(0.5);
  });
  it("a hunter drone fires while moving", () => {
    const { e, shots } = run(HUNTER, "hunter");
    expect(shots).toBeGreaterThan(0);
    expect(Math.hypot(e.motion.pos.x, e.motion.pos.z)).toBeGreaterThan(3);
  });
  it("the vault places turrets and hunters", () => {
    const m = buildVault("high").markers;
    expect(Object.keys(m).filter((k) => k.includes("turret")).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(m).filter((k) => k.includes("hunter")).length).toBeGreaterThanOrEqual(2);
  });
});
