// Plan item 26: the weapon inspect per class, and the idle sway per class.
//
// The inspect (S2.2 layer 3) turns the gun toward the viewmodel's key light, so the finish, the engraving and
// the class's own working parts read: a pistol shows its left flank and the dot; a revolver rolls out to show
// the cylinder; the long guns tip onto their side for the receiver and the port, then come up for a look down
// the optic; a blade turns its edge through the light. Offsets on the rig root, in its own space (m, rad); the
// turn pivots part-way back toward the firing wrist (weapons.ts INSPECT_PIVOT).
//
// The idle sway is her breathing and the gun's weight: a slow figure-eight at the hip, smaller and slower for
// the heavy guns, a touch quicker and lighter for the pistols. None under reduced motion.

import type { WeaponClass } from "../../sim/types";
import type { Clip, Key } from "./clip";

const clip = (dur: number, keys: Key[], cloth: number[]): Clip => ({
  dur,
  tracks: { root: keys },
  events: [...cloth.map((t) => [t, "cloth"] as [number, string]), [dur - 50, "settle"]],
});

/** The pistols' (and the smart gun's) inspect: the left flank to the light, then a look down the dot. */
const PISTOL = clip(
  2600,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [420, [-0.036, 0.05, -0.06], [0.12, 0.74, 0.36], "inOut"],
    [1350, [-0.032, 0.054, -0.06], [0.17, 0.8, 0.33]],
    [1800, [-0.03, 0.03, 0.01], [-0.32, 0.25, -0.15], "inOut"],
    [2150, [-0.03, 0.03, 0.01], [-0.3, 0.22, -0.12]],
    [2600, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [80, 1750],
);

/** The revolver rolls out on its side to show the cylinder's flutes, then back over to the right flank. */
const REVOLVER = clip(
  2800,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [450, [-0.03, 0.045, -0.05], [0.1, 0.62, 0.78], "inOut"],
    [1300, [-0.03, 0.05, -0.05], [0.14, 0.68, 0.84]],
    [1850, [0.004, 0.035, -0.02], [0.05, -0.32, -0.42], "inOut"],
    [2300, [0.004, 0.035, -0.02], [0.04, -0.3, -0.4]],
    [2800, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [90, 1800],
);

/** The SMG: a quick flick onto its left side, a glance at the mag, back. */
const SMG = clip(
  2100,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [330, [-0.03, 0.04, -0.03], [0.08, 0.48, 0.62], "inOut"],
    [1050, [-0.03, 0.044, -0.03], [0.12, 0.52, 0.66]],
    [1450, [-0.01, 0.02, 0], [-0.2, 0.12, -0.3], "inOut"],
    [1700, [-0.01, 0.02, 0], [-0.18, 0.1, -0.28]],
    [2100, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [60, 1400],
);

/** The rifle tips onto its side for the receiver and the port, then rises for a look through the prism. */
const RIFLE = clip(
  3000,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [520, [-0.05, 0.06, 0.02], [0.18, 0.36, 0.72], "inOut"],
    [1450, [-0.05, 0.064, 0.02], [0.22, 0.4, 0.76]],
    [2000, [-0.06, 0.05, 0.04], [-0.24, 0.12, -0.08], "inOut"],
    [2450, [-0.06, 0.05, 0.04], [-0.22, 0.1, -0.06]],
    [3000, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [100, 1950],
);

/** The shotgun rolls its loading port up to her, then the muzzle comes up to check the bead. */
const SHOTGUN = clip(
  2900,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [500, [-0.04, 0.05, 0.01], [0.24, 0.3, -0.82], "inOut"],
    [1400, [-0.04, 0.054, 0.01], [0.28, 0.34, -0.86]],
    [1950, [-0.03, 0.06, 0.02], [0.38, 0.16, 0.12], "inOut"],
    [2350, [-0.03, 0.06, 0.02], [0.36, 0.14, 0.1]],
    [2900, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [90, 1900],
);

/** The sniper's weight: a slow tip onto the left side to show the bolt, then a long look at the glass. */
const SNIPER = clip(
  3400,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [650, [-0.06, 0.07, 0.03], [0.16, 0.3, 0.64], "inOut"],
    [1650, [-0.06, 0.074, 0.03], [0.2, 0.33, 0.68]],
    [2300, [-0.07, 0.04, 0.06], [-0.18, 0.2, -0.06], "inOut"],
    [2850, [-0.07, 0.04, 0.06], [-0.16, 0.18, -0.05]],
    [3400, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [120, 2250],
);

/** The launcher: a heavy roll onto its side to show the breech, and back. */
const LAUNCHER = clip(
  3000,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [600, [-0.04, 0.05, 0.03], [0.14, 0.32, 0.6], "inOut"],
    [1600, [-0.04, 0.054, 0.03], [0.18, 0.35, 0.64]],
    [2200, [-0.02, 0.03, 0.02], [-0.12, 0.08, -0.12], "inOut"],
    [3000, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [110, 2150],
);

/** A blade or a baton: the edge turned slowly through the light, flat, then back. */
const MELEE = clip(
  2400,
  [
    [0, [0, 0, 0], [0, 0, 0]],
    [420, [-0.03, 0.06, -0.04], [0.2, 0.9, 0.2], "inOut"],
    [1200, [-0.03, 0.065, -0.04], [0.24, 0.95, 1.2]],
    [1700, [-0.02, 0.04, -0.02], [0.1, 0.4, 1.3], "inOut"],
    [2400, [0, 0, 0], [0, 0, 0], "inOut"],
  ],
  [80, 1150],
);

export const INSPECTS: Record<WeaponClass, Clip> = {
  pistol: PISTOL,
  smart: PISTOL,
  revolver: REVOLVER,
  smg: SMG,
  rifle: RIFLE,
  shotgun: SHOTGUN,
  sniper: SNIPER,
  launcher: LAUNCHER,
  melee: MELEE,
};

/** The inspect for a class. */
export const inspectClip = (c: WeaponClass): Clip => INSPECTS[c] ?? PISTOL;

/** The clip's largest turn (radians, the bigger of yaw and roll): the HUD's "how far into the turn" divides by it. */
export function inspectPeak(c: Clip): number {
  let m = 0;
  for (const k of c.tracks.root ?? []) m = Math.max(m, Math.abs(k[2][1]), Math.abs(k[2][2]));
  return m || 1;
}

/** The idle sway per class: amplitude (m at the hip; the roll and pitch take about as many radians) and the breath's rate (Hz). */
export interface IdleSway {
  amp: number;
  hz: number;
}

export const IDLE_SWAY: Record<WeaponClass, IdleSway> = {
  pistol: { amp: 0.0018, hz: 0.3 },
  smart: { amp: 0.0018, hz: 0.3 },
  revolver: { amp: 0.0021, hz: 0.27 },
  smg: { amp: 0.002, hz: 0.28 },
  rifle: { amp: 0.0024, hz: 0.24 },
  shotgun: { amp: 0.0026, hz: 0.23 },
  sniper: { amp: 0.0028, hz: 0.2 },
  launcher: { amp: 0.003, hz: 0.19 },
  melee: { amp: 0.0022, hz: 0.26 },
};

/**
 * The sway's offset at time `t` (s): a slow figure-eight (x at the breath's rate, y at twice it, a roll that
 * follows x). Zero under reduced motion, and scaled down as she aims (`steady`, 1 at the hip).
 */
export function idleSway(s: IdleSway, t: number, steady: number, calm: boolean): { x: number; y: number; roll: number; pitch: number } {
  if (calm || steady <= 0) return { x: 0, y: 0, roll: 0, pitch: 0 };
  const w = Math.PI * 2 * s.hz;
  const a = s.amp * steady;
  const x = Math.sin(w * t) * a;
  const y = Math.sin(w * 2 * t + 0.6) * a * 0.55;
  return { x, y, roll: x * 1.0, pitch: y * 0.8 };
}
