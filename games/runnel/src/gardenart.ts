// Bea's garden, drawn in code (plan item 37): every crop in three growth stages, the season's visitor and
// the event crops, as small SVGs coloured by tokens (`.ga-*` classes in styles.css). No platform emoji:
// the garden looks the same on every system.

export const CROP_IDS = ['carrot', 'sunflower', 'tomato', 'cabbage', 'corn', 'strawberry', 'pumpkin', 'potato'] as const
export type CropId = (typeof CROP_IDS)[number]
export type Stage = 'sprout' | 'growing' | 'ripe'
export const STAGES: readonly Stage[] = ['sprout', 'growing', 'ripe']
export type VisitorId = 'lamb' | 'butterfly' | 'hedgehog' | 'robin'
export type EventCropId = 'blossom' | 'giantPumpkin'

const p = (d: string, cls: string) => `<path d="${d}" class="${cls}"/>`
const c = (cx: number, cy: number, r: number, cls: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}"/>`
const e = (cx: number, cy: number, rx: number, ry: number, cls: string, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="${cls}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}/>`

const MOUND = e(0, 9, 13, 4, 'ga-soil')
const SPROUT = p('M0 8 V1', 'ga-stem') + p('M0 3 Q-7 1 -7 -4 Q-1 -3 0 3 Z', 'ga-leaf') + p('M0 2 Q6 -1 7 -6 Q1 -5 0 2 Z', 'ga-leaf-2')

// Each crop: [growing, ripe]. The sprout is the same seedling for all, in the crop's own soil mark.
const ART: Record<CropId, [string, string]> = {
  carrot: [
    p('M-4 8 Q-8 -6 -5 -12 M0 8 Q0 -8 1 -14 M4 8 Q8 -4 6 -11', 'ga-frond'),
    p('M-4 6 Q-9 -8 -6 -14 M0 6 Q0 -10 1 -16 M4 6 Q9 -6 7 -13', 'ga-frond') + p('M-5 5 L5 5 L0 16 Z', 'ga-orange') + p('M-2 8 h3 M-1 11 h2', 'ga-line'),
  ],
  sunflower: [
    p('M0 8 V-10', 'ga-stem') + p('M0 0 Q-8 -3 -9 3 Q-3 4 0 0 Z', 'ga-leaf') + p('M0 -4 Q8 -7 9 -1 Q3 0 0 -4 Z', 'ga-leaf-2') + c(0, -12, 3, 'ga-leaf'),
    p('M0 8 V-6', 'ga-stem') +
      p('M0 2 Q-8 -1 -9 5 Q-3 6 0 2 Z', 'ga-leaf') +
      Array.from({ length: 10 }, (_, k) => e(Math.round(Math.cos((k * Math.PI) / 5) * 70) / 10, -12 + Math.round(Math.sin((k * Math.PI) / 5) * 70) / 10, 3.6, 2, 'ga-yellow', k * 36)).join('') +
      c(0, -12, 4.6, 'ga-brown'),
  ],
  tomato: [
    p('M0 8 V-12 M0 -2 L-6 -8 M0 -6 L6 -11', 'ga-stem') + e(-6, -9, 3.5, 2, 'ga-leaf', -30) + e(6, -12, 3.5, 2, 'ga-leaf-2', 30) + c(-3, -2, 1.6, 'ga-yellow'),
    p('M0 8 V-12 M0 -2 L-6 -8 M0 -6 L6 -11', 'ga-stem') + e(-6, -9, 3.5, 2, 'ga-leaf', -30) + e(6, -12, 3.5, 2, 'ga-leaf-2', 30) + c(-4, 1, 4.2, 'ga-red') + c(4, -4, 3.6, 'ga-red') + c(-5, -0.5, 1, 'ga-shine'),
  ],
  cabbage: [c(0, 2, 7, 'ga-leaf') + c(0, 1, 4, 'ga-leaf-2') + p('M-4 2 Q0 -3 4 2', 'ga-line'),
    c(0, 1, 11, 'ga-leaf') + e(-6, 2, 5, 7, 'ga-leaf-2', -20) + e(6, 2, 5, 7, 'ga-leaf-2', 20) + c(0, 0, 6, 'ga-pale') + p('M-4 0 Q0 -5 4 0 M0 -5 V5', 'ga-line')],
  corn: [
    p('M0 8 V-12', 'ga-stem') + p('M0 2 Q-9 -2 -10 -9 Q-3 -5 0 2 Z', 'ga-leaf') + p('M0 -3 Q9 -6 10 -13 Q3 -9 0 -3 Z', 'ga-leaf-2'),
    p('M0 8 V-14', 'ga-stem') + p('M0 4 Q-9 0 -11 -7 Q-3 -3 0 4 Z', 'ga-leaf') + e(4, -5, 3.6, 8, 'ga-yellow', 15) + p('M2 -4 h4 M2 -7 h4 M2 -1 h4', 'ga-line') + p('M2 3 Q6 0 7 -12 Q4 -6 2 3 Z', 'ga-leaf-2') + p('M4 -13 Q6 -17 3 -19', 'ga-silk'),
  ],
  strawberry: [
    e(-5, 2, 4, 3, 'ga-leaf', -20) + e(5, 2, 4, 3, 'ga-leaf-2', 20) + e(0, -2, 4, 3, 'ga-leaf') + c(-1, 5, 1.6, 'ga-pale'),
    e(-6, 0, 4.5, 3.2, 'ga-leaf', -20) + e(6, 0, 4.5, 3.2, 'ga-leaf-2', 20) + e(0, -4, 4.5, 3.2, 'ga-leaf') + p('M-7 3 Q-7 11 -3 12 Q1 9 -1 3 Z', 'ga-red') + p('M2 4 Q2 12 6 13 Q10 9 7 4 Z', 'ga-red') + c(-4, 6, 0.6, 'ga-seed') + c(-3, 9, 0.6, 'ga-seed') + c(5, 7, 0.6, 'ga-seed') + c(6, 10, 0.6, 'ga-seed'),
  ],
  pumpkin: [
    p('M-10 6 Q-4 -6 6 -4 Q10 -3 11 2', 'ga-vine') + e(-3, -2, 4, 3, 'ga-leaf', -10) + e(6, -5, 4, 3, 'ga-leaf-2', 20) + c(8, 4, 2.5, 'ga-yellow'),
    p('M-11 4 Q-6 -8 6 -8', 'ga-vine') + e(-6, -7, 4, 3, 'ga-leaf', -10) + e(-6, 3, 6, 6.5, 'ga-orange-2') + e(6, 3, 6, 6.5, 'ga-orange-2') + e(0, 3, 6, 7, 'ga-orange') + p('M0 -4 l1 -4', 'ga-stem'),
  ],
  potato: [
    p('M-3 8 V-4 M3 8 V-6', 'ga-stem') + e(-6, -5, 4, 3, 'ga-leaf', -20) + e(6, -7, 4, 3, 'ga-leaf-2', 20) + e(0, -9, 3.5, 2.6, 'ga-leaf'),
    p('M-3 6 V-6 M3 6 V-8', 'ga-stem') + e(-6, -7, 4, 3, 'ga-leaf', -20) + e(6, -9, 4, 3, 'ga-leaf-2', 20) + c(-2, -12, 1.8, 'ga-pale') + c(3, -13, 1.8, 'ga-pale') + e(-5, 9, 4.5, 3.4, 'ga-tuber') + e(5, 10, 4, 3, 'ga-tuber') + c(-6, 8, 0.5, 'ga-seed') + c(5, 9, 0.5, 'ga-seed'),
  ],
}

const VISITORS: Record<VisitorId, string> = {
  lamb: c(-4, 0, 6, 'ga-wool') + c(2, -1, 6, 'ga-wool') + c(-1, -4, 5, 'ga-wool') + e(8, -3, 3.5, 3, 'ga-face') + p('M-5 5 v5 M2 5 v5', 'ga-leg') + c(9, -4, 0.7, 'ga-eye'),
  butterfly: e(-5, -4, 5, 6, 'ga-pink', -20) + e(5, -4, 5, 6, 'ga-pink', 20) + e(-4, 4, 3.5, 4, 'ga-yellow', 20) + e(4, 4, 3.5, 4, 'ga-yellow', -20) + e(0, 0, 1.2, 7, 'ga-brown') + p('M0 -7 Q-2 -11 -4 -12 M0 -7 Q2 -11 4 -12', 'ga-line'),
  hedgehog: p('M-11 6 Q-12 -8 0 -9 Q9 -8 10 0 L13 3 Q10 6 6 6 Z', 'ga-spines') + p('M6 0 Q10 0 13 3 Q10 6 6 6 Z', 'ga-face') + c(9, 2, 0.8, 'ga-eye') + c(13, 3, 1, 'ga-eye'),
  robin: e(0, 0, 8, 7, 'ga-brown') + c(3, 2, 4.5, 'ga-red') + c(6, -5, 4, 'ga-brown') + p('M10 -5 l4 1 l-4 1 Z', 'ga-yellow') + c(7, -6, 0.8, 'ga-eye') + p('M-8 0 l-6 -3 l1 5 Z', 'ga-brown') + p('M-1 7 v4 M2 7 v4', 'ga-leg'),
}

const EVENT_CROPS: Record<EventCropId, string> = {
  blossom: p('M0 10 V-2 M0 2 L-6 -4 M0 0 L6 -6', 'ga-trunk') + [[-6, -8], [0, -10], [6, -9], [-3, -4], [4, -3], [-8, -2], [8, -4]].map(([x, y]) => c(x!, y!, 3.4, 'ga-pink')).join('') + c(0, -10, 1, 'ga-pale') + c(-6, -8, 1, 'ga-pale'),
  giantPumpkin: p('M0 -9 l1 -5', 'ga-stem') + e(-8, 2, 7, 8.5, 'ga-orange-2') + e(8, 2, 7, 8.5, 'ga-orange-2') + e(0, 2, 7.5, 9.5, 'ga-orange') + p('M-4 -2 Q0 3 4 -2', 'ga-line'),
}

// With a title the drawing is an image; without, it's decoration inside something already labelled.
function svg(inner: string, title: string | undefined, extra = ''): string {
  const a11y = title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'
  return `<svg class="ga${extra}" viewBox="-16 -18 32 32" ${a11y}><g>${inner}</g></svg>`
}

/** A crop at one growth stage. */
export function cropSvg(crop: CropId, stage: Stage, title?: string): string {
  const body = stage === 'sprout' ? SPROUT : ART[crop][stage === 'growing' ? 0 : 1]
  return svg(MOUND + body, title, ` ga-${stage}`)
}

/** The drawing for each stage, for the "three drawn stages" check. */
export function cropStages(crop: CropId): [string, string, string] {
  return [SPROUT, ART[crop][0], ART[crop][1]]
}

export function visitorSvg(v: VisitorId, title?: string): string {
  return svg(VISITORS[v], title, ' ga-visitor')
}

export function eventCropSvg(id: EventCropId, title?: string): string {
  return svg(MOUND + EVENT_CROPS[id], title, ' ga-ripe ga-event')
}

/** An Orchard drop on the win card: full when earned, an empty outline when not. */
export function dropSvg(full: boolean): string {
  return `<svg class="ga-drop${full ? ' is-full' : ''}" viewBox="-6 -8 12 15" aria-hidden="true"><path d="M0 -7 Q6 0 5 3 A5 5 0 0 1 -5 3 Q-6 0 0 -7 Z"/></svg>`
}

// ---- The Orchard's trees (plan item 37): one per level, in ten kinds that repeat down the rows ----------

export type TreeState = 'locked' | 'open' | 'blossom' | 'fruit'
const TREE_FRUIT = ['ga-red', 'ga-yellow', 'ga-plum', 'ga-red', 'ga-yellow', 'ga-brown', 'ga-tuber', 'ga-plum', 'ga-leaf-2', 'ga-brown']
// A canopy shape per kind, so a row reads as different trees: round, tall, broad, weeping.
const CANOPY = [
  c(0, -8, 8, 'ga-canopy'),
  e(0, -9, 6, 9, 'ga-canopy'),
  e(0, -7, 9, 6.5, 'ga-canopy'),
  c(-4, -7, 5.5, 'ga-canopy') + c(4, -7, 5.5, 'ga-canopy') + c(0, -12, 5.5, 'ga-canopy'),
  c(0, -8, 7.5, 'ga-canopy') + c(-5, -4, 4, 'ga-canopy') + c(5, -4, 4, 'ga-canopy'),
  e(0, -8, 8.5, 7.5, 'ga-canopy'),
  c(-3, -9, 6, 'ga-canopy') + c(4, -6, 6, 'ga-canopy'),
  e(0, -10, 5.5, 8.5, 'ga-canopy'),
  c(0, -8, 8, 'ga-canopy') + c(0, -14, 3.5, 'ga-canopy'),
  e(0, -8, 10, 7, 'ga-canopy'),
]
const SPOTS: Array<[number, number]> = [[-5, -9], [3, -12], [5, -5], [-2, -4], [0, -9]]

/** A tree for Orchard level `level` (1-based) in its state. */
export function treeSvg(level: number, state: TreeState): string {
  const kind = (level - 1) % 10
  const ground = e(0, 11, 9, 2.4, 'ga-soil')
  if (state === 'locked') {
    return svg(ground + p('M0 11 V-2 M0 2 L-3 -2 M0 0 L3 -4', 'ga-trunk ga-sapling'), undefined, ' ga-tree is-locked')
  }
  const trunk = p('M0 11 V-2 M0 3 L-3 -1 M0 1 L3 -3', 'ga-trunk')
  let deco = ''
  if (state === 'blossom') deco = SPOTS.map(([x, y]) => c(x, y, 1.7, 'ga-blossom')).join('')
  if (state === 'fruit') deco = SPOTS.map(([x, y]) => c(x, y, 2.1, TREE_FRUIT[kind]!)).join('')
  return svg(ground + trunk + CANOPY[kind] + deco, undefined, ` ga-tree is-${state}`)
}
