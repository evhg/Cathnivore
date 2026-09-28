import { useEffect, useRef, useState } from 'react'
import { applyAction, currentDecision, legalActions } from '../engine/api'
import { resolveRules } from '../engine/rules'
import { createRng } from '../engine/rng'
import { ACTIONS_PER_ROUND } from '../engine/region'
import { PRODUCERS } from '../content/producers'
import { REGIONS, regionMatchesPressureSlot } from '../content/map'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { HeuristicBot } from '../ai/heuristic'
import type { AIWorkerRequest, AIWorkerResponse } from '../ai/aiWorker'
import { saveGame, clearGame } from '../platform/storage'
import { playHapticsFor } from '../platform/haptics'
import { loadSettings, AI_SPEED_DELAY_MS } from '../platform/settings'
import { actionCost, actionLabel, actionGroupKey, actionGroupLabel, actionTermFor, actionTermForKind, regionOf } from './actionLabel'
import { investCost } from '../engine/actions'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { canUndo, popUndo, pushUndo, type UndoEntry } from './undo'
import { enemyTurnEvents, pendingMidSceneTrigger } from './enemyTurnLog'
import EnemyTurnPlayback from './EnemyTurnPlayback'
import LogSheet from './LogSheet'
import FarmSheet from './FarmSheet'
import MarketSheet from './MarketSheet'
import CathsPlanSheet from './CathsPlanSheet'
import RegionMap, { Outlet, Buyout, Doubt, CoopMarkerIcon } from './Map'
import RulesReference from './RulesReference'
import Scene from './Scene'
import Portrait from './portraits/Portrait'
import CathArt from './CathArt'
import CathCompanion from './CathCompanion'
import Tooltip from './Tooltip'
import { CATH_REACTION_EXPRESSION, cathLine, cathLineForRegion, type CathReaction } from '../content/cathCompanionLines'
import type { CathExpression } from '../../shared/cath/cath'
import { WIN_LINE, LOSS_LINE, LOSS_REASON_LABEL } from '../content/endLines'
import {
  ActionsLeftIcon,
  GaugeRing,
  GoodwillIcon,
  LostLandIcon,
  MarksIcon,
  ProduceIcon,
  PublicTrustIcon,
  RiftIcon,
  RoundIcon,
} from './icons/ResourceIcons'
import {
  GraftIcon,
  InvestIcon,
  OpenStallIcon,
  RebutIcon,
  RoleIcon,
  SchemeIcon,
  SellIcon,
  SupplyIcon,
} from './icons/ActionIcons'
import { RegionTypeIcon, romanStage } from './icons/RegionTypeIcon'
import { CandorLogo, HollowellLogo } from './icons/EnemyLogos'
import type { Action, GameEvent, GameState, ProducerId, RegionId, RegionType, ResourceKind } from '../engine/types'
import type { Mode } from './Setup'
import type { TutorialStep } from '../content/chapters'
import type { Scene as SceneData } from '../content/story/types'

interface Props {
  initial: GameState
  seed: number
  mode: Mode
  onExit(): void
  // SPEC 8.1: a campaign chapter's end screen continues into its closing scene (via App.tsx) instead of
  // going straight back to the title, so it takes this callback instead of the plain onExit button. The
  // final `state` is passed too so App.tsx can read carry-over data (e.g. chapter 3's surviving Wholesome
  // Hollow Contracts, SPEC 7) out of it when a chapter ends.
  onChapterEnd?(won: boolean, state: GameState): void
  // SPEC 8.1 tutorial prompts (2 sentences max), shown one at a time above the plan strip. Simplified
  // from the full spec for now: the player advances them manually rather than the engine gating legal
  // actions down to "only the action being taught" — see DECISIONS.md.
  tutorialSteps?: TutorialStep[]
  // SPEC 8.1 "triggers ... scenes": a chapter's mid-game scripted scenes, keyed by `scriptedTrigger.sceneId`
  // (e.g. chapter 3's round-5 Wholesome Hollow reveal). Absent for non-campaign games and chapters with no
  // scripted trigger — see `state.log`'s `{type: 'trigger'}` events, appended by `round.ts`.
  midGameScenes?: Record<string, SceneData>
  // SPEC 8.1/11.3: which campaign chapter this game belongs to, so the autosave records it (see the effect
  // below) — a reload mid-chapter needs this to resume back into the `chapterGame` screen rather than a
  // plain Quick Game that can never call `onChapterEnd`. Absent for Quick Game/hot-seat games.
  chapterId?: string
  // SPEC 8.1/11.3: mid-game scene ids already dismissed in a prior session of this same save (from
  // `SavedGame.dismissedMidScenes`, App.tsx's `resume()`) — seeds `dismissedMidScenes` state so a scene
  // dismissed just before a reload (before any further action) doesn't replay once more on resume (see
  // DECISIONS.md). Absent for a fresh game or an older save.
  initialDismissedMidScenes?: string[]
}

// SPEC 10.2 Game screen. Plain controls for now — see PROGRESS.md M3 for what's still missing (the SVG
// map, sheets, targeting-mode highlighting, enemy-turn step playback). `legalActions` already expands
// every choice into its own concrete Action, so a flat button list is enough to play a full game.
// SPEC 11.4 gate 5's "test driving ... using HeuristicBot choices" and the chapters 2-6 "test-only
// auto-play hook driven by MCTSBot" both need some way for a Playwright test to finish a game without
// hand-writing every click. `?e2eAutoplay=1` makes every producer (not just the Solo AI teammate) act via
// HeuristicBot and skips enemy-turn playback instantly, so a test only has to load the URL and poll for
// `state.result`. Never set by the app itself outside a test — see e2e/quick-game.spec.ts.
function isE2EAutoplay(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eAutoplay') === '1'
}

// Test-only: forces the AI teammate's Worker to throw on its very first decision, so
// e2e/ai-teammate-crash.spec.ts can verify the fallback-to-HeuristicBot path (DECISIONS.md) without
// depending on a real MCTS bug. Never set by the app itself outside a test.
function isE2EAiWorkerCrash(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eAiWorkerCrash') === '1'
}

// ROADMAP 8 "the table, part 1: layout": the action list (see `actionsPanel` below) shows in a different
// place on phone vs desktop, and mounting it unconditionally in both spots (CSS picking which one is
// visible, the way the Farm/Market/Plan/Log `inline` panels split their mobile-modal/desktop-tray copies)
// broke every Playwright locator that queries `.action-item`/`.tooltip-trigger-button` — strict mode counts
// DOM matches regardless of `display: none`, so `e2e/tooltip.spec.ts` started resolving 2 elements for the
// same button. Gating which one actually *mounts* on viewport width avoids that: there is only ever one
// `.actions` in the DOM. Reacts to live resizes (not just the width at first render) since Playwright's
// `setViewportSize` can change the viewport after the page has already mounted.
function useIsDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

// The Cath companion's reaction to one log event (ROADMAP "Cath in Cathnivore, as guide and narrator"),
// ranked so that when a round produces several at once (e.g. a Squeeze and a liberation), the most
// significant wins. `null` for events she has nothing to say about yet.
function cathReactionFor(event: GameEvent): { reaction: CathReaction; rank: number; line: string } | null {
  switch (event.type) {
    case 'liberated':
      return { reaction: 'liberated', rank: 1, line: cathLineForRegion('liberated', event.region) }
    case 'expand':
      // Lowest rank: an Outlet/Buyout/Doubt lands most rounds, so it should never bury a rarer, more
      // significant reaction (a liberation or a Squeeze) that landed in the same round's new events.
      return { reaction: 'expand', rank: 0, line: cathLineForRegion('expand', event.region) }
    case 'squeeze':
      return event.lostLand
        ? { reaction: 'squeezeLostLand', rank: 3, line: cathLineForRegion('squeezeLostLand', event.region) }
        : { reaction: 'squeeze', rank: 2, line: cathLineForRegion('squeeze', event.region) }
    case 'riftSplit':
      return { reaction: 'riftSplit', rank: 4, line: cathLine('riftSplit', event.faction) }
    default:
      return null
  }
}

// A scripted campaign Pressure card (SPEC 8.1) may target regions directly instead of by type.
function pressureLabel(card: GameState['squeeze']): string {
  if (!card) return '—'
  if (card.regionTypes.length > 0) return card.regionTypes.join('+')
  return (card.regions ?? []).map((r) => REGIONS[r].name).join('+') || '—'
}

// STYLE.md 8's Pressure card: "one or two region-type icons." A scripted card (SPEC 8.1) has no
// `regionTypes` of its own, only specific `regions` — derived here via each region's own type, deduped,
// so the icon still shows correctly for both the real Pressure deck and a campaign chapter's scripted
// sequence, the same fallback `pressureLabel` above already uses for its text.
function pressureIconTypes(card: GameState['squeeze']): RegionType[] {
  if (!card) return []
  if (card.regionTypes.length > 0) return card.regionTypes
  const types = (card.regions ?? []).map((r) => REGIONS[r].type)
  return [...new Set(types)]
}

// ROADMAP 10 "illustrated gauges": Public Trust's and Rift's fixed ranges, matching the exact bounds
// `validate()` (engine/api.ts) checks state against — the single source of truth for "full" on each
// gauge, so it can never silently drift from what the rules actually allow.
const TRUST_MAX = 15
const RIFT_MAX = 6

// Lost Land has no fixed range — it's a pool that starts at a difficulty (or campaign-chapter override)
// value and only ever shrinks, so "full" for its gauge is this game's own starting pool, computed the
// exact same way `createGame` (engine/api.ts) does rather than a guessed constant.
function lostLandStartingPool(state: GameState): number {
  return state.config.lostLandPoolOverride ?? DIFFICULTY_SETTINGS[state.config.difficulty].lostLandPool
}

// ROADMAP 10 "the HUD ... tick-up and tick-down animation when they change": returns a counter that only
// increments when `value` actually differs from the previous render, computed synchronously during
// render (no effect/timer needed) — starts at 0 and never moves on the very first render of this
// component instance, so a fresh game screen doesn't flash every stat on load, only a real change later
// ticks it. The caller keys its animated element on this counter, so React remounts it (replaying its
// CSS `animation`) exactly once per genuine change, and gates the animation class itself on `tick > 0`
// so that very first key=0 mount never plays it either.
function useHudTick<T>(value: T): number {
  const prev = useRef(value)
  const tick = useRef(0)
  if (prev.current !== value) {
    tick.current += 1
    prev.current = value
  }
  return tick.current
}

const COST_ICON: Record<ResourceKind, typeof ProduceIcon> = { produce: ProduceIcon, marks: MarksIcon, goodwill: GoodwillIcon }

// ROADMAP 9 "an icon per action" (STYLE.md 5.1): a leading icon inside each action button, before the
// label. `supplyOutlets`/`supplyBuyout` share one icon (both are "Supply," just a different piece
// removed); `decide`/`tearUpContract` have none yet (a forced choice and a rare campaign-only action,
// neither part of the core 7-actions-plus-role set STYLE.md 5.1 documents).
const ACTION_ICON: Partial<Record<Action['kind'], typeof OpenStallIcon>> = {
  openStall: OpenStallIcon,
  supplyOutlets: SupplyIcon,
  supplyBuyout: SupplyIcon,
  rebut: RebutIcon,
  invest: InvestIcon,
  sell: SellIcon,
  scheme: SchemeIcon,
  graft: GraftIcon,
  role: RoleIcon,
}

// ROADMAP 9 "cost chips shown with resource tokens": a small icon+number badge inside an action button,
// next to `actionLabel`'s existing cost-as-text (e.g. "(4 Marks)") — additive, not a replacement, so no
// existing button text changes (several e2e tests match button names by prefix, e.g. `/^Graft:/`).
// `undefined` renders nothing, for the actions `actionCost` already returns no cost for.
function ActionCostChip({ cost }: { cost: { resource: ResourceKind; amount: number } | undefined }) {
  if (!cost) return null
  const Icon = COST_ICON[cost.resource]
  return (
    <span className="action-cost">
      <Icon size={14} />
      {cost.amount}
    </span>
  )
}

// A region-targeting group (e.g. "Supply: remove 2 Outlets…") can cover several regions whose actual
// cost differs (Supply's per-Outlet Produce cost varies by region type and Improvements, SPEC 7) — the
// group button itself doesn't commit to a region yet, so it can only show one number if every entry in
// the group would actually cost the same. Mixed costs fall back to no chip rather than a misleading one.
function uniformGroupCost(
  entries: { index: number }[],
  actions: Action[],
  state: GameState,
): { resource: ResourceKind; amount: number } | undefined {
  const first = actionCost(actions[entries[0]!.index]!, state)
  if (!first) return undefined
  const uniform = entries.every((e) => {
    const c = actionCost(actions[e.index]!, state)
    return c && c.resource === first.resource && c.amount === first.amount
  })
  return uniform ? first : undefined
}

export default function Game({ initial, seed, mode, onExit, onChapterEnd, tutorialSteps, midGameScenes, chapterId, initialDismissedMidScenes }: Props) {
  const [state, setState] = useState(initial)
  // ROADMAP 10's HUD tick animation (see `useHudTick`'s own comment) — called unconditionally here,
  // before any of this component's early returns (pass-device, end screen, tutorial rules), so the Rules
  // of Hooks hold regardless of which branch below actually renders.
  const roundTick = useHudTick(state.round)
  const trustTick = useHudTick(state.publicTrust)
  const lostLandTick = useHudTick(state.lostLandPool)
  const riftTick = useHudTick(state.rift)
  const cathLogSeenRef = useRef(0)
  const [cathReaction, setCathReaction] = useState<{ expression: CathExpression; line: string }>(() => ({
    expression: CATH_REACTION_EXPRESSION.greeting,
    line: cathLine('greeting', String(seed)),
  }))
  const [tutorialIndex, setTutorialIndex] = useState(0)
  const [dismissedMidScenes, setDismissedMidScenes] = useState<string[]>(initialDismissedMidScenes ?? [])
  const aiProducerRef = useRef<ProducerId | null>(mode === 'solo' ? initial.config.producers[1] ?? null : null)
  const autoplayRef = useRef(isE2EAutoplay())
  const isDesktop = useIsDesktopLayout()
  // SPEC 4.6: "a human may undo any action taken in their current turn ... undo never reveals hidden
  // information [because refills happen at cleanup]. Any action that reveals hidden information ... is
  // marked irreversible, and undo cannot go back past it. The AI never undoes." So the stack is cleared
  // whenever the turn changes (activeProducer switches, see `advance()`), and once an irreversible action
  // is taken, its own entry can never be popped (see `undo()`) — later actions in the same turn can still
  // be undone individually, right back down to that point.
  const undoStackRef = useRef<UndoEntry[]>([])
  const rngRef = useRef(createRng(seed + 1))
  // SPEC 9.2's real AI teammate ("MCTSBot running in a Web Worker so the screen never freezes"), created
  // lazily so hotseat/campaign games with no AI producer never spin one up. Terminated on unmount.
  const aiWorkerRef = useRef<Worker | null>(null)
  useEffect(() => {
    return () => {
      aiWorkerRef.current?.terminate()
      aiWorkerRef.current = null
    }
  }, [])
  const [selectedGroup, setSelectedGroup] = useState<{ label: string; entries: { index: number; region: RegionId }[] } | null>(null)
  // SPEC 10.2: "Choosing an action enters targeting mode: legal regions ... glow, everything else dims, a
  // clear Confirm button appears, and Cancel is always visible." Tapping a glowing region used to commit
  // the action immediately; it now only stages a choice (`pendingChoice`), narrowing the glow to that one
  // region, and the action only actually happens on Confirm. Cancel steps back to the full group's glow
  // (or, with nothing pending, drops out of targeting mode entirely).
  const [pendingChoice, setPendingChoice] = useState<{ index: number; region: RegionId } | null>(null)
  // SPEC 10.2: "Tapping [a Squeeze/Expand/Scout card] highlights the matching regions on the map." A
  // second tap on the same card clears the highlight; tapping a different card switches to it.
  const [planHighlightSlot, setPlanHighlightSlot] = useState<'squeeze' | 'expand' | 'scout' | null>(null)
  const [pendingEnemyTurn, setPendingEnemyTurn] = useState<GameEvent[]>([])
  const [showLog, setShowLog] = useState(false)
  const [showFarm, setShowFarm] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [showRulesFromTutorial, setShowRulesFromTutorial] = useState(false)
  // SPEC 9.2: "Each AI action shows a one-line reason in the log." Keyed by the index of the `state.log`
  // entry the reason belongs to (the `{type: 'action'}` entry `applyAction` appends for that decision) —
  // engine state itself never carries this narration, since it's not a rule, so it lives alongside the UI
  // state that already tracks everything else not worth serializing into a save (`pendingChoice`, etc.).
  const [aiReasons, setAiReasons] = useState<Record<number, string>>({})
  // Hot-seat "pass the device" screen (Known issues, PROGRESS.md): the mode-picker already promises
  // "pass the device back and forth," but turns used to switch with only the active-producer header
  // changing, an easy-to-miss cue on a shared screen. `passAckRef` is the producer whose turn the screen
  // is already showing; whenever `state.activeProducer` moves past it (a new turn, or the next round's
  // first player after enemy-turn playback finishes), a blocking screen names the next producer until
  // dismissed. Solo/campaign games have at most one human seat, so this never fires there.
  const passAckRef = useRef<ProducerId>(initial.activeProducer)
  const [passDeviceFor, setPassDeviceFor] = useState<ProducerId | null>(null)

  // The Cath companion (CathCompanion.tsx): react to whatever's newest in the log each time it grows,
  // picking the highest-ranked reaction if a round produced more than one (see `cathReactionFor`).
  useEffect(() => {
    const newEvents = state.log.slice(cathLogSeenRef.current)
    cathLogSeenRef.current = state.log.length
    let best: { reaction: CathReaction; rank: number; line: string } | null = null
    for (const event of newEvents) {
      const candidate = cathReactionFor(event)
      if (candidate && (!best || candidate.rank >= best.rank)) best = candidate
    }
    if (best) setCathReaction({ expression: CATH_REACTION_EXPRESSION[best.reaction], line: best.line })
  }, [state.log])

  useEffect(() => {
    setSelectedGroup(null)
    setPendingChoice(null)
  }, [state])

  useEffect(() => {
    saveGame({ version: 1, config: state.config, seed, actions: state.actionHistory, chapterId, dismissedMidScenes })
  }, [state, seed, chapterId, dismissedMidScenes])

  // SPEC 6/8.1: in Solo mode, the second producer is played by the AI teammate — the real MCTSBot-in-Worker
  // bot below, not a HeuristicBot stand-in (see the effect further down that wires `aiWorker.ts`).
  // Applies an action and, if it ended the round, queues the resulting enemy-turn events for playback
  // (SPEC 10.2) instead of jumping straight to the new state's controls.
  function advance(from: GameState, action: Action, aiReason?: string): void {
    const next = applyAction(from, action)
    // Undo is scoped to "the current turn" (SPEC 4.6) — the moment the active producer changes, whatever
    // was undoable before belongs to a turn that's now over.
    if (next.activeProducer !== from.activeProducer) undoStackRef.current = []
    const events = enemyTurnEvents(from, next)
    playHapticsFor(action, next.log.slice(from.log.length), next.result)
    if (aiReason) {
      // `gameLog.ts`'s `actionCaption` deliberately returns null for invest/scheme/decide's own `{type:
      // 'action'}` entry, deferring to the richer 'invest'/'schemePlayed'/'decision' entry `applyAction`
      // also appends for those three kinds — LogSheet then drops the null-caption entry entirely, so a
      // reason attached to it would never render. Attach to whichever entry actually carries the caption
      // for this decision instead. `refreshAllLiberation` may have inserted 'liberated' entries first, so
      // find by type rather than assuming a fixed offset.
      const captionEventType: GameEvent['type'] =
        action.kind === 'invest' ? 'invest' : action.kind === 'scheme' ? 'schemePlayed' : action.kind === 'decide' ? 'decision' : 'action'
      const addedIndex = next.log.slice(from.log.length).findIndex((e) => e.type === captionEventType)
      if (addedIndex !== -1) {
        const logIndex = from.log.length + addedIndex
        setAiReasons((reasons) => ({ ...reasons, [logIndex]: aiReason }))
      }
    }
    setState(next)
    if (events.length > 0) setPendingEnemyTurn(events)
  }

  // SPEC 8.1/8.2 ch3: a chapter's mid-game scripted scene (e.g. the round-5 Wholesome Hollow reveal) pauses
  // play until dismissed. Autoplay (e2e/the AI teammate) skips straight past it, matching how it already
  // skips the enemy-turn caption playback. See `pendingMidSceneTrigger`'s own comment for why this is
  // derived from the log rather than from `dismissedMidScenes` component state alone (that state resets on
  // every reload, which used to make the scene reappear and re-block play long after it was dismissed).
  const pendingTrigger = midGameScenes ? pendingMidSceneTrigger(state.log, dismissedMidScenes) : undefined
  const pendingMidScene = pendingTrigger && !autoplayRef.current ? midGameScenes![pendingTrigger.sceneId] : undefined

  useEffect(() => {
    if (autoplayRef.current && pendingTrigger) setDismissedMidScenes((d) => [...d, pendingTrigger.sceneId])
  }, [pendingTrigger])

  useEffect(() => {
    if (mode !== 'hotseat' || autoplayRef.current) return
    if (state.result || pendingEnemyTurn.length > 0 || pendingMidScene) return
    if (state.activeProducer !== passAckRef.current) setPassDeviceFor(state.activeProducer)
  }, [mode, state, pendingEnemyTurn.length, pendingMidScene])

  useEffect(() => {
    if (state.result || pendingEnemyTurn.length > 0 || pendingMidScene) return
    const aiProducer = aiProducerRef.current
    const decision = currentDecision(state)
    // SPEC 4.7 Rift 6's two decisions belong to "the players" collectively, not one producer (unlike
    // squeeze/Kingsmarket, which name whose production is affected) — the current turn holder decides.
    const activeProducer = decision && 'producer' in decision ? decision.producer : state.activeProducer
    const aiShouldAct = autoplayRef.current || (aiProducer !== null && activeProducer === aiProducer)
    if (!aiShouldAct) return

    // Autoplay (e2e tests, SPEC 11.4 gate 5's "HeuristicBot choices" driver) always uses the fast,
    // synchronous HeuristicBot for every producer — including the AI teammate's own seat — so a test can
    // finish a whole game in milliseconds rather than waiting on real MCTS decisions.
    if (autoplayRef.current) {
      const timer = setTimeout(() => {
        const [action, nextRng] = HeuristicBot.chooseAction(state, rngRef.current)
        rngRef.current = nextRng
        advance(state, action)
      }, 0)
      return () => clearTimeout(timer)
    }

    // The real Solo AI teammate (SPEC 9.2): MCTSBot in a Web Worker, so its up-to-400ms decision never
    // blocks the UI thread. `cancelled` guards against a stale response landing after the state this
    // decision was made against has already changed (e.g. the player undid something while it was
    // thinking, or the component unmounted).
    let cancelled = false
    let settled = false
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      if (!aiWorkerRef.current) {
        aiWorkerRef.current = new Worker(new URL('../ai/aiWorker.ts', import.meta.url), { type: 'module' })
      }
      const worker = aiWorkerRef.current
      // SPEC 1.3's #1 priority ("games can be finished") over a real MCTS decision every time: if the
      // worker throws (`onerror`) or simply never responds within a watchdog well past its own 400ms
      // budget, fall back to the fast, synchronous HeuristicBot rather than leaving the AI teammate's turn
      // — and the whole game — stuck forever with no visible failure and no recovery path.
      const fallBackToHeuristic = (why: string) => {
        // Unregister this turn's listeners before the early return, matching `onMessage`'s order below —
        // otherwise a turn whose effect gets cancelled (state advanced, e.g. an undo, or unmount) before a
        // late `error` event or a late watchdog fire left its now-stale closures permanently attached to
        // the long-lived worker (a listener leak, one pair per such turn — never a stale action, since the
        // `settled`/`cancelled` guard still blocked `advance()` correctly either way; see DECISIONS.md).
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        clearTimeout(watchdog)
        if (settled || cancelled) return
        settled = true
        aiWorkerRef.current?.terminate()
        aiWorkerRef.current = null
        // SPEC 9.2's "each AI action shows a one-line reason in the log" must still hold on this path —
        // silently substituting HeuristicBot with no trace left this undiagnosable (no console output, no
        // Log sheet indication) and every fallback move looked like a normal, reason-less action.
        console.warn(`AI teammate: ${why}, falling back to HeuristicBot for this decision.`)
        const [action, nextRng] = HeuristicBot.chooseAction(state, rngRef.current)
        rngRef.current = nextRng
        advance(state, action, '(AI worker unavailable — used backup logic)')
      }
      const onMessage = (event: MessageEvent<AIWorkerResponse>) => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        clearTimeout(watchdog)
        if (settled || cancelled) return
        settled = true
        rngRef.current = event.data.rng
        advance(state, event.data.action, event.data.reason)
      }
      const onError = (event: ErrorEvent) => fallBackToHeuristic(`worker error (${event.message || 'unknown'})`)
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      // Well past the bot's own 400ms decision budget (SPEC 9.2) plus the UI's own AI-speed delay, so this
      // only ever fires on a genuine hang, never on a slow-but-alive decision.
      watchdog = setTimeout(() => fallBackToHeuristic('decision timed out'), 3000)
      const request: AIWorkerRequest = { state, rng: rngRef.current, e2eCrash: isE2EAiWorkerCrash() }
      worker.postMessage(request)
    }, AI_SPEED_DELAY_MS[loadSettings().aiSpeed])
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(watchdog)
    }
  }, [state, pendingEnemyTurn.length, pendingMidScene])

  // Skip the (otherwise real-time) enemy-turn caption playback instantly under e2e autoplay.
  useEffect(() => {
    if (autoplayRef.current && pendingEnemyTurn.length > 0) setPendingEnemyTurn([])
  }, [pendingEnemyTurn])

  // SPEC 8.1: "Each new rule is introduced ... with a '?' link to the rules reference." A full early
  // return (rather than an overlay stacked on top of the game's own `<main>`) avoids nesting two
  // `<main>` landmarks and reuses the exact same screen "How to Play" already opens from the title.
  if (showRulesFromTutorial) {
    // SPEC 8.1: land on the term this tutorial step is actually teaching, not just the top of the page.
    // Only an action-kind highlight names a glossary term this way; a region highlight (e.g. "tap this
    // region") has no single matching entry, so it falls back to opening at the top.
    const highlight = tutorialSteps?.[tutorialIndex]?.highlight
    const initialTerm = highlight?.kind === 'action' ? actionTermForKind(highlight.action) : undefined
    return <RulesReference onClose={() => setShowRulesFromTutorial(false)} initialTerm={initialTerm} />
  }

  if (state.result) {
    return (
      <main className="end-screen">
        <CathArt
          className="end-screen-cath"
          framing="bust"
          expression={state.result.won ? 'delighted' : 'worried'}
          animate
          width={96}
          height={96}
          title={state.result.won ? 'Cath, delighted' : 'Cath, undeterred'}
        />
        <h1>{state.result.won ? 'You liberated Marrow.' : 'Not this time.'}</h1>
        <p>
          {state.result.won ? 'Win' : `Loss: ${LOSS_REASON_LABEL[state.result.lossReason!]}`} — {state.result.regionsLiberated} regions
          liberated, round {state.result.round}.
        </p>
        <p className="end-screen-story">
          {state.result.won ? WIN_LINE : LOSS_LINE[state.result.lossReason!]}
        </p>
        <p className="end-screen-stats">
          {state.result.cardsBought} card{state.result.cardsBought === 1 ? '' : 's'} bought,{' '}
          {state.result.schemesPlayed} scheme{state.result.schemesPlayed === 1 ? '' : 's'} played.
        </p>
        {onChapterEnd ? (
          <button
            onClick={() => {
              clearGame()
              onChapterEnd(state.result!.won, state)
            }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={() => {
              clearGame()
              onExit()
            }}
          >
            Back to Title
          </button>
        )}
      </main>
    )
  }

  if (pendingMidScene && pendingTrigger) {
    return <Scene scene={pendingMidScene} onContinue={() => setDismissedMidScenes((d) => [...d, pendingTrigger.sceneId])} />
  }

  if (passDeviceFor) {
    return (
      <main className="scene pass-device">
        <Portrait character={passDeviceFor} size={96} />
        <h2>Pass the device</h2>
        <p>It's {PRODUCERS[passDeviceFor].name}'s turn.</p>
        <button
          onClick={() => {
            passAckRef.current = passDeviceFor
            setPassDeviceFor(null)
          }}
        >
          Continue
        </button>
      </main>
    )
  }

  const rules = resolveRules(state)
  const decision = currentDecision(state)
  const aiProducer = aiProducerRef.current
  const waitingOnAi = decision && 'producer' in decision ? decision.producer === aiProducer : state.activeProducer === aiProducer
  const actions = waitingOnAi || pendingEnemyTurn.length > 0 ? [] : legalActions(state)
  const active = state.producers[state.activeProducer]

  // SPEC 8.1: "the first few steps are guided: only the action being taught is enabled." A step with a
  // highlight gates every action except a forced `decide` (never optional) and the one being taught,
  // either a specific action kind or any action targeting the highlighted region. Autoplay never reaches
  // this render path (it calls `legalActions` directly, see the AI-turn effect above), so it's unaffected.
  // If gating would leave nothing playable (a scripting mistake, or the player already cleared the taught
  // move some other way), fall back to the ungated list rather than stranding the player.
  const tutorialStep = !autoplayRef.current && tutorialSteps && tutorialIndex < tutorialSteps.length ? tutorialSteps[tutorialIndex] : undefined
  // Whether `a` is genuinely the action a highlight names — used both to gate and (separately, see `act`)
  // to decide whether taking `a` should advance the step. A pending `decide` is never a genuine match: it
  // only needs `tutorialAllows` below to bypass the gate so a forced choice is never blocked, not to be
  // mistaken for the taught action itself (a chapter with both a gated step and an unrelated pending
  // decision at once doesn't exist yet, but this keeps the two concerns from silently coupling).
  function matchesHighlight(a: Action): boolean {
    const highlight = tutorialStep?.highlight
    if (!highlight) return false
    return highlight.kind === 'action' ? a.kind === highlight.action : regionOf(a) === highlight.region
  }
  function tutorialAllows(a: Action): boolean {
    return !tutorialStep?.highlight || a.kind === 'decide' || matchesHighlight(a)
  }
  const allIndices = actions.map((_, i) => i)
  const gatedIndices = allIndices.filter((i) => tutorialAllows(actions[i]!))
  const visibleIndices = gatedIndices.length > 0 ? gatedIndices : allIndices

  // SPEC 10.2 targeting mode: group same-action-different-region choices into one button, then let the
  // player tap the glowing region on the map instead of reading N near-identical buttons.
  const standalone: { index: number; action: Action }[] = []
  const groups = new Map<string, { label: string; entries: { index: number; region: RegionId }[] }>()
  visibleIndices.forEach((index) => {
    const a = actions[index]!
    const region = regionOf(a)
    if (region === undefined) {
      standalone.push({ index, action: a })
      return
    }
    const key = actionGroupKey(a)
    const group = groups.get(key) ?? { label: actionGroupLabel(a, state), entries: [] }
    group.entries.push({ index, region })
    groups.set(key, group)
  })

  // ROADMAP 9 "clear disabled and why-not states": Sell's missing counts (Produce too low for 2 or 3)
  // get a disabled placeholder right where the real button would be, so a player learns *why* the full
  // 1-3 range isn't all offered instead of the count quietly shrinking with no explanation. Scoped to
  // Sell only for now, not every action: it's the one whose entire legality is a single resource
  // comparison, so the reason is never ambiguous the way it would be for e.g. Invest (not enough Marks,
  // no affordable card, or the rule not unlocked yet could all look the same from outside) — those stay
  // simply absent, as before, until a later session can give each kind its own real reason. Skipped
  // during a gated tutorial step: SPEC 8.1's "only the action being taught is enabled" already hides
  // everything else outright, and a disabled Sell row competing for attention there would muddy that.
  const sellEntries = standalone.filter((e) => e.action.kind === 'sell')
  const otherStandalone = standalone.filter((e) => e.action.kind !== 'sell' && e.action.kind !== 'invest')
  const investEntries = standalone.filter((e) => e.action.kind === 'invest')
  const disabledSell: { count: 1 | 2 | 3; missing: number }[] = []
  if (rules.sell && !tutorialStep?.highlight) {
    const affordable = Math.min(3, active.resources.produce)
    for (let n = affordable + 1; n <= 3; n++) {
      disabledSell.push({ count: n as 1 | 2 | 3, missing: n - active.resources.produce })
    }
  }

  // ROADMAP 9 why-not, continued: Invest is the other action whose legality is a single resource
  // comparison per card (Marks vs. `investCost`), so — unlike Scheme/Supply/Rebut/Open Stall, whose
  // legality also depends on region/target state — each unaffordable market slot gets its own
  // unambiguous "Need N more Marks" placeholder, the same way each unaffordable Sell count does.
  const disabledInvest: { improvementId: string; cost: number; missing: number }[] = []
  if (rules.improvements && !tutorialStep?.highlight && !waitingOnAi && pendingEnemyTurn.length === 0) {
    for (const id of state.market) {
      if (!id) continue
      if (investEntries.some((e) => e.action.kind === 'invest' && e.action.improvementId === id)) continue
      const card = IMPROVEMENTS_BY_ID.get(id)
      if (!card) continue
      const cost = investCost(state, state.activeProducer, card)
      if (active.resources.marks < cost) disabledInvest.push({ improvementId: id, cost, missing: cost - active.resources.marks })
    }
  }

  // The same per-card "Need N more Marks" reason `disabledInvest` computes for the main action panel,
  // looked up by card id, for the Market sheet's own Buy-button-less cards to explain themselves too.
  const investMissingByCard = new Map(disabledInvest.map((d) => [d.improvementId, d.missing]))
  function missingMarks(improvementId: string): number | undefined {
    return investMissingByCard.get(improvementId)
  }

  function act(actionIndex: number): void {
    const action = actions[actionIndex]!
    // SPEC 8.1: once the taught action is actually taken, move straight to the next tutorial step rather
    // than waiting on a separate "Got it" tap — the gate above already guaranteed this action is the one
    // being taught (or gating had nothing to show, in which case there's nothing to advance past).
    if (matchesHighlight(action)) setTutorialIndex((i) => i + 1)
    undoStackRef.current = pushUndo(undoStackRef.current, state, action)
    advance(state, action)
  }

  function undo(): void {
    const popped = popUndo(undoStackRef.current)
    if (!popped) return
    undoStackRef.current = popped.stack
    setState(popped.state)
  }

  // The Market/Cath's Plan sheets (SPEC 10.2) offer a direct Buy/Play button for a card only when the
  // active human producer currently has a legal action for it, reusing the same `actions` this render
  // already computed rather than re-deriving legality.
  function canBuy(improvementId: string): boolean {
    return standalone.some(({ action: a }) => a.kind === 'invest' && a.improvementId === improvementId)
  }

  function buy(improvementId: string): void {
    const entry = standalone.find(({ action: a }) => a.kind === 'invest' && a.improvementId === improvementId)
    if (entry) {
      act(entry.index)
      setShowMarket(false)
    }
  }

  // A Scheme with no region choice is one standalone action; one needing a region lands in `groups` under
  // `scheme:<id>` — a single legal region there still resolves directly (matching the main action panel's
  // own single-entry-group behaviour), more than one opens the map's targeting mode instead.
  function canPlayScheme(schemeId: string): boolean {
    return (
      groups.has(`scheme:${schemeId}`) ||
      standalone.some(({ action: a }) => a.kind === 'scheme' && a.schemeId === schemeId)
    )
  }

  function playScheme(schemeId: string): void {
    const group = groups.get(`scheme:${schemeId}`)
    if (group) {
      if (group.entries.length === 1) act(group.entries[0]!.index)
      else {
        setPendingChoice(null)
        setSelectedGroup(group)
      }
      setShowPlan(false)
      return
    }
    const entry = standalone.find(({ action: a }) => a.kind === 'scheme' && a.schemeId === schemeId)
    if (entry) {
      act(entry.index)
      setShowPlan(false)
    }
  }

  // ROADMAP 8 "the table, part 1: layout": the action list used to render inside the centre `.game`
  // column, squeezed into an internally-scrolling 3-column grid at the bottom (see DECISIONS.md history).
  // Built once here as a value, not a component, so both places that can show it (the phone flow below and
  // the desktop left tray further down, alongside the Farm panel) read the exact same
  // `standalone`/`groups`/`selectedGroup` closures. `useIsDesktopLayout()` (above) mounts exactly one of the
  // two at a time — not both with CSS hiding one, which left a second `.actions`/`.action-item` permanently
  // in the DOM and broke every Playwright strict-mode locator that queried it (e2e/tooltip.spec.ts).
  const actionsPanel = (
    <section className="actions" tabIndex={0} role="region" aria-label="Actions">
      {pendingEnemyTurn.length > 0 ? null : waitingOnAi ? (
        <p>AI teammate is deciding…</p>
      ) : selectedGroup ? (
        pendingChoice ? (
          <>
            <p>{selectedGroup.label} in {REGIONS[pendingChoice.region].name}?</p>
            <button className="primary" onClick={() => act(pendingChoice.index)}>Confirm</button>
            <button onClick={() => setPendingChoice(null)}>Cancel</button>
          </>
        ) : (
          <>
            <p>{selectedGroup.label}: tap a glowing region on the map.</p>
            <button onClick={() => setSelectedGroup(null)}>Cancel</button>
          </>
        )
      ) : (
        <>
          {sellEntries.map(({ index, action: a }) => {
            const term = actionTermFor(a)
            const Icon = ACTION_ICON[a.kind]
            return (
              <span key={index} className="action-item">
                <button onClick={() => act(index)}>
                  <span className="action-label">
                    {Icon && <Icon size={18} />}
                    {actionLabel(a, state)}
                  </span>
                  <ActionCostChip cost={actionCost(a, state)} />
                </button>
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })}
          {disabledSell.map(({ count, missing }) => (
            <span key={`disabled-sell-${count}`} className="action-item">
              <button disabled title={`Need ${missing} more Produce`}>
                <span className="action-label-group">
                  <span className="action-label">
                    <SellIcon size={18} />
                    {`Sell ${count} Produce for ${count} Marks`}
                  </span>
                  <span className="action-why-not">Need {missing} more Produce</span>
                </span>
                <ActionCostChip cost={{ resource: 'produce', amount: count }} />
              </button>
              <Tooltip term="Sell" label="What is Sell?">
                ?
              </Tooltip>
            </span>
          ))}
          {investEntries.map(({ index, action: a }) => {
            const term = actionTermFor(a)
            const Icon = ACTION_ICON[a.kind]
            return (
              <span key={index} className="action-item">
                <button onClick={() => act(index)}>
                  <span className="action-label">
                    {Icon && <Icon size={18} />}
                    {actionLabel(a, state)}
                  </span>
                  <ActionCostChip cost={actionCost(a, state)} />
                </button>
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })}
          {disabledInvest.map(({ improvementId, cost, missing }) => {
            const card = IMPROVEMENTS_BY_ID.get(improvementId)
            if (!card) return null
            return (
              <span key={`disabled-invest-${improvementId}`} className="action-item">
                <button disabled title={`Need ${missing} more Marks`}>
                  <span className="action-label-group">
                    <span className="action-label">
                      <InvestIcon size={18} />
                      {`Invest: buy ${card.name} (${cost} Marks)`}
                    </span>
                    <span className="action-why-not">Need {missing} more Marks</span>
                  </span>
                  <ActionCostChip cost={{ resource: 'marks', amount: cost }} />
                </button>
                <Tooltip term="Invest" label="What is Invest?">
                  ?
                </Tooltip>
              </span>
            )
          })}
          {otherStandalone.map(({ index, action: a }) => {
            const term = actionTermFor(a)
            const Icon = ACTION_ICON[a.kind]
            return (
              <span key={index} className="action-item">
                <button onClick={() => act(index)}>
                  <span className="action-label">
                    {Icon && <Icon size={18} />}
                    {actionLabel(a, state)}
                  </span>
                  <ActionCostChip cost={actionCost(a, state)} />
                </button>
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })}
          {[...groups.entries()].map(([key, group]) => {
            const single = group.entries.length === 1
            const firstAction = actions[group.entries[0]!.index]!
            const term = actionTermFor(firstAction)
            const cost = single ? actionCost(firstAction, state) : uniformGroupCost(group.entries, actions, state)
            const Icon = ACTION_ICON[firstAction.kind]
            return (
              <span key={key} className="action-item">
                <button onClick={() => (single ? act(group.entries[0]!.index) : setSelectedGroup(group))}>
                  <span className="action-label">
                    {Icon && <Icon size={18} />}
                    {single ? actionLabel(firstAction, state) : `${group.label}…`}
                  </span>
                  <ActionCostChip cost={cost} />
                </button>
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })}
        </>
      )}
    </section>
  )

  // SPEC 10.3 desktop 3-column layout (1024px+): both producers' Farms on the left, the map/plan strip in
  // the centre, actions/Market/Cath's Plan/Log on the right, always visible (no scrolling at 1280x800).
  // `.desktop-*` panels reuse the same sheet components in `inline` mode and are shown only above 1024px
  // via CSS; below that the phone layout's toggle buttons and modal sheets (below) still work unchanged.
  return (
    <div className="game-layout">
      {/* tabIndex so axe's "scrollable-region-focusable" rule is satisfied unconditionally, not just when
          the panel happens to contain a focusable button — the desktop column scrolls (overflow-y: auto,
          SPEC 10.3), and at some game states (nothing affordable yet in Market/Cath's Plan) it can have no
          focusable descendants of its own, which the right column hit at random in this session's
          testing. */}
      <aside className="desktop-col desktop-col-left" tabIndex={0}>
        <FarmSheet state={state} onClose={() => {}} inline />
        {/* ROADMAP 8: the actions tray lives here on desktop, not the right column — Market/Cath's Plan/Log
            already claim nearly all of the right column's height budget on their own (measured directly:
            close to the full 768px at 1280x800), while the Farm panel leaves real headroom. Mounted only
            when `useIsDesktopLayout()` says so, not just hidden by CSS: `actionsPanel` is otherwise mounted
            twice at once (here and in the phone flow below), and Playwright's strict-mode locators count
            DOM matches regardless of `display: none` — e2e/tooltip.spec.ts caught this directly. Wrapped in
            `.sheet-panel` to match the tray it sits alongside. */}
        {isDesktop && (
          <div className="sheet-panel actions-sheet">
            <h2>Actions</h2>
            {actionsPanel}
          </div>
        )}
      </aside>

      <main className="game">
      {/* ROADMAP 8 "the table, part 1: layout": SPEC 10.2's phone "Bottom panel (fixed)" — the active
          producer, actions and Undo/sheet buttons below — must stay visible without scrolling the page to
          reach it (previously all of this just sat at the end of one long scrolling column, so only the
          first action button was ever on-screen without a scroll, a real gap this wrapper closes). Splits
          `.game` into two flex children: this one (everything *about* the current state — topbar, companion,
          plan strip, map) scrolls internally if it doesn't fit; `.action-tray` below (the actual controls)
          keeps its natural size and is always the second, non-scrolling child, so simple flexbox does the
          pinning with no fixed positioning or measured JS height needed. A plain `display: contents` on
          desktop (`@media (max-width: 1023.98px)` below) makes both wrappers a no-op there — every element
          still flows directly in `.game`'s own column exactly as before this session. */}
      <div className="game-scroll">
      <header className="topbar">
        <span>
          <span key={roundTick} className={roundTick > 0 ? 'hud-value hud-tick' : 'hud-value'}>
            <span className="hud-icon-ring">
              <RoundIcon />
              <GaugeRing value={state.round} max={state.round + state.pressureDeck.length} />
            </span>{' '}
            Round {state.round}/{state.round + state.pressureDeck.length}
          </span>
        </span>
        <span>
          <Tooltip term="Public Trust">
            <span key={trustTick} className={trustTick > 0 ? 'hud-value hud-tick' : 'hud-value'}>
              <span className="hud-icon-ring">
                <PublicTrustIcon />
                <GaugeRing value={state.publicTrust} max={TRUST_MAX} />
              </span>{' '}
              Trust {state.publicTrust}
            </span>
          </Tooltip>
        </span>
        <span>
          <Tooltip term="Lost Land">
            <span key={lostLandTick} className={lostLandTick > 0 ? 'hud-value hud-tick' : 'hud-value'}>
              <span className="hud-icon-ring">
                <LostLandIcon />
                <GaugeRing value={state.lostLandPool} max={lostLandStartingPool(state)} />
              </span>{' '}
              Lost Land left {state.lostLandPool}
            </span>
          </Tooltip>
        </span>
        <span>
          <Tooltip term="Rift">
            <span key={riftTick} className={riftTick > 0 ? 'hud-value hud-tick' : 'hud-value'}>
              <span className="hud-icon-ring">
                <RiftIcon />
                <GaugeRing value={state.rift} max={RIFT_MAX} />
              </span>{' '}
              Rift {state.rift}
            </span>
          </Tooltip>
        </span>
        {/* SPEC 10.2: "Top bar (fixed): round x/10, Public Trust, Lost Land remaining, Rift and a menu
            button" — the menu button belongs in the fixed top bar, not the footer, so it stays reachable
            without scrolling past the bottom action panel. */}
        <button onClick={onExit}>Menu</button>
      </header>

      <CathCompanion expression={cathReaction.expression} line={cathReaction.line} />

      {tutorialSteps && tutorialIndex < tutorialSteps.length && (
        <section className="tutorial-prompt">
          <p>
            {/* ROADMAP "tutorial prompts spoken by her": a small face so the line reads as Cath teaching,
                not an anonymous system message. Decorative (the section's own text already says it). */}
            <CathArt className="tutorial-prompt-cath" framing="face" width={22} height={27} />
            {tutorialSteps[tutorialIndex]!.text}{' '}
            {/* SPEC 8.1: "a '?' link to the rules reference," alongside every tutorial prompt, not just
                the ones teaching an action — a step can be explaining Public Trust or the Scout slot with
                nothing to click. */}
            <button type="button" className="tutorial-rules-link" aria-label="Open the rules reference" onClick={() => setShowRulesFromTutorial(true)}>
              ?
            </button>
          </p>
          {/* SPEC 8.1: a step teaching one action/region advances by taking it (see `act`'s auto-advance);
              an informational step (no highlight) has nothing to take, so it still needs a manual tap. */}
          {!tutorialSteps[tutorialIndex]!.highlight && <button onClick={() => setTutorialIndex((i) => i + 1)}>Got it</button>}
        </section>
      )}

      {/* ROADMAP 8: the plan strip and the map legend used to be two separate full-width rows stacked
          above the map — both are compact, low-height content (a handful of short labels), so on desktop,
          where the centre column is far wider than the map itself, they share one row instead. `.plan-strip`
          grows to fill the leftover width; `.map-legend` keeps its own natural size. Phone keeps the original
          two-row stack (`.plan-legend-row` is a plain block there, see global.css) since the narrower column
          has no spare width to share. */}
      <div className="plan-legend-row">
        <section className="plan-strip">
          {(['squeeze', 'expand', 'scout'] as const).map((slot) => {
            const slotLabel = slot === 'squeeze' ? 'Squeeze' : slot === 'expand' ? 'Expand' : 'Scout'
            const card = state[slot]
            return (
              <span key={slot} className="plan-strip-item">
                <button
                  type="button"
                  aria-pressed={planHighlightSlot === slot}
                  className={planHighlightSlot === slot ? 'plan-strip-active' : ''}
                  onClick={() => setPlanHighlightSlot((s) => (s === slot ? null : slot))}
                >
                  {/* ROADMAP 10: the enemy's plan strip becomes agenda-card-like — STYLE.md 8's Agenda
                      cards put "the faction logo top-left"; both corporations act through every slot
                      (SPEC 4.7's Scout/Expand/Squeeze all place or count Hollowell pieces, several also
                      count or add Candor Doubt), so both logos brand every card rather than picking one. */}
                  <span className="plan-strip-card-brand">
                    <HollowellLogo size={12} />
                    <CandorLogo size={12} />
                  </span>
                  {slotLabel}: {pressureLabel(state[slot])}
                  {card && (
                    <span className="plan-strip-card-meta">
                      <span className="plan-strip-stage">{romanStage(card.stage)}</span>
                      {pressureIconTypes(card).map((type) => (
                        <RegionTypeIcon key={type} type={type} size={13} />
                      ))}
                    </span>
                  )}
                </button>
                {/* A separate trigger, not nested inside the button above: that button already has its own
                    tap meaning (toggle the map highlight), so a tooltip needs its own affordance rather than
                    fighting it for the same tap (SPEC 10.5, alongside SPEC 10.2's highlight behaviour). */}
                <Tooltip term={slotLabel} label={`What is ${slotLabel}?`}>
                  ?
                </Tooltip>
              </span>
            )
          })}
        </section>

        {/* SPEC 10.5: the map's own pieces (Outlet/Buyout/Doubt) are the last piece of the tooltip surface —
            a compact key, not one trigger per drawn piece (a region can hold several of the same piece, and
            an in-SVG popover would fight the map's own transforms), same "?"-next-to-the-thing pattern as
            the topbar and plan-strip above. */}
        <section className="map-legend">
          {(
            [
              { term: 'Outlet', icon: <Outlet /> },
              { term: 'Buyout', icon: <Buyout /> },
              { term: 'Doubt', icon: <Doubt /> },
              { term: 'Co-op marker', icon: <CoopMarkerIcon /> },
            ] as const
          ).map(({ term, icon }) => (
            <span key={term} className="map-legend-item">
              <svg className="map-legend-icon" viewBox="0 0 12 14" width={16} height={18} aria-hidden="true">
                {icon}
              </svg>
              <Tooltip term={term}>{term}</Tooltip>
              {term === 'Co-op marker' && (
                <>
                  {' · '}
                  <Tooltip term="Liberated">Liberated</Tooltip>
                </>
              )}
            </span>
          ))}
        </section>
      </div>

      <section className="map-wrap">
        <RegionMap
          state={state}
          highlight={
            selectedGroup
              ? pendingChoice
                ? [pendingChoice.region]
                : selectedGroup.entries.map((e) => e.region)
              : planHighlightSlot
                ? state.config.activeRegions.filter((id) => regionMatchesPressureSlot(state, id, planHighlightSlot))
                : undefined
          }
          onSelect={
            selectedGroup
              ? (region) => {
                  const entry = selectedGroup.entries.find((e) => e.region === region)
                  if (entry) setPendingChoice(entry)
                }
              : undefined
          }
        />
        {pendingEnemyTurn.length > 0 && (
          <EnemyTurnPlayback events={pendingEnemyTurn} onDone={() => setPendingEnemyTurn([])} />
        )}
      </section>
      </div>

      {/* SPEC 10.2's phone "Bottom panel (fixed)": the active producer, its actions and Undo/sheet-toggle
          buttons, always on screen — see the `.game-scroll` comment above for how. */}
      <div className="action-tray">
      {decision ? (
        <section className="decision">
          <p>
            {decision.kind === 'kingsmarketBonus' && `${PRODUCERS[decision.producer].name}: choose a production bonus`}
            {decision.kind === 'squeezeProductionLoss' && `${PRODUCERS[decision.producer].name}: choose which production to lower`}
            {decision.kind === 'riftSplitFaction' && 'Rift 6, The Split: choose which faction to split'}
            {decision.kind === 'riftSplitRemoval' &&
              `Rift 6, The Split: choose where to remove a ${decision.pieceKind === 'doubt' ? 'Doubt' : decision.pieceKind === 'buyout' ? 'Buyout' : 'Outlet'} from (${decision.remaining + 1} left)`}
          </p>
        </section>
      ) : (
        <section className="active-producer">
          <span className="active-producer-header">
            <Portrait character={state.activeProducer} size={48} />
            <strong>{PRODUCERS[state.activeProducer].name}</strong>
          </span>
          <span>
            <Tooltip term="Produce">
              <ProduceIcon /> {active.resources.produce} ({active.production.produce}/round)
            </Tooltip>{' '}
            <Tooltip term="Marks">
              <MarksIcon /> {active.resources.marks} ({active.production.marks}/round)
            </Tooltip>{' '}
            <Tooltip term="Goodwill">
              <GoodwillIcon /> {active.resources.goodwill} ({active.production.goodwill}/round)
            </Tooltip>
          </span>
          <span>
            Actions left: <ActionsLeftIcon total={ACTIONS_PER_ROUND} left={state.actionsLeft} />
          </span>
        </section>
      )}

      {/* Phone copy of `actionsPanel` (defined above), now inside `.action-tray`. Only mounted when
          `useIsDesktopLayout()` says this isn't desktop — see the left tray's copy above for why this is
          gated in JS rather than just hidden by CSS. */}
      {!isDesktop && actionsPanel}

      <footer className="controls">
        <button
          disabled={!canUndo(undoStackRef.current) || pendingEnemyTurn.length > 0 || waitingOnAi}
          onClick={undo}
        >
          Undo
        </button>
        <button className="mobile-only" onClick={() => setShowFarm(true)}>Farm</button>
        {rules.improvements && (
          <button className="mobile-only" onClick={() => setShowMarket(true)}>Market</button>
        )}
        {rules.schemes && (
          <button className="mobile-only" onClick={() => setShowPlan(true)}>Cath&rsquo;s Plan</button>
        )}
        <button className="mobile-only" onClick={() => setShowLog(true)}>Log</button>
      </footer>
      </div>

      {showFarm && <FarmSheet state={state} onClose={() => setShowFarm(false)} />}
      {/* SPEC 8.1: "each new rule is introduced exactly once, at the moment it first matters" — a chapter
          with `improvements`/`schemes` off (e.g. chapters 1-2 have no Market, 1-3 have no Cath's Plan) must
          not let the sheet stay reachable with real card content, even read-only, before its own chapter
          narrates that introduction. */}
      {rules.improvements && showMarket && (
        <MarketSheet state={state} canBuy={canBuy} missingMarks={missingMarks} onBuy={buy} onClose={() => setShowMarket(false)} />
      )}
      {rules.schemes && showPlan && (
        <CathsPlanSheet state={state} canPlay={canPlayScheme} onPlay={playScheme} onClose={() => setShowPlan(false)} />
      )}
      {showLog && <LogSheet log={state.log} aiReasons={aiReasons} onClose={() => setShowLog(false)} />}
      </main>

      <aside className="desktop-col desktop-col-right" tabIndex={0}>
        {rules.improvements && <MarketSheet state={state} canBuy={canBuy} missingMarks={missingMarks} onBuy={buy} onClose={() => {}} inline />}
        {rules.schemes && (
          <CathsPlanSheet state={state} canPlay={canPlayScheme} onPlay={playScheme} onClose={() => {}} inline />
        )}
        <LogSheet log={state.log} aiReasons={aiReasons} onClose={() => {}} inline />
      </aside>
    </div>
  )
}
