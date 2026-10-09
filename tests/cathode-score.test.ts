import { describe, expect, it } from "vitest";
import { Score } from "../games/cathode/src/game/score";

/** A recording stand-in for the Web Audio graph: every node accepts any call and counts oscillators. */
function fakeCtx() {
  const counts = { osc: 0 };
  const node = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, k) => {
        if (k === "connect") return (n: unknown) => n;
        if (k === "gain" || k === "frequency" || k === "detune" || k === "delayTime" || k === "pan")
          return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
        return () => undefined;
      },
      set: () => true,
    });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createDelay: node,
    createGain: node,
    createBiquadFilter: node,
    createStereoPanner: node,
    createBufferSource: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(4000) }),
    createOscillator: () => {
      counts.osc++;
      return node();
    },
  };
  return { ctx: ctx as unknown as AudioContext, counts, sink: node() as AudioNode };
}

const fixed = () => 0.5;
function run(tension: number, seconds: number, start = 0) {
  const { ctx, counts, sink } = fakeCtx();
  const rand = Math.random;
  Math.random = fixed;
  const score = new Score(ctx, sink, sink);
  const c = ctx as unknown as { currentTime: number };
  score.update(start);
  c.currentTime = 100; // well past the sting guard; the warm-up's own sting doesn't count
  score.update(start);
  counts.osc = 0;
  for (let t = 100; t < 100 + seconds; t += 1 / 30) {
    c.currentTime = t;
    score.update(tension);
  }
  Math.random = rand;
  return counts.osc;
}

describe("score", () => {
  it("gets busier when hunted", () => {
    expect(run(0.9, 20)).toBeGreaterThan(run(0, 20));
  });
  it("stings when the alert jumps, once", () => {
    const stung = run(0.9, 1, 0.2);
    const steady = run(0.9, 1, 0.8);
    expect(stung).toBeGreaterThan(steady);
  });
});

describe("district scores", () => {
  it("each variant plays and keeps its own tempo", () => {
    for (const v of ["market", "clinic", "plaza", "tower", "vault"] as const) {
      const { ctx, counts, sink } = fakeCtx();
      const score = new Score(ctx, sink, sink, v);
      const c = ctx as unknown as { currentTime: number };
      for (let t = 0; t < 12; t += 1 / 30) {
        c.currentTime = t;
        score.update(0.3);
      }
      expect(counts.osc, v).toBeGreaterThan(10);
    }
  });
});
