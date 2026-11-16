/**
 * Plan item 453: the tall phone's title opens once a day on a short scene: the stall's awning unrolls, Cath steps
 * in and waves, the tags drop onto the counter and Hollowell's vans start driving. 1200 ms at most, a tap skips it,
 * and reduced motion gets a plain fade. Under webdriver it plays only with `?opening` (which also replays it), so
 * specs keep their timing.
 */
export const OPENING_MS = 1200
export const OPENING_KEY = 'cathnivore:title-opening'
export const OPENING_MEDIA = '(max-width: 600px) and (min-height: 721px)'

export type OpeningEnv = {
  /** the day's key in the player's own time zone */
  day: string
  webdriver: boolean
  forced: boolean
  tallPhone: boolean
  store: Pick<Storage, 'getItem' | 'setItem'> | null
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Whether this load plays the opening; it records the day so the rest of the day's loads open straight on the menu. */
export function shouldOpen(env: OpeningEnv): boolean {
  if (env.forced) return true
  if (env.webdriver || !env.tallPhone || !env.store) return false
  try {
    if (env.store.getItem(OPENING_KEY) === env.day) return false
    env.store.setItem(OPENING_KEY, env.day)
    return true
  } catch {
    return false
  }
}

export function openingEnv(now = new Date()): OpeningEnv {
  if (typeof window === 'undefined') return { day: localDay(now), webdriver: false, forced: false, tallPhone: false, store: null }
  let store: Storage | null = null
  try {
    store = window.localStorage
  } catch {
    store = null
  }
  return {
    day: localDay(now),
    webdriver: navigator.webdriver === true,
    forced: new URLSearchParams(location.search).has('opening'),
    tallPhone: window.matchMedia?.(OPENING_MEDIA).matches ?? false,
    store,
  }
}

let thisLoad: boolean | undefined
/** Decided once per page load (React may run a state initialiser twice). */
export function openingThisLoad(): boolean {
  thisLoad ??= shouldOpen(openingEnv())
  return thisLoad
}
