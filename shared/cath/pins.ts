// Cath's market pins (ROADMAP 238): one keepsake per Marrow Market event, won by liberating Marrow while the
// event runs and worn by Cath in every game. Storage is two small keys, read defensively like the wardrobe.

export type CathPin = 'bunting' | 'weathervane' | 'turnip'

export const PINS: Record<CathPin, { name: string; event: string }> = {
  bunting: { name: 'Festival bunting', event: 'festival' },
  weathervane: { name: 'Rain-dance weathervane', event: 'drought' },
  turnip: { name: 'Golden turnip sign', event: 'glut' },
}

export const PINS_KEY = 'cath:pins'
export const PIN_KEY = 'cath:pin'

export const pinForEvent = (event: string | undefined): CathPin | null =>
  (Object.keys(PINS) as CathPin[]).find((p) => PINS[p].event === event) ?? null

export function earnedPins(storage: Pick<Storage, 'getItem'> = localStorage): CathPin[] {
  try {
    const raw = JSON.parse(storage.getItem(PINS_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((p): p is CathPin => typeof p === 'string' && p in PINS) : []
  } catch {
    return []
  }
}

/** Award the pin for an event; returns true if it is new. */
export function awardPin(event: string | undefined, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): boolean {
  const pin = pinForEvent(event)
  if (!pin) return false
  const have = earnedPins(storage)
  if (have.includes(pin)) return false
  try {
    storage.setItem(PINS_KEY, JSON.stringify([...have, pin]))
    storage.setItem(PIN_KEY, pin)
  } catch {
    return false
  }
  return true
}

/** The pin she wears: the latest earned one (a saved choice must still be earned), else none. */
export function chosenPin(storage: Pick<Storage, 'getItem'> = localStorage): CathPin | undefined {
  try {
    const want = storage.getItem(PIN_KEY)
    if (want && earnedPins(storage).includes(want as CathPin)) return want as CathPin
  } catch {
    // Blocked storage: no pin.
  }
  return undefined
}

export function pinSvg(pin: CathPin): string {
  switch (pin) {
    case 'bunting':
      return `<path fill="none" stroke="#7A3A48" stroke-width="1.2" d="M-14 -4 Q0 6 14 -4"/><path fill="#C9566B" stroke="#7A2A3A" stroke-width="0.9" d="M-12 -1 L-7 -1 L-9.5 6 Z"/><path fill="#E8B84A" stroke="#8A6A1E" stroke-width="0.9" d="M-3 2 L2 2 L-0.5 9 Z"/><path fill="#6FA37A" stroke="#3D6B49" stroke-width="0.9" d="M6 -1 L11 -1 L8.5 6 Z"/>`
    case 'weathervane':
      return `<path stroke="#6B5A3A" stroke-width="1.6" stroke-linecap="round" d="M0 10 L0 -10"/><path fill="#E8B84A" stroke="#8A6A1E" stroke-width="1" d="M0 -9 L12 -4 L0 1 Z"/><path fill="#8FB4D9" stroke="#3E6A92" stroke-width="0.9" d="M0 -9 L-7 -12 L-7 -3 Z"/><circle cy="-10" r="1.6" fill="#E8B84A"/>`
    case 'turnip':
      return `<path fill="#6FA37A" stroke="#3D6B49" stroke-width="1" d="M0 -3 C-5 -10 -9 -8 -7 -12 C-3 -11 0 -8 0 -3 C0 -8 3 -11 7 -12 C9 -8 5 -10 0 -3 Z"/><path fill="#F3C84A" stroke="#8A6A1E" stroke-width="1.1" d="M0 -3 C9 -3 11 8 0 12 C-11 8 -9 -3 0 -3 Z"/><path fill="#fff" opacity="0.55" d="M-5 2 C-5 -1 -3 -1 -2 -1 C-4 0 -4 3 -5 5 Z"/>`
  }
}
