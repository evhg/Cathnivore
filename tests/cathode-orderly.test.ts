import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Enemy, ORDERLY, ORDERLY_REACH, type Sight } from "../games/cathode/src/game/enemy";
import { Progress } from "../games/cathode/src/game/progress";

const sightAt = (x: number, z: number): Sight => ({
  eye: new THREE.Vector3(x, 1.6, z),
  chest: new THREE.Vector3(x, 1.2, z),
  light: 1,
  low: 0,
  speed: 0,
  stealth: 1,
});

describe("Candor orderly", () => {
  it("closes in and strikes in melee, never with a ranged shot", () => {
    const kit = { ...Progress.kit(ORDERLY, "candorChrome", 3, 5), role: "orderly" as const };
    const e = new Enemy(kit, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)], 3);
    const rays = { cast: () => null, clear: () => true } as never;
    e.state = "combat";
    e.detect = 1;
    let melee = 0;
    let ranged = 0;
    for (let i = 0; i < 600; i++) {
      e.update(0.05, sightAt(0, 12), rays, [], () => 0);
      for (const s of e.shots) {
        if (s.melee) melee++;
        else ranged++;
      }
    }
    expect(ranged).toBe(0);
    expect(melee).toBeGreaterThan(0);
    expect(Math.hypot(e.motion.pos.x, e.motion.pos.z - 12)).toBeLessThan(ORDERLY_REACH + 0.5);
  });
});
