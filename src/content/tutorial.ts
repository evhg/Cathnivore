import type { Action } from '../engine/types'
import type { TutorialExpect, TutorialStep, TutorialTarget } from './chapters'

// The guided tutorial's pure rules (chapter 1, `Chapter.guided`): how a step completes, what it lets the
// player do, and where a reloaded game picks the script back up. The UI half is ui/TutorialCoach.tsx.

export type TutorialMode = 'action' | 'enemyTurn' | 'next'

export function stepMode(step: TutorialStep): TutorialMode {
  if (step.expect) return 'action'
  if (step.waitFor === 'enemyTurn') return 'enemyTurn'
  return 'next'
}

function actionRegion(action: Action): string | undefined {
  if ('region' in action) return action.region
  if ('targetRegion' in action) return action.targetRegion
  return undefined
}

// The completion predicate: `action` is the one this step asks for.
export function matchesExpect(expect: TutorialExpect, action: Action): boolean {
  if (action.kind !== expect.kind) return false
  if (expect.region !== undefined && actionRegion(action) !== expect.region) return false
  if (expect.count !== undefined && (!('count' in action) || action.count !== expect.count)) return false
  return true
}

// The action the panel offers while this step shows: its own, or for an explain-only step the next
// one the script will ask for (so the panel doesn't jump about between steps; it stays disabled
// behind the spotlight until its own step comes).
export function upcomingExpect(steps: readonly TutorialStep[], index: number): TutorialExpect | undefined {
  for (let i = index; i < steps.length; i++) {
    const step = steps[i]!
    if (step.expect) return step.expect
    if (step.waitFor) return undefined
  }
  return undefined
}

// A reloaded game replays its saved actions, so the script resumes just after the last action step
// already taken. An enemy-turn step straight after it is skipped: its playback was already shown (or
// lost with the reload) and won't play again.
export function resumeIndex(steps: readonly TutorialStep[], actionsTaken: number): number {
  if (actionsTaken <= 0) return 0
  let seen = 0
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i]!.expect) continue
    seen += 1
    if (seen === actionsTaken) {
      let next = i + 1
      if (steps[next]?.waitFor === 'enemyTurn') next += 1
      return next
    }
  }
  // More actions than the script has: the player is past the tutorial.
  return steps.length
}

// The `data-tutorial` id Game.tsx puts on the element a target names. An `action` target moves with the
// phase of the action: its button, then the glowing region (targeting mode), then Confirm.
export function tutorialTargetId(target: TutorialTarget | undefined, phase: 'button' | 'region' | 'confirm' = 'button', region?: string): string | null {
  if (!target) return null
  if (target.kind === 'region') return `region-${target.region}`
  if (target.kind === 'ui') return target.id
  if (phase === 'region' && region) return `region-${region}`
  if (phase === 'confirm') return 'confirm'
  return 'action'
}
