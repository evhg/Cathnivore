// Plan item 530: on a phone the four game posters are one swiped shelf, a full-width poster at a time. The pager
// dots follow the poster in view; the arrow keys move between posters (focus and scroll), and a dot tapped scrolls
// to its poster. Native scroll snapping does the swiping.

export function shelfIndex(scrollLeft: number, step: number, count: number): number {
  if (step <= 0) return 0
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / step)))
}

export function mountShelf(doc: Document = document): void {
  const shelf = doc.querySelector<HTMLElement>('.hero-games')
  const dots = [...doc.querySelectorAll<HTMLElement>('#hero-dots i')]
  if (!shelf) return
  const posters = [...shelf.querySelectorAll<HTMLAnchorElement>('.hero-game')]
  const step = () => (posters.length > 1 ? posters[1]!.offsetLeft - posters[0]!.offsetLeft : 0)
  const sync = () => {
    const i = shelfIndex(shelf.scrollLeft, step(), posters.length)
    dots.forEach((d, k) => d.toggleAttribute('data-on', k === i))
    shelf.dataset.index = String(i)
  }
  shelf.addEventListener('scroll', sync, { passive: true })
  const go = (i: number, focus: boolean) => {
    const target = posters[Math.max(0, Math.min(posters.length - 1, i))]
    if (!target) return
    if (focus) target.focus({ preventScroll: true })
    shelf.scrollTo({ left: target.offsetLeft - posters[0]!.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  shelf.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const at = posters.indexOf(doc.activeElement as HTMLAnchorElement)
    if (at < 0) return
    e.preventDefault()
    go(at + (e.key === 'ArrowRight' ? 1 : -1), true)
  })
  dots.forEach((d, k) => d.addEventListener('click', () => go(k, false)))
  sync()
}
