import { describe, expect, it } from "vitest";
import { Voice, painGrunt } from "../games/cathode/src/game/voice";

describe("voice", () => {
  it("says each cue once and plays Bea's call in order", () => {
    const out: string[] = [];
    const v = new Voice((t) => out.push(t));
    v.say("beaCall1");
    v.say("beaCall1");
    v.say("beaCall2");
    for (let i = 0; i < 40; i++) v.update(1);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^Bea: /);
    expect(out[1]).toMatch(/^Cath: /);
  });
});

/** A stand-in Web Audio graph: records the nodes built and the filters' frequencies. */
function fakeCtx() {
  const made: { kind: string; type?: string; f?: number; stopAt?: number }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = (kind: string) => {
    const rec: { kind: string; type?: string; f?: number; stopAt?: number } = { kind };
    made.push(rec);
    const n: Record<string, unknown> = {
      connect: (x: unknown) => x,
      gain: param(),
      pan: param(),
      Q: param(),
      frequency: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        set value(v: number) {
          rec.f = v;
        },
        get value() {
          return rec.f ?? 0;
        },
      },
      set type(t: string) {
        rec.type = t;
      },
      start() {},
      stop(t: number) {
        rec.stopAt = t;
      },
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createGain: () => node("gain"),
    createStereoPanner: () => node("pan"),
    createBiquadFilter: () => node("biquad"),
    createWaveShaper: () => node("shaper"),
    createOscillator: () => node("osc"),
    createBufferSource: () => node("buffer"),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe("S10 pain grunt", () => {
  it("is a 120 ms two-vowel grunt through the squad radio's band", () => {
    const { ctx, made } = fakeCtx();
    const len = painGrunt(ctx, {} as AudioNode, 6, 0.2, 0.5);
    expect(len).toBeGreaterThanOrEqual(0.12);
    expect(len).toBeLessThan(0.16);
    const filters = made.filter((m) => m.kind === "biquad");
    expect(filters.some((f) => f.type === "highpass" && f.f === 400)).toBe(true);
    expect(filters.some((f) => f.type === "lowpass" && f.f === 3200)).toBe(true);
    const osc = made.find((m) => m.kind === "osc");
    expect(osc?.stopAt).toBeCloseTo(0.135, 2);
  });
});
