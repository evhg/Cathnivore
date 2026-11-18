// Plan item 503: the title's board previews the next chapter. About every 10 s while the title is visible, the
// next unwon chapter's region plays item 127's liberation flip, holds green for 2 s and eases back, and Cath
// points to it with one line. The beat lives in this tiny store so only the beat's overlay and Cath re-render,
// never the board (a Map re-render is the expensive part of the title).

import { useSyncExternalStore } from 'react'
import type { RegionId } from '../engine/types'

/** The first beat waits this long after the page's load event (gate 7: nothing new runs while Lighthouse measures). */
export const BEAT_FIRST_MS = 9000
/** One beat about every 10 s (acceptance: at most one per 8 s). */
export const BEAT_EVERY_MS = 10000
/** The flip (about 1.2 s), the green held 2 s, and the ease back. */
export const BEAT_MS = 3600
/** A beat that finds the menu in use, the tab hidden or the phone's opening playing waits this long and asks again. */
const RETRY_MS = 2000

export interface TitleBeat {
  region: RegionId
  /** Bumped every beat so its CSS animations restart. */
  n: number
}

let current: TitleBeat | null = null
const listeners = new Set<() => void>()
function set(next: TitleBeat | null) {
  current = next
  for (const l of listeners) l()
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
/** The beat playing now, or null. */
export function useTitleBeat(): TitleBeat | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

/** Whether the beat should hold off this instant: the menu under the pointer or keyboard, the tab hidden, the opening on. */
function busy(): boolean {
  if (document.hidden) return true
  if (document.querySelector('.title-menu:hover, .title-menu :focus-visible')) return true
  return document.querySelector('[data-opening="run"]') !== null
}

/** Whether this page runs the loop: never under webdriver unless the URL asks (`?attract`). */
export function attractOn(search: string, webdriver: boolean): boolean {
  return !webdriver || new URLSearchParams(search).has('attract')
}

/** Starts the loop for one region; returns its stop. `fast` (`?attract`) starts the first beat soon after load. */
export function startTitleBeats(region: RegionId, fast = false): () => void {
  let t = 0
  let n = 0
  let stopped = false
  const schedule = (ms: number, fn: () => void) => {
    window.clearTimeout(t)
    t = window.setTimeout(fn, ms)
  }
  const play = () => {
    if (stopped) return
    if (busy()) return schedule(RETRY_MS, play)
    n += 1
    set({ region, n })
    schedule(BEAT_MS, () => {
      set(null)
      schedule(BEAT_EVERY_MS - BEAT_MS, play)
    })
  }
  const first = fast ? 1500 : BEAT_FIRST_MS
  const onLoad = () => schedule(first, play)
  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad, { once: true })
  return () => {
    stopped = true
    window.clearTimeout(t)
    window.removeEventListener('load', onLoad)
    if (current) set(null)
  }
}
