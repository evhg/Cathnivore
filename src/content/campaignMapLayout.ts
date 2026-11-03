import type { RegionId } from '../engine/types'
import { REGIONS } from './map'
import { CHAPTER_HOMES, MAP_AXIAL, currentChapterIndex, liberatedRegions } from './campaignMap'

// Plan item 49: where everything on the campaign map stands, as plain geometry so a unit test can check that
// no label crosses a neighbour, a landmark, a pin, a Hollowell post or Cath, for every point in the campaign.
// The map draws from these numbers (ui/CampaignMap.tsx); nothing is placed by eye in the component.

export const MAP_R = 52
export const MAP_W = MAP_R * Math.sqrt(3)
/** The painted face of a hex (a 2-unit paper gap between neighbours). */
export const MAP_FACE_R = MAP_R * 0.96

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export const boxesMeet = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

export function regionCentre(id: RegionId): { x: number; y: number } {
  const [q, r] = MAP_AXIAL[id]!
  return { x: MAP_W * (q + r / 2), y: 1.5 * MAP_R * r }
}

/** A chapter's pin: on its first home region, below the name. */
export function pinCentre(home: RegionId): { x: number; y: number } {
  const c = regionCentre(home)
  return { x: c.x, y: c.y + MAP_R * 0.42 }
}
export const PIN_R = 11

/** Cath's figure on the map (cathSvg at 28 x 42), standing just right of and above her pin. At 28 x 42 she
 * stays inside her own region at Kingsmarket, clear of Shingle Bay's bunting below it. */
export const CATH_SIZE = { w: 28, h: 42 }
export function cathBox(pin: { x: number; y: number }): Box {
  const x0 = pin.x + 12
  const y0 = pin.y - 25
  return { x0, y0, x1: x0 + CATH_SIZE.w, y1: y0 + CATH_SIZE.h }
}

// Region names: 11 px display type. A generous per-character width (the face runs about 5.2 units a
// character at this size) so the boxes err on the side of a collision, never miss one.
const CHAR_W = 5.9
const LINE_H = 11
export function nameLines(id: RegionId): string[] {
  const name = REGIONS[id].name
  return name.includes(' ') ? name.split(' ') : [name]
}
/** The name's baseline (single line) or the first line's baseline (two lines), relative to the hex centre. */
export function nameBaseline(id: RegionId): number {
  return nameLines(id).length > 1 ? -MAP_R * 0.26 - 5 : -MAP_R * 0.26
}
export function nameBox(id: RegionId): Box {
  const c = regionCentre(id)
  const lines = nameLines(id)
  const w = Math.max(...lines.map((l) => l.length)) * CHAR_W
  const top = c.y + nameBaseline(id) - LINE_H * 0.8
  const bottom = c.y + nameBaseline(id) + (lines.length - 1) * LINE_H + 2.5
  return { x0: c.x - w / 2, y0: top, x1: c.x + w / 2, y1: bottom }
}

// Each region's landmark (the docks at Shingle Bay, the mill at Rivermead, the market cross at Kingsmarket...)
// stands in the hex's lower left, where no name, pin or Cath ever is.
export type LandmarkKind = 'cross' | 'mill' | 'docks' | 'lighthouse' | 'oak' | 'barn' | 'fold' | 'gull' | 'fern' | 'tarn'
export const LANDMARKS: Record<string, { kind: LandmarkKind; name: string }> = {
  kingsmarket: { kind: 'cross', name: 'the market cross' },
  rivermead: { kind: 'mill', name: 'the mill' },
  shingleBay: { kind: 'docks', name: 'the docks' },
  saltmarsh: { kind: 'lighthouse', name: 'the light' },
  oakvale: { kind: 'oak', name: 'the old oak' },
  brindleHills: { kind: 'barn', name: 'the barn' },
  highmoor: { kind: 'fold', name: 'the sheepfold' },
}
export const LANDMARK_SIZE = 24
export function landmarkAt(id: RegionId): { x: number; y: number } {
  const c = regionCentre(id)
  return { x: c.x - MAP_R * 0.5, y: c.y + MAP_R * 0.2 }
}
export function landmarkBox(id: RegionId): Box {
  const p = landmarkAt(id)
  const h = LANDMARK_SIZE / 2
  return { x0: p.x - h, y0: p.y - h, x1: p.x + h, y1: p.y + h }
}

// Hollowell's sign post on each region it still holds, on the hex's right flank. Where Cath stands, she
// stands in front of it, so the post is left out there.
export function postAt(id: RegionId): { x: number; y: number } {
  const c = regionCentre(id)
  return { x: c.x + MAP_R * 0.6, y: c.y + MAP_R * 0.1 }
}
export function postBox(id: RegionId): Box {
  const p = postAt(id)
  return { x0: p.x - 7, y0: p.y - 16, x1: p.x + 7, y1: p.y + 2 }
}

/** A freed region's bunting: a swag of pennants across the hex's upper edge (ui/CampaignMap.tsx Bunting). */
export const BUNTING = { halfSpan: MAP_W * 0.28, top: -MAP_R * 0.72, drop: 14 }
export function buntingBox(id: RegionId): Box {
  const c = regionCentre(id)
  return { x0: c.x - BUNTING.halfSpan, y0: c.y + BUNTING.top, x1: c.x + BUNTING.halfSpan, y1: c.y + BUNTING.top + BUNTING.drop }
}

export function pinBox(p: { x: number; y: number }): Box {
  return { x0: p.x - PIN_R, y0: p.y - PIN_R, x1: p.x + PIN_R, y1: p.y + PIN_R }
}

export interface MapLayout {
  free: Set<RegionId>
  here: number
  allDone: boolean
  pins: { x: number; y: number }[]
  cath: Box
  names: { id: RegionId; box: Box }[]
  landmarks: { id: RegionId; box: Box }[]
  posts: { id: RegionId; box: Box }[]
  bunting: { id: RegionId; box: Box }[]
}

/** The whole map's layout for a campaign at this point (chapter ids in order, the ones won). */
export function campaignMapLayout(chapterIds: readonly string[], completed: readonly string[]): MapLayout {
  const free = liberatedRegions(completed)
  const here = currentChapterIndex(chapterIds, completed)
  const allDone = chapterIds.every((id) => completed.includes(id))
  const homeOf = (id: string) => CHAPTER_HOMES[id]![0]!
  const pins = chapterIds.map((id) => pinCentre(homeOf(id)))
  const cathHome = homeOf(chapterIds[here]!)
  const regions = Object.keys(MAP_AXIAL) as RegionId[]
  return {
    free,
    here,
    allDone,
    pins,
    cath: cathBox(pins[here]!),
    names: regions.map((id) => ({ id, box: nameBox(id) })),
    landmarks: regions.map((id) => ({ id, box: landmarkBox(id) })),
    bunting: [...free].map((id) => ({ id, box: buntingBox(id) })),
    posts: regions.filter((id) => !free.has(id) && id !== cathHome).map((id) => ({ id, box: postBox(id) })),
  }
}

// The river Mead: from the moor's spring down the edges between the hexes (Highmoor | Saltmarsh, Saltmarsh |
// Kingsmarket, Kingsmarket | Rivermead, Rivermead | Shingle Bay) and out past Shingle Bay to the sea.
export function riverPath(): string {
  const W = MAP_W
  const R = MAP_R
  const pts: [number, number][] = [
    [-10, -1.5 * R - R * 0.92],
    [0, -1.5 * R - R / 2],
    [0, -R],
    [W / 2, -R / 2],
    [W / 2, R / 2],
    [W, R],
    [W, 2 * R],
    [W + 14, 2 * R + 34],
  ]
  // A gentle meander: each leg bows a little to alternate sides.
  let d = `M${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!
    const [bx, by] = pts[i]!
    const s = i % 2 === 0 ? 1 : -1
    const mx = (ax + bx) / 2 + (by - ay) * 0.12 * s
    const my = (ay + by) / 2 - (bx - ax) * 0.12 * s
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`
  }
  return d
}
