// Plan item 479: the win's last knockout is held. The engine has already finished (a won game's `stepGame` is a
// no-op), so the hold lives on the render clock alone: replays, the tuner and the level tests never see it.

/** How long the knockout is held, in wall-clock ms. */
export const KNOCKOUT_MS = 700;
/** The render clock's rate while it is held. */
export const KNOCKOUT_RATE = 0.35;

/** Whether the win's knockout is held at all: never under reduced motion; under webdriver only with `?showdown`
 *  (specs keep their old timing otherwise). */
export function holdsKnockout(reduced: boolean, webdriver: boolean, search: string): boolean {
  return !reduced && (!webdriver || new URLSearchParams(search).has("showdown"));
}

/** The render step for a frame at `now`, slowed while the hold runs (until `until`, wall-clock ms). */
export function renderStep(dt: number, now: number, until: number): number {
  return now < until ? dt * KNOCKOUT_RATE : dt;
}
