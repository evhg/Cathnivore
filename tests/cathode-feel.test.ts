import { describe, expect, it, vi } from "vitest";
import { Spring1, Spring3 } from "../games/cathode/src/game/feel/spring";
import { Trauma } from "../games/cathode/src/game/feel/trauma";
import { CombatBus } from "../games/cathode/src/game/feel/bus";
import { tuning } from "../games/cathode/src/game/feel/tuning";

describe("CATHODE feel runtime (S0)", () => {
  it("a critically damped spring settles within 2% near the analytic time", () => {
    const f = 4;
    const s = new Spring1({ freqHz: f, zeta: 1 }, 1);
    s.target = 0;
    // Critically damped: x(t) = (1 + wt) e^(-wt). Within 2% when (1+wt)e^(-wt) = 0.02, wt ≈ 5.83.
    const tAnalytic = 5.83 / (2 * Math.PI * f);
    let t = 0;
    while (Math.abs(s.x) > 0.02 && t < 2) {
      s.update(1 / 120);
      t += 1 / 120;
    }
    expect(Math.abs(t - tAnalytic)).toBeLessThan(0.03);
  });

  it("a spring stays stable at dt = 0.1 s", () => {
    const s = new Spring3({ freqHz: 12, zeta: 0.4 });
    s.shove(5, -3, 2);
    for (let i = 0; i < 50; i++) s.update(0.1);
    const [x, y, z] = s.update(0.1);
    expect(Math.abs(x) + Math.abs(y) + Math.abs(z)).toBeLessThan(1e-3);
  });

  it("trauma decays from 1 to 0 in about 0.63 s, and is 0 at trauma 0", () => {
    const tr = new Trauma();
    expect(tr.sample()).toEqual({ pitch: 0, yaw: 0, roll: 0, x: 0, y: 0 });
    tr.add(1);
    let t = 0;
    while (tr.value > 0) {
      tr.update(1 / 240);
      t += 1 / 240;
    }
    expect(t).toBeCloseTo(1 / tuning.trauma.decayPerS, 1);
    expect(t).toBeGreaterThan(0.6);
    expect(t).toBeLessThan(0.66);
  });

  it("trauma caps at 1, and at 0.3 with no roll under reduced motion", () => {
    const tr = new Trauma();
    tr.add(0.8);
    tr.add(0.8);
    expect(tr.value).toBe(1);
    const rm = new Trauma();
    rm.reducedMotion = true;
    rm.add(1);
    expect(rm.value).toBe(tuning.trauma.reducedMotionCap);
    rm.update(0.01);
    expect(rm.sample().roll).toBe(0);
    const max = (tuning.trauma.maxRotDeg * Math.PI) / 180;
    tr.update(0.01);
    const s = tr.sample();
    expect(Math.abs(s.pitch)).toBeLessThanOrEqual(max);
  });

  it("the bus calls each listener once per emit, and unsubscribing stops it", () => {
    const bus = new CombatBus();
    const a = vi.fn();
    const b = vi.fn();
    const off = bus.on("encounterCleared", a);
    bus.on("encounterCleared", b);
    bus.emit("encounterCleared", { t: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    off();
    bus.emit("encounterCleared", { t: 2 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
