import { describe, expect, it } from 'vitest'
import { botFor } from '../sim/simCore'
import { RandomBot } from '../src/ai/random'
import { HeuristicBot } from '../src/ai/heuristic'

// A bad --bot value used to fall through botFor() to MCTSBot silently, mislabeling the report with the
// typo'd name while actually running the slowest bot (see DECISIONS.md). `sim/run.ts`'s own CLI parsing
// now rejects a bad --bot before this ever runs, but `botFor` itself should also fail loudly, since it's
// called directly by `sim/simWorker.ts` too.
describe('botFor (sim/simCore.ts)', () => {
  it('returns the matching bot for each recognized name', () => {
    expect(botFor('random')).toBe(RandomBot)
    expect(botFor('heuristic')).toBe(HeuristicBot)
    expect(botFor('mcts')).toBeTruthy()
  })

  it('throws on an unrecognized bot name instead of silently defaulting to MCTS', () => {
    // @ts-expect-error deliberately passing an invalid BotName to exercise the runtime guard
    expect(() => botFor('heuristc')).toThrow(/Unknown bot/)
  })
})
