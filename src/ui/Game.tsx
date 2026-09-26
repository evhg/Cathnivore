import { useEffect, useRef, useState } from 'react'
import { applyAction, currentDecision, legalActions } from '../engine/api'
import { createRng } from '../engine/rng'
import { PRODUCERS } from '../content/producers'
import { REGIONS, regionMatchesPressureSlot } from '../content/map'
import { HeuristicBot } from '../ai/heuristic'
import type { AIWorkerRequest, AIWorkerResponse } from '../ai/aiWorker'
import { saveGame, clearGame } from '../platform/storage'
import { playHapticsFor } from '../platform/haptics'
import { loadSettings, AI_SPEED_DELAY_MS } from '../platform/settings'
import { actionLabel, actionGroupKey, actionGroupLabel, actionTermFor, regionOf } from './actionLabel'
import { isIrreversible } from './undo'
import { enemyTurnEvents } from './enemyTurnLog'
import EnemyTurnPlayback from './EnemyTurnPlayback'
import LogSheet from './LogSheet'
import FarmSheet from './FarmSheet'
import MarketSheet from './MarketSheet'
import CathsPlanSheet from './CathsPlanSheet'
import RegionMap, { Outlet, Buyout, Doubt } from './Map'
import RulesReference from './RulesReference'
import Scene from './Scene'
import Tooltip from './Tooltip'
import { WIN_LINE, LOSS_LINE } from '../content/endLines'
import {
  ActionsLeftIcon,
  GoodwillIcon,
  LostLandIcon,
  MarksIcon,
  ProduceIcon,
  PublicTrustIcon,
  RiftIcon,
  RoundIcon,
} from './icons/ResourceIcons'
import type { Action, GameEvent, GameState, ProducerId, RegionId } from '../engine/types'
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

// A scripted campaign Pressure card (SPEC 8.1) may target regions directly instead of by type.
function pressureLabel(card: GameState['squeeze']): string {
  if (!card) return '—'
  if (card.regionTypes.length > 0) return card.regionTypes.join('+')
  return (card.regions ?? []).map((r) => REGIONS[r].name).join('+') || '—'
}

export default function Game({ initial, seed, mode, onExit, onChapterEnd, tutorialSteps, midGameScenes }: Props) {
  const [state, setState] = useState(initial)
  const [tutorialIndex, setTutorialIndex] = useState(0)
  const [dismissedMidScenes, setDismissedMidScenes] = useState<string[]>([])
  const aiProducerRef = useRef<ProducerId | null>(mode === 'solo' ? initial.config.producers[1] ?? null : null)
  const autoplayRef = useRef(isE2EAutoplay())
  // SPEC 4.6: "a human may undo any action taken in their current turn ... undo never reveals hidden
  // information [because refills happen at cleanup]. Any action that reveals hidden information ... is
  // marked irreversible, and undo cannot go back past it. The AI never undoes." So the stack is cleared
  // whenever the turn changes (activeProducer switches, see `advance()`), and once an irreversible action
  // is taken, its own entry can never be popped (see `undo()`) — later actions in the same turn can still
  // be undone individually, right back down to that point.
  const undoStackRef = useRef<{ state: GameState; irreversible: boolean }[]>([])
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

  useEffect(() => {
    setSelectedGroup(null)
    setPendingChoice(null)
  }, [state])

  useEffect(() => {
    saveGame({ version: 1, config: state.config, seed, actions: state.actionHistory })
  }, [state, seed])

  // SPEC 6/8.1: in Solo mode, the second producer is played by the AI teammate — the real MCTSBot-in-Worker
  // bot below, not a HeuristicBot stand-in (see the effect further down that wires `aiWorker.ts`).
  // Applies an action and, if it ended the round, queues the resulting enemy-turn events for playback
  // (SPEC 10.2) instead of jumping straight to the new state's controls.
  function advance(from: GameState, action: Action): void {
    const next = applyAction(from, action)
    // Undo is scoped to "the current turn" (SPEC 4.6) — the moment the active producer changes, whatever
    // was undoable before belongs to a turn that's now over.
    if (next.activeProducer !== from.activeProducer) undoStackRef.current = []
    const events = enemyTurnEvents(from, next)
    playHapticsFor(action, next.log.slice(from.log.length), next.result)
    setState(next)
    if (events.length > 0) setPendingEnemyTurn(events)
  }

  // SPEC 8.1/8.2 ch3: a chapter's mid-game scripted scene (e.g. the round-5 Wholesome Hollow reveal) pauses
  // play until dismissed — found via `state.log`'s `{type: 'trigger'}` events, which `round.ts` appends the
  // moment the chapter's `scriptedTrigger.round` is reached. Autoplay (e2e/the AI teammate) skips straight
  // past it, matching how it already skips the enemy-turn caption playback.
  const pendingTrigger = midGameScenes
    ? (state.log.find((e) => e.type === 'trigger' && !dismissedMidScenes.includes(e.sceneId)) as
        | Extract<GameEvent, { type: 'trigger' }>
        | undefined)
    : undefined
  const pendingMidScene = pendingTrigger && !autoplayRef.current ? midGameScenes![pendingTrigger.sceneId] : undefined

  useEffect(() => {
    if (autoplayRef.current && pendingTrigger) setDismissedMidScenes((d) => [...d, pendingTrigger.sceneId])
  }, [pendingTrigger])

  useEffect(() => {
    if (state.result || pendingEnemyTurn.length > 0 || pendingMidScene) return
    const aiProducer = aiProducerRef.current
    const decision = currentDecision(state)
    const activeProducer = decision ? decision.producer : state.activeProducer
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
    const timer = setTimeout(() => {
      if (!aiWorkerRef.current) {
        aiWorkerRef.current = new Worker(new URL('../ai/aiWorker.ts', import.meta.url), { type: 'module' })
      }
      const worker = aiWorkerRef.current
      const onMessage = (event: MessageEvent<AIWorkerResponse>) => {
        worker.removeEventListener('message', onMessage)
        if (cancelled) return
        rngRef.current = event.data.rng
        advance(state, event.data.action)
      }
      worker.addEventListener('message', onMessage)
      const request: AIWorkerRequest = { state, rng: rngRef.current }
      worker.postMessage(request)
    }, AI_SPEED_DELAY_MS[loadSettings().aiSpeed])
    return () => {
      cancelled = true
      clearTimeout(timer)
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
    return <RulesReference onClose={() => setShowRulesFromTutorial(false)} />
  }

  if (state.result) {
    return (
      <main className="end-screen">
        <h1>{state.result.won ? 'You liberated Marrow.' : 'Not this time.'}</h1>
        <p>
          {state.result.won ? 'Win' : `Loss: ${state.result.lossReason}`} — {state.result.regionsLiberated} regions
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

  const decision = currentDecision(state)
  const aiProducer = aiProducerRef.current
  const waitingOnAi = decision ? decision.producer === aiProducer : state.activeProducer === aiProducer
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

  function act(actionIndex: number): void {
    const action = actions[actionIndex]!
    // SPEC 8.1: once the taught action is actually taken, move straight to the next tutorial step rather
    // than waiting on a separate "Got it" tap — the gate above already guaranteed this action is the one
    // being taught (or gating had nothing to show, in which case there's nothing to advance past).
    if (matchesHighlight(action)) setTutorialIndex((i) => i + 1)
    undoStackRef.current.push({ state, irreversible: isIrreversible(action) })
    advance(state, action)
  }

  function undo(): void {
    const top = undoStackRef.current[undoStackRef.current.length - 1]
    if (!top || top.irreversible) return
    undoStackRef.current.pop()
    setState(top.state)
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

  // SPEC 10.3 desktop 3-column layout (1024px+): both producers' Farms on the left, the map/plan strip in
  // the centre, Market/Cath's Plan/Log on the right, always visible (no scrolling at 1280x800). `.desktop-*`
  // panels reuse the same sheet components in `inline` mode and are shown only above 1024px via CSS; below
  // that the phone layout's toggle buttons and modal sheets (below) still work unchanged.
  return (
    <div className="game-layout">
      {/* tabIndex so axe's "scrollable-region-focusable" rule is satisfied unconditionally, not just when
          the panel happens to contain a focusable button — the desktop column scrolls (overflow-y: auto,
          SPEC 10.3), and at some game states (nothing affordable yet in Market/Cath's Plan) it can have no
          focusable descendants of its own, which the right column hit at random in this session's
          testing. */}
      <aside className="desktop-col desktop-col-left" tabIndex={0}>
        <FarmSheet state={state} onClose={() => {}} inline />
      </aside>

      <main className="game">
      <header className="topbar">
        <span>
          <RoundIcon /> Round {state.round}/10
        </span>
        <span>
          <Tooltip term="Public Trust">
            <PublicTrustIcon /> Trust {state.publicTrust}
          </Tooltip>
        </span>
        <span>
          <Tooltip term="Lost Land">
            <LostLandIcon /> Lost Land left {state.lostLandPool}
          </Tooltip>
        </span>
        <span>
          <Tooltip term="Rift">
            <RiftIcon /> Rift {state.rift}
          </Tooltip>
        </span>
        {/* SPEC 10.2: "Top bar (fixed): round x/10, Public Trust, Lost Land remaining, Rift and a menu
            button" — the menu button belongs in the fixed top bar, not the footer, so it stays reachable
            without scrolling past the bottom action panel. */}
        <button onClick={onExit}>Menu</button>
      </header>

      {tutorialSteps && tutorialIndex < tutorialSteps.length && (
        <section className="tutorial-prompt">
          <p>
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

      <section className="plan-strip">
        {(['squeeze', 'expand', 'scout'] as const).map((slot) => {
          const slotLabel = slot === 'squeeze' ? 'Squeeze' : slot === 'expand' ? 'Expand' : 'Scout'
          return (
            <span key={slot} className="plan-strip-item">
              <button
                type="button"
                aria-pressed={planHighlightSlot === slot}
                className={planHighlightSlot === slot ? 'plan-strip-active' : ''}
                onClick={() => setPlanHighlightSlot((s) => (s === slot ? null : slot))}
              >
                {slotLabel}: {pressureLabel(state[slot])}
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
          ] as const
        ).map(({ term, icon }) => (
          <span key={term} className="map-legend-item">
            <svg viewBox="0 0 12 14" width={16} height={18} aria-hidden="true">
              {icon}
            </svg>
            <Tooltip term={term}>{term}</Tooltip>
          </span>
        ))}
      </section>

      {decision ? (
        <section className="decision">
          <p>
            {PRODUCERS[decision.producer].name}: {decision.kind === 'kingsmarketBonus' ? 'choose a production bonus' : 'choose which production to lower'}
          </p>
        </section>
      ) : (
        <section className="active-producer">
          <strong>{PRODUCERS[state.activeProducer].name}</strong>
          <span>
            <ProduceIcon /> {active.resources.produce} ({active.production.produce}/round) <MarksIcon />{' '}
            {active.resources.marks} ({active.production.marks}/round) <GoodwillIcon /> {active.resources.goodwill} (
            {active.production.goodwill}/round)
          </span>
          <span>
            Actions left: <ActionsLeftIcon total={3} left={state.actionsLeft} />
          </span>
        </section>
      )}

      <section className="actions">
        {pendingEnemyTurn.length > 0 ? null : waitingOnAi ? (
          <p>AI teammate is deciding…</p>
        ) : selectedGroup ? (
          pendingChoice ? (
            <>
              <p>{selectedGroup.label} in {REGIONS[pendingChoice.region].name}?</p>
              <button onClick={() => act(pendingChoice.index)}>Confirm</button>
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
            {standalone.map(({ index, action: a }) => {
              const term = actionTermFor(a)
              return (
                <span key={index} className="action-item">
                  <button onClick={() => act(index)}>{actionLabel(a, state)}</button>
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
              return (
                <span key={key} className="action-item">
                  <button onClick={() => (single ? act(group.entries[0]!.index) : setSelectedGroup(group))}>
                    {single ? actionLabel(firstAction, state) : `${group.label}…`}
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

      <footer className="controls">
        <button
          disabled={
            undoStackRef.current.length === 0 ||
            undoStackRef.current[undoStackRef.current.length - 1]!.irreversible ||
            pendingEnemyTurn.length > 0 ||
            waitingOnAi
          }
          onClick={undo}
        >
          Undo
        </button>
        <button className="mobile-only" onClick={() => setShowFarm(true)}>Farm</button>
        <button className="mobile-only" onClick={() => setShowMarket(true)}>Market</button>
        <button className="mobile-only" onClick={() => setShowPlan(true)}>Cath&rsquo;s Plan</button>
        <button className="mobile-only" onClick={() => setShowLog(true)}>Log</button>
      </footer>

      {showFarm && <FarmSheet state={state} onClose={() => setShowFarm(false)} />}
      {showMarket && <MarketSheet state={state} canBuy={canBuy} onBuy={buy} onClose={() => setShowMarket(false)} />}
      {showPlan && (
        <CathsPlanSheet state={state} canPlay={canPlayScheme} onPlay={playScheme} onClose={() => setShowPlan(false)} />
      )}
      {showLog && <LogSheet log={state.log} onClose={() => setShowLog(false)} />}
      </main>

      <aside className="desktop-col desktop-col-right" tabIndex={0}>
        <MarketSheet state={state} canBuy={canBuy} onBuy={buy} onClose={() => {}} inline />
        <CathsPlanSheet state={state} canPlay={canPlayScheme} onPlay={playScheme} onClose={() => {}} inline />
        <LogSheet log={state.log} onClose={() => {}} inline />
      </aside>
    </div>
  )
}
