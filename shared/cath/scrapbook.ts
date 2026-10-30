// Cath's scrapbook (ROADMAP N27): one page per game, filled from the progress each save already holds.
// Pure: it takes `readProgress()` plus a few extras and returns the pages to show, so it is unit-tested.

import { WARDROBE, unlockedOutfits, type WardrobeProgress } from './wardrobe'

export interface ScrapPage {
  id: 'hedgerow' | 'runnel' | 'nightshift' | 'wardrobe'
  glyph: string
  title: string
  line: string
}

export interface ScrapExtras {
  /** Total Hedgerow stars earned. */
  hedgerowStars: number
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** Only pages with something in them; a first-time visitor gets none. */
export function scrapbookPages(p: WardrobeProgress, x: ScrapExtras): ScrapPage[] {
  const pages: ScrapPage[] = []
  if (p.hedgerowLevels > 0) {
    pages.push({
      id: 'hedgerow',
      glyph: '🌾',
      title: 'The hedgerow',
      line: `${plural(p.hedgerowLevels, 'level')} held and ${plural(x.hedgerowStars, 'star')} pinned to the page.`,
    })
  }
  if (p.runnelDays > 0) {
    pages.push({
      id: 'runnel',
      glyph: '🥕',
      title: "Bea's garden",
      line: `${plural(p.runnelDays, 'crop')} planted, one for every day the water ran.`,
    })
  }
  if (p.nightJobs > 0) {
    pages.push({
      id: 'nightshift',
      glyph: '📷',
      title: 'Case photos',
      line: `${plural(p.nightJobs, 'job')} closed in Hollowell, each with its polaroid.`,
    })
  }
  const worn = unlockedOutfits(p).length
  if (pages.length > 0) {
    pages.push({
      id: 'wardrobe',
      glyph: '🧥',
      title: 'The wardrobe',
      line: `${worn} of ${WARDROBE.length} outfits found so far.`,
    })
  }
  return pages
}
