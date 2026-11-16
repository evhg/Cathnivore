import '../../shared/ui/base.css'
import './fonts.css'
import './tokens.css'
import './styles.css'
import '../../shared/cath/cath.css'
import { watchCathLines } from '../../shared/cath/lines'
import { cathSvg } from '../../shared/cath/cath'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import { startField } from './hero'
import { cards, counters, kinetic, pulse, shippedLine, viewTransitionNames, words } from './fx'
import { startPosterPlay } from '../../site/src/posterplay'

// Plan item 442: her line weight at small sizes, including a figure prerendered into the page.
watchCathLines()

// Every page (the home page and each /work/<id>/ case study) runs this. The HTML is complete without
// it; this adds the shader field, the kinetic type and the motion.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

document.querySelectorAll<HTMLElement>('.cell').forEach((el, i) => el.style.setProperty('--order', String(i)))
viewTransitionNames(document)

const field = document.querySelector<HTMLCanvasElement>('#field')
// Automated browsers skip the shader (software WebGL is slow) unless ?field asks for it, for screenshots.
if (field && (!navigator.webdriver || location.search.includes('field'))) startField(field, reduced, { force: location.search.includes('field') })

// Plan item 23: the hero's right half is the studio's work, with Cath (the face of every game) in front.
const heroCath = document.querySelector<HTMLElement>('#hero-cath')
// Built into the page at build time (scripts/build-site.ts); drawn here only if it isn't there.
if (heroCath && !heroCath.firstElementChild) heroCath.innerHTML = cathSvg({ framing: 'full', expression: 'smirk', pose: SCREEN_POSE['site:portfolio'], animate: !reduced })
// Reduced motion: the built-in drawing stops her idle (blink, breath, sway).
if (reduced) heroCath?.querySelector('svg.cath')?.classList.remove('cath-animate')

const h1 = document.querySelector<HTMLElement>('[data-kinetic]')
if (h1) kinetic(h1, reduced)
words(document)
cards(document)
counters(document, reduced)
void pulse(document.querySelector<HTMLElement>('#pulse-text'))

document.documentElement.classList.add('ready')

// Plan item 38: the header turns solid glass once the page has scrolled (styles.css `.top.is-scrolled`).
const top = document.querySelector<HTMLElement>('.top')
if (top) {
  const mark = () => top.classList.toggle('is-scrolled', window.scrollY > 4)
  mark()
  window.addEventListener('scroll', mark, { passive: true })
}

// Plan item 145: the hero's game prints play. Plan item 454: at D (a pointer that hovers) only the print pointed at or
// focused plays, and Cath turns to it, points, and names it; on a phone they play in turn.
const wall = matchMedia('(min-width: 1100px) and (hover: hover)')
const showCards = [...document.querySelectorAll<HTMLAnchorElement>('.hero-show .show-card')]
startPosterPlay(
  showCards.flatMap((card) => {
    const game = (['cathnivore', 'runnel', 'hedgerow', 'nightshift'] as const).find((id) => card.dataset.game === id)
    return game ? [{ poster: card, art: card, game }] : []
  }),
  { hoverOnly: () => wall.matches },
)
if (heroCath) presentWork(heroCath, showCards)
void shipped(document.querySelector<HTMLElement>('#shipped-text'))

function presentWork(cath: HTMLElement, cards: HTMLElement[]): void {
  const say = document.querySelector<HTMLElement>('#show-say .show-say-text')
  const rest = say?.textContent ?? ''
  const resting = cath.innerHTML
  let current: HTMLElement | null = null
  let leaveTimer = 0
  const face = (card: HTMLElement | null) => {
    clearTimeout(leaveTimer)
    if (card === current) return
    current = card
    if (!card || !wall.matches) {
      cath.innerHTML = resting
      delete cath.dataset.facing
      if (say) say.textContent = rest
      document.querySelector('#show-say')?.removeAttribute('data-game')
      return
    }
    // She stands right of the wall, so she turns to face left (mirrored) and aims her arm at the print's centre from
    // her shoulder (about a fifth of the way down her figure); the angle is in her mirrored SVG space.
    const c = cath.getBoundingClientRect()
    const t = card.getBoundingClientRect()
    const dx = c.left + c.width / 2 - (t.left + t.width / 2)
    const dy = t.top + t.height / 2 - (c.top + c.height * 0.22)
    const pointAt = (Math.atan2(dy, Math.max(1, dx)) * 180) / Math.PI
    cath.innerHTML = cathSvg({ framing: 'full', expression: 'delighted', pose: 'point', pointAt, animate: !reduced })
    if (reduced) cath.querySelector('svg.cath')?.classList.remove('cath-animate')
    cath.dataset.facing = card.dataset.game ?? ''
    const game = card.dataset.game ?? ''
    if (say) say.textContent = SHOW_LINES[game] ?? rest
    document.querySelector('#show-say')?.setAttribute('data-game', game)
  }
  for (const card of cards) {
    card.addEventListener('pointerenter', () => face(card))
    card.addEventListener('focusin', () => face(card))
    // A short grace so moving between two prints doesn't flick her back to rest in between.
    const leave = () => {
      clearTimeout(leaveTimer)
      leaveTimer = window.setTimeout(() => face(null), 220)
    }
    card.addEventListener('pointerleave', leave)
    card.addEventListener('focusout', leave)
  }
  wall.addEventListener('change', () => face(null))
}

/** Plan item 454: her one line per print, in her voice. */
const SHOW_LINES: Record<string, string> = {
  cathnivore: 'Cathnivore: my market. Hollowell wants it; you hold it.',
  runnel: "Runnel: one water puzzle a day. Today's is fresh.",
  nightshift: 'NIGHT SHIFT: me, after dark. Grown-ups only.',
  hedgerow: 'Hedgerow: hold the lane and save the farm.',
}

/** Plan item 454: the stats' live line: when the live release shipped (its version.json) and the next build session. */
async function shipped(el: HTMLElement | null): Promise<void> {
  if (!el) return
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { buildTime, commit } = (await res.json()) as { buildTime?: string; commit?: string }
    const at = buildTime ? Date.parse(buildTime) : NaN
    if (!Number.isFinite(at)) return
    el.textContent = shippedLine(Date.now() - at, commit, new Date())
  } catch {
    // Offline: the static line stays.
  }
}
