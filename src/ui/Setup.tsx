import { useEffect, useRef, useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { LAYOUTS, layoutConfig, type LayoutId } from '../content/layouts'
import BoardMiniature from './BoardMiniature'
import type { GameConfig, ProducerId } from '../engine/types'
import { earnedPins, pinForEvent, pinSvg, PINS, type CathPin } from '../../shared/cath/pins'
import { MARKET_EVENTS, marketEventFor, type MarketEventId } from '../engine/marketEvent'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import { CATH_SKIN } from '../../shared/cath/cath'
import Portrait from './portraits/Portrait'
import { RoleArt } from './icons/ActionArt'
import { RoleProducerContext } from './icons/artScene'
import { pairLine, setupCath } from '../content/pairLines'
import { useMedia } from './useMedia'

export type Mode = 'solo' | 'hotseat'

interface Props {
  onStart(config: GameConfig, seed: number, mode: Mode): void
}

// SPEC 10.1/10.2 Setup screen: mode, producers, difficulty, map and an optional seed. Plan item 8 made it a
// table spread at D; plan item 54 makes the phone one designed screen with no page scroll: the event a pinned
// poster strip, the producers a dealt row with the picked pair lifted and their abilities in full under it,
// the mode two chairs at a table, difficulty Hollowell's threat card, the maps on a shelf, the seed behind an
// Advanced chip and Start the stall's open sign.

export default function Setup({ onStart }: Props) {
  const [mode, setMode] = useState<Mode>('solo')
  const [producers, setProducers] = useState<ProducerId[]>(['mara', 'tomas'])
  const [difficulty, setDifficulty] = useState<GameConfig['difficulty']>('normal')
  const [seedInput, setSeedInput] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [layout, setLayout] = useState<LayoutId>('ring')
  const [marketEvent] = useState(() => marketEventFor(new Date()))
  // Plan item 195: Start rolls the stall's shutter up (520 ms; a 180 ms fade under reduced motion) before the game opens.
  const [opening, setOpening] = useState(false)
  const openTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(openTimer.current), [])

  function toggleProducer(id: ProducerId): void {
    setProducers((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 2) return [prev[1]!, id]
      return [...prev, id]
    })
  }

  const canStart = producers.length === 2

  function rollUp(): void {
    if (opening) return
    setOpening(true)
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-animations')
    openTimer.current = window.setTimeout(start, calm ? 180 : 520)
  }

  function start(): void {
    const parsed = seedInput.trim() ? Number.parseInt(seedInput, 10) : NaN
    // A non-numeric seed (e.g. a pasted non-digit string) must not silently coerce to a real seed (0)
    // indistinguishable from actually typing "0" — fall back to a fresh random seed instead.
    const seed = Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31)
    onStart({ producers, difficulty, ...layoutConfig(layout, seed), marketEvent: marketEvent.id }, seed, mode)
  }

  const rail = useMedia('(min-width: 1100px)')
  const modeSection = (
    <section className="settings-card setup-mode">
      <h2>Mode</h2>
      {/* Plan item 204: at D each mode is a tent place card standing on a ledge, the picked one upright, the other
          laid flat; the phone keeps its chairs. */}
      <div className="segmented mode-picker">
        <label data-place-card="solo">
          <span className="place-word" aria-hidden="true">You and an AI</span>
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
        <label data-place-card="hotseat">
          <span className="place-word" aria-hidden="true">Two at the table</span>
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
  )
  const difficultySection = (
    <section className="settings-card setup-difficulty">
      <h2>
        Difficulty<span className="threat-kicker" aria-hidden="true"> · Hollowell's threat</span>
      </h2>
      <div className="segmented">
        {(['easy', 'normal', 'hard'] as const).map((d) => (
          <label key={d} className="price-tag" data-tag={d}>
            <span>
              <input type="radio" name="difficulty" checked={difficulty === d} onChange={() => setDifficulty(d)} />
              {d}
            </span>
          </label>
        ))}
      </div>
      <DifficultySheet key={difficulty} difficulty={difficulty} />
    </section>
  )

  const producersSection = (
      <section className="settings-card setup-producers">
        <div className="setup-producers-head">
          <h2>Producers (pick 2)</h2>
          <button type="button" className="setup-recommend" onClick={() => setProducers([...RECOMMENDED_PAIR])}>
            Use recommended pair
          </button>
        </div>
        <div className="producer-grid">
          {ALL_PRODUCER_IDS.map((id) => (
            <label key={id} className="producer-card" data-producer={id} data-seat={producers.includes(id) ? id : undefined}>
              <input
                type="checkbox"
                aria-label={`${PRODUCERS[id].name}, ${PRODUCERS[id].roleName}. ${PRODUCERS[id].roleAbility}${RECOMMENDED_PAIR.includes(id) ? ' Recommended.' : ''}`}
                checked={producers.includes(id)}
                onChange={() => toggleProducer(id)}
              />
              {/* Plan item 67: at D each producer is pulled up to the table in a chair (item 54's seat, larger). */}
              <svg className="pc-chair" viewBox="0 0 40 48" aria-hidden="true">
                <path className="chair-back" d="M7 30V9a7 7 0 0 1 7-7h12a7 7 0 0 1 7 7v21" />
                <rect className="chair-seat" x="3" y="30" width="34" height="5" rx="2" />
              </svg>
              <span className="pc-portrait" aria-hidden="true">
                <Portrait character={id} size={112} />
              </span>
              <span className="pc-name">{PRODUCERS[id].name}</span>
              {/* Plan item 80: on a phone the four are small toggles by first name; the picked pair are drawn big below. */}
              <span className="pc-short" aria-hidden="true">{shortName(PRODUCERS[id].name)}</span>
              <span className="pc-role">{PRODUCERS[id].roleName}</span>
              {/* Plan item 328: at D the power is an ink stamp with its own picture (the hand's role card art). */}
              <span className="pc-stamp" aria-hidden="true">
                <RoleProducerContext.Provider value={id}>
                  <RoleArt size={22} />
                </RoleProducerContext.Provider>
                {powerName(PRODUCERS[id].roleName)}
              </span>
              <span className="pc-ability">{PRODUCERS[id].roleAbility}</span>
              {RECOMMENDED_PAIR.includes(id) && (
                <span className="recommended-badge">
                  {/* Plan item 328: at D Cath's own leaf pin marks the pair she'd pick */}
                  <svg className="pc-leaf-pin" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M3 13C3 7 7 3 13 3c0 6-4 10-10 10Z" />
                    <path className="pc-leaf-vein" d="M3.5 12.5 10 6" />
                  </svg>
                  <span className="pc-rec-word">Recommended</span>
                </span>
              )}
              <span className="pc-pick" aria-hidden="true">
                ✓<span className="pc-pick-word"> Picked</span>
              </span>
            </label>
          ))}
        </div>
        <PairPanel producers={producers} />
      </section>
  )
  const mapSection = (
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
              <BoardMiniature id={id} />
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
  )
  const startButton = (
    <button className="primary setup-start" disabled={!canStart} onClick={rollUp} data-opening={opening || undefined}>
      <span className="shutter">
        <span className="open-sign-kicker" aria-hidden="true">
          {canStart ? 'Open' : 'Closed · pick two'}
        </span>
        <span className="open-sign-word">Start</span>
      </span>
    </button>
  )
  const eventFlyer = (
    <section className="settings-card market-event" data-event={marketEvent.id} data-flyer>
      <p className="market-event-eyebrow" aria-hidden="true">This week at the market</p>
      <h2>
        <span className="market-event-kicker">Market event: </span>
        {/* Plan item 201: the name breaks as a whole ('Great / Glut' left one word on a line). */}
        <span className="market-event-name">{marketEvent.name}</span>
      </h2>
      <p className="market-event-line">“{marketEvent.banner}”</p>
      {/* Plan item 367: at D Cath holds the poster up by its edge: her fingers curl over it, her coat cuff behind. */}
      {rail && (
        <svg className="poster-grip" viewBox="0 0 40 52" aria-hidden="true" focusable="false">
          <path className="grip-cuff" d="M22 0h16v22l-16 3Z" />
          <path d="M24 20c-6 0-12 3-15 7v22c4 2 9 2 13 0l4-12Z" fill={CATH_SKIN.base} stroke={CATH_SKIN.line} strokeWidth="1.2" strokeLinejoin="round" />
          {[27, 34, 41].map((y) => (
            <path key={y} d={`M9 ${y}h-6a3.2 3.2 0 0 0 0 6.4h6`} fill={CATH_SKIN.base} stroke={CATH_SKIN.line} strokeWidth="1.2" />
          ))}
          <path d="M10 26c4 0 7 1 9 3" fill="none" stroke={CATH_SKIN.shade} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {/* Plan item 204: at D the rule is a stamped line on the flyer; on a phone the two run on as one line. */}
      <p className="market-event-deal">
        <span className="market-event-rule" data-stamp>{marketEvent.cheap.join(' and ')} Improvements cost 1 Mark less this week.</span>{' '}
        <span className="market-event-pin">Win during it to earn Cath's pin: {marketEvent.cosmetic}{earnedPins().includes(pinForEvent(marketEvent.id)!) ? ' (earned)' : ''}.</span>
      </p>
    </section>
  )

  // Plan item 367: at D the Setup is one table in three numbered steps (who, where, how hard), with Cath behind a
  // counter on its right holding the week's poster, and Start a plank on the counter in front of her. The phone
  // keeps its own screen (item 349), below.
  if (rail)
    return (
      <main className="setup" data-steps>
        <header className="setup-header">
          <div className="setup-header-text">
            <h1>Quick Game</h1>
            <p className="setup-cath-line">
              <span className="cath-line-ask">Three steps, then open the stall.</span>
            </p>
          </div>
        </header>
        <div className="setup-table" data-setup-table>
          <section className="setup-step" data-step="1">
            <StepHead n={1} words="Who's at the stall" hint="you, and two producers who cover each other" />
            <div className="step-who">
              {modeSection}
              {producersSection}
            </div>
          </section>
          <section className="setup-step" data-step="2">
            <StepHead n={2} words="Where you trade" />
            {mapSection}
          </section>
          <section className="setup-step" data-step="3">
            <StepHead n={3} words="How hard Hollowell pushes" />
            {difficultySection}
            {/* Plan item 367: Cath's pins, the prize for winning an event week, lie by Hollowell's tags. */}
            <PinTin week={marketEvent.id} />
          </section>
        </div>
        <SetupCath producers={producers} difficulty={difficulty} event={marketEvent.banner} />
        {eventFlyer}
        <div className="setup-counter" aria-hidden="true" />
        {startButton}
      </main>
    )

  return (
    <main className="setup">
      <header className="setup-header">
        <div className="setup-header-text">
          <h1>Quick Game</h1>
          <p className="setup-cath-line">
            <span className="cath-line-ask">“Pick two producers who'll cover each other, love.”</span>
            {/* Plan item 80: on a phone, once a pair is picked, Cath's line on them is said up here, beside her. */}
            {producers.length === 2 && (
              <span className="cath-line-pair" aria-hidden="true">
                “{pairLine(producers[0]!, producers[1]!)}”
              </span>
            )}
          </p>
        </div>
        {/* ROADMAP "Cath on the title, Campaign, setup and end screens": her default warm smirk, since
            no game state exists yet to react to here. */}
        <CathArt className="setup-header-cath" framing="bust" pose={SCREEN_POSE['cathnivore:setup']} expression="smirk" animate width={80} height={80} title="Cath" />
      </header>

      {eventFlyer}

      {modeSection}

      {/* Plan item 195: the producers, the maps and Hollowell's price tags laid on one gingham table, Cath at its head. */}
      <div className="setup-table" data-setup-table>
      {producersSection}
      {mapSection}

      {difficultySection}

      </div>

      {startButton}
    </main>
  )
}

/**
 * Plan item 204: Cath's market pins in a tin on the stall (D only): one enamel badge per Marrow Market event, earned
 * ones in colour, the rest dimmed with the week that awards them; this week's pin is ringed.
 */
function PinTin({ week }: { week: MarketEventId }) {
  const earned = earnedPins()
  const pins = Object.keys(PINS) as CathPin[]
  return (
    <div className="pin-tin" role="group" aria-label="Cath's market pins">
      <p className="pin-tin-head" aria-hidden="true">
        Cath's pins <span>{earned.length} of {pins.length}</span>
      </p>
      <ul>
        {pins.map((pin) => {
          const ev = PINS[pin].event as MarketEventId
          const has = earned.includes(pin)
          return (
            <li key={pin} data-pin={pin} data-earned={has || undefined} data-week={ev === week || undefined}>
              <svg viewBox="-16 -16 32 32" aria-hidden="true" dangerouslySetInnerHTML={{ __html: pinSvg(pin) }} />
              <span className="pin-name">{PINS[pin].name}</span>
              <span className="pin-when">{has ? 'Earned' : ev === week ? 'Win this week' : MARKET_EVENTS[ev].name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Plan item 367: a step's heading at D: its numeral, its words and a quiet hint. */
function StepHead({ n, words, hint }: { n: number; words: string; hint?: string }) {
  return (
    <h2 className="step-head">
      <span className="step-num" aria-hidden="true">{n}</span>
      <span className="step-words">{words}</span>
      {hint && <small className="step-hint">{hint}</small>}
    </h2>
  )
}

/** 'Litigator, Injunction' -> 'Injunction': the power's own name, for the producer card's stamp (plan item 328). */
function powerName(roleName: string): string {
  return roleName.split(', ').pop() ?? roleName
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

/** "Dr Ines Farrow" -> "Ines": the phone toggles' label. */
function shortName(name: string): string {
  return name.replace(/^Dr\.? /, '').split(' ')[0] ?? name
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
              <span className="pair-portrait" aria-hidden="true">
                <Portrait character={id} size={100} />
                <span className="pair-plate">{PRODUCERS[id].name}</span>
              </span>
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

const PRODUCER_NAMES = Object.fromEntries(ALL_PRODUCER_IDS.map((id) => [id, PRODUCERS[id].name])) as Record<ProducerId, string>

/** Plan item 75: the desktop Setup's half-length Cath, her line and face following the picks (`setupCath`). */
function SetupCath({ producers, difficulty, event }: { producers: readonly ProducerId[]; difficulty: GameConfig['difficulty']; event: string }) {
  const cath = setupCath(producers, difficulty, PRODUCER_NAMES)
  return (
    <div className="setup-cath-stand">
      {/* Plan item 367: her bubble carries the week's event, then her advice on the pick. Plan item 390: as one thing
          she says (two quoted lines in one bubble read as two speakers). */}
      <p className="setup-cath-says">
        “<span className="says-event">{event}</span> <span className="says-pick" aria-live="polite">{cath.line}</span>”
      </p>
      <CathArt framing="half" expression={cath.expression} pose={SCREEN_POSE['cathnivore:setup']} animate />
    </div>
  )
}
