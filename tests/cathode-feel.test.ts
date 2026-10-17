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

describe("CATHODE Kestrel fire choreography (S2.3, C5)", async () => {
  const { FIRE, HERO, DRAW, CamRecoil, Heat, impulseForPeak } = await import("../games/cathode/src/game/feel/pistol");
  const { sampleTrack, eventsBetween } = await import("../games/cathode/src/game/feel/clip");
  const F = tuning.kestrel.fire;
  const slideAt = (t: number) => sampleTrack(FIRE.tracks.slide!, t).pos[2];

  it("the slide is fully back by 30 ms and home by 62 ms with at most a 0.6 mm overshoot", () => {
    expect(slideAt(30)).toBeCloseTo(F.slideM, 6);
    // Visibly back at 20 ms (the acceptance's stage): the ease-out has it most of the way.
    expect(slideAt(20)).toBeGreaterThan(F.slideM * 0.9);
    expect(Math.abs(slideAt(62))).toBeLessThanOrEqual(F.overshootM + 1e-9);
    expect(slideAt(62)).toBeLessThan(0);
    expect(Math.abs(slideAt(78))).toBeLessThan(1e-9);
    for (let t = 0; t < 30; t++) expect(slideAt(t + 1)).toBeGreaterThanOrEqual(slideAt(t));
  });

  it("clip events: the shell at 18 ms, slide back at 30 ms, home at 62 ms", () => {
    const at = (name: string) => FIRE.events!.find(([, n]) => n === name)![0];
    expect(at("shell")).toBe(18);
    expect(at("slideBack")).toBeLessThanOrEqual(30);
    expect(at("slideHome")).toBeLessThanOrEqual(62);
    expect(eventsBetween(FIRE, 16.6, 33.3)).toEqual(["shell", "slideBack"]);
  });

  it("the hammer falls on the break and is re-cocked to 55° by 62 ms; the barrel tilts 3° only from 14 ms", () => {
    const ham = (t: number) => sampleTrack(FIRE.tracks.hammer!, t).rot[0];
    expect(ham(0)).toBeCloseTo((55 * Math.PI) / 180, 5);
    expect(ham(10)).toBeCloseTo(0, 5);
    expect(ham(62)).toBeCloseTo((55 * Math.PI) / 180, 5);
    const bar = (t: number) => sampleTrack(FIRE.tracks.barrel!, t).rot[0];
    expect(bar(13)).toBe(0);
    expect(bar(30)).toBeCloseTo((3 * Math.PI) / 180, 5);
  });

  it("the draw rises from 25 cm low and 40° down in 450 ms; the hero draw racks at 300 ms", () => {
    const g0 = sampleTrack(DRAW.tracks.gun!, 0);
    expect(g0.pos[1]).toBeCloseTo(-0.25, 5);
    expect(g0.rot[0]).toBeCloseTo((-40 * Math.PI) / 180, 5);
    expect(DRAW.dur).toBe(450);
    expect(HERO.dur).toBe(900);
    expect(HERO.events!.find(([, n]) => n === "rackBack")![0]).toBe(300);
    expect(sampleTrack(HERO.tracks.slide!, 370).pos[2]).toBeCloseTo(F.slideM, 5);
  });

  it("camera recoil: 1.1° a shot, 70% back within 200 ms, 30% stays", () => {
    const r = new CamRecoil();
    const keep = r.kick(0);
    expect(keep.pitch).toBeCloseTo(((1.1 * Math.PI) / 180) * 0.3, 6);
    expect(r.pitch.x).toBeCloseTo(((1.1 * Math.PI) / 180) * 0.7, 6);
    for (let i = 0; i < 12; i++) r.update(1 / 60);
    expect(Math.abs(r.pitch.x)).toBeLessThan(((1.1 * Math.PI) / 180) * 0.7 * 0.03);
    expect(CamRecoil.recoilAt(200)).toBeLessThan(0.02);
    expect(CamRecoil.recoilAt(0)).toBeCloseTo(0.7, 6);
  });

  it("a shove sized by impulseForPeak peaks at the table's value", () => {
    for (const spec of [tuning.kestrel.recoil.rot, tuning.kestrel.recoil.pos]) {
      const s = new Spring1(spec);
      s.shove(impulseForPeak(spec, 0.03));
      let peak = 0;
      for (let i = 0; i < 240; i++) peak = Math.max(peak, s.update(1 / 240));
      expect(peak).toBeGreaterThan(0.0285);
      expect(peak).toBeLessThan(0.0315);
    }
  });

  it("heat builds 0.12 a shot, cools 0.25/s, and triples the smoke at most", () => {
    const h = new Heat();
    for (let i = 0; i < 10; i++) h.shot();
    expect(h.v).toBeCloseTo(1.2, 6);
    expect(h.smokeMul).toBeCloseTo(3, 6);
    expect(h.glow).toBe(1);
    h.update(2);
    expect(h.v).toBeCloseTo(0.7, 6);
  });
});
