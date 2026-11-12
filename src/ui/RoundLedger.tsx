import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameState } from '../engine/types'
import { receiptsFor, type Receipt } from './roundLedger'

// Plan item 190: the round's ledger at the foot of the desktop rail. Plan item 244: a ledger page that writes itself
// in ink as the game goes: a line per move (its Marks change and the running Marks), a line per Trust or land change
// Hollowell makes, a closing line with Bea's doodle when a round ends. It is tracked from the state as the game goes
// (the engine logs actions, not deltas); an Undo strikes out the lines its turn wrote, and a new game starts a page.
const KEEP = 24

// Plan item 244: Bea's doodles in the margin of each round's closing line (a flower, the sun, a heart, a star).
const DOODLES = [
  'M9 9m-2 0a2 2 0 104 0 2 2 0 10-4 0M9 7c-1-3 2-4 2-1M11 9c3-1 4 2 1 2M9 11c1 3-2 4-2 1M7 9c-3 1-4-2-1-2M9 11v6',
  'M9 9m-3 0a3 3 0 106 0 3 3 0 10-6 0M9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.4 1.4M12.6 12.6L14 14M4 14l1.4-1.4M12.6 5.4L14 4',
  'M9 15C3 10 3 5 6 4.5c1.6-.3 2.6 1 3 2.3.4-1.3 1.4-2.6 3-2.3 3 .5 3 5.5-3 10.5z',
  'M9 2l2 5h5l-4 3 1.6 5L9 12l-4.6 3L6 10 2 7h5z',
]

export default function RoundLedger({ state }: { state: GameState }) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  // The page's first line: the balance it starts from (a fresh game's opening, or what a reload carried in).
  const openingOf = (g: GameState) => ({ trust: g.publicTrust, land: g.lostLandPool, round: g.round, fresh: g.round === 1 && !g.log.some((e) => e.type === 'action') })
  const [opening, setOpening] = useState(() => openingOf(state))
  const prev = useRef(state)
  const ids = useRef(0)
  useEffect(() => {
    const was = prev.current
    prev.current = state
    if (was === state) return
    // A fresh game (or a reload into another one): start a new page.
    if (state.log.length === 0 || state.config !== was.config) {
      setReceipts([])
      setOpening(openingOf(state))
      return
    }
    // Undo: the log shrank, so strike out what the undone turn wrote.
    if (state.log.length < was.log.length) {
      setReceipts((rs) => rs.filter((r) => r.logLen <= state.log.length))
      return
    }
    const fresh = receiptsFor(was, state, () => ++ids.current)
    if (fresh.length) setReceipts((rs) => [...rs, ...fresh].slice(-KEEP))
  }, [state])

  // The page is written top down; when the column is short, the oldest lines go first, so the newest line is always
  // on the page. The ledger hides outright when not even its title and one line fit, so it never shows as a sliver.
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const fit = () => {
      const bottom = el.getBoundingClientRect().bottom
      const items = [...el.querySelectorAll<HTMLElement>('.receipt')]
      for (const item of items) delete item.dataset.gone
      // Gate 7 (the hand-over render under 4x throttling): one layout for the whole fit, not one per hidden line.
      // The lines stack in a column, so hiding the oldest lifts the newest by the step to the next line's top.
      const tops = items.map((item) => item.getBoundingClientRect().top)
      const newest = items.at(-1)
      let newestBottom = newest ? newest.getBoundingClientRect().bottom : 0
      let i = 0
      while (newest && i < items.length - 1 && newestBottom > bottom + 0.5) {
        newestBottom -= tops[i + 1]! - tops[i]!
        i++
      }
      for (let k = 0; k < i; k++) items[k]!.dataset.gone = ''
      el.dataset.room = newest && newestBottom <= bottom + 0.5 ? 'yes' : 'no'
      // Plan item 287: while the page is mostly blank its free room holds Bea's chalk sketch of the stall, sized to
      // the room left under the newest line (it goes once the lines need the space).
      const free = newest ? bottom - newestBottom : 0
      el.dataset.sketch = free >= 96 ? 'yes' : 'no'
      el.style.setProperty('--sketch-room', `${Math.max(0, Math.round(free))}px`)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [receipts])

  const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`
  return (
    <section ref={ref} className="round-ledger" aria-label="Ledger: this game's moves, Marks, Trust and land">
      <h3 className="round-ledger-title label">
        Ledger <span className="round-ledger-col" aria-hidden="true">Marks</span>
      </h3>
      <ol className="round-ledger-roll" data-ledger="">
        <li className="receipt" data-kind="opening">
          <span className="receipt-why">{opening.fresh ? 'Opening balance' : `Carried in, round ${opening.round}`}</span>
          <b className="receipt-amount num">
            {opening.trust} Trust · {opening.land} Land
          </b>
        </li>
        {receipts.map((r) =>
          r.kind === 'round' ? (
            <li key={r.id} className="receipt" data-kind="round">
              <svg className="receipt-doodle" viewBox="0 0 18 18" aria-hidden="true">
                <path d={DOODLES[(r.round - 1) % DOODLES.length]} />
              </svg>
              <span className="receipt-why">{r.caption}</span>
            </li>
          ) : r.kind === 'action' || r.kind === 'harvest' ? (
            <li key={r.id} className="receipt" data-kind={r.kind} data-producer={r.producer} data-sign={r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'even'} data-marks={r.marks}>
              <span className="receipt-why">
                {r.caption}
                {r.trust ? <b className="receipt-trust num"> {signed(r.trust)} Trust</b> : null}
              </span>
              <b className="receipt-amount num">{r.delta ? signed(r.delta) : ''}</b>
              <span className="receipt-total num" aria-label={`${r.marks} Marks`}>
                {r.marks}
              </span>
            </li>
          ) : (
            <li key={r.id} className="receipt" data-kind={r.kind} data-sign={r.delta > 0 ? 'up' : 'down'}>
              <span className="receipt-why">{r.caption}</span>
              <b className="receipt-amount num">
                {signed(r.delta)} {r.kind === 'trust' ? 'Trust' : 'Land'}
              </b>
            </li>
          ),
        )}
      </ol>
      <div className="ledger-sketch" aria-hidden="true">
        <svg viewBox="0 0 120 80">
          {/* the stall: a scalloped awning on two posts, a counter, three crates and a price tag */}
          <path d="M14 22h92l-6-12H20zM14 22q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0q5 6 10 0" />
          <path d="M20 23v47M100 23v47M10 70h100M24 52h72v18M24 52l4-6h64l4 6" />
          <path d="M30 46v-9h16v9M30 42h16M50 46v-11h18v11M50 41h18M72 46v-8h16v8M72 42h16" />
          <path d="M35 37a3 3 0 106 0 3 3 0 10-6 0M55 35a3 3 0 106 0 3 3 0 10-6 0M77 38a3 3 0 106 0 3 3 0 10-6 0" />
          <path d="M96 30l8 4-3 7-8-4zM96 30l-2-4" />
        </svg>
        {/* Plan item 337: Cath's own tip in her hand, not a placeholder caption, until the round's first move is chalked up */}
        <span className="ledger-sketch-note">Sell early, love: Marks buy what you're saving for, and it pays back every round. <i className="ledger-sign">— C.</i></span>
      </div>
    </section>
  )
}
