// Plan item 476: the round's Harvest as a moment on the table. Each good the engine pays out (`harvestSources`)
// rises from the ground it comes from (the producer's home hex, or Shingle Bay for the Oyster Beds bonus) and arcs
// to that producer's bust at the table, in seat order, over 900-1600 ms. A tap anywhere ends it at once; under
// reduced motion nothing flies (the counts already show the totals).
import { useEffect, useLayoutEffect, useState } from 'react'
import type { HarvestGood } from '../engine/harvest'
import { GoodwillIcon, MarksIcon, ProduceIcon } from './icons/ResourceIcons'
import { harvestTiming } from './harvestTiming'

const ICON = { produce: ProduceIcon, marks: MarksIcon, goodwill: GoodwillIcon }

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

export default function HarvestMoment({ goods, onDone }: { goods: HarvestGood[]; onDone: () => void }) {
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
      const busts = [...document.querySelectorAll(`[data-table-producer="${good.producer}"]`)]
      const to = busts.map(centre).find((c) => c !== null) ?? null
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
    const skip = () => onDone()
    window.addEventListener('pointerdown', skip, true)
    window.addEventListener('keydown', skip, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', skip, true)
      window.removeEventListener('keydown', skip, true)
    }
  }, [placed, timing.total, onDone])

  if (!placed) return null
  return (
    <div className="harvest-moment" data-moment="harvest" data-goods={placed.length} data-duration={timing.total} aria-hidden="true">
      {placed.map((p, i) => {
        const Icon = ICON[p.good.unit]
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
              <Icon size={22} />
            </span>
          </span>
        )
      })}
    </div>
  )
}
