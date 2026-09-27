import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_PRODUCER_IDS, RECOMMENDED_PAIR } from '../src/content/producers'

// SPEC 6: "The setup screen suggests the pair with the best balance data, labelled 'Recommended.'"
// This test guards against RECOMMENDED_PAIR drifting away from what BALANCE.md's own numbers say,
// by parsing the most recent large-enough MCTSBot/Normal/all-pairs run logged there and checking that
// pair's win rate is the highest of the 6. If a future balance-loop run changes the leader, this test
// will fail and `RECOMMENDED_PAIR` (src/content/producers.ts) needs updating to match, along with its
// comment.
//
// MIN_GAMES_FOR_LEADER (2026-09-27): a 200-game run splits into ~33 games per pair, whose win-rate
// standard error (~9 points at p=0.5) is large enough that a single such run can show a different
// "leader" than dozens of prior 200+/1000-game runs did, purely from sampling noise (confirmed the
// same session this constant was added: a 200-game run showed mara+sol ahead of the long-standing
// mara+tomas leader by 7.6 points, a swing well inside that noise band). Requiring a larger sample
// before trusting an entry as authoritative avoids flip-flopping SPEC 6's actual player-facing guidance
// on noise; a genuine leadership change should show up consistently at this size, not just once.
const MIN_GAMES_FOR_LEADER = 300

describe('RECOMMENDED_PAIR', () => {
  it('is one of the 6 valid 2-producer pairs', () => {
    const [a, b] = RECOMMENDED_PAIR
    expect(a).not.toBe(b)
    expect(ALL_PRODUCER_IDS).toContain(a)
    expect(ALL_PRODUCER_IDS).toContain(b)
  })

  it(`matches the win-rate leader of the latest >=${MIN_GAMES_FOR_LEADER}-game MCTSBot/Normal/all-pairs run in BALANCE.md`, () => {
    const balanceMd = readFileSync(join(__dirname, '../BALANCE.md'), 'utf8')
    const entries = balanceMd.split(/\n## /).slice(1)

    // Find the most recent entry (entries are chronological, newest last) that is a large-enough
    // MCTSBot/Normal/all-pairs run with a per-pair breakdown.
    let latestPairLine: string | undefined
    for (const entry of entries) {
      const isMctsNormalAll =
        /"bot":"mcts"/.test(entry) && /"difficulty":"normal"/.test(entry) && /"pairs":"all"/.test(entry)
      const gamesMatch = entry.match(/"games":(\d+)/)
      const isLargeEnough = gamesMatch !== null && Number.parseInt(gamesMatch[1]!, 10) >= MIN_GAMES_FOR_LEADER
      const pairLineMatch = entry.match(/win rate by pair: (.+)/)
      if (isMctsNormalAll && isLargeEnough && pairLineMatch) {
        latestPairLine = pairLineMatch[1]
      }
    }

    expect(latestPairLine).toBeDefined()

    const pairWinRates = latestPairLine!
      .split(', ')
      .map((part) => {
        const [pair, rate] = part.split('=')
        return { pair: pair!.trim(), rate: Number.parseFloat(rate!) }
      })

    expect(pairWinRates).toHaveLength(6)

    const leader = pairWinRates.reduce((best, cur) => (cur.rate > best.rate ? cur : best))
    const recommendedKey = [...RECOMMENDED_PAIR].sort().join('+')

    expect(leader.pair).toBe(recommendedKey)
  })
})
