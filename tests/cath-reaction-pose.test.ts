import { describe, expect, it } from 'vitest'
import { CATH_REACTION_EXPRESSION, CATH_REACTION_POSE } from '../src/content/cathCompanionLines'
import { CATH_POSES } from '../shared/cath/cath'

// Plan item 276: Cath reacts at the table with her body as well as her face.
describe('Cath reaction poses', () => {
  it('maps every reaction to a pose she has', () => {
    for (const r of Object.keys(CATH_REACTION_EXPRESSION)) expect(CATH_POSES).toContain(CATH_REACTION_POSE[r as keyof typeof CATH_REACTION_POSE])
  })
  it('gives six or more events five or more distinct poses, none of them her resting one', () => {
    const poses = Object.values(CATH_REACTION_POSE)
    expect(poses.length).toBeGreaterThanOrEqual(6)
    expect(new Set(poses).size).toBeGreaterThanOrEqual(5)
    expect(poses).not.toContain('clasped')
  })
  it('matches pose to mood: a cheer is never worried, a hand to the chin never delighted', () => {
    for (const [r, pose] of Object.entries(CATH_REACTION_POSE)) {
      const face = CATH_REACTION_EXPRESSION[r as keyof typeof CATH_REACTION_EXPRESSION]
      if (pose === 'cheer') expect(face).not.toBe('worried')
      if (pose === 'thinking') expect(face).not.toBe('delighted')
    }
  })
})
