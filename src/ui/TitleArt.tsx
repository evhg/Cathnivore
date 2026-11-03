import { useEffect, useMemo, useState } from 'react'
import Map, { HEX_R } from './Map'
import { titleBoardState, titleLine } from './titleBoard'
import { BeasDrawing } from './TableProps'
import { lightForHour } from './tableLight'
import { loadCampaign } from '../platform/storage'
import CathArt from './CathArt'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import type { CathExpression } from '../../shared/cath/cath'

// The title screen's illustration: the real board (plan item 60), purely decorative (aria-hidden); every
// animation is CSS so reduced motion stills it.

/**
 * Plan item 60: the title opens on the real table. The game's own board (Map.tsx, read-only) on the market cloth,
 * laid from the player's campaign (titleBoard.ts), with Cath standing beside it, never over a hex.
 */
export default function TitleArt() {
  const completed = useMemo(() => loadCampaign().completed, [])
  const state = useMemo(() => titleBoardState(completed), [completed])
  const light = useMemo(() => lightForHour(new Date().getHours()), [])
  const expression = useMenuExpression()
  return (
    <div className="title-art title-table" aria-hidden="true" data-free={Object.values(state.regions).filter((r) => r.liberated).length}>
      <div className="title-cath">
        <p className="title-cath-line">{titleLine(completed)}</p>
        <CathArt framing="half" expression={expression} pose={SCREEN_POSE['cathnivore:title']} animate />
      </div>
      <div className="title-board" data-light={light}>
        {/* Bea is at the market too: her drawing of her mum, pinned to the cloth's corner. */}
        <div className="title-bea">
          <BeasDrawing />
        </div>
        <div className="title-map-wrap">
          <Map state={state} />
          <TitleMovers held={Object.values(state.regions).some((r) => !r.liberated)} />
        </div>
      </div>
    </div>
  )
}

/** A vertex of Kingsmarket's hex (pointy-top, i = 0 at the top, clockwise), `k` hex radii out from the centre. */
function vertex(i: number, k = 1): string {
  const a = ((-90 + 60 * i) * Math.PI) / 180
  return `${(Math.cos(a) * HEX_R * k).toFixed(1)},${(Math.sin(a) * HEX_R * k).toFixed(1)}`
}
/** The ring road round the capital, and a run in from the board's edge, half round it and out again. */
const RING_ROAD = `M ${[0, 1, 2, 3, 4, 5].map((i) => vertex(i)).join(' L ')} Z`
const THROUGH_ROAD = `M ${vertex(1, 2)} L ${vertex(1)} L ${vertex(2)} L ${vertex(3)} L ${vertex(4)} L ${vertex(4, 2)} L ${vertex(4)} L ${vertex(5)} L ${vertex(0)} L ${vertex(1)} Z`

/** Reduced motion (the OS setting or the game's own Animations toggle) parks the vans and stills the cloth. */
function isStill(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('no-animations')
}

/**
 * Plan item 71: the table lives. Hollowell's vans drive the roads between the regions (while any is held); once
 * Marrow is free, the producers' carts take the roads instead. Drawn over the board in its own viewBox.
 */
function TitleMovers({ held }: { held: boolean }) {
  const still = useMemo(isStill, [])
  const runs: Array<{ path: string; dur: string; begin: string; park: string }> = [
    { path: RING_ROAD, dur: '22s', begin: '0s', park: vertex(5) },
    { path: THROUGH_ROAD, dur: '30s', begin: '-9s', park: vertex(2) },
  ]
  return (
    <svg className={`title-movers ${held ? 'is-held' : 'is-free'}`} viewBox="-250 -238 500 476" aria-hidden="true" data-still={still || undefined}>
      {runs.map((r, i) => (
        <g key={i} className="title-van" transform={still ? `translate(${r.park})` : undefined}>
          <g transform="translate(-9 -6)">
            <rect className="van-body" x="0" y="1" width="13" height="9" rx="1.5" />
            <path className="van-cab" d="M13 3h3.2l2.3 3v4H13z" />
            <rect className="van-window" x="14" y="4" width="2.4" height="2.2" rx="0.4" />
            <circle className="van-wheel" cx="4" cy="10.5" r="1.9" />
            <circle className="van-wheel" cx="14.5" cy="10.5" r="1.9" />
          </g>
          {!still && <animateMotion dur={r.dur} begin={r.begin} repeatCount="indefinite" rotate="auto" path={r.path} />}
        </g>
      ))}
    </svg>
  )
}

/** Plan item 71: Cath reacts to the menu entry under the pointer or the keyboard focus. */
const MENU_FACES: Array<[RegExp, CathExpression]> = [
  [/^campaign/i, 'determined'],
  [/^quick game/i, 'delighted'],
  [/^daily/i, 'wink'],
  [/^credits/i, 'delighted'],
]
function useMenuExpression(): CathExpression {
  const [face, setFace] = useState<CathExpression>('smirk')
  useEffect(() => {
    const pick = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.('.title-menu button, .title-menu a')
      if (!el) return setFace('smirk')
      const text = (el.textContent ?? '').trim()
      setFace(MENU_FACES.find(([re]) => re.test(text))?.[1] ?? 'smirk')
    }
    const leave = (e: Event) => {
      if (!(e as FocusEvent).relatedTarget || !(e.target as Element).closest?.('.title-menu')) setFace('smirk')
    }
    document.addEventListener('pointerover', pick)
    document.addEventListener('focusin', pick)
    document.addEventListener('focusout', leave)
    return () => {
      document.removeEventListener('pointerover', pick)
      document.removeEventListener('focusin', pick)
      document.removeEventListener('focusout', leave)
    }
  }, [])
  return face
}
