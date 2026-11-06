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

/** Plan item 60: the title's table is lit by the player's own clock: dawn before 8, dusk from 5 in the evening. */
export function lightForHour(hour: number): TablePhase {
  if (hour < 8) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 14) return 'noon'
  if (hour < 17) return 'afternoon'
  return 'dusk'
}

/** Plan item 206: the title market's sky by the player's clock. The dark theme is always the lantern-lit evening. */
export type TitleSky = 'dawn' | 'day' | 'golden' | 'evening'

export function skyForHour(hour: number, dark = false): TitleSky {
  if (dark) return 'evening'
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 16) return 'day'
  if (hour >= 16 && hour < 19) return 'golden'
  return 'evening'
}
