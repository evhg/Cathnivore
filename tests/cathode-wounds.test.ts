import { describe, expect, it } from "vitest";
import { WOUNDS, crawlRoll, limbHurt, limpPhase, makeWounds, resetWounds, woundHit, woundState } from "../games/cathode/src/sim/wounds";

const HP = 100;

describe("cathode-wounds: limbs (S4.2)", () => {
  it("a leg past 40% of its share limps at x0.6", () => {
    const w = makeWounds();
    woundHit(w, "legL", WOUNDS.limbShare * HP * 0.39);
    expect(limbHurt(w, "legL", HP)).toBe(false);
    expect(woundState(w, 90, HP).limp).toBeNull();
    woundHit(w, "legL", WOUNDS.limbShare * HP * 0.02);
    const s = woundState(w, 90, HP);
    expect(s.limp).toBe("L");
    expect(s.speedMul).toBeCloseTo(0.6);
  });
  it("an arm past it goes one-handed at accuracy x0.7; the worse arm hangs", () => {
    const w = makeWounds();
    woundHit(w, "armR", 20);
    woundHit(w, "armL", 14);
    const s = woundState(w, 60, HP);
    expect(s.oneArm).toBe("R");
    expect(s.accuracyMul).toBeCloseTo(0.7);
  });
  it("hunches below 25% health, clutching the worst wound", () => {
    const w = makeWounds();
    woundHit(w, "torso", 50);
    woundHit(w, "legR", 30);
    expect(woundState(w, 26, HP).hunch).toBe(false);
    const s = woundState(w, 24, HP);
    expect(s.hunch).toBe(true);
    expect(s.worst).toBe("torso");
  });
  it("reset clears everything", () => {
    const w = makeWounds();
    woundHit(w, "legR", 99);
    resetWounds(w);
    expect(woundState(w, HP, HP)).toMatchObject({ limp: null, oneArm: null, hunch: false, worst: null });
  });
});

describe("cathode-wounds: the crawl (S4.2)", () => {
  it("only below 10% health; Enforcers 25% of the time, Price-War Boys always, machines never", () => {
    expect(crawlRoll(11, HP, "enforcer", 0)).toBe(false);
    expect(crawlRoll(9, HP, "enforcer", 0.24)).toBe(true);
    expect(crawlRoll(9, HP, "enforcer", 0.25)).toBe(false);
    expect(crawlRoll(9, HP, "priceWar", 0.99)).toBe(true);
    expect(crawlRoll(5, HP, "machine", 0)).toBe(false);
    expect(crawlRoll(0, HP, "enforcer", 0)).toBe(false);
  });
});

describe("cathode-wounds: the limp's gait clock", () => {
  it("the injured stance takes 35% of the cycle", () => {
    const N = 2000;
    let stance = 0;
    for (let i = 0; i < N; i++) {
      const ph = limpPhase((i / N) * Math.PI * 2, 0);
      if (Math.sin(ph) < 0) stance++;
    }
    expect(stance / N).toBeCloseTo(WOUNDS.limpStance, 1);
  });
  it("k = 0 is the plain gait", () => {
    for (const ph of [0.3, 1.7, 3.5, 5.9]) {
      expect(Math.sin(limpPhase(ph, Math.PI, 0))).toBeCloseTo(Math.sin(ph), 6);
      expect(Math.cos(limpPhase(ph, Math.PI, 0))).toBeCloseTo(Math.cos(ph), 6);
    }
  });
});
