// Plan item 477: the chapter's three wax seals on the table while you play (a campaign game only), so the feat is a
// goal, not a surprise on the end screen. Each seal reads `sealOutlook`: open, on track (a warm glow), at risk (one
// round left), lost (the wax cracks) or sealed. The card is pinned to the table's corner; a tap opens its labels.
import type { SealOutlook, SealState } from '../content/campaignMap'

const STATE_WORD: Record<SealState, string> = {
  open: 'open',
  onTrack: 'on track',
  atRisk: 'at risk: this round',
  lost: 'lost',
  sealed: 'sealed',
}

const SEAL_NAME = { win: 'Win', hard: 'Hard', feat: 'Feat' } as const

/** One wax seal: a scalloped disc with a pressed mark, and a crack that draws across it when the seal is lost. */
export function WaxSeal({ id }: { id: SealOutlook['id'] }) {
  const scallops = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    return <circle key={i} cx={16 + Math.cos(a) * 11.5} cy={16 + Math.sin(a) * 11.5} r="3.6" />
  })
  return (
    <svg className="seal-wax" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g className="seal-blob">
        {scallops}
        <circle cx="16" cy="16" r="12" />
      </g>
      <circle className="seal-press" cx="16" cy="16" r="7.5" />
      {id === 'win' && <path className="seal-mark" d="M11.5 16.5 l3 3 l6 -7" />}
      {id === 'hard' && <path className="seal-mark" d="M16 10.5 l1.7 3.6 l3.8 .4 l-2.9 2.6 l.9 3.8 l-3.5 -2 l-3.5 2 l.9 -3.8 l-2.9 -2.6 l3.8 -.4 Z" />}
      {id === 'feat' && <path className="seal-mark" d="M16 10 q-4.5 4 -1.5 9.5 M16 10 q4.5 4 1.5 9.5 M16 21 v-11" />}
      <path className="seal-crack" pathLength={1} d="M7 9 l6 5 l-2 3 l6 2 l-1 3 l9 3" />
    </svg>
  )
}

export default function SealCard({ seals }: { seals: SealOutlook[] }) {
  const summary = seals.map((s) => `${SEAL_NAME[s.id]} ${STATE_WORD[s.state]}`).join(', ')
  return (
    <details className="seal-card" data-seal-card="">
      <summary aria-label={`Chapter seals: ${summary}`}>
        <span className="seal-card-title" aria-hidden="true">Seals</span>
        <span className="seal-row" aria-hidden="true">
          {seals.map((s) => (
            <span key={s.id} className="seal" data-seal={s.id} data-state={s.state}>
              <WaxSeal id={s.id} />
            </span>
          ))}
        </span>
      </summary>
      <ul className="seal-list">
        {seals.map((s) => (
          <li key={s.id} data-state={s.state}>
            <span className="seal" data-state={s.state} aria-hidden="true">
              <WaxSeal id={s.id} />
            </span>
            <span className="seal-label">{s.label}</span>
            <span className="seal-word label">{STATE_WORD[s.state]}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
