// Gate 7: the production build links only the title's critical stylesheet render-blocking and names the full one
// in a meta tag (scripts/critical-css.ts). This loads the full sheet once; the Game screen awaits it so the table
// never draws unstyled. In dev (no meta tag) every rule is already on the page and this resolves at once.

let pending: Promise<void> | null = null

export function loadFullCss(): Promise<void> {
  if (pending) return pending
  const href = document.querySelector<HTMLMetaElement>('meta[name="cathnivore-full-css"]')?.content
  if (!href) return (pending = Promise.resolve())
  pending = new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
  return pending
}
