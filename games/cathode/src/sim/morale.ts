// S11 morale (docs/design/cathode-combat.md C16): a 0..1 nerve per fighter. Allies dying near him, his leader
// falling, his own wounds and a takedown in front of him knock it down; quiet seconds in cover build it back.
// Below 0.3 he falls back to the farthest cover and shoots at half accuracy; below 0.1, the last one standing gives up
// (Price-War Boys run instead). Machines and Cyberpsychos have none. Pure: no three.js.

export type MoraleEvent = "allyDied" | "leaderDied" | "lowHp" | "takedownSeen" | "coverSecond";

/** The S11 table. `coverSecond` is per second in cover without being hit. */
export const MORALE_DELTA: Readonly<Record<MoraleEvent, number>> = {
  allyDied: -0.25,
  leaderDied: -0.4,
  lowHp: -0.3,
  takedownSeen: -0.35,
  coverSecond: 0.1,
};

/** How near an ally's death must be to shake him (m). */
export const ALLY_DEATH_M = 15;
/** Below this he falls back; below SURRENDER_AT, alone, he gives up. */
export const FALLBACK_AT = 0.3;
export const SURRENDER_AT = 0.1;
/** A fighter falling back shoots at this share of his accuracy. */
export const FALLBACK_ACCURACY = 0.5;

export type MoraleBand = "steady" | "fallback" | "broken";

export interface Morale {
  value: number;
  /** False for machines and Cyberpsychos: every event is ignored and he never breaks. */
  readonly has: boolean;
  /** The low-HP hit counts once. */
  lowHpTaken: boolean;
}

export function makeMorale(has = true, start = 1): Morale {
  return { value: has ? start : 1, has, lowHpTaken: false };
}

/** Applies one event (`k` scales it: `coverSecond` takes the seconds). Returns the new value. */
export function moraleEvent(m: Morale, ev: MoraleEvent, k = 1): number {
  if (!m.has) return m.value;
  if (ev === "lowHp") {
    if (m.lowHpTaken) return m.value;
    m.lowHpTaken = true;
  }
  m.value = Math.max(0, Math.min(1, m.value + MORALE_DELTA[ev] * k));
  return m.value;
}

/** What his nerve says he does. `lastAlive`: he is the only one of his squad still up. */
export function moraleBand(m: Morale, lastAlive: boolean): MoraleBand {
  if (!m.has) return "steady";
  if (m.value < SURRENDER_AT && lastAlive) return "broken";
  if (m.value < FALLBACK_AT) return "fallback";
  return "steady";
}

/** His accuracy multiplier from morale. */
export function moraleAccuracy(m: Morale, lastAlive = false): number {
  return moraleBand(m, lastAlive) === "steady" ? 1 : FALLBACK_ACCURACY;
}

/** Factions that run rather than kneel when they break (S11). */
export const FLEES_INSTEAD: ReadonlySet<string> = new Set(["priceWarBoys"]);
