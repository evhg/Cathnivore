import { describe, expect, it } from 'vitest'
import { boardCode, parseBoardCode } from '../games/runnel/src/code'

describe('runnel board codes', () => {
  it('round-trips a practice seed', () => {
    const seed = 'practice-medium-lq8x1f-k2j9a'
    const code = boardCode(seed)!
    expect(code).toBe('M-lq8x1f-k2j9a')
    expect(parseBoardCode(code)).toEqual({ size: 'medium', seed })
  })
  it('accepts pasted case and spaces', () => {
    expect(parseBoardCode('  l-AB12-cd34 ')?.size).toBe('large')
  })
  it('rejects daily seeds and junk', () => {
    expect(boardCode('daily-2026-10-31')).toBeNull()
    expect(parseBoardCode('hello')).toBeNull()
    expect(parseBoardCode('X-ab-cd')).toBeNull()
  })
})
