// Plan item 183: the Not-yet shelf's 'Saving for' goal. A producer pins one priced card off the shelf; a jar beside
// it fills with the coins they hold toward its price, and it lifts into the hand once affordable.
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'

export type ShelfGoal = `invest:${string}` | `scheme:${string}`

export const investGoal = (improvementId: string): ShelfGoal => `invest:${improvementId}`
export const schemeGoal = (schemeId: string): ShelfGoal => `scheme:${schemeId}`

/** A goal names a card that exists: an Improvement (paid in Marks) or a Scheme (paid in Goodwill). */
export function isShelfGoal(goal: string): goal is ShelfGoal {
  const [kind, id] = [goal.slice(0, goal.indexOf(':')), goal.slice(goal.indexOf(':') + 1)]
  if (kind === 'invest') return IMPROVEMENTS_BY_ID.has(id)
  if (kind === 'scheme') return SCHEMES_BY_ID.has(id)
  return false
}

/** The goal's name and coin, for Cath's line and the jar's label. */
export function goalCard(goal: string): { name: string; coin: 'Marks' | 'Goodwill' } | undefined {
  const id = goal.slice(goal.indexOf(':') + 1)
  if (goal.startsWith('invest:')) {
    const c = IMPROVEMENTS_BY_ID.get(id)
    return c && { name: c.name, coin: 'Marks' }
  }
  if (goal.startsWith('scheme:')) {
    const c = SCHEMES_BY_ID.get(id)
    return c && { name: c.name, coin: 'Goodwill' }
  }
  return undefined
}

/** Plan item 183: at D the shelf shows one row: the pinned goal first, then the rest in their order, at most `row`. */
export function shelfOrder<T>(items: readonly T[], keyOf: (t: T) => string, goal: string | undefined, row = 3): { shown: T[]; folded: T[] } {
  const pinned = goal ? items.filter((t) => keyOf(t) === goal) : []
  const rest = items.filter((t) => !pinned.includes(t))
  const all = [...pinned, ...rest]
  return { shown: all.slice(0, row), folded: all.slice(row) }
}
