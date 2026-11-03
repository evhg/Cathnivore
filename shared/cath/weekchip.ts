// In-game "Cath's Week" chip (ROADMAP 233): a one-line progress pill that links back to the games page.
// Pure text builder (unit-tested) plus a tiny mount helper. Silent when storage is unreadable.

import { loadWeek, weekComplete, weekGoals, type WeekGoal } from './week'
import { readProgress } from './wardrobe'

/**
 * The chip's line. Inside a game (`game` set) it names only that game's own goal (plan item 47: Hedgerow's title
 * named a Runnel goal); with this game's goal met, or none here, it gives the week's count.
 */
export function weekChipText(goals: WeekGoal[], game?: string): string {
  const done = goals.filter((g) => g.done >= g.need).length
  if (weekComplete(goals)) return "Cath's Week: complete ✓"
  const head = `Cath's Week ${done}/${goals.length}`
  if (game !== undefined) {
    const own = goals.find((g) => g.game === game)
    if (!own) return head
    if (own.done >= own.need) return `${head} · ${own.game} done ✓`
    return `${head} · ${own.text} (${own.done}/${own.need})`
  }
  const next = goals.find((g) => g.done < g.need)!
  return `${head} · ${next.game}: ${next.text.toLowerCase()}`
}

export function mountWeekChip(host: HTMLElement | null, game?: string, doc: Document = document): void {
  try {
    if (!host) return
    const now = readProgress()
    const goals = weekGoals(now, loadWeek(now, new Date()).base)
    const a = doc.createElement('a')
    a.className = 'week-chip'
    a.href = '/games/#week'
    a.dataset.done = String(weekComplete(goals))
    a.textContent = weekChipText(goals, game)
    host.append(a)
  } catch {
    // No chip without storage.
  }
}
