// Keyframe clips (S0): `{dur, tracks: {[part]: Key[]}, events}` with `Key = [tMs, pos3, rot3, ease]`. A clip
// is sampled additively on top of a part's rest pose (the viewmodel's draw, inspect and reload, and later the
// melee swings). `eventsBetween(t0, t1)` gives the sound and spawn cues a frame crossed. No three.js import.

export type Ease = "linear" | "in" | "out" | "inOut" | "outBack" | "step";
export type V3 = [number, number, number];
/** [time ms, position offset (m), rotation offset (rad, XYZ Euler), ease into this key]. */
export type Key = [number, V3, V3, Ease?];

export interface Clip {
  /** Duration, ms. */
  dur: number;
  tracks: Record<string, Key[]>;
  /** Cues: [time ms, name]. */
  events?: [number, string][];
}

export function ease(kind: Ease | undefined, u: number): number {
  const t = Math.min(1, Math.max(0, u));
  switch (kind) {
    case "in":
      return t * t * t;
    case "out":
      return 1 - (1 - t) ** 3;
    case "inOut":
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    case "outBack": {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    }
    case "step":
      return t < 1 ? 0 : 1;
    case "linear":
      return t;
    default:
      // Smoothstep: the default for a held pose.
      return t * t * (3 - 2 * t);
  }
}

export interface Sample {
  pos: V3;
  rot: V3;
}

/** A track's offset at `tMs` (clamped to its first and last keys). */
export function sampleTrack(keys: Key[], tMs: number, out: Sample = { pos: [0, 0, 0], rot: [0, 0, 0] }): Sample {
  if (!keys.length) {
    out.pos = [0, 0, 0];
    out.rot = [0, 0, 0];
    return out;
  }
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (tMs <= first[0]) return copyKey(first, out);
  if (tMs >= last[0]) return copyKey(last, out);
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i]!;
    if (tMs > k1[0]) continue;
    const k0 = keys[i - 1]!;
    const span = Math.max(1e-6, k1[0] - k0[0]);
    const e = ease(k1[3], (tMs - k0[0]) / span);
    for (let j = 0; j < 3; j++) {
      out.pos[j] = k0[1][j]! + (k1[1][j]! - k0[1][j]!) * e;
      out.rot[j] = k0[2][j]! + (k1[2][j]! - k0[2][j]!) * e;
    }
    return out;
  }
  return copyKey(last, out);
}

function copyKey(k: Key, out: Sample): Sample {
  out.pos = [k[1][0], k[1][1], k[1][2]];
  out.rot = [k[2][0], k[2][1], k[2][2]];
  return out;
}

/** Every track of a clip at `tMs`. */
export function sampleClip(clip: Clip, tMs: number): Record<string, Sample> {
  const res: Record<string, Sample> = {};
  for (const [part, keys] of Object.entries(clip.tracks)) res[part] = sampleTrack(keys, tMs);
  return res;
}

/** The cues in (t0, t1] (ms), in time order: a frame from t0 to t1 fires each once. */
export function eventsBetween(clip: Clip, t0: number, t1: number): string[] {
  if (!clip.events || t1 <= t0) return [];
  return clip.events.filter(([t]) => t > t0 && t <= t1).map(([, n]) => n);
}
