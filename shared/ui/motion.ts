// AAA UI shared motion helpers (docs/design/aaa-ui.md "Motion conventions"). No build step, no
// dependencies: every game imports this file directly.
//
// Every helper writes the final state at once when motion is off: the OS asks for reduced motion,
// `html.reduce-motion` is set (Cathnivore's no-animations setting, CATHODE's toggle), or the page is
// driven by a test (navigator.webdriver), which keeps e2e deterministic. Per-element values go through
// style.setProperty only (CSP: never a style attribute, never a direct style property write).

type Vars = Record<string, string | number>

export function reducedMotion(): boolean {
  const g = globalThis as {
    navigator?: { webdriver?: boolean }
    document?: { documentElement?: { classList?: { contains(c: string): boolean } } }
    matchMedia?: (q: string) => { matches: boolean }
  }
  if (g.navigator?.webdriver) return true
  if (g.document?.documentElement?.classList?.contains('reduce-motion')) return true
  return !!g.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Sets CSS custom properties on an element (names with or without the leading `--`). */
export function setVars(el: { style: { setProperty(n: string, v: string): void } }, vars: Vars): void {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k.startsWith('--') ? k : `--${k}`, String(v))
}

/** Gives each child its `--i` (capped) and the parent `.stagger`, so base.css staggers them in. */
export function stagger(parent: HTMLElement, cap = 10): void {
  const kids = Array.from(parent.children) as HTMLElement[]
  kids.forEach((k, i) => setVars(k, { i: Math.min(i, cap) }))
  parent.classList.add('stagger')
}

export interface CountUpOptions {
  ms?: number
  fmt?: (n: number) => string
  from?: number
}

/** Counts an element's text up to `to`, ending exactly on it. Jumps straight there when motion is off. */
export function countUp(el: HTMLElement, to: number, opts: CountUpOptions = {}): Promise<void> {
  const fmt = opts.fmt ?? ((n: number) => String(Math.round(n)))
  const ms = opts.ms ?? 900
  const raf = (globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame
  if (reducedMotion() || ms <= 0 || !raf) {
    el.textContent = fmt(to)
    return Promise.resolve()
  }
  const from = opts.from ?? 0
  return new Promise((resolve) => {
    let start = -1
    const step = (t: number): void => {
      if (start < 0) start = t
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - (1 - p) ** 3
      el.textContent = fmt(p >= 1 ? to : from + (to - from) * eased)
      if (p < 1) raf(step)
      else resolve()
    }
    raf(step)
  })
}

/** A one-shot tick on a counter that just changed. */
export function tick(el: HTMLElement): void {
  if (reducedMotion()) return
  el.classList.remove('ui-tick')
  void el.offsetWidth // restart the animation
  el.classList.add('ui-tick')
  el.addEventListener('animationend', () => el.classList.remove('ui-tick'), { once: true })
}

export interface BurstOptions {
  color?: string
  /** At most 12 nodes. */
  n?: number
  ring?: boolean
  dist?: number
}

/** A small particle burst inside `host` (position it relatively). Removes itself on animationend, with a
 *  1.2 s safety timeout. Returns null (and draws nothing) when motion is off. */
export function burst(host: HTMLElement, opts: BurstOptions = {}): HTMLElement | null {
  if (reducedMotion()) return null
  const doc = host.ownerDocument
  const n = Math.max(1, Math.min(12, opts.n ?? 8))
  const wrap = doc.createElement('span')
  wrap.className = opts.ring ? 'ui-burst ring' : 'ui-burst'
  wrap.setAttribute('aria-hidden', 'true')
  if (opts.color) setVars(wrap, { burst: opts.color })
  for (let i = 0; i < n; i++) {
    const dot = doc.createElement('i')
    setVars(dot, { ang: `${Math.round((360 / n) * i)}deg`, dist: `${opts.dist ?? 40}px` })
    wrap.appendChild(dot)
  }
  host.appendChild(wrap)
  let gone = false
  const remove = (): void => {
    if (gone) return
    gone = true
    wrap.remove()
  }
  wrap.lastElementChild?.addEventListener('animationend', remove, { once: true })
  setTimeout(remove, 1200)
  return wrap
}
