import { ALL_REGION_IDS, REGIONS } from '../content/map'
import { PRODUCERS } from '../content/producers'
import { unshuffledPressureDeck } from '../content/pressure'
import { AGENDA_CARDS } from '../content/agenda'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { createRng, shuffle } from './rng'
import type { GameConfig, GameState, PressureCard, ProducerState, RegionId, RegionState } from './types'
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
    if (!config.scriptedStart?.regions && active.has(def.home)) {
      regions[def.home].stalls[pid] = 2 + settings.extraHomeStalls
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
  // SPEC 8.2 ch3: a chapter can force specific cards (e.g. 3x "Wholesome Hollow Contract") into the
  // opening Market instead of the usual shuffled draw. Those ids never entered `improvementDeck` (they
  // aren't part of `IMPROVEMENTS`), so the remaining slots still fill from the normal shuffled deck.
  const scripted = config.scriptedMarket ?? []
  const fillCount = Math.max(0, 4 - scripted.length)
  const market = [...scripted.slice(0, 4), ...improvementDeck.slice(0, fillCount), ...Array(Math.max(0, 4 - scripted.length - fillCount)).fill(null)]
  const marketRest = improvementDeck.slice(fillCount)
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
    lostLandPool: config.lostLandPoolOverride ?? settings.lostLandPool,
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
    wholesomeHollowRevealed: false,
    contractsTornUp: 0,
    scriptedTriggerFired: false,
    cathsPlanLocked: config.cathsPlanLocked ?? false,
    freeSchemePlays: 0,
    log: [],
    actionHistory: [],
    result: null,
  }

  if (config.scriptedStart?.regions) {
    // SPEC 8.2 ch5: an explicit pre-built board replaces the normal SPEC 4.3.2 setup entirely.
    const start = config.scriptedStart
    for (const [id, r] of Object.entries(start.regions ?? {}) as [RegionState['id'], NonNullable<typeof start.regions>[RegionState['id']]][]) {
      if (!r) continue
      if (r.outlets) state = addOutlets(state, id, r.outlets)
      if (r.buyouts) state = addBuyout(state, id, r.buyouts)
      if (r.doubt) state = addDoubt(state, id, r.doubt)
      if (r.lostLand) {
        state = { ...state, lostLandPool: Math.max(0, state.lostLandPool - r.lostLand) }
      }
      const stalls = r.stalls ?? {}
      const liberated = r.liberated ?? false
      state = {
        ...state,
        regions: {
          ...state.regions,
          [id]: {
            ...state.regions[id],
            stalls: { ...state.regions[id].stalls, ...stalls },
            lostLand: state.regions[id].lostLand + (r.lostLand ?? 0),
            liberated,
            everLiberated: state.regions[id].everLiberated || liberated,
          },
        },
      }
    }
  } else {
    // SPEC 4.3.2: Kingsmarket 2 Outlets/1 Buyout/2 Doubt; every other region 1 Outlet; each Coast +1 Doubt.
    for (const id of config.activeRegions) {
      const def = REGIONS[id]
      if (def.type === 'capital') {
        state = addOutlets(state, id, settings.kingsmarketOutlets)
        state = addBuyout(state, id, 1)
        state = addDoubt(state, id, 2)
      } else {
        state = addOutlets(state, id, 1)
        if (def.type === 'coast') state = addDoubt(state, id, 1)
        if (def.type === 'pasture' && config.difficulty === 'hard') state = addDoubt(state, id, 1)
      }
    }
  }

  // SPEC 8.2 ch3->4 carry-over (see `GameConfig.extraStartingOutlets`): applied on top of whichever setup
  // just ran above, additively, so it never displaces the normal per-region enemy setup.
  if (config.extraStartingOutlets) {
    for (const [id, count] of Object.entries(config.extraStartingOutlets) as [RegionId, number][]) {
      if (count) state = addOutlets(state, id, count)
    }
  }

  // SPEC 8.2 ch6: rift/publicTrust/producer overrides (e.g. Rift starting at 2) apply whether or not a
  // chapter also supplies a fully scripted board of region pieces.
  if (config.scriptedStart) {
    const start = config.scriptedStart
    if (start.rift !== undefined) state = { ...state, rift: start.rift }
    if (start.publicTrust !== undefined) state = { ...state, publicTrust: start.publicTrust }
    for (const [pid, overrides] of Object.entries(start.producers ?? {}) as [
      keyof typeof producers,
      NonNullable<typeof start.producers>[keyof typeof producers],
    ][]) {
      if (!overrides || !state.producers[pid]) continue
      state = {
        ...state,
        producers: {
          ...state.producers,
          [pid]: {
            ...state.producers[pid],
            resources: { ...state.producers[pid].resources, ...overrides.resources },
            production: { ...state.producers[pid].production, ...overrides.production },
          },
        },
      }
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
