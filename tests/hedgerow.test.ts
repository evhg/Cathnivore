import { describe, expect, it } from 'vitest'
import {
  STEP,
  TOWERS,
  isPlot,
  newGame,
  place,
  pointAt,
  sell,
  sellValue,
  sendWave,
  stars,
  stepGame,
  towerAt,
  upgrade,
  type Game,
  type Level,
} from '../games/hedgerow/src/engine'
import { LEVELS } from '../games/hedgerow/src/levels'
import { emptySave, isUnlocked, parseSave, recordStars } from '../games/hedgerow/src/store'

/** A simple greedy player: spend everything, scarecrows on the plots that see the most lane. */
function plotsByCoverage(level: Level): Array<[number, number]> {
  const cells: Array<{ c: number; r: number; score: number }> = []
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!isPlot(level, c, r)) continue
      let score = 0
      for (let d = 0; d < 40; d += 0.5) {
        const p = pointAt(level.path, d)
        if (Math.hypot(c + 0.5 - p.x, r + 0.5 - p.y) <= 2.4) score++
      }
      cells.push({ c, r, score })
    }
  }
  return cells.sort((a, b) => b.score - a.score).map((x) => [x.c, x.r])
}

function play(level: Level, build: boolean): Game {
  const game = newGame(level)
  const plots = plotsByCoverage(level)
  let guard = 0
  while (game.phase !== 'won' && game.phase !== 'lost' && guard++ < 200_000) {
    if (game.phase === 'build') {
      if (build) {
        let bought = true
        while (bought) {
          bought = false
          const scarecrows = game.towers.filter((t) => t.kind === 'scarecrow').length
          const hedges = game.towers.filter((t) => t.kind === 'hedgerow').length
          const kind = hedges < Math.floor(scarecrows / 2) ? 'hedgerow' : 'scarecrow'
          const spot = plots.find(([c, r]) => !towerAt(game, c, r))
          if (spot && place(game, kind, spot[0], spot[1]).ok) bought = true
          else {
            const weakest = [...game.towers].sort((a, b) => a.tier - b.tier)[0]
            if (weakest && upgrade(game, weakest.id).ok) bought = true
          }
        }
      }
      sendWave(game)
    }
    stepGame(game)
  }
  return game
}

describe('hedgerow engine', () => {
  const level = LEVELS[0]!

  it('places, upgrades and sells towers with the right costs', () => {
    const game = newGame(level)
    expect(place(game, 'scarecrow', 0, 0).ok).toBe(true)
    expect(game.marks).toBe(level.startMarks - TOWERS.scarecrow.cost)
    expect(place(game, 'scarecrow', 0, 0).ok).toBe(false)
    const id = game.towers[0]!.id
    expect(upgrade(game, id).ok).toBe(true)
    expect(game.towers[0]!.tier).toBe(2)
    const before = game.marks
    expect(sell(game, id).ok).toBe(true)
    expect(game.marks).toBe(before + Math.floor((TOWERS.scarecrow.cost + TOWERS.scarecrow.upgrades[0]) * 0.7))
    expect(sellValue({ ...game.towers[0]!, spent: 100 } as never)).toBe(70)
  })

  it('refuses builds on the lane, off the map and beyond the budget', () => {
    const game = newGame(level)
    expect(place(game, 'scarecrow', 2, 1).ok).toBe(false)
    expect(place(game, 'scarecrow', -1, 0).ok).toBe(false)
    game.marks = 10
    expect(place(game, 'hedgerow', 0, 0).ok).toBe(false)
  })

  it('is deterministic: the same build order gives the same result', () => {
    const a = play(level, true)
    const b = play(level, true)
    expect([a.tick, a.goodwill, a.marks]).toEqual([b.tick, b.goodwill, b.marks])
  })

  it('a slowed enemy covers less ground', () => {
    const g1 = newGame(level)
    const g2 = newGame(level)
    place(g2, 'hedgerow', 0, 0)
    for (const g of [g1, g2]) {
      sendWave(g)
      for (let i = 0; i < 60; i++) stepGame(g)
    }
    expect(g2.enemies[0]!.dist).toBeLessThan(g1.enemies[0]!.dist)
    expect(STEP).toBeCloseTo(1 / 30)
  })

  for (const lv of LEVELS) {
    it(`level ${lv.id} (${lv.name}): lanes are connected and it is winnable, but not for free`, () => {
      for (let i = 1; i < lv.path.length; i++) {
        const [ax, ay] = lv.path[i - 1]!
        const [bx, by] = lv.path[i]!
        expect(ax === bx || ay === by).toBe(true)
        for (const [x, y] of lv.path) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThan(lv.cols)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThan(lv.rows)
        }
      }
      expect(play(lv, false).phase).toBe('lost')
      const won = play(lv, true)
      expect(won.phase).toBe('won')
      expect(stars(won)).toBeGreaterThanOrEqual(1)
    })
  }
})

describe('hedgerow saves', () => {
  it('starts empty, repairs junk and keeps the best stars', () => {
    expect(parseSave(null)).toEqual(emptySave())
    expect(parseSave('{not json')).toEqual(emptySave())
    expect(parseSave(JSON.stringify({ stars: { '1': 9, '2': 2, '3': 'x' }, seenBefore: { '1': true, '2': 1 } }))).toEqual({
      version: 1,
      stars: { '2': 2 },
      seenBefore: { '1': true },
    })
    const data = emptySave()
    recordStars(data, 1, 3)
    recordStars(data, 1, 1)
    expect(data.stars['1']).toBe(3)
  })

  it('unlocks level n only after level n-1 is cleared', () => {
    const data = emptySave()
    expect(isUnlocked(data, 1)).toBe(true)
    expect(isUnlocked(data, 2)).toBe(false)
    data.stars['1'] = 1
    expect(isUnlocked(data, 2)).toBe(true)
  })
})
