import type { Scene as SceneData } from '../content/story/types'
import { portraitKeyFor } from '../content/characters'
import type { CathExpression } from '../../shared/cath/cath'

// Staging rules for the graphic-novel Scene (Scene.tsx, plan item 5).
// Scene lines carry no mood tags, so read it off the punctuation: "!" is delighted, "?" worried, "..." determined.
export function moodOf(line: string): CathExpression | undefined {
  if (/!\s*["”']?$/.test(line)) return 'delighted'
  if (/\?\s*["”']?$/.test(line)) return 'worried'
  if (/(\.\.\.|…)\s*["”']?$/.test(line)) return 'determined'
  return undefined
}

export type Side = 'left' | 'right'

/** Which side of the stage each speaker stands on, fixed for the whole scene. */
export function sidesFor(scene: SceneData): Map<string, Side> {
  const keys: string[] = []
  for (const l of scene.lines) {
    const k = portraitKeyFor(l.speaker)
    if (k && !keys.includes(k)) keys.push(k)
  }
  const leftKey = keys.includes('cath') ? 'cath' : keys[0]
  return new Map(keys.map((k) => [k, k === leftKey ? 'left' : 'right']))
}

