// The workshop dialog: a small hex editor over `workshop.ts`. Tap a tile, then a neighbour, to lay or cut a channel.

import { boardHexes, neighbourTable } from './engine'
import { checkLayout, emptyLayout, encodeLayout, toggleEdge, type Layout } from './workshop'

const NS = 'http://www.w3.org/2000/svg'
const S = 30

interface Hooks {
  play: (code: string) => boolean
  toast: (text: string) => void
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
  parent.appendChild(n)
  return n
}

export function initWorkshop(hooks: Hooks): void {
  const dlg = document.getElementById('workshop') as HTMLDialogElement | null
  const open = document.getElementById('btn-workshop')
  const svg = document.getElementById('ws-board') as SVGSVGElement | null
  const status = document.getElementById('ws-status')
  if (!dlg || !open || !svg || !status) return
  let layout: Layout = emptyLayout(2)
  let selected = -1

  const centre = (q: number, r: number) => ({ x: S * Math.sqrt(3) * (q + r / 2), y: S * 1.5 * r })

  function draw(): void {
    svg!.replaceChildren()
    const hexes = boardHexes(layout.radius)
    const extent = S * Math.sqrt(3) * (layout.radius + 0.6)
    const h = S * 1.5 * layout.radius + S * 1.2
    svg!.setAttribute('viewBox', `${-extent} ${-h} ${extent * 2} ${h * 2}`)
    hexes.forEach((hex, i) => {
      const { x, y } = centre(hex.q, hex.r)
      const g = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, 'data-cell': String(i) }, svg!)
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = (Math.PI / 180) * (60 * k + 30)
        return `${((S - 1.5) * Math.cos(a)).toFixed(1)},${((S - 1.5) * Math.sin(a)).toFixed(1)}`
      })
      const isCentre = hex.q === 0 && hex.r === 0
      const live = layout.masks[i]! !== 0 || isCentre
      el('polygon', { points: pts.join(' '), class: `ws-hex${live ? ' live' : ''}${i === selected ? ' sel' : ''}` }, g)
      for (let d = 0; d < 6; d++) {
        if (!(layout.masks[i]! & (1 << d))) continue
        const a = (Math.PI / 180) * 60 * d
        el('line', { x1: '0', y1: '0', x2: (S * 0.87 * Math.cos(a)).toFixed(1), y2: (S * 0.87 * Math.sin(a)).toFixed(1), class: 'ws-pipe' }, g)
      }
      if (isCentre) el('circle', { r: '7', class: 'ws-spring' }, g)
    })
    const c = checkLayout(layout)
    status!.textContent = c.ok ? `Solvable: ${c.pieces} turnable pieces.` : c.problem
    status!.classList.toggle('ok', c.ok)
    ;(document.getElementById('ws-play') as HTMLButtonElement).disabled = !c.ok
    ;(document.getElementById('ws-copy') as HTMLButtonElement).disabled = !c.ok
    dlg!.querySelectorAll<HTMLButtonElement>('#ws-sizes button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.radius) === layout.radius)))
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
    draw()
  })
  document.getElementById('ws-clear')!.addEventListener('click', () => {
    layout = emptyLayout(layout.radius)
    selected = -1
    draw()
  })
  document.getElementById('ws-close')!.addEventListener('click', () => dlg.close())
  document.getElementById('ws-play')!.addEventListener('click', () => {
    if (hooks.play(encodeLayout(layout))) dlg.close()
  })
  document.getElementById('ws-copy')!.addEventListener('click', async () => {
    const code = encodeLayout(layout)
    try {
      await navigator.clipboard.writeText(code)
      hooks.toast(`Copied ${code}. Anyone can paste it to play your board.`)
    } catch {
      hooks.toast(`Workshop code: ${code}`)
    }
  })
  open.addEventListener('click', () => {
    draw()
    dlg.showModal()
  })
}
