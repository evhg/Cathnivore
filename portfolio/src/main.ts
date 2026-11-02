import '../../shared/ui/base.css'
import './fonts.css'
import './tokens.css'
import './styles.css'
import '../../shared/cath/cath.css'
import { cathSvg } from '../../shared/cath/cath'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import { startField } from './hero'
import { cards, counters, kinetic, pulse, viewTransitionNames, words } from './fx'

// Every page (the home page and each /work/<id>/ case study) runs this. The HTML is complete without
// it; this adds the shader field, the kinetic type and the motion.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

document.querySelectorAll<HTMLElement>('.cell').forEach((el, i) => el.style.setProperty('--order', String(i)))
viewTransitionNames(document)

const field = document.querySelector<HTMLCanvasElement>('#field')
// Automated browsers skip the shader (software WebGL is slow) unless ?field asks for it, for screenshots.
if (field && (!navigator.webdriver || location.search.includes('field'))) startField(field, reduced)

// Plan item 23: the hero's right half is the studio's work, with Cath (the face of every game) in front.
const heroCath = document.querySelector<HTMLElement>('#hero-cath')
if (heroCath) heroCath.innerHTML = cathSvg({ framing: 'half', expression: 'smirk', pose: SCREEN_POSE['site:portfolio'], animate: !reduced })

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
