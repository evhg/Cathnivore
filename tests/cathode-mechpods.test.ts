import { describe, expect, it } from "vitest";
import { makePods, missileVolley, podHit, podsAlive } from "../games/cathode/src/sim/mechpods";

describe("mech pods", () => {
  it("sizes both pods from the mech's HP", () => {
    const pods = makePods(1400);
    expect(pods.map((p) => p.hp)).toEqual([112, 112]);
    expect(missileVolley(pods)).toBe(8);
  });
  it("a standing pod keeps most of the round from the hull", () => {
    const [l] = makePods(1400);
    const r = podHit(l, 20);
    expect(r.broke).toBe(false);
    expect(r.through).toBeCloseTo(6);
    expect(l.hp).toBe(92);
  });
  it("breaking a pod halves the volley; breaking both disables the attack", () => {
    const pods = makePods(1400);
    expect(podHit(pods[0], 500).broke).toBe(true);
    expect(podsAlive(pods)).toBe(1);
    expect(missileVolley(pods)).toBe(4);
    podHit(pods[1], 500);
    expect(missileVolley(pods)).toBe(0);
  });
  it("a broken pod is hull: nothing absorbed, no second break", () => {
    const [l] = makePods(1400);
    podHit(l, 500);
    expect(podHit(l, 30)).toEqual({ through: 30, broke: false });
  });
  it("the breaking round passes its overkill to the hull", () => {
    const [l] = makePods(1400);
    expect(podHit(l, 150).through).toBe(38);
  });
});
