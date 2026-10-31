// In-game "Cath's Week" chip (ROADMAP 233): a one-line progress pill that links back to the games page.
// Pure text builder (unit-tested) plus a tiny mount helper. Silent when storage is unreadable.

import { loadWeek, weekComplete, weekGoals, type WeekGoal } from './week'
import { readProgress } from './wardrobe'

export function weekChipText(goals: WeekGoal[]): string {
  const done = goals.filter((g) => g.done >= g.need).length
  if (weekComplete(goals)) return "Cath's Week: complete ✓"
  const next = goals.find((g) => g.done < g.need)!
  return `Cath's Week ${done}/${goals.length} · ${next.game}: ${next.text.toLowerCase()}`
}

export function mountWeekChip(host: HTMLElement | null, doc: Document = document): void {
  try {
    if (!host) return
    const now = readProgress()
    const goals = weekGoals(now, loadWeek(now, new Date()).base)
    const a = doc.createElement('a')
    a.className = 'week-chip'
    a.href = '/games/#week'
    a.dataset.done = String(weekComplete(goals))
    a.textContent = weekChipText(goals)
    host.append(a)
  } catch {
    // No chip without storage.
  }
}
