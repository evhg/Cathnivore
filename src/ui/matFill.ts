// Plan item 418: how many pieces each of the stall's stores shows (one a unit, so the fill is the count, up to its cap).
export const MAT_CAP = { crate: 9, coins: 8, rosette: 8 } as const

export function matFill(kind: keyof typeof MAT_CAP, count: number): number {
  return Math.max(0, Math.min(MAT_CAP[kind], Math.floor(count)))
}
