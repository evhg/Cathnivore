import { useEffect, useMemo, useRef, useState } from 'react'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import { AGENDA_CARDS } from '../content/agenda'
import { PRODUCERS, ALL_PRODUCER_IDS } from '../content/producers'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { REGIONS } from '../content/map'
import { ACTION_TERMS, GLOSSARY_TERMS, entryDomId, type GlossaryEntry } from '../content/terms'
import { ACTIONS_PER_ROUND } from '../engine/region'
import CathArt from './CathArt'
import TourBoard, { type TourCard, type TourHex } from './TourBoard'

interface Props {
  onClose(): void
  // SPEC 8.1: "a '?' link to the rules reference" from a tutorial prompt should land the player on the
  // term that prompt was about, not just the top of the page. The exact glossary/action term name (see
  // `Game.tsx`'s `tutorialTermFor`), used to scroll to and highlight that entry once opened.
  initialTerm?: string
}

type Entry = GlossaryEntry

const ACTIONS = ACTION_TERMS
const TERMS = GLOSSARY_TERMS

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rules-section settings-card">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function EntryList({ entries, activeTerm }: { entries: Entry[]; activeTerm?: string }) {
  return (
    <dl className="rules-entries">
      {entries.map((e) => (
        <div
          key={e.term}
          id={entryDomId(e.term)}
          className={e.term === activeTerm ? 'rules-entry rules-entry-active' : 'rules-entry'}
        >
          <dt>{e.term}</dt>
          <dd>{e.body}</dd>
        </div>
      ))}
    </dl>
  )
}

// Plan item 8: the regions of the mini Marrow, Kingsmarket first, then the ring as on the real map.
const FILLS = ['var(--region-capital)', 'var(--region-pasture)', 'var(--region-coast)', 'var(--region-crop)', 'var(--region-coast)', 'var(--region-crop)', 'var(--region-pasture)']
const board = (over: Record<number, Omit<TourHex, 'fill'>>): TourHex[] => FILLS.map((fill, i) => ({ fill, ...over[i] }))

const TOUR: Array<{ title: string; text: string; board: TourHex[]; cards?: TourCard[]; label: string }> = [
  {
    title: 'Your round',
    text: `Each round, every producer gets ${ACTIONS_PER_ROUND} actions: sell, invest, scheme, supply and more. Open Stalls next to the ones you have, and spread across Marrow.`,
    board: board({
      0: { pieces: ['outlet', 'outlet'] },
      6: { focus: true, mark: '1', pieces: ['stall'] },
      1: { focus: true, mark: '2', pieces: ['stall', 'stall'] },
      5: { focus: true, mark: '3', pieces: ['stall2'] },
      3: { pieces: ['outlet'] },
    }),
    label: 'A mini map of Marrow: your Stalls in three regions, numbered as actions one to three',
  },
  {
    title: 'Beat the Squeeze',
    text: 'Liberate a region by clearing out its Outlets, Buyouts and Doubt while you have a Stall there. Keep it clear to keep it.',
    board: board({
      0: { pieces: ['outlet', 'outlet', 'buyout'] },
      2: { focus: true, ring: 'ours', pieces: ['stall', 'stall2'] },
      3: { focus: true, ring: 'theirs', pieces: ['outlet', 'stall', 'stall2'] },
      4: { pieces: ['buyout'] },
    }),
    label: 'One region liberated with a solid green ring; the next held by an Outlet against two Stalls, ringed in dashed clay',
  },
  {
    title: 'Mind the Rift',
    text: 'Doubt left alone costs Public Trust when the Squeeze lands, and a Squeeze that beats your Stalls places Lost Land. Trust at zero, or no Lost Land left to place, and Marrow is repossessed.',
    board: board({
      0: { pieces: ['outlet', 'buyout'] },
      4: { focus: true, pieces: ['doubt', 'doubt'] },
      5: { focus: true, lost: true },
      6: { pieces: ['stall', 'doubt'] },
      3: { pieces: ['outlet', 'outlet'] },
    }),
    label: 'Doubt tokens spreading and a region hatched over with Lost Land',
  },
  {
    title: 'Play your cards',
    text: 'Buy Improvements to strengthen your regions, and play Schemes from Cath’s Plan at the right moment to turn a round around.',
    board: board({ 1: { pieces: ['stall', 'stall'], ring: 'ours' }, 0: { pieces: ['outlet'] } }),
    cards: [
      { kind: 'improvement', name: 'Cold Store' },
      { kind: 'scheme', name: 'Loss Leader' },
    ],
    label: 'An Improvement card and a Scheme card beside the map',
  },
  {
    title: 'Ask the table',
    text: 'Tap any card, region or action on the table for its rules; the "?" links land you back here.',
    board: board({ 0: { focus: true, mark: '?' } }),
    label: 'Kingsmarket with a help marker',
  },
]

// ROADMAP 18: Cath's paged quick tour, one tiny demo board per page.
function QuickTour() {
  const [i, setI] = useState(0)
  const page = TOUR[i]!
  return (
    <section
      className="rules-basics settings-card tour"
      aria-label="Quick tour"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, TOUR.length - 1))
        if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
      }}
    >
      <CathArt framing="bust" expression="delighted" width={64} height={64} title="Cath" />
      <div className="tour-body">
        <h2>The basics, from Cath</h2>
        <h3 className="tour-title">{page.title}</h3>
        <TourBoard hexes={page.board} cards={page.cards} label={page.label} />
        <p className="tour-text">{page.text}</p>
        <div className="tour-nav">
          <button onClick={() => setI(i - 1)} disabled={i === 0}>Back</button>
          <span className="tour-dots" aria-live="polite">
            {TOUR.map((_, n) => (
              <span key={n} aria-hidden="true" style={{ opacity: n === i ? 1 : 0.35 }}>●</span>
            ))}
            <span className="sr-only">{i + 1} / {TOUR.length}</span>
          </span>
          <button onClick={() => setI(i + 1)} disabled={i === TOUR.length - 1}>Next</button>
        </div>
      </div>
    </section>
  )
}

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
}

// SPEC 10.1/10.5: rules reference, generated from the rules data (so it can never disagree with the
// engine), searchable by name/text/flavor.
export default function RulesReference({ onClose, initialTerm }: Props) {
  const [query, setQuery] = useState('')
  const scrolledRef = useRef(false)

  // Land on and briefly highlight the term the tutorial's "?" was tapped from, rather than always opening
  // at the top (SPEC 8.1). Runs once per mount; the empty initial `query` means every section (including
  // `initialTerm`'s) is already rendered on this first pass, so the target id exists immediately.
  useEffect(() => {
    if (!initialTerm || scrolledRef.current) return
    scrolledRef.current = true
    const el = document.getElementById(entryDomId(initialTerm))
    el?.scrollIntoView({ block: 'center' })
  }, [initialTerm])

  const actions = useMemo(() => ACTIONS.filter((e) => matches(query, e.term, e.body)), [query])
  const terms = useMemo(() => TERMS.filter((e) => matches(query, e.term, e.body)), [query])
  const producers = useMemo(
    () => ALL_PRODUCER_IDS.map((id) => PRODUCERS[id]).filter((p) => matches(query, p.name, p.roleName, p.roleAbility)),
    [query],
  )
  const improvements = useMemo(
    () => IMPROVEMENTS.filter((c) => matches(query, c.name, c.text, c.flavor, ...c.tags)),
    [query],
  )
  const schemes = useMemo(
    () => SCHEMES.filter((c) => matches(query, c.name, c.text, c.line, ...(c.tags ?? []))),
    [query],
  )
  const agenda = useMemo(() => AGENDA_CARDS.filter((c) => matches(query, c.headline, c.faction)), [query])

  const nothingFound =
    query.length > 0 &&
    actions.length === 0 &&
    terms.length === 0 &&
    producers.length === 0 &&
    improvements.length === 0 &&
    schemes.length === 0 &&
    agenda.length === 0

  return (
    <main className="rules-reference">
      <header className="rules-header">
        <span className="rules-cath">
          <CathArt framing="bust" expression="delighted" width={40} height={40} title="Cath" />
        </span>
        <h1 style={{ flex: 1, margin: 0 }}>How to Play</h1>
        <button onClick={onClose}>Close</button>
      </header>

      <input
        className="rules-search"
        type="search"
        placeholder="Search rules, cards, producers..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the rules reference"
      />

      {!query && !initialTerm && (
        <QuickTour />
      )}

      {nothingFound && <p className="rules-empty">No matches for "{query}".</p>}

      {actions.length > 0 && (
        <Section title={`Actions (${ACTIONS_PER_ROUND} per producer per round)`}>
          <EntryList entries={actions} activeTerm={initialTerm} />
        </Section>
      )}

      {terms.length > 0 && (
        <Section title="Key terms">
          <EntryList entries={terms} activeTerm={initialTerm} />
        </Section>
      )}

      {producers.length > 0 && (
        <Section title="Producers">
          <EntryList
            entries={producers.map((p) => ({
              term: `${p.name} (${REGIONS[p.home].name})`,
              body: `${p.roleName}: ${p.roleAbility}`,
            }))}
          />
        </Section>
      )}

      {improvements.length > 0 && (
        <Section title="Improvements">
          <EntryList
            entries={improvements.map((c) => ({
              term: `${c.name} (${c.cost} Marks, ${c.tags.join('/')})`,
              body: c.text,
            }))}
          />
        </Section>
      )}

      {schemes.length > 0 && (
        <Section title="Cath's Plan (Schemes)">
          <EntryList
            entries={schemes.map((c) => ({
              term: `${c.name} (${c.cost} Goodwill)`,
              body: c.text,
            }))}
          />
        </Section>
      )}

      {agenda.length > 0 && (
        <Section title="Agenda cards">
          <EntryList
            entries={agenda.map((c) => ({
              term: `${c.faction === 'hollowell' ? 'Hollowell' : 'Candor'}: "${c.headline}"`,
              body: `${c.text} Its bonus effect is skipped once Rift reaches 3.`,
            }))}
          />
        </Section>
      )}

      {!query && (
        <Section title="Difficulty">
          <EntryList
            entries={(['easy', 'normal', 'hard'] as const).map((d) => ({
              term: d[0]!.toUpperCase() + d.slice(1),
              body: [
                `Public Trust starts at ${DIFFICULTY_SETTINGS[d].publicTrust}, Lost Land pool of ${DIFFICULTY_SETTINGS[d].lostLandPool}, Kingsmarket starts with ${DIFFICULTY_SETTINGS[d].kingsmarketOutlets} Outlet${DIFFICULTY_SETTINGS[d].kingsmarketOutlets === 1 ? '' : 's'} and ${DIFFICULTY_SETTINGS[d].kingsmarketBuyouts} Buyout${DIFFICULTY_SETTINGS[d].kingsmarketBuyouts === 1 ? '' : 's'}.`,
                DIFFICULTY_SETTINGS[d].extraHomeStalls > 0 &&
                  `Each producer starts with ${DIFFICULTY_SETTINGS[d].extraHomeStalls} extra Stall in their home region.`,
                d === 'hard' && 'Each Pasture region also starts with 1 Doubt.',
              ]
                .filter(Boolean)
                .join(' '),
            }))}
          />
        </Section>
      )}
    </main>
  )
}

