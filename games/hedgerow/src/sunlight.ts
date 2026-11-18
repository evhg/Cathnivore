// Plan item 370: the 2D field's sun, so its cast shadows fall the same way as the 3D view's key light (item 360).
// The azimuths are each act's `sunAz` in render3d/palette.ts (a test keeps the two equal); this module stays free of
// three.js so the 2D renderer doesn't pull it in.

/** Each act's sun azimuth in degrees, as in the 3D palette: the sun sits at (cos az, sin az) in (x, row) from the centre. */
export const ACT_SUN_AZ: readonly number[] = [140, 120, 200, 230, 250, 170, 270, 210, 190, 300];

/** Plan item 440: each act's sun colour, as the 3D palette's `sun` (a test keeps the two equal): the 2D grade's lit side. */
export const ACT_SUN_COLOUR: readonly string[] = ["#fff1d0", "#ffe2a8", "#f4fbff", "#f2f6ea", "#ffe7b0", "#ffffff", "#ffad70", "#fff0d8", "#e8f0ff", "#ffb070"];

/** The act's sun colour as "r,g,b" for an rgba() wash. */
export function sunRgbFor(levelId: number): string {
  const hex = ACT_SUN_COLOUR[Math.min(ACT_SUN_COLOUR.length - 1, Math.max(0, Math.floor((levelId - 1) / 10)))]!;
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function sunAzFor(levelId: number): number {
  return ACT_SUN_AZ[Math.min(ACT_SUN_AZ.length - 1, Math.max(0, Math.floor((levelId - 1) / 10)))]!;
}

/** The unit direction a shadow falls on the 2D board (screen x right, y down): away from the sun. */
export function shadowDir(levelId: number): { x: number; y: number } {
  const az = (sunAzFor(levelId) * Math.PI) / 180;
  return { x: -Math.cos(az), y: -Math.sin(az) };
}

// ---- Plan item 485: the day passes over the field, morning to dusk across a level ----
// Cosmetic only. The act's azimuth above stays its noon; the day swings the sun about it, lengthens and warms the
// shadows toward the ends, and lights the lamps in the last third.

/** How far through the day round `round` (1-based) of `rounds` is: 0 the first round's morning, 1 the last's dusk. */
export function dayPhase(round: number, rounds: number): number {
  if (!(rounds > 1)) return 0;
  return Math.min(1, Math.max(0, (round - 1) / (rounds - 1)));
}

/** The swing either side of the act's noon, in degrees. */
export const DAY_SWING = 40;

/** The sun's azimuth at a phase: the act's noon at 0.5, DAY_SWING before it in the morning, after it at dusk. */
export function dayAzFor(levelId: number, phase: number): number {
  return sunAzFor(levelId) + (Math.min(1, Math.max(0, phase)) - 0.5) * 2 * DAY_SWING;
}

/** The 2D shadow's direction at a phase (away from the day's sun). */
export function dayShadowDir(levelId: number, phase: number): { x: number; y: number } {
  const az = (dayAzFor(levelId, phase) * Math.PI) / 180;
  return { x: -Math.cos(az), y: -Math.sin(az) };
}

/** The shadow's length as a multiple of noon's: 1 at noon, 1.8 at morning and dusk (a low sun). */
export function dayShadowLength(phase: number): number {
  const d = 2 * Math.abs(Math.min(1, Math.max(0, phase)) - 0.5);
  return 1 + 0.8 * d * d;
}

/** How warm the light runs: 0 through the morning and noon, rising to 1 at dusk. */
export function dayWarmth(phase: number): number {
  const k = Math.min(1, Math.max(0, (phase - 0.5) / 0.5));
  return k * k * (3 - 2 * k);
}

/** The farm's lamps (farmhouse windows, the depot's neon, the folk's lanterns) are lit in the day's last third. */
export function dayLamps(phase: number): boolean {
  return phase >= 2 / 3;
}

const DUSK = [255, 150, 92] as const;

/** The day's sun colour as "r,g,b": the act's own, run toward a dusk orange by `dayWarmth` (at most 60% of the way). */
export function daySunRgb(levelId: number, phase: number): string {
  const base = sunRgbFor(levelId).split(",").map(Number);
  const w = 0.6 * dayWarmth(phase);
  return base.map((c, i) => Math.round(c + (DUSK[i]! - c) * w)).join(",");
}
