import { useState } from 'react'
import type { GameState } from '../engine/types'
import LogSheet from './LogSheet'
import RoundLedger from './RoundLedger'

// Plan item 589: the desktop rail's third section, one tabbed book: the Ledger (item 190's receipts) and the Log (the
// game's turn history) share one panel, one tab open, the last choice remembered. The ledger stays mounted under the
// Log tab: it writes its lines from the state as the game goes, so unmounting it would lose the page.
type Tab = 'ledger' | 'log'
const KEY = 'cathnivore:railTab'

function readTab(): Tab {
  try {
    return localStorage.getItem(KEY) === 'log' ? 'log' : 'ledger'
  } catch {
    return 'ledger'
  }
}

export default function RailBook({ state, aiReasons }: { state: GameState; aiReasons?: Record<number, string> }) {
  const [tab, setTab] = useState<Tab>(readTab)
  const pick = (t: Tab) => {
    setTab(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* storage blocked: the tab still switches */
    }
  }
  return (
    <section className="rail-book" data-rail-section="book" data-tab={tab}>
      <div className="rail-book-tabs" role="tablist" aria-label="Ledger and log">
        {(['ledger', 'log'] as const).map((t) => (
          <button key={t} type="button" role="tab" id={`rail-tab-${t}`} aria-selected={tab === t} aria-controls={`rail-panel-${t}`} className="rail-book-tab" onClick={() => pick(t)}>
            {t === 'ledger' ? 'Ledger' : 'Log'}
          </button>
        ))}
      </div>
      <div className="rail-book-panel" id="rail-panel-ledger" role="tabpanel" aria-labelledby="rail-tab-ledger" hidden={tab !== 'ledger'}>
        <RoundLedger state={state} />
      </div>
      <div className="rail-book-panel" id="rail-panel-log" role="tabpanel" aria-labelledby="rail-tab-log" hidden={tab !== 'log'}>
        {tab === 'log' && <LogSheet log={state.log} aiReasons={aiReasons} onClose={() => pick('ledger')} inline />}
      </div>
    </section>
  )
}
