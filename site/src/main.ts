import './styles.css'
import '../../shared/cath/cath.css'
import { cathSvg, type CathExpression } from '../../shared/cath/cath'
import { startScene } from './scene'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const root = document.documentElement

// Split the title into letters so they can rise in one after another. The visible text stays in one
// aria-label on the heading.
const title = document.querySelector<HTMLElement>('.title-text')
if (title) {
  const text = title.textContent ?? ''
  title.replaceChildren(
    ...[...text].map((ch, i) => {
      const span = document.createElement('span')
      span.className = 'letter'
      span.textContent = ch
      span.style.setProperty('--i', String(i))
      span.setAttribute('aria-hidden', 'true')
      return span
    }),
  )
}

document.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => el.style.setProperty('--order', String(i)))

// Cath is the face of every game (VISION.md): she stands in the landscape and reacts to the game cards.
const heroCath = document.getElementById('hero-cath')
function showCath(expression: CathExpression): void {
  if (heroCath) heroCath.innerHTML = cathSvg({ framing: 'half', expression, animate: !reducedMotion })
}
showCath('smirk')
document.querySelectorAll<HTMLElement>('.card[data-cath]').forEach((card) => {
  const react = () => showCath(card.dataset.cath as CathExpression)
  const rest = () => showCath('smirk')
  card.addEventListener('pointerenter', react)
  card.addEventListener('focus', react)
  card.addEventListener('pointerleave', rest)
  card.addEventListener('blur', rest)
})
const cardFace = document.querySelector('.art-cath')
if (cardFace) {
  const face = document.createElement('span')
  face.className = 'mm-cath'
  face.innerHTML = cathSvg({ framing: 'face', expression: 'smirk' })
  cardFace.appendChild(face)
}

const canvas = document.getElementById('scene') as HTMLCanvasElement
let scene = null
try {
  scene = startScene(canvas, reducedMotion)
} catch (err) {
  console.warn('Scene failed to start', err)
}
if (!scene) root.classList.add('no-webgl')

// Start the entrance on the next frame so the first paint is the dark sky, not a flash of content.
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')))

// Before this landing page, Cathnivore lived at / with a site-wide service worker. The server now serves
// a self-removing worker in its place; this nudges the browser to fetch it straight away.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) if (new URL(reg.scope).pathname === '/') reg.update().catch(() => {})
  }).catch(() => {})
}
