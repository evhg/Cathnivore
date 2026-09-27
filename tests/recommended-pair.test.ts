import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_PRODUCER_IDS, RECOMMENDED_PAIR } from '../src/content/producers'

// SPEC 6: "The setup screen suggests the pair with the best balance data, labelled 'Recommended.'"
// This test guards against RECOMMENDED_PAIR drifting away from what BALANCE.md's own numbers say,
// by parsing the most recent MCTSBot/Normal/all-pairs run logged there and checking that pair's win
// rate is the highest of the 6. If a future balance-loop run changes the leader, this test will fail
// and `RECOMMENDED_PAIR` (src/content/producers.ts) needs updating to match, along with its comment.
describe('RECOMMENDED_PAIR', () => {
  it('is one of the 6 valid 2-producer pairs', () => {
    const [a, b] = RECOMMENDED_PAIR
    expect(a).not.toBe(b)
    expect(ALL_PRODUCER_IDS).toContain(a)
    expect(ALL_PRODUCER_IDS).toContain(b)
  })

  it('matches the win-rate leader of the latest MCTSBot/Normal/all-pairs run in BALANCE.md', () => {
    const balanceMd = readFileSync(join(__dirname, '../BALANCE.md'), 'utf8')
    const entries = balanceMd.split(/\n## /).slice(1)

    // Find the most recent entry (entries are chronological, newest last) that is an
    // MCTSBot/Normal/all-pairs run with a per-pair breakdown.
    let latestPairLine: string | undefined
    for (const entry of entries) {
      const isMctsNormalAll =
        /"bot":"mcts"/.test(entry) && /"difficulty":"normal"/.test(entry) && /"pairs":"all"/.test(entry)
      const pairLineMatch = entry.match(/win rate by pair: (.+)/)
      if (isMctsNormalAll && pairLineMatch) {
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
