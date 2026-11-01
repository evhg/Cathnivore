// Runnel weekday arc report: par and board size per weekday over 52 weeks of dailies from ARC_FROM.
// Usage: npx tsx scripts/runnel-arc.ts [--before]   (--before measures the old fixed radius-3 schedule)
import { ARC_FROM, dailyPuzzle, generatePuzzle, DAILY_RADIUS, sluicesFor, reservoirsFor, bridgesFor } from '../games/runnel/src/engine'

const before = process.argv.includes('--before')
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pars: number[][] = DAYS.map(() => [])
const cells: number[][] = DAYS.map(() => [])
const start = Date.parse(`${ARC_FROM}T00:00:00Z`)
for (let d = 0; d < 7 * 52; d++) {
  const date = new Date(start + d * 86_400_000).toISOString().slice(0, 10)
  const p = before
    ? generatePuzzle(`daily-${date}`, { radius: DAILY_RADIUS, fixedCount: sluicesFor(date), reservoirCount: reservoirsFor(date), bridgeCount: bridgesFor(date) })
    : dailyPuzzle(date)
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  pars[day]!.push(p.par)
  cells[day]!.push(p.cells.filter((c) => c.kind !== 'stone').length)
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
// Time model: a tap plus a glance is about 1.2 s for a practised player, so the median solve is
// roughly par x 1.2 s plus 10% wasted taps.
console.log('| Day | Tiles | Par (median) | Par (min-max) | Est. median time |')
console.log('| --- | --- | --- | --- | --- |')
for (const k of [1, 2, 3, 4, 5, 6, 0]) {
  const m = median(pars[k]!)
  const secs = Math.round(m * 1.1 * 1.2)
  console.log(`| ${DAYS[k]} | ${median(cells[k]!)} | ${m} | ${Math.min(...pars[k]!)}-${Math.max(...pars[k]!)} | ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} |`)
}
