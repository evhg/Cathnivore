// Plan item 483: starting a chapter is a staged departure from the atlas to the table, not a cut. The chapter's
// home regions lift and glow at once, the atlas zooms in on them, Cath steps toward them with her crates and the
// paper rustles; then the screen fades into the story scene (or the table). A tap skips it; reduced motion keeps
// a short fade. Under webdriver it stays off (specs click straight through) unless the page has `?depart`.

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** The departure's full length, and its length under reduced motion (a plain fade). */
export const DEPART_MS = 900
export const DEPART_STILL_MS = 200

export function departureOn(search: string, webdriver: boolean): boolean {
  return !webdriver || new URLSearchParams(search).has('depart')
}

/**
 * The zoom that brings the chapter's home regions to fill about 70% of the map's box: its origin (in px from the
 * map's top-left corner, so `transform-origin` scales about the homes' centre), its scale (1.4 to 3), and Cath's
 * step toward the homes (at most 56 px either way along x, a little up), and a drift (dx, dy) that carries the
 * homes 70% of the way to the map's centre.
 */
export function departFrame(homes: Box[], map: Box, cath?: Box): { x: number; y: number; scale: number; step: number; dx: number; dy: number } {
  if (!homes.length || !map.width || !map.height) return { x: map.width / 2, y: map.height / 2, scale: 1.4, step: 0, dx: 0, dy: 0 }
  const left = Math.min(...homes.map((h) => h.left))
  const top = Math.min(...homes.map((h) => h.top))
  const right = Math.max(...homes.map((h) => h.left + h.width))
  const bottom = Math.max(...homes.map((h) => h.top + h.height))
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const fit = Math.min((map.width * 0.7) / Math.max(1, right - left), (map.height * 0.7) / Math.max(1, bottom - top))
  const scale = Math.max(1.4, Math.min(3, fit))
  const step = cath ? Math.max(-56, Math.min(56, (cx - (cath.left + cath.width / 2)) * 0.25)) : 0
  // and the homes drift most of the way to the map's centre as it zooms, so the flight ends on them
  const dx = Math.round((map.left + map.width / 2 - cx) * 0.7)
  const dy = Math.round((map.top + map.height / 2 - cy) * 0.7)
  return { x: cx - map.left, y: cy - map.top, scale: Math.round(scale * 100) / 100, step: Math.round(step), dx, dy }
}
