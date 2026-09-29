import type { Scene as SceneData } from '../content/story/types'
import { portraitKeyFor } from '../content/characters'
import Portrait from './portraits/Portrait'

// SPEC 10.1: the Scene (dialogue) screen. All of a scene's lines render at once, with a single Continue
// button to move on — not the one-line-at-a-time reveal an earlier draft of this comment described.
export default function Scene({ scene, onContinue }: { scene: SceneData; onContinue: () => void }) {
  return (
    <main className="scene">
      <div className="scene-lines">
        {scene.lines.map((l, i) => {
          const key = portraitKeyFor(l.speaker)
          return (
            <p key={i} className="scene-line">
              {key && (
                <span className="scene-portrait">
                  <Portrait character={key} size={48} />
                </span>
              )}
              <span className="scene-speaker">{l.speaker}</span> {l.line}
            </p>
          )
        })}
      </div>
      <button onClick={onContinue}>Continue</button>
    </main>
  )
}
