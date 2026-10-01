import { useEffect, useState } from 'react'
import type { Scene as SceneData } from '../content/story/types'
import { portraitKeyFor } from '../content/characters'
import type { CathExpression } from '../../shared/cath/cath'
import Portrait from './portraits/Portrait'

// SPEC 10.1: the Scene (dialogue) screen, as a small graphic novel (ROADMAP 14): the current speaker's
// portrait beside a speech bubble, tap the bubble or "Next" to reveal the next line, with earlier lines
// kept as a dimmed backlog. "Continue" is always available and leaves the scene (it doubles as skip).
// Scene lines carry no mood tags, so read it off the punctuation: "!" is delighted, "?" worried, "..." determined.
function moodOf(line: string): CathExpression | undefined {
  if (/!\s*["”']?$/.test(line)) return 'delighted'
  if (/\?\s*["”']?$/.test(line)) return 'worried'
  if (/(\.\.\.|…)\s*["”']?$/.test(line)) return 'determined'
  return undefined
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
  const key = current ? portraitKeyFor(current.speaker) : null

  return (
    <main className={`scene${chapterId ? ` scene-bg-${chapterId}` : ''}`}>
      <div className="scene-backlog" aria-live="polite">
        {scene.lines.slice(Math.max(0, shown - 4), shown - 1).map((l, i) => (
          <p key={i} className="scene-log-line">
            <span className="scene-speaker">{l.speaker}</span> {l.line}
          </p>
        ))}
      </div>
      {current && (
        <div className={`scene-stage${key === 'cath' ? '' : ' scene-stage-right'}`} key={shown}>
          {key && (
            <span className="scene-portrait">
              <Portrait character={key} size={128} expression={moodOf(current.line)} />
            </span>
          )}
          <div
            className="scene-bubble"
            role={done ? undefined : 'button'}
            tabIndex={done ? undefined : 0}
            onClick={done ? undefined : advance}
            onKeyDown={done ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), advance())}
          >
            <span className="scene-speaker">{current.speaker}</span>
            <span className="scene-text">{current.line}</span>
          </div>
        </div>
      )}
      <div className="scene-actions">
        <span className="scene-progress">{shown} / {last}</span>
        {!done && <button className="scene-next" onClick={advance}>Next</button>}
        <button className={done ? '' : 'scene-skip'} onClick={onContinue}>Continue</button>
      </div>
    </main>
  )
}
