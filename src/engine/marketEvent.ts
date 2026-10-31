// ROADMAP 232: weekly Marrow Market events. A fixed rotation by ISO week (UTC) picks one of three
// events; the chosen id rides in `GameConfig.marketEvent` so a game stays deterministic and replayable.
// An event makes two tags of Improvement 1 Mark cheaper (never below 1) and carries a Cath banner line.

export type MarketEventId = 'festival' | 'drought' | 'glut'

export interface MarketEvent {
  id: MarketEventId
  name: string
  cheap: string[] // Improvement tags that cost 1 less
  banner: string // Cath narrates
  cosmetic: string // the week's exclusive stall flag, shown on the Setup banner
}

export const MARKET_EVENTS: Record<MarketEventId, MarketEvent> = {
  festival: {
    id: 'festival',
    name: 'Harvest Festival',
    cheap: ['community', 'media'],
    banner: 'Bunting up, bands out. Anything that brings people together is going cheap today.',
    cosmetic: 'Festival bunting',
  },
  drought: {
    id: 'drought',
    name: 'Dry Spell',
    cheap: ['coast', 'science'],
    banner: 'Not a cloud in sight. The clever folk are selling their wells and gadgets at a bargain.',
    cosmetic: 'Rain-dance weathervane',
  },
  glut: {
    id: 'glut',
    name: 'Great Glut',
    cheap: ['pasture', 'crop'],
    banner: 'Too many cabbages, too many cows. Farm kit has never been so cheap.',
    cosmetic: 'Golden turnip sign',
  },
}

const ORDER: MarketEventId[] = ['festival', 'drought', 'glut']

/** Week number since the Unix epoch (UTC, Monday start): same for everyone in a given week. */
export function marketEventFor(now: Date): MarketEvent {
  const week = Math.floor((Math.floor(now.getTime() / 86400000) + 3) / 7)
  return MARKET_EVENTS[ORDER[week % ORDER.length]!]
}

export function eventDiscount(id: MarketEventId | undefined, tags: readonly string[] | undefined): number {
  if (!id || !tags) return 0
  return MARKET_EVENTS[id].cheap.some((t) => tags.includes(t)) ? 1 : 0
}
