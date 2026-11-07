import type { GameEvent, GameState, ProducerId, RegionId } from '../engine/types'
import { REGIONS } from '../content/map'
import { PRODUCERS } from '../content/producers'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import { logCaption } from './gameLog'

// Plan item 190: the receipts the desktop rail's ledger prints (RoundLedger.tsx): one per change to Public Trust
// or the land left, with what moved it. A whole Hollowell turn arrives as one step, so captions summarise it.
// Plan item 244: it is a ledger page written as the round plays: a line per move the player makes (its Marks change
// and the running Marks), a line per Trust or land change Hollowell causes, and a closing line, with Bea's doodle in
// the margin, when a round ends.
export interface Receipt {
  id: number
  kind: 'trust' | 'land' | 'action' | 'round' | 'harvest'
  delta: number
  caption: string
  round: number
  logLen: number
  /** An action line: who moved, and their Marks after it. */
  producer?: ProducerId
  marks?: number
  /** An action line that also moved Trust (a Supply or a Rebut that won it). */
  trust?: number
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

const region = (r: RegionId): string => REGIONS[r].name

/** A move as the ledger writes it: short and past tense, with no name (the line's tick is the producer's colour). */
export function ledgerCaption(e: GameEvent): string | null {
  if (e.type === 'invest') return `Bought ${IMPROVEMENTS_BY_ID.get(e.improvementId)?.name ?? e.improvementId}`
  if (e.type === 'schemePlayed') {
    const name = SCHEMES_BY_ID.get(e.schemeId)?.name ?? e.schemeId
    return e.target ? `${name}, ${region(e.target)}` : name
  }
  if (e.type !== 'action') return null
  const a = e.action
  switch (a.kind) {
    case 'sell':
      return `Sold ${a.count} Produce`
    case 'openStall':
      return `Stall opened, ${region(a.region)}`
    case 'supplyOutlets':
      return `${a.count} Outlet${a.count > 1 ? 's' : ''} supplied, ${region(a.region)}`
    case 'supplyBuyout':
      return `Buyout supplied, ${region(a.region)}`
    case 'rebut':
      return `${a.count} Doubt rebutted, ${region(a.region)}`
    case 'graft':
      return 'Grafted'
    case 'role': {
      const role = PRODUCERS[e.producer].roleName.split(', ').at(-1)!
      return a.targetRegion ? `${role}, ${region(a.targetRegion)}` : role
    }
    case 'tearUpContract':
      return 'Contract torn up'
    case 'invest':
    case 'scheme':
    case 'decide':
      return null // 'invest' and 'schemePlayed' events write those; a decision moves nothing of its own
  }
}

/** The lines a step from `prev` to `next` writes (none for a quiet step). */
export function receiptsFor(prev: GameState, next: GameState, nextId: () => number): Receipt[] {
  const fresh = next.log.slice(prev.log.length)
  const out: Receipt[] = []
  const at = { round: next.round, logLen: next.log.length }
  // The player's moves, in order; each producer's last move this step carries their Marks change.
  for (const e of fresh) {
    const caption = ledgerCaption(e)
    if (!caption || !('producer' in e)) continue
    out.push({ id: nextId(), kind: 'action', delta: 0, caption, producer: e.producer, ...at })
  }
  // A step that ends the round also brings the next round's Harvest (SPEC 4.5.1), written on its own line.
  const newRound = next.round > prev.round
  const harvest = (p: ProducerId): number => (newRound ? (next.producers?.[p]?.production.marks ?? 0) : 0)
  for (const p of new Set(out.map((r) => r.producer!))) {
    const marks = (next.producers?.[p]?.resources.marks ?? 0) - harvest(p)
    const line = [...out].reverse().find((r) => r.producer === p)!
    line.marks = marks
    line.delta = marks - (prev.producers?.[p]?.resources.marks ?? marks)
  }
  const dTrust = next.publicTrust - prev.publicTrust
  const dLand = next.lostLandPool - prev.lostLandPool
  // Trust a move won (no Hollowell turn in the step) is written on the move's own line.
  const mine = out.length > 0 && !fresh.some((e) => ENEMY.has(e.type))
  if (dTrust && mine) out.at(-1)!.trust = dTrust
  else if (dTrust) out.push({ id: nextId(), kind: 'trust', delta: dTrust, caption: receiptCaption(fresh, 'trust', dTrust).replace(/\.$/, ''), ...at })
  if (dLand) out.push({ id: nextId(), kind: 'land', delta: dLand, caption: receiptCaption(fresh, 'land', dLand).replace(/\.$/, ''), ...at })
  if (newRound) {
    out.push({ id: nextId(), kind: 'round', delta: 0, caption: `Round ${prev.round} closed`, round: prev.round, logLen: next.log.length })
    // Its amount is everything else that moved the producer's Marks in the step (the Harvest, and any market
    // event), so the running column always meets the mat.
    const two = Object.keys(next.producers ?? {}).length > 1
    for (const p of Object.keys(next.producers ?? {}) as ProducerId[]) {
      const now = next.producers[p].resources.marks
      const before = [...out].reverse().find((r) => r.producer === p)?.marks ?? prev.producers?.[p]?.resources.marks ?? now
      if (harvest(p) || now !== before) out.push({ id: nextId(), kind: 'harvest', delta: now - before, caption: two ? `Harvest, ${PRODUCERS[p].name.split(' ')[0]}` : 'Harvest', producer: p, marks: now, ...at })
    }
  }
  return out
}

