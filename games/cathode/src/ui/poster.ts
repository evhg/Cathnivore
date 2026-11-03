// Plan item 65: the front door's poster, a baked frame of the title's street (scripts/cathode-poster.mjs) shown from
// the first paint, behind the menu, until the live street has drawn its first frame. Which file a screen loads.

export const POSTER_LANDSCAPE = [640, 960, 1440] as const
export const POSTER_PORTRAIT = [520, 780] as const

/** The poster for a viewport (CSS px) and device pixel ratio: portrait art on an upright screen, the smallest file at least as wide as the screen's pixels. */
export function posterFor(width: number, height: number, dpr = 1): string {
  const portrait = height > width
  const widths: readonly number[] = portrait ? POSTER_PORTRAIT : POSTER_LANDSCAPE
  const need = width * Math.min(dpr, 2)
  const w = widths.find((x) => x >= need) ?? widths[widths.length - 1]!
  return `front-poster${portrait ? "-portrait" : ""}-${w}.webp`
}

/** The same choice for the HTML <picture>: the srcsets index.html carries. */
export function posterSrcset(base: string, portrait: boolean): string {
  const widths: readonly number[] = portrait ? POSTER_PORTRAIT : POSTER_LANDSCAPE
  return widths.map((w) => `${base}front-poster${portrait ? "-portrait" : ""}-${w}.webp ${w}w`).join(", ")
}
