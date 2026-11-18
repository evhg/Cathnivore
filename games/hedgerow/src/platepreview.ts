// Plan item 493: the level card's field plate plays its level before you do. The first round's convoy rolls down the
// plate's lane from the depot end, each vehicle drawn with the battlefield's own sprite (icons.ts), looping every 6 s
// while the card shows; pointing at or focusing a vehicle's row on the card lights that vehicle on the plate. Nothing is
// drawn while the plate is off screen, hidden or the tab is in the background; under reduced motion it is one still,
// the convoy stopped on the lane's first stretch.
import { ENEMIES, type EnemyKind, type Level, type TowerKind } from "./engine";
import { enemyIcon, towerIcon } from "./icons";
import { roundAdvice } from "./advice";

/** The plate's cell size (map.ts fieldThumb). */
export const PLATE_CELL = 12;
export const LOOP_MS = 6000;
const SVGNS = "http://www.w3.org/2000/svg";

export interface ConvoyCar {
  kind: EnemyKind;
  lane: 0 | 1;
  /** When it turns into the lane, in ms from the loop's start. */
  enter: number;
  /** How long it takes to run the whole lane, in ms. */
  run: number;
}

/** The first round's first vehicles (up to eight), their entries squeezed into the loop's first 2.2 s, then one of
 *  each kind in `also` (the card's rows) the first round doesn't bring, so every row has a vehicle on the plate. */
export function convoyOf(lv: Level, also: readonly EnemyKind[] = [], max = 8): ConvoyCar[] {
  const first = lv.waves[0] ?? []
  const queue: { at: number; kind: EnemyKind; lane: 0 | 1 }[] = []
  for (const g of first) for (let i = 0; i < g.count; i++) queue.push({ at: g.delay + i * g.gap, kind: g.enemy, lane: g.lane && lv.path2 ? 1 : 0 })
  queue.sort((a, b) => a.at - b.at)
  const cars = queue.slice(0, max)
  const t0 = cars[0]?.at ?? 0
  const span = Math.max(0.001, (cars[cars.length - 1]?.at ?? 0) - t0)
  // Faster vehicles cross the plate sooner; every one is off the lane before the loop restarts.
  const run = (kind: EnemyKind) => Math.min(3000, 2700 / Math.max(0.6, ENEMIES[kind].speed))
  const out: ConvoyCar[] = cars.map((c) => ({ kind: c.kind, lane: c.lane, enter: cars.length === 1 ? 0 : ((c.at - t0) / span) * 2200, run: run(c.kind) }))
  const extra = also.filter((k, i) => also.indexOf(k) === i && !out.some((c) => c.kind === k))
  extra.forEach((kind, i) => out.push({ kind, lane: 0, enter: (out.length ? 2500 : 0) + i * 160, run: run(kind) }))
  return out
}

type Pt = [number, number];

/** The towers the level's rules suggest: the one Cath's advice names for the first round, then the kit's first. */
export function suggestedTowers(lv: Level): TowerKind[] {
  const spawns = (lv.waves[0] ?? []).flatMap((g) => Array.from({ length: g.count }, () => ({ kind: g.enemy })));
  const named = roundAdvice(spawns, lv.towers, [])?.tower ?? null;
  const out = [named, lv.towers[0] ?? null].filter((t): t is TowerKind => t !== null);
  return out.filter((t, i) => out.indexOf(t) === i);
}

/** Free plots beside the lane, spread along it (a third and two thirds of the way for two), for the suggested towers. */
export function towerSpots(lv: Level, n: number): Pt[] {
  const key = (c: number, r: number) => `${c},${r}`;
  const blocked = new Set([...lv.path, ...(lv.path2 ?? []), ...(lv.terrain?.water ?? []), ...(lv.oaks ?? []), ...(lv.barns ?? [])].map(([c, r]) => key(c, r)));
  const spots: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const at = lv.path[Math.min(lv.path.length - 1, Math.round(((i + 1) / (n + 1)) * (lv.path.length - 1)))]!;
    const near = ([[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]] as const).map(([dc, dr]) => [at[0] + dc, at[1] + dr] as Pt);
    const free = near.find(([c, r]) => c >= 0 && r >= 0 && c < lv.cols && r < lv.rows && !blocked.has(key(c, r)) && !spots.some((p) => p[0] === c && p[1] === r));
    if (free) spots.push(free);
  }
  return spots;
}

/** A point a fraction `f` of the way down a lane of cells, in plate units, and the way it heads there. */
export function along(path: readonly Pt[], f: number): { x: number; y: number; dx: number; dy: number } {
  const pts = path.map(([c, r]) => [c * PLATE_CELL + PLATE_CELL / 2, r * PLATE_CELL + PLATE_CELL / 2] as Pt)
  if (pts.length === 1) return { x: pts[0]![0], y: pts[0]![1], dx: 1, dy: 0 }
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]))
  const total = seg.reduce((a, b) => a + b, 0)
  let d = Math.max(0, Math.min(1, f)) * total
  for (let i = 0; i < seg.length; i++) {
    const len = seg[i]!
    if (d <= len || i === seg.length - 1) {
      const a = pts[i]!
      const b = pts[i + 1]!
      const k = len ? Math.min(1, d / len) : 0
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: Math.sign(b[0] - a[0]), dy: Math.sign(b[1] - a[1]) }
    }
    d -= len
  }
  return { x: pts[0]![0], y: pts[0]![1], dx: 1, dy: 0 }
}

export interface PlatePreview {
  /** Lights the vehicles of a kind (null for none). */
  light(kind: EnemyKind | null): void
  stop(): void
}

/**
 * Fills each `.lcard-convoy` group in `thumb` (map.ts draws one per plate, inside the plate's own turn) with the
 * convoy, and runs it while the plate is on screen. `thumb[data-preview-playing]` is set while frames are drawn.
 */
export function startPlatePreview(thumb: HTMLElement, lv: Level, reduced: boolean, rows: readonly EnemyKind[] = []): PlatePreview {
  const cars = convoyOf(lv, rows)
  const lanes: readonly (readonly Pt[])[] = [lv.path, lv.path2 ?? lv.path]
  const size = PLATE_CELL * 1.35
  const groups = [...thumb.querySelectorAll<SVGGElement>(".lcard-convoy")]
  const towers = suggestedTowers(lv)
  const spots = towerSpots(lv, towers.length)
  for (const g of groups) {
    const turned = g.ownerSVGElement?.classList.contains("lcard-plate-wide") ?? false
    spots.forEach(([c, r], i) => {
      const im = document.createElementNS(SVGNS, "image")
      const ts = PLATE_CELL * 1.25
      im.setAttribute("href", towerIcon(towers[i]!))
      im.setAttribute("width", String(ts))
      im.setAttribute("height", String(ts))
      im.setAttribute("class", "lcard-tower")
      im.dataset.tower = towers[i]!
      const x = c * PLATE_CELL + PLATE_CELL / 2
      const y = r * PLATE_CELL + PLATE_CELL / 2
      im.setAttribute("transform", `translate(${x} ${y})${turned ? " rotate(90)" : ""} translate(${-ts / 2} ${-ts * 0.7})`)
      g.append(im)
    })
  }
  const sprites = groups.map((g) =>
    cars.map((c) => {
      const im = document.createElementNS(SVGNS, "image")
      im.setAttribute("href", enemyIcon(c.kind))
      im.setAttribute("width", String(size))
      im.setAttribute("height", String(size))
      im.setAttribute("class", "lcard-car")
      im.dataset.kind = c.kind
      g.append(im)
      return im
    }),
  )
  const place = (t: number) => {
    // Only the plate on show (a card carries a tall and a wide copy, one hidden by CSS).
    groups.forEach((g, gi) => {
      const svg = g.ownerSVGElement
      if (!(svg?.getBoundingClientRect().width ?? 0)) return
      // The wide plate draws the field turned a quarter (map.ts), so its vehicles turn back upright and face the way
      // they go across the screen.
      const turned = svg!.classList.contains("lcard-plate-wide")
      cars.forEach((c, i) => {
        const f = (t - c.enter) / c.run
        const im = sprites[gi]![i]!
        if (f < 0 || f > 1) {
          im.setAttribute("opacity", "0")
          return
        }
        const p = along(lanes[c.lane]!, f)
        // a quick fade at either end of the lane
        im.setAttribute("opacity", String(Math.min(1, f * 12, (1 - f) * 12)))
        const k = c.kind === litKind ? 1.45 : 1
        const sx = ((turned ? p.dy : p.dx) < 0 ? -1 : 1) * k
        im.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})${turned ? " rotate(90)" : ""} scale(${sx} ${k}) translate(${-size / 2} ${-size * 0.62})`)
      })
    })
  }

  let litKind: EnemyKind | null = null
  let raf = 0
  let t0 = 0
  let onScreen = false
  const playing = (on: boolean) => {
    if (on) thumb.dataset.previewPlaying = ""
    else delete thumb.dataset.previewPlaying
  }
  const frame = (now: number) => {
    raf = 0
    if (!visible()) return playing(false)
    if (!t0) t0 = now
    place((now - t0) % LOOP_MS)
    raf = requestAnimationFrame(frame)
  }
  const visible = () => onScreen && !document.hidden && thumb.isConnected && thumb.getBoundingClientRect().width > 0
  const kick = () => {
    if (cars.length === 0) return
    if (reduced) {
      if (visible()) place(2400 + 400)
      return
    }
    if (visible()) {
      playing(true)
      if (!raf) raf = requestAnimationFrame(frame)
    } else playing(false)
  }
  // Reduced motion: one still, the convoy stopped along the lane as it stands 2.8 s in (drawn once it's on screen).
  if (reduced) thumb.dataset.previewStill = ""
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting)
        kick()
      })
    : null
  if (io) io.observe(thumb)
  else onScreen = true
  document.addEventListener("visibilitychange", kick)
  kick()

  return {
    light(kind) {
      litKind = kind
      if (reduced) kick()
      if (kind) thumb.dataset.lit = kind
      else delete thumb.dataset.lit
      for (const set of sprites) for (const im of set) im.classList.toggle("is-lit", im.dataset.kind === kind)
    },
    stop() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      io?.disconnect()
      document.removeEventListener("visibilitychange", kick)
      playing(false)
    },
  }
}
