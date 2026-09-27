import { REGIONS } from '../content/map'
import { AGENDA_CARDS_BY_ID } from '../content/agenda'
import { PRODUCERS } from '../content/producers'
import type { GameEvent, GameState } from '../engine/types'

// SPEC 10.2: "the enemy turn plays back as a short series of steps, at most 1 second each, each with a
// caption such as 'Squeeze in Highmoor: 1 Lost Land.'" `runEnemyTurn`/`cleanup` already append one
// `GameEvent` per step to `state.log` (agenda, squeeze, expand, scout, plus any liberated/riftSplit they
// trigger); this just turns the slice of the log added by one `applyAction` call into captions.

// The enemy turn always starts by resolving Agenda (SPEC 4.5.3), so the first 'agenda' event in the
// newly-appended log entries marks where the player's own action ends and the enemy turn begins.
export function enemyTurnEvents(previous: GameState, next: GameState): GameEvent[] {
  const added = next.log.slice(previous.log.length)
  const agendaIndex = added.findIndex((e) => e.type === 'agenda')
  return agendaIndex === -1 ? [] : added.slice(agendaIndex)
}

export function captionFor(event: GameEvent): string {
  switch (event.type) {
    case 'agenda': {
      const card = AGENDA_CARDS_BY_ID.get(event.cardId)
      const bonus = event.bonusSkipped ? ' (bonus skipped — Rift 3+)' : ''
      return card ? `${card.headline}${bonus}` : `Agenda: ${event.cardId}`
    }
    case 'scout': {
      const region = REGIONS[event.region].name
      return event.doubtAdded ? `Scout in ${region}: 1 Outlet, 1 Doubt.` : `Scout in ${region}: 1 Outlet.`
    }
    case 'expand': {
      const region = REGIONS[event.region].name
      const piece = event.piece === 'outlet' ? 'Outlet' : event.piece === 'buyout' ? 'Buyout' : 'Doubt'
      return `Expand in ${region}: 1 ${piece}.`
    }
    case 'squeeze': {
      const region = REGIONS[event.region].name
      const parts: string[] = []
      if (event.lostLand) parts.push('1 Lost Land')
      if (event.stallRemoved) parts.push('1 Stall removed')
      if (event.trustLoss > 0) parts.push(`Trust -${event.trustLoss}`)
      return parts.length > 0 ? `Squeeze in ${region}: ${parts.join(', ')}.` : `Squeeze in ${region}: held.`
    }
    case 'liberated':
      return `${REGIONS[event.region].name} liberated by ${PRODUCERS[event.producer].name}.`
    case 'riftSplit':
      return `Rift 6, The Split: ${event.faction === 'hollowell' ? 'Hollowell' : 'Candor'} loses half its pieces.`
    default:
      return ''
  }
}
