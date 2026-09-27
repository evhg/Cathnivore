import './styles.css'
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
