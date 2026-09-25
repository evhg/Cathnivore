import { REGIONS } from '../content/map'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import { PRODUCERS } from '../content/producers'
import { captionFor } from './enemyTurnLog'
import type { Action, GameEvent, ProducerId } from '../engine/types'

const RESOURCE_NAME = { produce: 'Produce', marks: 'Marks', goodwill: 'Goodwill' } as const

// A plain-English caption for one action, historical (SPEC 10.2's Log sheet), unlike `actionLabel`'s
// present-tense button text: it names the producer (a fixed `event.producer`, not `state.activeProducer`,
// since a Log entry may be many turns old) and skips invest/scheme (they get their own richer captions).
function actionCaption(producer: ProducerId, action: Action): string | null {
  const name = PRODUCERS[producer].name
  switch (action.kind) {
    case 'openStall':
      return `${name} opens a Stall in ${REGIONS[action.region].name}.`
    case 'supplyOutlets':
      return `${name} supplies away ${action.count} Outlet${action.count > 1 ? 's' : ''} in ${REGIONS[action.region].name}.`
    case 'supplyBuyout':
      return `${name} supplies away a Buyout in ${REGIONS[action.region].name}.`
    case 'rebut':
      return `${name} rebuts ${action.count} Doubt in ${REGIONS[action.region].name}.`
    case 'sell':
      return `${name} sells ${action.count} Produce for Marks.`
    case 'graft':
      return `${name} grafts for +1 Produce, +1 Marks.`
    case 'role':
      return `${name} uses ${PRODUCERS[producer].roleName}.`
    case 'tearUpContract':
      return `${name} tears up a Wholesome Hollow Contract.`
    case 'invest':
    case 'scheme':
    case 'decide':
      return null // covered by the 'invest'/'schemePlayed'/'decision' GameEvents instead
  }
}

// The Log sheet (SPEC 10.2) shows every turn's actions plus enemy-turn events in one readable feed.
// Reuses `captionFor` for the enemy-turn event types it already knows how to render.
export function logCaption(event: GameEvent): string | null {
  switch (event.type) {
    case 'action':
      return actionCaption(event.producer, event.action)
    case 'invest': {
      const card = IMPROVEMENTS_BY_ID.get(event.improvementId)
      return `${PRODUCERS[event.producer].name} buys ${card?.name ?? event.improvementId}.`
    }
    case 'schemePlayed': {
      const card = SCHEMES_BY_ID.get(event.schemeId)
      const target = event.target ? ` in ${REGIONS[event.target].name}` : ''
      return `${PRODUCERS[event.producer].name} plays ${card?.name ?? event.schemeId}${target}.`
    }
    case 'decision':
      return `Choice recorded: ${RESOURCE_NAME[event.choice]}.`
    case 'agenda':
    case 'squeeze':
    case 'expand':
    case 'scout':
    case 'liberated':
    case 'riftSplit': {
      const caption = captionFor(event)
      return caption || null
    }
    case 'trigger':
      return null // the UI shows the scripted scene itself instead of a log line
  }
}
