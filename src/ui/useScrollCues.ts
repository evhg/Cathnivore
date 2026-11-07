import { useEffect, useState } from 'react'

// AAA UI M4: a list that scrolls inside a frame must look like a list with more in it, not like a card
// cut in half by broken layout. Every `[data-scroll-cue]` element under `root` gets
//   - `data-fade-top` / `data-fade-bottom` / `data-fade-right` while there is more to scroll that way (CSS masks the
//     edge; the phone's sideways hand of cards shows a chevron tab),
//   - and its parent frame gets `data-more="<n>"`, the number of rows wholly or partly below the fold,
//     which CSS prints as a small "n more" tab on the frame's bottom edge, and `data-next="<group>"`, the
//     heading of the group the first hidden row is in (the desktop Actions frame names it: "Play · 8 more").
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
      // Critique 2026-11-03: a row that scrolls sideways (the phone's hand of action cards) says so too.
      const right = el.scrollWidth - el.clientWidth > 2 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      toggle(el, 'fadeRight', right)
      // Plan item 266: and how many cards lie past the edge (a card more than half out counts), so the tab says so.
      if (right) {
        const edge = el.getBoundingClientRect().right
        let n = 0
        for (const c of Array.from(el.children)) {
          const r = c.getBoundingClientRect()
          if (r.width > 0 && r.left + r.width / 2 > edge && !c.matches('[aria-hidden="true"], .action-head')) n++
        }
        const v = n > 9 ? '9+' : String(n)
        if (el.dataset.moreRight !== v) el.dataset.moreRight = v
      } else if (el.dataset.moreRight !== undefined) delete el.dataset.moreRight
      const owner = el.parentElement
      if (!owner) return
      let more = 0
      // The group the first hidden row belongs to (the Actions frame's "Play", "Supply"...), so the cue
      // names what is below instead of leaving a faded card top to guess at.
      let next = ''
      if (bottom) {
        const fold = el.getBoundingClientRect().bottom - 8
        // A scroller that wraps one list (the Log's <ol>) counts that list's rows.
        const rows = el.children.length === 1 && el.firstElementChild?.matches('ol, ul') ? el.firstElementChild.children : el.children
        let head = ''
        let headEl: Element | null = null
        let orphan: Element | null = null
        // Plan item 98: rows cut by the fold that show only in the fade (under the tab that counts them).
        const cut: Element[] = []
        const edge = el.getBoundingClientRect().bottom
        let shownInGroup = 0
        for (const child of Array.from(rows)) {
          if (child.matches('.action-head')) {
            head = child.textContent?.trim() ?? ''
            headEl = child
            shownInGroup = 0
          }
          const r = child.getBoundingClientRect()
          if (r.height > 0 && r.bottom <= fold && !(el.matches('.actions') && edge - r.top < 80) && !child.matches('.action-head')) shownInGroup++
          // Plan item 98: a row that starts in the fold's fade counts as below it too (it showed only as a sliver).
          const inFade = el.matches('.actions') && edge - r.top < 80
          if (r.height > 0 && (r.bottom > fold || inFade) && !child.matches('[aria-hidden="true"], .action-head, .log-round')) {
            if (!more) {
              next = head
              // Plan item 79: the group's heading is still above the fold with none of its rows: it would only
              // ghost through the fade over the tab that already names it.
              if (headEl && !shownInGroup && headEl.getBoundingClientRect().top < fold) orphan = headEl
            }
            if (inFade && r.top < edge) cut.push(child)
            more++
          }
        }
        const folded = new Set<Element>(cut)
        if (orphan) folded.add(orphan)
        for (const h of Array.from(el.querySelectorAll('[data-at-fold]'))) if (!folded.has(h)) h.removeAttribute('data-at-fold')
        for (const h of folded) if (!h.hasAttribute('data-at-fold')) h.setAttribute('data-at-fold', '')
      } else for (const h of Array.from(el.querySelectorAll('[data-at-fold]'))) h.removeAttribute('data-at-fold')
      if (more > 0) owner.dataset.more = String(more)
      else delete owner.dataset.more
      if (more > 0 && next) {
        if (owner.dataset.next !== next) owner.dataset.next = next
      } else delete owner.dataset.next
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

function toggle(el: HTMLElement, key: 'fadeTop' | 'fadeBottom' | 'fadeRight', on: boolean) {
  if (on) {
    if (el.dataset[key] !== '') el.dataset[key] = ''
  } else if (key in el.dataset) {
    delete el.dataset[key]
  }
}
