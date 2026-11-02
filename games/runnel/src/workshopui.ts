// Bea's workshop (plan item 39): a full-screen table where you draw a board. Tap a tile, then a neighbour, to lay or
// cut a channel; water runs out from the spring along whatever is joined to it as you lay it. The flow is
// "Test it" (play the board in Practice) and then "Share" (a code and the share card), with a shelf of saved picks.

import { boardHexes, neighbourTable } from './engine'
import { beaCrayonSvg, crayonTinSvg } from './gardenart'
import { checkLayout, emptyLayout, encodeLayout, parseLayout, toggleEdge, type Layout } from './workshop'

const NS = 'http://www.w3.org/2000/svg'
const S = 30

interface Hooks {
  /** Plays a workshop code in Practice; false when it isn't a solvable board. */
  play: (code: string) => boolean
  /** Shares a board that has been tested and solved. */
  share: (code: string) => void
  /** The codes on Bea's shelf (her picks). */
  picks: () => string[]
  /** Whether this code has been solved in Practice (tested). */
  tested: (code: string) => boolean
  toast: (text: string) => void
}

export interface Workshop {
  open: () => void
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
  parent.appendChild(n)
  return n
}

/** The cells water reaches from the spring along laid channels, with each cell's distance in steps. */
export function wetDepths(layout: Layout): Map<number, number> {
  const hexes = boardHexes(layout.radius)
  const nb = neighbourTable(hexes)
  const centre = hexes.findIndex((h) => h.q === 0 && h.r === 0)
  const depth = new Map<number, number>([[centre, 0]])
  const queue = [centre]
  while (queue.length) {
    const i = queue.shift()!
    for (let d = 0; d < 6; d++) {
      if (!(layout.masks[i]! & (1 << d))) continue
      const j = nb[i]![d]!
      if (j < 0 || depth.has(j)) continue
      depth.set(j, depth.get(i)! + 1)
      queue.push(j)
    }
  }
  return depth
}

export function initWorkshop(hooks: Hooks): Workshop | null {
  const dlg = document.getElementById('workshop') as HTMLDialogElement | null
  const open = document.getElementById('btn-workshop')
  const svg = document.getElementById('ws-board') as SVGSVGElement | null
  const status = document.getElementById('ws-status')
  const shelf = document.getElementById('ws-shelf')
  if (!dlg || !open || !svg || !status || !shelf) return null
  const bea = document.getElementById('ws-bea')
  if (bea) bea.innerHTML = beaCrayonSvg() + crayonTinSvg()
  let layout: Layout = emptyLayout(2)
  let selected = -1
  let wasWet = new Set<number>()
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

  const centre = (q: number, r: number) => ({ x: S * Math.sqrt(3) * (q + r / 2), y: S * 1.5 * r })

  function draw(): void {
    svg!.replaceChildren()
    const hexes = boardHexes(layout.radius)
    const extent = S * Math.sqrt(3) * (layout.radius + 0.6)
    const h = S * 1.5 * layout.radius + S * 1.2
    svg!.setAttribute('viewBox', `${-extent} ${-h} ${extent * 2} ${h * 2}`)
    const wet = wetDepths(layout)
    const tiles = el('g', { class: 'ws-tiles' }, svg!)
    const water = el('g', { class: 'ws-waters' }, svg!)
    hexes.forEach((hex, i) => {
      const { x, y } = centre(hex.q, hex.r)
      const at = `translate(${x.toFixed(1)} ${y.toFixed(1)})`
      const g = el('g', { transform: at, 'data-cell': String(i) }, tiles)
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = (Math.PI / 180) * (60 * k + 30)
        return `${((S - 1.5) * Math.cos(a)).toFixed(1)},${((S - 1.5) * Math.sin(a)).toFixed(1)}`
      })
      const isCentre = hex.q === 0 && hex.r === 0
      const live = layout.masks[i]! !== 0 || isCentre
      el('polygon', { points: pts.join(' '), class: `ws-hex${live ? ' live' : ''}${wet.has(i) && !isCentre ? ' wet' : ''}${i === selected ? ' sel' : ''}` }, g)
      const fresh = wet.has(i) && !wasWet.has(i) && !reduced()
      const w = el('g', { transform: at, class: 'ws-water-cell' }, water)
      for (let d = 0; d < 6; d++) {
        if (!(layout.masks[i]! & (1 << d))) continue
        const a = (Math.PI / 180) * 60 * d
        const x2 = (S * 0.87 * Math.cos(a)).toFixed(1)
        const y2 = (S * 0.87 * Math.sin(a)).toFixed(1)
        el('line', { x1: '0', y1: '0', x2, y2, class: 'ws-pipe' }, g)
        if (!wet.has(i)) continue
        // Water runs from the cell's middle out to each edge, a beat later for each step from the spring.
        el('line', { x1: '0', y1: '0', x2, y2, class: `ws-water${fresh ? ` fresh d${Math.min(wet.get(i)!, 8)}` : ''}`, pathLength: '1' }, w)
      }
      if (isCentre) {
        el('circle', { r: '9', class: 'ws-spring-ring' }, w)
        el('circle', { r: '6', class: 'ws-spring' }, w)
      }
    })
    wasWet = new Set(wet.keys())
    const c = checkLayout(layout)
    const code = encodeLayout(layout)
    const tested = c.ok && hooks.tested(code)
    const blank = layout.masks.every((m) => m === 0)
    status!.textContent = blank
      ? 'Tap the spring, then a tile beside it, to draw a channel. Keep going until every tile drinks.'
      : !c.ok
      ? c.problem
      : tested
        ? `Tested and solved: ${code}. Share it with a friend.`
        : `Every tile drinks. ${c.pieces} pieces to turn. Test it before you share it.`
    status!.classList.toggle('ok', c.ok)
    ;(document.getElementById('ws-play') as HTMLButtonElement).disabled = !c.ok
    const share = document.getElementById('ws-share') as HTMLButtonElement
    share.disabled = !tested
    dlg!.querySelectorAll<HTMLButtonElement>('#ws-sizes button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.radius) === layout.radius)))
    renderShelf()
  }

  function renderShelf(): void {
    const picks = hooks.picks()
    const empty = document.createElement('p')
    empty.className = 'ws-shelf-empty'
    empty.textContent = 'Boards you test or save land here.'
    shelf!.replaceChildren(
      ...(picks.length
        ? picks.map((code) => {
            const b = document.createElement('button')
            b.type = 'button'
            b.className = 'ws-pick'
            b.textContent = code
            b.addEventListener('click', () => {
              const l = parseLayout(code)
              if (l) {
                // A workshop board goes back on the table to edit; a generated board is played.
                layout = l
                selected = -1
                wasWet = new Set()
                draw()
              } else if (hooks.play(code)) dlg!.close()
            })
            return b
          })
        : [empty]),
    )
  }

  svg.addEventListener('click', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('g[data-cell]')
    if (!g) return
    const i = Number(g.dataset.cell)
    const nb = neighbourTable(boardHexes(layout.radius))
    if (selected >= 0 && selected !== i) {
      const dir = nb[selected]!.indexOf(i)
      if (dir >= 0) {
        toggleEdge(layout, selected, dir)
        selected = i
        draw()
        return
      }
    }
    selected = selected === i ? -1 : i
    draw()
  })
  dlg.querySelector('#ws-sizes')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-radius]')
    if (!b) return
    layout = emptyLayout(Number(b.dataset.radius))
    selected = -1
    wasWet = new Set()
    draw()
  })
  document.getElementById('ws-clear')!.addEventListener('click', () => {
    layout = emptyLayout(layout.radius)
    selected = -1
    wasWet = new Set()
    draw()
  })
  document.getElementById('ws-close')!.addEventListener('click', () => dlg.close())
  document.getElementById('ws-play')!.addEventListener('click', () => {
    if (hooks.play(encodeLayout(layout))) dlg.close()
  })
  document.getElementById('ws-share')!.addEventListener('click', () => hooks.share(encodeLayout(layout)))

  const show = () => {
    ;(document.getElementById('board-sheet') as HTMLDialogElement | null)?.close()
    wasWet = new Set(wetDepths(layout).keys())
    draw()
    if (!dlg.open) dlg.showModal()
  }
  open.addEventListener('click', show)
  return { open: show }
}
