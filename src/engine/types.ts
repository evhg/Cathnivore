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
  // SPEC 8.1 "a scripted Pressure sequence where needed": a campaign chapter can target specific regions
  // directly instead of by type (e.g. chapter 1 introduces Brindle Hills and Highmoor one at a time,
  // even though both are Pasture). Absent for the real Pressure deck, which always matches by type.
  regions?: RegionId[]
}

export type PressureSlot = 'squeeze' | 'expand' | 'scout'

// Agenda card content (including its effect functions) lives in src/content/agenda.ts, keyed by this id,
// so GameState only ever stores the id — keeping the state plain data and JSON-serializable (SPEC 9.1).
export type AgendaCardId = string

// SPEC 8.1: campaign chapters switch individual rules on/off (e.g. chapter 1 has only Harvest, Open
// Stall, Supply and Graft, with an enemy that only Scouts). Missing when absent from GameConfig — see
// `src/engine/rules.ts`'s `DEFAULT_RULES`/`resolveRules`, which the full game (and every non-campaign
// config) relies on implicitly.
export interface RulesEnabled {
  agenda: boolean
  squeeze: boolean
  expand: boolean
  rebut: boolean
  sell: boolean
  improvements: boolean
  schemes: boolean
  roles: boolean
}

export interface GameConfig {
  producers: ProducerId[] // 1 or 2
  difficulty: 'easy' | 'normal' | 'hard'
  activeRegions: RegionId[] // which regions are in play (full game: all 7)
  rulesEnabled?: RulesEnabled // SPEC 8.1; absent means the full game (see `resolveRules`)
  scriptedPressure?: PressureCard[] // SPEC 8.1 "a scripted Pressure sequence where needed" (campaign only)
  // SPEC 8.2's chapters each have their own liberation goal (e.g. chapter 1: "liberate both regions
  // within 6 rounds"). Absent means the full game's SPEC 4.8 win (5 regions, one of which is Kingsmarket).
  // A chapter's round limit is expressed by giving `scriptedPressure` exactly that many cards, so running
  // out of the deck (the engine's existing `pressureDeckEmpty` loss) doubles as "ran out of rounds."
  winCondition?: { regionsRequired: number; requireKingsmarket: boolean }
  // SPEC 8.2 ch3: the Market starts with these ids face up (in slot order) instead of the usual shuffled
  // draw — chapter 3 seeds 3 copies of the campaign-only "Wholesome Hollow Contract". Remaining slots
  // still fill from the normal shuffled Improvement deck. Absent means the ordinary all-random market.
  scriptedMarket?: ImprovementCardId[]
  // SPEC 8.1 "triggers (round start ...)" / SPEC 8.2 ch3's twist: at the start of `round`, `effect` is
  // applied once (see `round.ts`'s `applyScriptedTrigger`) and a `{type: 'trigger'}` event is logged so
  // the UI can show `sceneId`'s scene. Only one kind of effect exists so far — extend the union, not the
  // shape, if a later chapter needs a different one.
  scriptedTrigger?: { round: number; effect: 'wholesomeHollowReveal'; sceneId: string }
  // A campaign chapter's single lone producer faces far more enemy turns per region than the tuned
  // 2-producer/7-region full game's `DIFFICULTY_SETTINGS.lostLandPool` was balanced for (a chapter runs
  // considerably longer than the full game's 10-round cap). Overrides that pool size for this game only;
  // absent means the ordinary difficulty-table value.
  lostLandPoolOverride?: number
  // SPEC 8.2 ch5: "the chapter starts from a pre-built mid-game position." Replaces the normal SPEC 4.3.2
  // per-region setup (Kingsmarket 2 Outlets/1 Buyout/2 Doubt, everyone else 1 Outlet, +1 Doubt on Coast)
  // and the normal 2-Stalls-at-home placement with an explicit board: which regions already have which
  // enemy pieces and Stalls, which are already liberated, and each producer's starting resources and
  // production. Applied once in `createGame`, after the deck-building/Scout-reveal steps still run
  // normally against this board. Absent means the ordinary fresh SPEC 4.3 setup.
  scriptedStart?: {
    rift?: number
    publicTrust?: number
    regions?: Partial<
      Record<
        RegionId,
        {
          outlets?: number
          buyouts?: number
          doubt?: number
          lostLand?: number
          stalls?: Partial<Record<ProducerId, number>>
          liberated?: boolean
        }
      >
    >
    producers?: Partial<
      Record<ProducerId, { resources?: Partial<Record<ResourceKind, number>>; production?: Partial<Record<ResourceKind, number>> }>
    >
  }
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
  pendingDecisions: PendingDecision[] // forced choices (SPEC 9.1 currentDecision); a default is already applied, see actions.ts
  // SPEC 8.2 ch3: true once the "Wholesome Hollow Contract" ownership twist has fired (`scriptedTrigger`).
  // From then on, each owned contract adds 1 Outlet to its owner's home region at the start of every round
  // (SPEC 7), until torn up (`tearUpContract` action).
  wholesomeHollowRevealed: boolean
  // Contracts removed by `tearUpContract` leave the game entirely (unlike a Scheme's discard pile), so
  // `validate()`'s improvement-total invariant needs this count to still add up.
  contractsTornUp: number
  log: GameEvent[]
  actionHistory: Action[]
  result: GameResult | null
}

// SPEC 9.1: `currentDecision(state)` — forced choices with legal options, so humans and the AI use the
// same path. The engine applies a default immediately (so unrelated state stays consistent) and records
// it here; resolving with a `decide` action either confirms the default or swaps it for another option.
export type PendingDecision =
  | {
      id: string
      kind: 'squeezeProductionLoss' // SPEC 4.7 Squeeze: a home region takes damage, its producer lowers one track by 1
      producer: ProducerId
      region: RegionId
      options: ResourceKind[]
      applied: ResourceKind
    }
  | {
      id: string
      kind: 'kingsmarketBonus' // SPEC 4.8: first-liberating Kingsmarket lets its producer choose which production to raise
      producer: ProducerId
      options: ResourceKind[]
      applied: ResourceKind
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
  | { type: 'decision'; decisionId: string; choice: ResourceKind }
  | { type: 'trigger'; effect: string; sceneId: string }

export type Action =
  | { kind: 'openStall'; region: RegionId }
  | { kind: 'supplyOutlets'; region: RegionId; count: 1 | 2 }
  | { kind: 'supplyBuyout'; region: RegionId }
  | { kind: 'rebut'; region: RegionId; count: 1 | 2 }
  | { kind: 'invest'; improvementId: string }
  | { kind: 'sell'; count: 1 | 2 | 3 }
  | { kind: 'scheme'; schemeId: string; targetRegion?: RegionId }
  | { kind: 'graft' }
  | { kind: 'role'; targetRegion?: RegionId; choice?: 'trust' | 'goodwill' }
  | { kind: 'decide'; decisionId: string; choice: ResourceKind }
  // SPEC 7 campaign-only carry-over rule: pay 3 Marks to remove one owned "Wholesome Hollow Contract"
  // and its +2 Marks production, once `wholesomeHollowRevealed` is true.
  | { kind: 'tearUpContract' }

export type LossReason = 'publicTrust' | 'lostLand' | 'pressureDeckEmpty'

export interface GameResult {
  won: boolean
  lossReason?: LossReason
  regionsLiberated: number
  round: number
}
