import { lazy, Suspense, useEffect, useState } from 'react'
import { createGame, replay } from './engine/api'
import type { Mode } from './ui/Setup'
import TitleArt from './ui/TitleArt'
import TitleSky from './ui/TitleSky'
import TitleSquare from './ui/TitleSquare'
import { skyForHour } from './ui/tableLight'
import { effectiveIsDark } from './platform/statusBar'
import { loadSettings } from './platform/settings'
import { setScoreRound } from './platform/sound'
import { scoreRoundForSky } from './platform/sound/score'
import {
  loadGame,
  clearGame,
  loadCampaign,
  markChapterComplete,
  recordGrowingSeasonCarryOver,
  recordSeals,
  chapterSeals,
  recordChapterLoss,
  clearChapterLossCount,
  isCoachDone,
  isTutorialDone,
  markCoachDone,
  savingForFrom,
  type SavedGame,
} from './platform/storage'
import { isShelfGoal } from './ui/shelfGoal'
import { openExternalLink } from './platform/externalLink'
import { isNativePlatform } from './platform/native'
import { CHAPTERS, CHAPTERS_BY_ID, CHAPTER_1, CHAPTER_3, CHAPTER_4, chapterConfig, chapter4Config, survivingWholesomeHollowContracts, type Chapter } from './content/chapters'
import { sealsEarned } from './content/campaignMap'
import { MarrowBadge } from './ui/CampaignMap'
import { SCENES as FRESH_MEAT_SCENES } from './content/story/fresh-meat'
import { SCENES as WORD_OF_MOUTH_SCENES } from './content/story/word-of-mouth'
import { SCENES as GROWING_SEASON_SCENES } from './content/story/growing-season'
import { SCENES as THE_PLAN_SCENES } from './content/story/the-plan'
import { SCENES as FRIENDS_IN_LOW_PLACES_SCENES } from './content/story/friends-in-low-places'
import { SCENES as KINGSMARKET_SCENES } from './content/story/kingsmarket'
import type { GameConfig, GameState } from './engine/types'
import { dailyMarket, dailyRecord, dailyStreak } from './content/daily'
import { countdownText, dailyRitual } from './content/dailyRitual'
import { LAYOUTS } from './content/layouts'
import { PRODUCERS } from './content/producers'
import { MARKET_EVENTS } from './engine/marketEvent'
import { loadFullCss } from './platform/fullCss'

// Gate 7 (Lighthouse mobile >= 85): the title paints from the first chunk; every other screen loads on demand
// (the service worker precaches every chunk, so offline play is unchanged).
const Setup = lazy(() => (void loadFullCss(), import('./ui/Setup')))
// The table's rules ship in the full stylesheet (platform/fullCss.ts): Setup and the campaign start loading it on
// the way to the table, and the Game screen waits for it. The title never pays for it.
const Game = lazy(() => Promise.all([import('./ui/Game'), loadFullCss()]).then(([m]) => m))
const Scene = lazy(() => import('./ui/Scene'))
const RulesReference = lazy(() => import('./ui/RulesReference'))
const Settings = lazy(() => import('./ui/Settings'))
const Credits = lazy(() => import('./ui/Credits'))
const CampaignScreen = lazy(() => (void loadFullCss(), import('./ui/CampaignScreen')))

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
  // `celebrate`: the chapter just won for the first time; the map plays its chapter-complete moment.
  | { name: 'campaign'; celebrate?: string }
  | { name: 'saveError' }
  | { name: 'chapterModeSelect'; chapter: Chapter; hard?: boolean }
  // SPEC 8.2 ch3 carry-over: 'contracts1'/'contracts2' are chapter 4's rueful-Tomas scenes, shown (via
  // `openingWhich`) right before 'opening' when contracts survived chapter 3 — see the-plan.ts.
  // `hard`: the campaign card's "Play on Hard" (plan item 35's second seal).
  | { name: 'chapterScene'; chapter: Chapter; which: 'opening' | 'closing' | 'contracts1' | 'contracts2'; mode: Mode; hard?: boolean; celebrate?: boolean }
  | { name: 'game'; state: GameState; seed: number; mode: Mode; savingFor?: SavedGame['savingFor'] }
  // `tutorial`: this run plays the chapter's guided tutorial (first time, or replayed on request).
  | { name: 'chapterGame'; chapter: Chapter; state: GameState; seed: number; mode: Mode; dismissedMidScenes?: string[]; tutorial?: boolean; savingFor?: SavedGame['savingFor'] }
  // SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy. After
  // 2 losses, also offer Skip Chapter." `seed` is the just-lost attempt's own seed, kept so "Retry (same
  // shuffle)" can replay it exactly; `lossCount` is this chapter's consecutive-loss count so far.
  // `hard`: the lost attempt was a Hard replay, so both Retries stay on Hard.
  | { name: 'chapterLoss'; chapter: Chapter; mode: Mode; seed: number; lossCount: number; hard?: boolean }
  | { name: 'chapterSkipSummary'; chapter: Chapter }

export default function App() {
  return (
    <Suspense fallback={null}>
      <Screens />
    </Suspense>
  )
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })
  const [updateReady, setUpdateReady] = useState(false)
  // Bumped by "Play again" so the same-seed game mounts fresh rather than keeping the finished one's state.
  const [gameRun, setGameRun] = useState(0)
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

  // Plan item 213: on the title the market score keeps the title's clock (its sky); a game sets it by the round.
  useEffect(() => {
    if (screen.name === 'title') setScoreRound(scoreRoundForSky(skyForHour(new Date().getHours(), effectiveIsDark(loadSettings().theme))))
  }, [screen.name])

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
        setScreen({
          name: 'chapterGame',
          chapter,
          state,
          seed: saved.save.seed,
          mode: 'hotseat',
          dismissedMidScenes: saved.save.dismissedMidScenes,
          tutorial: tutorialFor(chapter, state.config),
          savingFor: savingForFrom(saved.save, isShelfGoal),
        })
      } else {
        setScreen({ name: 'game', state, seed: saved.save.seed, mode: 'hotseat', savingFor: savingForFrom(saved.save, isShelfGoal) })
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

  function startChapter(chapter: Chapter, hard = false): void {
    // SPEC 8.1: "the player picks Solo or Hot-seat when starting the campaign." A single-producer
    // chapter has no second producer for an AI teammate to play, so there's nothing to choose.
    if (chapter.producers.length > 1) {
      setScreen({ name: 'chapterModeSelect', chapter, hard })
    } else {
      setScreen({ name: 'chapterScene', chapter, which: openingWhich(chapter), mode: 'hotseat', hard })
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

  // The guided tutorial plays on a guided chapter until it has been finished or skipped once, and only
  // on the chapter's own scripted board (not "Play on Easy", whose extra Stall the script doesn't know).
  function tutorialFor(chapter: Chapter, config: GameConfig, replayTutorial = false): boolean {
    return !!chapter.guided && config.difficulty === chapter.difficulty && (replayTutorial || !isCoachDone(chapter.id))
  }

  function playChapter(chapter: Chapter, mode: Mode, seedOverride?: number, difficultyOverride?: 'easy' | 'normal' | 'hard', replayTutorial = false): void {
    // SPEC 8.1 "Retry (same shuffle)" reuses the just-lost attempt's own seed; every other path
    // (a fresh chapter start, "Retry (new shuffle)", "Play on Easy") draws a new one.
    const seed = seedOverride ?? Date.now()
    const config = configForChapter(chapter, difficultyOverride)
    setScreen({ name: 'chapterGame', chapter, state: createGame(config, seed), seed, mode, tutorial: tutorialFor(chapter, config, replayTutorial) })
  }

  // Settings and the campaign card's "Replay the tutorial": straight into that chapter's guided round
  // (Settings replays chapter 1's).
  function replayTutorial(chapter: Chapter = CHAPTER_1): void {
    playChapter(chapter, 'hotseat', undefined, undefined, true)
  }

  function endChapter(chapter: Chapter, mode: Mode, won: boolean, state: GameState, seed: number): void {
    // SPEC 8.2 ch3 carry-over: recorded whenever the chapter ends (won or lost), so a replay's latest
    // outcome is always what chapter 4 reads back.
    if (chapter.id === CHAPTER_3.id) {
      recordGrowingSeasonCarryOver(survivingWholesomeHollowContracts(state))
    }
    if (won) {
      const firstWin = !loadCampaign().completed.includes(chapter.id)
      recordSeals(chapter.id, sealsEarned(chapter.id, state))
      markChapterComplete(chapter.id)
      clearChapterLossCount(chapter.id)
      setScreen({ name: 'chapterScene', chapter, which: 'closing', mode, celebrate: firstWin })
    } else {
      // SPEC 8.1: "Losing a chapter: offer Retry (same shuffle), Retry (new shuffle) and Play on Easy.
      // After 2 losses, also offer Skip Chapter... Progress is never locked."
      const lossCount = recordChapterLoss(chapter.id)
      setScreen({ name: 'chapterLoss', chapter, mode, seed, lossCount, hard: state.config.difficulty === 'hard' && chapter.difficulty !== 'hard' })
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
    // Plan item 206: the sky over the market follows the player's clock; the dark theme is always evening.
    const sky = skyForHour(new Date().getHours(), effectiveIsDark(loadSettings().theme))
    return (
      <main className="title title-screen" data-sky={sky}>
        <TitleSky sky={sky} />
        <TitleSquare />
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
            {/* Plan item 86: at D the market's painted sign hangs from the bunting over the price-board. */}
            <div className="title-hang" aria-hidden="true">
              <svg viewBox="0 0 240 92" focusable="false">
                <rect className="title-hang-plank" x="4" y="10" width="232" height="76" rx="8" />
                <rect className="title-hang-inset" x="13" y="19" width="214" height="58" rx="4" />
                <circle className="title-hang-eye" cx="30" cy="10" r="5" />
                <circle className="title-hang-eye" cx="210" cy="10" r="5" />
                <text className="title-hang-word" x="120" y="50">Marrow Market</text>
                <text className="title-hang-sub" x="120" y="68">fresh every round · since the Glut</text>
              </svg>
            </div>
            <nav className="title-menu" aria-label="Main menu">
              {hasSave && (
                <button className="primary title-cta" onClick={resume}>
                  Continue
                </button>
              )}
              <button className={hasSave ? 'title-cta' : 'primary title-cta'} onClick={() => setScreen({ name: 'campaign' })}>
                Campaign
                <MarrowBadge completed={loadCampaign().completed} />
              </button>
              <button className="title-cta" onClick={() => setScreen({ name: 'setup' })}>
                Quick Game
              </button>
              <DailyButton onStart={start} />
              <div className="title-minor">
                <button className="quiet" onClick={() => setScreen({ name: 'rules' })}>
                  <svg className="title-key-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5.5c3-1.2 5.5-1 8 .8 2.5-1.800 5-2 8-.8V19c-3-1.200-5.500-1-8 .8-2.500-1.800-5-2-8-.8zM12 6.300V19.800" /></svg>
                  How to Play
                </button>
                <button className="quiet" onClick={() => setScreen({ name: 'settings' })}>
                  <svg className="title-key-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.500v5M9 14.500v5" /></svg>
                  Settings
                </button>
                <button className="quiet" onClick={() => setScreen({ name: 'credits' })}>
                  <svg className="title-key-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.500l2.600 5.300 5.800.800-4.200 4.100 1 5.800-5.200-2.700-5.200 2.700 1-5.800L3.600 9.600l5.800-.8z" /></svg>
                  Credits
                </button>
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
    return <Settings onClose={() => setScreen({ name: 'title' })} onReplayTutorial={() => replayTutorial()} />
  }

  if (screen.name === 'credits') {
    return <Credits onClose={() => setScreen({ name: 'title' })} />
  }

  if (screen.name === 'campaign') {
    return (
      <CampaignScreen
        chapters={CHAPTERS}
        completed={loadCampaign().completed}
        tutorialDone={isTutorialDone()}
        coachDone={(id) => isCoachDone(id)}
        seals={(id) => chapterSeals(id)}
        celebrate={screen.celebrate}
        onStartHard={(chapter) => startChapter(chapter, true)}
        onStart={startChapter}
        onReplayTutorial={replayTutorial}
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
        <button onClick={() => setScreen({ name: 'chapterScene', chapter, which: openingWhich(chapter), mode: 'solo', hard: screen.hard })}>
          Solo (with an AI teammate)
        </button>
        <button onClick={() => setScreen({ name: 'chapterScene', chapter, which: openingWhich(chapter), mode: 'hotseat', hard: screen.hard })}>
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
      if (isCarryOverScene) setScreen({ name: 'chapterScene', chapter: screen.chapter, which: 'opening', mode: screen.mode, hard: screen.hard })
      else if (screen.which === 'opening') playChapter(screen.chapter, screen.mode, undefined, screen.hard ? 'hard' : undefined)
      else setScreen({ name: 'campaign', celebrate: screen.celebrate ? screen.chapter.id : undefined })
    }
    if (!scene) {
      // No story data for this chapter/scene yet — skip straight past it rather than show a blank screen.
      continueTo()
      return null
    }
    return <Scene scene={scene} onContinue={continueTo} chapterId={screen.chapter.id} />
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
        tutorialSteps={
          // A guided chapter's script only plays as the guided tutorial; once that's done, it's free play.
          screen.chapter.guided
            ? screen.tutorial
              ? screen.chapter.tutorialSteps
              : undefined
            : // Replaying a finished chapter: drop the talk-only prompts, keep the forced action steps (ROADMAP 161).
              loadCampaign().completed.includes(screen.chapter.id)
              ? screen.chapter.tutorialSteps.filter((t) => t.highlight)
              : screen.chapter.tutorialSteps
        }
        guided={!!screen.tutorial}
        onTutorialDone={() => markCoachDone(screen.chapter.id)}
        midGameScenes={midGameScenes}
        chapterId={screen.chapter.id}
        initialDismissedMidScenes={screen.dismissedMidScenes}
        initialSavingFor={screen.savingFor}
        onExit={() => setScreen({ name: 'campaign' })}
        onChapterEnd={(won, state) => endChapter(screen.chapter, screen.mode, won, state, screen.seed)}
      />
    )
  }

  if (screen.name === 'chapterLoss') {
    const { chapter, mode, seed, lossCount } = screen
    const retryDifficulty = screen.hard ? 'hard' : undefined
    return (
      <main className="campaign chapter-loss">
        <h1>{chapter.title}</h1>
        <p>You didn’t pull it off this time. Progress is never locked — try again whenever you like.</p>
        <button onClick={() => playChapter(chapter, mode, seed, retryDifficulty)}>Retry (same shuffle)</button>
        <button onClick={() => playChapter(chapter, mode, undefined, retryDifficulty)}>Retry (new shuffle)</button>
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

  return (
    <Game
      key={gameRun}
      initial={screen.state}
      seed={screen.seed}
      mode={screen.mode}
      initialSavingFor={screen.savingFor}
      onExit={() => setScreen({ name: 'title' })}
      onPlayAgain={() => {
        // Plan item 8: the same seed from the start, with the same producers and difficulty.
        setGameRun((n) => n + 1)
        start(screen.state.config, screen.seed, screen.mode)
      }}
      onNewGame={() => setScreen({ name: 'setup' })}
    />
  )
}

/** Plan item 15: today's Daily Market on the title, with the day's map, pair and event, and the streak. */
function DailyButton({ onStart }: { onStart(config: GameConfig, seed: number, mode: Mode): void }) {
  const [daily] = useState(() => dailyMarket(new Date()))
  const rec = dailyRecord()
  const played = rec.results[daily.date]
  const streak = dailyStreak(daily.date, rec)
  const pair = daily.producers.map((id) => PRODUCERS[id].name.replace(/^Dr /, '').split(' ')[0]).join(' & ')
  return (
    <button className="title-cta title-daily" data-daily={daily.date} onClick={() => onStart(daily.config, daily.seed, 'solo')}>
      <span className="title-daily-name">
        Daily Market <span className="title-daily-no">#{daily.number}</span>
        {(played || streak > 0) && (
          <span className="title-daily-streak" aria-label={played ? `Played today${streak ? `, streak ${streak}` : ''}` : `Streak ${streak}`}>
            {played ? (played.won ? '✓' : '·') : ''}
            {streak > 0 ? ` ${streak} in a row` : ''}
          </span>
        )}
      </span>
      <small>
        {/* Plan item 296: each '·' binds to the word before it, so a wrap never opens a line on a lone dot. Plan item
            385: on a phone the tag keeps the map's name and gives its status and countdown (the desktop's ritual slip
            says those); the pair and event stay for screen readers. */}
        <span className="title-daily-where">
          {LAYOUTS[daily.layout].name}
          <span className="title-daily-more">
            {'\u00a0· '}
            {pair}
            {'\u00a0· '}
            {MARKET_EVENTS[daily.marketEvent].name}
          </span>
        </span>
        <span className="title-daily-when">
          {played ? (played.won ? 'Won · new in\u00a0' : 'Played · new in\u00a0') : 'Open · '}
          {countdownText(dailyRitual(new Date(), rec).nextInMs).replace(' ', '\u00a0')}
          {played ? '' : '\u00a0left'}
        </span>
      </small>
    </button>
  )
}
