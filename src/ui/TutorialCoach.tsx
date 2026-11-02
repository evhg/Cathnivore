import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CathArt from './CathArt'

// The guided tutorial's spotlight (chapter 1, owner 2026-11-02: "where to click should be super
// obvious"). Everything but the one element the step is about is dimmed and blocked; a pulsing ring
// marks it, and Cath's card says what to do and why. The step logic lives in Game.tsx and
// content/tutorial.ts; this only draws, blocks and handles the keyboard.
//
// The target is found by its `data-tutorial` id and re-measured every frame, so the hole follows it
// through scrolling, resizing and layout changes. Positions go through CSS custom properties
// (`setProperty`), never style attributes (CSP).

interface Props {
  // The `data-tutorial` id to spotlight; null dims the whole screen and centres the card.
  targetId: string | null
  text: string
  why?: string
  step: number // 1-based
  total: number
  // An explain step's (or the enemy turn's) button. Absent on an action step: the target is the way on.
  nextLabel?: string
  onNext?(): void
  onSkip(): void
  onRules?(): void
}

const GAP = 6 // between the target and its ring
const MARGIN = 12 // between the card and the screen edge or the ring

function isFocusable(el: Element | null): el is HTMLElement | SVGElement {
  if (!el) return false
  if (el instanceof HTMLButtonElement) return !el.disabled
  return el.getAttribute('tabindex') !== null
}

function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function TutorialCoach({ targetId, text, why, step, total, nextLabel, onNext, onSkip, onRules }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const titleId = useId()
  const whyId = useId()

  // Follow the target every frame (cheap: one rect read), writing the hole and card position only when
  // something actually moved.
  useLayoutEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      const root = rootRef.current
      const card = cardRef.current
      if (root && card) {
        const vw = window.innerWidth
        const vh = window.innerHeight
        const el = targetId ? document.querySelector(`[data-tutorial="${targetId}"]`) : null
        const r = el?.getBoundingClientRect()
        const has = !!r && r.width > 0 && r.height > 0
        const cw = card.offsetWidth
        const ch = card.offsetHeight
        let hx = 0
        let hy = 0
        let hw = 0
        let hh = 0
        let left = (vw - cw) / 2
        let top = (vh - ch) / 2
        let place = 'centre'
        let notch = cw / 2
        if (has && r) {
          hx = Math.max(0, r.left - GAP)
          hy = Math.max(0, r.top - GAP)
          hw = Math.min(vw, r.right + GAP) - hx
          hh = Math.min(vh, r.bottom + GAP) - hy
          const below = hy + hh + MARGIN
          const above = hy - MARGIN - ch
          if (below + ch <= vh - MARGIN) {
            top = below
            place = 'below'
          } else if (above >= MARGIN) {
            top = above
            place = 'above'
          } else {
            // No room either side (a tall target on a short screen): dock to the far edge.
            top = hy + hh / 2 > vh / 2 ? MARGIN : vh - ch - MARGIN
            place = 'docked'
          }
          const cx = hx + hw / 2
          left = Math.min(Math.max(cx - cw / 2, MARGIN), Math.max(MARGIN, vw - cw - MARGIN))
          notch = Math.min(Math.max(cx - left, 22), cw - 22)
        }
        const key = [has, hx, hy, hw, hh, left, top, place, notch].map((n) => (typeof n === 'number' ? Math.round(n) : n)).join(',')
        if (key !== last) {
          last = key
          root.dataset.target = has ? 'yes' : 'no'
          root.dataset.place = place
          const set = (k: string, v: number) => root.style.setProperty(k, `${Math.round(v)}px`)
          set('--hole-x', hx)
          set('--hole-y', hy)
          set('--hole-w', hw)
          set('--hole-h', hh)
          set('--card-x', left)
          set('--card-y', top)
          set('--notch-x', notch)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [targetId])

  // Each new step: bring its target into view, then move focus to it (or to the card's button), so a
  // keyboard player is always exactly where the step wants them.
  useEffect(() => {
    setConfirmSkip(false)
    const el = targetId ? document.querySelector(`[data-tutorial="${targetId}"]`) : null
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
    const focusTarget = isFocusable(el) ? el : cardRef.current?.querySelector<HTMLButtonElement>('.coach-primary')
    focusTarget?.focus({ preventScroll: true })
  }, [targetId, step])

  // The keyboard half of the hard gate: Tab only cycles between the target and the card's own buttons,
  // and Escape asks whether to skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setConfirmSkip((c) => !c)
        return
      }
      if (e.key !== 'Tab') return
      const el = targetId ? document.querySelector(`[data-tutorial="${targetId}"]`) : null
      const stops: Array<HTMLElement | SVGElement> = []
      if (isFocusable(el)) stops.push(el)
      cardRef.current?.querySelectorAll('button').forEach((b) => stops.push(b))
      if (stops.length === 0) return
      e.preventDefault()
      const i = stops.indexOf(document.activeElement as HTMLElement)
      const next = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : (i + 1) % stops.length
      stops[next]!.focus()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [targetId])

  useEffect(() => {
    if (confirmSkip) cardRef.current?.querySelector<HTMLButtonElement>('.coach-keep')?.focus()
  }, [confirmSkip])

  return createPortal(
    // `data-for` names the spotlit element, for tests that click only what the tutorial points at.
    <div className="coach" ref={rootRef} data-target="no" data-place="centre" data-for={targetId ?? ""}>
      {/* Four blockers frame the hole: they dim the screen and swallow every click that isn't on the target. */}
      <div className="coach-block coach-block-top" aria-hidden="true" />
      <div className="coach-block coach-block-bottom" aria-hidden="true" />
      <div className="coach-block coach-block-left" aria-hidden="true" />
      <div className="coach-block coach-block-right" aria-hidden="true" />
      <div className="coach-ring" aria-hidden="true">
        {!onNext && <span className="coach-tap">Tap here</span>}
      </div>
      <section className="coach-card" ref={cardRef} role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={why ? whyId : undefined}>
        <header className="coach-head">
          <span className="coach-cameo" aria-hidden="true">
            <CathArt framing="face" expression="smirk" width={34} height={42} />
          </span>
          <span className="coach-meta">
            <span className="coach-who">Cath</span>
            <span className="coach-count">
              Step {step} of {total}
            </span>
          </span>
          {onRules && (
            <button type="button" className="tooltip-trigger-button tooltip-info coach-rules" aria-label="Open the rules reference" onClick={onRules}>
              ?
            </button>
          )}
        </header>
        <div aria-live="polite">
          <p className="coach-what" id={titleId}>
            {text}
          </p>
          {why && (
            <p className="coach-why" id={whyId}>
              <span className="coach-why-label">Why: </span>
              {why}
            </p>
          )}
        </div>
        {confirmSkip ? (
          <div className="coach-confirm">
            <p>Skip the tutorial? You can replay it from Settings or the campaign.</p>
            <div className="coach-keys">
              <button type="button" className="coach-skip-yes" onClick={onSkip}>
                Yes, skip it
              </button>
              <button type="button" className="primary coach-keep" onClick={() => setConfirmSkip(false)}>
                Keep going
              </button>
            </div>
          </div>
        ) : (
          <div className="coach-keys">
            <button type="button" className="btn-quiet coach-skip" onClick={() => setConfirmSkip(true)}>
              Skip tutorial
            </button>
            {onNext && (
              <button type="button" className="primary coach-primary" onClick={onNext}>
                {nextLabel ?? 'Next'}
              </button>
            )}
          </div>
        )}
        <span className="coach-progress" aria-hidden="true">
          <span className="coach-progress-fill" data-step={step} ref={(el) => el?.style.setProperty('--coach-progress', `${(step / total) * 100}%`)} />
        </span>
      </section>
    </div>,
    document.body,
  )
}
