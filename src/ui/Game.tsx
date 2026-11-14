import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { useMedia } from './useMedia'
import { BoardObject } from './BoardObjects'
import { MARKET_EVENTS } from '../engine/marketEvent'
import { rivalMood } from './portraits/rivalFace'
import { lightFor } from './tableLight'
import { BeasDrawing, ProduceCrates } from './TableProps'
import { awardPin, chosenPin, pinForEvent, PINS, type CathPin } from '../../shared/cath/pins'
import { applyAction, currentDecision, legalActions } from '../engine/api'
import { resolveRules } from '../engine/rules'
import { LONG_MAX, planPreview } from '../engine/preview'
import { createRng } from '../engine/rng'
import { ACTIONS_PER_ROUND, canOpenStallIn, regionStallTotal } from '../engine/region'
import { PRODUCERS } from '../content/producers'
import { REGIONS } from '../content/map'
import { CHAPTER_HOMES } from '../content/campaignMap'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { HeuristicBot } from '../ai/heuristic'
import { reasonForAction } from '../ai/reason'
import type { AIWorkerRequest, AIWorkerResponse } from '../ai/aiWorker'
import { saveGame, clearGame, type SavedGame } from '../platform/storage'
import { goalCard, investGoal, schemeGoal } from './shelfGoal'
import { playHapticsFor } from '../platform/haptics'
import { playCues, playSoundsFor, setScoreMode, setScoreRound, soundRound } from '../platform/sound'
import { eventCue } from '../platform/sound/cues'
import { loadSettings, AI_SPEED_DELAY_MS, TEAMMATE_PICK_MS } from '../platform/settings'
import { flyCardToHex, pickExpression, pickRegion } from './teammatePick'
import BuyFlight from './BuyFlight'
import { liftEnabled, liftPlayedCard, liftTarget } from './playLift'
import { buyFlightPath, type BuyFlightPath } from './buyFlightGeometry'
import type { ImprovementCard } from '../content/improvements'
import { PlanArt } from './icons/HollowellArt'
import { splitTarget } from './planTarget'
import { usePlanArming } from './usePlanArming'
import { ArtSceneContext, RoleProducerContext } from './icons/artScene'
import { GraftArt, InvestArt, OpenStallArt, RebutArt, RoleArt, SchemeArt, SellArt, SupplyArt } from './icons/ActionArt'
import { actionCardLabel, actionCost, actionLabel, actionFamily, actionGroupKey, actionGroupLabel, actionTermFor, actionTermForKind, familyOptionLabel, regionOf } from './actionLabel'
import { investCost, schemeCost, supplyOutletCostPerOutlet, supplyBuyoutCost, rebutCost } from '../engine/actions'
import { IMPROVEMENTS, IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import { canUndo, popUndo, pushUndo, type UndoEntry } from './undo'
import { enemyTurnEvents, pendingMidSceneTrigger } from './enemyTurnLog'
import EnemyTurnPlayback from './EnemyTurnPlayback'
import { EXECS, MOOD_EXPRESSION, execFor, flightsFor, stagedRegions, stripDock, type ExecMood } from './boardroom'
import Figure from './portraits/Figure'
import LogSheet from './LogSheet'
import RoundLedger from './RoundLedger'
import FarmSheet, { Stall } from './FarmSheet'
import { vignetteFor } from './vignetteKind'
import Vignette from './Vignette'
import MarketSheet from './MarketSheet'
import CathsPlanSheet from './CathsPlanSheet'
import RegionMap, { Outlet, Buyout, Doubt, CoopMarkerIcon } from './Map'
import RegionCloseUp from './RegionCloseUp'
import RulesReference from './RulesReference'
import Scene from './Scene'
import Portrait from './portraits/Portrait'
import type { ProducerFace } from './portraits/producerFaces'
import { producerMoods } from './producerMood'
import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import CathCompanion, { CathDock } from './CathCompanion'
import Tooltip from './Tooltip'
import { CATH_REACTION_EXPRESSION, CATH_REACTION_POSE, cathLine, cathLineForRegion, type CathReaction } from '../content/cathCompanionLines'
import type { CathExpression, CathPoseId } from '../../shared/cath/cath'
import { WIN_LINE, LOSS_LINE, LOSS_REASON_LABEL } from '../content/endLines'
import {
  GoodwillIcon,
  MarksIcon,
  ProduceIcon,
} from './icons/ResourceIcons'
import { OpenStallIcon } from './icons/ActionIcons'
import { MatCoins, MatCrate, MatRosette } from './PlayerMat'
import { RegionTypeIcon } from './icons/RegionTypeIcon'
import { dailyMarket, dailyRecord, dailyShareText, dailyStreak, recordDaily } from '../content/daily'
import { LAYOUTS } from '../content/layouts'
import { FarmIcon, LogIcon, MarketIcon, MenuIcon, PlanIcon, UndoIcon } from './icons/RailIcons'
import { romanStage } from './romanStage'
import { HollowellLogo } from './icons/EnemyLogos'
import type { Action, GameEvent, GameState, ProducerId, RegionId, RegionType, ResourceKind } from '../engine/types'
import type { Mode } from './Setup'
import { useScrollCues } from './useScrollCues'
import { endSummary } from './endSummary'
import EndChart from './EndChart'
import type { TutorialStep } from '../content/chapters'
import { matchesExpect, resumeIndex, stepMode, tutorialTargetId, upcomingExpect } from '../content/tutorial'
import TutorialCoach from './TutorialCoach'
import type { Scene as SceneData } from '../content/story/types'
import { plural } from '../content/plural'

interface Props {
  initial: GameState
  seed: number
  mode: Mode
  onExit(): void
  // Plan item 8: a Quick Game's end screen offers the same seed again and a fresh Setup (App.tsx).
  onPlayAgain?(): void
  onNewGame?(): void
  // SPEC 8.1: a campaign chapter's end screen continues into its closing scene (via App.tsx) instead of
  // going straight back to the title, so it takes this callback instead of the plain onExit button. The
  // final `state` is passed too so App.tsx can read carry-over data (e.g. chapter 3's surviving Wholesome
  // Hollow Contracts, SPEC 7) out of it when a chapter ends.
  onChapterEnd?(won: boolean, state: GameState): void
  // SPEC 8.1 tutorial prompts (2 sentences max), shown one at a time above the plan strip. Simplified
  // from the full spec for now: the player advances them manually rather than the engine gating legal
  // actions down to "only the action being taught" — see DECISIONS.md.
  tutorialSteps?: TutorialStep[]
  // The first-time guided tutorial (chapter 1): `tutorialSteps` play as a spotlight with a hard gate
  // (TutorialCoach) instead of the prompt strip. `onTutorialDone` fires once when it's finished or skipped.
  guided?: boolean
  onTutorialDone?(): void
  // SPEC 8.1 "triggers ... scenes": a chapter's mid-game scripted scenes, keyed by `scriptedTrigger.sceneId`
  // (e.g. chapter 3's round-5 Wholesome Hollow reveal). Absent for non-campaign games and chapters with no
  // scripted trigger — see `state.log`'s `{type: 'trigger'}` events, appended by `round.ts`.
  midGameScenes?: Record<string, SceneData>
  // SPEC 8.1/11.3: which campaign chapter this game belongs to, so the autosave records it (see the effect
  // below) — a reload mid-chapter needs this to resume back into the `chapterGame` screen rather than a
  // plain Quick Game that can never call `onChapterEnd`. Absent for Quick Game/hot-seat games.
  chapterId?: string
  // SPEC 8.1/11.3: mid-game scene ids already dismissed in a prior session of this same save (from
  // `SavedGame.dismissedMidScenes`, App.tsx's `resume()`) — seeds `dismissedMidScenes` state so a scene
  // dismissed just before a reload (before any further action) doesn't replay once more on resume (see
  // DECISIONS.md). Absent for a fresh game or an older save.
  initialDismissedMidScenes?: string[]
  // Plan item 183: each producer's 'Saving for' goal from the save (App.tsx's `resume()`).
  initialSavingFor?: SavedGame['savingFor']
}

// SPEC 10.2 Game screen. Plain controls for now — see PROGRESS.md M3 for what's still missing (the SVG
// map, sheets, targeting-mode highlighting, enemy-turn step playback). `legalActions` already expands
// every choice into its own concrete Action, so a flat button list is enough to play a full game.
// SPEC 11.4 gate 5's "test driving ... using HeuristicBot choices" and the chapters 2-6 "test-only
// auto-play hook driven by MCTSBot" both need some way for a Playwright test to finish a game without
// hand-writing every click. `?e2eAutoplay=1` makes every producer (not just the Solo AI teammate) act via
// HeuristicBot and skips enemy-turn playback instantly, so a test only has to load the URL and poll for
// `state.result`. Never set by the app itself outside a test — see e2e/quick-game.spec.ts.
function isE2EAutoplay(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eAutoplay') === '1'
}
// Test-only, with `?e2eAutoplay=1`: `&e2eAutoplayUntil=N` stops the autoplay once round N begins, so a test
// can look at the table at a given round (plan item 28's light through the day).
const E2E_AUTOPLAY_UNTIL = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('e2eAutoplayUntil') ?? 0) : 0

// Test-only: forces the AI teammate's Worker to throw on its very first decision, so
// e2e/ai-teammate-crash.spec.ts can verify the fallback-to-HeuristicBot path (DECISIONS.md) without
// depending on a real MCTS bug. Never set by the app itself outside a test.
function isE2EAiWorkerCrash(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eAiWorkerCrash') === '1'
}

// Plan item 34: under webdriver the AI teammate's picks show only briefly, unless `?e2eTeammateShow=1`.
function isE2EWebdriver(): boolean {
  return typeof navigator !== 'undefined' && navigator.webdriver === true
}
const HAND_PEEK = 24
// Plan item 384: a short hand (one Sell card, not three) left slack in the fan, so the first card off the front
// showed half its face. Each strip widens to share the row's room, never under 24 px.
function handPeek(row: HTMLElement): number {
  return parseFloat(row.dataset.peekPx ?? '') || HAND_PEEK
}
// The held fan's stacking: the front card (the first not pinned to the left stack) on top, the left stack rising
// toward it and the right stack falling away from it, so each card off the front shows the strip on its far side.
function stackHand(row: HTMLElement) {
  const cards = [...row.querySelectorAll<HTMLElement>(':scope > .action-item[data-peek]')]
  if (cards.length === 0) return
  const edge = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft || '0')
  const peek = handPeek(row)
  let front = cards.findIndex((c, i) => c.getBoundingClientRect().left > edge + i * peek + 1.5)
  if (front < 0) front = cards.length - 1
  cards.forEach((c, i) => {
    c.style.setProperty('--peek-z', String(cards.length - Math.abs(i - front)))
    const side = i < front ? 'l' : i > front ? 'r' : 'f'
    if (c.dataset.stack !== side) c.dataset.stack = side
  })
}
// Scrolls the phone's held fan so `card` (the i-th sticky card) stands whole between the two stacks. Its
// unstuck spot is read with the stickiness off for one layout.
function bringToFront(row: HTMLElement, card: HTMLElement, i: number) {
  card.dataset.measure = ''
  const natural = card.offsetLeft
  delete card.dataset.measure
  const lo = i * handPeek(row)
  const hi = row.clientWidth - (parseFloat(card.style.getPropertyValue('--stick-r')) || 0) - card.offsetWidth
  const want = natural - (lo + Math.max(0, hi - lo) / 2)
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('no-animations')
  row.scrollTo({ left: Math.max(0, want), behavior: smooth ? 'smooth' : 'auto' })
  card.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true })
}

// Plan item 302: the phone's held fan covers every card's middle but the front one's, where Playwright aims its
// clicks, so under webdriver the hand stays a plain swiped row unless `?e2eHandFan=1` (e2e/phone-hand-held.spec).
function isE2EHandFanOff(): boolean {
  return isE2EWebdriver() && new URLSearchParams(window.location.search).get('e2eHandFan') !== '1'
}
function isE2ETeammateShow(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eTeammateShow') === '1'
}

// ROADMAP 8 "the table, part 1: layout": the action list (see `actionsPanel` below) shows in a different
// place on phone vs desktop, and mounting it unconditionally in both spots (CSS picking which one is
// visible, the way the Farm/Market/Plan/Log `inline` panels split their mobile-modal/desktop-tray copies)
// broke every Playwright locator that queries `.action-item`/`.tooltip-trigger-button` — strict mode counts
// DOM matches regardless of `display: none`, so `e2e/tooltip.spec.ts` started resolving 2 elements for the
// same button. Gating which one actually *mounts* on viewport width avoids that: there is only ever one
// `.actions` in the DOM. Reacts to live resizes (not just the width at first render) since Playwright's
// `setViewportSize` can change the viewport after the page has already mounted.
function useIsDesktopLayout(): boolean {
  return useMedia('(min-width: 1024px)')
}
// Plan item 118: the desktop sizes where Cath stands at the table (styles: .table-cath).
const TABLE_CATH_QUERY = '(min-width: 1240px) and (min-height: 760px)'
// Plan item 131: on an upright phone she stands at the table too, at its lower-left corner, and the header strip goes.
// Plan item 225: her bubble carries the suggestion too only where the table is tall enough for both lines (at
// 1280x800 the two-part bubble rose over the plan strip); shorter desktops keep the suggestion in the rail.
const TABLE_CATH_TALL_QUERY = '(min-width: 1240px) and (min-height: 880px)'
const PHONE_TABLE_CATH_QUERY = '(max-width: 599.98px) and (min-height: 640px) and (orientation: portrait)'


// Plan item 92: Graham Pell, Hollowell's face (the boardroom's, plan item 11), in a glossy boardroom medallion with
// the company's plastic nameplate, at the end of the papers' row on a desktop. A phone meets him in the boardroom
// strip when Hollowell plays its turn.
function Rival({ mood }: { mood: ExecMood }) {
  const who = `${EXECS.pell.name}, ${EXECS.pell.title}`
  return (
    <aside className="rival" data-rival data-mood={mood} aria-label={`${who}, ${mood}`}>
      <span className="rival-frame">
        <Figure character="pell" expression={MOOD_EXPRESSION[mood]} title={EXECS.pell.name} />
      </span>
      <span className="rival-plate" aria-hidden="true">
        <HollowellLogo size={11} />
        Hollowell
      </span>
    </aside>
  )
}

// Plan item 144: a market event's rule in words: the two Improvement tags it makes 1 Mark cheaper.
// Plan item 141: the leaf on the card Cath would play.
const SUGGEST_LEAF = (
  <span className="suggest-leaf" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
      <path d="M3 13C3 7 7 3 13 3c0 6-4 10-10 10Z" />
      <path className="suggest-leaf-vein" d="M3.5 12.5 10 6" />
    </svg>
  </span>
)

const EVENT_SHORT: Record<string, string> = { festival: 'Festival', drought: 'Dry Spell', glut: 'Glut' }
const EVENT_TAG: Record<string, string> = { pasture: 'Pasture', crop: 'Crop', coast: 'Coast', community: 'Community', media: 'Media', science: 'Science' }
function eventRule(id: keyof typeof MARKET_EVENTS, short = false): string {
  const tags = MARKET_EVENTS[id].cheap.map((t) => EVENT_TAG[t] ?? t).join(' & ')
  return short ? `${tags} \u22121` : `${tags} kit 1 Mark off`
}

// Plan item 80: a producer's face as the expression name Portrait takes.
// Plan item 374: at a desktop table the producers stand half length behind the board's far rim, at 80% of Cath's
// drawn height (the same `half` framing as hers, so one scale of people): the first in front with their foot on the
// rim, the second behind their shoulder, lifted only as far as the free space needs. Collisions are tested on the
// drawn parts (head and hair, shoulders and arms), not the figure's transparent box, so they can stand in the
// corner beside the hexes; an outer arm may pass behind the frame's edge, as at a table's corner. Each tries 84% of Cath's height down to 60%; with no room, both stay unseated and the
// rail keeps the active producer's portrait.
type Box = { left: number; top: number; right: number; bottom: number }
const FIG_ASPECT = 320 / 480
type Parts = { head: Box; body: Box }
/** Where a Figure's head (with hair) and body (with arms and prop) sit in its box, as fractions, measured once. */
function figFractions(p: HTMLElement): Parts {
  const svg = p.querySelector('svg')!.getBoundingClientRect()
  const frac = (els: Element[], fallback: Box): Box => {
    const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    if (rs.length === 0 || svg.width === 0) return fallback
    return {
      left: (Math.min(...rs.map((r) => r.left)) - svg.left) / svg.width,
      top: (Math.min(...rs.map((r) => r.top)) - svg.top) / svg.height,
      right: (Math.max(...rs.map((r) => r.right)) - svg.left) / svg.width,
      bottom: (Math.max(...rs.map((r) => r.bottom)) - svg.top) / svg.height,
    }
  }
  const head = frac([...p.querySelectorAll('.fig-head, .fig-hair-back')], { left: 0.26, top: 0.12, right: 0.74, bottom: 0.58 })
  // The torso and arms; a held prop (Mara's staff, Tomas's carrots) may cross an edge, as a hand would.
  const body = frac([...p.querySelectorAll('.fig-body > path')], { left: 0.1, top: 0.54, right: 0.9, bottom: 1 })
  return { head: { ...head, bottom: Math.min(head.bottom, body.top) }, body }
}
const PLATE: Box = { left: 0.3, top: 0.6, right: 0.7, bottom: 0.74 }
function figPart(x: number, y: number, h: number, f: Box): Box {
  const fw = h * FIG_ASPECT
  return { left: x + f.left * fw, top: y + f.top * h, right: x + f.right * fw, bottom: y + f.bottom * h }
}
const meets = (a: Box, b: Box, gap = 3) => a.left < b.right + gap && b.left - gap < a.right && a.top < b.bottom + gap && b.top - gap < a.bottom
function standProducers(wrap: HTMLElement, people: HTMLElement[], obstacles: Box[], cathH: number): void {
  const w = wrap.getBoundingClientRect()
  const PAD = 4
  const STEP = 3
  // 7 px clear: the active one leans in (1 degree about the foot, ~5 px at the head).
  const clear = (b: Box) => !obstacles.some((o) => meets(b, o, 7))
  // The hair's back may run above the box (a bun): the head part's top is clamped to the frame below.
  for (const p of people) p.style.setProperty('--fig-h', '240px')
  const parts = people.map(figFractions)
  const fits = (x: number, y: number, h: number, f: Parts) => {
    const head = figPart(x, y, h, f.head)
    return x >= w.left + PAD && x + h * FIG_ASPECT * 0.76 <= w.right - PAD && head.top >= w.top + PAD && clear(head) && clear(figPart(x, y, h, f.body))
  }
  const unseat = () => people.forEach((p) => (p.dataset.unseated = ''))
  for (const k of [0.84, 0.81, 0.76, 0.7, 0.64, 0.6]) {
    const h = Math.round(cathH * k)
    const fw = h * FIG_ASPECT
    const y = w.bottom - h
    let best: { fx: number; bx: number; by: number; shift: number; score: number } | null = null
    // Where the second one could stand at all, found once per scale (it doesn't depend on the first one's spot).
    const spots: { bx: number; by: number; lift: number }[] = []
    if (people.length > 1)
      for (let lift = 0; lift <= h * 0.6; lift += STEP)
        for (let bx = w.left + PAD; bx + fw * 0.76 <= w.right - PAD; bx += STEP) if (fits(bx, y - lift, h, parts[1]!)) spots.push({ bx, by: y - lift, lift })
    for (let fx = w.right - PAD - fw * 0.76; fx >= w.left + PAD; fx -= STEP) {
      if (!fits(fx, y, h, parts[0]!)) continue
      if (people.length === 1) {
        best = { fx, bx: 0, by: 0, shift: 0, score: 0 }
        break
      }
      const fHead = figPart(fx, y, h, parts[0]!.head)
      const fBody = figPart(fx, y, h, parts[0]!.body)
      for (const { bx, by, lift } of spots) {
        if (Math.abs(bx - fx) < fw * 0.28) continue
        // Least lift, then the pair kept together and toward the far right corner.
        const score = lift * 2 + Math.abs(bx - fx) * 0.5 + (w.right - Math.max(fx, bx) - fw) * 0.3
        if (best && score >= best.score) continue
        if (meets(figPart(bx, by, h, parts[1]!.head), fHead, 6)) continue
        // The back one's name plate sits on their chest, or slides toward their outer shoulder to clear the front one.
        const side = bx > fx ? 1 : -1
        const shift = [0, 0.16 * side].find((sh) => {
          const plate = figPart(bx + sh * fw, by, h, PLATE)
          return !meets(plate, fHead, 2) && !meets(plate, fBody, 2) && plate.right <= w.right - PAD - 8 && plate.left >= w.left + PAD + 8
        })
        if (shift === undefined) continue
        best = { fx, bx, by, shift, score: score + (shift ? 4 : 0) }
      }
    }
    if (!best) continue
    const place = (p: HTMLElement, x: number, top: number, depth: 'front' | 'back', shift = 0) => {
      p.style.setProperty('--plate-shift', `${(shift * fw).toFixed(0)}px`)
      p.style.setProperty('--seat-x', `${(x - w.left).toFixed(0)}px`)
      p.style.setProperty('--seat-y', `${(top - w.top).toFixed(0)}px`)
      p.style.setProperty('--fig-h', `${h}px`)
      p.dataset.depth = depth
      delete p.dataset.unseated
    }
    place(people[0]!, best.fx, y, 'front')
    if (people[1]) {
      place(people[1], best.bx, best.by, 'back', best.shift)
      // Lifted behind the front one, their foot would end in mid-air: it fades into the table instead.
      // Plan item 390: lifted, they stand behind a stack of their crates that reaches down to the rim (a fade left a
      // ghost from the waist down, the name plate on the faded band).
      people[1].style.setProperty('--lift', `${Math.max(0, y - best.by).toFixed(0)}px`)
      if (y - best.by > h * 0.04) people[1].dataset.lifted = ''
      else delete people[1].dataset.lifted
    }
    for (const p of people.slice(2)) p.dataset.unseated = ''
    return
  }
  unseat()
}

const faceExpression = (f?: ProducerFace) => (f === 'delighted' ? 'delighted' : f === 'worried' ? 'worried' : undefined)

// The Cath companion's reaction to one log event (ROADMAP "Cath in Cathnivore, as guide and narrator"),
// ranked so that when a round produces several at once (e.g. a Squeeze and a liberation), the most
// significant wins. `null` for events she has nothing to say about yet.
function cathReactionFor(event: GameEvent): { reaction: CathReaction; rank: number; line: string } | null {
  switch (event.type) {
    case 'liberated':
      return { reaction: 'liberated', rank: 1, line: cathLineForRegion('liberated', event.region) }
    case 'expand':
      // Lowest rank: an Outlet/Buyout/Doubt lands most rounds, so it should never bury a rarer, more
      // significant reaction (a liberation or a Squeeze) that landed in the same round's new events.
      return { reaction: 'expand', rank: 0, line: cathLineForRegion('expand', event.region) }
    case 'squeeze':
      return event.lostLand
        ? { reaction: 'squeezeLostLand', rank: 3, line: cathLineForRegion('squeezeLostLand', event.region) }
        : { reaction: 'squeeze', rank: 2, line: cathLineForRegion('squeeze', event.region) }
    case 'invest':
      return { reaction: 'invest', rank: 0.5, line: cathLine('invest', event.improvementId) }
    case 'action':
      return event.action.kind === 'sell'
        ? { reaction: 'sell', rank: 0.5, line: cathLine('sell', `${event.action.count}${event.producer}${event.action.count}`) }
        : null
    case 'riftSplit':
      return { reaction: 'riftSplit', rank: 4, line: cathLine('riftSplit', event.faction) }
    default:
      return null
  }
}

// A scripted campaign Pressure card (SPEC 8.1) may target regions directly instead of by type.
function pressureLabel(card: GameState['squeeze']): string {
  if (!card) return 'Empty'
  if (card.regionTypes.length > 0) return card.regionTypes.join('+')
  return (card.regions ?? []).map((r) => REGIONS[r].name).join('+') || '—'
}

// STYLE.md 8's Pressure card: "one or two region-type icons." A scripted card (SPEC 8.1) has no
// `regionTypes` of its own, only specific `regions` — derived here via each region's own type, deduped,
// so the icon still shows correctly for both the real Pressure deck and a campaign chapter's scripted
// sequence, the same fallback `pressureLabel` above already uses for its text.
function pressureIconTypes(card: GameState['squeeze']): RegionType[] {
  if (!card) return []
  if (card.regionTypes.length > 0) return card.regionTypes
  const types = (card.regions ?? []).map((r) => REGIONS[r].type)
  return [...new Set(types)]
}

// ROADMAP 10 "illustrated gauges": Public Trust's and Rift's fixed ranges, matching the exact bounds
// `validate()` (engine/api.ts) checks state against — the single source of truth for "full" on each
// gauge, so it can never silently drift from what the rules actually allow.
// Plan item 92: when a flown enemy piece lands on its hex (global.css `.flight-land` starts at 640 ms).
const FLIGHT_LAND_MS = 640
const TRUST_MAX = 15
const RIFT_MAX = 6

// Lost Land has no fixed range — it's a pool that starts at a difficulty (or campaign-chapter override)
// value and only ever shrinks, so "full" for its gauge is this game's own starting pool, computed the
// exact same way `createGame` (engine/api.ts) does rather than a guessed constant.
function lostLandStartingPool(state: GameState): number {
  return state.config.lostLandPoolOverride ?? DIFFICULTY_SETTINGS[state.config.difficulty].lostLandPool
}

// ROADMAP 10 "the HUD ... tick-up and tick-down animation when they change": returns a counter that only
// increments when `value` actually differs from the previous render, computed synchronously during
// render (no effect/timer needed) — starts at 0 and never moves on the very first render of this
// component instance, so a fresh game screen doesn't flash every stat on load, only a real change later
// ticks it. The caller keys its animated element on this counter, so React remounts it (replaying its
// CSS `animation`) exactly once per genuine change, and gates the animation class itself on `tick > 0`
// so that very first key=0 mount never plays it either.
function useHudTick<T>(value: T): number {
  const prev = useRef(value)
  const tick = useRef(0)
  if (prev.current !== value) {
    tick.current += 1
    prev.current = value
  }
  return tick.current
}

// Plan item 36: an income figure ticks up when the same producer's production rises (a buy landing in
// the farmstead), not when the turn passes to someone else.
function useIncomeTick(producer: string, income: number): number {
  const prev = useRef({ producer, income })
  const tick = useRef(0)
  if (prev.current.producer === producer && income > prev.current.income) tick.current += 1
  prev.current = { producer, income }
  return tick.current
}

const COST_ICON: Record<ResourceKind, typeof ProduceIcon> = { produce: ProduceIcon, marks: MarksIcon, goodwill: GoodwillIcon }

// ROADMAP 9 "an icon per action" (STYLE.md 5.1): a leading icon inside each action button, before the
// label. `supplyOutlets`/`supplyBuyout` share one icon (both are "Supply," just a different piece
// removed); `decide`/`tearUpContract` have none yet (a forced choice and a rare campaign-only action,
// neither part of the core 7-actions-plus-role set STYLE.md 5.1 documents).
// Plan item 83: the cards draw each kind's painted picture (ActionArt.tsx) where the glyph was.
const ACTION_ICON: Partial<Record<Action['kind'], typeof OpenStallIcon>> = {
  openStall: OpenStallArt,
  supplyOutlets: SupplyArt,
  supplyBuyout: SupplyArt,
  rebut: RebutArt,
  invest: InvestArt,
  sell: SellArt,
  scheme: SchemeArt,
  graft: GraftArt,
  role: RoleArt,
}

// ROADMAP 9 "cost chips shown with resource tokens": a small icon+number badge inside an action button,
// next to `actionLabel`'s existing cost-as-text (e.g. "(4 Marks)") — additive, not a replacement, so no
// existing button text changes (several e2e tests match button names by prefix, e.g. `/^Graft:/`).
// `undefined` renders nothing, for the actions `actionCost` already returns no cost for.
function ActionCostChip({ cost }: { cost: { resource: ResourceKind; amount: number } | undefined }) {
  if (!cost) return null
  const Icon = COST_ICON[cost.resource]
  return (
    <span className="action-cost">
      <Icon size={14} />
      {cost.amount}
    </span>
  )
}

// AAA UI M4 4.9 "Ledger chips": a resource on the active producer's ledger, icon + count, with this
// round's income as a small "+2" rather than "(2/round)".
function LedgerChip({ term, Icon, value, income, tick, incomeTick = 0, tutorial, delta, art }: { term: string; Icon: typeof ProduceIcon; value: number; income: number; tick: number; incomeTick?: number; tutorial?: string; delta?: number; art?: ReactNode }) {
  // Plan item 287: the stall's goods move when their count does: a hop on a gain, a sink on a loss (a fade under
  // reduced motion). The slot remounts on each tick, which replays its animation.
  const last = useRef<{ value: number; dir: 'up' | 'down' }>({ value, dir: 'up' })
  if (last.current.value !== value) last.current = { value, dir: value > last.current.value ? 'up' : 'down' }
  return (
    <Tooltip term={term}>
      <span className={art ? 'ledger-chip mat-store' : 'ledger-chip'} data-tutorial={tutorial} data-delta={delta ? delta : undefined} data-delta-label={delta ? (delta > 0 ? `+${delta}` : `\u2212${-delta}`) : undefined}>
        {art ? (
          <span key={`a${tick}`} className="mat-art-slot" data-bump={tick > 0 ? last.current.dir : undefined} aria-hidden="true">
            {art}
          </span>
        ) : null}
        <Icon size={18} />
        <span key={tick} className={tick > 0 ? 'num ledger-value hud-tick' : 'num ledger-value'}>{value}</span>
        <span className="visually-hidden"> {term}, </span>
        <span key={`i${incomeTick}`} className={incomeTick > 0 ? 'ledger-income num hud-tick income-tick' : 'ledger-income num'} aria-hidden="true">+{income}</span>
        <span className="visually-hidden">plus {income} a round</span>
      </span>
    </Tooltip>
  )
}

// AAA UI M4 fix: Sell's chip shows what you get (the Marks), since the label already says the Produce
// it takes; the visible label stays on one line ("Sell 2 Produce"), the full one is the accessible name.
function SellGainChip({ count }: { count: number }) {
  return (
    <span className="action-cost action-gain" aria-hidden="true">
      <span className="action-gain-arrow">{'\u2192'}</span>
      <MarksIcon size={14} />
      {count}
    </span>
  )
}

// A role card's face names just the ability and its effect ("On Air: +1 Trust"); the full label, with
// the producer's role title, stays in its accessible name. The long form ran off the foot of a phone card.
// Plan item 225: a role costs nothing, so its card's foot says so in the cost chip's place (a blank foot read as unfinished).
const ROLE_FREE_CHIP = (
  <span className="action-cost action-free" aria-hidden="true">
    Free
  </span>
)

function roleCardText(action: Extract<Action, { kind: 'role' }>, state: GameState): string {
  const roleName = PRODUCERS[state.activeProducer].roleName
  const ability = roleName.split(', ').pop() ?? roleName
  const target = action.targetRegion ? ` on ${REGIONS[action.targetRegion].name}` : ''
  const choice = action.choice === 'trust' ? ': +1 Trust' : action.choice === 'goodwill' ? ': +2 Goodwill' : ''
  return `${ability}${target}${choice}`
}

// Under the desktop INVEST head the verb is already said, so "Buy" hides there (CSS) and two-line names
// stay two lines: four Invest cards always fit the Actions frame at 1440x900. The text and the accessible
// name keep it.
// Plan item 83: the few long words in card names break at a syllable (a soft hyphen) in a narrow tile, never mid-letter.
const SOFT_BREAKS: [RegExp, string][] = [
  [/Reconnaissance/g, 'Recon\u00ADnaissance'],
  [/Whistleblower/g, 'Whistle\u00ADblower'],
  [/Letterpress/g, 'Letter\u00ADpress'],
]
function softBreaks(text: string): string {
  return SOFT_BREAKS.reduce((t, [re, to]) => t.replace(re, to), text)
}

function BuyVerb({ text: raw }: { text: string }) {
  const text = softBreaks(raw)
  // Plan item 83: in a big turn's two-up tiles the scheme's picture says "Scheme", so the word hides there.
  if (text.startsWith('Scheme: '))
    return (
      <>
        <span className="action-prefix">Scheme: </span>
        {text.slice(8)}
      </>
    )
  // Plan item 83: a lone Rebut's or Supply's count is its own line on a big turn's tile, so the name never cuts
  // mid-phrase.
  const lead = /^(Rebut|Supply): /.exec(text)
  if (lead)
    return (
      <>
        {lead[1]}
        <span className="action-colon">:</span>
        <span className="action-sub">
          {' '}
          {text.slice(lead[0].length).startsWith('remove ') && <span className="action-remove">remove </span>}
          {text
            .slice(lead[0].length)
            .replace(/^remove /, '')
            .replace(/ in…$/, '…')}
        </span>
      </>
    )
  if (!text.startsWith('Buy ')) return <>{text}</>
  return (
    <>
      <span className="action-verb">Buy </span>
      {text.slice(4)}
    </>
  )
}

function ActionButton({
  action,
  state,
  Icon,
  tutorialTarget,
  sellCount,
  onClick,
}: {
  action: Action
  state: GameState
  Icon?: typeof OpenStallIcon
  tutorialTarget?: boolean
  sellCount?: boolean
  onClick(): void
}) {
  if (action.kind === 'sell') {
    // Plan item 384: on the one Sell card the count sits on the 1-2-3 pips; the face just says Sell.
    return (
      <button aria-label={actionLabel(action, state)} data-tutorial={tutorialTarget ? 'action' : undefined} onClick={onClick}>
        <span className="action-label">
          <SellArt size={18} count={action.count} />
          {sellCount ? 'Sell' : `Sell ${action.count}`}
          {!sellCount && <span className="action-word"> Produce</span>}
        </span>
        <SellGainChip count={action.count} />
      </button>
    )
  }
  // Plan item 83: Graft's card is its name over what it gives, drawn as a gain chip (+1 crate, +1 coin) like Sell's.
  if (action.kind === 'graft') {
    return (
      <button aria-label={actionLabel(action, state)} data-tutorial={tutorialTarget ? 'action' : undefined} onClick={onClick}>
        <span className="action-label">
          {Icon && <Icon size={18} />}
          Graft
        </span>
        <span className="action-cost action-gain action-gain-graft" aria-hidden="true">
          +1
          <ProduceIcon size={14} />
          +1
          <MarksIcon size={14} />
        </span>
      </button>
    )
  }
  const cost = actionCost(action, state)
  const { text, aria } = chipLabel(actionLabel(action, state), !!cost)
  return (
    <button aria-label={aria ?? (action.kind === 'scheme' ? text : undefined)} data-tutorial={tutorialTarget ? 'action' : undefined} onClick={onClick}>
      <span className="action-label">
        {action.kind === 'invest' ? (
          <InvestArt size={18} motif={investMotif(action.improvementId)} variant={INVEST_VARIANT.get(action.improvementId)} />
        ) : (
          Icon && <Icon size={18} />
        )}
        {action.kind === 'role' ? roleCardText(action, state) : <BuyVerb text={text} />}
      </span>
      {action.kind === 'role' ? ROLE_FREE_CHIP : <ActionCostChip cost={cost} />}
    </button>
  )
}

// Plan item 320: an invest card's picture is the Improvement's own vignette scene, varied by its place among the
// Improvements that share its tag (InvestArt).
function investMotif(improvementId: string) {
  const card = IMPROVEMENTS_BY_ID.get(improvementId)
  return card ? vignetteFor(card) : undefined
}
const INVEST_VARIANT: Map<string, number> = (() => {
  const seen = new Map<string, number>()
  const out = new Map<string, number>()
  for (const card of IMPROVEMENTS) {
    const kind = vignetteFor(card)
    const n = seen.get(kind) ?? 0
    out.set(card.id, n)
    seen.set(kind, n + 1)
  }
  return out
})()

// AAA UI M4 (aaa-ui-specs.md "cathnivore" 4.2): a label that ends in its own cost ("Invest: buy Cold
// Store (5 Marks)") shows the cost once, in the price-tag chip; the button keeps the full label as its
// accessible name through aria-label, so every e2e name regex (`/^Invest/`) still matches.
const TRAILING_COST = /\s*\(\d+ (?:Marks?|Produce|Goodwill)\)$/
function chipLabel(label: string, hasChip: boolean): { text: string; aria?: string } {
  if (!hasChip || !TRAILING_COST.test(label)) return { text: label }
  // Under the INVEST head the verb is already said: "Buy Cold Store" fits the key on one line.
  return { text: label.replace(TRAILING_COST, '').replace(/^Invest: buy /, 'Buy '), aria: label }
}

// A region-targeting group (e.g. "Supply: remove 2 Outlets…") can cover several regions whose actual
// cost differs (Supply's per-Outlet Produce cost varies by region type and Improvements, SPEC 7) — the
// group button itself doesn't commit to a region yet, so it can only show one number if every entry in
// the group would actually cost the same. Mixed costs fall back to no chip rather than a misleading one.
function uniformGroupCost(
  entries: { index: number }[],
  actions: Action[],
  state: GameState,
): { resource: ResourceKind; amount: number } | undefined {
  const first = actionCost(actions[entries[0]!.index]!, state)
  if (!first) return undefined
  const uniform = entries.every((e) => {
    const c = actionCost(actions[e.index]!, state)
    return c && c.resource === first.resource && c.amount === first.amount
  })
  return uniform ? first : undefined
}

/**
 * Plan item 48: a win's headline. A Quick Game frees all of Marrow; a campaign chapter frees its own home regions,
 * so it names them ("Highmoor and Brindle Hills are free.") rather than claiming the whole Republic.
 */
function winHeadline(chapterId: string | undefined): string {
  // The last chapter, Kingsmarket, is the one that frees the whole Republic.
  const homes = chapterId && chapterId !== 'kingsmarket' ? CHAPTER_HOMES[chapterId] : undefined
  if (!homes?.length) return 'You liberated Marrow.'
  const names = homes.map((id) => REGIONS[id].name)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  return `${list} ${names.length > 1 ? 'are' : 'is'} free.`
}

/** Plan item 104: a disabled action's reason. Its lead ('Need ') and tail (' to remove') are their own spans so the
 *  phone dock's narrow card can drop them ('2 more Marks', 'No Outlets left') instead of cutting the words. */
function WhyNot({ text }: { text: string }) {
  const lead = text.startsWith('Need ') ? 'Need ' : ''
  const tail = / to remove$/.test(text) ? ' to remove' : ''
  return (
    <span className="action-why-not">
      {lead && <span className="why-lead">{lead}</span>}
      {text.slice(lead.length, text.length - tail.length)}
      {tail && <span className="why-tail">{tail}</span>}
    </span>
  )
}

/** Plan item 100: a plan card's target line, each region drawn as a chip (the words stay the accessible text). */
function TargetLine({ line, names }: { line: string; names: string[] }) {
  return (
    <>
      {splitTarget(line, names).map((part, i) =>
        part.region ? (
          <span key={i} className="plan-chip">
            {part.text}
          </span>
        ) : part.sep ? (
          <span key={i}>
            <span className="visually-hidden">,</span>{' '}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  )
}

export default function Game({ initial, seed, mode, onExit, onPlayAgain, onNewGame, onChapterEnd, tutorialSteps, guided, onTutorialDone, midGameScenes, chapterId, initialDismissedMidScenes, initialSavingFor }: Props) {
  const [state, setState] = useState(initial)
  const [sellPick, setSellPick] = useState<{ key: string; count: 1 | 2 | 3 } | null>(null)
  const layoutRef = useScrollCues()
  // The tutorial step whose note the player folded away (phone); a new step opens again.
  const [tipCollapsedAt, setTipCollapsedAt] = useState<number | null>(null)
  // ROADMAP 10's HUD tick animation (see `useHudTick`'s own comment) — called unconditionally here,
  // before any of this component's early returns (pass-device, end screen, tutorial rules), so the Rules
  // of Hooks hold regardless of which branch below actually renders.
  const roundTick = useHudTick(state.round)
  const trustTick = useHudTick(state.publicTrust)
  const lostLandTick = useHudTick(state.lostLandPool)
  const riftTick = useHudTick(state.rift)
  const activeResources = state.producers[state.activeProducer]?.resources
  const produceTick = useHudTick(`${state.activeProducer}:${activeResources?.produce}`)
  const marksTick = useHudTick(`${state.activeProducer}:${activeResources?.marks}`)
  const goodwillTick = useHudTick(`${state.activeProducer}:${activeResources?.goodwill}`)
  const activeProduction = state.producers[state.activeProducer]?.production
  const produceIncomeTick = useIncomeTick(state.activeProducer, activeProduction?.produce ?? 0)
  const marksIncomeTick = useIncomeTick(state.activeProducer, activeProduction?.marks ?? 0)
  const goodwillIncomeTick = useIncomeTick(state.activeProducer, activeProduction?.goodwill ?? 0)
  const cathLogSeenRef = useRef(0)
  // Plan item 276: the pose she strikes with a reaction, held a few seconds, then back to her resting pose.
  const [cathPose, setCathPose] = useState<CathPoseId | null>(null)
  const poseTimerRef = useRef(0)
  const [poseTick, setPoseTick] = useState(0)
  const strikePose = useCallback((reaction: CathReaction) => {
    setCathPose(CATH_REACTION_POSE[reaction])
    setPoseTick((t) => t + 1)
    window.clearTimeout(poseTimerRef.current)
    poseTimerRef.current = window.setTimeout(() => setCathPose(null), 5000)
  }, [])
  useEffect(() => () => window.clearTimeout(poseTimerRef.current), [])
  const [cathReaction, setCathReaction] = useState<{ expression: CathExpression; line: string }>(() => ({
    expression: CATH_REACTION_EXPRESSION.greeting,
    // Plan item 144: a game in a market week opens on Cath naming it (the event's own line, in her voice).
    line: initial.config.marketEvent && initial.round === 1 && initial.actionHistory.length === 0 ? MARKET_EVENTS[initial.config.marketEvent].banner : cathLine('greeting', String(seed)),
  }))
  // A reloaded guided game picks the script up just after the last action it already took.
  const [tutorialIndex, setTutorialIndex] = useState(() =>
    guided && tutorialSteps ? resumeIndex(tutorialSteps, initial.actionHistory.length) : 0,
  )
  // The guided tutorial ends early when skipped, or if the board ever stops matching the script.
  const [guidedEnded, setGuidedEnded] = useState(false)
  const [dismissedMidScenes, setDismissedMidScenes] = useState<string[]>(initialDismissedMidScenes ?? [])
  // Plan item 183: the Not-yet shelf's pinned goal per producer, and whether the folded shelf is open.
  const [savingFor, setSavingFor] = useState<NonNullable<SavedGame['savingFor']>>(initialSavingFor ?? {})
  const [shelfOpen, setShelfOpen] = useState(false)
  // The goal that just became affordable, lifting into the hand.
  const [goalLift, setGoalLift] = useState<string | null>(null)
  const aiProducerRef = useRef<ProducerId | null>(mode === 'solo' ? initial.config.producers[1] ?? null : null)
  const autoplayRef = useRef(isE2EAutoplay())
  const isDesktop = useIsDesktopLayout()
  const deskTableCath = useMedia(TABLE_CATH_QUERY)
  const phoneTableCath = useMedia(PHONE_TABLE_CATH_QUERY)
  const tableCath = deskTableCath || phoneTableCath
  const bubbleSuggest = useMedia(TABLE_CATH_TALL_QUERY)
  // Plan item 149: the same sizes hold the hand of cards at the table's edge.
  const handOnTable = deskTableCath
  // Plan item 302: on a phone every playable card stays in reach. The row still swipes, but each card is sticky on
  // both sides: one swiped past waits at the left edge and one not reached yet at the right, each showing a 24 px
  // strip of itself (`--stick-l`, `--stick-r`, read by table.css), so the whole hand is in view at once. The NOT
  // YET deck after them scrolls as before. A tap on a strip brings that card to the front; it doesn't play it.
  useLayoutEffect(() => {
    const row = document.querySelector<HTMLElement>('.action-tray .actions')
    if (!row) return
    const cards: HTMLElement[] = []
    // Plan item 368: on the phone counter (390x844 and taller) the hand is a plain row of narrow cards, three whole
    // faces in view, not one face and a run of spines.
    if (!handOnTable && !isE2EHandFanOff() && matchMedia('(max-width: 1023.98px)').matches && !matchMedia(PHONE_TABLE_CATH_QUERY).matches) {
      for (const c of Array.from(row.children) as HTMLElement[]) {
        if (c.matches('.action-head-later')) break
        if (c.matches('.action-item')) cards.push(c)
      }
    }
    for (const c of Array.from(row.querySelectorAll<HTMLElement>(':scope > [data-peek]'))) {
      if (!cards.includes(c)) {
        delete c.dataset.peek
        delete c.dataset.stack
      }
    }
    if (cards.length < 2) {
      for (const c of cards) {
        delete c.dataset.peek
        delete c.dataset.stack
      }
      return
    }
    // The right stack's offsets come from each card's width, so cards a few px wider or narrower still show even strips.
    const widths = cards.map((c) => c.offsetWidth)
    const rcs = getComputedStyle(row)
    const inner = row.clientWidth - parseFloat(rcs.paddingLeft || '0') - parseFloat(rcs.paddingRight || '0')
    const peek = Math.max(HAND_PEEK, Math.floor((inner - Math.max(...widths)) / (cards.length - 1)))
    if (row.dataset.peekPx !== String(peek)) row.dataset.peekPx = String(peek)
    let inset = 0
    for (let i = cards.length - 1; i >= 0; i--) {
      const c = cards[i]!
      c.dataset.peek = ''
      // The name a strip shows down its edge while the card is off the front (table.css).
      const name = (c.querySelector('.action-label')?.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (c.dataset.spine !== name) c.dataset.spine = name
      c.style.setProperty('--stick-l', `${i * peek}px`)
      c.style.setProperty('--stick-r', `${inset}px`)
      if (i > 0) inset += peek + widths[i]! - widths[i - 1]!
    }
    stackHand(row)
  })
  useEffect(() => {
    const row = document.querySelector<HTMLElement>('.action-tray .actions')
    if (!row) return
    // A card that isn't the front one is only brought forward: its press, release and click all stop here (hand
    // cards also drag, on pointer events), so it is never played or armed from its strip.
    let held: HTMLElement | null = null
    const covered = (e: Event) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.action-item[data-peek]')
      if (!card || card.parentElement !== row) return null
      const r = card.getBoundingClientRect()
      return card.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) ? null : card
    }
    const swallow = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const onDown = (e: PointerEvent) => {
      held = covered(e)
      if (held) swallow(e)
    }
    const onUpOrClick = (e: Event) => {
      const card = held ?? covered(e)
      if (!card) return
      swallow(e)
      if (e.type === 'click') {
        held = null
        const peers = [...row.querySelectorAll<HTMLElement>(':scope > .action-item[data-peek]')]
        bringToFront(row, card, peers.indexOf(card))
      }
    }
    const onScroll = () => stackHand(row)
    row.addEventListener('pointerdown', onDown, true)
    row.addEventListener('pointerup', onUpOrClick, true)
    row.addEventListener('click', onUpOrClick, true)
    row.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      row.removeEventListener('pointerdown', onDown, true)
      row.removeEventListener('pointerup', onUpOrClick, true)
      row.removeEventListener('click', onUpOrClick, true)
      row.removeEventListener('scroll', onScroll)
    }
  })
  // Plan item 149: the hand fans out from its middle: outer cards tilt and dip a little, like cards held.
  useLayoutEffect(() => {
    if (!handOnTable) return
    const fan = () => {
    const hand = document.querySelector<HTMLElement>('.table-hand')
    const cards = [...document.querySelectorAll<HTMLElement>('.table-hand .action-item')]
    if (!hand || cards.length === 0) return
    // Plan item 154: every card keeps its whole face. Cards overlap by at most a fifth of a card; a turn with more
    // cards than one row holds that way lays them out as two rows of shorter, landscape cards (`data-rows`), each
    // still showing its picture, whole name and cost. Cards sit at measured spots (`--x`, `--y`), not in a flex
    // row, so nothing can squeeze them.
    const cs = getComputedStyle(hand)
    const padL = parseFloat(cs.paddingLeft)
    const padB = parseFloat(cs.paddingBottom)
    const room = hand.clientWidth - padL - parseFloat(cs.paddingRight)
    const LAP = 6
    const plan = (rows: number, widths: number[]) => {
      const per = Math.ceil(cards.length / rows)
      const out: { from: number; to: number; step: number; width: number }[] = []
      for (let from = 0; from < cards.length; from += per) {
        const to = Math.min(cards.length, from + per)
        const ws = widths.slice(from, to)
        const sum = ws.reduce((x, y) => x + y, 0)
        const n = ws.length
        const step = n > 1 ? Math.min(-LAP, (room - sum) / (n - 1)) : 0
        out.push({ from, to, step, width: sum + step * (n - 1) })
      }
      return out
    }
    const fits = (rows: ReturnType<typeof plan>, widths: number[]) =>
      rows.every((row) => row.step >= -0.2 * Math.min(...widths) - 0.01 && row.width <= room + 0.5)
    // Plan item 177: a card whose name runs past its face is dealt wider; where that would break the row, its name
    // is set tighter instead (`data-dense`: a smaller picture and a 12 px name). Then everything is measured.
    const overflows = (c: HTMLElement) => {
      const face = c.querySelector<HTMLElement>(':scope > button:first-child, .action-card-draggable')
      return !!face && face.scrollHeight > face.clientHeight + 1
    }
    const widen = () => {
      for (const c of cards) { delete c.dataset.wide; delete c.dataset.dense; c.style.setProperty('--lap', '0px') }
      for (const c of cards) if (overflows(c)) c.dataset.wide = ''
      // Item 218: a name that runs three lines under the picture window can still spill from a wide card; set it tighter.
      for (const c of cards) if (c.dataset.wide !== undefined && overflows(c)) c.dataset.dense = ''
    }
    delete hand.dataset.rows
    hand.style.removeProperty('--hand-card-w')
    widen()
    let widths = cards.map((c) => c.offsetWidth)
    let rows = plan(1, widths)
    if (!fits(rows, widths) && cards.some((c) => c.dataset.wide !== undefined)) {
      for (const c of cards) if (c.dataset.wide !== undefined) { delete c.dataset.wide; c.dataset.dense = '' }
      widths = cards.map((c) => c.offsetWidth)
      rows = plan(1, widths)
    }
    if (!fits(rows, widths)) {
      hand.dataset.rows = '2'
      widen()
      widths = cards.map((c) => c.offsetWidth)
      for (let r = 2; r <= 4; r++) {
        rows = plan(r, widths)
        if (fits(rows, widths)) break
      }
      // Plan item 312: in rows no card lies over another: every card takes the widest width that fits its row with
      // an 8 px gap (a wide card 19% more), set as --hand-card-w (table.css), and the rows are laid out again.
      const GAP = 8
      let w = window.innerWidth < 1400 ? 186 : 214
      for (const row of rows) {
        const m = row.to - row.from
        const wides = cards.slice(row.from, row.to).filter((c) => c.dataset.wide !== undefined).length
        w = Math.min(w, (room - GAP * (m - 1)) / (m + 0.19 * wides))
      }
      hand.style.setProperty('--hand-card-w', `${Math.floor(w)}px`)
      widths = cards.map((c) => c.offsetWidth)
      rows = rows.map((row) => {
        const ws = widths.slice(row.from, row.to)
        const sum = ws.reduce((x, y) => x + y, 0)
        const n = ws.length
        const step = n > 1 ? Math.min(GAP, (room - sum) / (n - 1)) : 0
        return { ...row, step, width: sum + step * (n - 1) }
      })
    }
    const cardH = Math.max(...cards.map((c) => c.offsetHeight))
    const rowStep = cardH + 6
    // Set on the parent so the spacer that holds the hand's place while it steps away (item 190) keeps its height:
    // on the hand itself the spacer fell back to 140 px, and the board jumped 34 px on Hollowell's turn after the
    // painted cards (item 218) grew taller.
    ;(hand.parentElement ?? hand).style.setProperty('--hand-h', `${Math.round(cardH + (rows.length - 1) * rowStep + padB + 12)}px`)
    // Plan item 312: where each row's shelf plank runs (table.css .table-hand[data-rows]::before).
    hand.style.setProperty('--row-step', `${rowStep}px`)
    hand.style.setProperty('--pad-b', `${padB}px`)
    // a big deal takes three or four rows, each on its own plank
    if (hand.dataset.rows !== undefined) hand.dataset.rowCount = String(rows.length)
    else delete hand.dataset.rowCount
    rows.forEach((row, r) => {
      const n = row.to - row.from
      const mid = (n - 1) / 2
      let x = padL + Math.max(0, (room - row.width) / 2)
      // The first row is the upper one; the last sits at the table's edge.
      const y = padB + (rows.length - 1 - r) * rowStep
      for (let i = row.from; i < row.to; i++) {
        const card = cards[i]!
        const off = mid === 0 || rows.length > 1 ? 0 : (i - row.from - mid) / Math.max(mid, 3)
        card.style.setProperty('--fan', `${(off * 4).toFixed(2)}deg`)
        card.style.setProperty('--rise', rows.length > 1 ? '0px' : `${Math.round(-(1 - off * off) * 8)}px`)
        card.style.setProperty('--x', `${x.toFixed(1)}px`)
        card.style.setProperty('--y', `${y}px`)
        // Item 217: the name keeps clear of the strip the next card covers (a card's face never runs under it).
        card.style.setProperty('--lap', i < row.to - 1 ? `${Math.max(0, Math.round(-row.step))}px` : '0px')
        x += widths[i]! + row.step
      }
    })
    // A name that no longer fits its face with the strip kept is set tighter first (item 218: the picture window
    // leaves less height); only then does it take the strip back (it's still read whole).
    for (const c of cards) if (overflows(c)) c.dataset.dense = ''
    for (const c of cards) if (overflows(c)) c.style.setProperty('--lap', '0px')
    }
    fan()
    window.addEventListener('resize', fan)
    return () => window.removeEventListener('resize', fan)
  })
  // Plan item 155: each seated producer takes the free spot in the map frame furthest from Cath (and from the
  // other producer), clear of every hex, name plaque, prop, the event ticket, the map key and Cath herself.
  useLayoutEffect(() => {
    // Plan item 387: a phone seats them at the counter (CathDock), not in the map frame.
    if (!deskTableCath) return
    const seat = () => {
      const wrap = document.querySelector<HTMLElement>('.map-wrap')
      const people = [...document.querySelectorAll<HTMLElement>('.table-producers .table-producer')]
      if (!wrap || people.length === 0) return
      const w = wrap.getBoundingClientRect()
      const rect = (e: Element) => e.getBoundingClientRect()
      const obstacles: DOMRect[] = [
        ...[...wrap.querySelectorAll('.region-hex')].map((h) => rect(h.querySelector('polygon') ?? h)),
        ...[...wrap.querySelectorAll('.region-plaque, .table-prop, .event-ticket, .map-key, .table-cath-line, .table-cath-figure, .map-overlay-btn')].map(rect),
      ].filter((r) => r.width > 0 && r.height > 0)
      const cath = wrap.querySelector('.table-cath-figure')
      if (!phoneTableCath) {
        // The crates stay on the rim in front of them, so they are no obstacle here.
        const standing = [
          ...[...wrap.querySelectorAll('.region-hex')].map((h) => rect(h.querySelector('polygon') ?? h)),
          ...[...wrap.querySelectorAll('.region-plaque, .table-prop:not(.produce-crates), .event-ticket, .map-key, .table-cath-line, .table-cath-figure, .map-overlay-btn')].map(rect),
        ].filter((r) => r.width > 0 && r.height > 0)
        standProducers(wrap, people, standing, cath ? rect(cath).height : 300)
        return
      }
      const cathX = cath ? rect(cath).left + rect(cath).width / 2 : w.left
      const PAD = 6
      const taken: { x: number; y: number; w: number; h: number }[] = []
      for (const person of people) {
        // Full size where the frame has room; a smaller bust (down to 60%) before none at all.
        let best = null as { x: number; y: number; score: number } | null
        let pw = 0
        let ph = 0
        for (const k of [1, 0.88, 0.76, 0.6]) {
        person.style.setProperty('--seat-k', String(k))
        pw = person.offsetWidth
        ph = person.offsetHeight
        for (let y = w.top + PAD; y + ph <= w.bottom - PAD; y += 4)
          for (let x = w.left + PAD; x + pw <= w.right - PAD; x += 4) {
            const hit = (o: { left: number; top: number; right: number; bottom: number }) =>
              x < o.right + 3 && o.left - 3 < x + pw && y < o.bottom + 3 && o.top - 3 < y + ph
            if (obstacles.some(hit)) continue
            if (taken.some((t) => hit({ left: t.x, top: t.y, right: t.x + t.w, bottom: t.y + t.h }))) continue
            const cx = x + pw / 2
            const score = Math.abs(cx - cathX) + taken.reduce((acc, t) => acc + Math.hypot(cx - (t.x + t.w / 2), y - t.y) * 0.5, 0) - y * 0.05
            if (!best || score > best.score) best = { x, y, score }
          }
        if (best) break
        }
        if (best) {
          taken.push({ x: best.x, y: best.y, w: pw, h: ph })
          person.style.setProperty('--seat-x', `${(best.x - w.left).toFixed(0)}px`)
          person.style.setProperty('--seat-y', `${(best.y - w.top).toFixed(0)}px`)
          delete person.dataset.unseated
        } else person.dataset.unseated = ''
      }
    }
    seat()
    const ro = new ResizeObserver(seat)
    const wrap = document.querySelector('.map-wrap')
    if (wrap) ro.observe(wrap)
    return () => ro.disconnect()
  }, [deskTableCath, phoneTableCath, state.config.producers])
  // SPEC 4.6: "a human may undo any action taken in their current turn ... undo never reveals hidden
  // information [because refills happen at cleanup]. Any action that reveals hidden information ... is
  // marked irreversible, and undo cannot go back past it. The AI never undoes." So the stack is cleared
  // whenever the turn changes (activeProducer switches, see `advance()`), and once an irreversible action
  // is taken, its own entry can never be popped (see `undo()`) — later actions in the same turn can still
  // be undone individually, right back down to that point.
  const undoStackRef = useRef<UndoEntry[]>([])
  const planStripRef = usePlanArming([state.squeeze?.id ?? '', state.expand?.id ?? '', state.scout?.id ?? ''])
  const rngRef = useRef(createRng(seed + 1))
  // SPEC 9.2's real AI teammate ("MCTSBot running in a Web Worker so the screen never freezes"), created
  // lazily so hotseat/campaign games with no AI producer never spin one up. Terminated on unmount.
  const aiWorkerRef = useRef<Worker | null>(null)
  useEffect(() => {
    return () => {
      aiWorkerRef.current?.terminate()
      aiWorkerRef.current = null
    }
  }, [])
  // Plan item 141: the action(s) under the pointer or focus, previewed on the board.
  const [previewKeys, setPreviewKeys] = useState<string[] | null>(null)
  // A move changes the list, so an old preview's indices would point at the wrong cards.
  useEffect(() => setPreviewKeys(null), [state])
  const [selectedGroup, setSelectedGroup] = useState<{ label: string; entries: { index: number; region: RegionId }[] } | null>(null)
  // SPEC 10.2: "Choosing an action enters targeting mode: legal regions ... glow, everything else dims, a
  // clear Confirm button appears, and Cancel is always visible." Tapping a glowing region used to commit
  // the action immediately; it now only stages a choice (`pendingChoice`), narrowing the glow to that one
  // region, and the action only actually happens on Confirm. Cancel steps back to the full group's glow
  // (or, with nothing pending, drops out of targeting mode entirely).
  const [pendingChoice, setPendingChoice] = useState<{ index: number; region: RegionId } | null>(null)
  // Plan item 109: the region opened up close on a phone (null: none).
  const [closeUp, setCloseUp] = useState<RegionId | null>(null)
  // Plan item 21: a region card can be dragged onto a glowing hex; dropping it there plays it at once.
  const [drag, setDrag] = useState<{ label: string; x: number; y: number; regions: RegionId[] } | null>(null)
  const dragRef = useRef<{ x0: number; y0: number; moved: boolean; group: { label: string; entries: { index: number; region: RegionId }[] } } | null>(null)
  const dragClickGuard = useRef(false)
  // SPEC 10.2: "Tapping [a Squeeze/Expand/Scout card] highlights the matching regions on the map." A
  // second tap on the same card clears the highlight; tapping a different card switches to it.
  const [planHighlightSlot, setPlanHighlightSlot] = useState<'squeeze' | 'expand' | 'scout' | null>(null)
  // Plan item 25: hovering or focusing a plan card shows its targets too (a tap pins them, as before).
  const [planPeekSlot, setPlanPeekSlot] = useState<'squeeze' | 'expand' | 'scout' | null>(null)
  const planHotSlot = planPeekSlot ?? planHighlightSlot
  // Plan item 212: on an upright phone the three papers fold into one placard; a tap opens them as a sheet.
  const [papersOpen, setPapersOpen] = useState(false)
  useEffect(() => {
    if (!papersOpen) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      const t = e.target as Element | null
      if (e.type === 'pointerdown' && t?.closest?.('.plan-strip, [data-intent-placard]')) return
      setPapersOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [papersOpen])
  const planThreat = planHotSlot ? { slot: planHotSlot, regions: planPreview(state, planHotSlot).regions } : undefined
  const [pendingEnemyTurn, setPendingEnemyTurn] = useState<GameEvent[]>([])
  // Plan item 213: Hollowell's turn ducks the market score under its muzak until the turn's playback ends.
  const hollowellPlaying = pendingEnemyTurn.length > 0
  // The round sets the score's tempo and mode (a resumed game too, not only a round change).
  useEffect(() => setScoreRound(state.round), [state.round])
  useEffect(() => {
    setScoreMode(hollowellPlaying ? 'muzak' : 'market')
    return () => setScoreMode('market')
  }, [hollowellPlaying])
  // Plan item 92: the regions the enemy turn started from, so the map can play its changes step by step.
  const [enemyTurnBefore, setEnemyTurnBefore] = useState<GameState['regions'] | undefined>()
  const [enemyStepRegion, setEnemyStepRegion] = useState<RegionId | undefined>()
  // Plan item 11: the step being played, so the map can fly its pieces out of the HQs.
  const [enemyStep, setEnemyStep] = useState<{ event: GameEvent | undefined; step: number } | undefined>()
  // Plan item 92: the last step whose change has reached the map (a flown piece lands 640 ms into its step).
  const [enemyLanded, setEnemyLanded] = useState(-1)
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(landTimerRef.current), [])
  const [showLog, setShowLog] = useState(false)
  const [showFarm, setShowFarm] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [drawer, setDrawer] = useState<DrawerId | null>(null)
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])
  const [showRulesFromTutorial, setShowRulesFromTutorial] = useState(false)
  // SPEC 9.2: "Each AI action shows a one-line reason in the log." Keyed by the index of the `state.log`
  // entry the reason belongs to (the `{type: 'action'}` entry `applyAction` appends for that decision) —
  // engine state itself never carries this narration, since it's not a rule, so it lives alongside the UI
  // state that already tracks everything else not worth serializing into a save (`pendingChoice`, etc.).
  const [aiReasons, setAiReasons] = useState<Record<number, string>>({})
  // Plan item 34: the AI teammate's pick on show (a lifted card with its reason) before it is applied. A
  // tap commits it at once and plays the rest of their turn without the show.
  const [teammatePick, setTeammatePick] = useState<{ from: GameState; action: Action; reason: string } | null>(null)
  const skipTeammateRef = useRef(false)
  // Plan item 36: the card of the last buy, in flight to the farmstead.
  const lastCardRef = useRef<{ el: HTMLElement; at: number } | null>(null)
  const [buyFlight, setBuyFlight] = useState<{ key: number; card: ImprovementCard; cost: number; path: BuyFlightPath } | null>(null)
  // Plan item 83: a desktop turn whose playable cards overflow the Actions frame folds the Farm block for the rest of
  // that turn (its Farm key sits beside Undo), giving the frame its height. Keyed by round and producer, so it
  // never flickers back mid-turn when the fold makes the cards fit.
  const [bigTurn, setBigTurn] = useState('')
  // A folded turn that still cuts a card (15 cards with a three-key Supply, 1 deal in 20 at 1280x800) goes one
  // step tighter: one-line Sell tiles and every family card's name beside its keys.
  const [tightTurn, setTightTurn] = useState('')
  const turnKey = `${state.round}:${state.activeProducer}`
  useLayoutEffect(() => {
    if (!isDesktop || tightTurn === turnKey) return
    const folded = bigTurn === turnKey
    const sheet = document.querySelector('.actions-sheet .actions')
    if (!sheet) return
    const check = () => {
      const frame = sheet.getBoundingClientRect()
      // A card under the frame's bottom fade (shown while more rows lie below) is not really in reach either.
      const more = sheet.scrollHeight - sheet.clientHeight - sheet.scrollTop > 1
      const floor = frame.bottom - (more || sheet.hasAttribute('data-fade-bottom') ? 36 : 0) + 1
      const over = [...sheet.querySelectorAll('.action-item')].some(
        (item) => !item.querySelector(':scope > button:disabled') && item.getBoundingClientRect().bottom > floor,
      )
      if (over) (folded ? setTightTurn : setBigTurn)(turnKey)
      return over
    }
    if (check() || typeof ResizeObserver === 'undefined') return
    // A card can grow after this render (its art or the web fonts land, the frame shrinks as the map settles), so
    // the check runs again whenever the frame or a card changes size during the turn; once is enough to fold.
    const ro = new ResizeObserver(() => {
      if (check()) ro.disconnect()
    })
    ro.observe(sheet)
    for (const item of sheet.querySelectorAll('.action-item')) ro.observe(item)
    return () => ro.disconnect()
  }, [state, isDesktop, bigTurn, tightTurn, turnKey, pendingEnemyTurn.length, selectedGroup, teammatePick])
  // Plan item 123: a phone card whose name and price don't fit beside its 56 px picture (a region's name, a long
  // ability) is marked tight, and its picture steps down so nothing leaves the card. Measured after each render.
  // Plan item 320: on the desktop table's hand the same measure lets a card whose name fits take a 60% window (table.css);
  // there it reads layout offsets, since the fan's tilt inflates on-screen boxes into each other.
  useLayoutEffect(() => {
    if (isDesktop) {
      for (const b of document.querySelectorAll<HTMLElement>('.table-hand .action-item:not(.action-family) > button:first-child:not(:disabled)')) {
        b.removeAttribute('data-tight')
        if ([...b.children].some((c) => c instanceof HTMLElement && c.offsetTop + c.offsetHeight > b.clientHeight - 2)) b.setAttribute('data-tight', '')
      }
      return
    }
    for (const b of document.querySelectorAll<HTMLElement>('.action-tray .actions .action-item > button:first-child:not(:disabled)')) {
      b.removeAttribute('data-tight')
      if (b.scrollHeight > b.clientHeight + 1 || [...b.children].some((c) => c.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom + 1)) b.setAttribute('data-tight', '')
    }
  })
  // Plan item 141: on a phone the card strip scrolls sideways, so after each move the card Cath suggests is
  // brought into view if it's off the strip (never fighting the player's own scroll between moves).
  useEffect(() => {
    if (isDesktop) return
    const item = document.querySelector<HTMLElement>('.action-tray .actions [data-suggested]')
    if (!item) return
    let strip: HTMLElement | null = item.parentElement
    while (strip && strip.scrollWidth <= strip.clientWidth + 1) strip = strip.parentElement
    if (!strip) return
    const s = strip.getBoundingClientRect()
    const r = item.getBoundingClientRect()
    if (r.left >= s.left - 1 && r.right <= s.right + 1) return
    // Lands on the card's own snap point (the strip snaps to card starts). Plan item 368: on the phone counter, which
    // holds three whole cards, it lands two cards earlier, so her card is the third and the two before it stay in view.
    let anchor = item
    if (matchMedia(PHONE_TABLE_CATH_QUERY).matches) {
      const hand = Array.from(item.parentElement?.querySelectorAll<HTMLElement>(':scope > .action-item[data-hand-card]') ?? [])
      anchor = hand[Math.max(0, hand.indexOf(item) - 2)] ?? item
    }
    const left = strip.scrollLeft + (anchor.getBoundingClientRect().left - s.left) - (parseFloat(getComputedStyle(strip).scrollPaddingInlineStart) || 0)
    strip.scrollTo({ left: Math.max(0, left), behavior: loadSettings().animations ? 'smooth' : 'auto' })
  }, [state, isDesktop])
  // The teammate's picks this turn, for the ledger beside the card.
  // Keyed by round and producer, so last turn's picks never show on this one.
  const [teammateTurn, setTeammateTurn] = useState<{ turn: string; labels: string[] }>({ turn: '', labels: [] })
  // Hot-seat "pass the device" screen (Known issues, PROGRESS.md): the mode-picker already promises
  // "pass the device back and forth," but turns used to switch with only the active-producer header
  // changing, an easy-to-miss cue on a shared screen. `passAckRef` is the producer whose turn the screen
  // is already showing; whenever `state.activeProducer` moves past it (a new turn, or the next round's
  // first player after enemy-turn playback finishes), a blocking screen names the next producer until
  // dismissed. Solo/campaign games have at most one human seat, so this never fires there.
  const passAckRef = useRef<ProducerId>(initial.activeProducer)
  const [passDeviceFor, setPassDeviceFor] = useState<ProducerId | null>(null)

  const moodRegionsRef = useRef(initial.regions)
  const moodTimerRef = useRef<number | undefined>(undefined)
  const [producerFaces, setProducerFaces] = useState<Partial<Record<ProducerId, ProducerFace>>>({})
  // The Cath companion (CathCompanion.tsx): react to whatever's newest in the log each time it grows,
  // picking the highest-ranked reaction if a round produced more than one (see `cathReactionFor`).
  useEffect(() => {
    const newEvents = state.log.slice(cathLogSeenRef.current)
    cathLogSeenRef.current = state.log.length
    let best: { reaction: CathReaction; rank: number; line: string } | null = null
    for (const event of newEvents) {
      const candidate = cathReactionFor(event)
      if (candidate && (!best || candidate.rank >= best.rank)) best = candidate
    }
    if (best) {
      setCathReaction({ expression: CATH_REACTION_EXPRESSION[best.reaction], line: best.line })
      strikePose(best.reaction)
    }
    // Plan item 80: the producers react too, for a few seconds.
    const moods = producerMoods(newEvents, moodRegionsRef.current)
    moodRegionsRef.current = state.regions
    if (Object.keys(moods).length > 0) {
      setProducerFaces(moods)
      window.clearTimeout(moodTimerRef.current)
      moodTimerRef.current = window.setTimeout(() => setProducerFaces({}), 6000)
    }
  }, [state.log, state.regions, strikePose])
  useEffect(() => () => window.clearTimeout(moodTimerRef.current), [])
  // Plan item 127: a moment staged through `?e2eMoment` gets Cath's reaction as the real event would.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ kind: 'liberate' | 'squeeze'; region: RegionId }>).detail
      const reaction = d.kind === 'liberate' ? 'liberated' : 'squeeze'
      setCathReaction({ expression: CATH_REACTION_EXPRESSION[reaction], line: cathLineForRegion(reaction, d.region) })
      strikePose(reaction)
      // Plan item 155: the seated producers react as to a real one: worried with a Stall under a Squeeze, the
      // region's first Stall-holder delighted at a liberation.
      {
        const stalls = moodRegionsRef.current[d.region]?.stalls ?? {}
        const holder = (Object.keys(stalls) as ProducerId[]).find((p) => (stalls[p] ?? 0) > 0)
        const events: GameEvent[] =
          d.kind === 'squeeze'
            ? [{ type: 'squeeze', region: d.region, lostLand: false, stallRemoved: false, trustLoss: 0 }]
            : holder
              ? [{ type: 'liberated', region: d.region, producer: holder }]
              : []
        const moods = producerMoods(events, moodRegionsRef.current)
        if (Object.keys(moods).length > 0) {
          setProducerFaces(moods)
          window.clearTimeout(moodTimerRef.current)
          moodTimerRef.current = window.setTimeout(() => setProducerFaces({}), 6000)
        }
      }
    }
    window.addEventListener('cathnivore-moment', on)
    return () => window.removeEventListener('cathnivore-moment', on)
  }, [strikePose])

  useEffect(() => {
    setSelectedGroup(null)
    setPendingChoice(null)
  }, [state])

  useEffect(() => {
    saveGame({ version: 1, config: state.config, seed, actions: state.actionHistory, chapterId, dismissedMidScenes, savingFor })
  }, [state, seed, chapterId, dismissedMidScenes, savingFor])

  // SPEC 6/8.1: in Solo mode, the second producer is played by the AI teammate — the real MCTSBot-in-Worker
  // bot below, not a HeuristicBot stand-in (see the effect further down that wires `aiWorker.ts`).
  // Applies an action and, if it ended the round, queues the resulting enemy-turn events for playback
  // (SPEC 10.2) instead of jumping straight to the new state's controls.
  function advance(from: GameState, action: Action, aiReason?: string): void {
    const next = applyAction(from, action)
    // Undo is scoped to "the current turn" (SPEC 4.6) — the moment the active producer changes, whatever
    // was undoable before belongs to a turn that's now over.
    if (next.activeProducer !== from.activeProducer) undoStackRef.current = []
    const events = enemyTurnEvents(from, next)
    // Plan item 36: a buy flies the card into the farmstead and counts the Marks out.
    // Not when the buy hands a hot-seat device over (the pass screen covers the table).
    if (action.kind === 'invest' && !autoplayRef.current && !(mode === 'hotseat' && next.activeProducer !== from.activeProducer)) {
      const card = IMPROVEMENTS_BY_ID.get(action.improvementId)
      const path = card && buyFlightPath(card.id, from.activeProducer)
      if (card && path) {
        const cost = investCost(from, from.activeProducer, card)
        setBuyFlight({ key: next.log.length, card, cost, path })
      }
    }
    playHapticsFor(action, next.log.slice(from.log.length), next.result)
    // Plan item 53: the enemy turn's cues play on its playback beats (onStep below), not all at once here.
    const staged = events.length > 0 && !autoplayRef.current ? new Set(events) : null
    const added = next.log.slice(from.log.length)
    playSoundsFor(action, staged ? added.filter((e) => !staged.has(e)) : added, next.result)
    if (!next.result) soundRound(next.round, from.round)
    if (aiReason) {
      // `gameLog.ts`'s `actionCaption` deliberately returns null for invest/scheme/decide's own `{type:
      // 'action'}` entry, deferring to the richer 'invest'/'schemePlayed'/'decision' entry `applyAction`
      // also appends for those three kinds — LogSheet then drops the null-caption entry entirely, so a
      // reason attached to it would never render. Attach to whichever entry actually carries the caption
      // for this decision instead. `refreshAllLiberation` may have inserted 'liberated' entries first, so
      // find by type rather than assuming a fixed offset.
      const captionEventType: GameEvent['type'] =
        action.kind === 'invest' ? 'invest' : action.kind === 'scheme' ? 'schemePlayed' : action.kind === 'decide' ? 'decision' : 'action'
      const addedIndex = next.log.slice(from.log.length).findIndex((e) => e.type === captionEventType)
      if (addedIndex !== -1) {
        const logIndex = from.log.length + addedIndex
        setAiReasons((reasons) => ({ ...reasons, [logIndex]: aiReason }))
      }
    }
    setState(next)
    if (events.length > 0) {
      setEnemyTurnBefore(from.regions)
      setEnemyStep(undefined)
      setEnemyLanded(-1)
      setPendingEnemyTurn(events)
    }
  }

  // SPEC 8.1/8.2 ch3: a chapter's mid-game scripted scene (e.g. the round-5 Wholesome Hollow reveal) pauses
  // play until dismissed. Autoplay (e2e/the AI teammate) skips straight past it, matching how it already
  // skips the enemy-turn caption playback. See `pendingMidSceneTrigger`'s own comment for why this is
  // derived from the log rather than from `dismissedMidScenes` component state alone (that state resets on
  // every reload, which used to make the scene reappear and re-block play long after it was dismissed).
  const pendingTrigger = midGameScenes ? pendingMidSceneTrigger(state.log, dismissedMidScenes) : undefined
  const pendingMidScene = pendingTrigger && !autoplayRef.current ? midGameScenes![pendingTrigger.sceneId] : undefined

  useEffect(() => {
    if (autoplayRef.current && pendingTrigger) setDismissedMidScenes((d) => [...d, pendingTrigger.sceneId])
  }, [pendingTrigger])

  // ROADMAP 238: liberating Marrow while a market event runs earns Cath that event's pin.
  const [newPin, setNewPin] = useState<CathPin | null>(null)
  useEffect(() => {
    if (state.result?.won && awardPin(state.config.marketEvent)) setNewPin(pinForEvent(state.config.marketEvent))
  }, [state.result, state.config.marketEvent])

  // Plan item 15: a Daily Market's first finish of the day is recorded; the end screen shows the streak.
  const [dailyStrip, setDailyStrip] = useState<{ number: number; streak: number; layoutName: string } | null>(null)
  useEffect(() => {
    const date = state.config.daily
    if (!state.result || !date) return
    recordDaily(date, { won: state.result.won, rounds: state.result.round, regions: state.result.regionsLiberated, trust: state.publicTrust })
    const day = dailyMarket(new Date(`${date}T12:00:00Z`))
    setDailyStrip({ number: day.number, streak: dailyStreak(date, dailyRecord()), layoutName: LAYOUTS[day.layout].name })
  }, [state.result, state.config.daily, state.publicTrust])

  useEffect(() => {
    if (mode !== 'hotseat' || autoplayRef.current) return
    if (state.result || pendingEnemyTurn.length > 0 || pendingMidScene) return
    if (state.activeProducer !== passAckRef.current) setPassDeviceFor(state.activeProducer)
  }, [mode, state, pendingEnemyTurn.length, pendingMidScene])

  function showTeammatePick(from: GameState, action: Action, reason: string): void {
    if (skipTeammateRef.current) advance(from, action, reason)
    else setTeammatePick({ from, action, reason })
  }
  function commitTeammatePick(): void {
    if (!teammatePick) return
    const region = pickRegion(teammatePick.action)
    if (region && !skipTeammateRef.current) flyCardToHex(region)
    setTeammatePick(null)
    const turn = `${teammatePick.from.round}:${teammatePick.from.activeProducer}`
    const label = actionLabel(teammatePick.action, teammatePick.from)
    setTeammateTurn((t) => ({ turn, labels: t.turn === turn ? [...t.labels, label] : [label] }))
    advance(teammatePick.from, teammatePick.action, teammatePick.reason)
  }
  useEffect(() => {
    if (!teammatePick) return
    // Under webdriver the show is brief unless a test asks for it, so specs that only need the teammate to
    // move on don't wait out the reading time; the card and its `data-teammate-step` still render first.
    const ms = isE2EWebdriver() && !isE2ETeammateShow() ? 120 : TEAMMATE_PICK_MS[loadSettings().aiSpeed]
    const timer = setTimeout(commitTeammatePick, ms)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teammatePick])

  useEffect(() => {
    if (state.result || pendingEnemyTurn.length > 0 || pendingMidScene || teammatePick) return
    const aiProducer = aiProducerRef.current
    const decision = currentDecision(state)
    // SPEC 4.7 Rift 6's two decisions belong to "the players" collectively, not one producer (unlike
    // squeeze/Kingsmarket, which name whose production is affected) — the current turn holder decides.
    const activeProducer = decision && 'producer' in decision ? decision.producer : state.activeProducer
    const aiShouldAct = autoplayRef.current || (aiProducer !== null && activeProducer === aiProducer)
    if (!aiShouldAct) return

    // Autoplay (e2e tests, SPEC 11.4 gate 5's "HeuristicBot choices" driver) always uses the fast,
    // synchronous HeuristicBot for every producer — including the AI teammate's own seat — so a test can
    // finish a whole game in milliseconds rather than waiting on real MCTS decisions.
    if (autoplayRef.current) {
      if (E2E_AUTOPLAY_UNTIL > 0 && state.round >= E2E_AUTOPLAY_UNTIL) return
      const timer = setTimeout(() => {
        const [action, nextRng] = HeuristicBot.chooseAction(state, rngRef.current)
        rngRef.current = nextRng
        advance(state, action)
      }, 0)
      return () => clearTimeout(timer)
    }

    // The real Solo AI teammate (SPEC 9.2): MCTSBot in a Web Worker, so its up-to-400ms decision never
    // blocks the UI thread. `cancelled` guards against a stale response landing after the state this
    // decision was made against has already changed (e.g. the player undid something while it was
    // thinking, or the component unmounted).
    let cancelled = false
    let settled = false
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      if (!aiWorkerRef.current) {
        aiWorkerRef.current = new Worker(new URL('../ai/aiWorker.ts', import.meta.url), { type: 'module' })
      }
      const worker = aiWorkerRef.current
      // SPEC 1.3's #1 priority ("games can be finished") over a real MCTS decision every time: if the
      // worker throws (`onerror`) or simply never responds within a watchdog well past its own 400ms
      // budget, fall back to the fast, synchronous HeuristicBot rather than leaving the AI teammate's turn
      // — and the whole game — stuck forever with no visible failure and no recovery path.
      const fallBackToHeuristic = (why: string) => {
        // Unregister this turn's listeners before the early return, matching `onMessage`'s order below —
        // otherwise a turn whose effect gets cancelled (state advanced, e.g. an undo, or unmount) before a
        // late `error` event or a late watchdog fire left its now-stale closures permanently attached to
        // the long-lived worker (a listener leak, one pair per such turn — never a stale action, since the
        // `settled`/`cancelled` guard still blocked `advance()` correctly either way; see DECISIONS.md).
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        clearTimeout(watchdog)
        if (settled || cancelled) return
        settled = true
        aiWorkerRef.current?.terminate()
        aiWorkerRef.current = null
        // SPEC 9.2's "each AI action shows a one-line reason in the log" must still hold on this path —
        // silently substituting HeuristicBot with no trace left this undiagnosable (no console output, no
        // Log sheet indication) and every fallback move looked like a normal, reason-less action.
        console.warn(`AI teammate: ${why}, falling back to HeuristicBot for this decision.`)
        const [action, nextRng] = HeuristicBot.chooseAction(state, rngRef.current)
        rngRef.current = nextRng
        showTeammatePick(state, action, '(AI worker unavailable — used backup logic)')
      }
      const onMessage = (event: MessageEvent<AIWorkerResponse>) => {
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        clearTimeout(watchdog)
        if (settled || cancelled) return
        settled = true
        rngRef.current = event.data.rng
        showTeammatePick(state, event.data.action, event.data.reason)
      }
      const onError = (event: ErrorEvent) => fallBackToHeuristic(`worker error (${event.message || 'unknown'})`)
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      // Well past the bot's own 400ms decision budget (SPEC 9.2) plus the UI's own AI-speed delay, so this
      // only ever fires on a genuine hang, never on a slow-but-alive decision.
      watchdog = setTimeout(() => fallBackToHeuristic('decision timed out'), 3000)
      const request: AIWorkerRequest = { state, rng: rngRef.current, e2eCrash: isE2EAiWorkerCrash() }
      worker.postMessage(request)
    }, AI_SPEED_DELAY_MS[loadSettings().aiSpeed])
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearTimeout(watchdog)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pendingEnemyTurn.length, pendingMidScene, teammatePick])

  // The guided tutorial (chapter 1): the step showing, and whether the board still matches the script.
  // It always should (tests/tutorial-script.test.ts replays it), but if a step's action were ever not
  // legal, the tutorial steps aside into free play rather than stranding the player behind its gate.
  const guidedActive = !!guided && !guidedEnded && !autoplayRef.current && !!tutorialSteps && tutorialIndex < tutorialSteps.length
  const guidedStep = guidedActive ? tutorialSteps![tutorialIndex] : undefined
  const guidedExpect = guidedStep?.expect
  const guidedBroken =
    !!guidedExpect && !state.result && pendingEnemyTurn.length === 0 && !legalActions(state).some((a) => matchesExpect(guidedExpect, a))
  useEffect(() => {
    if (guidedBroken) setGuidedEnded(true)
  }, [guidedBroken])
  function finishTutorial(): void {
    setGuidedEnded(true)
    onTutorialDone?.()
  }

  // Skip the (otherwise real-time) enemy-turn caption playback instantly under e2e autoplay.
  useEffect(() => {
    if (autoplayRef.current && pendingEnemyTurn.length > 0) setPendingEnemyTurn([])
  }, [pendingEnemyTurn])

  // Plan item 183: once affordable the goal lifts off the shelf into the hand, and the pin comes off after it lands.
  // (Before the early returns below, so the hooks keep their order; `goalReady` is the render's own check.)
  const goalNow = savingFor[state.activeProducer]
  const goalPlayableNow = useMemo(() => {
    if (!goalNow || pendingEnemyTurn.length > 0) return false
    return legalActions(state).some((a) => (a.kind === 'invest' && investGoal(a.improvementId) === goalNow) || (a.kind === 'scheme' && schemeGoal(a.schemeId) === goalNow))
  }, [state, goalNow, pendingEnemyTurn.length])
  useEffect(() => {
    const goal = goalNow
    if (!goal || !goalPlayableNow || state.activeProducer === aiProducerRef.current) return
    const who = state.activeProducer
    setGoalLift(goal)
    setTimeout(() => {
      setGoalLift((cur) => (cur === goal ? null : cur))
      setSavingFor((cur) => {
        if (cur[who] !== goal) return cur
        const next = { ...cur }
        delete next[who]
        return next
      })
    }, 900)
  }, [goalNow, goalPlayableNow, state.activeProducer])

  // SPEC 8.1: "Each new rule is introduced ... with a '?' link to the rules reference." A full early
  // return (rather than an overlay stacked on top of the game's own `<main>`) avoids nesting two
  // `<main>` landmarks and reuses the exact same screen "How to Play" already opens from the title.
  if (showRulesFromTutorial) {
    // SPEC 8.1: land on the term this tutorial step is actually teaching, not just the top of the page.
    // Only an action-kind highlight names a glossary term this way; a region highlight (e.g. "tap this
    // region") has no single matching entry, so it falls back to opening at the top.
    const highlight = tutorialSteps?.[tutorialIndex]?.highlight
    const taught = highlight?.kind === 'action' ? highlight.action : tutorialSteps?.[tutorialIndex]?.expect?.kind
    const initialTerm = taught ? actionTermForKind(taught) : undefined
    return <RulesReference onClose={() => setShowRulesFromTutorial(false)} initialTerm={initialTerm} />
  }

  if (state.result) {
    const won = state.result.won
    const summary = endSummary(state, seed)
    return (
      // Plan item 48: a tap on the screen (not on a button) skips the sequence: everything lands at once.
      <main
        className={`end-screen ${won ? 'is-win' : 'is-loss'}`}
        data-seed={seed}
        onPointerDown={(ev) => {
          if (!(ev.target as HTMLElement).closest('button, a')) ev.currentTarget.classList.add('end-skip')
        }}
      >
        <section className="end-col end-col-story">
          <div className={`end-screen-hero ${won ? 'is-win' : 'is-loss'}`}>
            {/* Plan item 48: the result staged on the market table: Cath at half length in the bible pose for it,
                cheering a win, arms crossed over a loss. */}
            <CathArt
              className="end-screen-cath"
              framing="half"
              pose={won ? 'cheer' : 'crossed'}
              expression={won ? 'delighted' : 'smirk'}
              pin={chosenPin()}
              animate
              width={200}
              height={300}
              title={won ? 'Cath, cheering' : 'Cath, arms crossed, undeterred'}
            />
          </div>
          <div className={`end-stamp ${won ? 'is-win' : 'is-loss'}`} aria-hidden="true">
            {won ? 'Liberated' : 'Repossessed'}
          </div>
          <h1>{won ? winHeadline(chapterId) : 'Not this time.'}</h1>
          {dailyStrip && (
            <p className="end-daily" data-daily-streak={dailyStrip.streak}>
              Daily Market #{dailyStrip.number} · {dailyStrip.layoutName}
              {dailyStrip.streak > 0 && <b> · {dailyStrip.streak} in a row</b>}
              <small>Same market for everyone today. A new one at midnight UTC.</small>
            </p>
          )}
          {newPin && (
            <p className="pin-earned" data-pin={newPin}>
              New pin for Cath: {PINS[newPin].name}. She is wearing it already.
            </p>
          )}
          <p className="end-screen-verdict">
            {won ? 'Win' : `Loss: ${LOSS_REASON_LABEL[state.result.lossReason!]}`}
            <span className="end-grade" data-grade={summary.grade} aria-label={`Grade ${summary.grade} on ${state.config.difficulty}`}>
              <b>{summary.grade}</b>
              <small>{state.config.difficulty}</small>
            </span>
          </p>
          <p className="end-screen-story">{won ? WIN_LINE : LOSS_LINE[state.result.lossReason!]}</p>
          {summary.play && (
            <article className="end-play">
              <h2>
                <small>Play of the game, round {summary.play.round}</small>
                {summary.play.title}
              </h2>
              <p>{summary.play.line}</p>
            </article>
          )}
        </section>
        <section className="end-col end-col-data" aria-label="How the game went">
          <EndChart summary={summary} />
          <dl className="end-screen-stats">
            {[
              ['Regions liberated', state.result.regionsLiberated],
              ['Round', state.result.round],
              ['Cards bought', state.result.cardsBought],
              ['Schemes played', state.result.schemesPlayed],
            ].map(([label, value]) => (
              <div key={label} className="stat-card">
                <dd>{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
          <div className="end-screen-map">
            <RegionMap state={state} />
          </div>
        </section>
        <div className="end-actions">
          {onChapterEnd ? (
            <button
              className="primary"
              onClick={() => {
                clearGame()
                onChapterEnd(won, state)
              }}
            >
              Continue
            </button>
          ) : (
            <>
              {onPlayAgain && (
                <button
                  className="primary"
                  onClick={() => {
                    clearGame()
                    onPlayAgain()
                  }}
                >
                  Play again
                  <small>same seed</small>
                </button>
              )}
              {onNewGame && (
                <button
                  onClick={() => {
                    clearGame()
                    onNewGame()
                  }}
                >
                  New game
                </button>
              )}
              <button
                className="end-back"
                onClick={() => {
                  clearGame()
                  onExit()
                }}
              >
                Back to Title
              </button>
            </>
          )}
          <ShareResultButton
            withUrl={!dailyStrip}
            text={dailyStrip ? dailyShareText({ number: dailyStrip.number, layout: state.config.layout ?? 'ring' }, { won, rounds: state.result.round, regions: state.result.regionsLiberated, trust: state.publicTrust }, dailyStrip.streak, dailyStrip.layoutName) : `${won ? 'I liberated Marrow' : 'Marrow held out this time'} in Cathnivore: ${state.result.regionsLiberated} regions liberated in ${state.result.round} rounds, grade ${summary.grade} on ${state.config.difficulty}.`}
          />
        </div>
      </main>
    )
  }

  if (pendingMidScene && pendingTrigger) {
    return <Scene scene={pendingMidScene} chapterId={chapterId} onContinue={() => setDismissedMidScenes((d) => [...d, pendingTrigger.sceneId])} />
  }

  if (passDeviceFor) {
    return (
      <main className="scene pass-device">
        <Portrait character={passDeviceFor} size={96} />
        <h2>Pass the device</h2>
        <p>It's {PRODUCERS[passDeviceFor].name}'s turn.</p>
        <div className="pass-device-cath">
          <CathArt framing="face" expression="smirk" width={44} height={54} title="Cath" />
          <p>No peeking at the other hand. Tap when you've got the device.</p>
        </div>
        <button
          className="pass-device-ready"
          onClick={() => {
            passAckRef.current = passDeviceFor
            setPassDeviceFor(null)
          }}
        >
          I'm ready
        </button>
      </main>
    )
  }

  const rules = resolveRules(state)
  const decision = currentDecision(state)
  const aiProducer = aiProducerRef.current
  const waitingOnAi = decision && 'producer' in decision ? decision.producer === aiProducer : state.activeProducer === aiProducer
  const actions = waitingOnAi || pendingEnemyTurn.length > 0 ? [] : legalActions(state)
  // Plan item 141: on Easy and Normal Cath marks the move she'd play (HeuristicBot's pick, which is deterministic and
  // leaves the rng alone) with a leaf on its card and one line on why. Never on Hard, the Daily, the guided tutorial,
  // a forced decision, or autoplay; Settings can turn it off.
  let suggested: { index: number; why: string } | undefined
  if (
    actions.length > 1 &&
    !decision &&
    !autoplayRef.current &&
    !guidedActive &&
    state.config.difficulty !== 'hard' &&
    !state.config.daily &&
    loadSettings().suggestions
  ) {
    try {
      const [pick] = HeuristicBot.chooseAction(state, rngRef.current)
      const key = JSON.stringify(pick)
      const index = actions.findIndex((a) => JSON.stringify(a) === key)
      if (index >= 0) suggested = { index, why: reasonForAction(state, pick) }
    } catch {
      suggested = undefined
    }
  }
  const isSuggested = (indices: number[]) => (suggested && indices.includes(suggested.index) ? '' : undefined)
  // Keyed by the action itself, so a preview left over from before a move can't land on a different card.
  const actionKeys = actions.map((a) => JSON.stringify(a))
  const previewActions = (previewKeys ?? []).map((k) => actions[actionKeys.indexOf(k)]).filter((a): a is Action => !!a)
  let previewState: GameState | undefined
  const previewsOn = loadSettings().suggestions
  if (previewsOn && previewActions.length > 0 && !decision && !autoplayRef.current) {
    try {
      const next = applyAction(structuredClone(state), previewActions[0]!)
      // A move that ends the round would preview Hollowell's turn too; only same-round changes are shown.
      if (next.round === state.round && next.activeProducer === state.activeProducer) previewState = next
    } catch {
      previewState = undefined
    }
  }
  const previewRegions = previewActions.flatMap((a) => ('region' in a && a.region ? [a.region as RegionId] : []))
  const ghost = previewsOn && previewRegions.length > 0 ? { regions: [...new Set(previewRegions)], sign: previewActions[0]!.kind === 'openStall' ? ('+' as const) : ('-' as const) } : undefined
  const previewDelta = (f: (g: GameState) => number) => (previewState ? f(previewState) - f(state) : 0)
  const previewProps = (indices: number[]) => {
    const keys = indices.map((i) => actionKeys[i]!)
    return {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') setPreviewKeys(keys)
      },
      onPointerLeave: () => setPreviewKeys(null),
      onFocus: (e: React.FocusEvent) => {
        // Keyboard focus previews; a click's focus doesn't (the move is being made, not looked at).
        if ((e.target as HTMLElement).matches(':focus-visible')) setPreviewKeys(keys)
      },
      onBlur: () => setPreviewKeys(null),
      onContextMenu: (e: React.MouseEvent) => {
        // A long-press on a phone previews instead of opening the browser's menu.
        e.preventDefault()
        setPreviewKeys(keys)
      },
    }
  }
  // A skip lasts for the rest of the teammate's turn only.
  if (!waitingOnAi) skipTeammateRef.current = false
  const active = state.producers[state.activeProducer]

  // SPEC 8.1: "the first few steps are guided: only the action being taught is enabled." A step with a
  // highlight gates every action except a forced `decide` (never optional) and the one being taught,
  // either a specific action kind or any action targeting the highlighted region. Autoplay never reaches
  // this render path (it calls `legalActions` directly, see the AI-turn effect above), so it's unaffected.
  // If gating would leave nothing playable (a scripting mistake, or the player already cleared the taught
  // move some other way), fall back to the ungated list rather than stranding the player.
  // The prompt strip (chapters 2-6, and chapter 1 outside the guided tutorial) gates on `highlight`.
  const tutorialStep = !guided && !autoplayRef.current && tutorialSteps && tutorialIndex < tutorialSteps.length ? tutorialSteps[tutorialIndex] : undefined
  // The guided tutorial's hard gate: the panel offers only the action the script asks for now (or, on an
  // explain step, the one it asks for next, which `act` still refuses until its own step comes).
  const guidedOffer = guidedActive ? upcomingExpect(tutorialSteps!, tutorialIndex) : undefined
  function guidedAllows(a: Action): boolean {
    return !!guidedExpect && matchesExpect(guidedExpect, a)
  }
  // Every gated state hides the "why not" placeholders: only the action being taught shows.
  const gatedNow = !!tutorialStep?.highlight || guidedActive
  // Whether `a` is genuinely the action a highlight names — used both to gate and (separately, see `act`)
  // to decide whether taking `a` should advance the step. A pending `decide` is never a genuine match: it
  // only needs `tutorialAllows` below to bypass the gate so a forced choice is never blocked, not to be
  // mistaken for the taught action itself (a chapter with both a gated step and an unrelated pending
  // decision at once doesn't exist yet, but this keeps the two concerns from silently coupling).
  function matchesHighlight(a: Action): boolean {
    const highlight = tutorialStep?.highlight
    if (!highlight) return false
    return highlight.kind === 'action' ? a.kind === highlight.action : regionOf(a) === highlight.region
  }
  function tutorialAllows(a: Action): boolean {
    return !tutorialStep?.highlight || a.kind === 'decide' || matchesHighlight(a)
  }
  const allIndices = actions.map((_, i) => i)
  const gatedIndices = allIndices.filter((i) => tutorialAllows(actions[i]!))
  const visibleIndices = guidedActive
    ? allIndices.filter((i) => !!guidedOffer && matchesExpect(guidedOffer, actions[i]!))
    : gatedIndices.length > 0
      ? gatedIndices
      : allIndices

  // SPEC 10.2 targeting mode: group same-action-different-region choices into one button, then let the
  // player tap the glowing region on the map instead of reading N near-identical buttons.
  const standalone: { index: number; action: Action }[] = []
  const groups = new Map<string, { label: string; entries: { index: number; region: RegionId }[] }>()
  visibleIndices.forEach((index) => {
    const a = actions[index]!
    const region = regionOf(a)
    if (region === undefined) {
      standalone.push({ index, action: a })
      return
    }
    const key = actionGroupKey(a)
    const group = groups.get(key) ?? { label: actionGroupLabel(a, state), entries: [] }
    group.entries.push({ index, region })
    groups.set(key, group)
  })

  // ROADMAP 9 "clear disabled and why-not states": Sell's missing counts (Produce too low for 2 or 3)
  // get a disabled placeholder right where the real button would be, so a player learns *why* the full
  // 1-3 range isn't all offered instead of the count quietly shrinking with no explanation. Scoped to
  // Sell only for now, not every action: it's the one whose entire legality is a single resource
  // comparison, so the reason is never ambiguous the way it would be for e.g. Invest (not enough Marks,
  // no affordable card, or the rule not unlocked yet could all look the same from outside) — those stay
  // simply absent, as before, until a later session can give each kind its own real reason. Skipped
  // during a gated tutorial step: SPEC 8.1's "only the action being taught is enabled" already hides
  // everything else outright, and a disabled Sell row competing for attention there would muddy that.
  const sellEntries = standalone.filter((e) => e.action.kind === 'sell')
  const otherStandalone = standalone.filter((e) => e.action.kind !== 'sell' && e.action.kind !== 'invest')
  const investEntries = standalone.filter((e) => e.action.kind === 'invest')
  // Plan item 384: the Sell card's chosen count. It defaults to the count Cath suggests, else 1, and resets
  // whenever the turn's actions change (keyed by them), so a pick never carries into another turn.
  const sellKey = sellEntries.map((e) => actionKeys[e.index]).join('|') + `#${state.activeProducer}`
  const sellCard = (() => {
    if (sellEntries.length === 0) return undefined
    const countOf = (e: (typeof sellEntries)[number]) => (e.action as { count: 1 | 2 | 3 }).count
    const picked = sellPick && sellPick.key === sellKey ? sellEntries.find((e) => countOf(e) === sellPick.count) : undefined
    const chosen = picked ?? sellEntries.find((e) => isSuggested([e.index]) !== undefined) ?? sellEntries[0]!
    return { index: chosen.index, count: countOf(chosen) }
  })()
  const disabledSell: { count: 1 | 2 | 3; missing: number }[] = []
  if (rules.sell && !gatedNow && sellEntries.length === 0) {
    // Plan item 384: with no Produce at all the one Sell card waits on the shelf as a single strip.
    disabledSell.push({ count: 1, missing: 1 - active.resources.produce })
  }

  // ROADMAP 9 why-not, continued: Invest is the other action whose legality is a single resource
  // comparison per card (Marks vs. `investCost`), so — unlike Scheme/Supply/Rebut/Open Stall, whose
  // legality also depends on region/target state — each unaffordable market slot gets its own
  // unambiguous "Need N more Marks" placeholder, the same way each unaffordable Sell count does.
  const disabledInvest: { improvementId: string; cost: number; missing: number }[] = []
  if (rules.improvements && !gatedNow && !waitingOnAi && pendingEnemyTurn.length === 0) {
    for (const id of state.market) {
      if (!id) continue
      if (investEntries.some((e) => e.action.kind === 'invest' && e.action.improvementId === id)) continue
      const card = IMPROVEMENTS_BY_ID.get(id)
      if (!card) continue
      const cost = investCost(state, state.activeProducer, card)
      if (active.resources.marks < cost) disabledInvest.push({ improvementId: id, cost, missing: cost - active.resources.marks })
    }
  }

  // The same per-card "Need N more Marks" reason `disabledInvest` computes for the main action panel,
  // looked up by card id, for the Market sheet's own Buy-button-less cards to explain themselves too.
  const investMissingByCard = new Map(disabledInvest.map((d) => [d.improvementId, d.missing]))
  function missingMarks(improvementId: string): number | undefined {
    return investMissingByCard.get(improvementId)
  }

  // ROADMAP 9 why-not, continued: a Scheme with `targeting: 'none'` never needs a region (see
  // `legalSchemeTargets`), so its only legality condition is Goodwill vs. `schemeCost` — the same
  // single-comparison shape as Sell/Invest. An 'optional'-targeting Scheme turns out to have exactly the
  // same shape: `legalSchemeTargets` falls back to `[null]` (an untargeted play) whenever no real target
  // exists, so it's never hidden for "no legal target" the way a 'required' Scheme genuinely can be — only
  // for being unaffordable. `state.freeSchemePlays` makes the next Scheme played free regardless of cost,
  // so a card is only genuinely unaffordable when that's spent too.
  const disabledScheme: { schemeId: string; cost: number; missing: number }[] = []
  if (rules.schemes && !state.cathsPlanLocked && !gatedNow && !waitingOnAi && pendingEnemyTurn.length === 0) {
    for (const id of state.cathsPlan) {
      if (!id) continue
      const card = SCHEMES_BY_ID.get(id)
      if (!card || (card.targeting !== 'none' && card.targeting !== 'optional')) continue
      if (standalone.some((e) => e.action.kind === 'scheme' && e.action.schemeId === id)) continue
      if (groups.has(`scheme:${id}`)) continue
      if (state.freeSchemePlays > 0) continue
      const cost = schemeCost(state, state.activeProducer, card)
      if (active.resources.goodwill < cost) disabledScheme.push({ schemeId: id, cost, missing: cost - active.resources.goodwill })
    }
  }
  const schemeMissingByCard = new Map(disabledScheme.map((d) => [d.schemeId, d.missing]))
  function missingGoodwill(schemeId: string): number | undefined {
    return schemeMissingByCard.get(schemeId)
  }

  // ROADMAP 9 why-not, continued: Open Stall has exactly two legality checks in a fixed order — Produce
  // vs. its flat 1-Produce cost, then whether any active region is actually open to place one in
  // (`canOpenStallIn`: under the Stall cap, past the Kingsmarket guard, and adjacent to or holding one of
  // the producer's own Stalls). Unlike a 'required'/'optional' Scheme's single region check, both reasons
  // here are unambiguous to compute directly from state, so a real "every region is full or unreachable"
  // case now gets its own placeholder too, not just the Produce-0 case this used to be scoped to.
  const disabledOpenStall: { text: string } | undefined = (() => {
    if (gatedNow || waitingOnAi || pendingEnemyTurn.length > 0 || groups.has('openStall')) return undefined
    if (active.resources.produce < 1) return { text: 'Need 1 more Produce' }
    const anyLegalRegion = state.config.activeRegions.some((id) => canOpenStallIn(state, state.activeProducer, id))
    return anyLegalRegion ? undefined : { text: 'No region open to place a Stall' }
  })()

  // ROADMAP 9 why-not, continued: Supply and Rebut are per-region grouped actions (SPEC 10.2's targeting
  // mode highlights valid regions on the map rather than listing one button per region), but each kind's
  // legality is still just two checks in a fixed order — a structural one (is there an owned region with
  // something to remove at all: an Outlet, a Buyout, a Doubt) and then a resource comparison (Produce/
  // Goodwill vs. cost). Those two reasons are genuinely distinct, unlike a 'required'/'optional' Scheme's
  // single region check (a missing target there could mean several different things from outside) — so
  // they're worth surfacing instead of leaving the whole group silently absent, same spirit as Sell/
  // Invest/`targeting: 'none'` Scheme/Open Stall above.
  const whyNotGated = gatedNow || waitingOnAi || pendingEnemyTurn.length > 0
  function ownedRegionsWith(filter: (r: GameState['regions'][RegionId]) => boolean) {
    return state.config.activeRegions.map((id) => state.regions[id]).filter((r) => (r.stalls[state.activeProducer] ?? 0) > 0 && filter(r))
  }
  function whyNotSupplyOutlets(count: 1 | 2): { text: string; cost?: { resource: ResourceKind; amount: number } } | undefined {
    if (whyNotGated || groups.has(`supplyOutlets:${count}`)) return undefined
    const candidates = ownedRegionsWith((r) => r.outlets >= count)
    if (candidates.length === 0) return { text: `No Outlet${count > 1 ? 's' : ''} left to remove` }
    const minCost = Math.min(...candidates.map((r) => supplyOutletCostPerOutlet(state, state.activeProducer, r.id) * count))
    const missing = minCost - active.resources.produce
    return missing > 0 ? { text: `Need ${missing} more Produce`, cost: { resource: 'produce', amount: minCost } } : undefined
  }
  function whyNotSupplyBuyout(): { text: string; cost?: { resource: ResourceKind; amount: number } } | undefined {
    if (whyNotGated || groups.has('supplyBuyout')) return undefined
    const candidates = ownedRegionsWith((r) => r.buyouts >= 1 && regionStallTotal(r) >= 2)
    if (candidates.length === 0) return { text: 'No Buyout to remove' }
    const cost = supplyBuyoutCost(state, state.activeProducer)
    const missing = cost - active.resources.produce
    return missing > 0 ? { text: `Need ${missing} more Produce`, cost: { resource: 'produce', amount: cost } } : undefined
  }
  function whyNotRebut(count: 1 | 2): { text: string; cost?: { resource: ResourceKind; amount: number } } | undefined {
    if (whyNotGated || !rules.rebut || groups.has(`rebut:${count}`)) return undefined
    const candidates = ownedRegionsWith((r) => r.doubt >= count)
    if (candidates.length === 0) return { text: `No Doubt to rebut` }
    const cost = rebutCost(state, state.activeProducer, count)
    const missing = cost - active.resources.goodwill
    return missing > 0 ? { text: `Need ${missing} more Goodwill`, cost: { resource: 'goodwill', amount: cost } } : undefined
  }
  const disabledSupplyOutlets = ([1, 2] as const).map((count) => ({ count, reason: whyNotSupplyOutlets(count) })).filter((d) => d.reason)
  const disabledSupplyBuyoutReason = whyNotSupplyBuyout()
  const disabledRebut = ([1, 2] as const).map((count) => ({ count, reason: whyNotRebut(count) })).filter((d) => d.reason)
  // Plan item 149: how many cards sit face down at the end of the desktop hand (the column's 'Not yet' strips).
  const laterCount = () =>
    disabledSell.length +
    disabledInvest.length +
    disabledScheme.length +
    disabledSupplyOutlets.length +
    disabledRebut.length +
    (disabledOpenStall ? 1 : 0) +
    (disabledSupplyBuyoutReason && !groups.has('supplyBuyout') ? 1 : 0)

  function act(actionIndex: number): void {
    const action = actions[actionIndex]!
    // SPEC 8.1: once the taught action is actually taken, move straight to the next tutorial step rather
    // than waiting on a separate "Got it" tap — the gate above already guaranteed this action is the one
    // being taught (or gating had nothing to show, in which case there's nothing to advance past).
    if (guidedActive) {
      // The guided tutorial's hard gate, in code as well as on screen: only the step's own action runs.
      if (!guidedAllows(action)) return
      setTutorialIndex((i) => i + 1)
    } else if (matchesHighlight(action)) setTutorialIndex((i) => i + 1)
    undoStackRef.current = pushUndo(undoStackRef.current, state, action)
    // Plan item 83: the pressed card lifts and sets down toward the board (a buy has its own flight).
    const pressed = lastCardRef.current
    lastCardRef.current = null
    if (pressed && action.kind !== 'invest' && !autoplayRef.current && liftEnabled() && performance.now() - pressed.at < 15_000) {
      liftPlayedCard(pressed.el, liftTarget(regionOf(action)))
    }
    advance(state, action)
  }

  function endEnemyTurnPlayback(): void {
    setPendingEnemyTurn([])
    setTutorialIndex((i) => (guided && tutorialSteps?.[i]?.waitFor === 'enemyTurn' ? i + 1 : i))
  }

  // What Cath's card shows for the current guided step. An action step follows the action through its
  // phases: its button, then (targeting mode) the glowing region, then Confirm.
  function coachProps(step: TutorialStep): ComponentProps<typeof TutorialCoach> {
    const total = tutorialSteps!.length
    const base = { step: tutorialIndex + 1, total, why: step.why, onSkip: finishTutorial, onRules: () => setShowRulesFromTutorial(true) }
    const mode = stepMode(step)
    if (mode === 'action') {
      const region = step.expect!.region
      const phase = pendingChoice ? 'confirm' : selectedGroup ? 'region' : 'button'
      const text =
        phase === 'confirm'
          ? 'Tap Confirm. Nothing is spent until you do.'
          : phase === 'region' && region
            ? `Now tap ${REGIONS[region].name} on the map. It's the one glowing.`
            : step.text
      return { ...base, targetId: tutorialTargetId(step.target, phase, region), text }
    }
    if (mode === 'enemyTurn') {
      const showing = pendingEnemyTurn.length > 0
      return { ...base, targetId: showing ? tutorialTargetId(step.target) : null, text: step.text, nextLabel: 'Carry on', onNext: endEnemyTurnPlayback }
    }
    const last = tutorialIndex === total - 1
    return {
      ...base,
      targetId: tutorialTargetId(step.target),
      text: step.text,
      nextLabel: last ? 'Let me play' : 'Next',
      onNext: last ? finishTutorial : () => setTutorialIndex((i) => i + 1),
    }
  }

  // Guided tutorial: an action with a region always goes through the map (button, glowing region,
  // Confirm), even with only one region to choose, so the first round teaches targeting too.
  const forceTargeting = !!guidedOffer?.region
  function isGuidedTarget(a: Action): boolean {
    return !!guidedOffer && matchesExpect(guidedOffer, a)
  }

  function undo(): void {
    const popped = popUndo(undoStackRef.current)
    if (!popped) return
    undoStackRef.current = popped.stack
    setState(popped.state)
  }

  // The Market/Cath's Plan sheets (SPEC 10.2) offer a direct Buy/Play button for a card only when the
  // active human producer currently has a legal action for it, reusing the same `actions` this render
  // already computed rather than re-deriving legality.
  function canBuy(improvementId: string): boolean {
    return standalone.some(({ action: a }) => a.kind === 'invest' && a.improvementId === improvementId)
  }

  function buy(improvementId: string): void {
    const entry = standalone.find(({ action: a }) => a.kind === 'invest' && a.improvementId === improvementId)
    if (entry) {
      act(entry.index)
      setShowMarket(false)
    }
  }

  // A Scheme with no region choice is one standalone action; one needing a region lands in `groups` under
  // `scheme:<id>` — a single legal region there still resolves directly (matching the main action panel's
  // own single-entry-group behaviour), more than one opens the map's targeting mode instead.
  function canPlayScheme(schemeId: string): boolean {
    return (
      groups.has(`scheme:${schemeId}`) ||
      standalone.some(({ action: a }) => a.kind === 'scheme' && a.schemeId === schemeId)
    )
  }

  function playScheme(schemeId: string): void {
    const group = groups.get(`scheme:${schemeId}`)
    if (group) {
      if (group.entries.length === 1) act(group.entries[0]!.index)
      else {
        setPendingChoice(null)
        setSelectedGroup(group)
      }
      setShowPlan(false)
      return
    }
    const entry = standalone.find(({ action: a }) => a.kind === 'scheme' && a.schemeId === schemeId)
    if (entry) {
      act(entry.index)
      setShowPlan(false)
    }
  }

  // ROADMAP 8 "the table, part 1: layout": the action list used to render inside the centre `.game`
  // column, squeezed into an internally-scrolling 3-column grid at the bottom (see DECISIONS.md history).
  // Built once here as a value, not a component, so both places that can show it (the phone flow below and
  // the desktop left tray further down, alongside the Farm panel) read the exact same
  // `standalone`/`groups`/`selectedGroup` closures. `useIsDesktopLayout()` (above) mounts exactly one of the
  // two at a time — not both with CSS hiding one, which left a second `.actions`/`.action-item` permanently
  // in the DOM and broke every Playwright strict-mode locator that queried it (e2e/tooltip.spec.ts).
  // Plan item 33: the enemy turn plays in the Actions area (the dock on a phone, the Actions column on a
  // desktop), which has nothing to offer while it runs; over the map it clipped and covered hexes.
  const foldFarm = isDesktop && bigTurn === turnKey
  // Plan item 92: while the enemy turn plays, the map shows each step's change only once its step plays.
  const boardState =
    pendingEnemyTurn.length > 0 && enemyTurnBefore
      ? { ...state, regions: stagedRegions(enemyTurnBefore, state.regions, pendingEnemyTurn, enemyLanded + 1) }
      : state

  // Plan item 149: the cards this turn can play. On a big desktop they are a hand at the table's bottom edge
  // (`.table-hand`, under the map); elsewhere they lead the Actions list.
  const showHand = handOnTable && pendingEnemyTurn.length === 0 && !(waitingOnAi && teammatePick) && !selectedGroup
  const playableCardFaces = (
    <>
          {sellEntries.length > 0 && <span className="action-head" aria-hidden="true">Sell</span>}
          {sellCard && (() => {
            // Plan item 384: Sell is one barrow card with a 1-2-3 count on its face, not three near-identical cards.
            const { index, count } = sellCard
            const a = actions[index]!
            const term = actionTermFor(a)
            const leafIndex = sellEntries.find((e) => isSuggested([e.index]) !== undefined)
            const step = (dir: 1 | -1) => {
              const counts = sellEntries.map((e) => (e.action as { count: 1 | 2 | 3 }).count)
              const next = counts[counts.indexOf(count) + dir]
              if (next) setSellPick({ key: sellKey, count: next })
            }
            return (
              <span
                key="sell"
                className="action-item action-sell"
                data-group="sell"
                data-hand-card=""
                data-sell-count={count}
                data-suggested={leafIndex ? '' : undefined}
                {...previewProps([index])}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1)
                  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1)
                  else return
                  e.preventDefault()
                }}
              >
                <ActionButton action={a} state={state} sellCount onClick={() => act(index)} />
                <span className="sell-count" role="group" aria-label="How many Produce to sell">
                  {([1, 2, 3] as const).map((n) => {
                    const short = n - active.resources.produce
                    return (
                      <button
                        key={n}
                        type="button"
                        className="sell-count-pip"
                        aria-pressed={n === count}
                        aria-label={`${n} to sell`}
                        disabled={!sellEntries.some((e) => (e.action as { count: number }).count === n)}
                        title={short > 0 ? `Need ${short} more Produce` : undefined}
                        data-leaf={leafIndex && (leafIndex.action as { count: number }).count === n ? '' : undefined}
                        onClick={() => setSellPick({ key: sellKey, count: n })}
                      >
                        {n}
                      </button>
                    )
                  })}
                </span>
                {leafIndex && SUGGEST_LEAF}
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })()}
          {investEntries.length > 0 && <span className="action-head" aria-hidden="true">Invest</span>}
          {investEntries.map(({ index, action: a }, position) => {
            const term = actionTermFor(a)
            const Icon = ACTION_ICON[a.kind]
            return (
              <span
                key={index}
                data-group="invest"
                data-hand-card=""
                className={position === 0 && !suggested ? 'action-item action-recommended' : 'action-item'}
                data-buy-card={a.kind === 'invest' ? a.improvementId : undefined}
                data-goal-lift={a.kind === 'invest' && goalLift === investGoal(a.improvementId) ? '' : undefined}
                data-suggested={isSuggested([index])}
                {...previewProps([index])}
              >
                <ActionButton action={a} state={state} Icon={Icon} onClick={() => act(index)} />
                {isSuggested([index]) !== undefined && SUGGEST_LEAF}
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })}
          {(otherStandalone.length > 0 || groups.size > 0) && (sellEntries.length > 0 || investEntries.length > 0) && (
            <span className="action-head" aria-hidden="true">Play</span>
          )}
          {otherStandalone.map(({ index, action: a }) => {
            const term = actionTermFor(a)
            const Icon = ACTION_ICON[a.kind]
            return (
              <span
                key={index}
                className="action-item"
                data-group="play"
                data-hand-card=""
                data-suggested={isSuggested([index])}
                data-goal-lift={a.kind === 'scheme' && goalLift === schemeGoal(a.schemeId) ? '' : undefined}
                {...previewProps([index])}
              >
                <ActionButton action={a} state={state} Icon={Icon} tutorialTarget={isGuidedTarget(a)} onClick={() => act(index)} />
                {isSuggested([index]) !== undefined && SUGGEST_LEAF}
                {term && (
                  <Tooltip term={term} label={`What is ${term}?`}>
                    ?
                  </Tooltip>
                )}
              </span>
            )
          })}
          {(() => {
            // Plan item 83: a group's button (a region-target action), whole or as one option of a family card.
            const groupButton = (group: { label: string; entries: { index: number; region: RegionId }[] }, short?: string) => {
              const single = group.entries.length === 1
              const firstAction = actions[group.entries[0]!.index]!
              const cost = single ? actionCost(firstAction, state) : uniformGroupCost(group.entries, actions, state)
              const Icon = ACTION_ICON[firstAction.kind]
              const full = chipLabel(single ? actionLabel(firstAction, state) : `${group.label}…`, !!cost)
              // Plan item 83: a Role group shows its ability ("Injunction…"), as the standalone Role card does.
              const roleText = !short && firstAction.kind === 'role' ? `${PRODUCERS[state.activeProducer].roleName.split(', ').pop()}…` : undefined
              const cardText = !short && !roleText && single ? actionCardLabel(firstAction) : undefined
              // Plan item 103 follow-up: the scheme's painted tile already says Scheme, so the face names the card alone
              // ('Price War in Brindle…' was cut at 1280); the accessible name keeps 'Scheme: '.
              const text = short ?? roleText ?? cardText ?? full.text.replace(/^Scheme: /, '')
              // Plan item 160: a group that still needs a region ends in '…' in the column; the desktop hand's card
              // says so in words instead ('Pick a region' on its own line), so the card never reads as cut.
              const pick = !short && (!single || !!roleText) && /…$/.test(text)
              const pickLine = single ? `in ${REGIONS[group.entries[0]!.region].name}` : 'Pick a region'
              const face = pick ? text.replace(/( in)?…$/, '') : text
              const aria = full.aria ?? (pick || short || roleText || cardText || full.text.startsWith('Scheme: ') ? full.text : undefined)
              return (
                <button
                  aria-label={aria}
                  data-tutorial={isGuidedTarget(firstAction) ? 'action' : undefined}
                  className={short ? 'action-card-draggable action-option' : 'action-card-draggable'}
                  onPointerDown={(e) => {
                    if (guidedActive || e.button !== 0) return
                    dragRef.current = { x0: e.clientX, y0: e.clientY, moved: false, group }
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }}
                  onPointerMove={(e) => {
                    const d = dragRef.current
                    if (!d) return
                    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 12) return
                    d.moved = true
                    setDrag({ label: text, x: e.clientX, y: e.clientY, regions: d.group.entries.map((en) => en.region) })
                  }}
                  onPointerUp={(e) => {
                    const d = dragRef.current
                    dragRef.current = null
                    if (!d?.moved) return
                    dragClickGuard.current = true
                    setDrag(null)
                    const hex = document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest('.region-hex')).find(Boolean)
                    const region = hex?.getAttribute('data-tutorial')?.replace(/^region-/, '')
                    const entry = d.group.entries.find((en) => en.region === region)
                    if (entry) act(entry.index)
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null
                    setDrag(null)
                  }}
                  onClick={() => {
                    if (dragClickGuard.current) {
                      dragClickGuard.current = false
                      return
                    }
                    if (guidedActive && !guidedExpect) return
                    if (single && !forceTargeting) act(group.entries[0]!.index)
                    else setSelectedGroup(group)
                  }}
                >
                  <span className="action-label">
                    {!short && Icon && <Icon size={18} />}
                    {short ? text : face.includes('\u00a0· ') ? (
                      // Plan item 368: the region after the name ('Supply 1 Outlet · Brindle Hills') is its own span, so the
                      // phone counter's narrow card can set it on a small line of its own, as a pick line.
                      <>
                        <BuyVerb text={face.slice(0, face.indexOf('\u00a0· '))} />
                        <span className="action-region">
                          <span className="action-region-dot">{'\u00a0· '}</span>
                          {face.slice(face.indexOf('\u00a0· ') + 3)}
                        </span>
                      </>
                    ) : (
                      <BuyVerb text={face} />
                    )}
                    {pick && (
                      <>
                        <span className="action-more" aria-hidden="true">…</span>
                        <span className="action-pick" aria-hidden="true">{pickLine}</span>
                      </>
                    )}
                  </span>
                  {!short && firstAction.kind === 'role' && !cost ? ROLE_FREE_CHIP : <ActionCostChip cost={cost} />}
                </button>
              )
            }
            // Plan item 83: Supply's three removals and Rebut's two are one card each with their options as keys,
            // so a big turn's Play group is a few rich cards rather than a column of near-identical rows.
            const rendered = new Set<string>()
            const keys = [...groups.keys()]
            return keys.map((key) => {
              if (rendered.has(key)) return null
              const group = groups.get(key)!
              const family = actionFamily(key)
              const members = family ? keys.filter((k) => actionFamily(k) === family) : []
              const firstAction = actions[group.entries[0]!.index]!
              const term = actionTermFor(firstAction)
              if (family && members.length > 1) {
                members.forEach((k) => rendered.add(k))
                const regions = new Set(members.flatMap((k) => groups.get(k)!.entries.map((e) => e.region)))
                const oneRegion = regions.size === 1 && members.every((k) => groups.get(k)!.entries.length === 1) ? [...regions][0]! : undefined
                const Icon = ACTION_ICON[firstAction.kind]
                const name = family === 'supply' ? 'Supply' : 'Rebut'
                return (
                  <span
                    key={`family-${family}`}
                    className="action-item action-family"
                    data-group="play" data-hand-card=""
                    data-family={family}
                    data-suggested={isSuggested(members.flatMap((k) => groups.get(k)!.entries.map((e) => e.index)))}
                    role="group"
                    {...previewProps(members.flatMap((k) => groups.get(k)!.entries.map((e) => e.index)))}
                    aria-label={oneRegion ? `${name} in ${REGIONS[oneRegion].name}` : name}
                  >
                    {isSuggested(members.flatMap((k) => groups.get(k)!.entries.map((e) => e.index))) !== undefined && SUGGEST_LEAF}
                    <span className="action-family-name" aria-hidden="true">
                      {Icon && <Icon size={18} />}
                      <span className="action-family-text">
                        {name}
                        {oneRegion && <span className="action-family-where">{REGIONS[oneRegion].name}</span>}
                      </span>
                    </span>
                    <span className="action-family-options">
                      {members.map((k) => (
                        <span key={k} className="action-family-option">
                          {groupButton(groups.get(k)!, familyOptionLabel(k))}
                        </span>
                      ))}
                    </span>
                    {term && (
                      <Tooltip term={term} label={`What is ${term}?`}>
                        ?
                      </Tooltip>
                    )}
                  </span>
                )
              }
              return (
                <span key={key} className="action-item" data-group="play" data-hand-card="" data-suggested={isSuggested(group.entries.map((e) => e.index))} {...previewProps(group.entries.map((e) => e.index))}>
                  {groupButton(group)}
                  {isSuggested(group.entries.map((e) => e.index)) !== undefined && SUGGEST_LEAF}
                  {term && (
                    <Tooltip term={term} label={`What is ${term}?`}>
                      ?
                    </Tooltip>
                  )}
                </span>
              )
            })
          })()}
    </>
  )
  const playableCards = <RoleProducerContext.Provider value={state.activeProducer}>{playableCardFaces}</RoleProducerContext.Provider>

  // Plan item 167: on a big desktop what can't be played yet is a shelf of small cards, each with its picture.
  const shelf = handOnTable && isDesktop
  const shelfPic = (art: ReactNode) => (shelf ? <span className="later-pic" aria-hidden="true">{art}</span> : null)
  // Plan item 183: the shelf folds to one row (the pinned goal first); each card counts its place as it renders.
  const goal = savingFor[state.activeProducer]
  let shelfCount = 0
  const laterIdx = () => (shelf ? shelfCount++ : undefined)
  const pinnedInvest = shelf && goal ? disabledInvest.find((d) => investGoal(d.improvementId) === goal) : undefined
  const pinnedScheme = shelf && goal && !pinnedInvest ? disabledScheme.find((d) => schemeGoal(d.schemeId) === goal) : undefined
  // How far the goal is, for Cath's line (on every layout), and whether it can be played now.
  const goalEntry = goal ? (disabledInvest.find((d) => investGoal(d.improvementId) === goal) ?? disabledScheme.find((d) => schemeGoal(d.schemeId) === goal)) : undefined
  const goalShort = goalEntry?.missing
  const jarArt = (
    <svg viewBox="0 0 24 30" aria-hidden="true">
      <rect className="jar-lid" x="6" y="1" width="12" height="4" rx="1.2" />
      <path className="jar-glass" d="M7 5h10v2.5c2.6 1 4 3.2 4 6V25a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V13.5c0-2.8 1.4-5 4-6Z" />
      <rect className="jar-fill" x="4" y="9" width="16" height="18" rx="2" />
      <path className="jar-shine" d="M6.5 12.5v10" />
    </svg>
  )
  // Plan item 183: on a phone the goal is a chip on the mat row (the shelf's jar, with its count).
  const goalChipCard = goal && goalEntry ? goalCard(goal) : undefined
  const goalChip =
    goal && goalEntry && goalChipCard && !shelf ? (
      <span
        className="goal-chip saving-jar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={goalEntry.cost}
        aria-valuenow={Math.max(0, goalEntry.cost - goalEntry.missing)}
        aria-label={`Saving for ${goalChipCard.name}: ${Math.max(0, goalEntry.cost - goalEntry.missing)} of ${goalEntry.cost} ${goalChipCard.coin}`}
        data-coin={goalChipCard.coin === 'Marks' ? 'marks' : 'goodwill'}
        style={{ ['--jar' as string]: String(Math.min(1, (goalEntry.cost - goalEntry.missing) / Math.max(1, goalEntry.cost))) }}
      >
        {jarArt}
        <span className="jar-count">
          {Math.max(0, goalEntry.cost - goalEntry.missing)}/{goalEntry.cost}
        </span>
      </span>
    ) : null
  const togglePin = (key: string) =>
    setSavingFor((cur) => {
      const next = { ...cur }
      if (next[state.activeProducer] === key) delete next[state.activeProducer]
      else next[state.activeProducer] = key
      return next
    })
  // The pin and, on the pinned card, the jar: the coins held toward its price.
  // Plan item 263: on the desktop shelf a priced card shows how far its price is met as a row of coins (filled for
  // those held) and a count, not a red 'Need N more' sentence; a card it is already met for lights its tag.
  const shelfMeter = (name: string, cost: number, missing: number, coin: 'marks' | 'goodwill') => {
    if (!shelf) return null
    const have = Math.max(0, cost - missing)
    const pips = Math.min(cost, 8)
    const lit = Math.round((have / Math.max(1, cost)) * pips)
    return (
      <span
        className="shelf-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={cost}
        aria-valuenow={have}
        aria-label={`${name}: ${have} of ${cost} ${coin === 'marks' ? 'Marks' : 'Goodwill'}`}
        data-coin={coin}
      >
        <span className="shelf-pips" aria-hidden="true">
          {Array.from({ length: pips }, (_, i) => (
            <i key={i} className={i < lit ? 'is-held' : undefined} />
          ))}
        </span>
        <span className="shelf-count" aria-hidden="true">
          {have}/{cost}
        </span>
      </span>
    )
  }
  const shelfGoalBits = (key: string, cost: number, missing: number) => {
    const card = goalCard(key)
    if (!card) return null
    const pinned = goal === key
    const have = Math.max(0, cost - missing)
    return (
      <>
        <button
          type="button"
          className="shelf-pin"
          aria-pressed={pinned}
          aria-label={pinned ? `Stop saving for ${card.name}` : `Save for ${card.name}`}
          title={pinned ? 'Saving for this' : 'Save for this'}
          onClick={() => togglePin(key)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5c-2.3 0-4 1.6-4 3.8 0 2.9 4 7.7 4 7.7s4-4.8 4-7.7c0-2.2-1.7-3.8-4-3.8Z" />
            <circle cx="8" cy="5.4" r="1.5" />
          </svg>
        </button>
        {pinned && shelf && (
          <span
            className="saving-jar"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={cost}
            aria-valuenow={have}
            aria-label={`Saving for ${card.name}: ${have} of ${cost} ${card.coin}`}
            data-coin={card.coin === 'Marks' ? 'marks' : 'goodwill'}
            style={{ ['--jar' as string]: String(Math.min(1, have / Math.max(1, cost))) }}
          >
            {jarArt}
            <span className="jar-count">
              {have}/{cost}
            </span>
          </span>
        )}
      </>
    )
  }
  const investLater = ({ improvementId, cost, missing }: (typeof disabledInvest)[number]) => {
            const card = IMPROVEMENTS_BY_ID.get(improvementId)
            if (!card) return null
            const key = investGoal(improvementId)
            return (
              <span
                key={`disabled-invest-${improvementId}`}
                className="action-item action-invest"
                data-later-idx={laterIdx()}
                data-saving-goal={goal === key ? '' : undefined}
                data-affordable={missing <= 0 ? 'true' : 'false'}
              >
                <button
                  disabled
                  title={`Need ${missing} more ${missing === 1 ? 'Mark' : 'Marks'}`}
                  aria-label={`Invest: buy ${card.name} (${plural(cost, 'Mark')}). Need ${missing} more ${missing === 1 ? 'Mark' : 'Marks'}`}
                >
                  {shelfPic(<Vignette kind={vignetteFor(card)} seed={card.id} />)}
                  <span className="action-label-group">
                    <span className="action-label">
                      <InvestArt size={18} />
                      <BuyVerb text={`Buy ${card.name}`} />
                    </span>
                    <WhyNot text={`Need ${missing} more ${missing === 1 ? 'Mark' : 'Marks'}`} />
                  </span>
                  {shelfMeter(card.name, cost, missing, 'marks')}
                  <ActionCostChip cost={{ resource: 'marks', amount: cost }} />
                </button>
                <Tooltip term="Invest" label="What is Invest?">
                  ?
                </Tooltip>
                {shelfGoalBits(key, cost, missing)}
              </span>
            )
          }
  const schemeLater = ({ schemeId, cost, missing }: (typeof disabledScheme)[number]) => {
            const card = SCHEMES_BY_ID.get(schemeId)
            if (!card) return null
            return (
              <span
                key={`disabled-scheme-${schemeId}`}
                className="action-item"
                data-later-idx={laterIdx()}
                data-saving-goal={goal === schemeGoal(schemeId) ? '' : undefined}
                data-affordable={missing <= 0 ? 'true' : 'false'}
              >
                <button disabled title={`Need ${missing} more Goodwill`}>
                  {shelfPic(<SchemeArt size={56} />)}
                  <span className="action-label-group">
                    <span className="action-label">
                      <SchemeArt size={18} />
                      {/* Plan item 104: the picture says Scheme; the word stays for screen readers. */}
                      <span className="visually-hidden">Scheme: </span>
                      {card.name}
                    </span>
                    <WhyNot text={`Need ${missing} more Goodwill`} />
                  </span>
                  {shelfMeter(card.name, cost, missing, 'goodwill')}
                  <ActionCostChip cost={{ resource: 'goodwill', amount: cost }} />
                </button>
                <Tooltip term="Scheme" label="What is Scheme?">
                  ?
                </Tooltip>
                {shelfGoalBits(schemeGoal(schemeId), cost, missing)}
              </span>
            )
          }
  // Plan item 225: Cath's suggestion, one line in her voice. On a desktop with her at the table it speaks from her
  // bubble there (one Cath voice on screen), elsewhere from the top of the actions.
  const suggestBody = suggested ? (
            <>
              {SUGGEST_LEAF}
              <span>
                <b>Cath:</b> I&rsquo;d play the leaf, love. {suggested.why}
                {goal && goalShort !== undefined && goalCard(goal) && (
                  <span data-goal-line="">
                    {` Still saving for ${goalCard(goal)!.name}: ${goalShort} more ${goalShort === 1 && goalCard(goal)!.coin === 'Marks' ? 'Mark' : goalCard(goal)!.coin} to go.`}
                  </span>
                )}
                {goalLift && goalCard(goalLift) && <span data-goal-line="">{` And ${goalCard(goalLift)!.name}'s paid for: it's in your hand.`}</span>}
              </span>
            </>
  ) : null
  const suggestLine = suggestBody && (
            <p className="suggest-line voice" data-testid="suggest-line">
              {suggestBody}
            </p>
  )
  const actionsPanel = (
    <div className="actions-well">
      <section
        className="actions"
        data-shelf={shelf ? '' : undefined}
        data-shelf-open={shelf && shelfOpen ? '' : undefined}
        data-saving-for={goal}
        tabIndex={0}
        role="region"
        aria-label="Actions"
        data-scroll-cue=""
        onClickCapture={(e) => {
          // Plan item 83: remember which card was pressed, so act() can lift it toward the board.
          const card = (e.target as Element).closest?.('.action-item > button:first-child, .action-family-option > button')
          if (card instanceof HTMLElement && !(card as HTMLButtonElement).disabled) lastCardRef.current = { el: card, at: performance.now() }
        }}
      >
      {pendingEnemyTurn.length > 0 ? (
        <EnemyTurnPlayback
          events={pendingEnemyTurn}
          onStep={(region, event, step) => {
            setEnemyStepRegion(region)
            setEnemyStep({ event, step })
            // The step before has landed by now; this one lands with its flight (at once if nothing flies).
            clearTimeout(landTimerRef.current)
            setEnemyLanded(step - 1)
            if (event && flightsFor(event).length > 0) landTimerRef.current = setTimeout(() => setEnemyLanded((l) => Math.max(l, step)), FLIGHT_LAND_MS)
            else setEnemyLanded(step)
            const cue = event && eventCue(event)
            if (cue) playCues([cue])
          }}
          // The guided tutorial holds each caption until it has been read (and its step moves on with it).
          hold={guidedStep?.waitFor === 'enemyTurn'}
          onDone={endEnemyTurnPlayback}
        />
      ) : waitingOnAi && teammatePick ? (
        // Plan item 34: the pick is lifted as a card with their reason before it lands; a tap skips the rest.
        <div
          className="teammate-pick"
          role="status"
          data-teammate-step={teammatePick.reason}
          style={{ ['--pick' as string]: `var(--p-${state.activeProducer})` }}
          onClick={() => {
            skipTeammateRef.current = true
            commitTeammatePick()
          }}
        >
          <span className={`producer-cameo pc-${state.activeProducer}`} key={`face-${teammatePick.reason}`}>
            <Portrait character={state.activeProducer} size={88} expression={pickExpression(teammatePick.action, teammatePick.reason)} />
          </span>
          <span className="teammate-pick-body">
            <strong>{PRODUCERS[state.activeProducer].name}</strong>
            <span className="teammate-card" key={`card-${teammatePick.from.log.length}`}>
              <span className="teammate-card-name">{actionLabel(teammatePick.action, teammatePick.from)}</span>
              <q className="teammate-card-reason">{teammatePick.reason}</q>
            </span>
            {/* Their turn as a ledger: moves made ticked off, this one lit, the rest to come. */}
            <ol className="boardroom-ledger teammate-ledger" aria-label={`${PRODUCERS[state.activeProducer].name}'s turn`}>
              {(teammateTurn.turn === `${teammatePick.from.round}:${teammatePick.from.activeProducer}` ? teammateTurn.labels : []).map((label, i) => (
                <li key={i} className="done">
                  <span>{label}</span>
                </li>
              ))}
              <li className="now">
                <span>{actionLabel(teammatePick.action, teammatePick.from)}</span>
              </li>
              {Array.from({ length: Math.max(0, teammatePick.from.actionsLeft - (teammatePick.action.kind === 'decide' ? 0 : 1)) }, (_, i) => (
                <li key={`next-${i}`} className="next">
                  <span>Still to come</span>
                </li>
              ))}
            </ol>
            <span className="teammate-pick-hint">
              Tap to skip the rest of their turn
            </span>
          </span>
        </div>
      ) : waitingOnAi ? (
        // Plan item 47: between picks their seat is staged like a pick (the D Actions panel was 560 px of blank
        // cream under one line): their face, a card they are still weighing up, and their turn as a ledger.
        <div
          className="teammate-pick teammate-pick-thinking"
          role="status"
          style={{ ['--pick' as string]: `var(--p-${state.activeProducer})` }}
          onClick={() => {
            skipTeammateRef.current = true
          }}
        >
          <span className={`producer-cameo pc-${state.activeProducer}`}>
            <Portrait character={state.activeProducer} size={88} expression="determined" />
          </span>
          <span className="teammate-pick-body">
            <strong>{PRODUCERS[state.activeProducer].name}</strong>
            <span className="teammate-card teammate-card-thinking">
              <span className="teammate-card-name teammate-thinking-line">
                is weighing up their move
                <span className="thinking-dots" aria-hidden="true">
                  <i>.</i>
                  <i>.</i>
                  <i>.</i>
                </span>
              </span>
            </span>
            <ol className="boardroom-ledger teammate-ledger" aria-label={`${PRODUCERS[state.activeProducer].name}'s turn`}>
              {(teammateTurn.turn === `${state.round}:${state.activeProducer}` ? teammateTurn.labels : []).map((label, i) => (
                <li key={i} className="done">
                  <span>{label}</span>
                </li>
              ))}
              {Array.from({ length: Math.max(0, state.actionsLeft) }, (_, i) => (
                <li key={`next-${i}`} className={i === 0 ? 'now' : 'next'}>
                  <span>{i === 0 ? 'Thinking it over' : 'Still to come'}</span>
                </li>
              ))}
            </ol>
            {/* Plan item 62: while they think, their stall: what they have built so far. */}
            {state.producers[state.activeProducer].improvements.length > 0 && (
              <span className="teammate-stall">
                <Stall producer={state.activeProducer} improvements={state.producers[state.activeProducer].improvements} production={state.producers[state.activeProducer].production} />
              </span>
            )}
            <span className="teammate-pick-hint">Tap to skip the rest of their turn</span>
          </span>
        </div>
      ) : selectedGroup ? (
        pendingChoice ? (
          <>
            <p>{selectedGroup.label} in {REGIONS[pendingChoice.region].name}?</p>
            <button className="primary" data-tutorial="confirm" onClick={() => act(pendingChoice.index)}>Confirm</button>
            <button onClick={() => setPendingChoice(null)}>Cancel</button>
          </>
        ) : (
          <>
            <p className="action-raised">
              <span className="action-raised-name">{selectedGroup.label}</span>
              <span className="action-raised-hint">Tap a glowing region, or drag the card onto one.</span>
            </p>
            <button onClick={() => setSelectedGroup(null)}>Cancel</button>
          </>
        )
      ) : (
        <>
          {!(handOnTable && bubbleSuggest) && suggestLine}
          {/* Plan item 320: on a phone too each playable card's picture is its painted window, full-bleed over the face's top half. */}
          {!handOnTable && (isDesktop ? playableCards : <ArtSceneContext.Provider value="wide">{playableCards}</ArtSceneContext.Provider>)}
          {/* Plan item 83: what this turn can play comes first; what it can't afford yet follows as priced strips. */}
          {disabledSell.length + disabledInvest.length + disabledScheme.length + disabledSupplyOutlets.length + disabledRebut.length > 0 ||
          disabledOpenStall ||
          (disabledSupplyBuyoutReason && !groups.has('supplyBuyout')) ? (
            <span className="action-head action-head-later" aria-hidden="true">
              {/* Plan item 225: with the hand on the table the rail's shelf is what she is saving for. */}
              {handOnTable || !isDesktop ? 'Saving for' : 'Not yet'}
            </span>
          ) : null}
          {pinnedInvest && investLater(pinnedInvest)}
          {pinnedScheme && schemeLater(pinnedScheme)}
          {disabledSell.map(({ count, missing }) => (
            <span key={`disabled-sell-${count}`} className="action-item" data-later-idx={laterIdx()}>
              <button disabled title={`Need ${missing} more Produce`}>
                {shelfPic(<SellArt size={44} count={count} />)}
                <span className="action-label-group">
                  <span className="action-label">
                    <SellArt size={18} count={count} />
                    {`Sell ${count} Produce`}
                    <span className="visually-hidden">{` for ${count} ${count === 1 ? 'Mark' : 'Marks'}`}</span>
                  </span>
                  <WhyNot text={`Need ${missing} more Produce`} />
                </span>
                <SellGainChip count={count} />
              </button>
              <Tooltip term="Sell" label="What is Sell?">
                ?
              </Tooltip>
            </span>
          ))}
          {disabledInvest.filter((d) => d !== pinnedInvest).map(investLater)}
          {disabledScheme.filter((d) => d !== pinnedScheme).map(schemeLater)}
          {disabledOpenStall && (
            <span className="action-item" data-later-idx={laterIdx()}>
              <button disabled title={disabledOpenStall.text}>
                {shelfPic(<OpenStallArt size={44} />)}
                <span className="action-label-group">
                  <span className="action-label">
                    <OpenStallArt size={18} />
                    Open Stall
                  </span>
                  <WhyNot text={disabledOpenStall.text} />
                </span>
                {disabledOpenStall.text.startsWith('Need') && <ActionCostChip cost={{ resource: 'produce', amount: 1 }} />}
              </button>
              <Tooltip term="Open Stall" label="What is Open Stall?">
                ?
              </Tooltip>
            </span>
          )}
          {disabledSupplyOutlets.map(({ count, reason }) => (
            <span key={`disabled-supply-outlets-${count}`} className="action-item" data-later-idx={laterIdx()}>
              <button disabled title={reason!.text}>
                {shelfPic(<SupplyArt size={44} />)}
                <span className="action-label-group">
                  <span className="action-label">
                    <SupplyArt size={18} />
                    {`Supply: remove ${count} Outlet${count > 1 ? 's' : ''}`}
                  </span>
                  <WhyNot text={reason!.text} />
                </span>
                {reason!.cost && <ActionCostChip cost={reason!.cost} />}
              </button>
              <Tooltip term="Supply" label="What is Supply?">
                ?
              </Tooltip>
            </span>
          ))}
          {disabledSupplyBuyoutReason && !groups.has('supplyBuyout') && (
            <span className="action-item" data-later-idx={laterIdx()}>
              <button disabled title={disabledSupplyBuyoutReason.text}>
                {shelfPic(<SupplyArt size={44} />)}
                <span className="action-label-group">
                  <span className="action-label">
                    <SupplyArt size={18} />
                    Supply: remove Buyout
                  </span>
                  <WhyNot text={disabledSupplyBuyoutReason.text} />
                </span>
                {disabledSupplyBuyoutReason.cost && <ActionCostChip cost={disabledSupplyBuyoutReason.cost} />}
              </button>
              <Tooltip term="Supply" label="What is Supply?">
                ?
              </Tooltip>
            </span>
          )}
          {disabledRebut.map(({ count, reason }) => (
            <span key={`disabled-rebut-${count}`} className="action-item" data-later-idx={laterIdx()}>
              <button disabled title={reason!.text}>
                {shelfPic(<RebutArt size={44} />)}
                <span className="action-label-group">
                  <span className="action-label">
                    <RebutArt size={18} />
                    {`Rebut: remove ${count} Doubt`}
                  </span>
                  <WhyNot text={reason!.text} />
                </span>
                {reason!.cost && <ActionCostChip cost={reason!.cost} />}
              </button>
              <Tooltip term="Rebut" label="What is Rebut?">
                ?
              </Tooltip>
            </span>
          ))}
          {/* Plan item 183: one row of the shelf shows; the rest wait behind this key. */}
          {shelf && shelfCount > 3 && (
            <button type="button" className="shelf-fold" aria-expanded={shelfOpen} onClick={() => setShelfOpen((o) => !o)}>
              {shelfOpen ? 'Fold the shelf' : `${shelfCount - 3} more not yet`}
            </button>
          )}
        </>
      )}
    </section>
    </div>
  )

  // SPEC 10.3 desktop 3-column layout (1024px+): both producers' Farms on the left, the map/plan strip in
  // the centre, actions/Market/Cath's Plan/Log on the right, always visible (no scrolling at 1280x800).
  // `.desktop-*` panels reuse the same sheet components in `inline` mode and are shown only above 1024px
  // via CSS; below that the phone layout's toggle buttons and modal sheets (below) still work unchanged.
  // ROADMAP 8, the owner's chat session 2026-09-30: the active producer's panel and the Undo/sheet controls
  // live next to the actions they belong to: in the left tray on desktop (freeing the centre column for
  // the map), in the pinned action tray on phone. Mounted exactly once, like `actionsPanel`.
  const mat = handOnTable && isDesktop
  const producerPanel = (
    <>
      {decision ? (
        <section className="decision">
          <p>
            {decision.kind === 'kingsmarketBonus' && `${PRODUCERS[decision.producer].name}: choose a production bonus`}
            {decision.kind === 'squeezeProductionLoss' && `${PRODUCERS[decision.producer].name}: choose which production to lower`}
            {decision.kind === 'riftSplitFaction' && 'Rift 6, The Split: choose which faction to split'}
            {decision.kind === 'riftSplitRemoval' &&
              `Rift 6, The Split: choose where to remove a ${decision.pieceKind === 'doubt' ? 'Doubt' : decision.pieceKind === 'buyout' ? 'Buyout' : 'Outlet'} from (${decision.remaining + 1} left)`}
          </p>
        </section>
      ) : (
        <section className="active-producer" data-seat={handOnTable && isDesktop ? '' : undefined}>
          {/* Plan item 154: on a big desktop the frame is the active producer's seat at the table: their portrait
              large in a painted chair-back, the action tokens and resources beside them. */}
          {handOnTable && isDesktop && (
            <span className={`producer-seat pc-${state.activeProducer}`} data-seat-producer={state.activeProducer} data-expression={faceExpression(producerFaces[state.activeProducer]) ?? 'neutral'} aria-hidden="true">
              <Portrait character={state.activeProducer} size={150} expression={faceExpression(producerFaces[state.activeProducer])} />
            </span>
          )}
          <span className="active-producer-header">
            <span className={`producer-cameo pc-${state.activeProducer}`}>
              <Portrait character={state.activeProducer} size={48} expression={faceExpression(producerFaces[state.activeProducer])} />
            </span>
            <strong>{PRODUCERS[state.activeProducer].name}</strong>
            {/* Plan item 62: on a phone, the last three things she bought as crates on a little plank, opening
                the Farm sheet's whole stall. */}
            {active.improvements.length > 0 && (
              <button className="mobile-only stall-strip" onClick={() => setShowFarm(true)} aria-label={`${PRODUCERS[state.activeProducer].name}'s stall: ${active.improvements.length} Improvements. Open the Farm`}>
                {active.improvements.slice(-3).map((id) => {
                  const card = IMPROVEMENTS_BY_ID.get(id)
                  return card ? (
                    <span key={id} className="stall-item stall-strip-item" data-tag={card.tags[0]} data-card={id}>
                      <Vignette kind={vignetteFor(card)} seed={card.id} />
                    </span>
                  ) : null
                })}
                {active.improvements.length > 3 && <b className="stall-strip-more">+{active.improvements.length - 3}</b>}
              </button>
            )}
          </span>
          {/* Plan item 167: on a big desktop the ledger is the producer's player mat: a crate, a coin stack and a
              rosette on a wooden board, each with its count and this round's income. */}
          <span className={mat ? 'ledger player-mat' : 'ledger'} data-player-mat={mat ? '' : undefined}>
            <LedgerChip term="Produce" Icon={ProduceIcon} value={active.resources.produce} income={active.production.produce} tick={produceTick} incomeTick={produceIncomeTick} tutorial="produce" delta={previewDelta((g) => g.producers[g.activeProducer].resources.produce)} art={mat ? <MatCrate count={active.resources.produce} /> : undefined} />
            <LedgerChip term="Marks" Icon={MarksIcon} value={active.resources.marks} income={active.production.marks} tick={marksTick} incomeTick={marksIncomeTick} delta={previewDelta((g) => g.producers[g.activeProducer].resources.marks)} art={mat ? <MatCoins count={active.resources.marks} /> : undefined} />
            <LedgerChip term="Goodwill" Icon={GoodwillIcon} value={active.resources.goodwill} income={active.production.goodwill} tick={goodwillTick} incomeTick={goodwillIncomeTick} tutorial="goodwill" delta={previewDelta((g) => g.producers[g.activeProducer].resources.goodwill)} art={mat ? <MatRosette count={active.resources.goodwill} /> : undefined} />
          </span>
          <span className="pips" data-tutorial="actions-left" role="img" aria-label={`Actions left: ${state.actionsLeft} of ${ACTIONS_PER_ROUND}`}>
            <span className="pips-label">Actions</span>
            {Array.from({ length: ACTIONS_PER_ROUND }, (_, i) => (
              <i key={i} className={i < state.actionsLeft ? 'pip on' : 'pip'} />
            ))}
          </span>
          {goalChip}
        </section>
      )}
    </>
  )
  // AAA UI M4 4.3: on a phone the controls are a tab rail on a kraft strip, Undo as a round key on its
  // left; on desktop only Undo shows, at the foot of the Actions frame. The visible words stay the
  // accessible names ("Undo", "Farm", "Market", "Cath's Plan", "Log").
  const controls = (
    <footer className="controls">
      <button
        className="rail-undo"
        disabled={!canUndo(undoStackRef.current) || pendingEnemyTurn.length > 0 || waitingOnAi || guidedActive}
        onClick={undo}
      >
        <UndoIcon size={22} />
        <span className="rail-undo-text">Undo</span>
        {/* Plan item 196: on a desktop Undo is a rubber stamp that voids the last line on the ledger's receipt. */}
        <span className="rail-undo-void" aria-hidden="true">Void</span>
      </button>
      <button
        className={`${foldFarm ? 'rail-tab rail-tab-farm' : 'mobile-only rail-tab rail-tab-farm'}${showFarm ? ' is-open' : ''}`}
        onClick={() => setShowFarm(true)}
      >
        <FarmIcon />
        <span>Farm</span>
        {/* Plan item 62: on a narrow phone the stall's newest crate rides the Farm tab, with how many she owns. */}
        {active.improvements.length > 0 && (
          <span className="rail-tab-stall" aria-hidden="true">
            {(() => {
              const card = IMPROVEMENTS_BY_ID.get(active.improvements.at(-1)!)
              return card ? (
                <span className="stall-item rail-tab-crate" data-tag={card.tags[0]}>
                  <Vignette kind={vignetteFor(card)} seed={card.id} />
                </span>
              ) : null
            })()}
            <b>{active.improvements.length}</b>
          </span>
        )}
      </button>
      {rules.improvements && (
        <button className={showMarket ? 'mobile-only rail-tab is-open' : 'mobile-only rail-tab'} onClick={() => setShowMarket(true)}>
          <MarketIcon />
          <span>Market</span>
        </button>
      )}
      {rules.schemes && (
        <button
          className={showPlan ? 'mobile-only rail-tab is-open' : 'mobile-only rail-tab'}
          aria-label={'Cath\u2019s Plan'}
          onClick={() => setShowPlan(true)}
        >
          <PlanIcon />
          <span aria-hidden="true">Plan</span>
        </button>
      )}
      <button className={showLog ? 'mobile-only rail-tab is-open' : 'mobile-only rail-tab'} onClick={() => setShowLog(true)}>
        <LogIcon />
        <span>Log</span>
      </button>
    </footer>
  )

  return (
    // Gate 7: the wide left column for a big turn is an attribute here, not a `:has()` on the layout (each
    // hand-over re-matched it across the table).
    <div className="game-layout" ref={layoutRef} data-big-turn={foldFarm ? '' : undefined}>
      {(lostLandTick > 0 || riftTick > 0) && (
        <div key={`${lostLandTick}-${riftTick}`} className={riftTick > 0 && (state.rift === 3 || state.rift === 6) ? 'danger-flash danger-flash-deep' : 'danger-flash'} aria-hidden="true" />
      )}
      {/* tabIndex so axe's "scrollable-region-focusable" rule is satisfied unconditionally, not just when
          the panel happens to contain a focusable button — the desktop column scrolls (overflow-y: auto,
          SPEC 10.3), and at some game states (nothing affordable yet in Market/Cath's Plan) it can have no
          focusable descendants of its own, which the right column hit at random in this session's
          testing. */}
      <aside className="desktop-col desktop-col-left" tabIndex={0} data-big-turn={foldFarm ? (tightTurn === turnKey ? 'tight' : '') : undefined}>
        {/* AAA UI M4 fix: the Farm ledger folds into the producer frame (one line a producer) so the
            Actions frame below keeps the column's height for the verbs. */}
        {isDesktop && (
          <div className="sheet-panel producer-sheet frame">
            {producerPanel}
            {!foldFarm && <FarmSheet state={state} onClose={() => {}} inline />}
          </div>
        )}
        {/* ROADMAP 8: the actions tray lives here on desktop, not the right column — Market/Cath's Plan/Log
            already claim nearly all of the right column's height budget on their own (measured directly:
            close to the full 768px at 1280x800), while the Farm panel leaves real headroom. Mounted only
            when `useIsDesktopLayout()` says so, not just hidden by CSS: `actionsPanel` is otherwise mounted
            twice at once (here and in the phone flow below), and Playwright's strict-mode locators count
            DOM matches regardless of `display: none` — e2e/tooltip.spec.ts caught this directly. Wrapped in
            `.sheet-panel` to match the tray it sits alongside. */}
        {isDesktop && (
          <div className="sheet-panel actions-sheet frame">
            {/* Plan item 225: with the hand on the table the rail holds no actions, so no "Actions" heading. */}
            {!handOnTable && <h2 className="frame-title">Actions</h2>}
            {actionsPanel}
            {/* Plan item 190: the rail's foot holds the game's ledger, Trust and land changes as till receipts. */}
            <RoundLedger state={state} />
            {controls}
          </div>
        )}
      </aside>

      <main className="game">
      {/* ROADMAP 8 "the table, part 1: layout": SPEC 10.2's phone "Bottom panel (fixed)" — the active
          producer, actions and Undo/sheet buttons below — must stay visible without scrolling the page to
          reach it (previously all of this just sat at the end of one long scrolling column, so only the
          first action button was ever on-screen without a scroll, a real gap this wrapper closes). Splits
          `.game` into two flex children: this one (everything *about* the current state — topbar, companion,
          plan strip, map) scrolls internally if it doesn't fit; `.action-tray` below (the actual controls)
          keeps its natural size and is always the second, non-scrolling child, so simple flexbox does the
          pinning with no fixed positioning or measured JS height needed. A plain `display: contents` on
          desktop (`@media (max-width: 1023.98px)` below) makes both wrappers a no-op there — every element
          still flows directly in `.game`'s own column exactly as before this session. */}
      <div className="game-scroll">
      {/* AAA UI M4 (aaa-ui-specs.md "cathnivore" 4.9): the Market Board, one card-stock strip in four
          cells (icon, tabular figure, segmented meter) plus the Menu key. The words stay inside each
          cell's tooltip trigger, visible from landscape up and read by screen readers on a phone. */}
      <header className="market-board" aria-label="Market board">
        <div className="board-cell board-round" data-meter="round" role="group" aria-label={`Round ${state.round} of ${state.round + state.pressureDeck.length}`}>
          <span className="board-head">
            <BoardObject kind="slate" value={state.round} max={state.round + state.pressureDeck.length} />
            <span className="board-label">Round</span>
            <span key={roundTick} className={roundTick > 0 ? 'num board-num hud-tick' : 'num board-num'}>
              {state.round}
              <span className="board-of">/{state.round + state.pressureDeck.length}</span>
            </span>
          </span>
        </div>
        <div className="board-cell" data-tutorial="trust" data-meter="trust" role="group" aria-label={`Public Trust ${state.publicTrust} of ${TRUST_MAX}`}>
          <Tooltip term="Public Trust">
            <span className="board-head">
              <BoardObject kind="jar" value={state.publicTrust} max={TRUST_MAX} preview={previewState?.publicTrust} />
              <span className="board-label">Trust</span>
              <span key={trustTick} className={trustTick > 0 ? 'num board-num hud-tick' : 'num board-num'}>{state.publicTrust}</span>
            </span>
          </Tooltip>
        </div>
        <div className={state.lostLandPool <= 3 ? 'board-cell board-cell--danger' : 'board-cell'} data-meter="land" role="group" aria-label={`Land left ${state.lostLandPool} of ${lostLandStartingPool(state)}`}>
          <Tooltip term="Lost Land">
            <span className="board-head">
              <BoardObject kind="deeds" value={state.lostLandPool} max={lostLandStartingPool(state)} preview={previewState?.lostLandPool} />
              {/* Critique 2026-11-03: the pool counts land still left to lose (a full bar is good), so the label says
                  so; "Lost Land" over a full bar read as ten regions lost. The tooltip keeps the rules term. */}
              <span className="board-label">{state.lostLandPool <= 3 ? `Last ${state.lostLandPool}` : <>Land<span className="board-label-more"> left</span></>}</span>
              <span key={lostLandTick} className={lostLandTick > 0 ? 'num board-num hud-tick' : 'num board-num'}>{state.lostLandPool}</span>
            </span>
          </Tooltip>
        </div>
        <div className="board-cell" data-meter="rift" role="group" aria-label={`Rift ${state.rift} of ${RIFT_MAX}`}>
          <Tooltip term="Rift">
            <span className="board-head">
              <BoardObject kind="plate" value={state.rift} max={RIFT_MAX} preview={previewState?.rift} />
              <span className="board-label">Rift</span>
              <span key={riftTick} className={riftTick > 0 ? 'num board-num hud-tick' : 'num board-num'}>{state.rift}</span>
            </span>
          </Tooltip>
        </div>
        {/* SPEC 10.2: the menu button belongs in the fixed top bar. */}
        <button className="btn-icon board-menu" onClick={onExit} aria-label="Menu">
          <MenuIcon size={22} />
        </button>
      </header>

      {/* Plan item 20: on desktop Cath's aside and tomorrow's papers share one row, so the board gets the height. */}
      <div className={tableCath ? 'table-head with-table-cath' : 'table-head'}>
      {!tableCath && <CathCompanion expression={cathReaction.expression} line={cathReaction.line} />}

      {!guided && tutorialSteps && tutorialIndex < tutorialSteps.length && (
        tipCollapsedAt === tutorialIndex ? (
          // AAA UI M4 fix: on a phone the note folds to a pill so the map keeps its full aspect.
          <button type="button" className="tutorial-pill" aria-expanded="false" onClick={() => setTipCollapsedAt(null)}>
            <CathArt className="tutorial-prompt-cath" framing="face" width={22} height={27} />
            Cath&rsquo;s tip
          </button>
        ) : (
        <section className="tutorial-prompt" aria-label="Cath's tip">
          {/* ROADMAP "tutorial prompts spoken by her": her face, so the line reads as Cath teaching,
              not an anonymous system message. Decorative (the section's own text already says it). */}
          <span className="tutorial-prompt-cameo" aria-hidden="true">
            <CathArt className="tutorial-prompt-cath" framing="face" width={30} height={37} />
          </span>
          <p>
            {tutorialSteps[tutorialIndex]!.text}{' '}
            {/* SPEC 8.1: "a '?' link to the rules reference," alongside every tutorial prompt. It wears
                the same italic "i" as every other explain-this trigger. */}
            <button type="button" className="tooltip-trigger-button tooltip-info tutorial-rules-link" aria-label="Open the rules reference" onClick={() => setShowRulesFromTutorial(true)}>
              ?
            </button>
          </p>
          <span className="tutorial-prompt-keys">
            {/* SPEC 8.1: a step teaching one action/region advances by taking it (see `act`'s auto-advance);
                an informational step (no highlight) has nothing to take, so it still needs a manual tap. */}
            {!tutorialSteps[tutorialIndex]!.highlight && <button onClick={() => setTutorialIndex((i) => i + 1)}>Got it</button>}
            <button type="button" className="tutorial-fold" aria-label="Fold Cath's tip away" aria-expanded="true" onClick={() => setTipCollapsedAt(tutorialIndex)}>
              <span aria-hidden="true">{'\u2303'}</span>
            </button>
          </span>
        </section>
        )
      )}

      {/* ROADMAP 8: the plan strip and the map legend used to be two separate full-width rows stacked
          above the map — both are compact, low-height content (a handful of short labels), so on desktop,
          where the centre column is far wider than the map itself, they share one row instead. `.plan-strip`
          grows to fill the leftover width; `.map-legend` keeps its own natural size. Phone keeps the original
          two-row stack (`.plan-legend-row` is a plain block there, see global.css) since the narrower column
          has no spare width to share. */}
      {/* Plan item 212: on an upright phone, tomorrow's papers fold into one glossy placard hung from Pell's portrait,
          so the board starts near the top of the screen; a tap opens the three memos as a sheet over the table. */}
      <div className="papers">
      <button
        type="button"
        className="papers-placard"
        data-intent-placard
        aria-expanded={papersOpen}
        aria-controls="papers-sheet"
        aria-label={`Tomorrow's papers: ${(['squeeze', 'expand', 'scout'] as const)
          .map((slot) => `${slot[0]!.toUpperCase()}${slot.slice(1)} ${state[slot] ? pressureLabel(state[slot]) : 'empty'}`)
          .join(', ')}`}
        onClick={() => setPapersOpen((o) => !o)}
      >
        <span className="papers-placard-face" aria-hidden="true">
          <Figure character="pell" expression={MOOD_EXPRESSION[rivalMood(cathReaction.expression)]} />
        </span>
        {(['squeeze', 'expand', 'scout'] as const).map((slot) => (
          // Keyed on the card, so a card the conveyor moves in re-mounts and stamps (the strip's arming can't show while folded).
          <span key={`${slot}-${state[slot]?.id ?? 'none'}`} className="papers-placard-slot" data-slot={slot} data-hot={planHighlightSlot === slot || undefined} aria-hidden="true">
            <PlanArt kind={slot} size={22} />
            <span className="papers-placard-words">
              <b>{slot === 'squeeze' ? 'Squeeze' : slot === 'expand' ? 'Expand' : 'Scout'}</b>
              <span>{state[slot] ? pressureLabel(state[slot]) : 'Empty'}</span>
            </span>
          </span>
        ))}
        <span className="papers-placard-caret" aria-hidden="true" />
      </button>
      <section ref={planStripRef} id="papers-sheet" className="plan-strip" aria-label="Tomorrow's papers" data-round={state.round} data-corp="hollowell" data-open={papersOpen || undefined}>
        {(['squeeze', 'expand', 'scout'] as const).map((slot) => {
          const slotLabel = slot === 'squeeze' ? 'Squeeze' : slot === 'expand' ? 'Expand' : 'Scout'
          const card = state[slot]
          const preview = planPreview(state, slot)
          return (
            <span key={slot} className="plan-strip-item">
              <button
                type="button"
                aria-pressed={planHighlightSlot === slot}
                className={planHighlightSlot === slot ? 'plan-strip-active' : ''}
                onClick={() => {
                  // A tap pins or unpins; it also ends any hover or focus peek, so unpinning really clears.
                  setPlanPeekSlot(null)
                  setPlanHighlightSlot((s) => (s === slot ? null : slot))
                  // Plan item 212: the phone sheet closes so the marked hexes show.
                  setPapersOpen(false)
                }}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setPlanPeekSlot(slot)}
                onPointerLeave={() => setPlanPeekSlot((s) => (s === slot ? null : s))}
                onFocus={(e) => e.currentTarget.matches(':focus-visible') && setPlanPeekSlot(slot)}
                onBlur={() => setPlanPeekSlot((s) => (s === slot ? null : s))}
              >
                {/* ROADMAP 10: the enemy's plan strip becomes agenda-card-like — STYLE.md 8's Agenda
                    cards put "the faction logo top-left"; both corporations act through every slot
                    (SPEC 4.7's Scout/Expand/Squeeze all place or count Hollowell pieces, several also
                    count or add Candor Doubt), so both logos brand every card rather than picking one. */}
                {/* AAA UI M4 fix: a dateline row in normal flow (the logos used to sit on the headline's
                    first letter), with the Pressure card's stage spelled out. */}
                <span className="plan-strip-dateline" aria-hidden="true">
                  {/* Plan item 100: where this card stands on Hollowell's conveyor (it arrives as Scout, Expands
                      the round after, then Squeezes): three chevrons, lit up to this slot. */}
                  <span className="plan-strip-dial" data-step={slot === 'scout' ? 1 : slot === 'expand' ? 2 : 3}>
                    <i />
                    <i />
                    <i />
                  </span>
                  {/* Plan item 173: Hollowell's plate on its dashboard (desktop only; a phone's card has no room). */}
                  <span className="plan-strip-plate">Hollowell</span>
                  {card && (
                    <span className="plan-strip-card-meta">
                      <span className="plan-strip-stage"><span className="plan-strip-stage-word">Stage </span>{romanStage(card.stage)}</span>
                      {pressureIconTypes(card).map((type) => (
                        <RegionTypeIcon key={type} type={type} size={13} />
                      ))}
                    </span>
                  )}
                </span>
                {/* Plan item 100: the move's own picture in the corporations' plastic (two 11 px logos were here),
                    beside its headline and effect. */}
                <PlanArt kind={slot} size={38} />
                <span className="plan-strip-headline">{slotLabel}</span>
                <span className="visually-hidden">: </span>
                <span className="plan-strip-effect">{card ? pressureLabel(card) : 'Empty'}</span>
                {/* Plan item 25: what the card will do, by region, from the rules (planPreview). */}
                {/* Plan item 47: a phone's narrow card shows the short line; the full one stays for the
                    accessible name (visually hidden there) and for wider cards. */}
                <span className="plan-strip-target plan-strip-target-full" data-long={preview.summary.length > LONG_MAX || undefined}>
                  <TargetLine line={preview.summary} names={preview.regions.map((r) => REGIONS[r].name)} />
                  {/* Plan item 189: a region under Mara's Injunction stays on Expand's card, struck through. */}
                  {slot === 'expand' &&
                    state.expandSkip.map((r) => (
                      <span key={r} className="plan-chip plan-chip-enjoined" data-enjoined={r}>
                        <span className="visually-hidden"> (skipped by Injunction: </span>
                        {REGIONS[r].name}
                        <span className="visually-hidden">)</span>
                      </span>
                    ))}
                </span>
                {preview.short !== preview.summary && (
                  <span className="plan-strip-target plan-strip-target-short" aria-hidden="true">
                    <TargetLine line={preview.short} names={preview.regions.map((r) => REGIONS[r].name)} />
                  </span>
                )}
                {card && <span className="visually-hidden">{`, stage ${card.stage}`}</span>}
              </button>
              {/* A separate trigger, not nested inside the button above: that button already has its own
                  tap meaning (toggle the map highlight), so a tooltip needs its own affordance rather than
                  fighting it for the same tap (SPEC 10.5, alongside SPEC 10.2's highlight behaviour). */}
              <Tooltip term={slotLabel} label={`What is ${slotLabel}?`}>
                ?
              </Tooltip>
            </span>
          )
        })}
      </section>
      </div>
      {/* Plan item 92: Hollowell's face across the table from Cath, his mood the mirror of hers. */}
      <Rival mood={rivalMood(cathReaction.expression)} />
      </div>

      <section className="map-wrap" data-light={lightFor(state.round)}>
        {/* Plan item 28: as the round turns, the new light sweeps across the table once. */}
        {roundTick > 0 && <div key={`sweep-${roundTick}`} className="table-sweep" aria-hidden="true" />}
        {/* Plan item 276: on an upright phone her reaction pops in over the board's lower-left corner (about 140 px tall)
            for a moment, as she strikes the pose; absolutely placed, so nothing moves, and taps go through her. */}
        {phoneTableCath && cathPose && (
          <span key={`pop-${poseTick}`} className="cath-pop" data-pose={cathPose} aria-hidden="true">
            <CathArt framing="half" pose={cathPose} expression={cathReaction.expression} />
          </span>
        )}
        <BeasDrawing />
        <ProduceCrates />
        {/* Plan item 144: the week's market event pinned to the table: its name and its rule. */}
        {state.config.marketEvent && (
          <p className="event-ticket" data-event={state.config.marketEvent}>
            <b>
              <span className="event-name">{MARKET_EVENTS[state.config.marketEvent].name}</span>
              <span className="event-name-short" aria-hidden="true">{EVENT_SHORT[state.config.marketEvent]}</span>
            </b>
            <span className="event-rule">{eventRule(state.config.marketEvent)}</span>
            <span className="event-rule-short" aria-hidden="true">{eventRule(state.config.marketEvent, true)}</span>
          </p>
        )}
        {/* Plan item 190: full length now, head to boots, since the papers' ticker gave the table its height. */}
        {/* Plan item 118: on a desktop Cath stands at the table's left edge, half-length, her face following the
            same reactions as her companion line (a liberation, a Squeeze, a plan reveal). Hidden below 1240 px. */}
        {/* Plan item 171: on an upright phone she speaks from the dock above the hand instead (CathDock), off the board. */}
        {deskTableCath && (
          <section className="table-cath" data-expression={cathReaction.expression} data-pose={cathPose ?? SCREEN_POSE['cathnivore:game']} aria-label="Cath">
            <p className="table-cath-line voice" aria-live="polite" key={cathReaction.line}>
              {cathReaction.line}
              {bubbleSuggest && suggestBody && (
                <span className="suggest-line table-cath-suggest" data-testid="suggest-line">
                  {suggestBody}
                </span>
              )}
            </p>
            <span className="table-cath-figure" aria-hidden="true" key={cathPose ?? 'rest'}>
              <CathArt framing="half" pose={cathPose ?? SCREEN_POSE['cathnivore:game']} expression={cathReaction.expression} animate />
            </span>
          </section>
        )}
        {/* Plan item 155: the producers sit at the table too, opposite Cath, their faces following the turn (an
            ability firing, a Squeeze on their Stall). Placed by `seatProducers` in the map's free corners. */}
        {deskTableCath && (
          <div className="table-producers table-producers-desk" aria-hidden="true">
            {state.config.producers.map((id) => (
              <span key={id} className={`table-producer pc-${id}`} data-table-producer={id} data-expression={producerFaces[id] ?? 'neutral'} data-active={id === state.activeProducer ? '' : undefined}>
                {/* Plan item 374: at a desktop table they stand half length at Cath's scale (the cast's Figure, drawn in
                    her `half` framing), behind the board's far rim; a phone keeps the small busts. */}
                {phoneTableCath ? (
                  <Portrait character={id} size={54} expression={faceExpression(producerFaces[id])} />
                ) : (
                  <Figure character={id} expression={faceExpression(producerFaces[id])} />
                )}
                {/* Plan item 374: at a desktop table each seat carries its producer's name on a plate in their colour. */}
                {!phoneTableCath && <span className="table-producer-name">{PRODUCERS[id].name.split(' ')[0]}</span>}
                {!phoneTableCath && <span className="producer-stack" />}
              </span>
            ))}
          </div>
        )}
        {/* AAA UI M4 fix: the round's bunting hangs across the map's top edge (it used to float at 18% of
            the viewport, over the clippings on a phone); the Rift's plastic sign hangs below it. */}
        {riftTick > 0 && (state.rift === 3 || state.rift === 6) && (
          <div key={`rift-${riftTick}`} className="round-banner rift-banner" role="status">
            {state.rift === 3 ? 'The Rift widens' : 'The Rift splits open'}
          </div>
        )}
        {roundTick > 0 && (
          <div key={roundTick} className="round-banner" aria-hidden="true">
            {state.pressureDeck.length === 0 ? `Final round ${state.round}` : `Round ${state.round}`}
            <span className="round-banner-sub">
              {(() => {
                const n = Object.values(state.regions).filter((r) => r.liberated).length
                return `${n} ${n === 1 ? 'region' : 'regions'} liberated`
              })()}
            </span>
          </div>
        )}
        {/* AAA UI M4: the map key (Outlet, Buyout, Doubt, Co-op marker, Liberated) folds into an "i" tag at
            the map's corner instead of a row of its own, which gives the map the height. Each term keeps
            its own SPEC 10.5 tooltip inside the key. */}
        <details className="map-key">
          <summary aria-label="Map key">
            <span aria-hidden="true">i</span>
            {/* Plan item 378: at a desktop table the "i" carries its word, so it reads as the map's key, not a stray button. */}
            <span className="map-key-word" aria-hidden="true">Map key</span>
          </summary>
          <section className="map-legend">
            <span className="map-key-title label">Map key</span>
            {(
              [
                { term: 'Outlet', icon: <Outlet /> },
                { term: 'Buyout', icon: <Buyout /> },
                { term: 'Doubt', icon: <Doubt /> },
                { term: 'Co-op marker', icon: <CoopMarkerIcon /> },
              ] as const
            ).map(({ term, icon }) => (
              <span key={term} className="map-legend-item">
                <svg className="map-legend-icon" viewBox="0 0 12 14" width={16} height={18} aria-hidden="true">
                  {icon}
                </svg>
                <Tooltip term={term}>{term}</Tooltip>
                {term === 'Co-op marker' && (
                  <>
                    {' · '}
                    <Tooltip term="Liberated">Liberated</Tooltip>
                  </>
                )}
              </span>
            ))}
          </section>
        </details>
        <RegionMap
          state={boardState}
          ghost={selectedGroup || drag ? undefined : ghost}
          faces={producerFaces}
          enemyTurn={
            pendingEnemyTurn.length > 0 && enemyStep
              ? {
                  step: enemyStep.step,
                  flights: enemyStep.event ? flightsFor(enemyStep.event) : [],
                  hqSide: stripDock(enemyStepRegion) === 'top' ? 'bottom' : 'top',
                  active: enemyStep.event ? (execFor(enemyStep.event) === 'vane' ? 'candor' : execFor(enemyStep.event) === 'pell' ? 'hollowell' : undefined) : undefined,
                }
              : undefined
          }
          highlight={
            enemyStepRegion && pendingEnemyTurn.length > 0
              ? [enemyStepRegion]
              : teammatePick && pickRegion(teammatePick.action)
                ? [pickRegion(teammatePick.action)!]
              : drag
                ? drag.regions
                : selectedGroup
              ? pendingChoice
                ? [pendingChoice.region]
                : selectedGroup.entries.map((e) => e.region)
              : planThreat && planThreat.regions.length > 0
                ? planThreat.regions
                : undefined
          }
          threat={pendingEnemyTurn.length > 0 || drag || selectedGroup ? undefined : planThreat}
          onSelect={
            selectedGroup
              ? (region) => {
                  const entry = selectedGroup.entries.find((e) => e.region === region)
                  if (entry) setPendingChoice(entry)
                }
              : undefined
          }
          inspected={closeUp}
          onInspect={!isDesktop && !guidedActive && pendingEnemyTurn.length === 0 && !drag && !teammatePick ? setCloseUp : undefined}
        />
        {closeUp && !isDesktop && (
          <RegionCloseUp
            state={boardState}
            region={closeUp}
            onClose={() => setCloseUp(null)}
            // Plan item 109: the actions this turn that can target the region; one goes straight to its confirm step.
            actions={[...groups.values()].flatMap((g) => {
              const entry = g.entries.find((e) => e.region === closeUp)
              return entry
                ? [{ label: g.label, play: () => {
                    setCloseUp(null)
                    setSelectedGroup(g)
                    setPendingChoice(entry)
                  } }]
                : []
            })}
          />
        )}
      </section>
      {showHand && (
        <section
          className="table-hand"
          role="region"
          aria-label="Your hand"
          onClickCapture={(e) => {
            const card = (e.target as Element).closest?.('.action-item > button:first-child, .action-family-option > button')
            if (card instanceof HTMLElement && !(card as HTMLButtonElement).disabled) lastCardRef.current = { el: card, at: performance.now() }
          }}
        >
          <ArtSceneContext.Provider value={true}>{playableCards}</ArtSceneContext.Provider>
        </section>
      )}
      {/* Plan item 190: while the hand steps away (Hollowell's turn, a region pick) its place stays, so the board keeps
          its size instead of growing over Cath's line at the table's edge. */}
      {handOnTable && !showHand && <div className="table-hand-spacer" aria-hidden="true" />}
      </div>

      {/* SPEC 10.2's phone "Bottom panel (fixed)": the active producer, its actions and Undo/sheet-toggle
          buttons, always on screen — see the `.game-scroll` comment above for how. */}
      <div className="action-tray">
      {phoneTableCath && (
        <CathDock expression={cathReaction.expression} line={cathReaction.line}>
          {/* Plan item 387: on an upright phone the producers sit at the counter's right end, opposite Cath, off the
              board: 72 px busts side by side with a name plate in their colour; whoever's turn it is sits up, lit, the
              other back in the counter's shade. A tap opens the Farm. (They were medallions pinned on the board's edge.) */}
          <span className="table-producers table-producers-phone counter-bench">
            {state.config.producers.map((id) => (
              <button
                type="button"
                key={id}
                className={`table-producer pc-${id}`}
                data-table-producer={id}
                data-expression={producerFaces[id] ?? 'neutral'}
                data-active={id === state.activeProducer ? '' : undefined}
                aria-label={`${PRODUCERS[id].name}${id === state.activeProducer ? ', playing now' : ''}: open the Farm`}
                onClick={() => setShowFarm(true)}
              >
                <Portrait character={id} size={72} expression={faceExpression(producerFaces[id])} />
                <span className="table-producer-name" aria-hidden="true">{PRODUCERS[id].name.split(' ')[0]}</span>
              </button>
            ))}
          </span>
        </CathDock>
      )}
      {!isDesktop && producerPanel}

      {/* Phone copy of `actionsPanel` (defined above), now inside `.action-tray`. Only mounted when
          `useIsDesktopLayout()` says this isn't desktop — see the left tray's copy above for why this is
          gated in JS rather than just hidden by CSS. */}
      {!isDesktop && actionsPanel}

      {!isDesktop && controls}
      </div>

      {showFarm && <FarmSheet state={state} onClose={() => setShowFarm(false)} />}
      {/* SPEC 8.1: "each new rule is introduced exactly once, at the moment it first matters" — a chapter
          with `improvements`/`schemes` off (e.g. chapters 1-2 have no Market, 1-3 have no Cath's Plan) must
          not let the sheet stay reachable with real card content, even read-only, before its own chapter
          narrates that introduction. */}
      {rules.improvements && showMarket && (
        <MarketSheet state={state} canBuy={canBuy} missingMarks={missingMarks} onBuy={buy} onClose={() => setShowMarket(false)} />
      )}
      {rules.schemes && showPlan && (
        <CathsPlanSheet state={state} canPlay={canPlayScheme} missingGoodwill={missingGoodwill} onPlay={playScheme} onClose={() => setShowPlan(false)} />
      )}
      {showLog && <LogSheet log={state.log} aiReasons={aiReasons} onClose={() => setShowLog(false)} />}
      {buyFlight && <BuyFlight key={buyFlight.key} card={buyFlight.card} cost={buyFlight.cost} path={buyFlight.path} onDone={() => setBuyFlight(null)} />}
      </main>

      {/* Plan item 20: on desktop the Market, Cath's Plan and the Log are a slim drawer rail, so the board is
          the hero (62%+ of 1440). A key opens its sheet as a drawer over the table's right edge; a count
          on the key says how many cards can be bought or played right now. Esc or the key again closes. */}
      <aside className="desktop-col desktop-col-right desktop-rail" aria-label={'Market, Cath\u2019s Plan and Log'}>
        <nav className="drawer-rail">
          {rules.improvements && (
            <DrawerKey id="market" open={drawer} setOpen={setDrawer} label="Market" count={state.market.filter((id) => id !== null && canBuy(id)).length}>
              <MarketIcon />
            </DrawerKey>
          )}
          {rules.schemes && (
            <DrawerKey id="plan" open={drawer} setOpen={setDrawer} label={'Cath\u2019s Plan'} short="Plan" count={state.cathsPlan.filter((id) => id !== null && canPlayScheme(id)).length}>
              <PlanIcon />
            </DrawerKey>
          )}
          <DrawerKey id="log" open={drawer} setOpen={setDrawer} label="Log">
            <LogIcon />
          </DrawerKey>
        </nav>
        {isDesktop && drawer && (
          <div className="drawer-panel" id={`drawer-${drawer}`} tabIndex={0}>
            {drawer === 'market' && rules.improvements && (
              <MarketSheet state={state} canBuy={canBuy} missingMarks={missingMarks} onBuy={buy} onClose={() => setDrawer(null)} inline />
            )}
            {drawer === 'plan' && rules.schemes && (
              <CathsPlanSheet state={state} canPlay={canPlayScheme} missingGoodwill={missingGoodwill} onPlay={playScheme} onClose={() => setDrawer(null)} inline />
            )}
            {drawer === 'log' && <LogSheet log={state.log} aiReasons={aiReasons} onClose={() => setDrawer(null)} inline />}
            <button className="drawer-close" aria-label="Close drawer" onClick={() => setDrawer(null)}>
              <span aria-hidden="true">{'\u00d7'}</span>
            </button>
          </div>
        )}
      {showHand && laterCount() > 0 && (
          // Plan item 149: what can't be played yet lies face down beside the hand (item 154: in the rail's gutter, so the
          // cards keep the table's width); its reasons are the
          // column's 'Not yet' strips, which a click brings into view.
          <button
            type="button"
            className="hand-later"
            data-later={laterCount()}
            aria-label={`${laterCount()} not yet playable: show why`}
            onClick={() => {
              const head = document.querySelector<HTMLElement>('.actions .action-head-later')
              head?.scrollIntoView({ block: 'start', behavior: 'smooth' })
            }}
          >
            <span className="hand-later-back" aria-hidden="true" />
            <span className="hand-later-back" aria-hidden="true" />
            <span className="hand-later-back" aria-hidden="true">
              <b>{laterCount()}</b>
              <small>Not yet</small>
            </span>
          </button>
        )}
      </aside>
      {drag && (
        <div className="drag-ghost" aria-hidden="true" style={{ left: drag.x, top: drag.y }}>
          {drag.label}
        </div>
      )}
      {guidedStep && <TutorialCoach {...coachProps(guidedStep)} />}
    </div>
  )
}

type DrawerId = 'market' | 'plan' | 'log'

/** A key on the desktop drawer rail (plan item 20): icon, a short word and, for the Market and Cath's Plan,
 * how many cards the active producer can take right now. */
function DrawerKey({ id, open, setOpen, label, short, count, children }: {
  id: DrawerId
  open: DrawerId | null
  setOpen: (d: DrawerId | null) => void
  label: string
  short?: string
  count?: number
  children: ReactNode
}) {
  const isOpen = open === id
  return (
    <button
      className={isOpen ? 'drawer-key is-open' : 'drawer-key'}
      aria-expanded={isOpen}
      aria-controls={`drawer-${id}`}
      aria-label={count ? `${label}, ${count} ready` : label}
      onClick={() => setOpen(isOpen ? null : id)}
    >
      {children}
      <span className="drawer-key-word" aria-hidden="true">{short ?? label}</span>
      {count ? <span className="drawer-key-count" aria-hidden="true">{count}</span> : null}
    </button>
  )
}

/** End-screen "Share result": the native share sheet where there is one, otherwise the clipboard. */
function ShareResultButton({ text, withUrl = true }: { text: string; withUrl?: boolean }) {
  const [note, setNote] = useState('')
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share(withUrl ? { text, url: location.origin + '/cathnivore/' } : { text })
        return
      }
      await navigator.clipboard.writeText(text)
      setNote('Copied to clipboard')
    } catch {
      setNote('Could not share')
    }
  }
  return (
    <>
      <button className="secondary" onClick={share}>
        Share result
      </button>
      <p className="end-screen-share-note" role="status">
        {note}
      </p>
    </>
  )
}
