import { ALL_REGION_IDS, REGIONS } from '../content/map'
import { PRODUCERS } from '../content/producers'
import { unshuffledPressureDeck } from '../content/pressure'
import { AGENDA_CARDS } from '../content/agenda'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { createRng, shuffle } from './rng'
import type { GameConfig, GameState, PressureCard, ProducerState, RegionState } from './types'
import { resolveScout } from './enemy'
import { POOL_SIZES, addBuyout, addDoubt, addOutlets } from './pieces'

function buildPressureDeck(seed: number): { deck: PressureCard[]; seedAfter: number } {
  const cards = unshuffledPressureDeck()
  const byStage = (s: 1 | 2 | 3) => cards.filter((c) => c.stage === s)
  let rng = createRng(seed)
  const shuffled: PressureCard[] = []
  for (const stage of [1, 2, 3] as const) {
    const [s, next] = shuffle(byStage(stage), rng)
    rng = next
    shuffled.push(...s)
  }
  return { deck: shuffled, seedAfter: rng.seed }
}

function emptyRegion(id: (typeof ALL_REGION_IDS)[number]): RegionState {
  return {
    id,
    stalls: {},
    outlets: 0,
    buyouts: 0,
    doubt: 0,
    lostLand: 0,
    liberated: false,
    everLiberated: false,
  }
}

export function createGame(config: GameConfig, seed: number): GameState {
  if (config.producers.length < 1) throw new Error('createGame: at least one producer is required')
  const firstProducer = config.producers[0]!
  const settings = DIFFICULTY_SETTINGS[config.difficulty]
  const active = new Set(config.activeRegions)

  const regions: GameState['regions'] = {} as GameState['regions']
  for (const id of ALL_REGION_IDS) {
    regions[id] = emptyRegion(id)
  }

  const producers: GameState['producers'] = {} as GameState['producers']
  for (const pid of config.producers) {
    const def = PRODUCERS[pid]
    const state: ProducerState = {
      id: pid,
      resources: { ...def.startingResources },
      production: { ...def.startingProduction },
      improvements: [],
      roleUsedThisRound: false,
    }
    producers[pid] = state
    if (active.has(def.home)) {
      regions[def.home].stalls[pid] = 2
    }
  }

  // SPEC 8.1 "a scripted Pressure sequence where needed": a campaign chapter can supply a fixed card
  // order (e.g. chapter 1's tutorial Scout sequence) instead of the normal per-stage shuffle.
  const { deck, seedAfter } = config.scriptedPressure
    ? { deck: config.scriptedPressure, seedAfter: seed }
    : buildPressureDeck(seed)
  const [agendaDeck, agendaRng] = shuffle(
    AGENDA_CARDS.map((c) => c.id),
    { seed: seedAfter },
  )
  const [improvementDeck, improvementRng] = shuffle(
    IMPROVEMENTS.map((c) => c.id),
    agendaRng,
  )
  const [schemeDeck, schemeRng] = shuffle(
    SCHEMES.map((c) => c.id),
    improvementRng,
  )
  const rng = schemeRng
  const market = [...improvementDeck.slice(0, 4), ...Array(Math.max(0, 4 - improvementDeck.length)).fill(null)]
  const marketRest = improvementDeck.slice(4)
  const cathsPlan = [...schemeDeck.slice(0, 3), ...Array(Math.max(0, 3 - schemeDeck.length)).fill(null)]
  const schemeRest = schemeDeck.slice(3)

  let state: GameState = {
    config,
    rng,
    round: 1,
    firstPlayer: firstProducer,
    activeProducer: firstProducer,
    actionsLeft: 3,
    publicTrust: settings.publicTrust,
    rift: 0,
    riftSplitDone: false,
    lostLandPool: settings.lostLandPool,
    outletPool: POOL_SIZES.outlet,
    buyoutPool: POOL_SIZES.buyout,
    doubtPool: POOL_SIZES.doubt,
    regions,
    producers,
    pressureDeck: deck,
    pressureDiscard: [],
    squeeze: null,
    expand: null,
    scout: null,
    agendaDeck,
    agendaDiscard: [],
    currentAgenda: null,
    agendaRemoved: [],
    improvementDeck: marketRest,
    improvementDiscard: [],
    market,
    schemeDeck: schemeRest,
    schemeDiscard: [],
    cathsPlan,
    squeezeSkip: [],
    expandSkip: [],
    pendingDecisions: [],
    log: [],
    actionHistory: [],
    result: null,
  }

  // SPEC 4.3.2: Kingsmarket 2 Outlets/1 Buyout/2 Doubt; every other region 1 Outlet; each Coast +1 Doubt.
  for (const id of config.activeRegions) {
    const def = REGIONS[id]
    if (def.type === 'capital') {
      state = addOutlets(state, id, config.difficulty === 'hard' ? 3 : 2)
      state = addBuyout(state, id, 1)
      state = addDoubt(state, id, 2)
    } else {
      state = addOutlets(state, id, 1)
      if (def.type === 'coast') state = addDoubt(state, id, 1)
      if (def.type === 'pasture' && config.difficulty === 'hard') state = addDoubt(state, id, 1)
    }
  }

  // SPEC 4.3.4: reveal the top card into Scout, resolve Scout, then advance the pipeline.
  const top = state.pressureDeck[0] ?? null
  state = { ...state, pressureDeck: state.pressureDeck.slice(1), scout: top }
  state = resolveScout(state)
  state = {
    ...state,
    squeeze: state.expand,
    expand: state.scout,
    scout: null,
  }

  return state
}

export { isLiberated, regionStallTotal } from './region'
