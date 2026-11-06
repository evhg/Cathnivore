import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { useSheetDismiss } from './useSheetDismiss'
import { PRODUCERS } from '../content/producers'
import { GoodwillIcon, MarksIcon, ProduceIcon } from './icons/ResourceIcons'
import Tooltip from './Tooltip'
import Portrait from './portraits/Portrait'
import Vignette from './Vignette'
import { vignetteFor } from './vignetteKind'
import { SHELVES, SLOT_W, stallLayout, tagTallies } from './stallLayout'
import type { GameState, ProducerId } from '../engine/types'

const TAG_LABEL = { pasture: 'Pasture', crop: 'Crop', coast: 'Coast', community: 'Community', media: 'Media', science: 'Science' }

// SPEC 10.2 "Sheets ... Farm (tableau and tag counts)." Shows every producer (SPEC 6: 1 in campaign
// chapters 1-3, 2 in a full game) so either can check the other's tableau, not just the active one.
// `inline` (SPEC 10.3 desktop 3-column layout) renders the panel content directly in the page flow
// instead of as a phone-sized modal overlay — the same data, just without the overlay/Close chrome.
export default function FarmSheet({ state, onClose, inline }: { state: GameState; onClose(): void; inline?: boolean }) {
  const sheetRef = useSheetDismiss(onClose, !inline)
  if (inline) {
    // Plan item 33: the active producer's row is only her name until she buys something (the card above names her
    // and carries her figures), and that empty row pushed the Actions frame down far enough to cut the Invest cards
    // at 1440x900.
    const shown = state.config.producers.filter(
      (id) => !(id === state.activeProducer && state.config.producers.length > 1 && state.producers[id].improvements.length === 0),
    )
    // Plan item 194: under the active producer's card, a block naming only the other producer says whose it is.
    const partnerOnly = shown.length === 1 && shown[0] !== state.activeProducer
    return (
      <section className="farm-sheet farm-inline" aria-labelledby="farm-inline-title">
        <h2 className="farm-inline-title" id="farm-inline-title">{partnerOnly ? 'Partner’s farm' : 'Farm'}</h2>
        {shown
          .map((id) => (
            <FarmColumn key={id} state={state} producer={id} hideSummary={state.config.producers.length === 1} compact />
          ))}
        {state.config.producers.every((id) => state.producers[id].improvements.length === 0) && (
          <p className="farm-empty">No Improvements bought yet.</p>
        )}
      </section>
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet farm-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="Farm" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Farm</h2>
          <button onClick={onClose}>Close</button>
        </header>
        {state.config.producers.map((id) => (
          <FarmColumn key={id} state={state} producer={id} />
        ))}
      </div>
    </div>
  )
}

// `hideSummary`: the desktop top-left card already shows a lone producer's name and stats (ROADMAP 169).
function FarmColumn({ state, producer, hideSummary, compact }: { state: GameState; producer: ProducerId; hideSummary?: boolean; compact?: boolean }) {
  const p = state.producers[producer]
  const def = PRODUCERS[producer]
  const tagCounts: Partial<Record<string, number>> = {}
  for (const id of p.improvements) {
    for (const tag of IMPROVEMENTS_BY_ID.get(id)?.tags ?? []) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
    }
  }

  return (
    <section className={compact ? 'farm-column farm-column--compact' : 'farm-column'}>
      {!hideSummary && !compact ? (
        // Plan item 36: the producer at their farm gate, and a ribbon that sums what the farm makes.
        <div className="farmstead-gate">
          <span className={`producer-cameo pc-${producer}`}>
            <Portrait character={producer} size={56} />
          </span>
          <h3>{def.name}</h3>
        </div>
      ) : (
        !hideSummary && <h3>{def.name}</h3>
      )}
      {!compact && (
        <p className="farmstead-ribbon">
          <span>
            <ProduceIcon /> +{p.production.produce}
          </span>
          <span>
            <MarksIcon /> +{p.production.marks}
          </span>
          <span>
            <GoodwillIcon /> +{p.production.goodwill}
          </span>
          <span className="farmstead-ribbon-tail">each round</span>
          <span className="visually-hidden">
            : {p.production.produce} Produce, {p.production.marks} {p.production.marks === 1 ? 'Mark' : 'Marks'} and {p.production.goodwill} Goodwill each round
          </span>
        </p>
      )}
      {/* AAA UI M4: a list, not inline " · " joiners (they dangled once the items stacked). The desktop
          frame shows the same figures as compact chips, one line a producer. */}
      {/* compact: the active producer's figures are already on the chips just above */}
      {!hideSummary && !(compact && producer === state.activeProducer) && (
        <ul className="farm-production">
          <li>
            <Tooltip term="Produce">
              <ProduceIcon /> {compact ? <span className="num">{p.resources.produce}</span> : `Produce ${p.resources.produce}`}
              {compact && <span className="farm-income num"> +{p.production.produce}</span>}
              {compact && <span className="visually-hidden"> Produce, plus {p.production.produce} a round</span>}
            </Tooltip>
          </li>
          <li>
            <Tooltip term="Marks">
              <MarksIcon /> {compact ? <span className="num">{p.resources.marks}</span> : `Marks ${p.resources.marks}`}
              {compact && <span className="farm-income num"> +{p.production.marks}</span>}
              {compact && <span className="visually-hidden"> Marks, plus {p.production.marks} a round</span>}
            </Tooltip>
          </li>
          <li>
            <Tooltip term="Goodwill">
              <GoodwillIcon /> {compact ? <span className="num">{p.resources.goodwill}</span> : `Goodwill ${p.resources.goodwill}`}
              {compact && <span className="farm-income num"> +{p.production.goodwill}</span>}
              {compact && <span className="visually-hidden"> Goodwill, plus {p.production.goodwill} a round</span>}
            </Tooltip>
          </li>
        </ul>
      )}
      {p.improvements.length === 0 ? (
        !compact && <p className="farm-empty">{hideSummary || state.config.producers.length < 2 ? 'No Improvements bought yet.' : 'No Improvements yet.'}</p>
      ) : compact ? (
        <Stall producer={producer} improvements={p.improvements} production={p.production} />
      ) : (
        // Plan item 36: the phone Farm lays each bought card out in the farmstead as a drawn card; plan item 62
        // puts the stall they fill above them.
        <>
        <Stall producer={producer} improvements={p.improvements} production={p.production} />
        <ul className="farmstead-row">
          {p.improvements.map((id) => {
            const card = IMPROVEMENTS_BY_ID.get(id)
            if (!card) return null
            return (
              <li key={id} className="farmstead-card card-framed" data-tag={card.tags[0]} data-card={id}>
                <Vignette kind={vignetteFor(card)} seed={card.id} />
                <strong>{card.name}</strong>
                <span className="card-tags">{card.tags.map((t) => TAG_LABEL[t]).join(', ')}</span>
                {/* SPEC 10.5/STYLE.md 8: a bought card's own entry reminds the player what an ongoing
                    ability does, without reopening the Market or the Rules Reference. */}
                <div className="farm-card-text">{card.text}</div>
              </li>
            )
          })}
        </ul>
        </>
      )}
      {!compact && Object.keys(tagCounts).length > 0 && (
        <p className="farm-tags">
          Tags:{' '}
          {Object.entries(tagCounts)
            .map(([tag, count]) => `${TAG_LABEL[tag as keyof typeof TAG_LABEL]} ${count}`)
            .join(', ')}
        </p>
      )}
    </section>
  )
}

const SHELF_LABEL = { fields: 'From the fields', sea: 'From the sea', town: 'From the town' }

/**
 * Plan item 62: the farm as a market stall that fills up. A striped awning, three shelves (stallLayout.ts) where
 * each bought card hangs as a painted crate with its vignette, the tag counts chalked on the stall's board and the
 * round's yield on a price board under the awning. A card bought just now drops into its slot.
 */
export function Stall({ producer, improvements, production }: { producer: ProducerId; improvements: readonly string[]; production: { produce: number; marks: number; goodwill: number } }) {
  const items = improvements.map((id) => ({ id, tags: IMPROVEMENTS_BY_ID.get(id)?.tags ?? [] }))
  const slots = stallLayout(items)
  const tallies = tagTallies(items)
  const W = SLOT_W * 4 + SLOT_W / 2 + 8
  return (
    <figure className={`farm-stall pc-${producer}`} data-items={slots.length} aria-label={`${PRODUCERS[producer].name}'s stall: ${slots.length} Improvements`}>
      <div className="farm-stall-awning" aria-hidden="true" />
      <p className="farm-stall-prices" aria-label={`Each round: ${production.produce} Produce, ${production.marks} Marks, ${production.goodwill} Goodwill`}>
        <span><ProduceIcon /> {production.produce}</span>
        <span><MarksIcon /> {production.marks}</span>
        <span><GoodwillIcon /> {production.goodwill}</span>
        <small>a round</small>
      </p>
      <div className="farm-stall-shelves" style={{ ['--stall-w' as string]: `${W}` }}>
        {SHELVES.map((sh, row) => (
          <div key={sh} className="farm-stall-shelf" data-shelf={sh} style={{ ['--row' as string]: row }}>
            <span className="visually-hidden">{SHELF_LABEL[sh]}</span>
          </div>
        ))}
        {slots.map((sl, i) => {
          const card = IMPROVEMENTS_BY_ID.get(sl.id)
          if (!card) return null
          return (
            <span
              key={sl.id}
              className={`stall-item${i === slots.length - 1 ? ' stall-item-new' : ''}`}
              data-card={sl.id}
              data-shelf={sl.shelf}
              data-tag={card.tags[0]}
              style={{ ['--x' as string]: sl.x, ['--y' as string]: sl.y, ['--layer' as string]: sl.layer }}
              title={`${card.name}: ${card.text}`}
            >
              <Vignette kind={vignetteFor(card)} seed={card.id} />
              <span className="visually-hidden">{card.name}</span>
            </span>
          )
        })}
      </div>
      {tallies.length > 0 && (
        <p className="farm-stall-board" aria-label={`Tags: ${tallies.map(([t, n]) => `${TAG_LABEL[t as keyof typeof TAG_LABEL]} ${n}`).join(', ')}`}>
          {tallies.map(([t, n]) => (
            <span key={t} data-tag={t}>
              {TAG_LABEL[t as keyof typeof TAG_LABEL]} <b className="chalk-tally">{'|'.repeat(Math.min(n, 4))}{n > 4 ? ` ${n}` : ''}</b>
            </span>
          ))}
        </p>
      )}
    </figure>
  )
}
