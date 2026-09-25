import { useEffect, useState } from 'react'
import { createGame, replay } from './engine/api'
import Setup, { type Mode } from './ui/Setup'
import Game from './ui/Game'
import Scene from './ui/Scene'
import RulesReference from './ui/RulesReference'
import { loadGame, loadCampaign, markChapterComplete } from './platform/storage'
import { CHAPTERS, chapterConfig, type Chapter } from './content/chapters'
import { SCENES as FRESH_MEAT_SCENES } from './content/story/fresh-meat'
import { SCENES as WORD_OF_MOUTH_SCENES } from './content/story/word-of-mouth'
import { SCENES as GROWING_SEASON_SCENES } from './content/story/growing-season'
import { SCENES as THE_PLAN_SCENES } from './content/story/the-plan'
import { SCENES as FRIENDS_IN_LOW_PLACES_SCENES } from './content/story/friends-in-low-places'
import { SCENES as KINGSMARKET_SCENES } from './content/story/kingsmarket'
import type { GameConfig, GameState } from './engine/types'

const STORY_SCENES: Record<string, typeof FRESH_MEAT_SCENES> = {
  'fresh-meat': FRESH_MEAT_SCENES,
  'word-of-mouth': WORD_OF_MOUTH_SCENES,
  'growing-season': GROWING_SEASON_SCENES,
  'the-plan': THE_PLAN_SCENES,
  'friends-in-low-places': FRIENDS_IN_LOW_PLACES_SCENES,
  kingsmarket: KINGSMARKET_SCENES,
}

type Screen =
  | { name: 'title' }
  | { name: 'setup' }
  | { name: 'rules' }
  | { name: 'campaign' }
  | { name: 'chapterModeSelect'; chapter: Chapter }
  | { name: 'chapterScene'; chapter: Chapter; which: 'opening' | 'closing'; mode: Mode }
  | { name: 'game'; state: GameState; seed: number; mode: Mode }
  | { name: 'chapterGame'; chapter: Chapter; state: GameState; seed: number; mode: Mode }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })
  const [updateReady, setUpdateReady] = useState(false)
  const saved = loadGame()

  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true)
    window.addEventListener('cathnivore:update-ready', onUpdateReady)
    return () => window.removeEventListener('cathnivore:update-ready', onUpdateReady)
  }, [])

  function start(config: GameConfig, seed: number, mode: Mode): void {
    setScreen({ name: 'game', state: createGame(config, seed), seed, mode })
  }

  function resume(): void {
    if (!saved) return
    const state = replay(saved.config, saved.seed, saved.actions)
    // Hot-seat is the safe default on resume — a mid-game Solo save doesn't record which slot was human.
    setScreen({ name: 'game', state, seed: saved.seed, mode: 'hotseat' })
  }

  function startChapter(chapter: Chapter): void {
    // SPEC 8.1: "the player picks Solo or Hot-seat when starting the campaign." A single-producer
    // chapter has no second producer for an AI teammate to play, so there's nothing to choose.
    if (chapter.producers.length > 1) {
      setScreen({ name: 'chapterModeSelect', chapter })
    } else {
      setScreen({ name: 'chapterScene', chapter, which: 'opening', mode: 'hotseat' })
    }
  }

  function playChapter(chapter: Chapter, mode: Mode): void {
    const seed = Date.now()
    setScreen({ name: 'chapterGame', chapter, state: createGame(chapterConfig(chapter), seed), seed, mode })
  }

  function endChapter(chapter: Chapter, mode: Mode, won: boolean): void {
    markChapterComplete(chapter.id)
    if (won) {
      setScreen({ name: 'chapterScene', chapter, which: 'closing', mode })
    } else {
      setScreen({ name: 'campaign' })
    }
  }

  if (screen.name === 'title') {
    return (
      <main className="title">
        <h1>Cathnivore</h1>
        <p>A cooperative engine-builder against two very polite conglomerates.</p>
        {updateReady && (
          <div className="update-ready">
            <span>Update ready.</span>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        )}
        {saved && <button onClick={resume}>Continue</button>}
        <button onClick={() => setScreen({ name: 'campaign' })}>Campaign</button>
        <button onClick={() => setScreen({ name: 'setup' })}>Quick Game</button>
        <button onClick={() => setScreen({ name: 'rules' })}>How to Play</button>
        <footer>
          <p>A work of satire. All places, companies and people are fictional.</p>
          <p>No tracking. Your saves stay on your device.</p>
          <p>
            <a href="/privacy">Privacy</a> · <a href="/support">Support</a>
          </p>
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

  if (screen.name === 'campaign') {
    const progress = loadCampaign()
    return (
      <main className="campaign">
        <h1>Campaign</h1>
        <ul className="chapter-list">
          {CHAPTERS.map((chapter) => (
            <li key={chapter.id}>
              <button onClick={() => startChapter(chapter)}>
                <strong>
                  {chapter.title}
                  {progress.completed.includes(chapter.id) ? ' (completed)' : ''}
                </strong>
                <span className="chapter-goal">{chapter.goalDescription}</span>
              </button>
            </li>
          ))}
        </ul>
        <button onClick={() => setScreen({ name: 'title' })}>Back to Title</button>
      </main>
    )
  }

  if (screen.name === 'chapterModeSelect') {
    const chapter = screen.chapter
    return (
      <main className="campaign">
        <h1>{chapter.title}</h1>
        <p>Play with an AI teammate, or pass the device back and forth between two humans.</p>
        <button onClick={() => setScreen({ name: 'chapterScene', chapter, which: 'opening', mode: 'solo' })}>
          Solo (with an AI teammate)
        </button>
        <button onClick={() => setScreen({ name: 'chapterScene', chapter, which: 'opening', mode: 'hotseat' })}>
          Hot-seat (two humans)
        </button>
        <button onClick={() => setScreen({ name: 'campaign' })}>Back</button>
      </main>
    )
  }

  if (screen.name === 'chapterScene') {
    const scenes = STORY_SCENES[screen.chapter.id]
    const key = screen.which === 'opening' ? screen.chapter.openingScene : screen.chapter.closingScene
    const scene = scenes?.[key as keyof typeof scenes]
    if (!scene) {
      // No story data for this chapter yet — skip straight past the scene rather than show a blank screen.
      if (screen.which === 'opening') playChapter(screen.chapter, screen.mode)
      else setScreen({ name: 'campaign' })
      return null
    }
    return (
      <Scene
        scene={scene}
        onContinue={() => (screen.which === 'opening' ? playChapter(screen.chapter, screen.mode) : setScreen({ name: 'campaign' }))}
      />
    )
  }

  if (screen.name === 'chapterGame') {
    const scenes = STORY_SCENES[screen.chapter.id]
    const triggerSceneId = screen.chapter.scriptedTrigger?.sceneId
    const midGameScenes = scenes && triggerSceneId && triggerSceneId in scenes ? { [triggerSceneId]: (scenes as Record<string, (typeof scenes)[keyof typeof scenes]>)[triggerSceneId]! } : undefined
    return (
      <Game
        initial={screen.state}
        seed={screen.seed}
        mode={screen.mode}
        tutorialSteps={screen.chapter.tutorialSteps}
        midGameScenes={midGameScenes}
        onExit={() => setScreen({ name: 'campaign' })}
        onChapterEnd={(won) => endChapter(screen.chapter, screen.mode, won)}
      />
    )
  }

  return <Game initial={screen.state} seed={screen.seed} mode={screen.mode} onExit={() => setScreen({ name: 'title' })} />
}
