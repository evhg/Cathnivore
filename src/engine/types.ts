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

export interface GameConfig {
  producers: ProducerId[] // 1 or 2
  difficulty: 'easy' | 'normal' | 'hard'
  activeRegions: RegionId[] // which regions are in play (full game: all 7)
}

export interface GameState {
  config: GameConfig
  rng: RngState
  round: number
  firstPlayer: ProducerId
  activeProducer: ProducerId
  actionsLeft: number
  publicTrust: number
  rift: number
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
  log: GameEvent[]
  actionHistory: Action[]
  result: GameResult | null
}

export type GameEvent =
  | { type: 'action'; producer: ProducerId; action: Action }
  | { type: 'liberated'; region: RegionId; producer: ProducerId }
  | { type: 'squeeze'; region: RegionId; lostLand: boolean; stallRemoved: boolean; trustLoss: number }
  | { type: 'expand'; region: RegionId; piece: 'outlet' | 'buyout' | 'doubt' }
  | { type: 'scout'; region: RegionId; doubtAdded: boolean }

export type Action =
  | { kind: 'openStall'; region: RegionId }
  | { kind: 'supplyOutlets'; region: RegionId; count: 1 | 2 }
  | { kind: 'supplyBuyout'; region: RegionId }
  | { kind: 'rebut'; region: RegionId; count: 1 | 2 }
  | { kind: 'invest'; improvementId: string }
  | { kind: 'sell'; count: 1 | 2 | 3 }
  | { kind: 'scheme'; schemeId: string }
  | { kind: 'graft' }
  | { kind: 'role' }

export type LossReason = 'publicTrust' | 'lostLand' | 'pressureDeckEmpty'

export interface GameResult {
  won: boolean
  lossReason?: LossReason
  regionsLiberated: number
  round: number
}
