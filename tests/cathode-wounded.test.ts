// C7 "Wounded" (docs/design/cathode-combat.md S6.3, S6.4): the heartbeat's phase mapping, the regen event's
// timing, the lens slots under reduced violence, and the wobble under reduced motion.
import { describe, expect, it } from "vitest";
import { Vitals, VITALS } from "../games/cathode/src/sim/vitals";
import { beatEnvelope, breath, HeartClock, heartBpm, LensBlood, lensFade, muffleHz, PhaseMap, wobble, WOUND } from "../games/cathode/src/sim/woundloop";

describe("CATHODE wounded loop (C7)", () => {
  it("beats at lerp(80, 120, w), and a stim takes 30 bpm off", () => {
    expect(heartBpm(0)).toBe(80);
    expect(heartBpm(1)).toBe(120);
    expect(heartBpm(0.5)).toBe(100);
    expect(heartBpm(1, 1)).toBe(90);
    expect(heartBpm(1, 0.5)).toBe(105);
  });

  it("maps the audio clock to the frame clock so the pulse peaks on the frame the beat is heard", () => {
    const heart = new HeartClock();
    const map = new PhaseMap();
    // The AudioContext started 3.217 s before the page's frame clock reached 10 s.
    const offset = -6.783;
    let peakFrame = -1;
    let peak = 0;
    const lubs: number[] = [];
    for (let f = 0; f < 240; f++) {
      const frameT = 10 + f / 120;
      const audioT = frameT + offset;
      map.sync(audioT, frameT);
      lubs.push(...heart.schedule(audioT, 0.1, 110));
      const p = heart.pulse(map.toAudio(frameT));
      if (f < 120 && p > peak) {
        peak = p;
        peakFrame = frameT;
      }
    }
    // Beats are scheduled ahead in audio time, a period apart.
    expect(lubs.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < lubs.length; i++) expect(lubs[i]! - lubs[i - 1]!).toBeCloseTo(60 / 110, 6);
    // The frame where the pulse peaked is the first lub's audio time, back in frame time (within a frame).
    expect(Math.abs(map.toFrame(lubs[0]!) + WOUND.dubS * 0 - peakFrame)).toBeLessThan(1 / 120 + 0.004 + 1e-9);
    expect(peak).toBeGreaterThan(0.9);
    // The map round-trips, and follows a drift without stepping.
    expect(map.toFrame(map.toAudio(12.5))).toBeCloseTo(12.5, 9);
    map.sync(20 + offset + 0.01, 20);
    expect(map.toAudio(20) - (20 + offset)).toBeGreaterThan(0);
    expect(map.toAudio(20) - (20 + offset)).toBeLessThan(0.01);
  });

  it("has a lub and a dub 110 ms later, each with a 4 ms attack", () => {
    expect(beatEnvelope(-0.01)).toBe(0);
    expect(beatEnvelope(0.002)).toBeCloseTo(0.5, 5);
    expect(beatEnvelope(0.004)).toBeCloseTo(1, 5);
    expect(beatEnvelope(0.1)).toBeLessThan(0.3);
    expect(beatEnvelope(0.114)).toBeGreaterThan(0.7);
    expect(beatEnvelope(0.6)).toBeLessThan(0.01);
  });

  it("stops the heart when bpm goes to 0 and restarts a beat out", () => {
    const h = new HeartClock();
    expect(h.schedule(1, 0.1, 100).length).toBe(1);
    expect(h.schedule(2, 0.1, 0)).toEqual([]);
    const again = h.schedule(5, 0.1, 100);
    expect(again[0]).toBeCloseTo(5.02, 6);
  });

  it("fires the regen event within one frame of 4.0 s after a hit, at 30, 60 and 144 fps", () => {
    for (const fps of [30, 60, 144]) {
      const v = new Vitals(100);
      v.damage(20);
      v.drain();
      let t = 0;
      let at = -1;
      for (let i = 0; i < fps * 6 && at < 0; i++) {
        t += 1 / fps;
        if (v.update(1 / fps).includes("regenStart")) at = t;
        v.drain();
      }
      expect(at).toBeGreaterThanOrEqual(VITALS.regenDelayS - 1e-9);
      expect(at - VITALS.regenDelayS).toBeLessThanOrEqual(1 / fps + 1e-9);
    }
  });

  it("puts no blood in the lens slots under reduced violence (grey water instead), and nothing when the lens is off", () => {
    const lens = new LensBlood(true);
    // S6.4: reduced violence uses a grey rain-on-lens mask: the slots fill, but as water.
    expect(lens.water).toBe(true);
    expect(lens.splat(1, 0, 0)).toBe(0);
    expect(lens.active).toBe(1);
    lens.reducedViolence = false;
    expect(lens.water).toBe(false);
    // The Damage effects setting without the lens: nothing at all.
    lens.clear();
    lens.off = true;
    for (let i = 0; i < 20; i++) expect(lens.splat(1, 0, 10 + i)).toBe(-1);
    expect(lens.active).toBe(0);
    expect(lens.slots.every((s) => s.age < 0)).toBe(true);
    lens.off = false;
    expect(lens.splat(1, 0, 100)).toBe(0);
    expect(lens.active).toBe(1);
  });

  it("places every splat afresh (offset, turn and size), so two never mirror or repeat", () => {
    const lens = new LensBlood();
    lens.splat(1, 0, 0);
    lens.splat(-1, 0, 1);
    const [r, l] = [lens.slots[0]!, lens.slots[1]!];
    // Not mirror images across the centre line.
    expect(Math.abs(r.x - (1 - l.x)) + Math.abs(r.y - l.y) + Math.abs(r.rot + l.rot)).toBeGreaterThan(0.08);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      lens.splat(1, 0, 2 + i);
      const sl = lens.slots[0]!;
      expect(Math.abs(sl.x - 0.84)).toBeLessThanOrEqual(0.1);
      expect(sl.size).toBeGreaterThanOrEqual(0.75);
      seen.add(`${sl.x.toFixed(3)},${sl.y.toFixed(3)},${sl.rot.toFixed(2)}`);
    }
    expect(seen.size).toBe(12);
  });

  it("splats in the slot nearest the hit side, at most once per 400 ms, and ages each over 1.8 s", () => {
    const lens = new LensBlood();
    expect(lens.splat(1, 0, 0)).toBe(0);
    expect(lens.splat(-1, 0, 0.2)).toBe(-1);
    lens.update(0.45);
    expect(lens.splat(-1, 0, 0.45)).toBe(1);
    lens.update(0.55);
    expect(lens.splat(0, 1, 1)).toBe(2);
    lens.update(0.5);
    expect(lens.splat(0, -1, 1.5)).toBe(3);
    expect(lens.active).toBe(4);
    // At 1.85 s the first is gone; at 2.3 s the second too.
    lens.update(0.35);
    expect(lens.active).toBe(3);
    lens.update(0.45);
    expect(lens.active).toBe(2);
    expect(lensFade(0).alpha).toBe(1);
    expect(lensFade(0.9).alpha).toBeCloseTo(0.75, 6);
    expect(lensFade(1.8).drip).toBeCloseTo(0.06, 6);
    expect(lensFade(-1).alpha).toBe(0);
  });

  it("wipes the lens left to right over 500 ms on a stim", () => {
    const lens = new LensBlood();
    lens.splat(-1, 0, 0);
    lens.splat(1, 0, 1);
    lens.startWipe();
    lens.update(0.2);
    // The left splat goes first.
    expect(lens.slots[1]!.age).toBe(-1);
    expect(lens.slots[0]!.age).toBeGreaterThan(0);
    lens.update(0.31);
    expect(lens.active).toBe(0);
    expect(lens.wipe).toBe(-1);
  });

  it("turns the bleeding wobble off under reduced motion", () => {
    let maxRoll = 0;
    let maxFov = 0;
    for (let t = 0; t < 4; t += 0.05) {
      const on = wobble(t, 1, false);
      maxRoll = Math.max(maxRoll, Math.abs(on.roll));
      maxFov = Math.max(maxFov, Math.abs(on.fovMul - 1));
      expect(wobble(t, 1, true)).toEqual({ roll: 0, fovMul: 1 });
      // Nothing above the bleeding tier.
      expect(wobble(t, 0.6, false)).toEqual({ roll: 0, fovMul: 1 });
    }
    expect(maxRoll).toBeCloseTo(Math.PI / 180, 2);
    expect(maxFov).toBeCloseTo(0.004, 3);
  });

  it("muffles the world from 22 kHz to 1.5 kHz on an exponential curve, and breathes faster as she weakens", () => {
    expect(muffleHz(0)).toBeCloseTo(22000);
    expect(muffleHz(1)).toBeCloseTo(1500);
    // The S6.1 table's corners: 6 kHz entering critical, 2.5 kHz entering bleeding; exponential between.
    expect(muffleHz(0.35)).toBeCloseTo(6000, 3);
    expect(muffleHz(0.85)).toBeCloseTo(2500, 3);
    expect(muffleHz(0.6)).toBeCloseTo(Math.sqrt(6000 * 2500), 3);
    for (let w = 0; w < 1; w += 0.05) expect(muffleHz(w + 0.05)).toBeLessThan(muffleHz(w));
    expect(breath(0)).toEqual({ hz: 0.3, level: 0 });
    expect(breath(1).hz).toBeCloseTo(0.9);
    expect(breath(1).level).toBe(1);
  });
});
