import { useMemo, useState } from 'react'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import { AGENDA_CARDS } from '../content/agenda'
import { PRODUCERS, ALL_PRODUCER_IDS } from '../content/producers'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { REGIONS } from '../content/map'

interface Props {
  onClose(): void
}

interface Entry {
  term: string
  body: string
}

const ACTIONS: Entry[] = [
  { term: 'Open Stall', body: 'Pay 1 Produce and place one of your Stalls in a region that contains your Stall or borders a region that does. Maximum 3 Stalls per region (all producers combined).' },
  { term: 'Supply', body: 'In a region with your Stall, either pay 2 Produce per Outlet to remove up to 2 Outlets, or pay 4 Produce to remove 1 Buyout (needs at least 2 Stalls in the region).' },
  { term: 'Rebut', body: 'In a region with your Stall, pay 1 Goodwill per Doubt to remove up to 2 Doubt.' },
  { term: 'Invest', body: 'Buy one face-up Improvement from the Market by paying its Marks cost. It joins your tableau and its Market space stays empty until cleanup.' },
  { term: 'Sell', body: 'Turn up to 3 Produce into the same number of Marks.' },
  { term: 'Scheme', body: "Play one face-up Scheme from Cath's Plan by paying its Goodwill cost, then resolve and discard it." },
  { term: 'Graft', body: 'Gain 1 Produce and 1 Marks. Always legal.' },
]

const TERMS: Entry[] = [
  { term: 'Liberated', body: 'A region with at least 1 Stall and no Outlets, Buyouts or Doubt. The first time a region is liberated, Public Trust +1 and the liberating producer gains +1 production.' },
  { term: 'Squeeze', body: 'An enemy step: in each matching region, Damage (Outlets + 2x Buyouts) compared to Defence (Stalls). If Damage is greater, place 1 Lost Land token; if it is at least Defence + 3, also remove a Stall. Public Trust also drops per Doubt there.' },
  { term: 'Expand', body: 'An enemy step: each matching region with at least 1 enemy piece gains an Outlet, or a Buyout if it already has 2+ Outlets and no Buyout.' },
  { term: 'Scout', body: 'An enemy step: reveal the top Pressure card and add 1 Outlet (and, at Stage III, 1 Doubt) to each matching region.' },
  { term: 'Rift', body: 'A shared track (0-6) that rises from Schemes and some Improvements. At 3 ("Cracks"), Agenda bonus effects are skipped. At 6 ("The Split"), the players remove one faction from the game in part.' },
  { term: 'Public Trust', body: "A shared track (0-15, starts at 10) representing the country's opinion of farmers. Reaching 0 loses the game." },
  { term: 'Lost Land', body: 'A pool of tokens (8 at Normal). Placing one shrinks a region\'s Stall cap. Needing one when the pool is empty loses the game.' },
]

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

