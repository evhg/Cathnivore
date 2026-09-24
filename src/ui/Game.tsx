import { useEffect, useRef, useState } from 'react'
import { applyAction, currentDecision, legalActions } from '../engine/api'
import { createRng } from '../engine/rng'
import { PRODUCERS } from '../content/producers'
import { HeuristicBot } from '../ai/heuristic'
import { saveGame, clearGame } from '../platform/storage'
import { actionLabel } from './actionLabel'
import Map from './Map'
import type { GameState, ProducerId } from '../engine/types'
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

  useEffect(() => {
    saveGame({ version: 1, config: state.config, seed, actions: state.actionHistory })
  }, [state, seed])

  // SPEC 6/8.1: in Solo mode, the second producer is played by the AI teammate. A real MCTSBot-in-Worker
  // teammate is future M3/M6 work (see DECISIONS.md); HeuristicBot stands in for now so the loop plays.
  useEffect(() => {
    const aiProducer = aiProducerRef.current
    if (!aiProducer || state.result) return
    const decision = currentDecision(state)
    const aiShouldAct = decision ? decision.producer === aiProducer : state.activeProducer === aiProducer
    if (!aiShouldAct) return
    const timer = setTimeout(() => {
      const [action, nextRng] = HeuristicBot.chooseAction(state, rngRef.current)
      rngRef.current = nextRng
      setState((s) => applyAction(s, action))
    }, 150)
    return () => clearTimeout(timer)
  }, [state])

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
  const actions = waitingOnAi ? [] : legalActions(state)
  const active = state.producers[state.activeProducer]

  function act(actionIndex: number): void {
    undoStackRef.current.push(state)
    setState(applyAction(state, actions[actionIndex]!))
  }

  function undo(): void {
    const previous = undoStackRef.current.pop()
    if (previous) setState(previous)
  }

  return (
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
        <Map state={state} />
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
        {waitingOnAi ? (
          <p>AI teammate is deciding…</p>
        ) : (
          actions.map((a, i) => (
            <button key={i} onClick={() => act(i)}>
              {actionLabel(a, state)}
            </button>
          ))
        )}
      </section>

      <footer className="controls">
        <button disabled={undoStackRef.current.length === 0} onClick={undo}>
          Undo
        </button>
        <button onClick={onExit}>Menu</button>
      </footer>
    </main>
  )
}
