import type { RngState } from './rng'

export type RegionId =
  | 'kingsmarket'
  | 'highmoor'
  | 'saltmarsh'
  | 'rivermead'
  | 'shingleBay'
  | 'oakvale'
  | 'brindleHills'

export type RegionType = 'capital' | 'pasture' | 'crop' | 'coast'

export type ProducerId = 'mara' | 'tomas' | 'ines' | 'sol'

export type ResourceKind = 'produce' | 'marks' | 'goodwill'

export interface Resources {
  produce: number
  marks: number
  goodwill: number
}

// Production per Harvest, same shape as Resources.
export type Production = Resources

export interface RegionState {
  id: RegionId
  stalls: Partial<Record<ProducerId, number>>
  outlets: number
  buyouts: number
  doubt: number
  lostLand: number
  liberated: boolean
  everLiberated: boolean
}

export interface ProducerState {
  id: ProducerId
  resources: Resources
  production: Production
  improvements: string[] // Improvement ids owned, in purchase order
  roleUsedThisRound: boolean
}

export type PressureStage = 1 | 2 | 3

export interface PressureCard {
  id: string
  stage: PressureStage
  regionTypes: RegionType[] // one or two region types this card matches
}

export type PressureSlot = 'squeeze' | 'expand' | 'scout'

// Agenda card content (including its effect functions) lives in src/content/agenda.ts, keyed by this id,
// so GameState only ever stores the id — keeping the state plain data and JSON-serializable (SPEC 9.1).
export type AgendaCardId = string

export interface GameConfig {
  producers: ProducerId[] // 1 or 2
  difficulty: 'easy' | 'normal' | 'hard'
  activeRegions: RegionId[] // which regions are in play (full game: all 7)
}

// Improvement/Scheme content (including effect functions) lives in src/content, keyed by these ids.
export type ImprovementCardId = string
export type SchemeCardId = string

export interface GameState {
  config: GameConfig
  rng: RngState
  round: number
  firstPlayer: ProducerId
  activeProducer: ProducerId
  actionsLeft: number
  publicTrust: number
  rift: number
  riftSplitDone: boolean // SPEC 4.7 Rift 6 "The Split" happens once per game
  lostLandPool: number
  outletPool: number
  buyoutPool: number
  doubtPool: number
  regions: Record<RegionId, RegionState>
  producers: Record<ProducerId, ProducerState>
  pressureDeck: PressureCard[]
  pressureDiscard: PressureCard[]
  squeeze: PressureCard | null
  expand: PressureCard | null
  scout: PressureCard | null
  agendaDeck: AgendaCardId[]
  agendaDiscard: AgendaCardId[]
  currentAgenda: AgendaCardId | null
  agendaRemoved: AgendaCardId[] // removed from the deck by Rift 6 "The Split" (SPEC 4.7), kept for accounting
  improvementDeck: ImprovementCardId[]
  improvementDiscard: ImprovementCardId[] // unused (Improvements aren't discarded), kept for symmetry with Schemes
  market: (ImprovementCardId | null)[] // 4 face-up slots; null while empty until cleanup refill
  schemeDeck: SchemeCardId[]
  schemeDiscard: SchemeCardId[]
  cathsPlan: (SchemeCardId | null)[] // 3 face-up slots; null while empty until cleanup refill
  squeezeSkip: RegionId[] // regions whose Squeeze step is skipped this round (Sunlight, Injunction)
  expandSkip: RegionId[] // regions whose Expand step is skipped this round (Injunction)
  log: GameEvent[]
  actionHistory: Action[]
  result: GameResult | null
}

export type GameEvent =
  | { type: 'action'; producer: ProducerId; action: Action }
  | { type: 'liberated'; region: RegionId; producer: ProducerId }
  | { type: 'agenda'; cardId: AgendaCardId; bonusSkipped: boolean }
  | { type: 'squeeze'; region: RegionId; lostLand: boolean; stallRemoved: boolean; trustLoss: number }
  | { type: 'expand'; region: RegionId; piece: 'outlet' | 'buyout' | 'doubt' }
  | { type: 'scout'; region: RegionId; doubtAdded: boolean }
  | { type: 'invest'; producer: ProducerId; improvementId: ImprovementCardId }
  | { type: 'schemePlayed'; producer: ProducerId; schemeId: SchemeCardId; target: RegionId | null }
  | { type: 'riftSplit'; faction: 'hollowell' | 'candor' }

export type Action =
  | { kind: 'openStall'; region: RegionId }
  | { kind: 'supplyOutlets'; region: RegionId; count: 1 | 2 }
  | { kind: 'supplyBuyout'; region: RegionId }
  | { kind: 'rebut'; region: RegionId; count: 1 | 2 }
  | { kind: 'invest'; improvementId: string }
  | { kind: 'sell'; count: 1 | 2 | 3 }
  | { kind: 'scheme'; schemeId: string; targetRegion?: RegionId }
  | { kind: 'graft' }
  | { kind: 'role'; targetRegion?: RegionId }

export type LossReason = 'publicTrust' | 'lostLand' | 'pressureDeckEmpty'

export interface GameResult {
  won: boolean
  lossReason?: LossReason
  regionsLiberated: number
  round: number
}
