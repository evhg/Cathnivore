import { useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { LAYOUTS, layoutConfig, type LayoutId } from '../content/layouts'
import type { GameConfig, ProducerId, RegionId } from '../engine/types'
import { earnedPins, pinForEvent } from '../../shared/cath/pins'
import { marketEventFor } from '../engine/marketEvent'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import Portrait from './portraits/Portrait'
import { pairLine } from '../content/pairLines'

export type Mode = 'solo' | 'hotseat'

interface Props {
  onStart(config: GameConfig, seed: number, mode: Mode): void
}

// SPEC 10.1/10.2 Setup screen: mode, producers, difficulty, map and an optional seed. Plan item 8 made it a
// table spread at D; plan item 54 makes the phone one designed screen with no page scroll: the event a pinned
// poster strip, the producers a dealt row with the picked pair lifted and their abilities in full under it,
// the mode two chairs at a table, difficulty Hollowell's threat card, the maps on a shelf, the seed behind an
// Advanced chip and Start the stall's open sign.

/** Plan item 15: a layout's hexes in miniature. The ring shows its printed types; the others are dealt by the
 * seed, so their hexes are blank paper with Kingsmarket marked. */
function LayoutGlyph({ id }: { id: LayoutId }) {
  const l = LAYOUTS[id]
  const R = 9
  const W = R * Math.sqrt(3)
  const pts = (cx: number, cy: number) =>
    [0, 1, 2, 3, 4, 5].map((i) => `${(cx + R * 0.94 * Math.cos(((-90 + i * 60) * Math.PI) / 180)).toFixed(1)},${(cy + R * 0.94 * Math.sin(((-90 + i * 60) * Math.PI) / 180)).toFixed(1)}`).join(' ')
  const hexes = (Object.entries(l.hexes) as [RegionId, [number, number]][]).map(([rid, [q, r]]) => ({ rid, x: W * (q + r / 2), y: 1.5 * R * r }))
  const xs = hexes.map((h) => h.x)
  const ys = hexes.map((h) => h.y)
  const vb = `${Math.min(...xs) - W / 2 - 2} ${Math.min(...ys) - R - 2} ${Math.max(...xs) - Math.min(...xs) + W + 4} ${Math.max(...ys) - Math.min(...ys) + 2 * R + 4}`
  return (
    <svg className="layout-glyph" viewBox={vb} aria-hidden="true">
      {hexes.map((h) => {
        const type = h.rid === 'kingsmarket' ? 'capital' : l.fixedTypes?.[h.rid]
        return <polygon key={h.rid} className={`cmp-hex ${type ? `cmp-${type}` : 'cmp-off'}`} points={pts(h.x, h.y)} />
      })}
    </svg>
  )
}

export default function Setup({ onStart }: Props) {
  const [mode, setMode] = useState<Mode>('solo')
  const [producers, setProducers] = useState<ProducerId[]>(['mara', 'tomas'])
  const [difficulty, setDifficulty] = useState<GameConfig['difficulty']>('normal')
  const [seedInput, setSeedInput] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [layout, setLayout] = useState<LayoutId>('ring')
  const [marketEvent] = useState(() => marketEventFor(new Date()))

  function toggleProducer(id: ProducerId): void {
    setProducers((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 2) return [prev[1]!, id]
      return [...prev, id]
    })
  }

  const canStart = producers.length === 2

  function start(): void {
    const parsed = seedInput.trim() ? Number.parseInt(seedInput, 10) : NaN
    // A non-numeric seed (e.g. a pasted non-digit string) must not silently coerce to a real seed (0)
    // indistinguishable from actually typing "0" — fall back to a fresh random seed instead.
    const seed = Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31)
    onStart({ producers, difficulty, ...layoutConfig(layout, seed), marketEvent: marketEvent.id }, seed, mode)
  }

  return (
    <main className="setup">
      <header className="setup-header">
        <div className="setup-header-text">
          <h1>Quick Game</h1>
          <p className="setup-cath-line">“Pick two producers who'll cover each other, love.”</p>
        </div>
        {/* ROADMAP "Cath on the title, Campaign, setup and end screens": her default warm smirk, since
            no game state exists yet to react to here. */}
        <CathArt className="setup-header-cath" framing="bust" pose={SCREEN_POSE['cathnivore:setup']} expression="smirk" animate width={80} height={80} title="Cath" />
      </header>

      <section className="settings-card market-event" data-event={marketEvent.id}>
        <p className="market-event-eyebrow" aria-hidden="true">This week at the market</p>
        <h2>
          <span className="market-event-kicker">Market event: </span>
          {marketEvent.name}
        </h2>
        <p className="market-event-line">“{marketEvent.banner}”</p>
        <p className="market-event-deal">{marketEvent.cheap.join(' and ')} Improvements cost 1 Mark less this week. Win during it to earn Cath's pin: {marketEvent.cosmetic}{earnedPins().includes(pinForEvent(marketEvent.id)!) ? ' (earned)' : ''}.</p>
      </section>

      <section className="settings-card setup-mode">
        <h2>Mode</h2>
        <div className="segmented mode-picker">
          <label>
            <span className="mode-name">
              <input type="radio" name="mode" aria-label="Solo (with an AI teammate)" checked={mode === 'solo'} onChange={() => setMode('solo')} /> Solo
              <small> with an AI</small>
            </span>
            {/* Plan item 8: the desktop spread draws each mode as a tile (hidden on phones, whose layout stays). */}
            <span className="mode-art" aria-hidden="true">
              <Seat who={producers[0] ?? 'mara'} tag="You" ai={false} />
              <Seat who={producers[1] ?? 'tomas'} tag="AI" ai={true} />
            </span>
          </label>
          <label>
            <span className="mode-name">
              <input type="radio" name="mode" aria-label="Hot-seat (two humans)" checked={mode === 'hotseat'} onChange={() => setMode('hotseat')} /> Hot-seat
              <small> two players</small>
            </span>
            <span className="mode-art" aria-hidden="true">
              <Seat who={producers[0] ?? 'mara'} tag="P1" ai={false} />
              <Seat who={producers[1] ?? 'tomas'} tag="P2" ai={false} />
            </span>
          </label>
        </div>
      </section>

      <section className="settings-card setup-producers">
        <div className="setup-producers-head">
          <h2>Producers (pick 2)</h2>
          <button type="button" className="setup-recommend" onClick={() => setProducers([...RECOMMENDED_PAIR])}>
            Use recommended pair
          </button>
        </div>
        <div className="producer-grid">
          {ALL_PRODUCER_IDS.map((id) => (
            <label key={id} className="producer-card" data-producer={id}>
              <input
                type="checkbox"
                aria-label={`${PRODUCERS[id].name}, ${PRODUCERS[id].roleName}. ${PRODUCERS[id].roleAbility}${RECOMMENDED_PAIR.includes(id) ? ' Recommended.' : ''}`}
                checked={producers.includes(id)}
                onChange={() => toggleProducer(id)}
              />
              <span className="pc-portrait" aria-hidden="true">
                <Portrait character={id} size={112} />
              </span>
              <span className="pc-name">{PRODUCERS[id].name}</span>
              <span className="pc-role">{PRODUCERS[id].roleName}</span>
              <span className="pc-ability">{PRODUCERS[id].roleAbility}</span>
              {RECOMMENDED_PAIR.includes(id) && <span className="recommended-badge">Recommended</span>}
              <span className="pc-pick" aria-hidden="true">
                ✓<span className="pc-pick-word"> Picked</span>
              </span>
            </label>
          ))}
        </div>
        <PairPanel producers={producers} />
      </section>

      <section className="settings-card setup-difficulty">
        <h2>
          Difficulty<span className="threat-kicker" aria-hidden="true"> · Hollowell's threat</span>
        </h2>
        <div className="segmented">
          {(['easy', 'normal', 'hard'] as const).map((d) => (
            <label key={d}>
              <span>
                <input type="radio" name="difficulty" checked={difficulty === d} onChange={() => setDifficulty(d)} />
                {d}
              </span>
            </label>
          ))}
        </div>
        <DifficultySheet key={difficulty} difficulty={difficulty} />
      </section>

      <section className="settings-card setup-seed" data-advanced={advanced || undefined}>
        <div className="setup-map-head">
          <h2>Map</h2>
          {/* Plan item 54: on a phone the seed folds behind this chip; at D the field always shows. */}
          <button type="button" className="setup-advanced" aria-expanded={advanced} aria-controls="setup-seed-field" onClick={() => setAdvanced((a) => !a)}>
            Advanced
          </button>
        </div>
        <div className="layout-picker" role="radiogroup" aria-label="Map">
          {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
            <label key={id} className="layout-tile" data-layout={id}>
              <input type="radio" name="layout" checked={layout === id} onChange={() => setLayout(id)} />
              <LayoutGlyph id={id} />
              <span className="layout-name">{LAYOUTS[id].name}</span>
              <span className="layout-blurb">{LAYOUTS[id].blurb}</span>
            </label>
          ))}
        </div>
        <label className="setup-seed-field" id="setup-seed-field">
          <span>Seed (optional)</span>
          <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="random" inputMode="numeric" />
        </label>
      </section>

      <button className="primary setup-start" disabled={!canStart} onClick={start}>
        <span className="open-sign-kicker" aria-hidden="true">
          {canStart ? 'Open' : 'Closed · pick two'}
        </span>
        <span className="open-sign-word">Start</span>
      </button>
    </main>
  )
}

/** Plan item 54: a seat at the table: a drawn chair, the producer sitting in it, and who plays them. */
function Seat({ who, tag, ai }: { who: ProducerId; tag: string; ai: boolean }) {
  return (
    <span className="mode-who">
      <svg className="mode-chair" viewBox="0 0 40 48" aria-hidden="true">
        <path className="chair-back" d="M7 30V9a7 7 0 0 1 7-7h12a7 7 0 0 1 7 7v21" />
        <rect className="chair-seat" x="3" y="30" width="34" height="5" rx="2" />
        <path className="chair-legs" d="M7 35v12M33 35v12" />
      </svg>
      <span className="mode-sit">
        <Portrait character={who} size={52} />
      </span>
      <i className={`mode-tag ${ai ? 'is-ai' : 'is-you'}`}>{tag}</i>
    </span>
  )
}

/** Plan item 54: the picked pair's abilities in full, with Cath's line on how they cover each other. */
function PairPanel({ producers }: { producers: ProducerId[] }) {
  const [a, b] = producers
  return (
    <div className="pair-panel" aria-live="polite">
      <div className="pair-abilities">
        {[a, b].map((id, i) =>
          id ? (
            <p key={id} className="pair-ability" data-producer={id}>
              <b>{PRODUCERS[id].roleName.split(', ')[1] ?? PRODUCERS[id].roleName}</b> {PRODUCERS[id].roleAbility}
            </p>
          ) : (
            <p key={`empty-${i}`} className="pair-ability is-empty">
              Pick {producers.length === 0 && i === 1 ? 'another' : 'one more'} producer.
            </p>
          ),
        )}
      </div>
      {a && b && (
        <p className="pair-line">
          <span className="pair-line-who">Cath</span> “{pairLine(a, b)}”
        </p>
      )}
    </div>
  )
}

const DIFFICULTY_LINE: Record<GameConfig['difficulty'], string> = {
  easy: 'A gentle week, love. Learn the market.',
  normal: 'A fair fight. Hollowell plays to win.',
  hard: 'They own the capital. Every move counts.',
}

/**
 * What the chosen difficulty changes, read from the same table the rules use, so the Setup card never says
 * one thing and the game does another. A line that differs from Normal is marked.
 */
function DifficultySheet({ difficulty }: { difficulty: GameConfig['difficulty'] }) {
  const s = DIFFICULTY_SETTINGS[difficulty]
  const n = DIFFICULTY_SETTINGS.normal
  const rows: Array<[string, string, boolean]> = [
    ['Public Trust', `starts at ${s.publicTrust}`, s.publicTrust !== n.publicTrust],
    ['Lost Land', `${s.lostLandPool} tokens to lose`, s.lostLandPool !== n.lostLandPool],
    [
      'Kingsmarket',
      `${s.kingsmarketOutlets} Outlet${s.kingsmarketOutlets === 1 ? '' : 's'}${s.kingsmarketBuyouts ? `, ${s.kingsmarketBuyouts} Buyout` : ', no Buyout'}`,
      s.kingsmarketOutlets !== n.kingsmarketOutlets || s.kingsmarketBuyouts !== n.kingsmarketBuyouts,
    ],
  ]
  if (s.extraHomeStalls) rows.push(['Home', `+${s.extraHomeStalls} Stall to start`, true])
  if (difficulty === 'hard') rows.push(['Pastures', '1 Doubt each', true])
  return (
    <div className="difficulty-sheet" aria-live="polite">
      <p className="difficulty-line">“{DIFFICULTY_LINE[difficulty]}”</p>
      <dl>
        {rows.map(([k, v, changed]) => (
          <div key={k} className={changed ? 'is-changed' : undefined}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
