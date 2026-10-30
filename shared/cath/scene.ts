// Shared Cath scene component (ROADMAP 227): one call gives intros, chapter ends and win/lose cards the
// same Cath, posed and animated by mood. Games pass the moment, never pick expressions themselves.
import { cathSvg, type CathExpression, type CathOptions } from './cath'

export type CathMoment = 'intro' | 'win' | 'perfect' | 'lose' | 'chapter-end' | 'thinking' | 'warning'

export interface CathPose {
  expression: CathExpression
  /** CSS class (shared/cath/cath.css) that moves her body: cheer hop, slump, lean-in. */
  motion: 'lean' | 'hop' | 'slump' | 'sway' | 'ponder' | 'start'
}

export const MOMENTS: Record<CathMoment, CathPose> = {
  intro: { expression: 'smirk', motion: 'lean' },
  win: { expression: 'delighted', motion: 'hop' },
  perfect: { expression: 'wink', motion: 'hop' },
  lose: { expression: 'worried', motion: 'slump' },
  'chapter-end': { expression: 'smirk', motion: 'sway' },
  thinking: { expression: 'determined', motion: 'ponder' },
  warning: { expression: 'worried', motion: 'start' },
}

/** The moment for a finished level: stars out of `max` (a full score is `perfect`). */
export function momentForResult(won: boolean, stars = 0, max = 3): CathMoment {
  if (!won) return 'lose'
  return stars >= max ? 'perfect' : 'win'
}

export function cathSceneSvg(moment: CathMoment, options: Omit<CathOptions, 'expression'> = {}): string {
  const pose = MOMENTS[moment]
  const className = `cath-scene cath-move-${pose.motion}${options.className ? ` ${options.className}` : ''}`
  return cathSvg({ framing: 'half', animate: true, ...options, expression: pose.expression, className })
}

/** Swap a mounted scene to a new moment (re-renders the SVG so the new pose animation restarts). */
export function setCathMoment(host: Element, moment: CathMoment, options: Omit<CathOptions, 'expression'> = {}): void {
  host.innerHTML = cathSceneSvg(moment, options)
  host.setAttribute('data-moment', moment)
}
