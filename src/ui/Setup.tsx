import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_PRODUCER_IDS, PRODUCERS, RECOMMENDED_PAIR } from '../content/producers'
import { LAYOUTS, type LayoutId } from '../content/layouts'
import BoardMiniature from './BoardMiniature'
import RegionMap from './Map'
import { openingState, setupConfig, type SetupPicks } from './openingPreview'
import AbilityPreview, { ABILITY_PREVIEW_MS } from './AbilityPreview'
import type { GameConfig, ProducerId, RegionId } from '../engine/types'
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
  // Plan item 461: on a phone and a tablet the setup is three swiped steps (who, where, how hard) under a dot rail; the
  // track's scroll position is the step, so a swipe, a rail tap or a keyboard focus landing in a panel all agree.
  const [step, setStep] = useState(0)
  // Plan item 572: on a phone a picked producer's rule is read on a tap of their power's stamp, in Cath's bubble.
  const [rule, setRule] = useState<ProducerId | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  function onTrackScroll(): void {
    const t = trackRef.current
    if (!t || !t.clientWidth) return
    setStep(Math.max(0, Math.min(STEP_WORDS.length - 1, Math.round(t.scrollLeft / t.clientWidth))))
  }
  function goStep(i: number): void {
    const t = trackRef.current
    if (!t) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-animations')
    t.scrollTo({ left: i * t.clientWidth, behavior: calm ? 'auto' : 'smooth' })
    setStep(i)
  }
  const [advanced, setAdvanced] = useState(false)
  const [layout, setLayout] = useState<LayoutId>('ring')
  const [marketEvent] = useState(() => marketEventFor(new Date()))
  // Plan item 195: Start rolls the stall's shutter up (520 ms; a 180 ms fade under reduced motion) before the game opens.
  const [opening, setOpening] = useState(false)
  const openTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(openTimer.current), [])

  // Plan item 490: a producer's power plays on a tile in place of their portrait when the card is hovered, focused or
  // picked (the recommended pair plays both); one stage at a time per producer, replayed by `n`.
  const [preview, setPreview] = useState<{ ids: ProducerId[]; n: number } | null>(null)
  const previewTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(previewTimer.current), [])
  function playPower(ids: ProducerId[]): void {
    setPreview((was) => (was && ids.every((id) => was.ids.includes(id)) ? was : { ids, n: (was?.n ?? 0) + 1 }))
    window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => setPreview(null), ABILITY_PREVIEW_MS)
  }

  function toggleProducer(id: ProducerId): void {
    if (!producers.includes(id)) playPower([id])
    setRule(null)
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

  // Plan item 502: the seed is rolled when the Setup opens (a typed one replaces it), so the opening table drawn
  // under the map pick is the one Start deals. A non-numeric seed (e.g. a pasted non-digit string) must not
  // silently coerce to a real seed (0) indistinguishable from actually typing "0": it falls back to the rolled one.
  const [rolledSeed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const parsedSeed = seedInput.trim() ? Number.parseInt(seedInput, 10) : NaN
  const seed = Number.isFinite(parsedSeed) ? parsedSeed : rolledSeed
  const picks: SetupPicks = { producers, difficulty, layout, marketEvent: marketEvent.id }

  function start(): void {
    onStart(setupConfig(picks, seed), seed, mode)
  }

  const rail = useMedia('(min-width: 1100px)')
  // Plan item 513, slice 4: an upright phone hangs the week's event on the opening board as the game's own pennant
  // (Game's .event-ticket), so its 62 px flyer card's height goes to the board.
  const pennant = useMedia('(max-width: 599px) and (orientation: portrait)')
  const modeSection = (
    <section className="settings-card setup-mode">
      <h2>Mode</h2>
      {/* Plan item 204: at D each mode is a tent place card standing on a ledge, the picked one upright, the other
          laid flat; the phone keeps its chairs. */}
      <div className="segmented mode-picker">
        <label data-place-card="solo" data-setup-choice="mode">
          {/* Plan item 533: at D each mode is a place setting laid at the stall, the picked one set with cups. */}
          <PlaceSetting seats={1} />
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
        <label data-place-card="hotseat" data-setup-choice="mode">
          <PlaceSetting seats={2} />
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
          <label key={d} className="price-tag" data-tag={d} data-setup-choice="difficulty">
            {/* Plan item 533: at D each level is a Hollowell memo slip stamped with its word; the picked one is pinned. */}
            <MemoSlip level={d} />
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
          <button type="button" className="setup-recommend" onClick={() => { setProducers([...RECOMMENDED_PAIR]); playPower([...RECOMMENDED_PAIR]) }}>
            Use recommended pair
          </button>
        </div>
        <div className="producer-grid">
          {ALL_PRODUCER_IDS.map((id) => (
            <label key={id} className="producer-card" data-setup-choice="producer" data-producer={id} data-seat={producers.includes(id) ? id : undefined} onMouseEnter={rail ? () => playPower([id]) : undefined} onFocus={rail ? () => playPower([id]) : undefined}>
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
                {/* Plan item 507: at D the power plays on the opening board instead, over their home region; a home off this map plays here. */}
                {rail && preview?.ids.includes(id) && !layoutHas(layout, PRODUCERS[id].home) && <AbilityPreview key={preview.n} producer={id} n={preview.n} />}
              </span>
              <span className="pc-name">{PRODUCERS[id].name}</span>
              {/* Plan item 80: on a phone the four are small toggles by first name; the picked pair are drawn big below. */}
              <span className="pc-short" aria-hidden="true">{shortName(PRODUCERS[id].name)}</span>
              <span className="pc-role">{PRODUCERS[id].roleName}</span>
              {/* Plan item 328: at D the power is an ink stamp with its own picture (the hand's role card art). */}
              {/* Plan item 593: a two-word power ('Second Opinion') set a size down so it keeps one line like the others. */}
              <span className="pc-stamp" aria-hidden="true" data-long={powerName(PRODUCERS[id].roleName).length > 12 || undefined}>
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
        <PairPanel producers={producers} preview={rail ? null : preview} rule={rule} onRule={(id) => setRule((r) => (r === id ? null : id))} />
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
        {/* Plan item 461: on a phone the chosen map is one large board between two arrows; the names below pick it too. */}
        {/* Plan item 502: the opening table you'll play, drawn from the picks; on a phone it is the map stage's board. */}
        {/* Plan item 513: on a phone the board stands above the steps (the stage under the dot rail), so step 2 keeps
            only its arrows and names. */}
        {rail ? <OpeningPreview picks={picks} seed={seed} showcase={preview} /> : <MapStage layout={layout} onPick={setLayout} />}
        <div className="layout-picker" role="radiogroup" aria-label="Map">
          {(Object.keys(LAYOUTS) as LayoutId[]).map((id) => (
            <label key={id} className="layout-tile" data-layout={id} data-setup-choice="map">
              <input type="radio" name="layout" checked={layout === id} onChange={() => setLayout(id)} />
              <BoardMiniature id={id} />
              <span className="layout-name">{LAYOUTS[id].name}</span>
              <span className="layout-blurb">{LAYOUTS[id].blurb}</span>
            </label>
          ))}
        </div>
        <label className="setup-seed-field" id="setup-seed-field">
          <span>
            Seed<span className="seed-optional"> (optional)</span>
          </span>
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
        <span className="market-event-rule" data-stamp>{capitalise(marketEvent.cheap.join(' and '))} Improvements cost 1 Mark less this week.</span>{' '}
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
            <StepHead n={3} words="Hollowell's push" />
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

  const stepLine = step === 1 ? MAP_LINE[layout] : step === 2 ? DIFFICULTY_LINE[difficulty] : null
  return (
    <main className="setup" data-phone-steps data-step={step + 1}>
      <header className="setup-header">
        <div className="setup-header-text">
          <h1>Quick Game</h1>
          <p className="setup-cath-line" aria-live="polite">
            {stepLine ? (
              <span className="cath-line-step">“{stepLine}”</span>
            ) : rule && producers.includes(rule) ? (
              <span className="cath-line-step cath-line-rule" data-rule={rule}>
                “{shortName(PRODUCERS[rule].name)}'s {powerName(PRODUCERS[rule].roleName)}: {PRODUCERS[rule].roleAbility}”
              </span>
            ) : (
              <>
                <span className="cath-line-ask">“Pick two producers who'll cover each other, love.”</span>
                {/* Plan item 80: on a phone, once a pair is picked, Cath's line on them is said up here, beside her. */}
                {producers.length === 2 && (
                  <span className="cath-line-pair" aria-hidden="true">
                    “{pairLine(producers[0]!, producers[1]!)}”
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        {/* ROADMAP "Cath on the title, Campaign, setup and end screens": her default warm smirk, since
            no game state exists yet to react to here. */}
        <CathArt className="setup-header-cath" framing="bust" pose={SCREEN_POSE['cathnivore:setup']} expression="smirk" animate width={80} height={80} title="Cath" />
        {/* Plan item 349: an upright phone's header is Cath's stall: her at half length (160 px+) behind its counter,
            her bubble beside her (global.css shows this one and hides the bust there). */}
        <div className="setup-header-stand" aria-hidden="true">
          <CathArt framing="half" pose={SCREEN_POSE['cathnivore:setup']} expression={step === 2 && difficulty === 'hard' ? 'worried' : 'smirk'} animate />
        </div>
      </header>

      {!pennant && eventFlyer}

      <nav className="setup-dots" aria-label="Setup steps">
        {STEP_WORDS.map((w, i) => (
          <button key={w} type="button" className="setup-dot" aria-current={step === i ? 'step' : undefined} onClick={() => goStep(i)}>
            <span className="setup-dot-n" aria-hidden="true">{i + 1}</span>
            <span className="setup-dot-word">{w}</span>
          </button>
        ))}
      </nav>

      {/* Plan item 513: the opening table you'll play, the screen's largest thing on every step: a producer's power
          plays on it over their home region, and a map or difficulty pick redraws it in place. */}
      <div className="setup-board-stage" data-board-stage>
        {pennant && (
          <p className="setup-event-pennant" data-event={marketEvent.id}>
            <span className="sr-only">Market event: </span>
            <b>{marketEvent.name}</b>
            <span className="setup-event-rule">
              {marketEvent.cheap.map(capitalise).join(' & ')} kit 1 Mark off<span className="sr-only"> this week</span>
            </span>
          </p>
        )}
        <OpeningPreview picks={picks} seed={seed} showcase={preview} />
      </div>

      {/* Plan item 195: the producers, the maps and Hollowell's price tags laid on one gingham table, Cath at its head. */}
      <div className="setup-table setup-track" data-setup-table ref={trackRef} onScroll={onTrackScroll}>
        <section className="setup-panel" data-panel="1" aria-label={`Step 1 of 3: ${STEP_WORDS[0]}`}>
          {modeSection}
          {producersSection}
          <NextStep words={STEP_WORDS[1]} onClick={() => goStep(1)} />
        </section>
        <section className="setup-panel" data-panel="2" aria-label={`Step 2 of 3: ${STEP_WORDS[1]}`}>
          {mapSection}
          <NextStep words={STEP_WORDS[2]} onClick={() => goStep(2)} />
        </section>
        <section className="setup-panel" data-panel="3" aria-label={`Step 3 of 3: ${STEP_WORDS[2]}`}>
          {difficultySection}
          <PinTin week={marketEvent.id} />
        </section>
      </div>

      {startButton}
    </main>
  )
}

/** Plan item 507: whether a region is on a map (a producer's power plays over their home on the opening board). */
function layoutHas(layout: LayoutId, region: RegionId): boolean {
  return region in LAYOUTS[layout].hexes
}

/** The event's rule starts its sentence (a phone runs it inline after the name, where ::first-letter can't reach). */
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const STEP_WORDS = ["Who's at the stall", 'Where you trade', 'How hard'] as const

/** Plan item 461: a step's foot on a phone: on to the next one (a swipe does the same). */
function NextStep({ words, onClick }: { words: string; onClick(): void }) {
  return (
    <button type="button" className="setup-next" onClick={onClick}>
      Next: {words} <span aria-hidden="true">›</span>
    </button>
  )
}

/** Plan item 461: Cath's line on each map, said while step 2 is showing on a phone. */
const MAP_LINE: Record<LayoutId, string> = {
  ring: 'The Ring: six regions round the capital. A good first market.',
  coast: 'The Long Coast: ten regions on a long shore. Hollowell spreads thin.',
  delta: 'The Delta: the river splits it, love. Mind the two bridges.',
}

/**
 * Plan item 502: the opening table for the picks: the game's own board (Map.tsx, read-only, as on the title) dealt
 * by `createGame` for this seed. A pick remounts it, so Hollowell's pieces and the stalls settle in (CSS, 200 ms).
 */
function OpeningPreview({ picks, seed, showcase }: { picks: SetupPicks; seed: number; showcase?: { ids: ProducerId[]; n: number } | null }) {
  const { producers, difficulty, layout, marketEvent } = picks
  const key = `${layout}|${difficulty}|${producers.join(',')}|${seed}|${marketEvent}`
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` names every pick the state is built from
  const state = useMemo(() => openingState(picks, seed), [key])
  return (
    <div
      className="opening-preview"
      aria-hidden="true"
      data-opening-preview={key}
      data-layout={layout}
      data-difficulty={difficulty}
      data-outlets={Object.values(state.regions).reduce((a, r) => a + (state.config.activeRegions.includes(r.id) ? r.outlets : 0), 0)}
    >
      <RegionMap
        key={key}
        state={state}
        showcase={showcase?.ids.filter((id) => state.config.activeRegions.includes(PRODUCERS[id].home)).map((id) => ({ producer: id, region: PRODUCERS[id].home, key: showcase.n }))}
      />
      <span className="opening-preview-caption">{LAYOUTS[layout].name}: {LAYOUTS[layout].blurb}</span>
    </div>
  )
}

/** Plan item 461: the phone's map step, the chosen board large between two arrows. */
function MapStage({ layout, onPick }: { layout: LayoutId; onPick(id: LayoutId): void }) {
  const ids = Object.keys(LAYOUTS) as LayoutId[]
  const at = ids.indexOf(layout)
  const step = (d: number) => onPick(ids[(at + d + ids.length) % ids.length]!)
  return (
    <div className="map-stage">
      <button type="button" className="map-arrow" aria-label="Previous map" onClick={() => step(-1)}>
        <span aria-hidden="true">‹</span>
      </button>
      <div className="map-stage-board" aria-hidden="true">
        <span className="map-stage-name">{LAYOUTS[layout].name}</span>
        <span className="map-stage-blurb">{LAYOUTS[layout].blurb}</span>
      </div>
      <button type="button" className="map-arrow" aria-label="Next map" onClick={() => step(1)}>
        <span aria-hidden="true">›</span>
      </button>
    </div>
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
              <span className="pin-when">{has ? 'Earned' : ev === week ? 'This week' : MARKET_EVENTS[ev].name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Plan item 533: a mode at D as a place setting on the stall: a plate, fork and knife per seat, and a cup each,
 * which only shows (CSS) on the picked one. */
function PlaceSetting({ seats }: { seats: 1 | 2 }) {
  const xs = seats === 1 ? [30] : [17, 45]
  const r = seats === 1 ? 11 : 9
  return (
    <svg className="place-setting" viewBox="0 0 60 34" aria-hidden="true" focusable="false">
      <path className="ps-cloth" d="M3 27h54" />
      {xs.map((x) => (
        <g key={x}>
          <path className="ps-cutlery" d={`M${x - r - 4} ${17 - r + 2}v${2 * r - 2}M${x - r - 5.5} ${17 - r + 2}v4M${x - r - 2.5} ${17 - r + 2}v4M${x + r + 4} ${17 - r + 2}v${2 * r - 2}`} />
          <ellipse className="ps-plate" cx={x} cy={17} rx={r} ry={r * 0.62} />
          <ellipse className="ps-well" cx={x} cy={17} rx={r * 0.58} ry={r * 0.36} />
          <g className="ps-cup">
            <path d={`M${x + r - 1} ${7}h7l-1 6h-5Z`} />
            <path className="ps-handle" d={`M${x + r + 6} ${8.5}a2 2 0 0 1 0 3.2`} />
            <path className="ps-steam" d={`M${x + r + 2} ${5}q1-1.5 0-3M${x + r + 4.5} ${5}q1-1.5 0-3`} />
          </g>
        </g>
      ))}
    </svg>
  )
}

/** Plan item 533: a difficulty at D as one of Hollowell's memo slips, the level stamped across it in red. */
function MemoSlip({ level }: { level: GameConfig['difficulty'] }) {
  return (
    <span className="memo-slip" aria-hidden="true">
      <span className="memo-slip-head">Memo</span>
      <span className="memo-slip-lines" />
      <span className="memo-slip-stamp">{level}</span>
    </span>
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
function PairPanel({ producers, preview, rule, onRule }: { producers: ProducerId[]; preview: { ids: ProducerId[]; n: number } | null; rule?: ProducerId | null; onRule?(id: ProducerId): void }) {
  const [a, b] = producers
  return (
    <div className="pair-panel" aria-live="polite">
      <div className="pair-abilities">
        {[a, b].map((id, i) =>
          id ? (
            <p key={id} className="pair-ability" data-producer={id}>
              <span className="pair-portrait" aria-hidden="true">
                <Portrait character={id} size={100} />
                {preview?.ids.includes(id) && <AbilityPreview key={preview.n} producer={id} n={preview.n} />}
                <span className="pair-plate">{PRODUCERS[id].name}</span>
              </span>
              <b>{PRODUCERS[id].roleName.split(', ')[1] ?? PRODUCERS[id].roleName}</b> <span className="pair-rule">{PRODUCERS[id].roleAbility}</span>
              {/* Plan item 572: on an upright phone the power is a stamp; a tap has Cath read its rule in her bubble. */}
              <button type="button" className="pair-power" aria-expanded={rule === id} aria-label={`${powerName(PRODUCERS[id].roleName)}: read the rule`} onClick={() => onRule?.(id)}>
                <RoleProducerContext.Provider value={id}>
                  <RoleArt size={20} />
                </RoleProducerContext.Provider>
                <span className="pair-power-name">{shortName(PRODUCERS[id].name)}'s {powerName(PRODUCERS[id].roleName)}</span>
                <span className="pair-power-ask" aria-hidden="true">?</span>
              </button>
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
    ['Lost Land', `${s.lostLandPool} to lose`, s.lostLandPool !== n.lostLandPool],
    [
      'Kingsmarket',
      `${s.kingsmarketOutlets}\u00a0Outlet${s.kingsmarketOutlets === 1 ? '' : 's'}${s.kingsmarketBuyouts ? `, ${s.kingsmarketBuyouts}\u00a0Buyout` : ', no\u00a0Buyout'}`,
      s.kingsmarketOutlets !== n.kingsmarketOutlets || s.kingsmarketBuyouts !== n.kingsmarketBuyouts,
    ],
  ]
  if (s.extraHomeStalls) rows.push(['Home', `+${s.extraHomeStalls} Stall to start`, true])
  if (difficulty === 'hard') rows.push(['Pastures', '1 Doubt each', true])
  return (
    <div className="difficulty-sheet" aria-live="polite" data-level={difficulty}>
      {/* Plan item 533: at D the sheet is the picked memo, pinned: Hollowell's letterhead and the level's stamp. */}
      <p className="memo-head" aria-hidden="true">
        <span>Hollowell memo</span> <span className="memo-stamp">{difficulty}</span>
      </p>
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
