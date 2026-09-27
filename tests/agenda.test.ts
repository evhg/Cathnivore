import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { runEnemyTurn } from '../src/engine/enemy'
import { AGENDA_CARDS_BY_ID } from '../src/content/agenda'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

// SPEC 4.8: "Liberated regions ignore Scout and Expand. Agenda cards cannot place pieces there unless
// the card says 'even liberated regions.'" None of these three cards say that, so their piece-placing
// effects must never target a liberated region, even when it would otherwise be the chosen target
// (most/fewest Stalls, most Outlets).
describe('Agenda effects respect the liberated-region exemption (SPEC 4.8)', () => {
  it('"Candor-funded study finds \'natural\' is a risk factor\' bonus never adds Doubt to a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    // Give Brindle Hills (Mara's home) the most Stalls on the board and liberate it.
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, stalls: { mara: 3 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const card = AGENDA_CARDS_BY_ID.get('candor-natural-risk-factor')!
    const after = card.bonusEffect!(state)
    expect(after.regions.brindleHills.doubt).toBe(0)
  })

  it('"Candor\'s study was peer-reviewed" effect never adds Doubt to a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, stalls: { mara: 3 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
    const card = AGENDA_CARDS_BY_ID.get('candor-peer-reviewed-by-us')!
    const after = card.effect(state)
    expect(after.regions.brindleHills.doubt).toBe(0)
  })

  it('"Sunny the Silo" bonus never adds a Buyout to a liberated region', () => {
    let state = createGame(FULL_CONFIG, 1)
    // Liberated regions always have 0 Outlets, so give a non-liberated region the most Outlets instead,
    // and confirm the liberated region (0 outlets, tied for "most" only if the reducer is unscoped) is
    // never targeted regardless.
    state = {
      ...state,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
        highmoor: { ...state.regions.highmoor, outlets: 3 },
      },
    }
    const card = AGENDA_CARDS_BY_ID.get('hollowell-sunny-the-silo')!
    const after = card.bonusEffect!(state)
    expect(after.regions.brindleHills.buyouts).toBe(0)
    expect(after.regions.highmoor.buyouts).toBe(1)
  })
})

// SPEC 4.7 Rift 3 "Cracks": "Agenda bonus effects are skipped." Runs the real enemy-turn path
// (`runEnemyTurn`, not the card's `effect`/`bonusEffect` called directly) so the check under test is
// `enemy.ts`'s `resolveAgenda`, at the moment the bonus would apply. Squeeze/Expand are disabled so their
// own Buyout-adding effects (SPEC 4.7 Expand) can't be mistaken for the Agenda bonus's.
describe('Rift 3 "Cracks" skips Agenda bonus effects but not the main effect (SPEC 4.7)', () => {
  const config: GameConfig = {
    ...FULL_CONFIG,
    rulesEnabled: { agenda: true, squeeze: false, expand: false, sell: true, improvements: true, schemes: true, roles: true, rebut: true },
  }

  function totalOutlets(state: ReturnType<typeof createGame>): number {
    return state.config.activeRegions.reduce((sum, id) => sum + state.regions[id].outlets, 0)
  }
  function totalBuyouts(state: ReturnType<typeof createGame>): number {
    return state.config.activeRegions.reduce((sum, id) => sum + state.regions[id].buyouts, 0)
  }

  // "Sunny the Silo": effect adds 1 Outlet to every non-liberated region; bonus adds 1 Buyout to whichever
  // region then has the most Outlets. The two are easy to tell apart (different piece kind), which is why
  // this card is used here and in the liberated-region tests above.
  function forceCard(state: ReturnType<typeof createGame>, id: string): ReturnType<typeof createGame> {
    return { ...state, agendaDeck: [id, ...state.agendaDeck.filter((c) => c !== id)] }
  }

  it('still fires the main effect while skipping the bonus once Rift reaches 3', () => {
    let state = createGame(config, 1)
    state = forceCard({ ...state, rift: 3 }, 'hollowell-sunny-the-silo')
    const outletsBefore = totalOutlets(state)
    const buyoutsBefore = totalBuyouts(state)

    state = runEnemyTurn(state)

    expect(totalOutlets(state)).toBeGreaterThan(outletsBefore) // main effect still applied
    expect(totalBuyouts(state)).toBe(buyoutsBefore) // bonus (would add a Buyout) skipped
    const entry = state.log.find((e) => e.type === 'agenda')
    expect(entry).toEqual({ type: 'agenda', cardId: 'hollowell-sunny-the-silo', bonusSkipped: true })
  })

  it('fires both the main effect and the bonus below Rift 3', () => {
    let state = createGame(config, 1)
    state = forceCard({ ...state, rift: 2 }, 'hollowell-sunny-the-silo')
    const buyoutsBefore = totalBuyouts(state)

    state = runEnemyTurn(state)

    expect(totalBuyouts(state)).toBeGreaterThan(buyoutsBefore) // bonus applied
    const entry = state.log.find((e) => e.type === 'agenda')
    expect(entry).toEqual({ type: 'agenda', cardId: 'hollowell-sunny-the-silo', bonusSkipped: false })
  })
})

// SPEC 4.8: "Lose immediately if: Public Trust reaches 0." An Agenda effect can drop Public Trust to 0 on
// its own (e.g. "Candor-funded study finds 'natural' is a risk factor'"'s -1 per 2+-Doubt region). Squeeze
// is disabled here specifically so `resolveSqueeze`'s own incidental Public-Trust check (the only other
// place the engine checked this) can't be mistaken for a real, general check.
describe('Public Trust hitting 0 from an Agenda effect ends the game immediately (SPEC 4.8)', () => {
  it('sets result.lossReason to publicTrust without ever reaching Squeeze/Expand/Scout', () => {
    const config: GameConfig = {
      ...FULL_CONFIG,
      rulesEnabled: { agenda: true, squeeze: false, expand: false, sell: true, improvements: true, schemes: true, roles: true, rebut: true },
    }
    let state = createGame(config, 1)
    state = {
      ...state,
      publicTrust: 1,
      regions: {
        ...state.regions,
        brindleHills: { ...state.regions.brindleHills, doubt: 2 },
        highmoor: { ...state.regions.highmoor, doubt: 2 },
      },
    }
    state = { ...state, agendaDeck: ['candor-natural-risk-factor', ...state.agendaDeck.filter((c) => c !== 'candor-natural-risk-factor')] }

    const after = runEnemyTurn(state)

    expect(after.publicTrust).toBe(0)
    expect(after.result?.won).toBe(false)
    expect(after.result?.lossReason).toBe('publicTrust')
    expect(after.result?.regionsLiberated).toBe(0)
  })
})
