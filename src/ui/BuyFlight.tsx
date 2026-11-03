import { useEffect, useRef } from 'react'
import Vignette from './Vignette'
import { playCoins } from '../platform/sound'
import { vignetteFor } from './vignetteKind'
import { reducedMotion, type BuyFlightPath } from './buyFlightGeometry'
import type { ImprovementCard } from '../content/improvements'

// Plan item 36: a choreographed buy. The bought card, drawn, flies from where it was bought into the
// farmstead, and its price counts out of the Marks as a rising "−N". Reduced motion fades the card in at
// the farm instead.
export default function BuyFlight({ card, cost, path, onDone }: { card: ImprovementCard; cost: number; path: BuyFlightPath; onDone(): void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const coinsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Plan item 53: a coin chinks for each Mark counted out.
    playCoins(cost)
    const el = cardRef.current
    const coins = coinsRef.current
    if (!el || typeof el.animate !== 'function') {
      const t = setTimeout(onDone, 700)
      return () => clearTimeout(t)
    }
    const dx = path.to.x - path.from.x
    const dy = path.to.y - path.from.y
    const still = reducedMotion()
    const fly = still
      ? el.animate([{ opacity: 0, transform: `translate(${dx}px, ${dy}px)` }, { opacity: 1, offset: 0.3, transform: `translate(${dx}px, ${dy}px)` }, { opacity: 0, transform: `translate(${dx}px, ${dy}px)` }], { duration: 700, fill: 'forwards' })
      : el.animate(
          [
            { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 40}px) scale(0.9) rotate(-4deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(3deg)`, opacity: 0.2 },
          ],
          { duration: 760, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' },
        )
    if (coins && !still) {
      coins.animate(
        [
          { transform: 'translate(-50%, 0)', opacity: 0 },
          { transform: 'translate(-50%, -18px)', opacity: 1, offset: 0.3 },
          { transform: 'translate(-50%, -40px)', opacity: 0 },
        ],
        { duration: 900, easing: 'ease-out', fill: 'forwards' },
      )
    }
    fly.onfinish = onDone
    return () => fly.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <div className="buy-flight" ref={cardRef} aria-hidden="true" data-tag={card.tags[0]} style={{ left: path.from.x - 60, top: path.from.y - 34 }}>
        <Vignette kind={vignetteFor(card)} seed={card.id} />
        <span>{card.name}</span>
      </div>
      {!reducedMotion() && (
        <div className="buy-coins" ref={coinsRef} aria-hidden="true" style={{ left: path.coinsAt.x, top: path.coinsAt.y }}>
          −{cost}
        </div>
      )}
    </>
  )
}
