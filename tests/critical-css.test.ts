import { describe, expect, it } from 'vitest'
import { reachable, splitCritical } from '../scripts/critical-css'

const gameOnly = (cls: string) => cls === 'board' || cls === 'chip'

describe('critical CSS split (gate 7)', () => {
  it('defers a rule only when every selector needs a game-only class', () => {
    const css = '.title{color:red}.board .cell{color:blue}.board,.title h1{margin:0}.chip:hover{top:0}'
    const { critical, moved } = splitCritical(css, gameOnly)
    expect(moved).toBe(2)
    expect(critical).toContain('.title{color:red}')
    expect(critical).toContain('.board,.title h1{margin:0}')
    expect(critical).not.toContain('.board .cell')
    expect(critical).not.toContain('.chip:hover')
  })

  it('ignores classes inside :not(), :is(), :where() and :has()', () => {
    const css = '.title:not(.board){a:b}:is(.chip) .x{a:b}.title:has(.chip){a:b}'
    expect(splitCritical(css, gameOnly).moved).toBe(0)
  })

  it('drops at-rules the split empties and keeps keyframes and font faces', () => {
    const css = '@media (min-width:600px){.board{a:b}}@media print{.title{a:b}}@keyframes board{0%{a:b}}@font-face{font-family:x}'
    const { critical } = splitCritical(css, gameOnly)
    expect(critical).not.toContain('min-width:600px')
    expect(critical).toContain('@media print{.title{a:b}}')
    expect(critical).toContain('@keyframes board{0%{a:b}}')
    expect(critical).toContain('@font-face')
  })

  it('counts a class as reachable when a template-literal prefix of it appears elsewhere', () => {
    const elsewhere = new Set(['a', 'tone-', 'title'])
    expect(reachable('title', elsewhere)).toBe(true)
    expect(reachable('a1', elsewhere)).toBe(true)
    expect(reachable('tone-wood', elsewhere)).toBe(true)
    expect(reachable('board', elsewhere)).toBe(false)
    expect(reachable('ab1', elsewhere)).toBe(false)
  })
})
