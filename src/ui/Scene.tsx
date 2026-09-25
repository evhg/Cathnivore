import type { Scene as SceneData } from '../content/story/types'

// SPEC 10.1: the Scene (dialogue) screen. Lines reveal one at a time; the last tap continues on.
export default function Scene({ scene, onContinue }: { scene: SceneData; onContinue: () => void }) {
  return (
    <main className="scene">
      <div className="scene-lines">
        {scene.lines.map((l, i) => (
          <p key={i} className="scene-line">
            <span className="scene-speaker">{l.speaker}</span> {l.line}
          </p>
        ))}
      </div>
      <button onClick={onContinue}>Continue</button>
    </main>
  )
}
