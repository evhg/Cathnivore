import { useState } from 'react'
import { createGame, replay } from './engine/api'
import Setup, { type Mode } from './ui/Setup'
import Game from './ui/Game'
import RulesReference from './ui/RulesReference'
import { loadGame } from './platform/storage'
import type { GameConfig, GameState } from './engine/types'

type Screen =
  | { name: 'title' }
  | { name: 'setup' }
  | { name: 'rules' }
  | { name: 'game'; state: GameState; seed: number; mode: Mode }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })
  const saved = loadGame()

  function start(config: GameConfig, seed: number, mode: Mode): void {
    setScreen({ name: 'game', state: createGame(config, seed), seed, mode })
  }

  function resume(): void {
    if (!saved) return
    const state = replay(saved.config, saved.seed, saved.actions)
    // Hot-seat is the safe default on resume — a mid-game Solo save doesn't record which slot was human.
    setScreen({ name: 'game', state, seed: saved.seed, mode: 'hotseat' })
  }

  if (screen.name === 'title') {
    return (
      <main className="title">
        <h1>Cathnivore</h1>
        <p>A cooperative engine-builder against two very polite conglomerates.</p>
        {saved && <button onClick={resume}>Continue</button>}
        <button onClick={() => setScreen({ name: 'setup' })}>Quick Game</button>
        <button onClick={() => setScreen({ name: 'rules' })}>How to Play</button>
        <footer>
          <p>A work of satire. All places, companies and people are fictional.</p>
          <p>No tracking. Your saves stay on your device.</p>
        </footer>
      </main>
    )
  }

  if (screen.name === 'setup') {
    return <Setup onStart={start} />
  }

  if (screen.name === 'rules') {
    return <RulesReference onClose={() => setScreen({ name: 'title' })} />
  }

  return <Game initial={screen.state} seed={screen.seed} mode={screen.mode} onExit={() => setScreen({ name: 'title' })} />
}
