import { useMemo, useState } from 'react'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import { AGENDA_CARDS } from '../content/agenda'
import { PRODUCERS, ALL_PRODUCER_IDS } from '../content/producers'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { REGIONS } from '../content/map'
import { ACTION_TERMS, GLOSSARY_TERMS, type GlossaryEntry } from '../content/terms'

interface Props {
  onClose(): void
}

type Entry = GlossaryEntry

const ACTIONS = ACTION_TERMS
const TERMS = GLOSSARY_TERMS

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rules-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function EntryList({ entries }: { entries: Entry[] }) {
  return (
    <dl className="rules-entries">
      {entries.map((e) => (
        <div key={e.term} className="rules-entry">
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
export default function RulesReference({ onClose }: Props) {
  const [query, setQuery] = useState('')

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

      {nothingFound && <p className="rules-empty">No matches for "{query}".</p>}

      {actions.length > 0 && (
        <Section title="Actions (3 per producer per round)">
          <EntryList entries={actions} />
        </Section>
      )}

      {terms.length > 0 && (
        <Section title="Key terms">
          <EntryList entries={terms} />
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
              body: 'Resolves for its faction each round; its bonus effect is skipped once Rift reaches 3.',
            }))}
          />
        </Section>
      )}

      {!query && (
        <Section title="Difficulty">
          <EntryList
            entries={(['easy', 'normal', 'hard'] as const).map((d) => ({
              term: d[0]!.toUpperCase() + d.slice(1),
              body: `Public Trust starts at ${DIFFICULTY_SETTINGS[d].publicTrust}, Lost Land pool of ${DIFFICULTY_SETTINGS[d].lostLandPool}.`,
            }))}
          />
        </Section>
      )}
    </main>
  )
}

