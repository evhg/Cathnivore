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
        const a = doc.createElement('a')
        a.href = g.href
        a.textContent = `${g.game}: ${g.text}`
        const n = doc.createElement('span')
        n.textContent = done ? '✓' : `${Math.min(g.done, g.need)}/${g.need}`
        li.append(a, n)
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
