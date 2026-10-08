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

type Hex = { fill: string; mark?: string }
const HEX_PTS = '0,-16 14,-8 14,8 0,16 -14,8 -14,-8'

function DemoBoard({ hexes, label }: { hexes: Hex[]; label: string }) {
  return (
    <svg className="tour-board" viewBox={`0 0 ${hexes.length * 34 + 6} 42`} role="img" aria-label={label}>
      {hexes.map((h, i) => (
        <g key={i} transform={`translate(${i * 34 + 20} 21)`}>
          <polygon points={HEX_PTS} fill={h.fill} stroke="var(--ink)" strokeWidth="1.5" />
          {h.mark && (
            <text textAnchor="middle" dy="5" fontSize="13" fontWeight="800" fill="var(--ink-on-fixed-fill)">
              {h.mark}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

const TOUR = [
  {
    title: 'Your round',
    text: `Each round, every producer gets ${ACTIONS_PER_ROUND} actions: sell, invest, scheme, supply and more.`,
    board: [
      { fill: 'var(--region-pasture)', mark: '1' },
      { fill: 'var(--region-crop)', mark: '2' },
      { fill: 'var(--region-coast)', mark: '3' },
    ],
    label: 'Three regions, numbered as actions one to three',
  },
  {
    title: 'Beat the Squeeze',
    text: 'Liberate regions by out-building the Outlets and Buyouts on them.',
    board: [
      { fill: 'var(--hollowell)', mark: '0.99' },
      { fill: 'var(--region-crop)', mark: 'S' },
      { fill: 'var(--region-pasture)', mark: 'S' },
    ],
    label: 'An Outlet-held region beside two of your Stalls',
  },
  {
    title: 'Mind the Rift',
    text: 'Watch Rift and Lost Land: the corporations get bolder as they climb.',
    board: [
      { fill: 'var(--candor)', mark: '?' },
      { fill: 'var(--hollowell)' },
      { fill: 'var(--candor)', mark: '?' },
    ],
    label: 'Corporate regions spreading across the board',
  },
  {
    title: 'Play your cards',
    text: 'Buy Improvements to strengthen your regions, and play Schemes at the right moment to turn a round around.',
    board: [
      { fill: 'var(--wheat)', mark: 'I' },
      { fill: 'var(--candor)', mark: 'S' },
    ],
    label: 'An Improvement card beside a Scheme card',
  },
  {
    title: 'Ask the table',
    text: 'Tap any card or action on the table for its rules; the "?" links land you back here.',
    board: [{ fill: 'var(--wheat)', mark: '?' }],
    label: 'A help marker',
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
        <DemoBoard hexes={page.board} label={page.label} />
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

