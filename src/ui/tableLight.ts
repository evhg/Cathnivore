// Plan item 28: the market table is lit by the day passing. Round 1 opens at dawn and the light swings
// across the table to dusk by round 9 (a campaign game rarely runs past 10). The phase is a data attribute
// on the table; the CSS turns it into a light token, a sun position and, at dusk, a long shade. In the dark
// theme the table is lit by lanterns at night instead, the same every round.

export type TablePhase = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk'

const PHASES: readonly TablePhase[] = ['dawn', 'morning', 'noon', 'afternoon', 'dusk']

/** The time of day on the table for a round (1-based): two rounds per phase, dusk from round 9 on. */
export function lightFor(round: number): TablePhase {
  const i = Math.floor((Math.max(1, Math.round(round)) - 1) / 2)
  return PHASES[Math.min(PHASES.length - 1, i)]!
}
