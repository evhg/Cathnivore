import type { Action, GameEvent, GameState } from '../../engine/types'

// Plan item 53: which sound each thing on the table makes. The players' world is wood, paper, coin and a crowd;
// Hollowell's moves are clean synth, so the joke is in the sound too. Pure: no audio here (see synth.ts).

export type Cue =
  | 'woodClack'
  | 'paperSlide'
  | 'paperFlip'
  | 'paperTear'
  | 'coin'
  /** One coin set down, for counting Marks out. */
  | 'coinOne'
  | 'awning'
  | 'crowd'
  | 'bell'
  | 'synthChime'
  | 'synthSweep'
  | 'synthSweepLow'
  | 'synthBlip'
  | 'synthGlitch'
  | 'win'
  | 'lose'

/** Hollowell's own cues: synthesised tones only, never wood or paper. */
export const SYNTH_CUES: ReadonlySet<Cue> = new Set<Cue>(['synthChime', 'synthSweep', 'synthSweepLow', 'synthBlip', 'synthGlitch', 'lose'])

/** Events that are Hollowell's doing (its Agenda, Squeezes, new Outlets and Buyouts, Doubt, scouts, rifts). */
export const HOLLOWELL_EVENTS: ReadonlySet<GameEvent['type']> = new Set<GameEvent['type']>(['agenda', 'squeeze', 'expand', 'scout', 'riftSplit'])

export const ACTION_CUE: Record<Action['kind'], Cue> = {
  openStall: 'awning',
  supplyOutlets: 'woodClack',
  supplyBuyout: 'woodClack',
  rebut: 'paperFlip',
  invest: 'paperSlide',
  sell: 'coin',
  scheme: 'paperFlip',
  graft: 'coin',
  role: 'woodClack',
  decide: 'paperSlide',
  tearUpContract: 'paperTear',
}

/** The cue for one event, or null when the action's own cue already says it (the log's `action` echo). */
export function eventCue(e: GameEvent): Cue | null {
  switch (e.type) {
    case 'action':
      return null
    case 'liberated':
      return 'crowd'
    case 'agenda':
      return 'synthChime'
    case 'squeeze':
      return e.lostLand ? 'synthSweepLow' : 'synthSweep'
    case 'expand':
      return e.piece === 'doubt' ? 'synthBlip' : 'synthChime'
    case 'scout':
      return 'synthBlip'
    case 'invest':
      return 'coin'
    case 'schemePlayed':
      return 'paperFlip'
    case 'riftSplit':
      return 'synthGlitch'
    case 'decision':
      return 'paperSlide'
    case 'trigger':
      return 'bell'
  }
}

/**
 * The cues for one step of play, in order: the action's own, then one per kind of event it caused (a Squeeze
 * that takes three regions plays once). At most four, so a busy enemy turn doesn't stack into noise. The
 * result, when the game ends, replaces the rest.
 */
export function cueFor(action: Action | null, events: readonly GameEvent[], result: GameState['result'] = null): Cue[] {
  if (result) return [result.won ? 'win' : 'lose']
  const out: Cue[] = []
  if (action) out.push(ACTION_CUE[action.kind])
  for (const e of events) {
    const c = eventCue(e)
    if (c && !out.includes(c)) out.push(c)
  }
  return out.slice(0, 4)
}
