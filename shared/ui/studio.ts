// The house back link every game uses (docs/design/aaa-ui.md): a 44 px button with the studio's
// hex-and-leaf monogram, drawn as code, plus "Games". Import shared/ui/studio.css alongside it.

export interface StudioBackOptions {
  /** Visible label, "Games" by default. */
  label?: string
  /** Where it goes, the landing page by default. */
  href?: string
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** The monogram: a hexagon (the Marrow map tile) holding a leaf, with a back chevron on its left edge. */
export function studioMonogram(doc: Document = document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 32 32')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const add = (tag: string, attrs: Record<string, string>): void => {
    const el = doc.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    svg.appendChild(el)
  }
  add('path', { class: 'studio-hex', d: 'M17 4.5 26.5 10v12L17 27.5 7.5 22V10Z' })
  add('path', { class: 'studio-leaf', d: 'M13.2 20.4c-.4-5.2 3.1-8.6 9-9.2-.2 5.9-3.6 9.5-9 9.2Zm1.1-.9c1.8-2.4 3.7-4.3 6.2-5.9' })
  add('path', { class: 'studio-chev', d: 'M5.5 12.5 2 16l3.5 3.5' })
  return svg
}

/** Builds the back link. The accessible name is the label ("Games"), which e2e specs rely on. */
export function studioBack(opts: StudioBackOptions = {}, doc: Document = document): HTMLAnchorElement {
  const a = doc.createElement('a')
  a.className = 'studio-back'
  a.href = opts.href ?? '/'
  a.appendChild(studioMonogram(doc))
  const span = doc.createElement('span')
  span.textContent = opts.label ?? 'Games'
  a.appendChild(span)
  return a
}
