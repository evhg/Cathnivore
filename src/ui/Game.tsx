import { useEffect, useRef, useState } from 'react'
import { applyAction, currentDecision, legalActions } from '../engine/api'
import { createRng } from '../engine/rng'
import { PRODUCERS } from '../content/producers'
import { HeuristicBot } from '../ai/heuristic'
import { saveGame, clearGame } from '../platform/storage'
import { actionLabel, actionGroupKey, actionGroupLabel, regionOf } from './actionLabel'
import { enemyTurnEvents } from './enemyTurnLog'
import EnemyTurnPlayback from './EnemyTurnPlayback'
import LogSheet from './LogSheet'
import FarmSheet from './FarmSheet'
import MarketSheet from './MarketSheet'
import CathsPlanSheet from './CathsPlanSheet'
import RegionMap from './Map'
import type { Action, GameEvent, GameState, ProducerId, RegionId } from '../engine/types'
import type { Mode } from './Setup'

interface Props {
  initial: GameState
  seed: number
  mode: Mode
  onExit(): void
}

// SPEC 10.2 Game screen. Plain controls for now — see PROGRESS.md M3 for what's still missing (the SVG
// map, sheets, targeting-mode highlighting, enemy-turn step playback). `legalActions` already expands
// every choice into its own concrete Action, so a flat button list is enough to play a full game.
export default function Game({ initial, seed, mode, onExit }: Props) {
  const [state, setState] = useState(initial)
  const aiProducerRef = useRef<ProducerId | null>(mode === 'solo' ? initial.config.producers[1] ?? null : null)
  const undoStackRef = useRef<GameState[]>([])
  const rngRef = useRef(createRng(seed + 1))
  const [selectedGroup, setSelectedGroup] = useState<{ label: string; entries: { index: number; region: RegionId }[] } | null>(null)
  const [pendingEnemyTurn, setPendingEnemyTurn] = useState<GameEvent[]>([])
  const [showLog, setShowLog] = useState(false)
  const [showFarm, setShowFarm] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const [showPlan, setShowPlan] = useState(false)

  useEffect(() => {
    setSelectedGroup(null)
  }, [state])

  useEffect(() => {
    saveGame({ version: 1, config: state.config, seed, actions: state.actionHistory })
  }, [state, seed])

  // SPEC 6/8.1: in Solo mode, the second producer is played by the AI teammate. A real MCTSBot-in-Worker
  // teammate is future M3/M6 work (see DECISIONS.md); HeuristicBot stands in for now so the loop plays.
  // Applies an action and, if it ended the round, queues the resulting enemy-turn events for playback
  // (SPEC 10.2) instead of jumping straight to the new state's controls.
  function advance(from: GameState, action: Action): void {
    const next = applyAction(from, action)
    const events = enemyTurnEvents(from, next)
    setState(next)
    if (events.length > 0) setPendingEnemyTurn(events)
  }

  useEffect(() => {
    const aiProducer = aiProducerRef.current
    if (!aiProducer || state.result || pendingEnemyTurn.length > 0) return
    const decision = currentDecision(state)
    const aiShouldAct = decision ? decision.producer === aiProducer : state.activeProducer === aiProducer
    if (!aiShouldAct) return
    const timer = setTimeout(() => {
      const [action, nextRng] = HeuristicBot.chooseAction(state, rngRef.current)
      rngRef.current = nextRng
      advance(state, action)
    }, 150)
    return () => clearTimeout(timer)
  }, [state, pendingEnemyTurn.length])

  if (state.result) {
    return (
      <main className="end-screen">
        <h1>{state.result.won ? 'You liberated Marrow.' : 'Not this time.'}</h1>
        <p>
          {state.result.won ? 'Win' : `Loss: ${state.result.lossReason}`} — {state.result.regionsLiberated} regions
          liberated, round {state.result.round}.
        </p>
        <button
          onClick={() => {
            clearGame()
            onExit()
          }}
        >
          Back to Title
        </button>
      </main>
    )
  }

  const decision = currentDecision(state)
  const aiProducer = aiProducerRef.current
  const waitingOnAi = decision ? decision.producer === aiProducer : state.activeProducer === aiProducer
  const actions = waitingOnAi || pendingEnemyTurn.length > 0 ? [] : legalActions(state)
  const active = state.producers[state.activeProducer]

  // SPEC 10.2 targeting mode: group same-action-different-region choices into one button, then let the
  // player tap the glowing region on the map instead of reading N near-identical buttons.
  const standalone: { index: number; action: Action }[] = []
  const groups = new Map<string, { label: string; entries: { index: number; region: RegionId }[] }>()
  actions.forEach((a, index) => {
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
    undoStackRef.current.push(state)
    advance(state, actions[actionIndex]!)
  }

  function undo(): void {
    const previous = undoStackRef.current.pop()
    if (previous) setState(previous)
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
      else setSelectedGroup(group)
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
      <aside className="desktop-col desktop-col-left">
        <FarmSheet state={state} onClose={() => {}} inline />
      </aside>

      <main className="game">
      <header className="topbar">
        <span>Round {state.round}/10</span>
        <span>Trust {state.publicTrust}</span>
        <span>Lost Land left {state.lostLandPool}</span>
        <span>Rift {state.rift}</span>
      </header>

      <section className="plan-strip">
        <span>Squeeze: {state.squeeze?.regionTypes.join('+') ?? '—'}</span>
        <span>Expand: {state.expand?.regionTypes.join('+') ?? '—'}</span>
        <span>Scout: {state.scout?.regionTypes.join('+') ?? '—'}</span>
      </section>

      <section className="map-wrap">
        <RegionMap
          state={state}
          highlight={selectedGroup?.entries.map((e) => e.region)}
          onSelect={
            selectedGroup
              ? (region) => {
                  const entry = selectedGroup.entries.find((e) => e.region === region)
                  if (entry) act(entry.index)
                }
              : undefined
          }
        />
        {pendingEnemyTurn.length > 0 && (
          <EnemyTurnPlayback events={pendingEnemyTurn} onDone={() => setPendingEnemyTurn([])} />
        )}
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
            Produce {active.resources.produce} ({active.production.produce}/round), Marks {active.resources.marks} (
            {active.production.marks}/round), Goodwill {active.resources.goodwill} ({active.production.goodwill}/round)
          </span>
          <span>Actions left: {state.actionsLeft}</span>
        </section>
      )}

      <section className="actions">
        {pendingEnemyTurn.length > 0 ? null : waitingOnAi ? (
          <p>AI teammate is deciding…</p>
        ) : selectedGroup ? (
          <>
            <p>{selectedGroup.label}: tap a glowing region on the map.</p>
            <button onClick={() => setSelectedGroup(null)}>Cancel</button>
          </>
        ) : (
          <>
            {standalone.map(({ index, action: a }) => (
              <button key={index} onClick={() => act(index)}>
                {actionLabel(a, state)}
              </button>
            ))}
            {[...groups.entries()].map(([key, group]) =>
              group.entries.length === 1 ? (
                <button key={key} onClick={() => act(group.entries[0]!.index)}>
                  {actionLabel(actions[group.entries[0]!.index]!, state)}
                </button>
              ) : (
                <button key={key} onClick={() => setSelectedGroup(group)}>
                  {group.label}…
                </button>
              ),
            )}
          </>
        )}
      </section>

      <footer className="controls">
        <button disabled={undoStackRef.current.length === 0 || pendingEnemyTurn.length > 0} onClick={undo}>
          Undo
        </button>
        <button className="mobile-only" onClick={() => setShowFarm(true)}>Farm</button>
        <button className="mobile-only" onClick={() => setShowMarket(true)}>Market</button>
        <button className="mobile-only" onClick={() => setShowPlan(true)}>Cath&rsquo;s Plan</button>
        <button className="mobile-only" onClick={() => setShowLog(true)}>Log</button>
        <button onClick={onExit}>Menu</button>
      </footer>

      {showFarm && <FarmSheet state={state} onClose={() => setShowFarm(false)} />}
      {showMarket && <MarketSheet state={state} canBuy={canBuy} onBuy={buy} onClose={() => setShowMarket(false)} />}
      {showPlan && (
        <CathsPlanSheet state={state} canPlay={canPlayScheme} onPlay={playScheme} onClose={() => setShowPlan(false)} />
      )}
      {showLog && <LogSheet log={state.log} onClose={() => setShowLog(false)} />}
      </main>

      <aside className="desktop-col desktop-col-right">
        <MarketSheet state={state} canBuy={canBuy} onBuy={buy} onClose={() => {}} inline />
        <CathsPlanSheet state={state} canPlay={canPlayScheme} onPlay={playScheme} onClose={() => {}} inline />
        <LogSheet log={state.log} onClose={() => {}} inline />
      </aside>
    </div>
  )
}
