// Plan item 370: the 2D field's sun, so its cast shadows fall the same way as the 3D view's key light (item 360).
// The azimuths are each act's `sunAz` in render3d/palette.ts (a test keeps the two equal); this module stays free of
// three.js so the 2D renderer doesn't pull it in.

/** Each act's sun azimuth in degrees, as in the 3D palette: the sun sits at (cos az, sin az) in (x, row) from the centre. */
export const ACT_SUN_AZ: readonly number[] = [140, 120, 200, 230, 250, 170, 270, 210, 190, 300];

export function sunAzFor(levelId: number): number {
  return ACT_SUN_AZ[Math.min(ACT_SUN_AZ.length - 1, Math.max(0, Math.floor((levelId - 1) / 10)))]!;
}

/** The unit direction a shadow falls on the 2D board (screen x right, y down): away from the sun. */
export function shadowDir(levelId: number): { x: number; y: number } {
  const az = (sunAzFor(levelId) * Math.PI) / 180;
  return { x: -Math.cos(az), y: -Math.sin(az) };
}
