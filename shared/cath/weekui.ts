// Cath's Week card renderer, shared by `/` and `/games/` (ROADMAP 231). Expects the markup
// `#week`, `#week-goals`, `#week-card`; shows the section only when storage is readable.

import { loadWeek, pinPostcard, postcardFor, weekComplete, weekGoals } from './week'
import type { WardrobeProgress } from './wardrobe'

export function renderWeek(now: WardrobeProgress, doc: Document = document): void {
  try {
    const section = doc.getElementById('week')
    const list = doc.getElementById('week-goals')
    const card = doc.getElementById('week-card')
    if (!section || !list || !card) return
    const state = loadWeek(now, new Date())
    const goals = weekGoals(now, state.base)
    list.replaceChildren(
      ...goals.map((g) => {
        const li = doc.createElement('li')
        li.className = 'week-goal'
        const done = g.done >= g.need
        li.dataset.done = String(done)
        li.dataset.game = g.href.replace(/\//g, '')
        const a = doc.createElement('a')
        a.href = g.href
        const span = (cls: string, text: string) => {
          const el = doc.createElement('span')
          el.className = cls
          el.textContent = text
          return el
        }
        const meter = span('wg-meter', '')
        meter.setAttribute('aria-hidden', 'true')
        meter.style.setProperty('--p', String(Math.min(1, g.done / g.need)))
        a.append(
          span('wg-game', g.game),
          span('wg-text', g.text),
          meter,
          span('wg-count', done ? 'Done ✓' : `${Math.min(g.done, g.need)} of ${g.need}`),
        )
        li.append(a)
        return li
      }),
    )
    if (weekComplete(goals)) {
      pinPostcard(state.week)
      card.textContent = `Postcard pinned: “${postcardFor(state.week)}” — Cath`
      card.hidden = false
    }
    section.hidden = false
  } catch {
    // Unreadable storage: no weekly card.
  }
}
