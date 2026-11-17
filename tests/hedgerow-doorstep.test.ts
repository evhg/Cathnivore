import { describe, expect, it } from 'vitest'
import { DOORSTEP_SHOWN, doorstepCleared, doorstepLeak, doorstepRound, doorstepShown, doorstepSwept, newDoorstep, saleBoard } from '../games/hedgerow/src/doorstep'
import { newGame, sendWave, stepGame } from '../games/hedgerow/src/engine'
import { LEVELS } from '../games/hedgerow/src/levels'

// Plan item 480: the step holds one parcel per leak, less one for each clean round after a leak; the win sweeps it.
describe('Hedgerow doorstep (plan item 480)', () => {
  it('counts leaks minus the parcels carted back after clean rounds', () => {
    const d = newDoorstep()
    doorstepRound(d)
    doorstepLeak(d)
    doorstepLeak(d)
    doorstepLeak(d)
    expect(doorstepCleared(d)).toBe(false) // a leaky round carts nothing back
    expect(d.parcels).toBe(3)
    expect(d.card).toBe(true)
    doorstepRound(d)
    expect(doorstepCleared(d)).toBe(true) // a clean round: one goes back
    doorstepRound(d)
    expect(doorstepCleared(d)).toBe(true)
    expect(d).toMatchObject({ parcels: 1, returned: 2 })
    doorstepSwept(d)
    expect(d).toMatchObject({ parcels: 0, card: false })
    doorstepRound(d)
    expect(doorstepCleared(d)).toBe(false) // nothing left to cart
  })

  it('draws at most eight and counts the rest', () => {
    const d = newDoorstep()
    for (let i = 0; i < 11; i++) doorstepLeak(d)
    expect(doorstepShown(d)).toEqual({ shown: DOORSTEP_SHOWN, extra: 3 })
  })

  it('puts the sale board up under a quarter of the Goodwill only', () => {
    expect(saleBoard(20, 20)).toBe(false)
    expect(saleBoard(5, 20)).toBe(false)
    expect(saleBoard(4, 20)).toBe(true)
    expect(saleBoard(0, 20)).toBe(false)
  })

  it('follows a real game: parcels on the step = leaks minus clean-round returns', () => {
    const level = LEVELS.find((l) => l.waves.length >= 4)!
    const g = newGame(level)
    const d = newDoorstep()
    let leaks = 0
    let returns = 0
    for (let tick = 0; tick < 60 * 60 * 20 && g.phase !== 'won' && g.phase !== 'lost'; tick++) {
      if (g.phase !== 'wave') sendWave(g)
      stepGame(g)
      for (const e of g.events.splice(0)) {
        if (e.type === 'wave') doorstepRound(d)
        if (e.type === 'leak') {
          doorstepLeak(d)
          leaks++
        }
        if (e.type === 'cleared' && doorstepCleared(d)) returns++
      }
    }
    expect(leaks).toBeGreaterThan(0)
    expect(d.parcels).toBe(leaks - returns)
  })
})
