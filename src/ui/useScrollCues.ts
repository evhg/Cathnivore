import { useEffect, useState } from 'react'

// AAA UI M4: a list that scrolls inside a frame must look like a list with more in it, not like a card
// cut in half by broken layout. Every `[data-scroll-cue]` element under `root` gets
//   - `data-fade-top` / `data-fade-bottom` while there is more to scroll that way (CSS masks the edge),
//   - and its parent frame gets `data-more="<n>"`, the number of rows wholly or partly below the fold,
//     which CSS prints as a small "n more" tab on the frame's bottom edge.
// Attributes only, no inline styles (CSP). Re-measured on scroll, resize and any DOM change under root.
// Returns a callback ref for the root, so the cues bind whenever that element mounts.
export function useScrollCues(): (el: HTMLElement | null) => void {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!host) return
    let frame = 0
    const tracked = new Set<HTMLElement>()

    const measure = (el: HTMLElement) => {
      const overflow = el.scrollHeight - el.clientHeight > 2
      const top = overflow && el.scrollTop > 2
      const bottom = overflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2
      toggle(el, 'fadeTop', top)
      toggle(el, 'fadeBottom', bottom)
      const owner = el.parentElement
      if (!owner) return
      let more = 0
      if (bottom) {
        const fold = el.getBoundingClientRect().bottom - 8
        // A scroller that wraps one list (the Log's <ol>) counts that list's rows.
        const rows = el.children.length === 1 && el.firstElementChild?.matches('ol, ul') ? el.firstElementChild.children : el.children
        for (const child of Array.from(rows)) {
          const r = child.getBoundingClientRect()
          if (r.height > 0 && r.bottom > fold && !child.matches('[aria-hidden="true"], .action-head, .log-round')) more++
        }
      }
      if (more > 0) owner.dataset.more = String(more)
      else delete owner.dataset.more
    }

    const scan = () => {
      frame = 0
      for (const el of Array.from(host.querySelectorAll<HTMLElement>('[data-scroll-cue]'))) {
        if (!tracked.has(el)) {
          tracked.add(el)
          el.addEventListener('scroll', () => measure(el), { passive: true })
          resize?.observe(el)
        }
        measure(el)
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan)
    }
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    const mutations = new MutationObserver(schedule)
    mutations.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] })
    window.addEventListener('resize', schedule)
    scan()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      resize?.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [host])
  return setHost
}

function toggle(el: HTMLElement, key: 'fadeTop' | 'fadeBottom', on: boolean) {
  if (on) {
    if (el.dataset[key] !== '') el.dataset[key] = ''
  } else if (key in el.dataset) {
    delete el.dataset[key]
  }
}
