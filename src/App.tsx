import { useEffect, useState } from 'react'
import { createGame, replay } from './engine/api'
import Setup, { type Mode } from './ui/Setup'
import Game from './ui/Game'
import Scene from './ui/Scene'
import RulesReference from './ui/RulesReference'
import Settings from './ui/Settings'
import Credits from './ui/Credits'
import TitleArt from './ui/TitleArt'
import CampaignScreen from './ui/CampaignScreen'
import {
  loadGame,
  clearGame,
  loadCampaign,
  markChapterComplete,
  recordGrowingSeasonCarryOver,
  recordChapterLoss,
  clearChapterLossCount,
} from './platform/storage'
import { openExternalLink } from './platform/externalLink'
import { isNativePlatform } from './platform/native'
import { CHAPTERS, CHAPTERS_BY_ID, CHAPTER_3, CHAPTER_4, chapterConfig, chapter4Config, survivingWholesomeHollowContracts, type Chapter } from './content/chapters'
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
  | { name: 'settings' }
  | { name: 'credits' }
  | { name: 'campaign' }
  | { name: 'saveError' }
  | { name: 'chapterModeSelect'; chapter: Chapter }
  // SPEC 8.2 ch3 carry-over: 'contracts1'/'contracts2' are chapter 4's rueful-Tomas scenes, shown (via
  // `openingWhich`) right before 'opening' when contracts survived chapter 3 — see the-plan.ts.
  | { name: 'chapterScene'; chapter: Chapter; which: 'opening' | 'closing' | 'contracts1' | 'contracts2'; mode: Mode }
  | { name: 'game'; state: GameState; seed: number; mode: Mode }
  | { name: 'chapterGame'; chapter: Chapter; state: GameState; seed: number; mode: Mode; dismissedMidScenes?: string[] }
  // SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy. After
  // 2 losses, also offer Skip Chapter." `seed` is the just-lost attempt's own seed, kept so "Retry (same
  // shuffle)" can replay it exactly; `lossCount` is this chapter's consecutive-loss count so far.
  | { name: 'chapterLoss'; chapter: Chapter; mode: Mode; seed: number; lossCount: number }
  | { name: 'chapterSkipSummary'; chapter: Chapter }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })
  const [updateReady, setUpdateReady] = useState(false)
  const saved = loadGame()

  // Test-only: SPEC 11.3's global error screen (`ErrorBoundary.tsx`) has no other reliable way to be
  // exercised end to end — a real crash can't be scripted from outside the app. Throwing during render
  // (rather than in an event handler, which React error boundaries don't catch) guarantees the boundary
  // catches it. Gone from the URL the moment `backToTitle`/`resumeFromAutosave` navigate away, so there's
  // no crash loop.
  if (new URLSearchParams(window.location.search).get('e2eCrash') === '1') {
    throw new Error('Test-only crash (?e2eCrash=1)')
  }

  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true)
    window.addEventListener('cathnivore:update-ready', onUpdateReady)
    return () => window.removeEventListener('cathnivore:update-ready', onUpdateReady)
  }, [])

  // ErrorBoundary.tsx's "Resume From Last Autosave" reloads with this flag rather than calling `resume()`
  // directly (it has no access to App's internal state); this is the other half of that path.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('autoresume')) {
      window.history.replaceState(null, '', window.location.pathname)
      resume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function start(config: GameConfig, seed: number, mode: Mode): void {
    setScreen({ name: 'game', state: createGame(config, seed), seed, mode })
  }

  // SPEC 11.3: "If a save fails to load or is from an older version, show 'This save is from an older
  // version' with Start New and Try Anyway. Never show a blank screen." `resume` is both the plain
  // Continue path and "Try Anyway" — if replaying an incompatible/corrupt save throws, this catches it
  // instead of crashing the whole app.
  function resume(): void {
    if (!saved.save) return
    try {
      const state = replay(saved.save.config, saved.save.seed, saved.save.actions)
      // Hot-seat is the safe default on resume — a mid-game Solo save doesn't record which slot was human.
      // A campaign chapter save (`chapterId` set) resumes back into `chapterGame`, not a plain Quick Game —
      // otherwise the tutorial prompts/scripted scenes are lost and, worse, `endChapter` (markChapterComplete,
      // the ch3->4 carry-over, the loss/retry screen) can never fire for this playthrough again, silently
      // stalling campaign progress every time the app is reloaded mid-chapter (SPEC 8.1's "save and resume"
      // is a "never cut" feature). Falls back to the plain Quick Game screen for an old save, a Quick Game
      // save, or a chapter that no longer exists.
      const chapter = saved.save.chapterId ? CHAPTERS_BY_ID.get(saved.save.chapterId) : undefined
      if (chapter) {
        setScreen({ name: 'chapterGame', chapter, state, seed: saved.save.seed, mode: 'hotseat', dismissedMidScenes: saved.save.dismissedMidScenes })
      } else {
        setScreen({ name: 'game', state, seed: saved.save.seed, mode: 'hotseat' })
      }
    } catch {
      setScreen({ name: 'saveError' })
    }
  }

  function startNewFromSaveError(): void {
    clearGame()
    setScreen({ name: 'title' })
  }

  // SPEC 8.2 ch3 carry-over: chapter 4's opening is preceded by a rueful-Tomas scene when contracts
  // survived chapter 3 (0 -> straight to 'opening', nothing to be rueful about).
  function openingWhich(chapter: Chapter): 'opening' | 'contracts1' | 'contracts2' {
    if (chapter.id !== CHAPTER_4.id) return 'opening'
    const surviving = loadCampaign().growingSeasonContractsSurviving ?? 0
    return surviving >= 2 ? 'contracts2' : surviving === 1 ? 'contracts1' : 'opening'
  }

  function startChapter(chapter: Chapter): void {
    // SPEC 8.1: "the player picks Solo or Hot-seat when starting the campaign." A single-producer
    // chapter has no second producer for an AI teammate to play, so there's nothing to choose.
    if (chapter.producers.length > 1) {
      setScreen({ name: 'chapterModeSelect', chapter })
    } else {
      setScreen({ name: 'chapterScene', chapter, which: openingWhich(chapter), mode: 'hotseat' })
    }
  }

  // SPEC 8.2 ch3 carry-over: chapter 4's setup adds Outlets to Oakvale for contracts that survived
  // chapter 3 (see `chapter4Config`); every other chapter just uses its plain `chapterConfig`.
  // `difficultyOverride` backs SPEC 8.1's "Play on Easy" loss option — it swaps only the difficulty,
  // keeping the chapter's own map/rules/scripted content untouched.
  function configForChapter(chapter: Chapter, difficultyOverride?: 'easy' | 'normal' | 'hard'): GameConfig {
    const base =
      chapter.id === CHAPTER_4.id ? chapter4Config(loadCampaign().growingSeasonContractsSurviving ?? 0) : chapterConfig(chapter)
    return difficultyOverride ? { ...base, difficulty: difficultyOverride } : base
  }

  function playChapter(chapter: Chapter, mode: Mode, seedOverride?: number, difficultyOverride?: 'easy' | 'normal' | 'hard'): void {
    // SPEC 8.1 "Retry (same shuffle)" reuses the just-lost attempt's own seed; every other path
    // (a fresh chapter start, "Retry (new shuffle)", "Play on Easy") draws a new one.
    const seed = seedOverride ?? Date.now()
    const config = configForChapter(chapter, difficultyOverride)
    setScreen({ name: 'chapterGame', chapter, state: createGame(config, seed), seed, mode })
  }

  function endChapter(chapter: Chapter, mode: Mode, won: boolean, state: GameState, seed: number): void {
    // SPEC 8.2 ch3 carry-over: recorded whenever the chapter ends (won or lost), so a replay's latest
    // outcome is always what chapter 4 reads back.
    if (chapter.id === CHAPTER_3.id) {
      recordGrowingSeasonCarryOver(survivingWholesomeHollowContracts(state))
    }
    if (won) {
      markChapterComplete(chapter.id)
      clearChapterLossCount(chapter.id)
      setScreen({ name: 'chapterScene', chapter, which: 'closing', mode })
    } else {
      // SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy.
      // After 2 losses, also offer Skip Chapter... Progress is never locked."
      const lossCount = recordChapterLoss(chapter.id)
      setScreen({ name: 'chapterLoss', chapter, mode, seed, lossCount })
    }
  }

  if (screen.name === 'saveError') {
    return (
      <main className="title">
        <h1>Cathnivore</h1>
        <div className="save-warning">
          <p>This save is from an older version.</p>
          <button onClick={startNewFromSaveError}>Start New</button>
          <button onClick={resume}>Try Anyway</button>
        </div>
        <button onClick={() => setScreen({ name: 'title' })}>Back to Title</button>
      </main>
    )
  }

  if (screen.name === 'title') {
    const hasSave = !!saved.save && !saved.incompatible
    return (
      <main className="title title-screen">
        <div className="title-hero">
          <TitleArt />
          <div className="title-copy">
            <p className="title-kicker">A cooperative strategy game</p>
            <h1 className="title-wordmark">Cathnivore</h1>
            <p className="title-tagline">A cooperative engine-builder against two very polite conglomerates.</p>
            {updateReady && (
              <div className="update-ready">
                <span>Update ready.</span>
                <button onClick={() => window.location.reload()}>Reload</button>
              </div>
            )}
            {saved.incompatible && (
              <div className="save-warning">
                <p>This save is from an older version.</p>
                <button onClick={startNewFromSaveError}>Start New</button>
                {saved.save && <button onClick={resume}>Try Anyway</button>}
              </div>
            )}
            <nav className="title-menu" aria-label="Main menu">
              {hasSave && (
                <button className="primary title-cta" onClick={resume}>
                  Continue
                </button>
              )}
              <button className={hasSave ? 'title-cta' : 'primary title-cta'} onClick={() => setScreen({ name: 'campaign' })}>
                Campaign
              </button>
              <button className="title-cta" onClick={() => setScreen({ name: 'setup' })}>
                Quick Game
              </button>
              <div className="title-minor">
                <button className="quiet" onClick={() => setScreen({ name: 'rules' })}>How to Play</button>
                <button className="quiet" onClick={() => setScreen({ name: 'settings' })}>Settings</button>
                <button className="quiet" onClick={() => setScreen({ name: 'credits' })}>Credits</button>
              </div>
            </nav>
          </div>
        </div>
        <footer className="title-footer">
          <p>A work of satire. All places, companies and people are fictional.</p>
          <p>No tracking. Your saves stay on your device.</p>
          <p>
            <a href="/privacy" onClick={(e) => { e.preventDefault(); openExternalLink('/privacy') }}>Privacy</a> ·{' '}
            <a href="/support" onClick={(e) => { e.preventDefault(); openExternalLink('/support') }}>Support</a>
            {/* The website's root is the games landing page. The iPhone app keeps SPEC 11.6's only two links out. */}
            {!isNativePlatform() && <> · <a href="/">More games</a></>}
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

  if (screen.name === 'settings') {
    return <Settings onClose={() => setScreen({ name: 'title' })} />
  }

  if (screen.name === 'credits') {
    return <Credits onClose={() => setScreen({ name: 'title' })} />
  }

  if (screen.name === 'campaign') {
    return (
      <CampaignScreen
        chapters={CHAPTERS}
        completed={loadCampaign().completed}
        onStart={startChapter}
        onBack={() => setScreen({ name: 'title' })}
      />
    )
  }

  if (screen.name === 'chapterModeSelect') {
    const chapter = screen.chapter
    return (
      <main className="campaign">
        <h1>{chapter.title}</h1>
        <p>Play with an AI teammate, or pass the device back and forth between two humans.</p>
        <button onClick={() => setScreen({ name: 'chapterScene', chapter, which: openingWhich(chapter), mode: 'solo' })}>
          Solo (with an AI teammate)
        </button>
        <button onClick={() => setScreen({ name: 'chapterScene', chapter, which: openingWhich(chapter), mode: 'hotseat' })}>
          Hot-seat (two humans)
        </button>
        <button onClick={() => setScreen({ name: 'campaign' })}>Back</button>
      </main>
    )
  }

  if (screen.name === 'chapterScene') {
    const scenes = STORY_SCENES[screen.chapter.id]
    const isCarryOverScene = screen.which === 'contracts1' || screen.which === 'contracts2'
    const key = screen.which === 'opening' ? screen.chapter.openingScene : screen.which === 'closing' ? screen.chapter.closingScene : screen.which
    const scene = scenes?.[key as keyof typeof scenes]
    const continueTo = (): void => {
      if (isCarryOverScene) setScreen({ name: 'chapterScene', chapter: screen.chapter, which: 'opening', mode: screen.mode })
      else if (screen.which === 'opening') playChapter(screen.chapter, screen.mode)
      else setScreen({ name: 'campaign' })
    }
    if (!scene) {
      // No story data for this chapter/scene yet — skip straight past it rather than show a blank screen.
      continueTo()
      return null
    }
    return <Scene scene={scene} onContinue={continueTo} />
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
        chapterId={screen.chapter.id}
        initialDismissedMidScenes={screen.dismissedMidScenes}
        onExit={() => setScreen({ name: 'campaign' })}
        onChapterEnd={(won, state) => endChapter(screen.chapter, screen.mode, won, state, screen.seed)}
      />
    )
  }

  if (screen.name === 'chapterLoss') {
    const { chapter, mode, seed, lossCount } = screen
    return (
      <main className="campaign chapter-loss">
        <h1>{chapter.title}</h1>
        <p>You didn’t pull it off this time. Progress is never locked — try again whenever you like.</p>
        <button onClick={() => playChapter(chapter, mode, seed)}>Retry (same shuffle)</button>
        <button onClick={() => playChapter(chapter, mode)}>Retry (new shuffle)</button>
        <button onClick={() => playChapter(chapter, mode, undefined, 'easy')}>Play on Easy</button>
        {lossCount >= 2 && (
          <button
            onClick={() => {
              // SPEC 8.1: "Progress is never locked" — skipping still lets the campaign move on.
              markChapterComplete(chapter.id)
              clearChapterLossCount(chapter.id)
              setScreen({ name: 'chapterSkipSummary', chapter })
            }}
          >
            Skip Chapter
          </button>
        )}
        <button onClick={() => setScreen({ name: 'campaign' })}>Back to Chapter List</button>
      </main>
    )
  }

  if (screen.name === 'chapterSkipSummary') {
    const { chapter } = screen
    return (
      <main className="campaign chapter-skip-summary">
        <h1>{chapter.title}</h1>
        <p>You skip ahead rather than replay it again. {chapter.goalDescription} The story moves on without dwelling on it.</p>
        <button onClick={() => setScreen({ name: 'campaign' })}>Continue</button>
      </main>
    )
  }

  return <Game initial={screen.state} seed={screen.seed} mode={screen.mode} onExit={() => setScreen({ name: 'title' })} />
}
