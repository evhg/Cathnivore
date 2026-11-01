import { AGENDA_CARDS_BY_ID } from '../content/agenda'
import { REGIONS } from '../content/map'
import type { CathExpression } from '../../shared/cath/cath'
import type { Faction, GameEvent } from '../engine/types'

// Plan item 11: the conglomerates as characters. Every enemy-turn step is played by the face behind it —
// Graham Pell for Hollowell (Outlets, Buyouts, Squeeze), Octavia Vane for Candor (Doubt, Trust) — with a
// one-line bark, and Cath answers the turn's last word. Barks are picked deterministically from the step's
// own facts (its region and its place in the turn), so a replay of the same turn says the same thing.

export type Exec = 'pell' | 'vane'
/** The three faces each executive pulls: pleased with himself, triumphant, and rattled. */
export type ExecMood = 'smug' | 'gloat' | 'rattled'

export const EXECS: Record<Exec, { name: string; title: string; faction: Faction }> = {
  pell: { name: 'Graham Pell', title: 'Chief Executive, Hollowell', faction: 'hollowell' },
  vane: { name: 'Octavia Vane', title: 'Public Understanding, Candor', faction: 'candor' },
}

/** How a mood is drawn on the shared figure rig. */
export const MOOD_EXPRESSION: Record<ExecMood, CathExpression> = {
  smug: 'wink',
  gloat: 'delighted',
  rattled: 'worried',
}

const BARKS: Record<Exec, Record<ExecMood, readonly string[]>> = {
  pell: {
    smug: [
      'Convenience is a kind of love, {region}.',
      'Another little shop for {region}. You’re welcome.',
      'We’re not closing anyone down. We’re opening up choice.',
      'Lovely spot, {region}. Lovelier with a car park.',
    ],
    gloat: [
      'Sold. They always sell.',
      'Everyone has a price, and ours is lower.',
      '{region} is under new management.',
    ],
    rattled: [
      'A minor regional setback.',
      'We’ll have our people look at {region}.',
      'Nobody tell the shareholders about {region}.',
    ],
  },
  vane: {
    smug: [
      'Just asking questions about {region}.',
      'Some people are saying things. We are some people.',
      'Our survey of {region} found it would rather not know.',
      'We only want what’s best for {region}. We decide what that is.',
    ],
    gloat: [
      'Trust is a renewable resource. For us.',
      'The story writes itself. We just hold the pen.',
      '{region} has heard enough. From you.',
    ],
    rattled: [
      'We are reviewing our messaging.',
      'That’s not the narrative we circulated.',
      'No comment on {region} at this time.',
    ],
  },
}

/** Cath's answer to the turn's last bark, by who spoke it. */
const REPLIES: Record<Exec, readonly string[]> = {
  pell: [
    'Every stall we open is one he can’t buy.',
    'He sells cheap. We sell true. Keep going.',
    'Graham counts tills. We count neighbours.',
  ],
  vane: [
    'Doubt’s cheap. Rebut it with the real thing.',
    'Octavia talks. The market answers.',
    'She writes the story; we’ve got the receipts.',
  ],
}

export interface BoardroomBeat {
  exec: Exec
  mood: ExecMood
  bark: string
  /** The card or piece this step plays, named, for the flipping card. */
  card: string
}

/** Who plays a step: Doubt and Candor's Agenda cards are Vane's; Outlets, Buyouts and Squeeze are Pell's. */
export function execFor(event: GameEvent): Exec | undefined {
  switch (event.type) {
    case 'agenda':
      return AGENDA_CARDS_BY_ID.get(event.cardId)?.faction === 'candor' ? 'vane' : 'pell'
    case 'scout':
      return event.doubtAdded ? 'vane' : 'pell'
    case 'expand':
      return event.piece === 'doubt' ? 'vane' : 'pell'
    case 'squeeze':
      return event.trustLoss > 0 && !event.lostLand && !event.stallRemoved ? 'vane' : 'pell'
    case 'liberated':
      return 'pell'
    case 'riftSplit':
      return event.faction === 'candor' ? 'vane' : 'pell'
    default:
      return undefined
  }
}

function moodFor(event: GameEvent): ExecMood {
  switch (event.type) {
    case 'squeeze':
      return event.lostLand || event.stallRemoved || event.trustLoss > 0 ? 'gloat' : 'rattled'
    case 'liberated':
    case 'riftSplit':
      return 'rattled'
    default:
      return 'smug'
  }
}

function cardFor(event: GameEvent): string {
  switch (event.type) {
    case 'agenda':
      return AGENDA_CARDS_BY_ID.get(event.cardId)?.headline ?? 'Agenda'
    case 'scout':
      return event.doubtAdded ? 'Scout: Outlet and Doubt' : 'Scout: Outlet'
    case 'expand':
      return `Expand: ${event.piece === 'outlet' ? 'Outlet' : event.piece === 'buyout' ? 'Buyout' : 'Doubt'}`
    case 'squeeze':
      return 'Squeeze'
    case 'liberated':
      return 'Liberated'
    case 'riftSplit':
      return 'The Split'
    default:
      return ''
  }
}

/** A small stable hash of a string, for picking lines. */
function pick(seed: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return (h >>> 0) % n
}

/** One step's executive, face, card and bark; undefined for steps nobody plays. `step` is its index in the turn. */
export function boardroomBeat(event: GameEvent, step: number): BoardroomBeat | undefined {
  const exec = execFor(event)
  if (!exec) return undefined
  const mood = moodFor(event)
  const region = 'region' in event ? REGIONS[event.region as keyof typeof REGIONS]?.name ?? '' : ''
  const lines = BARKS[exec][mood].filter((l) => region || !l.includes('{region}'))
  const line = lines[pick(`${event.type}:${region}:${step}`, lines.length)]!
  return { exec, mood, bark: line.replaceAll('{region}', region), card: cardFor(event) }
}

/** Cath's reply to the last executive who spoke in a turn. */
export function cathReply(exec: Exec, turnSeed: string): string {
  const lines = REPLIES[exec]
  return lines[pick(turnSeed, lines.length)]!
}
