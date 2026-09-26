import { REGIONS } from '../content/map'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { countLiberated } from '../engine/pieces'
import type { GameState, RegionType } from '../engine/types'

const MAX_TRUST = 15
const ENEMY_POOL_WEIGHT_TOTAL = 30 + 12 * 2 + 30 // outlets + 2*buyouts + doubt, matching the pools' max
const WIN_REGIONS = 5

function matchesType(types: RegionType[], type: RegionType): boolean {
  return types.includes(type)
}

// SPEC 9.2: "a weighted mix of liberated regions and progress towards Kingsmarket, the margin on Public
// Trust, the margin on Lost Land, progress relative to rounds remaining, total production, enemy pieces
// on the map (negative) and Stall coverage of the next Squeeze regions." Weights are a starting point —
// SPEC 9.2 says to tune them by self-play once the balance loop (M4) can measure MCTSBot's win rate.
const CONTRACT_PENALTY = 0.05

const WEIGHTS = {
  liberated: 0.35,
  trust: 0.15,
  lostLand: 0.15,
  pace: 0.15,
  production: 0.1,
  enemyPieces: 0.02,
  squeezeCoverage: 0.05,
  expandCoverage: 0.03,
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

export function evaluate(state: GameState): number {
  if (state.result) return state.result.won ? 1 : 0

  const liberated = countLiberated(state)
  const kingsmarketBonus = state.regions.kingsmarket.liberated ? 1 / WIN_REGIONS : 0
  const liberatedScore = clamp01(liberated / WIN_REGIONS + kingsmarketBonus)

  const trustScore = clamp01(state.publicTrust / MAX_TRUST)

  const startingLostLandPool = state.config.lostLandPoolOverride ?? DIFFICULTY_SETTINGS[state.config.difficulty].lostLandPool
  const lostLandScore = clamp01(state.lostLandPool / startingLostLandPool)

  // "On pace" when the shortfall to win (regions still needed) is no larger than the rounds still left.
  // Rounds left is the Pressure deck's own remaining length, not a hardcoded 10: SPEC 4.8's loss condition
  // ("the Scout step needs a Pressure card and the deck is empty") ties the real round cap directly to the
  // deck, one card consumed per round's Scout — and campaign chapters script decks of other lengths (6, 8,
  // 14 cards; see src/content/chapters.ts), so a fixed 10-round assumption was wrong for every chapter but
  // 4 and 6. Matches the old `NORMAL_ROUND_CAP - state.round` exactly for the standard 10-card game (the
  // setup Scout consumes 1 card before round 1, then 1 more per round's own Scout step), so full-game/Quick
  // Game bot behavior and every existing balance-loop measurement are unaffected.
  const regionsNeeded = Math.max(0, WIN_REGIONS - liberated)
  const roundsLeft = state.pressureDeck.length
  const paceScore = clamp01(1 - Math.max(0, regionsNeeded - roundsLeft) / WIN_REGIONS)

  const producers = Object.values(state.producers)
  const totalProduction = producers.reduce((sum, p) => sum + p.production.produce + p.production.marks + p.production.goodwill, 0)
  const productionScore = clamp01(totalProduction / (producers.length * 15))

  let enemyPieces = 0
  for (const id of state.config.activeRegions) {
    const r = state.regions[id]
    enemyPieces += r.outlets + 2 * r.buyouts + r.doubt
  }
  const enemyScore = clamp01(1 - enemyPieces / ENEMY_POOL_WEIGHT_TOTAL)

  const squeezeTypes = state.squeeze?.regionTypes ?? []
  const squeezeTargets = state.config.activeRegions.filter(
    (id) => !state.regions[id].liberated && matchesType(squeezeTypes, REGIONS[id].type),
  )
  const squeezeCoverageScore =
    squeezeTargets.length === 0
      ? 1
      : clamp01(squeezeTargets.filter((id) => Object.values(state.regions[id].stalls).some((n) => (n ?? 0) > 0)).length / squeezeTargets.length)

  // SPEC 9.2 also credits HeuristicBot with "protecting regions in the ... Expand slot," but unlike
  // `squeezeCoverageScore` (which rewards Stall coverage — Squeeze's own Defence stat), Expand's rule
  // (4.7) only escalates a region that "has at least 1 enemy piece" there already; a region with none is
  // untouched by Expand regardless of Stalls. So the matching defensive signal for Expand is "cleared,"
  // not "occupied": reward having no enemy pieces left in an Expand-targeted region before it resolves.
  const expandTypes = state.expand?.regionTypes ?? []
  const expandTargets = state.config.activeRegions.filter(
    (id) => !state.regions[id].liberated && matchesType(expandTypes, REGIONS[id].type),
  )
  const expandCoverageScore =
    expandTargets.length === 0
      ? 1
      : clamp01(
          expandTargets.filter((id) => {
            const r = state.regions[id]
            return r.outlets === 0 && r.buyouts === 0 && r.doubt === 0
          }).length / expandTargets.length,
        )

  const base = clamp01(
    WEIGHTS.liberated * liberatedScore +
      WEIGHTS.trust * trustScore +
      WEIGHTS.lostLand * lostLandScore +
      WEIGHTS.pace * paceScore +
      WEIGHTS.production * productionScore +
      WEIGHTS.enemyPieces * enemyScore +
      WEIGHTS.squeezeCoverage * squeezeCoverageScore +
      WEIGHTS.expandCoverage * expandCoverageScore,
  )

  // SPEC 8.2/7 chapter 3's twist: once revealed, an owned "Wholesome Hollow Contract" is a *future*
  // liability (it floods its owner's home region with Outlets every round from here on) that a 1-ply
  // evaluation otherwise can't see — tearing one up costs marks/production right now for a payoff only
  // visible next round, so without this term a greedy bot never tears one up until the damage is already
  // done (observed directly: HeuristicBot's chapter-3 win rate was 0% before this term existed). Zero
  // everywhere else in the game, since `wholesomeHollowRevealed` is otherwise always false.
  if (state.wholesomeHollowRevealed) {
    const contracts = producers.reduce(
      (n, p) => n + p.improvements.filter((id) => id === 'wholesome-hollow-contract').length,
      0,
    )
    return clamp01(base - contracts * CONTRACT_PENALTY)
  }
  return base
}
