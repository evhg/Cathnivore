import { describe, expect, it } from 'vitest'
import { LAYOUTS, layoutConfig, type LayoutId } from '../src/content/layouts'
import { createGame } from '../src/engine/state'
import type { GameConfig } from '../src/engine/types'
import { openingPieces, openingState, setupConfig } from '../src/ui/openingPreview'

// Plan item 502: the Setup's opening preview is the board Start deals.
const MAPS = Object.keys(LAYOUTS) as LayoutId[]
const LEVELS: GameConfig['difficulty'][] = ['easy', 'normal', 'hard']

describe('opening preview (plan item 502)', () => {
  it('covers three maps', () => expect(MAPS).toHaveLength(3))
  for (const layout of MAPS)
    for (const difficulty of LEVELS)
      it(`${layout} at ${difficulty}: the preview's pieces match createGame`, () => {
        for (const seed of [1, 4242, 987654321]) {
          const picks = { producers: ['mara', 'tomas'] as const, difficulty, layout, marketEvent: 'glut' as const }
          const dealt = createGame({ producers: ['mara', 'tomas'], difficulty, ...layoutConfig(layout, seed), marketEvent: 'glut' }, seed)
          const preview = openingState(picks, seed)
          expect(openingPieces(preview)).toEqual(openingPieces(dealt))
          expect(preview.config).toEqual(dealt.config)
          const pieces = Object.values(openingPieces(preview))
          expect(pieces.reduce((a, p) => a + p!.outlets, 0)).toBeGreaterThanOrEqual(pieces.length)
          expect(pieces.reduce((a, p) => a + p!.stalls, 0)).toBeGreaterThan(0)
        }
      })
  it('Start and the preview build one config', () => {
    const picks = { producers: ['ines', 'sol'] as const, difficulty: 'hard' as const, layout: 'delta' as const, marketEvent: 'festival' as const }
    expect(openingState(picks, 77).config).toEqual(setupConfig(picks, 77))
  })
  it('with no producer picked, Hollowell is dealt and no stall stands', () => {
    const state = openingState({ producers: [], difficulty: 'normal', layout: 'ring', marketEvent: 'drought' }, 5)
    const pieces = Object.values(openingPieces(state))
    expect(pieces.every((p) => p!.stalls === 0)).toBe(true)
    expect(pieces.reduce((a, p) => a + p!.outlets, 0)).toBeGreaterThan(0)
  })
})
