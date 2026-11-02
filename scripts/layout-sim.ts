// Plan item 15: HeuristicBot win rate per map layout (normal difficulty, the recommended pair), against the
// ring. Usage: npx tsx scripts/layout-sim.ts [games per layout, default 500]. Seeds 1..N, so reruns match.
import { botFor, playOneGame } from '../sim/simCore'
import { layoutConfig, type LayoutId } from '../src/content/layouts'
import { RECOMMENDED_PAIR } from '../src/content/producers'

const n = Number(process.argv[2] ?? 500)
const bot = botFor('heuristic')
for (const id of ['ring', 'coast', 'delta'] as LayoutId[]) {
  let won = 0
  let crashed = 0
  let rounds = 0
  for (let seed = 1; seed <= n; seed++) {
    const { activeRegions, ...extra } = layoutConfig(id, seed)
    const o = playOneGame(bot, [...RECOMMENDED_PAIR], 'normal', seed, activeRegions, extra)
    if (o.won) won++
    if (o.crashed || o.invariantFailure) crashed++
    rounds += o.rounds
  }
  console.log(`${id}: ${((100 * won) / n).toFixed(1)}% won of ${n}, ${crashed} crashed, mean ${(rounds / n).toFixed(1)} rounds`)
}
