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
        <h1>How to Play</h1>
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
        <section className="rules-basics settings-card">
          <CathArt framing="bust" expression="delighted" width={64} height={64} title="Cath" />
          <div>
            <h2>The basics, from Cath</h2>
            <ol>
              <li>Each round, every producer gets {ACTIONS_PER_ROUND} actions: sell, invest, scheme, supply and more.</li>
              <li>Liberate regions from the Squeeze by out-building the Outlets and Buyouts on them.</li>
              <li>Watch Rift and Lost Land: the corporations get bolder as they climb.</li>
              <li>Tap any card or action on the table for its rules; the "?" links land you back here.</li>
            </ol>
          </div>
        </section>
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

