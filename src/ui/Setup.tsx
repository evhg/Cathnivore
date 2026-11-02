import { useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { LAYOUTS, layoutConfig, type LayoutId } from '../content/layouts'
import type { GameConfig, ProducerId, RegionId } from '../engine/types'
import { earnedPins, pinForEvent } from '../../shared/cath/pins'
import { marketEventFor } from '../engine/marketEvent'
import CathArt from './CathArt'
import Portrait from './portraits/Portrait'

export type Mode = 'solo' | 'hotseat'

interface Props {
  onStart(config: GameConfig, seed: number, mode: Mode): void
}

// SPEC 10.1/10.2 Setup screen: mode, producers, difficulty and an optional seed. Plain controls for now

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
        <CathArt className="setup-header-cath" framing="bust" expression="smirk" animate width={80} height={80} title="Cath" />
      </header>

      <section className="settings-card market-event" data-event={marketEvent.id}>
        <p className="market-event-eyebrow" aria-hidden="true">This week at the market</p>
        <h2>Market event: {marketEvent.name}</h2>
        <p className="market-event-line">“{marketEvent.banner}”</p>
        <p className="market-event-deal">{marketEvent.cheap.join(' and ')} Improvements cost 1 Mark less this week. Win during it to earn Cath's pin: {marketEvent.cosmetic}{earnedPins().includes(pinForEvent(marketEvent.id)!) ? ' (earned)' : ''}.</p>
      </section>

      <section className="settings-card setup-mode">
        <h2>Mode</h2>
        <div className="segmented mode-picker">
          <label>
            <span>
              <input type="radio" checked={mode === 'solo'} onChange={() => setMode('solo')} /> Solo (with an AI teammate)
            </span>
            {/* Plan item 8: the desktop spread draws each mode as a tile (hidden on phones, whose layout stays). */}
            <span className="mode-art" aria-hidden="true">
              <span className="mode-who">
                <Portrait character={producers[0] ?? 'mara'} size={52} />
                <i className="mode-tag is-you">You</i>
              </span>
              <span className="mode-who">
                <Portrait character={producers[1] ?? 'tomas'} size={52} />
                <i className="mode-tag is-ai">AI</i>
              </span>
            </span>
          </label>
          <label>
            <span>
              <input type="radio" checked={mode === 'hotseat'} onChange={() => setMode('hotseat')} /> Hot-seat (two humans)
            </span>
            <span className="mode-art" aria-hidden="true">
              <span className="mode-who">
                <Portrait character={producers[0] ?? 'mara'} size={52} />
                <i className="mode-tag is-you">P1</i>
              </span>
              <span className="mode-who">
                <Portrait character={producers[1] ?? 'tomas'} size={52} />
                <i className="mode-tag is-you">P2</i>
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-card setup-producers">
        <h2>Producers (pick 2)</h2>
        <button type="button" className="setup-recommend" onClick={() => setProducers([...RECOMMENDED_PAIR])}>
          Use recommended pair
        </button>
        <div className="producer-grid">
          {ALL_PRODUCER_IDS.map((id) => (
            <label key={id} className="producer-card" data-producer={id}>
              <input type="checkbox" checked={producers.includes(id)} onChange={() => toggleProducer(id)} />
              <span className="pc-portrait" aria-hidden="true">
                <Portrait character={id} size={112} />
              </span>
              <span className="pc-name">{PRODUCERS[id].name}</span>
              <span className="pc-role">{PRODUCERS[id].roleName}</span>
              <span className="pc-ability">{PRODUCERS[id].roleAbility}</span>
              {RECOMMENDED_PAIR.includes(id) && <span className="recommended-badge">Recommended</span>}
              <span className="pc-pick" aria-hidden="true">✓ Picked</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card setup-difficulty">
        <h2>Difficulty</h2>
        <div className="segmented">
          {(['easy', 'normal', 'hard'] as const).map((d) => (
            <label key={d}>
              <span>
                <input type="radio" checked={difficulty === d} onChange={() => setDifficulty(d)} />
                {d}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-card setup-seed">
        <h2>Map</h2>
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
        <label className="setup-seed-field">
          <span>Seed (optional)</span>
          <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="random" inputMode="numeric" />
        </label>
      </section>

      <button className="primary" disabled={!canStart} onClick={start}>
        Start
      </button>
    </main>
  )
}
