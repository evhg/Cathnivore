import '../../shared/ui/base.css'
import './fonts.css'
import './tokens.css'
import './styles.css'
import '../../shared/cath/cath.css'
import { cathSvg, type CathExpression } from '../../shared/cath/cath'
import { WARDROBE, chooseOutfit, chosenOutfit, readProgress, unlockedOutfits } from '../../shared/cath/wardrobe'
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
let outfit = chosenOutfit()
function showCath(expression: CathExpression): void {
  if (heroCath) heroCath.innerHTML = cathSvg({ framing: 'half', expression, outfit, animate: !reducedMotion })
}
showCath('smirk')

// The wardrobe: outfits earned in the games, one worn everywhere. Hidden until she has more than the blazer.
const wardrobeEl = document.getElementById('wardrobe')
if (wardrobeEl) {
  const open = unlockedOutfits(readProgress())
  if (open.length > 1) {
    wardrobeEl.hidden = false
    const draw = () => {
      wardrobeEl.innerHTML = WARDROBE.map((w) => {
        const got = open.includes(w.id)
        return `<button type="button" class="wardrobe-pick" data-outfit="${w.id}" aria-pressed="${w.id === outfit}" ${got ? '' : 'disabled'} title="${got ? w.name : w.how}">${w.name}</button>`
      }).join('')
    }
    draw()
    wardrobeEl.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-outfit]')?.dataset.outfit
      if (!id) return
      outfit = id as typeof outfit
      chooseOutfit(outfit)
      draw()
      showCath('delighted')
    })
  }
}
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

// A daily line from Cath, rotating by calendar day, pointing at today's Runnel.
const lede = document.querySelector<HTMLElement>('.lede')
if (lede) {
  const now = new Date()
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000)
  const lines = [
    "Today's Runnel is up. Water every field and keep your streak alive.",
    'The daily Runnel is fresh this morning. Come and turn some pipes with me.',
    "I've set today's Runnel out for you. How few taps can you manage?",
    "New day, new Runnel. The fields are thirsty and I'm putting the kettle on.",
    'Fancy a quick Runnel before the corporations wake up? Today\'s is ready.',
    "Today's Runnel is a tricky one. I believe in you.",
    'Water the fields, share the result, and come back tomorrow.',
  ]
  lede.textContent = lines[day % lines.length] ?? null
}

// U5: the poster cards lean a few degrees toward a mouse pointer. Fine pointers only, never under reduced motion.
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll<HTMLElement>('.games > a.card:not(.card-cathode)').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      card.style.setProperty('--tilt-y', `${(x * 6).toFixed(2)}deg`)
      card.style.setProperty('--tilt-x', `${(-y * 5).toFixed(2)}deg`)
    })
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--tilt-x')
      card.style.removeProperty('--tilt-y')
    })
  })
}

// U5: the Today button reads the Runnel save defensively and says Play, Finish or Solved (with the streak).
try {
  const label = document.getElementById('cta-today-label')
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const save = JSON.parse(localStorage.getItem('runnel:v1') ?? 'null') as { results?: Record<string, unknown>; daily?: Record<string, unknown> } | null
  const results = save?.results ?? {}
  if (label && save && typeof save === 'object') {
    let streak = 0
    let cursor = results[today] ? today : new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    while (results[cursor] && streak < 3650) {
      streak++
      cursor = new Date(Date.parse(`${cursor}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    }
    if (results[today]) label.textContent = streak > 1 ? `Solved today · ${streak}-day streak` : 'Solved today'
    else if (save.daily?.[today]) label.textContent = "Finish today's Runnel"
    else if (streak > 0) label.textContent = `Keep your ${streak}-day streak`
  }
} catch {
  // Unreadable storage: keep the default label.
}

// U13: "your progress" line on the cards, read defensively from each game's own save. Nothing is shown to a first-time visitor.
function showProgress(id: string, text: string): void {
  const el = document.getElementById(id)
  if (!el || !text) return
  el.textContent = text
  el.hidden = false
}
try {
  const hg = JSON.parse(localStorage.getItem('hedgerow:v1') ?? 'null') as { stars?: Record<string, number> } | null
  const levels = Object.values(hg?.stars ?? {}).filter((n) => typeof n === 'number' && n >= 1)
  if (levels.length > 0) {
    const stars = levels.reduce((a, n) => a + Math.min(3, n), 0)
    showProgress('prog-hedgerow', `${levels.length} of 100 levels cleared · ${stars} stars`)
  }
  const rn = JSON.parse(localStorage.getItem('runnel:v1') ?? 'null') as { results?: Record<string, unknown> } | null
  const solved = Object.keys(rn?.results ?? {}).length
  if (solved > 0) showProgress('prog-runnel', `${solved} ${solved === 1 ? 'day' : 'days'} solved`)
} catch {
  // Unreadable storage: show nothing.
}
