import { describe, expect, it } from "vitest";
import { KILLCAM, KillCamRules, barShare, bulletDone, bulletScale, canSkip, orbitBars, orbitDone, orbitScale, whipAt, type KillCamKill } from "../games/cathode/src/sim/killcam";

const kill = (o: Partial<KillCamKill>): KillCamKill => ({
  now: 0,
  last: false,
  headshot: false,
  severed: false,
  takedown: false,
  ballistic: false,
  predicted: false,
  distance: 10,
  killsThisSave: 10,
  ...o,
});

describe("CATHODE kill-cam rules (S5.3)", () => {
  it("the last enemy by a headshot, a sever or a takedown earns one; a body shot does not", () => {
    for (const k of [{ headshot: true }, { severed: true }, { takedown: true }]) {
      expect(new KillCamRules().kill(kill({ last: true, ...k }))).toBe("orbit");
    }
    expect(new KillCamRules().kill(kill({ last: true }))).toBeNull();
    expect(new KillCamRules().kill(kill({ headshot: true }))).toBeNull();
  });

  it("a kill noted without a camera never starts the cooldown; a missed bullet follow hands it back", () => {
    const r = new KillCamRules();
    const k = kill({ now: 0, last: true, headshot: true });
    expect(r.wouldTrigger(k)).toBe("orbit");
    r.note(k);
    expect(r.cooldownLeft(1)).toBe(0);
    expect(r.wouldTrigger(kill({ now: 1000, last: true, headshot: true }))).toBe("orbit");
    const prev = r.commit(2000);
    expect(r.cooldownLeft(2000)).toBe(KILLCAM.cooldownMs);
    r.rollback(prev);
    expect(r.cooldownLeft(2000)).toBe(0);
    expect(r.kill(kill({ now: 3000, last: true, headshot: true }))).toBe("orbit");
  });

  it("predict() gates the bullet follow", () => {
    expect(new KillCamRules().kill(kill({ last: true, headshot: true, ballistic: true, predicted: true }))).toBe("bullet");
    expect(new KillCamRules().kill(kill({ last: true, headshot: true, ballistic: true, predicted: false }))).toBe("orbit");
    const on = new KillCamRules("on");
    expect(on.kill(kill({ headshot: true, ballistic: true, predicted: true, distance: 31 }))).toBe("bullet");
    expect(new KillCamRules("on").kill(kill({ headshot: true, ballistic: true, predicted: false, distance: 31 }))).toBeNull();
    expect(new KillCamRules("on").kill(kill({ headshot: true, ballistic: true, predicted: true, distance: 29 }))).toBeNull();
  });

  it("a multi-kill of 3 in 1.5 s (setting On only)", () => {
    const on = new KillCamRules("on");
    expect(on.kill(kill({ now: 0 }))).toBeNull();
    expect(on.kill(kill({ now: 600 }))).toBeNull();
    expect(on.kill(kill({ now: 1400 }))).toBe("orbit");
    const spread = new KillCamRules("on");
    spread.kill(kill({ now: 0 }));
    spread.kill(kill({ now: 1000 }));
    expect(spread.kill(kill({ now: 2600 }))).toBeNull();
    const last = new KillCamRules("last");
    last.kill(kill({ now: 0 }));
    last.kill(kill({ now: 100 }));
    expect(last.kill(kill({ now: 200 }))).toBeNull();
  });

  it("one per 20 s", () => {
    const r = new KillCamRules();
    expect(r.kill(kill({ now: 0, last: true, headshot: true }))).toBe("orbit");
    expect(r.kill(kill({ now: 19999, last: true, headshot: true }))).toBeNull();
    expect(r.cooldownLeft(19999)).toBe(1);
    expect(r.kill(kill({ now: 20000, last: true, headshot: true }))).toBe("orbit");
  });

  it("never in the first 3 kills of a new save, except the first job's finale; Off is off", () => {
    const r = new KillCamRules();
    expect(r.kill(kill({ last: true, headshot: true, killsThisSave: 3 }))).toBeNull();
    expect(r.kill(kill({ last: true, headshot: true, killsThisSave: 2, finale: true }))).toBe("orbit");
    expect(new KillCamRules("off").kill(kill({ last: true, headshot: true }))).toBeNull();
  });

  it("wouldTrigger has no side effects", () => {
    const r = new KillCamRules();
    expect(r.wouldTrigger(kill({ last: true, headshot: true, ballistic: true, predicted: true }))).toBe("bullet");
    expect(r.cooldownLeft(0)).toBe(0);
    expect(r.kill(kill({ last: true, headshot: true }))).toBe("orbit");
  });

  it("skips only after 300 ms", () => {
    expect(canSkip(299)).toBe(false);
    expect(canSkip(300)).toBe(true);
  });

  it("the bullet follow's time: 0.1 in flight, 0.05 at impact, 0.3 over the body, a monotonic ramp to 1", () => {
    expect(bulletScale(null)).toBe(0.1);
    expect(bulletScale(100)).toBe(0.05);
    expect(bulletScale(500)).toBe(0.3);
    let prev = 0;
    for (let t = KILLCAM.bullet.orbitEndMs; t <= KILLCAM.bullet.orbitEndMs + KILLCAM.bullet.rampMs; t += 10) {
      const s = bulletScale(t);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(1);
      prev = s;
    }
    expect(prev).toBe(1);
    expect(bulletDone(KILLCAM.bullet.orbitEndMs + KILLCAM.bullet.rampMs)).toBe(true);
    expect(whipAt(KILLCAM.bullet.orbitEndMs + 60)).toBeCloseTo(1, 5);
    expect(whipAt(KILLCAM.bullet.orbitEndMs + 200)).toBe(0);
  });

  it("the orbit's time, bars and end", () => {
    expect(orbitScale(0)).toBe(0.25);
    expect(orbitScale(1150)).toBe(1);
    expect(orbitDone(1150)).toBe(true);
    expect(orbitBars(75)).toBeCloseTo(0.5, 5);
    expect(orbitBars(500)).toBe(1);
    expect(orbitBars(1150)).toBe(0);
    // 16:9 gets two bars of about 12.8% each; a 2.39:1 screen none.
    expect(barShare(16 / 9)).toBeCloseTo(0.128, 2);
    expect(barShare(2.39)).toBe(0);
  });
});
