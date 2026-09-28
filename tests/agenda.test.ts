import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { runEnemyTurn } from '../src/engine/enemy'
import { validate } from '../src/engine/api'
import { AGENDA_CARDS, AGENDA_CARDS_BY_ID } from '../src/content/agenda'
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

// SPEC 4.8's exemption applies to every Agenda card, including the several that target Kingsmarket by a
// literal id rather than a computed "most/fewest Stalls" pick — those don't go through the same
// `nonLiberated()` filter and were found to bypass the check entirely (fixed alongside this test).
describe('Agenda cards that target Kingsmarket by id respect the liberated-region exemption (SPEC 4.8)', () => {
  function liberatedKingsmarket(state: ReturnType<typeof createGame>) {
    return {
      ...state,
      regions: {
        ...state.regions,
        kingsmarket: { ...state.regions.kingsmarket, stalls: { mara: 1 }, outlets: 0, buyouts: 0, doubt: 0, liberated: true, everLiberated: true },
      },
    }
  }

  const cases: Array<{ id: string; kind: 'bonusEffect' | 'effect'; field: 'outlets' | 'buyouts' | 'doubt' }> = [
    { id: 'hollowell-farmhouse-range', kind: 'bonusEffect', field: 'buyouts' },
    { id: 'hollowell-loyalty-card', kind: 'bonusEffect', field: 'outlets' },
    { id: 'hollowell-listening-tour', kind: 'bonusEffect', field: 'doubt' },
    { id: 'hollowell-store-opening', kind: 'effect', field: 'outlets' },
    { id: 'hollowell-friendly-buyout-offer', kind: 'bonusEffect', field: 'outlets' },
    { id: 'candor-clarifies-clarification', kind: 'effect', field: 'doubt' },
    { id: 'candor-independent-panel', kind: 'effect', field: 'doubt' },
  ]

  for (const { id, kind, field } of cases) {
    it(`"${id}"'s ${kind} never adds a piece to a liberated Kingsmarket`, () => {
      const state = liberatedKingsmarket(createGame(FULL_CONFIG, 1))
      const card = AGENDA_CARDS_BY_ID.get(id)!
      const after = card[kind]!(state)
      expect(after.regions.kingsmarket[field]).toBe(0)
      expect(after.regions.kingsmarket.liberated).toBe(true)
    })
  }
})

// SPEC 11.4 gate 2: "a unit test for every ... Agenda card." A fresh audit found 14 of the 24 cards had no
// test anywhere that called their `effect`/`bonusEffect` at all (only the liberated-region-exemption tests
// above touch a handful of them, and only for that one property). Closes it generically: every card's
// `effect` and `bonusEffect` are called directly against the real post-setup board (varied Stalls/Outlets/
// Doubt/Buyouts across regions, so "most/fewest Stalls"/"2+ Outlets, no Buyout" extremal picks all have a
// real answer), and the result must never violate `validate()`'s invariants.
describe('Every Agenda card resolves cleanly (SPEC 11.4 gate 2)', () => {
  for (const card of AGENDA_CARDS) {
    it(`${card.id}: effect and bonusEffect are both invariant-clean`, () => {
      const state = createGame(FULL_CONFIG, 3)
      expect(validate(card.effect(state))).toEqual([])
      expect(validate(card.bonusEffect(state))).toEqual([])
    })
  }
})

// SPEC 11.4 gate 2: the "resolves cleanly" loop above only checks validate() never fails — it never asserts
// what a card actually *does*. A follow-up audit found 14 of the 24 cards had no test asserting their
// specific numeric effect anywhere. These are computed by hand against the real SPEC 4.3 setup on
// `createGame(FULL_CONFIG, ...)` (any seed — setup piece placement doesn't depend on the RNG): Kingsmarket
// starts with 2 Outlets/1 Buyout/2 Doubt and 0 Stalls (guarded); every other region starts with 1 Outlet;
// Saltmarsh/Shingle Bay (Coast) also start with 1 Doubt; Brindle Hills (Mara's home, Pasture) and Oakvale
// (Tomas's home, Crop) are the only regions with Stalls (2 each). Ties in the "fewest Stalls" extremal pick
// resolve to the first region in activeRegions order (Kingsmarket), since `extremeByStallCount`'s reduce
// keeps the earliest region on a tie.
describe('Every previously-untested Agenda card\'s specific numeric effect (SPEC 11.4 gate 2)', () => {
  it('hollowell-support-local-farmers: converts 1 Outlet to a Buyout in the fewest-Stalls region (Kingsmarket)', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('hollowell-support-local-farmers')!
    const afterEffect = card.effect(state)
    expect(afterEffect.regions.kingsmarket.outlets).toBe(1)
    expect(afterEffect.regions.kingsmarket.buyouts).toBe(2)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.marks).toBe(state.producers.mara.resources.marks - 1)
    expect(afterBonus.producers.tomas.resources.marks).toBe(state.producers.tomas.resources.marks - 1)
  })

  it('hollowell-record-harvests: adds 1 Outlet only to a Pasture region that already has a Stall', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('hollowell-record-harvests')!
    const after = card.effect(state)
    expect(after.regions.brindleHills.outlets).toBe(2) // Pasture, has Mara's Stalls
    expect(after.regions.oakvale.outlets).toBe(1) // Crop, has Tomas's Stalls, but wrong type
    expect(after.regions.highmoor.outlets).toBe(1) // Pasture, but no Stall
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.goodwill).toBe(state.producers.mara.resources.goodwill - 1)
    expect(afterBonus.producers.tomas.resources.goodwill).toBe(state.producers.tomas.resources.goodwill - 1)
  })

  it('hollowell-billboard: adds 1 Doubt only to a Coast region that already has a Stall', () => {
    let state = createGame(FULL_CONFIG, 1)
    state = { ...state, regions: { ...state.regions, saltmarsh: { ...state.regions.saltmarsh, stalls: { mara: 1 } } } }
    const card = AGENDA_CARDS_BY_ID.get('hollowell-billboard')!
    const after = card.effect(state)
    expect(after.regions.saltmarsh.doubt).toBe(2) // Coast, now has a Stall, started at 1
    expect(after.regions.shingleBay.doubt).toBe(1) // Coast, but no Stall
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.produce).toBe(state.producers.mara.resources.produce - 1)
  })

  it('hollowell-trademark-fresh: producers lose Marks, then every non-liberated Crop region gains 1 Outlet', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('hollowell-trademark-fresh')!
    const afterEffect = card.effect(state)
    expect(afterEffect.producers.mara.resources.marks).toBe(state.producers.mara.resources.marks - 1)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.regions.rivermead.outlets).toBe(2)
    expect(afterBonus.regions.oakvale.outlets).toBe(2)
    expect(afterBonus.regions.highmoor.outlets).toBe(1) // Pasture, unaffected
  })

  it('hollowell-value-meal: adds 1 Outlet (unconditionally) to the fewest-Stalls region (Kingsmarket)', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('hollowell-value-meal')!
    const afterEffect = card.effect(state)
    expect(afterEffect.regions.kingsmarket.outlets).toBe(3)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.produce).toBe(state.producers.mara.resources.produce - 1)
  })

  it('hollowell-supply-chain: adds 1 Outlet only to a Crop region that already has a Stall', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('hollowell-supply-chain')!
    const after = card.effect(state)
    expect(after.regions.oakvale.outlets).toBe(2) // Crop, has Tomas's Stalls
    expect(after.regions.rivermead.outlets).toBe(1) // Crop, but no Stall
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.marks).toBe(state.producers.mara.resources.marks - 1)
  })

  it('candor-wellness-app: producers lose Goodwill, then every non-liberated Coast region gains 1 Doubt', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-wellness-app')!
    const afterEffect = card.effect(state)
    expect(afterEffect.producers.mara.resources.goodwill).toBe(state.producers.mara.resources.goodwill - 1)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.regions.saltmarsh.doubt).toBe(2)
    expect(afterBonus.regions.shingleBay.doubt).toBe(2)
  })

  it('candor-more-research-needed: Public Trust -1, then the fewest-Stalls region (Kingsmarket) gains 1 Doubt', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-more-research-needed')!
    const afterEffect = card.effect(state)
    expect(afterEffect.publicTrust).toBe(state.publicTrust - 1)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.regions.kingsmarket.doubt).toBe(3)
  })

  it('candor-balanced-debate: adds 1 Doubt only to a Pasture region that already has a Stall', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-balanced-debate')!
    const after = card.effect(state)
    expect(after.regions.brindleHills.doubt).toBe(1) // Pasture, has Mara's Stalls
    expect(after.regions.highmoor.doubt).toBe(0) // Pasture, but no Stall
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.goodwill).toBe(state.producers.mara.resources.goodwill - 1)
  })

  it('candor-wellness-index: producers lose Produce, then every region with 2+ Outlets (Kingsmarket) gains 1 Doubt', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-wellness-index')!
    const afterEffect = card.effect(state)
    expect(afterEffect.producers.mara.resources.produce).toBe(state.producers.mara.resources.produce - 1)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.regions.kingsmarket.doubt).toBe(3)
    expect(afterBonus.regions.highmoor.doubt).toBe(0) // only 1 Outlet, unaffected
  })

  it('candor-sponsored-segment: adds 1 Doubt to every region with a Stall, of any type', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-sponsored-segment')!
    const after = card.effect(state)
    expect(after.regions.brindleHills.doubt).toBe(1)
    expect(after.regions.oakvale.doubt).toBe(1)
    expect(after.regions.highmoor.doubt).toBe(0)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.publicTrust).toBe(state.publicTrust - 1)
  })

  it('candor-second-opinion-discouraged: Public Trust -1, then producers lose Marks', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-second-opinion-discouraged')!
    const afterEffect = card.effect(state)
    expect(afterEffect.publicTrust).toBe(state.publicTrust - 1)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.marks).toBe(state.producers.mara.resources.marks - 1)
  })

  it('candor-awareness-campaign: adds 1 Doubt to every non-liberated Pasture region, Stall or not', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-awareness-campaign')!
    const after = card.effect(state)
    expect(after.regions.highmoor.doubt).toBe(1) // no Stall, still affected (unlike balanced-debate)
    expect(after.regions.brindleHills.doubt).toBe(1)
    const afterBonus = card.bonusEffect(state)
    expect(afterBonus.producers.mara.resources.produce).toBe(state.producers.mara.resources.produce - 1)
  })

  it('candor-satisfaction-survey: producers lose Goodwill, then Public Trust -1 (capped, not per-region)', () => {
    const state = createGame(FULL_CONFIG, 1)
    const card = AGENDA_CARDS_BY_ID.get('candor-satisfaction-survey')!
    const afterEffect = card.effect(state)
    expect(afterEffect.producers.mara.resources.goodwill).toBe(state.producers.mara.resources.goodwill - 1)
    const afterBonus = card.bonusEffect(state)
    // 3 regions already have Doubt >= 1 at setup (Kingsmarket, Saltmarsh, Shingle Bay), but the loss is
    // capped at 1 regardless of how many qualify.
    expect(afterBonus.publicTrust).toBe(state.publicTrust - 1)
  })
})
