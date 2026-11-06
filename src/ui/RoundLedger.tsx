import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameState } from '../engine/types'
import { receiptsFor, type Receipt } from './roundLedger'

// Plan item 190: the round's ledger at the foot of the desktop rail. Every change to Public Trust or the land
// left prints a till receipt: the amount, what moved it (the newest log line that explains it) and the round.
// It is tracked from the state as the game goes (the engine logs actions, not deltas); an Undo tears off the
// receipts its turn printed, and a new game starts a fresh roll.
const KEEP = 6

export default function RoundLedger({ state }: { state: GameState }) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  // The roll's first slip: the balance it starts from (a fresh game's opening, or what a reload carried in).
  const openingOf = (g: GameState) => ({ trust: g.publicTrust, land: g.lostLandPool, round: g.round, fresh: g.round === 1 && !g.log.some((e) => e.type === 'action') })
  const [opening, setOpening] = useState(() => openingOf(state))
  const prev = useRef(state)
  const ids = useRef(0)
  useEffect(() => {
    const was = prev.current
    prev.current = state
    if (was === state) return
    // A fresh game (or a reload into another one): start a new roll.
    if (state.log.length === 0 || state.config !== was.config) {
      setReceipts([])
      setOpening(openingOf(state))
      return
    }
    // Undo: the log shrank, so tear off what the undone turn printed.
    if (state.log.length < was.log.length) {
      setReceipts((rs) => rs.filter((r) => r.logLen <= state.log.length))
      return
    }
    const fresh = receiptsFor(was, state, () => ++ids.current)
    if (fresh.length) setReceipts((rs) => [...fresh.reverse(), ...rs].slice(0, KEEP))
  }, [state])

  // The roll gives way when the hand needs the column: only whole receipts show (the newest first), and the
  // ledger hides outright when not even its title and one line fit, so it never shows as a sliver.
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const bottom = el.getBoundingClientRect().bottom
      let shown = 0
      for (const item of el.querySelectorAll<HTMLElement>('.receipt')) {
        item.hidden = false
        const fits = item.getBoundingClientRect().bottom <= bottom + 0.5
        item.hidden = !fits
        if (fits) shown++
      }
      el.dataset.room = shown > 0 ? 'yes' : 'no'
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [receipts])

  return (
    <section ref={ref} className="round-ledger" aria-label="Ledger: Trust and land this game">
      <h3 className="round-ledger-title label">Ledger</h3>
      <ol className="round-ledger-roll" data-ledger="">
        {receipts.map((r) => (
          <li key={r.id} className="receipt" data-kind={r.kind} data-sign={r.delta > 0 ? 'up' : 'down'}>
            <b className="receipt-amount num">
              {r.delta > 0 ? '+' : '−'}
              {Math.abs(r.delta)} {r.kind === 'trust' ? 'Trust' : 'Land'}
            </b>
            <span className="receipt-why">{r.caption}</span>
            <span className="receipt-round num" aria-label={`round ${r.round}`}>
              R{r.round}
            </span>
          </li>
        ))}
        <li className="receipt" data-kind="opening">
          <b className="receipt-amount num">
            {opening.trust} Trust · {opening.land} Land
          </b>
          <span className="receipt-why">{opening.fresh ? 'Opening balance.' : 'Carried in.'}</span>
          <span className="receipt-round num" aria-label={`round ${opening.round}`}>
            R{opening.round}
          </span>
        </li>
      </ol>
    </section>
  )
}
