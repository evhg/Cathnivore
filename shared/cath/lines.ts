// Plan item 442: Cath's line weight at small sizes. Her SVG strokes are in viewBox units, so a 1.8-unit
// outline drawn 96 px tall (the full figure's viewBox is 870 units) comes out about 0.2 px: a grey smear,
// not an ink line. A size container can't measure an <svg> (size containment drops its aspect ratio and
// collapses it), so one shared ResizeObserver writes each figure's scale onto it instead: `--cath-s`, the
// screen px per viewBox unit, and `data-cath-lod="small"` when that scale would leave her outlines under
// about 0.8 px. cath.css then draws her lines as non-scaling strokes, floored at 1 px (outlines) or 0.75 px
// (detail lines), and drops the sub-unit texture strokes (stitching, dashes) that only blur at that size.
// Large figures (s >= SMALL_BELOW) are left exactly as drawn.

/** Below this many screen px per viewBox unit a 1.8-unit outline renders under 0.8 px. */
export const SMALL_BELOW = 0.45

/** Screen px per viewBox unit for an SVG laid out at `width` x `height` (preserveAspectRatio meet). */
export function cathScale(width: number, height: number, viewBox: string): number {
  const [, , vw = 0, vh = 0] = viewBox.trim().split(/[\s,]+/).map(Number)
  if (!(vw > 0) || !(vh > 0) || !(width > 0) || !(height > 0)) return 0
  return Math.min(width / vw, height / vh)
}

/** The level of detail for a scale: 'small' floors her lines (cath.css), 'full' draws them as authored. */
export function cathLod(scale: number): 'small' | 'full' {
  return scale > 0 && scale < SMALL_BELOW ? 'small' : 'full'
}

function apply(svg: SVGSVGElement, width: number, height: number): void {
  const s = cathScale(width, height, svg.getAttribute('viewBox') ?? '')
  if (!s) return
  // CSSOM custom property, not a style attribute: the site's CSP forbids inline style attributes in markup.
  svg.style.setProperty('--cath-s', s.toFixed(4))
  const lod = cathLod(s)
  if (svg.getAttribute('data-cath-lod') !== lod) svg.setAttribute('data-cath-lod', lod)
}

let resize: ResizeObserver | undefined

function observe(svg: Element): void {
  if (!(svg instanceof SVGSVGElement) || svg.hasAttribute('data-cath-lod')) return
  const r = svg.getBoundingClientRect()
  svg.setAttribute('data-cath-lod', 'full')
  apply(svg, r.width, r.height)
  resize!.observe(svg)
}

function scan(node: Node): void {
  if (node.nodeType !== 1) return
  const el = node as Element
  if (el.classList.contains('cath') && el.tagName.toLowerCase() === 'svg') observe(el)
  else for (const svg of Array.from(el.getElementsByClassName('cath'))) observe(svg)
}

/** Start watching every `svg.cath` on the page (idempotent; a no-op outside a browser). */
export function watchCathLines(): void {
  if (resize || typeof window === 'undefined' || typeof ResizeObserver === 'undefined' || typeof MutationObserver === 'undefined') return
  resize = new ResizeObserver((entries) => {
    for (const e of entries) {
      const svg = e.target as SVGSVGElement
      if (!svg.isConnected) {
        resize!.unobserve(svg)
        svg.removeAttribute('data-cath-lod')
        continue
      }
      const box = e.contentRect
      apply(svg, box.width, box.height)
    }
  })
  const start = () => {
    scan(document.documentElement)
    new MutationObserver((records) => {
      for (const rec of records) for (const n of Array.from(rec.addedNodes)) scan(n)
    }).observe(document.documentElement, { childList: true, subtree: true })
  }
  if (document.documentElement) start()
}
