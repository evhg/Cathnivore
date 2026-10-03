import { describe, expect, it } from "vitest";
import {
  ALARM_COOLDOWN,
  LOSE_COMBAT_AFTER,
  QUIET_AREA,
  SEARCH_TIME,
  SUSPICION_TIME,
  UNAWARE,
  alarmEffects,
  detectionRate,
  hearNoise,
  hears,
  raiseAlarm,
  stepAlarm,
  stepDetection,
  type AwarenessState,
  type MaskingEvent,
  type NoiseEvent,
  type Observation,
} from "../games/cathode/src/sim/stealth";

const seen: Observation = {
  distance: 15,
  angle: 10,
  visionCone: 100,
  visionRange: 45,
  lineOfSight: true,
  light: 0.8,
  stance: "stand",
  speed: 2,
  detectionMultiplier: 1,
};

/** Seconds of steady observation until the enemy reaches combat (Infinity if it never does within 60 s). */
function timeToSpot(obs: Observation): number {
  let s: AwarenessState = UNAWARE;
  for (let t = 0; t < 60; t += 0.05) {
    s = stepDetection(s, obs, 0.05);
    if (s.state === "combat") return t;
  }
  return Infinity;
}

describe("CATHODE detection meter", () => {
  it("fills to suspicious, then combat, while Cath stays in view", () => {
    let s: AwarenessState = UNAWARE;
    const states = new Set<string>();
    for (let i = 0; i < 200 && s.state !== "combat"; i++) {
      s = stepDetection(s, seen, 0.05);
      states.add(s.state);
    }
    expect(states.has("suspicious")).toBe(true);
    expect(s.state).toBe("combat");
    expect(s.meter).toBe(1);
  });

  it("is slower for a crouch than standing, and slower again prone", () => {
    const stand = timeToSpot(seen);
    const crouch = timeToSpot({ ...seen, stance: "crouch" });
    const prone = timeToSpot({ ...seen, stance: "prone" });
    expect(crouch).toBeGreaterThan(stand * 1.5);
    expect(prone).toBeGreaterThan(crouch);
  });

  it("never detects Cath outside the cone, out of range or behind cover", () => {
    expect(detectionRate({ ...seen, angle: 51 })).toBe(0);
    expect(detectionRate({ ...seen, angle: -80 })).toBe(0);
    expect(detectionRate({ ...seen, distance: 46 })).toBe(0);
    expect(detectionRate({ ...seen, lineOfSight: false })).toBe(0);
    expect(timeToSpot({ ...seen, angle: 120, distance: 2 })).toBe(Infinity);
  });

  it("is helped by darkness, distance, stillness, the cone's edge and Nerve", () => {
    const base = detectionRate(seen);
    expect(detectionRate({ ...seen, light: 0.05 })).toBeLessThan(base * 0.3);
    expect(detectionRate({ ...seen, distance: 35 })).toBeLessThan(base);
    expect(detectionRate({ ...seen, speed: 0 })).toBeLessThan(base);
    expect(detectionRate({ ...seen, speed: 7 })).toBeGreaterThan(base);
    expect(detectionRate({ ...seen, angle: 49 })).toBeLessThan(base);
    expect(detectionRate({ ...seen, detectionMultiplier: 0.5 })).toBeCloseTo(base / 2);
    expect(detectionRate({ ...seen, alarm: 2 })).toBeCloseTo(base * 1.5);
    expect(timeToSpot({ ...seen, light: 0.05, stance: "crouch", speed: 1 })).toBeGreaterThan(timeToSpot(seen) * 5);
  });

  it("spots Cath instantly at point-blank range in the cone", () => {
    expect(stepDetection(UNAWARE, { ...seen, distance: 1, light: 0 }, 0.016).state).toBe("combat");
  });

  it("decays: combat → searching → suspicious → unaware", () => {
    const hidden = { ...seen, lineOfSight: false };
    let s: AwarenessState = { state: "combat", meter: 1, sinceStimulus: 0 };
    s = stepDetection(s, hidden, LOSE_COMBAT_AFTER - 0.5);
    expect(s.state).toBe("combat");
    s = stepDetection(s, hidden, 1);
    expect(s.state).toBe("searching");
    s = stepDetection(s, hidden, SEARCH_TIME + 0.1);
    expect(s.state).toBe("suspicious");
    // The meter has drained by now; suspicion lapses after its timer.
    for (let t = 0; t < SUSPICION_TIME + 10; t += 0.5) s = stepDetection(s, hidden, 0.5);
    expect(s.state).toBe("unaware");
    expect(s.meter).toBe(0);
  });
});

describe("CATHODE hearing", () => {
  const listener = { position: { x: 0, y: 0, z: 0 }, hearing: 1 };
  const shot = (over: Partial<NoiseEvent> = {}): NoiseEvent => ({ kind: "gunshot", position: { x: 0, y: 0, z: 60 }, radius: 180, ...over });
  const thunder: MaskingEvent = { kind: "thunder", position: { x: 0, y: 50, z: 0 }, radius: 500, strength: 60 };

  it("hears gunshots within their radius, cut by suppressors and subsonic rounds", () => {
    expect(hears(shot(), listener)).toBe(true);
    expect(hears(shot({ suppressed: true }), listener)).toBe(false);
    expect(hears(shot({ suppressed: true, position: { x: 0, y: 0, z: 30 } }), listener)).toBe(true);
    expect(hears(shot({ suppressed: true, subsonic: true, position: { x: 0, y: 0, z: 30 } }), listener)).toBe(false);
    expect(hears(shot(), { ...listener, hearing: 0 })).toBe(false);
  });

  it("masks quiet shots under thunder or a passing train, but not loud ones", () => {
    const quiet = shot({ suppressed: true, position: { x: 0, y: 0, z: 30 } });
    expect(hears(quiet, listener, [thunder])).toBe(false);
    expect(hears(shot(), listener, [thunder])).toBe(true);
    const train: MaskingEvent = { kind: "train", position: { x: 0, y: 0, z: 1000 }, radius: 40, strength: 60 };
    expect(hears(quiet, listener, [train])).toBe(true);
  });

  it("sends an unaware enemy searching on a gunshot and suspicious on a footstep", () => {
    const g = hearNoise(UNAWARE, shot(), listener);
    expect(g.heard).toBe(true);
    expect(g.state.state).toBe("searching");
    expect(g.state.lastKnown).toEqual({ x: 0, y: 0, z: 60 });
    const step = hearNoise(UNAWARE, { kind: "footstep", position: { x: 0, y: 0, z: 3 }, radius: 6 }, listener);
    expect(step.state.state).toBe("suspicious");
    const missed = hearNoise(UNAWARE, { kind: "footstep", position: { x: 0, y: 0, z: 3 }, radius: 6, multiplier: 0.3 }, listener);
    expect(missed.heard).toBe(false);
    expect(missed.state).toBe(UNAWARE);
  });
});

describe("CATHODE area alarm", () => {
  it("rises with bodies found, decays slowly, and stays wary once a body was found", () => {
    let a = raiseAlarm(QUIET_AREA, "body");
    expect(a.level).toBe(2);
    expect(a.seen).toBe(false);
    a = raiseAlarm(a, "body");
    expect(a.level).toBe(3);
    expect(alarmEffects(a.level).reinforcements).toBeGreaterThan(alarmEffects(1).reinforcements);
    for (let i = 0; i < 5; i++) a = stepAlarm(a, ALARM_COOLDOWN);
    expect(a.level).toBe(1);
    expect(raiseAlarm(QUIET_AREA, "combat").seen).toBe(true);
    let n = raiseAlarm(QUIET_AREA, "noise");
    n = stepAlarm(n, ALARM_COOLDOWN);
    expect(n.level).toBe(0);
  });
});
