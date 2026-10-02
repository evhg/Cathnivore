import { describe, expect, it } from "vitest";
import {
  TRACKS,
  buildLeadScore,
  chordPcs,
  degreeMidi,
  fitToChord,
  midiHz,
  padVoicings,
  voiceLead,
} from "../games/hedgerow/src/sound";

describe("hedgerow music", () => {
  it("has a track per act, getting faster towards the finale", () => {
    expect(TRACKS).toHaveLength(10);
    TRACKS.forEach((t, i) => {
      expect(t.bpm).toBeGreaterThanOrEqual(100);
      expect(t.bpm).toBeLessThanOrEqual(122);
      if (i > 0) expect(t.bpm).toBeGreaterThan(TRACKS[i - 1]!.bpm);
      expect(32 % t.chords.length).toBe(0);
      expect(t.arp).toHaveLength(16);
      expect(t.scale).toHaveLength(7);
    });
  });

  it("does the pitch maths", () => {
    expect(midiHz(69)).toBeCloseTo(440);
    expect(midiHz(57)).toBeCloseTo(220);
    expect(degreeMidi(60, [0, 2, 4, 5, 7, 9, 11], 7)).toBe(72);
    expect(degreeMidi(60, [0, 2, 4, 5, 7, 9, 11], -1)).toBe(59);
    expect(chordPcs(9, { root: 0, q: "m9" })).toEqual([9, 0, 4, 7, 11]);
    expect(fitToChord(61, [0, 4, 7])).toBe(60);
    expect(fitToChord(62, [0, 4, 7])).toBe(62);
    expect(fitToChord(66, [0, 4, 7])).toBe(67);
  });

  it("voice-leads every pad loop smoothly", () => {
    for (const t of TRACKS) {
      const v = padVoicings(t);
      expect(v).toHaveLength(t.chords.length);
      v.forEach((chord, i) => {
        expect(chord).toHaveLength(4);
        for (const n of chord) {
          expect(n).toBeGreaterThanOrEqual(52);
          expect(n).toBeLessThanOrEqual(77);
        }
        const pcs = chordPcs(t.tonic, t.chords[i]!);
        for (const n of chord) expect(pcs).toContain(n % 12);
        const next = v[(i + 1) % v.length]!;
        const moves = chord.map((n, k) => Math.abs(n - next[k]!));
        expect(Math.max(...moves)).toBeLessThanOrEqual(7);
        expect(moves.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(14);
      });
    }
  });

  it("drops the root of a ninth chord and keeps a triad's root", () => {
    expect(voiceLead(null, [9, 0, 4, 7, 11]).map((n) => n % 12)).not.toContain(9);
    expect(voiceLead(null, [0, 4, 7]).filter((n) => n % 12 === 0)).toHaveLength(2);
  });

  it("writes a playable lead score with rests for the breakdown", () => {
    for (const t of TRACKS) {
      const score = buildLeadScore(t);
      expect(score.length).toBeGreaterThan(30);
      const steps = new Set(score.map((n) => n.step));
      expect(steps.size).toBe(score.length);
      for (const n of score) {
        expect(n.step).toBeGreaterThanOrEqual(0);
        expect(n.step).toBeLessThan(512);
        expect(n.step >= 256 && n.step < 288).toBe(false);
        expect(n.step).toBeLessThan(448);
        expect(n.midi).toBeGreaterThanOrEqual(57);
        expect(n.midi).toBeLessThanOrEqual(86);
        if (n.step % 4 === 0) {
          // No strong-beat note sits a semitone off the chord.
          const pcs = chordPcs(t.tonic, t.chords[Math.floor(n.step / 16) % t.chords.length]!);
          if (!pcs.includes(n.midi % 12)) {
            expect(pcs).not.toContain((n.midi + 1) % 12);
            expect(pcs).not.toContain((n.midi + 11) % 12);
          }
        }
      }
    }
  });
});
