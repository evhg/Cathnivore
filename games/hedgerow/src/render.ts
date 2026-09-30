// Canvas 2D renderer for Hedgerow. It only reads the Game; it never changes it. Enemies and towers differ
// by shape as well as colour (STYLE.md 2: the greyscale test). Effects (flying turnips, floating Marks) live
// here and are fed from the engine's event list.

import { ENEMIES, TOWERS, laneCells, pointAt, towerAt, type Game, type EnemyKind, type GameEvent, type TowerKind } from './engine'

interface Fx {
  kind: 'turnip' | 'float' | 'puff' | 'swarm'
  x: number
  y: number
  toX: number
  toY: number
  age: number
  life: number
  text?: string
}

export interface View {
  cellSize: number
  offX: number
  offY: number
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private fx: Fx[] = []
  view: View = { cellSize: 40, offX: 0, offY: 0 }
  selected: { col: number; row: number } | null = null
  cursor: { col: number; row: number } | null = null
  private dpr = 1

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
  }

  resize(game: Game): void {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr))
    const cell = Math.floor(Math.min(rect.width / game.level.cols, rect.height / game.level.rows))
    this.view = {
      cellSize: cell,
      offX: Math.floor((rect.width - cell * game.level.cols) / 2),
      offY: Math.floor((rect.height - cell * game.level.rows) / 2),
    }
  }

  cellAt(clientX: number, clientY: number, game: Game): { col: number; row: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const col = Math.floor((clientX - rect.left - this.view.offX) / this.view.cellSize)
    const row = Math.floor((clientY - rect.top - this.view.offY) / this.view.cellSize)
    if (col < 0 || row < 0 || col >= game.level.cols || row >= game.level.rows) return null
    return { col, row }
  }

  feed(events: GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'shot') this.fx.push({ kind: e.kind === 'beehive' ? 'swarm' : 'turnip', x: e.fromX, y: e.fromY, toX: e.toX, toY: e.toY, age: 0, life: 0.18 })
      else if (e.type === 'kill') {
        this.fx.push({ kind: 'float', x: e.x, y: e.y, toX: e.x, toY: e.y - 0.8, age: 0, life: 0.9, text: `+${e.bounty}` })
        this.fx.push({ kind: 'puff', x: e.x, y: e.y, toX: e.x, toY: e.y, age: 0, life: 0.35 })
      } else if (e.type === 'leak') this.fx.push({ kind: 'float', x: e.x, y: e.y, toX: e.x, toY: e.y - 0.6, age: 0, life: 1, text: '-1' })
    }
  }

  draw(game: Game, dt: number): void {
    const { ctx } = this
    const { cellSize: s, offX, offY } = this.view
    const w = this.canvas.width / this.dpr
    const h = this.canvas.height / this.dpr
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.translate(offX, offY)
    const level = game.level
    const px = (v: number) => v * s

    // Meadow, in two soft greens like mown stripes.
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? '#9dbb6c' : '#94b464'
        ctx.fillRect(px(c), px(r), s, s)
      }
    }

    // Lane: a wide dirt track with a darker rim.
    const strokeLane = (width: number, color: string) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
      ctx.beginPath()
      level.path.forEach(([c, r], i) => (i === 0 ? ctx.moveTo(px(c + 0.5), px(r + 0.5)) : ctx.lineTo(px(c + 0.5), px(r + 0.5))))
      ctx.stroke()
    }
    strokeLane(s * 0.86, '#8a6a43')
    strokeLane(s * 0.7, '#d8bd8a')

    // Plots: pale rings so you can see where to build.
    const lane = laneCells(level.path)
    ctx.lineWidth = 2
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (lane.has(`${c},${r}`) || towerAt(game, c, r)) continue
        ctx.strokeStyle = 'rgba(255,255,255,0.32)'
        ctx.beginPath()
        ctx.arc(px(c + 0.5), px(r + 0.5), s * 0.3, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Farmhouse at the end of the lane.
    const end = level.path[level.path.length - 1]!
    this.house(px(end[0] + 0.5), px(end[1] + 0.5), s)

    // Selected tower or plot, with its range.
    if (this.selected) {
      const { col, row } = this.selected
      const t = towerAt(game, col, row)
      if (t) {
        const range = TOWERS[t.kind].range[t.tier - 1]!
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px(col + 0.5), px(row + 0.5), range * s, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.strokeRect(px(col) + 3, px(row) + 3, s - 6, s - 6)
    }
    if (this.cursor && !this.selected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 2
      ctx.strokeRect(px(this.cursor.col) + 3, px(this.cursor.row) + 3, s - 6, s - 6)
      ctx.setLineDash([])
    }

    for (const t of game.towers) this.tower(t.kind, t.tier, px(t.col + 0.5), px(t.row + 0.5), s)

    for (const e of game.enemies) {
      const p = pointAt(level.path, e.dist)
      this.enemy(e.kind, px(p.x), px(p.y), s, e.hp / ENEMIES[e.kind].hp, e.slowed)
    }

    // Effects.
    for (const f of this.fx) {
      f.age += dt
      const t = Math.min(1, f.age / f.life)
      if (f.kind === 'turnip') {
        const x = f.x + (f.toX - f.x) * t
        const y = f.y + (f.toY - f.y) * t - Math.sin(t * Math.PI) * 0.35
        ctx.fillStyle = '#e9d8ef'
        ctx.strokeStyle = '#7a3f7d'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(px(x), px(y), s * 0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else if (f.kind === 'swarm') {
        ctx.fillStyle = '#f2c94c'
        ctx.strokeStyle = '#2b2320'
        ctx.lineWidth = 1.5
        for (let i = 0; i < 4; i++) {
          const x = f.x + (f.toX - f.x) * t + Math.sin(t * 20 + i * 1.7) * 0.12
          const y = f.y + (f.toY - f.y) * t + Math.cos(t * 18 + i * 2.1) * 0.12
          ctx.beginPath()
          ctx.arc(px(x), px(y), s * 0.05, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      } else if (f.kind === 'float') {
        ctx.globalAlpha = 1 - t
        ctx.fillStyle = f.text!.startsWith('-') ? '#8f2f22' : '#fffbe6'
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'
        ctx.lineWidth = 3
        ctx.font = `700 ${Math.round(s * 0.3)}px 'Atkinson Hyperlegible', sans-serif`
        ctx.textAlign = 'center'
        const y = px(f.y + (f.toY - f.y) * t)
        ctx.strokeText(f.text!, px(f.x), y)
        ctx.fillText(f.text!, px(f.x), y)
        ctx.globalAlpha = 1
      } else {
        ctx.globalAlpha = 0.6 * (1 - t)
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(px(f.x), px(f.y), s * (0.15 + 0.3 * t), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
    this.fx = this.fx.filter((f) => f.age < f.life)
    ctx.restore()
  }

  private house(x: number, y: number, s: number): void {
    const { ctx } = this
    ctx.fillStyle = '#f4ede1'
    ctx.strokeStyle = '#6b4a2b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.rect(x - s * 0.3, y - s * 0.1, s * 0.6, s * 0.4)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#b5523b'
    ctx.beginPath()
    ctx.moveTo(x - s * 0.38, y - s * 0.08)
    ctx.lineTo(x, y - s * 0.4)
    ctx.lineTo(x + s * 0.38, y - s * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#6b4a2b'
    ctx.fillRect(x - s * 0.06, y + s * 0.08, s * 0.12, s * 0.22)
  }

  private tower(kind: TowerKind, tier: number, x: number, y: number, s: number): void {
    const { ctx } = this
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#2b2320'
    if (kind === 'hedgerow') {
      ctx.fillStyle = '#4c7a34'
      ctx.beginPath()
      ctx.roundRect(x - s * 0.36, y - s * 0.24, s * 0.72, s * 0.5, s * 0.22)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e8748b'
      for (let i = 0; i < tier + 1; i++) {
        ctx.beginPath()
        ctx.arc(x - s * 0.2 + i * s * 0.14, y - s * 0.02 + (i % 2) * s * 0.08, s * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (kind === 'beehive') {
      ctx.fillStyle = '#f2c94c'
      for (let i = 0; i < 3; i++) {
        const w = s * (0.44 - i * 0.1)
        ctx.beginPath()
        ctx.roundRect(x - w / 2, y + s * 0.26 - (i + 1) * s * 0.16, w, s * 0.16, s * 0.07)
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = '#2b2320'
      ctx.beginPath()
      ctx.arc(x, y + s * 0.02, s * 0.04, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fffbe6'
      for (let i = 0; i < tier; i++) {
        ctx.beginPath()
        ctx.arc(x - s * 0.12 * (tier - 1) + i * s * 0.24, y + s * 0.35, s * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(x, y - s * 0.22)
      ctx.lineTo(x, y + s * 0.34)
      ctx.moveTo(x - s * 0.3, y - s * 0.06)
      ctx.lineTo(x + s * 0.3, y - s * 0.06)
      ctx.stroke()
      ctx.fillStyle = '#e9c98a'
      ctx.beginPath()
      ctx.arc(x, y - s * 0.24, s * 0.13, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#6b4a2b'
      ctx.beginPath()
      ctx.moveTo(x - s * 0.24, y - s * 0.3)
      ctx.lineTo(x, y - s * 0.55)
      ctx.lineTo(x + s * 0.24, y - s * 0.3)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fffbe6'
      for (let i = 0; i < tier; i++) {
        ctx.beginPath()
        ctx.arc(x - s * 0.12 * (tier - 1) + i * s * 0.24, y + s * 0.32, s * 0.055, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private enemy(kind: EnemyKind, x: number, y: number, s: number, hp: number, slowed: boolean): void {
    const { ctx } = this
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#2b2320'
    if (kind === 'boss') {
      ctx.fillStyle = '#f3f0ea'
      ctx.beginPath()
      ctx.roundRect(x - s * 0.46, y - s * 0.34, s * 0.92, s * 0.68, s * 0.12)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#7fb8c8'
      ctx.fillRect(x + s * 0.12, y - s * 0.26, s * 0.26, s * 0.2)
      ctx.fillStyle = '#c4433a'
      ctx.fillRect(x - s * 0.36, y - s * 0.1, s * 0.4, s * 0.1)
      ctx.fillStyle = '#2b2320'
      ctx.beginPath()
      ctx.arc(x - s * 0.24, y + s * 0.34, s * 0.09, 0, Math.PI * 2)
      ctx.arc(x + s * 0.24, y + s * 0.34, s * 0.09, 0, Math.PI * 2)
      ctx.fill()
      // A small smile on the front: the corporations always smile.
      ctx.beginPath()
      ctx.arc(x + s * 0.2, y + s * 0.1, s * 0.09, 0.1 * Math.PI, 0.9 * Math.PI)
      ctx.stroke()
    } else if (kind === 'van') {
      ctx.fillStyle = '#f3f0ea'
      ctx.beginPath()
      ctx.roundRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.4, s * 0.09)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#7fb8c8'
      ctx.fillRect(x + s * 0.06, y - s * 0.14, s * 0.18, s * 0.14)
      ctx.fillStyle = '#2b2320'
      ctx.beginPath()
      ctx.arc(x - s * 0.15, y + s * 0.2, s * 0.07, 0, Math.PI * 2)
      ctx.arc(x + s * 0.15, y + s * 0.2, s * 0.07, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = '#e9ecef'
      ctx.beginPath()
      ctx.moveTo(x, y - s * 0.2)
      ctx.lineTo(x + s * 0.2, y)
      ctx.lineTo(x, y + s * 0.2)
      ctx.lineTo(x - s * 0.2, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - s * 0.3, y - s * 0.24)
      ctx.lineTo(x + s * 0.3, y - s * 0.24)
      ctx.stroke()
    }
    if (hp < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(x - s * 0.3, y - s * 0.46, s * 0.6, s * 0.08)
      ctx.fillStyle = '#c4433a'
      ctx.fillRect(x - s * 0.3, y - s * 0.46, s * 0.6 * Math.max(0, hp), s * 0.08)
    }
    if (slowed) {
      ctx.strokeStyle = '#4c7a34'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, s * 0.36, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

