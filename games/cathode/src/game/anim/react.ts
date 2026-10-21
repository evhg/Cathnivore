// C15 (docs/design/cathode-combat.md S4.2): the stagger set, the knockdown and get-up, and the visor snap, as
// pose curves in body space (x to his left, y up, z forward). animate.ts lays them over the gait and the aim, under
// the hit flinch. Pure numbers: no three.js, so the tests read the same poses the game plays.

import { STAGGER, type StaggerDir } from "../../sim/stagger";

export type ReactKind = "stagger" | "knockdown" | "visorSnap";

export interface ReactPose {
  /** The hips (and everything above) moved off his stance (m). */
  pelvisX: number;
  pelvisZ: number;
  pelvisDrop: number;
  /** Each foot moved off its stance (m), and lifted. */
  footLX: number;
  footLZ: number;
  footLLift: number;
  footRX: number;
  footRZ: number;
  footRLift: number;
  /** Upper body tipped forward (+) or back (-) about the pelvis, rolled toward his left (+). */
  pitch: number;
  roll: number;
  /** The head dropped forward (+) on the neck. */
  headPitch: number;
  /** The weapon arm (and the rifle in it) dropped about the right shoulder. */
  armDrop: number;
  /** The off hand to the wound on his chest (0..1). */
  clutch: number;
  /** Arms flung out to the side (rad), and one arm up for balance (rad). */
  flailL: number;
  flailR: number;
  upL: number;
  upR: number;
  /** Both hands to the helmet (the visor snap, 0..1). */
  helmet: number;
  /** The knockdown: 0 standing .. 1 down on his back, propped on his elbows, and the fall's heading (rad). */
  lie: number;
  lieYaw: number;
  /** Breathing while he's down (m). */
  breathe: number;
}

export function restPose(): ReactPose {
  return { pelvisX: 0, pelvisZ: 0, pelvisDrop: 0, footLX: 0, footLZ: 0, footLLift: 0, footRX: 0, footRZ: 0, footRLift: 0, pitch: 0, roll: 0, headPitch: 0, armDrop: 0, clutch: 0, flailL: 0, flailR: 0, upL: 0, upR: 0, helmet: 0, lie: 0, lieYaw: 0, breathe: 0 };
}

const DEG = Math.PI / 180;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Up over `a` ms, held, down over the last `c` ms of `dur`. */
const envelope = (t: number, a: number, dur: number, c: number) => (t < a ? smooth(t / a) : t > dur - c ? smooth((dur - t) / c) : 1);
/** A step: 0 before t0, eased to 1 at t1. */
const step = (t: number, t0: number, t1: number) => smooth((t - t0) / (t1 - t0));
/** A foot's lift over a step. */
const lift = (t: number, t0: number, t1: number, h: number) => (t <= t0 || t >= t1 ? 0 : Math.sin(((t - t0) / (t1 - t0)) * Math.PI) * h);

/** How far a reaction moves him for good (body space, m): committed to his position when it ends. */
export function reactTravel(kind: ReactKind, dir: StaggerDir): { x: number; z: number } {
  if (kind !== "stagger") return { x: 0, z: 0 };
  const T = REACT.stagger;
  if (dir === "front") return { x: 0, z: -T.frontStepM };
  if (dir === "back") return { x: 0, z: T.backStepM };
  return { x: (dir === "left" ? 1 : -1) * T.sideStepM, z: 0 };
}

/** Overstated (pillar 4: a stagger must read twice as clearly as feels natural, at 10 m in rain). */
export const REACT = {
  // S4.2's numbers are the floor: the head drop (15), the back pitch (25) and the flail (20) are pushed past them so
  // a still at 200 ms reads as a stagger, not a walk (C15 review).
  stagger: { frontStepM: 0.35, stepMs: 180, backStepM: 0.4, sideStepM: 0.32, armDropDeg: 45, headDropDeg: 22, backPitchDeg: 32, flailDeg: 38, rollDeg: 24, recoilDeg: 24, whipDeg: 14 },
  visorSnap: { headDeg: 25 },
} as const;

/**
 * The pose `t` ms into a reaction. `fallYaw` is the heading the round pushes him toward (body space, 0 = straight
 * back, -z); the knockdown falls that way.
 */
export function reactPose(kind: ReactKind, dir: StaggerDir, t: number, fallYaw = 0): ReactPose {
  const p = restPose();
  const S = REACT.stagger;
  if (kind === "visorSnap") {
    const dur = STAGGER.visorSnapMs;
    const k = envelope(t, 60, dur, 220);
    p.headPitch = -REACT.visorSnap.headDeg * DEG * (t < 60 ? smooth(t / 60) : Math.max(0, 1 - (t - 60) / 340));
    // The hand comes up after the snap (from 140 ms), so the face shows first, then he covers it.
    p.helmet = step(t, 140, 300) * (t > dur - 120 ? smooth((dur - t) / 120) : 1);
    p.pitch = -6 * DEG * k;
    p.armDrop = 40 * DEG * k;
    return p;
  }
  if (kind === "stagger") {
    const dur = STAGGER.ms[dir];
    const env = envelope(t, 90, dur, 200);
    if (dir === "front") {
      // Two steps back (right foot, then left), the weapon arm dropping 45 degrees, the off hand to the wound, the
      // head dropping as the shoulders rock back.
      const st = S.stepMs;
      p.footRZ = -S.frontStepM * step(t, 0, st);
      p.footRLift = lift(t, 0, st, 0.09);
      p.footLZ = -S.frontStepM * step(t, st, st * 2);
      p.footLLift = lift(t, st, st * 2, 0.07);
      p.pelvisZ = -S.frontStepM * step(t, 20, st * 2 + 30);
      p.pelvisDrop = 0.09 * env;
      p.pitch = -S.recoilDeg * DEG * (t < 90 ? smooth(t / 90) : Math.max(0, 1 - (t - 90) / (dur - 90))) - 6 * DEG * env;
      p.armDrop = S.armDropDeg * DEG * envelope(t, 110, dur, 220);
      p.clutch = envelope(t, 160, dur, 200);
      // The head whips back with the blow, then drops as he folds over the wound.
      p.headPitch = -S.whipDeg * DEG * Math.sin(clamp01(t / 140) * Math.PI) + S.headDropDeg * DEG * envelope(t, 140, dur, 200) * step(t, 90, 220);
    } else if (dir === "back") {
      // Hit from behind: pitched 25 degrees forward, one stumble step, arms flung out.
      p.pitch = S.backPitchDeg * DEG * envelope(t, 100, dur, 240);
      p.footLZ = S.backStepM * step(t, 60, 250);
      p.footLLift = lift(t, 60, 250, 0.1);
      p.footRZ = S.backStepM * step(t, 250, 420);
      p.footRLift = lift(t, 250, 420, 0.06);
      p.pelvisZ = S.backStepM * step(t, 30, 400);
      p.pelvisDrop = 0.1 * env;
      p.flailL = p.flailR = S.flailDeg * DEG * envelope(t, 90, dur, 240);
      p.armDrop = 30 * DEG * env;
      // The head whips back as the shoulders are thrown forward.
      p.headPitch = -(S.whipDeg + 8) * DEG * env;
    } else {
      // Left or right: a crossover step, rolled 20 degrees, the far arm up for balance.
      const s = dir === "left" ? 1 : -1;
      // The trailing foot crosses over in front, then the lead foot steps out.
      const cross = s > 0 ? "R" : "L";
      const crossZ = 0.12 * envelope(t, 120, dur, 200);
      const crossX = s * S.sideStepM * step(t, 0, 200);
      const leadX = s * S.sideStepM * step(t, 200, 380);
      if (cross === "R") {
        p.footRX = crossX;
        p.footRZ = crossZ;
        p.footRLift = lift(t, 0, 200, 0.08);
        p.footLX = leadX;
        p.footLLift = lift(t, 200, 380, 0.07);
      } else {
        p.footLX = crossX;
        p.footLZ = crossZ;
        p.footLLift = lift(t, 0, 200, 0.08);
        p.footRX = leadX;
        p.footRLift = lift(t, 200, 380, 0.07);
      }
      p.pelvisX = s * S.sideStepM * step(t, 20, 380);
      p.roll = s * S.rollDeg * DEG * envelope(t, 100, dur, 200);
      p.pelvisDrop = 0.04 * env;
      if (s > 0) p.upR = 55 * DEG * envelope(t, 120, dur, 200);
      else p.upL = 55 * DEG * envelope(t, 120, dur, 200);
      p.armDrop = 25 * DEG * env;
    }
    return p;
  }
  // Knockdown: the fall (gravity: slow then fast), down on his back propped on an elbow and breathing, then the
  // get-up through a crouch.
  const K = STAGGER.knock;
  p.lieYaw = fallYaw;
  if (t < K.fallMs) {
    const x = t / K.fallMs;
    p.lie = x * x * (1.6 - 0.6 * x);
    p.armDrop = 50 * DEG * smooth(x * 2);
    p.flailL = p.flailR = 30 * DEG * Math.sin(Math.min(1, x) * Math.PI);
  } else if (t < K.fallMs + K.downMs) {
    const d = t - K.fallMs;
    // A bounce on landing, then still but for the breath.
    p.lie = 1 + Math.sin(Math.min(1, d / 160) * Math.PI) * 0.04 * Math.max(0, 1 - d / 160);
    p.breathe = Math.sin((d / 1000) * Math.PI * 2 * 0.9) * 0.012;
  } else {
    const u = clamp01((t - K.fallMs - K.downMs) / K.upMs);
    p.lie = 1 - smooth(u);
    // Through a crouch: the hips stay low until he's nearly up.
    p.pelvisDrop = 0.32 * Math.sin(u * Math.PI) * (1 - u * 0.3);
    p.pitch = 22 * DEG * Math.sin(u * Math.PI);
  }
  return p;
}

/** How long a reaction lasts (ms). */
export function reactDuration(kind: ReactKind, dir: StaggerDir): number {
  if (kind === "visorSnap") return STAGGER.visorSnapMs;
  if (kind === "stagger") return STAGGER.ms[dir];
  return STAGGER.knock.fallMs + STAGGER.knock.downMs + STAGGER.knock.upMs;
}
