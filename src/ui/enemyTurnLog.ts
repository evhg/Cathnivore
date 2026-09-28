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

// SPEC 8.1/8.2 ch3/ch6: finds the still-pending mid-game scripted-scene trigger in a game's log, if any.
// `round.ts` appends a `{type: 'trigger'}` event once, the moment a chapter's `scriptedTrigger` condition is
// reached, and it stays in `log` forever afterward (log entries are permanent history, never removed).
// The Scene overlay it triggers blocks every game action while it's pending (no action buttons render), so
// "at least one `{type: 'action'}` event exists later in the log" is durable proof the scene was already
// shown and dismissed in an earlier session — without it, a reload long after the scene was dismissed would
// find that same past trigger again and show the overlay a second time, re-blocking the current turn (a
// real bug this function fixes; see DECISIONS.md). `dismissedIds` covers same-session dismissal, which
// happens before any further action gets logged.
export function pendingMidSceneTrigger(
  log: GameEvent[],
  dismissedIds: string[],
): Extract<GameEvent, { type: 'trigger' }> | undefined {
  return log.find((event, i) => {
    if (event.type !== 'trigger') return false
    if (dismissedIds.includes(event.sceneId)) return false
    return !log.slice(i + 1).some((later) => later.type === 'action')
  }) as Extract<GameEvent, { type: 'trigger' }> | undefined
}
