// Phone haptics: short buzzes for the moments that matter. Silent where unsupported, and off when sound is muted.

let enabled = true;

export function setHaptics(on: boolean): void {
  enabled = on;
}

export function buzz(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported: fine
  }
}

export const haptic = {
  build: () => buzz(12),
  upgrade: () => buzz([10, 40, 18]),
  leak: () => buzz(40),
  boss: () => buzz([30, 40, 60]),
  win: () => buzz([20, 50, 20, 50, 40]),
  lose: () => buzz(120),
  /** An ability is ready again: a tiny tick under the thumb. */
  ready: () => buzz(8),
  /** Something got through: the first leak of a round. */
  leakReport: () => buzz([30, 30, 50]),
};
