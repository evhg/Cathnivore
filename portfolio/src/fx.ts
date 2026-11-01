// The page's small interactions. Every one is an enhancement: the HTML reads fully without JS, and with
// reduced motion each shows its final state at once. Styles are written only through custom properties
// (setProperty), so the strict CSP (no inline styles) holds.

const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * The kinetic headline: each letter becomes a span whose weight and optical size follow the pointer, so
 * the type swells as you move across it. The heading keeps its text for assistive tech (aria-label).
 */
export function kinetic(el: HTMLElement, reduced: boolean): void {
  const text = el.textContent ?? ''
  el.setAttribute('aria-label', text.replace(/\u00a0/g, ' '))
  el.textContent = ''
  const letters: HTMLElement[] = []
  let i = 0
  // Words split on spaces; a no-break space keeps its neighbours on one line, as in the source.
  const parts = text.split(/( |\u00a0)/)
  parts.forEach((word) => {
    if (word === ' ' || word === '\u00a0') {
      el.append(word)
      return
    }
    if (!word) return
    const w = document.createElement('span')
    w.className = 'kw'
    w.setAttribute('aria-hidden', 'true')
    const chars = [...word]
    chars.forEach((ch, k) => {
      const l = document.createElement('span')
      l.className = 'kl'
      l.textContent = ch
      l.style.setProperty('--i', String(i++))
      l.style.setProperty('--k', String(chars.length > 1 ? k / (chars.length - 1) : 0))
      w.append(l)
      letters.push(l)
    })
    el.append(w)
  })
  el.classList.add('split')
  if (reduced || !fine()) return

  let centres: Array<[number, number]> = []
  const measure = () => {
    centres = letters.map((l) => {
      const r = l.getBoundingClientRect()
      return [r.left + r.width / 2, r.top + r.height / 2 + scrollY]
    })
  }
  measure()
  addEventListener('resize', measure, { passive: true })
  document.fonts?.ready.then(measure)

  let px = -1e4
  let py = -1e4
  let queued = false
  const paint = () => {
    queued = false
    const reach = Math.max(160, innerWidth * 0.16)
    letters.forEach((l, k) => {
      const [cx, cy] = centres[k]!
      const d = Math.hypot(cx - px, cy - (py + scrollY))
      const near = Math.max(0, 1 - d / reach)
      const ease = near * near * (3 - 2 * near)
      l.style.setProperty('--wg', String(Math.round(380 + ease * 520)))
      l.style.setProperty('--lift', String(ease))
    })
  }
  addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX
      py = e.clientY
      if (!queued) {
        queued = true
        requestAnimationFrame(paint)
      }
    },
    { passive: true },
  )
}

/** Cards follow the pointer: a soft spotlight under it, and a few degrees of 3D tilt. */
export function cards(root: ParentNode): void {
  if (!fine()) return
  for (const card of root.querySelectorAll<HTMLElement>('.card')) {
    let raf = 0
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
        card.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`)
        card.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`)
      })
    })
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf)
      card.style.setProperty('--rx', '0deg')
      card.style.setProperty('--ry', '0deg')
    })
  }
}

/** Numbers count up the first time they scroll into view. */
export function counters(root: ParentNode, reduced: boolean): void {
  if (reduced) return
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io.unobserve(e.target)
        const el = e.target as HTMLElement
        const to = Number(el.dataset.count)
        const t0 = performance.now()
        const dur = 900 + to * 25
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / dur)
          el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 4))))
          if (k < 1) requestAnimationFrame(step)
        }
        el.textContent = '0'
        requestAnimationFrame(step)
      }
    },
    { threshold: 0.6 },
  )
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => io.observe(el))
}

/** The thesis lights up word by word as it scrolls through (CSS scroll-driven animation does the work). */
export function words(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-words]')) {
    const text = el.textContent ?? ''
    el.textContent = ''
    const parts = text.split(' ')
    parts.forEach((w, i) => {
      const s = document.createElement('span')
      s.className = 'word'
      s.textContent = w
      s.style.setProperty('--w', String(i / parts.length))
      el.append(s, i < parts.length - 1 ? ' ' : '')
    })
  }
}

/** Shared-element names for cross-document view transitions: a card's visual morphs into its case page. */
export function viewTransitionNames(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-vt]').forEach((el) => el.style.setProperty('view-transition-name', `v-${el.dataset.vt}`))
}

/** The live dot: when the site last shipped, read from /version.json (written at every release build). */
export async function pulse(el: HTMLElement | null): Promise<void> {
  if (!el) return
  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const { buildTime } = (await res.json()) as { buildTime?: string }
    const at = buildTime ? Date.parse(buildTime) : NaN
    if (!Number.isFinite(at)) return
    el.textContent = `Last shipped ${ago(Date.now() - at)}`
  } catch {
    // Offline or blocked: the static text stays.
  }
}

export function ago(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 2) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}
