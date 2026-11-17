// Plan item 480: Goodwill on the farmhouse doorstep. Every leak leaves one of Hollowell's glossy parcels on the
// farmhouse step (the first brings a 'Sorry we missed you' card for the door); after a round with no leak two
// neighbours cart one back toward the depot; the win's harvest sweeps the step clear; under a quarter of the Goodwill
// Hollowell's 'ACQUIRED' sale board goes up at the gate. Pure: main.ts feeds it the game's events, the renderers
// draw it, and the tests count it.

/** At most this many parcels are drawn on the step; the rest show as '+N'. */
export const DOORSTEP_SHOWN = 8
/** The sale board goes up below this share of the Goodwill. */
export const SALE_BOARD_BELOW = 0.25

export interface Doorstep {
  /** Parcels on the step now (leaks minus the ones carted back). */
  parcels: number
  /** Parcels the neighbours have carted back this level. */
  returned: number
  /** The 'Sorry we missed you' card is on the door (from the first leak until the step is swept). */
  card: boolean
  /** The current round has leaked. */
  leakedThisRound: boolean
}

export function newDoorstep(): Doorstep {
  return { parcels: 0, returned: 0, card: false, leakedThisRound: false }
}

/** A leak: a parcel lands on the step. */
export function doorstepLeak(d: Doorstep): void {
  d.parcels++
  d.card = true
  d.leakedThisRound = true
}

/** A round is called. */
export function doorstepRound(d: Doorstep): void {
  d.leakedThisRound = false
}

/** A round is cleared: after a clean one the neighbours cart a parcel back. True when they do. */
export function doorstepCleared(d: Doorstep): boolean {
  const clean = !d.leakedThisRound
  d.leakedThisRound = false
  if (!clean || d.parcels === 0) return false
  d.parcels--
  d.returned++
  return true
}

/** The win's harvest sweeps the step clear. */
export function doorstepSwept(d: Doorstep): void {
  d.parcels = 0
  d.card = false
}

/** The parcels drawn on the step and the count beyond them ('+N'). */
export function doorstepShown(d: Doorstep): { shown: number; extra: number } {
  const shown = Math.min(d.parcels, DOORSTEP_SHOWN)
  return { shown, extra: d.parcels - shown }
}

/** Hollowell's 'ACQUIRED' board stands at the gate while the Goodwill is under a quarter (and the farm isn't lost). */
export function saleBoard(goodwill: number, maxGoodwill: number): boolean {
  return goodwill > 0 && goodwill < maxGoodwill * SALE_BOARD_BELOW
}
