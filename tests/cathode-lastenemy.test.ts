import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { encounterCleared } from "../games/cathode/src/game/combat";
import { Timescale } from "../games/cathode/src/game/feel/timescale";
import { tuning } from "../games/cathode/src/game/feel/tuning";

const guy = (x: number, state = "unaware", alive = true, role = "rifle") => ({ alive, state, position: new THREE.Vector3(x, 0, 0), kit: { role } });

describe("CATHODE last enemy of the encounter (S1.4, S1.5)", () => {
  it("is the last when nobody armed is fighting, hunting or standing close", () => {
    const fallen = guy(0, "dead", false);
    expect(encounterCleared(fallen, [fallen, guy(50)])).toBe(true);
    expect(encounterCleared(fallen, [fallen, guy(50, "combat")])).toBe(false);
    expect(encounterCleared(fallen, [fallen, guy(50, "searching")])).toBe(false);
    expect(encounterCleared(fallen, [fallen, guy(8)])).toBe(false);
    // Bystanders and the dead don't keep a fight going.
    expect(encounterCleared(fallen, [fallen, guy(3, "combat", true, "civilian"), guy(2, "combat", false)])).toBe(true);
  });

  it("holds 120 ms, runs at 0.35x for 700 ms, then ramps back over 250 ms", () => {
    const ts = new Timescale();
    const L = tuning.lastEnemySlowmo;
    ts.hitStop(tuning.hitStop.lastEnemy);
    ts.push("lastEnemy", L.scale, tuning.hitStop.lastEnemy + L.holdMs, 0, L.rampOutMs, "focus");
    // A kill's own 60 ms stop arrives in the same frame and never shortens it.
    ts.hitStop(tuning.hitStop.kill);
    const at = (ms: number) => {
      const t = new Timescale();
      t.hitStop(tuning.hitStop.lastEnemy);
      t.push("lastEnemy", L.scale, tuning.hitStop.lastEnemy + L.holdMs, 0, L.rampOutMs, "focus");
      for (let k = 0; k < ms; k += 5) t.update(0.005);
      return t.simScale;
    };
    expect(ts.simScale).toBe(0);
    expect(at(100)).toBe(0);
    expect(at(300)).toBeCloseTo(0.35);
    expect(at(800)).toBeCloseTo(0.35);
    const mid = at(950);
    expect(mid).toBeGreaterThan(0.35);
    expect(mid).toBeLessThan(1);
    expect(at(1100)).toBe(1);
  });
});
