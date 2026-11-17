// Plan item 476: the round's Harvest as a moment on the table. Each good the engine pays out (`harvestSources`)
// rises from the ground it comes from (the producer's home hex, or Shingle Bay for the Oyster Beds bonus) and arcs
// to that producer's bust at the table, in seat order, over 900-1600 ms. A tap anywhere ends it at once; under
// reduced motion nothing flies (the counts already show the totals).
import { useEffect, useLayoutEffect, useState } from 'react'
import type { HarvestGood } from '../engine/harvest'
import type { ProducerId, ResourceKind } from '../engine/types'
import { harvestTiming } from './harvestTiming'

/** Plan item 476: each good as the mat paints it (PlayerMat.tsx): a piece of veg, a Mark coin, a Goodwill rosette. */
function GoodArt({ unit }: { unit: ResourceKind }) {
  return (
    <svg className="harvest-art" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {unit === 'produce' && (
        <>
          <circle cx="16" cy="18" r="10" fill="var(--clay)" stroke="var(--ink)" strokeWidth="1.2" />
          <path d="M14 8.5 q2.5 -5 6.5 -3.6" fill="none" stroke="var(--pasture-deep)" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="12.5" cy="15" rx="3" ry="2" fill="var(--paper-hi)" opacity=".45" />
        </>
      )}
      {unit === 'marks' && (
        <>
          <ellipse cx="16" cy="19.5" rx="12" ry="6" fill="var(--clay-deep)" stroke="var(--ink)" strokeWidth="1.1" />
          <ellipse cx="16" cy="16" rx="12" ry="6" fill="var(--wheat)" stroke="var(--ink)" strokeWidth="1.1" />
          <ellipse cx="16" cy="16" rx="7" ry="3.2" fill="none" stroke="var(--ink-a35)" strokeWidth="1" />
        </>
      )}
      {unit === 'goodwill' && (
        <>
          <path d="M12 19 L8 30 L12 28 L14 31 L16 20 Z" fill="var(--clay)" stroke="var(--ink)" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M20 19 L24 30 L20 28 L18 31 L16 20 Z" fill="var(--clay-deep)" stroke="var(--ink)" strokeWidth=".9" strokeLinejoin="round" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <circle key={i} cx={16 + Math.cos(a) * 7} cy={13 + Math.sin(a) * 7} r="4.2" fill="var(--pasture)" stroke="var(--ink)" strokeWidth=".8" />
          })}
          <circle cx="16" cy="13" r="5.6" fill="var(--paper-hi)" stroke="var(--ink)" strokeWidth=".9" />
        </>
      )}
    </svg>
  )
}

interface Placed {
  good: HarvestGood
  x0: number
  y0: number
  x1: number
  y1: number
}

function centre(el: Element | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function calm(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-animations')
}

export default function HarvestMoment({ goods, active, onLand, onDone }: { goods: HarvestGood[]; active: ProducerId; onLand: (unit: ResourceKind) => void; onDone: () => void }) {
  const [placed, setPlaced] = useState<Placed[] | null>(null)
  const timing = harvestTiming(goods.length)

  // Measure where each good starts and lands once the new round's table has laid out.
  useLayoutEffect(() => {
    if (calm() || goods.length === 0) {
      onDone()
      return
    }
    const out: Placed[] = []
    goods.forEach((good, i) => {
      const from = centre(document.querySelector(`.map [data-region="${good.from}"]`))
      // The active producer's goods land on its own counts (the mat at D, the counter's chips on a phone), which
      // tick up as each arrives; everyone else's on their bust at the table.
      const targets = good.producer === active ? [...document.querySelectorAll(`[data-ledger-unit="${good.unit}"]`)] : []
      targets.push(...document.querySelectorAll(`[data-table-producer="${good.producer}"]`))
      const to = targets.map(centre).find((c) => c !== null) ?? null
      if (!from || !to) return
      // A little spread so a haul reads as several goods, not one stacked token.
      const jx = ((i * 37) % 11) - 5
      const jy = ((i * 53) % 9) - 4
      out.push({ good, x0: from.x + jx * 2, y0: from.y + jy * 2, x1: to.x + jx, y1: to.y + jy })
    })
    if (out.length === 0) onDone()
    else setPlaced(out)
    // One moment per mount: the caller keys this on the round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // It ends on its own, or on the first tap or key anywhere.
  useEffect(() => {
    if (!placed) return
    const t = window.setTimeout(onDone, timing.total + 60)
    const lands = placed.flatMap((p, i) => (p.good.producer === active ? [window.setTimeout(() => onLand(p.good.unit), i * timing.step + timing.flight * 0.9)] : []))
    const skip = () => onDone()
    window.addEventListener('pointerdown', skip, true)
    window.addEventListener('keydown', skip, true)
    return () => {
      window.clearTimeout(t)
      for (const l of lands) window.clearTimeout(l)
      window.removeEventListener('pointerdown', skip, true)
      window.removeEventListener('keydown', skip, true)
    }
  }, [placed, timing.total, timing.step, timing.flight, active, onLand, onDone])

  if (!placed) return null
  return (
    <div className="harvest-moment" data-moment="harvest" data-goods={placed.length} data-duration={timing.total} aria-hidden="true">
      {placed.map((p, i) => {
        return (
          <span
            key={i}
            className="harvest-good"
            data-harvest-good={p.good.unit}
            data-producer={p.good.producer}
            data-bonus={p.good.bonus ? '' : undefined}
            style={
              {
                '--hx0': `${p.x0}px`,
                '--hy0': `${p.y0}px`,
                '--hx1': `${p.x1}px`,
                '--hy1': `${p.y1}px`,
                '--hd': `${Math.round(i * timing.step)}ms`,
                '--hf': `${timing.flight}ms`,
              } as React.CSSProperties
            }
          >
            <span className="harvest-good-arc">
              <GoodArt unit={p.good.unit} />
            </span>
          </span>
        )
      })}
    </div>
  )
}
