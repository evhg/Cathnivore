import { useEffect, useMemo, useRef, useState } from 'react'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import { AGENDA_CARDS } from '../content/agenda'
import { PRODUCERS, ALL_PRODUCER_IDS } from '../content/producers'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { REGIONS } from '../content/map'
import { ACTION_TERMS, GLOSSARY_TERMS, entryDomId, type GlossaryEntry } from '../content/terms'
import { ALMANAC, almanacSearch, type AlmanacChapter, type AlmanacChapterId, type AlmanacGallery } from '../content/almanac'
import { ACTIONS_PER_ROUND } from '../engine/region'
import CathArt from './CathArt'
import Portrait from './portraits/Portrait'
import Vignette from './Vignette'
import { vignetteFor } from './vignetteKind'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import TourBoard, { type TourCard, type TourHex } from './TourBoard'
import { plural } from '../content/plural'
import '../styles/almanac.css'

interface Props {
  onClose(): void
  // SPEC 8.1: "a '?' link to the rules reference" from a tutorial prompt should land the player on the
  // term that prompt was about, not just the top of the page. The exact glossary/action term name (see
  // `Game.tsx`'s `tutorialTermFor`): the almanac opens on that term's page and highlights it.
  initialTerm?: string
}

const ALL_TERMS: GlossaryEntry[] = [...ACTION_TERMS, ...GLOSSARY_TERMS]

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

// ROADMAP 18: Cath's paged quick tour, one tiny demo board per page. Plan item 56: the almanac's "Start here" page.
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
      <CathArt framing="bust" pose={SCREEN_POSE['cathnivore:rules']} expression="delighted" width={64} height={64} title="Cath" />
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

function hit(query: string, ...fields: (string | undefined)[]): boolean {
  if (!query) return false
  const q = query.toLowerCase()
  return fields.some((f) => f?.toLowerCase().includes(q))
}

function Entries({ terms, query, activeTerm }: { terms: string[]; query: string; activeTerm?: string }) {
  const entries = terms.map((t) => ALL_TERMS.find((e) => e.term === t)).filter((e): e is GlossaryEntry => !!e)
  if (!entries.length) return null
  // An entry named by the search is the hit; the entries that only mention it in passing stay plain.
  const named = entries.some((e) => hit(query, e.term))
  return (
    <dl className="rules-entries almanac-entries">
      {entries.map((e) => {
        const on = e.term === activeTerm || (named ? hit(query, e.term) : hit(query, e.term, e.body))
        return (
          <div key={e.term} id={entryDomId(e.term)} className={on ? 'rules-entry rules-entry-active' : 'rules-entry'} data-hit={on || undefined}>
            <dt>{e.term}</dt>
            <dd>{e.body}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/** One card in a gallery: a drawn banner, the name and price, and its rules line. */
function GalleryCard({ art, name, price, text, line, on, kind }: {
  art: React.ReactNode
  name: string
  price?: string
  text: string
  line?: string
  on: boolean
  kind: string
}) {
  return (
    <li className={`almanac-card almanac-card-${kind}`} data-hit={on || undefined}>
      <div className="almanac-card-art">{art}</div>
      <div className="almanac-card-head">
        <h4>{name}</h4>
        {price && <span className="almanac-price">{price}</span>}
      </div>
      <p className="almanac-card-text">{text}</p>
      {line && <p className="almanac-card-line">{line}</p>}
    </li>
  )
}

function Gallery({ gallery, query }: { gallery: AlmanacGallery; query: string }) {
  if (gallery === 'producers') {
    return (
      <ul className="almanac-gallery almanac-gallery-people" aria-label="The producers">
        {ALL_PRODUCER_IDS.map((id) => {
          const p = PRODUCERS[id]
          return (
            <GalleryCard
              key={id}
              kind="producer"
              art={<Portrait character={id} size={64} />}
              name={p.name}
              price={REGIONS[p.home].name}
              text={`${p.roleName}: ${p.roleAbility}`}
              on={hit(query, p.name, p.roleName, p.roleAbility)}
            />
          )
        })}
      </ul>
    )
  }
  if (gallery === 'improvements') {
    return (
      <ul className="almanac-gallery" aria-label="Every Improvement">
        {IMPROVEMENTS.map((c) => (
          <GalleryCard
            key={c.id}
            kind="improvement"
            art={<Vignette kind={vignetteFor(c)} seed={c.id} />}
            name={c.name}
            price={plural(c.cost, 'Mark')}
            text={c.text}
            line={c.flavor}
            on={hit(query, c.name, c.text, c.flavor, ...c.tags)}
          />
        ))}
      </ul>
    )
  }
  if (gallery === 'schemes') {
    return (
      <ul className="almanac-gallery" aria-label="Every Scheme in Cath's Plan">
        {SCHEMES.map((c) => (
          <GalleryCard
            key={c.id}
            kind="scheme"
            art={<Vignette kind={vignetteFor(c)} seed={c.id} />}
            name={c.name}
            price={`${c.cost} Goodwill`}
            text={c.text}
            line={c.line}
            on={hit(query, c.name, c.text, c.line, ...(c.tags ?? []))}
          />
        ))}
      </ul>
    )
  }
  if (gallery === 'agenda') {
    return (
      <>
        <p className="almanac-aside">An Agenda card’s bonus effect is skipped once Rift reaches 3.</p>
        <ul className="almanac-gallery almanac-gallery-news" aria-label="Every Agenda card">
          {AGENDA_CARDS.map((c) => (
            <li key={c.id} className={`almanac-clipping is-${c.faction}`} data-hit={hit(query, c.headline, c.faction, c.text) || undefined}>
              <span className="almanac-masthead">{c.faction === 'hollowell' ? 'Hollowell' : 'Candor'}</span>
              <h4>{c.headline}</h4>
              <p>{c.text}</p>
            </li>
          ))}
        </ul>
      </>
    )
  }
  return (
    <ul className="almanac-gallery almanac-gallery-difficulty" aria-label="Difficulty">
      {(['easy', 'normal', 'hard'] as const).map((d) => {
        const s = DIFFICULTY_SETTINGS[d]
        const name = d[0]!.toUpperCase() + d.slice(1)
        return (
          <li key={d} className={`almanac-difficulty is-${d}`} data-hit={hit(query, name, 'Difficulty') || undefined}>
            <h4>{name}</h4>
            <ul>
              <li>Public Trust starts at {s.publicTrust}</li>
              <li>{plural(s.lostLandPool, 'Lost Land token')} to place</li>
              <li>Kingsmarket starts with {plural(s.kingsmarketOutlets, 'Outlet')} and {plural(s.kingsmarketBuyouts, 'Buyout')}</li>
              {s.extraHomeStalls > 0 && <li>Each producer starts with {s.extraHomeStalls} extra Stall at home</li>}
              {d === 'hard' && <li>Each Pasture region starts with 1 Doubt</li>}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

function Picture({ ch }: { ch: AlmanacChapter }) {
  const ill = ch.illustration
  if ('tour' in ill) {
    const t = TOUR[ill.tour]!
    return (
      <figure className="almanac-figure is-board">
        <TourBoard hexes={t.board} cards={t.cards} label={t.label} />
      </figure>
    )
  }
  return (
    <figure className="almanac-figure is-vignette">
      <Vignette kind={ill.vignette} seed={ch.id} />
    </figure>
  )
}

function Page({ ch, n, query, activeTerm }: { ch: AlmanacChapter; n: number; query: string; activeTerm?: string }) {
  return (
    <article className="almanac-page" data-chapter={ch.id}>
      <header className="almanac-page-head">
        <span className="almanac-chapter-no">Chapter {n}</span>
        <h2>{ch.title}</h2>
      </header>
      <div className="almanac-spread">
        <Picture ch={ch} />
        <aside className="almanac-note" aria-label="Cath's note">
          <CathArt framing="bust" expression="delighted" width={44} height={44} title="Cath" />
          <p>{ch.note}</p>
        </aside>
      </div>
      <Entries terms={ch.terms} query={query} activeTerm={activeTerm} />
      {ch.galleries.map((g) => (
        <Gallery key={g} gallery={g} query={ch.terms.some((t) => hit(query, t)) ? '' : query} />
      ))}
    </article>
  )
}

type Tab = 'start' | AlmanacChapterId
const TABS: Array<{ id: Tab; label: string }> = [{ id: 'start', label: 'Start here' }, ...ALMANAC.map((c) => ({ id: c.id as Tab, label: c.id === 'winning' ? 'Winning' : c.title }))]

function chapterOfTerm(term: string | undefined): AlmanacChapterId | undefined {
  return term ? ALMANAC.find((c) => c.terms.includes(term))?.id : undefined
}

// SPEC 10.1/10.5: rules reference, generated from the rules data (so it can never disagree with the
// engine), searchable by name/text/flavor. Plan item 56: laid out as Cath's almanac, a chapter per page.
export default function RulesReference({ onClose, initialTerm }: Props) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>(() => chapterOfTerm(initialTerm) ?? 'start')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const pageRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => almanacSearch(query), [query])
  const searching = query.trim().length > 0

  // A search jumps to its best page, unless the page shown is already a hit.
  useEffect(() => {
    if (!searching || !hits.length) return
    setTab((t) => (hits.includes(t as AlmanacChapterId) ? t : hits[0]!))
  }, [hits, searching])

  // Bring the first highlighted entry or card into view: the tutorial's "?" term, or a search hit.
  useEffect(() => {
    if (!searching && !initialTerm) return
    const el = pageRef.current?.querySelector('[data-hit]')
    el?.scrollIntoView({ block: 'center' })
  }, [tab, hits, searching, initialTerm])

  const go = (t: Tab, focus = false) => {
    setTab(t)
    if (focus) tabRefs.current[t]?.focus()
  }
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab)
    let j = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % TABS.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + TABS.length) % TABS.length
    if (e.key === 'Home') j = 0
    if (e.key === 'End') j = TABS.length - 1
    if (j < 0) return
    e.preventDefault()
    go(TABS[j]!.id, true)
  }

  const idx = TABS.findIndex((t) => t.id === tab)
  const chapter = ALMANAC.find((c) => c.id === tab)
  const prev = TABS[idx - 1]
  const next = TABS[idx + 1]

  return (
    <main className="rules-reference almanac">
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
      {searching && (
        <p className="almanac-found" aria-live="polite">
          {hits.length
            ? `“${query.trim()}” is on ${plural(hits.length, 'page')}: ${hits.map((h) => ALMANAC.find((c) => c.id === h)!.title).join(', ')}.`
            : `No matches for "${query}".`}
        </p>
      )}

      <nav className="almanac-tabs" role="tablist" aria-label="Almanac chapters" onKeyDown={onTabKey}>
        {TABS.map((t) => {
          const isHit = searching && hits.includes(t.id as AlmanacChapterId)
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[t.id] = el }}
              role="tab"
              id={`almanac-tab-${t.id}`}
              aria-controls="almanac-panel"
              aria-selected={t.id === tab}
              tabIndex={t.id === tab ? 0 : -1}
              className={`almanac-tab${isHit ? ' is-hit' : ''}${searching && !isHit ? ' is-dim' : ''}`}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      <div className="almanac-panel" id="almanac-panel" role="tabpanel" aria-labelledby={`almanac-tab-${tab}`} ref={pageRef}>
        {chapter ? (
          <Page ch={chapter} n={idx} query={searching ? query.trim() : ''} activeTerm={initialTerm} />
        ) : (
          <QuickTour />
        )}
      </div>

      <nav className="almanac-pager" aria-label="Turn the page">
        {prev ? <button onClick={() => go(prev.id)}>← {prev.label}</button> : <span />}
        {next ? <button onClick={() => go(next.id)}>{next.label} →</button> : <span />}
      </nav>
    </main>
  )
}
