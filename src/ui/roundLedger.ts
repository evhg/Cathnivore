import type { GameEvent, GameState, RegionId } from '../engine/types'
import { REGIONS } from '../content/map'
import { logCaption } from './gameLog'

// Plan item 190: the receipts the desktop rail's ledger prints (RoundLedger.tsx): one per change to Public Trust
// or the land left, with what moved it. A whole Hollowell turn arrives as one step, so captions summarise it.
export interface Receipt {
  id: number
  kind: 'trust' | 'land'
  delta: number
  caption: string
  round: number
  logLen: number
}

const ENEMY = new Set<GameEvent['type']>(['squeeze', 'expand', 'scout', 'agenda', 'riftSplit'])

function names(regions: RegionId[]): string {
  const n = [...new Set(regions)].map((r) => REGIONS[r].name)
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`
}

/** What moved Trust or the land in one step of the game (a whole Hollowell turn arrives as one step). */
export function receiptCaption(events: GameEvent[], kind: Receipt['kind'], delta: number): string {
  const squeezes = events.filter((e): e is Extract<GameEvent, { type: 'squeeze' }> => e.type === 'squeeze')
  if (kind === 'land') {
    const hit = squeezes.filter((e) => e.lostLand)
    return hit.length ? `Squeezed in ${names(hit.map((e) => e.region))}.` : "Lost on Hollowell's turn."
  }
  if (delta < 0) {
    const hit = squeezes.filter((e) => e.trustLoss > 0)
    if (hit.length) return `Squeezed in ${names(hit.map((e) => e.region))}.`
    if (events.some((e) => ENEMY.has(e.type))) return "Lost on Hollowell's turn."
  } else {
    const freed = events.filter((e): e is Extract<GameEvent, { type: 'liberated' }> => e.type === 'liberated')
    if (freed.length) return `${names(freed.map((e) => e.region))} liberated.`
  }
  for (const e of [...events].reverse()) {
    const caption = logCaption(e)
    if (caption) return caption
  }
  return delta < 0 ? 'Trust lost.' : 'Trust won.'
}

/** The receipts a step from `prev` to `next` prints (none if neither Trust nor the land changed). */
export function receiptsFor(prev: GameState, next: GameState, nextId: () => number): Receipt[] {
  const fresh = next.log.slice(prev.log.length)
  const out: Receipt[] = []
  const dTrust = next.publicTrust - prev.publicTrust
  const dLand = next.lostLandPool - prev.lostLandPool
  if (dTrust) out.push({ id: nextId(), kind: 'trust', delta: dTrust, caption: receiptCaption(fresh, 'trust', dTrust), round: next.round, logLen: next.log.length })
  if (dLand) out.push({ id: nextId(), kind: 'land', delta: dLand, caption: receiptCaption(fresh, 'land', dLand), round: next.round, logLen: next.log.length })
  return out
}

