import { useState } from 'react'
import type { Scene as SceneData } from '../content/story/types'
import { portraitKeyFor } from '../content/characters'
import Portrait from './portraits/Portrait'

// SPEC 10.1: the Scene (dialogue) screen, as a small graphic novel (ROADMAP 14): the current speaker's
// portrait beside a speech bubble, tap the bubble or "Next" to reveal the next line, with earlier lines
// kept as a dimmed backlog. "Continue" is always available and leaves the scene (it doubles as skip).
export default function Scene({ scene, onContinue, chapterId }: { scene: SceneData; onContinue: () => void; chapterId?: string }) {
  const [shown, setShown] = useState(1)
  const last = scene.lines.length
  const done = shown >= last
  const advance = () => setShown((n) => Math.min(last, n + 1))
  const current = scene.lines[shown - 1]
  const key = current ? portraitKeyFor(current.speaker) : null

  return (
    <main className={`scene${chapterId ? ` scene-bg-${chapterId}` : ''}`}>
      <div className="scene-backlog" aria-live="polite">
        {scene.lines.slice(0, shown - 1).map((l, i) => (
          <p key={i} className="scene-log-line">
            <span className="scene-speaker">{l.speaker}</span> {l.line}
          </p>
        ))}
      </div>
      {current && (
        <div className="scene-stage" key={shown}>
          {key && (
            <span className="scene-portrait">
              <Portrait character={key} size={96} />
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
