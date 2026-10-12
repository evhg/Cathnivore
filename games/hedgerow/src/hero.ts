// Cath levels up inside a run (Hedgerow 2 M6): every layer the field pops feeds her, so she grows with the
// round book instead of standing still. Pure maths; the engine applies the result to the Hero. Classic
// levels never call it, so acts 4 to 10 play as before.

export const HERO_MAX_LEVEL = 20;
/** Gain per level on top of the level-1 body, before the save's attributes. */
export const HERO_LEVEL_GAIN = { damage: 0.05, hp: 0.05 };

/** Popped layers needed to reach `level` (level 1 is free). */
export function xpFor(level: number): number {
  const n = Math.max(0, Math.min(HERO_MAX_LEVEL, Math.floor(level)) - 1);
  return Math.round(92 * Math.pow(n, 2.2));
}

/** Her level for a count of popped layers. */
export function levelFor(popped: number): number {
  let lv = 1;
  while (lv < HERO_MAX_LEVEL && popped >= xpFor(lv + 1)) lv++;
  return lv;
}

/** Multiplier on her base damage and health at a level. */
export function levelScale(level: number): { damage: number; hp: number } {
  const n = Math.max(0, level - 1);
  return { damage: 1 + HERO_LEVEL_GAIN.damage * n, hp: 1 + HERO_LEVEL_GAIN.hp * n };
}
