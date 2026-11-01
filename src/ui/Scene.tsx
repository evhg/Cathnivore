import { useEffect, useState } from 'react'
import type { Scene as SceneData } from '../content/story/types'
import { portraitKeyFor } from '../content/characters'
import type { CathExpression, CathOutfit } from '../../shared/cath/cath'
import CathArt from './CathArt'
import Figure from './portraits/Figure'
import Backdrop from './scenes/Backdrop'
import { moodOf, sidesFor, type Side } from './sceneStaging'

// SPEC 10.1: the Scene (dialogue) screen as a graphic novel (ROADMAP 14, 58, U7; plan item 5). A painted
// backdrop per chapter fills the screen; the speakers stand on it at half length, at least half the
// viewport tall: Cath always on the left, the rest of the cast on the right (when Cath isn't in a scene, the
// first speaker takes the left). The current speaker is lit and forward; the other stays on stage, dimmed.
// A new face on a side wipes in like a fresh panel; each line sets the speaker's pose (a head tilt and a
// lean read from the line). Tap the caption or "Next" for the next line; earlier lines stay as a short
// dimmed backlog. "Continue" is always available and leaves the scene (it doubles as skip).
// Cath dresses for each chapter's place: the farm, a dusk lambing shed, market day, town, the harbour, the hall.
const OUTFIT: Record<string, CathOutfit> = {
  'fresh-meat': 'field',
  'word-of-mouth': 'wax',
  'growing-season': 'market',
  'the-plan': 'trench',
  'friends-in-low-places': 'trench',
  kingsmarket: 'gown',
}

function Speaker({ who, expression, chapterId }: { who: string; expression?: CathExpression; chapterId?: string }) {
  if (who === 'cath') return <CathArt framing="half" title="Cath" expression={expression} outfit={OUTFIT[chapterId ?? ''] ?? 'field'} />
  return <Figure character={who} expression={expression} title={who[0]!.toUpperCase() + who.slice(1)} />
}

export default function Scene({ scene, onContinue, chapterId }: { scene: SceneData; onContinue: () => void; chapterId?: string }) {
  const [shown, setShown] = useState(1)
  const last = scene.lines.length
  const done = shown >= last
  const advance = () => setShown((n) => Math.min(last, n + 1))
  const current = scene.lines[shown - 1]
  // Keyboard: Right arrow advances; Escape skips the scene (Enter/Space on a focused button keep their own meaning).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setShown((n) => Math.min(last, n + 1))
      else if (e.key === 'Escape') onContinue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onContinue])

  const sides = sidesFor(scene)
  const key = current ? portraitKeyFor(current.speaker) : undefined
  const speakingSide: Side = (key && sides.get(key)) || 'right'
  // Who stands on each side right now: the latest speaker from that side up to this line, with the mood of
  // their latest line (so the listener keeps the pose they last spoke with).
  const stage: Partial<Record<Side, { who: string; mood?: CathExpression }>> = {}
  for (let i = shown - 1; i >= 0; i--) {
    const l = scene.lines[i]!
    const k = portraitKeyFor(l.speaker)
    const s = k && sides.get(k)
    if (k && s && !stage[s]) stage[s] = { who: k, mood: moodOf(l.line) }
    if (stage.left && stage.right) break
  }

  return (
    <main className={`scene scene-gn${chapterId ? ` scene-bg-${chapterId}` : ''}`}>
      <Backdrop chapterId={chapterId} />
      <div className="scene-stage-area">
        {(['left', 'right'] as const).map((s) => {
          const who = stage[s]
          if (!who) return null
          const speaking = s === speakingSide && who.who === key
          return (
            <div
              key={`${s}-${who.who}`}
              className={`scene-fig scene-fig-${s} ${speaking ? 'is-speaking' : 'is-listening'} mood-${who.mood ?? 'calm'}`}
              aria-hidden={speaking ? undefined : true}
            >
              <Speaker who={who.who} expression={who.mood} chapterId={chapterId} />
            </div>
          )
        })}
      </div>
      <div className="scene-panel">
        <div className="scene-backlog" aria-live="polite">
          {scene.lines.slice(Math.max(0, shown - 3), shown - 1).map((l, i) => (
            <p key={i} className="scene-log-line">
              <span className="scene-speaker">{l.speaker}</span> {l.line}
            </p>
          ))}
        </div>
        {current && (
          <div
            key={shown}
            className={`scene-bubble scene-bubble-${speakingSide}`}
            role={done ? undefined : 'button'}
            tabIndex={done ? undefined : 0}
            onClick={done ? undefined : advance}
            onKeyDown={done ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), advance())}
          >
            <span className="scene-speaker">{current.speaker}</span>
            <span className="scene-text">{current.line}</span>
          </div>
        )}
        <div className="scene-actions">
          <span className="scene-progress">{shown} / {last}</span>
          {!done && <button className="scene-next" onClick={advance}>Next</button>}
          <button className={done ? '' : 'scene-skip'} onClick={onContinue}>Continue</button>
        </div>
      </div>
    </main>
  )
}
